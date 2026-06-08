// Fetch Tajawal from Google Fonts and inline every face as a base64 data URI so the
// PDF renders identically with zero network dependency at print time.
import fs from 'node:fs';
import path from 'node:path';

const OUT = '/Users/kareem.adel.zayed/tanfeth/docs/product/deliverable';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const cssUrl =
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap';

const css = await (await fetch(cssUrl, { headers: { 'User-Agent': UA } })).text();
const urls = [
  ...new Set(
    [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/g)].map((m) => m[1]),
  ),
];

let out = css;
for (const u of urls) {
  const buf = Buffer.from(await (await fetch(u)).arrayBuffer());
  out = out.split(u).join(`data:font/woff2;base64,${buf.toString('base64')}`);
}

fs.writeFileSync(path.join(OUT, 'fonts.css'), out);
console.log(
  'fonts.css written · faces:',
  (out.match(/@font-face/g) || []).length,
  '· embedded woff2:',
  urls.length,
);
