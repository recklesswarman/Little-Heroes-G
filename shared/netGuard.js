// Tablet internet guard (Pi-hole on the family Pi), shared by the server (server/netGuardService.js),
// the Parent Portal card (src/views/TabletInternetCard.js) and the tests.
//
//  - Safety, all day, only on the kids' tablets: YouTube Restricted Mode and SafeSearch on Google,
//    Bing and DuckDuckGo. Pi-hole answers those sites with the "safe" server's address (regex
//    ;reply=), which is how Google, Microsoft and DuckDuckGo ask networks to force safe mode.
//  - Bedtime: the tablet's internet goes off when its kid opens the Bedtime Sanctuary in the
//    evening, or at the kid's Bedtime Curfew at the latest, and comes back at the morning time.
//    The Little Heroes app (and the few hosts it needs) keeps working, so bedtime stories do too.
// Pure functions only: no network, no file access.

export const NETGUARD_TAG = 'little-heroes';
export const KIDS_GROUP = 'little-heroes-kids';
export const BEDTIME_GROUP = 'little-heroes-bedtime';
export const MAX_TABLETS = 6;
export const EXTEND_MINUTES = 15;
export const MAX_EXTEND_MINUTES = 60;
// The Bedtime Sanctuary only starts bedtime when it's opened this close to the curfew (or later).
export const ROUTINE_LEAD_MINUTES = 4 * 60;
export const DEFAULT_MORNING = '07:00';
export const DEFAULT_SETTINGS = Object.freeze({ youtube: 'strict', safeSearch: true, alerts: true });

// Names whose address Pi-hole hands out instead of the real site (resolved on the Pi).
export const SAFE_HOSTS = Object.freeze({
  youtubeStrict: 'restrict.youtube.com',
  youtubeModerate: 'restrictmoderate.youtube.com',
  google: 'forcesafesearch.google.com',
  bing: 'strict.bing.com',
  duckduckgo: 'safe.duckduckgo.com'
});

// Sites that get the safe answer. YouTube's list is Google's own list for DNS Restricted Mode.
export const SAFETY_TARGETS = Object.freeze([
  { key: 'youtube', label: 'YouTube Restricted Mode', patterns: ['^((www|m)\\.)?youtube\\.com$', '^youtubei?\\.googleapis\\.com$', '^www\\.youtube-nocookie\\.com$'] },
  { key: 'google', label: 'Google SafeSearch', patterns: ['^(www\\.)?google\\.[a-z]{2,3}(\\.[a-z]{2})?$'] },
  { key: 'bing', label: 'Bing SafeSearch', patterns: ['^(www\\.)?bing\\.com$'] },
  { key: 'duckduckgo', label: 'DuckDuckGo safe search', patterns: ['^(www\\.)?duckduckgo\\.com$'] }
]);

// During bedtime everything is blocked for the tablet except these, so the app still opens,
// syncs and reads bedtime stories. Kept narrow on purpose: no googlevideo / youtube / netflix.
export const BEDTIME_ALLOW = Object.freeze([
  '^recklesswarman\\.github\\.io$',
  '(^|\\.)little-heroes-quest-8842\\.(web\\.app|firebaseapp\\.com|firebasestorage\\.app)$',
  '^littleheroes-g1--little-heroes-quest-8842\\.us-east4\\.hosted\\.app$',
  '^meshlink\\.tail9d175a\\.ts\\.net$',
  '^(firestore|firebase|firebaseinstallations|firebasestorage|identitytoolkit|securetoken|storage|fonts|www)\\.googleapis\\.com$',
  '(^|\\.)gstatic\\.com$',
  '^lh3\\.googleusercontent\\.com$',
  '^(prod|my)\\.spline\\.design$',
  '^modelviewer\\.dev$',
  '^cdn\\.jsdelivr\\.net$',
  '^raw\\.githubusercontent\\.com$',
  '^little-heroes-free-image-api\\.recklesswarman\\.workers\\.dev$',
  '^storyweaver\\.org\\.in$'
]);
export const BEDTIME_BLOCK_ALL = '.*';

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAC = /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i;
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

export function isTime(value) {
  return typeof value === 'string' && HHMM.test(value);
}

