#!/usr/bin/env node
/**
 * زرع عقود تجريبية كاملة عبر واجهة الـAPI — لا كتابةً في قاعدة البيانات، فتمرّ
 * البيانات بقواعد النطاق نفسها (السقوف النظامية، فصل المهام، سجل المتعاقدين).
 *
 * الاستعمال:
 *   API=https://staging-api.tanfeeth.io/api \
 *   EMAIL=you@example.com PASSWORD='...' \
 *   node deploy/seed-demo-contracts.mjs
 *
 * إعادة التشغيل آمنة: يتخطّى أي عقد رقمه موجود مسبقًا.
 */

const API = process.env.API ?? 'http://localhost:3000/api';
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('حدّد EMAIL و PASSWORD في البيئة.');
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
    const err = new Error(`${method} ${path} → ${res.status}: ${msg}`);
    err.status = res.status;
    err.code = data?.code;
    throw err;
  }
  return data;
};

const iso = (d) => d.toISOString().slice(0, 10);
const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

/** أربعة عقود بأنماط مختلفة عمدًا: كلٌّ يُظهر جانبًا من الشاشات. */
const CONTRACTS = [
  {
    contractNumber: 'CT-2026-1001',
    name: 'تشغيل وصيانة المباني الإدارية بالمقر الرئيسي',
    contractorName: 'شركة الخدمات المتكاملة للتشغيل والصيانة',
    contractorEmail: 'ops@integrated-services.example.sa',
    category: 'خدمات',
    tenderType: 'منافسة عامة',
    year: 2026,
    ownerName: 'الإدارة العامة للشؤون الهندسية',
    responsibleEmployee: 'م. سعد الحربي',
    value: 4_800_000,
    disbursedAmount: 1_200_000,
    completionPercentage: 26,
    duration: '24 شهرًا',
    bankGuaranteeValue: 240_000,
    bankGuaranteeReference: 'LG-2026-4471',
    etimadReferenceNumber: '260601158001',
    biddingNumber: 'BID-2026-1001',
    notes: 'يشمل التشغيل والصيانة الوقائية والتصحيحية وأعمال النظافة.',
    offsets: { sign: -60, start: -45, end: 685, warranty: 745, guarantee: 745 },
    lineItems: [
      { itemNumber: '1', description: 'أعمال الصيانة الوقائية للأنظمة الكهربائية', unit: 'شهر', quantity: 24, unitPrice: 55_000, phase: 'التشغيل' },
      { itemNumber: '2', description: 'أعمال صيانة أنظمة التكييف والتبريد', unit: 'شهر', quantity: 24, unitPrice: 62_500, phase: 'التشغيل' },
      { itemNumber: '3', description: 'أعمال النظافة العامة والضيافة', unit: 'شهر', quantity: 24, unitPrice: 48_000, phase: 'التشغيل' },
      { itemNumber: '4', description: 'قطع الغيار والمستهلكات', unit: 'مقطوعية', quantity: 1, unitPrice: 360_000, phase: 'التوريد' },
    ],
    subcontracts: [
      {
        subcontractorName: 'مؤسسة الأنظمة الكهربائية المتقدمة',
        origin: 'tender',
        reference: 'SUB-1001-A',
        scope: 'تنفيذ أعمال الصيانة الوقائية والتصحيحية للأنظمة الكهربائية',
        value: 1_320_000,
        licenseNumber: 'LIC-EL-88214',
        classification: 'كهرباء — الدرجة الثالثة',
        allocationOf: ['1'],
        percentages: [100],
        notes: 'مُعلن ضمن قائمة متعاقدي الباطن المقدَّمة مع العرض.',
      },
    ],
  },
  {
    contractNumber: 'CT-2026-1002',
    name: 'توريد وتركيب أجهزة حاسب ومعدات شبكات',
    contractorName: 'شركة التقنية الرقمية للحلول',
    contractorEmail: 'sales@digital-tech.example.sa',
    category: 'توريد',
    tenderType: 'منافسة عامة',
    year: 2026,
    ownerName: 'الإدارة العامة لتقنية المعلومات',
    responsibleEmployee: 'أ. نورة القحطاني',
    value: 2_150_000,
    disbursedAmount: 2_150_000,
    completionPercentage: 100,
    duration: '6 أشهر',
    bankGuaranteeValue: 107_500,
    bankGuaranteeReference: 'LG-2026-3120',
    etimadReferenceNumber: '260601158002',
    purchaseOrderNumber: 'PO-2026-0442',
    sapRequisitionNumber: 'SAP-99120',
    notes: 'اكتمل التوريد والتركيب واستُلمت الأعمال ابتدائيًا.',
    offsets: { sign: -300, start: -285, end: -105, warranty: 260, guarantee: 260, preliminary: -100 },
    lineItems: [
      { itemNumber: '1', description: 'أجهزة حاسب مكتبي', unit: 'جهاز', quantity: 350, unitPrice: 3_400, phase: 'التوريد' },
      { itemNumber: '2', description: 'أجهزة حاسب محمول', unit: 'جهاز', quantity: 120, unitPrice: 5_200, phase: 'التوريد' },
      { itemNumber: '3', description: 'مبدّلات شبكة 48 منفذًا', unit: 'وحدة', quantity: 24, unitPrice: 11_500, phase: 'التوريد' },
      { itemNumber: '4', description: 'أعمال التمديدات والتركيب', unit: 'مقطوعية', quantity: 1, unitPrice: 84_000, phase: 'التركيب' },
    ],
    subcontracts: [],
  },
  {
    contractNumber: 'CT-2026-1003',
    name: 'إنشاء مبنى مستودعات وساحات تخزين',
    contractorName: 'شركة البناء الحديث للمقاولات',
    contractorEmail: 'projects@modern-build.example.sa',
    category: 'مقاولات',
    tenderType: 'منافسة عامة',
    year: 2026,
    ownerName: 'الإدارة العامة للمشاريع',
    responsibleEmployee: 'م. فيصل الدوسري',
    value: 12_400_000,
    disbursedAmount: 3_100_000,
    completionPercentage: 31,
    duration: '18 شهرًا',
    bankGuaranteeValue: 620_000,
    bankGuaranteeReference: 'LG-2026-7788',
    etimadReferenceNumber: '260601158003',
    committeeMemoNumber: 'AWD-2026-113',
    notes: 'مشروع إنشائي يتضمن أعمال هيكل وتشطيبات وأعمال خارجية.',
    offsets: { sign: -150, start: -120, end: 420, warranty: 785, guarantee: 785 },
    lineItems: [
      { itemNumber: '1', description: 'أعمال الحفر والردم', unit: 'م3', quantity: 18_000, unitPrice: 45, phase: 'الأعمال الترابية' },
      { itemNumber: '2', description: 'أعمال الخرسانة المسلحة', unit: 'م3', quantity: 4_200, unitPrice: 1_150, phase: 'الهيكل' },
      { itemNumber: '3', description: 'أعمال الهياكل المعدنية', unit: 'طن', quantity: 260, unitPrice: 9_800, phase: 'الهيكل' },
      { itemNumber: '4', description: 'أعمال التشطيبات الداخلية', unit: 'م2', quantity: 6_500, unitPrice: 320, phase: 'التشطيبات' },
      { itemNumber: '5', description: 'أعمال الأسفلت والساحات الخارجية', unit: 'م2', quantity: 9_000, unitPrice: 135, phase: 'الأعمال الخارجية' },
    ],
    subcontracts: [
      {
        subcontractorName: 'مؤسسة الهياكل المعدنية الوطنية',
        origin: 'tender',
        reference: 'SUB-1003-A',
        scope: 'توريد وتركيب الهياكل المعدنية للمستودعات',
        value: 2_548_000,
        licenseNumber: 'LIC-ST-40119',
        classification: 'إنشاءات معدنية — الدرجة الثانية',
        allocationOf: ['3'],
        percentages: [100],
      },
      {
        subcontractorName: 'شركة الطرق والأسفلت المتحدة',
        origin: 'tender',
        reference: 'SUB-1003-B',
        scope: 'تنفيذ أعمال الأسفلت والساحات الخارجية',
        value: 1_215_000,
        licenseNumber: 'LIC-RD-22087',
        classification: 'طرق — الدرجة الثالثة',
        allocationOf: ['5'],
        percentages: [100],
        // يتجاوز مجموعهما 30% فيلزم مرجع الموافقة وأكثر من متعاقد — وهو متحقق.
        efficiencyApprovalReference: 'EEA-2026-0417',
      },
    ],
  },
  {
    contractNumber: 'CT-2026-1004',
    name: 'خدمات استشارية لإدارة وتنفيذ المشاريع',
    contractorName: 'مكتب الاستشارات الهندسية المتخصص',
    contractorEmail: 'info@consult-eng.example.sa',
    category: 'خدمات استشارية',
    tenderType: 'شراء مباشر',
    year: 2026,
    ownerName: 'مكتب إدارة المشاريع',
    responsibleEmployee: 'م. ريم العتيبي',
    value: 890_000,
    disbursedAmount: 220_000,
    completionPercentage: 25,
    duration: '12 شهرًا',
    bankGuaranteeValue: 44_500,
    bankGuaranteeReference: 'LG-2026-5501',
    etimadReferenceNumber: '260601158004',
    notes: 'إشراف هندسي ومتابعة فنية على مشاريع الإدارة.',
    offsets: { sign: -70, start: -60, end: 305, warranty: 365, guarantee: 365 },
    lineItems: [
      { itemNumber: '1', description: 'الإشراف الهندسي الميداني', unit: 'شهر', quantity: 12, unitPrice: 42_000, phase: 'الإشراف' },
      { itemNumber: '2', description: 'إعداد التقارير الفنية الدورية', unit: 'تقرير', quantity: 12, unitPrice: 11_500, phase: 'التقارير' },
      { itemNumber: '3', description: 'مراجعة المخططات والمواصفات', unit: 'مقطوعية', quantity: 1, unitPrice: 248_000, phase: 'المراجعة' },
    ],
    subcontracts: [],
  },
];

