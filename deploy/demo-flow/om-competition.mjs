#!/usr/bin/env node
/**
 * منافسةٌ كاملة لعرض «رفع العروض»: تشغيل وصيانة المباني الإدارية — تعاقد قائم
 * على الأداء (نموذج وزارة المالية)، من بند الخطة حتى نشر الإعلان وانقضاء موعد
 * تقديم العروض، كلُّ خطوةٍ بحساب صاحبها. وتقف هنا: أمينُ لجنة الفحص
 * (open.secretary@example.com) يرفع العروض بنفسه.
 *
 *   node deploy/demo-flow/om-competition.mjs --auto --booklet deploy/demo-flow/data/om-performance-booklet.json [--plan <planId>]
 *
 * `--booklet` ملفُّ نصوص الكراسة المستخرجة من نموذج العقد (النطاق، مؤشرات
 * الأداء، الغرامات، جداول الكميات، معايير التقييم…).
 * `--plan-item` بندُ خطةٍ قائم بدل إضافة بندٍ جديد.
 * `--plan` خطةٌ معتمدة/نافذة يُضاف إليها البند بتعديل خطة (افتراضيًا خطة السنة
 * الحالية). والخطةُ المعتمدة لا يُضاف إليها بندٌ إلا بتعديلٍ يعتمده معتمدُها.
 *
 * المهل: موعدُ تقديم العروض في الكراسة **أمس** — فالاستلامُ منتهٍ والعروضُ
 * تُرفع الآن. وكلُّ ما عدا ذلك من مواعيد متّسقٌ معه (الاستفسارات قبله، والترسية
 * والمباشرة بعده).
 */

import { readFileSync } from 'node:fs';

import { as, daysFromNow, done, RUN, step, userId } from './lib.mjs';
import {
  approveBooklet,
  committeesContext,
  conflictDeclarations,
  createProject,
  publishAnnouncement,
  submitAndApprove,
} from './competition.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const note = (text) => console.log(`   · ${text}`);

/** تاريخٌ بصيغة الكراسة: يوم/شهر/سنة ميلادي. */
const dmy = (d) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

const DEPARTMENT = 'إدارة تقنية المعلومات (تجريبية)';
const OPEN_COMMITTEE = 'لجنة فتح العروض وفحصها — تجريبية';
const TECH_COMMITTEE = 'لجنة التقييم الفني — تجريبية';

/* ── بند الخطة: تعديلُ خطةٍ معتمدة (المخطِّط يطلب، المعتمد يعتمد) ─────────── */

async function planItem(booklet, budget) {
  const { items: plans } = await as('plan.announcer').get('/annual-plans');
  const year = new Date().getFullYear();
  const plan =
    plans.find((p) => p.id === arg('--plan')) ??
    plans.find((p) => ['approved', 'active'].includes(p.status) && p.year <= year && year <= (p.endYear ?? p.year));
  if (!plan) throw new Error(`لا خطة معتمدة تغطي ${year} — مرّر --plan`);

  const title = `تشغيل وصيانة المباني الإدارية — تعاقد قائم على الأداء (${RUN})`;
  const amendment = await step(
    {
      who: 'plan.announcer',
      title: `مسؤول التخطيط يطلب تعديل «${plan.title}» بإضافة بند «تشغيل وصيانة المباني الإدارية»`,
      screen: `/portal/plan/${plan.id}?phase=execution`,
    },
    () =>
      as('plan.announcer').post(`/annual-plans/${plan.id}/amendments`, {
        type: 'add_item',
        payload: {
          title,
          description: booklet.purpose,
          department: DEPARTMENT,
          estimatedBudget: budget,
          expectedQuarter: 4,
          planYear: year,
          notes: 'نوع الطرح: منافسة عامة — تشغيل وصيانة قائم على الأداء (نموذج وزارة المالية).',
        },
        reason: 'انتهاء عقد التشغيل والصيانة الحالي للمباني الإدارية؛ يُطرح بديله بنموذج التعاقد القائم على الأداء.',
      }),
  );
  await step(
    { who: 'plan.approver', title: 'معتمد الخطة يعتمد التعديل فيُضاف البند للخطة', screen: `/portal/plan/${plan.id}?phase=execution` },
    () => as('plan.approver').post(`/annual-plans/${plan.id}/amendments/${amendment.id}/approve`, { comment: 'معتمد — يُطرح في الربع الرابع.' }),
  );
  const overview = await as('plan.approver').get(`/annual-plans/${plan.id}`);
  const item = overview.items.find((i) => i.title === title);
  if (!item) throw new Error('لم يُعثر على البند المضاف بالتعديل');
  note(`الخطة «${plan.title}» (${plan.year}) — البند ${item.id}`);
  return item.id;
}

