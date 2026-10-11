#!/usr/bin/env node
/**
 * حساباتٌ تجريبية تمشي دورة الجهة كاملة: الخطة السنوية ← المشروع ← اللجان
 * والترسية ← العقد وتنفيذه — كلُّ خطوةٍ بحسابٍ يملك صلاحيتها وحدها، فيظهر
 * فصلُ المهام كما هو لا مُتجاوَزًا بحساب مسؤولٍ يملك كل شيء.
 *
 *   API=https://staging-api.tanfeeth.io/api EMAIL=admin@example.com PASSWORD=... \
 *   node deploy/seed-demo-users.mjs
 *
 * عبر الـAPI لا قاعدة البيانات: الأدوار تُسند بفحص فصل المهام (409 إن تعارضت)،
 * ومقاعدُ اللجان بفحص النصاب. يُعاد تشغيله بأمان — ما وُجد يُعاد استعماله.
 *
 * كلمةُ المرور: الـAPI يفرض كلمةً قوية (`DEMO_PASSWORD`، افتراضيًا Demo@2026x).
 * ومن أراد كلمةً أبسط للعرض يضبطها بعد الزرع في قاعدة البيانات بنسخ تجزئةٍ
 * معروفة — والسكربت يطبع البريد فقط، لا يكتب في القاعدة.
 */

const API = process.env.API ?? 'http://localhost:3000/api';
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo@2026x';

if (!EMAIL || !PASSWORD) {
  console.error('حدّد EMAIL و PASSWORD لحسابٍ يملك users.manage و roles.manage و departments.manage و committees.manage.');
  process.exit(1);
}

let token = '';

