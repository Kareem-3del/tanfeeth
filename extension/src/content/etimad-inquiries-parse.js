// تنفيذ — قارئ استفسارات الموردين في اعتماد (دوال نقية، بلا chrome ولا شبكة)
// • parseEtimadInquiries(doc, opts) → { reference, tenderName, tenderId, complete, rows, badges }
//   يقرأ صفحة تفاصيل المنافسة، أو جزء «GetEnquiryViewComponenet» بعد DOMParser.
// • parseEnquiryList(doc, opts) → [{ reference, tenderId, title, count, replyUrl }]
//   يقرأ «إستفسارات الموردين» (SupplierEnquiryList).
// المحددات مأخوذة من صفحات اعتماد محفوظة، لا من تخمين:
//   رأس كل استفسار div.card-header[role=tab] فيه a[data-toggle=collapse][aria-controls=<رقم اعتماد>]
//   واللوحة div#<الرقم> > blockquote: أول span.h5 = نص السؤال، small = اسم المورد،
//   والردود blockquote متداخلة (span.h5 = الرد، small = الجهة + شارة «معتمد» + «تاريخ الرد»).
// لا بصمات هنا — الخادم يحسبها (docs/product/COMMUNICATIONS-MODULE.md §1). التطبيع هنا
// نسخة حارسة فقط: نتأكد قبل الكتابة أن السؤال في الصفحة هو نفسه وقت المزامنة.
// يعمل في سكربت المحتوى (TNF_INQ_PARSE) وفي Node للاختبار (module.exports).

"use strict";

