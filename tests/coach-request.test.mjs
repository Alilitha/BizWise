import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../app/adviser/request.ts', import.meta.url), 'utf8');
const js = ts.transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 });
const { requestCoach } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const options = { url: 'https://example.supabase.co', key: 'public-test', token: 'user-test', origin: 'http://localhost:3000', body: { goal: 'ask', question: 'How do I record payments?' } };
test('browser network failures identify the exact local origin without exposing credentials', async () => {
  await assert.rejects(requestCoach({ ...options, fetcher: async () => { throw new TypeError('Failed to fetch'); } }), error => /http:\/\/localhost:3000/.test(error.message) && /ALLOWED_ORIGINS/.test(error.message) && !/user-test|public-test/.test(error.message));
});
test('expired sessions, timeouts and malformed replies are separate from connection failures', async () => {
  await assert.rejects(requestCoach({ ...options, fetcher: async () => Response.json({}, { status: 401 }) }), /sign-in has expired/);
  await assert.rejects(requestCoach({ ...options, fetcher: async () => { throw new DOMException('timeout', 'TimeoutError'); } }), /took too long/);
  await assert.rejects(requestCoach({ ...options, fetcher: async () => Response.json({ answer: 'missing evidence' }) }), /incomplete response/);
  await assert.rejects(requestCoach({ ...options, fetcher: async () => Response.json({ error: 'Limit reached' }, { status: 429 }) }), /Limit reached/);
});
test('valid advice is returned with scoped auth and a bounded request timeout', async () => {
  const expected = { answer: 'Check your recorded payments.', goal: 'money', evidence: { limitations: 'Recorded data only' } };
  const result = await requestCoach({ ...options, fetcher: async (url, init) => {
    assert.equal(url, 'https://example.supabase.co/functions/v1/adviser');
    assert.equal(init.headers.Authorization, 'Bearer user-test');
    assert.ok(init.signal);
    return Response.json(expected);
  } });
  assert.deepEqual(result, expected);
});
