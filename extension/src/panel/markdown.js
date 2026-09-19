// عارض Markdown صغير لأجوبة المساعد — يبني DOM بالـ textContent فقط (لا innerHTML)،
// فأي نص من النموذج يبقى نصا. يدعم: العناوين، والفقرات، والقوائم النقطية
// والمرقمة، و**الغامق**، و`الشيفرة`، وكتل الشيفرة، والروابط http(s)، والفواصل.

import { h } from "./dom.js";

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;

function inline(text) {
  const out = [];
  let last = 0;
  let m;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(h("strong", null, tok.slice(2, -2)));
    else if (tok.startsWith("`")) out.push(h("code", null, tok.slice(1, -1)));
    else {
      const label = tok.slice(1, tok.indexOf("]("));
      out.push(h("a", { href: m[2], target: "_blank", rel: "noopener noreferrer" }, label));
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BULLET = /^\s*(?:[-*•])\s+(.*)$/;
const ORDERED = /^\s*(?:\d+|[٠-٩]+)[.)]\s+(.*)$/;
const HEADING = /^(#{1,4})\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;

export function renderMarkdown(src) {
  const root = h("div", { class: "md" });
  const lines = String(src || "").replace(/\r\n/g, "\n").split("\n");
  let para = [];
  let list = null; // { el, ordered }

  const flushPara = function () {
    if (para.length) {
      const p = h("p");
      para.forEach(function (line, i) {
        if (i) p.appendChild(h("br"));
        inline(line).forEach(function (n) { p.append(n); });
      });
      root.appendChild(p);
      para = [];
    }
  };
  const flushList = function () {
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      flushPara();
      flushList();
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++]);
      root.appendChild(h("pre", { attrs: { dir: "ltr" } }, h("code", null, code.join("\n"))));
      continue;
    }
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      flushPara();
      flushList();
      root.appendChild(h("hr"));
      continue;
    }
    const hm = line.match(HEADING);
    if (hm) {
      flushPara();
      flushList();
      root.appendChild(h(hm[1].length <= 2 ? "h3" : "h4", null, inline(hm[2])));
      continue;
    }
    const qm = line.match(QUOTE);
    if (qm) {
      flushPara();
      flushList();
      const prev = root.lastElementChild;
      if (prev && prev.tagName === "BLOCKQUOTE") {
        prev.appendChild(h("br"));
        inline(qm[1]).forEach(function (n) { prev.append(n); });
      } else {
        root.appendChild(h("blockquote", null, inline(qm[1])));
      }
      continue;
    }
    const bm = line.match(BULLET);
    const om = bm ? null : line.match(ORDERED);
    if (bm || om) {
      flushPara();
      const ordered = Boolean(om);
      if (!list || list.ordered !== ordered) {
        list = { el: h(ordered ? "ol" : "ul"), ordered };
        root.appendChild(list.el);
      }
      list.el.appendChild(h("li", null, inline((bm || om)[1])));
      continue;
    }
    if (list && /^\s{2,}\S/.test(line)) {
      const lastLi = list.el.lastElementChild;
      if (lastLi) {
        lastLi.appendChild(h("br"));
        inline(line.trim()).forEach(function (n) { lastLi.append(n); });
        continue;
      }
    }
    flushList();
    para.push(line);
  }
  flushPara();
  return root;
}
