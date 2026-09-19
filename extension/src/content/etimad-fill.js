// تنفيذ — التعبئة في اعتماد | Etimad content script
// Draws the Tanfeeth bar at the top of Etimad pages (sign in → choose a project →
// fill), and fills the current wizard page's fields from the stored payload.
// Everything is gated on being signed in to the extension.
// The extension NEVER clicks save/submit — the user always does that.

"use strict";

(function () {
  const STORAGE_KEY = "tanfeethEtimadFill";
  const LOG_KEY = "tanfeethFillLog";
  const SETTINGS_KEY = "tanfeethSettings";
  const MAX_AGE_MS = 2 * 60 * 60 * 1000; // ساعتان
  const AUTO_FILL_DELAY_MS = 1200; // let Etimad's own JS / select2 boot first

  // الافتراضات لازم تطابق popup.js — المستخدم يغيّرها من واجهة الإضافة.
  const DEFAULT_SETTINGS = { enabled: true, autoFill: true, showOverlay: true, fillCriteria: true };

  let bridgeInjected = false;
  let bridgeIdCounter = 0;
  let running = false;
  let settings = DEFAULT_SETTINGS;

  // ────────────────────────────────────────────────────────── utilities ──

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function storageGet(keys) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(keys, function (items) {
          resolve(items || {});
        });
      } catch (_e) {
        resolve({});
      }
    });
  }

  function storageSet(items) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.set(items, function () {
          resolve();
        });
      } catch (_e) {
        resolve();
      }
    });
  }

  function pageKey() {
    return location.pathname + location.search;
  }

  // اعتماد يرفض الأرقام العربية‑الهندية (٠١٢) في حقول التاريخ والأرقام،
  // ولوحة المفاتيح العربية تكتبها افتراضيًا. خط الدفاع الأخير قبل الكتابة
  // في أي حقل: كل رقم يصل اعتماد لاتيني. (نظائره في المنصة: backend
  // shared/domain/arabic-digits.ts و frontend-v2 lib/text/digits.ts)
  function toLatinDigits(s) {
    return String(s).replace(/[٠-٩۰-۹]/g, function (d) {
      const code = d.charCodeAt(0);
      return String(code - (code <= 0x0669 ? 0x0660 : 0x06f0));
    });
  }

  function normText(v) {
    return toLatinDigits(String(v == null ? "" : v)).trim();
  }

  // true / false / null (not boolean-ish)
  function toBool(value) {
    if (value === true || value === false) return value;
    const s = normText(value);
    if (s === "true" || s === "نعم") return true;
    if (s === "false" || s === "لا") return false;
    return null;
  }

  function findByName(name) {
    const list = document.getElementsByName(name);
    return list && list.length ? Array.prototype.slice.call(list) : [];
  }

  // صفحات اعتماد تحمل hidden inputs بنفس name عناصر ظاهرة (TenderName مثلًا
  // موجود text وhidden معًا) — الملء في المخفي يبدو ناجحًا في اللوج بينما
  // الحقل الظاهر يظل فارغًا. لذلك: العناصر المرندرة الظاهرة أولًا دائمًا.
  function isVisibleControl(el) {
    if (el.type === "hidden") return false;
    if (typeof el.getClientRects === "function" && !el.getClientRects().length) {
      return false;
    }
    return true;
  }

  function findField(key) {
    const named = findByName(key);
    if (named.length) {
      const visible = named.filter(isVisibleControl);
      return visible.length ? visible : named;
    }
    const byId = document.getElementById(key);
    return byId ? [byId] : [];
  }

  // Framework-proof value set: use the prototype's native setter so React /
  // Knockout / jQuery value-tracking wrappers don't swallow the change.
  function setNativeValue(el, value) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : el instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && typeof desc.set === "function") {
      desc.set.call(el, value);
    } else {
      el.value = value;
    }
  }

  function fireEvents(el, types) {
    (types || ["input", "change"]).forEach(function (type) {
      try {
        el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
      } catch (_e) {
        /* ignore */
      }
    });
  }

  // ─────────────────────────────────────────────── page-context jQuery ──

  function ensureBridge() {
    if (bridgeInjected) return;
    bridgeInjected = true;
    try {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("src/content/page-bridge.js");
      script.onload = function () {
        script.remove();
      };
      (document.head || document.documentElement).appendChild(script);
    } catch (err) {
      console.warn("[Tanfeeth] bridge injection failed:", err);
    }
  }

  // Tell page-world jQuery/select2 the select's value changed.
  function jquerySync(el, values) {
    try {
      ensureBridge();
      if (!el.hasAttribute("data-tanfeeth-id")) {
        bridgeIdCounter += 1;
        el.setAttribute("data-tanfeeth-id", String(bridgeIdCounter));
      }
      const detail = JSON.stringify({
        id: el.getAttribute("data-tanfeeth-id"),
        values: values,
      });
      document.dispatchEvent(new CustomEvent("tanfeeth:jquery-sync", { detail: detail }));
    } catch (err) {
      console.warn("[Tanfeeth] jquerySync failed:", err);
    }
  }

  // ─────────────────────────────────────────────────────── field fillers ──

  function labelTextFor(input) {
    try {
      if (input.id) {
        const forLabel = document.querySelector('label[for="' + CSS.escape(input.id) + '"]');
        if (forLabel) return forLabel.textContent || "";
      }
      const wrapping = input.closest("label");
      if (wrapping) return wrapping.textContent || "";
      if (input.parentElement) return input.parentElement.textContent || "";
    } catch (_e) {
      /* ignore */
    }
    return "";
  }

  function fillText(el, value) {
    setNativeValue(el, normText(value));
    fireEvents(el, ["input", "change"]);
    return { status: "filled", detail: normText(value).slice(0, 60) };
  }

  function fillSelectSingle(el, value) {
    const want = normText(value);
    const options = Array.prototype.slice.call(el.options || []);
    let match = options.find(function (o) {
      return normText(o.textContent) === want;
    });
    if (!match) {
      match = options.find(function (o) {
        return normText(o.value) === want;
      });
    }
    if (!match) return { status: "skipped", detail: "لا يوجد خيار مطابق: " + want.slice(0, 40) };

    setNativeValue(el, match.value);
    fireEvents(el, ["input", "change"]);
    jquerySync(el, match.value);
    return { status: "filled", detail: normText(match.textContent).slice(0, 60) };
  }

  function fillSelectMulti(el, value) {
    const wanted = (Array.isArray(value) ? value : [value]).map(normText).filter(Boolean);
    const options = Array.prototype.slice.call(el.options || []);
    const matchedValues = [];
    const matchedTexts = [];

    wanted.forEach(function (want) {
      let match = options.find(function (o) {
        return normText(o.textContent) === want;
      });
      if (!match) {
        match = options.find(function (o) {
          return normText(o.value) === want;
        });
      }
      if (match) {
        match.selected = true;
        matchedValues.push(match.value);
        matchedTexts.push(normText(match.textContent));
      }
    });

    if (!matchedValues.length) {
      return { status: "skipped", detail: "لا توجد خيارات مطابقة (" + wanted.length + " مطلوب)" };
    }
    fireEvents(el, ["change"]);
    jquerySync(el, matchedValues);
    const missed = wanted.length - matchedValues.length;
    return {
      status: "filled",
      detail: matchedTexts.join("، ").slice(0, 80) + (missed ? " (+" + missed + " غير مطابق)" : ""),
    };
  }

  function fillRadio(elements, value) {
    const radios = elements.filter(function (el) {
      return el.type === "radio";
    });
    if (!radios.length) return { status: "skipped", detail: "لا توجد أزرار اختيار" };

    const bool = toBool(value);
    let target = null;

    if (bool !== null) {
      // Etimad convention: true → value="true" / label «نعم», false → «لا».
      target = radios.find(function (r) {
        return normText(r.value).toLowerCase() === String(bool);
      });
      if (!target) {
        const wantLabel = bool ? "نعم" : "لا";
        target = radios.find(function (r) {
          return labelTextFor(r).indexOf(wantLabel) !== -1;
        });
      }
    } else {
      const want = normText(value);
      target = radios.find(function (r) {
        return normText(r.value) === want;
      });
      if (!target) {
        target = radios.find(function (r) {
          return labelTextFor(r).indexOf(want) !== -1;
        });
      }
    }

    if (!target) return { status: "skipped", detail: "لا يوجد زر مطابق: " + normText(value).slice(0, 40) };

    if (!target.checked) {
      try {
        target.click(); // click drives Etimad's own show/hide handlers
      } catch (_e) {
        target.checked = true;
        fireEvents(target, ["input", "change"]);
      }
      if (!target.checked) {
        target.checked = true;
        fireEvents(target, ["input", "change"]);
      }
    }
    return { status: "filled", detail: labelTextFor(target).trim().slice(0, 60) || normText(target.value) };
  }

  function fillCheckbox(el, value) {
    const desired = toBool(value);
    if (desired === null) return { status: "skipped", detail: "قيمة غير منطقية لمربع اختيار" };
    if (el.checked !== desired) {
      try {
        el.click();
      } catch (_e) {
        el.checked = desired;
        fireEvents(el, ["input", "change"]);
      }
      if (el.checked !== desired) {
        el.checked = desired;
        fireEvents(el, ["input", "change"]);
      }
    }
    return { status: "filled", detail: desired ? "مفعّل" : "غير مفعّل" };
  }

  // Date text input, optionally paired with a "ميلادي" toggle checkbox
  // named/id'd cb_<FieldName>. Calendar hint comes from "<key>__calendar".
  async function fillDate(el, key, value, calendarHint) {
    if (calendarHint) {
      const cb =
        findByName("cb_" + key).find(function (c) {
          return c.type === "checkbox";
        }) || document.getElementById("cb_" + key);
      if (cb) {
        const wantGregorian = normText(calendarHint) === "ميلادي";
        if (cb.checked !== wantGregorian) {
          try {
            cb.click();
          } catch (_e) {
            cb.checked = wantGregorian;
            fireEvents(cb, ["change"]);
          }
          await sleep(250); // datepicker re-initializes on toggle
        }
      }
    }
    return fillText(el, value);
  }

  async function fillField(key, value, etimadFields) {
    const meta = ETIMAD_FIELD_META[key] || {};
    if (meta.control === "data") return { status: "skipped", detail: "حقل قراءة فقط (data)" };

    const elements = findField(key);
    if (!elements.length) return { status: "skipped", detail: "غير موجود في هذه الصفحة" };

    const el = elements[0];
    const tag = (el.tagName || "").toLowerCase();
    const type = (el.type || "").toLowerCase();
    const calendarHint = etimadFields[key + "__calendar"];

    // radio group?
    if (type === "radio" || meta.control === "radio") {
      return fillRadio(elements, value);
    }
    if (type === "checkbox" || meta.control === "checkbox") {
      return fillCheckbox(el, value);
    }
    if (tag === "select") {
      const multi = el.multiple || meta.control === "multiselect" || Array.isArray(value);
      return multi ? fillSelectMulti(el, value) : fillSelectSingle(el, value);
    }
    if (meta.control === "date" || calendarHint != null) {
      return await fillDate(el, key, value, calendarHint);
    }
    if (tag === "input" || tag === "textarea") {
      return fillText(el, value);
    }
    return { status: "skipped", detail: "عنصر غير مدعوم <" + tag + ">" };
  }

  // onProgress(done, total, label) — يغذي شريط التقدم في شريط تنفيذ.
  async function runFill(record, onProgress) {
    if (running) return null;
    running = true;
    try {
      return await runFillUnsafe(record, onProgress || function () {});
    } finally {
      running = false;
    }
  }

  async function runFillUnsafe(record, onProgress) {

    const etimadFields = (record.payload && record.payload.etimadFields) || {};
    // الحمولة الخام: المركّبات المتكررة (معايير التقييم) ليست حقولًا مسطّحة
    // لها `name`، فمحرك name→value لا يراها — تُقرأ من هنا.
    const rawPayload = (record.payload && record.payload.raw) || {};
    const rows = [];
    let filled = 0;
    let skipped = 0;
    let failed = 0;

    const keys = Object.keys(etimadFields).filter(function (k) {
      return !k.endsWith("__calendar");
    });

    const total = keys.length + (settings.fillCriteria ? 1 : 0);
    let done = 0;
    for (const key of keys) {
      onProgress(done++, total, "الحقول");
      let result;
      try {
        result = await fillField(key, etimadFields[key], etimadFields);
      } catch (err) {
        result = { status: "failed", detail: String(err && err.message ? err.message : err).slice(0, 80) };
      }
      if (result.status === "filled") filled += 1;
      else if (result.status === "failed") failed += 1;
      else skipped += 1;
      rows.push({
        key: key,
        step: (ETIMAD_FIELD_META[key] || {}).step || "?",
        status: result.status,
        detail: result.detail || "",
      });
      await sleep(60); // let Etimad's cascading handlers breathe
    }

    // معايير التقييم — واجهة إضافة متكررة، تُنفَّذ بعد الحقول المسطّحة لأن
    // «آلية الاجتياز الفني» تُضبط ضمنها.
    if (!settings.fillCriteria) {
      rows.push({
        key: "معايير التقييم",
        step: "معايير التقييم",
        status: "note",
        detail: "متوقفة من إعدادات الإضافة",
      });
    } else {
      try {
        onProgress(done, total, "معايير التقييم");
        const criteria = await TNF_CRITERIA.fill(rawPayload, jquerySync);
        if (criteria.applicable) {
          criteria.rows.forEach(function (r) {
            if (r.status === "filled") filled += 1;
            else if (r.status === "failed") failed += 1;
            else skipped += 1;
            rows.push({ key: r.key, step: "معايير التقييم", status: r.status, detail: r.detail });
          });
          criteria.notes.forEach(function (note) {
            rows.push({ key: "ملاحظة", step: "معايير التقييم", status: "note", detail: note });
          });
        }
      } catch (err) {
        failed += 1;
        rows.push({
          key: "معايير التقييم",
          step: "معايير التقييم",
          status: "failed",
          detail: String(err && err.message ? err.message : err).slice(0, 120),
        });
      }
    }

    try {
      console.groupCollapsed(
        "[Tanfeeth → Etimad] " + pageKey() + " — filled " + filled + ", skipped " + skipped + ", failed " + failed
      );
      console.table(rows);
      console.groupEnd();
    } catch (_e) {
      /* ignore */
    }

    // per-page fill log so reloads of the same step don't re-run automatically
    const items = await storageGet([LOG_KEY]);
    const log = items[LOG_KEY] || {};
    // تُحفَظ التفاصيل أيضًا لأن واجهة الإضافة (popup) تعرض «آخر تعبئة» منها.
    log[pageKey()] = {
      filled: filled,
      skipped: skipped,
      failed: failed,
      at: Date.now(),
      rows: rows.map(function (r) {
        return { key: r.key, status: r.status, detail: String(r.detail || "").slice(0, 120) };
      }),
    };
    const patch = {};
    patch[LOG_KEY] = log;
    await storageSet(patch);

    onProgress(total, total, "");
    return { filled: filled, skipped: skipped, failed: failed };
  }


  // ────────────────────────────────────────────────────── شريط تنفيذ ──
  // شريط عائم أعلى الصفحة داخل Shadow DOM: حال الدخول، والمشروع الجاهز،
  // وزر «تعبئة الحقول»، وفتح المساعد. يُصغَّر إلى زر دائري في الزاوية.

  const UI = TNF_UI;

  const BAR_CSS = [
    ".frame{position:fixed;inset:0;border:2px solid var(--green);pointer-events:none;z-index:2147483646}",
    ".bar{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;align-items:center;gap:10px;width:max-content;max-width:min(94vw,760px);padding:7px 8px 7px 8px;padding-inline-start:8px;background:var(--paper);border:1px solid var(--line);border-radius:999px;box-shadow:0 10px 30px -14px rgba(15,21,20,.22);animation:tnf-drop 260ms cubic-bezier(.22,1,.36,1);overflow:hidden}",
    "@keyframes tnf-drop{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}",
    ".disc{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:999px;background:var(--green)}",
    ".txt{min-width:0;display:flex;flex-direction:column;line-height:1.35;padding-inline-end:4px}",
    ".t{font-family:'TNF Display','TNF Body',system-ui,sans-serif;font-weight:700;font-size:13px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:360px}",
    ".s{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:380px}",
    ".s.ok{color:var(--success)}",
    ".s.warn{color:var(--warning)}",
    ".acts{display:flex;align-items:center;gap:2px;flex:none}",
    ".acts .btn{margin-inline-end:4px}",
    ".sep{width:1px;height:20px;background:var(--line);margin:0 4px}",
    ".progress{position:absolute;inset-inline:0;bottom:0;height:2px;background:transparent}",
    ".progress>i{display:block;height:100%;background:var(--leaf);transition:width 200ms ease;width:0}",
    ".fab{position:fixed;bottom:20px;inset-inline-start:20px;z-index:2147483647;display:grid;place-items:center;width:52px;height:52px;border-radius:999px;background:var(--green);box-shadow:0 10px 30px -14px rgba(15,21,20,.35);border:1px solid rgba(255,255,255,.12)}",
    ".fab:hover{background:var(--green-deep)}",
    ".fab .dot{position:absolute;top:4px;inset-inline-end:4px;width:11px;height:11px;border-radius:999px;background:var(--leaf);border:2px solid var(--paper)}",
    "@media (max-width:640px){.t,.s{max-width:150px}.btn span{display:none}.btn{padding:0 10px}}",
  ].join("\n");

  const view = {
    auth: { signedIn: false },
    record: null, // حمولة صالحة (أحدث من ساعتين) أو null
    log: {},
    phase: "idle", // idle | filling | done
    progress: 0,
    progressLabel: "",
    summary: null,
    collapsed: false,
    hint: "",
  };
  let host = null; // { host, root }
  let pendingAutoFill = false;
  let lastSavedAt = null;

  function validRecord(record) {
    if (!record || !record.savedAt) return null;
    return Date.now() - record.savedAt > MAX_AGE_MS ? null : record;
  }

  function alreadyFilled() {
    return view.log && view.log[pageKey()] ? view.log[pageKey()] : null;
  }

  function barVisible() {
    return settings.enabled && settings.showOverlay;
  }

  function destroyHost() {
    if (host) host.host.remove();
    host = null;
  }

  function button(cls, iconName, label, onClick, opts) {
    const b = UI.el("button", cls);
    b.type = "button";
    const ic = UI.icon(iconName, cls.indexOf("icon-btn") !== -1 ? 17 : 15);
    if (opts && opts.spin) ic.classList.add("spin");
    b.appendChild(ic);
    if (label && cls.indexOf("icon-btn") === -1) b.appendChild(UI.el("span", null, label));
    if (label) {
      b.setAttribute("aria-label", label);
      b.title = label;
    }
    if (opts && opts.disabled) b.disabled = true;
    b.addEventListener("click", onClick);
    return b;
  }

  async function openPanel(target) {
    const ok = await UI.openPanel(target);
    if (!ok) {
      view.hint = "اضغط أيقونة تنفيذ في شريط أدوات المتصفح لفتح المساعد";
      render();
    }
  }

  async function setCollapsed(value) {
    view.collapsed = value;
    const items = await storageGet([UI.KEYS.prefs]);
    const prefs = Object.assign({}, items[UI.KEYS.prefs] || {}, { launcherCollapsed: value });
    await storageSet({ [UI.KEYS.prefs]: prefs });
    render();
  }

  function render() {
    if (!barVisible()) {
      destroyHost();
      return;
    }
    if (!host) host = UI.createHost("bar", BAR_CSS);
    const root = host.root;
    Array.prototype.slice.call(root.childNodes).forEach(function (n) {
      if (n.tagName !== "STYLE") n.remove();
    });

    const wrap = UI.el("div", "tnf");
    root.appendChild(wrap);
    const controlled = view.auth.signedIn && view.record;
    if (controlled) wrap.appendChild(UI.el("div", "frame"));

    if (view.collapsed) {
      const fab = UI.el("button", "fab");
      fab.type = "button";
      fab.setAttribute("aria-label", "إظهار شريط تنفيذ");
      fab.title = "تنفيذ";
      fab.appendChild(UI.mark(18, "mono"));
      if (controlled && view.phase !== "done") fab.appendChild(UI.el("span", "dot"));
      fab.addEventListener("click", function () {
        setCollapsed(false);
      });
      wrap.appendChild(fab);
      return;
    }

    const bar = UI.el("div", "bar");
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "شريط تنفيذ");
    const disc = UI.el("span", "disc");
    disc.appendChild(UI.mark(15, "mono"));
    bar.appendChild(disc);

    const txt = UI.el("div", "txt");
    const acts = UI.el("div", "acts");
    let title = "تنفيذ";
    let sub = "";
    let subTone = "";

    if (!view.auth.signedIn) {
      title = "تنفيذ — التعبئة في اعتماد";
      sub = "سجل الدخول بحساب تنفيذ لتفعيل التعبئة والمساعد";
      acts.appendChild(button("btn btn-primary", "login", "تسجيل الدخول", function () { openPanel("login"); }));
    } else if (!view.record) {
      title = "لا يوجد مشروع جاهز للتعبئة";
      sub = "اختر مشروعا من تنفيذ وسنملأ صفحات اعتماد عنك";
      acts.appendChild(button("btn btn-primary", "folder", "اختيار مشروع", function () { openPanel("projects"); }));
      acts.appendChild(button("icon-btn", "sparkles", "المساعد", function () { openPanel("chat"); }));
    } else {
      title = (view.record.meta && view.record.meta.title) || "مشروع من تنفيذ";
      const prev = alreadyFilled();
      if (view.phase === "filling") {
        sub = (view.progressLabel ? "جار تعبئة " + view.progressLabel : "جار التعبئة") + "…";
        acts.appendChild(button("btn btn-primary", "loader", "جار التعبئة", function () {}, { spin: true, disabled: true }));
      } else {
        if (view.phase === "done" && view.summary) {
          if (view.summary.filled > 0) {
            sub = "تمت تعبئة " + view.summary.filled + " حقلا" + (view.summary.failed ? " وتعذر " + view.summary.failed : "") + " — راجع ثم اضغط «حفظ ومتابعة»";
            subTone = view.summary.failed ? "warn" : "ok";
          } else {
            sub = "لا توجد حقول مطابقة في هذه الصفحة — انتقل إلى خطوة أخرى";
            subTone = "warn";
          }
        } else if (prev) {
          sub = "سبق تعبئة هذه الصفحة (" + prev.filled + " حقلا) — يمكنك إعادة التعبئة";
        } else {
          sub = settings.autoFill ? "جاهز — تبدأ التعبئة تلقائيا" : "جاهز للتعبئة — راجع ثم احفظ بنفسك";
        }
        const again = view.phase === "done" || Boolean(prev);
        acts.appendChild(button("btn btn-primary", again ? "refresh" : "fill", again ? "إعادة التعبئة" : "تعبئة الحقول", function () { fillNow(); }));
      }
      acts.appendChild(button("icon-btn", "list", "تفاصيل التعبئة", function () { openPanel("fill"); }));
      acts.appendChild(button("icon-btn", "folder", "تغيير المشروع", function () { openPanel("projects"); }));
      acts.appendChild(button("icon-btn", "sparkles", "المساعد", function () { openPanel("chat"); }));
    }

    if (view.hint) {
      sub = view.hint;
      subTone = "warn";
    }

    txt.appendChild(UI.el("span", "t", title));
    txt.appendChild(UI.el("span", "s" + (subTone ? " " + subTone : ""), sub));
    bar.appendChild(txt);
    acts.appendChild(UI.el("span", "sep"));
    acts.appendChild(button("icon-btn", "minus", "تصغير", function () { setCollapsed(true); }));
    bar.appendChild(acts);

    if (view.phase === "filling") {
      const track = UI.el("div", "progress");
      const fillEl = document.createElement("i");
      fillEl.style.width = Math.round(view.progress * 100) + "%";
      track.appendChild(fillEl);
      bar.appendChild(track);
    }
    wrap.appendChild(bar);
  }

  async function fillNow() {
    if (!view.auth.signedIn) return { ok: false, reason: "AUTH_REQUIRED" };
    if (!view.record) return { ok: false, reason: "NO_RECORD" };
    if (running) return { ok: false, reason: "BUSY" };
    pendingAutoFill = false;
    view.phase = "filling";
    view.progress = 0;
    view.hint = "";
    render();
    let summary = null;
    try {
      summary = await runFill(view.record, function (done, total, label) {
        view.progress = total ? done / total : 1;
        view.progressLabel = label;
        render();
      });
    } catch (err) {
      console.warn("[Tanfeeth] fill error:", err);
    }
    const items = await storageGet([LOG_KEY]);
    view.log = items[LOG_KEY] || {};
    view.summary = summary;
    view.phase = summary ? "done" : "idle";
    render();
    return { ok: Boolean(summary), summary: summary };
  }

  function maybeAutoFill() {
    if (!settings.enabled || !settings.autoFill) return;
    if (!view.auth.signedIn || !view.record || alreadyFilled()) return;
    if (document.visibilityState !== "visible") {
      pendingAutoFill = true; // تبويبات اعتماد الخلفية تملأ حين يفتحها المستخدم
      return;
    }
    setTimeout(function () {
      fillNow().catch(function (err) {
        console.warn("[Tanfeeth] auto-fill error:", err);
      });
    }, AUTO_FILL_DELAY_MS);
  }

  /** ملخص الصفحة للمساعد: العنوان والخطوة والحقول الظاهرة. */
  function pageContext() {
    const visible = function (n) {
      return n && n.getClientRects().length > 0;
    };
    const texts = function (selector, limit) {
      const out = [];
      document.querySelectorAll(selector).forEach(function (n) {
        if (out.length >= limit || !visible(n)) return;
        const t = normText(n.textContent).replace(/\s+/g, " ").replace(/\*/g, "").trim();
        if (t && t.length <= 80 && out.indexOf(t) === -1) out.push(t);
      });
      return out;
    };
    return {
      url: location.origin + location.pathname,
      title: document.title,
      headings: texts("h1, h2, h3, h4, .active .step-title, li.active", 6),
      labels: texts("label", 45),
      record: view.record && view.record.meta ? { title: view.record.meta.title || "" } : null,
      lastFill: alreadyFilled(),
    };
  }

  async function loadState() {
    const items = await storageGet([STORAGE_KEY, LOG_KEY, SETTINGS_KEY, UI.KEYS.prefs]);
    settings = Object.assign({}, DEFAULT_SETTINGS, items[SETTINGS_KEY] || {});
    view.record = validRecord(items[STORAGE_KEY]);
    view.log = items[LOG_KEY] || {};
    view.collapsed = Boolean((items[UI.KEYS.prefs] || {}).launcherCollapsed);
    view.auth = await UI.authState();
    lastSavedAt = view.record ? view.record.savedAt : null;
  }

  async function init() {
    await loadState();
    render();
    maybeAutoFill();
  }

  // ─────────────────────────────────────────────────────── الرسائل ──

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (!message) return false;
    if (message.type === "TNF_FILL_NOW") {
      fillNow().then(sendResponse, function () {
        sendResponse({ ok: false });
      });
      return true;
    }
    if (message.type === "TNF_PAGE_CONTEXT") {
      sendResponse(pageContext());
      return false;
    }
    return false;
  });

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local") return;
    (async function () {
      if (changes[SETTINGS_KEY]) {
        settings = Object.assign({}, DEFAULT_SETTINGS, changes[SETTINGS_KEY].newValue || {});
      }
      let signedInNow = false;
      if (changes[UI.KEYS.session]) {
        const wasSignedIn = view.auth.signedIn;
        view.auth = await UI.authState();
        signedInNow = !wasSignedIn && view.auth.signedIn;
        if (!view.auth.signedIn) view.phase = "idle";
      }
      if (changes[LOG_KEY]) view.log = changes[LOG_KEY].newValue || {};
      if (changes[UI.KEYS.prefs]) {
        view.collapsed = Boolean((changes[UI.KEYS.prefs].newValue || {}).launcherCollapsed);
      }
      let newRecord = false;
      if (changes[STORAGE_KEY]) {
        view.record = validRecord(changes[STORAGE_KEY].newValue);
        const savedAt = view.record ? view.record.savedAt : null;
        newRecord = Boolean(savedAt) && savedAt !== lastSavedAt;
        lastSavedAt = savedAt;
        if (newRecord || !view.record) {
          view.phase = "idle";
          view.summary = null;
        }
      }
      view.hint = "";
      render();
      if (newRecord || signedInNow) maybeAutoFill();
    })().catch(function (err) {
      console.warn("[Tanfeeth] state sync error:", err);
    });
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && pendingAutoFill) {
      pendingAutoFill = false;
      maybeAutoFill();
    }
  });

  try {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        init().catch(function (err) {
          console.warn("[Tanfeeth] init error:", err);
        });
      });
    } else {
      init().catch(function (err) {
        console.warn("[Tanfeeth] init error:", err);
      });
    }
  } catch (err) {
    console.warn("[Tanfeeth] fatal:", err);
  }
})();
