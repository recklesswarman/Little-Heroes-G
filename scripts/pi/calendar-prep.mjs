#!/usr/bin/env node
// Nightly "get ready for tomorrow" heads-up, run on the Pi by little-heroes-calendar-prep.timer
// (6:30 PM). Reads the family Google Calendar (GOOGLE_CALENDAR_ICS_URL), works out tonight's
// prep chores with shared/calendarPrep.js and posts them to the family ntfy topic. The chores
// themselves appear in the app on every device (store.applyCalendarPlan via /api/calendar/plan).
//
//   GOOGLE_CALENDAR_ICS_URL  the calendar's secret iCal address (required)
//   HOUSEHOLD_CODES          to know the kids' names for "added for Kayden"
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

async function heroesFromEnv(env, fetchImpl) {
  const [code] = householdCodesFromEnv(env);
  if (!code) return [];
  try {
    return listHeroes(await fetchHousehold(code, { fetchImpl }));
  } catch (err) {
    console.warn(`Could not read the household (${err.message}); naming no kids.`);
    return [];
  }
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

export async function runCalendarPrep({ env = process.env, dryRun = false, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  if (!getCalendarConfig(env).icsUrl) throw new Error('Set GOOGLE_CALENDAR_ICS_URL in ~/apps/little-heroes.env (Google Calendar > Settings > Secret address in iCal format).');
  const heroes = await heroesFromEnv(env, fetchImpl);
  const plan = await createCalendarService({ env, fetchImpl, now }).plan(heroes, { days: 2 });
  const message = formatTonightMessage(plan, heroes);
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
