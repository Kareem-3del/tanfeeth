#!/usr/bin/env node
/**
 * «إدارتي» بسيناريو كامل: ثلاث إدارات تجريبية، لكلٍّ مديرها وفريقها، وتختلف
 * صفحة كل مدير بحسب ما تعمله إدارته (FR-HM-021).
 *
 *   API=https://staging-api.tanfeeth.io/api EMAIL=admin@example.com PASSWORD=... \
 *   node deploy/seed-demo-department-workspace.mjs
 *
 * ما يُزرع (عبر الـAPI، يُعاد تشغيله بأمان — ما وُجد يُعاد استعماله):
 *  - «إدارة العقود — تجريبية» (DEMO-CDM، contracts_cdm) وفرعها «قسم متابعة
 *    الضمانات — تجريبي»؛ مديرها حساب EMAIL نفسه. ترى عقود الجهة كلها.
 *  - «إدارة المشتريات — تجريبية» (DEMO-PROC، procurement)؛ مديرها
 *    proc.manager@example.com. ترى مشاريع الجهة الجارية كلها.
 *  - «إدارة التحول الرقمي — تجريبية» (DEMO-DGT، requesting)؛ مديرتها
 *    itd.manager@example.com. ترى بنود خطتها التي يرفعها فريقها.
 *
 * لا تلمس DEMO-IT ولا it.manager / it.employee: تلك إدارة درس الخطة السنوية
 * (`seed-demo-users.mjs`)، وتعيين مديرٍ آخر فيها يُنزل «هند» إلى عضو ويكسر الدرس.
 * والرموز تُطابَق بالحرف، فلا تُعِد استعمال رمزٍ موجود لإدارة أخرى.
 *  - لكل إدارة: نائب وموظفون (@example.com؛ المديرون والنواب في مجموعة
 *    «الإدارات» بمبدّل الحسابات — frontend-v3 demo-accounts/accounts.ts)، ومهامٌ يسندها المدير من «إدارتي» نفسها (متأخرة، قيد التنفيذ،
 *    منجزة هذا الشهر)، ومؤشر للإدارة ومؤشر لكل موظف بقراءات شهرية من يونيو
 *    يُدخلها صاحبها ويُتحقَّق منها (فصل المهام)، بنتائج متفاوتة.
 *  - بنود خطة يرفعها الموظفون في خطةٍ معلنة نافذتها مفتوحة: بعضها ينتظر قرار
 *    المدير، وبعضها معتمد، وواحد مُعاد بسببه.
 *
 * العقود والمشاريع لا تُزرع: العقود والمشتريات تريان ما على البيئة كما هو.
 */

const API = process.env.API ?? 'http://localhost:3000/api';
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo@2026x';

if (!EMAIL || !PASSWORD) {
  console.error('حدّد EMAIL و PASSWORD لحسابٍ يملك users.manage و departments.manage و tasks.manage و kpis.manage.');
  process.exit(1);
}

const tokens = new Map();

