const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
if (!url || !key || url.includes('your-project') || key.includes('your-publishable')) {
  throw new Error('Set real NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY values in Settings > Secrets and variables > Actions > Variables. Then rerun this workflow.');
}
if (new URL(url).protocol !== 'https:') throw new Error('The deployed Supabase URL must use HTTPS.');
if (key.startsWith('sb_secret_')) throw new Error('Never use a Supabase secret key for a public variable.');
if (!key.startsWith('sb_publishable_')) {
  let role;
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch {}
  if (role !== 'anon') throw new Error('Use a Supabase publishable key (or legacy anon key), never a service_role key.');
}
console.log('Public build configuration is present. Values are not printed.');
