// Parent alerts from every host: app server first, then direct publish to the Pi's ntfy.
import assert from 'node:assert/strict';
import { sendParentAlert, getDirectNtfyConfig } from '../src/services/parentNotifyService.js';
import { buildNtfyRequest, NTFY_EVENT_KINDS } from '../src/services/ntfyEvents.js';
import { buildNtfyRequest as serverBuild } from '../server/ntfyService.js';

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✅ ${name}`); } catch (err) { failures++; console.error(`  ❌ ${name}\n     ${err.message}`); }
}
const json = (body, status = 200) => ({ ok: status < 300, status, headers: { get: () => 'application/json' }, json: async () => body });
const html = () => ({ ok: true, status: 200, headers: { get: () => 'text/html' }, json: async () => { throw new Error('html'); } });
const DIRECT = { url: 'https://meshlink.example.ts.net', token: 'tk_publishonly', topic: 'little-heroes' };
const detail = { kind: 'task_submitted', kidName: 'Mia', title: 'Brush teeth' };

console.log('🧪 Parent alerts on hosted sites');

await test('server and browser build the same whitelisted message', () => {
  const cfg = { url: 'http://pi:8090', topic: 'little-heroes', token: 't' };
  assert.deepEqual(serverBuild('reward_requested', detail, cfg), buildNtfyRequest('reward_requested', detail, cfg));
  assert.equal(buildNtfyRequest('anything_else', detail, cfg), null);
  assert.deepEqual(NTFY_EVENT_KINDS, ['task_submitted', 'reward_requested', 'boss_defeated']);
});

await test('uses the app server when /api/notify delivers (Pi, App Hosting)', async () => {
  const calls = [];
  const result = await sendParentAlert(detail, { directConfig: DIRECT, fetchImpl: async (url, init) => { calls.push(url); return json({ ok: true, sent: true }); } });
  assert.equal(result, 'server');
  assert.deepEqual(calls, ['/api/notify']);
});

await test('falls back to the Pi ntfy with the publish token on static hosts', async () => {
  const calls = [];
  const result = await sendParentAlert(detail, {
    directConfig: DIRECT,
    fetchImpl: async (url, init) => { calls.push({ url, init }); return url === '/api/notify' ? html() : { ok: true, status: 200 }; }
  });
  assert.equal(result, 'direct');
  assert.equal(calls[1].url, 'https://meshlink.example.ts.net/little-heroes');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer tk_publishonly');
  assert.equal(calls[1].init.body, 'Mia finished "Brush teeth" and is waiting for your approval.');
});

await test('falls back when the app server cannot reach ntfy (502)', async () => {
  const result = await sendParentAlert(detail, { directConfig: DIRECT, fetchImpl: async (url) => (url === '/api/notify' ? json({ ok: false }, 502) : { ok: true }) });
  assert.equal(result, 'direct');
});

await test('does nothing extra when no direct config is built in', async () => {
  const calls = [];
  const result = await sendParentAlert(detail, { directConfig: null, fetchImpl: async (url) => { calls.push(url); return html(); } });
  assert.equal(result, false);
  assert.equal(calls.length, 1);
});

await test('rejects unknown kinds before any request', async () => {
  let called = false;
  const result = await sendParentAlert({ kind: 'free_text', title: 'spam' }, { directConfig: DIRECT, fetchImpl: async () => { called = true; return json({}); } });
  assert.equal(result, false);
  assert.equal(called, false);
});

await test('direct config needs an https URL and a token', () => {
  assert.equal(getDirectNtfyConfig({ VITE_NTFY_PUBLIC_URL: 'http://insecure', VITE_NTFY_PUBLISH_TOKEN: 'tk' }), null);
  assert.equal(getDirectNtfyConfig({ VITE_NTFY_PUBLIC_URL: 'https://x.ts.net/' }), null);
  assert.deepEqual(getDirectNtfyConfig({ VITE_NTFY_PUBLIC_URL: 'https://x.ts.net/', VITE_NTFY_PUBLISH_TOKEN: 'tk' }), { url: 'https://x.ts.net', token: 'tk', topic: 'little-heroes' });
});

if (failures) { console.error(`\n❌ ${failures} parent alert check(s) failed`); process.exit(1); }
console.log('\n✅ All parent alert checks passed');
