import { createRequire } from 'node:module';
import fs from 'node:fs';

const DIR = '/Users/kareem.adel.zayed/tanfeth/docs/product/deliverable';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = `${DIR}/Tanfeeth-Product-Delivery-AR-v2.pdf`;
const req = createRequire('/Users/kareem.adel.zayed/tanfeth/backend/');
const puppeteer = req('puppeteer');

const mark = fs.readFileSync(`${DIR}/logo-mark.svg`).toString('base64');
const footer = `<div style="width:100%;direction:rtl;font-family:Arial,sans-serif;font-size:7pt;color:#8b969e;padding:2px 15mm 0;display:flex;justify-content:space-between;align-items:center;border-top:.5px solid #d8dfdd">
  <span style="display:flex;align-items:center;gap:4px"><img src="data:image/svg+xml;base64,${mark}" style="height:10px;width:auto"><span style="color:#234f33;font-weight:bold">منصة تنفيذ</span></span>
  <span style="letter-spacing:.04em">سري</span>
  <span style="direction:ltr;unicode-bidi:isolate"><span class="pageNumber"></span> / <span class="totalPages"></span></span>
</div>`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--font-render-hinting=none'],
});
const page = await browser.newPage();
await page.goto(`file://${DIR}/revised.html`, { waitUntil: 'networkidle0' });
await page.evaluate(async () => { await document.fonts.ready; });
await page.pdf({
  path: OUT,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: footer,
  margin: { top: '14mm', bottom: '16mm', left: '15mm', right: '15mm' },
});
await browser.close();
console.log(`Created ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
