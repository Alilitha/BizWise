import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';
import path from 'node:path';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const html = await readFile('out/index.html', 'utf8');
assert.ok(html.includes('BizWise'), 'Expected the app, not the README');
const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]).filter(value => value.includes('/_next/') || value.endsWith('/favicon.svg'));
assert.ok(assets.length > 0);
for (const asset of assets) {
  assert.ok(asset.startsWith(`${base}/`), `Incorrect base path: ${asset}`);
  await access(path.join('out', asset.slice(base.length).split('?')[0]));
}
await access('out/.nojekyll');
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await scan(file);
    else if (/\.(js|html|json|txt)$/.test(entry.name)) {
      const text = await readFile(file, 'utf8');
      assert.ok(!/gsk_[A-Za-z0-9]{20,}|sb_secret_[A-Za-z0-9_-]{20,}|https:\/\/google\.serper\.dev\/search|https:\/\/api\.groq\.com\/openai/.test(text), `Server code or secret detected in ${file}`);
    }
  }
}
await scan('out');
console.log(`Static export verified: app HTML, assets under ${base || '/'}, .nojekyll, no provider implementation or recognizable secrets.`);
