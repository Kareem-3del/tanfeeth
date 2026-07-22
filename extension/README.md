# تنفيذ — التعبئة في اعتماد

إضافة كروم (Manifest V3) تعمل كجسر تعبئة تلقائية من منصة **تنفيذ** إلى نموذج
إنشاء المنافسة في منصة **اعتماد** (`tenders.etimad.sa/Tender/AddTender`).

الإضافة **لا ترسل ولا تحفظ** أي شيء نيابةً عن المستخدم — التعبئة فقط، وزر
«حفظ ومتابعة» في اعتماد يضغطه المستخدم بنفسه دائمًا. لا يوجد أي اتصال شبكي
خارجي، ولا تسجيل دخول، ولا تتبّع.

## التثبيت (Load unpacked)

1. افتح كروم واذهب إلى `chrome://extensions`.
2. فعّل **وضع المطوّر** (Developer mode) من أعلى يمين الصفحة.
3. اضغط **Load unpacked** واختر مجلد `extension/` من هذا المستودع.
4. تأكد أن الإضافة ظهرت باسم «تنفيذ — التعبئة في اعتماد» وأنها مفعّلة.

## طريقة العمل (الفلو)

1. من داخل تطبيق تنفيذ (في التطوير: `http://localhost:3002`) ومن صفحة معالج
   المنافسة، يضغط المستخدم زر «التعبئة في اعتماد» — فيرسل التطبيق رسالة
   `postMessage` (العقد بالأسفل).
2. سكربت المحتوى الخاص بالإضافة على نطاق تنفيذ يلتقط الرسالة، يحفظ الحمولة في
   `chrome.storage.local`، ثم يفتح تبويبًا جديدًا على
   `https://tenders.etimad.sa/Tender/AddTender`.
