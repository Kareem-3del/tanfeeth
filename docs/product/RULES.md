# Tanfeeth — Binding Rules / القواعد المُلزِمة

> These rules are **binding** for every contributor, feature, and AI agent working
> on Tanfeeth. They are derived from the FRD, the Flow & Functions workbook, and the
> non‑functional requirements. They are referenced from the root `CLAUDE.md`. When a
> rule and a quick implementation conflict, **the rule wins** — raise it, don’t work
> around it. Full context: [`PRODUCT.en.md`](./PRODUCT.en.md) · [`PRODUCT.ar.md`](./PRODUCT.ar.md).
>
> هذه القواعد **مُلزِمة** لكل مساهم وميزة ووكيل ذكاء اصطناعي يعمل على «تنفيذ». وهي
> مشتقّة من الـFRD ومصنّف التدفق والمتطلبات غير الوظيفية، ومُشار إليها من `CLAUDE.md`
> الجذري. عند تعارض قاعدة مع حلٍّ سريع، **تُقدَّم القاعدة** — أثرها ولا تلتفّ عليها.

---

### R‑01 — Workflow integrity / سلامة سير العمل
**EN:** Every state change is a **gated transition** in the workflow engine: allowed
only for the owning role(s) and only when the stage’s business rules pass. Never
mutate a competition/contract state by a side path. Model the 10 main‑path stages
and the exceptional paths exactly as in `PRODUCT`.
**AR:** كل تغيير حالة هو **انتقال محكوم** في محرك سير العمل: مسموح فقط للدور المالك
وعند استيفاء قواعد المرحلة. لا تُغيّر حالة منافسة/عقد عبر مسار جانبي. والتزم بالمراحل
العشر والمسارات الاستثنائية كما في `PRODUCT`.

### R‑02 — Audit everything / دقّق كل شيء
**EN:** Every transition and impactful action is written to an **immutable audit
log**: actor, timestamp, action, and state before/after. No silent state changes.
**AR:** يُسجَّل كل انتقال وإجراء ذي أثر في **سجل تدقيق غير قابل للتلاعب**: الفاعل،
الوقت، الإجراء، والحالة قبل/بعد. لا تغييرات صامتة.

### R‑03 — Human‑in‑the‑loop (HITL) is mandatory / الإشراف البشري إلزامي
**EN:** No AI output with **financial, contractual, or regulatory** impact is acted
upon without **explicit human review + approval**. Every AI recommendation must ship
with **explainability** (why it was produced). AI assists; humans decide.
**AR:** لا يُنفَّذ أي مخرَج للذكاء الاصطناعي ذي أثر **مالي أو تعاقدي أو تنظيمي** دون
**مراجعة واعتماد بشري صريح**. وكل توصية آلية تُرفق بـ**تفسيرها**. الذكاء يساعد،
والبشر يقرّرون.

### R‑04 — RBAC & the CDM access rule / الصلاحيات وقاعدة وصول CDM
**EN:** Access is **permission‑based**. The **Contract Dept Manager (CDM)** has
permanent default access to all actions on the department’s orders. **Assignment**
transfers the *action* permission to the assignee while CDM access remains.
**AR:** الوصول **قائم على الصلاحيات**. لـ**مدير العقود والمشتريات (CDM)** وصول دائم
افتراضي لكل إجراء على طلبات إدارته. و**الإسناد** ينقل صلاحية *الإجراء* للمُسنَد إليه
مع بقاء صلاحية CDM.

### R‑05 — Standard actions / الإجراءات القياسية
**EN:** Stage actions are drawn from the canonical set — **Confirm, Reject,
Return‑with‑comment, Edit, Assign, Comment, Sign** — and each is permission‑checked
and audited. Don’t invent per‑screen bespoke verbs.
**AR:** إجراءات المراحل من المجموعة المعيارية — **اعتماد، رفض، إرجاع مع تعليق، تعديل،
إسناد، تعليق، توقيع** — وكلٌّ مُتحقَّق من صلاحيته ومُدقَّق. لا أفعال مخصّصة لكل شاشة.

