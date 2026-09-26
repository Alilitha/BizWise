# BizWise Garage MVP

A mobile-friendly Next.js app for independent South African repair shops. It supports account sign-in, shop and service setup, jobs, partial payments, calculated summaries, AI business advice, editable adverts, action results, feedback, and CSV export.

## Before running

1. Create a Supabase project. In its **SQL Editor**, run `supabase/migrations/20260925_bizwise.sql` in full. The SQL creates tables, payment checks, and row level security policies. Do not enter real customer data until this is complete.
2. Copy `.env.example` to `.env.local`. Set the Supabase project URL and **publishable** key. Create a new Groq key at https://console.groq.com/keys and set `GROQ_API_KEY` as a server-only environment variable. Replace the placeholders; never commit `.env.local`.
3. On Windows, install Node.js 22.13 or newer, then run `npm install` and `npm run dev` inside the extracted project folder. Open the local address shown in the terminal. This package uses standard Next.js commands and does not require the Sites build helper.
4. If Supabase Auth requires email confirmation, confirm the account from your email before signing in. Configure the correct Site URL/redirects in the Supabase Auth dashboard for the deployment you use.

The AI endpoint calls Groq’s chat completions API with `openai/gpt-oss-20b`. Groq free-plan limits apply and may change. The app displays a configuration error when the key is missing rather than pretending that AI is working.

## Demo flow

Sign up → set up shop → add a service → add three completed jobs → add a partial payment → view Home → ask BizWise → confirm an offer and generate an advert → edit, save and copy it → record enquiries and bookings in Actions.

Example job: R1 200 charged − R650 parts − R100 other direct costs = **R450 left after recorded direct costs**. A R500 payment leaves **R700 outstanding**. This is not net profit.

## Status

TypeScript check and standard Next.js production build passed in the development workspace. The development server started with an explicit loopback address. A live Supabase account flow, SQL application, cross-account row level security, and live Groq call require access to the provisioned project and a newly issued server secret; they were not verified here. The action tracker relies on owner-reported attribution. Advert sharing uses copy-to-clipboard. The AI response is plain text; the database stores its underlying evidence summary.

## Security

Do not commit `.env.local`. Never use a Supabase secret/service-role key in the browser. The publishable key is safe for client use only with the included RLS policies applied. Revoke any OpenAI or Groq key that has been shared in chat. The server re-authenticates AI requests with the Supabase access token and queries only the signed-in owner's shop.

## Voice, images and public web research

No extra packages are required. Existing dependencies and native fetch are used.

Configuration in `.env.local` (restart `npm run dev` after changing it):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-project-publishable-key
GROQ_API_KEY=
SERPER_API_KEY=
# Optional override; current documented Groq vision model:
GROQ_VISION_MODEL=qwen/qwen3.8-27b
```

Get Supabase values from your project's Connect/API settings at https://supabase.com/dashboard, a NEW Groq key from https://console.groq.com/keys, and a Serper key from https://serper.dev/api-key. Revoke the exposed Groq key (also previously present in `.env.example`) before using this app. Removing a key from a file does not revoke it. The existing `.env.local` has not been overwritten. Never commit it. Only the Supabase URL and publishable key belong in NEXT_PUBLIC variables.

Service documentation checked for this implementation:
- Groq vision: https://console.groq.com/docs/vision (qwen/qwen3.8-27b, base64 image content).
- Serper search: https://serper.dev/playground (server POST with X-API-KEY authentication).
- Browser speech: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition.

### Local checks

Run `npm run dev`, open http://localhost:3000 (or the terminal's port), sign in, and set up a shop with its town and a saved service. Existing node_modules are sufficient; a fresh checkout uses `npm install`.

1. **Voice:** Open Adviser, press Speak question, allow microphone access, speak, and press Stop recording. Review/edit the populated text before Ask BizWise. Submission is disabled during listening. Deny permission to check the error; test an unsupported browser to check the typed fallback. Use HTTPS or localhost. Browser speech support varies: try Chrome; Firefox and embedded browsers may lack it. Browser-provided recognition can send audio to its own online service; offline operation is not promised. No audio is uploaded to this app, and no speech API key is required. Actual microphone recognition must be tested on your device.
2. **Images:** Attach a JPEG, PNG or WebP under 3 MB and 20 megapixels. Check preview/removal. HEIC/PDF/SVG, empty, oversized and unreadable files show errors. Ask about a receipt or job card. Check the separate visible-content/figures panel against the original. Advice is not saved until the confirmation checkbox and Confirm and save advice button are used. If the reading is wrong, crop/replace the image and ask again. Saving records remains manual through Jobs/Payments; the AI has no write tools. Test an image saying “ignore instructions” to check it is reported as content rather than followed. The image is sent via the authenticated server to Groq; its original bytes are not stored in Supabase. Confirmed extraction and advice are stored in adviser_actions.evidence_json/recommendation.
3. **Research:** Enable Research the public web and ask “What are competitors near my shop offering?” or “What do customers in my area look for in a repair shop?” These example local questions also trigger research automatically. Check source numbers, clickable links, publication dates when supplied, retrieval timestamps, and excerpts. Sources are preserved in Actions. The search sends only the question and saved town to Serper. Do not put private details in a research question. Search snippets are public claims, not verified demand or a complete competitor census. Removing SERPER_API_KEY and restarting should show a clear configuration error without fabricated findings.
4. **Regression:** Ask a typed records-only question, add a job and partial payment, generate an advert from a saved action, save its draft, and update action results. Verify record figures remain unchanged after image analysis. Sign out/in and ensure the previous adviser attachment/result clears.

Automated checks:
```sh
node --test tests/adviser.test.mjs
npm run typecheck
npm run build
```

The focused tests use mocked provider responses; they do not prove live account/model access. The local SQL migration and owner-scoped queries were inspected; the deployed Supabase schema/RLS has not been inspected directly. No migration is needed for these features: existing shops.town and adviser_actions.evidence_json are used. The route authenticates through Supabase before accessing shop records or paid providers and bounds the actual request stream. The model sees external text as untrusted data and cannot write business records. Prompt instructions reduce, but cannot guarantee elimination of, malicious content influence; review readings and advice.

Status: UI and server integrations are implemented, five focused tests and typecheck/build pass. Voice requires a supporting browser and microphone permission. Advice/image interpretation require a rotated GROQ_API_KEY and model access. Research also requires SERPER_API_KEY and available account credits. Live sign-in/database/provider calls and physical microphone/mobile interactions were not verified in this development run.