3. على أي صفحة من صفحات اعتماد، إذا وُجدت حمولة محفوظة **أحدث من ساعتين**:
   - يُرسم إطار أزرق (#0066CC) بسماكة 3px حول الصفحة + شريط علوي (Badge)
     يوضح أن الصفحة تحت تحكم إضافة تنفيذ.
   - تُعبّأ حقول الصفحة الحالية تلقائيًا بعد ~1.2 ثانية (مهلة لتهيئة select2)،
     ويظهر على الشريط: «تم تعبئة N حقلًا — راجع واضغط حفظ ومتابعة».
   - معالج اعتماد متعدد الصفحات (7 خطوات): الحمولة تبقى محفوظة، وكل صفحة
     جديدة تُعبّئ حقولها الخاصة بها. الصفحات التي عُبّئت من قبل لا يُعاد
     ملؤها تلقائيًا — زر **«إعادة التعبئة»** على الشريط يجبر إعادة الملء.
4. المستخدم يراجع ويضغط حفظ بنفسه في كل خطوة.

## عقد الرسالة (postMessage) — الجهة المرسِلة: تطبيق تنفيذ

يرسل التطبيق من صفحة معالج المنافسة:

```js
window.postMessage(
  {
    source: "tanfeeth",
    type: "TANFEETH_ETIMAD_FILL",
    payload: {
      etimadFields: {
        // المفاتيح = قيمة السمة name في DOM اعتماد (انظر خريطة الحقول بالأسفل)
        TenderName: "تطوير منظومة إجراءات التراخيص والتصاريح",
        TenderTypeId: "منافسة عامة",            // select: مطابقة نص الخيار أولًا ثم value
        Purpose: "…",
        ConditionsBookletPrice: 500,
        InsideKSA: true,                          // radio نعم/لا: boolean أو "نعم"/"لا"
        TenderAreaIDs: ["منطقة الرياض", "منطقة مكة المكرمة"], // multiselect: مصفوفة نصوص عربية
        IsLinkedToAnnouncement: false,            // checkbox: boolean
        OffersDeliveryDate: "1447/05/01",
        OffersDeliveryDate__calendar: "هجري",     // تلميح التقويم للحقل المرافق cb_OffersDeliveryDate
        Description: "…",
        CerificatesIDs: ["شهادة الزكاة والدخل"]
      }
    },
    meta: { competitionId: "…", title: "اسم المنافسة" }
  },
  "*"
);
```

وترد الإضافة على نفس النافذة (اختياري للاستماع له من التطبيق) بـ:

```js
{ source: "tanfeeth-extension", type: "TANFEETH_ETIMAD_FILL_ACK", meta, savedAt }
```

### اصطلاحات القيم حسب نوع الحقل

| نوع الحقل | القيمة المتوقعة | السلوك |
|---|---|---|
| text / number / textarea | نص أو رقم | تعيين القيمة عبر الـ native setter + أحداث `input`/`change` |
| select | نص الخيار العربي (مطابقة تامة بعد trim) أو `value` | تعيين + `change` + مزامنة jQuery/select2 في سياق الصفحة |
| multiselect | مصفوفة نصوص عربية (أو values) | اختيار كل المطابقات + مزامنة select2 |
| radio (نعم/لا) | `true`/`false` أو "نعم"/"لا" | `true` = زر «نعم»، `false` = زر «لا» (بالـ value ثم بنص الـ label) |
| radio (قيمي) | نص الـ label أو الـ value | مطابقة value ثم نص الـ label |
| checkbox | `true`/`false` | نقر (click) حتى تتطابق الحالة |
| date | نص التاريخ | إن وُجد مفتاح مرافق `<الاسم>__calendar` = "ميلادي" يُفعَّل مربع «ميلادي» (`cb_<الاسم>`) أولًا، و"هجري" يُعطَّل، ثم يُكتب التاريخ |

الحقول غير الموجودة في الصفحة الحالية تُتخطى بصمت (تُحتسب skipped)، وحقول
`data` (للقراءة فقط مثل `ReferenceNumber`) لا تُلمس. ملخص مفصّل لكل حقل يُطبع
في Console المتصفح داخل مجموعة `[Tanfeeth → Etimad]` (جدول key/status/detail).

## مخطط التخزين (`chrome.storage.local`)

```js
{
  // الحمولة الملتقطة من تنفيذ
  tanfeethEtimadFill: {
    payload: { etimadFields: { … } },
    meta: { competitionId, title },
    savedAt: 1769000000000   // Date.now() لحظة الالتقاط
  },

  // سجل التعبئة لكل صفحة (pathname + search) — يُصفَّر مع كل التقاط جديد
  tanfeethFillLog: {
    "/Tender/AddTender": { filled: 12, skipped: 3, failed: 0, at: 1769000005000 }
  }
}
```

## قاعدة الصلاحية (ساعتان)

الحمولة تُعتبر صالحة لمدة **ساعتين** من لحظة `savedAt`. بعد انقضائها تتجاهل
الإضافة الحمولة تمامًا: لا إطار، لا شريط، لا تعبئة — حتى يعيد المستخدم الضغط
على زر التعبئة من داخل تنفيذ (وكل التقاط جديد يصفّر سجل الصفحات المعبأة).

## خريطة الحقول

المصدر المرجعي الكامل (الخيارات، الإلزامية، رسائل التحقق) في:
`docs/product/etimad-fill-contract.json` (خطوات المعالج السبع:
basic / classification / datesAddresses / fragmentation / spendingEfficiency /
quantityTables / bookletFiles).

نسخة مختصرة مضمّنة داخل الإضافة في `src/field-meta.js`
(`ETIMAD_FIELD_META`: المفتاح ← نوع التحكم + الخطوة) — عند تغيّر نموذج اعتماد
حدِّث ملف العقد أولًا ثم انعكس التغيير يدويًا على `field-meta.js`.

## بنية الملفات

```
extension/
├── manifest.json            # MV3: content scripts + service worker + storage
├── src/
│   ├── tanfeeth-capture.js  # على نطاق تنفيذ: التقاط postMessage وحفظه وفتح اعتماد
│   ├── etimad-fill.js       # على نطاق اعتماد: الإطار + الشريط + محرك التعبئة
│   ├── field-meta.js        # خريطة المفتاح ← نوع التحكم/الخطوة (مولّدة من ملف العقد)
│   ├── page-bridge.js       # جسر سياق الصفحة لمزامنة jQuery/select2
│   ├── background.js        # فتح تبويب اعتماد عند الالتقاط
│   └── overlay.css          # أنماط الإطار والشريط
└── icons/                   # 16/48/128 — مربع أزرق #0066CC بعلامة «ت» هندسية بيضاء
```

## ملاحظات أمان

- لا صلاحيات مضيف إضافية: سكربتات المحتوى محصورة في `localhost:3002` و
  `tenders.etimad.sa` فقط، والصلاحية `storage` فقط.
- لا يُقبل `postMessage` إلا إذا كان مصدره نفس النافذة (`event.source === window`)
  وبنية الرسالة مطابقة للعقد.
- عند اعتماد نطاقات staging لاحقًا، أضِفها إلى `content_scripts[0].matches`
  في `manifest.json` (مثال: `https://*.tanfeeth.example/*`).
