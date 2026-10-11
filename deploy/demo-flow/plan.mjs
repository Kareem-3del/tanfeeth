/**
 * مرحلة الخطة السنوية في سيناريو العرض — كل خطوة بحسابها (فصل المهام في الخادم):
 *
 *   plan.announcer  يعلن الخطة بنافذة تقديم (POST /annual-plans/announce)
 *   it.employee     يضيف بند إدارته ثم يقدّمه لمديره (…/submissions، …/submit)
 *   it.manager      تعتمد البند لإدارتها (…/submissions/:id/decide)
 *   plan.reviewer   مراجعة مبكرة: تقفل النافذة فورًا بسببٍ مذكور وتُتم المراجعة
 *                   (POST /annual-plans/:id/review { early: true, note })
 *   plan.approver   الاعتماد النهائي (POST /annual-plans/:id/approve)
 *
 * النافذة: حالتها مشتقة من وقت الخادم، والمراجع لا يتصرف قبل قفلها. بدل
 * الانتظار نستعمل «المراجعة المبكرة» — مسار المنتج نفسه: تُقفل النافذة الآن
 * ويُسجَّل الحدث `window_closed_early` بالسبب.
 *
 * السنة: من السنة الحالية حتى +5، بلا تداخل. إن لم تبقَ سنة حرّة:
 *   - `--reuse-plan=<id>` (أو PLAN_REUSE_ID) يكمل خطةً معلنةً قائمة بالفلو نفسه؛
 *   - وإلا تُكمَل خطةُ عرضٍ سابقة لم تكتمل (معلنة/مراجَعة)؛
 *   - وإلا يُضاف البند لخطة عرضٍ معتمدة عبر «تعديل الخطة» (المعلن يطلب،
 *     المعتمد يعتمد) — مسار المنتج للخطط المعتمدة.
 *
 *   node deploy/demo-flow/plan.mjs [--auto] [--reuse-plan=<id>]
 */

import { pathToFileURL } from 'node:url';

import { as, done, RUN, step } from './lib.mjs';

/** علامة تميّز بيانات العرض (تُرى في العنوان وتكشف خطط التشغيلات السابقة). */
const DEMO_MARK = 'العرض التجريبي';
const DEMO_DEPARTMENT = 'إدارة تقنية المعلومات (تجريبية)';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const plansPath = (id = '') => `/annual-plans${id ? `/${id}` : ''}`;
const planScreen = (id, phase) => `/portal/plan/${id}${phase ? `?phase=${phase}` : ''}`;

