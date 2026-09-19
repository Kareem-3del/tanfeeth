// تنفيذ — التقاط طلب التعبئة على نطاق تطبيق تنفيذ
// يستمع إلى postMessage من التطبيق («التعبئة في اعتماد»)، ويحفظ الحمولة،
// ثم يطلب من عامل الخلفية فتح اعتماد. يتطلب تسجيل الدخول في الإضافة:
// بدون دخول لا يُحفظ شيء، ويظهر تنبيه بزر «تسجيل الدخول» يفتح اللوحة.
//
// عقد الرسالة (يرسلها تطبيق تنفيذ):
//   window.postMessage({
//     source: "tanfeeth",
//     type: "TANFEETH_ETIMAD_FILL",
//     payload: { etimadFields: { <EtimadFieldName>: value, ... }, raw: {...} },
//     meta: { competitionId, title }
//   }, origin)

"use strict";

(function () {
  const UI = TNF_UI;

  // إعلان الوجود: التطبيق يفحص هذه السمة قبل «املأ في اعتماد».
  try {
    document.documentElement.setAttribute("data-tanfeeth-extension", "2");
  } catch (_e) {
    /* non-fatal */
  }

  // ─────────────────────────────────────────────────────────── التنبيه ──

  const TOAST_CSS = [
    ".toast{position:fixed;inset-block-end:20px;inset-inline-start:20px;z-index:2147483647;display:flex;align-items:flex-start;gap:12px;width:min(380px,calc(100vw - 32px));padding:14px 14px 14px 12px;background:var(--paper);border:1px solid var(--line);border-radius:16px;box-shadow:0 10px 30px -14px rgba(15,21,20,.22);animation:tnf-in 260ms cubic-bezier(.22,1,.36,1)}",
    "@keyframes tnf-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}",
    ".disc{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:999px;background:var(--mint);color:var(--green)}",
    ".disc.warn{background:var(--warning-soft);color:var(--warning)}",
    ".body{flex:1;min-width:0}",
    ".t{font-family:'TNF Display','TNF Body',system-ui,sans-serif;font-weight:700;font-size:13.5px;color:var(--ink)}",
    ".s{margin-top:2px;color:var(--muted);font-size:12.5px}",
    ".acts{display:flex;gap:8px;margin-top:10px}",
  ].join("\n");

  let toastHost = null;
  function toast(opts) {
    if (toastHost) toastHost.host.remove();
    toastHost = UI.createHost("toast", TOAST_CSS);
    const wrap = UI.el("div", "tnf");
    const box = UI.el("div", "toast");
    box.setAttribute("role", "status");
    const disc = UI.el("span", "disc" + (opts.tone === "warn" ? " warn" : ""));
    disc.appendChild(UI.icon(opts.icon || "check", 18));
    box.appendChild(disc);
    const body = UI.el("div", "body");
    body.appendChild(UI.el("div", "t", opts.title));
    if (opts.text) body.appendChild(UI.el("div", "s", opts.text));
    if (opts.action) {
      const acts = UI.el("div", "acts");
      const btn = UI.el("button", "btn btn-primary");
      btn.type = "button";
      btn.appendChild(UI.icon(opts.action.icon || "login", 15));
      btn.appendChild(UI.el("span", null, opts.action.label));
      btn.addEventListener("click", opts.action.run);
      acts.appendChild(btn);
      body.appendChild(acts);
    }
    box.appendChild(body);
    const close = UI.el("button", "icon-btn");
    close.type = "button";
    close.setAttribute("aria-label", "إغلاق");
    close.appendChild(UI.icon("x", 16));
    close.addEventListener("click", function () {
      if (toastHost) toastHost.host.remove();
      toastHost = null;
    });
    box.appendChild(close);
    wrap.appendChild(box);
    toastHost.root.appendChild(wrap);
    const mine = toastHost;
    if (opts.autoHideMs) {
      setTimeout(function () {
        if (toastHost === mine) {
          mine.host.remove();
          toastHost = null;
        }
      }, opts.autoHideMs);
    }
  }

  function ack(extra) {
    try {
      window.postMessage(
        Object.assign({ source: "tanfeeth-extension", type: "TANFEETH_ETIMAD_FILL_ACK" }, extra),
        window.location.origin
      );
    } catch (_e) {
      /* non-fatal */
    }
  }

  // ─────────────────────────────────────────────────────────── الالتقاط ──

  window.addEventListener("message", function (event) {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || typeof data !== "object" || data.source !== "tanfeeth" || data.type !== "TANFEETH_ETIMAD_FILL") return;
    if (!data.payload || typeof data.payload !== "object") {
      console.warn("[Tanfeeth] TANFEETH_ETIMAD_FILL received without a payload — ignored.");
      return;
    }
    capture(data).catch(function (err) {
      console.warn("[Tanfeeth] capture error:", err);
    });
  });

  async function capture(data) {
    const items = await UI.storageGet([UI.KEYS.settings]);
    const settings = Object.assign({}, UI.DEFAULT_SETTINGS, items[UI.KEYS.settings] || {});
    if (!settings.enabled) {
      ack({ ok: false, reason: "DISABLED" });
      toast({
        tone: "warn",
        icon: "alert",
        title: "إضافة تنفيذ متوقفة",
        text: "فعلها من إعدادات الإضافة ثم أعد المحاولة.",
        action: { label: "فتح الإعدادات", icon: "sparkles", run: function () { UI.openPanel("settings"); } },
      });
      return;
    }

    const auth = await UI.authState();
    if (!auth.signedIn) {
      ack({ ok: false, reason: "AUTH_REQUIRED" });
      toast({
        tone: "warn",
        icon: "login",
        title: "سجل الدخول إلى إضافة تنفيذ أولا",
        text: "التعبئة في اعتماد تعمل بعد تسجيل الدخول بحساب تنفيذ. سجل ثم اضغط «التعبئة في اعتماد» مرة أخرى.",
        action: {
          label: "تسجيل الدخول",
          icon: "login",
          run: async function () {
            const opened = await UI.openPanel("login");
            if (!opened) {
              toast({ tone: "warn", icon: "alert", title: "افتح الإضافة من شريط الأدوات", text: "اضغط أيقونة تنفيذ بجانب شريط العنوان." });
            }
          },
        },
      });
      return;
    }

    const record = {
      payload: data.payload,
      meta: Object.assign({}, data.meta || {}, { source: "web" }),
      savedAt: Date.now(),
    };
    await UI.storageSet({ [UI.KEYS.fill]: record, [UI.KEYS.log]: {} });
    ack({ ok: true, meta: record.meta, savedAt: record.savedAt });
    toast({
      title: "جهزنا بيانات المشروع للتعبئة",
      text: (record.meta.title ? "«" + record.meta.title + "» — " : "") + "يفتح اعتماد الآن في تبويب جديد.",
      autoHideMs: 6000,
    });
    await UI.send({ type: "TANFEETH_OPEN_ETIMAD" });
  }
})();
