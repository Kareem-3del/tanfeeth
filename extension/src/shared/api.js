// تنفيذ — عميل الـ API المشترك: الجلسة، وتجديد الرمز، والطلبات، وبث المساعد.
//
// الجلسة في chrome.storage.local تحت KEYS.session. سكربتات المحتوى لا تقرؤها
// أبدا — تسأل عامل الخلفية «هل المستخدم مسجل؟» فقط، فالرموز لا تقترب من صفحات
// اعتماد ولا تنفيذ.
//
// تجديد الرمز له مالك واحد: عامل الخلفية. رمز التجديد يدور مع كل استخدام،
// فلو جددت اللوحة والخلفية معا لأبطل أحدهما الآخر وخرج المستخدم. لذلك اللوحة
// تستدعي setRefresher(طلب رسالة إلى الخلفية) والخلفية تجدد مباشرة.

import { DEFAULT_SERVER, KEYS, SERVERS } from "./config.js";

export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || null;
  }
}

const NETWORK_MESSAGE = "تعذر الوصول إلى خادم تنفيذ — تحقق من الاتصال وأعد المحاولة.";

function storageGet(keys) {
  return chrome.storage.local.get(keys);
}

export async function getServerId() {
  const items = await storageGet([KEYS.server]);
  const id = items[KEYS.server];
  return SERVERS[id] ? id : DEFAULT_SERVER;
}

export async function setServerId(id) {
  if (!SERVERS[id]) return;
  await chrome.storage.local.set({ [KEYS.server]: id });
}

export async function getSession() {
  const items = await storageGet([KEYS.session]);
  const s = items[KEYS.session];
  return s && s.accessToken && s.refreshToken && SERVERS[s.serverId] ? s : null;
}

async function saveSession(session) {
  await chrome.storage.local.set({ [KEYS.session]: session });
}

export async function clearSession() {
  await chrome.storage.local.remove(KEYS.session);
}

/** أول اسم من الاسم الكامل، وإلا ما قبل @ في البريد. */
export function firstName(user) {
  if (!user) return "";
  const full = String(user.fullName || "").trim();
  if (full) return full.split(/\s+/)[0];
  return String(user.email || "").split("@")[0];
}

async function readError(res) {
  let body = null;
  try {
    body = await res.json();
  } catch (_e) {
    /* not json */
  }
  const code = body && typeof body.code === "string" ? body.code : null;
  let message = body && body.message;
  if (Array.isArray(message)) message = message.join("، ");
  if (res.status === 401) return new ApiError(401, "انتهت الجلسة — سجل الدخول من جديد.", code);
  if (res.status === 403) return new ApiError(403, "لا تملك الصلاحية لهذا الإجراء.", code);
  if (res.status === 429) return new ApiError(429, "محاولات كثيرة — انتظر دقيقة ثم أعد المحاولة.", code);
  if (res.status >= 500) return new ApiError(res.status, "حدث خطأ في الخادم — أعد المحاولة بعد قليل.", code);
  // رسائل النطاق عربية؛ رسائل التحقق الإنجليزية لا تفيد المستخدم.
  const arabic = typeof message === "string" && /[؀-ۿ]/.test(message);
  return new ApiError(res.status, arabic ? message : "تعذر تنفيذ الطلب.", code);
}

async function rawFetch(url, init) {
  try {
    return await fetch(url, init);
  } catch (err) {
    if (err && err.name === "AbortError") throw err;
    throw new ApiError(0, NETWORK_MESSAGE, "NETWORK");
  }
}

function jsonInit(method, body, token) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = "Bearer " + token;
  return { method, headers, body: body === undefined ? undefined : JSON.stringify(body) };
}

function sessionFrom(serverId, tokens, user) {
  return {
    serverId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    // هامش ٣٠ ثانية حتى لا يصل الرمز منتهيا إلى الخادم.
    expiresAt: Date.now() + Math.max(0, Number(tokens.expiresIn || 0) - 30) * 1000,
    user,
  };
}

async function fetchProfile(api, accessToken) {
  const res = await rawFetch(api + "/auth/me", jsonInit("GET", undefined, accessToken));
  if (!res.ok) throw await readError(res);
  return res.json();
}

/** تسجيل الدخول بحساب تنفيذ ثم جلب الملف والصلاحيات. */
export async function login(serverId, email, password) {
  const server = SERVERS[serverId];
  if (!server) throw new ApiError(0, "خادم غير معروف.");
  const res = await rawFetch(server.api + "/auth/login", jsonInit("POST", { email, password }));
  if (res.status === 401) throw new ApiError(401, "البريد الإلكتروني أو كلمة المرور غير صحيحة.");
  if (!res.ok) throw await readError(res);
  const result = await res.json();
  const user = await fetchProfile(server.api, result.tokens.accessToken);
  const session = sessionFrom(serverId, result.tokens, user);
  await setServerId(serverId);
  await saveSession(session);
  return session;
}

