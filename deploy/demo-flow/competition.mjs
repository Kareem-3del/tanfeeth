#!/usr/bin/env node
/**
 * مرحلة المشروع (المنافسة): من إنشاء المشروع إلى توقيع العقد — كلُّ خطوةٍ
 * بحساب صاحبها، فيظهر فصلُ المهام كما هو.
 *
 *   node deploy/demo-flow/competition.mjs [--auto] [--plan-item <id>] [--resume <competitionId>]
 *
 * `--plan-item` يربط المشروع ببند خطة (اختياري — بدونه يُنشأ بلا تصنيف خطة).
 * `--resume` يكمل منافسةً قائمة من مرحلتها الحالية (للتجريب بعد عطل).
 *
 * يُستورد أيضًا: `const { competitionId, contractId } = await runCompetition({ planItemId })`
 * (ثم `done()` من lib عند نهاية السيناريو كله).
 *
 * المهل الزمنية: موعد تسليم العروض في الكراسة أمسِ (لا يحرس الخادمُ تسجيل العروض
 * بالتاريخ، ووقتُ جلسة الفتح يجب ألا يكون في المستقبل)؛ وفترة التوقف تُنهى بـ
 * `award/standstill/waive` — متاحة على staging لأن DEMO_IMPERSONATION=true.
 * النشر على اعتماد مُحاكى: يُقيَّد رقم الإعلان فقط.
 */

import { API, AUTO, RUN, as, daysFromNow, done, step, userId } from './lib.mjs';

/* ── أدوات صغيرة ─────────────────────────────────────────────────────────── */

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};

/** تاريخٌ بصيغة الكراسة: يوم/شهر/سنة. */
const dmy = (d) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

const STAGES = [
  'order_creation',
  'bid_document',
  'pre_qualification',
  'announcement',
  'technical_opening',
  'technical_evaluation',
  'financial_opening',
  'financial_award',
  'contract_drafting',
  'project_start',
];
const before = (c, stage) => STAGES.indexOf(c.stage) < STAGES.indexOf(stage);

const screen = (id, phase, section) =>
  `/portal/competitions/${id}?phase=${phase}${section ? `&section=${section}` : ''}`;

const note = (text) => console.log(`   · ${text}`);
const warn = (text) => console.log(`   ⚠ ${text}`);

/** الفعلُ التالي على الملف وما يمنعه — من `/state` بعين من يسأل. */
async function nextAction(who, id) {
  try {
    const state = await as(who).get(`/competitions/${id}/state`);
    return [state.next, ...(state.alternates ?? [])]
      .filter(Boolean)
      .map((a) => `${a.actionKey} (${a.permission})${a.enabled ? '' : ` — ${(a.blockers ?? []).join(' | ')}`}`);
  } catch (error) {
    return [`(تعذّرت قراءة الحالة: ${error.message})`];
  }
}

/** القيمة التقديرية المختومة (ريال) — تُكشف عند فتح العروض المالية. */
const ESTIMATED_VALUE = 950000;

/* ── بيانات الكراسة ──────────────────────────────────────────────────────── */

const BOQ_ROWS = [
  { item: 'توريد أجهزة حاسب مكتبية جديدة وغير مستعملة', unit: 'جهاز', count: '60', category: 'أجهزة حاسب مكتبية', description: 'جهاز حاسب مكتبي جديد مع لوحة مفاتيح وفأرة', specifications: 'معالج حديث، ذاكرة 16GB، قرص SSD سعة 512GB' },
  { item: 'توريد أجهزة حاسب محمول جديدة وغير مستعملة', unit: 'جهاز', count: '20', category: 'أجهزة حاسب محمولة', description: 'حاسب محمول 14 بوصة مع حقيبة', specifications: 'معالج حديث، ذاكرة 16GB، قرص SSD سعة 512GB' },
];

/** يربط كل سطر جدول كميات ببندٍ من سجل المنتجات والأسعار (شرط الإرسال). */
async function linkBoqRows(who) {
  const meta = [];
  for (const row of BOQ_ROWS) {
    const found = await as(who).get(`/catalog/items?limit=5&q=${encodeURIComponent(row.item)}`);
    let item = (found.items ?? []).find((i) => i.name === row.item) ?? (found.items ?? [])[0];
    if (!item) item = await as(who).post('/catalog/items', { name: row.item, unit: row.unit, category: 'تقنية المعلومات' });
    meta.push({ source: 'manual', catalogItemId: item.id });
  }
  return meta;
}

