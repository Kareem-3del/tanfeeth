// تنفيذ — قارئ عروض المتنافسين في اعتماد (دوال نقية، بلا chrome ولا شبكة)
// • pageMeta(doc, url) → { page, reference, tenderName, tenderId, offerId }
// • reportResource(text) → رابط JSON «تقرير الموردين» من سكربت الصفحة (أو null)
// • reportItems(json) → { items[], total, pageSize } — صفوف التقرير من JSON
// • reportRows(doc) → صفوف جدول التقرير المرسوم (الصفحة الظاهرة وحدها)
// • offerFiles(doc) → [{ key, name, typeLabel }] من جدول «الملفات» في صفحة العرض
// • fileUrl(key, name) → مسار التنزيل كما يبنيه اعتماد نفسه
// المحددات من صفحتين محفوظتين من اعتماد (تقرير الموردين + ملفات العرض، أكتوبر 2026):
//   التقرير: table#OfferTable، والخلايا بـ data-label («الاسم التجاري للشركة»،
//   «الرقم الوطني الموحد»، «تاريخ سحب العرض»)، ورابط «ملفات العرض» إلى
//   /Offer/OpenOffers/<معرّف العرض>/0. والصفوف يرسمها Vue من
//   resource_url = '/Offer/GetSuppliersReport…?tenderIdString=' + '<المعرّف>'
//   وتُرقَّم بـ pageNumber، والرد { data, totalCount, pageSize, currentPage }.
//   صفحة العرض: div#attachmentdiv table — العمود الأول اسم الملف (رابط)، والثاني
//   «نوع المرفق»؛ والتنزيل RedirectURL(fileNetReferenceId, fileName) →
//   /Upload/getfile/<id>:<name>. (حفظُ الصفحة يُسقط href="javascript:…" فبقي
//   الرابط فارغًا في النسخة المحفوظة؛ نقرأ المعاملين من href أو onclick أيًّا كان.)
// أسماء حقول JSON التقرير غير موثقة لدينا: تُقرأ بالقيم لا بالأسماء وحدها
// (معرّف base64، رقم موحد من عشرة أرقام يبدأ بـ7، اسم عربي) — انظر reportItems.
// يعمل في سكربت المحتوى (TNF_OFFERS_PARSE) وفي Node للاختبار (module.exports).

"use strict";

