// The model selects a topic. It cannot author financial facts or business diagnoses.
export const coachTopics = ['records', 'payments', 'costs', 'feedback', 'marketing', 'unknown'] as const;
export type CoachTopic = typeof coachTopics[number];
// Reviewed teaching material, not provider-generated tool claims or prices.
export function digitalSkillsTraining(topic: CoachTopic): string {
  if (topic === 'unknown') return 'CHOOSE YOUR TRAINING\n\nTell me what you need to do: keep records, check payments, understand costs, collect feedback or promote a service. I need that context before choosing a skill or tool.';
  const guide = {
    records: {
      skill: 'Digital record keeping: distinguish a job, its direct costs and a payment.',
      tool: 'Record checklist',
      steps: 'Open Jobs & payments. Use a receipt to enter one job: date, service, amount charged and known direct costs. Add the payment separately only when money was received. Check the saved entry against the receipt.',
      exercise: 'Use the checklist below with one receipt. An unchecked item means “not checked yet”, not zero. Do not fill gaps with estimates presented as facts.',
      measure: 'Count how many receipts match saved entries, then resolve each mismatch. Aim for a complete match for the receipts you reviewed.',
      offline: 'Write the same fields in a notebook when offline. Enter each record once when connected; check for an existing entry first.',
    },
    payments: {
      skill: 'Payment reconciliation: match money received to the correct job before following up.',
      tool: 'Payment balance worksheet',
      steps: 'Open a job in Jobs & payments. Compare its agreed charge with receipts for payments against that job. Use the worksheet below to practise calculating the balance, then correct the saved records if needed.',
      exercise: 'Enter the charge and total confirmed payments for one job. Balance = charge minus payments. A negative result is a credit to investigate, not another amount to collect.',
      measure: 'Check that your worksheet result matches that job’s saved payment history. Only send a private reminder after resolving discrepancies.',
      offline: 'Keep a paper payment log with date, job reference and amount. Reconcile it with BizWise when connected.',
    },
    costs: {
      skill: 'Basic costing: calculate what remains after direct costs and distinguish it from net profit.',
      tool: 'Direct-cost worksheet',
      steps: 'Find the charge and materials/direct-cost receipts for one completed job. Enter them below, review the calculation, then update that job in Jobs & payments if its records are incomplete.',
      exercise: 'Enter the charge and total direct costs. Contribution = charge minus direct costs. Contribution margin = contribution divided by charge × 100. A zero charge has no defined margin.',
      measure: 'Match every input to a record. Before deciding a price, separately account for overheads, your time and other missing costs; this worksheet does not establish net profit.',
      offline: 'Use a calculator and paper with columns for charge, materials and other direct costs. Keep the supporting receipts.',
    },
    feedback: {
      skill: 'Digital feedback collection: ask a neutral question and separate observations from conclusions.',
      tool: 'Feedback checklist',
      steps: 'Ask “What worked well, and what could we improve?” Use Customer feedback to record the response. Ask customers consistently rather than selecting only those likely to praise you.',
      exercise: 'Use the checklist below before recording one response. Choose one improvement to test and record what later customers say without claiming that a small sample represents everyone.',
      measure: 'Track the number of people asked and the number who responded over the same period. Record mixed and negative feedback as well as positive feedback.',
      offline: 'Ask verbally or use a short paper form. Explain why you are collecting feedback and enter only the information you need when connected.',
    },
    marketing: {
      skill: 'Digital campaign measurement: turn a confirmed offer into a message and track enquiries separately from bookings.',
      tool: 'Enquiry-to-booking worksheet',
      steps: 'In Marketing, choose a saved service and an offer you can honour. Review the generated wording before copying it to a channel your customers use. In Actions & results, record enquiries and bookings for the same offer and period.',
      exercise: 'Enter enquiries and resulting bookings from one campaign and period. Conversion = bookings divided by enquiries × 100. Use the same group of enquiries; do not combine unrelated bookings.',
      measure: 'Record the channel and dates with the result. Compare like-for-like periods cautiously; the result does not prove the message caused a sale or predict future demand.',
      offline: 'Record enquiries in a notebook or by phone. Paid advertising and a new software subscription are not required for this exercise.',
    },
  }[topic];
  return ['DIGITAL SKILL TO LEARN', guide.skill, 'TOOL TO USE', guide.tool,
    'GUIDED PRACTICE', guide.steps, guide.exercise, 'CHECK YOUR LEARNING', guide.measure,
    'LOW-DATA OPTION', guide.offline, 'KEEP YOUR DATA PRIVATE',
    'Use job references instead of customer names in practice tools. Do not paste passwords, identity numbers or banking details into the chat. Practice inputs below stay on this page and do not update business records.',
    'TRAINING FOLLOW-UP', 'Tell me which step is difficult, which tool you can access, or what result you got. We can work through the next step together.'].join('\n\n');
}
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
  return replies[kind] + '\n\n' + digitalSkillsTraining(topic);
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
    digitalSkillsTraining(topic),
    'YOUR TURN', 'Does this step fit your situation? You can ask why, choose a smaller step, correct the suggestion or come back with your result.',
  ].filter(Boolean).join('\n\n');
}
