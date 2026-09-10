#!/usr/bin/env node
/**
 * زرع اتفاقية إطارية تجريبية كاملة مع أوامر شراء عليها — عبر واجهة الـAPI لا
 * بكتابةٍ في قاعدة البيانات، فتمرّ بكل قواعد المجال (السقف، الطرف الساري،
 * الأسعار المرجعية، توفير عقد التنفيذ عند الاعتماد).
 *
 *   API=https://staging-api.tanfeeth.io/api \
 *   EMAIL=... PASSWORD=... APPROVER_PASSWORD=... node deploy/seed-demo-framework-agreement.mjs
 *
 * ما يُزرع (يوضح الفكرة على الشاشات):
 *   - اتفاقية «توريد مستلزمات وأجهزة تقنية المعلومات» سارية سنتين، بسقف
 *     4.5 مليون، بقواعد نموذج وزارة المالية (مدة الرد، الغرامة، الضمان…).
 *   - طرفان (متعاقدان مسجّلان) وجدول أسعار مرجعية من ثمانية بنود بسعرٍ لكل طرف.
 *   - أربعة أوامر شراء بحالاتٍ مختلفة عمدًا: معتمد (وله عقد تنفيذ)، بانتظار
 *     الاعتماد، مرفوض بملاحظة، ومسودة — فكل شاشة تجد ما تعرضه.
 *
 * لا يُوجَّه أيّ أمر معتمد إلى متعاقدٍ له بريد: الاعتماد يرسل رابط القبول
 * بالبريد، ولا نراسل عناوين حقيقية من بيانات تجريبية.
 */

const API = process.env.API ?? 'http://localhost:3000/api';
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
/**
 * فصلُ المهام: من قدّم أمر الشراء لا يبتّ فيه. فالاعتماد والرفض يقعان بحسابٍ
 * ثانٍ — يُنشأ إن لم يوجد، بدورٍ لا يحمل إلا قراءة الاتفاقيات واعتماد أوامرها.
 */
const APPROVER_EMAIL = process.env.APPROVER_EMAIL ?? 'fa.approver.demo@tanfeeth.local';
const APPROVER_PASSWORD = process.env.APPROVER_PASSWORD;

if (!EMAIL || !PASSWORD || !APPROVER_PASSWORD) {
  console.error('حدّد EMAIL و PASSWORD و APPROVER_PASSWORD في البيئة.');
  process.exit(1);
}

let token = '';

const call = async (method, path, body, as = token) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(as ? { Authorization: `Bearer ${as}` } : {}),
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

const iso = (d) => d.toISOString().slice(0, 10);
const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};
const fmt = (n) => Number(n).toLocaleString('en-US');

const AGREEMENT = {
  title: 'اتفاقية إطارية لتوريد مستلزمات وأجهزة تقنية المعلومات لفروع الجهة',
  referenceNumber: 'FA-2026-0001',
  competitionReferenceNumber: '260939001172',
  agreementType: 'supply',
  nature: 'closed',
  value: 4_500_000,
  unit: 'وحدة',
  startDate: iso(daysFromNow(-70)),
  endDate: iso(daysFromNow(730 - 70)),
  signedAt: iso(daysFromNow(-75)),
  rules: {
    responseDays: 5,
    defaultCompletionDays: 30,
    penaltyCapPct: 6,
    advancePaymentPct: 0,
    finalGuaranteePct: 5,
    finalGuaranteeThreshold: 100_000,
    nationalPricePreferencePct: 10,
  },
  beneficiaries: [
    'الإدارة العامة لتقنية المعلومات',
    'فرع الرياض',
    'فرع جدة',
    'فرع الدمام',
  ],
  notes:
    'اتفاقية مغلقة على نموذج وزارة المالية (4149): الأسعار المرجعية ثابتة طوال المدة، وكل أمر شراء يُصدر بكتابٍ مستقل ويُنشأ له عقد تنفيذ عند الاعتماد. الكميات تقديرية ولا تُلزم الجهة بشراء كامل السقف.',
};

