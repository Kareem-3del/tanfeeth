// تنفيذ — عامل الخلفية
// • أيقونة الإضافة تفتح اللوحة الجانبية (المساعد).
// • المالك الوحيد لتجديد الرمز (single-flight) — انظر shared/api.js.
// • يجيب سكربتات المحتوى عن حال الدخول دون أن يسلمها أي رمز.
// • يفتح اللوحة من زر داخل الصفحة، ويفتح تبويب اعتماد بعد الالتقاط.
// • استفسارات الموردين: سكربت اعتماد يرسل الصفوف المقروءة، والخلفية وحدها تنادي
//   الخادم برمزها (TNF_INQ_MATCH / TNF_INQ_SYNC / TNF_INQ_INJECTED).

import { apiGet, apiPost, getSession, refreshDirect } from "./shared/api.js";
import { ETIMAD_ADD_TENDER_URL, ETIMAD_ORIGIN, KEYS } from "./shared/config.js";

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

// ─────────────────────────────────────────────── استفسارات الموردين ──
// المدخلات من صفحة اعتماد — نقبل الحقول المعروفة فقط وبأطوال معقولة، والخادم
// يتحقق من جديد. لا نقص نص السؤال إلا عند حد مبالغ فيه.

const REF_RE = /^\d{6,20}$/;
const NATIVE_RE = /^\d{1,20}$/;
const NO_COMPETITION = "COMPETITIONS.INQUIRY_SYNC_NO_COMPETITION";

function fromEtimad(sender) {
  return Boolean(sender && sender.tab && typeof sender.url === "string" && sender.url.startsWith(ETIMAD_ORIGIN + "/"));
}

function str(v, max) {
  return typeof v === "string" ? v.slice(0, max) : null;
}

function syncBody(input) {
  const ref = String((input && input.etimadReference) || "");
  if (!REF_RE.test(ref)) return null;
  const rows = Array.isArray(input.rows) ? input.rows.slice(0, 5000) : [];
  return {
    etimadReference: ref,
    etimadTenderId: str(input.etimadTenderId, 200),
    tenderName: str(input.tenderName, 1000),
    complete: input.complete === true,
    rows: rows.map(function (r, i) {
      const row = r || {};
      const replies = Array.isArray(row.replies) ? row.replies.slice(0, 100) : [];
      return {
        domIndex: Number.isInteger(row.domIndex) ? row.domIndex : i,
        nativeId: typeof row.nativeId === "string" && NATIVE_RE.test(row.nativeId) ? row.nativeId : null,
        question: str(row.question, 20000) || "",
        askedBy: str(row.askedBy, 500),
        askedAtText: str(row.askedAtText, 100),
        replies: replies.map(function (p) {
          const rep = p || {};
          return {
            text: str(rep.text, 20000) || "",
            responder: str(rep.responder, 500),
            approved: rep.approved === true,
            statusText: str(rep.statusText, 100),
            repliedAtText: str(rep.repliedAtText, 100),
          };
        }),
      };
    }),
  };
}

/** خطأ الـ API برسالة عربية تعرضها الصفحة كما هي. */
function inquiryError(err) {
  const status = (err && err.status) || 0;
  const code = (err && err.code) || null;
  if (code === NO_COMPETITION) {
    return { ok: false, status, code, message: "لا توجد منافسة في تنفيذ بهذا الرقم المرجعي — سجّل الرقم في «اعتماد الطرح» أولًا" };
  }
  if (code === "AUTH_REQUIRED" || status === 401) {
    return { ok: false, status: 401, code: "AUTH_REQUIRED", message: "سجل الدخول بحساب تنفيذ أولا." };
  }
  if (status === 404) {
    return { ok: false, status, code, message: "مزامنة الاستفسارات غير متاحة على هذا الخادم بعد." };
  }
  return { ok: false, status, code, message: (err && err.message) || "تعذر تنفيذ الطلب." };
}

function answer(promise, sendResponse) {
  promise.then(
    function (data) {
      sendResponse({ ok: true, data });
    },
    function (err) {
      sendResponse(inquiryError(err));
    }
  );
  return true;
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

    case "TNF_INQ_MATCH": {
      if (!fromEtimad(sender)) return false;
      const refs = (Array.isArray(message.references) ? message.references : [])
        .map(String)
        .filter(function (r, i, all) {
          return REF_RE.test(r) && all.indexOf(r) === i;
        })
        .slice(0, 100);
      if (!refs.length) {
        sendResponse({ ok: true, data: [] });
        return false;
      }
      return answer(apiGet("/competitions/etimad-inquiries/match?references=" + encodeURIComponent(refs.join(","))), sendResponse);
    }

    case "TNF_INQ_SYNC": {
      if (!fromEtimad(sender)) return false;
      const body = syncBody(message.body);
      if (!body) {
        sendResponse({ ok: false, code: "BAD_REFERENCE", message: "لم نجد الرقم المرجعي للمنافسة في هذه الصفحة." });
        return false;
      }
      return answer(apiPost("/competitions/etimad-inquiries/sync", body), sendResponse);
    }

    case "TNF_INQ_INJECTED": {
      if (!fromEtimad(sender)) return false;
      const ref = String(message.etimadReference || "");
      const fingerprints = (Array.isArray(message.fingerprints) ? message.fingerprints : [])
        .filter(function (f) {
          return typeof f === "string" && f.length > 0 && f.length <= 200;
        })
        .slice(0, 5000);
      if (!REF_RE.test(ref) || !fingerprints.length) {
        sendResponse({ ok: true, data: { updated: 0 } });
        return false;
      }
      return answer(apiPost("/competitions/etimad-inquiries/injected", { etimadReference: ref, fingerprints }), sendResponse);
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