var TNF_OFFERS_PARSE = (function () {
  function toLatinDigits(s) {
    return String(s == null ? "" : s).replace(/[٠-٩۰-۹]/g, function (d) {
      const code = d.charCodeAt(0);
      return String(code - (code <= 0x0669 ? 0x0660 : 0x06f0));
    });
  }

  function oneLine(s) {
    return String(s == null ? "" : s).replace(/[\s ]+/g, " ").trim();
  }

  /** «لا يوجد» وما في معناه — خانةٌ فارغة في تقارير اعتماد. */
  function isNone(s) {
    const t = oneLine(s);
    return t === "" || t === "لا يوجد" || t === "-" || /^n\/?a$/i.test(t) || /^null$/i.test(t);
  }

  function pageOf(url) {
    let path = "";
    try {
      path = new URL(url).pathname;
    } catch (_e) {
      path = String(url || "");
    }
    if (/^\/Offer\/SuppliersReport\/?$/i.test(path)) return "report";
    if (/^\/Offer\/OpenOffers\//i.test(path)) return "offer";
    if (/^\/Tender\/(Details|DetailsForAll|DetailsForVisitor)\/?/i.test(path)) return "details";
    return null;
  }

  /** معرّف العرض من رابط /Offer/OpenOffers/<id>/<n> — كما كُتب (المسافة فيه حرفٌ من المعرّف). */
  function offerIdFromHref(href) {
    const m = /\/Offer\/OpenOffers\/([^/?#]+)/i.exec(String(href || ""));
    if (!m) return null;
    try {
      return decodeURIComponent(m[1]);
    } catch (_e) {
      return m[1];
    }
  }

  /** قيمة «عنوان: قيمة» في قوائم التفاصيل (etd-item-title / etd-item-info). */
  function fieldValue(doc, label) {
    const want = oneLine(label);
    const titles = doc.querySelectorAll(".etd-item-title");
    for (let i = 0; i < titles.length; i++) {
      if (oneLine(titles[i].textContent) !== want) continue;
      const row = titles[i].parentElement;
      const info = row && row.querySelector(".etd-item-info");
      if (info) return oneLine(info.textContent);
    }
    return null;
  }

  function scriptsText(doc) {
    const out = [];
    const scripts = doc.querySelectorAll("script:not([src])");
    for (let i = 0; i < scripts.length; i++) out.push(scripts[i].textContent || "");
    return out.join("\n");
  }

  /**
   * معرّف المنافسة المشفّر (tenderIdString) — من الرابط، وإلا من سكربت الصفحة:
   *   'tenderIdString=' + 'pcyW…==' في التقرير، و'tenderIdStr=' + 'pcyW…==' في صفحة العرض.
   */
  function tenderIdFrom(doc, url) {
    try {
      const u = new URL(url);
      const q = u.searchParams.get("tenderIdString") || u.searchParams.get("tenderIdStr") || u.searchParams.get("STenderId");
      if (q) return q;
    } catch (_e) {
      /* ليس رابطًا كاملًا */
    }
    const text = scriptsText(doc);
    const m = /tenderId(?:String|Str)\s*=\s*'\s*\+\s*'([^']+)'/i.exec(text) || /tenderId(?:String|Str)=([A-Za-z0-9+/= %]+?)['"&]/i.exec(text);
    return m ? m[1] : null;
  }

  function pageMeta(doc, url) {
    const page = pageOf(url);
    const ref = fieldValue(doc, "الرقم المرجعي");
    const reference = ref ? toLatinDigits(ref).replace(/\D/g, "") || null : null;
    return {
      page,
      reference,
      tenderName: fieldValue(doc, "اسم المنافسة"),
      tenderId: tenderIdFrom(doc, url),
      offerId: page === "offer" ? offerIdFromHref(url) : null,
    };
  }

  /** رابط JSON التقرير كما يكتبه سكربت الصفحة — يُقرأ ولا يُخمَّن (فيه «__» في اعتماد). */
  function reportResource(text) {
    const s = String(text || "");
    const m = /resource_url\s*:\s*'([^']*GetSuppliersReport[^']*)'\s*(?:\+\s*'([^']*)')?/i.exec(s);
    if (m) return m[1] + (m[2] || "");
    const n = /['"](\/Offer\/GetSuppliersReport[^'"]*)['"]/i.exec(s);
    return n ? n[1] : null;
  }

  // ─────────────────────────────────────────────── صفوف التقرير من JSON ──

  const BASE64_ID = /^[A-Za-z0-9+/ ]{12,}={0,2}$/;
  const UNIFIED = /^7\d{9}$/;
  const ARABIC = /[؀-ۿ]/;

  function digitsOf(v) {
    return toLatinDigits(v == null ? "" : String(v)).replace(/\D/g, "");
  }

  function firstKey(item, test) {
    const keys = Object.keys(item);
    for (let i = 0; i < keys.length; i++) if (test(keys[i], item[keys[i]])) return keys[i];
    return null;
  }

  /**
   * صفٌّ من JSON التقرير → متنافس. الأسماء غير موثقة، فالقراءة بالقيم:
   * - المعرّف: حقلٌ اسمه فيه offer وقيمته base64، وإلا أيُّ قيمةٍ base64 تنتهي بـ«=».
   * - الرقم الموحد: قيمةٌ من عشرة أرقام تبدأ بـ7 (الرقم الوطني الموحد للمنشأة).
   * - الاسم: حقلٌ اسمه فيه name/commercial/company وقيمته عربية، وإلا أوّلُ نصٍّ عربي.
   * - السحب: تاريخٌ في حقلٍ اسمه فيه withdraw، أو حالٌ فيها «سحب/منسحب».
   */
  function itemOf(item) {
    if (!item || typeof item !== "object") return null;
    const str = function (k) {
      return k && typeof item[k] === "string" ? item[k] : null;
    };
    const idKey =
      firstKey(item, function (k, v) {
        return /offer/i.test(k) && /id|str|enc/i.test(k) && typeof v === "string" && BASE64_ID.test(v) && !/^\d+$/.test(v);
      }) ||
      firstKey(item, function (_k, v) {
        return typeof v === "string" && /=$/.test(v) && BASE64_ID.test(v);
      });
    const unifiedKey =
      firstKey(item, function (k, v) {
        return /unified|national|700/i.test(k) && UNIFIED.test(digitsOf(v));
      }) ||
      firstKey(item, function (_k, v) {
        return (typeof v === "string" || typeof v === "number") && UNIFIED.test(digitsOf(v));
      });
    const nameKey =
      firstKey(item, function (k, v) {
        return /commercial|company|supplier.?name|vendor.?name|trade.?name/i.test(k) && typeof v === "string" && ARABIC.test(v);
      }) ||
      firstKey(item, function (k, v) {
        return /name/i.test(k) && typeof v === "string" && ARABIC.test(v) && !/status|state/i.test(k);
      }) ||
      firstKey(item, function (k, v) {
        return typeof v === "string" && ARABIC.test(v) && !/status|state|date/i.test(k) && oneLine(v).length > 3;
      });
    const statusKey = firstKey(item, function (k, v) {
      return /offer.?status/i.test(k) && typeof v === "string";
    });
    const withdrawKey = firstKey(item, function (k, v) {
      return /withdraw|retract/i.test(k) && /offer/i.test(k) && v != null && !isNone(v) && v !== false;
    });
    const status = oneLine(str(statusKey));
    const etimadOfferId = str(idKey);
    const contractorName = oneLine(str(nameKey));
    if (!etimadOfferId || !contractorName) return null;
    return {
      etimadOfferId: etimadOfferId,
      contractorName: contractorName,
      contractorUnifiedNumber: unifiedKey ? digitsOf(item[unifiedKey]) : null,
      statusText: status || null,
      withdrawn: Boolean(withdrawKey) || /منسحب|مسحوب|سحب العرض/.test(status),
    };
  }

  function reportItems(json) {
    const data = json && (Array.isArray(json) ? json : Array.isArray(json.data) ? json.data : Array.isArray(json.Data) ? json.Data : null);
    if (!data) return null;
    const items = [];
    data.forEach(function (row) {
      const it = itemOf(row);
      if (it) items.push(it);
    });
    const total = Number((json && (json.totalCount != null ? json.totalCount : json.TotalCount)) || 0) || null;
    const pageSize = Number((json && (json.pageSize != null ? json.pageSize : json.PageSize)) || 0) || null;
    return { items: items, rows: data.length, total: total, pageSize: pageSize };
  }

  // ───────────────────────────────────────── صفوف التقرير من الجدول المرسوم ──

  function cell(tr, label) {
    const cells = tr.querySelectorAll("td");
    for (let i = 0; i < cells.length; i++) {
      if (oneLine(cells[i].getAttribute("data-label")) === label) return oneLine(cells[i].textContent);
    }
    return null;
  }

  function reportRows(doc) {
    const table = doc.querySelector("table#OfferTable");
    if (!table) return [];
    const out = [];
    table.querySelectorAll("tbody tr").forEach(function (tr) {
      const link = tr.querySelector('a[href*="/Offer/OpenOffers/"]');
      const id = link ? offerIdFromHref(link.getAttribute("href")) : null;
      const name = cell(tr, "الاسم التجاري للشركة");
      if (!id || !name) return;
      const unified = digitsOf(cell(tr, "الرقم الوطني الموحد"));
      const withdrawnAt = cell(tr, "تاريخ سحب العرض");
      out.push({
        etimadOfferId: id,
        contractorName: name,
        contractorUnifiedNumber: unified.length === 10 ? unified : null,
        statusText: null,
        withdrawn: withdrawnAt != null && !isNone(withdrawnAt),
      });
    });
    return out;
  }

  /** هل في الجدول المرسوم صفحاتٌ أخرى؟ (أزرار ترقيم Vue) */
  function reportHasMorePages(doc) {
    const links = doc.querySelectorAll(".pagination .page-item .page-link");
    let pages = 0;
    links.forEach(function (a) {
      if (/^\d+$/.test(oneLine(a.textContent))) pages += 1;
    });
    return pages > 1;
  }

  // ──────────────────────────────────────────────────────── ملفات العرض ──

  /** معاملا RedirectURL('<id>', '<name>') من نص href أو onclick. */
  function redirectArgs(text) {
    const m = /RedirectURL\s*\(\s*(['"])(.*?)\1\s*,\s*(['"])(.*?)\3\s*\)/.exec(String(text || ""));
    return m ? { key: m[2], name: m[4] } : null;
  }

  /** ‎/Upload/getfile/<id>:<name> مباشرةً في href. */
  function getfileArgs(href) {
    const m = /\/Upload\/getfile\/([^:?#]+):([^?#]+)/i.exec(String(href || ""));
    if (!m) return null;
    let name = m[2];
    try {
      name = decodeURIComponent(name);
    } catch (_e) {
      /* كما هو */
    }
    return { key: m[1], name: name };
  }

  function attachmentsTable(doc) {
    const direct = doc.querySelector("#attachmentdiv table");
    if (direct) return direct;
    const tables = doc.querySelectorAll("table");
    for (let i = 0; i < tables.length; i++) {
      const head = oneLine((tables[i].querySelector("thead") || {}).textContent || "");
      if (/إسم الملف|اسم الملف/.test(head) && /نوع المرفق/.test(head)) return tables[i];
    }
    return null;
  }

  function offerFiles(doc) {
    const table = attachmentsTable(doc);
    if (!table) return [];
    const out = [];
    table.querySelectorAll("tbody tr").forEach(function (tr) {
      const tds = tr.querySelectorAll("td");
      if (!tds.length) return;
      const a = tds[0].querySelector("a") || tr.querySelector("a");
      const shown = oneLine((a || tds[0]).textContent);
      let args = null;
      if (a) {
        args = redirectArgs(a.getAttribute("href")) || redirectArgs(a.getAttribute("onclick")) || getfileArgs(a.getAttribute("href"));
      }
      if (!args) args = redirectArgs(tr.getAttribute("onclick")) || redirectArgs(tds[0].getAttribute("onclick"));
      if (!shown && !args) return;
      out.push({
        key: args ? args.key : null,
        name: args && args.name ? oneLine(args.name) : shown,
        typeLabel: tds[1] ? oneLine(tds[1].textContent) || null : null,
      });
    });
    return out;
  }

  /** «منشأة صغيرة أو متوسطة: نعم/لا» في «متطلبات المحتوى المحلي» — null إن لم تُقرأ. */
  function smeFrom(doc) {
    const v = fieldValue(doc, "منشأة صغيرة أو متوسطة");
    if (v === "نعم") return true;
    if (v === "لا") return false;
    return null;
  }

  /** مسار التنزيل كما يبنيه اعتماد في RedirectURL. */
  function fileUrl(key, name) {
    return "/Upload/getfile/" + key + ":" + name;
  }

  function offerUrl(offerId) {
    return "/Offer/OpenOffers/" + offerId + "/0";
  }

  function reportUrl(tenderId) {
    return "/Offer/SuppliersReport?tenderIdString=" + encodeURIComponent(tenderId);
  }

  return {
    toLatinDigits: toLatinDigits,
    oneLine: oneLine,
    pageOf: pageOf,
    pageMeta: pageMeta,
    tenderIdFrom: tenderIdFrom,
    offerIdFromHref: offerIdFromHref,
    reportResource: reportResource,
    scriptsText: scriptsText,
    reportItems: reportItems,
    reportRows: reportRows,
    reportHasMorePages: reportHasMorePages,
    redirectArgs: redirectArgs,
    offerFiles: offerFiles,
    smeFrom: smeFrom,
    fileUrl: fileUrl,
    offerUrl: offerUrl,
    reportUrl: reportUrl,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = TNF_OFFERS_PARSE;
