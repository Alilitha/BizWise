import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 })).toString('base64');
const read = name => readFile(new URL(`../supabase/functions/adviser/${name}`, import.meta.url), 'utf8');
const shared = dataUrl(await read('shared.ts'));
const providers = dataUrl((await read('providers.ts')).replace("'./shared.ts'", JSON.stringify(shared)));
const client = dataUrl('export const createClient = (...args) => globalThis.testClient(...args);');
const handler = await import(dataUrl((await read('handler.ts')).replace('"@supabase/supabase-js"', JSON.stringify(client)).replace('"./providers.ts"', JSON.stringify(providers))));
const env = { ALLOWED_ORIGINS: 'https://alilitha.github.io,http://localhost:3000', SUPABASE_URL: 'https://test.supabase.co', BIZWISE_SUPABASE_PUBLISHABLE_KEY: 'publishable-test', GROQ_API_KEY: 'test-only' };
globalThis.Deno = { env: { get: name => env[name] } };
const origin = 'https://alilitha.github.io';
const request = (method, extra = {}, body) => new Request('https://test.supabase.co/functions/v1/adviser', { method, headers: { Origin: origin, ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
test('CORS preflight succeeds only for configured origins and permits browser auth headers', async () => {
  globalThis.testClient = () => { throw new Error('Preflight must not access Supabase'); };
  const response = await handler.handleRequest(request('OPTIONS'));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.match(response.headers.get('Access-Control-Allow-Headers'), /authorization, apikey/);
  const denied = await handler.handleRequest(request('OPTIONS', { Origin: 'https://attacker.example' }));
  assert.equal(denied.status, 403); assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
});
test('unsupported methods and missing credentials never reach database or providers', async () => {
  globalThis.testClient = () => { throw new Error('Must reject before constructing a client'); };
  assert.equal((await handler.handleRequest(request('GET'))).status, 405);
  const denied = await handler.handleRequest(request('POST', {}, { goal: 'ask', question: 'How is business?' }));
  assert.equal(denied.status, 401); assert.equal(denied.headers.get('Access-Control-Allow-Origin'), origin);
});
test('invalid JWT is rejected through Supabase Auth before querying shop records', async () => {
  globalThis.testClient = () => ({ auth: { getUser: async token => {
    assert.equal(token, 'invalid'); return { data: { user: null }, error: new Error('invalid') };
  } } });
  assert.equal((await handler.handleRequest(request('POST', { Authorization: 'Bearer invalid' }, { goal: 'ask', question: 'How is business?' }))).status, 401);
});
test('authenticated advice preserves user-scoped reads and returns CORS on success', async () => {
  const reads = []; const clients = []; const previousFetch = globalThis.fetch;
  globalThis.testClient = (url, key, options) => {
    assert.equal(url, env.SUPABASE_URL); assert.equal(key, env.BIZWISE_SUPABASE_PUBLISHABLE_KEY); clients.push(options);
    return { auth: { getUser: async token => { assert.equal(token, 'valid'); return { data: { user: { id: 'owner-1' } }, error: null }; } },
      from: table => {
        const query = { table, filters: [] }; reads.push(query);
        const data = table === 'shops' ? { id: 'shop-1', name: 'Garage', town: 'Paarl', whatsapp_number: null } : [];
        const builder = { select: () => builder, eq: (key, value) => { query.filters.push([key,value]); return builder; }, single: async () => ({ data, error: null }), then: resolve => resolve({ data, error: null }) };
        return builder;
      },
    };
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    const body = JSON.parse(options.body);
    assert.equal(body.messages[0].role, 'system');
    return Response.json({ choices: [{ message: { content: 'Record more completed jobs before drawing conclusions.' }, finish_reason: 'stop' }] });
  };
  try {
    const response = await handler.handleRequest(request('POST', { Authorization: 'Bearer valid' }, { goal: 'ask', question: 'How is business?' }));
    assert.equal(response.status, 200); assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(clients[1].global.headers.Authorization, 'Bearer valid');
    assert.deepEqual(reads.find(item => item.table === 'shops').filters, [['owner_user_id', 'owner-1']]);
    for (const query of reads.filter(item => item.table !== 'shops')) assert.deepEqual(query.filters, [['shop_id', 'shop-1']]);
    const result = await response.json(); assert.ok(result.answer); assert.equal(result.evidence.shop.town, 'Paarl');
  } finally { globalThis.fetch = previousFetch; }
});
