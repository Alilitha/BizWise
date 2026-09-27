"use client";
import { useState } from "react";
import { Check, Copy, LoaderCircle, LockKeyhole, Megaphone, Users } from "lucide-react";
import { CoachRequestError, requestCampaign } from "../adviser/request";
import type { Campaign, Platform } from "../adviser/shared";
import type { Authorize } from "./textbook-generator";

const PLATFORMS: { key: Platform; label: string }[] = [{ key: "linkedin", label: "LinkedIn" }, { key: "instagram", label: "Instagram" }, { key: "x", label: "X / Twitter" }, { key: "facebook", label: "Facebook" }];
type Status = { phase: "idle" } | { phase: "writing" } | { phase: "ready"; campaign: Campaign } | { phase: "failed"; message: string };

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" className="ghost pm-copy" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setCopied(false); } }}>{copied ? <Check size={14}/> : <Copy size={14}/>}{copied ? "Copied" : "Copy"}</button>;
}

export function MarketingGenerator({ services, premium, onUpgrade, authorize }: { services: string[]; premium: boolean; onUpgrade: () => void; authorize: Authorize }) {
  const [goal, setGoal] = useState("");
  const [service, setService] = useState("");
  const [offer, setOffer] = useState("");
  const [audience, setAudience] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>(["instagram", "facebook"]);
  const [status, setStatus] = useState<Status>({ phase: "idle" });

  if (!premium) return <section className="card full pm-locked-feature">
    <LockKeyhole size={24}/><div><span className="eyebrow">PREMIUM</span><h2>Strategic campaign generator</h2><p className="muted">Platform-specific copy for LinkedIn, Instagram, X and Facebook, organised hashtag clusters, buyer personas, accounts to engage and calls to action.</p></div>
    <button className="primary" onClick={onUpgrade}>Upgrade to Premium</button>
  </section>;

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    setStatus({ phase: "writing" });
    try {
      setStatus({ phase: "ready", campaign: await requestCampaign({ ...(await authorize()), body: { campaign_goal: goal, service, offer, audience, platforms } }) });
    } catch (error) {
      setStatus({ phase: "failed", message: error instanceof CoachRequestError ? error.message : "The campaign could not be prepared. Please try again." });
    }
  }

  return <section className="card full pm-campaign">
    <span className="eyebrow"><Megaphone size={14}/> STRATEGIC MARKETING ENGINE</span><h2>Build a social media campaign</h2>
    <form onSubmit={generate} className="pm-campaign-form">
      <label>Campaign goal<input value={goal} maxLength={200} onChange={event => setGoal(event.target.value)} placeholder="For example: fill weekday bookings in October" required/></label>
      <div className="pm-split">
        <label>Service to promote<select value={service} onChange={event => setService(event.target.value)}><option value="">Whole business</option>{services.map(name => <option key={name}>{name}</option>)}</select></label>
        <label>Offer you can honour (optional)<input value={offer} maxLength={200} onChange={event => setOffer(event.target.value)} placeholder="For example: free check with every service"/></label>
      </div>
      <label>Who are you trying to reach? (optional)<input value={audience} maxLength={200} onChange={event => setAudience(event.target.value)} placeholder="For example: commuters and small fleet owners"/></label>
      <fieldset className="pm-platforms"><legend>Platforms</legend>{PLATFORMS.map(platform => <label key={platform.key} className="research-toggle"><input type="checkbox" checked={platforms.includes(platform.key)} onChange={event => setPlatforms(current => event.target.checked ? [...current, platform.key] : current.filter(item => item !== platform.key))}/> {platform.label}</label>)}</fieldset>
      <button className="primary" disabled={status.phase === "writing" || goal.trim().length < 5 || !platforms.length}>{status.phase === "writing" ? <><LoaderCircle className="pm-spin" size={16}/> Writing your campaign…</> : "Generate campaign"}</button>
    </form>
    <p className="muted compact">Sends your goal, chosen service, offer, audience notes, services list and town to Groq. No customer or financial records are sent. Review every post before publishing; the AI cannot see live trends or verify claims.</p>
    {status.phase === "failed" && <p className="notice error" role="alert">{status.message}</p>}
    {status.phase === "ready" && <div className="pm-campaign-output">
      <div className="pm-posts">{status.campaign.posts.map(post => <article key={post.platform} className="pm-post">
        <div className="section-heading"><h3>{PLATFORMS.find(item => item.key === post.platform)?.label}</h3><CopyButton text={`${post.copy}\n\n${post.cta}`}/></div>
        <p>{post.copy}</p><p className="pm-cta"><strong>Call to action:</strong> {post.cta}</p>
        {post.platform === "x" && <small className="muted">{post.copy.length} / 280 characters</small>}
      </article>)}</div>
      <div className="pm-two">
        <article className="pm-hashtags"><div className="section-heading"><h3>Hashtag strategy</h3><CopyButton text={[...status.campaign.hashtags.niche, ...status.campaign.hashtags.local, ...status.campaign.hashtags.broad].join(" ")}/></div>
          {(["niche", "local", "broad"] as const).map(group => <div key={group}><h4>{group === "niche" ? "Niche: specific to your service" : group === "local" ? "Local: your area" : "Broad: wider reach"}</h4><p className="hashtags">{status.campaign.hashtags[group].join(" ")}</p></div>)}
          <p className="muted compact">Check current volume in each platform's search before posting. These are suggestions, not live trend data.</p>
        </article>
        <article><h3><Users size={17}/> Target audience</h3>{status.campaign.personas.map(persona => <div key={persona.name} className="pm-persona"><strong>{persona.name}</strong><p>{persona.profile}</p><small className="muted">Where to reach them: {persona.where}</small></div>)}
          <h4>Accounts worth engaging or tagging</h4><ul>{status.campaign.tag_categories.map(category => <li key={category}>{category}</li>)}</ul>
        </article>
      </div>
    </div>}
  </section>;
}
