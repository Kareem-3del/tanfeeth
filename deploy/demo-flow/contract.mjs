/**
 * مرحلة تنفيذ العقد حتى الإقفال في سيناريو العرض — كل خطوة بحسابها، والطلب
 * دائمًا من مسؤولة العقود والاعتماد من معتمد العقود (فصل المهام في الخادم):
 *
 *   contract.officer   تسجيل العقد (إن لم يُمرَّر عقدٌ من الترسية)        POST /contracts
 *   contract.approver  المباشرة (توريد): بدء ← اعتماد ← خطاب ← مباشرة      …/commencement[/confirm|/issue-letter|/commence]
 *   contract.officer   تسعير جدول الكميات إن كان بلا أسعار (عقد الترسية)  PATCH …/line-items/:id
 *   contract.officer   المستخلص الأول: إعداد بكميات جدول الكميات وتقديمه  …/payments، …/:id/submit
 *   contract.approver  اعتماد المستخلص ثم تسجيل صرفه                      …/:id/approve، …/:id/mark-paid
 *   contract.officer   الضمان النهائي: تسجيل خطاب البنك (+PDF) ← تسليم الأصل للمالية ← طلب تمديد
 *                                                                          …/guarantees، …/:gid/hand-over، …/:gid/requests
 *   contract.approver  اعتماد التمديد ← خطاب التمديد محالًا للصادر والوارد ← رقم الصادر
 *                                         …/guarantees/requests/:rid/decide، POST /guarantee-letters، …/letters/:eid/issue
 *   contract.officer   تأكيد وصول تعديل البنك                              …/:gid/bank-confirmed
 *   contract.officer   طلب أمر تغيير (زيادة ٥٪)                            …/change-orders
 *   contract.approver  اعتماد أمر التغيير                                  …/change-orders/:id/decide
 *   contract.officer   رفع إنجاز بنود جدول الكميات؛ contract.approver يعتمدها   …/line-items/:id/progress|confirm
 *   contract.officer   نسبة الإنجاز ٩٥٪، طلب شهادة الإنجاز، ثم إرفاقها نيابةً عن المتعاقد (PDF)
 *                                         …/completion-certificates/request|upload، POST /files
 *   contract.officer   تقييم المتعاقد وتقديمه                              …/evaluations/form
 *   contract.approver  استلام التقييم للمراجعة ثم اعتماده                 …/start-review، …/decide
 *   contract.approver  خطوات الإقفال: تأكيد انتهاء الأعمال ← إشعار الإدارة المشرفة ←
 *                      طلب الاستلام النهائي ← محضر الاستلام (مسودة/لجنة/تواقيع/إصدار) ←
 *                      توزيع المحضر وإقفال العقد                        …/workflow/actions، …/certificate/*
 *
 * ملاحظات:
 *   - شهادة الإنجاز المرفوعة من الجهة تُسجَّل «مستلمة» مباشرة؛ خطوة المراجعة
 *     (قبول/إعادة) لا تخصّ إلا ما يقدّمه المتعاقد عبر رابطه، والتوكن لا يعود في الـAPI.
 *   - الإفراج عن الضمان بعد الإقفال غير مشمول ولم يُختبر (بوابته تطلب إقرارات
 *     كالمخالصة المالية ومستحقات المتعاقد عبر …/guarantees/requests/:rid/confirm).
 *
 *   node deploy/demo-flow/contract.mjs [--auto] [--contract <id>]
 */

import { pathToFileURL } from 'node:url';

import { API, as, daysFromNow, done, iso, RUN, session, step } from './lib.mjs';

const OFFICER = 'contract.officer';
const APPROVER = 'contract.approver';

/** بريد المتعاقد التجريبي — لا عناوين حقيقية (المنصّة تراسل المتعاقد). */
const CONTRACTOR_EMAIL = 'contractor.demo@example.com';
/** بريد الإدارة المشرفة التجريبية (من seed-demo-users). */
const SUPERVISING_EMAIL = 'it@example.com';

const c = (id) => `/contracts/${id}`;
const screen = (id, query = '') => `/portal/contracts/${id}${query ? `?${query}` : ''}`;
const sar = (n) => `${Math.round(n).toLocaleString('en-US')} ريال`;

