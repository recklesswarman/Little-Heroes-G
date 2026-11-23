#!/usr/bin/env node
// Yearly school calendar refresh, run on the Pi by little-heroes-school-calendar.timer
// (July 1 and August 1, plus once at install). Reads the district calendar page for the
// coming school year, parses the no-school days with shared/schoolCalendar.js and saves them
// to SCHOOL_CALENDAR_FILE (default ~/apps/little-heroes-school-calendar.json). The server
// (server/schoolCalendarService.js) picks the file up without a restart and hands it to every
// device through the calendar plan. Until the district posts the new year, the bundled year
// in shared/schoolCalendar.js keeps working.
//
// Usage: node scripts/pi/school-calendar.mjs [--year 2027-2028] [--dry-run]
import { writeFileSync, renameSync } from 'node:fs';
import { parseDistrictCalendar, districtCalendarUrl, schoolYearFor, isSchoolCalendar } from '../../shared/schoolCalendar.js';
import { schoolCalendarFile } from '../../server/schoolCalendarService.js';
import { dayKey, DEFAULT_TIME_ZONE } from '../../shared/familyInsights.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const yearArg = args[args.indexOf('--year') + 1];

function yearsToTry(today) {
  if (/^\d{4}-\d{4}$/.test(yearArg || '')) return [yearArg];
  const current = schoolYearFor(today);
  const start = Number(current.slice(0, 4));
  // From May on, try next year's page first (it is usually posted in the spring).
  const next = `${start + 1}-${start + 2}`;
  return Number(today.slice(5, 7)) >= 5 && Number(today.slice(5, 7)) < 7 ? [next, current] : [current, next];
}

async function main() {
  const today = dayKey(Date.now(), process.env.REPORT_TIME_ZONE || DEFAULT_TIME_ZONE);
  for (const year of yearsToTry(today)) {
    const url = districtCalendarUrl(year);
    let res;
    try {
      res = await fetch(url, { headers: { 'User-Agent': 'little-heroes-family-pi', Accept: 'text/html' }, signal: AbortSignal.timeout(20000) });
    } catch (err) {
      console.warn(`${year}: could not reach ${url} (${err.message})`);
      continue;
    }
    if (!res.ok) {
      console.warn(`${year}: ${url} returned ${res.status}`);
      continue;
    }
    const parsed = parseDistrictCalendar(await res.text());
    const cal = { district: 'Worcester Public Schools', year, source: url, fetchedAt: new Date().toISOString(), ...parsed };
    if (!isSchoolCalendar(cal) || cal.days.length < 5) {
      console.warn(`${year}: the page did not have a full calendar yet (first ${cal.firstDay || '?'}, last ${cal.lastDay || '?'}, ${cal.days.length} days off)`);
      continue;
    }
    console.log(`${year}: school ${cal.firstDay} to ${cal.lastDay}, ${cal.days.length} no-school days`);
    if (dryRun) {
      console.log(JSON.stringify(cal, null, 2));
      return;
    }
    const file = schoolCalendarFile();
    writeFileSync(`${file}.tmp`, JSON.stringify(cal, null, 2));
    renameSync(`${file}.tmp`, file);
    console.log(`Saved ${file}`);
    return;
  }
  console.log('No new school calendar found; the app keeps using the year it has.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
