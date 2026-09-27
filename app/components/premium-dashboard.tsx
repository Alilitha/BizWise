"use client";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, FileSpreadsheet } from "lucide-react";
import { metricsCsv, type BusinessMetrics } from "../premium/metrics";
import { downloadProgressReport, kpiRows } from "../premium/pdf";

const rand = (value: number) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
const pct = (value: number | null) => value === null ? "-" : `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
const COLORS = { forest: "#194d3e", gold: "#d1a349", sage: "#8fb3a2" };

function download(name: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  link.click();
  URL.revokeObjectURL(url);
}

export function PremiumDashboard({ shopName, metrics }: { shopName: string; metrics: BusinessMetrics }) {
  const [exporting, setExporting] = useState(false);
  const growthData = metrics.months.map(month => ({ ...month, growth: month.growthPct === null ? null : Number((month.growthPct * 100).toFixed(1)) }));
  const latest = metrics.months[metrics.months.length - 1];
  const previous = metrics.months[metrics.months.length - 2];
  const lastQuarter = metrics.quarters[metrics.quarters.length - 1];

  return <div className="pm-dashboard">
    <div className="pm-toolbar">
      <div><span className="eyebrow">PREMIUM ANALYTICS</span><h2>Business progress</h2><p className="muted compact">Last 12 months of completed jobs, payments and feedback. Calculated from your saved records; no AI-generated figures.</p></div>
      <div className="pm-toolbar-actions">
        <button className="ghost" onClick={() => download(`bizwise-progress-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8", metricsCsv(metrics))}><FileSpreadsheet size={16}/> Export CSV</button>
        <button className="primary" disabled={exporting} onClick={async () => { setExporting(true); try { await downloadProgressReport(shopName, metrics); } finally { setExporting(false); } }}><Download size={16}/> {exporting ? "Preparing PDF…" : "Export PDF"}</button>
      </div>
    </div>

    <div className="pm-kpi-grid">
      <article className="pm-kpi"><small>This month (partial)</small><strong>{rand(latest?.charged || 0)}</strong><span>{pct(latest?.growthPct ?? null)} vs {previous?.label || "last month"}</span></article>
      <article className="pm-kpi"><small>Latest quarter</small><strong>{rand(lastQuarter?.charged || 0)}</strong><span>{pct(lastQuarter?.growthPct ?? null)} vs previous quarter</span></article>
      {kpiRows(metrics.kpis).map(([label, value, hint]) => <article className="pm-kpi" key={label}><small>{label}</small><strong>{value}</strong><span>{hint}</span></article>)}
    </div>

    {metrics.completedJobs === 0 ? <div className="card empty"><strong>Your charts start with your first completed job.</strong><p>Record completed jobs, payments and feedback to see growth, acquisition and performance trends here.</p></div> : <>
      <section className="card pm-chart-card">
        <div className="section-heading"><h3>Revenue and growth velocity</h3><span className="pill">Monthly</span></div>
        <div className="pm-chart" role="img" aria-label={growthData.map(month => `${month.label}: ${rand(month.charged)} charged, ${pct(month.growthPct)} growth`).join("; ")}>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={growthData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e3e9e2" vertical={false}/>
              <XAxis dataKey="label" tick={{ fontSize: 12 }}/>
              <YAxis yAxisId="money" tickFormatter={value => `R${Math.round(Number(value) / 1000)}k`} tick={{ fontSize: 12 }} width={48}/>
              <YAxis yAxisId="growth" orientation="right" tickFormatter={value => `${value}%`} tick={{ fontSize: 12 }} width={48}/>
              <Tooltip formatter={(value, name) => name === "Growth" ? `${value}%` : rand(Number(value))}/>
              <Legend/>
              <Bar yAxisId="money" dataKey="charged" name="Charged" fill={COLORS.forest} radius={[6, 6, 0, 0]}/>
              <Bar yAxisId="money" dataKey="collected" name="Received" fill={COLORS.sage} radius={[6, 6, 0, 0]}/>
              <Line yAxisId="growth" dataKey="growth" name="Growth" stroke={COLORS.gold} strokeWidth={2.5} dot connectNulls={false}/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="pm-two">
        <section className="card pm-chart-card">
          <div className="section-heading"><h3>Quarterly progress</h3><span className="pill">Quarters</span></div>
          <div className="pm-chart" role="img" aria-label={metrics.quarters.map(quarter => `${quarter.label}: ${rand(quarter.charged)}, ${pct(quarter.growthPct)}`).join("; ")}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={metrics.quarters}>
                <CartesianGrid stroke="#e3e9e2" vertical={false}/>
                <XAxis dataKey="label" tick={{ fontSize: 11 }}/>
                <YAxis tickFormatter={value => `R${Math.round(Number(value) / 1000)}k`} tick={{ fontSize: 12 }} width={48}/>
                <Tooltip formatter={value => rand(Number(value))}/>
                <Bar dataKey="charged" name="Charged" fill={COLORS.forest} radius={[6, 6, 0, 0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card pm-chart-card">
          <div className="section-heading"><h3>Customer acquisition and retention</h3><span className="pill">Customers</span></div>
          <div className="pm-chart" role="img" aria-label={metrics.months.map(month => `${month.label}: ${month.newCustomers} new, ${month.returningCustomers} returning`).join("; ")}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={metrics.months}>
                <CartesianGrid stroke="#e3e9e2" vertical={false}/>
                <XAxis dataKey="label" tick={{ fontSize: 11 }}/>
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32}/>
                <Tooltip/>
                <Legend/>
                <Bar dataKey="newCustomers" name="New" stackId="c" fill={COLORS.gold}/>
                <Bar dataKey="returningCustomers" name="Returning" stackId="c" fill={COLORS.forest} radius={[6, 6, 0, 0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="muted compact">Counts only jobs linked to a saved customer.</p>
        </section>
      </div>
    </>}
    <p className="muted compact">The current month is partial. Amounts charged are not cash received, and direct-cost margin is not net profit.</p>
  </div>;
}
