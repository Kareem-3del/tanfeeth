#!/usr/bin/env node
/**
 * «إدارتي» بسيناريو كامل: admin@example.com مديرٌ لإدارة العقود التجريبية.
 *
 *   API=https://staging-api.tanfeeth.io/api EMAIL=admin@example.com PASSWORD=... \
 *   node deploy/seed-demo-department-workspace.mjs
 *
 * ما يُزرع (عبر الـAPI، يُعاد تشغيله بأمان — ما وُجد يُعاد استعماله):
 *  - «إدارة العقود — تجريبية» (DEMO-CDM، نوع contracts_cdm) وفرعها
 *    «قسم متابعة الضمانات — تجريبي» (DEMO-CDM-GRT).
 *  - المدير: حساب EMAIL نفسه؛ نائب وثلاثة موظفين وموظف في الفرع (@example.com،
 *    فيُبدَّل إليهم من مبدّل العرض التجريبي).
 *  - مهامٌ يسندها المدير من «إدارتي» نفسها (POST /department-workspace/:id/tasks):
 *    متأخرة، وقيد التنفيذ، ومنجزة هذا الشهر — لكل موظفٍ حملٌ مختلف.
 *  - مؤشرات: مؤشر للإدارة ومؤشرٌ لكل موظف بقراءات شهرية من يونيو، يُدخلها
 *    صاحبها ويتحقق منها المدير (فصل المهام)، بنتائج متفاوتة (أخضر/أصفر/أحمر).
 *  - أربعة بنود يقدّمها الموظفون في خطةٍ معلنة نافذتها مفتوحة: اثنان ينتظران
 *    قرار المدير، وواحد معتمد، وواحد مردود بسببه.
 *
 * العقود لا تُزرع: إدارة العقود ترى عقود الجهة كلها كما هي على البيئة.
 */

const API = process.env.API ?? 'http://localhost:3000/api';
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo@2026x';

if (!EMAIL || !PASSWORD) {
  console.error('حدّد EMAIL و PASSWORD لحسابٍ يملك users.manage و departments.manage و tasks.manage.');
  process.exit(1);
}

const tokens = new Map();
let as = EMAIL;

