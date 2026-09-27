// The model selects a topic. It cannot author financial facts or business diagnoses.
export const coachTopics = ['records', 'payments', 'costs', 'feedback', 'marketing', 'unknown'] as const;
export type CoachTopic = typeof coachTopics[number];
export const followUpKinds = ['explain', 'small_step', 'outcome', 'correction'] as const;
export type FollowUpKind = typeof followUpKinds[number];
export function parseFollowUp(raw: string): FollowUpKind | undefined {
  try {
    const value = JSON.parse(raw);
    if (value && Object.keys(value).length === 1 && followUpKinds.includes(value.follow_up)) return value.follow_up;
  } catch { /* Never display arbitrary provider text. */ }
  return undefined;
}
export function followUpAnswer(topic: CoachTopic, kind: FollowUpKind): string {
  const nextStep = {
    records: 'Choose one completed service. Find the receipt and record the date and amount. You can add the direct costs when you have the supporting receipt.',
    payments: 'Open one unpaid job. Compare its charge with the payments already recorded. Do not contact anyone until that balance is correct.',
    costs: 'Choose one completed job and find one receipt for materials used. Enter that cost against the job before estimating what is left.',
    feedback: 'Ask one customer: “What is one thing we could do better?” Record their answer without their phone number or other unnecessary personal details.',
    marketing: 'Choose one service you can deliver and write one offer you can honour. You can share it through a channel your customers already use; paid advertising is not required.',
    unknown: 'Choose the area you want help with: records, payments, costs, feedback or marketing. You do not need technical terms.',
  }[topic];
  const replies = {
    explain: `WHY THIS STEP\n\nThe guide was selected for the topic of your question, not because we have proved a problem or predicted an outcome. Figures come from your saved records. Missing records can change the picture.\n\nLET US CHECK IT\n\n${nextStep}\n\nYOUR TURN\n\nDoes this match what is happening in your business? If not, choose “This does not fit” and describe what is different.`,
    small_step: `START SMALL\n\n${nextStep}\n\nYOUR TURN\n\nCan you do this with the records and tools you already have? If you are stuck, tell me what is missing.`,
    outcome: 'REVIEW THE RESULT\n\nWhat did you try, what happened, and over what period? Compare the result with your original record. A change after an action does not prove the action caused it.\n\nRECORD IT\n\nUse Actions & results to enter enquiries, bookings or your own notes against the original action. Money received belongs in Jobs & payments. This conversation does not change either automatically.\n\nYOUR TURN\n\nWhat happened when you tried the step? Avoid customer names or contact details.',
    correction: 'THANK YOU FOR CORRECTING THAT\n\nTreat the previous suggestion as unsuitable until you have checked it. No score or decision about your business is made from your correction.\n\nWHAT SHOULD CHANGE?\n\nTell me whether the figures are wrong, the topic is wrong, or the step is impractical. Correct incorrect job/payment records at their source. For an unsuitable topic, start a new question in your own words.\n\nYOUR TURN\n\nWhat does not fit your situation?',
  };
  return replies[kind];
}
export function parseCoachTopic(raw: string): CoachTopic {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Object.keys(parsed).length === 1 && coachTopics.includes(parsed.focus)) return parsed.focus;
  } catch { /* Fail closed to an explicit limitation, never show raw model output. */ }
  return 'unknown';
}
export function groundedAnswer(topic: CoachTopic, facts: {
  jobs: number; charged: number; costs: number; outstanding: number; feedback: number;
}, research: boolean, sourceCount: number, hasImage: boolean): string {
  const money = (n: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n);
  const lessons = {
    records: ['Keep a daily business record', 'Record the service, date, charge and direct cost. Record payments separately so a sale is not mistaken for cash received.', 'Record one completed service and check it against your original receipt.', 'Compare your recorded jobs with your receipts at the end of the week.'],
    payments: ['Follow up on payments', 'A job charge and money received are different. Check the original agreement and payments before sending a reminder.', 'Review Jobs & payments. If an amount is still due, confirm it with the customer privately.', 'Record any payment received and review the remaining balance.'],
    costs: ['Understand what a service leaves over', 'Subtract direct costs from the amount charged. This does not give net profit: rent, wages, tax and other overheads may still be missing.', 'Check the direct costs for a completed job against receipts and correct missing entries.', 'Compare the recorded charge and direct cost for that job.'],
    feedback: ['Turn feedback into a small experiment', 'Ask what worked and what could improve. A few comments can suggest a change, but cannot establish a retention rate or a market trend.', 'Ask a customer for feedback and record their response with the relevant job.', 'Try one service improvement and record feedback from the next customer.'],
    marketing: ['Make a clear customer offer', 'Use a saved service and an offer you can honour. Avoid invented discounts, testimonials or claims of guaranteed results.', 'Confirm the offer, then create and review a customer advert in Visibility.', 'Record enquiries and bookings in Actions & results. These are owner-reported outcomes, not proof the advert caused them.'],
    unknown: ['Start with evidence', 'This coach currently supports records, payment follow-up, direct costs, feedback and customer offers. Your question could not be safely matched to one of these topics.', 'Ask a specific question about one of those areas, or record the missing information first.', 'Check the relevant record before making a decision.'],
  }[topic];
  return [
    'WHAT YOUR RECORDS SHOW',
    `All recorded completed jobs through today: ${facts.jobs}. Amount charged: ${money(facts.charged)}. Recorded direct costs: ${money(facts.costs)}. Outstanding on those jobs: ${money(facts.outstanding)}. Customer feedback responses: ${facts.feedback}.`,
    facts.jobs === 0 ? 'There are no completed jobs to assess. No growth or performance conclusion can be drawn.' : 'These totals describe your saved records; they do not establish causes, growth or future demand.',
    'SKILL TO PRACTISE', lessons[0], lessons[1], 'ONE NEXT ACTION', lessons[2], 'HOW TO MEASURE IT', lessons[3],
    'WHAT IS STILL UNKNOWN',
    'Missing records and overhead costs affect the picture. Customer retention cannot be calculated from the current inputs. This is a guided next step, not a verified diagnosis or a forecast.',
    research ? `Public research returned ${sourceCount} source excerpts. Review the separate sources for location and date; they are not verified business facts or evidence of local demand.` : 'No public web research was used.',
    hasImage ? 'Image transcription is unverified. Check every figure against the original; it is excluded from these calculations.' : '',
    'YOUR TURN', 'Does this step fit your situation? You can ask why, choose a smaller step, correct the suggestion or come back with your result.',
  ].filter(Boolean).join('\n\n');
}
