import { createRequire } from 'node:module';
import fs from 'node:fs';
const req = createRequire('/Users/kareem.adel.zayed/tanfeth/backend/');
const puppeteer = req('puppeteer');
const DIR = '/Users/kareem.adel.zayed/tanfeth/docs/product/guides/create-competition';
const DELIV = '/Users/kareem.adel.zayed/tanfeth/docs/product/deliverable';
const fontsCss = fs.readFileSync(`${DELIV}/fonts.css`, 'utf8');
const logo = fs.readFileSync(`${DELIV}/logo.svg`).toString('base64');
const mark = fs.readFileSync(`${DELIV}/logo-mark.svg`).toString('base64');
const img = (n) => `data:image/png;base64,${fs.readFileSync(`${DIR}/shots/${n}.png`).toString('base64')}`;

const AR = {
  dir: 'rtl', lang: 'ar',
  title: 'دليل طرح منافسة', subtitle: 'خطوة بخطوة من إنشاء الطلب حتى رفعه للاعتماد',
  product: 'منصة تنفيذ', conf: 'سري', version: 'الإصدار 1.0 — 23 أغسطس 2026',
  toc: 'المحتويات', stepWord: 'الخطوة', noteWord: 'ملاحظة', tipWord: 'تلميح',
  intro: {
    h: 'نظرة عامة',
    p: [
      'يشرح هذا الدليل كيفية طرح منافسة جديدة على منصة تنفيذ، بدءًا من تسجيل الدخول، مرورًا بربط المنافسة بالخطة السنوية، وتعبئة بيانات الطرح وفق خطوات منصة اعتماد السبع، وانتهاءً برفع الطلب إلى سلسلة الاعتماد.',
      'الصلاحية المطلوبة: <b>competitions.create</b> (طرح منافسة). يظهر عنصر «طرح منافسة» في القائمة الجانبية فقط للمستخدمين الذين يملكون هذه الصلاحية.',
    ],
    flow: ['تسجيل الدخول', 'الخطة السنوية + اسم المنافسة', 'ويزارد بيانات الطرح (7 خطوات)', 'كراسة المنافسة', 'رفع للاعتماد'],
  },
  steps: [
    { n: 1, h: 'تسجيل الدخول', img: '01-login', p: ['افتح المنصة وأدخل البريد الإلكتروني وكلمة المرور، ثم اضغط «تسجيل الدخول».'], note: 'إذا كانت جهتك تستخدم نفاذ، اختر الدخول عبر نفاذ بدل البريد وكلمة المرور.' },
    { n: 2, h: 'لوحة المعلومات', img: '02-dashboard', p: ['بعد الدخول تصل إلى لوحة المعلومات. القائمة الجانبية على اليمين هي مدخلك لكل الوحدات: المنافسات، طرح منافسة، طلبات خارج الخطة، العقود، الخطة السنوية، والتقارير.'] },
    { n: 3, h: 'قائمة المنافسات', img: '03-competitions-list', p: ['من القائمة الجانبية اختر «المنافسات» لعرض كل المنافسات مع حالتها ومرحلتها. اضغط زر «طرح منافسة» في أعلى الصفحة (أو اختر «طرح منافسة» من القائمة الجانبية) لبدء منافسة جديدة.'], tip: 'يمكنك أيضًا استيراد منافسات دفعة واحدة من ملف Excel عبر «استيراد».' },
    { n: 4, h: 'الخطة السنوية — هل المنافسة ضمن الخطة؟', img: '04-new-plan-step', p: ['أول خطوة في طرح أي منافسة هي تحديد علاقتها بالخطة السنوية المعتمدة. يظهر شريط الخطوات في الأعلى: «الخطة السنوية» ثم خطوات اعتماد السبع.', 'اختر <b>ضمن الخطة</b> إذا كانت المنافسة مدرجة في خطة معتمدة، أو <b>خارج الخطة</b> إذا كانت احتياجًا مستجدًا.'] },
    { n: 5, h: 'اختيار الخطة ومشروع الخطة', img: '05-new-pick-plan-item-open', p: ['عند اختيار «ضمن الخطة»: اختر الخطة السنوية (بالسنة) ثم اختر المشروع من قائمة مشاريع الخطة. لا تظهر في القائمة إلا المشاريع التي لم تُطرح بعد.'] },
    { n: 6, h: 'تعبئة اسم المنافسة تلقائيًا', img: '06-new-in-plan-filled', p: ['بمجرد اختيار المشروع يُعبَّأ «اسم المنافسة» تلقائيًا من مشروع الخطة، وتُنقل القيمة التقديرية للمشروع صامتة إلى المنافسة كمؤشر ميزانية. يمكنك تعديل الاسم إن لزم.', 'اضغط <b>حفظ ومتابعة</b> لإنشاء الطلب والانتقال إلى بيانات الطرح.'] },
    { n: 7, h: 'البديل: منافسة خارج الخطة', img: '07-new-out-of-plan', p: ['إذا اخترت «خارج الخطة» تظهر حقول إضافية: وضع الطلب (إنشاء طلب خارج الخطة جديد أو ربط بطلب موجود)، وسبب الخروج عن الخطة (مشروع طارئ، احتياج مستجد، توجيه إداري، تغير نطاق، تغير ميزانية، أخرى) مع تفاصيل إضافية.'], note: 'يُنشأ «طلب خارج الخطة» مرتبط بالمنافسة تلقائيًا بعد الحفظ. يمكنك متابعة تعبئة البيانات، لكن لا يمكن اعتماد المنافسة قبل اعتماد الطلب من الجهة المختصة.' },
    { n: 8, h: 'ويزارد بيانات الطرح — 1: المعلومات الأساسية', img: '08-wizard-step1', p: ['بعد الحفظ تنتقل مباشرة إلى «بيانات طرح المنافسة» — نفس خطوات وحقول منصة اعتماد. يعرض الرأس الرقم المرجعي ورقم المنافسة المولَّدين.', 'عبّئ نوع المنافسة، رقم المنافسة الخاص بالجهة، الغرض من المنافسة، القيمة التقديرية، وبقية الحقول الأساسية. اضغط «حفظ ومتابعة» بعد كل خطوة.'], tip: 'أعلى الصفحة تجد «تدقيق الضوابط» الذي يفحص المنافسة آليًا ضد ضوابط هيئة كفاءة الإنفاق في الخلفية، وزر «تعبئة ذكية» (الخطوة 15).' },
    { n: 9, h: 'ويزارد — 2: مجال التصنيف وموقع التنفيذ والتقديم', img: '09-wizard-step2', p: ['حدد مجال التصنيف المطلوب للمتنافسين (مطلوب دائمًا)، وموقع التنفيذ، وطريقة تقديم العروض (ملف واحد أو ملفين وفق القاعدة BR‑01 للقيم فوق الحد المقرر).'] },
    { n: 10, h: 'ويزارد — 3: العناوين والمواعيد', img: '10-wizard-step3', p: ['عنوان التسليم مقفول من إعدادات المنظمة. حدد مواعيد الاستفسارات، آخر موعد لتقديم العروض، موعد فتح المظاريف، وفترة سريان العروض. تُقترح المدد النظامية تلقائيًا وفق نوع المنافسة وقيمتها.'] },
    { n: 11, h: 'ويزارد — 4: تجزئة المنافسة', img: '11-wizard-step4', p: ['حدد هل المنافسة مجزّأة إلى حزم أم لا. عند التجزئة أضف الحزم واسم كل حزمة وقيمتها عبر «إضافة حزمة».'] },
    { n: 12, h: 'ويزارد — 5: مراجعة هيئة كفاءة الإنفاق', img: '12-wizard-step5', p: ['أجب عن أسئلة مراجعة الهيئة (هل المنافسة خاضعة للمراجعة؟ رقم ومرجع المراجعة إن وُجد). تظهر نتيجة «تدقيق الضوابط» الآلي هنا أيضًا عند اكتماله.'] },
    { n: 13, h: 'ويزارد — 6: جداول الكميات', img: '13-wizard-step6', p: ['أضف جداول الكميات يدويًا عبر «إضافة جدول» و«إضافة بند»، أو حمّل القالب الفارغ وأعد رفعه كملف.'] },
    { n: 14, h: 'ويزارد — 7: ملفات المنافسة', img: '14-wizard-step7', p: ['ارفع ملفات المنافسة المرافقة (المواصفات، المخططات، أي مرفقات إضافية). في هذه الخطوة يتغير الزر إلى <b>إنهاء ومتابعة إلى كراسة المنافسة</b>.'], note: 'لا يمكن الإنهاء إذا كانت هناك أخطاء في قائمة المراجعة (الخطوة 16) — يفتح لك النظام لوحة المراجعة ويحدد الحقول الناقصة.' },
    { n: 15, h: 'التعبئة الذكية (اختياري)', img: '15-smart-fill-dialog', p: ['من زر «تعبئة ذكية» في أعلى الويزارد: صف مجال العمل والشروط والمواصفات وجداول الكميات (أو أرفق ملفات PDF/Excel/CSV)، وفعّل «الاستفادة من المنافسات السابقة المشابهة» ثم اضغط «توليد التعبئة».', 'يقترح الذكاء الاصطناعي قيمًا لكل حقل مع ذكر المصدر ودرجة الثقة — وتبقى المراجعة والاعتماد بيدك (HITL).'] },
    { n: 16, h: 'المراجعة والتحقق', img: '15b-review-panel', p: ['زر «المراجعة والتحقق» يعرض قائمة تدقيق كاملة لكل الخطوات: الحقول الناقصة، التحذيرات، وتقدير مدة دورة المنافسة. اضغط على أي بند للانتقال مباشرة إلى خطوته.'] },
    { n: 17, h: 'صفحة المنافسة — نظرة عامة', img: '16-detail-overview', p: ['بعد الإنهاء تصل إلى صفحة المنافسة. تعرض النظرة العامة ملخص الطلب، الميزانية (القيمة التقديرية والميزانية المعتمدة)، وسلسلة الاعتماد. من الأعلى: «تعديل بيانات المنافسة» للعودة إلى الويزارد، و«املأ في اعتماد» لنقل البيانات إلى منصة اعتماد.'] },
    { n: 18, h: 'تبويب كراسة المنافسة', img: '17-detail-booklet', p: ['من تبويب «كراسة المنافسة» اختر نموذج الكراسة الرسمي (وزارة المالية) ثم إما «إنشاء وتعبئة بالذكاء الاصطناعي» أو «إنشاء ثم التعبئة يدويًا». الكراسة تُبنى على النموذج الرسمي بالحرف، وكل حقل يبقى تحت مراجعتك ويُعتمد قبل الإصدار.'] },
    { n: 19, h: 'رفع الطلب للاعتماد', img: '19-submit-for-approval', p: ['عندما تكتمل البيانات اضغط <b>رفع للاعتماد</b>. تتغير حالة المنافسة إلى «قيد الاعتماد» وتبدأ سلسلة الاعتماد في أسفل الصفحة بالانتقال بين المعتمدين حسب الدور والصلاحية.', 'يمكن للمنشئ «إلغاء الطلب» قبل اكتمال الاعتماد، ويمكن تحديد الميزانية المعتمدة من لوحة الميزانية.'], note: 'وفق قاعدة فصل المهام لا يستطيع من أنشأ الطلب اعتماده بنفسه.' },
    { n: 20, h: 'السجل', img: '18-detail-timeline', p: ['تبويب «السجل» يعرض كل الأحداث على المنافسة مرتبة زمنيًا (الإنشاء، التعديل، الرفع، قرارات الاعتماد) مع اسم المستخدم والتوقيت — سجل تدقيق كامل لكل انتقال.'] },
  ],
};