const call = async (method, path, body, who = as) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.get(who)}` },
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
    throw err;
  }
  return data;
};

/* The API throttles logins per address; a seed logs in as each employee, so it waits its turn. */
const login = async (email, password) => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (res.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 15_000));
      continue;
    }
    if (!res.ok) throw new Error(`login ${email} → ${res.status}`);
    const data = await res.json();
    tokens.set(email, data.tokens.accessToken);
    return data.user;
  }
  throw new Error(`login ${email} → 429 بعد الانتظار`);
};

const day = (offset) => {
  const d = new Date(Date.now() + offset * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(d);
};

/* ── الفريق ─────────────────────────────────────────────────────────────── */

const ROOT = { code: 'DEMO-CDM', name: 'إدارة العقود — تجريبية', type: 'contracts_cdm', email: 'contracts@example.com', notes: 'إدارة تجريبية لعرض «إدارتي»: يديرها حساب المسؤول التجريبي.' };
const BRANCH = { code: 'DEMO-CDM-GRT', name: 'قسم متابعة الضمانات — تجريبي', type: 'contracts_cdm' };

const TEAM = [
  { email: 'cdm.deputy@example.com', fullName: 'عبدالله الحربي', title: 'نائب مدير إدارة العقود', role: 'deputy', at: 'root' },
  { email: 'cdm.sara@example.com', fullName: 'سارة العتيبي', title: 'أخصائية عقود', role: 'member', at: 'root' },
  { email: 'cdm.fahad@example.com', fullName: 'فهد القحطاني', title: 'مهندس متابعة تنفيذ', role: 'member', at: 'root' },
  { email: 'cdm.noura@example.com', fullName: 'نورة الشهري', title: 'محللة عقود', role: 'member', at: 'root' },
  { email: 'cdm.majed@example.com', fullName: 'ماجد الدوسري', title: 'مراقب ضمانات بنكية', role: 'manager', at: 'branch' },
];

/* What each one is carrying: [title, dueOffsetDays, status]. Negative = overdue. */
const TASKS = {
  'cdm.deputy@example.com': [
    ['مراجعة مسودة عقد صيانة المباني قبل التوقيع', 3, 'IN_PROGRESS'],
    ['اعتماد جدول الكميات المعدّل لعقد التشغيل', -2, 'TODO'],
    ['إعداد تقرير العقود المنتهية خلال الربع', -20, 'DONE'],
  ],
  'cdm.sara@example.com': [
    ['متابعة تمديد الضمان النهائي لعقد توريد الأجهزة', -6, 'TODO'],
    ['إعداد خطاب المباشرة لعقد خدمات النظافة', -3, 'IN_PROGRESS'],
    ['تحديث نسبة الإنجاز في عقود الربع الرابع', 5, 'TODO'],
    ['مطابقة مستخلص المرحلة الثانية مع جدول الكميات', 9, 'TODO'],
    ['رفع شهادة الإنجاز لعقد صيانة المصاعد', -12, 'DONE'],
  ],
  'cdm.fahad@example.com': [
    ['زيارة موقع مشروع المبنى الإداري وتوثيق نسبة الإنجاز', 2, 'IN_PROGRESS'],
    ['محضر الاستلام الابتدائي لعقد التكييف', 7, 'TODO'],
    ['تقرير غرامات التأخير لعقد الطرق', -15, 'DONE'],
    ['متابعة إغلاق ملاحظات الاستلام', -25, 'DONE'],
  ],
  'cdm.noura@example.com': [
    ['تحليل أوامر التغيير المقترحة على عقد التشغيل', -9, 'TODO'],
    ['مراجعة نسبة المحتوى المحلي في تقارير المتعاقدين', -4, 'TODO'],
    ['إعداد ملخص العقود المتعثرة لاجتماع الإدارة', 1, 'IN_PROGRESS'],
  ],
  'cdm.majed@example.com': [
    ['تنبيه البنوك بالضمانات المنتهية خلال ٣٠ يومًا', 4, 'IN_PROGRESS'],
    ['الإفراج عن الضمان الابتدائي للعروض غير الفائزة', -1, 'TODO'],
    ['جرد خطابات الضمان المستلمة هذا الشهر', -8, 'DONE'],
  ],
};

/* Monthly readings June→October: [A achieved, B total] — so the scores differ. */
const MONTHS = ['06', '07', '08', '09', '10'];
const YEAR = new Date().getUTCFullYear();
const EMPLOYEE_KPI = {
  'cdm.deputy@example.com': { name: 'اعتماد مسودات العقود خلال ٥ أيام عمل', target: 90, values: [[9, 10], [8, 9], [10, 11], [9, 10], [11, 12]] },
  'cdm.sara@example.com': { name: 'تحديث بيانات العقود في موعدها', target: 95, values: [[18, 20], [17, 20], [19, 22], [20, 21], [21, 22]] },
  'cdm.fahad@example.com': { name: 'زيارات المتابعة الميدانية المنفّذة من المخطط', target: 90, values: [[6, 8], [5, 8], [6, 8], [7, 9], [6, 8]] },
  'cdm.noura@example.com': { name: 'تقارير التحليل المسلّمة في موعدها', target: 90, values: [[3, 6], [4, 6], [3, 5], [4, 7], [3, 6]] },
  'cdm.majed@example.com': { name: 'تنبيه الضمانات قبل انتهائها بـ٣٠ يومًا', target: 100, values: [[12, 12], [10, 11], [14, 14], [13, 13], [15, 15]] },
};

async function main() {
  const me = await login(EMAIL, PASSWORD);
  console.log(`• المدير: ${EMAIL}`);

  /* People — reuse by email. */
  const people = new Map((await call('GET', '/departments/assignable-users')).items.map((u) => [u.email.toLowerCase(), u]));
  const ids = {};
  for (const spec of TEAM) {
    let user = people.get(spec.email);
    if (!user) {
      const created = await call('POST', '/users', { email: spec.email, password: DEMO_PASSWORD, fullName: spec.fullName, title: spec.title });
      user = { id: created.id, email: spec.email };
      console.log(`  + ${spec.fullName} <${spec.email}>`);
    }
    ids[spec.email] = user.id;
  }

  /* Departments — the root under the manager, the branch under it. */
  const all = (await call('GET', '/departments')).items;
  const ensure = async (spec, parentId) => {
    let dept = all.find((d) => d.code === spec.code);
    if (!dept) dept = await call('POST', '/departments', { ...spec, parentId });
    if (dept.status === 'archived') await call('PATCH', `/departments/${dept.id}/status`, { status: 'active' });
    return dept;
  };
  const root = await ensure(ROOT, null);
  const branch = await ensure(BRANCH, root.id);
  const place = { root: root.id, branch: branch.id };

  const join = async (departmentId, userId, role, jobTitle) => {
    try {
      await call('POST', `/departments/${departmentId}/members`, { userId, role, jobTitle, transfer: true });
    } catch (error) {
      console.log(`  ! ${jobTitle}: ${error.message}`);
    }
  };
  await join(root.id, me.id, 'manager', 'مدير إدارة العقود');
  for (const spec of TEAM) await join(place[spec.at], ids[spec.email], spec.role, spec.title);
  console.log(`• ${ROOT.name} ← ${BRANCH.name}: الفريق ${TEAM.length + 1}`);

  /* Tasks — handed out from «إدارتي» itself; skip titles already there. */
  const workspace = await call('GET', `/department-workspace/${root.id}`);
  const open = new Set((workspace.tasks ?? []).map((t) => `${t.assigneeId}:${t.title}`));
  /* A finished task is no longer «open»: look each title up so a re-run does not hand it out twice. */
  const exists = async (assigneeId, title) => {
    const found = await call('GET', `/tasks?search=${encodeURIComponent(title)}&pageSize=100`).catch(() => ({ items: [] }));
    return (found.items ?? []).some((t) => t.title === title && (t.assignee?.id ?? t.assigneeId) === assigneeId);
  };
  let made = 0;
  for (const [email, list] of Object.entries(TASKS)) {
    for (const [title, offset, status] of list) {
      const key = `${ids[email]}:${title}`;
      if (open.has(key) || (await exists(ids[email], title))) continue;
      const { id } = await call('POST', `/department-workspace/${root.id}/tasks`, { assigneeId: ids[email], title, dueDate: day(offset), description: 'مهمة تجريبية لعرض «إدارتي».' });
      if (status === 'IN_PROGRESS') await call('PATCH', `/tasks/${id}/status`, { status: 'IN_PROGRESS' });
      if (status === 'DONE') {
        await call('PATCH', `/tasks/${id}/status`, { status: 'IN_PROGRESS' }).catch(() => {});
        await call('PATCH', `/tasks/${id}/status`, { status: 'DONE' }).catch((error) => console.log(`  ! ${title}: ${error.message}`));
      }
      made += 1;
    }
  }
  console.log(`• المهام: +${made}`);

  /* KPIs — department + one per employee; readings by the reporter, verified by the manager. */
  /* Both the department and its branch: an employee KPI sits in the employee's own department. */
  const existing = [];
  for (const departmentId of [root.id, branch.id]) {
    existing.push(...((await call('GET', `/kpis?scope=department&departmentId=${departmentId}&includeEmployees=true`)).items ?? []));
  }
  const byName = new Map(existing.map((k) => [k.name, k]));
  const kpi = async (spec) => {
    if (byName.has(spec.name)) return byName.get(spec.name);
    return call('POST', '/kpis', {
      unit: 'percent',
      direction: 'up',
      formula: 'A / B * 100',
      variables: [
        { key: 'A', label: spec.a, source: 'manual' },
        { key: 'B', label: spec.b, source: 'manual' },
      ],
      frequency: 'monthly',
      startDate: `${YEAR}-06-01`,
      entryWindowDays: 10,
      weight: spec.weight ?? 1,
      ownerUserId: me.id,
      departmentId: root.id,
      ...spec.fields,
      name: spec.name,
      target: spec.target,
    });
  };
  const readings = async (record, values, reporterEmail) => {
    for (const [i, month] of MONTHS.entries()) {
      const period = `${YEAR}-${month}`;
      try {
        await call('PUT', `/kpis/${record.id}/readings/${period}`, { values: { A: values[i][0], B: values[i][1] } }, reporterEmail);
      } catch (error) {
        if (error.status !== 409) console.log(`  ! ${record.name} ${period}: ${error.message}`);
      }
      await call('POST', `/kpis/${record.id}/readings/${period}/verify`, undefined, EMAIL).catch(() => {});
    }
  };

  await login('cdm.deputy@example.com', DEMO_PASSWORD).catch(() => console.log('  ! تعذّر دخول النائب بكلمة DEMO_PASSWORD'));
  const deptKpi = await kpi({
    name: 'العقود المحدّثة في موعدها',
    a: 'عقود حُدّثت بياناتها في موعدها',
    b: 'العقود القائمة',
    target: 90,
    weight: 2,
    fields: { level: 'department', visibility: 'department', reporterUserId: ids['cdm.deputy@example.com'] },
  });
  await readings(deptKpi, [[41, 48], [44, 50], [45, 49], [47, 51], [48, 52]], 'cdm.deputy@example.com');

  for (const [email, spec] of Object.entries(EMPLOYEE_KPI)) {
    await login(email, DEMO_PASSWORD).catch(() => console.log(`  ! تعذّر دخول ${email}`));
    const member = TEAM.find((t) => t.email === email);
    const record = await kpi({
      name: spec.name,
      a: 'المنجز',
      b: 'المطلوب',
      target: spec.target,
      fields: { level: 'employee', visibility: 'restricted', subjectUserId: ids[email], reporterUserId: ids[email], departmentId: place[member.at] },
    });
    await readings(record, spec.values, email);
  }
  console.log('• المؤشرات: مؤشر الإدارة + مؤشر لكل موظف بقراءات يونيو–أكتوبر');

  /*
   * Plan lines — the real flow (FR-PL-005…007): employees submit their
   * department's lines in an announced plan's window, the manager decides.
   * Two stay waiting («تنتظر قرارك»), one approved, one returned with a reason.
   */
  const LINES = [
    ['cdm.sara@example.com', 'تجديد عقد الصيانة الشاملة لمباني الجهة', 4_200_000, 1, null],
    ['cdm.fahad@example.com', 'عقد إشراف هندسي على مشاريع الإنشاءات', 2_750_000, 2, null],
    ['cdm.noura@example.com', 'عقد إطاري لخدمات النظافة للفروع', 1_850_000, 2, true],
    ['cdm.deputy@example.com', 'استشارات قانونية لصياغة العقود النموذجية', 600_000, 3, false],
  ];
  try {
    const plans = (await call('GET', '/annual-plans')).items ?? [];
    let placed = null;
    for (const plan of plans.filter((p) => p.status === 'announced').sort((a, b) => a.year - b.year)) {
      const listed = (await call('GET', `/annual-plans/${plan.id}/submissions`)).items ?? [];
      try {
        for (const [email, title, budget, quarter, decision] of LINES) {
          let line = listed.find((item) => item.title === title);
          if (!line) {
            line = await call('POST', `/annual-plans/${plan.id}/submissions`, { title, estimatedBudget: budget, expectedQuarter: quarter, planYear: plan.year, description: 'بند تجريبي من إدارة العقود.' }, email);
            await call('POST', `/annual-plans/${plan.id}/submissions/${line.id}/submit`, undefined, email);
            if (decision !== null) {
              await call('POST', `/annual-plans/${plan.id}/submissions/${line.id}/decide`, decision ? { approved: true } : { approved: false, reason: 'أعد تقدير الميزانية بعد مراجعة عروض السوق للعام الماضي.' }, EMAIL);
            }
          }
        }
        placed = plan;
        break;
      } catch (error) {
        console.log(`  ! ${plan.title}: ${error.message}`);
      }
    }
    console.log(placed ? `• بنود الخطة: ${placed.title} — بندان ينتظران قرار المدير` : '• بنود الخطة تُخطّيت: لا خطة معلنة بنافذة تقديم مفتوحة');
  } catch (error) {
    console.log(`• بنود الخطة تُخطّيت: ${error.message}`);
  }

  const view = await call('GET', `/department-workspace/${root.id}`);
  console.log(`\n«إدارتي» — ${view.department.name}`);
  console.log(`  الفريق ${view.team.length} · مهام مفتوحة ${view.team.reduce((s, m) => s + (m.load?.open ?? 0), 0)} · متأخرة ${view.team.reduce((s, m) => s + (m.load?.overdue ?? 0), 0)}`);
  for (const section of view.sections) console.log(`  ${section.key} (${section.reach}): ${section.counts.map((c) => `${c.key}=${c.value}`).join(' ')}`);
  console.log(`  الرابط: /portal/my-department?department=${root.id}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
