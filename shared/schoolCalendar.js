// District school calendar: no-school days, first and last day of school.
//
// Worcester Public Schools publishes no iCal feed, but its calendar page lists every month as
// a plain HTML table ("7 - No School - Labor Day"), so parseDistrictCalendar() reads that page
// (or the same tables as Markdown). The 2026-27 year is bundled below so every device works
// offline; the Pi refreshes it each summer with scripts/pi/school-calendar.mjs and serves the
// newer copy through the calendar plan (server/calendarService.js).
//
// Kids are matched to grade groups: 'prek_k' (Pre-K and kindergarten) or 'elementary'.
// A hero's `schoolGroup` wins; otherwise age 5 and under counts as Pre-K/K.
//
// Pure, no I/O: used by the browser, the Pi server and the Pi scripts.

export const SCHOOL_CALENDAR_SOURCE = 'https://www.worcesterschools.org/o/wps/page/worcester-public-school-calendar-2026-2027';

export const BUNDLED_SCHOOL_CALENDAR = {
  district: 'Worcester Public Schools',
  year: '2026-2027',
  source: SCHOOL_CALENDAR_SOURCE,
  firstDay: '2026-08-31',
  firstDayPreK: '2026-09-03',
  lastDay: '2027-06-17',
  days: [
    { date: '2026-09-07', label: 'Labor Day' },
    { date: '2026-10-09', label: 'Staff Development Day' },
    { date: '2026-10-12', label: 'Indigenous Peoples Day' },
    { date: '2026-11-03', label: 'Staff Development Day' },
    { date: '2026-11-11', label: 'Veterans Day' },
    { date: '2026-11-25', label: 'Thanksgiving' },
    { date: '2026-11-26', label: 'Thanksgiving' },
    { date: '2026-11-27', label: 'Thanksgiving' },
    { date: '2026-12-24', label: 'Holiday Vacation' },
    { date: '2026-12-25', label: 'Holiday Vacation' },
    { date: '2026-12-28', label: 'Holiday Vacation' },
    { date: '2026-12-29', label: 'Holiday Vacation' },
    { date: '2026-12-30', label: 'Holiday Vacation' },
    { date: '2026-12-31', label: 'Holiday Vacation' },
    { date: '2027-01-01', label: 'New Year\'s Day' },
    { date: '2027-01-18', label: 'Martin Luther King Day' },
    { date: '2027-02-15', label: 'Presidents Day' },
    { date: '2027-02-16', label: 'Winter Vacation' },
    { date: '2027-02-17', label: 'Winter Vacation' },
    { date: '2027-02-18', label: 'Winter Vacation' },
    { date: '2027-02-19', label: 'Winter Vacation' },
    { date: '2027-03-05', label: 'Staff Development Day' },
    { date: '2027-03-26', label: 'No School Day' },
    { date: '2027-04-19', label: 'Patriots Day' },
    { date: '2027-04-20', label: 'Spring Vacation' },
    { date: '2027-04-21', label: 'Spring Vacation' },
    { date: '2027-04-22', label: 'Spring Vacation' },
    { date: '2027-04-23', label: 'Spring Vacation' },
    { date: '2027-05-31', label: 'Memorial Day' },
    { date: '2027-06-02', label: 'Pre-K and K Open House', groups: ['prek_k'] },
    { date: '2027-06-18', label: 'Juneteenth' },
    { date: '2027-07-04', label: 'Independence Day' }
  ]
};

