export type FeedbackRow = { topic: string; ratings: number; up: number; down: number; inaccurate: number; unsafe: number; biased?: number; not_relevant?: number; unclear?: number; satisfaction: number };
export type Telemetry = {
  generated_at: string; since: string;
  daily: { day: string; requests: number; failures: number; avg_latency_ms: number; p95_latency_ms: number; tokens: number }[];
  by_kind: { kind: string; requests: number; avg_latency_ms: number; tokens: number; failure_rate: number }[];
  // topics and recent arrive with 20260929_admin_console.sql; older databases omit them.
  topics?: { topic: string; requests: number; declined: number; declined_rate: number }[];
  recent?: { kind: string; topic: string | null; status: string; latency_ms: number; tokens: number; created_at: string }[];
  feedback: FeedbackRow[];
  usage: { active_accounts: number; new_accounts_7d?: number | null; accounts_at_daily_limit: number; requests_last_hour: number; average_hourly_requests: number; busiest_account_share: number | null };
  auth_events_24h: { action: string; events: number }[] | null;
};
export type Category = 'performance' | 'accuracy' | 'bias' | 'security';
export type Alert = { severity: 'high' | 'medium'; category: Category; area: string; message: string; action: string };

export const THRESHOLDS = {
  minRatings: 3, satisfaction: 0.7, inaccurateReports: 2, failureRate: 0.1, p95LatencyMs: 8000,
  spikeMultiplier: 3, spikeMinimum: 20, busiestShare: 0.5, failedLogins: 20,
  declinedRate: 0.3, declinedMinimum: 10, satisfactionSpread: 0.3,
};
const pct = (value: number) => `${(value * 100).toFixed(0)}%`;

export function improvementAlerts(data: Telemetry): Alert[] {
  const alerts: Alert[] = [];
  for (const topic of data.feedback) {
    const area = `Topic: ${topic.topic}`;
    if (topic.unsafe > 0) alerts.push({ severity: 'high', category: 'accuracy', area, message: `${topic.unsafe} answer(s) reported as unsafe.`, action: 'Review the reviewed guide and routing for this topic before the next release.' });
    if ((topic.biased ?? 0) > 0) alerts.push({ severity: 'high', category: 'bias', area, message: `${topic.biased} answer(s) reported as biased or unfair.`, action: 'Read the guide text for assumptions about customers, location or ability, and test it with a diverse pilot group.' });
    if (topic.inaccurate >= THRESHOLDS.inaccurateReports) alerts.push({ severity: 'high', category: 'accuracy', area, message: `${topic.inaccurate} accuracy reports. Possible hallucinated or mismatched guidance.`, action: 'Check that the figures shown match the owner records and that questions route to the right topic.' });
    if (topic.ratings >= THRESHOLDS.minRatings && topic.satisfaction < THRESHOLDS.satisfaction) alerts.push({ severity: 'medium', category: 'accuracy', area, message: `Satisfaction ${pct(topic.satisfaction)} across ${topic.ratings} ratings is below ${pct(THRESHOLDS.satisfaction)}.`, action: 'Rewrite the guide in plainer language or add a more specific next step.' });
  }
  const rated = data.feedback.filter(topic => topic.ratings >= THRESHOLDS.minRatings);
  if (rated.length > 1) {
    const best = rated.reduce((a, b) => a.satisfaction > b.satisfaction ? a : b);
    const worst = rated.reduce((a, b) => a.satisfaction < b.satisfaction ? a : b);
    if (best.satisfaction - worst.satisfaction >= THRESHOLDS.satisfactionSpread) alerts.push({ severity: 'medium', category: 'bias', area: 'Uneven answer quality', message: `Satisfaction ranges from ${pct(worst.satisfaction)} (${worst.topic}) to ${pct(best.satisfaction)} (${best.topic}).`, action: `Bring the ${worst.topic} guide up to the standard of ${best.topic} so every owner gets equally useful help.` });
  }
  for (const topic of data.topics ?? []) {
    if (topic.requests >= THRESHOLDS.declinedMinimum && topic.declined_rate > THRESHOLDS.declinedRate) alerts.push({ severity: 'medium', category: 'bias', area: `Coverage: ${topic.topic}`, message: `${pct(topic.declined_rate)} of ${topic.requests} questions were declined as unsupported.`, action: 'Owners asking these questions get no help. Add a reviewed guide or clearer examples of supported questions.' });
  }
  for (const kind of data.by_kind) {
    if (kind.requests >= 5 && kind.failure_rate > THRESHOLDS.failureRate) alerts.push({ severity: 'high', category: 'performance', area: `Model: ${kind.kind}`, message: `${(kind.failure_rate * 100).toFixed(1)}% of requests failed or returned unusable output.`, action: 'Check provider errors and quota, then tighten the prompt or schema for this feature.' });
  }
  const slow = data.daily.filter(day => day.p95_latency_ms > THRESHOLDS.p95LatencyMs);
  if (slow.length) alerts.push({ severity: 'medium', category: 'performance', area: 'Latency', message: `p95 latency exceeded ${THRESHOLDS.p95LatencyMs / 1000}s on ${slow.length} day(s).`, action: 'Consider a faster model for this feature or shorter outputs.' });
  return alerts;
}

