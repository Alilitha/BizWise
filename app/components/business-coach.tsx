"use client";

import { useState } from "react";
import { ArrowRight, BookOpen, Check, ArrowUpRight, Mic, Camera, TrendingUp, Sparkles, ShieldCheck, Target, BarChart3 } from "lucide-react";

type CoachProps = { outstanding: number; jobCount: number; feedbackCount: number; onNavigate: (tab: string) => void; learned: string[]; onLearn: (topic: string) => Promise<void> };

export function BusinessCoach({ outstanding, jobCount, feedbackCount, onNavigate, learned, onLearn }: CoachProps) {
  const [saving, setSaving] = useState(false);
  const topic = jobCount === 0 ? "records" : outstanding > 0 ? "payments" : "customers";
  const content = {
    records: { label: "Build your business baseline", reason: "You have no recorded jobs yet. Start with one completed service so your guidance has real information to work with.", skill: "Keep a useful daily record", steps: ["Choose one service you completed today.", "Record the amount charged and the direct cost of delivering it.", "Record money received separately. A sale and a payment are not always the same thing."], action: "Record your first job", target: "Jobs" },
    payments: { label: "Follow up on unpaid work", reason: `${new Intl.NumberFormat("en-ZA", {style:"currency",currency:"ZAR"}).format(outstanding)} remains unpaid across your completed jobs. Check those records before contacting customers.`, skill: "Make payment follow-ups clear", steps: ["Check the job amount and payments already received.", "Send a polite reminder with the service, outstanding amount and agreed payment date.", "Record the payment when it arrives, then review what remains unpaid."], action: "Review jobs & payments", target: "Jobs" },
    customers: { label: "Learn from your customers", reason: feedbackCount ? `You have ${feedbackCount} recorded customer responses. Review the comments for a specific service improvement to try.` : "Your jobs are building a useful record. Add customer feedback to understand the experience behind the numbers.", skill: "Turn feedback into a small experiment", steps: ["Ask a customer what worked well and what could improve.", "Choose one specific change you can make for your next job.", "Record the next customer's response and compare. A few responses are a starting point, not proof of a trend."], action: "Review customer feedback", target: "Feedback" },
  }[topic];
  return <section className="coach-panel">
    <div className="coach-intro"><span className="section-kicker">01 / YOUR NEXT STEP</span><h2>{content.label}</h2><p>{content.reason}</p><span className="evidence-label">Suggested from your recorded activity</span></div>
    <div className="coach-lesson"><span className="section-kicker"><BookOpen size={15}/> LEARN THE SKILL</span><h3>{content.skill}</h3><details key={topic}><summary>Read the short guide <ArrowRight size={16}/></summary><ol>{content.steps.map(step => <li key={step}>{step}</li>)}</ol><button className="lesson-complete" disabled={saving || learned.includes(topic)} onClick={async () => { setSaving(true); try { await onLearn(topic); } finally { setSaving(false); } }}><Check size={15}/>{learned.includes(topic) ? 'Guide completed' : saving ? 'Saving…' : 'Mark guide complete'}</button></details><button className="primary" onClick={() => onNavigate(content.target)}>{content.action}<ArrowRight size={16}/></button><p className="lesson-measure"><strong>Check your progress</strong>{topic === 'payments' ? 'After your follow-up, record any payment and review the balance.' : topic === 'records' ? 'At the end of the day, compare your recorded jobs with your receipts.' : 'Try one change, then record the next customer’s feedback.'}</p></div>
  </section>;
}

export function PremiumTeaser({ onOpen }: { onOpen: () => void }) {
  return <button className="premium-strip" onClick={onOpen}><span className="premium-strip-icon"><TrendingUp size={23}/></span><span><span className="section-kicker">BIZWISE PREMIUM</span><strong>See the patterns behind your performance.</strong><small>Revenue trends, service performance and deeper business insights.</small></span><span className="premium-strip-link">Explore Premium <ArrowUpRight size={18}/></span></button>;
}

