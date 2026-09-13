#!/usr/bin/env node
/**
 * زرعُ مهامٍّ تجريبية لوحدة «المهام والمتابعة» — عبر واجهة الـAPI لا بكتابةٍ في
 * قاعدة البيانات، فتمرّ بكلّ قواعد المجال (الانتقالات، شرطُ الدليل، الصلاحيات).
 *
 *   API=https://staging-api.tanfeeth.io/api \
 *   EMAIL=... PASSWORD=... node deploy/seed-demo-tasks.mjs
 *
 * ── ما يُزرع، ولماذا هذه المجموعة بعينها ──────────────────────────────────
 * المقصودُ أن تُضيء الشاشةُ كلُّها: كلُّ بلاطةٍ في الملخّص لها رقم، وكلُّ حالةٍ
 * في الجدول لها صفّ، وكلُّ ميزةٍ في الوحدة لها ما يُريها.
 *
 *   · **متأخّرتان** — فتحمرّ بلاطةُ «متأخرة» ويظهر وسمُ التأخّر بجوار الموعد.
 *     وإحداهما تشترط دليلًا ولا دليلَ لها: هي **أفضلُ ما يُجرَّب** — اضغط
 *     «إكمال المهمة» فيردّها الخادمُ بـ«أرفق المستند المطلوب قبل إكمال المهمة».
 *   · **مستحقّةٌ اليوم** — تُظهر وسمَ «اليوم»، وتُثبت أنّ المستحقَّ اليومَ
 *     ليس متأخرًا (وهي العلّةُ التي جُعل لها يومُ الاستحقاق نصًّا لا لحظة).
 *   · **مكتملةٌ بمرفق** — تُري دورةَ الدليل كاملةً: رُفع المستند ثمّ أُكمِلت.
 *     وجرّب إزالةَ مرفقها: يُمنع، لأنّها مكتملةٌ تشترط دليلًا.
 *   · **قيد التنفيذ** و**لم تبدأ** — ليكون لكلّ بلاطةٍ رقم.
 *   · وثلاثةُ التصنيفات ممثَّلة (كفاءة الإنفاق، المحتوى المحلي، عام)،
 *     والمسؤولون موزَّعون على أكثر من شخصٍ ليُرى عمودُ المسؤول ومرشِّحُه.
 *
 * ── والزرعُ لا يُكرَّر ────────────────────────────────────────────────────
 * كلُّ مهمّةٍ تُبحث بعنوانها قبل إنشائها، فتشغيلُ السكربت مرّتين لا يُخرج
 * نسختين. والوحدةُ بلا حذفٍ نهائيّ عمدًا، فالتكرارُ لا يُصلَح بضغطة.
 */

const API = process.env.API ?? 'http://localhost:3000/api';
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('حدّد EMAIL و PASSWORD في البيئة.');
  console.error(
    'مثال: API=https://staging-api.tanfeeth.io/api EMAIL=… PASSWORD=… node deploy/seed-demo-tasks.mjs',
  );
  process.exit(1);
}

let token = '';

const call = async (method, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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
    const msg = data?.message ?? res.statusText;
    const details = data?.details ? ` [${data.details.join('; ')}]` : '';
    const err = new Error(`${method} ${path} → ${res.status}: ${msg}${details}`);
    err.status = res.status;
    err.code = data?.code;
    throw err;
  }
  return data;
};

/**
 * يومُ الاستحقاق بتقويم الرياض — لا بتقويم الجهاز الذي يشغّل السكربت.
 *
 * حكمُ التأخّر في الخادم يُقاس بـ`Asia/Riyadh`. فلو حُسب «اليوم» هنا بتوقيتٍ
 * آخر لخرجت المهمّةُ المقصودُ أنّها مستحقّةٌ اليوم متأخّرةً على الشاشة — وهي
 * الحالةُ التي وُضعت لتُثبت العكس.
 */
const riyadhDay = (offsetDays = 0) => {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
};

/** مستندُ PDF صغير صالحٌ — دليلٌ يُرفع ويُفتح، لا بايتاتٌ عشوائية. */
const evidencePdf = () => {
  const body = [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj',
    'trailer<</Root 1 0 R>>',
    '%%EOF',
  ].join('\n');
  return new Blob([body], { type: 'application/pdf' });
};

