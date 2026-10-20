// العروض — سحب عروض المتنافسين وملفاتها من اعتماد إلى «استلام العروض» في تنفيذ (FR-SP-019).
// سكربت الصفحة يقرأ اعتماد بجلسة المستخدم (TNF_OFFERS_SCAN) ويمرّر بايتات كل ملف عبر منفذ؛
// والخادم يقول ما يُفعل (POST /competitions/etimad-offers/plan) وينشئ العرض أو يطابقه
// (…/intake)، ثم تُرفع الملفات على مسار الرفع نفسه (POST …/offers/:offerId/files).
// اللوحة هي التي ترفع: الرفع يطول (فكّ المضغوطات وقراءتها) وعامل الخلفية لا يُبقي طلبًا طويلًا.

import { ApiError, apiPost, apiUpload } from "../../shared/api.js";
import { h, icon } from "../dom.js";

const POLL_MS = 2500;
const PORT_NAME = "tnf-offer-file";
const MAX_FILE_BYTES = 200 * 1024 * 1024; // سقف الملف الواحد في الخادم
const BIDDER_CONCURRENCY = 2;
const NO_COMPETITION = "COMPETITIONS.ETIMAD_OFFERS_NO_COMPETITION";

const ENVELOPE_LABEL = { combined: "مستند جامع", technical: "المظروف الفني", financial: "المظروف المالي" };

/** صفحة المنافسة في واجهة تنفيذ لكل خادم. */
function competitionUrl(app, competitionId) {
  const id = app.state.session && app.state.session.serverId;
  const server = app.server();
  const base = id === "staging" ? "https://demo.tanfeeth.io" : id === "local" ? "http://localhost:3010" : server ? server.web : "";
  return base + "/portal/competitions/" + encodeURIComponent(competitionId);
}

function mb(bytes) {
  if (bytes == null) return "";
  const v = bytes / (1024 * 1024);
  return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + " م.ب";
}

/** العدد بتمييزه: «عرض واحد»، «عرضان»، «٣ عروض»، «١١ عرضًا». */
function count(n, one, two, few, many) {
  if (n === 1) return one;
  if (n === 2) return two;
  return n + " " + (n >= 3 && n <= 10 ? few : many);
}
const offersN = function (n) { return count(n, "عرضًا واحدًا", "عرضين", "عروض", "عرضًا"); };
const filesN = function (n) { return count(n, "ملفًا واحدًا", "ملفين", "ملفات", "ملفًا"); };

function planError(err) {
  if (err && err.code === NO_COMPETITION) {
    return { kind: "none", message: "هذه المنافسة غير مسجّلة في تنفيذ — سجّل رقمها المرجعي في خطوة «اعتماد الطرح» على مشروعها أولًا، ثم اسحب العروض." };
  }
  if (err && err.status === 403) return { kind: "forbidden", message: "سحب العروض لمن يملك صلاحية لجنة العروض في تنفيذ — اطلبها من مدير النظام." };
  if (err && err.status === 404) return { kind: "error", message: "سحب العروض غير متاح على هذا الخادم بعد." };
  return { kind: "error", message: (err && err.message) || "تعذر الوصول إلى تنفيذ." };
}

/** يطلب ملفًا من سكربت صفحة اعتماد ويجمع قطعه — يرجع Blob. */
function downloadFromEtimad(tabId, file, onProgress) {
  return new Promise(function (resolve, reject) {
    let port;
    try {
      port = chrome.tabs.connect(tabId, { name: PORT_NAME });
    } catch (_e) {
      reject(new ApiError(0, "صفحة اعتماد لم تعد مفتوحة — افتحها وأعد المحاولة.", "ETIMAD_TAB"));
      return;
    }
    const parts = [];
    let size = null;
    let mime = "application/octet-stream";
    let settled = false;
    let chain = Promise.resolve();
    const finish = function (fn, value) {
      if (settled) return;
      settled = true;
      try {
        port.disconnect();
      } catch (_e) {
        /* مغلق أصلا */
      }
      fn(value);
    };
    port.onMessage.addListener(function (msg) {
      chain = chain.then(async function () {
        if (settled || !msg) return;
        if (msg.type === "meta") {
          size = msg.size;
          mime = msg.mime || mime;
        } else if (msg.type === "chunk") {
          const blob = await (await fetch(msg.data)).blob();
          parts.push(blob);
          onProgress(msg.received, size);
          if (msg.received > MAX_FILE_BYTES) finish(reject, new ApiError(413, "الملف أكبر من ٢٠٠ م.ب — حمّله من اعتماد وارفعه مقسّمًا.", "TOO_LARGE"));
        } else if (msg.type === "done") {
          finish(resolve, new Blob(parts, { type: mime }));
        } else if (msg.type === "error") {
          finish(reject, new ApiError(0, msg.message || "تعذر تنزيل الملف من اعتماد.", msg.code || "ETIMAD"));
        }
      });
    });
    port.onDisconnect.addListener(function () {
      void chrome.runtime.lastError;
      chain.then(function () {
        finish(reject, new ApiError(0, "انقطع الاتصال بصفحة اعتماد — لا تغلقها ولا تنتقل منها أثناء السحب.", "ETIMAD_TAB"));
      });
    });
    port.postMessage({ type: "get", key: file.key, name: file.name });
  });
}

