#!/usr/bin/env node
/**
 * سيناريو العرض كاملًا: الخطة السنوية ← المشروع واللجان والترسية ← تنفيذ العقد
 * حتى الإقفال، كلُّ خطوةٍ بحساب صاحبها.
 *
 *   node deploy/demo-flow/run.mjs            # وضع العرض: يتوقف قبل كل خطوة حتى Enter
 *   node deploy/demo-flow/run.mjs --auto     # اختبار: يمضي حتى النهاية بلا توقف
 *   node deploy/demo-flow/run.mjs --from=competition|contract
 *
 * في وضع العرض: اضغط Enter، فيُنفَّذ ما على الحساب المذكور، ثم بدّل الحساب في
 * الشاشة («تبديل الحساب» من قائمة الحساب) وافتح الشاشة المطبوعة لترى الأثر.
 * البيئة: API (افتراضيًا staging)، وكل حسابات العرض كلمة مرورها `secret`.
 */

import { AUTO, done } from './lib.mjs';
import { runPlan } from './plan.mjs';
import { runCompetition } from './competition.mjs';
import { runContract } from './contract.mjs';

const from = process.argv.find((a) => a.startsWith('--from='))?.slice(7) ?? 'plan';
const phases = ['plan', 'competition', 'contract'];
if (!phases.includes(from)) {
  console.error(`--from يقبل: ${phases.join(' | ')}`);
  process.exit(1);
}
const runs = (phase) => phases.indexOf(phase) >= phases.indexOf(from);

const banner = (text) => console.log(`\n════════ ${text} ════════`);

try {
  console.log(AUTO ? 'وضع الاختبار (--auto)' : 'وضع العرض: Enter قبل كل خطوة');
  let planItemId;
  if (runs('plan')) {
    banner('١ — الخطة السنوية');
    ({ itemId: planItemId } = await runPlan());
  }
  let contractId;
  if (runs('competition')) {
    banner('٢ — المشروع واللجان والترسية');
    ({ contractId } = await runCompetition({ planItemId }));
  }
  if (runs('contract')) {
    banner('٣ — تنفيذ العقد حتى الإقفال');
    ({ contractId } = await runContract({ contractId: contractId ?? undefined }));
  }
  banner('اكتمل السيناريو');
  if (contractId) console.log(`العقد: /portal/contracts/${contractId}`);
} catch (error) {
  console.error(`\n✗ ${error.message}`);
  process.exitCode = 1;
} finally {
  done();
}
