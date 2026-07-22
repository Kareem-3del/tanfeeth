// تنفيذ — التعبئة في اعتماد | background service worker
// Sole job: when the Tanfeeth-origin content script reports a captured
// payload, open the Etimad "AddTender" wizard in a new tab.

"use strict";

const ETIMAD_ADD_TENDER_URL = "https://tenders.etimad.sa/Tender/AddTender";

chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
  try {
    if (message && message.type === "TANFEETH_OPEN_ETIMAD") {
      chrome.tabs.create({ url: ETIMAD_ADD_TENDER_URL }, function () {
        if (chrome.runtime.lastError) {
          console.warn("[Tanfeeth] tabs.create failed:", chrome.runtime.lastError.message);
        }
        sendResponse({ ok: !chrome.runtime.lastError });
      });
      return true; // keep the message channel open for the async sendResponse
    }
  } catch (err) {
    console.warn("[Tanfeeth] background error:", err);
  }
  return false;
});
