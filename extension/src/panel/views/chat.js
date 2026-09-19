// المساعد — محادثة بأسلوب ChatGPT: خيارات مقترحة حسب الصفحة المفتوحة، وبث
// الجواب، وسياق الصفحة (اعتماد/تنفيذ) يُرسل مع كل سؤال. المساعد يقترح ولا ينفذ (R-03).

import { firstName } from "../../shared/api.js";
import { chat } from "../chat-store.js";
import { clear, h, icon, mark } from "../dom.js";
import { renderMarkdown } from "../markdown.js";

const SITE_LABEL = { etimad: "منصة اعتماد", tanfeeth: "منصة تنفيذ", other: "" };

/** الخيارات المقترحة — نوعان: سؤال يُرسل، أو إجراء في الإضافة. */
function optionsFor(app) {
  const site = app.state.ctx.site;
  const ready = Boolean(app.validRecord());
  if (site === "etimad") {
    return [
      ready
        ? { icon: "fill", title: "عبئ هذه الصفحة", sub: "من بيانات المشروع الجاهز", run: fillHere }
        : { icon: "folder", title: "اختر مشروعا للتعبئة", sub: "ونملأ صفحات اعتماد عنك", run: function () { app.go("projects"); } },
      { icon: "help", title: "اشرح حقول هذه الخطوة", sub: "ماذا أكتب في كل حقل", prompt: "اشرح لي حقول هذه الصفحة في اعتماد، وما الذي أكتبه في كل حقل." },
      { icon: "listChecks", title: "راجع قبل الحفظ", sub: "ما الذي أتحقق منه", prompt: "ما الذي يجب أن أتحقق منه في هذه الخطوة قبل أن أضغط «حفظ ومتابعة» في اعتماد؟" },
      { icon: "scale", title: "الضوابط النظامية", sub: "ما يلزم في هذا النوع", prompt: "ما أهم ضوابط نظام المنافسات والمشتريات الحكومية التي تنطبق على هذه الخطوة؟" },
    ];
  }
  return [
    { icon: "fill", title: "اطرح مشروعا في اعتماد", sub: "اختر مشروعا وعبئ نموذجه", run: function () { app.go("projects"); } },
    { icon: "route", title: "مراحل المشروع", sub: "من الإنشاء إلى العقد", prompt: "ما مراحل المشروع في تنفيذ من الإنشاء إلى العقد؟ وماذا يحدث في كل مرحلة؟" },
    { icon: "filePlus", title: "إنشاء مشروع جديد", sub: "خطوة بخطوة", prompt: "كيف أنشئ مشروعا جديدا في تنفيذ خطوة بخطوة؟" },
    { icon: "key", title: "ماذا أستطيع أن أفعل؟", sub: "حسب صلاحياتي الحالية", prompt: "ما الذي أستطيع فعله في تنفيذ بصلاحياتي الحالية؟" },
  ];

  async function fillHere() {
    const res = await app.sendToEtimad({ type: "TNF_FILL_NOW" });
    if (!res) app.toast("حدّث صفحة اعتماد ثم أعد المحاولة.", "danger");
    else if (res.ok) app.toast("تمت تعبئة " + res.summary.filled + " حقلا — راجع ثم احفظ بنفسك.", "success");
    else if (res.reason === "BUSY") app.toast("التعبئة جارية بالفعل.");
    else app.toast("تعذرت التعبئة في هذه الصفحة.", "danger");
  }
}

