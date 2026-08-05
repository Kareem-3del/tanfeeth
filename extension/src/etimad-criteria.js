// تنفيذ — التعبئة في اعتماد | معايير التقييم (شجرة متكررة)
//
// «معايير التقييم» في اعتماد ليست حقولًا لها `name` — هي واجهة إضافة متكررة:
//   • المستوى الأول ثابت في اعتماد (التقييم الفني / التقييم المالي) ولا يُضاف.
//   • المستوى الثاني/الثالث يُضافان بكتابة الاسم في حقل **بلا name ولا id**
//     ثم الضغط على «إضافة» (addCriteria) — كل إضافة تُنشئ صفًا في الجدول.
//   • الوزن لا يُكتب في نموذج الإضافة بل في عمود «الوزن النهائي» داخل الجدول،
//     في input معرّفه مُولَّد ديناميكيًا (class="finalweightinput").
//
// لذلك محرك التعبئة المسطّح (name → value) لا يستطيع لمسها إطلاقًا، وهذا سبب
// عدم إضافة المعايير. هذا الملف ينفّذ الواجهة المتكررة خطوة بخطوة.
//
// المخطط الدلالي (مهم): جدول «التقييم المالي» في اعتماد ثابت وغير قابل
// للتحرير (التقييم المالي ← السعر ← التكلفة الكلية ← 100). لذلك أي معيار
// أساسي في تنفيذ يمثّل السعر/التكلفة **لا يُضاف** كمعيار فني — وإلا حُسِب
// مرتين — ويُستخدم وزنه لوزن التقييم المالي بدلًا من ذلك. القرار يُسجَّل في
// نتيجة التعبئة (لا يُطبَّق بصمت).
//
// الإضافة لا تضغط «حفظ ومتابعة» أبدًا — المستخدم يراجع ويحفظ بنفسه.

"use strict";

