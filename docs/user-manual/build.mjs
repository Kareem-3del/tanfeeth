/**
 * يبني «دليل المستخدم لمنصة تنفيذ» PDF من الفصول في chapters/.
 *
 * التمريرة الأولى تطبع الوثيقة بعلامات مخفية عند كل عنوان، ثم يُستخرج نص كل صفحة
 * لمعرفة صفحة كل عنوان، فتُكتب الأرقام في الفهرس وتُطبع الوثيقة مرة ثانية.
 *
 *   node docs/user-manual/build.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createRequire } from "node:module";

import puppeteer from "/Users/kareem.adel.zayed/tanfeth/backend/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js";

const { PDFDocument } = createRequire("/Users/kareem.adel.zayed/.cache/tanfeeth-pdf-build/")("pdf-lib");

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(DIR, "Tanfeeth-User-Manual-AR.pdf");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const chapters = readdirSync(join(DIR, "chapters")).filter((f) => f.endsWith(".html")).sort();
const manifest = {};
if (existsSync(join(DIR, "shots"))) for (const f of readdirSync(join(DIR, "shots")).filter((x) => /^manifest.*\.json$/.test(x))) Object.assign(manifest, JSON.parse(readFileSync(join(DIR, "shots", f), "utf8")));

const date = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { dateStyle: "long" }).format(new Date());

const MARK = (size) => `
<svg width="${Math.round(size * 1.45)}" height="${size}" viewBox="0 0 58 40" fill="none" aria-hidden="true">
  ${[0, 16, 32].map((x, i) => `<polyline points="${x + 5.5},7 ${x + 18.5},20 ${x + 5.5},33" stroke="${["#2F7D5E", "#4FA36A", "#9ED9A6"][i]}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}
  <circle cx="53.4" cy="5.6" r="3.6" fill="#9ED9A6"/>
</svg>`;

const cover = `
<div class="cover">
  <div class="band"></div>
  <div class="brand">${MARK(30)}<div><b>تنفيذ</b><br><span>منصة إدارة المنافسات والعقود الحكومية</span></div></div>
  <div class="mid">
    <div class="kicker">الدليل الإرشادي للموظفين</div>
    <h1 class="title">دليل المستخدم</h1>
    <p class="subtitle">شرح تفصيلي لكل صفحة وميزة وإجراء في منصة تنفيذ — من الخطة السنوية إلى إقفال العقد</p>
    <div class="rule"></div>
    <p class="desc">يعرّف هذا الدليل الموظف بالغاية من كل جزء في المنصة، وبطريقة العمل فيه خطوة بخطوة، وبالأسباب النظامية والإجرائية التي بُني عليها، ليبدأ العمل عليها مباشرة.</p>
  </div>
  <div class="meta">
    <div><b>الإصدار</b>١٫٠</div>
    <div><b>تاريخ الإصدار</b>${date}</div>
    <div><b>التصنيف</b>للاستخدام الداخلي في الجهة</div>
  </div>
</div>`;

const front = `
<div class="front">
  <h2>عن هذا الدليل</h2>
  <p>أُعدّ هذا الدليل لموظفي الجهة الذين يستخدمون منصة تنفيذ في أعمالهم اليومية: الإدارات الطالبة، وإدارة المشتريات، وإدارة العقود، وأعضاء اللجان، والإدارة العليا، ومدير النظام في الجهة. ولا يفترض الدليل أي خلفية تقنية لدى القارئ.</p>
  <p>يتناول كل فصل مرحلة من مراحل العمل أو مجموعة من الأدوات، ويشرح لكل صفحة غايتها، وما يظهر فيها، والإجراءات المتاحة عليها ومن يملكها، والخطوات التفصيلية لتنفيذ كل إجراء، وسبب تصميمها على هذا النحو. ويُختم كل فصل بأسئلة شائعة.</p>
  <p>قد لا تظهر لك بعض الصفحات أو الأزرار المذكورة في هذا الدليل؛ فالمنصة تعرض لكل موظف ما يتيحه له دوره فقط. فإن احتجت إلى صفحة لا تظهر لك فتواصل مع مدير النظام في جهتك.</p>
  <p>صور الشاشة الواردة في الدليل مأخوذة من بيئة تجريبية ببيانات افتراضية، وقد تختلف تفاصيلها عن البيانات الفعلية في جهتك أو عن هوية جهتك وألوانها.</p>
  <h2 style="margin-top:10mm">اصطلاحات الدليل</h2>
  <div class="purpose"><h5>الغاية</h5><p>يوضّح ما وُجدت الصفحة أو الميزة من أجله، والمشكلة التي تحلّها.</p></div>
  <div class="why"><h5>لماذا صُمِّم هكذا</h5><p>يشرح سبب قرار إجرائي أو تصميمي قد لا يكون بديهيًا، ويستند غالبًا إلى نظام المنافسات والمشتريات الحكومية ولائحته التنفيذية.</p></div>
  <div class="note"><h5>ملاحظة</h5><p>معلومة إضافية تساعد على الفهم.</p></div>
  <div class="tip"><h5>نصيحة</h5><p>طريقة أسرع أو أفضل لإنجاز العمل.</p></div>
  <div class="warn"><h5>تنبيه</h5><p>أمر يجب الانتباه له لتجنّب خطأ أو إجراء لا يمكن التراجع عنه.</p></div>
  <p>النصوص الظاهرة على الشاشة كما هي تُكتب بهذا الشكل: <span class="ui">إرسال للاعتماد</span>، وأسماء الحالات بهذا الشكل: <span class="status">بانتظار الاعتماد</span>.</p>
</div>`;

const body = chapters.map((f) => readFileSync(join(DIR, "chapters", f), "utf8")).join("\n");

const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>دليل المستخدم — منصة تنفيذ</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="manual.css">
<style>@page :first { margin: 0; }</style>
</head><body>
${cover}
${front}
<nav class="toc"><h2>المحتويات</h2><ol id="toc"></ol></nav>
<main>${body}</main>
</body></html>`;

const SRC = join(DIR, "manual.html");
writeFileSync(SRC, html);

/** يرقّم الفصول والأشكال ويضع الصور ويبني الفهرس، داخل الصفحة. */
function prepare(manifest) {
  const AR = (n) => String(n);
  let mk = 0;
  const entries = [];
  document.querySelectorAll("main section.chapter").forEach((sec, ci) => {
    const isAppendix = sec.id === "ch-99";
    const h1 = sec.querySelector("h1");
    const num = isAppendix ? "" : AR(ci);
    const opener = document.createElement("div");
    opener.className = "ch-opener";
    opener.innerHTML = `<div class="num">${isAppendix ? "الملاحق" : ci === 0 ? "تمهيد" : `الفصل ${num}`}<span class="mk">QQ${mk + 1}QQ</span></div>`;
    h1.parentNode.insertBefore(opener, h1);
    opener.appendChild(h1);
    const chEntry = { id: sec.id, title: h1.textContent.trim(), label: isAppendix || ci === 0 ? "" : num, mk: ++mk, children: [] };
    entries.push(chEntry);

    sec.querySelectorAll("h2").forEach((h2, hi) => {
      if (!h2.id) h2.id = `${sec.id}-s${hi}`;
      const e = { id: h2.id, title: h2.textContent.trim(), mk: ++mk };
      h2.insertAdjacentHTML("afterend", `<div class="mk">QQ${e.mk}QQ</div>`);
      chEntry.children.push(e);
    });

    let fig = 0;
    sec.querySelectorAll("figure.shot").forEach((f, fi) => {
      const key = `${sec.id}#${fi}`;
      const shot = manifest[key];
      if (!shot) { f.remove(); return; }
      fig += 1;
      const cap = f.getAttribute("data-caption") || "";
      f.innerHTML = `<img src="${shot.file}" alt=""><figcaption><b>شكل ${isAppendix ? "م" : ci === 0 ? "ت" : AR(ci)}-${fig}</b>${cap}</figcaption>`;
      if (shot.narrow) f.classList.add("narrow");
    });
  });

  const toc = document.getElementById("toc");
  toc.innerHTML = entries.map((c) => `
    <li class="toc-ch"><div class="row"><a href="#${c.id}" class="t">${c.label ? `<span class="n">${c.label}.</span>` : ""}${c.title}</a><span class="dots"></span><span class="p" data-mk="${c.mk}"></span></div>
      <ol>${c.children.map((s) => `<li><div class="row"><a href="#${s.id}" class="t">${s.title}</a><span class="dots"></span><span class="p" data-mk="${s.mk}"></span></div></li>`).join("")}</ol>
    </li>`).join("");
  return mk;
}

