#!/usr/bin/env node
/**
 * منافسةٌ رُفعت عروضُها ← جلسةُ فتح العروض الفنية ومحضرُها موقَّعًا ← مرحلةُ
 * التقييم الفني، وجلسةُ التقييم مفتوحةٌ للجنة التقييم الفني. ولا يُقيِّم أحدًا:
 * الدرجاتُ لأعضاء اللجنة في الشاشة.
 *
 *   node deploy/demo-flow/to-evaluation.mjs --auto --id <competitionId> [--guarantee-required]
 */

import { as, done, step } from './lib.mjs';
import { advance, committeesContext, openingSession } from './competition.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};

async function run() {
  const id = arg('--id');
  if (!id) throw new Error('--id مطلوب');
  const ctx = await committeesContext();
  ctx.guaranteeNotRequired = !process.argv.includes('--guarantee-required');
  const reload = () => as('tender.entry').get(`/competitions/${id}`);
  let c = await reload();
  const { offers } = await as('tender.entry').get(`/competitions/${id}/offers`);
  console.log(`   · العروض المسجّلة: ${offers.length} — ${offers.map((o) => o.contractorName).join('، ')}`);
  if (offers.length === 0) throw new Error('لم تُرفع عروض بعد');

  if (c.stage === 'announcement') {
    await step(
      { who: ctx.clerk, title: 'ينقل الملف إلى فتح العروض الفنية', screen: `/portal/competitions/${id}?phase=evaluation&section=opening` },
      () => advance(ctx, id, 'technical_opening'),
    );
    c = await reload();
  }
  if (c.stage === 'technical_opening') {
    await openingSession(c, ctx, 'technical');
    await step(
      { who: ctx.clerk, title: 'المحضر مختوم — يبدأ تقييم العروض', screen: `/portal/competitions/${id}?phase=evaluation&section=scoring` },
      () => advance(ctx, id, 'technical_evaluation'),
    );
    c = await reload();
  }
  const te = `/competitions/${id}/technical-evaluation`;
  if (c.stage === 'technical_evaluation' && !(await as('tender.auditor').get(te).catch(() => null))) {
    await step(
      { who: 'tender.auditor', title: 'مدققة المنافسة تفتح جلسة التقييم الفني وتكلّف لجنة التقييم الفني', screen: `/portal/competitions/${id}?phase=evaluation&section=scoring` },
      () => as('tender.auditor').post(`${te}/open`, { committeeId: ctx.tech.id }),
    );
  }
  c = await reload();
  console.log(`   · الحال: ${c.stage} / ${c.status}`);
}

run()
  .catch((error) => {
    console.error(`\n✗ ${error.message}`);
    if (error.data) console.error(JSON.stringify(error.data, null, 1).slice(0, 2000));
    process.exitCode = 1;
  })
  .finally(done);