const EN = {
  dir: 'ltr', lang: 'en',
  title: 'Creating a Competition', subtitle: 'Step-by-step guide from order creation to approval submission',
  product: 'Tanfeeth Platform', conf: 'Confidential', version: 'Version 1.0 — 23 August 2026',
  toc: 'Contents', stepWord: 'Step', noteWord: 'Note', tipWord: 'Tip',
  intro: {
    h: 'Overview',
    p: [
      'This guide explains how to launch a new competition (tender) on the Tanfeeth platform: signing in, linking the competition to the annual plan, filling the tender data through the seven Etimad steps, and finally submitting the order to the approval chain.',
      'Required permission: <b>competitions.create</b>. The “Create competition” entry appears in the sidebar only for users who hold this permission.',
    ],
    flow: ['Sign in', 'Annual plan + title', 'Tender data wizard (7 steps)', 'Tender booklet', 'Submit for approval'],
  },
  steps: [
    { n: 1, h: 'Sign in', img: '01-login', p: ['Open the platform, enter your e‑mail and password, then press “Sign in”.'], note: 'If your entity uses Nafath, choose the Nafath sign‑in instead of e‑mail/password.' },
    { n: 2, h: 'Dashboard', img: '02-dashboard', p: ['After signing in you land on the dashboard. The sidebar (on the right, RTL layout) is your entry to every module: Competitions, Create competition, Out‑of‑plan requests, Contracts, Annual plan, and Reports.'] },
    { n: 3, h: 'Competitions list', img: '03-competitions-list', p: ['Choose “Competitions” (المنافسات) in the sidebar to see all competitions with their status and stage. Press the “Create competition” (طرح منافسة) button at the top of the page — or the sidebar entry of the same name — to start a new one.'], tip: 'You can also bulk‑import competitions from an Excel file via “Import”.' },
    { n: 4, h: 'Annual plan — is the competition in the plan?', img: '04-new-plan-step', p: ['The first step of any competition is its relation to the approved annual plan. The step bar at the top shows “Annual plan” followed by the seven Etimad steps.', 'Choose <b>In plan</b> (ضمن الخطة) if the competition is listed in an approved plan, or <b>Out of plan</b> (خارج الخطة) if it is a new need.'] },
    { n: 5, h: 'Pick the plan and the plan project', img: '05-new-pick-plan-item-open', p: ['With “In plan” selected: choose the annual plan (by year), then pick the project from the plan’s project list. Only projects not yet launched are listed.'] },
    { n: 6, h: 'Competition title auto‑filled', img: '06-new-in-plan-filled', p: ['As soon as a project is chosen, the “Competition title” is pre‑filled from the plan project and the project’s estimated value is silently carried over as a budget indicator. Edit the title if needed.', 'Press <b>Save & continue</b> (حفظ ومتابعة) to create the order and move on to the tender data.'] },
    { n: 7, h: 'Alternative: out‑of‑plan competition', img: '07-new-out-of-plan', p: ['If you choose “Out of plan”, extra fields appear: request mode (create a new out‑of‑plan request or link an existing one) and the deviation reason (emergency project, new need, management directive, scope change, budget change, other) with optional details.'], note: 'An out‑of‑plan request linked to this competition is created automatically on save. You may keep filling the data, but the competition cannot be approved before the linked request is approved by the competent authority.' },
    { n: 8, h: 'Tender wizard — 1: Basic information', img: '08-wizard-step1', p: ['After saving you go straight to “Tender data” — the same steps and fields as the Etimad platform. The header shows the generated reference number and competition number.', 'Fill the competition type, the entity’s own competition number, purpose, estimated value and the remaining basic fields. Press “Save & continue” after every step.'], tip: 'At the top you will find the “Controls audit” that checks the competition against the Expenditure Efficiency Authority controls in the background, and the “Smart fill” button (step 15).' },
    { n: 9, h: 'Wizard — 2: Classification, execution site and submission', img: '09-wizard-step2', p: ['Set the classification field required from bidders (always mandatory), the execution location, and the bid submission method (single file or two files per rule BR‑01 for values above the configured threshold).'] },
    { n: 10, h: 'Wizard — 3: Addresses and dates', img: '10-wizard-step3', p: ['The delivery address is locked from the organization settings. Set the enquiry deadline, bid submission deadline, envelope opening date and bid validity period. Statutory durations are suggested automatically from the competition type and value.'] },
    { n: 11, h: 'Wizard — 4: Competition division', img: '11-wizard-step4', p: ['Indicate whether the competition is split into packages. If so, add each package with its name and value via “Add package”.'] },
    { n: 12, h: 'Wizard — 5: Expenditure Efficiency Authority review', img: '12-wizard-step5', p: ['Answer the Authority review questions (is the competition subject to review? review number/reference if any). The result of the automatic controls audit is also shown here once complete.'] },
    { n: 13, h: 'Wizard — 6: Bill of quantities', img: '13-wizard-step6', p: ['Add BoQ tables manually via “Add table” and “Add item”, or download the blank template and upload it back as a file.'] },
    { n: 14, h: 'Wizard — 7: Competition files', img: '14-wizard-step7', p: ['Upload the accompanying files (specifications, drawings, any extra attachments). On this step the button changes to <b>Finish & continue to the tender booklet</b>.'], note: 'Finishing is blocked while the review checklist (step 16) contains errors — the system opens the review panel and highlights the missing fields.' },
    { n: 15, h: 'Smart fill (optional)', img: '15-smart-fill-dialog', p: ['From the “Smart fill” button at the top of the wizard: describe the scope of work, terms & specifications and bill of quantities (or attach PDF/Excel/CSV files), enable “Use similar previous competitions”, then press “Generate”.', 'The AI proposes a value for every field with its source and a confidence score — review and approval remain in your hands (human‑in‑the‑loop).'] },
    { n: 16, h: 'Review & validation', img: '15b-review-panel', p: ['The “Review & validation” button shows a full checklist across all steps: missing fields, warnings and an estimate of the competition lifecycle duration. Click any item to jump straight to its step.'] },
    { n: 17, h: 'Competition page — Overview', img: '16-detail-overview', p: ['After finishing you land on the competition page. The overview shows the order summary, the budget panel (estimated value and approved budget) and the approval chain. At the top: “Edit competition data” returns to the wizard and “Fill in Etimad” pushes the data to the Etimad platform.'] },
    { n: 18, h: 'Tender booklet tab', img: '17-detail-booklet', p: ['In the “Tender booklet” tab choose the official Ministry of Finance template, then either “Create & fill with AI” or “Create then fill manually”. The booklet is built on the official template verbatim; every field stays under your review and is approved before publishing.'] },
    { n: 19, h: 'Submit for approval', img: '19-submit-for-approval', p: ['Once the data is complete press <b>Submit for approval</b> (رفع للاعتماد). The status changes to “Pending approval” and the approval chain at the bottom of the page starts moving between approvers by role and permission.', 'The creator can “Cancel the order” before approval completes, and the approved budget can be set from the budget panel.'], note: 'By the segregation‑of‑duties rule the user who created the order cannot approve it.' },
    { n: 20, h: 'Timeline', img: '18-detail-timeline', p: ['The “Timeline” tab lists every event on the competition in chronological order (creation, edits, submission, approval decisions) with user and time — a complete audit trail for every transition.'] },
  ],
};

