# BYE PRO FINANCE

تطبيق مالي شخصي بواجهة عربية، مبني باستخدام React وTypeScript وVite وSupabase.

## الحالة الحالية

- [x] إعداد مشروع الواجهة والبناء وفحوص GitHub Actions.
- [x] عميل Supabase مضبوط على متغيرات بيئة عامة آمنة.
- [x] تسجيل الدخول، إنشاء الحساب، واستعادة كلمة المرور عبر Supabase Auth.
- [x] لوحة التحكم والحسابات والمعاملات مرتبطة بالبيانات الفعلية.
- [x] الميزانيات والديون والفواتير والادخار والأصول: CRUD كامل من الواجهة مع Supabase.
- [x] التقارير: ملخص التدفق النقدي، الأرصدة، الديون، الادخار، الأصول، أعلى المصروفات وآخر النشاط.
- [x] المستندات: رفع الملفات إلى Storage الخاص، إنشاء سجلات metadata، فتح روابط مؤقتة وحذف الملف والسجل.
- [x] الإشعارات: عرض، عدّ غير المقروء، تحديد كمقروء/غير مقروء، وتحديد الكل كمقروء.
- [x] ربط جميع الأقسام الأحد عشر بالتنقل الرئيسي.
- [x] التحقق من وجود bucket `finance-documents` وسياسات Storage المقيدة بمجلد المستخدم.
- [ ] تشغيل اختبارات التكامل النهائية على بيئة الإنتاج بعد كل تغيير والتأكد من نجاح Vercel وGitHub Actions.
- [ ] استكمال تحسينات أداء RLS وindexes الموصى بها في مراجعة Supabase قبل اعتبار النظام جاهزًا لبيانات مالية حساسة.

**تنبيه:** النظام أصبح متصلًا وظيفيًا بالأقسام الأساسية وقاعدة البيانات، لكن مراجعة الأمان والأداء النهائية واختبارات التكامل الإنتاجية يجب أن تظل شرطًا قبل استخدامه كمنصة مالية حساسة.

## الأقسام

00. لوحة التحكم
01. الحسابات
02. المعاملات
03. الميزانيات
04. الديون
05. الفواتير
06. الادخار
07. الأصول
08. التقارير
09. المستندات
10. الإشعارات

## إعداد البيئة

المتطلبات: Node.js 20+ وnpm.

1. انسخ `.env.example` إلى `.env.local`.
2. اضبط `VITE_SUPABASE_URL` و`VITE_SUPABASE_PUBLISHABLE_KEY`.
3. نفّذ `npm install`.
4. نفّذ `npm run dev`.

في Vercel أضف المتغيرين نفسيهما لبيئات Preview وProduction ثم أعد البناء. مشروع Supabase الحالي: `ngfaukvfsesoslfiwaue`.

استخدم مفتاح Supabase publishable/anon المخصص للواجهة فقط. **لا تضع مفتاح service-role أو أي مفتاح سري داخل متغيرات `VITE_*` أو في GitHub.**

## الفحوص

- `npm run typecheck` — فحص TypeScript.
- `npm test` — الاختبارات الوحدوية.
- `npm run build` — بناء الإنتاج.

يجب التحقق من نتائج GitHub Actions وVercel بعد كل مجموعة تغييرات. حالة Vercel المعلّقة لا تُعد نجاحًا حتى يظهر اكتمال البناء.

## قاعدة البيانات

- مشروع Supabase: `ngfaukvfsesoslfiwaue` (EU West 3 / Paris).
- الجداول المستخدمة: accounts, assets, bills, budgets, categories, debts, documents, notifications, profiles, savings_goals, transactions, transfers.
- مخطط PostgreSQL وتعريفات TypeScript موجودة في المستودع.
- فعّل RLS على كل جدول مكشوف واحتفظ بتخزين المستندات خاصًا.
- قبل إضافة migrations جديدة، طابق سجل الترحيلات مع المخطط الحي حتى لا تعيد إنشاء جداول موجودة.

## التخزين

Bucket خاص باسم `finance-documents`. مسار الملفات يكون داخل مجلد UUID المستخدم، وسياسات Storage تمنع المستخدم من قراءة أو تعديل ملفات مستخدم آخر.

## الهيكل

- `src/App.tsx` — المصادقة والتنقل الرئيسي.
- `src/components/AccountsView.tsx` — الحسابات.
- `src/components/TransactionsView.tsx` — المعاملات.
- `src/components/FinanceViews.tsx` — CRUD للميزانيات والديون والفواتير والادخار والأصول.
- `src/components/AdvancedFinanceViews.tsx` — التقارير والمستندات والإشعارات.
- `src/components/DashboardView.tsx` — لوحة التحكم.
- `src/lib/finance.ts` — قواعد الحساب المالي القابلة للاختبار.
- `src/types/database.types.ts` — تعريفات قاعدة البيانات.
- `supabase/` — ملاحظات قاعدة البيانات.
