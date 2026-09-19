// يطبق المظهر المحفوظ قبل أول رسم — بلا وميض فاتح في الوضع الداكن.
// (CSP صفحات الإضافة يمنع السكربت المضمن، لذلك ملف مستقل.)
"use strict";
try {
  const cached = localStorage.getItem("tanfeeth-theme");
  if (cached === "light" || cached === "dark") document.documentElement.setAttribute("data-theme", cached);
} catch (_e) {
  /* storage unavailable — system scheme applies */
}
