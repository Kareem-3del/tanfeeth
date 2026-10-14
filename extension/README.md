# تنفيذ — المساعد والتعبئة في اعتماد (0.3)

إضافة كروم (Manifest V3) بهوية frontend-v3 «Slate & Leaf»:

- **لوحة جانبية** (أيقونة الإضافة تفتحها) فيها مساعد تنفيذ الذكي بأسلوب ChatGPT،
  وقائمة المشاريع، وحال التعبئة، والإعدادات.
- **شريط تنفيذ أعلى صفحات اعتماد** (`tenders.etimad.sa`): تسجيل الدخول ← اختيار مشروع ←
  «تعبئة الحقول»، مع فتح المساعد. يُصغَّر إلى زر دائري في الزاوية.
- **استفسارات الموردين** (جديد في 0.3): سحب الاستفسارات من اعتماد إلى تنفيذ، وكتابة الردود
  المعتمدة في تنفيذ مسودةً في اعتماد — انظر «الاستفسارات» بالأسفل.
- **تسجيل الدخول إلزامي**: بدون جلسة لا تعمل التعبئة ولا الالتقاط ولا المساعد.

الإضافة **لا تضغط «حفظ ومتابعة» ولا ترسل شيئا في اعتماد** — المراجعة والحفظ على
المستخدم دائما (R-03). لا تتصل إلا بخادم تنفيذ الذي سجّل المستخدم الدخول إليه، والخطوط
مضمّنة (لا طلبات خارجية).

## التثبيت

1. `chrome://extensions` ← فعّل **وضع المطوّر**.
2. **Load unpacked** ← اختر مجلد `extension/`. (بعد أي تعديل: زر التحديث على بطاقة الإضافة،
   ثم حدّث صفحات اعتماد المفتوحة.)
3. اضغط أيقونة تنفيذ ← سجّل الدخول (اختر الخادم: التجريبية / الإنتاج / محلي).

يتطلب Chrome 116 أو أحدث (Side Panel API).

## الفلو

### أ) من الإضافة مباشرة (جديد)
1. اللوحة ← **المشاريع** ← «تعبئة في اعتماد» على المشروع.
   تجلب الإضافة `GET /competitions/:id/etimad-fill-payload` (صلاحية `competitions.read`)
   وتحفظ الحمولة.
2. افتح نموذج اعتماد (زر «فتح نموذج اعتماد» في تبويب **التعبئة**)؛ كل خطوة من المعالج
   تُعبّأ تلقائيا (أو بزر «تعبئة الحقول» إن أُوقفت التعبئة التلقائية).

### ب) من بوابة تنفيذ (العقد القديم باقٍ)
زر «التعبئة في اعتماد» في البوابة يرسل `postMessage` (العقد بالأسفل). إن كان المستخدم
مسجّلا في الإضافة: تُحفظ الحمولة ويُفتح اعتماد. وإن لم يكن: لا يُحفظ شيء ويظهر تنبيه
بزر «تسجيل الدخول» (والرد `TANFEETH_ETIMAD_FILL_ACK` يحمل `ok: false, reason: "AUTH_REQUIRED"`).

الحمولة صالحة **ساعتين** من تجهيزها؛ بعدها تُتجاهل.

## المساعد

- `POST /assistant/stream` (SSE: `delta` ثم `done` أو `error`) — نفس مساعد البوابة.
- يُرسل مع كل سؤال سياق الصفحة المفتوحة: في اعتماد عناوين الخطوة والحقول الظاهرة ونتيجة
  آخر تعبئة (يقرؤها سكربت اعتماد عبر `TNF_PAGE_CONTEXT`).
- خيارات مقترحة حسب الصفحة (في اعتماد: عبّئ هذه الصفحة، اشرح الحقول، راجع قبل الحفظ…).
- آخر ٤٠ رسالة تُحفظ محليا؛ «محادثة جديدة» يمسحها.

## الاستفسارات (اعتماد ↔ تنفيذ)

التصميم في `docs/product/COMMUNICATIONS-MODULE.md` (§1، §3، §3.1). السكربت
`src/content/etimad-inquiries.js` والقارئ النقي `src/content/etimad-inquiries-parse.js`
(`parseEtimadInquiries(doc)` و`parseEnquiryList(doc)` — بلا chrome، يُختبر في Node).

