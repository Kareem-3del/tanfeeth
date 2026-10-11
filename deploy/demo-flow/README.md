# سيناريو العرض — من الخطة إلى إقفال العقد

كل خطوة بحساب صاحبها (`<الحساب>@example.com`، كلمة المرور `secret`). هذه الخطوات من آخر تشغيل كامل أخضر على staging (92 خطوة، 2026-10-11).

## التشغيل

```bash
node deploy/demo-flow/run.mjs                      # وضع العرض: Enter قبل كل خطوة
node deploy/demo-flow/run.mjs --auto               # اختبار كامل بلا توقف
node deploy/demo-flow/run.mjs --from=competition   # من المشروع (أو --from=contract)
```

في وضع العرض: اضغط Enter فتُنفَّذ الخطوة، ثم في demo.tanfeeth.io افتح «تبديل الحساب» من قائمة الحساب، واختر الحساب المطبوع، وافتح الشاشة المطبوعة.

إعداد الحسابات (مرة واحدة أو بعد أي تعديل للأدوار): `API=https://staging-api.tanfeeth.io/api EMAIL=admin@example.com PASSWORD=secret node deploy/seed-demo-users.mjs` — ثم كلمة المرور `secret` تُنسخ من تجزئة `admin@example.com` في قاعدة staging (الـAPI لا يقبل كلمة بسيطة).


## الخطة السنوية

| # | الحساب | ماذا يحدث | الشاشة |
|---|---|---|---|
| 1 | `plan.announcer` | مسؤول التخطيط يطلب تعديل الخطة المعتمدة بإضافة بند «توريد أجهزة حاسب آلي» لإدارة تقنية المعلومات | `/portal/plan/<id>?phase=execution` |
| 2 | `plan.approver` | معتمد الخطة يعتمد التعديل فيُضاف البند للخطة | `/portal/plan/<id>?phase=execution` |

## المشروع واللجان والترسية

