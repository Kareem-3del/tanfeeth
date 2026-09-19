// التعبئة — المشروع الجاهز، وتشغيل التعبئة في تبويب اعتماد، ونتيجة آخر تعبئة،
// وما في الحمولة (سجل الحقول، ومعايير التقييم، والحقول المسطحة).

import { KEYS, MAX_AGE_MS } from "../../shared/config.js";
import { ago, h, icon, remaining } from "../dom.js";
import { FILL_STATUS } from "../labels.js";

const FINANCIAL = ["السعر", "سعر", "التكلفة", "تكلفة", "التكلفة الكلية", "العرض المالي", "التقييم المالي"];
function isFinancial(t) {
  return FINANCIAL.indexOf(String(t == null ? "" : t).replace(/\s+/g, " ").trim()) !== -1;
}

function shortValue(v) {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.join("، ") || "—";
  if (typeof v === "boolean") return v ? "نعم" : "لا";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s.length > 120 ? s.slice(0, 120) + "…" : s;
}

// التبويب الداخلي والتصفية يبقيان بين التنقلات.
const ui = { tab: "log", filter: "all", query: "" };

export function mountFill(container, app) {
  let filling = false;
  const root = h("div", { class: "pane" });
  container.appendChild(root);

  function latestLog() {
    const log = app.state.log || {};
    let key = null;
    Object.keys(log).forEach(function (k) {
      if (!key || (log[k].at || 0) > (log[key].at || 0)) key = k;
    });
    return key ? Object.assign({ page: key }, log[key]) : null;
  }

  async function fillHere() {
    if (filling) return;
    filling = true;
    render();
    const res = await app.sendToEtimad({ type: "TNF_FILL_NOW" });
    filling = false;
    render();
    if (!res) app.toast("حدث صفحة اعتماد (F5) ثم أعد المحاولة — الصفحة فُتحت قبل تفعيل الإضافة.", "danger");
    else if (res.ok) app.toast("تمت تعبئة " + res.summary.filled + " حقلا — راجع ثم اضغط «حفظ ومتابعة».", "success");
    else if (res.reason === "BUSY") app.toast("التعبئة جارية بالفعل.");
    else app.toast("تعذرت التعبئة في هذه الصفحة.", "danger");
  }

  async function clearData() {
    await chrome.storage.local.set({ [KEYS.fill]: null, [KEYS.log]: {} });
    app.toast("مسحنا بيانات التعبئة.");
  }

  // ────────────────────────────────────────────────────────── أجزاء ──

  function emptyState(expired) {
    return h("div", { class: "empty tall" },
      h("span", { class: "empty-disc" }, icon(expired ? "clock" : "fill", 22)),
      h("b", null, expired ? "انتهت صلاحية بيانات التعبئة" : "لا يوجد مشروع جاهز للتعبئة"),
      h("p", null, expired
        ? "البيانات صالحة ساعتين من تجهيزها حتى لا تعبأ اعتماد بقيم قديمة. جهزها من جديد."
        : "اختر مشروعا من قائمة مشاريعك، أو اضغط «التعبئة في اعتماد» من داخل بوابة تنفيذ."),
      h("button", { class: "btn btn-primary", type: "button", on: { click: function () { app.go("projects"); } } }, icon("folder", 16), "اختيار مشروع"));
  }

  function recordCard(record) {
    const meta = record.meta || {};
    const left = MAX_AGE_MS - (Date.now() - record.savedAt);
    const onEtimad = app.state.ctx.site === "etimad";
    const primary = onEtimad
      ? h("button", { class: "btn btn-primary", type: "button", disabled: filling || !app.state.settings.enabled, on: { click: fillHere } },
          icon(filling ? "loader" : "fill", 16, filling ? "spin" : ""), filling ? "جار التعبئة…" : "تعبئة هذه الصفحة")
      : h("button", { class: "btn btn-primary", type: "button", on: { click: function () { app.openEtimad(); } } }, icon("external", 16), "فتح نموذج اعتماد");

    return h("section", { class: "card ready" },
      h("div", { class: "ready-top" },
        h("span", { class: "overline" }, h("i", { class: "live-dot" }), "جاهز للتعبئة"),
        h("button", { class: "icon-btn sm", type: "button", title: "مسح", attrs: { "aria-label": "مسح بيانات التعبئة" }, on: { click: clearData } }, icon("trash", 16))),
      h("h2", { class: "ready-title" }, meta.title || "مشروع بلا عنوان"),
      h("p", { class: "ready-meta" },
        icon("clock", 14),
        h("span", null, "جهزت " + ago(record.savedAt) + " · تنتهي خلال " + remaining(left)),
        h("span", { class: "dot-sep" }),
        h("span", null, meta.source === "extension" ? "من الإضافة" : "من بوابة تنفيذ")),
      !app.state.settings.enabled
        ? h("div", { class: "alert tone-warning" }, icon("alert", 16), h("span", null, "الإضافة متوقفة — فعلها من الإعدادات لتعمل التعبئة."))
        : null,
      h("div", { class: "ready-acts" },
        primary,
        h("button", { class: "btn btn-ghost", type: "button", on: { click: function () { app.go("projects"); } } }, "تغيير المشروع")),
      onEtimad ? null : h("p", { class: "muted sm" }, "افتح نموذج إنشاء المنافسة في اعتماد وسنملأ كل خطوة من خطواته السبع تلقائيا."));
  }

  function stats(entry) {
    if (!entry) {
      return h("div", { class: "note" }, icon("shield", 16), h("span", null, "لم تنفذ أي تعبئة بعد. الإضافة لا تضغط «حفظ ومتابعة» أبدا — المراجعة والحفظ عليك."));
    }
    const tile = function (tone, value, label) {
      return h("div", { class: "stat tone-" + tone }, h("b", null, String(value)), h("span", null, label));
    };
    return h("section", { class: "stats-wrap" },
      h("div", { class: "row-between" },
        h("h3", { class: "title-sm" }, "آخر تعبئة"),
        h("span", { class: "muted xs", attrs: { dir: "ltr" }, title: entry.page }, ago(entry.at))),
      h("div", { class: "stats" }, tile("success", entry.filled, "تمت"), tile("neutral", entry.skipped, "تخطي"), tile("danger", entry.failed, "تعذر")));
  }

  function logList(entry) {
    const rows = entry && Array.isArray(entry.rows) ? entry.rows : [];
    if (!rows.length) return h("div", { class: "empty sm" }, h("p", null, "لا توجد تفاصيل بعد — تظهر هنا بعد أول تعبئة."));
    const filtered = rows.filter(function (r) {
      return ui.filter === "all" || r.status === ui.filter;
    });
    const filters = [["all", "الكل", rows.length], ["failed", "تعذر", 0], ["skipped", "تخطي", 0], ["filled", "تمت", 0]].map(function (f) {
      if (f[0] !== "all") f[2] = rows.filter(function (r) { return r.status === f[0]; }).length;
      return f;
    });
    return h("div", null,
      h("div", { class: "chips wrap" }, filters.map(function (f) {
        return h("button", {
          class: "chip" + (ui.filter === f[0] ? " is-on" : ""),
          type: "button",
          on: { click: function () { ui.filter = f[0]; render(); } },
        }, f[1], h("span", { class: "chip-count" }, String(f[2])));
      })),
      filtered.length
        ? h("ul", { class: "rows" }, filtered.map(function (r) {
            const st = FILL_STATUS[r.status] || FILL_STATUS.skipped;
            return h("li", { class: "row" },
              h("span", { class: "row-icon tone-" + st.tone, title: st.label }, icon(st.icon, 16)),
              h("span", { class: "row-main" },
                h("span", { class: "row-key", attrs: { dir: "auto" } }, r.key),
                r.detail ? h("span", { class: "row-detail" }, r.detail) : null));
          }))
        : h("div", { class: "empty sm" }, h("p", null, "لا صفوف بهذه الحالة.")));
  }

  function criteria(raw) {
    const tree = raw && Array.isArray(raw.evaluationCriteria) ? raw.evaluationCriteria : [];
    if (!tree.length) return h("div", { class: "empty sm" }, h("p", null, "لا توجد معايير تقييم في هذا المشروع."));
    const nodes = tree.map(function (c) {
      const kids = Array.isArray(c.children) ? c.children : [];
      return h("li", { class: "crit" },
        h("div", { class: "crit-row" },
          h("span", { class: "crit-name" }, c.title, isFinancial(c.title) ? h("span", { class: "pill tone-warning xs", title: "جدول التقييم المالي ثابت في اعتماد — يذهب وزنه للتقييم المالي" }, "مالي") : null),
          h("span", { class: "crit-weight" }, String(c.weight) + "%")),
        kids.length
          ? h("ul", { class: "crit-kids" }, kids.map(function (k) {
              return h("li", { class: "crit-row" }, h("span", null, k.title), h("span", { class: "crit-weight soft" }, String(k.weight) + "%"));
            }))
          : !isFinancial(c.title)
            ? h("p", { class: "muted xs crit-hint", title: "اعتماد يضع حقل الوزن على المستوى الثالث فقط" }, "سينشأ مستوى ثالث بنفس الاسم")
            : null);
    });
    const scalars = [["نسبة الاجتياز الفني", raw.technicalPassScore], ["وزن التقييم الفني", raw.technicalWeight], ["وزن التقييم المالي", raw.financialWeight]]
      .filter(function (p) { return p[1] !== "" && p[1] != null; });
    return h("div", null,
      h("ul", { class: "crits" }, nodes),
      scalars.length
        ? h("div", { class: "kv-grid" }, scalars.map(function (p) { return h("div", { class: "kv" }, h("span", null, p[0]), h("b", null, String(p[1]) + "%")); }))
        : null);
  }

  function fields(etimadFields) {
    const all = Object.keys(etimadFields || {}).sort().map(function (k) { return [k, etimadFields[k]]; });
    const q = ui.query.trim().toLowerCase();
    const rows = all.filter(function (f) {
      return !q || f[0].toLowerCase().indexOf(q) !== -1 || shortValue(f[1]).toLowerCase().indexOf(q) !== -1;
    });
    const input = h("input", {
      class: "search-input",
      type: "search",
      value: ui.query,
      attrs: { placeholder: "ابحث في " + all.length + " حقلا", "aria-label": "بحث في الحقول" },
      on: {
        input: function (e) {
          ui.query = e.target.value;
          const pos = e.target.selectionStart;
          render();
          const again = root.querySelector(".fields-search .search-input");
          if (again) {
            again.focus();
            again.setSelectionRange(pos, pos);
          }
        },
      },
    });
    return h("div", null,
      h("label", { class: "search fields-search" }, icon("search", 16), input),
      rows.length
        ? h("ul", { class: "rows" }, rows.map(function (f) {
            return h("li", { class: "row field-row" },
              h("span", { class: "row-main" },
                h("span", { class: "row-detail mono", attrs: { dir: "ltr" } }, f[0]),
                h("span", { class: "row-key" }, shortValue(f[1]))));
          }))
        : h("div", { class: "empty sm" }, h("p", null, all.length ? "لا نتائج مطابقة." : "لا توجد حقول.")));
  }

  function render() {
    const stored = app.state.record;
    const record = app.validRecord();
    const nodes = [];
    if (!record) {
      nodes.push(emptyState(Boolean(stored && stored.savedAt)));
      const entry = latestLog();
      if (entry) nodes.push(stats(entry));
      root.replaceChildren.apply(root, nodes);
      return;
    }
    const payload = record.payload || {};
    const entry = latestLog();
    nodes.push(recordCard(record));
    nodes.push(stats(entry));

    const TABS = [["log", "سجل التعبئة"], ["criteria", "معايير التقييم"], ["fields", "الحقول"]];
    nodes.push(h("div", { class: "seg seg-sm seg-under", attrs: { role: "tablist" } }, TABS.map(function (t) {
      return h("button", {
        class: "seg-btn" + (ui.tab === t[0] ? " is-on" : ""),
        type: "button",
        attrs: { role: "tab", "aria-selected": ui.tab === t[0] ? "true" : "false" },
        on: { click: function () { ui.tab = t[0]; render(); } },
      }, t[1]);
    })));
    if (ui.tab === "log") nodes.push(logList(entry));
    else if (ui.tab === "criteria") nodes.push(criteria(payload.raw || {}));
    else nodes.push(fields(payload.etimadFields));

    root.replaceChildren.apply(root, nodes);
  }

  const off = app.subscribe(function (keys) {
    if (["record", "log", "ctx", "settings"].some(function (k) { return keys.indexOf(k) !== -1; })) render();
  });
  // عداد الصلاحية يتحدث كل دقيقة.
  const tick = setInterval(render, 60000);
  render();

  return {
    destroy() {
      off();
      clearInterval(tick);
    },
  };
}