/** سياق الصفحة المرسل مع السؤال (PageContextDto: path/title/section/summary). */
async function buildPage(app) {
  const ctx = app.state.ctx;
  const record = app.validRecord();
  const lines = ["المستخدم يسألك من إضافة تنفيذ في متصفح كروم (لوحة جانبية بجانب الصفحة المفتوحة)."];
  let path = "/extension";
  let title = "إضافة تنفيذ";
  let section;

  let url = null;
  try {
    url = ctx.url ? new URL(ctx.url) : null;
  } catch (_e) {
    url = null;
  }

  if (ctx.site === "etimad") {
    path = "/etimad" + (url ? url.pathname : "");
    title = "منصة اعتماد — " + (ctx.title || "");
    lines.push("الصفحة المفتوحة في منصة اعتماد الحكومية (tenders.etimad.sa)، وليست في تنفيذ. الإضافة تعبئ نموذج إنشاء المنافسة في اعتماد من بيانات مشروع في تنفيذ، ولا تضغط «حفظ ومتابعة» أبدا.");
    const pc = await app.sendToEtimad({ type: "TNF_PAGE_CONTEXT" });
    if (pc) {
      if (pc.headings && pc.headings.length) section = pc.headings.join(" · ");
      if (pc.labels && pc.labels.length) lines.push("الحقول الظاهرة في الصفحة: " + pc.labels.join("، "));
      if (pc.lastFill) lines.push("نتيجة آخر تعبئة لهذه الصفحة: تمت " + pc.lastFill.filled + "، تخطي " + pc.lastFill.skipped + "، تعذر " + pc.lastFill.failed + ".");
    }
  } else if (ctx.site === "tanfeeth" && url) {
    path = url.pathname + url.search;
    title = ctx.title || "تنفيذ";
    lines.push("الصفحة المفتوحة من بوابة تنفيذ.");
  } else {
    lines.push("الصفحة المفتوحة ليست من تنفيذ ولا من اعتماد.");
  }
  if (record && record.meta && record.meta.title) {
    lines.push("المشروع الجاهز للتعبئة في الإضافة: «" + record.meta.title + "».");
  }

  return {
    path: path.slice(0, 300),
    title: title.slice(0, 300),
    section: section ? section.slice(0, 300) : undefined,
    summary: lines.join("\n").slice(0, 3000),
  };
}

