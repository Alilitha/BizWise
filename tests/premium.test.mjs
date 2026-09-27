import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const transpile = source => import('data:text/javascript;base64,' + Buffer.from(ts.transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 })).toString('base64'));
const source = name => readFile(new URL(`../app/premium/${name}`, import.meta.url), 'utf8');
const { computeMetrics, metricsCsv } = await transpile(await source('metrics.ts'));
const { luhnValid, validateCard, simulateCharge, formatCardNumber, formatExpiry } = await transpile(await source('checkout.ts'));
const { improvementAlerts, securityFindings } = await transpile(await source('telemetry.ts'));
const { pdfSafe } = await transpile((await source('pdf.ts')).replace(/^import .*$/gm, ''));

const now = new Date('2026-09-15T12:00:00Z');
const job = (id, job_date, amount, extra = {}) => ({ id, job_date, status: 'completed', amount_charged: amount, parts_cost: 0, other_direct_cost: 0, service_id: 's', customer_id: null, ...extra });

test('metrics count only completed jobs dated up to today and report growth against the previous month', () => {
  const metrics = computeMetrics({ now, feedback: [], actions: [], payments: [{ job_id: 'a', amount: 50, paid_at: '2026-08-20' }],
    jobs: [job('a', '2026-08-10', 100, { parts_cost: 20 }), job('b', '2026-09-01', 150), job('future', '2026-09-30', 9999), job('draft', '2026-09-02', 500, { status: 'draft' })] });
  const [aug, sep] = metrics.months.slice(-2);
  assert.equal(metrics.months.length, 12);
  assert.deepEqual([aug.key, aug.charged, aug.directCosts, aug.collected], ['2026-08', 100, 20, 50]);
  assert.equal(sep.charged, 150);
  assert.equal(sep.growthPct, 0.5);
  assert.equal(aug.growthPct, null, 'no growth figure when the previous month has no revenue');
  assert.equal(metrics.kpis.collectionRate, 50 / 250);
  assert.equal(metrics.kpis.directMargin, (250 - 20) / 250);
  assert.equal(metrics.kpis.averageJobValue, 125);
});

test('customers are new in the month of their first completed job and returning afterwards', () => {
  const metrics = computeMetrics({ now, payments: [], feedback: [], actions: [],
    jobs: [job('1', '2026-07-05', 10, { customer_id: 'c1' }), job('2', '2026-08-05', 10, { customer_id: 'c1' }), job('3', '2026-08-06', 10, { customer_id: 'c2' }), job('4', '2026-08-07', 10)] });
  const aug = metrics.months.find(month => month.key === '2026-08');
  assert.deepEqual([aug.newCustomers, aug.returningCustomers], [1, 1]);
  assert.equal(metrics.kpis.repeatCustomerRate, 0.5);
});

test('metrics never invent figures when there is nothing to divide by', () => {
  const { kpis, quarters } = computeMetrics({ now, jobs: [], payments: [], feedback: [{ rating: null }], actions: [{ enquiries: 0, bookings: 0 }] });
  assert.deepEqual(Object.values(kpis), [null, null, null, null, null, null]);
  assert.equal(quarters.length, 4);
  assert.ok(quarters.every(quarter => quarter.growthPct === null));
});

test('CSV export has one row per month and keeps negative growth numeric', () => {
  const csv = metricsCsv(computeMetrics({ now, payments: [], feedback: [], actions: [], jobs: [job('a', '2026-08-10', 200), job('b', '2026-09-01', 100)] })).split('\r\n');
  assert.equal(csv.length, 13);
  assert.match(csv[0], /^Month,Completed jobs/);
  assert.equal(csv.at(-1), '2026-09,1,100,0,0,0,0,-50');
});

