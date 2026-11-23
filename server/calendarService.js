// Family calendar -> tonight's "get ready" chores and the fridge display's "coming up" list.
//
// On the Pi:   GOOGLE_CALENDAR_ICS_URL is the calendar's *secret* iCal address (Google
//              Calendar > Settings > the calendar > "Secret address in iCal format"). It
//              stays in ~/apps/little-heroes.env and never reaches a browser.
// On App Hosting (and so GitHub Pages / Firebase Hosting, which call App Hosting): there is
//              no calendar URL, so the request is relayed to the Pi over the same Tailscale
//              Funnel path and token Rex's voice uses (PI_RELAY_URL / PI_RELAY_TOKEN).
//
// Calendar titles are private, so every request must carry one of the family's household
// codes (HOUSEHOLD_CODES on the Pi), the same code that already unlocks the household's
// synced data. The Pi also requires the family network or the relay token.
import { timingSafeEqual } from 'node:crypto';
import { parseIcs, buildCalendarPlan, DEFAULT_CALENDAR_TIME_ZONE } from '../shared/calendarPrep.js';
import { householdCodesFromEnv } from './householdReader.js';
import { isFamilyNetworkRequest, hasValidRelayToken } from './localAiService.js';
import { getPiRelayConfig } from './piRelayService.js';
import { weatherService as defaultWeather } from './weatherService.js';
import { loadSchoolCalendar as defaultSchoolCalendar } from './schoolCalendarService.js';
import { SCHOOL_GROUPS } from '../shared/schoolCalendar.js';

const CACHE_MS = 10 * 60 * 1000;
const MAX_ICS_BYTES = 3 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15000;
const RELAY_TIMEOUT_MS = 20000;

export function getCalendarConfig(env = process.env) {
  const url = String(env.GOOGLE_CALENDAR_ICS_URL || '').trim();
  return {
    icsUrl: /^https:\/\//i.test(url) ? url : '',
    timeZone: String(env.CALENDAR_TIME_ZONE || env.REPORT_TIME_ZONE || DEFAULT_CALENDAR_TIME_ZONE).trim()
  };
}

function sameText(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/** True when `code` is one of HOUSEHOLD_CODES. */
export function isKnownHouseholdCode(code, env = process.env) {
  const clean = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{4,32}$/.test(clean)) return false;
  return householdCodesFromEnv(env).some((c) => sameText(c, clean));
}

/** Only id, name and learning level of each kid are used (for matching titles to kids). */
export function sanitizeHeroes(raw) {
  return (Array.isArray(raw) ? raw : []).slice(0, 12).map((h) => ({
    id: String(h?.id || '').slice(0, 60),
    name: String(h?.name || '').replace(/[^\p{L}\p{N} '-]/gu, '').trim().slice(0, 30),
    gameDifficulty: ['easy', 'medium', 'hard'].includes(h?.gameDifficulty) ? h.gameDifficulty : '',
    // Age / school group only pick the grade group for district no-school days (e.g. Pre-K/K only).
    age: Number.isFinite(Number(h?.age)) && Number(h.age) > 0 && Number(h.age) < 19 ? Math.round(Number(h.age)) : null,
    schoolGroup: SCHOOL_GROUPS.includes(h?.schoolGroup) ? h.schoolGroup : ''
  })).filter((h) => h.id);
}

export function createCalendarService({ env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now(), weather = defaultWeather, schoolCalendar = defaultSchoolCalendar } = {}) {
  let cache = { at: 0, url: '', events: null };

  async function loadEvents() {
    const { icsUrl, timeZone } = getCalendarConfig(env);
    if (!icsUrl) return null;
    if (cache.events && cache.url === icsUrl && now() - cache.at < CACHE_MS) return cache.events;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetchImpl(icsUrl, { signal: controller.signal, headers: { Accept: 'text/calendar' } });
      if (!res.ok) throw new Error(`calendar returned ${res.status}`);
      const text = await res.text();
      if (text.length > MAX_ICS_BYTES) throw new Error('calendar is too big');
      const events = parseIcs(text, { timeZone });
      cache = { at: now(), url: icsUrl, events };
      return events;
    } catch (err) {
      // Keep the last good copy for a while rather than emptying the fridge on a blip.
      if (cache.events && now() - cache.at < 6 * CACHE_MS) return cache.events;
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /** The plan for these kids, or { configured:false } when no calendar is set up here. */
  async function plan(heroes, { days = 7, month = false } = {}) {
    const events = await loadEvents();
    if (!events) return { configured: false, events: [], prepTasks: [] };
    const { timeZone } = getCalendarConfig(env);
    const forecast = weather ? await weather.get().catch(() => null) : null;
    return {
      configured: true,
      ...buildCalendarPlan(events, sanitizeHeroes(heroes), { now: now(), days, timeZone, month, weather: forecast, schoolCalendar: schoolCalendar() })
    };
  }

  async function relayToPi(body) {
    const cfg = getPiRelayConfig(env);
    if (!cfg) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);
    try {
      const res = await fetchImpl(`${cfg.url}/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!res.ok) return { status: res.status === 403 ? 403 : 502, data: { configured: false, events: [], prepTasks: [] } };
      return { status: 200, data: await res.json() };
    } catch {
      return { status: 502, data: { configured: false, events: [], prepTasks: [] } };
    } finally {
      clearTimeout(timer);
    }
  }

  /** POST /api/calendar/plan (any host) and /api/local/calendar (the Pi, via the relay). */
  async function handlePlanRequest(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const days = Math.max(1, Math.min(14, Number(body.days) || 7));
    const heroes = sanitizeHeroes(body.heroes);
    const month = body.month === true;
    const { icsUrl } = getCalendarConfig(env);

    if (!icsUrl) {
      // No calendar on this server: hand the request to the Pi when a relay is set up.
      const relayed = await relayToPi({ householdCode: body.householdCode, heroes, days, month });
      if (relayed) return res.status(relayed.status).json(relayed.data);
      return res.json({ configured: false, events: [], prepTasks: [] });
    }
    if (!(isFamilyNetworkRequest(req) || hasValidRelayToken(req, env))) {
      return res.status(403).json({ error: 'The family calendar is only available on the family network', configured: false });
    }
    if (!isKnownHouseholdCode(body.householdCode, env)) {
      return res.status(403).json({ error: 'Unknown household', configured: false });
    }
    try {
      return res.json(await plan(heroes, { days, month }));
    } catch (err) {
      console.warn('Family calendar read failed:', err?.message || err);
      return res.status(502).json({ error: 'Could not read the family calendar', configured: true, events: [], prepTasks: [] });
    }
  }

  return { loadEvents, plan, handlePlanRequest };
}

export const calendarService = createCalendarService();