/** PDF صغيرٌ صالح (صفحة واحدة) يُولَّد في الذاكرة — بديلُ الملف الممسوح ضوئيًّا. */
function demoPdf(title) {
  const text = title.replace(/[^\x20-\x7E]/g, '?').replace(/[()\\]/g, '');
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

/** رفع ملف (multipart، الحقل `file`) بجلسة الحساب — `lib` يرسل JSON فقط. */
async function uploadFile(who, name, bytes, type = 'application/pdf') {
  const { token } = await session(who);
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), name);
  const res = await fetch(`${API}/files`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(`POST /files → ${res.status}${data?.code ? ` ${data.code}` : ''}: ${data?.message ?? res.statusText}`);
    err.data = data;
    throw err;
  }
  return data;
}

function argValue(name) {
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

/* ── تسجيل العقد (عند التشغيل منفردًا) ─────────────────────────────────── */

const LINE_ITEMS = [
  { itemNumber: '1', description: 'توريد أجهزة حاسب مكتبي', unit: 'جهاز', quantity: 120, unitPrice: 4_200, phase: 'التوريد' },
  { itemNumber: '2', description: 'توريد مبدّلات شبكة 48 منفذًا', unit: 'وحدة', quantity: 16, unitPrice: 12_500, phase: 'التوريد' },
  { itemNumber: '3', description: 'أعمال التركيب والتشغيل والتدريب', unit: 'مقطوعية', quantity: 1, unitPrice: 96_000, phase: 'التركيب' },
];
const CONTRACT_VALUE = LINE_ITEMS.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

async function registerContract() {
  return step(
    { who: OFFICER, title: 'تسجيل العقد الموقَّع وجدول كمياته في المنصّة (تجريبي)', screen: '/portal/contracts' },
    async () => {
      const contract = await as(OFFICER).post('/contracts', {
        contractNumber: `DEMO-CT-${RUN}`,
        name: `توريد وتركيب أجهزة حاسب ومعدات شبكات — تجريبي ${RUN}`,
        contractorName: 'شركة الحلول الرقمية التجريبية',
        contractorEmail: CONTRACTOR_EMAIL,
        category: 'توريد',
        tenderType: 'منافسة عامة',
        year: new Date().getFullYear(),
        ownerName: 'إدارة تقنية المعلومات (تجريبية)',
        responsibleEmployee: 'ريم مسؤولة العقود',
        value: CONTRACT_VALUE,
        duration: '6 أشهر',
        signDate: iso(daysFromNow(-7)),
        endDate: iso(daysFromNow(180)),
        endOfWarranty: iso(daysFromNow(545)),
        bankGuaranteeValue: Math.round(CONTRACT_VALUE * 0.05),
        bankGuaranteeReference: `LG-DEMO-${RUN}`,
        bankGuaranteeExpiry: iso(daysFromNow(270)),
        etimadReferenceNumber: `DEMO-${RUN}`,
        notes: `عقد تجريبي لسيناريو العرض (${RUN}) — بيانات غير حقيقية.`,
        lineItems: LINE_ITEMS,
      });
      console.log(`   ↳ ${contract.contractNumber} — ${sar(CONTRACT_VALUE)} — ${contract.id}`);
      return contract;
    },
  );
}

/* ── المباشرة (BR-02: توريد) ─────────────────────────────────────────────── */

const COMMENCEMENT_ORDER = ['not_started', 'initiated', 'confirmed', 'letter_issued', 'commenced'];

async function commencement(id) {
  const existing = await as(APPROVER).get(`${c(id)}/commencement`);
  const at = COMMENCEMENT_ORDER.indexOf(existing?.status ?? 'not_started');
  const where = screen(id, 'phase=commencement');

  if (at < 1) {
    await step({ who: APPROVER, title: 'بدء إجراءات المباشرة — عقد توريد (لا استلام موقع)', screen: where }, () =>
      as(APPROVER).post(`${c(id)}/commencement`, { type: 'supply' }),
    );
  }
  if (at < 2) {
    await step({ who: APPROVER, title: 'اعتماد بدء التنفيذ', screen: where }, () =>
      as(APPROVER).post(`${c(id)}/commencement/confirm`),
    );
  }
  if (at < 3) {
    await step({ who: APPROVER, title: 'إصدار خطاب المباشرة برقمٍ مرجعي (R-09)', screen: where }, async () => {
      const r = await as(APPROVER).post(`${c(id)}/commencement/issue-letter`);
      console.log(`   ↳ رقم الخطاب: ${r.letterReference}`);
      return r;
    });
  }
  if (at < 4) {
    await step({ who: APPROVER, title: 'تسجيل مباشرة المتعاقد للعمل اليوم (يُثبَّت تاريخ البدء)', screen: where }, () =>
      as(APPROVER).post(`${c(id)}/commencement/commence`, { commencementDate: iso(new Date()) }),
    );
  } else {
    console.log('\n   • المباشرة مسجّلة مسبقًا على هذا العقد — تخطٍّ');
  }
}

/* ── المستخلص (الدفعة) ───────────────────────────────────────────────────── */

/**
 * عقدٌ وُلد من الترسية يحمل جدولَ الكميات بلا أسعار (العرض الفائز سُجِّل
 * بإجماليه). والمستخلصُ = الكمية × السعر، فيُسعَّر الجدولُ أولًا — من نافذة
 * المستخلص نفسها في v3 (`PATCH …/line-items/:id { unitPrice }`).
 *
 * المصدر: أسعارُ بنود العرض الفائز لا تُقرأ بصلاحيات العقود (جدولُ كميات العرض
 * خلف `competitions.committee`، وعروضُ العرض التجريبي مسجّلةٌ بإجماليّها فقط)،
 * فتوزَّع قيمةُ العقد — وهي مبلغُ العرض الفائز — على البنود غير المسعّرة
 * بحسب الكمية، ويُضبط آخرُ بند ليطابق المجموعُ القيمة.
 */
async function priceBoq(id) {
  const { items } = await as(OFFICER).get(`${c(id)}/line-items`);
  const unpriced = items.filter((l) => l.unitPrice == null);
  if (unpriced.length === 0) return items;

  const contract = await as(OFFICER).get(c(id));
  const value = contract.value;
  if (!(value > 0)) throw new Error(`العقد ${id} بلا قيمة — لا يُشتق سعرٌ لبنود جدول الكميات`);
  const pricedTotal = items.filter((l) => l.unitPrice != null).reduce((s, l) => s + (l.quantity ?? 1) * l.unitPrice, 0);
  const remaining = value - pricedTotal;
  if (!(remaining > 0)) throw new Error(`البنود المسعّرة تستنفد قيمة العقد (${sar(pricedTotal)}) — لا متّسع لتسعير الباقي`);

  return step(
    {
      who: OFFICER,
      title: `تسعير جدول الكميات من العرض الفائز (${unpriced.length} بنود — ${sar(remaining)} موزّعة بالكمية)`,
      screen: screen(id, 'phase=execution&section=payments'),
    },
    async () => {
      const qty = (l) => (l.quantity > 0 ? l.quantity : 1);
      const totalQty = unpriced.reduce((s, l) => s + qty(l), 0);
      const base = Math.floor((remaining / totalQty) * 100) / 100;
      let assigned = 0;
      for (const [i, l] of unpriced.entries()) {
        const last = i === unpriced.length - 1;
        const unitPrice = last ? Math.round(((remaining - assigned) / qty(l)) * 100) / 100 : base;
        assigned += unitPrice * qty(l);
        await as(OFFICER).patch(`${c(id)}/line-items/${l.id}`, { unitPrice });
        console.log(`   ↳ البند ${l.itemNumber}: ${qty(l)} × ${unitPrice.toLocaleString('en-US')} ريال`);
      }
      const after = await as(OFFICER).get(`${c(id)}/line-items`);
      console.log(`   ↳ إجمالي الجدول: ${sar(after.summary?.totalAmount ?? 0)} (قيمة العقد ${sar(value)})`);
      return after.items;
    },
  );
}

async function payment(id) {
  const where = screen(id, 'phase=execution&section=payments');
  const items = await priceBoq(id);
  const previous = await as(OFFICER).get(`${c(id)}/payments`);
  // ما سبقت مطالبته من كل بند — لا يُطالب بأكثر من المتبقّي (يرفضه الخادم).
  const claimed = new Map();
  for (const p of previous) {
    for (const l of p.lines ?? []) claimed.set(l.lineItemId, (claimed.get(l.lineItemId) ?? 0) + (l.quantity ?? 0));
  }
  // نصف كمية أول بندين قابلين للقياس (في حدود المتبقّي) — أو مبلغٌ مقطوع إن كان العقد بلا جدول كميات.
  const measurable = items
    .map((l) => ({ id: l.id, remaining: (l.quantity ?? 0) - (claimed.get(l.id) ?? 0), quantity: l.quantity ?? 0 }))
    .filter((l) => l.remaining >= 1)
    .slice(0, 2);
  if (items.length > 0 && measurable.length === 0) {
    console.log('\n   • كل كميات جدول الكميات مُطالَبٌ بها مسبقًا — تخطّي المستخلص');
    return null;
  }
  const number = previous.length + 1;

  const draft = await step(
    { who: OFFICER, title: `إعداد المستخلص رقم ${number} من كميات جدول الكميات المنفَّذة وتقديمه للاعتماد`, screen: where },
    async () => {
      const body = {
        notes: `المستخلص رقم ${number} — تجريبي ${RUN}`,
        periodFrom: iso(new Date()),
        periodTo: iso(daysFromNow(30)),
        ...(measurable.length
          ? { lines: measurable.map((l) => ({ lineItemId: l.id, quantity: Math.max(1, Math.floor(Math.min(l.quantity / 2, l.remaining))) })) }
          : { amount: 100_000 }),
      };
      const p = await as(OFFICER).post(`${c(id)}/payments`, body);
      const submitted = await as(OFFICER).post(`${c(id)}/payments/${p.id}/submit`);
      console.log(`   ↳ مستخلص رقم ${submitted.paymentNumber} — ${sar(submitted.amount ?? submitted.netAmount ?? 0)} — ${submitted.status}`);
      return submitted;
    },
  );

  await step({ who: APPROVER, title: 'اعتماد المستخلص بعد التحقق من توفر الاعتماد المالي', screen: where }, async () => {
    const p = await as(APPROVER).post(`${c(id)}/payments/${draft.id}/approve`);
    console.log(`   ↳ الحالة: ${p.status}`);
  });

  await step({ who: APPROVER, title: 'تسجيل صرف المستخلص (يُضاف إلى المنصرف على العقد)', screen: where }, async () => {
    const p = await as(APPROVER).post(`${c(id)}/payments/${draft.id}/mark-paid`);
    console.log(`   ↳ الحالة: ${p.status}`);
  });
  return draft.id;
}

/* ── الضمان البنكي النهائي ───────────────────────────────────────────────── */

async function guarantee(id) {
  const where = `/portal/guarantees/${id}`;
  let view = await as(OFFICER).get(`${c(id)}/guarantees`);
  const contract = await as(OFFICER).get(c(id));
  const value = contract.revisedValue ?? contract.value ?? CONTRACT_VALUE;
  const required = view.requiredAmount ?? Math.round(value * 0.05);

  if (!view.live) {
    view = await step(
      { who: OFFICER, title: `تسجيل خطاب الضمان النهائي الوارد من البنك (${sar(required)}، ٥٪)`, screen: where },
      async () => {
        const letter = await uploadFile(OFFICER, `final-guarantee-${RUN}.pdf`, demoPdf(`Final bank guarantee LG-DEMO-${RUN}`));
        const v = await as(OFFICER).post(`${c(id)}/guarantees`, {
          kind: 'final',
          amount: required,
          percentOfContract: 5,
          bankName: 'البنك التجريبي',
          letterNumber: `LG-DEMO-${RUN}`,
          issuedOn: iso(new Date()),
          expiresOn: iso(daysFromNow(200)),
          letterFileId: letter.id,
          note: `خطاب ضمان تجريبي ${RUN}`,
        });
        console.log(`   ↳ ضمان ${v.live.id} — ${v.live.status} — ينتهي ${String(v.live.expiresOn).slice(0, 10)}`);
        return v;
      },
    );
  } else {
    console.log(`\n   • على العقد ضمانٌ نهائي ساري (${view.live.id}) — تخطّي التسجيل`);
  }
  const g = view.live;

  if (g.status === 'received') {
    view = await step({ who: OFFICER, title: 'تسليم أصل خطاب الضمان إلى الإدارة المالية (يصير الضمان ساريًا)', screen: where }, () =>
      as(OFFICER).post(`${c(id)}/guarantees/${g.id}/hand-over`, { holder: 'finance', note: 'سُلِّم الأصل لحفظه — تجريبي' }),
    );
  }

  const newExpiry = iso(daysFromNow(400));
  view = await step(
    { who: OFFICER, title: `طلب تمديد الضمان حتى ${newExpiry} لتغطية فترة الضمان بعد الاستلام`, screen: where },
    async () => {
      const v = await as(OFFICER).post(`${c(id)}/guarantees/${g.id}/requests`, {
        kind: 'extend',
        newExpiresOn: newExpiry,
        reason: `يمتد الضمان النهائي ليغطي فترة الضمان حتى الاستلام النهائي — تجريبي ${RUN}`,
      });
      return v;
    },
  );
  const request = view.requests.find((r) => r.status === 'pending' && r.kind === 'extend');
  if (!request) throw new Error(`لا طلب تمديد معلّق على الضمان ${g.id}`);

  await step({ who: APPROVER, title: 'اعتماد طلب تمديد الضمان', screen: where }, async () => {
    const v = await as(APPROVER).post(`${c(id)}/guarantees/requests/${request.id}/decide`, {
      decision: 'approve',
      note: 'معتمد — تجريبي',
    });
    console.log(`   ↳ ينتهي الآن ${String(v.live.expiresOn).slice(0, 10)} — بانتظار تعديل البنك`);
  });

  const letter = await step(
    { who: APPROVER, title: 'توليد خطاب التمديد إلى البنك وإحالته إلى الصادر والوارد', screen: where },
    async () => {
      const r = await as(APPROVER).post('/guarantee-letters', { guaranteeId: g.id, kind: 'extend', toCorrespondence: true });
      if (!r.letterEventId) throw new Error(`الخطاب وُلّد (${r.reportId}) ولم يُقيَّد على الضمان`);
      console.log(`   ↳ تقرير ${r.reportId} — واقعة ${r.letterEventId} — بانتظار رقم الصادر: ${r.awaitingCorrespondence}`);
      return r;
    },
  );

  const outbound = `ص/${new Date().getFullYear()}/${RUN.slice(-4)}`;
  await step({ who: APPROVER, title: `إصدار رقم الصادر الرسمي للخطاب (${outbound})`, screen: where }, () =>
    as(APPROVER).post(`${c(id)}/guarantees/${g.id}/letters/${letter.letterEventId}/issue`, {
      outboundReference: outbound,
      note: 'صدر من إدارة الصادر والوارد — تجريبي',
    }),
  );

  await step({ who: OFFICER, title: 'تأكيد وصول تعديل البنك على خطاب الضمان', screen: where }, async () => {
    const v = await as(OFFICER).post(`${c(id)}/guarantees/${g.id}/bank-confirmed`, { note: 'وصل خطاب التمديد من البنك — تجريبي' });
    console.log(`   ↳ ${v.live.status} — ينتهي ${String(v.live.expiresOn).slice(0, 10)}`);
  });
  return { guaranteeId: g.id, guaranteeRequestId: request.id, letterEventId: letter.letterEventId };
}

/* ── أمر التغيير ─────────────────────────────────────────────────────────── */

async function changeOrder(id, contract) {
  const where = screen(id, 'phase=changeOrders');
  // ٥٪ من القيمة الأصلية (مرجع السقف النظامي)، في حدود المتبقي من سقف الزيادة.
  const capacity = await as(OFFICER).get(`${c(id)}/change-orders/capacity`);
  const value = capacity.contractValue ?? contract.value ?? CONTRACT_VALUE;
  const amount = Math.floor(Math.min(value * 0.05, capacity.remainingIncrease ?? Infinity));
  if (!(amount > 0)) {
    console.log('\n   • لا متّسع لزيادة جديدة ضمن سقف ١٠٪ على هذا العقد — تخطّي أمر التغيير');
    return null;
  }

  const order = await step(
    { who: OFFICER, title: `طلب أمر تغيير بزيادة ${sar(amount)} (≈٥٪) — ضمن سقف ١٠٪ النظامي`, screen: where },
    async () => {
      const o = await as(OFFICER).post(`${c(id)}/change-orders`, {
        type: 'increase',
        amount,
        reason: `توريد أجهزة إضافية لقاعة التدريب الجديدة بالأسعار التعاقدية نفسها — تجريبي ${RUN}`,
      });
      console.log(`   ↳ أمر رقم ${o.orderNumber} — ${o.status}`);
      return o;
    },
  );

  await step({ who: APPROVER, title: 'اعتماد أمر التغيير (تُحدَّث القيمة المعدّلة للعقد)', screen: where }, async () => {
    const o = await as(APPROVER).post(`${c(id)}/change-orders/${order.id}/decide`, {
      decision: 'approved',
      note: 'معتمد ضمن الحد النظامي للزيادة — تجريبي',
    });
    const after = await as(APPROVER).get(c(id));
    console.log(`   ↳ ${o.status} — القيمة المعدّلة: ${sar(after.revisedValue ?? after.value)}`);
  });
  return order.id;
}

/* ── الإنجاز وشهادة الإنجاز ──────────────────────────────────────────────── */

async function progressAndCertificate(id, contract) {
  const boq = screen(id, 'phase=execution&section=payments');
  const open = (await as(OFFICER).get(`${c(id)}/line-items`)).items.filter((l) => !l.confirmed);
  if (open.length > 0) {
    await step(
      { who: OFFICER, title: `رفع إنجاز بنود جدول الكميات (${open.length} بنود) مكتملةً مع سند الإنجاز — عبر الـAPI، لا زرّ له في v3`, screen: boq },
      async () => {
        for (const l of open) {
          await as(OFFICER).post(`${c(id)}/line-items/${l.id}/progress`, {
            contractorCompletion: 100,
            proofNote: `اكتمل البند ${l.itemNumber} وفق محضر التوريد والتركيب — تجريبي`,
          });
        }
      },
    );
    await step({ who: APPROVER, title: 'اعتماد إنجاز بنود جدول الكميات (فصل المهام) — يظهر أثره في محضر الاستلام بلا بنود ناقصة', screen: boq }, async () => {
      for (const l of open) await as(APPROVER).post(`${c(id)}/line-items/${l.id}/confirm`, { confirmed: true });
      const { summary } = await as(APPROVER).get(`${c(id)}/line-items`);
      console.log(`   ↳ ملخص الجدول: ${JSON.stringify(summary)}`);
    });
  }

  await step(
    { who: OFFICER, title: 'تحديث نسبة الإنجاز في سجل العقد إلى ٩٥٪', screen: screen(id, 'view=record') },
    () => as(OFFICER).patch(c(id), { completionPercentage: 95 }),
  );

  const requested = await step(
    {
      who: OFFICER,
      title: 'طلب شهادة الإنجاز من المتعاقد (يصله رابط تقديم بالبريد)',
      screen: screen(id, 'phase=execution&section=actions'),
    },
    async () => {
      const existing = await as(OFFICER).get(`${c(id)}/completion-certificates`);
      const open = existing.find((x) => x.isOpen ?? ['requested', 'submitted'].includes(x.status));
      if (open) {
        console.log(`   • طلبٌ مفتوح موجود مسبقًا (${open.id}) — تخطٍّ`);
        return open;
      }
      const cert = await as(OFFICER).post(`${c(id)}/completion-certificates/request`, {
        ...(contract.contractorEmail ? {} : { contractorEmail: CONTRACTOR_EMAIL }),
        message: `نأمل تزويدنا بشهادة الإنجاز للأعمال المنفذة حتى تاريخه — تجريبي ${RUN}`,
        dueDate: iso(daysFromNow(7)),
      });
      console.log(`   ↳ ${cert.id} — ${cert.status}`);
      return cert;
    },
  );

  // الشهادةُ وصلت ورقيًّا: تُرفق نيابةً عن المتعاقد فتُستلم مباشرة (ويُلغى رابطه
  // المفتوح). والمراجعةُ (قبول/إعادة) لا تخصّ إلا ما يقدّمه المتعاقد عبر الرابط.
  return step(
    {
      who: OFFICER,
      title: 'إرفاق شهادة الإنجاز المستلمة من المتعاقد (PDF) — تُسجَّل «مستلمة»',
      screen: screen(id, 'phase=execution&section=actions'),
    },
    async () => {
      if (requested.status !== 'requested') {
        console.log(`   • الطلب بحالة ${requested.status} — لا إرفاق`);
        return requested;
      }
      const file = await uploadFile(OFFICER, `completion-certificate-${RUN}.pdf`, demoPdf(`Completion certificate - DEMO ${RUN}`));
      const cert = await as(OFFICER).post(`${c(id)}/completion-certificates/upload`, {
        fileId: file.id,
        certificateId: requested.id,
        note: `شهادة إنجاز مسلَّمة ورقيًّا من المتعاقد — تجريبي ${RUN}`,
      });
      console.log(`   ↳ ${cert.id} — ${cert.status} — ملف ${file.id}`);
      return cert;
    },
  );
}

/* ── تقييم المتعاقد ──────────────────────────────────────────────────────── */

async function evaluation(id) {
  const tpl = await as(OFFICER).get(`${c(id)}/evaluations/template`);
  const template = tpl.resolved;
  const criteriaScores = template.groups.flatMap((g) =>
    g.criteria.map((cr) => ({
      groupKey: g.key,
      criterionKey: cr.key,
      band: 'high',
      justification: `أداءٌ ملتزم في «${cr.name}» خلال فترة التنفيذ — تجريبي`,
    })),
  );
  const officer = await as(OFFICER).user();

  const evaluationView = await step(
    {
      who: OFFICER,
      title: `تقييم أداء المتعاقد بنموذج «${template.title}» وتقديمه للمراجعة`,
      screen: `/portal/contracts/${id}/evaluations/new`,
    },
    async () => {
      const form = {
        templateId: template.id,
        period: `الربع الأول من التنفيذ — تجريبي ${RUN}`,
        periodType: 'quarterly',
        periodFrom: iso(daysFromNow(-90)),
        periodTo: iso(new Date()),
        criteriaScores,
        committee: [
          { name: 'ريم مسؤولة العقود', role: 'chair', jobTitle: 'أخصائية عقود', signed: true },
          { name: 'عضو لجنة التقييم (تجريبي)', role: 'member', jobTitle: 'مهندس مشروع', signed: true },
        ],
        recommendations: 'الاستمرار مع المتعاقد ومتابعة التزامه بجدول التوريد.',
      };
      const created = await as(OFFICER).post(`${c(id)}/evaluations/form`, form);
      let ev = await as(OFFICER).get(`${c(id)}/evaluations/${created.id}`);

      // معيار المحتوى المحلي يُحسب آليًّا من تقرير متحقَّق منه؛ بلا تقرير يبقى
      // «غير معلوم» فيُتجاوز بشريحةٍ ومبرَّرٍ مكتوب — مسار المنتج نفسه.
      if (ev.localContent && ev.localContent.score == null) {
        console.log(`   ↳ معيار المحتوى المحلي: ${ev.localContent.explanation}`);
        ev = await as(OFFICER).patch(`${c(id)}/evaluations/${ev.id}/local-content-score`, {
          band: 'mid',
          reason: 'لا تقرير محتوى محلي متحقَّق منه بعد في هذه الفترة؛ تقديرُ اللجنة من مستندات التوريد — تجريبي',
        });
      }
      ev = await as(OFFICER).post(`${c(id)}/evaluations/${ev.id}/submit`);
      console.log(`   ↳ ${ev.id} — ${ev.status} — الدرجة: ${ev.total ?? '—'} (المقيّم: ${officer.email})`);
      return ev;
    },
  );

  const where = `/portal/contracts/${id}/evaluations/${evaluationView.id}`;
  await step({ who: APPROVER, title: 'استلام التقييم للمراجعة', screen: where }, () =>
    as(APPROVER).post(`${c(id)}/evaluations/${evaluationView.id}/start-review`),
  );
  await step({ who: APPROVER, title: 'اعتماد تقييم المتعاقد (تصل المتعاقدَ نسخةٌ بالنتيجة)', screen: where }, async () => {
    const ev = await as(APPROVER).post(`${c(id)}/evaluations/${evaluationView.id}/decide`, {
      decision: 'approved',
      note: 'معتمد — تجريبي',
    });
    console.log(`   ↳ ${ev.status}`);
  });
  return evaluationView.id;
}

/* ── الاستلام والإقفال ───────────────────────────────────────────────────── */

async function advance(id, action, extra = {}) {
  const wf = await as(APPROVER).get(`${c(id)}/workflow`);
  if (!wf.actions.some((a) => a.code === action)) {
    throw new Error(
      `الإجراء ${action} غير متاح الآن (المرحلة ${wf.stage}، المتاح: ${wf.actions.map((a) => a.code).join('، ') || '—'})`,
    );
  }
  return as(APPROVER).post(`${c(id)}/workflow/actions`, { action, ...extra });
}

async function closeout(id) {
  const where = screen(id, 'phase=receipt');
  const wf = await as(APPROVER).get(`${c(id)}/workflow`);
  console.log(`\n   مرحلة سير العقد الآن: ${wf.stage}`);

  if (wf.actions.some((a) => a.code === 'confirm_works_completed')) {
    await step({ who: APPROVER, title: 'تأكيد انتهاء الأعمال', screen: where }, () =>
      advance(id, 'confirm_works_completed', { note: 'أُنجزت أعمال التوريد والتركيب — تجريبي' }),
    );
  }

  await step({ who: APPROVER, title: 'إشعار الإدارة المشرفة بانتهاء الأعمال (بريد تجريبي)', screen: where }, () =>
    advance(id, 'notify_supervising_department', {
      supervisingDepartmentEmail: SUPERVISING_EMAIL,
      note: 'نأمل ترشيح ممثل الإدارة في لجنة الاستلام — تجريبي',
    }),
  );

  await step({ who: APPROVER, title: 'طلب الاستلام النهائي', screen: where }, () =>
    advance(id, 'request_final_acceptance'),
  );

  await step({ who: APPROVER, title: 'إعداد محضر الاستلام النهائي (يرصد بنود الكميات غير المكتملة)', screen: where }, async () => {
    const cert = await as(APPROVER).post(`${c(id)}/certificate/draft`, {
      type: 'final',
      referenceNumber: `ACC-${RUN}`,
      notes: `محضر استلام نهائي — تجريبي ${RUN}`,
    });
    await advance(id, 'prepare_final_certificate');
    console.log(`   ↳ محضر ${cert.referenceNumber ?? cert.id} — ${cert.status} — بنود غير مكتملة: ${cert.incompleteItems?.length ?? 0}`);
  });

  await step({ who: APPROVER, title: 'إرسال المحضر إلى لجنة الاستلام', screen: where }, async () => {
    await as(APPROVER).post(`${c(id)}/certificate/send-to-committee`);
    await advance(id, 'send_to_acceptance_committee');
  });

  await step({ who: APPROVER, title: 'تسجيل التواقيع: عضو اللجنة ثم المتعاقد ثم الاعتماد', screen: where }, async () => {
    const signers = [
      { role: 'committee_member', name: 'عضو لجنة الاستلام (تجريبي)' },
      { role: 'contractor', name: 'ممثل شركة الحلول الرقمية التجريبية' },
      { role: 'approver', name: 'بدر معتمد العقود' },
    ];
    let cert;
    for (const s of signers) cert = await as(APPROVER).post(`${c(id)}/certificate/signatures`, s);
    await advance(id, 'collect_signatures');
    console.log(`   ↳ ${cert.status}`);
  });

  await step({ who: APPROVER, title: 'إصدار محضر الاستلام النهائي الموقَّع', screen: where }, () =>
    as(APPROVER).post(`${c(id)}/certificate/issue`, {}),
  );

  await step({ who: APPROVER, title: 'توزيع المحضر وإقفال العقد', screen: where }, async () => {
    await advance(id, 'distribute_certificate', { note: 'وُزّع المحضر على الجهات ذات العلاقة — تجريبي' });
    const after = await as(APPROVER).get(c(id));
    console.log(`   ↳ حالة العقد: ${after.status} — تاريخ الاستلام النهائي: ${String(after.finalAcceptanceDate).slice(0, 10)}`);
    if (after.status !== 'closed') throw new Error(`العقد لم يُقفل (الحالة: ${after.status})`);
  });
}

/* ── التشغيل ─────────────────────────────────────────────────────────────── */

export async function runContract({ contractId } = {}) {
  let contract;
  if (contractId) {
    contract = await as(OFFICER).get(c(contractId));
    console.log(`\n   العقد من مرحلة الترسية: ${contract.contractNumber} — ${contract.name} (${contract.status})`);
  } else {
    contract = await registerContract();
    contractId = contract.id;
  }
  if (['closed', 'cancelled'].includes(contract.status)) {
    throw new Error(`العقد ${contractId} منتهٍ (${contract.status}) — لا تنفيذ عليه`);
  }

  await commencement(contractId);
  const paymentId = await payment(contractId);
  const guaranteeIds = await guarantee(contractId);
  const changeOrderId = await changeOrder(contractId, contract);
  const certificateRequestId = (await progressAndCertificate(contractId, contract)).id;
  const evaluationId = await evaluation(contractId);
  await closeout(contractId);

  console.log(`\n   ✔ العقد ${contractId} نُفّذ حتى الإقفال — ${screen(contractId, 'phase=receipt')}`);
  return { contractId, paymentId, ...guaranteeIds, changeOrderId, certificateRequestId, evaluationId };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runContract({ contractId: argValue('contract') })
    .then((r) => console.log(JSON.stringify(r)))
    .catch((err) => {
      console.error(`\n✗ ${err.message}`);
      if (err.data) console.error(JSON.stringify(err.data));
      process.exitCode = 1;
    })
    .finally(done);
}
