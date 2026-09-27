"use client";
import { ArrowRight, MessageSquareText } from 'lucide-react';

export type ConversationTurn = { question: string; answer: string };
const headings = new Set(['WHAT YOUR RECORDS SHOW', 'SKILL TO PRACTISE', 'ONE NEXT ACTION', 'HOW TO MEASURE IT', 'WHAT IS STILL UNKNOWN', 'YOUR TURN', 'WHY THIS STEP', 'LET US CHECK IT', 'START SMALL', 'REVIEW THE RESULT', 'RECORD IT', 'THANK YOU FOR CORRECTING THAT', 'WHAT SHOULD CHANGE?']);

export function CoachResponse({ answer }: { answer: string }) {
  return <div className="coach-response">{answer.split('\n\n').map((part, index) => headings.has(part) ? <h3 key={index} className={part === 'ONE NEXT ACTION' || part === 'START SMALL' ? 'response-action-title' : ''}>{part.toLowerCase()}</h3> : <p key={index}>{part}</p>)}</div>;
}

export function CoachConversation({ turns, busy, canContinue, onFollowUp, onReset }: {
  turns: ConversationTurn[]; busy: boolean; canContinue: boolean;
  onFollowUp: (kind: string, question: string) => void; onReset: () => void;
}) {
  return <section className="conversation-tools" aria-label="Continue your coaching conversation">
    {turns.length > 1 && <details className="conversation-history"><summary>Earlier in this conversation ({turns.length - 1})</summary>{turns.slice(0, -1).map((turn,index)=><article key={index}><p className="conversation-question"><MessageSquareText size={15}/>{turn.question}</p><CoachResponse answer={turn.answer}/></article>)}</details>}
    <h3>Let’s work through it</h3><p>Choose a follow-up, or type your next question in the question box. Your records are never changed by this conversation.</p>
    <div className="follow-up-options">{[
      ['explain', 'Why this step?'], ['small_step', 'Make it simpler'], ['outcome', 'I tried it. What next?'], ['correction', 'This does not fit'],
    ].map(([kind,label])=><button key={kind} className="ghost" disabled={busy || !canContinue} onClick={()=>onFollowUp(kind,label)}>{label}<ArrowRight size={14}/></button>)}</div>
    {!canContinue && <p className="compact">Save this recommendation first. Image observations need your review before the conversation can continue.</p>}
    <button className="conversation-reset" disabled={busy} onClick={onReset}>Start a new conversation</button>
  </section>;
}