const TNF_CRITERIA = (function () {
  const SETTLE_MS = 450; // اعتماد يعيد رسم الجدول بعد كل إضافة

  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }

  function norm(v) {
    return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  }

  function num(v) {
    if (v == null || v === "") return null;
    const n = Number(String(v).replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function isVisible(el) {
    return Boolean(el && el.getClientRects && el.getClientRects().length);
  }

  /** معيار أساسي يمثّل الشق المالي في اعتماد (جدوله ثابت وغير قابل للتحرير). */
  const FINANCIAL_RE = /(السعر|سعر|التكلفة|تكلفة|العرض المالي|التقييم المالي|price|cost|financial)/i;
  function isFinancialTitle(title) {
    return FINANCIAL_RE.test(norm(title));
  }

  // ───────────────────────────────────────────────── DOM: نموذج الإضافة ──

  /** صف الإضافة المطابق لمستوى معيّن، معرَّفًا بنص التسمية داخله. */
  function addRowFor(levelLabel) {
    const rows = Array.prototype.slice.call(document.querySelectorAll("div.row"));
    for (const row of rows) {
      if (!row.querySelector('button[onclick*="addCriteria"]')) continue;
      const labels = Array.prototype.slice.call(row.querySelectorAll("label"));
      const own = labels.find(function (l) {
        return norm(l.textContent) === levelLabel;
      });
      if (!own) continue;
      const input = row.querySelector('input[type="text"].form-control');
      const button = row.querySelector('button[onclick*="addCriteria"]');
      if (input && button) {
        return { row: row, input: input, button: button, select: row.querySelector("select.selectpicker") };
      }
    }
    return null;
  }

  /** تبديل «إضافة معيار فني» بين المستوى الثاني/الثالث (يُظهر صف الإضافة). */
  async function setAddLevel(levelTwo) {
    const radio = document.getElementById(levelTwo ? "isLevelTwo1" : "isLevelTwo2");
    if (!radio) return false;
    if (!radio.checked) {
      try {
        radio.click(); // النقر يشغّل معالجات إظهار/إخفاء الصفوف في اعتماد
      } catch (_e) {
        radio.checked = true;
        radio.dispatchEvent(new Event("change", { bubbles: true }));
      }
      await sleep(250);
    }
    return true;
  }

  function setText(el, value) {
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    if (desc && typeof desc.set === "function") desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /** اختيار الأب (المستوى الثاني) في قائمة bootstrap-select بنص الخيار. */
  function selectParent(select, parentTitle, jquerySync) {
    const want = norm(parentTitle);
    const options = Array.prototype.slice.call(select.options || []);
    const match = options.find(function (o) {
      return norm(o.textContent) === want;
    });
    if (!match) return false;
    const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    if (desc && typeof desc.set === "function") desc.set.call(select, match.value);
    else select.value = match.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    if (typeof jquerySync === "function") jquerySync(select, match.value);
    return true;
  }

  // ──────────────────────────────────────────────────── DOM: جدول المعايير ──

  /**
   * جدول «معايير التقييم الفني».
   *
   * لا يُعرَّف بوجود حقل وزن (input.finalweightinput) لأن الجدول يكون **فارغًا
   * تمامًا قبل أول إضافة** — وهي الحالة الأشيع — فيعود null وتفشل كل عمليات
   * التحقق والوزن. التعريف بترويسة «الوزن النهائي» مع استبعاد جدول الشق
   * المالي الثابت (يحوي «التقييم المالي» في متنه).
   */
  function technicalTable() {
    const tables = Array.prototype.slice.call(document.querySelectorAll("table"));
    const candidates = tables.filter(function (t) {
      const head = norm(t.tHead ? t.tHead.textContent : "");
      if (head.indexOf("الوزن النهائي") === -1) return false;
      const body = norm(t.tBodies && t.tBodies[0] ? t.tBodies[0].textContent : "");
      return body.indexOf("التقييم المالي") === -1;
    });
    return candidates.length ? candidates[0] : null;
  }

  /**
   * شبكة منطقية للجدول تراعي rowspan: خلية المستوى الثاني تمتد على صفوف
   * أبنائها، فتنزاح فهارس الخلايا في صفوف الاستمرار. بدون هذا يُقرأ اسم
   * المستوى الثالث على أنه المستوى الثاني ويُكتب الوزن في الصف الخطأ.
   */
  function buildGrid(table) {
    const body = table.tBodies && table.tBodies[0];
    if (!body) return [];
    const rows = Array.prototype.slice.call(body.rows);
    const carry = {}; // colIndex → { remaining, ref }
    const grid = [];

    rows.forEach(function (tr, r) {
      const cells = Array.prototype.slice.call(tr.cells);
      const line = [];
      let ci = 0;
      for (let c = 0; c < 12; c += 1) {
        if (carry[c] && carry[c].remaining > 0) {
          line[c] = carry[c].ref;
          carry[c].remaining -= 1;
          continue;
        }
        if (ci >= cells.length) break;
        const cell = cells[ci];
        ci += 1;
        const ref = { text: norm(cell.textContent), cell: cell };
        line[c] = ref;
        const rs = parseInt(cell.getAttribute("rowspan") || "1", 10);
        if (rs > 1) carry[c] = { remaining: rs - 1, ref: ref };
      }
      grid[r] = line;
    });
    return grid;
  }

  /** أسماء المستوى الثاني الموجودة فعلًا في الجدول (لتفادي التكرار). */
  function existingLevelTwo(grid) {
    const set = new Set();
    grid.forEach(function (line) {
      if (line[1] && line[1].text) set.add(line[1].text);
    });
    return set;
  }

  function existingPaths(grid) {
    const set = new Set();
    grid.forEach(function (line) {
      const l2 = line[1] ? line[1].text : "";
      const l3 = line[2] ? line[2].text : "";
      if (l2) set.add(l2 + "›" + l3);
    });
    return set;
  }

  /** حقل الوزن النهائي للسطر المطابق للمسار (مستوى ثانٍ + ثالث اختياري). */
  function weightInputFor(grid, levelTwo, levelThree) {
    const wantTwo = norm(levelTwo);
    const wantThree = norm(levelThree || "");
    for (const line of grid) {
      if (!line[1] || line[1].text !== wantTwo) continue;
      const three = line[2] ? line[2].text : "";
      if (wantThree && three !== wantThree) continue;
      if (!wantThree && three) continue; // المعيار له أبناء → الوزن على الأبناء
      for (let c = 2; c < line.length; c += 1) {
        const input = line[c] && line[c].cell && line[c].cell.querySelector("input.finalweightinput");
        if (input) return input;
      }
    }
    return null;
  }

  // ───────────────────────────────────────────────────────────── التنفيذ ──

  /**
   * @param payload حمولة تنفيذ الخام (evaluationCriteria + الأوزان)
   * @param jquerySync دالة مزامنة select مع jQuery في سياق الصفحة
   * @returns {{applicable:boolean, rows:Array, added:number, weighted:number, notes:Array}}
   */
  async function fill(payload, jquerySync) {
    const out = { applicable: false, rows: [], added: 0, weighted: 0, notes: [] };
    if (!payload || typeof payload !== "object") return out;

    const tree = Array.isArray(payload.evaluationCriteria) ? payload.evaluationCriteria : [];
    const table = technicalTable();
    const levelTwoForm = addRowFor("المستوى الثاني");

    // ليست صفحة معايير التقييم → لا شيء ليُعمل
    if (!table && !levelTwoForm) return out;
    out.applicable = true;

    // شجرة فارغة لا تمنع تعبئة نسبة الاجتياز ووزنَي الشقين — هي حقول مستقلة.
    if (!tree.length) out.notes.push("لا توجد معايير تقييم في حمولة تنفيذ");

    // ١) فصل الشق المالي: جدوله في اعتماد ثابت وغير قابل للتحرير.
    const financial = tree.filter(function (c) {
      return isFinancialTitle(c && c.title);
    });
    const technical = tree.filter(function (c) {
      return !isFinancialTitle(c && c.title);
    });
    financial.forEach(function (c) {
      out.notes.push(
        "«" + norm(c.title) + "» لم يُضف كمعيار فني — جدول التقييم المالي ثابت في اعتماد؛ وزنه يذهب لوزن التقييم المالي"
      );
    });

    if (!technical.length) {
      out.notes.push("لا توجد معايير فنية بعد استبعاد الشق المالي");
    }

    // ٢) إضافة المستوى الثاني ثم الثالث (تخطّي الموجود مسبقًا).
    for (const parent of technical) {
      const title = norm(parent && parent.title);
      if (!title) continue;

      let grid = table ? buildGrid(table) : [];
      if (existingLevelTwo(grid).has(title)) {
        out.rows.push({ key: "معيار: " + title, status: "skipped", detail: "موجود في الجدول مسبقًا" });
      } else if (!levelTwoForm) {
        out.rows.push({ key: "معيار: " + title, status: "failed", detail: "نموذج إضافة المستوى الثاني غير موجود" });
        continue;
      } else {
        await setAddLevel(true);
        const form = addRowFor("المستوى الثاني") || levelTwoForm;
        setText(form.input, title);
        await sleep(120);
        form.button.click();
        await sleep(SETTLE_MS);
        grid = table ? buildGrid(table) : [];
        const ok = existingLevelTwo(grid).has(title);
        out.rows.push({
          key: "معيار: " + title,
          status: ok ? "filled" : "failed",
          detail: ok ? "أُضيف كمستوى ثانٍ" : "لم يظهر في الجدول بعد الإضافة",
        });
        if (ok) out.added += 1;
      }

      const children = Array.isArray(parent.children) ? parent.children : [];
      for (const child of children) {
        const childTitle = norm(child && child.title);
        if (!childTitle) continue;
        const gridNow = table ? buildGrid(table) : [];
        if (existingPaths(gridNow).has(title + "›" + childTitle)) {
          out.rows.push({ key: "فرع: " + title + " › " + childTitle, status: "skipped", detail: "موجود مسبقًا" });
          continue;
        }
        await setAddLevel(false);
        const form3 = addRowFor("المستوى الثالث");
        if (!form3 || !form3.select) {
          out.rows.push({
            key: "فرع: " + title + " › " + childTitle,
            status: "failed",
            detail: "نموذج إضافة المستوى الثالث غير مكتمل",
          });
          continue;
        }
        const picked = selectParent(form3.select, title, jquerySync);
        if (!picked) {
          out.rows.push({
            key: "فرع: " + title + " › " + childTitle,
            status: "failed",
            detail: "المعيار الأب غير متاح في القائمة",
          });
          continue;
        }
        await sleep(150);
        setText(form3.input, childTitle);
        await sleep(120);
        form3.button.click();
        await sleep(SETTLE_MS);
        const ok3 = table ? existingPaths(buildGrid(table)).has(title + "›" + childTitle) : false;
        out.rows.push({
          key: "فرع: " + title + " › " + childTitle,
          status: ok3 ? "filled" : "failed",
          detail: ok3 ? "أُضيف كمستوى ثالث" : "لم يظهر في الجدول بعد الإضافة",
        });
        if (ok3) out.added += 1;
      }
    }

    // ٣) الأوزان النهائية — تُطبَّع على ١٠٠ داخل الشق الفني.
    //    اعتماد يوزّع الوزن داخل كل شق على ١٠٠ (جدول المالي = التكلفة ١٠٠)،
    //    فلو استُبعد معيار السعر لن يجمع الباقي ١٠٠. التطبيع يُذكر صراحةً.
    if (table && technical.length) {
      const leaves = [];
      technical.forEach(function (parent) {
        const children = Array.isArray(parent.children) ? parent.children : [];
        if (children.length) {
          children.forEach(function (child) {
            leaves.push({ two: norm(parent.title), three: norm(child.title), weight: num(child.weight) });
          });
        } else {
          leaves.push({ two: norm(parent.title), three: "", weight: num(parent.weight) });
        }
      });

      const total = leaves.reduce(function (s, l) {
        return s + (l.weight || 0);
      }, 0);
      const scale = total > 0 && Math.abs(total - 100) > 0.01 ? 100 / total : 1;
      if (scale !== 1) {
        out.notes.push(
          "أوزان المعايير الفنية مجموعها " + total + "% — طُبِّعت إلى ١٠٠٪ داخل الشق الفني (اعتماد يوزّع كل شق على ١٠٠)"
        );
      }

      const grid = buildGrid(table);
      leaves.forEach(function (leaf) {
        if (leaf.weight == null) return;
        const input = weightInputFor(grid, leaf.two, leaf.three);
        const label = "وزن: " + leaf.two + (leaf.three ? " › " + leaf.three : "");
        if (!input) {
          out.rows.push({ key: label, status: "skipped", detail: "لم يُعثر على سطر مطابق في الجدول" });
          return;
        }
        const value = Math.round(leaf.weight * scale * 100) / 100;
        setText(input, String(value));
        input.dispatchEvent(new Event("blur", { bubbles: true }));
        out.weighted += 1;
        out.rows.push({ key: label, status: "filled", detail: String(value) + "%" });
      });
    }

    // ٤) نسبة الاجتياز ووزنا الشقين (ids بلا name — لا يراها المحرك المسطّح).
    const financialFromTree = financial.reduce(function (s, c) {
      return s + (num(c.weight) || 0);
    }, 0);

    const scalars = [
      { id: "txtTechnicalPassingRate", value: payload.technicalPassScore, label: "نسبة الاجتياز الفني" },
      {
        id: "technicalEvaluationWeight",
        value: payload.technicalWeight,
        label: "وزن التقييم الفني",
        fallback: financialFromTree > 0 ? 100 - financialFromTree : null,
      },
      {
        id: "financialEvaluationWeight",
        value: payload.financialWeight,
        label: "وزن التقييم المالي",
        fallback: financialFromTree > 0 ? financialFromTree : null,
      },
    ];

    scalars.forEach(function (f) {
      const el = document.getElementById(f.id);
      if (!el || !isVisible(el)) return;
      let v = num(f.value);
      let derived = false;
      if (v == null && f.fallback != null) {
        v = f.fallback;
        derived = true;
      }
      if (v == null) {
        out.rows.push({ key: f.label, status: "skipped", detail: "لا قيمة في الحمولة" });
        return;
      }
      setText(el, String(v));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
      out.weighted += 1;
      out.rows.push({
        key: f.label,
        status: "filled",
        detail: String(v) + "%" + (derived ? " (مُشتق من وزن معيار السعر)" : ""),
      });
      if (derived) {
        out.notes.push(f.label + " غير مُدخل في تنفيذ — اشتُق من وزن معيار السعر (" + v + "%)");
      }
    });

    return out;
  }

  return { fill: fill, isFinancialTitle: isFinancialTitle };
})();