function html(L) {
  const steps = L.steps.map((s) => `
  <section class="step">
    <h2><span class="num">${s.n}</span>${s.h}</h2>
    ${s.p.map((p) => `<p>${p}</p>`).join('')}
    ${s.note ? `<div class="callout note"><b>${L.noteWord}:</b> ${s.note}</div>` : ''}
    ${s.tip ? `<div class="callout tip"><b>${L.tipWord}:</b> ${s.tip}</div>` : ''}
    <figure><img src="${img(s.img)}" alt=""><figcaption>${L.stepWord} ${s.n} — ${s.h}</figcaption></figure>
  </section>`).join('');
  return `<!doctype html><html lang="${L.lang}" dir="${L.dir}"><head><meta charset="utf-8"><title>${L.title}</title>
<style>
${fontsCss}
:root{--g:#02594d;--g2:#234f33;--ink:#1f2a2e;--mut:#5f6b70;--line:#d8dfdd;--bg:#f3f6f5}
*{box-sizing:border-box}body{margin:0;font-family:Tajawal,Arial,sans-serif;color:var(--ink);font-size:11pt;line-height:1.7}
.cover{height:262mm;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always;padding:10mm 0}
.cover img.logo{height:34px}.cover h1{font-size:34pt;color:var(--g);margin:0 0 6px;line-height:1.25}.cover .sub{font-size:14pt;color:var(--mut);margin:0}
.cover .meta{color:var(--mut);font-size:10pt;border-top:1px solid var(--line);padding-top:8px}
.cover .hero{border:1px solid var(--line);border-radius:4px;overflow:hidden;margin-top:16mm}.cover .hero img{width:100%;display:block}
h1.sec{font-size:20pt;color:var(--g);margin:0 0 10px}
.toc ol{columns:2;column-gap:10mm;padding-inline-start:18px;margin:0}.toc li{break-inside:avoid;margin-bottom:3px}
.flow{display:flex;gap:6px;margin:10px 0 18px;flex-wrap:wrap}.flow span{background:var(--g);color:#fff;padding:6px 10px;border-radius:4px;font-size:9.5pt;font-weight:700}
.flow span::after{content:"";}
.step{page-break-before:always}
h2{font-size:15pt;color:var(--g);margin:0 0 8px;display:flex;align-items:center;gap:10px}
.num{display:inline-flex;width:30px;height:30px;border-radius:50%;background:var(--g);color:#fff;align-items:center;justify-content:center;font-size:12pt;flex:none}
p{margin:0 0 8px}
.callout{border:1px solid var(--line);border-inline-start:4px solid var(--g);background:var(--bg);padding:8px 12px;border-radius:4px;margin:8px 0;font-size:10pt}
.callout.tip{border-inline-start-color:#b8860b}
figure{margin:12px 0 0;border:1px solid var(--line);border-radius:4px;overflow:hidden;page-break-inside:avoid}
figure img{width:100%;display:block;max-height:185mm;object-fit:cover;object-position:top}
figcaption{font-size:9pt;color:var(--mut);padding:6px 10px;border-top:1px solid var(--line);background:var(--bg)}
</style></head><body>
<div class="cover">
  <div><img class="logo" src="data:image/svg+xml;base64,${logo}"></div>
  <div><h1>${L.title}</h1><p class="sub">${L.subtitle}</p>
    <div class="hero"><img src="${img('06-new-in-plan-filled')}"></div></div>
  <div class="meta">${L.product} · ${L.version} · ${L.conf}</div>
</div>
<section class="toc"><h1 class="sec">${L.toc}</h1><ol>${L.steps.map((s) => `<li>${s.h}</li>`).join('')}</ol></section>
<section style="margin-top:14mm"><h1 class="sec">${L.intro.h}</h1>${L.intro.p.map((p) => `<p>${p}</p>`).join('')}
<div class="flow">${L.intro.flow.map((f, i) => `<span>${i + 1}. ${f}</span>`).join('')}</div></section>
${steps}
</body></html>`;
}

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox', '--font-render-hinting=none'] });
for (const [L, out] of [[AR, 'Tanfeeth-Create-Competition-Guide-AR.pdf'], [EN, 'Tanfeeth-Create-Competition-Guide-EN.pdf']]) {
  const file = `${DIR}/guide-${L.lang}.html`;
  fs.writeFileSync(file, html(L));
  const page = await browser.newPage();
  await page.goto(`file://${file}`, { waitUntil: 'networkidle0' });
  await page.evaluate(async () => { await document.fonts.ready; });
  const footer = `<div style="width:100%;direction:${L.dir};font-family:Arial,sans-serif;font-size:7pt;color:#8b969e;padding:2px 15mm 0;display:flex;justify-content:space-between;align-items:center;border-top:.5px solid #d8dfdd">
  <span style="display:flex;align-items:center;gap:4px"><img src="data:image/svg+xml;base64,${mark}" style="height:10px"><span style="color:#234f33;font-weight:bold">${L.product}</span></span>
  <span>${L.title}</span><span style="direction:ltr"><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
  await page.pdf({ path: `${DIR}/${out}`, format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<div></div>', footerTemplate: footer, margin: { top: '14mm', bottom: '16mm', left: '15mm', right: '15mm' } });
  await page.close();
  console.log(out, Math.round(fs.statSync(`${DIR}/${out}`).size / 1024), 'KB');
}
await browser.close();