function argValue(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

/** البند الذي ستُطرح منه المنافسة لاحقًا. */
function itemPayload(planYear) {
  return {
    title: `توريد أجهزة حاسب آلي — ${DEMO_MARK} ${RUN}`,
    description:
      'توريد ١٢٠ جهاز حاسب آلي مكتبي و٤٠ حاسبًا محمولًا مع الضمان والتركيب لمقرّ الجهة، ' +
      'يُطرح منافسةً عامة على منصة اعتماد.',
    estimatedBudget: 1_200_000,
    expectedQuarter: 2,
    planYear,
    notes: 'نوع الطرح المقترح: منافسة عامة — توريد.',
  };
}

const coveredYears = (plans) => {
  const years = new Set();
  for (const p of plans) for (let y = p.year; y <= (p.endYear ?? p.year); y++) years.add(y);
  return years;
};

const isDemoPlan = (overview) =>
  overview.plan.title.includes(DEMO_MARK) || overview.items.some((i) => i.department === DEMO_DEPARTMENT);

/**
 * يختار مسار هذا التشغيل:
 *   fresh  — سنة حرّة: إعلان خطة جديدة.
 *   resume — خطة معلنة/مراجَعة (صريحة بـ--reuse-plan أو عرضٌ سابق لم يكتمل).
 *   amend  — خطة عرض معتمدة: البند عبر تعديل الخطة.
 */
async function choosePath(reusePlanId) {
  const { items: plans } = await as('plan.announcer').get(plansPath());
  if (reusePlanId) {
    const plan = plans.find((p) => p.id === reusePlanId);
    if (!plan) throw new Error(`--reuse-plan: الخطة ${reusePlanId} غير موجودة`);
    if (!['announced', 'reviewed'].includes(plan.status)) {
      throw new Error(`--reuse-plan: الخطة «${plan.title}» حالتها ${plan.status} — يلزم معلنة أو مراجَعة`);
    }
    return { mode: 'resume', plan };
  }

  const current = new Date().getFullYear();
  const taken = coveredYears(plans);
  for (let y = current; y <= current + 5; y++) {
    if (!taken.has(y)) return { mode: 'fresh', year: y };
  }

  // لا سنة حرّة — نبحث عن خطة عرضٍ سابقة (بالعلامة أو ببندٍ من الإدارة التجريبية).
  const demo = [];
  for (const p of plans) {
    if (!['announced', 'reviewed', 'approved', 'active'].includes(p.status)) continue;
    const overview = await as('plan.approver').get(plansPath(p.id));
    if (isDemoPlan(overview)) demo.push(p);
  }
  const unfinished = demo.find((p) => p.status === 'reviewed' || (p.status === 'announced' && p.submissionWindow !== 'closed'));
  if (unfinished) return { mode: 'resume', plan: unfinished };
  const approved = demo.find((p) => p.status === 'approved' || p.status === 'active');
  if (approved) return { mode: 'amend', plan: approved };

  const occupied = plans.map((p) => `${p.year}${p.endYear > p.year ? `–${p.endYear}` : ''} ${p.status} «${p.title}» (${p.id})`);
  throw new Error(
    `لا سنة حرّة للخطة (${current}–${current + 5}) ولا خطة عرضٍ سابقة يُبنى عليها.\n` +
      `   الخطط القائمة:\n     ${occupied.join('\n     ')}\n` +
      '   الحل: احذف خطةً قديمة (planning.delete) أو مرّر --reuse-plan=<id> لخطةٍ معلنة.',
  );
}

/** موظف الإدارة يضيف البند ويقدّمه، ومديرة الإدارة تعتمده. */
async function departmentFlow(planId, planYear) {
  const item = await step(
    {
      who: 'it.employee',
      title: 'موظف تقنية المعلومات يضيف بند «توريد أجهزة حاسب آلي» لخطة إدارته (١٬٢٠٠٬٠٠٠ ريال، الربع الثاني)',
      screen: planScreen(planId, 'submissions'),
    },
    async () => {
      const created = await as('it.employee').post(`${plansPath(planId)}/submissions`, itemPayload(planYear));
      console.log(`   البند: ${created.id} — الإدارة (من عضوية الموظف): ${created.department} — ${created.submissionStatus}`);
      return created;
    },
  );

  await step(
    {
      who: 'it.employee',
      title: 'الموظف يقدّم البند لمديرة إدارته للاعتماد',
      screen: planScreen(planId, 'submissions'),
    },
    async () => {
      const submitted = await as('it.employee').post(`${plansPath(planId)}/submissions/${item.id}/submit`);
      console.log(`   حالة البند: ${submitted.submissionStatus}`);
    },
  );

  await step(
    {
      who: 'it.manager',
      title: 'مديرة إدارة تقنية المعلومات تعتمد البند لإدارتها',
      screen: planScreen(planId, 'departmentApproval'),
    },
    async () => {
      const decided = await as('it.manager').post(`${plansPath(planId)}/submissions/${item.id}/decide`, {
        approved: true,
        reason: 'البند ضمن احتياج تحديث أجهزة الإدارة لهذا العام — معتمد.',
      });
      console.log(`   حالة البند: ${decided.submissionStatus}`);
    },
  );
  return item.id;
}

async function reviewAndApprove(plan) {
  if (plan.status === 'announced') {
    await step(
      {
        who: 'plan.reviewer',
        title: 'مراجع الخطة يُجري مراجعة مبكرة: تُقفل نافذة التقديم الآن بسببٍ مذكور ويُتم المراجعة',
        screen: planScreen(plan.id, 'review'),
      },
      async () => {
        const closed = plan.submissionWindow === 'closed';
        const reviewed = await as('plan.reviewer').post(`${plansPath(plan.id)}/review`, {
          approved: true,
          ...(closed ? {} : { early: true }),
          note: 'اكتملت بنود الإدارات المعنية واعتمدها مدراؤها — مراجعة مبكرة لتسريع الطرح.',
        });
        console.log(`   الخطة: ${reviewed.status} — النافذة: ${reviewed.submissionWindow}`);
      },
    );
  }

  await step(
    {
      who: 'plan.approver',
      title: 'معتمد الخطة يعتمد الخطة السنوية نهائيًا',
      screen: planScreen(plan.id, 'approval'),
    },
    async () => {
      const approved = await as('plan.approver').post(`${plansPath(plan.id)}/approve`);
      console.log(`   الخطة: ${approved.status}`);
    },
  );
}

/** خطة عرضٍ معتمدة: البند يدخلها بتعديل خطة (المعلن يطلب، المعتمد يعتمد). */
async function amendFlow(plan) {
  const planYear = Math.max(plan.year, Math.min(new Date().getFullYear(), plan.endYear ?? plan.year));
  const amendment = await step(
    {
      who: 'plan.announcer',
      title: 'مسؤول التخطيط يطلب تعديل الخطة المعتمدة بإضافة بند «توريد أجهزة حاسب آلي» لإدارة تقنية المعلومات',
      screen: planScreen(plan.id, 'execution'),
    },
    async () => {
      const { title, description, estimatedBudget, expectedQuarter, notes } = itemPayload(planYear);
      const created = await as('plan.announcer').post(`${plansPath(plan.id)}/amendments`, {
        type: 'add_item',
        payload: { title, description, department: DEMO_DEPARTMENT, estimatedBudget, expectedQuarter, planYear, notes },
        reason: 'احتياج طارئ لتحديث أجهزة إدارة تقنية المعلومات لم يُدرج عند إعداد الخطة.',
      });
      console.log(`   طلب التعديل: ${created.id} — ${created.status}`);
      return created;
    },
  );

  await step(
    {
      who: 'plan.approver',
      title: 'معتمد الخطة يعتمد التعديل فيُضاف البند للخطة',
      screen: planScreen(plan.id, 'execution'),
    },
    async () => {
      const approved = await as('plan.approver').post(`${plansPath(plan.id)}/amendments/${amendment.id}/approve`, {
        comment: 'معتمد — يُطرح في الربع الثاني.',
      });
      console.log(`   التعديل: ${approved.status}`);
    },
  );

  const overview = await as('plan.approver').get(plansPath(plan.id));
  const item = overview.items.find((i) => i.title === amendment.payload.title && !i.linkedId);
  if (!item) throw new Error('لم يُعثر على البند المضاف بالتعديل');
  return item.id;
}

/** يرجع خطة معتمدة فيها بند معتمد من الإدارة تُطرح منه المنافسة. */
export async function runPlan({ reusePlanId = argValue('reuse-plan') ?? process.env.PLAN_REUSE_ID } = {}) {
  const path = await choosePath(reusePlanId);
  let planId;
  let itemId;

  if (path.mode === 'fresh') {
    const plan = await step(
      {
        who: 'plan.announcer',
        title: `معلن الخطة يعلن «خطة المشتريات ${path.year}» ويفتح نافذة تقديم خطط الإدارات أسبوعًا`,
        screen: '/portal/plan',
      },
      async () => {
        const now = Date.now();
        const announced = await as('plan.announcer').post(`${plansPath()}/announce`, {
          year: path.year,
          title: `خطة المشتريات ${path.year} — ${DEMO_MARK} ${RUN}`,
          // تُفتح قبل دقائق (هامشٌ لفرق الساعة مع الخادم) وتُقفل بعد أسبوع.
          submissionOpensAt: new Date(now - 5 * MINUTE).toISOString(),
          submissionClosesAt: new Date(now + 7 * DAY).toISOString(),
          notes: `خطة سيناريو العرض (${RUN}).`,
        });
        console.log(`   الخطة: ${announced.id} — سنة ${announced.year} — ${announced.status} — النافذة: ${announced.submissionWindow}`);
        return announced;
      },
    );
    planId = plan.id;
    itemId = await departmentFlow(plan.id, plan.year);
    await reviewAndApprove(plan);
  } else if (path.mode === 'resume') {
    let plan = path.plan;
    console.log(`\n   لا سنة حرّة — نكمل الخطة «${plan.title}» (${plan.year}، ${plan.status}).`);
    planId = plan.id;
    if (plan.status === 'announced') {
      if (plan.submissionWindow === 'scheduled') {
        plan = await step(
          {
            who: 'plan.announcer',
            title: 'معلن الخطة يقدّم موعد فتح نافذة التقديم إلى الآن',
            screen: planScreen(plan.id, 'announce'),
          },
          () =>
            as('plan.announcer').patch(`${plansPath(plan.id)}/announcement`, {
              submissionOpensAt: new Date(Date.now() - MINUTE).toISOString(),
              submissionClosesAt: new Date(Date.now() + 7 * DAY).toISOString(),
            }),
        );
      }
      if (plan.submissionWindow === 'closed') throw new Error(`نافذة الخطة ${plan.id} مقفلة — لا يمكن إضافة بند`);
      itemId = await departmentFlow(plan.id, plan.year);
    } else {
      const { items } = await as('plan.approver').get(plansPath(plan.id));
      const ready = items.find((i) => i.submissionStatus === 'dept_approved' && !i.linkedId);
      if (!ready) throw new Error(`الخطة ${plan.id} مراجَعة ولا بند معتمدًا غير مرتبط فيها`);
      itemId = ready.id;
    }
    await reviewAndApprove(plan);
  } else {
    console.log(`\n   لا سنة حرّة — نضيف البند لخطة العرض المعتمدة «${path.plan.title}» بتعديل خطة.`);
    planId = path.plan.id;
    itemId = await amendFlow(path.plan);
  }

  // تحقّق: الخطة معتمدة والبند فيها ظاهر لغير أصحابه.
  const overview = await as('plan.approver').get(plansPath(planId));
  const item = overview.items.find((i) => i.id === itemId);
  if (!['approved', 'active'].includes(overview.plan.status)) {
    throw new Error(`الخطة ${planId} لم تُعتمد (الحالة: ${overview.plan.status})`);
  }
  if (!item) throw new Error(`البند ${itemId} غير ظاهر في الخطة ${planId}`);
  const planYear = item.planYear ?? overview.plan.year;
  console.log(
    `\n   ✔ الخطة ${planId} (${overview.plan.status}، ${planYear}) — البند ${itemId} «${item.title}» ` +
      `${item.estimatedBudget?.toLocaleString('en')} ريال — ${item.submissionStatus ?? 'بند تعديل'}`,
  );
  return { planId, itemId, planYear };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPlan()
    .then((r) => console.log(JSON.stringify(r)))
    .catch((err) => {
      console.error(`\n✗ ${err.message}`);
      if (err.data) console.error(JSON.stringify(err.data));
      process.exitCode = 1;
    })
    .finally(done);
}
