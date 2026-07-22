// تنفيذ — التعبئة في اعتماد | page-context bridge
// Injected into the Etimad page's main world (via web_accessible_resources)
// so that jQuery/select2 widgets — which live in the page context, out of
// reach of the isolated content-script world — get notified after the
// content script sets a native <select> value.
//
// Protocol: the content script tags the element with data-tanfeeth-id="N"
// and dispatches on document:
//   new CustomEvent("tanfeeth:jquery-sync", { detail: JSON.stringify({ id, values }) })
// This script resolves the element and calls jQuery(el).val(values).trigger("change").

"use strict";

(function () {
  if (window.__tanfeethBridgeInstalled) return;
  window.__tanfeethBridgeInstalled = true;

  document.addEventListener("tanfeeth:jquery-sync", function (event) {
    try {
      if (!event || typeof event.detail !== "string") return;
      const msg = JSON.parse(event.detail);
      if (!msg || msg.id == null) return;

      const el = document.querySelector('[data-tanfeeth-id="' + String(msg.id) + '"]');
      if (!el) return;

      const jq = window.jQuery || window.$;
      if (typeof jq !== "function") return;

      jq(el).val(msg.values).trigger("change");
    } catch (err) {
      // Never let the bridge break the host page.
      if (window.console && console.warn) console.warn("[Tanfeeth] bridge error:", err);
    }
  });
})();
