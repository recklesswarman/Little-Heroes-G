// Tablet internet guard: YouTube Restricted Mode + SafeSearch all day, and internet off at
// bedtime, for the kids' tablets only, through the Pi-hole on the family Pi.
// Rules and the schedule live in shared/netGuard.js; the Pi-hole API client in server/piholeClient.js.
//
// On the Pi (Pi-hole installed, /etc/pihole/pihole.toml): this module talks to Pi-hole and checks
//   every minute whether a tablet should go off or come back. Settings are kept in NETGUARD_FILE
//   (default ~/apps/little-heroes-netguard.json). Nothing is changed in Pi-hole until a parent adds
//   a tablet in Parent Portal > Screen Time.
// On App Hosting (and so GitHub Pages / Firebase Hosting, which call it): requests are relayed to
//   the Pi over the same Tailscale Funnel path and token Rex's voice uses (PI_RELAY_URL / _TOKEN).
//
// Every request needs one of the family's household codes (HOUSEHOLD_CODES on the Pi), and the Pi
// also needs the family network or the relay token. The parent PIN guards the buttons in the app.
//   NETGUARD=off          turn the whole feature off on this server
//   NETGUARD_FILE         where the settings are saved
//   PIHOLE_URL            Pi-hole web address (default http://127.0.0.1); also marks Pi-hole as present
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { promises as dns } from 'node:dns';
import os from 'node:os';
import path from 'node:path';
import {
  BEDTIME_GROUP, EXTEND_MINUTES, KIDS_GROUP, MAX_EXTEND_MINUTES, NETGUARD_TAG, REASON_TEXT, SAFE_HOSTS,
  buildRules, desiredState, isRoutineWindow, msUntil, normalizeClient, sanitizeSettings, sanitizeTablets
} from '../shared/netGuard.js';
import { createPiholeClient, getPiholeConfig } from './piholeClient.js';
import { isFamilyNetworkRequest, hasValidRelayToken } from './localAiService.js';
import { getPiRelayConfig } from './piRelayService.js';
import { isKnownHouseholdCode } from './calendarService.js';
import { sendNtfy } from './ntfyService.js';

const TICK_MS = 60 * 1000;
const RULES_REFRESH_MS = 6 * 60 * 60 * 1000;
const RELAY_TIMEOUT_MS = 20000;
const ACTIONS = new Set(['status', 'save', 'off', 'on', 'extend', 'auto', 'bedtime', 'remove-all']);

export function getNetGuardConfig(env = process.env) {
  const off = String(env.NETGUARD || '').toLowerCase() === 'off';
  const hasPihole = Boolean(String(env.PIHOLE_URL || '').trim()) || existsSync('/etc/pihole/pihole.toml');
  return {
    local: !off && hasPihole,
    off,
    file: String(env.NETGUARD_FILE || path.join(os.homedir(), 'apps', 'little-heroes-netguard.json')),
    timeZone: String(env.REPORT_TIME_ZONE || env.CALENDAR_TIME_ZONE || 'America/New_York').trim()
  };
}

function emptyState() {
  return { settings: sanitizeSettings({}), tablets: [], overrides: {}, extendUntil: {}, bedtimeUntil: {}, applied: {}, managed: {}, rulesAt: 0, skipped: [] };
}

