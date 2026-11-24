#!/usr/bin/env node
// Nightly "get ready for tomorrow" heads-up, run on the Pi by little-heroes-calendar-prep.timer
// (6:30 PM). Reads the family Google Calendar (GOOGLE_CALENDAR_ICS_URL), works out tonight's
// prep chores with shared/calendarPrep.js and posts them to the family ntfy topic. The chores
// themselves appear in the app on every device (store.applyCalendarPlan via /api/calendar/plan).
// It also adds tomorrow's school lunch (or the packed lunch planned instead) from the Meal
// Planner (shared/mealPlan.js), unless a parent turned that off in Parent Portal > Meal Planner.
//
//   GOOGLE_CALENDAR_ICS_URL  the calendar's secret iCal address (needed for the calendar part)
//   HOUSEHOLD_CODES          the kids' names for "added for Nova", and the meal planner
//   NTFY_URL / NTFY_TOPIC / NTFY_TOKEN   same as server.js
//
// Usage: node scripts/pi/calendar-prep.mjs [--dry-run | --check]
//   --dry-run  print tonight's heads-up instead of sending it
//   --check    print the next 7 days the Fridge Display will show, and which become chores
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createCalendarService, getCalendarConfig } from '../../server/calendarService.js';
import { fetchHousehold, householdCodesFromEnv } from '../../server/householdReader.js';
import { listHeroes } from '../../shared/familyInsights.js';
import { formatTonightMessage } from '../../shared/calendarPrep.js';
import { getNtfyConfig } from '../../server/ntfyService.js';
import { buildHouseholdMealDays, getSchoolMenu } from '../../server/mealsService.js';
import { normalizeMealPlan, formatTomorrowLunch } from '../../shared/mealPlan.js';
import { dayKey, DEFAULT_TIME_ZONE } from '../../shared/familyInsights.js';
import { addDays } from '../../shared/schoolMenu.js';

async function householdFromEnv(env, fetchImpl) {
  const [code] = householdCodesFromEnv(env);
  if (!code) return null;
  try {
    return await fetchHousehold(code, { fetchImpl });
  } catch (err) {
    console.warn(`Could not read the household (${err.message}); naming no kids.`);
    return null;
  }
}

async function heroesFromEnv(env, fetchImpl) {
  const state = await householdFromEnv(env, fetchImpl);
  return state ? listHeroes(state) : [];
}

/** "🍱 Tomorrow's school lunch: ..." for the household, or '' (turned off, weekend, no menu). */
export async function tomorrowLunchLine(state, { env = process.env, now = () => Date.now(), schoolMenu = getSchoolMenu } = {}) {
  if (!state) return '';
  const plan = normalizeMealPlan(state.mealPlan);
  if (!plan.settings.tomorrowLunchAlert) return '';
  const tomorrow = addDays(dayKey(now(), env.REPORT_TIME_ZONE || DEFAULT_TIME_ZONE), 1);
  const { days } = await buildHouseholdMealDays(state, { from: tomorrow, days: 1, env, schoolMenu, skipWeekends: false });
  return formatTomorrowLunch(days[0]);
}

/** Setup check: what the Fridge Display and the chores will see for the next week. */
export async function runCalendarCheck({ env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now(), log = console.log, heroes: knownHeroes } = {}) {
  if (!getCalendarConfig(env).icsUrl) throw new Error('GOOGLE_CALENDAR_ICS_URL is not set in ~/apps/little-heroes.env.');
  const heroes = knownHeroes || await heroesFromEnv(env, fetchImpl);
  const plan = await createCalendarService({ env, fetchImpl, now }).plan(heroes, { days: 7 });
  const nameOf = (id) => heroes.find((h) => h.id === id)?.name || id;
  log(`Calendar OK. Kids: ${heroes.map((h) => h.name).join(', ') || '(none found, check HOUSEHOLD_CODES)'}`);
  log(`Next 7 days (${plan.events.length} events, all shown on the Fridge Display):`);
  for (const e of plan.events) {
    const who = e.heroIds.length ? ` [${e.heroIds.map(nameOf).join(' & ')}]` : '';
    log(`  ${e.day} ${e.time || 'all day'}  ${e.emoji} ${e.title}${who}`);
  }
  log(`Get-ready chores (${plan.prepTasks.length}):`);
  for (const t of plan.prepTasks) log(`  evening of ${t.showOn}: "${t.title}" for ${t.heroIds.map(nameOf).join(' & ')} (${t.eventTitle})`);
  return { events: plan.events.length, chores: plan.prepTasks.length };
}

export async function runCalendarPrep({ env = process.env, dryRun = false, fetchImpl = globalThis.fetch, now = () => Date.now(), schoolMenu = getSchoolMenu } = {}) {
  const hasCalendar = Boolean(getCalendarConfig(env).icsUrl);
  if (!hasCalendar && !householdCodesFromEnv(env).length) {
    throw new Error('Set GOOGLE_CALENDAR_ICS_URL and/or HOUSEHOLD_CODES in ~/apps/little-heroes.env (Google Calendar > Settings > Secret address in iCal format).');
  }
  const state = await householdFromEnv(env, fetchImpl);
  const heroes = state ? listHeroes(state) : [];
  let calendarPart = '';
  if (hasCalendar) {
    const plan = await createCalendarService({ env, fetchImpl, now }).plan(heroes, { days: 2 });
    calendarPart = formatTonightMessage(plan, heroes) || '';
  }
  let lunchPart = '';
  try {
    lunchPart = await tomorrowLunchLine(state, { env, now, schoolMenu });
  } catch (err) {
    console.warn(`Tomorrow's lunch skipped: ${err.message || err}`);
  }
  const message = [calendarPart, lunchPart].filter(Boolean).join('\n\n');
  if (!message) {
    console.log('Nothing to get ready for tomorrow.');
    return { sent: false, reason: 'nothing' };
  }
  if (dryRun) {
    console.log(message);
    return { sent: false, dryRun: true };
  }
  const ntfy = getNtfyConfig(env);
  if (!ntfy.enabled) return { sent: false, reason: 'ntfy is turned off' };
  const res = await fetchImpl(`${ntfy.url}/${encodeURIComponent(ntfy.topic)}`, {
    method: 'POST',
    headers: {
      Title: 'Get ready for tomorrow',
      Tags: 'calendar',
      ...(ntfy.token ? { Authorization: `Bearer ${ntfy.token}` } : {})
    },
    body: message,
    signal: AbortSignal.timeout(10000)
  });
  console.log(`Calendar heads-up: ${res.ok ? 'sent' : `not sent (${res.status})`}`);
  return { sent: res.ok, status: res.status };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (process.argv.includes('--check') ? runCalendarCheck().then(() => ({ dryRun: true })) : runCalendarPrep({ dryRun: process.argv.includes('--dry-run') }))
    .then((r) => process.exit(r.sent || r.dryRun || r.reason === 'nothing' ? 0 : 1))
    .catch((err) => {
      console.error(err.message || err);
      process.exit(1);
    });
}