var TNF_INQ_PARSE = (function () {
  /** الأرقام العربية‑الهندية والفارسية إلى لاتينية — التواريخ والأرقام المرجعية تُقارن بها. */
  function toLatinDigits(s) {
    return String(s == null ? "" : s).replace(/[\u0660-\u0669\u06F0-\u06F9]/g, function (d) {
      const code = d.charCodeAt(0);
      return String(code - (code <= 0x0669 ? 0x0660 : 0x06f0));
    });
  }

  /** مسافات سطر واحد: كل بياض (ومنه nbsp) مسافة واحدة. */
  function oneLine(s) {
    return String(s == null ? "" : s).replace(/[\s\u00A0]+/g, " ").trim();
  }

  /**
   * نص متعدد الأسطر كما كتبه المورد: نحافظ على الأسطر ونقص أطرافها،
   * ولا نترك أكثر من سطر فارغ واحد متتاليا.
   */
  function multiLine(s) {
    return String(s == null ? "" : s)
      .replace(/\r\n?/g, "\n")
      .replace(/\u00A0/g, " ")
      .split("\n")
      .map(function (line) {
        return line.trim();
      })
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /** صيغة واحدة للنص نفسه — نسخة حارسة من normalizeInquiryText في الخادم. */
  function normalizeInquiryText(raw) {
    return toLatinDigits(String(raw == null ? "" : raw).normalize("NFKC"))
      .replace(/[\u064B-\u0670\u065F\u06D6-\u06ED]/g, "") // الحركات وعلامات المصحف
      .replace(/\u0640/g, "") // التطويل
      .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
      .replace(/\u0649/g, "\u064A")
      .replace(/\u0629/g, "\u0647")
      .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\u00A0]/g, " ")
      .replace(/[\s\u060C,.;:!?\u061F\u00AB\u00BB"'()[\]-]+/g, " ")
      .trim()
      .toLowerCase();
  }

  /** أول تاريخ dd/mm/yyyy في النص (بعد تحويل الأرقام)، وإلا النص نفسه مختصرا. */
  function dateText(raw) {
    const s = oneLine(toLatinDigits(raw));
    const m = s.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
    return m ? m[0] : s || null;
  }

  function firstInt(raw) {
    const m = toLatinDigits(raw).match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }

  /**
   * معرّف المنافسة في اعتماد (STenderId) — base64. اعتماد يطبع «+» أحيانا مسافة
   * (أو %20) في روابطه، والـ base64 لا يحوي مسافة، فنعيدها «+».
   */
  function normTenderId(raw) {
    if (raw == null) return null;
    let s = String(raw);
    try {
      s = decodeURIComponent(s);
    } catch (_e) {
      /* كما هو */
    }
    s = s.trim().replace(/ /g, "+");
    return s || null;
  }

  /** STenderId من رابط تفاصيل، أو آخر مقطع من رابط SupplierEnquiriesOnTender. */
  function tenderIdFromUrl(href, base) {
    if (!href) return null;
    let url;
    try {
      url = new URL(href, base || "https://tenders.etimad.sa/");
    } catch (_e) {
      return null;
    }
    // نقرأ القيمة الخام (لا URLSearchParams) لأنها تحول «+» إلى مسافة.
    const q = url.search.match(/[?&](?:STenderId|tenderIdStr|tenderIdString)=([^&#]*)/i);
    if (q) return normTenderId(q[1]);
    const p = url.pathname.match(/\/Enquiry\/SupplierEnquiriesOnTender\/([^/?#]+)/i);
    if (p) return normTenderId(p[1]);
    return null;
  }

  function ownText(node) {
    let out = "";
    node.childNodes.forEach(function (c) {
      if (c.nodeType === 3) out += c.nodeValue;
    });
    return out;
  }

  /** أبناء مباشرون بمحدد — بلا :scope حتى يعمل في أي محرك. */
  function children(node, test) {
    return Array.prototype.filter.call(node.children || [], test);
  }

  function isTag(tag, cls) {
    return function (n) {
      return n.tagName && n.tagName.toLowerCase() === tag && (!cls || n.classList.contains(cls));
    };
  }

  /** قيمة صف «عنوان ← معلومة» في صفحات اعتماد (.etd-item-title / .etd-item-info). */
  function itemInfo(root, title) {
    const want = oneLine(title);
    const titles = root.querySelectorAll(".etd-item-title");
    for (let i = 0; i < titles.length; i++) {
      if (oneLine(titles[i].textContent) !== want) continue;
      const row = titles[i].parentElement;
      const info = row && row.querySelector(".etd-item-info");
      if (!info) continue;
      const span = info.querySelector("span");
      return oneLine((span || info).textContent);
    }
    return null;
  }

  function referenceFrom(text) {
    const m = toLatinDigits(text || "").match(/\d{6,}/);
    return m ? m[0] : null;
  }

  // ───────────────────────────────────────────────────── كتل الاستفسارات ──

  /**
   * كل استفسار في الجذر بترتيب العرض: { nativeId, header, link, panel, quote, row, badges }.
   * header/link/panel عناصر DOM (لسكربت المحتوى)، row للإرسال.
   */
  function collectBlocks(root) {
    const out = [];
    const headers = root.querySelectorAll('div.card-header[role="tab"]');
    headers.forEach(function (header) {
      const link = header.querySelector('a[data-toggle="collapse"][aria-controls]');
      if (!link) return;
      const nativeId = String(link.getAttribute("aria-controls") || "").trim();
      if (!nativeId) return;

      // اللوحة عادة الأخ التالي للرأس؛ وإلا نبحث بالمعرّف داخل الجذر.
      let panel = header.nextElementSibling;
      if (!panel || panel.id !== nativeId) {
        panel = root.querySelector('[id="' + nativeId.replace(/"/g, "") + '"]');
      }
      const quote = panel ? children(panel, isTag("blockquote"))[0] || panel.querySelector("blockquote") : null;

      let question = "";
      let askedBy = null;
      const replies = [];
      if (quote) {
        const q = children(quote, isTag("span", "h5"))[0];
        question = multiLine(q ? q.textContent : "");
        const by = children(quote, isTag("small"))[0];
        askedBy = by ? oneLine(by.textContent) || null : null;
        quote.querySelectorAll("blockquote").forEach(function (rq) {
          const t = children(rq, isTag("span", "h5"))[0];
          const small = children(rq, isTag("small"))[0];
          let responder = null;
          let statusText = null;
          let repliedAtText = null;
          if (small) {
            responder = oneLine(ownText(small)) || null;
            small.querySelectorAll("span.badge").forEach(function (b) {
              if (b.classList.contains("badge-info")) repliedAtText = dateText(b.textContent);
              else if (statusText == null) statusText = oneLine(b.textContent) || null;
            });
          }
          replies.push({
            text: multiLine(t ? t.textContent : ""),
            responder: responder,
            approved: statusText === "معتمد",
            statusText: statusText,
            repliedAtText: repliedAtText,
          });
        });
      }
      if (!question) {
        // لوحة بلا اقتباس: نص الرأس (مختصر في اعتماد) أفضل من لا شيء.
        question = multiLine(ownText(link));
      }

      let badgeApproved = null;
      let badgePending = null;
      let askedAtText = null;
      link.querySelectorAll(".badge").forEach(function (b) {
        const t = oneLine(b.textContent);
        if (b.classList.contains("badge-info")) askedAtText = dateText(t);
        else if (t.indexOf("المعتمدة") !== -1) badgeApproved = firstInt(t);
        else if (t.indexOf("المعلقة") !== -1) badgePending = firstInt(t);
      });

      out.push({
        nativeId: nativeId,
        header: header,
        link: link,
        panel: panel,
        quote: quote,
        badges: { approved: badgeApproved, pending: badgePending },
        row: {
          domIndex: out.length,
          nativeId: /^\d+$/.test(nativeId) ? nativeId : null,
          question: question,
          askedBy: askedBy,
          askedAtText: askedAtText,
          replies: replies,
        },
      });
    });
    return out;
  }

  /** الرقم المرجعي واسم المنافسة ومعرّفها في اعتماد — من صفحة التفاصيل ورابطها. */
  function pageMeta(doc, url) {
    let tenderId = tenderIdFromUrl(url);
    if (!tenderId) {
      const a = doc.querySelector('a[href*="STenderId="], a[href*="tenderIdString="], a[href*="SupplierEnquiriesOnTender/"]');
      tenderId = a ? tenderIdFromUrl(a.getAttribute("href"), url) : null;
    }
    return {
      reference: referenceFrom(itemInfo(doc, "الرقم المرجعي")),
      tenderName: itemInfo(doc, "اسم المنافسة") || null,
      tenderId: tenderId,
    };
  }

  /**
   * صفحة تفاصيل المنافسة أو جزء الاستفسارات.
   * opts.url: رابط الصفحة (لـ STenderId). opts.container: جذر بديل للبحث عن الاستفسارات.
   * complete = وُجدت قائمة الاستفسارات مرسومة، ولكل رأس لوحته.
   */
  function parseEtimadInquiries(doc, opts) {
    const o = opts || {};
    const container = o.container || doc.querySelector("#inquiriesDiv") || doc.body || doc;
    const blocks = collectBlocks(container);

    const meta = pageMeta(doc, o.url);

    const rendered = oneLine(container.textContent).length > 0;
    const allPanels = blocks.every(function (b) {
      return Boolean(b.quote);
    });

    let approvedBadges = 0;
    let pendingBadges = 0;
    let approvedParsed = 0;
    let pendingParsed = 0;
    blocks.forEach(function (b) {
      approvedBadges += b.badges.approved || 0;
      pendingBadges += b.badges.pending || 0;
      b.row.replies.forEach(function (r) {
        if (r.approved) approvedParsed += 1;
        else pendingParsed += 1;
      });
    });

    return {
      reference: meta.reference,
      tenderName: meta.tenderName,
      tenderId: meta.tenderId,
      complete: rendered && allPanels,
      rows: blocks.map(function (b) {
        return b.row;
      }),
      badges: { approved: approvedBadges, pending: pendingBadges, approvedParsed: approvedParsed, pendingParsed: pendingParsed },
    };
  }

  // ─────────────────────────────────────────────── قائمة «إستفسارات الموردين» ──

  /** بطاقات القائمة: [{ card, item }] — card عنصر DOM لتزيينه، item للإرسال. */
  function listCards(doc, opts) {
    const base = (opts && opts.url) || "https://tenders.etimad.sa/";
    const out = [];
    doc.querySelectorAll(".monafasa-item").forEach(function (card) {
      const reference = referenceFrom(itemInfo(card, "الرقم المرجعي"));
      const titleLink = card.querySelector('.monafasa-content h5 a, a[href*="STenderId="]');
      const replyLink = card.querySelector('a[href*="SupplierEnquiriesOnTender/"]');
      let tenderId = titleLink ? tenderIdFromUrl(titleLink.getAttribute("href"), base) : null;
      if (!tenderId && replyLink) tenderId = tenderIdFromUrl(replyLink.getAttribute("href"), base);

      let count = null;
      card.querySelectorAll("p").forEach(function (p) {
        if (count != null) return;
        const t = oneLine(p.textContent);
        if (t === "عدد الإستفسارات" || t === "عدد الاستفسارات") {
          const next = p.nextElementSibling;
          count = next ? firstInt(next.textContent) : null;
        }
      });

      let replyUrl = null;
      if (replyLink) {
        try {
          replyUrl = new URL(replyLink.getAttribute("href"), base).href;
        } catch (_e) {
          replyUrl = null;
        }
      }
      out.push({
        card: card,
        item: {
          reference: reference,
          tenderId: tenderId,
          title: titleLink ? oneLine(titleLink.textContent) || null : null,
          count: count,
          replyUrl: replyUrl,
        },
      });
    });
    return out;
  }

  function parseEnquiryList(doc, opts) {
    return listCards(doc, opts).map(function (c) {
      return c.item;
    });
  }

  return {
    toLatinDigits: toLatinDigits,
    oneLine: oneLine,
    multiLine: multiLine,
    normalizeInquiryText: normalizeInquiryText,
    normTenderId: normTenderId,
    tenderIdFromUrl: tenderIdFromUrl,
    collectBlocks: collectBlocks,
    pageMeta: pageMeta,
    parseEtimadInquiries: parseEtimadInquiries,
    listCards: listCards,
    parseEnquiryList: parseEnquiryList,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = TNF_INQ_PARSE;
