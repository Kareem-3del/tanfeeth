// تنفيذ — التعبئة في اعتماد | Etimad content script
// Draws the "controlled by Tanfeeth" frame + badge, and fills the current
// wizard page's fields from the payload captured on the Tanfeeth origin.
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
  let ui = null; // { frame, badge, textEl, fillBtn }
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
      script.src = chrome.runtime.getURL("src/page-bridge.js");
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

  async function runFill(record) {
    if (running) return null;
    running = true;
    setBadgeText("جارٍ تعبئة الحقول...");

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

    for (const key of keys) {
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
        setBadgeText("جارٍ إضافة معايير التقييم...");
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

    running = false;
    return { filled: filled, skipped: skipped, failed: failed };
  }

  // ───────────────────────────────────────────────────────────── overlay ──

  function svgIcon(pathD, size) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", String(size || 16));
    svg.setAttribute("height", String(size || 16));
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2.2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", pathD);
    svg.appendChild(path);
    return svg;
  }

  function setBadgeText(text) {
    if (ui && ui.textEl) ui.textEl.textContent = text;
  }

  function setFillButtonLabel(label) {
    if (ui && ui.fillBtnLabel) ui.fillBtnLabel.textContent = label;
  }

  function removeOverlay() {
    if (!ui) return;
    try {
      ui.frame.remove();
      ui.badge.remove();
    } catch (_e) {
      /* ignore */
    }
    ui = null;
  }

  function buildOverlay(onFill) {
    if (ui) return;

    const frame = document.createElement("div");
    frame.className = "tnf-frame";
    frame.setAttribute("aria-hidden", "true");

    const badge = document.createElement("div");
    badge.className = "tnf-badge";
    badge.setAttribute("dir", "rtl");
    badge.setAttribute("role", "status");

    // shield-check mark
    const logo = svgIcon("M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z M9 12l2 2 4-4", 18);
    logo.classList.add("tnf-badge-logo");
    badge.appendChild(logo);

    const textEl = document.createElement("span");
    textEl.className = "tnf-badge-text";
    textEl.textContent = "هذه الصفحة تحت تحكم إضافة تنفيذ — البيانات جاهزة للتعبئة";
    badge.appendChild(textEl);

    const fillBtn = document.createElement("button");
    fillBtn.type = "button";
    fillBtn.className = "tnf-btn";
    const fillIcon = svgIcon("M12 5v14 M5 12h14", 14); // plus → "fill"
    fillBtn.appendChild(fillIcon);
    const fillBtnLabel = document.createElement("span");
    fillBtnLabel.textContent = "تعبئة الحقول";
    fillBtn.appendChild(fillBtnLabel);
    fillBtn.addEventListener("click", function () {
      onFill();
    });
    badge.appendChild(fillBtn);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "tnf-close";
    closeBtn.setAttribute("aria-label", "إخفاء شريط تنفيذ");
    closeBtn.appendChild(svgIcon("M6 6l12 12 M18 6L6 18", 14));
    closeBtn.addEventListener("click", removeOverlay);
    badge.appendChild(closeBtn);

    (document.body || document.documentElement).appendChild(frame);
    (document.body || document.documentElement).appendChild(badge);

    ui = { frame: frame, badge: badge, textEl: textEl, fillBtn: fillBtn, fillBtnLabel: fillBtnLabel };
  }

  // ──────────────────────────────────────────────────────────────── boot ──

  async function init() {
    const items = await storageGet([STORAGE_KEY, LOG_KEY, SETTINGS_KEY]);
    settings = Object.assign({}, DEFAULT_SETTINGS, items[SETTINGS_KEY] || {});
    if (!settings.enabled) return; // موقوفة من واجهة الإضافة → لا إطار ولا تعبئة

    const record = items[STORAGE_KEY];
    if (!record || !record.savedAt) return; // nothing captured → stay silent

    const age = Date.now() - record.savedAt;
    if (age > MAX_AGE_MS) {
      // stale payload (> ساعتين) → ignore it entirely
      return;
    }

    const log = items[LOG_KEY] || {};
    const alreadyFilled = Boolean(log[pageKey()]);

    const doFill = async function () {
      const summary = await runFill(record);
      if (!summary) return;
      if (summary.filled > 0) {
        setBadgeText("تم تعبئة " + summary.filled + " حقلًا — راجع واضغط حفظ ومتابعة");
      } else {
        setBadgeText("لا توجد حقول مطابقة في هذه الصفحة — انتقل لخطوة أخرى من المعالج");
      }
      setFillButtonLabel("إعادة التعبئة");
    };

    // إخفاء الشريط لا يعني إيقاف التعبئة — «التعبئة التلقائية» هي التي تقرر.
    if (settings.showOverlay) buildOverlay(doFill);

    const title = record.meta && record.meta.title ? " (" + record.meta.title + ")" : "";
    if (alreadyFilled) {
      const prev = log[pageKey()];
      setBadgeText("سبق تعبئة هذه الصفحة (" + prev.filled + " حقلًا)" + title + " — يمكنك إعادة التعبئة");
      setFillButtonLabel("إعادة التعبئة");
      return;
    }

    setBadgeText("هذه الصفحة تحت تحكم إضافة تنفيذ — البيانات جاهزة للتعبئة" + title);
    if (!settings.autoFill) {
      if (!ui) return; // بلا شريط وبلا تعبئة تلقائية → لا شيء يُفعَل
      setBadgeText("البيانات جاهزة — اضغط «تعبئة الحقول»" + title);
      return;
    }
    setTimeout(function () {
      doFill().catch(function (err) {
        console.warn("[Tanfeeth] auto-fill error:", err);
      });
    }, AUTO_FILL_DELAY_MS);
  }

  // تغيير الإعدادات من واجهة الإضافة ينعكس فورًا على الصفحة المفتوحة.
  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== "local" || !changes[SETTINGS_KEY]) return;
      const next = Object.assign({}, DEFAULT_SETTINGS, changes[SETTINGS_KEY].newValue || {});
      const wasVisible = settings.enabled && settings.showOverlay;
      settings = next;
      const isVisible = next.enabled && next.showOverlay;
      if (wasVisible && !isVisible) removeOverlay();
      else if (!wasVisible && isVisible && !running) {
        init().catch(function () {
          /* ignore */
        });
      }
    });
  } catch (_e) {
    /* ignore */
  }

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
