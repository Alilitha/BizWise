"use client";
import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, Scale, ShieldAlert, Sparkles, ThumbsDown, ThumbsUp, Gauge, ListChecks, History } from "lucide-react";
import { FAIRNESS_CONTROLS, improvementAlerts, RELEASE_CHECKS, securityFindings, type Alert, type Telemetry } from "../premium/telemetry";

type Load = { phase: "loading" } | { phase: "ready"; data: Telemetry } | { phase: "failed"; message: string };
const SECTIONS = [
  { key: "overview", label: "Overview", icon: Activity },
  { key: "performance", label: "Performance", icon: Gauge },
  { key: "accuracy", label: "Hallucination & accuracy", icon: Sparkles },
  { key: "bias", label: "Bias & fairness", icon: Scale },
  { key: "security", label: "Security", icon: ShieldAlert },
  { key: "plan", label: "Improvement plan", icon: ListChecks },
  { key: "activity", label: "Activity log", icon: History },
] as const;
type Section = typeof SECTIONS[number]["key"];
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const grid = <CartesianGrid stroke="#e3e9e2" vertical={false}/>;

function AlertList({ alerts, empty, showAction = false }: { alerts: Alert[]; empty: string; showAction?: boolean }) {
  if (!alerts.length) return <p className="pm-ok"><CheckCircle2 size={16}/> {empty}</p>;
  return <ul className="pm-alerts">{alerts.map(alert => <li key={alert.area + alert.message} className={`pm-alert ${alert.severity}`}><AlertTriangle size={15}/><div><strong>{alert.area}</strong><span>{alert.message}</span>{showAction && <span className="pm-action">Next step: {alert.action}</span>}</div></li>)}</ul>;
}

