// الإعدادات — الحساب وتسجيل الخروج، ومفاتيح التعبئة، والمظهر، والبيانات المحلية.

import { firstName, logout } from "../../shared/api.js";
import { KEYS, SERVERS } from "../../shared/config.js";
import { chat } from "../chat-store.js";
import { firstLetter, h, icon } from "../dom.js";

const TOGGLES = [
  { key: "enabled", title: "تفعيل التعبئة في اعتماد", sub: "عند الإيقاف: لا شريط ولا تعبئة في اعتماد، ولا التقاط من البوابة." },
  { key: "autoFill", title: "التعبئة التلقائية", sub: "تملأ كل خطوة فور فتحها. عند الإيقاف تملأ بالضغط على «تعبئة الحقول»." },
  { key: "showOverlay", title: "شريط تنفيذ في اعتماد", sub: "الشريط العلوي والإطار داخل صفحات اعتماد." },
  { key: "fillCriteria", title: "إضافة معايير التقييم", sub: "إضافة شجرة المعايير وأوزانها. أوقفها لتعبئة الحقول فقط." },
];

const THEMES = [
  { id: "light", label: "فاتح", icon: "sun" },
  { id: "dark", label: "داكن", icon: "moon" },
  { id: "system", label: "النظام", icon: "monitor" },
];

export function mountSettings(container, app) {
  const root = h("div", { class: "pane" });
  container.appendChild(root);
  let signingOut = false;

  function toggle(t) {
    const on = Boolean(app.state.settings[t.key]);
    const disabled = t.key !== "enabled" && !app.state.settings.enabled;
    const id = "tg-" + t.key;
    return h("div", { class: "toggle-row" + (disabled ? " is-disabled" : "") },
      h("label", { class: "toggle-txt", htmlFor: id }, h("b", null, t.title), h("span", null, t.sub)),
      h("button", {
        id,
        class: "switch" + (on ? " is-on" : ""),
        type: "button",
        disabled,
        attrs: { role: "switch", "aria-checked": on ? "true" : "false" },
        on: { click: function () { app.setSettings({ [t.key]: !on }); } },
      }, h("i")));
  }

  function render() {
    const session = app.state.session;
    if (!session) return;
    const user = session.user || {};
    const server = SERVERS[session.serverId];

    root.replaceChildren(
      h("div", { class: "section-head" },
        h("button", { class: "icon-btn", type: "button", title: "رجوع", attrs: { "aria-label": "رجوع إلى المساعد" }, on: { click: function () { app.go("chat"); } } }, icon("arrowLeft", 18, "flip")),
        h("h2", { class: "title-md" }, "الحساب والإعدادات")),

      h("section", { class: "card account" },
        h("span", { class: "avatar lg" }, firstLetter(firstName(user))),
        h("div", { class: "account-txt" },
          h("b", null, user.fullName || firstName(user)),
          h("span", { attrs: { dir: "ltr" } }, user.email || ""),
          h("span", { class: "pill tone-" + (session.serverId === "prod" ? "brand" : "info") + " xs" }, icon("server", 12), "خادم " + server.label)),
        h("button", {
          class: "btn btn-ghost btn-sm tone-danger-text",
          type: "button",
          disabled: signingOut,
          on: {
            click: async function () {
              signingOut = true;
              render();
              await chat.reset();
              await logout();
            },
          },
        }, icon(signingOut ? "loader" : "logout", 15, signingOut ? "spin" : ""), "تسجيل الخروج")),

      h("h3", { class: "group-title" }, "التعبئة في اعتماد"),
      h("section", { class: "card flush" }, TOGGLES.map(toggle)),

      h("h3", { class: "group-title" }, "المظهر"),
      h("div", { class: "seg seg-sm", attrs: { role: "radiogroup", "aria-label": "المظهر" } }, THEMES.map(function (t) {
        const on = (app.state.prefs.theme || "system") === t.id;
        return h("button", {
          class: "seg-btn" + (on ? " is-on" : ""),
          type: "button",
          attrs: { role: "radio", "aria-checked": on ? "true" : "false" },
          on: { click: function () { app.setPrefs({ theme: t.id }).then(render); } },
        }, icon(t.icon, 15), t.label);
      })),

      h("h3", { class: "group-title" }, "البيانات على هذا الجهاز"),
      h("section", { class: "card flush" },
        h("button", {
          class: "list-btn",
          type: "button",
          on: { click: async function () { await chrome.storage.local.set({ [KEYS.fill]: null, [KEYS.log]: {} }); app.toast("مسحنا بيانات التعبئة."); } },
        }, icon("trash", 16), h("span", null, "مسح بيانات التعبئة وسجلها")),
        h("button", {
          class: "list-btn",
          type: "button",
          on: { click: async function () { await chat.reset(); app.toast("مسحنا المحادثة."); } },
        }, icon("newChat", 16), h("span", null, "مسح المحادثة"))),

      h("div", { class: "note" }, icon("shield", 16), h("span", null, "الإضافة لا تضغط «حفظ ومتابعة» في اعتماد أبدا، ولا ترسل بيانات إلا إلى خادم تنفيذ الذي سجلت الدخول إليه.")),
      h("p", { class: "fineprint center" }, "تنفيذ — الإصدار " + chrome.runtime.getManifest().version));
  }

  const off = app.subscribe(function (keys) {
    if (keys.indexOf("settings") !== -1 || keys.indexOf("session") !== -1) render();
  });
  render();

  return { destroy: off };
}