/**
 * يجدد الرمز مباشرة — يستدعيه عامل الخلفية وحده (عبر single-flight).
 * يرجع الجلسة الجديدة، أو null إذا رفض الخادم التجديد (فتمسح الجلسة).
 * خطأ الشبكة يُرمى ولا يخرج المستخدم.
 */
export async function refreshDirect() {
  const session = await getSession();
  if (!session) return null;
  const server = SERVERS[session.serverId];
  const res = await rawFetch(server.api + "/auth/refresh", jsonInit("POST", { refreshToken: session.refreshToken }));
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    // قد تكون جهة أخرى جددت للتو — إن تغير الرمز المخزن فالجلسة سليمة.
    const latest = await getSession();
    if (latest && latest.refreshToken !== session.refreshToken) return latest;
    await clearSession();
    return null;
  }
  if (!res.ok) throw await readError(res);
  const result = await res.json();
  const next = sessionFrom(session.serverId, result.tokens, session.user);
  await saveSession(next);
  return next;
}

let refresher = refreshDirect;
/** اللوحة تمرر هنا دالة تطلب التجديد من عامل الخلفية. */
export function setRefresher(fn) {
  refresher = fn;
}

/** طلب موثق: يجدد الرمز قبل انتهائه، ويعيد المحاولة مرة واحدة بعد 401. */
export async function authFetch(path, init) {
  let session = await getSession();
  if (!session) throw new ApiError(401, "سجل الدخول أولا.", "AUTH_REQUIRED");
  if (Date.now() >= session.expiresAt) {
    session = await refresher();
    if (!session) throw new ApiError(401, "انتهت الجلسة — سجل الدخول من جديد.", "AUTH_REQUIRED");
  }
  const send = function (s) {
    const headers = Object.assign({}, (init && init.headers) || {}, { Authorization: "Bearer " + s.accessToken });
    return rawFetch(SERVERS[s.serverId].api + path, Object.assign({}, init, { headers }));
  };
  let res = await send(session);
  if (res.status === 401) {
    session = await refresher();
    if (!session) throw new ApiError(401, "انتهت الجلسة — سجل الدخول من جديد.", "AUTH_REQUIRED");
    res = await send(session);
  }
  return res;
}

export async function apiGet(path, signal) {
  const res = await authFetch(path, { method: "GET", headers: { Accept: "application/json" }, signal });
  if (!res.ok) throw await readError(res);
  return res.json();
}

/** يحدث الملف والصلاحيات المخزنة (الاسم قد يتغير من البوابة). */
export async function refreshProfile() {
  const user = await apiGet("/auth/me");
  const session = await getSession();
  if (session) await saveSession(Object.assign({}, session, { user }));
  return user;
}

/** تسجيل الخروج: يبطل رمز التجديد على الخادم (بأفضل جهد) ثم يمسح الجلسة. */
export async function logout() {
  const session = await getSession();
  if (session) {
    try {
      await authFetch("/auth/logout", jsonInit("POST", { refreshToken: session.refreshToken }));
    } catch (_e) {
      /* الخروج المحلي يكفي */
    }
  }
  await clearSession();
}

/**
 * يبث جواب مساعد تنفيذ (POST /assistant/stream — SSE: delta ثم done أو error).
 * يرجع نص الجواب كاملا.
 */
export async function streamAssistant(body, hooks) {
  const res = await authFetch("/assistant/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal: hooks.signal,
  });
  if (!res.ok) throw await readError(res);
  if (!res.body) throw new ApiError(0, "المتصفح لا يدعم البث.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let answer = "";

  const handle = function (block) {
    let event = "message";
    const data = [];
    block.split("\n").forEach(function (line) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    });
    if (!data.length) return; // تعليق نبض
    let payload;
    try {
      payload = JSON.parse(data.join("\n"));
    } catch (_e) {
      return;
    }
    if (event === "delta" && payload && typeof payload.text === "string") {
      answer += payload.text;
      hooks.onDelta(payload.text, answer);
    } else if (event === "done" && payload && typeof payload.answer === "string") {
      answer = payload.answer;
    } else if (event === "error") {
      throw new ApiError(502, (payload && payload.message) || "تعذر الوصول إلى المساعد الآن.");
    }
  };

  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, "\n");
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      handle(block);
    }
  }
  if (buffer.trim()) handle(buffer);
  return answer;
}

/** حمولة تعبئة اعتماد لمشروع — بنفس شكل ما يرسله تطبيق تنفيذ عبر postMessage. */
export async function fetchFillRecord(competitionId, calendarHints) {
  const fill = await apiGet("/competitions/" + encodeURIComponent(competitionId) + "/etimad-fill-payload");
  const etimadFields = Object.assign({}, fill.etimadFields);
  Object.keys(calendarHints).forEach(function (ourKey) {
    const v = fill.payload && fill.payload[ourKey];
    if (v === "هجري" || v === "ميلادي") etimadFields[calendarHints[ourKey]] = v;
  });
  return {
    payload: { etimadFields, raw: fill.payload },
    meta: { competitionId: fill.competitionId, title: fill.title, source: "extension" },
    savedAt: Date.now(),
  };
}
