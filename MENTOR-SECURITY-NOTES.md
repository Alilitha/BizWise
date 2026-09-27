# How BizWise separates business data

Suggested explanation for the demonstration:

“We do not ask the AI to enforce privacy. Supabase verifies who is signed in. Every record query is scoped to that owner's business, and database row-level security applies the same ownership rule. A follow-up conversation must belong to that business before the server can use it. The text model receives the current question and, where needed, a topic label—not a shared pool of owners' records. Premium checks and financial calculations happen outside the model.”

## Evidence and honest limits

| Concern | Implemented control | Verification / remaining work |
| --- | --- | --- |
| One owner's data shown to another | User-token database client, owner/shop filters, RLS, parent-conversation ownership check, account-change response invalidation | Local PostgreSQL read/write isolation tests and mocked Edge tests pass. Repeat against deployed Supabase with two accounts. |
| Least privilege | Anonymous access revoked; clients have only required table operations and update columns. No client owner reassignment, deletion or evidence editing after insert. No service-role key in the frontend or adviser. | Migration tests check privileges. Apply both new migrations before release. |
| Unsubscribed access | Database checks authenticated entitlement and expiry. Blurred content contains no report data. | Active, absent and expired entitlement tests pass locally. Billing remains unconnected. |
| Incorrect AI claims | Server-calculated figures, strict topic/follow-up selection, reviewed response templates, no autonomous record changes | Malformed/invented output and future/truncated-record tests pass. Topic selection and OCR can still be wrong. |
| Bias | The same calculations and reviewed guides apply across owners. No demographic scoring or creditworthiness model. Owner can reject a suggestion. | This is bias reduction by design, not proof of fairness. Test language, accessibility and relevance with a diverse pilot group. |
| Accountability | Saved action/evidence snapshot, method and timestamp, parent reference, correction follow-up and owner-reported outcomes | Records are not independently certified audit logs. Clients can insert their own records; operator access also needs governance. |
| Privacy | Text-only by default, no automatic web search, general search query rather than private question, disclosure for voice/photo processing | Groq receives typed questions and opted-in images. Provider retention/settings need review; do not claim zero retention or automatic legal compliance. |
| Digital inclusion | Plain-language guides, optional voice/photo, keyboard controls, larger-text mode, free records and selected learning, simpler-step follow-ups | Internet is required. Offline operation and multilingual quality have not been implemented or validated. |

## Before the competition/live pilot

Apply migrations in order, deploy the adviser, test two real accounts and an expired plan, configure Auth abuse protections, rotate exposed secrets, check backups, and verify provider retention/access settings. Avoid claiming the app is “unhackable”, “bias-free”, or unable to hallucinate. Demonstrate the rejection paths instead.

The local PostgreSQL harness checks real database policy behavior against a small Auth fixture. It does not certify the live environment or constitute a penetration test.

References: [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api), [OWASP AI agent security](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html).