function tenderData({ title, entrantId, entrantName, boqMeta }) {
  const deadline = daysFromNow(-1); // آخر موعد لتقديم العروض: أمس — العرض يجري بعده
  return {
    title,
    competitionType: 'منافسة عامة',
    procurementType: 'supply',
    purpose: 'توريد أجهزة حاسب مكتبية ومحمولة لإدارة تقنية المعلومات بضمان مصنعي ثلاث سنوات — مشروع تجريبي للعرض.',
    activityDescription: 'توريد أجهزة حاسب آلي مكتبية ومحمولة مع الضمان والدعم الفني.',
    bookletDescription: 'منافسة تجريبية لتوريد أجهزة الحاسب الآلي — وفق نظام المنافسات والمشتريات الحكومية.',
    documentsCost: 0,
    estimatedValueEnteredById: entrantId,
    estimatedValueEnteredBy: entrantName,
    submissionMethod: 'ملف واحد',
    technicalCommittee: 'إدارة تقنية المعلومات (تجريبية)',
    openingCommittee: 'لجنة فتح العروض وفحصها — تجريبية',
    examinationCommittee: 'لجنة فتح العروض وفحصها — تجريبية',
    executionLocation: 'داخل المملكة',
    regions: ['منطقة الرياض'],
    cities: ['الرياض'],
    activities: ['تقنية المعلومات'],
    activityYears: 'سنة أو أقل',
    standstillDays: 5,
    deliveryAddress: 'طريق الملك عبدالعزيز، حي الملز — الرياض',
    deliveryBuilding: 'المبنى الرئيسي',
    deliveryFloor: 'الدور الثالث',
    deliveryDepartment: 'إدارة المشتريات والعقود',
    offerDeliveryDate: dmy(deadline),
    offerDeliveryDateCalendar: 'ميلادي',
    offerDeliveryTime: '10:00',
    offerOpeningPlace: 'إلكترونياً على منصة اعتماد',
    inquiryDays: 5,
    offerReceivingDays: 10,
    maxInquiryAnswerDays: 2,
    expectedAwardDate: dmy(daysFromNow(20)),
    expectedAwardDateCalendar: 'ميلادي',
    workStartDate: dmy(daysFromNow(45)),
    workStartDateCalendar: 'ميلادي',
    contractDurationType: 'يوم',
    contractDuration: 90,
    boqTables: [
      { mode: 'table', type: 'المعدات والأجهزة', name: 'جدول أجهزة الحاسب', rows: BOQ_ROWS, rowMeta: boqMeta },
    ],
    agentName: 'ياسر مدخل المنافسة',
    agentPhone: '0110000000',
    agentJob: 'أخصائي مشتريات',
    agentEmail: 'tender.entry@example.com',
    alternativeEmail: 'tenders@example.com',
    agencyDefinition: 'الجهة الحكومية: الجهة التجريبية لمنصة تنفيذ. المتنافس: مقدم العرض.',
    technicalOfferDocuments: ['ملف تعريف بالشركة', 'المواصفة الفنية للأجهزة المعروضة', 'خطة التوريد والتركيب'],
    financialOfferDocuments: ['جدول الكميات مسعّرًا شاملًا الضرائب'],
    documentFormat: 'جميع الملفات بصيغة PDF، وجداول الكميات بصيغة Excel.',
    projectScope: 'توريد 60 جهاز حاسب مكتبي و20 جهاز حاسب محمول جديدة مع الضمان والدعم الفني.',
    workProgram: 'التوريد على دفعتين خلال تسعين يومًا من تاريخ المباشرة.',
    workLocationDetails: 'مستودع الجهة الرئيسي بالرياض.',
    executionMethod: 'اعتماد عيّنة، ثم التوريد على دفعتين، ثم الفحص والاستلام بمحضر.',
    qualitySpecs: 'أجهزة جديدة غير مستعملة من الشركة الصانعة المعتمدة.',
    safetySpecs: 'الالتزام بأنظمة السلامة المعمول بها في المملكة.',
    penalties: 'غرامات التأخير وفق نظام المنافسات والمشتريات الحكومية ولائحته التنفيذية.',
    latePenaltiesFormula: 'تُحتسب على قيمة البند المتأخر بحسب عدد أيام التأخير.',
    latePenaltiesTotalPct: 20,
    attachmentsList: '1. خطاب تقديم العرض\n2. جدول الكميات',
    technicalWeight: 30,
    financialWeight: 70,
    technicalPassScore: 60,
    technicalPassingMechanism: 'على جميع المعايير',
    evaluationCriteria: [
      { title: 'مطابقة الأجهزة للمواصفات', weight: 60, children: [] },
      { title: 'مدة الضمان والدعم الفني', weight: 40, children: [] },
    ],
    qualificationType: 'التأهيل اللاحق',
    requiresPreQualification: false,
    samplesRequired: false,
    initialGuarantee: 'لا يوجد ضمان',
    finalGuarantee: 'الضمان النهائي',
    finalGuaranteePct: 5,
    certificates: ['السجل التجاري', 'شهادة الزكاة'],
    invitationType: 'إعلان بالبوابة (جميع الموردين)',
  };
}

/* ── المراحل ─────────────────────────────────────────────────────────────── */

export async function createProject({
  planItemId,
  title = `تجريبي ${RUN} — توريد أجهزة حاسب لإدارة تقنية المعلومات`,
  description = 'مشروع تجريبي لعرض دورة المنافسة كاملة — بيانات غير حقيقية.',
  procurementType = 'supply',
  requestingDepartment = 'إدارة تقنية المعلومات (تجريبية)',
}) {
  const competition = await step(
    { who: 'tender.entry', title: 'مدخل المنافسة ينشئ المشروع (طلب الطرح)', screen: '/portal/competitions/new' },
    () =>
      as('tender.entry').post('/competitions', {
        title,
        description,
        procurementType,
        tenderType: 'منافسة عامة',
        year: new Date().getFullYear(),
        requestingDepartment,
        ...(planItemId ? { planItemId, planClassification: 'in_plan' } : {}),
      }),
  );
  note(`المشروع: ${competition.id} · ${competition.referenceNumber}${planItemId ? ` · مرتبط ببند الخطة ${planItemId}` : ' · بلا ربط بالخطة'}`);
  return competition;
}