/* ── جداول الكميات: كلُّ سطرٍ مربوطٌ ببند سجلٍّ مربوطٍ بصنفه في دليل التصنيف ── */

async function linkRow(row) {
  const who = as('tender.entry');
  const found = await who.get(`/catalog/items?limit=5&q=${encodeURIComponent(row.item)}`);
  let item = (found.items ?? []).find((i) => i.name === row.item);
  if (!item) {
    item = await who.post('/catalog/items', {
      name: row.item,
      unit: row.unit,
      category: 'التشغيل والصيانة',
      specification: row.specifications,
      ...(row.classificationCode ? { classificationCode: row.classificationCode } : {}),
    });
  }
  return { source: 'manual', catalogItemId: item.id };
}

/* ── بيانات الكراسة ──────────────────────────────────────────────────────── */

const numbered = (list) => list.map((text, i) => `${i + 1}. ${text}`).join('\n');

function tenderData({ booklet, title, entrant, boq }) {
  const months = booklet.contractDurationMonths;
  const deadline = daysFromNow(-1);
  return {
    /* الخطوة ١ — الأساسيات */
    title,
    competitionType: 'منافسة عامة',
    procurementType: 'maintenance',
    purpose: booklet.purpose,
    agencyTenderNumber: `OM-${RUN}`,
    documentsCost: 1500,
    estimatedValueEnteredBy: entrant.fullName,
    estimatedValueEnteredById: entrant.id,
    submissionMethod: 'ملفين منفصلين ( فني ومالي)',
    invitationType: 'إعلان بالبوابة (جميع الموردين)',
    requiresPreQualification: false,
    qualificationType: 'التأهيل اللاحق',
    hasInternalPreQualification: false,
    frameworkQuestion: false,
    linkedToPriorAnnouncement: false,
    technicalCommittee: TECH_COMMITTEE,
    openingCommittee: OPEN_COMMITTEE,
    examinationCommittee: OPEN_COMMITTEE,

    /* الخطوة ٢ — التصنيف والموقع والضمانات */
    executionLocation: 'داخل المملكة',
    regions: ['منطقة الرياض'],
    cities: ['الرياض'],
    countries: [],
    activities: ['التشغيل والصيانة والنظافة للمنشآت - التشغيل والصيانة'],
    activityDescription: booklet.activityDescription,
    activityYears: months >= 36 ? 'ثلاث سنوات' : months >= 24 ? 'سنتين' : 'سنة أو أقل',
    classificationMaintenance: 'صيانة المباني',
    includesSupplyItems: false,
    standstillDays: 5,
    initialGuarantee: booklet.initialGuaranteePct ? 'ضمان إبتدائي' : 'لا يوجد ضمان',
    initialGuaranteePct: booklet.initialGuaranteePct ?? 1,
    initialGuaranteeAddress: 'الرياض — طريق الملك عبدالعزيز، حي الملز، المبنى الرئيسي، إدارة الشؤون المالية',
    finalGuarantee: 'الضمان النهائي',
    finalGuaranteePct: booklet.finalGuaranteePct ?? 5,
    guaranteeDetails:
      'يُقدَّم الضمان الابتدائي مع العرض ساريًا تسعين يومًا من تاريخ فتح العروض، ويُقدَّم الضمان النهائي خلال خمسة عشر يوم عمل من إشعار الترسية ساريًا حتى الاستلام النهائي، صادرين من بنك مرخّص في المملكة وفق النماذج المعتمدة.',

    /* الخطوة ٣ — العناوين والمواعيد */
    offerOpeningPlace: 'إلكترونياً على منصة اعتماد',
    samplesRequired: false,
    sampleAddressSameAsOffers: false,
    deliveryAddress: 'الرياض — طريق الملك عبدالعزيز، حي الملز',
    deliveryBuilding: 'المبنى الرئيسي',
    deliveryFloor: 'الدور الثالث',
    deliveryDepartment: 'إدارة المشتريات والعقود — غرفة 305',
    offerDeliveryDate: dmy(deadline),
    offerDeliveryDateCalendar: 'ميلادي',
    offerDeliveryTime: '10:00',
    inquiryDays: 10,
    offerReceivingDays: 30,
    maxInquiryAnswerDays: 3,
    expectedAwardDate: dmy(daysFromNow(30)),
    expectedAwardDateCalendar: 'ميلادي',
    workStartDate: dmy(daysFromNow(60)),
    workStartDateCalendar: 'ميلادي',
    contractDurationType: 'شهر',
    contractDuration: months,

    /* الخطوة ٤ — التجزئة */
    divisible: false,
    divisionReason: '',
    divisionPackages: [],
    divisionClassification: 'قطاع التشغيل والصيانة والخدمات',
    subcontractingAllowed: true,
    subcontractingMaxPct: 30,

    /* الخطوة ٥ — بنود جداول الكميات */
    symmetricItemsInBoq: false,
    brandNamesInBoq: false,
    alternativeOffersAllowed: false,

    /* الخطوة ٦ — جداول الكميات */
    boqTables: [boq],
    boqNotes: booklet.paymentTerms,

    /* الخطوة ٧ — الكرّاسة */
    bookletDescription: booklet.bookletDescription,
    agencyDefinition: booklet.agencyDefinition,
    agentName: 'ياسر مدخل المنافسة',
    agentJob: 'أخصائي مشتريات',
    agentPhone: '0114567890',
    agentFax: '0114567891',
    agentEmail: 'tender.entry@example.com',
    alternativeEmail: 'procurement@example.com',
    hideCertificates: false,
    certificates: ['السجل التجاري', 'تصنيف المقاولين', 'شهادة الزكاة', 'شهادة الضريبة', 'التأمينات الاجتماعية', 'شهادة اشتراك الغرفة التجارية', 'شهادة السعودة'],
    technicalOfferDocuments: booklet.technicalOfferDocuments,
    financialOfferDocuments: booklet.financialOfferDocuments,
    documentFormat: booklet.documentFormat,
    certificatesGracePeriodDays: 10,
    contractSigningPeriodDays: 15,
    priceWritingRules: 'لا يجوز لمقدم العرض ترك أي بند من بنود المنافسة دون تسعير إلّا إذا أجازت شروط المنافسة ذلك',
    offersEvaluationText:
      'تتم الترسية على العرض الأفضل من حيث التقييم الشامل (الفني ٦٠٪ والمالي ٤٠٪) من العروض التي اجتازت التقييم الفني.',
    offersCheckingText:
      'تفتح لجنة فحص العروض ملف الأسعار التقديرية، كما تقوم بفتح العروض المالية للعروض الفنية المقبولة في الموعد المحدد لذلك بعد إشعار أصحاب العروض الفنية المقبولة بذلك، وتعلن الأسعار للحاضرين من أصحاب العروض',
    projectScope: booklet.projectScope,
    workProgram: booklet.workProgram,
    workLocationDetails: booklet.workLocationDetails,
    executionMethod: booklet.executionMethod,
    deliverables: booklet.deliverables,
    termsAndDefinitions: booklet.termsAndDefinitions,
    essentialRequirements: booklet.essentialRequirements ?? [],
    saudiExperienceYears: '',
    teamConditions: booklet.teamConditions,
    qualitySpecs: booklet.qualitySpecs,
    safetySpecs: booklet.safetySpecs,
    serviceLevelAgreement: booklet.serviceLevelAgreement,
    includesTraining: false,
    projectInsurance: true,
    insuranceRequirements: booklet.insuranceRequirements,
    specialConditions: booklet.specialConditions,
    requiresSpecializedTechCapabilities: false,
    solidarityAllowed: true,
    regionalHqExceptionRequired: false,
    penalties: booklet.penalties,
    latePenaltiesFormula: booklet.latePenaltiesFormula,
    latePenaltiesTotalPct: booklet.latePenaltiesTotalPct,
    qualificationAnnexNumber: 1,
    attachmentsList: booklet.attachmentsList,
    supportingFiles: [],

    /* المحتوى المحلي */
    /* ما تشتقّه اللائحة لهذه المنافسة (بصمتُها): خدماتٌ بلا بندٍ من القائمة
       الإلزامية ← التفضيلُ السعريُّ للمنتج الوطني ١٠٪ (م١٠) — وهو ما في البند ١٤ من النموذج. */
    localContentMechanisms: ['آلية التفضيل السعري للمنتج الوطني'],
    applyMandatoryList: false,
    minimumBaseline: '',
    minimumLocalContentTarget: '',
    economicOffsetRequirements: booklet.localContent,
    baselineStudyRef: '',
    localContentApprovalRef: '',

    /* التقييم */
    technicalPassingMechanism: 'على جميع المعايير',
    technicalPassScore: 70,
    technicalWeight: 60,
    financialWeight: 40,
    evaluationCriteria: booklet.evaluationCriteria,
  };
}

