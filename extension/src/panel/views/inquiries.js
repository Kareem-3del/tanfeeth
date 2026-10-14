// الاستفسارات — دورة استفسارات الموردين من اللوحة: سحبها من اعتماد، وكتابة الردود
// المعتمدة في خاناتها. الأفعال نفسها التي في شريط تنفيذ أعلى صفحة اعتماد — اللوحة
// تطلبها من سكربت الصفحة (TNF_INQ_ACTION) ولا تحمل منطقًا ثانيًا.

import { ETIMAD_ORIGIN } from "../../shared/config.js";
import { ago, h, icon } from "../dom.js";

const ENQUIRY_LIST_URL = ETIMAD_ORIGIN + "/Enquiry/SupplierEnquiryList";
const POLL_MS = 2500;

/** «مركز المراسلات» في واجهة تنفيذ لكل خادم. */
function centerUrl(app, competitionId) {
  const id = app.state.session && app.state.session.serverId;
  const server = app.server();
  const base = id === "staging" ? "https://demo.tanfeeth.io" : id === "local" ? "http://localhost:3010" : server ? server.web : "";
  return base + "/portal/communications" + (competitionId ? "?competitionId=" + encodeURIComponent(competitionId) : "");
}

function n(value) {
  return Number(value || 0);
}