/** ثمانية بنود بأسعار مرجعية — والسعر لكل طرف يُضبط بعد الانضمام. */
const ITEMS = [
  { itemNumber: '1', productCode: 'IT-LT-14', description: 'حاسب محمول 14 بوصة — معالج Core i7 الجيل 13، ذاكرة 16GB، قرص SSD 512GB، ضمان 3 سنوات', unit: 'جهاز', referenceUnitPrice: 3_850, category: 'أجهزة حاسب', onMandatoryList: true, countryOfOrigin: 'الصين', spread: [0, 60] },
  { itemNumber: '2', productCode: 'IT-DS-24', description: 'حاسب مكتبي مع شاشة 24 بوصة — معالج Core i5، ذاكرة 16GB، قرص SSD 512GB', unit: 'جهاز', referenceUnitPrice: 3_200, category: 'أجهزة حاسب', onMandatoryList: true, countryOfOrigin: 'الصين', spread: [-50, 40] },
  { itemNumber: '3', productCode: 'IT-DK-USBC', description: 'قاعدة توصيل USB-C بمنفذين للشاشة وشبكة سلكية', unit: 'قطعة', referenceUnitPrice: 650, category: 'ملحقات', onMandatoryList: false, countryOfOrigin: 'تايوان', spread: [0, 20] },
  { itemNumber: '4', productCode: 'IT-PR-A4', description: 'طابعة ليزر شبكية A4 أحادية اللون، طباعة على الوجهين، 40 صفحة/دقيقة', unit: 'جهاز', referenceUnitPrice: 1_900, category: 'طباعة', onMandatoryList: true, countryOfOrigin: 'اليابان', spread: [-100, 0] },
  { itemNumber: '5', productCode: 'IT-TN-A4', description: 'خرطوشة حبر أصلية للطابعة الشبكية A4 — سعة 10,000 صفحة', unit: 'خرطوشة', referenceUnitPrice: 420, category: 'مستهلكات', onMandatoryList: false, countryOfOrigin: 'اليابان', spread: [0, 15] },
  { itemNumber: '6', productCode: 'IT-SW-48', description: 'محوّل شبكة مُدار 48 منفذ PoE+ جيجابت مع 4 منافذ SFP+', unit: 'جهاز', referenceUnitPrice: 9_800, category: 'شبكات', onMandatoryList: true, countryOfOrigin: 'الولايات المتحدة', spread: [0, 300] },
  { itemNumber: '7', productCode: 'IT-AP-WIFI6', description: 'نقطة وصول لاسلكية Wi-Fi 6 داخلية مع التركيب والتهيئة', unit: 'نقطة', referenceUnitPrice: 1_450, category: 'شبكات', onMandatoryList: false, countryOfOrigin: 'الولايات المتحدة', spread: [-30, 50] },
  { itemNumber: '8', productCode: 'IT-UPS-3K', description: 'وحدة طاقة غير منقطعة 3KVA لغرف الاتصالات مع بطاريات', unit: 'وحدة', referenceUnitPrice: 5_600, category: 'طاقة', onMandatoryList: false, countryOfOrigin: 'الصين', spread: [0, 0] },
];

/**
 * أربعة أوامر شراء — كلٌّ في حالة: `approved` يُعتمد فيُنشأ عقده، و`pending`
 * يُقدَّم ويُترك، و`rejected` يُقدَّم ثم يُردّ بملاحظة، و`draft` يبقى مسودة.
 * `party`: فهرس الطرف (0 = بلا بريد، يصلح للاعتماد؛ 1 = له بريد، لا يُعتمد).
 */