export function securityFindings(data: Telemetry): Alert[] {
  const findings: Alert[] = [];
  const { usage } = data;
  const push = (severity: Alert['severity'], area: string, message: string, action: string) => findings.push({ severity, category: 'security', area, message, action });
  if (usage.requests_last_hour >= THRESHOLDS.spikeMinimum && usage.requests_last_hour > usage.average_hourly_requests * THRESHOLDS.spikeMultiplier) push('high', 'API usage spike', `${usage.requests_last_hour} AI requests in the last hour vs an average of ${usage.average_hourly_requests}/hour.`, 'Check for scripted abuse and provider spend.');
  if (usage.accounts_at_daily_limit > 0) push('medium', 'Rate limiting', `${usage.accounts_at_daily_limit} account(s) reached the 50-per-day coaching limit.`, 'Confirm these are genuine owners, not automated clients.');
  if ((usage.busiest_account_share ?? 0) > THRESHOLDS.busiestShare && usage.active_accounts > 1) push('medium', 'Usage concentration', `One account made ${pct(usage.busiest_account_share ?? 0)} of AI requests in this window.`, 'Review that account in Supabase Auth for unusual activity.');
  const failedLogins = (data.auth_events_24h || []).filter(event => /fail|invalid|reject/i.test(event.action)).reduce((total, event) => total + event.events, 0);
  if (failedLogins > THRESHOLDS.failedLogins) push('high', 'Sign-in attempts', `${failedLogins} failed sign-in events in 24 hours.`, 'Enable CAPTCHA and review IPs in Supabase Auth logs.');
  if (data.auth_events_24h === null) push('medium', 'Auth logs', 'Supabase Auth audit logs are not readable from this function.', 'Review sign-in activity in the Supabase dashboard.');
  return findings;
}

// Controls that are designed in rather than measured. Shown so reviewers can see what the numbers cannot.
export const FAIRNESS_CONTROLS = [
  'No gender, race, age, language or location-based scoring. BizWise does not collect demographic data.',
  'Every owner gets the same calculations and the same reviewed guides for a topic.',
  'The model is instructed not to infer ability, trustworthiness or success from names, gender, race, accent or location.',
  'Owners can reject any suggestion with "This does not fit" or report it as biased.',
];

export const RELEASE_CHECKS = [
  'Run npm audit and update vulnerable dependencies before each release.',
  'Confirm leaked-password protection, email confirmation and CAPTCHA are enabled in Supabase Auth.',
  'Set CSP, HSTS, frame-ancestors and Referrer-Policy at the hosting or CDN layer. GitHub Pages cannot set them.',
  'Rotate GROQ_API_KEY and SERPER_API_KEY if they were ever committed or shared.',
  'Confirm RLS is enabled on every public table and that no service-role key is used in the browser.',
];
