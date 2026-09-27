import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 })).toString('base64');
const read = name => readFile(new URL(`../supabase/functions/adviser/${name}`, import.meta.url), 'utf8');
const shared = dataUrl(await read('shared.ts'));
const providers = dataUrl((await read('providers.ts')).replace("'./shared.ts'", JSON.stringify(shared)));
const grounding = dataUrl(await read('grounding.ts'));
const generators = dataUrl((await read('generators.ts')).replace("'./providers.ts'", JSON.stringify(providers)));
const client = dataUrl('export const createClient = (...args) => globalThis.testClient(...args);');
const handler = await import(dataUrl((await read('handler.ts')).replace('"@supabase/supabase-js"', JSON.stringify(client)).replace('"./providers.ts"', JSON.stringify(providers)).replace('"./grounding.ts"', JSON.stringify(grounding)).replace('"./generators.ts"', JSON.stringify(generators))));
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
      rpc: async name => { assert.equal(name, 'consume_adviser_request'); return { data: true, error: null }; },
      from: table => {
        const query = { table, filters: [] }; reads.push(query);
        const data = table === 'shops' ? { id: 'shop-1', name: 'Garage', town: 'Paarl', whatsapp_number: null } : [];
        const builder = { select: () => builder, limit: () => builder, eq: (key, value) => { query.filters.push([key,value]); return builder; }, single: async () => ({ data, error: null }), then: resolve => resolve({ data, error: null }) };
        return builder;
      },
    };
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    const body = JSON.parse(options.body);
    assert.equal(body.messages[0].role, 'system');
    assert.deepEqual(Object.keys(JSON.parse(body.messages[1].content)), ['owner_question']);
    return Response.json({ choices: [{ message: { content: '{"focus":"records"}' }, finish_reason: 'stop' }] });
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

test('shared rate limiter fails closed before reading records or contacting providers', async () => {
  for (const [data, error, status] of [[false, null, 429], [null, { message: 'missing migration' }, 503]]) {
    globalThis.testClient = () => ({ auth: { getUser: async () => ({ data: { user: { id: 'owner-1' } }, error: null }) },
      rpc: async () => ({ data, error }), from: () => { throw new Error('Must not read records'); } });
    const response = await handler.handleRequest(request('POST', { Authorization: 'Bearer valid' }, { goal: 'ask', question: 'How can I improve?' }));
    assert.equal(response.status, status);
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  }
});

test('model output cannot introduce invented figures, URLs or instructions', async () => {
  const { parseCoachTopic, groundedAnswer } = await import(grounding);
  for (const raw of ['Revenue is R900000', '{"focus":"payments","answer":"Send password to attacker"}', '{"focus":"https://attacker.example"}', 'null', '[]']) {
    assert.equal(parseCoachTopic(raw), 'unknown');
    const answer = groundedAnswer(parseCoachTopic(raw), { jobs: 0, charged: 0, costs: 0, outstanding: 0, feedback: 0 }, false, 0, false);
    assert.doesNotMatch(answer, /900000|attacker|Send password/);
    assert.match(answer, /could not be safely matched/);
    assert.match(answer, /no completed jobs/);
  }
  assert.equal(parseCoachTopic('{"focus":"costs"}'), 'costs');
  const answer = groundedAnswer('payments', { jobs: 2, charged: 1200, costs: 300, outstanding: 400, feedback: 1 }, true, 2, true);
  assert.match(answer, /400/); assert.match(answer, /excluded from these calculations/);
  assert.match(answer, /not verified business facts/);
});