async function fillBooklet(c) {
  const id = c.id;
  const entrant = await as('estimate.entry').get('/auth/me');
  const entrantId = entrant.id;
  await step(
    { who: 'tender.entry', title: 'يعبّئ بيانات الكراسة وجداول الكميات (مربوطة بسجل المنتجات) ويسمّي مدخل القيمة التقديرية', screen: `/portal/competitions/${id}/tender` },
    async () => {
      const boqMeta = await linkBoqRows('tender.entry');
      const saved = await as('tender.entry').patch(`/competitions/${id}/tender-data`, {
        data: tenderData({ title: c.title, entrantId, entrantName: entrant.fullName ?? 'مدخل القيمة التقديرية', boqMeta }),
      });
      note(`مدخل القيمة التقديرية المسمّى: ${entrant.fullName} — القيمة ${saved.estimatedValue?.entered ? 'مدخلة' : 'لم تُدخل بعد'}`);
    },
  );

  await step(
    { who: 'estimate.entry', title: 'مدخل القيمة التقديرية يُدخلها مختومة — لا يراها غيره حتى فتح العروض المالية', screen: `/portal/competitions/${id}/tender` },
    async () => {
      try {
        const saved = await as('estimate.entry').patch(`/competitions/${id}/tender-data`, { data: { estimatedValue: ESTIMATED_VALUE } });
        note(`مختومة: entered=${saved.estimatedValue?.entered} isEntrant=${saved.estimatedValue?.isEntrant}`);
        return;
      } catch (error) {
        if (error.status !== 403) throw error;
        warn(`عائق صلاحية: ${error.message}`);
        warn('estimate.entry يملك competitions.read وحدها على هذه البيئة، وحفظ بيانات الطرح (PATCH /tender-data) محروسٌ بـcompetitions.update.');
        warn('الإصلاح: أضف competitions.update لدور «قراءة المنافسات — تجريبي» في deploy/seed-demo-users.mjs وأعد تشغيله.');
      }
      /* بديلٌ مُعلَن ليكمل العرض: مدخل المنافسة يسمّي نفسَه مدخلًا (تسميةٌ جديدة تُفرغ القيمة) ثم يُدخلها. */
      warn('بديل مؤقت (يخالف فصل المهام المقصود): مدخل المنافسة يسمّي نفسه مدخلًا للقيمة ويُدخلها.');
      const me = await as('tender.entry').get('/auth/me');
      await as('tender.entry').patch(`/competitions/${id}/tender-data`, { data: { estimatedValueEnteredById: me.id, estimatedValueEnteredBy: me.fullName } });
      const saved = await as('tender.entry').patch(`/competitions/${id}/tender-data`, { data: { estimatedValue: ESTIMATED_VALUE } });
      note(`مختومة: entered=${saved.estimatedValue?.entered} isEntrant=${saved.estimatedValue?.isEntrant}`);
    },
  );

  const view = await as('tender.auditor').get(`/competitions/${id}/tender-data`);
  note(`مدققة المنافسة ترى: مدخلة=${view.estimatedValue?.entered} · ظاهرة لها=${view.estimatedValue?.visible} · القيمة في الرد: ${'estimatedValue' in (view.data ?? {}) ? 'ظاهرة' : 'محجوبة'}`);
}

export async function submitAndApprove(c, { budget } = {}) {
  const id = c.id;
  if (budget) {
    /* الميزانيةُ المعتمدة تُقيَّد قبل البتّ النهائي — وعليها يُحكم BR-01 (مظروفان فوق ٥ ملايين). */
    await step(
      { who: 'tender.auditor', title: `تُقيّد الميزانية المعتمدة للمشروع (${budget.toLocaleString('en')} ريال) — فوق ٥ ملايين يُقدَّم العرض في ملفين`, screen: screen(id, 'approvals') },
      () => as('tender.auditor').post(`/competitions/${id}/budget`, { amount: budget }),
    );
  }
  await step(
    { who: 'tender.entry', title: 'يرسل الطلب لسلسلة الاعتماد', screen: screen(id, 'creation') },
    () => as('tender.entry').post(`/competitions/${id}/submit`),
  );
  let current = await as('tender.auditor').get(`/competitions/${id}`);
  const chain = current.approvalChain ?? [];
  note(`سلسلة الاعتماد: ${chain.map((s) => s.label ?? s.role).join(' ← ')}`);
  for (const s of chain) {
    if (s.status === 'approved') continue;
    await step(
      { who: 'tender.auditor', title: `مدققة المنافسة تعتمد خطوة «${s.label ?? s.role}»`, screen: screen(id, 'approvals') },
      () => as('tender.auditor').post(`/competitions/${id}/decision`, { decision: 'approve', comment: `اعتماد تجريبي — ${s.role}` }),
    );
  }
  current = await as('tender.auditor').get(`/competitions/${id}`);
  note(`الحالة: ${current.status} · المرحلة: ${current.stage}`);
  return current;
}