| # | الحساب | ماذا يحدث | الشاشة |
|---|---|---|---|
| 3 | `tender.entry` | مدخل المنافسة ينشئ المشروع (طلب الطرح) | `/portal/competitions/new` |
| 4 | `tender.entry` | يعبّئ بيانات الكراسة وجداول الكميات (مربوطة بسجل المنتجات) ويسمّي مدخل القيمة التقديرية | `/portal/competitions/<id>/tender` |
| 5 | `estimate.entry` | مدخل القيمة التقديرية يُدخلها مختومة — لا يراها غيره حتى فتح العروض المالية | `/portal/competitions/<id>/tender` |
| 6 | `tender.entry` | يرسل الطلب لسلسلة الاعتماد | `/portal/competitions/<id>?phase=creation` |
| 7 | `tender.auditor` | مدققة المنافسة تعتمد خطوة «budget_head» | `/portal/competitions/<id>?phase=approvals` |
| 8 | `tender.auditor` | مدققة المنافسة تعتمد خطوة «finance» | `/portal/competitions/<id>?phase=approvals` |
| 9 | `tender.auditor` | مدققة المنافسة تعتمد خطوة «higher_management» | `/portal/competitions/<id>?phase=approvals` |
| 10 | `tender.auditor` | مدققة المنافسة تعتمد خطوة «cdm» | `/portal/competitions/<id>?phase=approvals` |
| 11 | `tender.entry` | يفتح كراسة الشروط ويُسندها لنفسه ثم يرفعها للاعتماد | `/portal/competitions/<id>/booklet` |
| 12 | `tender.entry` | يعتمد الكراسة بصيغتها النهائية — تتقدم المنافسة إلى التأهيل | `/portal/competitions/<id>/booklet` |
| 13 | `open.secretary` | التأهيل لاحق في هذه الكراسة — يُنقل الملف إلى مرحلة الإعلان | `/portal/competitions/<id>?phase=publishing` |
| 14 | `open.secretary` | يُقيّد نشر إعلان المنافسة برقمه في منصة اعتماد (النشر نفسه في اعتماد مُحاكى) | `/portal/competitions/<id>?phase=publishing` |
| 15 | `open.secretary` | بعد انقضاء موعد التقديم: تُسجَّل 3 عروض وردت من متنافسين (بيانات وهمية @example.com) | `/portal/competitions/<id>?phase=upload` |
| 16 | `open.secretary` | ينقل الملف إلى فتح العروض الفنية | `/portal/competitions/<id>?phase=evaluation&section=opening` |
| 17 | `open.secretary` | يعقد جلسة فتح العروض الفنية بحضور لجنة فتح العروض وفحصها ويحمّل العروض في محضرها | `/portal/competitions/<id>?phase=evaluation&section=opening` |
| 18 | `open.secretary` | يفحص قائمة التحقّق لكل عرض (جداول الكميات، الضمان، الشهادات، وثائق الكراسة) ثم يُخرج المحضر للتوقيع | `/portal/competitions/<id>?phase=evaluation&section=opening` |
| 19 | `open.chair` | توقيع محضر فتح العروض الفنية — رئيس لجنة فتح العروض وفحصها | `/portal/competitions/<id>?phase=evaluation&section=opening` |
| 20 | `open.deputy` | توقيع محضر فتح العروض الفنية — نائبة رئيس لجنة الفحص | `/portal/competitions/<id>?phase=evaluation&section=opening` |
| 21 | `open.secretary` | توقيع محضر فتح العروض الفنية — أمين لجنة الفحص | `/portal/competitions/<id>?phase=evaluation&section=opening` |
| 22 | `open.expert` | توقيع محضر فتح العروض الفنية — خبير فني | `/portal/competitions/<id>?phase=evaluation&section=opening` |
| 23 | `open.member` | توقيع محضر فتح العروض الفنية — عضو لجنة الفحص | `/portal/competitions/<id>?phase=evaluation&section=opening` |
| 24 | `open.secretary` | المحضر مختوم — يبدأ تقييم العروض | `/portal/competitions/<id>?phase=evaluation&section=scoring` |
| 25 | `tender.auditor` | مدققة المنافسة تفتح جلسة التقييم الفني وتكلّف لجنة التقييم الفني — تُجمَّد معايير الكراسة وأوزانها | `/portal/competitions/<id>?phase=evaluation&section=scoring` |
| 26 | `tech.chair` | رئيس لجنة التقييم الفني: تقييم العروض معيارًا معيارًا وتسليمه | `/portal/competitions/<id>?phase=evaluation&section=scoring` |
| 27 | `tech.deputy` | نائبة رئيس لجنة التقييم الفني: تقييم العروض معيارًا معيارًا وتسليمه | `/portal/competitions/<id>?phase=evaluation&section=scoring` |
| 28 | `tech.secretary` | أمين لجنة التقييم الفني: تقييم العروض معيارًا معيارًا وتسليمه | `/portal/competitions/<id>?phase=evaluation&section=scoring` |
| 29 | `tech.member` | عضو لجنة التقييم الفني: تقييم العروض معيارًا معيارًا وتسليمه | `/portal/competitions/<id>?phase=evaluation&section=scoring` |
| 30 | `tender.auditor` | مدققة المنافسة تجمّع نتيجة التقييم — يجتاز من بلغ حدّ الاجتياز | `/portal/competitions/<id>?phase=evaluation&section=scoring` |
| 31 | `tender.auditor` | تُصدر محضر التقييم الفني وتخرجه للتوقيع | `/portal/competitions/<id>?phase=evaluation&section=minute` |
| 32 | `tech.chair` | توقيع محضر التقييم الفني — ماجد رئيس التقييم الفني | `/portal/competitions/<id>?phase=evaluation&section=minute` |
| 33 | `tech.deputy` | توقيع محضر التقييم الفني — غادة نائبة التقييم الفني | `/portal/competitions/<id>?phase=evaluation&section=minute` |
| 34 | `tech.secretary` | توقيع محضر التقييم الفني — حسن أمين التقييم الفني | `/portal/competitions/<id>?phase=evaluation&section=minute` |
| 35 | `tech.member` | توقيع محضر التقييم الفني — دانة عضو التقييم الفني | `/portal/competitions/<id>?phase=evaluation&section=minute` |
| 36 | `tender.auditor` | ترفع المحضر الموقَّع إلى لجنة فتح العروض وفحصها | `/portal/competitions/<id>?phase=evaluation&section=minute` |
| 37 | `open.deputy` | اعتماد محضر التقييم الفني والتصويت على التوصية — مشاعل نائبة لجنة الفحص (لجنة الفحص) | `/portal/competitions/<id>?phase=evaluation&section=minute` |
| 38 | `open.secretary` | اعتماد محضر التقييم الفني والتصويت على التوصية — وليد أمين لجنة الفحص (لجنة الفحص) | `/portal/competitions/<id>?phase=evaluation&section=minute` |
| 39 | `open.expert` | اعتماد محضر التقييم الفني والتصويت على التوصية — نواف الخبير الفني (لجنة الفحص) | `/portal/competitions/<id>?phase=evaluation&section=minute` |
| 40 | `open.member` | اعتماد محضر التقييم الفني والتصويت على التوصية — أمل عضو لجنة الفحص (لجنة الفحص) | `/portal/competitions/<id>?phase=evaluation&section=minute` |
| 41 | `open.chair` | رئيس لجنة الفحص يصوّت ثم يعتمد محضر التقييم الفني — اعتمادُه آخرُ ما يقع | `/portal/competitions/<id>?phase=evaluation&section=minute` |
| 42 | `open.secretary` | يرسل الملف إلى فتح العروض المالية — المحضر الفني معتمد | `/portal/competitions/<id>?phase=evaluation&section=financial` |
| 43 | `open.secretary` | يعقد جلسة فتح العروض المالية بحضور لجنة فتح العروض وفحصها ويحمّل العروض في محضرها | `/portal/competitions/<id>?phase=evaluation&section=financial` |
| 44 | `open.secretary` | يرصد قيم المظاريف المالية للعروض المجتازة فنيًا (2) | `/portal/competitions/<id>?phase=evaluation&section=financial` |
| 45 | `open.secretary` | يفحص قائمة التحقّق لكل عرض (جداول الكميات، الضمان، الشهادات، وثائق الكراسة) ثم يُخرج المحضر للتوقيع | `/portal/competitions/<id>?phase=evaluation&section=financial` |
| 46 | `open.chair` | توقيع محضر فتح العروض المالية — رئيس لجنة فتح العروض وفحصها | `/portal/competitions/<id>?phase=evaluation&section=financial` |
| 47 | `open.deputy` | توقيع محضر فتح العروض المالية — نائبة رئيس لجنة الفحص | `/portal/competitions/<id>?phase=evaluation&section=financial` |
| 48 | `open.secretary` | توقيع محضر فتح العروض المالية — أمين لجنة الفحص | `/portal/competitions/<id>?phase=evaluation&section=financial` |
| 49 | `open.expert` | توقيع محضر فتح العروض المالية — خبير فني | `/portal/competitions/<id>?phase=evaluation&section=financial` |
| 50 | `open.member` | توقيع محضر فتح العروض المالية — عضو لجنة الفحص | `/portal/competitions/<id>?phase=evaluation&section=financial` |
| 51 | `open.secretary` | ينقل الملف إلى التقييم المالي والترسية — تنكشف القيمة التقديرية | `/portal/competitions/<id>?phase=award` |
| 52 | `tender.auditor` | تقرّ الالتزام المالي النهائي وطلب الارتباط على الميزانية | `/portal/competitions/<id>?phase=award` |
| 53 | `award.approver` | صاحب الصلاحية يُصدر قرار الترسية المبدئي على صاحب المرتبة الأولى — تبدأ فترة التوقف | `/portal/competitions/<id>?phase=award` |
| 54 | `award.approver` | يدوّن إشعار المتنافسين بقرار الترسية | `/portal/competitions/<id>?phase=award` |
| 55 | `award.approver` | فترة التوقف (التظلّم) خمسة أيام عمل — تُنهى لأجل العرض (خاصية تجريبية على staging) | `/portal/competitions/<id>?phase=award` |
| 56 | `award.approver` | يعتمد الترسية — تصير المنافسة مُرساة وتنتقل إلى إعداد العقد | `/portal/competitions/<id>?phase=award` |
| 57 | `contract.signer` | مفوّض التوقيع يحدّد سيناريو توقيع العقد (عبر منصة اعتماد) | `/portal/competitions/<id>?phase=contract` |
| 58 | `contract.signer` | يسجّل توقيع أطراف العقد: المتعاقد، الشؤون القانونية، الميزانية، إدارة العقود والمشتريات، صاحب الصلاحية | `/portal/competitions/<id>?phase=contract` |
| 59 | `contract.signer` | يُتمّ العقد ويسلّمه إلى وحدة العقود — يُنشأ سجلّ العقد | `/portal/competitions/<id>?phase=contract` |

