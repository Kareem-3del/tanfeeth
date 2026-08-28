import { createRequire } from 'node:module';
import fs from 'node:fs';
const req = createRequire('/Users/kareem.adel.zayed/tanfeth/backend/');
const puppeteer = req('puppeteer');
const OUT = '/Users/kareem.adel.zayed/tanfeth/docs/product/guides/create-competition/shots';
const BASE = 'http://localhost:3002';
const id = fs.readFileSync(`${OUT}/../competition-id.txt`, 'utf8').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 } });
const page = await browser.newPage();
const shot = async (n, full) => { await sleep(900); await page.screenshot({ path: `${OUT}/${n}.png`, fullPage: !!full }); console.log('shot', n); };
const go = async (p) => { await page.goto(BASE + p, { waitUntil: 'networkidle2', timeout: 60000 }); await sleep(800); };
const clickText = (text) => page.evaluate((text) => { const root = document.querySelector('main') || document.body; const el = [...root.querySelectorAll('button,a,[role=tab]')].find((e) => (e.textContent || '').trim().includes(text)); if (el) { el.click(); return true; } return false; }, text);

await go('/auth/login');
await page.type('input[type=email], input[name=email]', 'admin@example.com');
await page.type('input[type=password]', 'secret');
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {}), page.keyboard.press('Enter')]);
await sleep(1500);

await go(`/portal/competitions/${id}/tender`);
console.log('smartfill', await clickText('تعبئة ذكية')); await shot('15-smart-fill-dialog');
await page.keyboard.press('Escape'); await sleep(600);
console.log('review', await clickText('المراجعة والتحقق')); await shot('15b-review-panel');
await page.keyboard.press('Escape'); await sleep(600);

await go(`/portal/competitions/${id}`);
console.log('submit', await clickText('رفع للاعتماد')); await shot('19-submit-for-approval');
await browser.close();
