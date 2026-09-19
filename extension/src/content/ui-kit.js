// تنفيذ — أدوات واجهة سكربتات المحتوى (على اعتماد وتنفيذ)
// • خطوط الهوية (Alexandria + IBM Plex Sans Arabic) مضمنة في الإضافة — لا طلب خارجي.
// • كل عنصر نرسمه داخل Shadow DOM حتى لا تتسرب أنماط الصفحة إليه ولا أنماطه إليها.
// • أيقونات Lucide كمسارات SVG — لا رموز تعبيرية.
// المفاتيح هنا نسخة من src/shared/config.js (سكربتات المحتوى لا تستورد وحدات).

"use strict";

var TNF_UI = (function () {
  const KEYS = {
    session: "tanfeethSession",
    fill: "tanfeethEtimadFill",
    log: "tanfeethFillLog",
    settings: "tanfeethSettings",
    prefs: "tanfeethPrefs",
  };
  const DEFAULT_SETTINGS = { enabled: true, autoFill: true, showOverlay: true, fillCriteria: true };
  const MAX_AGE_MS = 2 * 60 * 60 * 1000;

  const ICONS = {
    fill: ["M5 4h1a3 3 0 0 1 3 3 3 3 0 0 1 3-3h1", "M13 20h-1a3 3 0 0 1-3-3 3 3 0 0 1-3 3H5", "M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1", "M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7", "M9 7v10"],
    sparkles: ["M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z", "M20 3v4", "M22 5h-4", "M4 17v2", "M5 18H3"],
    x: ["M18 6 6 18", "m6 6 12 12"],
    minus: ["M5 12h14"],
    check: ["M20 6 9 17l-5-5"],
    loader: ["M21 12a9 9 0 1 1-6.219-8.56"],
    login: ["M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4", "m10 17 5-5-5-5", "M15 12H3"],
    folder: ["M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z", "M8 10v4", "M12 10v2", "M16 10v6"],
    refresh: ["M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", "M21 3v5h-5", "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", "M8 16H3v5"],
    alert: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 8v4", "M12 16h.01"],
    list: ["m3 17 2 2 4-4", "m3 7 2 2 4-4", "M13 6h8", "M13 12h8", "M13 18h8"],
  };

  function icon(name, size) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", String(size || 16));
    svg.setAttribute("height", String(size || 16));
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("i", "i-" + name);
    (ICONS[name] || []).forEach(function (d) {
      const p = document.createElementNS(ns, "path");
      p.setAttribute("d", d);
      svg.appendChild(p);
    });
    return svg;
  }

  /** علامة تنفيذ — ثلاث أسهم ونقطة (نفس هندسة frontend-v3 LogoMark). */
  function mark(size, tone) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 58 40");
    svg.setAttribute("width", String(Math.round(size * 1.45)));
    svg.setAttribute("height", String(size));
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    const tones = {
      brand: ["#6CB56E", "#337349", "#00665E", "#6CB56E"],
      mono: ["rgba(255,255,255,0.45)", "rgba(255,255,255,0.72)", "#FFFFFF", "#9ED9A6"],
    };
    const t = tones[tone] || tones.brand;
    [0, 16, 32].forEach(function (x, i) {
      const p = document.createElementNS(ns, "polyline");
      p.setAttribute("points", x + 5.5 + ",7 " + (x + 18.5) + ",20 " + (x + 5.5) + ",33");
      p.setAttribute("stroke", t[i]);
      p.setAttribute("stroke-width", "9");
      p.setAttribute("stroke-linecap", "round");
      p.setAttribute("stroke-linejoin", "round");
      svg.appendChild(p);
    });
    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("cx", "53.4");
    dot.setAttribute("cy", "5.6");
    dot.setAttribute("r", "3.6");
    dot.setAttribute("fill", t[3]);
    svg.appendChild(dot);
    return svg;
  }

  let fontsInjected = false;
  /** @font-face لا يعمل داخل Shadow DOM — يُعلن مرة في المستند بأسماء خاصة بنا. */
  function injectFonts() {
    if (fontsInjected) return;
    fontsInjected = true;
    const url = function (f) {
      return chrome.runtime.getURL("fonts/" + f);
    };
    const AR = "U+0600-06FF, U+0750-077F, U+0870-08FF, U+200C-200E, U+2010-2011, U+FB50-FDFF, U+FE70-FEFC";
    const LAT = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2212";
    const faces = [];
    [["alexandria-arabic.woff2", AR], ["alexandria-latin.woff2", LAT]].forEach(function (f) {
      faces.push("@font-face{font-family:'TNF Display';font-style:normal;font-weight:100 900;font-display:swap;src:url(" + url(f[0]) + ") format('woff2');unicode-range:" + f[1] + "}");
    });
    [400, 500, 600, 700].forEach(function (w) {
      faces.push("@font-face{font-family:'TNF Body';font-style:normal;font-weight:" + w + ";font-display:swap;src:url(" + url("plex-arabic-" + w + "-arabic.woff2") + ") format('woff2');unicode-range:" + AR + "}");
      faces.push("@font-face{font-family:'TNF Body';font-style:normal;font-weight:" + w + ";font-display:swap;src:url(" + url("plex-arabic-" + w + "-latin.woff2") + ") format('woff2');unicode-range:" + LAT + "}");
    });
    const style = document.createElement("style");
    style.setAttribute("data-tanfeeth", "fonts");
    style.textContent = faces.join("\n");
    (document.head || document.documentElement).appendChild(style);
  }

  /** أنماط أساسية مشتركة داخل كل Shadow root — نفس رموز frontend-v3. */
  const BASE_CSS = [
    ":host{all:initial}",
    "*{box-sizing:border-box}",
    ".tnf{--green:#00665E;--green-deep:#004F49;--leaf:#6CB56E;--mint:#E6F0EB;--ink:#111A1B;--ink-soft:#2B3A3B;--muted:#5E6B6A;--faint:#8F9A99;--paper:#FFFFFF;--mist:#F4F5F4;--line:#E1E5E3;--danger:#C0533A;--danger-soft:#F8E3DC;--warning:#B7791F;--warning-soft:#FBEFD5;--success:#2E7D56;--success-soft:#E1F0E7;",
    "font-family:'TNF Body',system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;color:var(--ink);font-size:13px;line-height:1.55;direction:rtl;-webkit-font-smoothing:antialiased}",
    ".i{display:block;flex:none}",
    "@keyframes tnf-spin{to{transform:rotate(360deg)}}",
    ".spin{animation:tnf-spin .9s linear infinite}",
    "button{font:inherit;color:inherit;cursor:pointer;border:0;background:none;margin:0}",
    "button:focus-visible{outline:2px solid var(--green);outline-offset:2px}",
    ".btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:34px;padding:0 14px;border-radius:999px;font-weight:600;font-size:12.5px;white-space:nowrap;transition:background-color 160ms cubic-bezier(.22,1,.36,1),border-color 160ms}",
    ".btn-primary{background:var(--green);color:#fff}",
    ".btn-primary:hover{background:var(--green-deep)}",
    ".btn-primary[disabled]{opacity:.7;cursor:progress}",
    ".btn-ghost{background:transparent;color:var(--ink-soft);border:1px solid var(--line)}",
    ".btn-ghost:hover{background:var(--mist)}",
    ".icon-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:999px;color:var(--muted)}",
    ".icon-btn:hover{background:var(--mist);color:var(--ink)}",
  ].join("\n");

  /** مضيف مغلق بجذر ظل — يرجع { host, root }. */
  function createHost(name, css) {
    injectFonts();
    const host = document.createElement("tanfeeth-" + name);
    host.setAttribute("data-tanfeeth", name);
    const root = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = BASE_CSS + "\n" + (css || "");
    root.appendChild(style);
    (document.body || document.documentElement).appendChild(host);
    return { host, root };
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
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

  function send(message) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(message, function (res) {
          void chrome.runtime.lastError;
          resolve(res || null);
        });
      } catch (_e) {
        resolve(null);
      }
    });
  }

  /** حال الدخول من عامل الخلفية — بلا رموز. */
  async function authState() {
    const res = await send({ type: "TNF_AUTH_STATE" });
    return res && res.signedIn ? res : { signedIn: false };
  }

  /** يفتح اللوحة الجانبية على شاشة معينة. يرجع false إن رفض المتصفح (بلا لمسة مستخدم). */
  async function openPanel(view, prompt) {
    const res = await send({ type: "TNF_OPEN_PANEL", view: view || "chat", prompt: prompt || null });
    return Boolean(res && res.ok);
  }

  return {
    KEYS,
    DEFAULT_SETTINGS,
    MAX_AGE_MS,
    icon,
    mark,
    createHost,
    el,
    storageGet,
    storageSet,
    send,
    authState,
    openPanel,
  };
})();
