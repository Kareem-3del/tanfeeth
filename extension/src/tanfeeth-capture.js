// تنفيذ — التعبئة في اعتماد | Tanfeeth-origin content script
// Listens for the app's postMessage handoff, persists the payload to
// chrome.storage.local, then asks the background worker to open Etimad.
//
// Message contract (dispatched by the Tanfeeth web app):
//   window.postMessage({
//     source: "tanfeeth",
//     type: "TANFEETH_ETIMAD_FILL",
//     payload: { etimadFields: { <EtimadFieldName>: value, ... } },
//     meta: { competitionId, title }
//   }, "*")

"use strict";

(function () {
  const STORAGE_KEY = "tanfeethEtimadFill";
  const LOG_KEY = "tanfeethFillLog";
  const SETTINGS_KEY = "tanfeethSettings";

  // إعلان الوجود: التطبيق يفحص هذه السمة قبل «املأ في اعتماد» ليعرض إرشادات
  // التثبيت عند غيابها. تُضبط عند document_idle فور تحميل الصفحة.
  try {
    document.documentElement.setAttribute("data-tanfeeth-extension", "1");
  } catch (_markErr) {
    /* non-fatal */
  }

  window.addEventListener("message", function (event) {
    try {
      // Only accept messages from this page itself.
      if (event.source !== window) return;

      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.source !== "tanfeeth") return;
      if (data.type !== "TANFEETH_ETIMAD_FILL") return;

      if (!data.payload || typeof data.payload !== "object") {
        console.warn("[Tanfeeth] TANFEETH_ETIMAD_FILL received without a payload — ignored.");
        return;
      }

      const record = {
        payload: data.payload,
        meta: data.meta || {},
        savedAt: Date.now(),
      };

      const toStore = {};
      toStore[STORAGE_KEY] = record;
      toStore[LOG_KEY] = {}; // new capture → reset the per-page fill log

      // «إيقاف الإضافة» من واجهتها = لا التقاط ولا فتح اعتماد.
      chrome.storage.local.get([SETTINGS_KEY], function (items) {
        const settings = (items && items[SETTINGS_KEY]) || {};
        if (settings.enabled === false) {
          console.warn("[Tanfeeth] الإضافة موقوفة من إعداداتها — تم تجاهل طلب التعبئة.");
          return;
        }
        capture();
      });

      function capture() {
        chrome.storage.local.set(toStore, function () {
          if (chrome.runtime.lastError) {
            console.warn("[Tanfeeth] storage.set failed:", chrome.runtime.lastError.message);
            return;
          }

          // Let the app know the extension picked the payload up.
          try {
            window.postMessage(
              {
                source: "tanfeeth-extension",
                type: "TANFEETH_ETIMAD_FILL_ACK",
                meta: record.meta,
                savedAt: record.savedAt,
              },
              window.location.origin
            );
          } catch (_ackErr) {
            /* non-fatal */
          }

          chrome.runtime.sendMessage({ type: "TANFEETH_OPEN_ETIMAD" }, function () {
            // Swallow "receiving end does not exist" style errors.
            void chrome.runtime.lastError;
          });
        });
      }
    } catch (err) {
      console.warn("[Tanfeeth] capture error:", err);
    }
  });
})();
