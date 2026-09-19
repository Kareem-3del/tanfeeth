// تنفيذ — اللوحة الجانبية: الغلاف، والحالة المشتركة، والتنقل بين الشاشات.
// بدون جلسة لا يظهر إلا تسجيل الدخول. بعد الدخول: المساعد · المشاريع · التعبئة،
// والإعدادات من صورة الحساب.

import { ApiError, firstName, getSession, refreshProfile, setRefresher } from "../shared/api.js";
import { DEFAULT_SETTINGS, ETIMAD_ADD_TENDER_URL, ETIMAD_ORIGIN, KEYS, MAX_AGE_MS, SERVERS } from "../shared/config.js";
import { clear, firstLetter, h, icon, mark } from "./dom.js";
import { mountChat } from "./views/chat.js";
import { mountFill } from "./views/fill.js";
import { mountLogin } from "./views/login.js";
import { mountProjects } from "./views/projects.js";
import { mountSettings } from "./views/settings.js";

// التجديد يملكه عامل الخلفية وحده (انظر shared/api.js).
setRefresher(async function () {
  const res = await chrome.runtime.sendMessage({ type: "TNF_REFRESH" });
  if (res && res.ok) return getSession();
  if (res && res.network) throw new ApiError(0, "تعذر الوصول إلى خادم تنفيذ — تحقق من الاتصال.", "NETWORK");
  return null;
});

const TABS = [
  { id: "chat", label: "المساعد", icon: "sparkles" },
  { id: "projects", label: "المشاريع", icon: "folder" },
  { id: "fill", label: "التعبئة", icon: "fill" },
];

const state = {
  session: null,
  view: "chat",
  ctx: { tabId: null, url: "", title: "", site: "other" },
  settings: DEFAULT_SETTINGS,
  record: null, // الحمولة المخزنة كما هي (قد تكون منتهية)
  log: {},
  prefs: { theme: "system" },
  pendingPrompt: null,
};

const listeners = new Set();
function emit(keys) {
  listeners.forEach(function (fn) {
    try {
      fn(keys);
    } catch (err) {
      console.warn("[Tanfeeth] view update failed:", err);
    }
  });
}

const app = {
  state,
  subscribe(fn) {
    listeners.add(fn);
    return function () {
      listeners.delete(fn);
    };
  },
  go(view, opts) {
    if (opts && opts.prompt) state.pendingPrompt = opts.prompt;
    if (!state.session) return;
    state.view = TABS.some(function (t) { return t.id === view; }) || view === "settings" ? view : "chat";
    renderShell();
  },
  toast,
  server() {
    return state.session ? SERVERS[state.session.serverId] : null;
  },
  /** الحمولة الصالحة (أحدث من ساعتين) أو null. */
  validRecord() {
    const r = state.record;
    return r && r.savedAt && Date.now() - r.savedAt <= MAX_AGE_MS ? r : null;
  },
  async openEtimad() {
    if (state.ctx.site === "etimad" && state.ctx.tabId != null) {
      await chrome.tabs.update(state.ctx.tabId, { url: ETIMAD_ADD_TENDER_URL });
    } else {
      await chrome.tabs.create({ url: ETIMAD_ADD_TENDER_URL });
    }
  },
  async openUrl(url) {
    await chrome.tabs.create({ url });
  },
  /** رسالة إلى سكربت اعتماد في التبويب النشط. */
  async sendToEtimad(message) {
    if (state.ctx.site !== "etimad" || state.ctx.tabId == null) return null;
    try {
      return await chrome.tabs.sendMessage(state.ctx.tabId, message);
    } catch (_e) {
      return null; // الصفحة لم تحمل السكربت بعد (تبويب قديم قبل تثبيت الإضافة)
    }
  },
  async setPrefs(patch) {
    state.prefs = Object.assign({}, state.prefs, patch);
    await chrome.storage.local.set({ [KEYS.prefs]: state.prefs });
    applyTheme();
  },
  async setSettings(patch) {
    const next = Object.assign({}, state.settings, patch);
    await chrome.storage.local.set({ [KEYS.settings]: next });
  },
};

