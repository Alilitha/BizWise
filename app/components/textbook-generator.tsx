"use client";
import { useState } from "react";
import { BookOpenText, Download, LoaderCircle } from "lucide-react";
import { CoachRequestError, requestTextbook } from "../adviser/request";
import type { Textbook } from "../adviser/shared";
import type { BusinessMetrics } from "../premium/metrics";
import { downloadTextbook } from "../premium/pdf";

export type Authorize = () => Promise<{ url: string; key: string; token: string; origin: string }>;
type Status = { phase: "idle" } | { phase: "writing" } | { phase: "ready"; book: Textbook } | { phase: "failed"; message: string };

export function TextbookGenerator({ shopName, defaultType, metrics, authorize }: { shopName: string; defaultType: string; metrics: BusinessMetrics; authorize: Authorize }) {
  const [businessType, setBusinessType] = useState(defaultType);
  const [stage, setStage] = useState("growing");
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const [saving, setSaving] = useState(false);

  async function write() {
    setStatus({ phase: "writing" });
    try {
      const book = await requestTextbook({ ...(await authorize()), body: { business_type: businessType.trim(), stage } });
      setStatus({ phase: "ready", book });
    } catch (error) {
      setStatus({ phase: "failed", message: error instanceof CoachRequestError ? error.message : "The textbook could not be prepared. Please try again." });
    }
  }

  return <section className="card pm-textbook">
    <div className="section-heading"><div><span className="eyebrow"><BookOpenText size={14}/> AI BUSINESS ADVISER</span><h2>Your personalised masterclass textbook</h2></div></div>
    <p className="muted">A structured PDF written for your business type, services, town and size: business model canvas, strategy and risk, scaling and unit economics, and daily checklists. Your figures are added from your records as an appendix; the AI never sees them.</p>
    <div className="pm-split">
      <label>Business type<input value={businessType} maxLength={80} onChange={event => setBusinessType(event.target.value)} placeholder="For example: Hair salon, mobile mechanic"/></label>
      <label>Stage<select value={stage} onChange={event => setStage(event.target.value)}><option value="starting">Just starting</option><option value="growing">Growing</option><option value="established">Established</option></select></label>
    </div>
    <div className="actions">
      <button className="primary" disabled={status.phase === "writing" || businessType.trim().length < 3} onClick={write}>{status.phase === "writing" ? <><LoaderCircle className="pm-spin" size={16}/> Writing your textbook… (up to a minute)</> : status.phase === "ready" ? "Write a new edition" : "Generate my textbook"}</button>
      {status.phase === "ready" && <button className="dark" disabled={saving} onClick={async () => { setSaving(true); try { await downloadTextbook(shopName, status.book, metrics); } finally { setSaving(false); } }}><Download size={16}/> {saving ? "Preparing PDF…" : "Download PDF"}</button>}
    </div>
    {status.phase === "failed" && <p className="notice error" role="alert">{status.message}</p>}
    {status.phase === "ready" && <div className="pm-toc"><h3>{status.book.title}</h3><ol>{status.book.chapters.map(chapter => <li key={chapter.title}><strong>{chapter.title}</strong><span>{chapter.sections.map(section => section.heading).join(" · ")}</span></li>)}<li><strong>Appendix. Your records at a glance</strong><span>Calculated from saved records</span></li></ol><p className="muted compact">AI-drafted education. Review before acting; consult a qualified professional for legal, tax or financing decisions.</p></div>}
  </section>;
}
