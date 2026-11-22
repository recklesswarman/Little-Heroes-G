// GET /api/fridge/snapshot: the Fridge Display's data, built on the Pi from the household's
// synced Firestore document (HOUSEHOLD_CODES) plus the family calendar.
//
// The Pi's own kiosk browser has no household joined, so this is how the fridge screen gets
// the kids' chores without anyone signing in on it. It only answers the family network
// (the Pi itself, the LAN and the tailnet), never a request that came through a proxy.
import { fetchHousehold, householdCodesFromEnv } from './householdReader.js';
import { isFamilyNetworkRequest } from './localAiService.js';
import { calendarService as defaultCalendar } from './calendarService.js';
import { listHeroes, DEFAULT_TIME_ZONE } from '../shared/familyInsights.js';
import { buildFridgeSnapshot } from '../shared/fridgeSnapshot.js';
import { getCurrentWeeklyChallenge } from '../src/data/hygieneBossesData.js';

const CACHE_MS = 30 * 1000;

export function createFridgeHandler({ env = process.env, fetchHouseholdImpl = fetchHousehold, calendar = defaultCalendar, now = () => Date.now() } = {}) {
  let cache = { at: 0, body: null };

  return async function handleFridgeSnapshot(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (env.FRIDGE_ALLOW_ANY_NETWORK !== 'true' && !isFamilyNetworkRequest(req)) {
      return res.status(403).json({ error: 'The fridge display only works on the family network' });
    }
    const codes = householdCodesFromEnv(env);
    if (!codes.length) return res.status(404).json({ error: 'Set HOUSEHOLD_CODES on this server to use the fridge display', configured: false });
    if (cache.body && now() - cache.at < CACHE_MS) return res.json(cache.body);
    try {
      const state = await fetchHouseholdImpl(codes[0]);
      const timeZone = env.REPORT_TIME_ZONE || DEFAULT_TIME_ZONE;
      let plan = null;
      try {
        plan = await calendar.plan(listHeroes(state), { days: 7, month: true });
      } catch (err) {
        console.warn('Fridge: calendar unavailable:', err?.message || err);
      }
      const weekly = getCurrentWeeklyChallenge(new Date(now()));
      const body = buildFridgeSnapshot(state, { now: now(), timeZone, calendar: plan, challenge: weekly?.challenge || null });
      cache = { at: now(), body };
      return res.json(body);
    } catch (err) {
      console.warn('Fridge snapshot failed:', err?.message || err);
      if (cache.body) return res.json({ ...cache.body, stale: true });
      return res.status(502).json({ error: 'Could not read the household right now' });
    }
  };
}

export const handleFridgeSnapshot = createFridgeHandler();