| الصفحة في اعتماد | ما يظهر |
|---|---|
| تفاصيل المنافسة (`/Tender/Details`، `/Tender/DetailsForAll`) | في شريط تنفيذ «مزامنة الاستفسارات (N)» ← ملخص «18 جديد · 5 ردود جاهزة للكتابة» ← «اكتب الردود الجاهزة» |
| «إستفسارات الموردين» (`/Enquiry/SupplierEnquiryList`) | شارة على كل بطاقة منافستها مسجلة في تنفيذ (العنوان والمعلق) بزر «مزامنة»، و«مزامنة الكل» في الشريط. البطاقة غير المطابقة بلا شارة |
| صفحة الرد (`/Enquiry/SupplierEnquiriesOnTender/<id>`) | «اكتب الردود الجاهزة» من آخر مزامنة (صالحة ساعتين) |

- **القراءة**: من جزء اعتماد نفسه `GET /Tender/GetEnquiryViewComponenet?tenderIdStr=<STenderId>`
  (كذا الإملاء في اعتماد؛ نفس طلب تبويب «الإستفسارات» بجلسة المستخدم) فتعمل دون فتح التبويب،
  وإلا من `#inquiriesDiv` المرسوم. رقم الاستفسار الأصلي (`nativeId`) = `aria-controls` في رأسه.
  `complete: true` فقط حين تُقرأ القائمة كاملة (اعتماد يرسمها كلها بلا ترقيم صفحات).
- **البصمات يحسبها الخادم** — الإضافة ترسل الصفوف خاما.
- **الكتابة**: لكل صف فيه `write` نحدد الكتلة برقمها (`id` أو `aria-controls`)، وإلا بموضعها
  وقت المزامنة، ونتحقق أن نص السؤال يطابق المزامنة بعد التطبيع (وإلا لا نكتب: «تغيّر نصها —
  زامن من جديد»). ثم أقرب `textarea`/contenteditable داخل الكتلة دون أن نتجاوز إلى استفسار
  آخر: إن كانت **فارغة** نملؤها بالضابط الأصلي + `input`/`change`، ونحدد الكتلة بلون تنفيذ مع
  «مسودة من تنفيذ — راجِع ثم أرسل». الخانة غير الفارغة لا تُمس. ثم
  `POST …/injected` بالبصمات التي كُتبت فعلا.
- **زر «نسخ ردّ تنفيذ»** بجانب كل استفسار له رد جاهز — يعمل حتى لو لم توجد خانة رد.
- **لا نضغط «إرسال» ولا «اعتماد» في اعتماد أبدا** — الموظف يرسل، والمزامنة التالية ترى الرد منشورا.
- بنية صفحة الرد في اعتماد **غير موثقة لدينا** (لم تُحفظ نسخة منها): الكتابة فيها تخمينية بالقاعدة
  أعلاه؛ إن لم نجد خانة لكل استفسار (نافذة رد مشتركة مثلا) يبقى زر النسخ. صفحة التفاصيل العامة
  بلا خانات رد، فالكتابة فيها نسخ فقط.

رسائل عامل الخلفية (من صفحات `tenders.etimad.sa` فقط؛ الخلفية وحدها تحمل الرمز):

| الرسالة | الطلب |
|---|---|
| `TNF_INQ_MATCH { references[] }` | `GET /competitions/etimad-inquiries/match?references=…` |
| `TNF_INQ_SYNC { body }` | `POST /competitions/etimad-inquiries/sync` (حقول العقد فقط) |
| `TNF_INQ_INJECTED { etimadReference, fingerprints[] }` | `POST /competitions/etimad-inquiries/injected` |

الرد `{ ok: true, data }` أو `{ ok: false, status, code, message }` برسالة عربية؛
`COMPETITIONS.INQUIRY_SYNC_NO_COMPETITION` ← «لا توجد منافسة في تنفيذ بهذا الرقم المرجعي — سجّل
الرقم في «اعتماد الطرح» أولًا». تبويب **التعبئة** في اللوحة يعرض ملخص آخر مزامنة لمنافسة التبويب المفتوح.

## الجلسة والأمان

- الدخول `POST /auth/login` ثم `GET /auth/me`. الجلسة في `chrome.storage.local`
  (`tanfeethSession`). **سكربتات المحتوى لا تقرأ الرموز** — تسأل عامل الخلفية
  `TNF_AUTH_STATE` فيرد `{ signedIn, name, email }` فقط.
