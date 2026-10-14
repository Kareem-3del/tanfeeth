// تنفيذ — استفسارات الموردين في اعتماد (سحب ← تنفيذ، وكتابة الردود المعتمدة ← اعتماد)
// • تفاصيل المنافسة (/Tender/Details، /Tender/DetailsForAll): شريط تنفيذ يعرض
//   «مزامنة الاستفسارات (N)». نقرأ القائمة كاملة من جزء اعتماد نفسه
//   (/Tender/GetEnquiryViewComponenet — نفس طلب تبويب «الإستفسارات»، بجلسة المستخدم)
//   فتعمل حتى لو لم يُفتح التبويب، وإلا من #inquiriesDiv المرسوم.
// • «إستفسارات الموردين» (/Enquiry/SupplierEnquiryList): نطابق الأرقام المرجعية مع
//   تنفيذ، ونضع على كل بطاقة مطابقة شارة صغيرة بزر «مزامنة»، و«مزامنة الكل» في الشريط.
// • صفحة الرد (/Enquiry/SupplierEnquiriesOnTender/<id>): بنيتها غير موثقة لدينا —
//   الكتابة فيها تخمينية: نبحث عن خانة نص داخل كتلة الاستفسار، وإلا زر النسخ فقط.
// الكتابة: نملأ خانة الرد الفارغة فقط ونحدد الكتلة بلون تنفيذ — ولا نضغط «إرسال»
// أو «اعتماد» أبدا (R-03): الموظف يراجع ويرسل بنفسه، والمزامنة التالية ترى الرد منشورا.
// الرموز لا تقترب من هنا — الخلفية تنادي الخادم (TNF_INQ_MATCH/SYNC/INJECTED).

"use strict";