const call = async (method, path, body, who = EMAIL) => {
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
const login = async (email, password = DEMO_PASSWORD) => {
  if (tokens.has(email)) return null;
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

const MONTHS = ['06', '07', '08', '09', '10'];
const YEAR = new Date().getUTCFullYear();

/* ── الإدارات ───────────────────────────────────────────────────────────────
 * manager: null = حساب EMAIL نفسه. tasks: [title, dueOffsetDays, status] — السالب متأخر.
 * kpi.values: قراءات يونيو→أكتوبر [A المنجز، B المطلوب]. lines: [email, title, budget, quarter, decision]
 * حيث decision: null ينتظر قرار المدير، true معتمد، نصٌّ = سبب الإعادة.
 */
const DEPARTMENTS = [
  {
    root: { code: 'DEMO-CDM', name: 'إدارة العقود — تجريبية', type: 'contracts_cdm', email: 'contracts@example.com', notes: 'إدارة تجريبية لعرض «إدارتي»: يديرها حساب المسؤول التجريبي.' },
    branch: { code: 'DEMO-CDM-GRT', name: 'قسم متابعة الضمانات — تجريبي', type: 'contracts_cdm' },
    manager: null,
    managerTitle: 'مدير إدارة العقود',
    team: [
      { email: 'cdm.deputy@example.com', fullName: 'عبدالله الحربي', title: 'نائب مدير إدارة العقود', role: 'deputy', at: 'root' },
      { email: 'cdm.sara@example.com', fullName: 'سارة العتيبي', title: 'أخصائية عقود', role: 'member', at: 'root' },
      { email: 'cdm.fahad@example.com', fullName: 'فهد القحطاني', title: 'مهندس متابعة تنفيذ', role: 'member', at: 'root' },
      { email: 'cdm.noura@example.com', fullName: 'نورة الشهري', title: 'محللة عقود', role: 'member', at: 'root' },
      { email: 'cdm.majed@example.com', fullName: 'ماجد الدوسري', title: 'مراقب ضمانات بنكية', role: 'manager', at: 'branch' },
    ],
    tasks: {
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
    },
    deptKpi: { name: 'العقود المحدّثة في موعدها', a: 'عقود حُدّثت بياناتها في موعدها', b: 'العقود القائمة', target: 90, reporter: 'cdm.deputy@example.com', values: [[41, 48], [44, 50], [45, 49], [47, 51], [48, 52]] },
    employeeKpis: {
      'cdm.deputy@example.com': { name: 'اعتماد مسودات العقود خلال ٥ أيام عمل', target: 90, values: [[9, 10], [8, 9], [10, 11], [9, 10], [11, 12]] },
      'cdm.sara@example.com': { name: 'تحديث بيانات العقود في موعدها', target: 95, values: [[18, 20], [17, 20], [19, 22], [20, 21], [21, 22]] },
      'cdm.fahad@example.com': { name: 'زيارات المتابعة الميدانية المنفّذة من المخطط', target: 90, values: [[6, 8], [5, 8], [6, 8], [7, 9], [6, 8]] },
      'cdm.noura@example.com': { name: 'تقارير التحليل المسلّمة في موعدها', target: 90, values: [[3, 6], [4, 6], [3, 5], [4, 7], [3, 6]] },
      'cdm.majed@example.com': { name: 'تنبيه الضمانات قبل انتهائها بـ٣٠ يومًا', target: 100, values: [[12, 12], [10, 11], [14, 14], [13, 13], [15, 15]] },
    },
    lines: [
      ['cdm.sara@example.com', 'تجديد عقد الصيانة الشاملة لمباني الجهة', 4_200_000, 1, null],
      ['cdm.fahad@example.com', 'عقد إشراف هندسي على مشاريع الإنشاءات', 2_750_000, 2, null],
      ['cdm.noura@example.com', 'عقد إطاري لخدمات النظافة للفروع', 1_850_000, 2, true],
      ['cdm.deputy@example.com', 'استشارات قانونية لصياغة العقود النموذجية', 600_000, 3, 'أعد تقدير الميزانية بعد مراجعة عروض السوق للعام الماضي.'],
    ],
  },
  {
    root: { code: 'DEMO-PROC', name: 'إدارة المشتريات — تجريبية', type: 'procurement', email: 'procurement@example.com', notes: 'إدارة تجريبية لعرض «إدارتي» من جهة المشتريات.' },
    manager: { email: 'proc.manager@example.com', fullName: 'خالد المطيري', title: 'مدير إدارة المشتريات' },
    managerTitle: 'مدير إدارة المشتريات',
    team: [
      { email: 'proc.deputy@example.com', fullName: 'نوال السبيعي', title: 'نائبة مدير إدارة المشتريات', role: 'deputy', at: 'root' },
      { email: 'proc.badr@example.com', fullName: 'بدر العنزي', title: 'أخصائي مشتريات', role: 'member', at: 'root' },
      { email: 'proc.lama@example.com', fullName: 'لمى الغامدي', title: 'محللة أسعار', role: 'member', at: 'root' },
      { email: 'proc.adel@example.com', fullName: 'عادل البقمي', title: 'منسّق لجان فحص العروض', role: 'member', at: 'root' },
    ],
    tasks: {
      'proc.deputy@example.com': [
        ['مراجعة كراسة الشروط لمشروع صيانة الطرق الداخلية', -3, 'IN_PROGRESS'],
        ['اعتماد خطة الطرح للربع الأول', 6, 'TODO'],
        ['إعداد تقرير المشاريع المتأخرة عن موعد طرحها', -18, 'DONE'],
      ],
      'proc.badr@example.com': [
        ['الرد على استفسارات المتنافسين في منافسة توريد الأثاث', -2, 'TODO'],
        ['إعداد إعلان الطرح لمنافسة خدمات الأمن والسلامة', 4, 'IN_PROGRESS'],
        ['استكمال وثائق الترسية لمشروع أجهزة العرض', -10, 'DONE'],
        ['رفع ملحق التعديل على كراسة مشروع التكييف', 8, 'TODO'],
      ],
      'proc.lama@example.com': [
        ['تحليل أسعار السوق لبنود مشروع الإنارة', -7, 'TODO'],
        ['مقارنة العروض المالية لمنافسة النظافة', 2, 'IN_PROGRESS'],
        ['تحديث القيمة التقديرية لمشروع الصيانة الوقائية', -14, 'DONE'],
      ],
      'proc.adel@example.com': [
        ['تجهيز محضر فتح العروض لمنافسة توريد الأجهزة', -1, 'TODO'],
        ['جدولة اجتماع لجنة الفحص لمشروع الشبكات', 3, 'TODO'],
        ['توقيع أعضاء اللجنة على محضر الترسية', -9, 'DONE'],
        ['أرشفة محاضر لجان الربع الثالث', -22, 'DONE'],
      ],
    },
    deptKpi: { name: 'المشاريع المطروحة في موعدها حسب الخطة', a: 'مشاريع طُرحت في الربع المخطط', b: 'مشاريع مخطط طرحها', target: 85, reporter: 'proc.deputy@example.com', values: [[7, 9], [8, 10], [9, 10], [8, 9], [10, 11]] },
    employeeKpis: {
      'proc.deputy@example.com': { name: 'مراجعة الكراسات خلال ٣ أيام عمل', target: 90, values: [[8, 9], [9, 10], [7, 8], [9, 9], [10, 11]] },
      'proc.badr@example.com': { name: 'الرد على الاستفسارات خلال المهلة النظامية', target: 100, values: [[14, 15], [16, 16], [13, 15], [15, 16], [17, 18]] },
      'proc.lama@example.com': { name: 'تحليلات الأسعار المسلّمة في موعدها', target: 90, values: [[5, 7], [4, 6], [6, 8], [5, 7], [6, 8]] },
      'proc.adel@example.com': { name: 'محاضر اللجان المكتملة خلال يومي عمل', target: 95, values: [[10, 10], [11, 12], [9, 9], [12, 12], [11, 11]] },
    },
    lines: [],
  },
  {
    root: { code: 'DEMO-DGT', name: 'إدارة التحول الرقمي — تجريبية', type: 'requesting', email: 'digital@example.com', notes: 'إدارة طالبة تجريبية لعرض «إدارتي»: ترفع احتياجها في الخطة السنوية.' },
    manager: { email: 'itd.manager@example.com', fullName: 'ريم الزهراني', title: 'مديرة إدارة التحول الرقمي' },
    managerTitle: 'مديرة إدارة التحول الرقمي',
    team: [
      { email: 'itd.deputy@example.com', fullName: 'بندر الشمري', title: 'نائب مديرة إدارة التحول الرقمي', role: 'deputy', at: 'root' },
      { email: 'itd.arwa@example.com', fullName: 'أروى العمري', title: 'محللة أنظمة', role: 'member', at: 'root' },
      { email: 'itd.yousef@example.com', fullName: 'يوسف الحارثي', title: 'مهندس شبكات', role: 'member', at: 'root' },
    ],
    tasks: {
      'itd.deputy@example.com': [
        ['إعداد المواصفات الفنية لتحديث أجهزة الشبكة', -4, 'IN_PROGRESS'],
        ['مراجعة اتفاقية مستوى الخدمة لعقد الدعم الفني', 5, 'TODO'],
        ['رفع احتياج الإدارة للخطة السنوية', -16, 'DONE'],
      ],
      'itd.arwa@example.com': [
        ['حصر تراخيص البرمجيات المنتهية هذا العام', -5, 'TODO'],
        ['تقدير تكلفة منصة البريد الإلكتروني لثلاث سنوات', 3, 'IN_PROGRESS'],
        ['توثيق متطلبات نظام إدارة الأصول', -11, 'DONE'],
      ],
      'itd.yousef@example.com': [
        ['فحص جاهزية مركز البيانات قبل التوسعة', 2, 'IN_PROGRESS'],
        ['حصر الأجهزة المحمولة المطلوبة للموظفين الجدد', -1, 'TODO'],
        ['تقرير أعطال الشبكة للربع الثالث', -19, 'DONE'],
      ],
    },
    deptKpi: { name: 'طلبات الدعم الفني المغلقة خلال يوم عمل', a: 'طلبات أُغلقت خلال يوم عمل', b: 'طلبات الدعم الواردة', target: 90, reporter: 'itd.deputy@example.com', values: [[182, 205], [190, 210], [176, 198], [201, 214], [207, 220]] },
    employeeKpis: {
      'itd.deputy@example.com': { name: 'المواصفات الفنية المسلّمة في موعدها', target: 90, values: [[4, 4], [3, 4], [5, 5], [4, 5], [5, 5]] },
      'itd.arwa@example.com': { name: 'متطلبات الأنظمة الموثّقة من المخطط', target: 90, values: [[6, 8], [7, 8], [6, 7], [7, 9], [8, 9]] },
      'itd.yousef@example.com': { name: 'توفر الشبكة الرئيسية', target: 99, values: [[996, 1000], [999, 1000], [993, 1000], [998, 1000], [997, 1000]] },
    },
    lines: [
      ['itd.arwa@example.com', 'ترخيص منصة البريد الإلكتروني لثلاث سنوات', 1_200_000, 1, null],
      ['itd.yousef@example.com', 'تحديث أجهزة الشبكة الرئيسية', 3_400_000, 2, null],
      ['itd.deputy@example.com', 'عقد دعم فني وتشغيل لمركز البيانات', 2_100_000, 1, true],
      ['itd.yousef@example.com', 'أجهزة حاسب محمول للموظفين الجدد', 900_000, 2, 'اجمعه مع طلب الأجهزة الموحّد في الربع الثاني لتوحيد التوريد.'],
    ],
  },
];

/* ── المهام المشتركة ───────────────────────────────────────────────────── */

let people = null;
const ensureUser = async (spec) => {
  people ??= new Map((await call('GET', '/departments/assignable-users')).items.map((u) => [u.email.toLowerCase(), u]));
  const known = people.get(spec.email);
  if (known) return known.id;
  const created = await call('POST', '/users', { email: spec.email, password: DEMO_PASSWORD, fullName: spec.fullName, title: spec.title });
  people.set(spec.email, { id: created.id, email: spec.email });
  console.log(`  + ${spec.fullName} <${spec.email}>`);
  return created.id;
};

let registry = null;
const ensureDepartment = async (spec, parentId) => {
  registry ??= (await call('GET', '/departments')).items;
  let dept = registry.find((d) => d.code === spec.code);
  if (!dept) {
    dept = await call('POST', '/departments', { ...spec, parentId });
    registry.push(dept);
  }
  if (dept.status === 'archived') await call('PATCH', `/departments/${dept.id}/status`, { status: 'active' });
  return dept;
};

const join = async (departmentId, userId, role, jobTitle) => {
  try {
    await call('POST', `/departments/${departmentId}/members`, { userId, role, jobTitle, transfer: true });
  } catch (error) {
    console.log(`  ! ${jobTitle}: ${error.message}`);
  }
};

/* A finished task is no longer «open»: look each title up so a re-run does not hand it out twice. */
const taskExists = async (assigneeId, title) => {
  const found = await call('GET', `/tasks?search=${encodeURIComponent(title)}&pageSize=100`).catch(() => ({ items: [] }));
  return (found.items ?? []).some((t) => t.title === title && (t.assignee?.id ?? t.assigneeId) === assigneeId);
};

const readings = async (record, values, reporterEmail) => {
  for (const [i, month] of MONTHS.entries()) {
    const period = `${YEAR}-${month}`;
    try {
      await call('PUT', `/kpis/${record.id}/readings/${period}`, { values: { A: values[i][0], B: values[i][1] } }, reporterEmail);
    } catch (error) {
      if (error.status !== 409) console.log(`  ! ${record.name} ${period}: ${error.message}`);
    }
    /* EMAIL holds kpis.manage and is neither the enterer nor the subject — the separation holds. */
    await call('POST', `/kpis/${record.id}/readings/${period}/verify`, undefined, EMAIL).catch(() => {});
  }
};

let announced = null;
const placeLines = async (config, managerEmail) => {
  if (config.lines.length === 0) return;
  announced ??= ((await call('GET', '/annual-plans')).items ?? []).filter((p) => p.status === 'announced').sort((a, b) => a.year - b.year);
  for (const plan of announced) {
    const listed = (await call('GET', `/annual-plans/${plan.id}/submissions`)).items ?? [];
    try {
      for (const [email, title, budget, quarter, decision] of config.lines) {
        if (listed.some((item) => item.title === title)) continue;
        await login(email);
        const line = await call('POST', `/annual-plans/${plan.id}/submissions`, { title, estimatedBudget: budget, expectedQuarter: quarter, planYear: plan.year, description: `بند تجريبي من ${config.root.name}.` }, email);
        await call('POST', `/annual-plans/${plan.id}/submissions/${line.id}/submit`, undefined, email);
        if (decision !== null) {
          await call('POST', `/annual-plans/${plan.id}/submissions/${line.id}/decide`, decision === true ? { approved: true } : { approved: false, reason: decision }, managerEmail);
        }
      }
      console.log(`  بنود الخطة في «${plan.title}»`);
      return;
    } catch (error) {
      console.log(`  ! ${plan.title}: ${error.message}`);
    }
  }
  console.log('  بنود الخطة تُخطّيت: لا خطة معلنة بنافذة تقديم مفتوحة');
};

/* ── إدارة واحدة ───────────────────────────────────────────────────────── */

async function seedDepartment(config, admin) {
  console.log(`\n• ${config.root.name}`);
  const managerEmail = config.manager ? config.manager.email : EMAIL;
  const managerId = config.manager ? await ensureUser(config.manager) : admin.id;
  const ids = {};
  for (const spec of config.team) ids[spec.email] = await ensureUser(spec);

  const root = await ensureDepartment(config.root, null);
  const branch = config.branch ? await ensureDepartment(config.branch, root.id) : null;
  const place = { root: root.id, branch: branch?.id ?? root.id };

  await join(root.id, managerId, 'manager', config.managerTitle);
  for (const spec of config.team) await join(place[spec.at], ids[spec.email], spec.role, spec.title);
  console.log(`  الفريق ${config.team.length + 1}`);

  /* Tasks — handed out by the manager from «إدارتي» itself, as the page does it. */
  await login(managerEmail, config.manager ? DEMO_PASSWORD : PASSWORD);
  let made = 0;
  for (const [email, list] of Object.entries(config.tasks)) {
    for (const [title, offset, status] of list) {
      if (await taskExists(ids[email], title)) continue;
      const { id } = await call('POST', `/department-workspace/${root.id}/tasks`, { assigneeId: ids[email], title, dueDate: day(offset), description: `مهمة تجريبية لعرض «إدارتي» — ${config.root.name}.` }, managerEmail);
      if (status !== 'TODO') await call('PATCH', `/tasks/${id}/status`, { status: 'IN_PROGRESS' }).catch(() => {});
      if (status === 'DONE') await call('PATCH', `/tasks/${id}/status`, { status: 'DONE' }).catch((error) => console.log(`  ! ${title}: ${error.message}`));
      made += 1;
    }
  }
  console.log(`  المهام +${made}`);

  /* KPIs — the department's and one per employee; an employee KPI sits in the employee's own department. */
  const existing = [];
  for (const departmentId of new Set(Object.values(place))) {
    existing.push(...((await call('GET', `/kpis?scope=department&departmentId=${departmentId}&includeEmployees=true`)).items ?? []));
  }
  const byName = new Map(existing.map((k) => [k.name, k]));
  const kpi = async (spec) =>
    byName.get(spec.name) ??
    call('POST', '/kpis', {
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
      ownerUserId: managerId,
      departmentId: root.id,
      ...spec.fields,
      name: spec.name,
      target: spec.target,
    });

  const d = config.deptKpi;
  await login(d.reporter).catch(() => console.log(`  ! تعذّر دخول ${d.reporter}`));
  const deptKpi = await kpi({ ...d, weight: 2, fields: { level: 'department', visibility: 'department', reporterUserId: ids[d.reporter] } });
  await readings(deptKpi, d.values, d.reporter);

  for (const [email, spec] of Object.entries(config.employeeKpis)) {
    await login(email).catch(() => console.log(`  ! تعذّر دخول ${email}`));
    const member = config.team.find((t) => t.email === email);
    const record = await kpi({
      name: spec.name,
      a: 'المنجز',
      b: 'المطلوب',
      target: spec.target,
      fields: { level: 'employee', visibility: 'restricted', subjectUserId: ids[email], reporterUserId: ids[email], departmentId: place[member.at] },
    });
    await readings(record, spec.values, email);
  }
  console.log('  المؤشرات: مؤشر الإدارة + مؤشر لكل موظف بقراءات يونيو–أكتوبر');

  await placeLines(config, managerEmail);

  const view = await call('GET', `/department-workspace/${root.id}`, undefined, managerEmail);
  console.log(`  «إدارتي»: الفريق ${view.team.length} · مفتوحة ${view.team.reduce((s, m) => s + (m.load?.open ?? 0), 0)} · متأخرة ${view.team.reduce((s, m) => s + (m.load?.overdue ?? 0), 0)}`);
  for (const section of view.sections) console.log(`  ${section.key} (${section.reach}): ${section.counts.map((c) => `${c.key}=${c.value}`).join(' ')}`);
  console.log(`  المدير ${managerEmail} · /portal/my-department?department=${root.id}`);
}

async function main() {
  const admin = await login(EMAIL, PASSWORD);
  const only = process.env.ONLY?.split(',');
  for (const config of DEPARTMENTS) {
    if (only && !only.includes(config.root.code)) continue;
    await seedDepartment(config, admin);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