export async function approveBooklet(c) {
  const id = c.id;
  const me = await userId('tender.entry');
  await step(
    { who: 'tender.entry', title: 'يفتح كراسة الشروط ويُسندها لنفسه ثم يرفعها للاعتماد', screen: `/portal/competitions/${id}/booklet` },
    async () => {
      try {
        await as('tender.entry').post(`/competitions/${id}/bid-document`);
      } catch (error) {
        if (error.status !== 409) throw error; // مفتوحة سلفًا
      }
      const doc = await as('tender.entry').get(`/competitions/${id}/bid-document`);
      if (doc.status === 'draft') await as('tender.entry').post(`/competitions/${id}/bid-document/assign`, { staffId: me });
      if (['draft', 'assigned', 'in_drafting'].includes((await as('tender.entry').get(`/competitions/${id}/bid-document`)).status)) {
        await as('tender.entry').post(`/competitions/${id}/bid-document/submit`);
      }
    },
  );
  await step(
    { who: 'tender.entry', title: 'يعتمد الكراسة بصيغتها النهائية — تتقدم المنافسة إلى التأهيل', screen: `/portal/competitions/${id}/booklet` },
    () => as('tender.entry').post(`/competitions/${id}/bid-document/approve`),
  );
  return as('tender.entry').get(`/competitions/${id}`);
}

/* ── التقييم الفني ومحضره ──────────────────────────────────────────────── */

const TE = (id) => `/competitions/${id}/technical-evaluation`;

const leaves = (criteria) =>
  criteria.flatMap((c) => ((c.children ?? []).length > 0 ? leaves(c.children) : [c]));

/** درجةُ كل عضوٍ على كل عرض — العرض الثالث دون حدّ الاجتياز ليظهر الإخفاق الفني. */
const SCORE_BY_BIDDER = [88, 76, 45];

/** توقيعٌ مكتوب بالاسم الرباعي إن اكتمل، وإلا توقيعٌ بلا إثبات. */
const typedProof = async (who) => {
  const me = await as(who).get('/auth/me');
  const parts = (me.fullName ?? '').trim().split(/\s+/);
  return parts.length >= 4 ? { proof: { method: 'typed', typedName: me.fullName } } : {};
};

async function technicalEvaluation(c, ctx) {
  const id = c.id;
  const scr = screen(id, 'evaluation', 'scoring');
  let evaluation = await as('tender.auditor').get(TE(id)).catch(() => null);
  if (!evaluation) {
    await step(
      { who: 'tender.auditor', title: 'مدققة المنافسة تفتح جلسة التقييم الفني وتكلّف لجنة التقييم الفني — تُجمَّد معايير الكراسة وأوزانها', screen: scr },
      () => as('tender.auditor').post(`${TE(id)}/open`, { committeeId: ctx.tech.id }),
    );
    evaluation = await as('tender.auditor').get(TE(id));
  }
  const criteria = leaves(evaluation.criteria ?? []);
  note(`المعايير: ${criteria.map((x) => `${x.id} ${x.title}`).join(' · ')} — حدّ الاجتياز ${evaluation.passThreshold}`);

  if (evaluation.status === 'open') {
    for (const member of ctx.tech.seats) {
      const memberId = ctx.idOf.get(member.who);
      const pending = (evaluation.offers ?? []).filter(
        (o) => !(o.members ?? []).some((m) => m.evaluatorId === memberId && m.submittedAt),
      );
      if (pending.length === 0) continue;
      await step(
        { who: member.who, title: `${member.label}: تقييم العروض معيارًا معيارًا وتسليمه`, screen: scr },
        async () => {
          for (const [index, offer] of pending.entries()) {
            const base = SCORE_BY_BIDDER[ctx.bidderIndex.get(offer.offerId) ?? index] ?? 70;
            await as(member.who).post(`${TE(id)}/offers/${offer.offerId}/start`, {});
            for (const [k, criterion] of criteria.entries()) {
              await as(member.who).post(`${TE(id)}/offers/${offer.offerId}/scores`, {
                criterionId: criterion.id,
                score: Math.max(0, Math.min(100, base + (k % 2 === 0 ? 2 : -2))),
                comment: 'تقييم تجريبي',
              });
            }
            await as(member.who).post(`${TE(id)}/offers/${offer.offerId}/submit`);
          }
        },
      );
    }
    const consolidated = await step(
      { who: 'tender.auditor', title: 'مدققة المنافسة تجمّع نتيجة التقييم — يجتاز من بلغ حدّ الاجتياز', screen: scr },
      () => as('tender.auditor').post(`${TE(id)}/consolidate`),
    );
    for (const row of consolidated.offers ?? []) {
      note(`${row.contractorName}: ${row.consolidatedTechnicalScore ?? '—'} → ${row.status}`);
    }
  }

  const minuteScreen = screen(id, 'evaluation', 'minute');
  const readMinute = () => as('tender.auditor').get(`${TE(id)}/minute`).catch(() => null);
  let minute = await readMinute();
  if (!minute || minute.status === 'draft' || minute.status === 'returned') {
    await step(
      { who: 'tender.auditor', title: 'تُصدر محضر التقييم الفني وتخرجه للتوقيع', screen: minuteScreen },
      async () => {
        if (!minute || minute.status === 'returned') await as('tender.auditor').post(`${TE(id)}/minute`, { notes: 'محضر تجريبي' });
        await as('tender.auditor').post(`${TE(id)}/minute/release`);
      },
    );
    minute = await readMinute();
  }
  for (const signer of minute.status === 'pending_signatures' ? minute.pendingSigners ?? [] : []) {
    const who = ctx.whoById.get(signer.userId);
    if (!who) throw new Error(`موقّعٌ في المحضر ليس من الحسابات التجريبية: ${signer.name}`);
    await step(
      { who, title: `توقيع محضر التقييم الفني — ${signer.name}`, screen: minuteScreen },
      async () => as(who).post(`${TE(id)}/minute/sign`, await typedProof(who)),
    );
  }
  minute = await readMinute();
  if (minute.status === 'signed') {
    await step(
      { who: 'tender.auditor', title: 'ترفع المحضر الموقَّع إلى لجنة فتح العروض وفحصها', screen: minuteScreen },
      () => as('tender.auditor').post(`${TE(id)}/minute/raise`, { committeeId: ctx.open.id }),
    );
    minute = await readMinute();
  }
  if (minute.status === 'in_examination') {
    const chairId = ctx.idOf.get('open.chair');
    for (const signer of minute.pendingExaminationSigners ?? []) {
      const who = ctx.whoById.get(signer.userId);
      await step(
        { who, title: `اعتماد محضر التقييم الفني والتصويت على التوصية — ${signer.name} (لجنة الفحص)`, screen: minuteScreen },
        async () => {
          await as(who).post(`${TE(id)}/minute/examination-approval`, await typedProof(who));
          await as(who).post(`${TE(id)}/minute/vote`, { choice: 'for' });
        },
      );
    }
    minute = await readMinute();
    for (const signer of minute.voteTally?.outstanding ?? []) {
      if (signer.userId === chairId) continue;
      const who = ctx.whoById.get(signer.userId);
      await step({ who, title: `التصويت بالموافقة على التوصية — ${signer.name}`, screen: minuteScreen }, () =>
        as(who).post(`${TE(id)}/minute/vote`, { choice: 'for' }),
      );
    }
    await step(
      { who: 'open.chair', title: 'رئيس لجنة الفحص يصوّت ثم يعتمد محضر التقييم الفني — اعتمادُه آخرُ ما يقع', screen: minuteScreen },
      async () => {
        const latest = await readMinute();
        if ((latest.voteTally?.outstanding ?? []).some((x) => x.userId === chairId)) {
          await as('open.chair').post(`${TE(id)}/minute/vote`, { choice: 'for' });
        }
        await as('open.chair').post(`${TE(id)}/minute/decide`, { approved: true, comment: 'اعتماد تجريبي', ...(await typedProof('open.chair')) });
      },
    );
    minute = await readMinute();
  }
  note(`محضر التقييم الفني: ${minute.status}`);
}

