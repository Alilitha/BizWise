"use client";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, CreditCard, LoaderCircle, LockKeyhole, X } from "lucide-react";
import { formatCardNumber, formatExpiry, simulateCharge, validateCard, type CardForm, type CheckoutState } from "../premium/checkout";

const EMPTY: CardForm = { name: "", number: "", expiry: "", cvv: "" };

export function PremiumCheckout({ open, onClose, onActivated }: { open: boolean; onClose: () => void; onActivated: (reference: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<CardForm>(EMPTY);
  const [state, setState] = useState<CheckoutState>({ phase: "closed" });

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) { setForm(EMPTY); setState({ phase: "editing", errors: {} }); element.showModal(); }
    if (!open && element.open) element.close();
  }, [open]);

  const close = () => { if (state.phase === "processing") return; setForm(EMPTY); onClose(); };
  const errors = state.phase === "editing" ? state.errors : {};
  const update = (field: keyof CardForm, value: string) => {
    const formatted = field === "number" ? formatCardNumber(value) : field === "expiry" ? formatExpiry(value) : field === "cvv" ? value.replace(/\D/g, "").slice(0, 4) : value.slice(0, 80);
    setForm(current => ({ ...current, [field]: formatted }));
    if (state.phase === "editing" && state.errors[field]) setState({ phase: "editing", errors: { ...state.errors, [field]: undefined } });
  };

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    const found = validateCard(form);
    if (Object.values(found).some(Boolean)) { setState({ phase: "editing", errors: found }); return; }
    setState({ phase: "processing" });
    const result = await simulateCharge(form);
    setForm(EMPTY);
    if (result.status === 200) { setState({ phase: "approved", reference: result.reference }); onActivated(result.reference); }
    else setState({ phase: "declined", message: "Your bank declined this demo payment. Try a different test card." });
  }

  const field = (key: keyof CardForm, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => <label className="pm-field">
    {label}
    <input {...props} value={form[key]} onChange={event => update(key, event.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `pm-${key}-error` : undefined} disabled={state.phase === "processing"}/>
    {errors[key] && <small id={`pm-${key}-error`} className="pm-error">{errors[key]}</small>}
  </label>;

  return <dialog ref={dialog} className="pm-dialog" onCancel={event => { event.preventDefault(); close(); }} aria-labelledby="pm-checkout-title">
    <div className="pm-dialog-head">
      <div><span className="eyebrow"><LockKeyhole size={13}/> DEMO CHECKOUT</span><h2 id="pm-checkout-title">Upgrade to Premium</h2></div>
      <button type="button" className="pm-icon-button" onClick={close} aria-label="Close checkout" disabled={state.phase === "processing"}><X size={18}/></button>
    </div>
    {state.phase === "approved" ? <div className="pm-success" role="status">
      <BadgeCheck size={44}/><h3>Premium is active</h3>
      <p>Payment approved. Reference {state.reference}. Your analytics, masterclass textbook and campaign generator are unlocked.</p>
      <button className="primary" onClick={close}>Start exploring</button>
    </div> : <form onSubmit={pay} noValidate className="pm-card-form">
      <div className="pm-order"><span>BizWise Premium, monthly</span><strong>R99.00</strong></div>
      {field("name", "Cardholder name", { autoComplete: "off", placeholder: "Name on card" })}
      {field("number", "Card number", { inputMode: "numeric", autoComplete: "off", placeholder: "4242 4242 4242 4242" })}
      <div className="pm-split">
        {field("expiry", "Expiry date", { inputMode: "numeric", autoComplete: "off", placeholder: "MM/YY" })}
        {field("cvv", "CVV", { inputMode: "numeric", autoComplete: "off", placeholder: "123" })}
      </div>
      {state.phase === "declined" && <p className="notice error" role="alert">{state.message}</p>}
      <button className="primary pm-pay" type="submit" disabled={state.phase === "processing"}>
        {state.phase === "processing" ? <><LoaderCircle className="pm-spin" size={18}/> Processing payment…</> : <><CreditCard size={18}/> Pay R99.00</>}
      </button>
      <p className="muted compact">Demo mode. No money is charged and card details never leave this browser. Use test card 4242 4242 4242 4242 to approve or 4000 0000 0000 0002 to see a decline. Premium unlocked here applies to this browser only; a real subscription is activated by BizWise after billing.</p>
    </form>}
  </dialog>;
}
