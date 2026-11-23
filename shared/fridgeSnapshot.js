// What the Fridge Display shows: each kid's chores for today, streaks and stars, this
// week's family challenge and what is coming up on the calendar.
//
// Pure, like shared/familyInsights.js: the Pi builds it from the synced household
// (GET /api/fridge/snapshot) and a joined device builds the same thing from its own store,
// so the screen looks the same either way.
import { listHeroes, buildChoreSnapshot, DEFAULT_TIME_ZONE, dayKey } from './familyInsights.js';
import { MEAL_TYPES } from './mealPlan.js';

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

/** The meal planner days (shared/mealPlan.js buildMealDays) trimmed to what the fridge shows. */
export function fridgeMeals(meals) {
  if (!meals || !Array.isArray(meals.days)) return null;
  const isDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const days = meals.days.filter((d) => d && isDay(d.date)).slice(0, 10).map((d) => {
    const out = {};
    for (const type of MEAL_TYPES) {
      const m = d.meals?.[type];
      if (!m) continue;
      const school = m.school
        ? {
            main: arr(m.school.main).slice(0, 8).map((i) => ({ name: clean(i?.name, 60), emoji: clean(i?.emoji, 4) || '🍽️' })).filter((i) => i.name),
            extras: arr(m.school.extras).slice(0, 30).map((i) => ({ name: clean(i?.name, 60), group: clean(i?.group, 12) })).filter((i) => i.name)
          }
        : null;
      const family = arr(m.family).slice(0, 6).map((e) => ({ title: clean(e?.title, 80), emoji: clean(e?.emoji, 4) || '🍽️', replacesSchool: e?.replacesSchool === true, notes: clean(e?.notes, 120) })).filter((e) => e.title);
      if ((school && (school.main.length || school.extras.length)) || family.length) out[type] = { school, family };
    }
    return { date: d.date, noSchool: d.noSchool === true, meals: out };
  });
  return {
    schoolName: clean(meals.school?.school || meals.plan?.settings?.schoolName || '', 80),
    showAll: meals.plan?.settings?.showAllSchoolItems === true,
    schoolError: meals.schoolError ? 'School menu unavailable right now' : '',
    days
  };
}

/**
 * @param meals     optional { plan, school, schoolError, days } from buildHouseholdMealDays
 * @param state     store / household state
 * @param calendar  optional plan from /api/calendar/plan ({ events: [...] })
 * @param challenge optional { title, description } for this week's family challenge
 */
export function buildFridgeSnapshot(state = {}, { now = Date.now(), timeZone = DEFAULT_TIME_ZONE, calendar = null, challenge = null, meals = null } = {}) {
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
  const toEvent = (e) => ({
    day: e.day,
    title: clean(e.title, 60),
    time: clean(e.time, 12),
    emoji: clean(e.emoji, 4) || '📅',
    who: arr(e.heroIds).length && arr(e.heroIds).length < heroes.length ? arr(e.heroIds).map(nameOf).filter(Boolean).join(' & ') : ''
  });
  const isDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const events = arr(calendar?.events)
    .filter((e) => e && e.day >= today)
    .slice(0, 12)
    .map(toEvent);
  const m = calendar?.month;
  const month = m && isDay(m.start) && isDay(m.end)
    ? { month: clean(m.month, 7), start: m.start, end: m.end, events: arr(m.events).filter((e) => e && isDay(e.day)).slice(0, 200).map(toEvent) }
    : null;

  return {
    generatedAt: new Date(now).toISOString(),
    today,
    householdName: clean(state.householdName || state.household?.name || '', 40),
    heroes,
    challenge: challenge ? { title: clean(challenge.title, 60), description: clean(challenge.description, 160) } : null,
    events,
    month,
    calendarConfigured: calendar?.configured === true,
    meals: fridgeMeals(meals),
    familyDone: heroes.reduce((s, h) => s + h.done, 0),
    familyTotal: heroes.reduce((s, h) => s + h.total, 0)
  };
}
