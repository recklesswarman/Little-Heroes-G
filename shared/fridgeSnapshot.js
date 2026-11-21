// What the Fridge Display shows: each kid's chores for today, streaks and stars, this
// week's family challenge and what is coming up on the calendar.
//
// Pure, like shared/familyInsights.js: the Pi builds it from the synced household
// (GET /api/fridge/snapshot) and a joined device builds the same thing from its own store,
// so the screen looks the same either way.
import { listHeroes, buildChoreSnapshot, DEFAULT_TIME_ZONE, dayKey } from './familyInsights.js';

const arr = (v) => (Array.isArray(v) ? v : []);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function clean(value, max = 60) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function safeImage(url) {
  const u = typeof url === 'string' ? url.trim() : '';
  if (/^https:\/\//i.test(u) && u.length < 2000) return u;
  if (/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,/i.test(u) && u.length < 200000) return u;
  if (/^\/?assets\//.test(u)) return u;
  return '';
}

/**
 * @param state     store / household state
 * @param calendar  optional plan from /api/calendar/plan ({ events: [...] })
 * @param challenge optional { title, description } for this week's family challenge
 */
export function buildFridgeSnapshot(state = {}, { now = Date.now(), timeZone = DEFAULT_TIME_ZONE, calendar = null, challenge = null } = {}) {
  const today = dayKey(now, timeZone);
  const heroes = listHeroes(state).slice(0, 6).map((hero) => {
    const chores = buildChoreSnapshot(state, hero.id, { now, timeZone })
      .filter((c) => c.status !== 'hidden')
      .slice(0, 12);
    const done = chores.filter((c) => c.status === 'done').length;
    const waiting = chores.filter((c) => c.status === 'waiting_for_parent').length;
    return {
      id: String(hero.id).slice(0, 60),
      name: clean(hero.name, 24) || 'Little Hero',
      avatar: safeImage(hero.avatar),
      streak: num(hero.streak),
      points: num(hero.points),
      coins: num(hero.coins),
      level: num(hero.level) || 1,
      chores: chores.map((c) => ({ id: c.id, title: c.title, status: c.status, when: c.when, fromCalendar: c.fromCalendar === true })),
      done,
      waiting,
      total: chores.length
    };
  });

  const nameOf = (id) => heroes.find((h) => h.id === id)?.name || '';
  const events = arr(calendar?.events)
    .filter((e) => e && e.day >= today)
    .slice(0, 8)
    .map((e) => ({
      day: e.day,
      title: clean(e.title, 60),
      time: clean(e.time, 12),
      emoji: clean(e.emoji, 4) || '📅',
      who: arr(e.heroIds).length && arr(e.heroIds).length < heroes.length ? arr(e.heroIds).map(nameOf).filter(Boolean).join(' & ') : ''
    }));

  return {
    generatedAt: new Date(now).toISOString(),
    today,
    householdName: clean(state.householdName || state.household?.name || '', 40),
    heroes,
    challenge: challenge ? { title: clean(challenge.title, 60), description: clean(challenge.description, 160) } : null,
    events,
    calendarConfigured: calendar?.configured === true,
    familyDone: heroes.reduce((s, h) => s + h.done, 0),
    familyTotal: heroes.reduce((s, h) => s + h.total, 0)
  };
}