/* ── التشغيل ─────────────────────────────────────────────────────────────── */

export async function runOmCompetition() {
  const bookletPath = arg('--booklet');
  if (!bookletPath) throw new Error('--booklet <booklet.json> مطلوب');
  const booklet = JSON.parse(readFileSync(bookletPath, 'utf8'));
  const estimatedValue = booklet.estimatedValue;

  const ctx = await committeesContext();
  const budget = Math.round(estimatedValue * 1.05);
  const planItemId = arg('--plan-item') ?? (await planItem(booklet, budget));

  const title = `تشغيل وصيانة المباني الإدارية — تعاقد قائم على الأداء (${RUN})`;
  let c = await createProject({
    planItemId,
    title,
    description: booklet.purpose,
    procurementType: 'maintenance',
    requestingDepartment: DEPARTMENT,
  });
  const id = c.id;
  note(`المشروع: ${id} · ${c.referenceNumber}`);

  const entrant = await as('estimate.entry').get('/auth/me');
  await step(
    {
      who: 'tender.entry',
      title: 'يعبّئ الكراسة كاملة من نموذج عقد التشغيل والصيانة القائم على الأداء، وجدول الكميات مربوطًا بسجل المنتجات ودليل التصنيف',
      screen: `/portal/competitions/${id}/tender`,
    },
    async () => {
      const rowMeta = [];
      for (const row of booklet.boq) rowMeta.push(await linkRow(row));
      const boq = {
        mode: 'table',
        type: 'الخدمات والمخرجات',
        name: 'جدول خدمات التشغيل والصيانة',
        rows: booklet.boq.map(({ classificationCode, ...row }) => row),
        rowMeta,
      };
      await as('tender.entry').patch(`/competitions/${id}/tender-data`, {
        data: tenderData({ booklet, title, entrant, boq }),
      });
    },
  );
  await step(
    { who: 'estimate.entry', title: 'مدخل القيمة التقديرية يُدخلها مختومة', screen: `/portal/competitions/${id}/tender` },
    async () => {
      const saved = await as('estimate.entry').patch(`/competitions/${id}/tender-data`, { data: { estimatedValue } });
      note(`مختومة: ${saved.estimatedValue?.entered}`);
    },
  );

  c = await submitAndApprove(c, { budget });
  if (c.stage === 'bid_document') c = await approveBooklet(c);
  await conflictDeclarations(ctx);
  c = await publishAnnouncement(c, ctx);

  note(`الحال: ${c.stage} / ${c.status} · نُشر ${c.publishedAt ?? '—'}`);
  note(`التالي: أمين لجنة الفحص (open.secretary@example.com) يرفع العروض — /portal/competitions/${id}?phase=upload`);
  return { competitionId: id, planItemId, myId: await userId('open.secretary') };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runOmCompetition()
    .then((ids) => console.log(`\n✓ ${JSON.stringify(ids)}`))
    .catch((error) => {
      console.error(`\n✗ ${error.message}`);
      if (error.data) console.error(JSON.stringify(error.data, null, 1).slice(0, 2000));
      process.exitCode = 1;
    })
    .finally(done);
}