const ORDERS = [
  {
    outcome: 'approved',
    party: 0,
    referenceNumber: 'PR-2026-0412',
    region: 'الرياض',
    site: 'المبنى الرئيسي — الإدارة العامة لتقنية المعلومات، الدور الثالث',
    scope: 'توريد أجهزة حاسب محمولة وقواعد توصيل لموظفي الإدارة العامة لتقنية المعلومات ضمن خطة إحلال الأجهزة 2026 — التوريد دفعة واحدة مع التسجيل في نظام الأصول.',
    completionDays: 30,
    retentionPct: 0,
    purchaseRequestRef: 'PR-2026-0412',
    contactName: 'م. عبدالعزيز الشهري',
    contactPhone: '0112345678',
    deliveryContactName: 'أ. سعد القحطاني — المستودع الرئيسي',
    deliveryContactPhone: '0554443322',
    shippingFee: 0,
    notes: 'يُرفق مع التوريد شهادة المنشأ وقائمة الأرقام التسلسلية لكل جهاز.',
    lines: [
      { item: 0, quantity: 120, deliveryIn: 25 },
      { item: 2, quantity: 120, deliveryIn: 25 },
    ],
  },
  {
    outcome: 'pending',
    party: 0,
    referenceNumber: 'PR-2026-0467',
    region: 'جدة',
    site: 'فرع جدة — مبنى الخدمات، الدور الأول',
    scope: 'طابعات شبكية وخراطيش حبر لأقسام فرع جدة بعد توسعة المكاتب.',
    completionDays: 21,
    retentionPct: 0,
    purchaseRequestRef: 'PR-2026-0467',
    contactName: 'أ. هند الغامدي',
    contactPhone: '0126789012',
    deliveryContactName: 'أ. ماجد الزهراني — مستودع فرع جدة',
    deliveryContactPhone: '0566778899',
    shippingFee: 1_200,
    notes: null,
    lines: [
      { item: 3, quantity: 18, deliveryIn: 18 },
      { item: 4, quantity: 60, deliveryIn: 18 },
    ],
  },
  {
    outcome: 'rejected',
    party: 0,
    referenceNumber: 'PR-2026-0471',
    region: 'الرياض',
    site: 'المبنى الرئيسي — غرفة الاتصالات الرئيسية',
    scope: 'وحدات طاقة غير منقطعة لغرف الاتصالات في المبنى الرئيسي.',
    completionDays: 30,
    retentionPct: 0,
    purchaseRequestRef: 'PR-2026-0471',
    contactName: 'م. عبدالعزيز الشهري',
    contactPhone: '0112345678',
    deliveryContactName: 'أ. سعد القحطاني — المستودع الرئيسي',
    deliveryContactPhone: '0554443322',
    shippingFee: 0,
    notes: null,
    lines: [{ item: 7, quantity: 40, deliveryIn: 28 }],
    rejectNote:
      'الكمية تفوق احتياج غرف الاتصالات الفعلي (12 غرفة). يُعاد الأمر بعد تحديث الحصر من إدارة البنية التحتية.',
  },
  {
    outcome: 'draft',
    party: 1,
    referenceNumber: null,
    region: 'الدمام',
    site: 'فرع الدمام — مبنى الإدارة، غرفة الشبكة',
    scope: 'محوّلات شبكة ونقاط وصول لاسلكية لإعادة تأهيل شبكة فرع الدمام.',
    completionDays: 45,
    retentionPct: 5,
    purchaseRequestRef: null,
    contactName: 'م. فهد العتيبي',
    contactPhone: '0138765432',
    deliveryContactName: null,
    deliveryContactPhone: null,
    shippingFee: 0,
    notes: 'بانتظار اعتماد طلب الشراء من الفرع قبل التقديم.',
    lines: [
      { item: 5, quantity: 6, deliveryIn: 40 },
      { item: 6, quantity: 24, deliveryIn: 40 },
    ],
  },
];

const APPROVER_ROLE = 'معتمد أوامر الشراء (تجريبي)';
const APPROVER_PERMISSIONS = ['frameworkagreements.read', 'frameworkagreements.approve'];

/** حساب المعتمد: يُنشأ مع دوره عند أول تشغيل، ويُكتفى بتسجيل دخوله بعدها. */
const approverToken = async () => {
  const tryLogin = () =>
    call('POST', '/auth/login', { email: APPROVER_EMAIL, password: APPROVER_PASSWORD }).catch(
      (err) => (err.status === 401 ? null : Promise.reject(err)),
    );
  const existing = await tryLogin();
  if (existing) return existing.tokens.accessToken;

  const roles = await call('GET', '/roles');
  let role = (Array.isArray(roles) ? roles : roles.items ?? []).find((r) => r.name === APPROVER_ROLE);
  if (!role) {
    role = await call('POST', '/roles', {
      name: APPROVER_ROLE,
      description: 'حساب تجريبي يعتمد أوامر الشراء على الاتفاقيات الإطارية — لفصل المهام في بيانات العرض',
      permissionKeys: APPROVER_PERMISSIONS,
    });
  }
  const user = await call('POST', '/users', {
    email: APPROVER_EMAIL,
    password: APPROVER_PASSWORD,
    fullName: 'مدير إدارة المشتريات التجريبي',
    title: 'معتمد أوامر الشراء',
  });
  await call('POST', `/users/${user.id}/roles`, { roleId: role.id });
  console.log(`✓ معتمد جديد: ${APPROVER_EMAIL} — دور «${APPROVER_ROLE}»`);
  const login = await tryLogin();
  if (!login) throw new Error('تعذّر تسجيل دخول المعتمد بعد إنشائه');
  return login.tokens.accessToken;
};