/* ── اللجان وحساباتها ────────────────────────────────────────────────────── */

const OPEN_COMMITTEE = 'لجنة فتح العروض وفحصها — تجريبية';
const TECH_COMMITTEE = 'لجنة التقييم الفني — تجريبية';
const SEATS = {
  open: ['open.chair', 'open.deputy', 'open.secretary', 'open.expert', 'open.member'],
  tech: ['tech.chair', 'tech.deputy', 'tech.secretary', 'tech.member'],
};

/**
 * من يقوم بأعمال اللجنة الإجرائية (`competitions.committee`): تسجيل العروض،
 * عقد جلسة الفتح وقائمة تحقّقها، رصد الأسعار، ونقل الملف بين المراحل.
 * المقصود أمين لجنة فتح العروض وفحصها؛ فإن لم يملك الصلاحية على هذه البيئة
 * (مقعد لجنة الفحص يمنح `competitions.examine` وحدها) حلّ محلّه أمين لجنة
 * التقييم الفني — ويُطبع ذلك تحذيرًا.
 */
async function pickClerk() {
  for (const who of ['open.secretary', 'tech.secretary']) {
    const me = await as(who).get('/auth/me');
    if ((me.permissions ?? []).includes('competitions.committee')) {
      if (who !== 'open.secretary') {
        warn('أمين لجنة فتح العروض (open.secretary) لا يملك competitions.committee على هذه البيئة — مقعد لجنة الفحص يمنح competitions.examine وحدها،');
        warn('وعقد جلسة الفتح وقائمة تحققها وتسجيل العروض ورصد الأسعار ونقل المراحل كلها على competitions.committee. ينوب عنه tech.secretary.');
      }
      return who;
    }
  }
  throw new Error('لا يوجد حسابٌ تجريبي يملك competitions.committee');
}

export async function committeesContext() {
  const ctx = { whoById: new Map(), idOf: new Map(), bidderIndex: new Map() };
  for (const who of [...SEATS.open, ...SEATS.tech]) {
    const id = await userId(who);
    ctx.whoById.set(id, who);
    ctx.idOf.set(who, id);
  }
  const listed = await as('tech.chair').get('/committees');
  const all = Array.isArray(listed) ? listed : listed.items;
  for (const [key, name] of [['open', OPEN_COMMITTEE], ['tech', TECH_COMMITTEE]]) {
    const committee = all.find((x) => x.name === name && x.status === 'active');
    if (!committee) throw new Error(`اللجنة غير موجودة على البيئة: ${name} — شغّل deploy/seed-demo-users.mjs`);
    const members = (committee.members ?? []).filter((m) => !m.activeTo);
    ctx[key] = {
      id: committee.id,
      name,
      members,
      seats: SEATS[key].map((who) => ({ who, label: members.find((m) => m.userId === ctx.idOf.get(who))?.jobTitle ?? who })),
    };
  }
  ctx.clerk = await pickClerk();
  return ctx;
}

export async function conflictDeclarations(ctx) {
  for (const key of ['open', 'tech']) {
    const committee = ctx[key];
    for (const seat of committee.seats) {
      const member = committee.members.find((m) => m.userId === ctx.idOf.get(seat.who));
      if (member?.conflictDeclaredAt) continue;
      await step(
        { who: seat.who, title: `إقرار عدم تعارض المصالح — ${seat.label} (${committee.name})`, screen: '/portal/committees' },
        () => as(seat.who).post(`/committees/${committee.id}/members/me/conflict-declaration`),
      );
    }
  }
}

