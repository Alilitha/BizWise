# BizWise Garage — GitHub Pages + Supabase

The interface is a static Next.js export hosted at **https://alilitha.github.io/BizWise/**. Supabase handles sign-in, shop records and the adviser Edge Function. No Vercel or Next.js server is needed in production.

The conversion is prepared locally. Upload/push these changes and complete the account configuration below to publish it. The existing README-only Pages site will be replaced by the app after the Pages workflow succeeds.

## 1. Set the two public GitHub variables

In the **Alilitha/BizWise** repository open **Settings → Secrets and variables → Actions → Variables → New repository variable**. Add:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your existing Supabase project URL, such as `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The same project's publishable key (`sb_publishable_...`) |
| `SUPABASE_PROJECT_REF` | The project reference from Supabase project settings (the subdomain before `.supabase.co`) |

These are configuration values, not Groq/Serper credentials. The first two are intentionally included in the browser build. The workflow refuses missing/placeholder values and secret/service-role keys. After changing either public variable, rerun the Pages workflow to rebuild the site.

The Pages workflow obtains the base path from GitHub automatically: `/BizWise` for this repository. Do not enter it as part of the Supabase URL.

## 2. Configure Supabase

Use your existing Supabase project. If the database has not yet been set up, apply `supabase/migrations/20260925_bizwise.sql` once using SQL Editor. Do not rerun it blindly on an existing database: its triggers/policies already exist. This conversion needs no new tables or migrations. Keep all included Row Level Security policies enabled.

In **Authentication → URL Configuration** set:

- Site URL: `https://alilitha.github.io/BizWise/`
- Redirect URLs: `https://alilitha.github.io/BizWise/`, plus `http://localhost:3000/` and `http://127.0.0.1:3000/` if developing locally.

In **Edge Functions → Secrets**, add:

| Secret name | Value |
| --- | --- |
| `GROQ_API_KEY` | A newly issued Groq key; revoke the previously exposed one |
| `SERPER_API_KEY` | Your Serper key |
| `BIZWISE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable key (same as the GitHub variable) |
| `ALLOWED_ORIGINS` | `https://alilitha.github.io,http://localhost:3000,http://127.0.0.1:3000` |
| `GROQ_VISION_MODEL` | Optional: `qwen/qwen3.8-27b` is the default |

Origins must have **no `/BizWise` path or trailing slash**. Add other origins explicitly if you use a custom domain or another local port. The Supabase runtime supplies `SUPABASE_URL` automatically. The function can use the built-in legacy `SUPABASE_ANON_KEY` when the custom publishable key is not provided; it never uses a service-role key.

