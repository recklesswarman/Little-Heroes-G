// School and activity calendar -> "get ready" chores the night before.
//
// The family's Google Calendar is read through its secret iCal address
// (GOOGLE_CALENDAR_ICS_URL on the Pi, see server/calendarService.js). Everything in this
// file is pure, so the Pi server, the App Hosting relay, the browser and the nightly
// heads-up job (scripts/pi/calendar-prep.mjs) all agree on what tomorrow needs.
//
//  - parseIcs(text)              -> events (one per VEVENT, recurring rules kept)
//  - eventsBetween(events, a, b) -> occurrences on local days a..b (YYYY-MM-DD, inclusive)
//  - buildPrepTasks(occ, heroes) -> chores to show the evening before each event
//
// Only event titles and times are used. Descriptions, locations and attendees are never read.

export const DEFAULT_CALENDAR_TIME_ZONE = 'America/New_York';
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TITLE = 60;

// ── Prep rules: an event title that matches gets one "get ready" chore ──────────
// Checked in order; the first match wins. `task` is what the kid sees the evening before.
export const PREP_RULES = [
  { id: 'library', match: /\blibrary\b/i, task: 'Pack your library book', icon: 'local_library', emoji: '📚' },
  { id: 'show_and_tell', match: /show[\s-]*(and|&|n)[\s-]*tell|\bshare day\b/i, task: 'Pick a show-and-tell treasure', icon: 'star', emoji: '🌟' },
  { id: 'picture_day', match: /\b(picture|photo)s?\s*day\b|school photos?/i, task: 'Lay out your picture-day outfit', icon: 'photo_camera', emoji: '📸' },
  { id: 'field_trip', match: /field\s*trip/i, task: 'Pack lunch and the field-trip slip', icon: 'directions_bus', emoji: '🚌' },
  { id: 'pajama_day', match: /\b(pajama|pyjama|pj'?s?)\s*day\b/i, task: 'Pick your pajamas for PJ day', icon: 'bedtime', emoji: '🛌' },
  { id: 'dress_up', match: /crazy\s*(hair|sock)|hat\s*day|dress[\s-]*up|spirit\s*(day|week)|costume|twin\s*day|color\s*day/i, task: 'Plan your dress-up outfit', icon: 'checkroom', emoji: '🎩' },
  { id: 'gym', match: /\b(gym|p\.?\s?e\.?|phys(ical)?\s*ed)\b|sneakers?/i, task: 'Put your sneakers by the door', icon: 'directions_run', emoji: '👟' },
  { id: 'swim', match: /\bswim(ming)?\b|\bpool\b/i, task: 'Pack your swim bag', icon: 'pool', emoji: '🏊', kidOnly: true },
  { id: 'sports', match: /\b(soccer|t-?ball|baseball|basketball|football|karate|taekwondo|gymnastics|dance|ballet|hockey|tennis|practice|lesson)\b/i, task: 'Pack your {activity} bag', icon: 'sports_soccer', emoji: '⚽', kidOnly: true },
  { id: 'birthday_party', match: /birthday\s*party|\bparty\b/i, task: 'Help wrap the party gift', icon: 'redeem', emoji: '🎁', kidOnly: true },
  { id: 'snack', match: /snack\s*(day|helper)|bring\s*(a\s*)?snack/i, task: 'Pack the class snack', icon: 'nutrition', emoji: '🍎' },
  { id: 'project', match: /project|book\s*report|homework\s*due|science\s*fair|due\b/i, task: 'Finish your project', icon: 'construction', emoji: '🛠️', kidOnly: true },
  { id: 'dentist', match: /dentist|dental/i, task: 'Brush extra sparkly for the dentist', icon: 'dentistry', emoji: '🦷', kidOnly: true },
  { id: 'doctor', match: /doctor|check[\s-]?up|pediatric/i, task: 'Pick a brave buddy for the doctor visit', icon: 'medical_services', emoji: '🩺', kidOnly: true }
];

// Events that never need a chore but are still worth showing on the fridge.
const INFO_ONLY = /no\s*school|early\s*(dismissal|release)|half\s*day|holiday|break\b|teacher\s*(work|planning)/i;

function cleanTitle(value) {
  return String(value || '')
    .replace(/\\([,;\\])/g, '$1')
    .replace(/\\n/gi, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TITLE);
}

function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

// ── Date helpers (day keys are YYYY-MM-DD in the family's time zone) ───────────

export function localDayKey(ms, timeZone = DEFAULT_CALENDAR_TIME_ZONE) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms));
    const get = (t) => parts.find((p) => p.type === t)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