const call = async (method, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status}: ${Array.isArray(data?.message) ? data.message.join('، ') : data?.message ?? res.statusText}`);
    err.status = res.status;
    err.code = data?.code;
    throw err;
  }
  return data;
};

/* ── من يفعل ماذا ───────────────────────────────────────────────────────── */

/**
 * أدوارٌ تجريبية بمفاتيح المنصّة نفسِها.
 *
 * أدوارُ مصفوفة اعتماد المزروعة (مدخل بيانات المنافسة، الموافقات الالكترونية
 * للعقود…) تحمل مفتاحَها `etimad.*` وحده؛ وما يفتحه كلُّ مفتاحٍ من مسارات
 * المنصّة يُحسب في `matrix-implications.ts` — فإن لم يكن ذلك منشورًا على
 * البيئة كان الدورُ اسمًا لا يفتح شيئًا. فلكلّ وظيفةٍ هنا دورٌ بالمفاتيح التي
 * تستلزمها (نسخةُ تلك الخريطة)، ويُضاف بجانب دور المصفوفة لا بدلَه.
 */
const CUSTOM_ROLES = [
  { name: 'تخطيط الخطة — تجريبي', description: 'إعداد بنود الخطة السنوية.', permissionKeys: ['planning.read', 'planning.manage'] },
  { name: 'إدخال المنافسة — تجريبي', description: 'إنشاء المشروع وإعداد الكراسة وتقديمه للاعتماد.', permissionKeys: ['competitions.read', 'competitions.create', 'competitions.update', 'competitions.bid', 'competitions.submit'] },
  { name: 'تدقيق المنافسة — تجريبي', description: 'البت في خطوات سلسلة الاعتماد وجلسة التقييم الفني.', permissionKeys: ['competitions.read', 'competitions.approve'] },
  /* الحفظُ محروسٌ بـ`competitions.update` على مسار بيانات الطرح نفسِه، والقيمةُ لا يكتبها إلا المُسمّى عليها. */
  { name: 'قراءة المنافسات — تجريبي', description: 'الوصول إلى المشروع وحفظ القيمة التقديرية المختومة (مسار بيانات الطرح).', permissionKeys: ['competitions.read', 'competitions.update'] },
  /* مقعدُ اللجنة يمنح مفتاح عملها وحده؛ وأعضاؤها يحتاجون فتح المشروع ليروا ما يوقّعون عليه. */
  { name: 'اطلاع اللجان — تجريبي', description: 'فتح المشروع ولجانه لأعضاء اللجان.', permissionKeys: ['competitions.read', 'committees.read'] },
  /* أعمالُ اللجنة الإجرائية: تسجيل العروض، جلسة الفتح وقائمة تحققها، رصد الأسعار، نقل المراحل. */
  { name: 'أمانة اللجان — تجريبي', description: 'أعمال أمين لجنة فتح العروض الإجرائية.', permissionKeys: ['competitions.read', 'committees.read', 'competitions.committee'] },
  { name: 'الترسية — تجريبي', description: 'اعتماد الترسية وتأكيدها.', permissionKeys: ['competitions.read', 'competitions.award'] },
  { name: 'توقيع العقد — تجريبي', description: 'توقيع العقد باسم الجهة.', permissionKeys: ['contracts.read', 'competitions.read', 'competitions.contract'] },
  {
    name: 'طلبات تنفيذ العقد — تجريبي',
    description: 'تسجيل العقد وجانب الطلب في تنفيذه: الدفعات، أوامر التغيير والإيقاف، شهادة الإنجاز، تقييم المتعاقد، المحتوى المحلي، التعاقد من الباطن، الضمانات البنكية (تسجيل وطلبات).',
    permissionKeys: ['contracts.read', 'contracts.create', 'contracts.update', 'contracts.changeorder.request', 'contracts.suspend.request', 'contracts.certificate.request', 'contracts.certificate.upload', 'contracts.evaluate', 'contracts.localcontent.submit', 'contracts.subcontract.request', 'contracts.guarantee.read', 'contracts.guarantee.manage', 'contracts.guarantee.request', 'files.upload', 'files.read'],
  },
  {
    name: 'اعتمادات تنفيذ العقد — تجريبي',
    description: 'جانب الاعتماد المقابل: سير العقد (المباشرة، الدفعات، الاستلام، الضمان)، الإيقاف وأوامر التغيير، تقييم المتعاقد، المحتوى المحلي، التعاقد من الباطن.',
    permissionKeys: ['contracts.read', 'contracts.workflow', 'contracts.suspend.approve', 'contracts.changeorder.approve', 'contracts.evaluate.approve', 'contracts.localcontent.verify', 'contracts.subcontract.approve', 'contracts.guarantee.read', 'contracts.guarantee.decide', 'contracts.guarantee.correspondence', 'files.read'],
  },
];

/**
 * `roles` بأسمائها كما زُرعت. الإدارةُ واللجانُ تُضبط بعد الإنشاء — موظفُ
 * الإدارة ومديرُها يأخذان صلاحيات الخطة من سجل الإدارات لا من دور.
 */
const USERS = [
  /* ١ — الخطة السنوية */
  { email: 'plan.announcer@example.com', fullName: 'سلمان المخطط', title: 'مسؤول التخطيط', roles: ['معلن الخطة السنوية', 'مسؤول التخطيط', 'تخطيط الخطة — تجريبي'] },
  { email: 'it.employee@example.com', fullName: 'فيصل موظف الإدارة', title: 'أخصائي تقنية معلومات', roles: [], department: 'member' },
  { email: 'it.manager@example.com', fullName: 'هند مديرة الإدارة', title: 'مديرة إدارة تقنية المعلومات', roles: [], department: 'manager' },
  { email: 'plan.reviewer@example.com', fullName: 'تركي مراجع الخطة', title: 'مراجع الميزانية والتخطيط', roles: ['مراجع الخطة السنوية'] },
  { email: 'plan.approver@example.com', fullName: 'عبدالله معتمد الخطة', title: 'وكيل الشؤون المالية', roles: ['معتمد الخطة السنوية'] },

  /* ٢ — المشروع (الطرح) */
  { email: 'tender.entry@example.com', fullName: 'ياسر مدخل المنافسة', title: 'أخصائي مشتريات', roles: ['مدخل بيانات المنافسة', 'إدخال المنافسة — تجريبي'] },
  { email: 'tender.auditor@example.com', fullName: 'منيرة مدققة المنافسة', title: 'مدققة المشتريات', roles: ['مدقق بيانات المنافسة', 'تدقيق المنافسة — تجريبي'] },
  { email: 'estimate.entry@example.com', fullName: 'راشد مدخل القيمة', title: 'محلل تكاليف', roles: ['مدخل القيمة التقديرية', 'قراءة المنافسات — تجريبي'] },

  /* ٣ — اللجان: فتح العروض وفحصها */
  { email: 'open.chair@example.com', fullName: 'سعد رئيس لجنة الفحص', title: 'رئيس لجنة فتح العروض وفحصها', roles: ['اطلاع اللجان — تجريبي'], seat: ['open', 'chair'] },
  { email: 'open.deputy@example.com', fullName: 'مشاعل نائبة لجنة الفحص', title: 'نائبة رئيس لجنة الفحص', roles: ['اطلاع اللجان — تجريبي'], seat: ['open', 'deputy_chair'] },
  { email: 'open.secretary@example.com', fullName: 'وليد أمين لجنة الفحص', title: 'أمين لجنة الفحص', roles: ['اطلاع اللجان — تجريبي', 'أمانة اللجان — تجريبي'], seat: ['open', 'secretary'] },
  { email: 'open.expert@example.com', fullName: 'نواف الخبير الفني', title: 'خبير فني', roles: ['اطلاع اللجان — تجريبي'], seat: ['open', 'technical_expert'] },
  { email: 'open.member@example.com', fullName: 'أمل عضو لجنة الفحص', title: 'عضو لجنة الفحص', roles: ['اطلاع اللجان — تجريبي'], seat: ['open', 'member'] },

  /* ٣ — اللجان: التقييم الفني */
  { email: 'tech.chair@example.com', fullName: 'ماجد رئيس التقييم الفني', title: 'رئيس لجنة التقييم الفني', roles: ['اطلاع اللجان — تجريبي'], seat: ['tech', 'chair'] },
  { email: 'tech.deputy@example.com', fullName: 'غادة نائبة التقييم الفني', title: 'نائبة رئيس لجنة التقييم الفني', roles: ['اطلاع اللجان — تجريبي'], seat: ['tech', 'deputy_chair'] },
  { email: 'tech.secretary@example.com', fullName: 'حسن أمين التقييم الفني', title: 'أمين لجنة التقييم الفني', roles: ['اطلاع اللجان — تجريبي'], seat: ['tech', 'secretary'] },
  { email: 'tech.member@example.com', fullName: 'دانة عضو التقييم الفني', title: 'عضو لجنة التقييم الفني', roles: ['اطلاع اللجان — تجريبي'], seat: ['tech', 'member'] },

  /* ٤ — الترسية والتعاقد */
  { email: 'award.approver@example.com', fullName: 'خالد صاحب الصلاحية', title: 'صاحب صلاحية الترسية', roles: ['اعتماد ترسية المنافسة لصاحب الصلاحية', 'الترسية — تجريبي'] },
  { email: 'contract.signer@example.com', fullName: 'فهد مفوض التوقيع', title: 'مفوض توقيع العقود', roles: ['توقيع مفوض الجهة الحكومية للعقود والتعميدات', 'توقيع العقد — تجريبي'] },

  /* ٥ — تنفيذ العقد */
  { email: 'contract.officer@example.com', fullName: 'ريم مسؤولة العقود', title: 'أخصائية عقود', roles: ['تسجيل وتعديل العقد/التعميد', 'اجراءات العقود (تعديل-انهاء-عقد بديل)', 'طلبات تنفيذ العقد — تجريبي'] },
  { email: 'contract.approver@example.com', fullName: 'بدر معتمد العقود', title: 'مدير إدارة العقود', roles: ['الموافقات الالكترونية للعقود', 'اعتمادات تنفيذ العقد — تجريبي'] },
];

const DEPARTMENT = { code: 'DEMO-IT', name: 'إدارة تقنية المعلومات (تجريبية)', type: 'requesting', email: 'it@example.com' };

const COMMITTEES = {
  open: { name: 'لجنة فتح العروض وفحصها — تجريبية', type: 'bid_examination' },
  tech: { name: 'لجنة التقييم الفني — تجريبية', type: 'technical_evaluation' },
};

/* ── التنفيذ ────────────────────────────────────────────────────────────── */

const findUser = async (email) => (await call('GET', `/users?search=${encodeURIComponent(email)}&pageSize=5`)).items.find((u) => u.email === email);

async function ensureUser(spec) {
  const existing = await findUser(spec.email);
  if (existing) return existing;
  await call('POST', '/users', { email: spec.email, password: DEMO_PASSWORD, fullName: spec.fullName, title: spec.title });
  return findUser(spec.email);
}

async function main() {
  token = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).tokens.accessToken;

  let roles = await call('GET', '/roles');
  for (const custom of CUSTOM_ROLES) {
    const found = roles.find((r) => r.name === custom.name);
    if (!found) {
      await call('POST', '/roles', custom);
      console.log(`+ دور: ${custom.name}`);
    } else {
      /* يُعاد ضبطُ مفاتيحه كلَّ مرة، فتعديلُ القائمة هنا يصل إلى البيئة. */
      await call('POST', `/roles/${found.id}/permissions`, { permissionKeys: custom.permissionKeys });
    }
  }
  roles = await call('GET', '/roles');
  const roleId = (name) => {
    const role = roles.find((r) => r.name === name);
    if (!role) throw new Error(`الدور غير موجود: ${name}`);
    return role.id;
  };

  const ids = {};
  for (const spec of USERS) {
    const user = await ensureUser(spec);
    ids[spec.email] = user.id;
    for (const name of spec.roles) {
      const id = roleId(name);
      if (user.roleIds?.includes(id)) continue;
      try {
        await call('POST', `/users/${user.id}/roles`, { roleId: id });
      } catch (error) {
        console.error(`! ${spec.email} ← ${name}: ${error.message}`);
      }
    }
    console.log(`✓ ${spec.email}`);
  }

  /* الإدارة: المدير بدوره عبر العضوية (يضبط رأس الإدارة)، والموظف عضو. */
  const departments = (await call('GET', '/departments')).items;
  let department = departments.find((d) => d.code === DEPARTMENT.code);
  if (!department) department = await call('POST', '/departments', DEPARTMENT);
  if (department.status === 'archived') await call('PATCH', `/departments/${department.id}/status`, { status: 'active' });
  for (const spec of USERS.filter((u) => u.department)) {
    await call('POST', `/departments/${department.id}/members`, { userId: ids[spec.email], role: spec.department, jobTitle: spec.title, transfer: true });
  }
  console.log(`✓ الإدارة: ${DEPARTMENT.name}`);

  /* اللجان: المقعد يمنح ما ينقصه من صلاحية العمل (`grantMissingPermissions`). */
  const committees = await call('GET', '/committees');
  const list = Array.isArray(committees) ? committees : committees.items;
  for (const [key, spec] of Object.entries(COMMITTEES)) {
    let committee = list.find((c) => c.name === spec.name && c.status !== 'archived');
    if (!committee) committee = await call('POST', '/committees', { ...spec, decisionNumber: `DEMO-${key.toUpperCase()}-2026` });
    const seated = new Set((committee.members ?? []).filter((m) => !m.endedAt && !m.activeTo).map((m) => m.userId));
    for (const user of USERS.filter((u) => u.seat?.[0] === key)) {
      if (seated.has(ids[user.email])) continue;
      try {
        await call('POST', `/committees/${committee.id}/members`, { userId: ids[user.email], role: user.seat[1], jobTitle: user.title, grantMissingPermissions: true });
      } catch (error) {
        console.error(`! مقعد ${user.email}: ${error.message}`);
      }
    }
    console.log(`✓ اللجنة: ${spec.name}`);
  }

  console.log(`\n${USERS.length} حسابًا — كلمة المرور: ${DEMO_PASSWORD}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