- تجديد الرمز يملكه **عامل الخلفية وحده** (single-flight، `TNF_REFRESH`) لأن رمز التجديد
  يدور مع كل استخدام؛ رفض التجديد يمسح الجلسة فتُقفل الإضافة.
- طلبات API من صفحات الإضافة لا تخضع لـ CORS (host_permissions)، فلا تغيير في الخادم.
- «تسجيل الخروج» يبطل رمز التجديد على الخادم ثم يمسح الجلسة والمحادثة.
- كل نصوص الخادم تُبنى بـ `textContent` (عارض Markdown بلا `innerHTML`).

## عقد الرسالة (postMessage) — من بوابة تنفيذ

```js
window.postMessage({
  source: "tanfeeth",
  type: "TANFEETH_ETIMAD_FILL",
  payload: { etimadFields: { TenderName: "…", TenderTypeId: "منافسة عامة", … }, raw: { …الحمولة بمفاتيحنا } },
  meta: { competitionId: "…", title: "اسم المشروع" }
}, window.location.origin);
```

الإضافة تضع `data-tanfeeth-extension="2"` على `<html>` في صفحات البوابة. اصطلاحات قيم
الحقول (select بنص الخيار، radio بـ true/false أو «نعم/لا»، التاريخ مع `<الحقل>__calendar`)
كما هي في `src/content/etimad-fill.js`، والخريطة في `src/content/field-meta.js`
(مرجعها `docs/product/etimad-fill-contract.json`).

## التخزين (`chrome.storage.local`)

| المفتاح | المحتوى |
|---|---|
| `tanfeethSession` | `{ serverId, accessToken, refreshToken, expiresAt, user }` |
| `tanfeethServer` | آخر خادم مختار |
| `tanfeethEtimadFill` | `{ payload, meta: { competitionId, title, source }, savedAt }` |
| `tanfeethFillLog` | سجل التعبئة لكل صفحة (يُصفَّر مع كل حمولة جديدة) |
| `tanfeethSettings` | `{ enabled, autoFill, showOverlay, fillCriteria }` |
| `tanfeethPrefs` | `{ theme, launcherCollapsed }` |
| `tanfeethChat` | آخر رسائل المحادثة |
| `tanfeethPanelIntent` | طلب مؤقت من الصفحة لفتح اللوحة على شاشة معينة |
| `tanfeethInquirySync` | `{ byRef: { <مرجع>: آخر مزامنة + الردود الجاهزة + آخر كتابة }, tenderRefs: { <STenderId>: <مرجع> } }` (آخر ٣٠ منافسة) |

## بنية الملفات

```
extension/
├── manifest.json
├── fonts/                     # Alexandria + IBM Plex Sans Arabic (woff2 مضمّنة)
├── icons/                     # من frontend-v3/src/app/icon.svg
└── src/
    ├── background.js          # فتح اللوحة، التجديد، حال الدخول، فتح اعتماد
    ├── shared/config.js       # الخوادم والمفاتيح (content scripts تنسخ ما تحتاجه في ui-kit.js)
    ├── shared/api.js          # الجلسة، authFetch، بث المساعد، حمولة التعبئة
    ├── panel/                 # اللوحة الجانبية
    │   ├── panel.html/.css/.js, theme-boot.js
    │   ├── dom.js, markdown.js, labels.js, chat-store.js
    │   └── views/ login · chat · projects · fill · settings
    └── content/
        ├── ui-kit.js          # خطوط، أيقونات Lucide، Shadow DOM
        ├── tanfeeth-capture.js
        ├── etimad-fill.js     # محرك التعبئة + شريط تنفيذ (وأوضاع الشريط من ui-kit)
        ├── etimad-inquiries-parse.js  # قارئ الاستفسارات النقي
        ├── etimad-inquiries.js        # مزامنة الاستفسارات وكتابة الردود
        ├── etimad-criteria.js, field-meta.js, page-bridge.js
```

## خوادم جديدة

أضف الخادم إلى `SERVERS` في `src/shared/config.js`، ونطاقه (API والويب) إلى
`host_permissions` — ونطاق الويب إلى `content_scripts[0].matches` إن كانت البوابة ترسل منه.
