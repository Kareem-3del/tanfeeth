import { createRequire } from 'node:module';
import fs from 'node:fs';
const req = createRequire('/Users/kareem.adel.zayed/tanfeth/backend/');
const puppeteer = req('puppeteer');
const OUT = '/Users/kareem.adel.zayed/tanfeth/docs/product/guides/create-competition/shots';
const BASE = 'http://localhost:3002';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 } });
const page = await browser.newPage();
const shot = async (name, opts = {}) => { await sleep(opts.wait ?? 800); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: !!opts.full }); console.log('shot', name); };
const go = async (p) => { await page.goto(BASE + p, { waitUntil: 'networkidle2', timeout: 60000 }); await sleep(500); };
const clickText = async (text, tag = 'button') => {
  const ok = await page.evaluate((text, tag) => {
    const root = document.querySelector('main') || document.body;
    const els = [...root.querySelectorAll(tag + ',a,button,[role=tab],label')];
    const el = els.find((e) => (e.textContent || '').trim().includes(text));
    if (el) { el.click(); return true; } return false;
  }, text, tag);
  if (!ok) console.warn('not found:', text);
  return ok;
};

// 1. login
await go('/auth/login');
await page.type('input[type=email], input[name=email]', 'admin@example.com');
await page.type('input[type=password]', 'secret');
await shot('01-login');
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {}), page.keyboard.press('Enter')]);
await sleep(1500);
await shot('02-dashboard');

// 2. competitions list
await go('/portal/competitions');
await shot('03-competitions-list');

// 3. new competition form
await go('/portal/competitions/new');
await shot('04-new-plan-step');
// choose in plan
await page.evaluate(() => document.querySelector('input[type=radio][value=yes]').click());
await sleep(600);
// open plan select
const selects = await page.$$('input[placeholder]');
for (const s of selects) {
  const ph = await s.evaluate((e) => e.getAttribute('placeholder'));
  if (ph === 'اختر الخطة') { await s.click(); await sleep(600); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(1200); }
}
for (const s of await page.$$('input[placeholder]')) {
  const ph = await s.evaluate((e) => e.getAttribute('placeholder'));
  if (ph === 'اختر المشروع من الخطة') { await s.click(); await sleep(800); await shot('05-new-pick-plan-item-open'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(800); }
}
await shot('06-new-in-plan-filled');
// out of plan variant
await page.evaluate(() => document.querySelector('input[type=radio][value=no]').click());
await sleep(700);
await shot('07-new-out-of-plan');
// back to in plan and save
await page.evaluate(() => document.querySelector('input[type=radio][value=yes]').click());
await sleep(500);
const titleInput = await page.$('input[placeholder="اسم المنافسة كما سيظهر في اعتماد"]');
const cur = await titleInput.evaluate((e) => e.value);
if (!cur) { await titleInput.type('منافسة تجريبية — دليل الاستخدام'); }
await clickText('حفظ ومتابعة');
await page.waitForFunction(() => location.pathname.includes('/tender'), { timeout: 60000 });
await sleep(2500);
const compId = page.url().split('/competitions/')[1].split('/')[0];
console.log('competition', compId);
fs.writeFileSync(`${OUT}/../competition-id.txt`, compId);

// 4. wizard steps 1..7
await shot('08-wizard-step1', { full: true });
for (let s = 2; s <= 7; s++) {
  await clickText('حفظ ومتابعة');
  await sleep(2500);
  await shot(`${String(7 + s).padStart(2, '0')}-wizard-step${s}`, { full: true });
}
// smart fill dialog if present
if (await clickText('التعبئة الذكية')) { await sleep(1000); await shot('15-smart-fill-dialog'); await page.keyboard.press('Escape'); await sleep(500); }

// 5. detail page
await go(`/portal/competitions/${compId}`);
await shot('16-detail-overview', { full: true });
await clickText('كراسة المنافسة', '[role=tab]');
await sleep(1500);
await shot('17-detail-booklet', { full: true });
await clickText('السجل', '[role=tab]');
await sleep(1200);
await shot('18-detail-timeline', { full: true });

await browser.close();
