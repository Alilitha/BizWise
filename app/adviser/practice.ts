export const practiceTools = ['Record checklist', 'Payment balance worksheet', 'Direct-cost worksheet', 'Feedback checklist', 'Enquiry-to-booking worksheet'] as const;
export type PracticeToolName = typeof practiceTools[number];

// Match the saved reviewed lesson. Do not infer a skill from personal characteristics.
export function practiceToolForAnswer(answer: string): PracticeToolName | undefined {
  const sections = answer.split('\n\n');
  const index = sections.indexOf('TOOL TO USE');
  return index >= 0 ? practiceTools.find(tool => tool === sections[index + 1]) : undefined;
}

export function calculatePractice(tool: PracticeToolName, first: string, second: string): string {
  if (!first.trim() || !second.trim()) return 'Enter both checked figures to see the calculation. Missing information is not zero.';
  const isCount = tool === 'Enquiry-to-booking worksheet';
  const pattern = isCount ? /^\d+$/ : /^\d+(\.\d{1,2})?$/;
  if (![first.trim(), second.trim()].every(value => pattern.test(value))) return isCount ? 'Use whole, non-negative counts.' : 'Use non-negative amounts with at most two decimal places, for example 1250.50.';
  const a = Number(first), b = Number(second);
  if (![a, b].every(value => Number.isFinite(value) && value <= 1_000_000_000)) return 'Use figures no larger than 1,000,000,000.';
  const money = (cents: number) => `R ${(cents / 100).toFixed(2)}`;
  if (tool === 'Payment balance worksheet' || tool === 'Direct-cost worksheet') {
    const ac = Math.round(a * 100), bc = Math.round(b * 100), difference = ac - bc;
    if (tool === 'Payment balance worksheet') return `${money(ac)} − ${money(bc)} = ${money(difference)}. ${difference < 0 ? 'Payments exceed the charge. Investigate the credit before contacting the customer.' : difference === 0 ? 'These practice figures balance.' : 'This is a practice balance; confirm the saved payment history before collecting it.'}`;
    return `${money(ac)} − ${money(bc)} = ${money(difference)} after direct costs. ${ac === 0 ? 'Margin is undefined when the charge is zero.' : `Contribution margin: (${money(difference)} ÷ ${money(ac)}) × 100 = ${(difference / ac * 100).toFixed(1)}%.`} This is not net profit; overheads and other costs may be missing.`;
  }
  if (tool === 'Enquiry-to-booking worksheet') {
    if (b > a) return 'Bookings exceed enquiries. Check that both counts cover the same group and period.';
    if (a === 0) return 'There are no enquiries, so a conversion percentage cannot be calculated.';
    return `${b} ÷ ${a} × 100 = ${(b / a * 100).toFixed(1)}% enquiry-to-booking conversion. This does not establish what caused those bookings or predict future results.`;
  }
  return '';
}
