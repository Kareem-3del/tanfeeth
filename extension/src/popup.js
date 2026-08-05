// تنفيذ — واجهة الإضافة (popup)
// تعرض الحالة، والحمولة المحفوظة (الحقول + شجرة المعايير)، وسجل آخر تعبئة،
// وتتيح التشغيل/الإيقاف والإعدادات. لا تلمس أي صفحة — قراءة/كتابة تخزين فقط.

"use strict";

(function () {
  const STORAGE_KEY = "tanfeethEtimadFill";
  const LOG_KEY = "tanfeethFillLog";
  const SETTINGS_KEY = "tanfeethSettings";
  const MAX_AGE_MS = 2 * 60 * 60 * 1000;

  const DEFAULTS = { enabled: true, autoFill: true, showOverlay: true, fillCriteria: true };

  const $ = function (id) {
    return document.getElementById(id);
  };

  function get(keys) {
    return new Promise(function (r) {
      chrome.storage.local.get(keys, function (i) {
        r(i || {});
      });
    });
  }
  function set(items) {
    return new Promise(function (r) {
      chrome.storage.local.set(items, function () {
        r();
      });
    });
  }

  function esc(v) {
    return String(v == null ? "" : v);
  }

  /** «قبل ٣ دقائق» — الحمولة تنتهي بعد ساعتين، فالعمر معلومة مهمة. */
  function ago(ms) {
    const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (s < 60) return "قبل ثوانٍ";
    const m = Math.floor(s / 60);
    if (m < 60) return "قبل " + m + " دقيقة";
    const h = Math.floor(m / 60);
    return "قبل " + h + " ساعة و" + (m % 60) + " دقيقة";
  }

  function shortValue(v) {
    if (v == null) return "—";
    if (Array.isArray(v)) return v.join("، ") || "—";
    if (typeof v === "object") return JSON.stringify(v);
    const s = String(v);
    return s.length > 90 ? s.slice(0, 90) + "…" : s || "—";
  }

  const FINANCIAL = ["السعر", "سعر", "التكلفة", "تكلفة", "التكلفة الكلية", "العرض المالي", "التقييم المالي"];
  function isFinancial(t) {
    const s = String(t == null ? "" : t).replace(/\s+/g, " ").trim();
    return FINANCIAL.indexOf(s) !== -1;
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ─────────────────────────────────────────────────────────────── العرض ──

  function renderMeta(record) {
    const box = $("meta");
    box.textContent = "";
    if (!record) {
      box.appendChild(el("div", "empty", "لا توجد بيانات محفوظة. افتح المنافسة في تنفيذ واضغط «املأ في اعتماد»."));
      return;
    }
    const meta = record.meta || {};
    box.appendChild(el("div", "t", meta.title || "منافسة بلا عنوان"));
    const age = Date.now() - record.savedAt;
    const stale = age > MAX_AGE_MS;
    box.appendChild(
      el("div", "k", "التُقطت " + ago(record.savedAt) + (stale ? " — منتهية الصلاحية، أعد الالتقاط" : ""))
    );
    if (meta.competitionId) box.appendChild(el("div", "k", "رقم المنافسة: " + meta.competitionId));
  }

  function renderCriteria(raw) {
    const box = $("criteria");
    box.textContent = "";
    const tree = raw && Array.isArray(raw.evaluationCriteria) ? raw.evaluationCriteria : [];
    $("critCount").textContent = tree.length ? String(tree.length) : "—";

    if (!tree.length) {
      box.appendChild(el("div", "empty-state", "لا توجد معايير تقييم في هذه الحمولة."));
      return;
    }

    tree.forEach(function (c) {
      const node = el("div", "node");
      const row = el("div", "row");
      const nm = el("span", "nm", esc(c.title));
      if (isFinancial(c.title)) {
        const tag = el("span", "tag fin", "مالي");
        tag.title = "جدول التقييم المالي ثابت في اعتماد — يذهب لوزن التقييم المالي";
        nm.appendChild(tag);
      }
      row.appendChild(nm);
      row.appendChild(el("span", "w", esc(c.weight) + "%"));
      node.appendChild(row);

      const kids = Array.isArray(c.children) ? c.children : [];
      if (kids.length) {
        const wrap = el("div", "kid");
        kids.forEach(function (k) {
          const r = el("div", "row");
          r.appendChild(el("span", "nm", esc(k.title)));
          r.appendChild(el("span", "w", esc(k.weight) + "%"));
          wrap.appendChild(r);
        });
        node.appendChild(wrap);
      } else if (!isFinancial(c.title)) {
        const hint = el("div", "kid");
        const r = el("div", "row");
        r.appendChild(el("span", "nm", "سيُنشأ مستوى ثالث بنفس الاسم"));
        hint.appendChild(r);
        hint.title = "اعتماد يضع حقل الوزن على المستوى الثالث فقط";
        node.appendChild(hint);
      }
      box.appendChild(node);
    });

    const scalars = [
      ["نسبة الاجتياز الفني", raw.technicalPassScore],
      ["وزن التقييم الفني", raw.technicalWeight],
      ["وزن التقييم المالي", raw.financialWeight],
    ].filter(function (p) {
      return p[1] !== "" && p[1] != null;
    });
    if (scalars.length) box.appendChild(el("div", "sub", "أوزان عامة"));
    scalars.forEach(function (p) {
      const node = el("div", "node");
      const row = el("div", "row");
      row.appendChild(el("span", "nm", p[0]));
      row.appendChild(el("span", "w", esc(p[1]) + "%"));
      node.appendChild(row);
      box.appendChild(node);
    });
  }

  let allFields = [];
  function renderFields(filter) {
    const box = $("fields");
    box.textContent = "";
    const q = String(filter || "").trim().toLowerCase();
    const rows = allFields.filter(function (f) {
      if (!q) return true;
      return f[0].toLowerCase().indexOf(q) !== -1 || String(shortValue(f[1])).toLowerCase().indexOf(q) !== -1;
    });
    if (!rows.length) {
      box.appendChild(el("div", "empty-state", q ? "لا نتائج مطابقة." : "لا توجد حقول."));
      return;
    }
    rows.forEach(function (f) {
      const item = el("div", "item");
      item.appendChild(el("span", "n", f[0]));
      item.appendChild(el("span", "v", shortValue(f[1])));
      box.appendChild(item);
    });
  }

  function renderLog(log) {
    const sum = $("logSummary");
    const box = $("logRows");
    sum.textContent = "";
    box.textContent = "";

    const pages = Object.keys(log || {});
    if (!pages.length) {
      sum.appendChild(el("div", "empty", "لم تُنفَّذ أي تعبئة بعد."));
      return;
    }
    // أحدث صفحة مُلئت
    let latestKey = pages[0];
    pages.forEach(function (k) {
      if ((log[k].at || 0) > (log[latestKey].at || 0)) latestKey = k;
    });
    const entry = log[latestKey];

    sum.appendChild(el("div", "t", "مُلئ " + entry.filled + " · تُخطّي " + entry.skipped + " · فشل " + entry.failed));
    sum.appendChild(el("div", "k", ago(entry.at)));
    sum.appendChild(el("div", "k", "الصفحة: " + latestKey));

    const rows = Array.isArray(entry.rows) ? entry.rows : [];
    if (!rows.length) {
      box.appendChild(el("div", "empty-state", "لا توجد تفاصيل محفوظة لهذه التعبئة."));
      return;
    }
    const STATUS_AR = { filled: "مُلئ", skipped: "تُخطّي", failed: "فشل", note: "ملاحظة" };
    rows.forEach(function (r) {
      const status = r.status || "skipped";
      const item = el("div", "item");
      item.appendChild(el("span", "st " + status, STATUS_AR[status] || status));
      item.appendChild(el("span", "v", r.key + (r.detail ? " — " + r.detail : "")));
      box.appendChild(item);
    });
  }

  function renderState(settings, record) {
    const dot = $("dot");
    const text = $("stateText");
    document.body.classList.toggle("off", !settings.enabled);

    if (!settings.enabled) {
      dot.className = "dot off";
      text.textContent = "الإضافة متوقفة — لن تملأ أي صفحة";
      return;
    }
    if (!record) {
      dot.className = "dot warn";
      text.textContent = "مفعّلة — بانتظار بيانات من تنفيذ";
      return;
    }
    if (Date.now() - record.savedAt > MAX_AGE_MS) {
      dot.className = "dot warn";
      text.textContent = "البيانات منتهية الصلاحية — أعد الالتقاط من تنفيذ";
      return;
    }
    dot.className = "dot ok";
    text.textContent = settings.autoFill ? "مفعّلة — تملأ تلقائيًا عند فتح اعتماد" : "مفعّلة — التعبئة يدوية";
  }

  // ───────────────────────────────────────────────────────────────── boot ──

  async function refresh() {
    const items = await get([STORAGE_KEY, LOG_KEY, SETTINGS_KEY]);
    const settings = Object.assign({}, DEFAULTS, items[SETTINGS_KEY] || {});
    const record = items[STORAGE_KEY] && items[STORAGE_KEY].savedAt ? items[STORAGE_KEY] : null;

    $("enabled").checked = settings.enabled;
    $("autoFill").checked = settings.autoFill;
    $("showOverlay").checked = settings.showOverlay;
    $("fillCriteria").checked = settings.fillCriteria;

    renderState(settings, record);
    renderMeta(record);

    const payload = (record && record.payload) || {};
    const fields = payload.etimadFields || {};
    allFields = Object.keys(fields)
      .sort()
      .map(function (k) {
        return [k, fields[k]];
      });
    $("fieldCount").textContent = allFields.length ? String(allFields.length) : "—";
    renderFields($("search").value);
    renderCriteria(payload.raw || {});
    renderLog(items[LOG_KEY] || {});
  }

  async function patchSettings(patch) {
    const items = await get([SETTINGS_KEY]);
    const next = Object.assign({}, DEFAULTS, items[SETTINGS_KEY] || {}, patch);
    const out = {};
    out[SETTINGS_KEY] = next;
    await set(out);
    await refresh();
  }

  document.addEventListener("DOMContentLoaded", function () {
    try {
      const m = chrome.runtime.getManifest();
      $("ver").textContent = m.name + " — الإصدار " + m.version;
    } catch (_e) {
      /* ignore */
    }

    ["enabled", "autoFill", "showOverlay", "fillCriteria"].forEach(function (id) {
      $(id).addEventListener("change", function (e) {
        const patch = {};
        patch[id] = e.target.checked;
        patchSettings(patch);
      });
    });

    document.querySelectorAll(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        document.querySelectorAll(".tab").forEach(function (t) {
          t.classList.toggle("is-on", t === tab);
        });
        document.querySelectorAll(".pane").forEach(function (p) {
          p.classList.toggle("is-on", p.id === "pane-" + tab.dataset.tab);
        });
      });
    });

    $("search").addEventListener("input", function (e) {
      renderFields(e.target.value);
    });

    $("clear").addEventListener("click", async function () {
      const out = {};
      out[STORAGE_KEY] = null;
      out[LOG_KEY] = {};
      await set(out);
      await refresh();
    });

    refresh();
  });
})();
