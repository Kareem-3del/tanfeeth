// تنفيذ — سحب العروض من اعتماد إلى «استلام العروض» في تنفيذ (FR-SP-019)
// على «تقرير الموردين» (/Offer/SuppliersReport) و«ملفات العرض» (/Offer/OpenOffers/…)
// وصفحة تفاصيل المنافسة:
// • شريط تنفيذ: «سحب العروض إلى تنفيذ» يفتح اللوحة على تبويب «العروض».
// • TNF_OFFERS_STATUS → حال الصفحة وآخر قراءة.
// • TNF_OFFERS_SCAN → يقرأ التقرير (JSON بصفحاته كلها) ثم صفحة كل عرض: ملفاته
//   ونوع كل مرفق و«منشأة صغيرة أو متوسطة». بجلسة المستخدم في اعتماد، من الصفحة نفسها.
// • منفذ "tnf-offer-file" من اللوحة: ينزّل ملفًا من اعتماد ويمرّر بايتاته قطعًا
//   (data URL) — اللوحة ترفعها إلى تنفيذ. لا يُكتب شيء على القرص، ولا يمسّ اعتماد.
// الرموز لا تقترب من هنا، ولا نضغط شيئًا في اعتماد.

"use strict";

(function () {
  const UI = TNF_UI;
  const P = TNF_OFFERS_PARSE;
  const PAGE = P.pageOf(location.href);
  if (!PAGE) return;

  const PORT_NAME = "tnf-offer-file";
  const CHUNK_BYTES = 4 * 1024 * 1024;
  const MAX_PAGES = 30;
  const DETAIL_CONCURRENCY = 3;
  const KEY_RE = /^[^/?#:]{1,500}$/;

  const view = {
    meta: P.pageMeta(document, location.href),
    scanning: false,
    scan: null, // آخر قراءة: { ok, at, reference, tenderName, offers[], withdrawn, partial, source, message }
  };

  class EtimadError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }

  const SESSION_MESSAGE = "انتهت جلستك في اعتماد أو لم تُفتح الصفحة بصلاحية لجنة الفتح — حدّث صفحة اعتماد وسجّل الدخول ثم أعد المحاولة.";

  /** طلبٌ من اعتماد نفسه بجلسة المستخدم — والرد «Logout» أو التحويل إلى الدخول جلسةٌ منتهية. */
  async function etimadGet(path, asJson) {
    let res;
    try {
      res = await fetch(path, {
        credentials: "same-origin",
        cache: "no-store",
        headers: asJson ? { Accept: "application/json, text/javascript, */*", "X-Requested-With": "XMLHttpRequest" } : { Accept: "text/html" },
      });
    } catch (_e) {
      throw new EtimadError("NETWORK", "تعذر الوصول إلى اعتماد — تحقق من الاتصال.");
    }
    const finalPath = (function () {
      try {
        return new URL(res.url).pathname;
      } catch (_e) {
        return "";
      }
    })();
    if (res.redirected && !/^\/(Offer|Tender)\//i.test(finalPath)) throw new EtimadError("SESSION", SESSION_MESSAGE);
    if (res.status === 401 || res.status === 403) throw new EtimadError("SESSION", SESSION_MESSAGE);
    if (!res.ok) throw new EtimadError("HTTP", "ردّ اعتماد بخطأ (" + res.status + ").");
    const text = await res.text();
    if (text.trim() === "Logout") throw new EtimadError("SESSION", SESSION_MESSAGE);
    if (!asJson) return text;
    try {
      return JSON.parse(text);
    } catch (_e) {
      throw new EtimadError("FORMAT", "ردّ «تقرير الموردين» ليس بالشكل المتوقع.");
    }
  }

  function parseHtml(html) {
    return new DOMParser().parseFromString(html, "text/html");
  }

  function withPage(resource, n) {
    if (/[?&]pageNumber=/i.test(resource)) return resource.replace(/([?&]pageNumber=)\d*/i, "$1" + n);
    return resource + (resource.indexOf("?") === -1 ? "?" : "&") + "pageNumber=" + n;
  }

  /** صفوف التقرير كلها من JSON — صفحةً صفحة حتى العدد الكلي. */
  async function reportFromJson(resource) {
    const byId = new Map();
    let total = null;
    let seenRows = 0;
    for (let n = 1; n <= MAX_PAGES; n++) {
      const json = await etimadGet(withPage(resource, n), true);
      const page = P.reportItems(json);
      if (!page) throw new EtimadError("FORMAT", "ردّ «تقرير الموردين» ليس بالشكل المتوقع.");
      if (page.total != null) total = page.total;
      seenRows += page.rows;
      page.items.forEach(function (it) {
        if (!byId.has(it.etimadOfferId)) byId.set(it.etimadOfferId, it);
      });
      if (page.rows === 0 || (total != null && seenRows >= total)) break;
      if (total == null && page.pageSize && page.rows < page.pageSize) break;
    }
    if (seenRows > 0 && byId.size === 0) throw new EtimadError("FORMAT", "لم نتعرّف على صفوف «تقرير الموردين».");
    return Array.from(byId.values());
  }

  async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    async function worker() {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }
    const workers = [];
    for (let k = 0; k < Math.min(limit, items.length); k++) workers.push(worker());
    await Promise.all(workers);
    return out;
  }

  /** قراءة عروض المنافسة: التقرير ثم صفحة كل عرض. */
  async function scan() {
    const meta = view.meta;
    if (!meta.tenderId) {
      throw new EtimadError("NO_TENDER", "لم نجد معرّف المنافسة في هذه الصفحة — افتح «تقرير الموردين» أو «ملفات العرض» لمنافسة فُتحت عروضها.");
    }

    // رابط JSON التقرير من سكربت هذه الصفحة، وإلا من صفحة التقرير نفسها.
    let resource = P.reportResource(P.scriptsText(document));
    if (!resource || !meta.reference) {
      const reportDoc = parseHtml(await etimadGet(P.reportUrl(meta.tenderId), false));
      resource = resource || P.reportResource(P.scriptsText(reportDoc));
      const reportMeta = P.pageMeta(reportDoc, location.origin + P.reportUrl(meta.tenderId));
      meta.reference = meta.reference || reportMeta.reference;
      meta.tenderName = meta.tenderName || reportMeta.tenderName;
    }

    const domRows = PAGE === "report" ? P.reportRows(document) : [];
    let rows = null;
    let source = "json";
    if (resource) {
      try {
        rows = await reportFromJson(resource);
      } catch (err) {
        if (err && err.code === "SESSION") throw err;
        console.warn("[Tanfeeth] offers report JSON:", err);
        rows = null;
      }
    }
    // الجدول المرسوم يصحّح الاسم والرقم لما يظهر منه (هو ما يقرؤه الموظف).
    const shown = new Map(domRows.map(function (r) { return [r.etimadOfferId, r]; }));
    let partial = false;
    if (rows) {
      rows = rows.map(function (r) {
        const d = shown.get(r.etimadOfferId);
        return d ? Object.assign({}, r, { contractorName: d.contractorName, contractorUnifiedNumber: d.contractorUnifiedNumber || r.contractorUnifiedNumber, withdrawn: r.withdrawn || d.withdrawn }) : r;
      });
    } else {
      source = "page";
      rows = domRows;
      partial = PAGE !== "report" || P.reportHasMorePages(document);
    }
    if (!rows.length) {
      throw new EtimadError(
        "EMPTY",
        PAGE === "report" ? "لا عروض في «تقرير الموردين» لهذه المنافسة بعد." : "تعذر قراءة «تقرير الموردين» من هنا — افتح التقرير نفسه من صفحة المنافسة ثم أعد المحاولة."
      );
    }

    const live = rows.filter(function (r) { return !r.withdrawn; });
    const offers = await mapLimit(live, DETAIL_CONCURRENCY, async function (row) {
      try {
        const doc = parseHtml(await etimadGet(P.offerUrl(row.etimadOfferId), false));
        const files = P.offerFiles(doc);
        return Object.assign({}, row, { isSme: P.smeFrom(doc), files: files, error: null });
      } catch (err) {
        if (err && err.code === "SESSION") throw err;
        return Object.assign({}, row, { isSme: null, files: [], error: (err && err.message) || "تعذر فتح صفحة العرض." });
      }
    });

    return {
      ok: true,
      at: Date.now(),
      reference: meta.reference,
      tenderName: meta.tenderName,
      tenderId: meta.tenderId,
      offers: offers,
      withdrawn: rows.length - live.length,
      partial: partial,
      source: source,
    };
  }

  async function runScan() {
    if (view.scanning) return view.scan;
    view.scanning = true;
    UI.requestBarRender();
    try {
      view.scan = await scan();
    } catch (err) {
      view.scan = { ok: false, at: Date.now(), code: (err && err.code) || "ERROR", message: (err && err.message) || "تعذر قراءة العروض من اعتماد." };
    } finally {
      view.scanning = false;
      UI.requestBarRender();
    }
    return view.scan;
  }

  function status() {
    return {
      started: true,
      page: PAGE,
      reference: view.meta.reference,
      tenderName: view.meta.tenderName,
      tenderId: view.meta.tenderId,
      offerId: view.meta.offerId,
      scanning: view.scanning,
      scan: view.scan,
    };
  }

  // ───────────────────────────────────────────── تمرير الملف إلى اللوحة ──

  function toDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(reader.error || new Error("read failed"));
      };
      reader.readAsDataURL(blob);
    });
  }

  /**
   * ينزّل الملف من اعتماد ويمرّره قطعًا وهو يصل — فالتنزيل والتمرير يجريان معًا.
   * الرد HTML يعني صفحة دخول أو خطأ لا ملفًّا: لا يُمرَّر منه شيء.
   */
  async function streamFile(port, key, name) {
    if (!KEY_RE.test(String(key || "")) || !name) throw new EtimadError("BAD_FILE", "رابط الملف في اعتماد غير مفهوم.");
    let res;
    try {
      res = await fetch(P.fileUrl(key, name), { credentials: "same-origin", cache: "no-store" });
    } catch (_e) {
      throw new EtimadError("NETWORK", "تعذر تنزيل الملف من اعتماد — تحقق من الاتصال.");
    }
    if (!res.ok) throw new EtimadError("HTTP", "رفض اعتماد تنزيل الملف (" + res.status + ").");
    const type = res.headers.get("content-type") || "";
    if (/text\/html/i.test(type)) throw new EtimadError("SESSION", "اعتماد لم يُرجع الملف — " + SESSION_MESSAGE);
    const total = Number(res.headers.get("content-length") || 0) || null;
    port.postMessage({ type: "meta", size: total, mime: type.split(";")[0] || "application/octet-stream" });

    let pending = [];
    let pendingBytes = 0;
    let received = 0;
    const flush = async function () {
      if (!pendingBytes) return;
      const data = await toDataUrl(new Blob(pending));
      pending = [];
      pendingBytes = 0;
      port.postMessage({ type: "chunk", data: data, received: received });
    };
    if (res.body && res.body.getReader) {
      const reader = res.body.getReader();
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        pending.push(part.value);
        pendingBytes += part.value.byteLength;
        received += part.value.byteLength;
        if (pendingBytes >= CHUNK_BYTES) await flush();
      }
    } else {
      const blob = await res.blob();
      for (let at = 0; at < blob.size; at += CHUNK_BYTES) {
        pending.push(blob.slice(at, at + CHUNK_BYTES));
        pendingBytes += Math.min(CHUNK_BYTES, blob.size - at);
        received += Math.min(CHUNK_BYTES, blob.size - at);
        await flush();
      }
    }
    await flush();
    if (!received) throw new EtimadError("EMPTY_FILE", "الملف في اعتماد فارغ.");
    port.postMessage({ type: "done", size: received });
  }

  chrome.runtime.onConnect.addListener(function (port) {
    if (port.name !== PORT_NAME) return;
    let open = true;
    port.onDisconnect.addListener(function () {
      open = false;
    });
    port.onMessage.addListener(function (msg) {
      if (!msg || msg.type !== "get") return;
      const safePost = port.postMessage.bind(port);
      const guarded = {
        postMessage: function (m) {
          if (open) safePost(m);
        },
      };
      streamFile(guarded, msg.key, msg.name).catch(function (err) {
        guarded.postMessage({ type: "error", code: (err && err.code) || "ERROR", message: (err && err.message) || "تعذر تنزيل الملف من اعتماد." });
      });
    });
  });

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (!message) return false;
    if (message.type === "TNF_OFFERS_STATUS") {
      sendResponse(status());
      return false;
    }
    if (message.type === "TNF_OFFERS_SCAN") {
      runScan().then(function () {
        sendResponse(status());
      });
      return true;
    }
    return false;
  });

  // ───────────────────────────────────────────────────── شريط تنفيذ ──
  // صفحة التفاصيل يتولّى شريطَها وضعُ الاستفسارات؛ والسحب منها من اللوحة.

  let panelHint = "";

  function barMode() {
    return {
      id: "offers-" + PAGE,
      signedOutTitle: "تنفيذ — استلام العروض من اعتماد",
      matches: function () {
        return PAGE === "report" || PAGE === "offer";
      },
      render: function (kit) {
        const title = view.meta.tenderName || "عروض المنافسة";
        const s = view.scan;
        let sub = panelHint || "اسحب عروض المتنافسين وملفاتهم إلى «استلام العروض» في تنفيذ مباشرة — بلا تنزيل ولا رفع يدوي.";
        let tone = panelHint ? "warn" : "";
        if (!panelHint && view.scanning) sub = "جار قراءة العروض من اعتماد…";
        else if (!panelHint && s && s.ok) sub = "قُرئت عروض المنافسة (" + s.offers.length + ") — تابع السحب من لوحة تنفيذ.";
        else if (!panelHint && s && !s.ok) {
          sub = s.message;
          tone = "warn";
        }
        const open = kit.button("btn btn-primary", "list", "سحب العروض إلى تنفيذ", async function () {
          panelHint = "";
          const ok = await UI.openPanel("offers");
          if (!ok) {
            panelHint = "اضغط أيقونة تنفيذ في شريط المتصفح ثم تبويب «العروض».";
            UI.requestBarRender();
          }
        });
        return { title: title, sub: sub, tone: tone, actions: [open] };
      },
    };
  }

  try {
    UI.registerBarMode(barMode());
  } catch (err) {
    console.warn("[Tanfeeth] offers bar:", err);
  }
})();