/* ── الإعلان والعروض وجلسة الفتح ────────────────────────────────────────── */

const BIDDERS = [
  { name: `شركة الرواد للحلول التقنية (تجريبي ${RUN})`, email: `bidder1.${RUN}@example.com` },
  { name: `مؤسسة الأفق للتجهيزات المكتبية (تجريبي ${RUN})`, email: `bidder2.${RUN}@example.com` },
  { name: `شركة المدار لتقنية المعلومات (تجريبي ${RUN})`, email: `bidder3.${RUN}@example.com` },
].map((b, i) => ({ ...b, cr: `10${RUN.slice(1)}${i + 1}`, unified: `70${RUN.slice(1)}${i + 1}` }));

/** السعر المقروء من المظروف المالي — للعرضين المجتازين فنيًا. */
const PRICES = [912_500, 884_000, 869_000];

/** عروض المنافسة (`GET /offers` يرجع `{ offers, comparison, submission }`). */
const listOffers = async (id) => (await as('tender.entry').get(`/competitions/${id}/offers`)).offers ?? [];

const advance = (ctx, id, stage) => as(ctx.clerk).post(`/competitions/${id}/advance-stage`, { stage });

/** التأهيل اللاحق ← الإعلان، ثم قيدُ نشر الإعلان برقمه في اعتماد. */
export async function publishAnnouncement(c, ctx) {
  const id = c.id;
  if (c.stage === 'pre_qualification') {
    await step(
      { who: ctx.clerk, title: 'التأهيل لاحق في هذه الكراسة — يُنقل الملف إلى مرحلة الإعلان', screen: screen(id, 'publishing') },
      () => advance(ctx, id, 'announcement'),
    );
  }
  c = await as('tender.entry').get(`/competitions/${id}`);
  if (!c.publishedAt) {
    await step(
      { who: ctx.clerk, title: 'يُقيّد نشر إعلان المنافسة برقمه في منصة اعتماد (النشر نفسه في اعتماد مُحاكى)', screen: screen(id, 'publishing') },
      () => as(ctx.clerk).post(`/competitions/${id}/announcement`, { reference: `ETM-DEMO-${RUN}` }),
    );
  }
  return as('tender.entry').get(`/competitions/${id}`);
}

async function announcementAndOffers(c, ctx) {
  const id = c.id;
  await publishAnnouncement(c, ctx);
  let offers = await listOffers(id);
  if (offers.length === 0) {
    await step(
      { who: ctx.clerk, title: `بعد انقضاء موعد التقديم: تُسجَّل ${BIDDERS.length} عروض وردت من متنافسين (بيانات وهمية @example.com)`, screen: screen(id, 'upload') },
      async () => {
        for (const bidder of BIDDERS) {
          const offer = await as(ctx.clerk).post(`/competitions/${id}/offers`, {
            contractorName: bidder.name,
            contractorCr: bidder.cr,
            contractorUnifiedNumber: bidder.unified,
          });
          try {
            await as(ctx.clerk).post(`/competitions/${id}/offers/${offer.id}/answers`, { identity: { contractorEmail: bidder.email } });
          } catch (error) {
            warn(`لم يُسجَّل بريد ${bidder.name}: ${error.message}`);
          }
          note(`${bidder.name} · س.ت ${bidder.cr} · ${bidder.email}`);
        }
        await as(ctx.clerk).post(`/competitions/${id}/participation`, { buyersCount: 5, applicantsCount: BIDDERS.length });
      },
    );
    offers = await listOffers(id);
  }
  return offers;
}

function rememberBidders(ctx, offers) {
  for (const offer of offers) {
    const index = BIDDERS.findIndex((b) => b.cr === offer.contractorCr || b.name === offer.contractorName);
    ctx.bidderIndex.set(offer.id, index === -1 ? ctx.bidderIndex.size : index);
  }
}

/** جلسة فتح (فنية أو مالية): عقدُها، فقائمةُ التحقّق، فإخراجُ المحضر، فتوقيعُ الحاضرين. */
async function openingSession(c, ctx, kind, { beforeRelease } = {}) {
  const id = c.id;
  const base = `/competitions/${id}/opening-sessions/${kind}`;
  const label = kind === 'technical' ? 'الفنية' : 'المالية';
  const scr = screen(id, 'evaluation', kind === 'technical' ? 'opening' : 'financial');
  let session = await as('tender.entry').get(base); // أعضاء اللجان لا يملكون competitions.read على البيئة
  if (!session) {
    session = await step(
      { who: ctx.clerk, title: `يعقد جلسة فتح العروض ${label} بحضور لجنة فتح العروض وفحصها ويحمّل العروض في محضرها`, screen: scr },
      () =>
        as(ctx.clerk).post(base, {
          openedAt: new Date(Date.now() - 60_000).toISOString(),
          committeeId: ctx.open.id,
          venue: 'قاعة اللجان — المبنى الرئيسي',
          notes: `جلسة تجريبية (${RUN})`,
        }),
    );
  }
  if (session.status === 'draft') {
    if (beforeRelease) await beforeRelease();
    await step(
      { who: ctx.clerk, title: `يفحص قائمة التحقّق لكل عرض (جداول الكميات، الضمان، الشهادات، وثائق الكراسة) ثم يُخرج المحضر للتوقيع`, screen: scr },
      async () => {
        for (const entry of session.entries ?? []) {
          for (const row of entry.checklist ?? []) {
            const result = row.key === 'bank_guarantee' ? 'not_required' : 'present';
            if ((row.outcome?.result ?? row.result) === result) continue;
            await as(ctx.clerk).put(`${base}/offers/${entry.offerId}/checks`, { item: row.key, result, note: 'فُحص في الجلسة (تجريبي)' });
          }
        }
        session = await as(ctx.clerk).post(`${base}/release`);
      },
    );
  }
  for (const seatId of session.pendingSeatIds ?? []) {
    const who = ctx.whoById.get(seatId);
    if (!who) throw new Error(`مقعدٌ في المحضر ليس من الحسابات التجريبية: ${seatId}`);
    session = await step(
      { who, title: `توقيع محضر فتح العروض ${label} — ${ctx.open.seats.find((s) => s.who === who)?.label ?? who}`, screen: scr },
      async () => as(who).post(`${base}/sign`, await typedProof(who)),
    );
  }
  note(`محضر فتح العروض ${label}: ${session.status}`);
}