function localTimeLabel(ms, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(ms));
  } catch {
    return '';
  }
}

function keyToUtc(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(key, n) {
  return utcToKey(keyToUtc(key) + n * DAY_MS);
}

function weekdayOf(key) {
  return new Date(keyToUtc(key)).getUTCDay(); // 0 = Sunday
}

const WEEKDAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function hourLabel(hh, mm) {
  const h = Number(hh);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${suffix}`;
}

/**
 * One iCal date or date-time value -> { day: 'YYYY-MM-DD', allDay, time }.
 * `params` is the text between the property name and the colon (e.g. ";TZID=America/New_York").
 */
export function parseIcsDate(value, params = '', timeZone = DEFAULT_CALENDAR_TIME_ZONE) {
  const v = String(value || '').trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly || /VALUE=DATE(?!-)/i.test(params) && /^\d{8}/.test(v)) {
    const m = dateOnly || /^(\d{4})(\d{2})(\d{2})/.exec(v);
    return { day: `${m[1]}-${m[2]}-${m[3]}`, allDay: true, time: '' };
  }
  const dt = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v);
  if (!dt) return null;
  if (dt[7]) {
    const ms = Date.UTC(+dt[1], +dt[2] - 1, +dt[3], +dt[4], +dt[5], +(dt[6] || 0));
    return { day: localDayKey(ms, timeZone), allDay: false, time: localTimeLabel(ms, timeZone) };
  }
  // Floating or TZID time: Google writes the calendar's own zone, which is the family's.
  return { day: `${dt[1]}-${dt[2]}-${dt[3]}`, allDay: false, time: hourLabel(dt[4], dt[5]) };
}

// ── iCal parsing ────────────────────────────────────────────────────────────────

function unfold(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');
}

function splitProp(line) {
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const semi = head.indexOf(';');
  return {
    name: (semi < 0 ? head : head.slice(0, semi)).toUpperCase(),
    params: semi < 0 ? '' : head.slice(semi),
    value: line.slice(colon + 1)
  };
}

function parseRrule(value) {
  const rule = {};
  for (const part of String(value || '').split(';')) {
    const [k, v] = part.split('=');
    if (k && v) rule[k.toUpperCase()] = v;
  }
  return rule;
}

/** iCal text -> events: { uid, title, start, rrule, exdates:Set, recurrenceId, cancelled }. */
export function parseIcs(text, { timeZone = DEFAULT_CALENDAR_TIME_ZONE, maxEvents = 2000 } = {}) {
  const events = [];
  let cur = null;
  for (const line of unfold(text).split('\n')) {
    if (line === 'BEGIN:VEVENT') { cur = { exdates: new Set() }; continue; }
    if (line === 'END:VEVENT') {
      if (cur && cur.start && events.length < maxEvents) {
        events.push({
          uid: cur.uid || hashString(`${cur.title}|${cur.start.day}`),
          title: cleanTitle(cur.title),
          start: cur.start,
          rrule: cur.rrule || null,
          exdates: cur.exdates,
          recurrenceId: cur.recurrenceId || null,
          cancelled: cur.cancelled === true
        });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const prop = splitProp(line);
    if (!prop) continue;
    switch (prop.name) {
      case 'UID': cur.uid = prop.value.trim().slice(0, 200); break;
      case 'SUMMARY': cur.title = prop.value; break;
      case 'DTSTART': cur.start = parseIcsDate(prop.value, prop.params, timeZone); break;
      case 'RRULE': cur.rrule = parseRrule(prop.value); break;
      case 'EXDATE':
        for (const v of prop.value.split(',')) {
          const d = parseIcsDate(v, prop.params, timeZone);
          if (d) cur.exdates.add(d.day);
        }
        break;
      case 'RECURRENCE-ID': {
        const d = parseIcsDate(prop.value, prop.params, timeZone);
        if (d) cur.recurrenceId = d.day;
        break;
      }
      case 'STATUS': cur.cancelled = /CANCELLED/i.test(prop.value); break;
      default: break;
    }
  }
  return events;
}

/** Does a recurring event fall on `key`? Walks from the first day so COUNT is honoured. */
function recursOn(event, key) {
  const rule = event.rrule;
  const first = event.start.day;
  if (key < first) return false;
  const freq = String(rule.FREQ || '').toUpperCase();
  const interval = Math.max(1, Number(rule.INTERVAL) || 1);
  let until = '';
  if (rule.UNTIL) {
    const u = parseIcsDate(rule.UNTIL, '', DEFAULT_CALENDAR_TIME_ZONE);
    until = u ? u.day : '';
  }
  if (until && key > until) return false;
  const count = Number(rule.COUNT) || 0;
  const byDay = rule.BYDAY
    ? rule.BYDAY.split(',').map((d) => WEEKDAYS[d.replace(/^[+-]?\d+/, '').toUpperCase()]).filter((d) => d !== undefined)
    : null;
  const byMonthDay = rule.BYMONTHDAY ? rule.BYMONTHDAY.split(',').map(Number) : null;
  const firstUtc = keyToUtc(first);
  const firstDate = new Date(firstUtc);

  const matches = (k) => {
    const days = Math.round((keyToUtc(k) - firstUtc) / DAY_MS);
    const d = new Date(keyToUtc(k));
    if (freq === 'DAILY') return days % interval === 0;
    if (freq === 'WEEKLY') {
      const weekIndex = Math.floor((days + weekdayOf(first)) / 7);
      if (weekIndex % interval !== 0) return false;
      return byDay ? byDay.includes(d.getUTCDay()) : d.getUTCDay() === firstDate.getUTCDay();
    }
    if (freq === 'MONTHLY') {
      const months = (d.getUTCFullYear() - firstDate.getUTCFullYear()) * 12 + d.getUTCMonth() - firstDate.getUTCMonth();
      if (months % interval !== 0) return false;
      if (byMonthDay) return byMonthDay.includes(d.getUTCDate());
      if (byDay) return byDay.includes(d.getUTCDay()) && Math.ceil(d.getUTCDate() / 7) === Math.ceil(firstDate.getUTCDate() / 7);
      return d.getUTCDate() === firstDate.getUTCDate();
    }
    if (freq === 'YEARLY') {
      const years = d.getUTCFullYear() - firstDate.getUTCFullYear();
      return years % interval === 0 && d.getUTCMonth() === firstDate.getUTCMonth() && d.getUTCDate() === firstDate.getUTCDate();
    }
    return k === first;
  };

  if (!count) return matches(key);
  // COUNT: count every occurrence from the first day up to `key` (bounded walk).
  let seen = 0;
  for (let k = first, steps = 0; k <= key && steps < 3700; k = addDays(k, 1), steps++) {
    if (matches(k)) {
      seen++;
      if (seen > count) return false;
      if (k === key) return true;
    }
  }
  return false;
}

/** Occurrences on days from..to (inclusive): { uid, title, day, time, allDay }. Sorted by day. */
export function eventsBetween(events = [], from, to) {
  const overrides = new Map(); // uid -> Set of days replaced by a RECURRENCE-ID copy
  for (const e of events) {
    if (e.recurrenceId) {
      if (!overrides.has(e.uid)) overrides.set(e.uid, new Set());
      overrides.get(e.uid).add(e.recurrenceId);
    }
  }
  const out = [];
  for (const e of events) {
    if (e.cancelled || !e.title) continue;
    const push = (day) => out.push({ uid: e.uid, title: e.title, day, time: e.start.allDay ? '' : e.start.time, allDay: e.start.allDay });
    if (e.recurrenceId || !e.rrule) {
      if (e.start.day >= from && e.start.day <= to) push(e.start.day);
      continue;
    }
    const skip = overrides.get(e.uid);
    for (let k = from; k <= to; k = addDays(k, 1)) {
      if (e.exdates.has(k) || skip?.has(k)) continue;
      if (recursOn(e, k)) push(k);
    }
  }
  return out.sort((a, b) => (a.day === b.day ? (a.allDay === b.allDay ? a.time.localeCompare(b.time) : a.allDay ? -1 : 1) : a.day.localeCompare(b.day)));
}

// ── Which kid an event is for ───────────────────────────────────────────────────

const YOUNGER = /\b(pre-?k|pre-?school|kinder(garten)?)\b/i;
const OLDER = /\b(2nd|second)\s*grade\b/i;

// Words that say an event is for the kids even when nobody is named.
const KIDS_WORDS = /\b(kids?|boys|girls|children|family|school|classroom|teacher)\b/i;

/**
 * Kids an event is for: anyone named in the title; otherwise a grade word picks the kid on
 * that level (easy = Pre-K/K, hard = 2nd grade); otherwise every kid.
 * With requireMention (a parent's calendar mixes in their own appointments), an event that
 * names no kid, grade or kids word is for nobody.
 */
export function kidsForEvent(title, heroes = [], { requireMention = false } = {}) {
  const kids = heroes.filter((h) => h && h.id && h.name);
  const named = kids.filter((h) => new RegExp(`\\b${String(h.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(title));
  if (named.length) return named.map((h) => h.id);
  const level = (h) => String(h.gameDifficulty || h.difficulty || h.learningLevel || '').toLowerCase();
  if (YOUNGER.test(title)) {
    const k = kids.filter((h) => level(h) === 'easy');
    if (k.length) return k.map((h) => h.id);
  }
  if (OLDER.test(title)) {
    const k = kids.filter((h) => level(h) === 'hard');
    if (k.length) return k.map((h) => h.id);
  }
  if (requireMention && !KIDS_WORDS.test(title)) return [];
  return kids.map((h) => h.id);
}

/** The prep rule for an event title, or null. */
export function prepRuleFor(title) {
  const t = String(title || '');
  if (!t || INFO_ONLY.test(t)) return null;
  return PREP_RULES.find((r) => r.match.test(t)) || null;
}

function taskTitle(rule, eventTitle) {
  if (!rule.task.includes('{activity}')) return rule.task;
  const m = rule.match.exec(eventTitle);
  const word = m ? m[0].toLowerCase() : 'activity';
  return rule.task.replace('{activity}', word === 'practice' || word === 'lesson' ? cleanTitle(eventTitle).split(/\s+/).slice(0, 2).join(' ').toLowerCase() : word);
}

/**
 * Chores for the evening before each event in `occurrences`.
 * Returns [{ id, title, showOn, eventDay, eventTitle, heroIds, icon, emoji, ruleId }].
 */
export function buildPrepTasks(occurrences = [], heroes = []) {
  const tasks = [];
  const seen = new Set();
  for (const occ of occurrences) {
    const rule = prepRuleFor(occ.title);
    if (!rule) continue;
    // School-only rules (library, picture day...) are for every kid; rules that also fit a
    // grown-up's appointment (dentist, party, practice...) need a kid named in the event.
    const heroIds = kidsForEvent(occ.title, heroes, { requireMention: rule.kidOnly === true });
    if (!heroIds.length) continue;
    const id = `cal_${hashString(occ.uid)}_${occ.day.replace(/-/g, '')}_${rule.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    tasks.push({
      id,
      title: taskTitle(rule, occ.title),
      showOn: addDays(occ.day, -1),
      eventDay: occ.day,
      eventTitle: occ.title,
      eventTime: occ.time || '',
      heroIds,
      icon: rule.icon,
      emoji: rule.emoji,
      ruleId: rule.id
    });
  }
  return tasks;
}

/**
 * Everything the app needs for the next `days` days, as of `now`:
 *  { today, events:[...occurrences, with heroIds], prepTasks:[...] }
 * Prep tasks cover events from today through the window so tonight's chores are included.
 */
/** The 6-week (42-day) grid a month calendar shows: Sunday on or before the 1st. */
export function monthGridRange(todayKey) {
  const [y, m] = todayKey.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const weekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const start = addDays(first, -weekday);
  return { month: first.slice(0, 7), start, end: addDays(start, 42) };
}

export function buildCalendarPlan(events = [], heroes = [], { now = Date.now(), days = 7, timeZone = DEFAULT_CALENDAR_TIME_ZONE, month = false } = {}) {
  const today = localDayKey(now, timeZone);
  const weekEnd = addDays(today, Math.max(1, Math.min(31, days)));
  const grid = month ? monthGridRange(today) : null;
  const from = grid && grid.start < today ? grid.start : today;
  const to = grid && grid.end > weekEnd ? grid.end : weekEnd;
  const occurrences = eventsBetween(events, from, to).slice(0, month ? 200 : 60);
  const upcoming = occurrences.filter((o) => o.day >= today && o.day < weekEnd);
  const prepTasks = buildPrepTasks(upcoming, heroes).filter((t) => t.showOn >= today);
  const withKids = (o) => ({ ...o, heroIds: kidsForEvent(o.title, heroes, { requireMention: true }), emoji: prepRuleFor(o.title)?.emoji || '📅' });
  return {
    today,
    events: upcoming.map(withKids),
    ...(grid ? { month: { ...grid, events: occurrences.map(withKids) } } : {}),
    prepTasks
  };
}

/** Plain-text heads-up for tonight's prep chores (for ntfy). '' when there is nothing to do. */
export function formatTonightMessage(plan, heroes = []) {
  const tonight = (plan?.prepTasks || []).filter((t) => t.showOn === plan.today);
  if (!tonight.length) return '';
  const nameOf = (id) => heroes.find((h) => h.id === id)?.name || 'a hero';
  return tonight
    .map((t) => `${t.emoji} ${t.eventTitle}${t.eventTime ? ` at ${t.eventTime}` : ''} tomorrow: "${t.title}" added for ${t.heroIds.map(nameOf).join(' & ') || 'everyone'}.`)
    .join('\n')
    .slice(0, 1500);
}
