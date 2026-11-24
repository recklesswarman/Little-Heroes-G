// Kids' tablet internet through the Pi's Pi-hole: YouTube Restricted Mode + SafeSearch rules,
// bedtime off / morning on, parent buttons, the Bedtime Sanctuary trigger, the App Hosting relay,
// the Pi-hole API client and the Parent Portal card.
import './setup_mock_env.js';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildRules, desiredState, isRoutineWindow, sanitizeTablets, sanitizeSettings, normalizeClient, inWindow, toMinutes,
  formatTime, msUntil, KIDS_GROUP, BEDTIME_GROUP, BEDTIME_ALLOW, SAFETY_TARGETS
} from '../shared/netGuard.js';
import { createNetGuardService } from '../server/netGuardService.js';
import { createPiholeClient } from '../server/piholeClient.js';
import { buildNtfyRequest } from '../src/services/ntfyEvents.js';
import { noteBedtimeStarted, netGuardRequest } from '../src/services/netGuardClient.js';
import { renderTabletInternetCard, _resetTabletInternetCard } from '../src/views/TabletInternetCard.js';

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✅ ${name}`); } catch (err) { failures++; console.error(`  ❌ ${name}\n     ${err.stack || err.message}`); }
}

const TZ = 'America/New_York';
// Wall-clock times on 2026-11-24 in New York (EST, UTC-5).
const at = (hhmm, day = 24) => {
  const [h, m] = hhmm.split(':').map(Number);
  return Date.UTC(2026, 10, day, h + 5, m);
};
const SAFE = {
  youtubeStrict: { v4: '216.239.38.120', v6: '2001:4860:4802:32::78' },
  youtubeModerate: { v4: '216.239.38.119', v6: '2001:4860:4802:32::77' },
  google: { v4: '216.239.38.120', v6: '2001:4860:4802:32::78' },
  bing: { v4: '204.79.197.220', v6: '' },
  duckduckgo: { v4: '52.149.246.39', v6: '' }
};
const HOST_V4 = { 'restrict.youtube.com': '216.239.38.120', 'restrictmoderate.youtube.com': '216.239.38.119', 'forcesafesearch.google.com': '216.239.38.120', 'strict.bing.com': '204.79.197.220' };
const TABLET = { id: 'nova-tab', name: "Nova's tablet", heroId: 'h_nova', client: 'aa-bb-cc-dd-ee-ff', offAt: '20:00', onAt: '07:00' };

function fakePihole() {
  const db = { groups: [{ id: 0, name: 'Default' }], domains: [], clients: [{ client: '192.168.1.50', comment: 'Dj laptop', groups: [0] }], calls: [] };
  const log = (name, arg) => db.calls.push([name, arg]);
  return {
    db,
    groups: async () => db.groups.map((g) => ({ ...g })),
    addGroup: async (name) => { log('addGroup', name); db.groups.push({ id: db.groups.length + 10, name }); },
    deleteGroup: async (name) => { log('deleteGroup', name); db.groups = db.groups.filter((g) => g.name !== name); },
    domains: async () => db.domains.map((d) => ({ ...d })),
    addDomain: async (d) => { log('addDomain', d.domain); db.domains.push({ ...d, enabled: true }); },
    updateDomain: async (d) => { log('updateDomain', d.domain); Object.assign(db.domains.find((x) => x.domain === d.domain && x.type === d.type), d); },
    deleteDomain: async (d) => { log('deleteDomain', d.domain); db.domains = db.domains.filter((x) => !(x.domain === d.domain && x.type === d.type)); },
    clients: async () => db.clients.map((c) => ({ ...c })),
    addClient: async (client, comment, groups) => { log('addClient', client); db.clients.push({ client, comment, groups }); },
    updateClient: async (client, comment, groups) => { log('updateClient', client); Object.assign(db.clients.find((c) => c.client.toUpperCase() === client.toUpperCase()), { comment, groups }); },
    deleteClient: async (client) => { log('deleteClient', client); db.clients = db.clients.filter((c) => c.client !== client); },
    devices: async () => [
      { hwaddr: 'aa:bb:cc:dd:ee:ff', macVendor: 'Samsung', lastQuery: Math.floor(at('19:58') / 1000), ips: [{ ip: '192.168.1.71', name: 'galaxy-tab' }] },
      { hwaddr: 'ip-10.0.0.9', macVendor: '', lastQuery: 1, ips: [{ ip: '10.0.0.9', name: '' }] }
    ],
    logout: async () => {}
  };
}

function makeService({ nowRef, pihole = fakePihole(), env = {}, notes = [] } = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'netguard-'));
  const service = createNetGuardService({
    env: { PIHOLE_URL: 'http://127.0.0.1', NETGUARD_FILE: path.join(dir, 'ng.json'), REPORT_TIME_ZONE: TZ, HOUSEHOLD_CODES: 'HERO42', ...env },
    pihole,
    resolver: { resolve4: async (h) => (HOST_V4[h] ? [HOST_V4[h]] : []), resolve6: async () => [] },
    notify: async (kind, data) => { notes.push([kind, data]); return { sent: true }; },
    now: () => nowRef.t
  });
  return { service, pihole, dir, notes };
}

function fakeRes() {
  const res = { statusCode: 200, headers: {}, body: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const lanReq = (body) => ({ body, headers: {}, socket: { remoteAddress: '192.168.1.71' } });

console.log('\n🛡️  Tablet internet guard (Pi-hole)');

await test('times, windows and client ids', () => {
  assert.equal(toMinutes('20:30'), 1230);
  assert.equal(formatTime('20:30'), '8:30 PM');
  assert.equal(formatTime('07:00'), '7:00 AM');
  assert.ok(inWindow(toMinutes('23:00'), toMinutes('20:00'), toMinutes('07:00')));
  assert.ok(inWindow(toMinutes('06:59'), toMinutes('20:00'), toMinutes('07:00')));
  assert.ok(!inWindow(toMinutes('07:00'), toMinutes('20:00'), toMinutes('07:00')));
  assert.equal(normalizeClient('aa-bb-cc-dd-ee-ff'), 'AA:BB:CC:DD:EE:FF');
  assert.equal(normalizeClient('192.168.1.71'), '192.168.1.71');
  assert.equal(normalizeClient('youtube.com'), '');
  assert.equal(normalizeClient('999.1.1.1'), '');
  assert.equal(msUntil('07:00', at('20:00'), TZ), 11 * 3600 * 1000);
});

await test('tablets and settings are cleaned up', () => {
  const list = sanitizeTablets([TABLET, { ...TABLET, id: 'dupe' }, { client: 'not-a-device' }, { id: 'x', client: '192.168.1.80', offAt: '25:00', onAt: 'soon', name: '<b>Milo</b>' }]);
  assert.equal(list.length, 2);
  assert.equal(list[0].client, 'AA:BB:CC:DD:EE:FF');
  assert.equal(list[1].offAt, '');
  assert.equal(list[1].onAt, '07:00');
  assert.ok(!list[1].name.includes('<'));
  assert.deepEqual(sanitizeSettings({ youtube: 'nope' }), { youtube: 'strict', safeSearch: true, alerts: true });
  assert.equal(sanitizeSettings({ youtube: 'moderate', safeSearch: false }).youtube, 'moderate');
});

await test('YouTube and SafeSearch rules answer with the safe address, kids group only', () => {
  const { rules, skipped } = buildRules({ youtube: 'strict', safeSearch: true }, SAFE);
  const yt = rules.filter((r) => r.comment.includes('YouTube'));
  assert.equal(yt.length, SAFETY_TARGETS[0].patterns.length);
  assert.ok(yt.every((r) => r.type === 'deny' && r.kind === 'regex' && r.group === KIDS_GROUP));
  assert.ok(yt[0].domain.endsWith(';reply=216.239.38.120;reply=2001:4860:4802:32::78'));
  assert.ok(rules.some((r) => r.domain.startsWith('^(www\\.)?bing\\.com$;reply=204.79.197.220')));
  assert.deepEqual(skipped, []);
  const moderate = buildRules({ youtube: 'moderate', safeSearch: false }, SAFE).rules;
  assert.ok(moderate.some((r) => r.domain.includes('216.239.38.119')));
  assert.ok(!moderate.some((r) => r.comment.includes('SafeSearch')));
  // No safe address found: skip that site rather than send it somewhere wrong.
  const missing = buildRules({}, { ...SAFE, duckduckgo: undefined });
  assert.deepEqual(missing.skipped, ['DuckDuckGo safe search']);
});

await test('YouTube patterns match the YouTube hosts and nothing the app needs', () => {
  const yt = SAFETY_TARGETS[0].patterns.map((p) => new RegExp(p));
  for (const host of ['www.youtube.com', 'm.youtube.com', 'youtube.com', 'youtubei.googleapis.com', 'youtube.googleapis.com', 'www.youtube-nocookie.com']) {
    assert.ok(yt.some((r) => r.test(host)), host);
  }
  for (const host of ['firestore.googleapis.com', 'music.youtube.com.evil.net', 'notyoutube.com']) assert.ok(!yt.some((r) => r.test(host)), host);
  const google = new RegExp(SAFETY_TARGETS[1].patterns[0]);
  for (const host of ['www.google.com', 'google.com', 'www.google.co.uk']) assert.ok(google.test(host), host);
  for (const host of ['accounts.google.com', 'mail.google.com', 'google.com.evil.net']) assert.ok(!google.test(host), host);
});

await test('bedtime still lets the app through, but not streaming', () => {
  const allow = BEDTIME_ALLOW.map((p) => new RegExp(p));
  const ok = (h) => allow.some((r) => r.test(h));
  for (const host of ['little-heroes-quest-8842.web.app', 'littleheroes-g1--little-heroes-quest-8842.us-east4.hosted.app', 'recklesswarman.github.io', 'firestore.googleapis.com', 'fonts.gstatic.com', 'connectivitycheck.gstatic.com', 'meshlink.tail9d175a.ts.net']) {
    assert.ok(ok(host), host);
  }
  for (const host of ['www.youtube.com', 'youtubei.googleapis.com', 'rr3---sn-abc.googlevideo.com', 'www.netflix.com', 'disneyplus.com', 'www.hulu.com', 'www.google.com', 'someone.github.io', 'evil-web.app']) {
    assert.ok(!ok(host), host);
  }
  const { rules } = buildRules({}, SAFE);
  assert.ok(rules.some((r) => r.group === BEDTIME_GROUP && r.type === 'deny' && r.domain === '.*'));
});

await test('schedule: off at curfew, on in the morning, routine and parent buttons win', () => {
  const t = sanitizeTablets([TABLET])[0];
  assert.equal(desiredState(t, {}, at('19:00'), TZ).online, true);
  assert.deepEqual([desiredState(t, {}, at('20:00'), TZ).online, desiredState(t, {}, at('20:00'), TZ).reason], [false, 'bedtime']);
  assert.equal(desiredState(t, {}, at('03:00', 25), TZ).online, false);
  assert.equal(desiredState(t, {}, at('07:00', 25), TZ).online, true);
  assert.equal(desiredState(t, { bedtimeUntil: { [t.id]: at('07:00', 25) } }, at('19:15'), TZ).reason, 'bedtime-routine');
  assert.equal(desiredState(t, { extendUntil: { [t.id]: at('20:15') } }, at('20:05'), TZ).reason, 'extra-time');
  assert.equal(desiredState(t, { overrides: { [t.id]: { mode: 'off', until: at('07:00', 25) } } }, at('12:00'), TZ).reason, 'parent-off');
  assert.equal(desiredState({ ...t, bedtime: false }, {}, at('22:00'), TZ).online, true);
  // Routine window: from 4 hours before the curfew until morning, never at lunchtime.
  assert.ok(isRoutineWindow(t, at('19:00'), TZ));
  assert.ok(!isRoutineWindow(t, at('12:00'), TZ));
  assert.ok(isRoutineWindow({ ...t, offAt: '' }, at('18:00'), TZ));
  assert.ok(!isRoutineWindow({ ...t, offAt: '' }, at('15:00'), TZ));
});

await test('adding a tablet makes the groups, rules and client in Pi-hole', async () => {
  const nowRef = { t: at('18:00') };
  const { service, pihole } = makeService({ nowRef });
  const out = await service.act({ action: 'save', settings: {}, tablets: [TABLET] });
  assert.equal(out.status, 200);
  const db = pihole.db;
  const kids = db.groups.find((g) => g.name === KIDS_GROUP).id;
  const bed = db.groups.find((g) => g.name === BEDTIME_GROUP).id;
  const client = db.clients.find((c) => c.client === 'AA:BB:CC:DD:EE:FF');
  assert.deepEqual(client.groups, [0, kids]);
  assert.ok(db.domains.some((d) => d.comment.includes('YouTube') && d.groups[0] === kids));
  assert.ok(db.domains.some((d) => d.domain === '.*' && d.groups[0] === bed));
  assert.equal(out.data.skipped.length, 1, 'DuckDuckGo has no resolved address in this test');
  assert.equal(out.data.devices[0].client, 'AA:BB:CC:DD:EE:FF');
  assert.equal(out.data.devices[0].name, 'galaxy-tab');
  assert.equal(out.data.tablets[0].lastQuery, Math.floor(at('19:58') / 1000));
  // Dj's own laptop is untouched.
  assert.deepEqual(db.clients.find((c) => c.client === '192.168.1.50').groups, [0]);
  // Saving the same thing again changes nothing.
  const before = db.calls.length;
  await service.act({ action: 'save', settings: {}, tablets: [TABLET] });
  assert.ok(!db.calls.slice(before).some(([n]) => /^(add|delete|update)/.test(n)), JSON.stringify(db.calls.slice(before)));
});

await test('curfew turns it off, morning turns it on, with phone alerts', async () => {
  const nowRef = { t: at('19:59') };
  const notes = [];
  const { service, pihole } = makeService({ nowRef, notes });
  await service.act({ action: 'save', settings: {}, tablets: [TABLET] });
  const bed = pihole.db.groups.find((g) => g.name === BEDTIME_GROUP).id;
  const groups = () => pihole.db.clients.find((c) => c.client === 'AA:BB:CC:DD:EE:FF').groups;
  nowRef.t = at('20:00');
  await service.reconcile();
  assert.ok(groups().includes(bed));
  assert.equal(notes.at(-1)[0], 'tablet_internet_off');
  nowRef.t = at('07:01', 25);
  await service.reconcile();
  assert.ok(!groups().includes(bed));
  assert.equal(notes.at(-1)[0], 'tablet_internet_on');
  assert.equal(notes.length, 2);
});

await test('Bedtime Sanctuary in the evening starts bedtime for that kid only', async () => {
  const nowRef = { t: at('12:00') };
  const { service, pihole } = makeService({ nowRef });
  const milo = { ...TABLET, id: 'milo-tab', heroId: 'h_milo', client: '192.168.1.72' };
  await service.act({ action: 'save', settings: {}, tablets: [TABLET, milo] });
  const bed = pihole.db.groups.find((g) => g.name === BEDTIME_GROUP).id;
  const groups = (c) => pihole.db.clients.find((x) => x.client === c).groups;
  let out = await service.act({ action: 'bedtime', heroId: 'h_nova' });
  assert.deepEqual(out.data.started, [], 'lunchtime does not count');
  nowRef.t = at('19:10');
  out = await service.act({ action: 'bedtime', heroId: 'h_nova' });
  assert.deepEqual(out.data.started, ['nova-tab']);
  assert.ok(groups('AA:BB:CC:DD:EE:FF').includes(bed));
  assert.ok(!groups('192.168.1.72').includes(bed));
});

await test('parent buttons: off now, on now, +15 min (max 60), back to schedule', async () => {
  const nowRef = { t: at('16:00') };
  const { service, pihole } = makeService({ nowRef });
  await service.act({ action: 'save', settings: {}, tablets: [TABLET] });
  const bed = pihole.db.groups.find((g) => g.name === BEDTIME_GROUP).id;
  const offline = () => pihole.db.clients.find((c) => c.client === 'AA:BB:CC:DD:EE:FF').groups.includes(bed);
  let out = await service.act({ action: 'off', tabletId: 'nova-tab' });
  assert.ok(offline());
  assert.equal(out.data.tablets[0].reason, 'parent-off');
  out = await service.act({ action: 'on', tabletId: 'nova-tab' });
  assert.ok(!offline());
  nowRef.t = at('20:30');
  await service.reconcile();
  assert.ok(offline(), '"on now" lasts until bedtime');
  for (let i = 0; i < 6; i++) out = await service.act({ action: 'extend', tabletId: 'nova-tab' });
  assert.ok(!offline());
  assert.equal(out.data.tablets[0].until, at('21:30'));
  out = await service.act({ action: 'auto', tabletId: 'nova-tab' });
  assert.ok(offline());
  assert.equal((await service.act({ action: 'off', tabletId: 'nope' })).status, 404);
});

await test('removing tablets puts Pi-hole back the way it was', async () => {
  const nowRef = { t: at('16:00') };
  const pihole = fakePihole();
  pihole.db.clients.push({ client: '192.168.1.72', comment: 'already here', groups: [0, 3] });
  const { service } = makeService({ nowRef, pihole });
  const milo = { ...TABLET, id: 'milo-tab', heroId: 'h_milo', client: '192.168.1.72' };
  await service.act({ action: 'save', settings: {}, tablets: [TABLET, milo] });
  await service.act({ action: 'save', settings: {}, tablets: [TABLET] });
  assert.deepEqual(pihole.db.clients.find((c) => c.client === '192.168.1.72').groups, [0, 3]);
  await service.act({ action: 'remove-all' });
  assert.ok(!pihole.db.clients.some((c) => c.client === 'AA:BB:CC:DD:EE:FF'));
  assert.ok(!pihole.db.domains.length);
  assert.ok(!pihole.db.groups.some((g) => g.name.startsWith('little-heroes')));
  assert.equal(pihole.db.clients.length, 2);
});

await test('requests need the family network (or relay token) and a household code', async () => {
  const nowRef = { t: at('16:00') };
  const { service } = makeService({ nowRef, env: { LOCAL_AI_RELAY_TOKEN: 'x'.repeat(32) } });
  let res = fakeRes();
  await service.handleRequest({ body: { householdCode: 'HERO42' }, headers: {}, socket: { remoteAddress: '8.8.8.8' } }, res);
  assert.equal(res.statusCode, 403);
  res = fakeRes();
  await service.handleRequest({ body: { householdCode: 'HERO42' }, headers: { 'x-forwarded-for': '1.2.3.4' }, socket: { remoteAddress: '127.0.0.1' } }, res);
  assert.equal(res.statusCode, 403, 'Funnel without the token');
  res = fakeRes();
  await service.handleRequest(lanReq({ householdCode: 'WRONG1' }), res);
  assert.equal(res.statusCode, 403);
  res = fakeRes();
  await service.handleRequest(lanReq({ householdCode: 'hero42', action: 'status' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.configured, true);
  res = fakeRes();
  await service.handleRequest({ body: { householdCode: 'HERO42', action: 'save', tablets: [TABLET] }, headers: { authorization: `Bearer ${'x'.repeat(32)}`, 'x-forwarded-for': '1.2.3.4' }, socket: { remoteAddress: '127.0.0.1' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.tablets.length, 1);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

await test('App Hosting relays to the Pi with the token; no Pi-hole and no relay = not configured', async () => {
  const sent = [];
  const fetchImpl = async (url, init) => { sent.push([url, init]); return { ok: true, status: 200, json: async () => ({ configured: true, tablets: [] }) }; };
  const hosted = createNetGuardService({ env: { PI_RELAY_URL: 'https://meshlink.tail9d175a.ts.net/pi-voice', PI_RELAY_TOKEN: 't'.repeat(32), NETGUARD_FILE: '/nonexistent/x.json' }, fetchImpl });
  if (hosted.config.local) return; // running on a machine that really has Pi-hole
  const res = fakeRes();
  await hosted.handleRequest({ body: { householdCode: 'HERO42', action: 'off', tabletId: 'nova-tab', junk: 'x' }, headers: {}, socket: {} }, res);
  assert.equal(sent[0][0], 'https://meshlink.tail9d175a.ts.net/pi-voice/netguard');
  assert.equal(sent[0][1].headers.Authorization, `Bearer ${'t'.repeat(32)}`);
  const body = JSON.parse(sent[0][1].body);
  assert.equal(body.action, 'off');
  assert.equal(body.junk, undefined);
  assert.equal(res.body.configured, true);
  const bare = createNetGuardService({ env: { NETGUARD_FILE: '/nonexistent/x.json' } });
  const res2 = fakeRes();
  await bare.handleRequest({ body: {}, headers: {}, socket: {} }, res2);
  assert.equal(res2.body.configured, false);
});

await test('Pi-hole API client logs in, retries once on 401 and encodes regex entries', async () => {
  const calls = [];
  let logins = 0;
  let expired = true;
  const fetchImpl = async (url, init) => {
    calls.push([init.method, url, init.headers['X-FTL-SID'] || '']);
    const json = (status, body) => ({ ok: status < 300, status, text: async () => JSON.stringify(body) });
    if (url.endsWith('/api/auth') && init.method === 'POST') {
      logins++;
      assert.deepEqual(JSON.parse(init.body), { password: 'pw' });
      return json(200, { session: { valid: true, sid: `sid${logins}`, validity: 300 } });
    }
    if (url.endsWith('/api/groups') && init.method === 'GET' && expired) { expired = false; return json(401, { error: { message: 'Unauthorized' } }); }
    if (url.endsWith('/api/groups') && init.method === 'GET') return json(200, { groups: [{ id: 0, name: 'Default' }] });
    if (init.method === 'PUT') return json(200, { processed: { errors: [] } });
    if (init.method === 'POST') return json(400, { error: { message: 'Bad request' } });
    return json(200, {});
  };
  const client = createPiholeClient({ config: { url: 'http://127.0.0.1' }, fetchImpl, getPassword: async () => 'pw' });
  const groups = await client.groups();
  assert.equal(groups[0].name, 'Default');
  assert.equal(logins, 2);
  assert.equal(calls.at(-1)[2], 'sid2');
  await client.updateDomain({ type: 'deny', kind: 'regex', domain: '^youtube\\.com$;reply=1.2.3.4', groups: [1], comment: 'c' });
  assert.ok(calls.at(-1)[1].endsWith('/api/domains/deny/regex/%5Eyoutube%5C.com%24%3Breply%3D1.2.3.4'));
  await assert.rejects(() => client.addGroup('x', 'y'), /Bad request/);
  const none = createPiholeClient({ config: { url: 'http://127.0.0.1' }, fetchImpl, getPassword: async () => '' });
  await assert.rejects(() => none.groups(), /No Pi-hole password/);
});

await test('phone alerts for internet off / on use fixed text', () => {
  const off = buildNtfyRequest('tablet_internet_off', { kidName: "Nova's tablet", title: 'bedtime' }, { url: 'http://127.0.0.1:8090', topic: 'little-heroes', appUrl: '' });
  assert.equal(off.init.body, "Nova's tablet's internet is off (bedtime). The Little Heroes app still works.");
  const on = buildNtfyRequest('tablet_internet_on', { kidName: "Nova's tablet" }, { url: 'http://x', topic: 't', appUrl: '' });
  assert.equal(on.init.body, "Nova's tablet's internet is back on.");
});

await test('Bedtime Sanctuary sends "bedtime" once per evening, never in the morning', async () => {
  const sent = [];
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const request = async (action, payload) => { sent.push([action, payload]); return {}; };
  const evening = new Date(2026, 10, 24, 19, 30).getTime();
  assert.equal(noteBedtimeStarted('h_nova', { nowMs: new Date(2026, 10, 24, 9, 0).getTime(), storage, request }), false);
  assert.equal(noteBedtimeStarted('h_nova', { nowMs: evening, storage, request }), true);
  assert.equal(noteBedtimeStarted('h_nova', { nowMs: evening + 60000, storage, request }), false);
  assert.equal(noteBedtimeStarted('h_milo', { nowMs: evening, storage, request }), true);
  assert.equal(noteBedtimeStarted('', { nowMs: evening, storage, request }), false);
  await Promise.resolve();
  assert.deepEqual(sent.map(([a, p]) => [a, p.heroId]), [['bedtime', 'h_nova'], ['bedtime', 'h_milo']]);
});

await test('client needs the household code and posts to /api/netguard', async () => {
  const noCode = await netGuardRequest('status', {}, { state: {}, fetchImpl: async () => { throw new Error('no call'); } });
  assert.equal(noCode.configured, false);
  let seen;
  const data = await netGuardRequest('off', { tabletId: 'nova-tab' }, {
    state: { household: { syncCode: 'hero42' } },
    fetchImpl: async (url, init) => { seen = [url, JSON.parse(init.body)]; return { headers: { get: () => 'application/json' }, json: async () => ({ ok: true, configured: true }) }; }
  });
  assert.ok(seen[0].endsWith('/api/netguard'));
  assert.deepEqual(seen[1], { tabletId: 'nova-tab', action: 'off', householdCode: 'HERO42' });
  assert.equal(data.ok, true);
});

await test('Parent Portal card shows each tablet, its status and the setup steps', () => {
  _resetTabletInternetCard({
    configured: true, now: at('20:10'), settings: { youtube: 'strict', safeSearch: true, alerts: true }, skipped: [],
    tablets: [{ ...sanitizeTablets([TABLET])[0], online: false, reason: 'bedtime', until: at('07:00', 25), lastQuery: Math.floor(at('20:05') / 1000) }],
    devices: [{ client: '192.168.1.72', ip: '192.168.1.72', name: 'milo-tab', vendor: 'Lenovo', lastQuery: 0 }]
  });
  const html = renderTabletInternetCard();
  assert.ok(html.includes('Nova&#39;s tablet') || html.includes("Nova's tablet"));
  assert.ok(html.includes('Internet off: bedtime'));
  assert.ok(html.includes('Off at 8:00 PM'));
  assert.ok(html.includes('Last seen 5 min ago'));
  assert.ok(html.includes('data-netguard-action="on"'));
  assert.ok(html.includes('milo-tab'));
  assert.ok(html.includes('Private DNS'));
  assert.ok(html.includes('192.168.1.163'));
  _resetTabletInternetCard({ configured: false, error: 'The family Pi did not answer' });
  assert.ok(renderTabletInternetCard().includes('The family Pi did not answer'));
  _resetTabletInternetCard(null);
});

await test('wired into server.js, the dev server, the Parent Portal, bedtime and the Pi deploy', () => {
  const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  assert.ok(read('server.js').includes("app.post('/api/netguard'"));
  assert.ok(read('server.js').includes("app.post('/api/local/netguard'"));
  assert.ok(read('server.js').includes('netGuardService.start()'));
  assert.ok(read('vite.config.js').includes("'/api/netguard'"));
  assert.ok(read('src/views/ParentPortalView.js').includes('renderTabletInternetCard()'));
  assert.ok(read('src/views/ParentPortalView.js').includes('bindTabletInternetCard()'));
  assert.ok(read('src/views/BedtimeStoryView.js').includes('noteBedtimeStarted('));
  assert.ok(read('scripts/pi/install-extras.sh').includes('setup-netguard.sh'));
  assert.ok(read('scripts/pi/setup-netguard.sh').includes('usermod -aG pihole'));
});

if (failures) {
  console.error(`\n❌ ${failures} tablet internet test(s) failed`);
  process.exit(1);
}
console.log('\n✅ Tablet internet guard tests passed');