export function mountInquiries(container, app) {
  const root = h("div", { class: "pane" });
  container.appendChild(root);
  let status = null; // ما قالته الصفحة آخر مرة، أو null
  let reached = false; // هل ردّ سكربت الصفحة أصلًا
  let busy = null; // الفعل الجاري من اللوحة
  let timer = null;

  async function poll() {
    if (app.state.ctx.site !== "etimad") {
      status = null;
      reached = false;
      render();
      return;
    }
    const res = await app.sendToEtimad({ type: "TNF_INQ_STATUS" });
    reached = Boolean(res);
    status = res || null;
    render();
  }

  async function act(action) {
    if (busy) return;
    busy = action;
    render();
    const res = await app.sendToEtimad({ type: "TNF_INQ_ACTION", action });
    busy = null;
    if (res) status = res;
    else app.toast("حدّث صفحة اعتماد (F5) ثم أعد المحاولة.", "danger");
    render();
  }

  // ───────────────────────────────────────────────────────── أجزاء ──

  /** الدورة بخطواتها — لمن يفتح اللوحة أول مرة. */
  function loopNote() {
    return h("div", { class: "note" },
      icon("route", 16),
      h("span", null, "يُسحب الاستفسار من صفحة المنافسة في اعتماد ← تردّ عليه الإدارة صاحبة المشروع في «مركز المراسلات» ← يُعتمد الرد ← تكتبه الإضافة في خانته هنا وأنت تضغط «إرسال» في اعتماد."));
  }

  function centerButton(competitionId) {
    return h("button", { class: "btn btn-ghost btn-block", type: "button", on: { click: function () { app.openUrl(centerUrl(app, competitionId)); } } },
      icon("external", 16), "افتح «مركز المراسلات» في تنفيذ");
  }

  function recentList() {
    const store = app.state.inquiries;
    const records = store && store.byRef ? Object.values(store.byRef) : [];
    if (!records.length) return null;
    records.sort(function (a, b) {
      return (b.at || 0) - (a.at || 0);
    });
    return h("section", { class: "card" },
      h("span", { class: "overline" }, icon("clock", 14), "آخر المزامنات"),
      h("div", { class: "list", style: { marginTop: "8px" } },
        records.slice(0, 5).map(function (rec) {
          const writes = Array.isArray(rec.writes) ? rec.writes.length : 0;
          return h("div", { class: "ready-meta", style: { justifyContent: "space-between" } },
            h("span", null, h("b", { style: { color: "var(--ink)" } }, rec.competitionTitle || rec.tenderName || rec.reference)),
            h("span", null, ago(rec.at) + (writes ? " · " + writes + " جاهزة للكتابة" : "")));
        })));
  }

  function tile(tone, value, label) {
    return h("div", { class: "stat tone-" + tone }, h("b", null, String(value)), h("span", null, label));
  }

  function awayState() {
    return [
      h("div", { class: "empty tall" },
        h("span", { class: "empty-disc" }, icon("listChecks", 22)),
        h("b", null, "استفسارات الموردين"),
        h("p", null, "افتح صفحة المنافسة في اعتماد لتسحب استفساراتها إلى تنفيذ، أو لتكتب الردود المعتمدة في خاناتها."),
        h("button", { class: "btn btn-primary", type: "button", on: { click: function () { app.openUrl(ENQUIRY_LIST_URL); } } }, icon("external", 16), "افتح «إستفسارات الموردين» في اعتماد")),
      loopNote(),
      centerButton(null),
      recentList(),
    ];
  }

  function tenderState(s) {
    const c = s.competition || { state: "checking" };
    const title = c.title || s.tenderName || "استفسارات المنافسة";
    const head = h("div", null,
      h("span", { class: "overline" }, icon("listChecks", 14), "استفسارات الموردين"),
      h("h2", { class: "ready-title" }, title),
      s.reference ? h("p", { class: "ready-meta" }, h("span", null, "الرقم المرجعي"), h("span", { attrs: { dir: "ltr" } }, s.reference)) : null);

    if (!s.reference) {
      return [h("section", { class: "card" }, head, h("div", { class: "alert tone-warning", style: { marginTop: "10px" } }, icon("alert", 16),
        h("span", null, s.page === "reply" ? "لا نعرف الرقم المرجعي لهذه المنافسة — افتح «تفاصيل المنافسة» مرة ثم عد." : "لم نجد «الرقم المرجعي» في هذه الصفحة.")))];
    }
    if (c.state === "checking") {
      return [h("section", { class: "card" }, head, h("p", { class: "muted sm", style: { marginTop: "10px" } }, "جار التحقق من وجود المنافسة في تنفيذ…"))];
    }
    if (c.state !== "matched") {
      return [
        h("section", { class: "card" }, head,
          h("div", { class: "alert tone-warning", style: { marginTop: "10px" } }, icon("alert", 16),
            h("span", null, c.state === "none"
              ? "هذه المنافسة غير مسجّلة في تنفيذ — سجّل رقمها المرجعي في خطوة «اعتماد الطرح» على مشروعها أولًا، ثم زامن."
              : c.message || "تعذر التحقق من المنافسة في تنفيذ.")),
          h("button", { class: "btn btn-ghost btn-block", type: "button", style: { marginTop: "10px" }, attrs: busy ? { disabled: "" } : {}, on: { click: function () { act("recheck"); } } },
            icon("refresh", 16), "تحقق من جديد")),
        loopNote(),
      ];
    }

    const counts = c.counts || {};
    const syncing = busy === "sync" || s.phase === "syncing";
    const writing = busy === "write" || s.phase === "writing";
    const actions = [];
    if (s.writes > 0) {
      actions.push(h("button", { class: "btn btn-primary btn-block", type: "button", attrs: writing || syncing ? { disabled: "" } : {}, on: { click: function () { act("write"); } } },
        icon(writing ? "loader" : "fill", 16, writing ? "spin" : ""), writing ? "جار الكتابة…" : "اكتب الردود الجاهزة في اعتماد (" + s.writes + ")"));
    }
    actions.push(h("button", { class: "btn " + (s.writes > 0 ? "btn-ghost" : "btn-primary") + " btn-block", type: "button", attrs: syncing || writing ? { disabled: "" } : {}, on: { click: function () { act("sync"); } } },
      icon(syncing ? "loader" : "refresh", 16, syncing ? "spin" : ""), syncing ? "جار المزامنة…" : "مزامنة الاستفسارات" + (s.total != null ? " (" + s.total + ")" : "")));

    return [
      h("section", { class: "card stats-wrap" },
        head,
        h("div", { class: "stats", style: { marginTop: "10px" } },
          tile("neutral", n(counts.waitingAnswer), "تنتظر رد الإدارة"),
          tile("neutral", n(counts.waitingApproval), "تنتظر الاعتماد"),
          tile(s.writes > 0 ? "success" : "neutral", s.writes, "جاهزة للكتابة")),
        s.message
          ? h("p", { class: "muted sm", style: { marginTop: "10px" } }, s.message)
          : s.syncedAt
            ? h("p", { class: "muted sm", style: { marginTop: "10px" } }, "آخر مزامنة " + ago(s.syncedAt))
            : h("p", { class: "muted sm", style: { marginTop: "10px" } }, "لم تُسحب استفساراتها بعد — زامن لتصل إلى الإدارة."),
        h("div", { style: { display: "grid", gap: "8px", marginTop: "12px" } }, actions),
        s.writes > 0 ? h("p", { class: "muted sm", style: { marginTop: "8px" } }, "الإضافة تملأ الخانات ولا ترسل — راجِع كل رد واضغط «إرسال» في اعتماد بنفسك.") : null),
      centerButton(c.id || null),
      loopNote(),
    ];
  }

  function listState(s) {
    const matched = s.matched || [];
    const running = busy === "syncAll" || Boolean(s.bulk && s.bulk.done < s.bulk.total);
    return [
      h("section", { class: "card" },
        h("span", { class: "overline" }, icon("listChecks", 14), "استفسارات الموردين"),
        h("h2", { class: "ready-title" }, matched.length + " من " + (s.cards || 0) + " منافسات مسجّلة في تنفيذ"),
        s.message ? h("p", { class: "muted sm" }, s.message) : null,
        matched.length
          ? h("div", { class: "list", style: { marginTop: "8px" } },
            matched.map(function (m) {
              const counts = m.counts || {};
              return h("div", { class: "ready-meta", style: { justifyContent: "space-between" } },
                h("span", null, h("b", { style: { color: "var(--ink)" } }, m.title)),
                h("span", null, n(counts.waitingAnswer) + " بلا رد · " + n(counts.pendingOnEtimad) + " جاهزة"));
            }))
          : h("p", { class: "muted sm" }, "لا منافسة في هذه الصفحة مسجّلة في تنفيذ — الإضافة لا تسحب إلا ما له مشروع."),
        matched.length
          ? h("button", { class: "btn btn-primary btn-block", type: "button", style: { marginTop: "12px" }, attrs: running ? { disabled: "" } : {}, on: { click: function () { act("syncAll"); } } },
            icon(running ? "loader" : "refresh", 16, running ? "spin" : ""), running ? "جار المزامنة…" : "مزامنة الكل (" + matched.length + ")")
          : null),
      centerButton(null),
      loopNote(),
    ];
  }

  function otherEtimadState() {
    if (!reached) {
      return [
        h("div", { class: "alert tone-warning" }, icon("alert", 16),
          h("span", null, "افتح صفحة المنافسة («تفاصيل المنافسة») أو «إستفسارات الموردين» في اعتماد. إن كانت مفتوحة فحدّثها (F5).")),
        h("button", { class: "btn btn-primary btn-block", type: "button", on: { click: function () { app.openUrl(ENQUIRY_LIST_URL); } } }, icon("external", 16), "افتح «إستفسارات الموردين»"),
        loopNote(),
        recentList(),
      ];
    }
    return [h("p", { class: "muted sm" }, "جار تجهيز الصفحة…")];
  }

  function render() {
    root.replaceChildren();
    let parts;
    if (app.state.ctx.site !== "etimad") parts = awayState();
    else if (!status || !status.started) parts = otherEtimadState();
    else if (status.page === "list") parts = listState(status);
    else parts = tenderState(status);
    parts.filter(Boolean).forEach(function (p) {
      root.appendChild(p);
    });
  }

  render();
  poll();
  timer = setInterval(poll, POLL_MS);
  const off = app.subscribe(function (keys) {
    if (keys.indexOf("ctx") !== -1) poll();
    else if (keys.indexOf("inquiries") !== -1) render();
  });

  return {
    destroy() {
      clearInterval(timer);
      off();
    },
  };
}