// ─────────────────────────────────────────────────────────────── المظهر ──

function applyTheme() {
  const theme = state.prefs.theme;
  const root = document.documentElement;
  if (theme === "light" || theme === "dark") root.setAttribute("data-theme", theme);
  else root.removeAttribute("data-theme");
  try {
    localStorage.setItem("tanfeeth-theme", theme || "system");
  } catch (_e) {
    /* ignore */
  }
}

// ──────────────────────────────────────────────────────── سياق التبويب ──

function siteOf(url) {
  if (!url) return "other";
  if (url.startsWith(ETIMAD_ORIGIN)) return "etimad";
  const web = Object.values(SERVERS).map(function (s) { return s.web; });
  if (web.some(function (w) { return url.startsWith(w); }) || /^https?:\/\/(www\.)?tanfeeth\.io/.test(url) || url.startsWith("http://localhost:3010")) {
    return "tanfeeth";
  }
  return "other";
}

async function readContext() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs && tabs[0];
    const url = (tab && tab.url) || "";
    const next = { tabId: tab ? tab.id : null, url, title: (tab && tab.title) || "", site: siteOf(url) };
    const changed = next.tabId !== state.ctx.tabId || next.url !== state.ctx.url || next.title !== state.ctx.title;
    state.ctx = next;
    if (changed) emit(["ctx"]);
  } catch (err) {
    console.warn("[Tanfeeth] tab context:", err);
  }
}

chrome.tabs.onActivated.addListener(readContext);
chrome.tabs.onUpdated.addListener(function (_id, info) {
  if (info.url || info.status === "complete" || info.title) readContext();
});
chrome.windows.onFocusChanged.addListener(readContext);

// ────────────────────────────────────────────────────────────── التنبيه ──

let snackTimer = null;
function toast(message, tone) {
  const host = document.getElementById("snack");
  if (!host) return;
  clear(host);
  host.appendChild(
    h("div", { class: "snack-in tone-" + (tone || "neutral"), attrs: { role: "status" } },
      icon(tone === "danger" ? "alert" : tone === "success" ? "circleCheck" : "sparkles", 16),
      h("span", null, message))
  );
  host.classList.add("is-on");
  clearTimeout(snackTimer);
  snackTimer = setTimeout(function () {
    host.classList.remove("is-on");
  }, 3600);
}

// ─────────────────────────────────────────────────────────────── الغلاف ──

let current = null; // { destroy() }

function renderShell() {
  const root = document.getElementById("app");
  if (current) current.destroy();
  current = null;
  clear(root);

  if (!state.session) {
    root.classList.add("is-login");
    const host = h("div", { class: "login-host" });
    root.appendChild(host);
    root.appendChild(h("div", { id: "snack", class: "snack" }));
    current = mountLogin(host, app);
    return;
  }
  root.classList.remove("is-login");

  const user = state.session.user || {};
  const server = SERVERS[state.session.serverId];
  const recordReady = Boolean(app.validRecord());

  const header = h("header", { class: "hd" },
    h("button", { class: "brand", type: "button", title: "المساعد", on: { click: function () { app.go("chat"); } } },
      h("span", { class: "brand-disc" }, mark(13, "mono")),
      h("span", { class: "brand-txt" },
        h("b", null, "تنفيذ"),
        h("span", null, state.session.serverId === "prod" ? "مساعد المشتريات" : "مساعد المشتريات · " + server.label))),
    h("div", { class: "hd-acts" },
      state.view === "chat"
        ? h("button", { class: "icon-btn", type: "button", title: "محادثة جديدة", attrs: { "aria-label": "محادثة جديدة" }, on: { click: function () { emit(["newChat"]); } } }, icon("newChat", 18))
        : null,
      h("button", {
        class: "avatar" + (state.view === "settings" ? " is-on" : ""),
        type: "button",
        title: (user.fullName || user.email || "") + " — الإعدادات",
        attrs: { "aria-label": "الحساب والإعدادات" },
        on: { click: function () { app.go(state.view === "settings" ? "chat" : "settings"); } },
      }, firstLetter(firstName(user)))));

  const nav = h("nav", { class: "seg", attrs: { role: "tablist" } },
    TABS.map(function (t) {
      const on = state.view === t.id;
      return h("button", {
        class: "seg-btn" + (on ? " is-on" : ""),
        type: "button",
        attrs: { role: "tab", "aria-selected": on ? "true" : "false" },
        on: { click: function () { app.go(t.id); } },
      }, icon(t.icon, 16), h("span", null, t.label), t.id === "fill" && recordReady ? h("i", { class: "seg-dot", attrs: { "aria-label": "مشروع جاهز" } }) : null);
    }));

  const main = h("main", { class: "view view-" + state.view });
  root.appendChild(header);
  if (state.view !== "settings") root.appendChild(nav);
  root.appendChild(main);
  root.appendChild(h("div", { id: "snack", class: "snack" }));

  const mounts = { chat: mountChat, projects: mountProjects, fill: mountFill, settings: mountSettings };
  current = mounts[state.view](main, app);
}