const PREMIUM_FEATURES = [
  { icon: BarChart3, title: "Personalised business analytics", text: "Revenue and growth velocity, quarterly progress, customer acquisition and retention, and KPIs for collection, margin and conversion. Export to CSV or PDF." },
  { icon: BookOpen, title: "Your own masterclass textbook", text: "A structured PDF written for your business type and size: business model canvas, strategy and risk, scaling and unit economics, daily checklists." },
  { icon: Target, title: "Strategic marketing toolkit", text: "Campaign copy for LinkedIn, Instagram, X and Facebook with hashtag clusters, buyer personas, accounts to engage and calls to action." },
  { icon: Mic, title: "Voice and vision coaching", text: "Speak your question with a live waveform, or photograph a receipt, price list or shopfront for the coach to read." },
];
const PLAN_ROWS: [feature: string, free: boolean][] = [
  ["Jobs, payments and customer feedback", true], ["Business coach with voice and photo input", true], ["WhatsApp and social advert drafts", true],
  ["12-month analytics dashboard", false], ["CSV and PDF progress reports", false], ["Personalised masterclass textbook (PDF)", false], ["Multi-platform campaign generator", false],
];

export function PremiumInsights({ premium = false, onUpgrade, ctaLabel = "Upgrade to Premium" }: { premium?: boolean; onUpgrade: () => void; ctaLabel?: string }) {
  return <div className="pm-landing">
    <section className="pm-hero">
      <div>
        <span className="eyebrow"><Sparkles size={14}/> BIZWISE PREMIUM</span>
        <h1>See where your business is heading. <em>Then steer it.</em></h1>
        <p>Premium turns the records you already keep into growth charts, a personalised business textbook and ready-to-post marketing campaigns. Every figure is calculated from your own saved records.</p>
        <ul className="pm-checklist">{["Know which months and services drive growth", "Spot unpaid work and weak margins early", "Get a step-by-step playbook written for your trade", "Post campaigns that sound like you"].map(item => <li key={item}><Check size={16}/>{item}</li>)}</ul>
      </div>
      <aside className="pm-price-card" aria-label="Premium pricing">
        <span className="pm-badge">Most popular</span>
        <h2>Premium</h2>
        <p className="pm-price"><strong>R99</strong><span>/ month</span></p>
        <p className="muted compact">Cancel any time. Your records stay yours on Free.</p>
        <ul className="pm-checklist">{["Full analytics dashboard", "CSV and PDF exports", "Masterclass textbook PDF", "Campaign generator", "Everything in Free"].map(item => <li key={item}><Check size={16}/>{item}</li>)}</ul>
        {premium ? <p className="pm-active"><ShieldCheck size={16}/> Premium is active</p> : <button className="primary pm-cta" onClick={onUpgrade}>{ctaLabel} <ArrowRight size={16}/></button>}
      </aside>
    </section>
    <section className="pm-feature-grid">{PREMIUM_FEATURES.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={22}/><h3>{title}</h3><p>{text}</p></article>)}</section>
    <section className="card pm-compare">
      <h3>Free and Premium compared</h3>
      <div className="report-table-wrap"><table className="report-table"><thead><tr><th scope="col">Feature</th><th scope="col">Free</th><th scope="col">Premium</th></tr></thead>
        <tbody>{PLAN_ROWS.map(([feature, free]) => <tr key={feature}><th scope="row">{feature}</th><td>{free ? <Check size={16} aria-label="Included"/> : <span aria-label="Not included">-</span>}</td><td><Check size={16} aria-label="Included"/></td></tr>)}</tbody></table></div>
      {!premium && <button className="primary" onClick={onUpgrade}>{ctaLabel} <ArrowRight size={16}/></button>}
    </section>
  </div>;
}

export function CaptureOptions({ onRecord, onCoach }: { onRecord: () => void; onCoach: () => void }) {
  return <div className="capture-options"><span>Start with what you have</span><button onClick={onRecord}>Record a job <ArrowRight size={15}/></button><button onClick={onCoach}><Mic size={16}/> Talk to your coach</button><button onClick={onCoach}><Camera size={16}/> Review a photo</button></div>;
}