Get provider keys from [Groq](https://console.groq.com/keys) and [Serper](https://serper.dev/api-key). Keep them only in Supabase secrets, never in GitHub public variables or any `NEXT_PUBLIC_` variable. Do not upload `.env.local`, a private function env file, or real keys in an example file.

## 3. Deploy the adviser from GitHub

Create a Supabase personal access token at [Supabase account tokens](https://supabase.com/dashboard/account/tokens). Add it to GitHub **Settings → Secrets and variables → Actions → Secrets** as `SUPABASE_ACCESS_TOKEN`. This is a deployment credential, not the project's publishable key.

After pushing the files:

1. Open **Actions → Deploy Supabase adviser → Run workflow** on your main branch.
2. Wait for success. Your existing tables will not be modified by this workflow.
3. Supabase should show the `adviser` function at `https://YOUR-PROJECT.supabase.co/functions/v1/adviser`.

`supabase/config.toml` sets `verify_jwt = false` because the function validates the bearer token itself with Supabase Auth `getUser(token)`. Missing/invalid user tokens are rejected before any shop queries or provider calls. This is not an anonymous adviser: do not remove the in-function verification. Every database read uses the user's token and owner/shop filters, preserving RLS.

If you prefer a local CLI instead of a GitHub deployment token:

```sh
npx supabase login
npx supabase functions deploy adviser --project-ref YOUR_PROJECT_REF
```

Use the tracked config when deploying. The function consists of `index.ts`, `handler.ts`, `providers.ts`, `shared.ts`, `deno.json` and its generated lockfile in `supabase/functions/adviser/`.

## 4. Publish GitHub Pages

1. Push/upload the updated source files, including the hidden `.github/workflows` directory. Do not upload `node_modules`, `.next`, `out`, or private `.env` files. Preserve any unrelated work in your checkout.
2. In GitHub **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**, replacing the old “Deploy from a branch” setting.
3. Under **Actions**, run **Deploy GitHub Pages**. Future pushes to `main` or `master` run it automatically. If another branch is your default, update the workflow's branch list.
4. Wait for both build and deploy to pass, then open **https://alilitha.github.io/BizWise/**.

The workflow publishes only `out/`, not the source repository or README. It checks public configuration, runs nine tests, checks the Edge Function with Deno, builds the static app, runs TypeScript, verifies asset paths and scans the export for server provider code/recognizable secrets before publishing.

## Local development and checks

No new app packages are required. Use Node.js 22.13 or later. Existing dependencies suffice; a fresh checkout uses `npm ci`.

Use `.env.pages.example` as the template for `.env.local`. Set the two real public Supabase values. Leave `NEXT_PUBLIC_BASE_PATH` empty for local development. Existing provider keys in `.env.local` are no longer used: the adviser now always runs in Supabase.

```sh
npm run dev
npm test
npm run build
npm run typecheck
node scripts/check-static-export.mjs
npm start
```

Run `npm start` after stopping `npm run dev`, since both default to port 3000. `npm start` previews `out/` using a small local-only static server, not a production API. Requests still go to the deployed Supabase function. It automatically detects the exported base path.

To verify the real project path in PowerShell:

```powershell
$env:NEXT_PUBLIC_BASE_PATH='/BizWise'
npm run build
node scripts/check-static-export.mjs
npm start
```

Open `http://127.0.0.1:3000/BizWise/`. Clear that environment variable before returning to root-path development. Add the exact local origin to Supabase `ALLOWED_ORIGINS` if changing the port.

Edge runtime typecheck (the first invocation downloads the Deno tooling):

```sh
npx --yes deno check --config supabase/functions/adviser/deno.json supabase/functions/adviser/index.ts
```

For optional local Edge Function development, copy `supabase/functions/.env.example` to ignored `supabase/functions/.env`, populate it privately, and use Supabase CLI's local stack and `functions serve`. Set the frontend's public Supabase URL/key to that local stack's values. Docker is required for the local Supabase stack; using the deployed function does not need Docker.

## Test the app

- **Sign-in and records:** Confirm email/sign in, load your existing shop, add a job and partial payment, save feedback, track actions and generate/edit an advert. Test a second account to confirm it cannot see the first account's records.
- **Voice:** Adviser → Speak question → allow microphone → speak → Stop → review/edit → Ask. Use a supporting browser such as Chrome over HTTPS or localhost. Browser speech may send audio to its online service; unsupported browsers retain typed input. No speech API key is needed.
- **Images:** Attach JPEG/PNG/WebP under 3 MB and 20 megapixels, preview/remove, then ask about a receipt. Review the extraction against the original and confirm before saving image-based advice. Jobs/payments are never automatically changed. Original image bytes are sent to Groq but not stored in Supabase; reviewed extraction/advice is saved with the action.
- **Research:** Enable public web research or ask about competitors near your shop. Check the sources, excerpts, retrieval times and source dates. Serper receives the question and town, not the shop records or image. Public claims are kept separate from shop records; they do not establish local demand.

## Troubleshooting

- **README still shows:** Select GitHub Actions as the Pages source and check that the new Pages workflow deployed `out/` successfully.
- **Missing Supabase values:** Set the two exact GitHub repository variable names, then rerun Pages. Editing `.env.local` does not update the hosted site.
- **Adviser cannot connect:** Deploy the `adviser` function and set `ALLOWED_ORIGINS=https://alilitha.github.io` (plus any desired local origins). Inspect Supabase function logs for failures without logging keys or full request bodies.
- **Session expired:** Sign in again. Authentication runs in the function even though platform JWT verification is disabled in its config.
- **Missing Groq/Serper key:** Set the named secret in Supabase, not GitHub Pages. Check account/model access or quotas if a provider rejects it.
- **Broken styles/scripts:** Rebuild through the supplied Pages workflow so its base path matches your Pages URL.

Local verification passed: nine mocked-provider/auth/CORS tests, Next.js static build, frontend typecheck, Deno Edge Function typecheck and `/BizWise` asset/export checks. Live GitHub publication, Supabase function deployment, sign-in, real provider calls and physical microphone/mobile behavior still require account setup and live testing. No changes have been pushed or deployed by this local conversion.