// السحب يعيش في الوحدة لا في الشاشة: الانتقال إلى «المساعد» أثناء السحب يهدم الشاشة،
// ولا يجوز أن يوقف رفعًا في منتصفه بلا كلمة. الشاشة تشترك فتُرسم مع كل تقدّم.
const runner = { run: null, version: 0, listeners: new Set() };
function notify() {
  runner.listeners.forEach(function (fn) {
    try {
      fn();
    } catch (err) {
      console.warn("[Tanfeeth] offers render:", err);
    }
  });
}

export function mountOffers(container, app) {
  const root = h("div", { class: "pane" });
  container.appendChild(root);

  let status = null; // ما قاله سكربت الصفحة آخر مرة
  let reached = false;
  let scanAsked = null; // tabId:tenderId الذي طُلبت قراءته
  let plan = null; // { scanAt, data } أو { scanAt, error }
  let planning = false;
  // runner.run = { tabId, reference, competitionId, phase, bidders: { [etimadOfferId]: { phase, message, files: { [key]: {...} } } } }
  let timer = null;
  let alive = true;

  const scanOf = function () {
    return status && status.scan && status.scan.ok ? status.scan : null;
  };

  async function poll() {
    if (!alive) return;
    if (app.state.ctx.site !== "etimad") {
      status = null;
      reached = false;
      render();
      return;
    }
    const res = await app.sendToEtimad({ type: "TNF_OFFERS_STATUS" });
    reached = Boolean(res);
    status = res || null;
    // القراءة تُطلب مرة لكل منافسة — قراءةٌ من اعتماد بلا كتابة في أي مكان.
    const key = status && status.tenderId ? app.state.ctx.tabId + ":" + status.tenderId : null;
    if (key && key !== scanAsked && !status.scanning && !status.scan) {
      scanAsked = key;
      rescan();
      return;
    }
    await ensurePlan();
    render();
  }

  async function rescan() {
    if (!status) return;
    status = Object.assign({}, status, { scanning: true });
    plan = null;
    render();
    const res = await app.sendToEtimad({ type: "TNF_OFFERS_SCAN" });
    if (res) status = res;
    await ensurePlan();
    render();
  }

  /** الحمولة إلى الخادم — ما قرأته الصفحة كما هو، والملفات التي عُرف رابطها وحدها. */
  function biddersOf(scan) {
    return scan.offers.map(function (o) {
      return {
        etimadOfferId: o.etimadOfferId,
        contractorName: o.contractorName,
        contractorUnifiedNumber: o.contractorUnifiedNumber,
        isSme: o.isSme,
        files: o.files.filter(function (f) { return f.key; }).map(function (f) {
          return { key: f.key, name: f.name, typeLabel: f.typeLabel };
        }),
      };
    });
  }

  async function ensurePlan(force) {
    const scan = scanOf();
    if (!scan || !scan.reference || planning) return;
    // الخطة تُعاد بعد كل سحبٍ انتهى — وإن انتهى في شاشةٍ هُدمت.
    if (!force && plan && plan.scanAt === scan.at && plan.version === runner.version) return;
    planning = true;
    const version = runner.version;
    try {
      const data = await apiPost("/competitions/etimad-offers/plan", { etimadReference: scan.reference, bidders: biddersOf(scan) });
      plan = { scanAt: scan.at, version, data };
    } catch (err) {
      plan = { scanAt: scan.at, version, error: planError(err) };
    } finally {
      planning = false;
    }
  }

  // ─────────────────────────────────────────────────────────── السحب ──

  function work(bidderPlan) {
    const uploads = bidderPlan.files.filter(function (f) { return f.action === "upload"; });
    return { create: !bidderPlan.offerId, uploads };
  }

  async function pullBidder(scanOffer, bidderPlan, state) {
    const render = notify;
    const b = state.bidders[bidderPlan.etimadOfferId];
    b.phase = "intake";
    render();
    let result;
    try {
      result = await apiPost("/competitions/etimad-offers/intake", {
        etimadReference: state.reference,
        bidder: biddersOf({ offers: [scanOffer] })[0],
      });
    } catch (err) {
      b.phase = "error";
      b.message = (err && err.message) || "تعذر تسجيل العرض في تنفيذ.";
      render();
      return;
    }
    b.offerId = result.offerId;
    b.created = result.created;
    const uploads = result.files.filter(function (f) { return f.action === "upload"; });
    uploads.forEach(function (f) {
      b.files[f.key] = { phase: "waiting", name: f.name, envelope: f.envelope, received: 0, size: null, message: "" };
    });
    b.phase = "files";
    render();
    for (const f of uploads) {
      const fs = b.files[f.key];
      try {
        fs.phase = "download";
        render();
        const blob = await downloadFromEtimad(state.tabId, f, function (received, size) {
          fs.received = received;
          fs.size = size;
          render();
        });
        if (blob.size > MAX_FILE_BYTES) throw new ApiError(413, "الملف أكبر من ٢٠٠ م.ب — حمّله من اعتماد وارفعه مقسّمًا.", "TOO_LARGE");
        fs.size = blob.size;
        fs.phase = "upload";
        render();
        const form = new FormData();
        form.append("envelope", f.envelope);
        form.append("files", blob, f.name);
        const res = await apiUpload("/competitions/" + encodeURIComponent(result.competitionId) + "/offers/" + encodeURIComponent(result.offerId) + "/files", form);
        fs.phase = "done";
        fs.expanded = res && res.expanded;
      } catch (err) {
        fs.phase = "error";
        fs.message = (err && err.message) || "تعذر رفع الملف.";
      }
      render();
    }
    const failed = Object.values(b.files).some(function (x) { return x.phase === "error"; });
    b.phase = failed ? "partial" : "done";
    render();
  }

  async function pullAll() {
    const scan = scanOf();
    if (!scan || !plan || !plan.data || (runner.run && runner.run.phase === "running")) return;
    const byId = new Map(scan.offers.map(function (o) { return [o.etimadOfferId, o]; }));
    const todo = plan.data.bidders.filter(function (bp) {
      const w = work(bp);
      return byId.has(bp.etimadOfferId) && (w.create || w.uploads.length > 0);
    });
    if (!todo.length) return;
    const state = { tabId: app.state.ctx.tabId, reference: scan.reference, competitionId: plan.data.competitionId, phase: "running", bidders: {} };
    todo.forEach(function (bp) {
      state.bidders[bp.etimadOfferId] = { phase: "waiting", message: "", files: {}, name: bp.contractorName };
    });
    runner.run = state;
    notify();
    let next = 0;
    async function worker() {
      while (next < todo.length) {
        const bp = todo[next++];
        await pullBidder(byId.get(bp.etimadOfferId), bp, state);
      }
    }
    const workers = [];
    for (let k = 0; k < Math.min(BIDDER_CONCURRENCY, todo.length); k++) workers.push(worker());
    await Promise.all(workers);
    state.phase = "done";
    runner.version += 1;
    await ensurePlan(true);
    notify();
    const all = Object.values(state.bidders);
    const bad = all.filter(function (x) { return x.phase === "error" || x.phase === "partial"; }).length;
    app.toast(bad ? "انتهى السحب — لم يكتمل " + offersN(bad) : "سُحبت العروض إلى تنفيذ", bad ? "danger" : "success");
  }

  // ───────────────────────────────────────────────────────── أجزاء ──

  function note() {
    return h("div", { class: "note" },
      icon("route", 16),
      h("span", null, "تقرأ الإضافة «تقرير الموردين» وصفحة كل عرض في اعتماد بجلستك، وتنقل الملفات من اعتماد إلى تنفيذ مباشرة — لا تنزيل على جهازك ولا رفع يدوي. ولا تضغط شيئًا في اعتماد."));
  }

  function tile(tone, value, label) {
    return h("div", { class: "stat tone-" + tone }, h("b", null, String(value)), h("span", null, label));
  }

  function awayState() {
    return [
      h("div", { class: "empty tall" },
        h("span", { class: "empty-disc" }, icon("inbox", 22)),
        h("b", null, "استلام العروض من اعتماد"),
        h("p", null, "افتح «تقرير الموردين» للمنافسة في اعتماد (أو «ملفات العرض» لأي متنافس) بعد فتح العروض، ثم عد إلى هنا.")),
      note(),
    ];
  }

  function noTenderState() {
    if (!reached) {
      return [
        h("div", { class: "alert tone-warning" }, icon("alert", 16),
          h("span", null, "افتح «تقرير الموردين» أو «ملفات العرض» للمنافسة في اعتماد. إن كانت مفتوحة فحدّثها (F5).")),
        note(),
      ];
    }
    return [
      h("div", { class: "alert tone-warning" }, icon("alert", 16),
        h("span", null, "هذه الصفحة لا تخص منافسة بعينها — افتح «تقرير الموردين» من صفحة المنافسة (بعد فتح العروض).")),
      note(),
    ];
  }

  function headCard(title, reference, extra) {
    return h("section", { class: "card stats-wrap" },
      h("span", { class: "overline" }, icon("inbox", 14), "استلام العروض من اعتماد"),
      h("h2", { class: "ready-title" }, title),
      reference ? h("p", { class: "ready-meta" }, h("span", null, "الرقم المرجعي"), h("span", { attrs: { dir: "ltr" } }, reference)) : null,
      extra || null);
  }

  function fileLine(f, live) {
    let tone = "neutral";
    let ic = "circleMinus";
    let detail = "";
    if (live) {
      if (live.phase === "download") {
        ic = "loader";
        detail = "جار التنزيل من اعتماد" + (live.received ? " · " + mb(live.received) + (live.size ? " من " + mb(live.size) : "") : "");
      } else if (live.phase === "upload") {
        ic = "loader";
        detail = "جار الرفع إلى تنفيذ وقراءته" + (live.size ? " · " + mb(live.size) : "");
      } else if (live.phase === "done") {
        tone = "success";
        ic = "circleCheck";
        detail = "رُفع في " + ENVELOPE_LABEL[live.envelope] + (live.expanded > 1 ? " · " + live.expanded + " ملفات بعد فكّ المضغوط" : "");
      } else if (live.phase === "error") {
        tone = "danger";
        ic = "circleX";
        detail = live.message;
      } else {
        detail = "ينتظر — " + ENVELOPE_LABEL[live.envelope];
      }
    } else if (f.action === "upload") {
      tone = "success";
      ic = "filePlus";
      detail = "سيُرفع في " + ENVELOPE_LABEL[f.envelope];
    } else if (f.action === "skip") {
      ic = "check";
      detail = f.reason;
    } else if (f.action === "blocked") {
      tone = "warning";
      ic = "alert";
      detail = f.reason;
    } else if (f.action === "nokey") {
      tone = "warning";
      ic = "alert";
      detail = "لم نعرف رابط تنزيله في صفحة العرض — حمّله من اعتماد وارفعه يدويًا.";
    }
    const spinning = live && (live.phase === "download" || live.phase === "upload");
    return h("li", { class: "row" },
      h("span", { class: "row-icon tone-" + tone }, icon(ic, 15, spinning ? "spin" : "")),
      h("div", { class: "row-main" }, h("span", { class: "row-key" }, f.name), h("span", { class: "row-detail" }, detail)));
  }

  function bidderCard(bp, scanOffer) {
    const run = runner.run && runner.run.competitionId === plan.data.competitionId ? runner.run : null;
    const live = run && run.bidders[bp.etimadOfferId];
    let pill;
    if (live && (live.phase === "intake" || live.phase === "files")) pill = h("span", { class: "pill xs tone-info" }, "جار السحب");
    else if (live && live.phase === "done") pill = h("span", { class: "pill xs tone-success" }, live.created ? "أُنشئ وسُحب" : "سُحب");
    else if (live && (live.phase === "error" || live.phase === "partial")) pill = h("span", { class: "pill xs tone-danger" }, "لم يكتمل");
    else if (!bp.offerId) pill = h("span", { class: "pill xs tone-leaf" }, "جديد");
    else if (bp.matchedBy === "name") pill = h("span", { class: "pill xs tone-warning" }, "مطابق بالاسم");
    else pill = h("span", { class: "pill xs tone-outline" }, "مسجّل في تنفيذ");

    const keyed = new Set(bp.files.map(function (f) { return f.key; }));
    const extra = (scanOffer ? scanOffer.files : []).filter(function (f) { return !f.key || !keyed.has(f.key); }).map(function (f) {
      return { key: null, name: f.name, action: "nokey" };
    });
    const files = bp.files.concat(extra);
    const meta = [];
    if (bp.contractorUnifiedNumber) meta.push("الرقم الموحد " + bp.contractorUnifiedNumber);
    if (scanOffer && scanOffer.isSme === true) meta.push("منشأة صغيرة أو متوسطة");
    return h("section", { class: "card", style: { padding: "12px" } },
      h("div", { class: "row-between" }, h("b", { class: "title-sm" }, bp.contractorName), pill),
      meta.length ? h("p", { class: "muted xs", style: { marginTop: "2px" } }, meta.join(" · ")) : null,
      live && live.message ? h("p", { class: "xs tone-danger-text", style: { marginTop: "6px" } }, live.message) : null,
      scanOffer && scanOffer.error ? h("p", { class: "xs tone-danger-text", style: { marginTop: "6px" } }, scanOffer.error) : null,
      files.length
        ? h("ul", { class: "rows" }, files.map(function (f) { return fileLine(f, live && f.key ? live.files[f.key] : null); }))
        : h("p", { class: "muted xs", style: { marginTop: "6px" } }, scanOffer && scanOffer.error ? "" : "لا ملفات في صفحة العرض على اعتماد."));
  }

  function tenderState() {
    const s = status;
    const scan = scanOf();
    const title = s.tenderName || (scan && scan.tenderName) || "عروض المنافسة";

    if (s.scanning || (!s.scan && !scan)) {
      return [headCard(title, s.reference, h("p", { class: "muted sm" }, h("span", { class: "row-between", style: { justifyContent: "flex-start" } }, icon("loader", 14, "spin"), "جار قراءة العروض وملفاتها من اعتماد…"))), note()];
    }
    if (s.scan && !s.scan.ok) {
      return [
        headCard(title, s.reference,
          h("div", null,
            h("div", { class: "alert tone-warning" }, icon("alert", 16), h("span", null, s.scan.message)),
            h("button", { class: "btn btn-ghost btn-block", type: "button", style: { marginTop: "10px" }, on: { click: rescan } }, icon("refresh", 16), "اقرأ من جديد"))),
        note(),
      ];
    }
    if (!plan || planning) {
      return [headCard(title, scan.reference, h("p", { class: "muted sm" }, "قُرئ " + offersN(scan.offers.length) + " — جار مطابقتها مع تنفيذ…")), note()];
    }
    if (plan.error) {
      return [
        headCard(title, scan.reference,
          h("div", null,
            h("div", { class: "alert tone-warning" }, icon("alert", 16), h("span", null, plan.error.message)),
            h("button", { class: "btn btn-ghost btn-block", type: "button", style: { marginTop: "10px" }, on: { click: function () { plan = null; ensurePlan(true).then(render); render(); } } }, icon("refresh", 16), "تحقق من جديد"))),
        note(),
      ];
    }

    const data = plan.data;
    const byId = new Map(scan.offers.map(function (o) { return [o.etimadOfferId, o]; }));
    const fresh = data.bidders.filter(function (b) { return !b.offerId; }).length;
    const uploads = data.bidders.reduce(function (n, b) { return n + work(b).uploads.length; }, 0);
    const toDo = data.bidders.filter(function (b) { const w = work(b); return w.create || w.uploads.length > 0; }).length;
    const run = runner.run && runner.run.competitionId === data.competitionId ? runner.run : null;
    const running = Boolean(run && run.phase === "running");

    let action;
    if (running) {
      const all = Object.values(run.bidders);
      const doneN = all.filter(function (x) { return x.phase === "done" || x.phase === "error" || x.phase === "partial"; }).length;
      action = h("button", { class: "btn btn-primary btn-block", type: "button", attrs: { disabled: "" } }, icon("loader", 16, "spin"), "جار السحب… " + doneN + " من " + all.length);
    } else if (toDo > 0) {
      action = h("button", { class: "btn btn-primary btn-block", type: "button", on: { click: pullAll } }, icon("inbox", 16),
        "اسحب " + offersN(toDo) + (uploads ? " و" + filesN(uploads) : "") + " إلى تنفيذ");
    } else {
      action = h("div", { class: "alert", style: { background: "var(--success-soft)", color: "var(--success)" } }, icon("circleCheck", 16), h("span", null, scan.partial ? "كل العروض الظاهرة مسحوبة إلى تنفيذ." : "كل عروض اعتماد مسحوبة إلى تنفيذ."));
    }

    const extras = [];
    if (data.requiresSplit) extras.push(h("p", { class: "muted xs" }, "فوق عتبة فصل المظاريف — الفني في مظروف والمالي في مظروف، ولا يُقبل مستند جامع."));
    if (scan.partial) extras.push(h("p", { class: "xs", style: { color: "var(--warning)" } }, "قُرئت الصفحة الظاهرة من «تقرير الموردين» وحدها — انتقل إلى صفحاته الأخرى واسحب منها أيضًا."));
    if (scan.withdrawn) extras.push(h("p", { class: "muted xs" }, (scan.withdrawn === 1 ? "عرضٌ واحد سحبه صاحبه في اعتماد" : count(scan.withdrawn, "", "عرضان سحبهما أصحابهما في اعتماد", "عروض سحبها أصحابها في اعتماد", "عرضًا سحبها أصحابها في اعتماد")) + " — لا يُنقل."));
    if (running) extras.push(h("p", { class: "muted xs" }, "لا تغلق صفحة اعتماد ولا هذه اللوحة حتى ينتهي السحب."));

    return [
      headCard(data.competitionTitle || title, data.reference,
        h("div", { style: { display: "grid", gap: "10px" } },
          h("div", { class: "stats" },
            tile("neutral", data.bidders.length, "عروض في اعتماد"),
            tile(fresh ? "success" : "neutral", fresh, "جديدة"),
            tile(uploads ? "success" : "neutral", uploads, "ملفات للرفع")),
          extras.length ? h("div", { style: { display: "grid", gap: "4px" } }, extras) : null,
          action,
          h("div", { class: "row-between" },
            h("button", { class: "btn btn-ghost btn-sm", type: "button", attrs: running ? { disabled: "" } : {}, on: { click: rescan } }, icon("refresh", 14), "اقرأ من جديد"),
            h("button", { class: "btn btn-ghost btn-sm", type: "button", on: { click: function () { app.openUrl(competitionUrl(app, data.competitionId)); } } }, icon("external", 14), "افتح المنافسة في تنفيذ")))),
      h("div", { class: "list" }, data.bidders.map(function (bp) { return bidderCard(bp, byId.get(bp.etimadOfferId)); })),
      note(),
    ];
  }

  function render() {
    if (!alive) return;
    root.replaceChildren();
    let parts;
    if (app.state.ctx.site !== "etimad") parts = awayState();
    else if (!status || !status.tenderId) parts = noTenderState();
    else parts = tenderState();
    parts.filter(Boolean).forEach(function (p) {
      root.appendChild(p);
    });
  }

  render();
  poll();
  const busy = function () {
    return Boolean(runner.run && runner.run.phase === "running");
  };
  timer = setInterval(function () {
    // أثناء السحب لا نعيد القراءة ولا الخطة — الحال في runner.run.
    if (!busy()) poll();
  }, POLL_MS);
  const off = app.subscribe(function (keys) {
    if (keys.indexOf("ctx") !== -1 && !busy()) poll();
  });
  runner.listeners.add(render);

  return {
    destroy() {
      alive = false;
      clearInterval(timer);
      runner.listeners.delete(render);
      off();
    },
  };
}
