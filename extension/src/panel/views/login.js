// شاشة تسجيل الدخول — الإضافة كلها مقفلة خلفها (المساعد والمشاريع والتعبئة).

import { getServerId, login } from "../../shared/api.js";
import { SERVERS } from "../../shared/config.js";
import { h, icon, mark } from "../dom.js";

const FEATURES = [
  { icon: "fill", text: "تعبئة نموذج اعتماد من بيانات مشروعك" },
  { icon: "sparkles", text: "مساعد ذكي يعرف المنصة وصلاحياتك" },
  { icon: "shield", text: "لا يحفظ ولا يرسل شيئا في اعتماد نيابة عنك" },
];

export function mountLogin(container, app) {
  let serverId = "staging";
  let busy = false;
  let showPassword = false;

  const email = h("input", {
    class: "field-input",
    type: "email",
    name: "email",
    autocomplete: "username",
    required: true,
    attrs: { dir: "ltr", placeholder: "name@tanfeeth.io", "aria-label": "البريد الإلكتروني" },
  });
  const password = h("input", {
    class: "field-input",
    type: "password",
    name: "password",
    autocomplete: "current-password",
    required: true,
    attrs: { dir: "ltr", placeholder: "••••••••", "aria-label": "كلمة المرور" },
  });
  const eye = h("button", {
    class: "field-end icon-btn sm",
    type: "button",
    attrs: { "aria-label": "إظهار كلمة المرور" },
    on: {
      click: function () {
        showPassword = !showPassword;
        password.type = showPassword ? "text" : "password";
        eye.replaceChildren(icon(showPassword ? "eyeOff" : "eye", 17));
        eye.setAttribute("aria-label", showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
      },
    },
  }, icon("eye", 17));

  const errorBox = h("div", { class: "alert tone-danger", hidden: true, attrs: { role: "alert" } });
  const submitLabel = h("span", null, "تسجيل الدخول");
  const submitIcon = h("span", { class: "btn-icon" }, icon("arrowLeft", 17));
  const submit = h("button", { class: "btn btn-primary btn-lg btn-block", type: "submit" }, submitLabel, submitIcon);

  const serverSeg = h("div", { class: "seg seg-sm", attrs: { role: "radiogroup", "aria-label": "الخادم" } });
  function renderServers() {
    serverSeg.replaceChildren.apply(serverSeg, Object.values(SERVERS).map(function (s) {
      const on = s.id === serverId;
      return h("button", {
        class: "seg-btn" + (on ? " is-on" : ""),
        type: "button",
        attrs: { role: "radio", "aria-checked": on ? "true" : "false" },
        on: { click: function () { serverId = s.id; renderServers(); } },
      }, s.label);
    }));
  }
  renderServers();
  getServerId().then(function (id) {
    serverId = id;
    renderServers();
  });

  function setBusy(value) {
    busy = value;
    submit.disabled = value;
    submitLabel.textContent = value ? "جار التحقق…" : "تسجيل الدخول";
    submitIcon.replaceChildren(icon(value ? "loader" : "arrowLeft", 17, value ? "spin" : ""));
  }

  function showError(message) {
    errorBox.replaceChildren(icon("alert", 16), h("span", null, message));
    errorBox.hidden = !message;
  }

  const form = h("form", {
    class: "login-form",
    novalidate: true,
    on: {
      submit: async function (e) {
        e.preventDefault();
        if (busy) return;
        const mail = email.value.trim();
        if (!mail || !password.value) {
          showError("أدخل البريد الإلكتروني وكلمة المرور.");
          (mail ? password : email).focus();
          return;
        }
        showError("");
        setBusy(true);
        try {
          await login(serverId, mail, password.value);
          // تغيير الجلسة في التخزين يعيد رسم اللوحة على المساعد.
        } catch (err) {
          showError((err && err.message) || "تعذر تسجيل الدخول.");
          setBusy(false);
          password.select();
        }
      },
    },
  },
    h("div", { class: "login-head" },
      h("h2", { class: "title-lg" }, "تسجيل الدخول"),
      h("p", { class: "muted" }, "استخدم حساب تنفيذ نفسه الذي تدخل به إلى البوابة.")),
    h("div", { class: "field" },
      h("span", { class: "field-label" }, icon("server", 14), "الخادم"),
      serverSeg),
    h("label", { class: "field" },
      h("span", { class: "field-label" }, "البريد الإلكتروني"),
      h("span", { class: "field-box" }, h("span", { class: "field-start" }, icon("mail", 17)), email)),
    h("label", { class: "field" },
      h("span", { class: "field-label" }, "كلمة المرور"),
      h("span", { class: "field-box" }, h("span", { class: "field-start" }, icon("lock", 17)), password, eye)),
    errorBox,
    submit,
    h("p", { class: "fineprint" }, "ليس لديك حساب؟ تواصل مع مسؤول النظام في جهتك."));

  const view = h("div", { class: "login" },
    h("section", { class: "login-hero" },
      h("div", { class: "login-mark" }, mark(22, "mono")),
      h("h1", { class: "login-brand" }, "تنفيذ"),
      h("p", { class: "login-lead" }, "مساعدك في المشتريات الحكومية — من المشروع إلى الطرح في اعتماد."),
      h("ul", { class: "login-features" },
        FEATURES.map(function (f) {
          return h("li", null, h("span", { class: "feat-disc" }, icon(f.icon, 15)), h("span", null, f.text));
        }))),
    form);

  container.appendChild(view);
  setTimeout(function () {
    email.focus();
  }, 60);

  return {
    destroy() {
      busy = true;
    },
  };
}
