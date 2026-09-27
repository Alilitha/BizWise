// Read-only check: no session, private records, or provider keys are sent.
import { existsSync } from 'node:fs';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL in .env.local first.');
const origins = process.argv.slice(2).length ? process.argv.slice(2) : ['http://localhost:3000', 'http://127.0.0.1:3000'];
let failed = false;
for (const origin of origins) {
  if (new URL(origin).origin !== origin) throw new Error('Pass a full origin without a path or trailing slash.');
  try {
    const result = await fetch(`${url.replace(/\/$/, '')}/functions/v1/adviser`, {
      method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,apikey,content-type' }, signal: AbortSignal.timeout(15000),
    });
    const allowed = result.headers.get('access-control-allow-origin') === origin;
    const methods = result.headers.get('access-control-allow-methods') || '';
    const headers = (result.headers.get('access-control-allow-headers') || '').toLowerCase();
    if (!result.ok || !allowed || !methods.includes('POST') || !['authorization','apikey','content-type'].every(value => headers.includes(value))) {
      failed = true;
      console.error(`BLOCKED ${origin}: HTTP ${result.status}. Add this exact origin to the existing ALLOWED_ORIGINS secret for the adviser; preserve production origins.`);
    } else console.log(`OK ${origin}: browser preflight accepted. Sign-in, database migrations and provider configuration require separate checks.`);
  } catch (error) { failed = true; console.error(`UNREACHABLE ${origin}: ${error instanceof Error ? error.message : 'Network error'}`); }
}
process.exitCode = failed ? 1 : 0;