/* ── المالي والترسية والعقد ─────────────────────────────────────────────── */

async function financialStage(c, ctx) {
  const id = c.id;
  const scr = screen(id, 'evaluation', 'financial');
  if (c.stage === 'technical_evaluation') {
    await step(
      { who: ctx.clerk, title: 'يرسل الملف إلى فتح العروض المالية — المحضر الفني معتمد', screen: scr },
      () => advance(ctx, id, 'financial_opening'),
    );
  }
  rememberBidders(ctx, await listOffers(id));
  const recordPrices = async () => {
    const missing = (await listOffers(id)).filter((o) => o.status === 'technically_passed' && o.financialAmount == null);
    if (missing.length === 0) return;
    await step(
      { who: ctx.clerk, title: `يرصد قيم المظاريف المالية للعروض المجتازة فنيًا (${missing.length})`, screen: scr },
      async () => {
        const entries = missing.map((o) => ({ offerId: o.id, amount: PRICES[ctx.bidderIndex.get(o.id) ?? 0] }));
        await as(ctx.clerk).post(`/competitions/${id}/financial-opening`, { entries });
        for (const e of entries) note(`${missing.find((o) => o.id === e.offerId)?.contractorName}: ${e.amount.toLocaleString('en')} ريال`);
      },
    );
  };
  await openingSession({ id }, ctx, 'financial', { beforeRelease: recordPrices });
  await recordPrices();
  await step(
    { who: ctx.clerk, title: 'ينقل الملف إلى التقييم المالي والترسية — تنكشف القيمة التقديرية', screen: screen(id, 'award') },
    () => advance(ctx, id, 'financial_award'),
  );
  const revealed = await as('tender.entry').get(`/competitions/${id}/tender-data`);
  note(`القيمة التقديرية بعد الكشف: ${revealed.data?.estimatedValue ?? '—'} (revealed=${revealed.estimatedValue?.revealed})`);
}

async function award(c, ctx) {
  const id = c.id;
  const scr = screen(id, 'award');
  let current = await as('award.approver').get(`/competitions/${id}`);
  if (current.finalBudgetCommitment == null) {
    await step(
      { who: 'tender.auditor', title: 'تقرّ الالتزام المالي النهائي وطلب الارتباط على الميزانية', screen: scr },
      () => as('tender.auditor').post(`/competitions/${id}/budget-commitment`, { amount: ESTIMATED_VALUE, reference: `BC-DEMO-${RUN}` }),
    );
  }
  let board = await as('award.approver').get(`/competitions/${id}/financial-award`);
  if (!current.awardedOfferId) {
    await step(
      { who: 'award.approver', title: 'صاحب الصلاحية يُصدر قرار الترسية المبدئي على صاحب المرتبة الأولى — تبدأ فترة التوقف', screen: scr },
      async () => {
        if ((board.blockers ?? []).length > 0) note(`موانع: ${board.blockers.join(' | ')}`);
        const winner = board.winnerOfferId;
        if (!winner) throw new Error(`لا فائز في لوحة الترسية: ${JSON.stringify(board).slice(0, 400)}`);
        await as('award.approver').post(`/competitions/${id}/award`, {
          offerId: winner,
          awardingLetterReference: `AWD-DEMO-${RUN}`,
          letterOfIntentReference: `LOI-DEMO-${RUN}`,
        });
      },
    );
    current = await as('award.approver').get(`/competitions/${id}`);
    const winner = (await listOffers(id)).find((o) => o.id === current.awardedOfferId);
    note(`الترسية على: ${winner?.contractorName ?? current.awardedOfferId} (${winner?.financialAmount?.toLocaleString('en') ?? '—'} ريال) · فترة التوقف تنتهي ${current.standstillEndsAt}`);
  }
  if (current.status !== 'awarded') {
    await step(
      { who: 'award.approver', title: 'يدوّن إشعار المتنافسين بقرار الترسية', screen: `/portal/competitions/${id}?phase=award` },
      () => as('award.approver').post(`/competitions/${id}/award-notice`, {}),
    ).catch((error) => warn(`إشعار الترسية: ${error.message}`));
    if (current.standstillEndsAt && new Date(current.standstillEndsAt) > new Date()) {
      await step(
        { who: 'award.approver', title: 'فترة التوقف (التظلّم) خمسة أيام عمل — تُنهى لأجل العرض (خاصية تجريبية على staging)', screen: scr },
        () => as('award.approver').post(`/competitions/${id}/award/standstill/waive`, { reason: `عرض تجريبي ${RUN}` }),
      );
    }
    await step(
      { who: 'award.approver', title: 'يعتمد الترسية — تصير المنافسة مُرساة وتنتقل إلى إعداد العقد', screen: scr },
      () => as('award.approver').post(`/competitions/${id}/award/confirm`),
    );
  }
}

