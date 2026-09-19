// تسميات حالات ومراحل المشروع — نفس frontend-v3 (messages/ar/portal.json → competitions).

export const STATUS_LABEL = {
  draft: "مسودة",
  in_approval: "قيد الاعتماد",
  returned: "معاد للتعديل",
  rejected: "مرفوض",
  approved: "معتمد",
  in_competition: "مطروح",
  awarded: "تمت الترسية",
  contracted: "تم التعاقد",
  cancelled: "ملغى",
};

export const STATUS_TONE = {
  draft: "neutral",
  in_approval: "accent",
  returned: "warning",
  rejected: "danger",
  approved: "success",
  in_competition: "info",
  awarded: "brand",
  contracted: "success",
  cancelled: "outline",
};

export const STAGE_LABEL = {
  order_creation: "إنشاء المشروع",
  bid_document: "كراسة المشروع",
  pre_qualification: "التأهيل المسبق",
  announcement: "الطرح",
  technical_opening: "فتح العروض الفنية",
  technical_evaluation: "التقييم الفني",
  financial_opening: "فتح العروض المالية",
  financial_award: "الترسية",
  contract_drafting: "العقد",
  project_start: "بدء التنفيذ",
};

export const FILL_STATUS = {
  filled: { label: "تمت", tone: "success", icon: "circleCheck" },
  skipped: { label: "تخطي", tone: "neutral", icon: "circleMinus" },
  failed: { label: "تعذر", tone: "danger", icon: "circleX" },
  note: { label: "ملاحظة", tone: "warning", icon: "alert" },
};
