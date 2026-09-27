import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const load = async path => import('data:text/javascript;base64,' + Buffer.from(ts.transpile(await readFile(new URL(path, import.meta.url), 'utf8'), { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 })).toString('base64'));
const { digitalSkillsTraining, groundedAnswer, followUpAnswer, coachTopics } = await load('../supabase/functions/adviser/grounding.ts');
const { calculatePractice, practiceToolForAnswer } = await load('../app/adviser/practice.ts');

test('each supported topic includes a practical tool, offline path, privacy and measured learning', () => {
  for (const topic of coachTopics.filter(value => value !== 'unknown')) {
    const answer = groundedAnswer(topic, { jobs: 0, charged: 0, costs: 0, outstanding: 0, feedback: 0 }, false, 0, false);
    assert.ok(practiceToolForAnswer(answer));
    for (const heading of ['GUIDED PRACTICE', 'CHECK YOUR LEARNING', 'LOW-DATA OPTION', 'KEEP YOUR DATA PRIVATE']) assert.ok(answer.includes(heading));
    assert.match(answer, /no completed jobs/);
    assert.ok(practiceToolForAnswer(followUpAnswer(topic, 'small_step')));
  }
  assert.equal(practiceToolForAnswer(digitalSkillsTraining('unknown')), undefined);
});
test('saved answer resolves exactly its worksheet and arbitrary prose cannot select a tool', () => {
  const saved = JSON.parse(JSON.stringify({ answer: digitalSkillsTraining('payments') }));
  assert.equal(practiceToolForAnswer(saved.answer), 'Payment balance worksheet');
  assert.equal(practiceToolForAnswer('Please show Payment balance worksheet'), undefined);
});
test('practice distinguishes missing data, zero, credit, overheads and integer-cents arithmetic', () => {
  assert.match(calculatePractice('Payment balance worksheet', '', '0'), /Missing information is not zero/);
  assert.match(calculatePractice('Payment balance worksheet', '0.30', '0.10'), /R 0.20/);
  assert.match(calculatePractice('Payment balance worksheet', '100', '120'), /Investigate the credit/);
  assert.match(calculatePractice('Direct-cost worksheet', '0', '10'), /undefined/);
  assert.match(calculatePractice('Direct-cost worksheet', '100', '40'), /60.0%.*not net profit/);
  for (const invalid of ['-1', 'NaN', 'Infinity', '1e4', '12.345', '1000000001']) assert.doesNotMatch(calculatePractice('Payment balance worksheet', invalid, '1'), /practice balance/);
});
test('conversion refuses undefined or mismatched groups and never predicts outcomes', () => {
  assert.match(calculatePractice('Enquiry-to-booking worksheet', '0', '0'), /cannot be calculated/);
  assert.match(calculatePractice('Enquiry-to-booking worksheet', '4', '5'), /exceed enquiries/);
  assert.match(calculatePractice('Enquiry-to-booking worksheet', '4.5', '2'), /whole/);
  assert.match(calculatePractice('Enquiry-to-booking worksheet', '10', '2'), /20.0%.*does not establish/);
});
