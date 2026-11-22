// Approval alerts carry an "Open Action Inbox" link; the app routes it to the parent portal.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildNtfyRequest, DEFAULT_APP_URL } from '../src/services/ntfyEvents.js';
import { getNtfyConfig } from '../server/ntfyService.js';
import { getDirectNtfyConfig } from '../src/services/parentNotifyService.js';

let failures = 0;
async function test(name, fn) { try { await fn(); console.log(`  ✅ ${name}`); } catch (e) { failures++; console.error(`  ❌ ${name}\n     ${e.message}`); } }
const cfg = { url: 'http://pi:8090', topic: 'little-heroes', token: 'tk' };

console.log('🧪 Approval alert link');

await test('chore and reward alerts open the Action Inbox on the public site', () => {
  for (const kind of ['task_submitted', 'reward_requested']) {
    const { init } = buildNtfyRequest(kind, { kidName: 'Mia', title: 'Brush' }, cfg);
    assert.equal(init.headers.Click, `${DEFAULT_APP_URL}#/approvals`);
    assert.equal(init.headers.Actions, `view, Open Action Inbox, ${DEFAULT_APP_URL}#/approvals`);
  }
});
await test('boss alerts have no link, and the link can be turned off or must be https', () => {
  assert.equal(buildNtfyRequest('boss_defeated', {}, cfg).init.headers.Click, undefined);
  assert.equal(buildNtfyRequest('task_submitted', {}, { ...cfg, appUrl: '' }).init.headers.Click, undefined);
  assert.equal(buildNtfyRequest('task_submitted', {}, { ...cfg, appUrl: 'http://insecure.example/' }).init.headers.Click, undefined);
  assert.equal(buildNtfyRequest('task_submitted', {}, { ...cfg, appUrl: 'https://a.example, https://b.example' }).init.headers.Click, undefined);
  assert.equal(buildNtfyRequest('task_submitted', {}, { ...cfg, appUrl: 'https://custom.example' }).init.headers.Click, 'https://custom.example/#/approvals');
});
await test('server and browser configs read NTFY_APP_URL / VITE_APP_URL the same way', () => {
  assert.equal(getNtfyConfig({}).appUrl, undefined);
  assert.equal(getNtfyConfig({ NTFY_APP_URL: ' https://x.example ' }).appUrl, 'https://x.example');
  assert.equal(getNtfyConfig({ NTFY_APP_URL: '' }).appUrl, '');
  assert.equal(getDirectNtfyConfig({ VITE_NTFY_PUBLIC_URL: 'https://n.example', VITE_NTFY_PUBLISH_TOKEN: 't' }).appUrl, undefined);
  assert.equal(getDirectNtfyConfig({ VITE_NTFY_PUBLIC_URL: 'https://n.example', VITE_NTFY_PUBLISH_TOKEN: 't', VITE_APP_URL: '' }).appUrl, '');
});
await test('the app routes #/approvals and /approvals to the parent portal (behind the PIN)', () => {
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(/hash === 'approvals'/.test(main) && /path === '\/approvals'/.test(main) && /return 'parent_portal'/.test(main));
  const store = fs.readFileSync(new URL('../src/state/store.js', import.meta.url), 'utf8');
  assert.ok(/targetView === 'parent_portal' && !this\.isParentUnlocked\(\)/.test(store), 'the PIN gate must stay in front of the portal');
});

if (failures) { console.error(`\n❌ ${failures} approval link check(s) failed`); process.exit(1); }
console.log('\n✅ All approval link checks passed');