### R‑06 — BR‑01: configurable 5M split / فصل المستندات عند 5 ملايين
**EN:** When the budget is set, value **> 5M SAR** ⇒ split technical & financial
documents; otherwise merge. The threshold is **configurable** in the rules engine,
never hard‑coded.
**AR:** عند تحديد الميزانية، القيمة **> 5 ملايين ريال** ⇐ فصل المستندين الفني
والمالي؛ وإلا الدمج. والحدّ **قابل للتهيئة** في محرك القواعد، لا ثابتاً في الكود.

### R‑07 — BR‑02: commencement branches by project type / تفرّع المباشرة
**EN:** Commencement follows project type: **Supply** ⇒ direct commencement letter;
**Maintenance** ⇒ adds site‑handover minute + site‑handover committee approval.
**AR:** تتبع المباشرة نوع المشروع: **توريد** ⇐ خطاب مباشرة مباشر؛ **صيانة** ⇐ إضافة
محضر استلام موقع + اعتماد لجنة استلام الموقع.

### R‑08 — Etimad/Nafath/MoF are the source of truth / المنصات الوطنية مصدر الحقيقة
**EN:** **Etimad, Nafath, and the Ministry of Finance** are **critical** integrations.
Authentication is via Nafath; competitions are published and offers received via
Etimad; budget/examination via MoF. **Reflect Etimad/MoF state in Tanfeeth and
vice‑versa** — never let the two drift. Design for their contracts, not mocks.
**AR:** **اعتماد ونفاذ ووزارة المالية** تكاملات **حرجة**. المصادقة عبر نفاذ؛ ونشر
المنافسات واستلام العروض عبر اعتماد؛ والميزانية/الفحص عبر المالية. **اعكس حالة اعتماد/
المالية في تنفيذ والعكس** — دون انفصال بينهما. صمّم لعقودها لا لمحاكاتها.

### R‑09 — Official correspondence gets a reference / المراسلات الرسمية برقم مرجعي
**EN:** Any official external letter/correspondence must obtain a **reference number
& date** via the Incoming & Outgoing department integration before it leaves the
entity. No external letter without a reference.
**AR:** أي خطاب/مراسلة خارجية رسمية يجب أن تحصل على **رقم وتاريخ مرجعي** عبر تكامل
الوارد والصادر قبل خروجها. لا خطاب خارجي بلا مرجع.

### R‑10 — Data residency & security / إقامة البيانات والأمن
**EN:** Host **inside Saudi Arabia**; encrypt sensitive data at‑rest/in‑transit;
comply with **NCA/CST**. Never log or expose secrets, national IDs, or full
financial credentials.
**AR:** الاستضافة **داخل المملكة**؛ تشفير البيانات الحسّاسة عند التخزين/النقل؛ التوافق
مع **NCA/CST**. لا تُسجّل أو تكشف الأسرار أو الهويات الوطنية أو بيانات مالية كاملة.

### R‑11 — Multi‑tenant isolation / عزل متعدّد المستأجرين
**EN:** The platform is **multi‑tenant**; every query, file, and audit entry is
scoped to its entity (tenant). Cross‑tenant data access is a defect, not a feature.
**AR:** المنصة **متعدّدة المستأجرين**؛ كل استعلام وملف وسجل تدقيق مقيّد بجهته. الوصول
عبر المستأجرين خلل لا ميزة.

### R‑12 — Bilingual, RTL‑first, localized / ثنائية اللغة وRTL والتوطين
**EN:** Arabic (RTL) + English are first‑class everywhere; no hard‑coded user‑facing
strings. Support **Hijri + Gregorian** calendars and **SAR**. Use logical
(RTL‑aware) layout. (See the frontend i18n rule in the root `CLAUDE.md`.)
**AR:** العربية (RTL) والإنجليزية من الدرجة الأولى في كل مكان؛ لا نصوص مكتوبة بثبات
للمستخدم. ودعم **الهجري والميلادي** و**الريال**. واستخدم تخطيطاً منطقياً مراعياً
للـRTL. (راجع قاعدة i18n للواجهة في `CLAUDE.md`.)