const uploadEvidence = async (taskId, filename) => {
  const form = new FormData();
  form.append('file', evidencePdf(), filename);
  const res = await fetch(`${API}/tasks/${taskId}/attachments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`رفعُ المرفق → ${res.status}: ${await res.text()}`);
  }
  return res.json();
};

/** المهمّةُ القائمةُ بهذا العنوان، أو `null` — أساسُ عدم التكرار. */
const findByTitle = async (title) => {
  const page = await call(
    'GET',
    `/tasks?search=${encodeURIComponent(title)}&pageSize=50`,
  );
  return (page.items ?? []).find((task) => task.title === title) ?? null;
};

/**
 * المهامُّ المزروعة. `due` بالأيام من اليوم: سالبٌ = متأخّرة، صفرٌ = اليوم.
 * و`status` الحالةُ التي تستقرّ عليها، و`evidence` اشتراطُ الدليل.
 */
const PLAN = [
  {
    title: 'تجميع أدلة معيار كفاءة الإنفاق — الربع الثالث',
    description:
      'تحديد المعيار المطلوب وجمع المستندات التي تثبت التنفيذ وربطها بالمهمة.',
    category: 'spending_efficiency',
    due: -6,
    status: 'TODO',
    evidence: true,
    sourceReference: 'دليل العمل، ص48',
    note: 'متأخّرة وتشترط دليلًا — جرّب إكمالها: يُردّ الطلب.',
  },
  {
    title: 'مراجعة متطلبات المحتوى المحلي بالكراسة',
    description:
      'مراجعة الكراسة والملحقات وتوثيق الملاحظات والمتطلبات الناقصة.',
    category: 'local_content',
    due: -2,
    status: 'IN_PROGRESS',
    evidence: false,
    note: 'متأخّرة وقيد التنفيذ.',
  },
  {
    title: 'استكمال بيانات المتعاقدين الناقصة',
    description:
      'تحديد البيانات الناقصة وجمعها والتحقق من اكتمالها وتجهيزها للتسليم.',
    category: 'general',
    due: 0,
    status: 'TODO',
    evidence: false,
    note: 'مستحقّة اليوم — وسمُ «اليوم»، وليست متأخّرة.',
  },
  {
    title: 'تجهيز تقرير متابعة العقد الربعي',
    description:
      'جمع بيانات العقد والتقرير المطلوب والمستندات الداعمة للمراجعة الداخلية.',
    category: 'local_content',
    due: 4,
    status: 'IN_PROGRESS',
    evidence: false,
    linkContract: true,
    note: 'قيد التنفيذ ومرتبطة بعقد.',
  },
  {
    title: 'رفع نموذج ن.3.2 للمحتوى المحلي',
    description:
      'تعبئة نموذج المحتوى المحلي المعتمد ورفعه بعد اعتماده من الإدارة.',
    category: 'local_content',
    due: -1,
    status: 'DONE',
    evidence: true,
    attach: 'نموذج-ن3.2.pdf',
    note: 'مكتملة بمرفق — جرّب إزالة مرفقها: يُمنع حتى تُعاد للتنفيذ.',
  },
  {
    title: 'تحديث سجل ضوابط كفاءة الإنفاق',
    description: 'مراجعة الضوابط المطبّقة وتحديث السجل بما استجدّ من قرارات.',
    category: 'spending_efficiency',
    due: 9,
    status: 'TODO',
    evidence: false,
    note: 'لم تبدأ.',
  },
  {
    title: 'إعداد ملخص التزامات المحتوى المحلي للإدارة العليا',
    description:
      'تلخيص نسب الالتزام والمخالفات والإجراءات المتخذة في صفحة واحدة.',
    category: 'local_content',
    due: 14,
    status: 'IN_PROGRESS',
    evidence: true,
    note: 'قيد التنفيذ وتشترط دليلًا — لم يحن موعدها بعد.',
  },
];

const main = async () => {
  const auth = await call('POST', '/auth/login', {
    email: EMAIL,
    password: PASSWORD,
  });
  token = auth.tokens.accessToken;
  console.log(`✓ دخلَ ${auth.user.email}`);

  /*
   * الإسنادُ يحتاج `tasks.manage`. ونداءٌ واحدٌ يكشف الأمرين: أللحساب صلاحيةٌ،
   * وهل في الجهة مستخدمون يُسنَد إليهم. ورسالةُ الفشل تقول العلاجَ لا العطل.
   */
  let assignees = [];
  try {
    assignees = (await call('GET', '/tasks/assignees')).items ?? [];
  } catch (err) {
    if (err.status === 403) {
      console.error(
        '✗ الحسابُ لا يملك `tasks.manage` — أسنِد إليه دورًا يحمله ثمّ أعد التشغيل.',
      );
      process.exit(1);
    }
    throw err;
  }
  if (assignees.length === 0) {
    console.error('✗ لا مستخدمين فعّالين للإسناد إليهم.');
    process.exit(1);
  }
  console.log(`✓ ${assignees.length} مستخدمًا متاحًا للإسناد`);

  /* ربطٌ اختياريّ بعقدٍ قائم — يُري أنّ المهمّة تتّصل بما في المنصّة. */
  let contractId = null;
  try {
    const contracts = await call('GET', '/contracts?page=1&pageSize=1');
    contractId = contracts.items?.[0]?.id ?? null;
  } catch {
    /* لا عقود أو لا صلاحية — الربطُ اختياريّ فلا يُوقف الزرع. */
  }

  let created = 0;
  let skipped = 0;

  for (const [index, spec] of PLAN.entries()) {
    const existing = await findByTitle(spec.title);
    if (existing) {
      skipped += 1;
      console.log(`· موجودة: ${spec.title}`);
      continue;
    }

    /* التوزيعُ بالدور: يُرى عمودُ المسؤول ومرشِّحُه بأكثر من اسم. */
    const assignee = assignees[index % assignees.length];

    let task = await call('POST', '/tasks', {
      title: spec.title,
      description: spec.description,
      category: spec.category,
      assigneeId: assignee.id,
      dueDate: riyadhDay(spec.due),
      evidenceRequired: spec.evidence,
      ...(spec.sourceReference ? { sourceReference: spec.sourceReference } : {}),
      ...(spec.linkContract && contractId ? { contractId } : {}),
    });

    if (spec.attach) {
      task = await uploadEvidence(task.id, spec.attach);
    }

    /*
     * الحالةُ تُبلَغ بانتقالاتها لا بقفزة: «مكتملة» تمرّ بـ«قيد التنفيذ»،
     * فيُسجَّل المسارُ كما لو مشاه إنسان — وهو ما يقرؤه سجلُّ التدقيق.
     */
    if (spec.status === 'IN_PROGRESS' || spec.status === 'DONE') {
      task = await call('PATCH', `/tasks/${task.id}/status`, {
        status: 'IN_PROGRESS',
      });
    }
    if (spec.status === 'DONE') {
      task = await call('PATCH', `/tasks/${task.id}/status`, {
        status: 'DONE',
      });
    }

    created += 1;
    console.log(
      `✓ ${task.title} — ${task.status}` +
        `${task.isOverdue ? ' — متأخّرة' : ''}` +
        `${task.evidenceRequired ? ' — يلزم مستند' : ''}` +
        ` — ${assignee.name}`,
    );
  }

  const summary = await call('GET', '/tasks/summary');
  console.log(
    `\nالملخّص — الإجمالي ${summary.total} · لم تبدأ ${summary.todo} · ` +
      `قيد التنفيذ ${summary.inProgress} · مكتملة ${summary.done} · متأخّرة ${summary.overdue}`,
  );
  console.log(`أُنشئت ${created}، وتُخطّيت ${skipped} موجودةً مسبقًا.`);
  console.log('\nالرابط: /portal/tasks');
  console.log('جرّب على الشاشة:');
  for (const spec of PLAN) {
    if (spec.note) console.log(`  · ${spec.title} — ${spec.note}`);
  }
};

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