export const SCHOOL_GROUPS = ['prek_k', 'elementary'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const isDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const pad = (n) => String(n).padStart(2, '0');

function cleanLabel(text) {
  return String(text || '')
    .replace(/[‘’]/g, '\'')
    .replace(/\bno school\b\s*[-–:]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[-–\s]+|[-–\s]+$/g, '')
    .replace(/\bPeople's\b/i, 'Peoples')
    .replace(/(Veterans|Presidents|Patriots)'/i, '$1')
    .slice(0, 60);
}

/** Which grade group a kid is in ('prek_k' or 'elementary'). */
export function schoolGroupFor(hero = {}) {
  if (SCHOOL_GROUPS.includes(hero?.schoolGroup)) return hero.schoolGroup;
  const age = Number(hero?.age);
  return Number.isFinite(age) && age > 0 && age <= 5 ? 'prek_k' : 'elementary';
}

/** A calendar object is usable when it has a first and last day and a list of days. */
export function isSchoolCalendar(cal) {
  return Boolean(cal && isDay(cal.firstDay) && isDay(cal.lastDay) && Array.isArray(cal.days));
}

/**
 * Read the district calendar page (HTML) or its tables as Markdown.
 * Returns { firstDay, firstDayPreK, lastDay, days: [{ date, label, groups? }] }.
 */
export function parseDistrictCalendar(text) {
  const plain = String(text || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<h\d[^>]*>/gi, '\n## ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;|&rsquo;|&#8217;/g, '\'')
    .replace(/&amp;/g, '&'); // last, so "&amp;nbsp;" stays literal text
  const out = { firstDay: '', firstDayPreK: '', lastDay: '', days: [] };
  const monthRe = new RegExp(`(${MONTHS.join('|')})\\s+(\\d{4})`, 'gi');
  const marks = [...plain.matchAll(monthRe)];
  marks.forEach((m, i) => {
    const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
    const year = Number(m[2]);
    const section = plain.slice(m.index + m[0].length, i + 1 < marks.length ? marks[i + 1].index : plain.length);
    for (const cell of section.split('|')) {
      const c = cell.replace(/\s+/g, ' ').trim();
      const hit = c.match(/^(\d{1,2})\s*(?:[-–]\s*)?(.*)$/);
      if (!hit || !hit[2]) continue;
      const day = Number(hit[1]);
      if (day < 1 || day > 31) continue;
      const date = `${year}-${pad(month)}-${pad(day)}`;
      const note = hit[2].trim();
      if (/no school/i.test(note)) {
        const prekOnly = /pre-?k|kindergarten/i.test(note) && /only/i.test(note);
        const entry = { date, label: prekOnly ? 'Pre-K and K Open House' : (cleanLabel(note) || 'No School Day') };
        if (/^day$/i.test(entry.label)) entry.label = 'No School Day';
        if (prekOnly) entry.groups = ['prek_k'];
        if (!out.days.some((d) => d.date === date)) out.days.push(entry);
      }
      if (/first day for pre-?k/i.test(note)) out.firstDayPreK = date;
      else if (/first day of school/i.test(note)) out.firstDay = date;
      if (/last day of school/i.test(note) && !/senior/i.test(note)) out.lastDay = date;
    }
  });
  out.days.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** The school-year label ("2027-2028") a day falls in, school years starting July 1. */
export function schoolYearFor(day) {
  const [y, m] = String(day).split('-').map(Number);
  const start = m >= 7 ? y : y - 1;
  return `${start}-${start + 1}`;
}

/** The district page for a school year ("2027-2028"). */
export function districtCalendarUrl(year) {
  return `https://www.worcesterschools.org/o/wps/page/worcester-public-school-calendar-${year}`;
}

function weekday(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Is `day` a school day for this kid?
 * Returns { school: boolean, reason: 'weekend' | 'summer' | label | '' }.
 * With no calendar for that year, weekdays count as school days.
 */
export function schoolDayInfo(day, hero = {}, calendar = BUNDLED_SCHOOL_CALENDAR) {
  if (!isDay(day)) return { school: false, reason: '' };
  const wd = weekday(day);
  if (wd === 0 || wd === 6) return { school: false, reason: 'weekend' };
  if (!isSchoolCalendar(calendar)) return { school: true, reason: '' };
  const group = schoolGroupFor(hero);
  const first = group === 'prek_k' && isDay(calendar.firstDayPreK) ? calendar.firstDayPreK : calendar.firstDay;
  // Summer: from July 1 to the first day, and from the day after the last day to August 31.
  const beforeStart = day < first && day >= `${first.slice(0, 4)}-07-01`;
  const afterEnd = day > calendar.lastDay && day <= `${calendar.lastDay.slice(0, 4)}-08-31`;
  if (beforeStart || afterEnd) return { school: false, reason: 'summer' };
  const off = calendar.days.find((d) => d.date === day && (!Array.isArray(d.groups) || d.groups.includes(group)));
  if (off) return { school: false, reason: off.label };
  return { school: true, reason: '' };
}

/**
 * No-school days between `from` and `to` (inclusive) as calendar events, with the kids they
 * apply to. Weekends and summer are left out (they need no reminder).
 */
export function noSchoolEvents(from, to, heroes = [], calendar = BUNDLED_SCHOOL_CALENDAR) {
  if (!isSchoolCalendar(calendar) || !isDay(from) || !isDay(to)) return [];
  const kids = (Array.isArray(heroes) ? heroes : []).filter((h) => h && h.id);
  return calendar.days
    .filter((d) => isDay(d.date) && d.date >= from && d.date <= to && weekday(d.date) !== 0 && weekday(d.date) !== 6)
    .map((d) => {
      const groups = Array.isArray(d.groups) ? d.groups : null;
      const heroIds = groups ? kids.filter((h) => groups.includes(schoolGroupFor(h))).map((h) => String(h.id)) : [];
      return { day: d.date, title: `No school: ${d.label}`.slice(0, 60), time: '', allDay: true, school: true, emoji: '🏠', heroIds };
    })
    .filter((e) => !Array.isArray(calendar.days.find((d) => d.date === e.day)?.groups) || e.heroIds.length);
}