export function toMinutes(hhmm) {
  const m = HHMM.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** "20:30" -> "8:30 PM" */
export function formatTime(hhmm) {
  const mins = toMinutes(hhmm);
  if (mins === null) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** A tablet's Pi-hole client id: a MAC address (upper case) or an IPv4 address, else ''. */
export function normalizeClient(value) {
  const v = String(value || '').trim();
  if (MAC.test(v)) return v.replace(/-/g, ':').toUpperCase();
  if (IPV4.test(v)) return v;
  return '';
}

function cleanName(value, max = 30) {
  return String(value || '').replace(/[^\p{L}\p{N} '._-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function sanitizeSettings(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    youtube: ['strict', 'moderate', 'off'].includes(r.youtube) ? r.youtube : DEFAULT_SETTINGS.youtube,
    safeSearch: r.safeSearch === undefined ? DEFAULT_SETTINGS.safeSearch : r.safeSearch === true,
    alerts: r.alerts === undefined ? DEFAULT_SETTINGS.alerts : r.alerts === true
  };
}

export function sanitizeTablet(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const client = normalizeClient(r.client);
  if (!client) return null;
  const id = String(r.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || `tablet-${client.replace(/[^0-9a-f]/gi, '').toLowerCase().slice(-8)}`;
  return {
    id,
    name: cleanName(r.name) || 'Tablet',
    heroId: String(r.heroId || '').slice(0, 60),
    client,
    // Bedtime Curfew of the kid (Parent Portal > Screen Time). '' = no fixed time, the Bedtime
    // Sanctuary still turns the internet off for the night.
    offAt: isTime(r.offAt) ? r.offAt : '',
    onAt: isTime(r.onAt) ? r.onAt : DEFAULT_MORNING,
    bedtime: r.bedtime !== false
  };
}

export function sanitizeTablets(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const t = sanitizeTablet(raw);
    if (!t || seen.has(t.id) || seen.has(t.client)) continue;
    seen.add(t.id);
    seen.add(t.client);
    out.push(t);
    if (out.length >= MAX_TABLETS) break;
  }
  return out;
}

/** Local wall-clock minutes (0-1439) and date key in a time zone. */
export function localClock(nowMs, timeZone = 'America/New_York') {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(nowMs));
  } catch {
    parts = new Intl.DateTimeFormat('en-US', { hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(nowMs));
  }
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  return { minutes: (Number(get('hour')) % 24) * 60 + Number(get('minute')), date: `${get('year')}-${get('month')}-${get('day')}` };
}

/** True when `minutes` is inside [from, to), wrapping past midnight. */
export function inWindow(minutes, from, to) {
  if (from === null || to === null || from === to) return false;
  return from < to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
}

/** Milliseconds from now until the wall clock next reads `hhmm` (whole minutes). */
export function msUntil(hhmm, nowMs, timeZone) {
  const target = toMinutes(hhmm);
  if (target === null) return 12 * 60 * 60 * 1000;
  const { minutes } = localClock(nowMs, timeZone);
  const seconds = Math.floor(nowMs / 1000) % 60;
  let diff = (target - minutes + 1440) % 1440;
  if (diff === 0) diff = 1440;
  return diff * 60000 - seconds * 1000;
}

/** Is now a time when opening the Bedtime Sanctuary should start the tablet's bedtime? */
export function isRoutineWindow(tablet, nowMs, timeZone) {
  const { minutes } = localClock(nowMs, timeZone);
  const on = toMinutes(tablet.onAt) ?? toMinutes(DEFAULT_MORNING);
  const off = toMinutes(tablet.offAt);
  // Without a curfew: any time from 5 PM until the morning time.
  const from = off === null ? 17 * 60 : (off - ROUTINE_LEAD_MINUTES + 1440) % 1440;
  return inWindow(minutes, from, on);
}

/**
 * Should this tablet be online right now, and why?
 * state = { overrides: {id: {mode:'on'|'off', until}}, extendUntil: {id: ms}, bedtimeUntil: {id: ms} }
 */
export function desiredState(tablet, state = {}, nowMs = Date.now(), timeZone = 'America/New_York') {
  const override = state.overrides?.[tablet.id];
  if (override && override.until > nowMs) {
    return { online: override.mode === 'on', reason: override.mode === 'on' ? 'parent-on' : 'parent-off', until: override.until };
  }
  const extend = state.extendUntil?.[tablet.id] || 0;
  if (extend > nowMs) return { online: true, reason: 'extra-time', until: extend };
  if (!tablet.bedtime) return { online: true, reason: 'no-bedtime', until: 0 };
  const { minutes } = localClock(nowMs, timeZone);
  const on = toMinutes(tablet.onAt);
  const off = toMinutes(tablet.offAt);
  if (off !== null && inWindow(minutes, off, on)) {
    return { online: false, reason: 'bedtime', until: nowMs + msUntil(tablet.onAt, nowMs, timeZone) };
  }
  const routine = state.bedtimeUntil?.[tablet.id] || 0;
  if (routine > nowMs) return { online: false, reason: 'bedtime-routine', until: routine };
  return { online: true, reason: 'schedule', until: off === null ? 0 : nowMs + msUntil(tablet.offAt, nowMs, timeZone) };
}

export const REASON_TEXT = Object.freeze({
  'parent-on': 'turned on by a parent',
  'parent-off': 'turned off by a parent',
  'extra-time': 'extra time',
  'no-bedtime': 'no bedtime limit',
  bedtime: 'bedtime',
  'bedtime-routine': 'bedtime routine started',
  schedule: 'daytime'
});

function regexReply(pattern, addrs) {
  const parts = [pattern];
  if (addrs?.v4) parts.push(`reply=${addrs.v4}`);
  if (addrs?.v6) parts.push(`reply=${addrs.v6}`);
  return parts.join(';');
}

/**
 * The Pi-hole domain entries this feature wants, given settings and the resolved safe addresses
 * ({ youtubeStrict: {v4, v6}, ... }). A target whose safe address couldn't be found is skipped
 * (and reported), never pointed at a wrong address.
 */
export function buildRules(settings, safeAddrs = {}) {
  const s = sanitizeSettings(settings);
  const rules = [];
  const skipped = [];
  for (const target of SAFETY_TARGETS) {
    let key = null;
    if (target.key === 'youtube') key = s.youtube === 'off' ? null : s.youtube === 'moderate' ? 'youtubeModerate' : 'youtubeStrict';
    else if (s.safeSearch) key = target.key;
    if (!key) continue;
    const addrs = safeAddrs[key];
    if (!addrs?.v4) {
      skipped.push(target.label);
      continue;
    }
    for (const pattern of target.patterns) {
      rules.push({ type: 'deny', kind: 'regex', domain: regexReply(pattern, addrs), group: KIDS_GROUP, comment: `${NETGUARD_TAG}: ${target.label}` });
    }
  }
  rules.push({ type: 'deny', kind: 'regex', domain: BEDTIME_BLOCK_ALL, group: BEDTIME_GROUP, comment: `${NETGUARD_TAG}: bedtime, internet off` });
  for (const pattern of BEDTIME_ALLOW) {
    rules.push({ type: 'allow', kind: 'regex', domain: pattern, group: BEDTIME_GROUP, comment: `${NETGUARD_TAG}: bedtime, app still works` });
  }
  return { rules, skipped };
}