export function mountChat(container, app) {
  const scroller = h("div", { class: "chat-scroll" });
  const thread = h("div", { class: "chat-thread" });
  scroller.appendChild(thread);

  const input = h("textarea", {
    class: "composer-input",
    rows: 1,
    maxLength: 1000,
    attrs: { placeholder: "اسأل مساعد تنفيذ…", "aria-label": "اكتب سؤالك" },
  });
  const counter = h("span", { class: "composer-count", hidden: true });
  const sendBtn = h("button", { class: "composer-send", type: "button", attrs: { "aria-label": "إرسال" } }, icon("send", 18));
  const chips = h("div", { class: "chips" });
  const ctxChip = h("div", { class: "ctx-chip", hidden: true });

  const dock = h("div", { class: "dock" },
    chips,
    h("div", { class: "composer" },
      ctxChip,
      h("div", { class: "composer-row" }, input, sendBtn),
      counter),
    h("p", { class: "fineprint center" }, "المساعد يقترح ولا ينفذ أي إجراء — راجع قبل الاعتماد."));

  container.appendChild(scroller);
  container.appendChild(dock);

  let stick = true;
  scroller.addEventListener("scroll", function () {
    stick = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
  });

  function page() {
    return buildPage(app);
  }

  function ask(text) {
    const q = String(text || "").trim();
    if (!q) return;
    stick = true;
    chat.send(q, page);
  }

  function runOption(opt) {
    if (opt.prompt) ask(opt.prompt);
    else if (opt.run) opt.run();
  }

  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 168) + "px";
    const len = input.value.length;
    counter.hidden = len < 800;
    counter.textContent = len + " / 1000";
    updateSend();
  }

  function updateSend() {
    const streaming = chat.store.streaming;
    sendBtn.classList.toggle("is-stop", streaming);
    sendBtn.replaceChildren(icon(streaming ? "stop" : "send", streaming ? 15 : 18));
    sendBtn.setAttribute("aria-label", streaming ? "إيقاف" : "إرسال");
    sendBtn.disabled = !streaming && !input.value.trim();
  }

  function submit() {
    if (chat.store.streaming) return;
    const q = input.value;
    if (!q.trim()) return;
    input.value = "";
    autosize();
    ask(q);
  }

  input.addEventListener("input", autosize);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      submit();
    }
  });
  sendBtn.addEventListener("click", function () {
    if (chat.store.streaming) chat.stop();
    else submit();
  });

  // ───────────────────────────────────────────────────── الرسم ──

  function renderCtx() {
    const label = SITE_LABEL[app.state.ctx.site];
    ctxChip.hidden = !label;
    if (label) {
      ctxChip.replaceChildren(h("i", { class: "live-dot" }), h("span", null, "يرى السياق: " + label));
    }
  }

  function renderEmpty() {
    const user = app.state.session && app.state.session.user;
    const name = firstName(user);
    return h("div", { class: "welcome" },
      h("div", { class: "welcome-mark" }, mark(24, "brand")),
      h("h1", { class: "welcome-title" }, name ? "أهلا " + name : "أهلا بك"),
      h("p", { class: "welcome-sub" }, app.state.ctx.site === "etimad" ? "أنت على منصة اعتماد — كيف أساعدك في هذه الخطوة؟" : "كيف أقدر أساعدك اليوم؟"),
      h("div", { class: "options" },
        optionsFor(app).map(function (opt) {
          return h("button", { class: "option", type: "button", on: { click: function () { runOption(opt); } } },
            h("span", { class: "option-disc" }, icon(opt.icon, 17)),
            h("span", { class: "option-txt" }, h("b", null, opt.title), h("span", null, opt.sub)));
        })));
  }

  function renderMessage(m, isLast) {
    if (m.role === "user") {
      return h("div", { class: "msg msg-user" }, h("div", { class: "bubble" }, m.content));
    }
    const body = h("div", { class: "msg-body" });
    if (m.status === "streaming" && !m.content) {
      body.appendChild(h("div", { class: "typing", attrs: { "aria-label": "المساعد يكتب" } }, h("i"), h("i"), h("i")));
    } else if (m.content) {
      body.appendChild(renderMarkdown(m.content));
      if (m.status === "streaming") body.lastElementChild.classList.add("is-streaming");
    }
    if (m.status === "error") {
      body.appendChild(h("div", { class: "alert tone-danger" },
        icon("alert", 16),
        h("span", null, m.error || "تعذر الوصول إلى المساعد."),
        isLast && !m.stopped
          ? h("button", { class: "link-btn", type: "button", on: { click: function () { chat.retry(page); } } }, "أعد المحاولة")
          : null));
    }
    if (m.status === "done" && m.content) {
      const copyBtn = h("button", {
        class: "icon-btn xs",
        type: "button",
        title: "نسخ",
        attrs: { "aria-label": "نسخ الجواب" },
        on: {
          click: async function () {
            try {
              await navigator.clipboard.writeText(m.content);
              copyBtn.replaceChildren(icon("check", 15));
              setTimeout(function () { copyBtn.replaceChildren(icon("copy", 15)); }, 1400);
            } catch (_e) {
              app.toast("تعذر النسخ.", "danger");
            }
          },
        },
      }, icon("copy", 15));
      body.appendChild(h("div", { class: "msg-acts" }, copyBtn));
    }
    return h("div", { class: "msg msg-ai" }, h("span", { class: "msg-avatar" }, mark(9, "brand")), body);
  }

  function renderChips() {
    const has = chat.store.messages.length > 0;
    chips.hidden = !has || chat.store.streaming;
    if (chips.hidden) return;
    chips.replaceChildren.apply(chips, optionsFor(app).map(function (opt) {
      return h("button", { class: "chip", type: "button", on: { click: function () { runOption(opt); } } }, icon(opt.icon, 14), opt.title);
    }));
  }

  let raf = 0;
  function render() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () {
      clear(thread);
      const msgs = chat.store.messages;
      if (!msgs.length) {
        if (chat.store.loaded) thread.appendChild(renderEmpty());
      } else {
        msgs.forEach(function (m, i) {
          thread.appendChild(renderMessage(m, i === msgs.length - 1));
        });
      }
      renderChips();
      updateSend();
      if (stick) scroller.scrollTop = scroller.scrollHeight;
    });
  }

  const offChat = chat.subscribe(render);
  const offApp = app.subscribe(function (keys) {
    if (keys.indexOf("newChat") !== -1) {
      chat.reset();
      input.focus();
      return;
    }
    if (keys.indexOf("ctx") !== -1 || keys.indexOf("record") !== -1) {
      renderCtx();
      render();
    }
  });

  renderCtx();
  autosize();
  chat.load().then(render);

  if (app.state.pendingPrompt) {
    input.value = app.state.pendingPrompt;
    app.state.pendingPrompt = null;
    autosize();
  }
  setTimeout(function () {
    input.focus();
  }, 60);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      offChat();
      offApp();
    },
  };
}
