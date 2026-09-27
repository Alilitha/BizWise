// Local PostgreSQL semantics check. Does not connect to the real Supabase project.
// Install @electric-sql/pglite in <os temp>/bizwise-security-check first, or pass
// its package directory as the first argument. No production credentials required.
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const packageDir = process.argv[2] || path.join(tmpdir(), 'bizwise-security-check', 'node_modules', '@electric-sql', 'pglite');
const { PGlite } = await import(pathToFileURL(path.join(packageDir, 'dist', 'index.js')).href);
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
  `);
  for (const file of ['20260925_bizwise.sql', '20260926_security_and_premium.sql', '20260927_least_privilege.sql', '20260928_telemetry_and_admin.sql', '20260929_admin_console.sql']) {
    const sql = (await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
      .replace('create extension if not exists pgcrypto;', ''); // gen_random_uuid is built into modern PostgreSQL.
    await db.exec(sql);
  }
  await db.exec(await readFile(new URL('../supabase/tests/premium-access.sql', import.meta.url), 'utf8'));
  console.log('PostgreSQL checks passed: owner isolation, no self-upgrade, active/expired Premium, cross-account progress rejection, shared quotas and least-privilege grants. Local auth schema is a fixture, not live Supabase Auth.');
} finally { await db.close(); }