const main = async () => {
  const login = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
  token = login.tokens.accessToken;
  const approver = await approverToken();

  // ── المتعاقدون: نأخذ المسجّلين، ونضع من لا بريدَ له أولًا ──────────────
  const registry = await call('GET', '/contractors');
  const contractors = (Array.isArray(registry) ? registry : registry.items ?? [])
    .filter((c) => c.status === 'active')
    .sort((a, b) => Number(!!a.email) - Number(!!b.email));
  if (contractors.length < 2) {
    throw new Error('يلزم متعاقدان مسجّلان على الأقل — أنشئهما أولًا (عقد أو دعوة).');
  }
  if (contractors[0].email) {
    throw new Error('كل المتعاقدين لهم بريد — الاعتماد سيراسلهم؛ أضف متعاقدًا بلا بريد.');
  }
  const [partyA, partyB] = contractors;

  // ── الاتفاقية ─────────────────────────────────────────────────────────
  // تُنشأ مسودةً ثم تُفعَّل بعد اكتمال أطرافها: الاتفاقية المغلقة لا تقبل
  // انضمامَ طرفٍ بعد سريانها (قاعدة المجال).
  const draft = await call('POST', '/framework-agreements', AGREEMENT);
  console.log(`✓ الاتفاقية: ${draft.title} — ${draft.referenceNumber}`);
  const agreement = { ...draft };

  const parties = [];
  for (const [i, c] of [partyA, partyB].entries()) {
    const party = await call('POST', `/framework-agreements/${agreement.id}/parties`, {
      contractorId: c.id,
      joinedAt: AGREEMENT.signedAt,
      notes: i === 0 ? 'المورّد الأول بالترتيب — الأسعار الأدنى في معظم البنود' : 'مورّد بديل — يفوز عند نفاد مخزون الأول أو في المناطق الشرقية',
    });
    parties.push(party);
    console.log(`  ↳ طرف: ${c.name}`);
  }

  const items = await call('PUT', `/framework-agreements/${agreement.id}/items`, {
    items: ITEMS.map(({ spread, ...item }) => ({
      ...item,
      partyPrices: {
        [parties[0].id]: item.referenceUnitPrice + spread[0],
        [parties[1].id]: item.referenceUnitPrice + spread[1],
      },
    })),
  });
  console.log(`  ↳ ${items.length} بنود بأسعار مرجعية`);

  const activated = await call('PATCH', `/framework-agreements/${agreement.id}`, { status: 'active' });
  console.log(`  ↳ الحالة: ${activated.status}`);

  // ── أوامر الشراء ──────────────────────────────────────────────────────
  for (const spec of ORDERS) {
    const party = parties[spec.party];
    const { outcome, party: _p, lines, rejectNote, ...fields } = spec;
    const body = {
      ...fields,
      partyId: party.id,
      issueDate: iso(daysFromNow(outcome === 'draft' ? 0 : -(ORDERS.indexOf(spec) + 1) * 6)),
      startDate: iso(daysFromNow(outcome === 'draft' ? 7 : 3)),
      currency: 'SAR',
      applyLocalContentWeighting: true,
      applyLocalContentMinimum: false,
      lines: lines.map((l) => {
        const item = items[l.item];
        return {
          agreementItemId: item.id,
          quantity: l.quantity,
          unitPrice: item.partyPrices?.[party.id] ?? item.referenceUnitPrice,
          deliveryDate: iso(daysFromNow(l.deliveryIn)),
        };
      }),
    };
    let order = await call('POST', `/framework-agreements/${agreement.id}/purchase-orders`, body);
    if (outcome !== 'draft') {
      order = await call('POST', `/purchase-orders/${order.id}/submit`);
    }
    if (outcome === 'approved') {
      order = await call(
        'POST',
        `/purchase-orders/${order.id}/decide`,
        { decision: 'approved', note: 'ضمن السقف والأسعار المرجعية — يُصدر كتاب أمر الشراء.' },
        approver,
      );
    }
    if (outcome === 'rejected') {
      order = await call(
        'POST',
        `/purchase-orders/${order.id}/decide`,
        { decision: 'rejected', note: rejectNote },
        approver,
      );
    }
    console.log(
      `✓ أمر شراء ${order.orderNumber ?? order.id} — ${order.status} — ${fmt(order.value ?? 0)} — ${party.contractorName ?? ''}` +
        (order.contractNumber ? ` — عقد ${order.contractNumber}` : ''),
    );
  }

  const capacity = await call('GET', `/framework-agreements/${agreement.id}/capacity`);
  console.log(
    `\nالسقف ${fmt(agreement.value)} — المحجوز ${fmt(capacity.committedValue)} — المتبقي ${fmt(capacity.remainingValue ?? agreement.value - capacity.committedValue)}`,
  );
  console.log(`الرابط: /portal/framework-agreements/${agreement.id}`);
};

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