const footerTemplate = `
<div dir="rtl" style="width:100%;font-family:'Geeza Pro',Arial,sans-serif;font-size:7.5pt;color:#8A9391;padding:0 15mm;display:flex;justify-content:space-between;align-items:center;">
  <span>منصة تنفيذ — دليل المستخدم</span>
  <span><span class="pageNumber"></span></span>
</div>`;

const pdfOpts = {
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<div></div>",
  footerTemplate,
  margin: { top: "17mm", bottom: "18mm", left: "17mm", right: "17mm" },
  outline: true,
  tagged: true,
  timeout: 0,
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--font-render-hinting=none"] });
const page = await browser.newPage();
await page.goto(`file://${SRC}`, { waitUntil: "networkidle0", timeout: 0 });
await page.evaluate(async () => { await document.fonts.ready; });
const total = await page.evaluate(prepare, manifest);
await page.evaluate(async () => {
  await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
});

// التمريرة الأولى: أرقام مؤقتة بعرض مماثل حتى لا يتغير التدفق.
await page.evaluate(() => document.querySelectorAll(".toc .p").forEach((s) => (s.textContent = "000")));
const tmp = join(DIR, ".pass1.pdf");
writeFileSync(tmp, await page.pdf(pdfOpts));

const text = execFileSync("pdftotext", ["-enc", "UTF-8", tmp, "-"], { maxBuffer: 1 << 28 }).toString("utf8");
const pages = text.split("\f");
const where = {};
pages.forEach((t, i) => {
  for (const m of t.matchAll(/QQ(\d+)QQ/g)) if (!(m[1] in where)) where[m[1]] = i + 1;
});
const missing = Array.from({ length: total }, (_, i) => i + 1).filter((n) => !where[n]);
if (missing.length) console.warn(`لم تُعثر على صفحات ${missing.length} عنوانًا:`, missing.slice(0, 20));

await page.evaluate((where) => {
  document.querySelectorAll(".toc .p").forEach((s) => (s.textContent = where[s.dataset.mk] ?? ""));
}, where);
const full = await page.pdf(pdfOpts);
// الغلاف بلا تذييل: تُطبع صفحته الأولى وحدها بلا ترويسة وتحلّ محل الأولى، فيبقى فهرس العلامات.
const coverPdf = await page.pdf({ ...pdfOpts, displayHeaderFooter: false, outline: false, pageRanges: "1" });
await browser.close();
const doc = await PDFDocument.load(full);
const [coverPage] = await doc.copyPages(await PDFDocument.load(coverPdf), [0]);
doc.removePage(0);
doc.insertPage(0, coverPage);
doc.setTitle("دليل المستخدم — منصة تنفيذ");
doc.setAuthor("منصة تنفيذ");
doc.setLanguage("ar");
writeFileSync(OUT, await doc.save());

const info = execFileSync("pdfinfo", [OUT]).toString();
console.log(OUT);
console.log(info.split("\n").filter((l) => /Pages|File size/.test(l)).join("\n"));