(function () {
  const UI = TNF_UI;
  const P = TNF_INQ_PARSE;

  const path = location.pathname;
  const PAGE = /^\/Tender\/Details(ForAll)?\/?$/i.test(path)
    ? "details"
    : /^\/Enquiry\/SupplierEnquiryList\/?$/i.test(path)
      ? "list"
      : /^\/Enquiry\/SupplierEnquiriesOnTender\/[^/]+/i.test(path)
        ? "reply"
        : null;
  if (!PAGE) return;

  const STORE_KEY = UI.KEYS.inquiries;
  const MAX_RECORDS = 30;
  // الردود الجاهزة من آخر مزامنة صالحة ساعتين — بعدها نطلب مزامنة جديدة حتى لا
  // يُكتب في اعتماد رد عُدِّل في تنفيذ بعد ذلك.
  const WRITES_MAX_AGE_MS = 2 * 60 * 60 * 1000;
  const ACCENT = "#00665E";
  const DRAFT_LABEL = "مسودة من تنفيذ — راجِع ثم أرسل";
  const FRAGMENT_PATH = "/Tender/GetEnquiryViewComponenet?tenderIdStr="; // كذا في اعتماد

  // ────────────────────────────────────────────────────────── الحال ──

  const view = {
    phase: "idle", // idle | counting | syncing | synced | writing | written | error
    meta: { reference: null, tenderName: null, tenderId: null },
    total: null, // عدد الاستفسارات في اعتماد إن عُرف
    record: null, // آخر مزامنة مخزنة لهذه المنافسة
    // هل للمنافسة مشروعٌ في تنفيذ؟ checking | matched | none | unknown
    // الاستفسارات تبعُ مشروعها: منافسةٌ لا مشروع لها في تنفيذ لا يُعرض لها سحب.
    competition: { state: "checking", title: null },
    message: "",
    tone: "",
    // صفحة القائمة
    cards: [], // [{ card, item, match, phase, message, record, host }]
    matching: false,
    bulk: null, // { done, total, created, writes, failed }
  };

  // ──────────────────────────────────────────────────────── أدوات ──

  function plural(n, one, many) {
    return n + " " + (n === 1 ? one : many);
  }

  /** «قبل 3 دقائق» — نفس صياغة ago() في اللوحة (panel/dom.js). */
  function agoText(at) {
    const sec = Math.max(0, Math.floor((Date.now() - at) / 1000));
    if (sec < 45) return "الآن";
    const m = Math.round(sec / 60);
    if (m < 60) return "قبل " + m + (m === 1 ? " دقيقة" : m === 2 ? " دقيقتين" : m <= 10 ? " دقائق" : " دقيقة");
    const hrs = Math.floor(m / 60);
    if (hrs < 24) return "قبل " + hrs + (hrs === 1 ? " ساعة" : hrs === 2 ? " ساعتين" : " ساعات");
    const days = Math.floor(hrs / 24);
    return "قبل " + days + (days === 1 ? " يوم" : days === 2 ? " يومين" : " أيام");
  }

  function liveWrites(record) {
    if (!record || !Array.isArray(record.writes) || !record.at) return [];
    return Date.now() - record.at > WRITES_MAX_AGE_MS ? [] : record.writes;
  }

  /** ملخص المزامنة بسطر واحد: «18 جديد · 5 ردود جاهزة للكتابة». */
  function summaryText(summary, writes) {
    const s = summary || {};
    const parts = [];
    if (s.created) parts.push(s.created + " جديد");
    if (writes) parts.push(writes === 1 ? "رد واحد جاهز للكتابة" : writes + " ردود جاهزة للكتابة");
    if (s.publishedNow) parts.push(s.publishedNow + " نُشر في اعتماد");
    if (s.drift) parts.push(s.drift + " يخالف المعتمد في تنفيذ");
    if (parts.length) return parts.join(" · ");
    return "متزامنة — " + plural(Number(s.seen || 0), "استفسار", "استفسارا") + " ولا جديد";
  }

  // ─────────────────────────────────────────────────────── التخزين ──
  // tanfeethInquirySync = { byRef: { <مرجع>: سجل }, tenderRefs: { <STenderId>: <مرجع> } }

  async function readStore() {
    const items = await UI.storageGet([STORE_KEY]);
    const s = items[STORE_KEY] || {};
    return { byRef: s.byRef || {}, tenderRefs: s.tenderRefs || {} };
  }

  async function writeStore(mutate) {
    const store = await readStore();
    mutate(store);
    const refs = Object.keys(store.byRef).sort(function (a, b) {
      return (store.byRef[b].at || 0) - (store.byRef[a].at || 0);
    });
    refs.slice(MAX_RECORDS).forEach(function (r) {
      delete store.byRef[r];
    });
    const tenderIds = Object.keys(store.tenderRefs);
    if (tenderIds.length > 300) tenderIds.slice(0, tenderIds.length - 300).forEach(function (t) {
      delete store.tenderRefs[t];
    });
    await UI.storageSet({ [STORE_KEY]: store });
    return store;
  }

  // ───────────────────────────────────────────────────── قراءة اعتماد ──

  /** جزء الاستفسارات كما يطلبه اعتماد نفسه — مستند مستقل بعد DOMParser. */
  async function fetchFragment(tenderId) {
    const res = await fetch(FRAGMENT_PATH + encodeURIComponent(tenderId), {
      credentials: "same-origin",
      headers: { "X-Requested-With": "XMLHttpRequest", Accept: "text/html" },
    });
    if (!res.ok) throw new Error("ETIMAD_HTTP_" + res.status);
    const html = await res.text();
    const doc = new DOMParser().parseFromString("<!doctype html><html><body>" + html + "</body></html>", "text/html");
    if (doc.querySelector('input[type="password"]')) throw new Error("ETIMAD_LOGIN");
    return doc;
  }

  /**
   * كل استفسارات المنافسة: من جزء اعتماد أولا، وإلا من الصفحة المرسومة.
   * complete = القائمة قُرئت كاملة (اعتماد يرسمها كلها بلا ترقيم صفحات).
   */
  async function scrape(tenderId, allowLive) {
    if (tenderId) {
      try {
        const frag = await fetchFragment(tenderId);
        const parsed = P.parseEtimadInquiries(frag, { url: location.origin + FRAGMENT_PATH + encodeURIComponent(tenderId), container: frag.body });
        if (parsed.rows.length) return { rows: parsed.rows, complete: parsed.complete, source: "fragment" };
      } catch (err) {
        if (String(err && err.message) === "ETIMAD_LOGIN") throw err;
        console.warn("[Tanfeeth] inquiries fragment:", err);
      }
    }
    if (allowLive) {
      const live = document.querySelector("#inquiriesDiv") || document.body;
      const parsed = P.parseEtimadInquiries(document, { url: location.href, container: live });
      if (parsed.rows.length) return { rows: parsed.rows, complete: parsed.complete, source: "page" };
    }
    return { rows: [], complete: false, source: "none" };
  }

  // ─────────────────────────────────────────────────────── المزامنة ──

  function failure(res) {
    if (!res) return "تعذر الاتصال بالإضافة — حدّث الصفحة (F5) ثم أعد المحاولة.";
    return res.message || "تعذر تنفيذ الطلب.";
  }

  /**
   * يرسل الصفوف إلى تنفيذ ويحفظ النتيجة. يرجع السجل المحفوظ.
   * meta: { reference, tenderId, tenderName }
   */
  async function syncRows(meta, scraped) {
    const res = await UI.send({
      type: "TNF_INQ_SYNC",
      body: {
        etimadReference: meta.reference,
        etimadTenderId: meta.tenderId,
        tenderName: meta.tenderName,
        complete: scraped.complete === true,
        rows: scraped.rows,
      },
    });
    if (!res || !res.ok) {
      const err = new Error(failure(res));
      err.code = res && res.code;
      throw err;
    }
    const data = res.data || {};
    const byIndex = {};
    scraped.rows.forEach(function (r) {
      byIndex[r.domIndex] = r;
    });
    const writes = (Array.isArray(data.rows) ? data.rows : [])
      .filter(function (r) {
        return r && r.write && typeof r.write.answer === "string" && r.write.answer.trim();
      })
      .map(function (r) {
        const mine = byIndex[r.domIndex] || {};
        return {
          domIndex: r.domIndex,
          nativeId: r.nativeId || mine.nativeId || null,
          fingerprint: r.fingerprint,
          question: mine.question || "",
          answer: r.write.answer,
        };
      });
    const record = {
      reference: meta.reference,
      tenderId: meta.tenderId,
      tenderName: meta.tenderName,
      competitionId: data.competitionId || null,
      competitionTitle: data.competitionTitle || null,
      at: Date.now(),
      seen: scraped.rows.length,
      complete: scraped.complete === true,
      summary: data.summary || {},
      writes: writes,
      lastWrite: null,
    };
    await writeStore(function (store) {
      store.byRef[meta.reference] = record;
      if (meta.tenderId) store.tenderRefs[meta.tenderId] = meta.reference;
    });
    return record;
  }

  // ─────────────────────────────────────────── الكتابة في اعتماد ──

  const decorations = new Map(); // fingerprint → [عناصر أضفناها]

  function clearDecoration(fp) {
    (decorations.get(fp) || []).forEach(function (n) {
      n.remove();
    });
    decorations.delete(fp);
  }

  function track(fp, node) {
    if (!decorations.has(fp)) decorations.set(fp, []);
    decorations.get(fp).push(node);
  }

  function isOurs(n) {
    return Boolean(n.closest && n.closest("[data-tanfeeth]"));
  }

  function cssId(id) {
    return String(id).replace(/["\\]/g, "");
  }

  /** عناصر تحمل رقم الاستفسار في الصفحة: id، aria-controls، data-*، أو حقل مخفي. */
  function anchorsFor(nativeId) {
    if (!nativeId) return [];
    const id = cssId(nativeId);
    const sel = [
      '[id="' + id + '"]',
      '[aria-controls="' + id + '"]',
      '[data-id="' + id + '"]',
      '[data-enquiry-id="' + id + '"]',
      '[data-enquiryid="' + id + '"]',
      'a[href$="#' + id + '"]',
      'input[type="hidden"][value="' + id + '"]',
    ].join(",");
    return Array.prototype.filter.call(document.querySelectorAll(sel), function (n) {
      return !isOurs(n);
    });
  }

  /** الرأس واللوحة (بنية اعتماد المعروفة) من أي عنصر يحمل الرقم. */
  function regionFrom(anchors, nativeId) {
    let header = null;
    let panel = null;
    anchors.forEach(function (a) {
      if (a.id === nativeId) panel = panel || a;
      const h = a.closest(".card-header");
      if (h) header = header || h;
    });
    if (panel && !header && panel.previousElementSibling && panel.previousElementSibling.classList.contains("card-header")) {
      header = panel.previousElementSibling;
    }
    const first = header || panel || anchors[0] || null;
    return first ? { header, panel, first, anchors } : null;
  }

  /** يحدد كتلة الاستفسار: برقمه أولا، وإلا بموضعه وقت المزامنة. */
  function locate(write, blocksNow) {
    const anchors = anchorsFor(write.nativeId);
    if (anchors.length) {
      const region = regionFrom(anchors, write.nativeId);
      if (region) return region;
    }
    const b = blocksNow[write.domIndex];
    if (b) return { header: b.header, panel: b.panel, first: b.header || b.panel, anchors: [b.link] };
    return null;
  }

  function regionText(region) {
    const parts = [];
    if (region.header) parts.push(region.header.textContent);
    if (region.panel) parts.push(region.panel.textContent);
    if (!parts.length) {
      const host = region.first.closest("tr, li, .card, .row") || region.first.parentElement || region.first;
      parts.push(host.textContent);
    }
    return parts.join(" ");
  }

  /** حارس: السؤال في الصفحة هو نفسه وقت المزامنة؟ */
  function questionMatches(region, question) {
    const want = P.normalizeInquiryText(question);
    if (!want) return false;
    const quoted = region.panel && region.panel.querySelector("blockquote > span.h5");
    if (quoted) return P.normalizeInquiryText(quoted.textContent) === want;
    // بنية غير معروفة: الرأس يعرض أول السؤال على الأقل.
    return P.normalizeInquiryText(regionText(region)).indexOf(want.slice(0, 80)) !== -1;
  }

  function editableIn(node) {
    const list = node.querySelectorAll('textarea, [contenteditable="true"], [contenteditable=""]');
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (isOurs(f) || f.disabled || f.readOnly) continue;
      return f;
    }
    return null;
  }

  /**
   * أقرب خانة رد للكتلة: نصعد من اللوحة/الرأس ما دام الأب لا يضم استفسارا آخر.
   * others: عناصر بقية الاستفسارات في الصفحة.
   */
  function findReplyField(region, others) {
    const starts = [region.panel, region.header, region.first].filter(Boolean);
    for (let s = 0; s < starts.length; s++) {
      let node = starts[s];
      while (node && node !== document.body && node !== document.documentElement) {
        const f = editableIn(node);
        if (f) return { field: f, block: node };
        const parent = node.parentElement;
        if (!parent) break;
        const current = node;
        const foreign = others.some(function (o) {
          return parent.contains(o) && !current.contains(o) && !region.anchors.includes(o) && o !== region.header && o !== region.panel;
        });
        if (foreign) break;
        node = parent;
      }
    }
    return null;
  }

  function fieldEmpty(f) {
    const v = f.tagName === "TEXTAREA" ? f.value : f.textContent;
    return !String(v || "").trim();
  }

  /** نفس طريقة etimad-fill.js: الضابط الأصلي ثم input/change حتى تراها أطر الصفحة. */
  function setFieldValue(f, text) {
    if (f.tagName === "TEXTAREA") {
      const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
      if (desc && typeof desc.set === "function") desc.set.call(f, text);
      else f.value = text;
    } else {
      f.textContent = text;
    }
    ["input", "change"].forEach(function (type) {
      try {
        f.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
      } catch (_e) {
        /* ignore */
      }
    });
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_e) {
      /* نجرب الطريقة القديمة */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (_e) {
      return false;
    }
  }

  const CHIP_CSS = [
    ":host{display:block;margin:6px 0}",
    ".chip{display:inline-flex;align-items:center;gap:8px;max-width:100%;padding:4px;padding-inline-start:12px;border:1px solid var(--line);border-radius:999px;background:var(--mint)}",
    ".chip .lbl{font-size:12px;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:420px}",
    ".chip .btn{height:28px;padding:0 12px;font-size:12px}",
    ".draft{display:inline-flex;align-items:center;gap:6px;padding:3px 12px;border-radius:999px;background:var(--green);color:#fff;font-size:12px;font-weight:600}",
  ].join("\n");

  /** زر «نسخ ردّ تنفيذ» بجانب الاستفسار — يعمل حتى لو لم نجد خانة الرد. */
  function copyChip(write, filled) {
    const made = UI.createInlineHost("inq-copy", CHIP_CSS);
    const wrap = UI.el("div", "tnf");
    const chip = UI.el("div", "chip");
    chip.appendChild(UI.mark(11, "brand"));
    chip.appendChild(UI.el("span", "lbl", filled ? "كُتبت مسودة الرد — راجِعها ثم أرسل بنفسك" : "ردّ معتمد في تنفيذ لم يُنشر بعد"));
    const btn = UI.el("button", "btn btn-ghost");
    btn.type = "button";
    btn.appendChild(UI.icon("copy", 14));
    const label = UI.el("span", null, "نسخ ردّ تنفيذ");
    btn.appendChild(label);
    btn.title = write.answer.slice(0, 300);
    btn.addEventListener("click", async function (e) {
      e.preventDefault();
      e.stopPropagation(); // لا نفتح/نطوي لوحة اعتماد
      const ok = await copyText(write.answer);
      label.textContent = ok ? "نُسخ الرد" : "تعذر النسخ";
      setTimeout(function () {
        label.textContent = "نسخ ردّ تنفيذ";
      }, 2000);
    });
    chip.appendChild(btn);
    wrap.appendChild(chip);
    made.root.appendChild(wrap);
    return made.host;
  }

  function draftLabel() {
    const made = UI.createInlineHost("inq-draft", CHIP_CSS);
    const wrap = UI.el("div", "tnf");
    const tag = UI.el("span", "draft");
    tag.appendChild(UI.icon("pen", 13));
    tag.appendChild(UI.el("span", null, DRAFT_LABEL));
    wrap.appendChild(tag);
    made.root.appendChild(wrap);
    return made.host;
  }

  function outline(block) {
    block.setAttribute("data-tanfeeth-draft", "1");
    block.style.outline = "2px solid " + ACCENT;
    block.style.outlineOffset = "3px";
    block.style.borderRadius = "6px";
  }

  function placeChip(region, host) {
    if (region.header) region.header.insertAdjacentElement("afterend", host);
    else region.first.insertAdjacentElement("beforebegin", host);
  }

  /**
   * يطبق الردود الجاهزة على الصفحة.
   * fill=false: أزرار النسخ فقط (بعد المزامنة، أو حين يعيد اعتماد رسم القائمة).
   * يرجع { filled: [fingerprints], copyOnly, kept, mismatch, missing }.
   */
  function applyWrites(writes, fill) {
    const root = document.querySelector("#inquiriesDiv") || document.body;
    const blocksNow = P.collectBlocks(root);
    const others = [];
    blocksNow.forEach(function (b) {
      if (b.header) others.push(b.header);
      if (b.panel) others.push(b.panel);
    });
    const out = { filled: [], copyOnly: 0, kept: 0, mismatch: 0, missing: 0 };
    writes.forEach(function (w) {
      clearDecoration(w.fingerprint);
      const region = locate(w, blocksNow);
      if (!region) {
        out.missing += 1;
        return;
      }
      if (!questionMatches(region, w.question)) {
        out.mismatch += 1; // الصفحة تغيرت — نعيد المزامنة بدل الكتابة في الخانة الخطأ
        return;
      }
      let filledHere = false;
      if (fill) {
        const found = findReplyField(region, others);
        if (found && fieldEmpty(found.field)) {
          setFieldValue(found.field, w.answer);
          outline(found.block === document.body ? found.field : found.block);
          const label = draftLabel();
          found.field.insertAdjacentElement("beforebegin", label);
          track(w.fingerprint, label);
          out.filled.push(w.fingerprint);
          filledHere = true;
        } else if (found) {
          out.kept += 1; // كتب الموظف شيئا — لا نمسه
        } else {
          out.copyOnly += 1;
        }
      }
      const chip = copyChip(w, filledHere);
      placeChip(region, chip);
      track(w.fingerprint, chip);
    });
    return out;
  }

  // ───────────────────────────────────── صفحة التفاصيل وصفحة الرد ──

  async function knownReference(tenderId) {
    if (!tenderId) return null;
    const store = await readStore();
    return store.tenderRefs[tenderId] || null;
  }

  async function loadRecord() {
    const store = await readStore();
    const ref = view.meta.reference || (view.meta.tenderId && store.tenderRefs[view.meta.tenderId]) || null;
    if (ref && !view.meta.reference) view.meta.reference = ref;
    view.record = ref ? store.byRef[ref] || null : null;
    if (view.record && !view.meta.tenderName) view.meta.tenderName = view.record.tenderName;
  }

  function setPhase(phase, message, tone) {
    view.phase = phase;
    view.message = message || "";
    view.tone = tone || "";
    UI.requestBarRender();
  }

  async function countInquiries() {
    const live = document.querySelector("#inquiriesDiv");
    if (live && P.collectBlocks(live).length) {
      view.total = P.collectBlocks(live).length;
      return;
    }
    if (!view.meta.tenderId) return;
    setPhase("counting");
    try {
      const scraped = await scrape(view.meta.tenderId, PAGE === "reply");
      view.total = scraped.rows.length || null;
    } catch (_e) {
      view.total = null;
    }
    if (view.phase === "counting") setPhase("idle");
  }

  /** يسأل تنفيذ: هل هذه المنافسة مسجّلة عندنا برقمها المرجعي؟ */
  async function checkCompetition() {
    if (!view.meta.reference) {
      view.competition = { state: "unknown", title: null };
      UI.requestBarRender();
      return;
    }
    view.competition = { state: "checking", title: null };
    UI.requestBarRender();
    const res = await UI.send({ type: "TNF_INQ_MATCH", references: [view.meta.reference] });
    if (!res || !res.ok) {
      view.competition = { state: "unknown", title: null, message: failure(res) };
    } else {
      const hit = (res.data || []).find(function (m) {
        return m.reference === view.meta.reference;
      });
      view.competition = hit ? { state: "matched", id: hit.competitionId, title: hit.title, counts: hit.counts } : { state: "none", title: null };
    }
    UI.requestBarRender();
  }

  async function syncThisTender() {
    if (view.phase === "syncing" || view.phase === "writing") return;
    if (view.competition.state !== "matched") return;
    if (!view.meta.reference) {
      setPhase("error", PAGE === "reply"
        ? "لا نعرف الرقم المرجعي لهذه المنافسة — افتح «تفاصيل المنافسة» أو «إستفسارات الموردين» مرة ثم عد"
        : "لم نجد «الرقم المرجعي» في هذه الصفحة", "warn");
      return;
    }
    setPhase("syncing");
    try {
      const scraped = await scrape(view.meta.tenderId, true);
      if (!scraped.rows.length) {
        setPhase("error", "لم نجد استفسارات في هذه المنافسة — افتح تبويب «الإستفسارات» ثم أعد المحاولة", "warn");
        return;
      }
      view.total = scraped.rows.length;
      view.record = await syncRows(view.meta, scraped);
      applyWrites(view.record.writes, false);
      setPhase("synced", summaryText(view.record.summary, view.record.writes.length), "ok");
    } catch (err) {
      const msg = String(err && err.message) === "ETIMAD_LOGIN" ? "انتهت جلستك في اعتماد — سجّل الدخول في اعتماد ثم أعد المحاولة" : (err && err.message) || "تعذرت المزامنة";
      setPhase("error", msg, "warn");
    }
  }

  async function writeReady() {
    const writes = liveWrites(view.record);
    if (!writes.length || view.phase === "writing" || view.phase === "syncing") return;
    setPhase("writing");
    const out = applyWrites(writes, true);
    let reported = true;
    if (out.filled.length) {
      const res = await UI.send({ type: "TNF_INQ_INJECTED", etimadReference: view.meta.reference, fingerprints: out.filled });
      reported = Boolean(res && res.ok);
    }
    const lastWrite = { at: Date.now(), filled: out.filled.length, copyOnly: out.copyOnly, kept: out.kept, mismatch: out.mismatch, missing: out.missing };
    const ref = view.meta.reference;
    await writeStore(function (store) {
      if (store.byRef[ref]) store.byRef[ref].lastWrite = lastWrite;
    });
    if (view.record) view.record.lastWrite = lastWrite;

    const parts = [];
    if (out.filled.length) parts.push("كُتبت " + plural(out.filled.length, "مسودة", "مسودات"));
    if (out.copyOnly) parts.push(out.copyOnly + " للنسخ فقط (لا خانة رد هنا)");
    if (out.kept) parts.push(out.kept + " تُركت لأن خانتها ليست فارغة");
    if (out.mismatch) parts.push(out.mismatch + " تغيّر نصها — زامن من جديد");
    if (out.missing) parts.push(out.missing + (PAGE === "details" ? " غير ظاهرة — افتح تبويب «الإستفسارات»" : " غير ظاهرة في الصفحة"));
    let sub = parts.join(" · ");
    if (out.filled.length) sub += " — راجِع ثم أرسل بنفسك";
    if (!reported) sub += " (لم نُبلغ تنفيذ بالمسودات — ستظهر في المزامنة التالية)";
    setPhase("written", sub, out.filled.length && !out.mismatch && reported ? "ok" : "warn");
  }

  function tenderMode() {
    return {
      id: "inquiries-" + PAGE,
      signedOutTitle: "تنفيذ — استفسارات الموردين",
      matches: function () {
        return true;
      },
      render: function (kit) {
        const b = kit.button;
        const actions = [];
        const writes = liveWrites(view.record);
        const title = view.competition.title || (view.record && view.record.competitionTitle) || view.meta.tenderName || "استفسارات المنافسة";

        // لا سحبَ ولا كتابة إلا لمنافسةٍ لها مشروع في تنفيذ.
        if (view.competition.state !== "matched") {
          const recheck = b("icon-btn", "refresh", "تحقق من جديد", function () { checkCompetition(); });
          if (view.competition.state === "checking") {
            return { title, sub: "جار التحقق من وجود المنافسة في تنفيذ…", tone: "", actions: [] };
          }
          if (view.competition.state === "none") {
            return {
              title,
              sub: "هذه المنافسة غير مسجّلة في تنفيذ — سجّل رقمها المرجعي " + view.meta.reference + " في خطوة «اعتماد الطرح» على مشروعها أولًا، ثم زامن",
              tone: "warn",
              actions: [recheck],
            };
          }
          return {
            title,
            sub: !view.meta.reference
              ? PAGE === "reply"
                ? "لا نعرف الرقم المرجعي لهذه المنافسة — افتح «تفاصيل المنافسة» أو «إستفسارات الموردين» مرة ثم عد"
                : "لم نجد «الرقم المرجعي» في هذه الصفحة"
              : view.competition.message || "تعذر التحقق من المنافسة في تنفيذ",
            tone: "warn",
            actions: view.meta.reference ? [recheck] : [],
          };
        }
        let sub = "";
        let tone = view.tone;
        const countLabel = view.total != null ? "مزامنة الاستفسارات (" + view.total + ")" : "مزامنة الاستفسارات";
        const syncBtn = function (primary) {
          return primary
            ? b("btn btn-primary", "refresh", countLabel, function () { syncThisTender(); })
            : b("icon-btn", "refresh", "مزامنة من جديد", function () { syncThisTender(); });
        };
        const writeBtn = function () {
          return b("btn btn-primary", "pen", "اكتب الردود الجاهزة (" + writes.length + ")", function () { writeReady(); });
        };

        if (view.phase === "syncing" || view.phase === "writing") {
          sub = view.phase === "syncing" ? "جار قراءة الاستفسارات ومزامنتها مع تنفيذ…" : "جار كتابة الردود الجاهزة…";
          actions.push(b("btn btn-primary", "loader", view.phase === "syncing" ? "جار المزامنة" : "جار الكتابة", function () {}, { spin: true, disabled: true }));
          return { title, sub, tone: "", actions };
        }
        if (view.phase === "synced" || view.phase === "written" || view.phase === "error") {
          sub = view.message;
          if (writes.length) actions.push(writeBtn());
          actions.push(syncBtn(!writes.length && view.phase === "error"));
          return { title, sub, tone, actions };
        }
        // idle / counting
        if (view.phase === "counting") {
          sub = "جار عدّ الاستفسارات…";
        } else if (view.record) {
          sub = "آخر مزامنة " + agoText(view.record.at) + " — " + summaryText(view.record.summary, writes.length);
        } else if (view.total != null) {
          sub = plural(view.total, "استفسار", "استفسارا") + " في اعتماد — زامنها مع تنفيذ";
        } else {
          sub = "اسحب استفسارات الموردين إلى تنفيذ واكتب الردود المعتمدة هنا";
        }
        tone = "";
        if (writes.length) {
          actions.push(writeBtn());
          actions.push(syncBtn(false));
        } else {
          actions.push(syncBtn(true));
        }
        return { title, sub, tone, actions };
      },
    };
  }

  let observer = null;
  function watchInquiriesTab() {
    // اعتماد يستبدل محتوى #inquiriesDiv عند فتح التبويب — نعيد أزرار النسخ.
    const live = document.querySelector("#inquiriesDiv");
    if (!live || observer) return;
    let timer = null;
    observer = new MutationObserver(function (mutations) {
      const external = mutations.some(function (m) {
        return Array.prototype.some.call(m.addedNodes, function (n) {
          return n.nodeType === 1 && !n.hasAttribute("data-tanfeeth");
        });
      });
      if (!external) return;
      clearTimeout(timer);
      timer = setTimeout(function () {
        const blocks = P.collectBlocks(live).length;
        if (blocks) view.total = blocks;
        const writes = liveWrites(view.record);
        if (writes.length) applyWrites(writes, false);
        UI.requestBarRender();
      }, 300);
    });
    observer.observe(live, { childList: true });
  }

  async function initTender() {
    if (!view.meta.reference) view.meta.reference = await knownReference(view.meta.tenderId);
    // نحفظ ربط المعرّف بالرقم المرجعي لصفحة الرد لاحقا.
    if (view.meta.reference && view.meta.tenderId) {
      await writeStore(function (store) {
        store.tenderRefs[view.meta.tenderId] = view.meta.reference;
      });
    }
    await loadRecord();
    UI.requestBarRender();
    await checkCompetition();
    // منافسةٌ لا مشروع لها في تنفيذ: لا عدّ ولا أزرار نسخ — لا شيء يُسحب منها.
    if (view.competition.state !== "matched") return;
    watchInquiriesTab();
    const writes = liveWrites(view.record);
    if (writes.length) applyWrites(writes, false);
    await countInquiries();
  }

  // ──────────────────────────────────────────── صفحة القائمة ──

  const CARD_CSS = [
    ":host{display:block;margin:10px 0 0}",
    ".box{display:grid;gap:6px;padding:10px 12px;border:1px solid var(--line);border-inline-start:3px solid var(--green);border-radius:10px;background:var(--paper)}",
    ".top{display:flex;align-items:center;gap:8px;min-width:0}",
    ".tag{flex:none;display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;background:var(--mint);color:var(--green-deep);font-size:11px;font-weight:600}",
    ".name{min-width:0;font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".line{font-size:12px;color:var(--muted)}",
    ".line.ok{color:var(--success)}",
    ".line.warn{color:var(--warning)}",
    ".acts{display:flex;gap:6px;flex-wrap:wrap}",
    ".acts .btn{height:28px;padding:0 12px;font-size:12px}",
  ].join("\n");

  function countsLine(match) {
    const c = (match && match.counts) || {};
    const parts = [];
    if (c.waitingAnswer) parts.push(c.waitingAnswer + " بانتظار الإجابة");
    if (c.waitingApproval) parts.push(c.waitingApproval + " بانتظار الاعتماد");
    if (c.pendingOnEtimad) parts.push(c.pendingOnEtimad + " جاهزة للكتابة في اعتماد");
    if (parts.length) return parts.join(" · ");
    return c.total ? plural(c.total, "استفسار", "استفسارا") + " في تنفيذ — لا شيء معلق" : "لم تُزامن استفساراتها بعد";
  }

  function renderCard(entry) {
    if (!entry.match) return;
    if (!entry.host) {
      entry.host = UI.createInlineHost("inq-card", CARD_CSS);
      const body = entry.card.querySelector(".card-body") || entry.card;
      body.appendChild(entry.host.host);
    }
    const root = entry.host.root;
    Array.prototype.slice.call(root.childNodes).forEach(function (n) {
      if (n.tagName !== "STYLE") n.remove();
    });
    const wrap = UI.el("div", "tnf");
    const box = UI.el("div", "box");
    const top = UI.el("div", "top");
    top.appendChild(UI.mark(11, "brand"));
    top.appendChild(UI.el("span", "tag", "في تنفيذ"));
    top.appendChild(UI.el("span", "name", entry.match.title || entry.item.title || ""));
    box.appendChild(top);

    let line = countsLine(entry.match);
    let tone = "";
    if (entry.phase === "syncing") line = "جار المزامنة…";
    else if (entry.phase === "error") {
      line = entry.message;
      tone = "warn";
    } else if (entry.record) {
      line = "آخر مزامنة " + agoText(entry.record.at) + " — " + summaryText(entry.record.summary, liveWrites(entry.record).length);
      tone = "ok";
    }
    box.appendChild(UI.el("div", "line" + (tone ? " " + tone : ""), line));

    const acts = UI.el("div", "acts");
    const sync = UI.el("button", "btn " + (entry.phase === "syncing" ? "btn-primary" : "btn-ghost"));
    sync.type = "button";
    const ic = UI.icon(entry.phase === "syncing" ? "loader" : "refresh", 14);
    if (entry.phase === "syncing") ic.classList.add("spin");
    sync.appendChild(ic);
    sync.appendChild(UI.el("span", null, entry.phase === "syncing" ? "جار المزامنة" : "مزامنة"));
    sync.disabled = entry.phase === "syncing" || Boolean(view.bulk);
    sync.addEventListener("click", function () {
      syncCard(entry).then(function () {
        UI.requestBarRender();
      });
    });
    acts.appendChild(sync);
    if (entry.record && liveWrites(entry.record).length && entry.item.replyUrl) {
      // ننتقل فقط — الكتابة نفسها في صفحة الرد بزر الشريط.
      const go = UI.el("button", "btn btn-primary");
      go.type = "button";
      go.appendChild(UI.icon("pen", 14));
      go.appendChild(UI.el("span", null, "كتابة الردود في اعتماد"));
      go.addEventListener("click", function () {
        location.assign(entry.item.replyUrl);
      });
      acts.appendChild(go);
    }
    box.appendChild(acts);
    wrap.appendChild(box);
    root.appendChild(wrap);
  }

  async function syncCard(entry) {
    if (entry.phase === "syncing") return null;
    entry.phase = "syncing";
    entry.message = "";
    renderCard(entry);
    try {
      if (!entry.item.tenderId) throw new Error("لم نجد معرّف المنافسة في البطاقة");
      const scraped = await scrape(entry.item.tenderId, false);
      if (!scraped.rows.length) throw new Error("تعذرت قراءة استفسارات هذه المنافسة من اعتماد");
      entry.record = await syncRows({ reference: entry.item.reference, tenderId: entry.item.tenderId, tenderName: entry.item.title }, scraped);
      entry.phase = "synced";
    } catch (err) {
      entry.phase = "error";
      entry.message = String(err && err.message) === "ETIMAD_LOGIN"
        ? "انتهت جلستك في اعتماد — سجّل الدخول ثم أعد المحاولة"
        : (err && err.message) || "تعذرت المزامنة";
    }
    renderCard(entry);
    return entry.record;
  }

  async function syncAll() {
    const targets = view.cards.filter(function (c) {
      return c.match;
    });
    if (!targets.length || view.bulk) return;
    view.bulk = { done: 0, total: targets.length, created: 0, writes: 0, failed: 0 };
    targets.forEach(renderCard);
    UI.requestBarRender();
    for (const entry of targets) {
      await syncCard(entry);
      if (entry.phase === "error") view.bulk.failed += 1;
      else if (entry.record) {
        view.bulk.created += Number((entry.record.summary || {}).created || 0);
        view.bulk.writes += liveWrites(entry.record).length;
      }
      view.bulk.done += 1;
      UI.requestBarRender();
    }
    const b = view.bulk;
    const parts = ["تمت مزامنة " + plural(b.done - b.failed, "منافسة", "منافسات")];
    if (b.created) parts.push(b.created + " جديد");
    if (b.writes) parts.push(b.writes + " ردود جاهزة للكتابة");
    if (b.failed) parts.push("تعذرت " + b.failed);
    view.message = parts.join(" · ");
    view.tone = b.failed ? "warn" : "ok";
    view.bulk = null;
    view.cards.forEach(renderCard);
    UI.requestBarRender();
  }

  function listMode() {
    return {
      id: "inquiries-list",
      signedOutTitle: "تنفيذ — استفسارات الموردين",
      matches: function () {
        return true;
      },
      render: function (kit) {
        const b = kit.button;
        const matched = view.cards.filter(function (c) {
          return c.match;
        }).length;
        const title = "استفسارات الموردين";
        if (view.matching) {
          return { title, sub: "جار مطابقة المنافسات مع تنفيذ…", actions: [] };
        }
        if (view.bulk) {
          return {
            title,
            sub: "جار مزامنة " + (view.bulk.done + 1) + " من " + view.bulk.total + "…",
            progress: view.bulk.total ? view.bulk.done / view.bulk.total : 0,
            actions: [b("btn btn-primary", "loader", "جار المزامنة", function () {}, { spin: true, disabled: true })],
          };
        }
        if (view.message) {
          return {
            title,
            sub: view.message,
            tone: view.tone,
            actions: matched ? [b("btn btn-ghost", "refresh", "مزامنة الكل", function () { syncAll(); })] : [],
          };
        }
        const sub = !view.cards.length
          ? "لا توجد منافسات في هذه الصفحة"
          : matched
            ? matched + " من " + view.cards.length + " منافسات مسجلة في تنفيذ"
            : "لا توجد منافسة في هذه الصفحة مسجلة في تنفيذ بعد";
        return {
          title,
          sub,
          actions: matched ? [b("btn btn-primary", "refresh", "مزامنة الكل (" + matched + ")", function () { syncAll(); })] : [],
        };
      },
    };
  }

  async function initList() {
    const withRef = view.cards.filter(function (c) {
      return c.item.reference;
    });
    // نحفظ ربط المعرّف بالرقم المرجعي حتى تعرفه صفحة الرد.
    await writeStore(function (store) {
      withRef.forEach(function (c) {
        if (c.item.tenderId) store.tenderRefs[c.item.tenderId] = c.item.reference;
      });
    });
    if (!withRef.length) {
      view.matching = false;
      UI.requestBarRender();
      return;
    }
    view.matching = true;
    UI.requestBarRender();
    const res = await UI.send({
      type: "TNF_INQ_MATCH",
      references: withRef.map(function (c) {
        return c.item.reference;
      }),
    });
    view.matching = false;
    if (!res || !res.ok) {
      view.message = failure(res);
      view.tone = "warn";
      UI.requestBarRender();
      return;
    }
    const store = await readStore();
    const byRef = {};
    (Array.isArray(res.data) ? res.data : []).forEach(function (m) {
      if (m && m.reference) byRef[String(m.reference)] = m;
    });
    view.cards.forEach(function (c) {
      c.match = byRef[c.item.reference] || null;
      c.record = c.match ? store.byRef[c.item.reference] || null : null;
      renderCard(c);
    });
    UI.requestBarRender();
  }

  // ──────────────────────────────────────────── اللوحة الجانبية ──
  // اللوحة تسأل عن حال الصفحة وتطلب الأفعال نفسها التي في الشريط — لا منطقٌ ثانٍ.

  function panelStatus() {
    const writes = liveWrites(view.record);
    if (PAGE === "list") {
      const matched = view.cards.filter(function (c) {
        return c.match;
      });
      return {
        page: PAGE,
        started,
        cards: view.cards.length,
        matched: matched.map(function (c) {
          return { reference: c.match.reference, title: c.match.title, counts: c.match.counts, phase: c.phase || "idle", message: c.message || "" };
        }),
        matching: view.matching,
        bulk: view.bulk,
        message: view.message,
        tone: view.tone,
      };
    }
    return {
      page: PAGE,
      started,
      reference: view.meta.reference,
      tenderName: view.meta.tenderName,
      competition: view.competition,
      total: view.total,
      phase: view.phase,
      message: view.message,
      tone: view.tone,
      writes: writes.length,
      summary: view.record ? view.record.summary : null,
      syncedAt: view.record ? view.record.at : null,
    };
  }

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (!message) return false;
    if (message.type === "TNF_INQ_STATUS") {
      sendResponse(panelStatus());
      return false;
    }
    if (message.type === "TNF_INQ_ACTION") {
      const run =
        message.action === "sync"
          ? syncThisTender
          : message.action === "write"
            ? writeReady
            : message.action === "syncAll"
              ? syncAll
              : message.action === "recheck"
                ? checkCompetition
                : null;
      /* «مزامنة الكل» لصفحة القائمة وحدها، وبقية الأفعال لصفحة المنافسة. */
      const fits = message.action === "syncAll" ? PAGE === "list" : PAGE !== "list";
      if (!run || !started || !fits) {
        sendResponse(panelStatus());
        return false;
      }
      Promise.resolve(run()).then(
        function () {
          sendResponse(panelStatus());
        },
        function () {
          sendResponse(panelStatus());
        }
      );
      return true;
    }
    return false;
  });

  // ─────────────────────────────────────────────────────── التشغيل ──

  // الوضع يُسجَّل فورا (الشريط لا يرسمه إلا بعد الدخول)، والقراءة والطلبات بعد الدخول فقط.
  let started = false;
  async function start() {
    if (started) return;
    const auth = await UI.authState();
    if (!auth.signedIn || started) return;
    started = true;
    if (PAGE === "list") await initList();
    else await initTender();
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local") return;
    if (changes[UI.KEYS.session] && changes[UI.KEYS.session].newValue && !started) {
      start().catch(function (err) {
        console.warn("[Tanfeeth] inquiries start:", err);
      });
    }
    // مزامنة من تبويب آخر (القائمة مثلا) — نحدّث الردود الجاهزة هنا.
    if (changes[STORE_KEY] && started && PAGE !== "list" && view.phase !== "syncing" && view.phase !== "writing") {
      loadRecord().then(function () {
        UI.requestBarRender();
      });
    }
  });

  function boot() {
    if (PAGE === "list") {
      view.cards = P.listCards(document, { url: location.href }).map(function (c) {
        return { card: c.card, item: c.item, match: null, phase: "idle", message: "", record: null, host: null };
      });
      view.matching = view.cards.some(function (c) {
        return c.item.reference;
      });
      UI.registerBarMode(listMode());
    } else {
      view.meta = P.pageMeta(document, location.href);
      UI.registerBarMode(tenderMode());
    }
    start().catch(function (err) {
      console.warn("[Tanfeeth] inquiries init:", err);
    });
  }

  try {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  } catch (err) {
    console.warn("[Tanfeeth] inquiries fatal:", err);
  }
})();
