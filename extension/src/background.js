// تنفيذ — عامل الخلفية
// • أيقونة الإضافة تفتح اللوحة الجانبية (المساعد).
// • المالك الوحيد لتجديد الرمز (single-flight) — انظر shared/api.js.
// • يجيب سكربتات المحتوى عن حال الدخول دون أن يسلمها أي رمز.
// • يفتح اللوحة من زر داخل الصفحة، ويفتح تبويب اعتماد بعد الالتقاط.

import { getSession, refreshDirect } from "./shared/api.js";
import { ETIMAD_ADD_TENDER_URL, KEYS } from "./shared/config.js";

function enablePanelOnActionClick() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(function (err) {
    console.warn("[Tanfeeth] sidePanel behavior:", err);
  });
}

chrome.runtime.onInstalled.addListener(enablePanelOnActionClick);
chrome.runtime.onStartup.addListener(enablePanelOnActionClick);

let inflight = null;
function refreshOnce() {
  if (!inflight) {
    inflight = refreshDirect().finally(function () {
      inflight = null;
    });
  }
  return inflight;
}

function authState(session) {
  if (!session) return { signedIn: false };
  const user = session.user || {};
  return { signedIn: true, name: user.fullName || user.email || "", email: user.email || "" };
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || typeof message.type !== "string") return false;

  switch (message.type) {
    case "TNF_AUTH_STATE":
      getSession().then(function (s) {
        sendResponse(authState(s));
      });
      return true;

    case "TNF_REFRESH":
      // مصدرها صفحات الإضافة فقط (اللوحة) — لا سكربتات المحتوى.
      if (sender.tab) return false;
      refreshOnce().then(
        function (s) {
          sendResponse({ ok: Boolean(s) });
        },
        function (err) {
          sendResponse({ ok: false, network: true, message: String((err && err.message) || err) });
        }
      );
      return true;

    case "TNF_OPEN_PANEL": {
      // sidePanel.open يحتاج لمسة المستخدم — يُستدعى قبل أي await.
      const tabId = sender.tab && sender.tab.id;
      const windowId = sender.tab && sender.tab.windowId;
      const intent = { view: message.view || "chat", prompt: message.prompt || null, at: Date.now() };
      let opening;
      try {
        opening = tabId != null ? chrome.sidePanel.open({ tabId }) : chrome.sidePanel.open({ windowId });
      } catch (err) {
        opening = Promise.reject(err);
      }
      chrome.storage.local.set({ [KEYS.intent]: intent });
      opening.then(
        function () {
          sendResponse({ ok: true });
        },
        function (err) {
          console.warn("[Tanfeeth] sidePanel.open:", err);
          sendResponse({ ok: false });
        }
      );
      return true;
    }

    case "TANFEETH_OPEN_ETIMAD":
      chrome.tabs.create({ url: ETIMAD_ADD_TENDER_URL }, function () {
        sendResponse({ ok: !chrome.runtime.lastError });
      });
      return true;

    default:
      return false;
  }
});