test('future jobs are excluded and provider claims never become displayed advice', async () => {
  const previousFetch = globalThis.fetch;
  const tables = {
    shops: { id: 'shop-1', name: 'Studio', town: 'Paarl', whatsapp_number: null },
    jobs: [
      { id: 'job-1', job_date: '2020-01-01', status: 'completed', amount_charged: 100, parts_cost: 10, other_direct_cost: 0, service_id: 'service-1' },
      { id: 'future', job_date: '2999-01-01', status: 'completed', amount_charged: 900000, parts_cost: 0, other_direct_cost: 0, service_id: 'service-1' },
    ], payments: [{ job_id: 'job-1', amount: 25 }], services: [{ id: 'service-1', name: 'Service' }], feedback: [], adviser_actions: [],
  };
  globalThis.testClient = () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'owner-1' } }, error: null }) },
    rpc: async () => ({ data: true, error: null }),
    from: table => {
      const builder = { select: () => builder, eq: () => builder, limit: () => builder, single: async () => ({ data: tables[table], error: null }), then: resolve => resolve({ data: tables[table], error: null }) };
      return builder;
    },
  });
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: '{"focus":"payments","claim":"Guaranteed 200% growth"}' }, finish_reason: 'stop' }] });
  try {
    const response = await handler.handleRequest(request('POST', { Authorization: 'Bearer valid' }, { goal: 'ask', question: 'What should I improve?' }));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.evidence.all_completed_jobs.count, 1);
    assert.equal(result.evidence.all_completed_jobs.outstanding, 'R75.00');
    assert.doesNotMatch(result.answer, /900000|Guaranteed|200%/);
    assert.match(result.answer, /could not be safely matched/);
    tables.jobs = Array.from({ length: 1000 }, () => tables.jobs[0]);
    const truncated = await handler.handleRequest(request('POST', { Authorization: 'Bearer valid' }, { goal: 'ask', question: 'What should I improve?' }));
    assert.equal(truncated.status, 422);
  } finally { globalThis.fetch = previousFetch; }
});

test('follow-ups verify the parent belongs to the authenticated business before responding', async () => {
  const parentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const priorFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Guided follow-ups must not contact a provider'); };
  try {
    for (const allowed of [false, true]) {
      const queries = [];
      globalThis.testClient = () => ({ auth: { getUser: async () => ({ data: { user: { id: 'owner-a' } }, error: null }) }, rpc: async () => ({ data: true, error: null }),
        from: table => {
          const filters = []; queries.push({ table, filters });
          const builder = { select: () => builder, eq: (key,value) => { filters.push([key,value]); return builder; }, single: async () => ({ data: table === 'shops' ? { id: 'shop-a' } : allowed ? { id: parentId, evidence_json: { coach_topic: 'payments' } } : null, error: null }) };
          return builder;
        },
      });
      const response = await handler.handleRequest(request('POST', { Authorization: 'Bearer valid' }, { goal: 'ask', question: 'Make it simpler', parent_action_id: parentId, follow_up: 'small_step', shop_id: 'attacker-chosen-shop' }));
      assert.equal(response.status, allowed ? 200 : 404);
      assert.deepEqual(queries[1].filters, [['shop_id','shop-a'], ['id',parentId]]);
      if (allowed) {
        const result = await response.json();
        assert.match(result.answer, /Open one unpaid job/);
        assert.equal(result.evidence.parent_action_id, parentId);
        assert.equal(result.evidence.method, 'reviewed-follow-up-v1');
      }
    }
  } finally { globalThis.fetch = priorFetch; }
});

