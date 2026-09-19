// المشاريع — قائمة مشاريع المستخدم من تنفيذ، واختيار مشروع لتعبئة اعتماد منه
// مباشرة (GET /competitions/:id/etimad-fill-payload) دون المرور بالبوابة.

import { apiGet, fetchFillRecord } from "../../shared/api.js";
import { CALENDAR_HINTS, KEYS } from "../../shared/config.js";
import { h, icon } from "../dom.js";
import { STAGE_LABEL, STATUS_LABEL, STATUS_TONE } from "../labels.js";

const PAGE_SIZE = 20;

// تبقى بين التنقلات: البحث والنتائج.
const memo = { query: "", items: [], total: 0, page: 0, at: 0, serverId: null };

export function mountProjects(container, app) {
  const serverId = app.state.session && app.state.session.serverId;
  if (memo.serverId !== serverId) Object.assign(memo, { query: "", items: [], total: 0, page: 0, at: 0, serverId });
  let loading = false;
  let error = null;
  let picking = null;
  let request = null;
  let debounce = 0;

  const search = h("input", {
    class: "search-input",
    type: "search",
    value: memo.query,
    attrs: { placeholder: "ابحث باسم المشروع أو رقمه", "aria-label": "بحث في المشاريع" },
  });
  const list = h("div", { class: "list" });
  const intro = h("div", { class: "section-head" },
    h("div", null,
      h("h2", { class: "title-md" }, "اختر مشروعا للتعبئة"),
      h("p", { class: "muted sm" }, "نجهز بياناته ونملأ بها نموذج المنافسة في اعتماد — المراجعة والحفظ عليك.")));

  container.appendChild(h("div", { class: "pane" },
    intro,
    h("label", { class: "search" }, icon("search", 17), search),
    list));

  async function load(reset) {
    if (request) request.abort();
    request = new AbortController();
    loading = true;
    error = null;
    if (reset) {
      memo.items = [];
      memo.page = 0;
    }
    render();
    const page = memo.page + 1;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (memo.query.trim()) params.set("search", memo.query.trim());
    try {
      const res = await apiGet("/competitions?" + params.toString(), request.signal);
      memo.items = reset ? res.items : memo.items.concat(res.items);
      memo.total = res.total;
      memo.page = page;
      memo.at = Date.now();
    } catch (err) {
      if (err && err.name === "AbortError") return;
      error = err;
    }
    loading = false;
    render();
  }

  async function pick(item) {
    if (picking) return;
    picking = item.id;
    render();
    try {
      const record = await fetchFillRecord(item.id, CALENDAR_HINTS);
      await chrome.storage.local.set({ [KEYS.fill]: record, [KEYS.log]: {} });
      picking = null;
      app.go("fill"); // يعيد رسم اللوحة — التنبيه بعده
      if (app.state.ctx.site === "etimad") {
        app.toast(app.state.settings.autoFill ? "جهزنا «" + record.meta.title + "» — تبدأ التعبئة في اعتماد." : "جهزنا «" + record.meta.title + "» — اضغط «تعبئة الحقول» في اعتماد.", "success");
      } else {
        app.toast("جهزنا «" + record.meta.title + "» للتعبئة.", "success");
      }
    } catch (err) {
      picking = null;
      render();
      app.toast((err && err.message) || "تعذر تجهيز بيانات المشروع.", "danger");
    }
  }

  function card(item) {
    const selected = app.validRecord();
    const isSelected = selected && selected.meta && selected.meta.competitionId === item.id;
    const busy = picking === item.id;
    const server = app.server();
    const meta = [STAGE_LABEL[item.stage], item.requestNumber, item.year].filter(Boolean);
    return h("article", { class: "card project" + (isSelected ? " is-selected" : "") },
      h("div", { class: "project-top" },
        h("span", { class: "pill tone-" + (STATUS_TONE[item.status] || "neutral") }, STATUS_LABEL[item.status] || item.status),
        isSelected ? h("span", { class: "pill tone-leaf" }, icon("check", 12), "جاهز للتعبئة") : null),
      h("h3", { class: "project-title" }, item.title),
      h("p", { class: "project-meta" }, meta.join(" · ")),
      item.requestingDepartment ? h("p", { class: "project-meta faint" }, item.requestingDepartment) : null,
      h("div", { class: "project-acts" },
        h("button", {
          class: "btn btn-primary btn-sm",
          type: "button",
          disabled: Boolean(picking),
          on: { click: function () { pick(item); } },
        }, icon(busy ? "loader" : isSelected ? "refresh" : "fill", 15, busy ? "spin" : ""), busy ? "جار التجهيز…" : isSelected ? "إعادة التجهيز" : "تعبئة في اعتماد"),
        server
          ? h("button", {
              class: "icon-btn",
              type: "button",
              title: "فتح في تنفيذ",
              attrs: { "aria-label": "فتح المشروع في تنفيذ" },
              on: { click: function () { app.openUrl(server.web + "/portal/competitions/" + item.id); } },
            }, icon("external", 16))
          : null));
  }

  function render() {
    const nodes = [];
    if (error) {
      const forbidden = error.status === 403;
      nodes.push(h("div", { class: "empty" },
        h("span", { class: "empty-disc tone-danger" }, icon(forbidden ? "lock" : "alert", 20)),
        h("b", null, forbidden ? "لا تملك صلاحية عرض المشاريع" : "تعذر تحميل المشاريع"),
        h("p", null, forbidden ? "اطلب صلاحية «عرض المشاريع» من مسؤول النظام." : error.message),
        forbidden ? null : h("button", { class: "btn btn-ghost btn-sm", type: "button", on: { click: function () { load(true); } } }, icon("refresh", 15), "أعد المحاولة")));
    } else if (!memo.items.length && loading) {
      for (let i = 0; i < 4; i++) {
        nodes.push(h("div", { class: "card skeleton" }, h("i", { class: "sk sk-pill" }), h("i", { class: "sk sk-line" }), h("i", { class: "sk sk-line short" })));
      }
    } else if (!memo.items.length) {
      const searching = Boolean(memo.query.trim());
      nodes.push(h("div", { class: "empty" },
        h("span", { class: "empty-disc" }, icon(searching ? "search" : "folder", 20)),
        h("b", null, searching ? "لا نتائج مطابقة" : "لا مشاريع بعد"),
        h("p", null, searching ? "جرب كلمات أخرى أو رقم الطلب." : "أنشئ مشروعا في تنفيذ ليظهر هنا.")));
    } else {
      memo.items.forEach(function (item) {
        nodes.push(card(item));
      });
      if (memo.items.length < memo.total) {
        nodes.push(h("button", {
          class: "btn btn-ghost btn-block",
          type: "button",
          disabled: loading,
          on: { click: function () { load(false); } },
        }, loading ? icon("loader", 15, "spin") : null, loading ? "جار التحميل…" : "عرض المزيد (" + (memo.total - memo.items.length) + ")"));
      }
    }
    list.replaceChildren.apply(list, nodes);
  }

  search.addEventListener("input", function () {
    clearTimeout(debounce);
    debounce = setTimeout(function () {
      memo.query = search.value;
      load(true);
    }, 300);
  });

  const off = app.subscribe(function (keys) {
    if (keys.indexOf("record") !== -1) render();
  });

  // نتائج أحدث من دقيقة تُعرض فورا، وإلا تُجلب من جديد.
  if (memo.items.length && Date.now() - memo.at < 60000) render();
  else load(true);

  return {
    destroy() {
      clearTimeout(debounce);
      if (request) request.abort();
      off();
    },
  };
}