/** تحديث الترويسة دون إعادة تركيب الشاشة (الاسم بعد تحديث الملف، ونقطة «جاهز»). */
function updateChrome() {
  if (!state.session) return;
  const avatar = document.querySelector(".hd .avatar");
  if (avatar) avatar.textContent = firstLetter(firstName(state.session.user));
  const fillTab = document.querySelectorAll(".seg-btn")[2];
  if (!fillTab) return;
  const dot = fillTab.querySelector(".seg-dot");
  if (app.validRecord() && !dot) fillTab.appendChild(h("i", { class: "seg-dot", attrs: { "aria-label": "مشروع جاهز" } }));
  else if (!app.validRecord() && dot) dot.remove();
}

// ──────────────────────────────────────────────────────── التخزين ──

async function applyIntent(intent) {
  if (!intent || !intent.at || Date.now() - intent.at > 15000) return;
  await chrome.storage.local.remove(KEYS.intent);
  if (!state.session) return; // شاشة الدخول ظاهرة أصلا
  app.go(intent.view === "login" ? "chat" : intent.view, { prompt: intent.prompt });
}

chrome.storage.onChanged.addListener(function (changes, area) {
  if (area !== "local") return;
  const keys = [];
  if (changes[KEYS.session]) {
    const before = Boolean(state.session);
    state.session = changes[KEYS.session].newValue || null;
    if (before !== Boolean(state.session)) {
      if (!state.session) state.view = "chat";
      renderShell();
    } else {
      keys.push("session");
      updateChrome();
    }
  }
  if (changes[KEYS.settings]) {
    state.settings = Object.assign({}, DEFAULT_SETTINGS, changes[KEYS.settings].newValue || {});
    keys.push("settings");
  }
  if (changes[KEYS.fill]) {
    const hadReady = Boolean(app.validRecord());
    state.record = changes[KEYS.fill].newValue || null;
    keys.push("record");
    if (hadReady !== Boolean(app.validRecord())) updateChrome();
  }
  if (changes[KEYS.log]) {
    state.log = changes[KEYS.log].newValue || {};
    keys.push("log");
  }
  if (changes[KEYS.intent] && changes[KEYS.intent].newValue) applyIntent(changes[KEYS.intent].newValue);
  if (keys.length) emit(keys);
});

async function boot() {
  const items = await chrome.storage.local.get([KEYS.settings, KEYS.fill, KEYS.log, KEYS.prefs, KEYS.intent]);
  state.session = await getSession();
  state.settings = Object.assign({}, DEFAULT_SETTINGS, items[KEYS.settings] || {});
  state.record = items[KEYS.fill] || null;
  state.log = items[KEYS.log] || {};
  state.prefs = Object.assign({ theme: "system" }, items[KEYS.prefs] || {});
  applyTheme();
  await readContext();
  renderShell();
  await applyIntent(items[KEYS.intent]);

  // الاسم والصلاحيات قد تتغير من البوابة — تحديث صامت عند كل فتح.
  if (state.session) {
    refreshProfile().catch(function () {
      /* الجلسة المنتهية تُمسح من التجديد نفسه */
    });
  }
}

boot().catch(function (err) {
  console.error("[Tanfeeth] panel boot failed:", err);
});
