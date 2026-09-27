"use client";
import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ThumbsDown, ThumbsUp } from "lucide-react";

const TAGS = [["inaccurate", "Figures or facts are wrong"], ["not_relevant", "Not relevant to my business"], ["unclear", "Hard to understand"], ["unsafe", "Unsafe or inappropriate"]] as const;
type State = "asking" | "why" | "saving" | "thanks" | "failed";

// Only the topic label, rating and reason are stored; not the question or answer text.
export function AnswerFeedback({ db, topic }: { db: SupabaseClient; topic: string }) {
  const [state, setState] = useState<State>("asking");
  async function send(rating: 1 | -1, tag: string) {
    setState("saving");
    const result = await db.from("ai_feedback").insert({ topic: topic.slice(0, 40), rating, tag });
    setState(result.error ? "failed" : "thanks");
  }
  if (state === "thanks") return <p className="pm-rate muted compact" role="status">Thank you. Your rating helps us find weak answers.</p>;
  return <div className="pm-rate">
    <span className="compact">Was this answer useful?</span>
    <button className="ghost" disabled={state === "saving"} onClick={() => send(1, "helpful")} aria-label="Useful"><ThumbsUp size={15}/></button>
    <button className="ghost" disabled={state === "saving"} onClick={() => setState("why")} aria-label="Not useful" aria-expanded={state === "why"}><ThumbsDown size={15}/></button>
    {state === "why" && <div className="pm-rate-tags">{TAGS.map(([tag, label]) => <button key={tag} className="ghost" onClick={() => send(-1, tag)}>{label}</button>)}</div>}
    {state === "failed" && <span className="compact" role="alert">Rating not saved. Try again later.</span>}
  </div>;
}
