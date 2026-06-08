// Render cover.html + body.html to PDF (system Chrome via Puppeteer) and merge with
// pdf-lib so the cover is unnumbered and the body is numbered 1..N (the pro convention).
import { createRequire } from 'node:module';
import fs from 'node:fs';

const DIR = '/Users/kareem.adel.zayed/tanfeth/docs/product/deliverable';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = `${DIR}/Tanfeeth-Product-Delivery-AR.pdf`;

const reqBackend = createRequire('/Users/kareem.adel.zayed/tanfeth/backend/');
const reqCache = createRequire('/Users/kareem.adel.zayed/.cache/tanfeeth-pdf-build/');
const puppeteer = reqBackend('puppeteer');
const { PDFDocument } = reqCache('pdf-lib');

const footer = `
<div style="width:100%;font-family:Arial,Helvetica,sans-serif;font-size:7.4pt;color:#9aa2ac;
  padding:3px 15mm 0;display:flex;justify-content:space-between;align-items:center;
  border-top:0.5px solid #d6dbe0;">
  <span style="letter-spacing:.02em;">Tanfeeth — Product &amp; Delivery Plan</span>
  <span style="letter-spacing:.14em;text-transform:uppercase;">Confidential</span>
  <span><span class="pageNumber"></span>&nbsp;/&nbsp;<span class="totalPages"></span></span>
</div>`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--font-render-hinting=none'],
});

async function render(file, opts) {
  const page = await browser.newPage();
  await page.goto(`file://${DIR}/${file}`, { waitUntil: 'networkidle0' });
  await page.evaluate(async () => { await document.fonts.ready; });
  const buf = await page.pdf(opts);
  await page.close();
  return buf;
}

const coverPdf = await render('cover.html', {
  width: '210mm', height: '297mm', printBackground: true,
  margin: { top: '0', bottom: '0', left: '0', right: '0' },
});

const bodyPdf = await render('body.html', {
  format: 'A4', printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: footer,
  margin: { top: '16mm', bottom: '17mm', left: '15mm', right: '15mm' },
});

await browser.close();

const merged = await PDFDocument.create();
let total = 0;
for (const bytes of [coverPdf, bodyPdf]) {
  const src = await PDFDocument.load(bytes);
  const pages = await merged.copyPages(src, src.getPageIndices());
  pages.forEach((p) => merged.addPage(p));
  total += src.getPageCount();
}
fs.writeFileSync(OUT, await merged.save());
console.log(`OK · ${total} pages · ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB · ${OUT}`);
