// حالة المحادثة — تعيش خارج الشاشة حتى يستمر البث عند التنقل بين التبويبات،
// وتُحفظ آخر الرسائل المكتملة في التخزين المحلي.

import { streamAssistant } from "../shared/api.js";
import { KEYS } from "../shared/config.js";

const MAX_STORED = 40;
const MAX_HISTORY = 12;

const store = {
  messages: [], // { id, role: "user"|"assistant", content, status: "done"|"streaming"|"error", error? }
  streaming: false,
  loaded: false,
};
let controller = null;
const listeners = new Set();

function emit() {
  listeners.forEach(function (fn) {
    fn(store);
  });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function persist() {
  const done = store.messages.filter(function (m) {
    return m.status === "done" && m.content;
  });
  await chrome.storage.local.set({ [KEYS.chat]: { messages: done.slice(-MAX_STORED) } });
}

export const chat = {
  store,
  subscribe(fn) {
    listeners.add(fn);
    return function () {
      listeners.delete(fn);
    };
  },

  async load() {
    if (store.loaded) return;
    const items = await chrome.storage.local.get([KEYS.chat]);
    const saved = items[KEYS.chat];
    if (saved && Array.isArray(saved.messages) && !store.messages.length) {
      store.messages = saved.messages.filter(function (m) {
        return m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string";
      });
    }
    store.loaded = true;
    emit();
  },

  /**
   * يرسل سؤالا ويبث الجواب. `pageProvider` يبني سياق الصفحة (async) لحظة الإرسال.
   */
  async send(text, pageProvider) {
    const question = String(text || "").trim().slice(0, 1000);
    if (!question || store.streaming) return;

    const history = store.messages
      .filter(function (m) { return m.status === "done" && m.content; })
      .slice(-MAX_HISTORY)
      .map(function (m) { return { role: m.role, content: m.content.slice(0, 4000) }; });

    store.messages.push({ id: uid(), role: "user", content: question, status: "done" });
    const reply = { id: uid(), role: "assistant", content: "", status: "streaming" };
    store.messages.push(reply);
    store.streaming = true;
    controller = new AbortController();
    emit();

    try {
      const page = await pageProvider();
      const answer = await streamAssistant(
        { question, history, page },
        {
          signal: controller.signal,
          onDelta: function (_d, full) {
            reply.content = full;
            emit();
          },
        }
      );
      reply.content = answer || reply.content;
      reply.status = reply.content ? "done" : "error";
      if (!reply.content) reply.error = "لم يصل جواب من المساعد — أعد المحاولة.";
    } catch (err) {
      if (err && err.name === "AbortError") {
        reply.status = reply.content ? "done" : "error";
        if (!reply.content) reply.error = "أوقفت الجواب.";
        reply.stopped = true;
      } else {
        reply.status = "error";
        reply.error = (err && err.message) || "تعذر الوصول إلى المساعد الآن.";
      }
    } finally {
      store.streaming = false;
      controller = null;
      emit();
      persist();
    }
  },

  stop() {
    if (controller) controller.abort();
  },

  /** يعيد إرسال آخر سؤال بعد خطأ. */
  retry(pageProvider) {
    if (store.streaming) return;
    const msgs = store.messages;
    const last = msgs[msgs.length - 1];
    if (!last || last.role !== "assistant" || last.status !== "error") return;
    msgs.pop();
    const question = msgs.pop();
    emit();
    if (question && question.role === "user") this.send(question.content, pageProvider);
  },

  async reset() {
    this.stop();
    store.messages = [];
    emit();
    await chrome.storage.local.remove(KEYS.chat);
  },
};