export function AdminDashboard({ db }: { db: SupabaseClient }) {
  const [days, setDays] = useState(14);
  const [section, setSection] = useState<Section>("overview");
  const [load, setLoad] = useState<Load>({ phase: "loading" });
  const refresh = useCallback(async () => {
    setLoad({ phase: "loading" });
    const result = await db.rpc("admin_telemetry", { window_days: days });
    if (result.error) setLoad({ phase: "failed", message: result.error.code === "42501" ? "Administrator access is required." : "Telemetry is unavailable. Apply the 20260928 and 20260929 migrations, then refresh." });
    else setLoad({ phase: "ready", data: result.data as Telemetry });
  }, [db, days]);
  useEffect(() => { void refresh(); }, [refresh]);

  const header = <div className="pm-toolbar">
    <div><span className="eyebrow"><Activity size={14}/> PLATFORM ADMINISTRATION</span><h2>AI monitoring console</h2><p className="muted compact">Aggregated labels, timings, counts and owner ratings. No questions, answers or business records are stored in telemetry.</p></div>
    <div className="pm-toolbar-actions">
      <select value={days} onChange={event => setDays(Number(event.target.value))} aria-label="Time window"><option value={1}>Last 24 hours</option><option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select>
      <button className="ghost" onClick={refresh} disabled={load.phase === "loading"}><RefreshCw size={16}/> Refresh</button>
    </div>
  </div>;
  if (load.phase !== "ready") return <div className="pm-dashboard">{header}<div className="card">{load.phase === "loading" ? <p className="muted" role="status">Loading telemetry…</p> : <p className="notice error" role="alert">{load.message}</p>}</div></div>;

  const { data } = load;
  const totals = data.daily.reduce((sum, day) => ({ requests: sum.requests + day.requests, failures: sum.failures + day.failures, tokens: sum.tokens + day.tokens }), { requests: 0, failures: 0, tokens: 0 });
  const ratings = data.feedback.reduce((sum, topic) => ({ up: sum.up + topic.up, down: sum.down + topic.down, inaccurate: sum.inaccurate + topic.inaccurate, unsafe: sum.unsafe + topic.unsafe, biased: sum.biased + (topic.biased ?? 0) }), { up: 0, down: 0, inaccurate: 0, unsafe: 0, biased: 0 });
  const latency = Math.round(data.daily.reduce((sum, day) => sum + day.avg_latency_ms * day.requests, 0) / Math.max(1, totals.requests));
  const alerts = [...improvementAlerts(data), ...securityFindings(data)].sort((a, b) => (a.severity === "high" ? 0 : 1) - (b.severity === "high" ? 0 : 1));
  const byCategory = (category: Alert["category"]) => alerts.filter(alert => alert.category === category);
  const topics = data.topics ?? [];
  const declined = topics.reduce((sum, topic) => sum + topic.declined, 0);
  const asked = topics.reduce((sum, topic) => sum + topic.requests, 0);
  const noData = totals.requests === 0 && data.feedback.length === 0;

  const kpi = (label: string, value: React.ReactNode, hint: string, tone = "") => <article className={`pm-kpi ${tone}`} key={label}><small>{label}</small><strong>{value}</strong><span>{hint}</span></article>;
  const performance = <div className="pm-two">
    <section className="card pm-chart-card"><div className="section-heading"><h3>Response latency</h3><span className="pill">milliseconds</span></div>
      <ResponsiveContainer width="100%" height={240}><ComposedChart data={data.daily}>{grid}<XAxis dataKey="day" tick={{ fontSize: 11 }}/><YAxis tick={{ fontSize: 11 }} width={48}/><Tooltip/><Legend/>
        <Line dataKey="avg_latency_ms" name="Average" stroke="#194d3e" strokeWidth={2}/><Line dataKey="p95_latency_ms" name="p95" stroke="#d1a349" strokeWidth={2}/></ComposedChart></ResponsiveContainer></section>
    <section className="card pm-chart-card"><div className="section-heading"><h3>Requests, failures and tokens</h3><span className="pill">Daily</span></div>
      <ResponsiveContainer width="100%" height={240}><ComposedChart data={data.daily}>{grid}<XAxis dataKey="day" tick={{ fontSize: 11 }}/><YAxis yAxisId="n" tick={{ fontSize: 11 }} width={36} allowDecimals={false}/><YAxis yAxisId="t" orientation="right" tick={{ fontSize: 11 }} width={52}/><Tooltip/><Legend/>
        <Bar yAxisId="n" dataKey="requests" name="Requests" fill="#8fb3a2" radius={[4, 4, 0, 0]}/><Bar yAxisId="n" dataKey="failures" name="Failures" fill="#b5483b" radius={[4, 4, 0, 0]}/><Line yAxisId="t" dataKey="tokens" name="Tokens" stroke="#194d3e" strokeWidth={2}/></ComposedChart></ResponsiveContainer></section>
    <section className="card"><div className="section-heading"><h3>By AI feature</h3><span className="pill">{data.by_kind.length} features</span></div>
      {data.by_kind.length ? <div className="report-table-wrap"><table className="report-table"><thead><tr><th scope="col">Feature</th><th scope="col">Requests</th><th scope="col">Avg latency</th><th scope="col">Tokens</th><th scope="col">Failure rate</th></tr></thead><tbody>{data.by_kind.map(kind => <tr key={kind.kind}><th scope="row">{kind.kind}</th><td>{kind.requests}</td><td>{(kind.avg_latency_ms / 1000).toFixed(2)}s</td><td>{kind.tokens.toLocaleString("en-ZA")}</td><td>{pct(kind.failure_rate)}</td></tr>)}</tbody></table></div> : <p className="muted compact">No AI requests in this window.</p>}</section>
    <section className="card"><h3>Performance alerts</h3><AlertList alerts={byCategory("performance")} empty="Latency and failure rates are within thresholds." showAction/></section>
  </div>;

  const accuracy = <div className="pm-two">
    <section className="card"><div className="section-heading"><h3>Answer ratings by topic</h3><span className="pill">Owner reported</span></div>
      {data.feedback.length ? <div className="report-table-wrap"><table className="report-table"><thead><tr><th scope="col">Topic</th><th scope="col">Up / down</th><th scope="col">Satisfaction</th><th scope="col">Inaccurate</th><th scope="col">Unclear</th><th scope="col">Unsafe</th></tr></thead><tbody>{data.feedback.map(topic => <tr key={topic.topic}><th scope="row">{topic.topic}</th><td>{topic.up} / {topic.down}</td><td>{pct(topic.satisfaction)}</td><td>{topic.inaccurate}</td><td>{topic.unclear ?? 0}</td><td>{topic.unsafe}</td></tr>)}</tbody></table></div> : <p className="muted compact">No answer ratings yet. Owners rate answers with the thumbs buttons under each coach reply.</p>}</section>
    <section className="card pm-chart-card"><div className="section-heading"><h3>Hallucination signals</h3><span className="pill">Reports</span></div>
      <ResponsiveContainer width="100%" height={220}><BarChart data={data.feedback}>{grid}<XAxis dataKey="topic" tick={{ fontSize: 11 }}/><YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32}/><Tooltip/><Legend/><Bar dataKey="inaccurate" name="Inaccurate" fill="#b5483b"/><Bar dataKey="unsafe" name="Unsafe" fill="#7d2a22"/><Bar dataKey="unclear" name="Unclear" fill="#d1a349"/></BarChart></ResponsiveContainer></section>
    <section className="card"><h3>Where the AI needs improvement</h3><AlertList alerts={byCategory("accuracy")} empty="No topic is below its accuracy or satisfaction threshold." showAction/></section>
    <section className="card"><h3>How hallucination is limited</h3><ul className="compact"><li>Coach figures are calculated from records by the server; the model only picks a topic.</li><li>Textbook and campaign output is parsed against a strict schema and labelled AI-drafted.</li><li>Image readings must be confirmed by the owner before advice is saved.</li><li>&quot;Inaccurate&quot; reports here are the signal to review a guide.</li></ul></section>
  </div>;

  const bias = <div className="pm-two">
    <section className="card"><div className="section-heading"><h3>Bias and fairness reports</h3><span className="pill">{ratings.biased} reports</span></div>
      {data.feedback.some(topic => (topic.biased ?? 0) > 0) ? <ul className="pm-plain">{data.feedback.filter(topic => (topic.biased ?? 0) > 0).map(topic => <li key={topic.topic}><span>{topic.topic}</span><strong>{topic.biased}</strong></li>)}</ul> : <p className="pm-ok"><CheckCircle2 size={16}/> No answers reported as biased or unfair in this window.</p>}
      <h4>Satisfaction across topics</h4>
      <ResponsiveContainer width="100%" height={200}><BarChart data={data.feedback.map(topic => ({ topic: topic.topic, satisfaction: Number((topic.satisfaction * 100).toFixed(1)) }))}>{grid}<XAxis dataKey="topic" tick={{ fontSize: 11 }}/><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={36}/><Tooltip formatter={value => `${value}%`}/><Bar dataKey="satisfaction" name="Satisfaction %" fill="#194d3e"/></BarChart></ResponsiveContainer>
      <p className="muted compact">Large gaps mean some owners get less useful help depending on what they ask.</p></section>
    <section className="card"><div className="section-heading"><h3>Coverage gaps</h3><span className="pill">{asked ? pct(declined / asked) : "-"} declined</span></div>
      {topics.length ? <div className="report-table-wrap"><table className="report-table"><thead><tr><th scope="col">Topic</th><th scope="col">Questions</th><th scope="col">Declined</th></tr></thead><tbody>{topics.map(topic => <tr key={topic.topic}><th scope="row">{topic.topic}</th><td>{topic.requests}</td><td>{pct(topic.declined_rate)}</td></tr>)}</tbody></table></div> : <p className="muted compact">Topic routing data appears after the 20260929 migration and new coach requests.</p>}
      <p className="muted compact">Declined questions are ones the coach could not safely match to a supported topic. A high rate can disadvantage owners who phrase questions differently.</p></section>
    <section className="card"><h3>Fairness alerts</h3><AlertList alerts={byCategory("bias")} empty="No bias reports, uneven quality or coverage gaps above threshold." showAction/></section>
    <section className="card"><h3>Fairness controls in place</h3><ul className="compact">{FAIRNESS_CONTROLS.map(control => <li key={control}>{control}</li>)}</ul><p className="muted compact">These numbers cannot show bias between demographic groups because none are collected. Test with a diverse pilot group of owners.</p></section>
  </div>;

  const security = <div className="pm-two">
    <section className="card"><h3>Sign-in activity (24 hours)</h3>{data.auth_events_24h?.length ? <ul className="pm-plain">{data.auth_events_24h.map(event => <li key={event.action}><span>{event.action}</span><strong>{event.events}</strong></li>)}</ul> : <p className="muted compact">{data.auth_events_24h === null ? "Auth audit log is not readable from the database. Check Supabase Authentication logs." : "No auth events."}</p>}</section>
    <section className="card"><h3>Rate limiting and usage</h3><ul className="pm-plain"><li><span>Coaching limits</span><strong>5 per minute · 50 per day</strong></li><li><span>Accounts at daily limit</span><strong>{data.usage.accounts_at_daily_limit}</strong></li><li><span>Requests last hour</span><strong>{data.usage.requests_last_hour}</strong></li><li><span>Average per hour</span><strong>{data.usage.average_hourly_requests}</strong></li><li><span>Busiest account share</span><strong>{data.usage.busiest_account_share === null ? "-" : pct(data.usage.busiest_account_share)}</strong></li></ul></section>
    <section className="card"><h3>Threats and anomalies</h3><AlertList alerts={byCategory("security")} empty="No anomalies detected in the recorded signals." showAction/></section>
    <section className="card"><h3>Release security checklist</h3><ul className="compact">{RELEASE_CHECKS.map(check => <li key={check}>{check}</li>)}</ul></section>
  </div>;

  const plan = <section className="card"><div className="section-heading"><h3>Improvement plan</h3><span className="pill">{alerts.length} items</span></div>
    <p className="muted compact">Every open alert across performance, accuracy, bias and security, most severe first, with a suggested next step.</p>
    <AlertList alerts={alerts} empty="Nothing needs attention right now." showAction/></section>;

  const activity = <section className="card"><div className="section-heading"><h3>Recent AI activity</h3><span className="pill">Last 25</span></div>
    {data.recent?.length ? <div className="report-table-wrap"><table className="report-table"><thead><tr><th scope="col">Time</th><th scope="col">Feature</th><th scope="col">Topic</th><th scope="col">Status</th><th scope="col">Latency</th><th scope="col">Tokens</th></tr></thead><tbody>{data.recent.map((event, index) => <tr key={index}><th scope="row">{new Date(event.created_at).toLocaleString("en-ZA")}</th><td>{event.kind}</td><td>{event.topic ?? "-"}</td><td><span className={`pm-status ${event.status}`}>{event.status}</span></td><td>{(event.latency_ms / 1000).toFixed(2)}s</td><td>{event.tokens}</td></tr>)}</tbody></table></div> : <p className="muted compact">No recorded activity yet. Events appear after the updated adviser function is deployed and owners use the coach.</p>}
    <p className="muted compact">Owner identities are not shown.</p></section>;

  const overview = <>
    <div className="pm-kpi-grid">
      {kpi("AI requests", totals.requests, `${data.usage.active_accounts} active accounts${data.usage.new_accounts_7d != null ? ` · ${data.usage.new_accounts_7d} new this week` : ""}`)}
      {kpi("Failure rate", totals.requests ? pct(totals.failures / totals.requests) : "-", "Provider errors, unusable output and declined questions", totals.requests && totals.failures / totals.requests > 0.1 ? "warn" : "")}
      {kpi("Average latency", latency ? `${(latency / 1000).toFixed(2)}s` : "-", "Server-side, per request")}
      {kpi("Tokens used", totals.tokens.toLocaleString("en-ZA"), "Reported by Groq")}
      {kpi("Answer ratings", <><ThumbsUp size={16}/> {ratings.up} · <ThumbsDown size={16}/> {ratings.down}</>, `${ratings.up + ratings.down ? pct(ratings.up / (ratings.up + ratings.down)) : "-"} positive`)}
      {kpi("Hallucination reports", ratings.inaccurate, `${ratings.unsafe} unsafe`, ratings.inaccurate + ratings.unsafe ? "warn" : "")}
      {kpi("Bias reports", ratings.biased, "Answers flagged biased or unfair", ratings.biased ? "warn" : "")}
      {kpi("Open alerts", alerts.length, `${alerts.filter(alert => alert.severity === "high").length} high severity`, alerts.some(alert => alert.severity === "high") ? "warn" : "")}
    </div>
    {noData && <p className="notice">No telemetry yet. Deploy the updated adviser function, then ask the coach a question and rate the answer to see data here.</p>}
    <div className="pm-two">
      <section className="card"><h3>Top priorities</h3><AlertList alerts={alerts.slice(0, 4)} empty="Nothing needs attention right now." showAction/></section>
      <section className="card pm-chart-card"><div className="section-heading"><h3>Daily AI requests</h3><span className="pill">{days} days</span></div>
        <ResponsiveContainer width="100%" height={220}><BarChart data={data.daily}>{grid}<XAxis dataKey="day" tick={{ fontSize: 11 }}/><YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32}/><Tooltip/><Bar dataKey="requests" name="Requests" fill="#194d3e" radius={[4, 4, 0, 0]}/><Bar dataKey="failures" name="Failures" fill="#b5483b" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></section>
    </div>
  </>;

  const views: Record<Section, React.ReactNode> = { overview, performance, accuracy, bias, security, plan, activity };
  return <div className="pm-dashboard">
    {header}
    <nav className="pm-admin-tabs" aria-label="Monitoring sections">{SECTIONS.map(({ key, label, icon: Icon }) => {
      const count = key === "plan" ? alerts.length : key === "overview" || key === "activity" ? 0 : byCategory(key).length;
      return <button key={key} className={section === key ? "active" : ""} aria-current={section === key ? "page" : undefined} onClick={() => setSection(key)}><Icon size={15}/>{label}{count > 0 && <span className="pm-count">{count}</span>}</button>;
    })}</nav>
    {views[section]}
  </div>;
}
