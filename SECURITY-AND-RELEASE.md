# BizWise: release requirements and security boundaries

## Required deployment order

1. Apply `supabase/migrations/20260926_security_and_premium.sql` after the original migration, followed by `20260927_least_privilege.sql`. They add learning completion, owner-readable entitlements, atomic per-account quotas, Premium reports and column-level client privileges. Then apply `20260928_telemetry_and_admin.sql`, which adds AI telemetry, answer ratings and the admin summary. Test this first in a staging Supabase project.
2. Deploy the updated adviser function, including `grounding.ts` and `generators.ts`. Optionally set `GROQ_WRITER_MODEL` (default `openai/gpt-oss-120b`) for the textbook and campaign writer. The coach intentionally returns 503 if the quota function is missing or fails. Limits are five requests per rolling minute window and fifty per rolling 24-hour window. There is no in-memory fallback.
3. Build and deploy the frontend. Existing records remain in their existing tables.
4. Verify isolation with two real accounts before releasing. The automated tests mock Supabase; they do not prove deployed RLS or SQL execution.

## Premium

Only a trusted administrator or a future verified billing webhook may insert or update `business_entitlements`. Browser roles have SELECT access to their own row only. The `premium_insights()` function checks the current user and expiry on every call; neither a URL parameter nor a browser toggle grants access. Sponsored access uses the same entitlement boundary. A loaded report is a snapshot; refresh checks access again.

Payment collection is not implemented. The Upgrade button opens a demo checkout: it validates the card fields in the browser, simulates a gateway (4242 4242 4242 4242 approves, 4000 0000 0000 0002 declines) and sends no card data anywhere. An approved demo payment unlocks Premium screens for that account in that browser only, stored in localStorage. It never writes `business_entitlements`, so it cannot grant a real subscription. Present it as a demo, not a working checkout. A real billing webhook must write the entitlement server-side.

The Premium dashboard, CSV and PDF exports are calculated in the browser from the owner's own records, which they can already read on Free. The gate controls the Premium screens, not access to data; this feature gate is not DRM over their data. The textbook and campaign generator call the model through the adviser function and are covered by the same per-account quota as coaching.

Grant an administrator from the SQL editor: `insert into public.platform_admins(user_id) values ('<auth user id>');`. The Admin monitoring tab appears only when `is_platform_admin()` returns true, and `admin_telemetry()` checks it again server-side.

## AI boundaries

Premium writer update: the textbook and campaign goals are the one place the model writes displayed prose. It receives a business profile (type, stage, service names, town, size band) and, for campaigns, the owner's goal, offer and audience notes. It never receives figures, customers, payments or feedback. Its JSON is parsed strictly: textbook chapter titles are fixed server-side, every field is length-capped and control characters are stripped, and a reply missing a chapter, canvas block or requested platform is rejected. The prompt forbids invented statistics, testimonials, prices and guarantees, but this is an instruction, not a guarantee; the UI labels the output as AI-drafted and to be reviewed. Record figures in the PDF appendix are calculated in the browser.

Telemetry stores feature, topic label, status, latency and token count per request, plus optional thumbs up/down ratings with a reason. It never stores question or answer text. Rows are attributed by `auth.uid()` inside `record_ai_event`, but an owner can call that function directly and misreport their own timings; treat single-account outliers with suspicion.

Follow-up update: a conversation reference is resolved using both the authenticated business ID and the action ID. The model receives only the current typed question and the previous topic, never a shared conversation history or raw financial records. Guided follow-up buttons use reviewed responses without another model request. The current session keeps up to twelve displayed turns; saved actions retain each turn and its parent reference. Topic classification can still misunderstand the user, and responses remain constrained guides rather than unrestricted dialogue.

Public search is now explicit opt-in. It sends only a general business query and the saved town to Serper, never the private question. Premium's blur covers inert placeholder shapes; report figures are only returned after the database validates entitlement. Failed checks remain locked. The account error screen does not imply a missing business when a session expires.

Local PostgreSQL verification now runs through `scripts/check-database-access.mjs` using PGlite with an isolated Auth fixture. It executes all migrations and tests tenant-scoped jobs/payments/feedback/conversations, cross-tenant writes, entitlement expiry, self-upgrade rejection, quotas and least-privilege grants. It does not replace verification of the deployed Supabase Auth/configuration.

The text model receives only the owner's question and may select one allowed topic. Arbitrary output, extra fields and unsupported topics fall back to an explicit limitation. The server calculates record totals and supplies reviewed lessons, actions and measurement suggestions. Advert drafts are composed from owner-confirmed fields, not generated claims. Future-dated completed jobs are excluded. A record query returning the configured 1,000-row cap is rejected rather than presenting potentially truncated totals.

This is deliberately a constrained coach, not open-ended diagnosis. Topic selection can still be wrong. Web excerpts are external claims shown separately, and image transcription still uses a model and can be inaccurate. The owner must review images before saving advice; no image automatically changes financial records. Prompt injection cannot instruct the topic selector to return arbitrary displayed advice, but untrusted source excerpts remain visible as plain text. No automated customer messages, purchases or record mutations are delegated to a model.

## Account and infrastructure controls still required

- Enable confirmed email, appropriate password policies, leaked-password protection where available, and Auth abuse controls/CAPTCHA in the Supabase project. Test account recovery and MFA before enabling them for customers. These project settings have not been changed by the code edits.
- Rotate any previously exposed credentials, as already called out in README. Provider secrets must remain in Edge Function secrets. Never use a service-role key in the frontend.
- Keep RLS enabled and test owner separation for every table. No client may write entitlements or quota counters. Rate limits do not stop distributed account creation or DDoS; configure platform-level controls and spend alerts.
- GitHub Pages serves a static frontend and does not support the custom security response headers this app would ideally use. At a configurable hosting/CDN layer, set and test CSP, frame-ancestors, HSTS, Referrer-Policy and Permissions-Policy. Do not add a Next.js `headers()` rule and assume it works in a static export. The Edge API adds no-store, nosniff and no-referrer headers.
- Supabase browser sessions remain client-accessible. Prevent XSS, avoid third-party scripts, sign out on shared devices, and monitor auth logs. In-flight record loads are invalidated when the account changes.
- Review access logs and dependencies, keep backups, and rehearse recovery. No code change can guarantee protection from all cybercrime.

## Verification

Run `npm test`, `npm run typecheck`, `npm run build`, and the Deno Edge Function typecheck. Then execute the SQL checks in `supabase/tests/premium-access.sql` in an isolated database. Test real sign-in, learning completion, expired and active plans, user switching, quotas and image review against staging. Do not treat local mocked tests as a penetration test.

Design follows the supplied presentation's capture → learn → act → measure flow. The interface uses plain business language, compact tables and an explicit Free/Premium distinction. There are no invented growth figures in the upgrade preview.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [database functions](https://supabase.com/docs/guides/database/functions), [OWASP prompt injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).