### R‑13 — Configurable engine over hard‑coding / محرك قابل للتهيئة لا كود ثابت
**EN:** Thresholds, approval chains, document‑split rules, and stage gates live in
the **configurable rules/workflow engine**, not scattered in code. New entities
reuse the engine; they don’t fork a parallel flow.
**AR:** الحدود وسلاسل الاعتماد وقواعد فصل المستندات وبوابات المراحل في **محرك القواعد/
سير العمل القابل للتهيئة**، لا مبعثرةً في الكود. والجهات الجديدة تعيد استخدام المحرك
ولا تنشئ تدفّقاً موازياً.

### R‑14 — Traceability to requirements / التتبّع للمتطلبات
**EN:** Tie new work to a requirement ID (`FR-WF/EX/FT/CM/CT/HM/AI/V30`). If a
behavior isn’t in `PRODUCT`/the FRD, document it there first — don’t invent silent
domain behavior.
**AR:** اربط كل عمل جديد بمعرّف متطلب (`FR-WF/EX/FT/CM/CT/HM/AI/V30`). وإن لم يكن
السلوك في `PRODUCT`/الـFRD، فوثّقه هناك أولاً — لا تخترع سلوكاً مجالياً صامتاً.

### R‑15 — One domain model / نموذج مجال واحد
**EN:** Roles, stages, committees, and documents map to the single domain defined in
`PRODUCT`. Don’t introduce parallel role names, statuses, or lifecycles; extend the
canonical ones.
**AR:** الأدوار والمراحل واللجان والمستندات تنعكس على المجال الواحد في `PRODUCT`. لا
تُدخل أسماء أدوار أو حالات أو دورات حياة موازية؛ بل وسّع المعياري منها.

### R‑16 — Verify before claiming done / تحقّق قبل ادّعاء الإنجاز
**EN:** A workflow/integration/AI feature is “done” only when its transitions,
permissions, and audit entries are exercised and observed — not when it compiles.
Especially for impactful actions, demonstrate the gated path end‑to‑end.
**AR:** لا تُعدّ ميزة سير عمل/تكامل/ذكاء اصطناعي «منجزة» إلا بعد تشغيل ومعاينة
انتقالاتها وصلاحياتها وسجلات تدقيقها — لا بمجرّد نجاح البناء. وبخاصة للإجراءات ذات
الأثر، أثبت المسار المحكوم من طرف إلى طرف.

### R‑17 — Fixed permission catalog / كتالوج الصلاحيات ثابت (v2)
**EN:** Permissions are a seeded, closed catalog (operational `resource.action`
keys + the Etimad permission matrix v6). There is **no runtime permission
creation** — no page, no API. Administration composes roles from the catalog
only; new keys enter through the seed catalog in code review.
**AR:** الصلاحيات كتالوج مُغلق يُزرع مع النظام (المفاتيح التشغيلية
`resource.action` + مصفوفة صلاحيات اعتماد v6). **لا إنشاء صلاحيات وقت التشغيل**
— لا صفحة ولا API. الإدارة تكون بتركيب الأدوار من الكتالوج فقط، والمفاتيح
الجديدة تدخل عبر كتالوج الزرع بمراجعة كود.

### R‑18 — Annual plan runs on the announcement cycle / الخطة السنوية بدورة الإعلان (v2)
**EN:** The annual plan is assembled through announce → department submissions →
department‑manager approval → review → final approval. The submission window
state is **derived from server time on every request** (never stored, no
scheduler). Plans may target the current year up to five years ahead — never a
past year. A manager never decides an item they submitted themselves. Announcing
notifies every active user (in‑app + email). See `FR‑PL‑001…014`.
**AR:** تُبنى الخطة السنوية بدورة: إعلان → تقديم الإدارات → اعتماد مدير الإدارة
→ مراجعة → اعتماد نهائي. حالة نافذة التقديم **تُشتق من وقت الخادم عند كل طلب**
(لا تُخزَّن ولا مجدول). تُنشأ الخطة للسنة الحالية وحتى خمس سنوات قادمة فقط — لا
سنة ماضية. ولا يبت مدير في بند قدّمه بنفسه. الإعلان يبلّغ كل مستخدم نشط
(إشعار + بريد). انظر `FR‑PL‑001…014`.
