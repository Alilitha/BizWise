export type MetricJob = { id: string; job_date: string; status: string; amount_charged: number | null; parts_cost: number; other_direct_cost: number; customer_id?: string | null; service_id: string };
export type MetricPayment = { job_id: string; amount: number; paid_at: string };
export type MetricFeedback = { rating: number | null };
export type MetricAction = { enquiries: number; bookings: number };

export type MonthMetric = {
  key: string; label: string; jobs: number; charged: number; directCosts: number; collected: number;
  newCustomers: number; returningCustomers: number; growthPct: number | null;
};
export type QuarterMetric = { label: string; charged: number; jobs: number; growthPct: number | null };
// null means the denominator is zero, so the figure cannot be calculated from records.
export type Kpis = {
  collectionRate: number | null; directMargin: number | null; averageJobValue: number | null;
  repeatCustomerRate: number | null; enquiryToBooking: number | null; averageRating: number | null;
};
export type BusinessMetrics = { months: MonthMetric[]; quarters: QuarterMetric[]; kpis: Kpis; completedJobs: number; charged: number };

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const ratio = (part: number, whole: number) => whole > 0 ? part / whole : null;
const growth = (current: number, previous: number) => previous > 0 ? (current - previous) / previous : null;

export function computeMetrics({ jobs, payments, feedback, actions, now = new Date(), monthCount = 12 }: {
  jobs: MetricJob[]; payments: MetricPayment[]; feedback: MetricFeedback[]; actions: MetricAction[]; now?: Date; monthCount?: number;
}): BusinessMetrics {
  const today = now.toISOString().slice(0, 10);
  const completed = jobs.filter(job => job.status === 'completed' && job.job_date <= today);
  const completedIds = new Set(completed.map(job => job.id));
  const charge = (job: MetricJob) => Number(job.amount_charged || 0);
  const cost = (job: MetricJob) => Number(job.parts_cost || 0) + Number(job.other_direct_cost || 0);

  const firstJobMonth = new Map<string, string>();
  for (const job of [...completed].sort((a, b) => a.job_date.localeCompare(b.job_date))) {
    if (job.customer_id && !firstJobMonth.has(job.customer_id)) firstJobMonth.set(job.customer_id, job.job_date.slice(0, 7));
  }

  const months: MonthMetric[] = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = start.toISOString().slice(0, 7);
    const inMonth = completed.filter(job => job.job_date.startsWith(key));
    const customers = new Set(inMonth.map(job => job.customer_id).filter((id): id is string => Boolean(id)));
    const newCustomers = [...customers].filter(id => firstJobMonth.get(id) === key).length;
    const charged = sum(inMonth.map(charge));
    months.push({
      key, label: start.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      jobs: inMonth.length, charged, directCosts: sum(inMonth.map(cost)),
      collected: sum(payments.filter(payment => completedIds.has(payment.job_id) && payment.paid_at.startsWith(key)).map(payment => Number(payment.amount))),
      newCustomers, returningCustomers: customers.size - newCustomers,
      growthPct: months.length ? growth(charged, months[months.length - 1].charged) : null,
    });
  }

  const quarters: QuarterMetric[] = [];
  for (let q = 0; q + 3 <= months.length; q += 3) {
    const slice = months.slice(q, q + 3);
    const charged = sum(slice.map(month => month.charged));
    quarters.push({ label: `${slice[0].label} to ${slice[2].label}`, charged, jobs: sum(slice.map(month => month.jobs)), growthPct: quarters.length ? growth(charged, quarters[quarters.length - 1].charged) : null });
  }

  const totalCharged = sum(completed.map(charge));
  const collected = sum(payments.filter(payment => completedIds.has(payment.job_id)).map(payment => Number(payment.amount)));
  const jobsPerCustomer = new Map<string, number>();
  for (const job of completed) if (job.customer_id) jobsPerCustomer.set(job.customer_id, (jobsPerCustomer.get(job.customer_id) || 0) + 1);
  const rated = feedback.filter(item => item.rating !== null).map(item => Number(item.rating));

  return {
    months, quarters, completedJobs: completed.length, charged: totalCharged,
    kpis: {
      collectionRate: ratio(collected, totalCharged),
      directMargin: ratio(totalCharged - sum(completed.map(cost)), totalCharged),
      averageJobValue: ratio(totalCharged, completed.length),
      repeatCustomerRate: ratio([...jobsPerCustomer.values()].filter(count => count > 1).length, jobsPerCustomer.size),
      enquiryToBooking: ratio(sum(actions.map(action => Number(action.bookings))), sum(actions.map(action => Number(action.enquiries)))),
      averageRating: rated.length ? sum(rated) / rated.length : null,
    },
  };
}

const csvCell = (value: string | number | null) => {
  const text = value === null ? '' : String(value);
  // A leading =,+,-,@ runs as a formula when the owner opens the file in a spreadsheet.
  const safe = typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function metricsCsv(metrics: BusinessMetrics): string {
  const rows: (string | number | null)[][] = [
    ['Month', 'Completed jobs', 'Amount charged (ZAR)', 'Direct costs (ZAR)', 'Payments received (ZAR)', 'New customers', 'Returning customers', 'Growth vs previous month (%)'],
    ...metrics.months.map(month => [month.key, month.jobs, month.charged, month.directCosts, month.collected, month.newCustomers, month.returningCustomers, month.growthPct === null ? null : Number((month.growthPct * 100).toFixed(1))]),
  ];
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
