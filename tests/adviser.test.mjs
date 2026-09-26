import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 })).toString('base64');
const sharedUrl = dataUrl(await readFile(new URL('../app/adviser/shared.ts', import.meta.url), 'utf8'));
const server = await import(dataUrl((await readFile(new URL('../app/adviser/server.ts', import.meta.url), 'utf8')).replace("'./shared'", JSON.stringify(sharedUrl))));
const shared = await import(sharedUrl);
test('image validation rejects URLs, SVG, spoofed and oversized content', () => {
  assert.equal(server.validateImage(undefined), undefined);
  for (const bad of ['https://example.com/image.jpg', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,YWJj', 12]) assert.throws(() => server.validateImage(bad));
  const bytes = Buffer.alloc(shared.MAX_IMAGE_BYTES + 1); bytes.set([255,216,255]);
  assert.throws(() => server.validateImage('data:image/jpeg;base64,' + bytes.toString('base64')), /under 3 MB/);
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9XkAAAAASUVORK5CYII=';
  assert.equal(server.validateImage(png), png);
});
test('bounded request reader rejects malformed and oversized streamed bodies', async () => {
  assert.deepEqual(await server.readBody(new Request('http://localhost', { method: 'POST', body: '{"goal":"ask"}' })), { goal: 'ask' });
  for (const body of ['null', '[]', '{bad', 'x'.repeat(5 * 1024 * 1024)]) await assert.rejects(server.readBody(new Request('http://localhost', { method: 'POST', body })));
});
test('source links reject executable URLs and credentials', () => {
  assert.equal(shared.safeWebUrl('https://example.com'), true);
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'https://user:password@example.com', '/relative']) assert.equal(shared.safeWebUrl(url), false);
});
test('search missing key, real provider request shape, filtering, empty results and errors', async () => {
  const key = process.env.SERPER_API_KEY; const original = globalThis.fetch;
  try {
    delete process.env.SERPER_API_KEY;
    await assert.rejects(server.searchWeb('competitors', 'Paarl'), /SERPER_API_KEY/);
    process.env.SERPER_API_KEY = 'test-only';
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://google.serper.dev/search');
      const body = JSON.parse(options.body); assert.match(body.q, /Paarl/); assert.match(body.q, /competitors/); assert.equal(body.gl, 'za'); assert.equal(body.hl, 'en'); assert.equal(body.num, 10); assert.equal(options.headers['X-API-KEY'], 'test-only'); assert.equal(options.headers.Authorization, undefined);
      return Response.json({ organic: [{ title: 'Local garage', link: 'https://example.com', snippet: 'Public snippet', date: '2026-09-01' }, { link: 'javascript:alert(1)', snippet: 'bad' }, null] });
    };
    const sources = await server.searchWeb('competitors', 'Paarl');
    assert.equal(sources.length, 1); assert.equal(sources[0].id, 1); assert.equal(sources[0].published, '2026-09-01'); assert.ok(sources[0].retrieved);
    globalThis.fetch = async () => Response.json({ organic: [] }); assert.deepEqual(await server.searchWeb('competitors', 'Paarl'), []);
    globalThis.fetch = async () => new Response('', { status: 401 }); await assert.rejects(server.searchWeb('competitors', 'Paarl'), /rejected/);
    for (const status of [402, 429]) { globalThis.fetch = async () => new Response('', { status }); await assert.rejects(server.searchWeb('competitors', 'Paarl'), /quota/); }
    globalThis.fetch = async () => Response.json({ organic: 'invalid' }); await assert.rejects(server.searchWeb('competitors', 'Paarl'), /invalid response/);
    globalThis.fetch = async () => new Response('not-json'); await assert.rejects(server.searchWeb('competitors', 'Paarl'), /invalid response/);
    globalThis.fetch = async () => { throw new Error('timeout'); }; await assert.rejects(server.searchWeb('competitors', 'Paarl'), /timed out/);
  } finally { globalThis.fetch = original; if (key === undefined) delete process.env.SERPER_API_KEY; else process.env.SERPER_API_KEY = key; }
});
test('vision passes image as data with instruction isolation and rejects partial readings', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body); assert.match(body.messages[0].content, /untrusted data/); assert.equal(body.messages[1].content[1].image_url.url, 'test-image'); assert.equal(body.tools, undefined);
      return Response.json({ choices: [{ message: { content: 'Visible amount: R100' }, finish_reason: 'stop' }] });
    };
    assert.equal(await server.extractImage('test-image', 'test-only'), 'Visible amount: R100');
    globalThis.fetch = async () => Response.json({ choices: [{ message: { content: 'partial' }, finish_reason: 'length' }] });
    await assert.rejects(server.extractImage('test-image', 'test-only'), /incomplete/);
  } finally { globalThis.fetch = original; }
});