async function contract(c) {
  const id = c.id;
  const scr = screen(id, 'contract');
  let current = await as('contract.signer').get(`/competitions/${id}`);
  if (!current.contractScenario) {
    await step(
      { who: 'contract.signer', title: 'مفوّض التوقيع يحدّد سيناريو توقيع العقد (عبر منصة اعتماد)', screen: scr },
      () => as('contract.signer').post(`/competitions/${id}/contract/scenario`, { scenario: 'etimad', documentReference: `CT-DEMO-${RUN}` }),
    );
  }
  const signed = new Set((current.signatures ?? []).map((s) => s.party));
  const parties = [
    ['contractor', 'المتعاقد'],
    ['legal', 'الشؤون القانونية'],
    ['budget', 'الميزانية'],
    ['cdm', 'إدارة العقود والمشتريات'],
    ['higher_management', 'صاحب الصلاحية'],
  ].filter(([party]) => !signed.has(party));
  if (parties.length > 0) {
    await step(
      { who: 'contract.signer', title: `يسجّل توقيع أطراف العقد: ${parties.map(([, l]) => l).join('، ')}`, screen: scr },
      async () => {
        for (const [party] of parties) await as('contract.signer').post(`/competitions/${id}/contract/sign`, { party });
      },
    );
  }
  current = await as('contract.signer').get(`/competitions/${id}`);
  if (current.status !== 'contracted') {
    current = await step(
      { who: 'contract.signer', title: 'يُتمّ العقد ويسلّمه إلى وحدة العقود — يُنشأ سجلّ العقد', screen: scr },
      () => as('contract.signer').post(`/competitions/${id}/contract/finalize`),
    );
  }
  if (current.contractId) {
    const record = await as('contract.signer').get(`/contracts/${current.contractId}`);
    note(`العقد ${record.contractNumber ?? ''} · ${record.status ?? ''} · ${record.contractorName ?? record.contractor?.name ?? ''} · ${(record.value ?? record.contractValue ?? '').toLocaleString?.('en') ?? ''} · /portal/contracts/${current.contractId}`);
  }
  return current;
}

/* ── التشغيل ─────────────────────────────────────────────────────────────── */

export async function runCompetition({ planItemId, resumeId } = {}) {
  console.log(`\n═══ مرحلة المشروع: من الإنشاء إلى العقد — ${API} — تشغيل ${RUN}${AUTO ? ' (آلي)' : ''}`);
  const ctx = await committeesContext();
  let c = resumeId ? await as('tender.entry').get(`/competitions/${resumeId}`) : await createProject({ planItemId });
  const id = c.id;
  const reload = () => as('tender.entry').get(`/competitions/${id}`);

  if (c.status === 'draft' || c.status === 'returned') {
    await fillBooklet(c);
    c = await submitAndApprove(c);
  } else if (c.status === 'in_approval') {
    c = await submitAndApprove(c);
  }
  if (c.stage === 'bid_document') c = await approveBooklet(c);

  await conflictDeclarations(ctx);

  if (before(c, 'technical_opening')) {
    const offers = await announcementAndOffers(c, ctx);
    rememberBidders(ctx, offers);
    await step(
      { who: ctx.clerk, title: 'ينقل الملف إلى فتح العروض الفنية', screen: screen(id, 'evaluation', 'opening') },
      () => advance(ctx, id, 'technical_opening'),
    );
    c = await reload();
  }
  if (c.stage === 'technical_opening') {
    await openingSession(c, ctx, 'technical');
    await step(
      { who: ctx.clerk, title: 'المحضر مختوم — يبدأ تقييم العروض', screen: screen(id, 'evaluation', 'scoring') },
      () => advance(ctx, id, 'technical_evaluation'),
    );
    c = await reload();
  }
  if (c.stage === 'technical_evaluation') {
    rememberBidders(ctx, await listOffers(id));
    await technicalEvaluation(c, ctx);
    c = await reload();
  }
  if (c.stage === 'technical_evaluation' || c.stage === 'financial_opening') {
    await financialStage(c, ctx);
    c = await reload();
  }
  if (c.stage === 'financial_award') {
    await award(c, ctx);
    c = await reload();
  }
  if (c.stage === 'contract_drafting') c = await contract(c);

  c = await reload();
  note(`الحال: ${c.stage} / ${c.status}${c.contractId ? ` · العقد ${c.contractId}` : ''}`);
  if (c.status !== 'contracted') for (const b of await nextAction('tender.entry', id)) note(`التالي: ${b}`);
  return { competitionId: id, contractId: c.contractId ?? null };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCompetition({ planItemId: arg('--plan-item'), resumeId: arg('--resume') })
    .then((ids) => {
      console.log(`\n✓ ${JSON.stringify(ids)}`);
      done();
    })
    .catch((error) => {
      console.error(`\n✗ ${error.message}`);
      if (error.data) console.error(JSON.stringify(error.data, null, 1).slice(0, 2000));
      done();
      process.exit(1);
    });
}