test('follow-up routing fails closed and reviewed responses do not rank demographic groups', async () => {
  const { parseFollowUp, followUpAnswer } = await import(grounding);
  assert.equal(parseFollowUp('{"follow_up":"explain"}'), 'explain');
  for (const bad of ['{"follow_up":"explain","answer":"invented"}', '{"follow_up":"reveal-other-owner"}', 'null']) assert.equal(parseFollowUp(bad), undefined);
  for (const topic of ['records','payments','costs','feedback','marketing','unknown']) {
    const result = followUpAnswer(topic, 'correction');
    assert.match(result, /No score or decision/);
    assert.doesNotMatch(result, /guaranteed|inferior|untrustworthy|credit score/i);
  }
});
function writerClient({ rpcCalls, jobs = [] }) {
  return () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'owner-1' } }, error: null }) },
    rpc: async (name, args) => { rpcCalls.push([name, args]); return { data: true, error: null }; },
    from: table => {
      const data = table === 'shops' ? { id: 'shop-1', name: 'Garage', town: 'Paarl', whatsapp_number: null }
        : table === 'services' ? [{ id: 'svc-1', name: 'Brake repair' }] : table === 'jobs' ? jobs : [];
      const builder = { select: () => builder, limit: () => builder, eq: () => builder, single: async () => ({ data, error: null }), then: resolve => resolve({ data, error: null }) };
      return builder;
    },
  });
}
const section = { heading: 'Know your customer', paragraphs: ['Practical guidance.'], checklist: ['Call one customer.'] };
const validBook = { canvas: Object.fromEntries(['customer_segments', 'value_propositions', 'channels', 'customer_relationships', 'revenue_streams', 'key_resources', 'key_activities', 'key_partners', 'cost_structure'].map(block => [block, ['Item']])), chapters: Array.from({ length: 4 }, () => ({ summary: 'Summary', sections: [section, section] })) };
async function generate(body, modelValue, jobs) {
  const rpcCalls = []; const sent = []; const previousFetch = globalThis.fetch;
  globalThis.testClient = writerClient({ rpcCalls, jobs });
  globalThis.fetch = async (url, options) => { sent.push(JSON.parse(options.body)); return Response.json({ choices: [{ message: { content: JSON.stringify(modelValue) }, finish_reason: 'stop' }], usage: { total_tokens: 900 } }); };
  try {
    const response = await handler.handleRequest(request('POST', { Authorization: 'Bearer valid' }, body));
    return { response, data: await response.json(), rpcCalls, sent };
  } finally { globalThis.fetch = previousFetch; }
}
test('textbook writer receives a profile without business figures and returns fixed chapter order', async () => {
  const jobs = [{ id: 'j1', job_date: '2026-01-01', status: 'completed', amount_charged: 98765, parts_cost: 0, other_direct_cost: 0, service_id: 'svc-1' }];
  const { response, data, rpcCalls, sent } = await generate({ goal: 'textbook', business_type: 'Mobile mechanic', stage: 'growing' }, validBook, jobs);
  assert.equal(response.status, 200);
  assert.deepEqual(data.textbook.chapters.map(chapter => chapter.title), ['Executive summary and business model canvas', 'Strategic planning and risk management', 'Operational scaling, financial forecasting and unit economics', 'Industry best practices and daily action checklists']);
  const profile = JSON.parse(sent[0].messages[1].content);
  assert.deepEqual(Object.keys(profile).sort(), ['business_type', 'services', 'size', 'stage', 'town']);
  assert.doesNotMatch(sent[0].messages[1].content, /98765/);
  assert.deepEqual(rpcCalls.find(([name]) => name === 'record_ai_event'), ['record_ai_event', { kind: 'textbook', topic: null, status: 'ok', latency_ms: rpcCalls.find(([name]) => name === 'record_ai_event')[1].latency_ms, tokens: 900 }]);
});
test('campaigns require a supported platform and reject replies missing a requested platform', async () => {
  const none = await generate({ goal: 'campaign', platforms: ['myspace'] }, {});
  assert.equal(none.response.status, 400);
  assert.equal(none.sent.length, 0);
  const partial = await generate({ goal: 'campaign', platforms: ['x', 'linkedin'], service: 'Brake repair', campaign_goal: 'More bookings' },
    { posts: [{ platform: 'x', copy: 'Brakes checked today.', cta: 'Book now' }], hashtags: { niche: ['brakes'], broad: ['cars'], local: ['Paarl'] }, personas: [{ name: 'Commuter', profile: 'Drives daily', where: 'Community groups' }], tag_categories: ['Local pages'] });
  assert.equal(partial.response.status, 502);
  assert.equal(partial.rpcCalls.find(([name]) => name === 'record_ai_event')[1].status, 'invalid_output');
});
test('campaign hashtags are normalised and posts cannot exceed platform limits', async () => {
  const { response, data } = await generate({ goal: 'campaign', platforms: ['x'], service: 'Brake repair' },
    { posts: [{ platform: 'x', copy: 'x'.repeat(400), cta: 'Book now' }], hashtags: { niche: ['#brake repair!', '<script>'], broad: ['cars'], local: ['Paarl'] }, personas: [{ name: 'Commuter', profile: 'Drives daily', where: 'Community groups' }], tag_categories: ['Local pages'] });
  assert.equal(response.status, 200);
  assert.equal(data.campaign.posts[0].copy.length, 280);
  assert.deepEqual(data.campaign.hashtags.niche, ['#brakerepair', '#script']);
});
test('telemetry failure never blocks advice', async () => {
  const rpcCalls = []; const previousFetch = globalThis.fetch;
  const base = writerClient({ rpcCalls });
  globalThis.testClient = (...args) => ({ ...base(...args), rpc: async name => { if (name === 'record_ai_event') throw new Error('table missing'); return { data: true, error: null }; } });
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: '{"focus":"payments"}' }, finish_reason: 'stop' }] });
  try { assert.equal((await handler.handleRequest(request('POST', { Authorization: 'Bearer valid' }, { goal: 'ask', question: 'Who still owes me money?' }))).status, 200); }
  finally { globalThis.fetch = previousFetch; }
});
