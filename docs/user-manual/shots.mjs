/**
 * يلتقط صور الشاشة لأماكن <figure class="shot"> في الفصول من البيئة التجريبية.
 *
 *   MANUAL_EMAIL=… MANUAL_PASSWORD=… node docs/user-manual/shots.mjs            # كل الصور الناقصة
 *   node docs/user-manual/shots.mjs ch-03      # فصل واحد (يعيد التقاطه)
 *
 * المسارات ذات المعرّف (:id) تُحلّ من shots/ids.json، وما يحتاج ضبطًا يدويًا
 * (تبويب أو زر أو مسار مختلف) يوضع في shots/overrides.json بمفتاح «ch-03#2».
 * الصفحة تقرأ بيانات تجريبية، فتُنظَّف أسماء السجلات التجريبية في الردود قبل العرض.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "/Users/kareem.adel.zayed/tanfeth/backend/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js";

const DIR = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(DIR, "shots");
mkdirSync(SHOTS, { recursive: true });
const BASE = "https://demo.tanfeeth.io";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const only = process.argv[2];

const read = (f, d) => (existsSync(join(SHOTS, f)) ? JSON.parse(readFileSync(join(SHOTS, f), "utf8")) : d);
const ids = read("ids.json", {});
const overrides = read("overrides.json", {});
const manifest = {};
for (const f of readdirSync(SHOTS).filter((x) => /^manifest.*\.json$/.test(x))) Object.assign(manifest, read(f, {}));
const mine = {};
const MF = `manifest-${only || "all"}.json`;
const titles = read("titles.json", {});

/* ---------- أماكن الصور ---------- */
const attr = (tag, name) => (tag.match(new RegExp(`${name}="([^"]*)"`)) || [])[1];
const figures = [];
for (const f of readdirSync(join(DIR, "chapters")).filter((x) => x.endsWith(".html")).sort()) {
  const html = readFileSync(join(DIR, "chapters", f), "utf8");
  const ch = (html.match(/<section class="chapter" id="([^"]+)"/) || [])[1];
  let i = 0;
  for (const m of html.matchAll(/<figure class="shot"[^>]*>/g)) {
    const tag = m[0];
    figures.push({ key: `${ch}#${i++}`, ch, route: attr(tag, "data-route"), tab: attr(tag, "data-tab"), action: attr(tag, "data-action"), state: attr(tag, "data-state"), caption: attr(tag, "data-caption") });
  }
}
if (process.argv.includes("--list")) {
  for (const f of figures) console.log([f.key, f.route, f.tab && `tab=${f.tab}`, f.action && `action=${f.action}`, f.state && `state=${f.state}`, f.caption].filter(Boolean).join(" | "));
  process.exit(0);
}

/* ---------- تنظيف البيانات التجريبية ---------- */
const JUNK = /(تست|للحذف|QA-TEST|\(مؤقت\)|invalid|^test|^\d{6,}$|ناقد الشكل|technical_evaluat|xxxx|اختبار|تجربة|«أكمِل|للتجربة|^[شسيظبلاتنمك]+$)/i;
const PREFIX = /^(?:[٠-٩0-9]+\s*·\s*[^·]+·\s*|(?:اختبار|تجربة|تجريبي)[^—–]*[—–]\s*)+/;
const SUFFIX = /\s*[—–-]\s*تجريبي\s*[0-9٠-٩]+\s*$/;
const scrub = (x) => x.replace(/\s*[(（](?:متنافس )?تجريبي(?:ة)?[)）]/g, "").replace(/\s*[—–]\s*تجريبي(?:ة)?\s*$/g, "").replace(/\s*\((?:services|supplies|works)\)/g, "");
const NAMEKEY = /^(title|name|projectTitle|competitionTitle|contractName|competitionName|subject)$/;
const label = (x) => (x && typeof x === "object" ? String(x.title ?? x.name ?? x.fullName ?? "") : "");
function clean(v) {
  if (Array.isArray(v)) {
    const out = v.map(clean);
    const kept = out.filter((x) => !JUNK.test(label(x)));
    return kept.length >= Math.min(3, out.length) ? kept : out;
  }
  if (v && typeof v === "object") {
    const o = {};
    const renamed = titles[v.id];
    for (const [k, x] of Object.entries(v)) {
      if (renamed && /^(title|name)$/.test(k)) { o[k] = renamed; continue; }
      if (x === "kareem") o[k] = "عبدالله القحطاني";
      else if (typeof x === "string") o[k] = scrub(NAMEKEY.test(k) ? x.replace(PREFIX, "").replace(SUFFIX, "") : x);
      else o[k] = clean(x);
    }
    return o;
  }
  return v;
}

