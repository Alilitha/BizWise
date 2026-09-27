export type CardForm = { name: string; number: string; expiry: string; cvv: string };
export type CardErrors = Partial<Record<keyof CardForm, string>>;
export type CheckoutState =
  | { phase: 'closed' }
  | { phase: 'editing'; errors: CardErrors }
  | { phase: 'processing' }
  | { phase: 'declined'; message: string }
  | { phase: 'approved'; reference: string };

export const digitsOnly = (value: string) => value.replace(/\D/g, '');
export const formatCardNumber = (value: string) => digitsOnly(value).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
export const formatExpiry = (value: string) => {
  const digits = digitsOnly(value).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};

export function luhnValid(number: string): boolean {
  const digits = digitsOnly(number);
  if (digits.length < 12 || digits.length > 19) return false;
  let total = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
    total += digit;
  }
  return total % 10 === 0;
}

export function validateCard(form: CardForm, now = new Date()): CardErrors {
  const errors: CardErrors = {};
  if (form.name.trim().length < 2 || !/^[\p{L}' .-]+$/u.test(form.name.trim())) errors.name = 'Enter the name shown on the card.';
  if (!luhnValid(form.number)) errors.number = 'Enter a valid card number.';
  const expiry = /^(\d{2})\/(\d{2})$/.exec(form.expiry);
  const month = expiry ? Number(expiry[1]) : 0;
  if (!expiry || month < 1 || month > 12) errors.expiry = 'Use MM/YY.';
  else if (new Date(Date.UTC(2000 + Number(expiry[2]), month, 1)) <= now) errors.expiry = 'This card has expired.';
  const amex = /^3[47]/.test(digitsOnly(form.number));
  if (!(amex ? /^\d{4}$/ : /^\d{3}$/).test(form.cvv)) errors.cvv = `Enter the ${amex ? 4 : 3}-digit security code.`;
  return errors;
}

// Simulated gateway: card details never leave the browser. 4000 0000 0000 0002 declines, as on common test gateways.
export async function simulateCharge(form: CardForm, wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))): Promise<{ status: 200 | 402; reference: string }> {
  await wait(1400);
  const declined = digitsOnly(form.number) === '4000000000000002';
  return { status: declined ? 402 : 200, reference: `DEMO-${Date.now().toString(36).toUpperCase()}` };
}
