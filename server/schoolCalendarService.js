// The district school calendar the server uses: the copy the Pi saved this summer
// (scripts/pi/school-calendar.mjs writes SCHOOL_CALENDAR_FILE) when it is for the current
// or a later school year, otherwise the year bundled in shared/schoolCalendar.js.
import { readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BUNDLED_SCHOOL_CALENDAR, isSchoolCalendar, schoolYearFor } from '../shared/schoolCalendar.js';

export function schoolCalendarFile(env = process.env) {
  return env.SCHOOL_CALENDAR_FILE || path.join(os.homedir(), 'apps', 'little-heroes-school-calendar.json');
}

/** Pick the calendar: the saved one when it is for the bundled school year or a later one. */
export function chooseSchoolCalendar(saved) {
  if (!isSchoolCalendar(saved)) return BUNDLED_SCHOOL_CALENDAR;
  return schoolYearFor(saved.firstDay) >= schoolYearFor(BUNDLED_SCHOOL_CALENDAR.firstDay) ? saved : BUNDLED_SCHOOL_CALENDAR;
}

export function createSchoolCalendarLoader({ env = process.env, read = readFileSync, stat = statSync } = {}) {
  let cache = { mtime: -1, saved: null };
  return function loadSchoolCalendar() {
    const file = schoolCalendarFile(env);
    try {
      const mtime = stat(file).mtimeMs;
      if (mtime !== cache.mtime) cache = { mtime, saved: JSON.parse(read(file, 'utf8')) };
    } catch {
      cache = { mtime: -1, saved: null };
    }
    return chooseSchoolCalendar(cache.saved);
  };
}

export const loadSchoolCalendar = createSchoolCalendarLoader();
