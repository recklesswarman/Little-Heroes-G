// Audit hardening (2026-11-24):
//  1. server.js's "nested /assets/" helper must never serve a file outside dist/assets
//     ("/x/assets/../../package.json" used to return the repo's files, and on the Pi
//     "../../../little-heroes.env" would have reached the env file with the keys).
//  2. The story picture endpoint is rate limited like the other AI routes.
//  3. The repo is public: the kids' real first names must not appear in any tracked file.
//     Only SHA-256 hashes of the names are kept here, so this file doesn't reveal them.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const check = async (name, fn) => {
  try { await fn(); console.log(`  ✅ ${name}`); } catch (err) { failed += 1; console.error(`  ❌ ${name}\n     ${err.message}`); }
};

// Raw GET: node's http client sends the path exactly as given (no "../" clean-up), like curl --path-as-is.
const rawGet = (port, p) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, path: p, method: 'GET' }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  req.on('error', reject);
  req.end();
});

async function startServer() {
  const port = 39000 + Math.floor(Math.random() * 900);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), GEMINI_API_KEY: '', NTFY_ENABLED: 'false' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  for (let i = 0; i < 60; i += 1) {
    try { if ((await rawGet(port, '/healthz')).status === 200) return { child, port }; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill();
  throw new Error('server.js did not start');
}

await check('nested /assets/ requests cannot climb out of dist/assets', async () => {
  const { child, port } = await startServer();
  try {
    for (const p of [
      '/x/assets/../../package.json',
      '/x/assets/../../server.js',
      '/deep/nested/assets/../../../../../../etc/hostname',
      '/x/assets/..%2f..%2fpackage.json'
    ]) {
      const res = await rawGet(port, p);
      assert.notEqual(res.status, 200, `${p} must not be served`);
      assert.doesNotMatch(res.body, /little-hero-adventures|import express/, `${p} leaked a file`);
    }
  } finally {
    child.kill();
  }
});

await check('the server code resolves nested assets inside dist/assets only', () => {
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.match(src, /target\.startsWith\(assetsRoot \+ path\.sep\)/);
});

await check('the story picture endpoint is rate limited per caller', () => {
  const src = fs.readFileSync(path.join(ROOT, 'server/imageGenService.js'), 'utf8');
  assert.match(src, /isRateLimited\(`illustration:\$\{getRequestIp\(req\)\}`/);
  assert.match(src, /status\(429\)/);
});

await check("no tracked file contains the kids' real first names", () => {
  const BLOCKED = new Set([
    'a4976819961c3bb9c950e7f2a2cd75b8ef4d4f61694e8fdc4114f9015cda584e',
    '771a3299824c27f5191278fead3ac107952eed1a1fed351e349367aa1761abe1'
  ]);
  const hash = (w) => crypto.createHash('sha256').update(w).digest('hex');
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT }).toString().split('\0').filter(Boolean);
  const hits = [];
  for (const f of files) {
    if (!/\.(m?js|cjs|ts|json|md|html|sh|ya?ml|py|txt|css|example|service|timer|desktop|toml|rules)$/i.test(f)) continue;
    if (f.endsWith('package-lock.json')) continue;
    let text;
    try {
      const stat = fs.statSync(path.join(ROOT, f));
      if (stat.size > 2_000_000) continue;
      text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    } catch { continue; }
    const seen = new Set(text.toLowerCase().match(/[a-z]+/g) || []);
    for (const w of seen) if (BLOCKED.has(hash(w))) hits.push(f);
  }
  assert.deepEqual([...new Set(hits)], [], 'use made-up names (Milo, Nova, Leo...) in code and fixtures');
});

if (failed) { console.error(`\n❌ ${failed} audit hardening check(s) failed`); process.exit(1); }
console.log('\nAll audit hardening checks passed');