test('card validation rejects bad numbers, past expiry and wrong CVV length', () => {
  assert.equal(luhnValid('4242 4242 4242 4242'), true);
  assert.equal(luhnValid('4242 4242 4242 4241'), false);
  assert.deepEqual(validateCard({ name: 'Thandi Mokoena', number: '4242424242424242', expiry: '12/30', cvv: '123' }, now), {});
  const errors = validateCard({ name: 'x', number: '1234 5678 9012 3456', expiry: '08/26', cvv: '12' }, now);
  assert.deepEqual(Object.keys(errors).sort(), ['cvv', 'expiry', 'name', 'number']);
  assert.match(errors.expiry, /expired/);
  assert.ok(validateCard({ name: 'Ann Lee', number: '3782 822463 10005', expiry: '12/30', cvv: '123' }, now).cvv, 'Amex needs four digits');
  assert.equal(validateCard({ name: 'Ann Lee', number: '4242424242424242', expiry: '09/26', cvv: '123' }, now).expiry, undefined, 'valid through the end of the expiry month');
  assert.equal(formatCardNumber('4242424242424242'), '4242 4242 4242 4242');
  assert.equal(formatExpiry('1230'), '12/30');
});

test('the simulated gateway approves test cards and declines the decline card without a network call', async () => {
  const instant = async () => {};
  assert.equal((await simulateCharge({ name: 'A', number: '4242 4242 4242 4242', expiry: '12/30', cvv: '123' }, instant)).status, 200);
  assert.equal((await simulateCharge({ name: 'A', number: '4000 0000 0000 0002', expiry: '12/30', cvv: '123' }, instant)).status, 402);
});

const healthy = { generated_at: '', since: '', daily: [{ day: '2026-09-14', requests: 40, failures: 1, avg_latency_ms: 900, p95_latency_ms: 2100, tokens: 5000 }],
  by_kind: [{ kind: 'ask', requests: 40, avg_latency_ms: 900, tokens: 5000, failure_rate: 0.025 }], feedback: [{ topic: 'payments', ratings: 10, up: 9, down: 1, inaccurate: 0, unsafe: 0, satisfaction: 0.9 }],
  usage: { active_accounts: 6, accounts_at_daily_limit: 0, requests_last_hour: 2, average_hourly_requests: 1.5, busiest_account_share: 0.3 }, auth_events_24h: [{ action: 'login', events: 12 }] };

test('healthy telemetry raises no alerts', () => {
  assert.deepEqual(improvementAlerts(healthy), []);
  assert.deepEqual(securityFindings(healthy), []);
});

test('low satisfaction, accuracy reports, failures and spikes are flagged', () => {
  const quality = improvementAlerts({ ...healthy, feedback: [{ topic: 'costs', ratings: 5, up: 2, down: 3, inaccurate: 2, unsafe: 1, satisfaction: 0.4 }], by_kind: [{ kind: 'textbook', requests: 10, avg_latency_ms: 20000, tokens: 1, failure_rate: 0.3 }] });
  assert.deepEqual(quality.map(alert => alert.area), ['Topic: costs', 'Topic: costs', 'Topic: costs', 'Model: textbook']);
  const security = securityFindings({ ...healthy, usage: { ...healthy.usage, requests_last_hour: 60, accounts_at_daily_limit: 2 }, auth_events_24h: null });
  assert.deepEqual(security.map(alert => alert.area), ['API usage spike', 'Rate limiting', 'Auth logs']);
});

test('PDF text keeps readable punctuation and drops characters the built-in fonts cannot draw', () => {
  assert.equal(pdfSafe('Owner’s “plan” – step…'), 'Owner\'s "plan" - step...');
  assert.equal(pdfSafe('Grow 🚀 fast'), 'Grow  fast');
  assert.equal(pdfSafe('Café'), 'Café');
});

test('bias reports, uneven quality between topics and coverage gaps raise fairness alerts', () => {
  const alerts = improvementAlerts({ ...healthy,
    feedback: [{ topic: 'payments', ratings: 10, up: 9, down: 1, inaccurate: 0, unsafe: 0, biased: 1, satisfaction: 0.9 }, { topic: 'marketing', ratings: 5, up: 2, down: 3, inaccurate: 0, unsafe: 0, satisfaction: 0.4 }],
    topics: [{ topic: 'unknown', requests: 20, declined: 12, declined_rate: 0.6 }, { topic: 'payments', requests: 30, declined: 0, declined_rate: 0 }] });
  const bias = alerts.filter(alert => alert.category === 'bias').map(alert => alert.area);
  assert.deepEqual(bias, ['Topic: payments', 'Uneven answer quality', 'Coverage: unknown']);
  assert.ok(alerts.every(alert => alert.action.length > 10), 'every alert carries a next step');
});