/* ---------- الالتقاط ---------- */
const { MANUAL_EMAIL: email, MANUAL_PASSWORD: password } = process.env;
if (!email || !password) throw new Error("ضع MANUAL_EMAIL وMANUAL_PASSWORD لحساب يرى كل الصفحات في البيئة التجريبية");
const login = await (await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).json();
const session = JSON.stringify({ state: { accessToken: login.tokens.accessToken, refreshToken: login.tokens.refreshToken, user: login.user }, version: 0 });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--lang=ar"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
await page.setRequestInterception(true);
page.on("request", async (req) => {
  if (!req.url().startsWith(`${BASE}/api/`) || req.method() !== "GET") return req.continue();
  try {
    const res = await fetch(req.url(), { headers: req.headers() });
    const type = res.headers.get("content-type") || "";
    if (!type.includes("json")) return req.respond({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
    const body = JSON.stringify(clean(await res.json()));
    req.respond({ status: res.status, contentType: "application/json", body });
  } catch {
    req.continue();
  }
});

await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded" });
await page.evaluate((s) => localStorage.setItem("tanfeeth-auth", s), session);

const settle = async (ms = 1500) => {
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 7000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, ms));
};
/** يخفي ما يخص وضع العرض التجريبي وحده، فلا يظهر في الدليل ما لا يراه موظف الجهة. */
const tidy = () => page.evaluate(() => {
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const hide = (e) => e && (e.style.visibility = "hidden");
  for (const el of document.querySelectorAll("p, span, div")) {
    if (el.children.length === 0 && norm(el.textContent).startsWith("وضع العرض:")) {
      let a = el;
      while (a.parentElement && ![...a.querySelectorAll("button")].some((b) => norm(b.innerText).includes("أكمِل الخطوة"))) a = a.parentElement;
      if (a !== document.body) a.style.display = "none";
    }
  }
  for (const b of document.querySelectorAll("button, a, li, [role=\"menuitem\"]")) {
    const t = norm(b.innerText) + " " + (b.getAttribute("aria-label") || "");
    if (/وضع العرض|أكمِل الخطوة|تبديل الحساب \(عرض\)/.test(t)) b.style.display = "none";
    if (b.querySelector("svg.lucide-palette") && getComputedStyle(b).position === "fixed") hide(b);
  }
});

async function clickText(text) {
  const handle = await page.evaluateHandle((text) => {
    const norm = (s) => s.replace(/\s+/g, " ").trim();
    const els = [...document.querySelectorAll('button, [role="tab"], [role="button"], a, [role="menuitem"], li')].filter((e) => e.offsetParent !== null && !e.closest("nav[aria-label=\"التنقل الرئيسي\"]"));
    const lab = (e) => norm(e.innerText || "") || norm(e.getAttribute("aria-label") || "");
    return els.find((e) => lab(e) === text) || els.find((e) => norm(e.getAttribute("aria-label") || "") === text) || els.find((e) => lab(e).includes(text)) || null;
  }, text);
  const el = handle.asElement();
  if (!el) return false;
  await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await el.click();
  return true;
}

const todo = figures.filter((f) => (only ? f.ch === only || f.key === only : !manifest[f.key]));
for (const f of todo) {
  const o = overrides[f.key] || {};
  if (o.skip || (!o.url && (!f.route || f.route.startsWith("extension:")))) { console.log("skip", f.key, f.route); continue; }
  let url = o.url || f.route;
  const KIND = [["/portal/suppliers/", "supplierId"], ["/portal/contractors/", "contractorId"], ["/portal/catalog/", "itemId"], ["/portal/plan/", "planId"], ["/portal/contracts/", "contractId"], ["/portal/organization/users/", "userId"], ["/portal/organization/departments/", "departmentId"], ["/portal/organization/roles/", "roleId"], ["/portal/guarantees/", "guaranteeContractId"], ["/portal/competitions/", "competitionId"]];
  const kind = (KIND.find(([pre]) => url.startsWith(pre)) || [])[1];
  url = url.replace(/:([a-zA-Z]+)/g, (_, k) => (k === "id" && kind ? ids[kind] : ids[k]) || `:${k}`);
  if (url.includes(":")) { console.log("no id", f.key, url); continue; }
  try {
    if (o.viewport) await page.setViewport({ ...o.viewport, deviceScaleFactor: o.viewport.deviceScaleFactor ?? 1.5 });
    await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await settle(o.wait ?? 1800);
    let missed = false;
    for (const step of o.clicks || [f.tab, f.action].filter(Boolean)) {
      const ok = await clickText(step);
      if (!ok) { console.log("  missing click", f.key, step); missed = true; break; }
      await settle(1200);
    }
    if (missed && !o.allowMiss) { console.log("drop", f.key); continue; }
    if (o.scroll) await page.evaluate((y) => window.scrollTo(0, y), o.scroll);
    if (o.scrollTo) await page.evaluate((t) => { const e = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,p,span,div")].find((x) => x.children.length === 0 && x.textContent.trim() === t); e?.scrollIntoView({ block: "start" }); window.scrollBy(0, -90); }, o.scrollTo);
    await tidy();
    await new Promise((r) => setTimeout(r, 400));
    const file = `${f.key.replace("#", "-")}.jpg`;
    await page.screenshot({ path: join(SHOTS, file), type: "jpeg", quality: 82 });
    manifest[f.key] = mine[f.key] = { file: `shots/${file}`, url, narrow: Boolean(o.narrow) };
    console.log("ok", f.key, url, f.tab || f.action || "");
    if (o.viewport) await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
    await page.keyboard.press("Escape").catch(() => {});
  } catch (e) {
    console.log("fail", f.key, url, e.message);
  }
  writeFileSync(join(SHOTS, MF), JSON.stringify({ ...read(MF, {}), ...mine }, null, 1));
}
await browser.close();