## تنفيذ العقد

| # | الحساب | ماذا يحدث | الشاشة |
|---|---|---|---|
| 60 | `contract.approver` | بدء إجراءات المباشرة — عقد توريد (لا استلام موقع) | `/portal/contracts/<id>?phase=commencement` |
| 61 | `contract.approver` | اعتماد بدء التنفيذ | `/portal/contracts/<id>?phase=commencement` |
| 62 | `contract.approver` | إصدار خطاب المباشرة برقمٍ مرجعي (R-09) | `/portal/contracts/<id>?phase=commencement` |
| 63 | `contract.approver` | تسجيل مباشرة المتعاقد للعمل اليوم (يُثبَّت تاريخ البدء) | `/portal/contracts/<id>?phase=commencement` |
| 64 | `contract.officer` | تسعير جدول الكميات من العرض الفائز (2 بنود — 912,500 ريال موزّعة بالكمية) | `/portal/contracts/<id>?phase=execution&section=payments` |
| 65 | `contract.officer` | إعداد المستخلص رقم 1 من كميات جدول الكميات المنفَّذة وتقديمه للاعتماد | `/portal/contracts/<id>?phase=execution&section=payments` |
| 66 | `contract.approver` | اعتماد المستخلص بعد التحقق من توفر الاعتماد المالي | `/portal/contracts/<id>?phase=execution&section=payments` |
| 67 | `contract.approver` | تسجيل صرف المستخلص (يُضاف إلى المنصرف على العقد) | `/portal/contracts/<id>?phase=execution&section=payments` |
| 68 | `contract.officer` | تسجيل خطاب الضمان النهائي الوارد من البنك (45,625 ريال، ٥٪) | `/portal/guarantees/<id>` |
| 69 | `contract.officer` | تسليم أصل خطاب الضمان إلى الإدارة المالية (يصير الضمان ساريًا) | `/portal/guarantees/<id>` |
| 70 | `contract.officer` | طلب تمديد الضمان حتى 2027-11-15 لتغطية فترة الضمان بعد الاستلام | `/portal/guarantees/<id>` |
| 71 | `contract.approver` | اعتماد طلب تمديد الضمان | `/portal/guarantees/<id>` |
| 72 | `contract.approver` | توليد خطاب التمديد إلى البنك وإحالته إلى الصادر والوارد | `/portal/guarantees/<id>` |
| 73 | `contract.approver` | إصدار رقم الصادر الرسمي للخطاب (ص/2026/1340) | `/portal/guarantees/<id>` |
| 74 | `contract.officer` | تأكيد وصول تعديل البنك على خطاب الضمان | `/portal/guarantees/<id>` |
| 75 | `contract.officer` | طلب أمر تغيير بزيادة 45,625 ريال (≈٥٪) — ضمن سقف ١٠٪ النظامي | `/portal/contracts/<id>?phase=changeOrders` |
| 76 | `contract.approver` | اعتماد أمر التغيير (تُحدَّث القيمة المعدّلة للعقد) | `/portal/contracts/<id>?phase=changeOrders` |
| 77 | `contract.officer` | رفع إنجاز بنود جدول الكميات (2 بنود) مكتملةً مع سند الإنجاز — عبر الـAPI، لا زرّ له في v3 | `/portal/contracts/<id>?phase=execution&section=payments` |
| 78 | `contract.approver` | اعتماد إنجاز بنود جدول الكميات (فصل المهام) — يظهر أثره في محضر الاستلام بلا بنود ناقصة | `/portal/contracts/<id>?phase=execution&section=payments` |
| 79 | `contract.officer` | تحديث نسبة الإنجاز في سجل العقد إلى ٩٥٪ | `/portal/contracts/<id>?view=record` |
| 80 | `contract.officer` | طلب شهادة الإنجاز من المتعاقد (يصله رابط تقديم بالبريد) | `/portal/contracts/<id>?phase=execution&section=actions` |
| 81 | `contract.officer` | إرفاق شهادة الإنجاز المستلمة من المتعاقد (PDF) — تُسجَّل «مستلمة» | `/portal/contracts/<id>?phase=execution&section=actions` |
| 82 | `contract.officer` | تقييم أداء المتعاقد بنموذج «نموذج تقييم أداء عام» وتقديمه للمراجعة | `/portal/contracts/<id>/evaluations/new` |
| 83 | `contract.approver` | استلام التقييم للمراجعة | `/portal/contracts/<id>/evaluations/<id>` |
| 84 | `contract.approver` | اعتماد تقييم المتعاقد (تصل المتعاقدَ نسخةٌ بالنتيجة) | `/portal/contracts/<id>/evaluations/<id>` |
| 85 | `contract.approver` | تأكيد انتهاء الأعمال | `/portal/contracts/<id>?phase=receipt` |
| 86 | `contract.approver` | إشعار الإدارة المشرفة بانتهاء الأعمال (بريد تجريبي) | `/portal/contracts/<id>?phase=receipt` |
| 87 | `contract.approver` | طلب الاستلام النهائي | `/portal/contracts/<id>?phase=receipt` |
| 88 | `contract.approver` | إعداد محضر الاستلام النهائي (يرصد بنود الكميات غير المكتملة) | `/portal/contracts/<id>?phase=receipt` |
| 89 | `contract.approver` | إرسال المحضر إلى لجنة الاستلام | `/portal/contracts/<id>?phase=receipt` |
| 90 | `contract.approver` | تسجيل التواقيع: عضو اللجنة ثم المتعاقد ثم الاعتماد | `/portal/contracts/<id>?phase=receipt` |
| 91 | `contract.approver` | إصدار محضر الاستلام النهائي الموقَّع | `/portal/contracts/<id>?phase=receipt` |
| 92 | `contract.approver` | توزيع المحضر وإقفال العقد | `/portal/contracts/<id>?phase=receipt` |

## ملاحظات

- **الخطة السنوية:** لا سنة حرّة على staging (كل السنوات 2026–2031 عليها خطط)، فالسكربت يضيف البند للخطة التجريبية المعتمدة بطلب تعديل. خطوات «موظف الإدارة يقدّم ← مديرة الإدارة تعتمد ← المراجع ← المعتمد» تظهر كاملةً فقط حين تتوفر سنة حرّة.
- **تسعير جدول الكميات:** عرض المتنافس الفائز يُسجَّل بمبلغه الإجمالي، فيوزّع السكربت قيمة العقد على البنود بالكمية.
- **فترة التوقف** تُنهى بنقطة العرض `award/standstill/waive` (DEMO_IMPERSONATION=true على staging).
- **شهادة الإنجاز** يرفعها مسؤول العقود نيابةً عن المتعاقد (رابط المتعاقد يصل بالبريد).
- كل مورد/متعاقد بريده `@example.com` — لا مراسلة لعناوين حقيقية.
