/**
 * أدوات مشتركة لسيناريو العرض: نداء الـAPI بحساب أي مستخدم تجريبي، وجلسة لكل
 * حساب تُفتح مرة واحدة، وانتظارٌ عند تقييد الدخول (429)، ومُشغّل خطوات يتوقف
 * قبل كل خطوة في وضع العرض.
 *
 * الحسابات من `deploy/seed-demo-users.mjs` — كلها `@example.com`.
 */

import readline from 'node:readline/promises';

export const API = process.env.API ?? 'https://staging-api.tanfeeth.io/api';
export const PASSWORD = process.env.DEMO_PASSWORD ?? 'secret';
/** `--auto` يمضي بلا توقف (للاختبار)؛ بدونها ينتظر Enter قبل كل خطوة (للعرض). */
export const AUTO = process.argv.includes('--auto');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sessions = new Map();

/** `who` = الجزء قبل @ (مثل `tender.entry`)، أو بريد كامل. */
const emailOf = (who) => (who.includes('@') ? who : `${who}@example.com`);

async function raw(method, path, body, token) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 429 && attempt < 12) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 15_000;
      console.log(`   … تقييد الطلبات، انتظار ${Math.round(wait / 1000)} ث`);
      await sleep(wait);
      continue;
    }
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const msg = Array.isArray(data?.message) ? data.message.join('، ') : data?.message ?? res.statusText;
      const err = new Error(`${method} ${path} → ${res.status}${data?.code ? ` ${data.code}` : ''}: ${msg}`);
      err.status = res.status;
      err.code = data?.code;
      err.data = data;
      throw err;
    }
    return data;
  }
}

/** جلسةُ الحساب — تُفتح مرة وتُعاد (الدخول مقيّد العدد). */
export async function session(who) {
  const email = emailOf(who);
  if (!sessions.has(email)) {
    const res = await raw('POST', '/auth/login', { email, password: PASSWORD });
    sessions.set(email, { token: res.tokens.accessToken, user: res.user });
  }
  return sessions.get(email);
}

/** نداءٌ باسم مستخدم: `await as('tender.entry').post('/competitions', {...})`. */
export function as(who) {
  const go = async (method, path, body) => raw(method, path, body, (await session(who)).token);
  return {
    get: (path) => go('GET', path),
    post: (path, body) => go('POST', path, body ?? {}),
    patch: (path, body) => go('PATCH', path, body ?? {}),
    put: (path, body) => go('PUT', path, body ?? {}),
    del: (path) => go('DELETE', path),
    user: async () => (await session(who)).user,
  };
}

/** معرّف المستخدم التجريبي. */
export const userId = async (who) => (await session(who)).user.id;

let rl = null;
let index = 0;

/**
 * خطوةٌ في السيناريو: من يفعل، وماذا يفعل، وأين يُرى على الشاشة.
 * في وضع العرض يطبعها وينتظر Enter ثم ينفّذ؛ في `--auto` ينفّذ مباشرة.
 * ترجع نتيجة `run` ليبني عليها ما بعدها.
 */
export async function step({ who, title, screen }, run) {
  index += 1;
  console.log(`\n── ${index}. ${title}`);
  console.log(`   الحساب: ${emailOf(who)}${screen ? `   ·   الشاشة: ${screen}` : ''}`);
  if (!AUTO) {
    rl ??= readline.createInterface({ input: process.stdin, output: process.stdout });
    await rl.question('   [Enter] للتنفيذ ');
  }
  const started = Date.now();
  const result = await run();
  console.log(`   ✓ تم (${((Date.now() - started) / 1000).toFixed(1)} ث)`);
  return result;
}

export function done() {
  rl?.close();
}

/** اسمٌ فريد لكل تشغيل حتى لا يتصادم مع تشغيلٍ سابق. */
export const RUN = new Date().toISOString().slice(5, 16).replace(/[-T:]/g, '');

export const iso = (d) => d.toISOString().slice(0, 10);
export const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};