const main = async () => {
  const login = await call('POST', '/auth/login', {
    email: EMAIL,
    password: PASSWORD,
  });
  token = login.tokens.accessToken;
  console.log(`دخلتُ باسم ${login.user.email}`);

  for (const spec of CONTRACTS) {
    const {
      offsets,
      lineItems,
      subcontracts,
      ...fields
    } = spec;

    const body = {
      ...fields,
      signDate: iso(daysFromNow(offsets.sign)),
      startDate: iso(daysFromNow(offsets.start)),
      endDate: iso(daysFromNow(offsets.end)),
      endOfWarranty: iso(daysFromNow(offsets.warranty)),
      bankGuaranteeExpiry: iso(daysFromNow(offsets.guarantee)),
      ...(offsets.preliminary
        ? { preliminaryAcceptanceDate: iso(daysFromNow(offsets.preliminary)) }
        : {}),
      lineItems,
    };

    let contract;
    try {
      contract = await call('POST', '/contracts', body);
      console.log(`\n✔ ${contract.contractNumber} — ${contract.name}`);
    } catch (error) {
      if (error.code === 'CONTRACT.NUMBER_IN_USE') {
        console.log(`\n• ${spec.contractNumber} موجود مسبقًا — تخطٍّ`);
        continue;
      }
      throw error;
    }

    const items = await call('GET', `/contracts/${contract.id}/line-items`);
    const byNumber = new Map(items.items.map((i) => [i.itemNumber, i.id]));
    console.log(`  جدول الكميات: ${items.items.length} بندًا`);

    for (const sub of subcontracts ?? []) {
      const { allocationOf, percentages, ...rest } = sub;
      const allocations = (allocationOf ?? []).map((num, idx) => ({
        lineItemId: byNumber.get(num),
        percentage: percentages?.[idx] ?? 100,
      }));
      try {
        const created = await call(
          'POST',
          `/contracts/${contract.id}/subcontracts`,
          { ...rest, allocations },
        );
        console.log(
          `  ↳ باطن: ${created.subcontractorName} — ${created.value.toLocaleString('en-US')} (${created.pctOfContract?.toFixed(1)}%) — ${created.status}`,
        );
      } catch (error) {
        console.log(`  ↳ تعذّر إنشاء عقد الباطن: ${error.message}`);
      }
    }
  }

  console.log('\nتمّ.');
};

main().catch((error) => {
  console.error(`\nفشل: ${error.message}`);
  process.exit(1);
});