function sameGroups(a = [], b = []) {
  const x = [...a].map(Number).sort((m, n) => m - n);
  const y = [...b].map(Number).sort((m, n) => m - n);
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

async function resolveSafe(host, resolver) {
  const [v4, v6] = await Promise.all([
    resolver.resolve4(host).then((a) => a[0] || '').catch(() => ''),
    resolver.resolve6(host).then((a) => a[0] || '').catch(() => '')
  ]);
  return v4 ? { v4, v6 } : null;
}

export function createNetGuardService({
  env = process.env,
  fetchImpl = globalThis.fetch,
  pihole = null,
  resolver = dns,
  notify = (kind, data) => sendNtfy(kind, data),
  now = () => Date.now(),
  fileIo = { readFile, writeFile, rename, mkdir }
} = {}) {
  const config = getNetGuardConfig(env);
  const api = pihole || (config.local ? createPiholeClient({ config: getPiholeConfig(env), fetchImpl }) : null);
  let state = null;
  let queue = Promise.resolve();
  let lastError = '';
  let safeCache = { at: 0, addrs: {} };
  let timer = null;

  // One change at a time: the minute check and parent buttons never interleave.
  function serial(fn) {
    const run = queue.then(fn, fn);
    queue = run.catch(() => {});
    return run;
  }

  async function load() {
    if (state) return state;
    try {
      const saved = JSON.parse(await fileIo.readFile(config.file, 'utf8'));
      state = { ...emptyState(), ...saved, settings: sanitizeSettings(saved.settings), tablets: sanitizeTablets(saved.tablets) };
    } catch {
      state = emptyState();
    }
    return state;
  }

  async function persist() {
    const tmp = `${config.file}.tmp`;
    await fileIo.mkdir(path.dirname(config.file), { recursive: true });
    await fileIo.writeFile(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
    await fileIo.rename(tmp, config.file);
  }

  async function safeAddresses() {
    if (now() - safeCache.at < RULES_REFRESH_MS && Object.keys(safeCache.addrs).length) return safeCache.addrs;
    const addrs = {};
    for (const [key, host] of Object.entries(SAFE_HOSTS)) {
      const found = await resolveSafe(host, resolver);
      if (found) addrs[key] = found;
      else if (safeCache.addrs[key]) addrs[key] = safeCache.addrs[key]; // keep the last good answer
    }
    safeCache = { at: now(), addrs };
    return addrs;
  }

  async function groupIds() {
    let groups = await api.groups();
    for (const [name, comment] of [[KIDS_GROUP, 'Little Heroes: kids\' tablets (YouTube Restricted, SafeSearch)'], [BEDTIME_GROUP, 'Little Heroes: tablets in bedtime (internet off, app still works)']]) {
      if (!groups.some((g) => g.name === name)) {
        await api.addGroup(name, comment);
        groups = await api.groups();
      }
    }
    const id = (name) => groups.find((g) => g.name === name)?.id;
    return { kids: id(KIDS_GROUP), bedtime: id(BEDTIME_GROUP) };
  }

  async function ensureRules(ids) {
    const { rules, skipped } = buildRules(state.settings, await safeAddresses());
    const want = rules.map((r) => ({ ...r, groups: [r.group === KIDS_GROUP ? ids.kids : ids.bedtime] }));
    const have = (await api.domains()).filter((d) => String(d.comment || '').startsWith(`${NETGUARD_TAG}:`));
    const key = (d) => `${d.type}|${d.kind}|${d.domain}`;
    const haveMap = new Map(have.map((d) => [key(d), d]));
    const wantKeys = new Set(want.map(key));
    for (const d of have) if (!wantKeys.has(key(d))) await api.deleteDomain(d);
    for (const d of want) {
      const existing = haveMap.get(key(d));
      if (!existing) await api.addDomain(d);
      else if (!sameGroups(existing.groups, d.groups) || existing.enabled === false) await api.updateDomain(d);
    }
    state.rulesAt = now();
    state.skipped = skipped;
  }

  async function applyClients(ids, { notifyChanges = true } = {}) {
    const t = now();
    const existing = await api.clients();
    const find = (client) => existing.find((c) => String(c.client || '').toUpperCase() === client.toUpperCase());
    const changes = [];
    for (const tablet of state.tablets) {
      const want = desiredState(tablet, state, t, config.timeZone);
      const groups = [0, ids.kids, ...(want.online ? [] : [ids.bedtime])];
      const comment = `${NETGUARD_TAG}: ${tablet.name}`;
      const current = find(tablet.client);
      if (!current) {
        await api.addClient(tablet.client, comment, groups);
        state.managed[tablet.client] = { created: true };
      } else {
        if (!state.managed[tablet.client]) state.managed[tablet.client] = { created: false, groups: current.groups || [0] };
        if (!sameGroups(current.groups, groups)) await api.updateClient(tablet.client, comment, groups);
      }
      const was = state.applied[tablet.id];
      state.applied[tablet.id] = want.online;
      if (was !== undefined && was !== want.online) changes.push({ tablet, want });
    }
    // Tablets a parent removed: give the device back its old Pi-hole setup.
    for (const [client, info] of Object.entries(state.managed)) {
      if (state.tablets.some((tb) => tb.client === client)) continue;
      if (info.created) await api.deleteClient(client);
      else if (find(client)) await api.updateClient(client, '', Array.isArray(info.groups) && info.groups.length ? info.groups : [0]);
      delete state.managed[client];
    }
    for (const id of Object.keys(state.applied)) if (!state.tablets.some((tb) => tb.id === id)) delete state.applied[id];
    if (notifyChanges && state.settings.alerts) {
      for (const { tablet, want } of changes) {
        notify(want.online ? 'tablet_internet_on' : 'tablet_internet_off', { kidName: tablet.name, title: REASON_TEXT[want.reason] || '' }).catch?.(() => {});
      }
    }
  }

  function pruneTimers() {
    const t = now();
    for (const bag of [state.overrides, state.extendUntil, state.bedtimeUntil]) {
      for (const [id, v] of Object.entries(bag)) {
        const until = typeof v === 'object' ? v?.until : v;
        if (!(until > t) || !state.tablets.some((tb) => tb.id === id)) delete bag[id];
      }
    }
  }

  async function reconcile({ forceRules = false, notifyChanges = true } = {}) {
    await load();
    pruneTimers();
    if (!api) return;
    const nothingToDo = !state.tablets.length && !Object.keys(state.managed).length;
    if (nothingToDo && !forceRules) return;
    try {
      const ids = await groupIds();
      if (forceRules || now() - (state.rulesAt || 0) > RULES_REFRESH_MS) await ensureRules(ids);
      await applyClients(ids, { notifyChanges });
      lastError = '';
    } catch (err) {
      lastError = err?.message || String(err);
      throw err;
    } finally {
      await persist().catch(() => {});
      await api.logout?.();
    }
  }

  async function removeAll() {
    await load();
    state.tablets = [];
    state.overrides = {};
    state.extendUntil = {};
    state.bedtimeUntil = {};
    if (api) {
      const ids = await groupIds().catch(() => null);
      if (ids) await applyClients(ids, { notifyChanges: false });
      for (const d of await api.domains()) if (String(d.comment || '').startsWith(`${NETGUARD_TAG}:`)) await api.deleteDomain(d);
      for (const name of [KIDS_GROUP, BEDTIME_GROUP]) await api.deleteGroup(name).catch(() => {});
      await api.logout?.();
    }
    state.rulesAt = 0;
    await persist();
  }

  function mapDevices(devices) {
    return (devices || [])
      .map((d) => {
        const mac = normalizeClient(d.hwaddr);
        const ips = (d.ips || []).map((x) => ({ ip: String(x.ip || ''), name: String(x.name || '') }));
        const ip = (ips.find((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x.ip)) || ips[0] || {}).ip || '';
        return {
          client: mac || normalizeClient(ip),
          mac,
          ip,
          name: (ips.find((x) => x.name) || {}).name || '',
          vendor: String(d.macVendor || '').slice(0, 40),
          lastQuery: Number(d.lastQuery) || 0
        };
      })
      .filter((d) => d.client)
      .sort((a, b) => b.lastQuery - a.lastQuery)
      .slice(0, 30);
  }

  async function status({ includeDevices = false } = {}) {
    await load();
    const t = now();
    let devices = [];
    let piholeOk = Boolean(api);
    if (api && includeDevices) {
      try {
        devices = mapDevices(await api.devices());
        await api.logout?.();
      } catch (err) {
        piholeOk = false;
        lastError = err?.message || String(err);
      }
    }
    const seen = new Map(devices.flatMap((d) => [[d.mac, d], [d.ip, d]]).filter(([k]) => k));
    return {
      configured: true,
      piholeOk: piholeOk && !lastError,
      error: lastError,
      now: t,
      timeZone: config.timeZone,
      settings: state.settings,
      skipped: state.skipped || [],
      tablets: state.tablets.map((tablet) => {
        const want = desiredState(tablet, state, t, config.timeZone);
        const dev = seen.get(tablet.client);
        return { ...tablet, online: want.online, reason: want.reason, until: want.until, lastQuery: dev ? dev.lastQuery : null };
      }),
      devices: includeDevices ? devices : undefined
    };
  }

  async function act(body) {
    await load();
    const t = now();
    const tablet = state.tablets.find((tb) => tb.id === String(body.tabletId || ''));
    switch (body.action) {
      case 'save': {
        state.settings = sanitizeSettings(body.settings);
        state.tablets = sanitizeTablets(body.tablets);
        await reconcile({ forceRules: true, notifyChanges: false });
        break;
      }
      case 'off':
      case 'on':
        if (!tablet) return { status: 404, data: { error: 'Unknown tablet' } };
        state.overrides[tablet.id] = { mode: body.action, until: t + msUntil(body.action === 'off' ? tablet.onAt : (tablet.offAt || tablet.onAt), t, config.timeZone) };
        delete state.extendUntil[tablet.id];
        await reconcile();
        break;
      case 'extend': {
        if (!tablet) return { status: 404, data: { error: 'Unknown tablet' } };
        delete state.overrides[tablet.id];
        const from = Math.max(t, state.extendUntil[tablet.id] || 0);
        state.extendUntil[tablet.id] = Math.min(from + EXTEND_MINUTES * 60000, t + MAX_EXTEND_MINUTES * 60000);
        await reconcile();
        break;
      }
      case 'auto':
        if (!tablet) return { status: 404, data: { error: 'Unknown tablet' } };
        delete state.overrides[tablet.id];
        delete state.extendUntil[tablet.id];
        await reconcile();
        break;
      case 'bedtime': {
        // The kid opened the Bedtime Sanctuary. Only counts in the evening (see isRoutineWindow).
        const heroId = String(body.heroId || '');
        const started = [];
        for (const tb of state.tablets.filter((x) => x.heroId && x.heroId === heroId && x.bedtime)) {
          if (!isRoutineWindow(tb, t, config.timeZone) || state.extendUntil[tb.id] > t) continue;
          state.bedtimeUntil[tb.id] = t + msUntil(tb.onAt, t, config.timeZone);
          started.push(tb.id);
        }
        if (started.length) await reconcile();
        return { status: 200, data: { ok: true, started } };
      }
      case 'remove-all':
        await removeAll();
        break;
      default:
        break;
    }
    return { status: 200, data: { ok: true, ...(await status({ includeDevices: body.action === 'save' })) } };
  }

  async function relayToPi(body) {
    const cfg = getPiRelayConfig(env);
    if (!cfg) return null;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);
    try {
      const res = await fetchImpl(`${cfg.url}/netguard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const data = await res.json().catch(() => null);
      return { status: res.ok ? 200 : (res.status === 403 || res.status === 404 ? res.status : 502), data: data || { configured: false, error: 'The family Pi did not answer' } };
    } catch {
      return { status: 502, data: { configured: false, error: 'The family Pi did not answer' } };
    } finally {
      clearTimeout(t);
    }
  }

  /** POST /api/netguard (any host) and /api/local/netguard (the Pi end of the relay). */
  async function handleRequest(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const raw = req.body && typeof req.body === 'object' ? req.body : {};
    const action = ACTIONS.has(raw.action) ? raw.action : 'status';
    const body = {
      householdCode: String(raw.householdCode || ''),
      action,
      tabletId: raw.tabletId,
      heroId: raw.heroId,
      includeDevices: raw.includeDevices === true,
      settings: raw.settings,
      tablets: raw.tablets
    };
    if (config.off) return res.json({ configured: false });
    if (!config.local) {
      const relayed = await relayToPi(body);
      if (relayed) return res.status(relayed.status).json(relayed.data);
      return res.json({ configured: false });
    }
    if (!(isFamilyNetworkRequest(req) || hasValidRelayToken(req, env))) {
      return res.status(403).json({ configured: false, error: 'Tablet internet controls only work on the family network' });
    }
    if (!isKnownHouseholdCode(body.householdCode, env)) {
      return res.status(403).json({ configured: false, error: 'Unknown household' });
    }
    try {
      if (action === 'status') return res.json(await serial(() => status({ includeDevices: body.includeDevices })));
      const out = await serial(() => act(body));
      return res.status(out.status).json(out.data);
    } catch (err) {
      console.warn('Tablet internet (Pi-hole) change failed:', err?.message || err);
      const data = await status().catch(() => ({ configured: true }));
      return res.status(502).json({ ...data, ok: false, piholeOk: false, error: err?.message || 'Pi-hole change failed' });
    }
  }

  function start() {
    if (!config.local || timer) return;
    const tick = () => serial(() => reconcile()).catch((err) => console.warn('Tablet internet check failed:', err?.message || err));
    timer = setInterval(tick, TICK_MS);
    timer.unref?.();
    setTimeout(tick, 5000).unref?.();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { config, handleRequest, reconcile: (o) => serial(() => reconcile(o)), act: (b) => serial(() => act(b)), status, start, stop, _state: () => state };
}

export const netGuardService = createNetGuardService();
