// تنفيذ — الإعدادات المشتركة بين اللوحة الجانبية وعامل الخلفية.
// سكربتات المحتوى لا تستورد وحدات ES، فنسخت منها المفاتيح التي تحتاجها
// (ui-kit.js) — عند تغيير مفتاح هنا غيره هناك.

/** خوادم تنفيذ التي يسجل المستخدم الدخول إليها. */
export const SERVERS = {
  staging: {
    id: "staging",
    label: "التجريبية",
    api: "https://staging-api.tanfeeth.io/api",
    web: "https://staging.tanfeeth.io",
  },
  prod: {
    id: "prod",
    label: "الإنتاج",
    api: "https://api.tanfeeth.io/api",
    web: "https://tanfeeth.io",
  },
  local: {
    id: "local",
    label: "محلي",
    api: "http://localhost:3000/api",
    web: "http://localhost:3002",
  },
};

export const DEFAULT_SERVER = "staging";

/** مفاتيح chrome.storage.local — الثلاثة الأخيرة موروثة من الإصدار 0.1 فلا تتغير. */
export const KEYS = {
  session: "tanfeethSession",
  server: "tanfeethServer",
  chat: "tanfeethChat",
  prefs: "tanfeethPrefs",
  intent: "tanfeethPanelIntent",
  fill: "tanfeethEtimadFill",
  log: "tanfeethFillLog",
  settings: "tanfeethSettings",
};

export const DEFAULT_SETTINGS = {
  enabled: true,
  autoFill: true,
  showOverlay: true,
  fillCriteria: true,
};

/** الحمولة صالحة ساعتين من لحظة تجهيزها. */
export const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export const ETIMAD_ORIGIN = "https://tenders.etimad.sa";
export const ETIMAD_ADD_TENDER_URL = ETIMAD_ORIGIN + "/Tender/AddTender";

/**
 * حقول التاريخ في اعتماد يرافقها مربع «ميلادي»، ومحرك التعبئة يتوقع تلميح
 * التقويم بمفتاح `<اسم حقل اعتماد>__calendar`. نظيره في
 * frontend-v2/src/features/project-wizard/etimad-bridge.ts.
 */
export const CALENDAR_HINTS = {
  offerDeliveryDateCalendar: "OffersDeliveryDate__calendar",
  expectedAwardDateCalendar: "AwardingExpectedDate__calendar",
  workStartDateCalendar: "StartingBusinessOrServicesDate__calendar",
  sampleDeliveryDateCalendar: "DeliveryDate__calendar",
};
