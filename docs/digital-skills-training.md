# Adviser digital skills training

The reviewed adviser responses now teach a skill for the selected topic: record keeping, payment reconciliation, direct costing, feedback collection or marketing measurement. Each includes instructions using existing BizWise screens, an exercise, a success check, a low-data/paper alternative and privacy guidance. Unsupported questions ask for clarification rather than inventing a training plan.

The response text includes the lesson and exact worksheet title. The existing `adviser_actions.recommendation` save path therefore keeps the teaching content with that recommendation. The UI renders an interactive checklist or calculator from that saved title, including earlier turns shown in the current conversation. Practice inputs are ephemeral React state: they are not sent to Groq, stored in browser storage, or written to Supabase. Real records must still be entered explicitly through the existing business forms.

Money worksheets calculate using integer cents and label contribution as distinct from net profit. Empty inputs remain unknown; a zero denominator has no percentage. Payment credits and bookings exceeding enquiries are flagged for review. These safeguards concern the practice tools and do not certify the completeness or correctness of the owner's underlying records.

The follow-up textarea sits below the response and uses the existing authenticated parent-action conversation flow. Failed requests retain the typed question. Reviewed teaching content is deterministic; Groq still selects the supported topic, so a mistaken topic selection remains possible and the owner can correct it.

Deployment: deploy the updated Supabase `adviser` Edge Function alongside the frontend. No new package, migration or environment variable is needed for this training change. Local tests mock external services; they do not prove production connectivity. This change does not implement the separate response-specific premium chart/report/PDF persistence redesign, which must be completed independently.
