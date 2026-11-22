// Keeps tonight's calendar "get ready" chores in the app (store.applyCalendarPlan) and the
// upcoming events in memory for the Fridge Display.
//
// The calendar itself lives on the family Pi (GOOGLE_CALENDAR_ICS_URL, server/calendarService.js).
// Every host can ask: the Pi answers directly and App Hosting relays to it. The request carries
// the household code so only the family's own devices get answers.
import { store } from '../state/store.js';
import { serverApiUrl } from './serverApi.js';

const REFRESH_MS = 30 * 60 * 1000;
let lastPlan = null;
let timer = null;
let inFlight = null;

function heroesForRequest(state) {
  return (state.heroes || [])
    .filter((h) => h && h.id && h.role !== 'parent' && !h.isParent)
    .map((h) => ({ id: h.id, name: h.name || '', gameDifficulty: h.gameDifficulty || h.difficulty || '' }));
}

export function getLastCalendarPlan() {
  return lastPlan;
}

/** Fetch the plan and apply it. Resolves to the plan, or null when there is no calendar. */
export async function refreshFamilyCalendar({ fetchImpl = globalThis.fetch } = {}) {
  if (inFlight) return inFlight;
  const state = store.getState();
  const householdCode = String(state.household?.syncCode || '').trim().toUpperCase();
  if (!householdCode || typeof fetchImpl !== 'function') return null;
  inFlight = (async () => {
    try {
      const res = await fetchImpl(serverApiUrl('/api/calendar/plan'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdCode, heroes: heroesForRequest(state), days: 7, month: true })
      });
      if (!res.ok) return null;
      const plan = await res.json();
      if (!plan || plan.configured !== true) return null;
      lastPlan = plan;
      store.applyCalendarPlan(plan);
      return plan;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Start the half-hourly refresh (safe to call more than once). */
export function startFamilyCalendarSync() {
  if (timer || typeof window === 'undefined') return;
  setTimeout(() => { refreshFamilyCalendar(); }, 4000);
  timer = setInterval(() => { refreshFamilyCalendar(); }, REFRESH_MS);
}
