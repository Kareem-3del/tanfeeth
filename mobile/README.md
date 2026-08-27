# تطبيق «تنفيذ» للجوال

غلاف WebView مبني بـ **Capacitor 8** حول تطبيق الويب المنشور — التطبيق يفتح
`https://staging.tanfeeth.io` مباشرة (قاعدة «staging أولًا»)، فكل ما يُنشر على
staging يظهر في التطبيق فورًا دون إعادة بناء.

- **المعرّف:** `io.tanfeeth.app` — **الاسم الظاهر:** تنفيذ
- الأيقونة والسبلاش مولّدة من `assets/` (المصدر: أيقونة المنصة + أخضر اعتماد `#02594d`)
- `www/` صفحة احتياطية لا تظهر إلا عند تعذّر الوصول للخادم

## البناء (أندرويد)

يتطلب JDK 21 — على هذا الجهاز نستخدم JBR المرفق مع Android Studio:

```bash
npm install
npx cap sync android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
  npm run android:debug
# الناتج: android/app/build/outputs/apk/debug/app-debug.apk
```

نسخة الإنتاج: بدّل `server.url` في `capacitor.config.json` إلى
`https://tanfeeth.io` ثم `npx cap sync android && npm run android:release`
(تحتاج توقيع keystore قبل النشر على المتجر).

## iOS

لم تُضف منصة iOS بعد — `npx cap add ios` ثم افتح المشروع في Xcode
(يتطلب حساب Apple Developer للتوقيع).
