"use client";

import { useId, useState } from 'react';
import { calculatePractice, practiceToolForAnswer } from '../adviser/practice';

export function PracticeTool({ answer }: { answer: string }) {
  const tool = practiceToolForAnswer(answer);
  if (!tool) return null;
  return <Worksheet key={answer} tool={tool}/>;
}

function Worksheet({ tool }: { tool: NonNullable<ReturnType<typeof practiceToolForAnswer>> }) {
  const id = useId();
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [checked, setChecked] = useState<number[]>([]);
  const checklist = tool === 'Record checklist' ? [
    'I matched the date and service to the receipt.',
    'I checked the charge and known direct costs.',
    'I recorded money received separately from the charge.',
    'I checked for duplicate entries before saving.',
  ] : tool === 'Feedback checklist' ? [
    'I asked a neutral question and explained its purpose.',
    'I recorded the customer’s meaning without unnecessary personal details.',
    'I kept negative feedback as well as positive feedback.',
    'I chose one small improvement to test.',
  ] : null;
  const labels = tool === 'Payment balance worksheet' ? ['Job charge (R)', 'Confirmed payments (R)']
    : tool === 'Direct-cost worksheet' ? ['Job charge (R)', 'Total direct costs (R)'] : ['Enquiries', 'Bookings from those enquiries'];
  const result = calculatePractice(tool, first, second);
  return <section className="practice-tool" aria-labelledby={`${id}-title`}>
    <div className="practice-tool-heading"><span className="eyebrow">Try it yourself</span><h4 id={`${id}-title`}>{tool}</h4></div>
    <p>Practice only. Inputs are not saved, sent to the AI, or added to your business records.</p>
    {checklist ? <fieldset><legend>Check each step you have completed</legend>{checklist.map((item, index) => <label key={item} className="practice-check"><input type="checkbox" checked={checked.includes(index)} onChange={event => setChecked(current => event.target.checked ? [...current, index] : current.filter(value => value !== index))}/><span>{item}</span></label>)}<p role="status">{checked.length} of {checklist.length} steps checked.</p></fieldset>
      : <><div className="practice-inputs">{labels.map((label, index) => <label key={label} htmlFor={`${id}-${index}`}>{label}<input id={`${id}-${index}`} inputMode={tool === 'Enquiry-to-booking worksheet' ? 'numeric' : 'decimal'} autoComplete="off" value={index === 0 ? first : second} onChange={event => (index === 0 ? setFirst : setSecond)(event.target.value)} placeholder="Enter a checked figure" maxLength={16}/></label>)}</div><output aria-live="polite" className="practice-result">{result}</output><button className="ghost" type="button" onClick={() => { setFirst(''); setSecond(''); }}>Clear practice figures</button></>}
  </section>;
}
