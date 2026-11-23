// The family meal planner: settings plus the meals the family plans itself (dinners, packed
// lunches, weekend breakfasts), layered over the school breakfast and lunch menu.
//
// Stored on the household as state.mealPlan (synced through the household document's
// stateSnapshot), and written by:
//   - the Parent Portal's Meal Planner tab (src/views/MealPlannerPanel.js via the store), and
//   - other apps through the Meal Planner API (server/mealsService.js, docs/meal-planner-api.md),
//     e.g. Dj's future recipe vault.
// Every entry carries updatedAt, and a delete leaves a short-lived tombstone, so two writers can
// merge safely: the newest version of each entry wins (mergeMealPlans).
//
// Pure: the browser, the Pi and App Hosting all use this same code.
import { SCHOOL_MEALS, DEFAULT_SCHOOL, isDayKey, isSchoolSlug, addDays, weekdayOf, mealItemNames, joinChoices } from './schoolMenu.js';

export const MEAL_TYPES = Object.freeze(['breakfast', 'lunch', 'dinner', 'snack']);
export const MEAL_LABELS = Object.freeze({ breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' });
export const MEAL_EMOJI = Object.freeze({ breakfast: '🥣', lunch: '🍱', dinner: '🍽️', snack: '🍎' });
export const MAX_ENTRIES = 300;
const KEEP_PAST_DAYS = 60;
const KEEP_TOMBSTONE_DAYS = 30;
const DAY_MS = 86400000;

const arr = (v) => (Array.isArray(v) ? v : []);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function text(v, max) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function stamp(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function isEntryId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(id);
}

export function newEntryId(date, mealType, rand = Math.random) {
  return `${date}-${mealType}-${Math.floor(rand() * 36 ** 6).toString(36).padStart(6, '0')}`;
}

export function defaultMealSettings() {
  return {
    showSchoolMenu: true,
    showAllSchoolItems: false,
    schoolSlug: DEFAULT_SCHOOL.slug,
    schoolName: DEFAULT_SCHOOL.name,
    tomorrowLunchAlert: true,
    updatedAt: 0
  };
}

export function defaultMealPlan() {
  return { version: 1, settings: defaultMealSettings(), entries: {} };
}

export function normalizeMealSettings(raw) {
  const d = defaultMealSettings();
  if (!isObj(raw)) return d;
  return {
    showSchoolMenu: typeof raw.showSchoolMenu === 'boolean' ? raw.showSchoolMenu : d.showSchoolMenu,
    showAllSchoolItems: typeof raw.showAllSchoolItems === 'boolean' ? raw.showAllSchoolItems : d.showAllSchoolItems,
    schoolSlug: isSchoolSlug(raw.schoolSlug) ? raw.schoolSlug : d.schoolSlug,
    schoolName: text(raw.schoolName, 80) || (isSchoolSlug(raw.schoolSlug) && raw.schoolSlug !== d.schoolSlug ? raw.schoolSlug : d.schoolName),
    tomorrowLunchAlert: typeof raw.tomorrowLunchAlert === 'boolean' ? raw.tomorrowLunchAlert : d.tomorrowLunchAlert,
    updatedAt: stamp(raw.updatedAt)
  };
}

function safeUrl(u) {
  const s = typeof u === 'string' ? u.trim() : '';
  return /^https:\/\/[^\s"'<>]+$/i.test(s) && s.length <= 500 ? s : '';
}

/**
 * One planned meal. Returns null when it isn't usable.
 *   id, date (YYYY-MM-DD), mealType, title, notes, items[], heroIds[] (empty = everyone),
 *   replacesSchool (packed lunch etc. instead of the school meal), recipeId / recipeUrl / source
 *   (for a linked recipe app), emoji, updatedAt, deleted (tombstone).
 */
export function normalizeMealEntry(raw, idHint = '') {
  if (!isObj(raw)) return null;
  const id = isEntryId(raw.id) ? raw.id : (isEntryId(idHint) ? idHint : '');
  if (!id) return null;
  const updatedAt = stamp(raw.updatedAt);
  if (raw.deleted === true) return { id, deleted: true, updatedAt };
  const date = isDayKey(raw.date) ? raw.date : '';
  const mealType = MEAL_TYPES.includes(raw.mealType) ? raw.mealType : '';
  const title = text(raw.title, 80);
  if (!date || !mealType || !title) return null;
  return {
    id,
    date,
    mealType,
    title,
    notes: text(raw.notes, 300),
    items: arr(raw.items).map((i) => text(i, 60)).filter(Boolean).slice(0, 20),
    heroIds: arr(raw.heroIds).map((h) => text(h, 60)).filter(Boolean).slice(0, 10),
    replacesSchool: raw.replacesSchool === true && SCHOOL_MEALS.includes(mealType),
    emoji: text(raw.emoji, 4) || MEAL_EMOJI[mealType],
    recipeId: text(raw.recipeId, 100),
    recipeUrl: safeUrl(raw.recipeUrl),
    source: text(raw.source, 40) || 'app',
    updatedAt
  };
}

/** Clean a stored plan; drops meals older than 60 days and tombstones older than 30 days. */
export function normalizeMealPlan(raw, { now = Date.now() } = {}) {
  const plan = defaultMealPlan();
  if (!isObj(raw)) return plan;
  plan.settings = normalizeMealSettings(raw.settings);
  const oldestDay = new Date(now - KEEP_PAST_DAYS * DAY_MS).toISOString().slice(0, 10);
  const list = Object.entries(isObj(raw.entries) ? raw.entries : {})
    .map(([k, v]) => normalizeMealEntry(v, k))
    .filter(Boolean)
    .filter((e) => (e.deleted ? now - e.updatedAt < KEEP_TOMBSTONE_DAYS * DAY_MS : e.date >= oldestDay))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_ENTRIES);
  for (const e of list) plan.entries[e.id] = e;
  return plan;
}

/** Merge two copies of the plan: for settings and for each entry, the newer updatedAt wins (ties go to `incoming`). */
export function mergeMealPlans(local, incoming, { now = Date.now() } = {}) {
  const a = normalizeMealPlan(local, { now });
  const b = normalizeMealPlan(incoming, { now });
  const out = { version: 1, settings: b.settings.updatedAt >= a.settings.updatedAt ? b.settings : a.settings, entries: { ...a.entries } };
  for (const [id, e] of Object.entries(b.entries)) {
    const mine = out.entries[id];
    if (!mine || e.updatedAt >= mine.updatedAt) out.entries[id] = e;
  }
  return normalizeMealPlan(out, { now });
}

/** Add or replace one entry. Returns { plan, entry } or throws with a readable message. */
export function upsertMealEntry(plan, input, { now = Date.now(), rand = Math.random } = {}) {
  const base = normalizeMealPlan(plan, { now });
  const date = input?.date;
  const mealType = input?.mealType;
  const id = isEntryId(input?.id) ? input.id : newEntryId(isDayKey(date) ? date : 'meal', MEAL_TYPES.includes(mealType) ? mealType : 'meal', rand);
  const prev = base.entries[id];
  const merged = prev && !prev.deleted ? { ...prev, ...input } : { ...input };
  const entry = normalizeMealEntry({ ...merged, id, deleted: false, updatedAt: Math.max(now, (prev?.updatedAt || 0) + 1) });
  if (!entry) {
    if (!isDayKey(merged.date)) throw new Error('date must be YYYY-MM-DD');
    if (!MEAL_TYPES.includes(merged.mealType)) throw new Error(`mealType must be one of ${MEAL_TYPES.join(', ')}`);
    throw new Error('title is required');
  }
  base.entries[id] = entry;
  return { plan: normalizeMealPlan(base, { now }), entry };
}

export function removeMealEntry(plan, id, { now = Date.now() } = {}) {
  const base = normalizeMealPlan(plan, { now });
  const prev = base.entries[id];
  if (!prev || prev.deleted) return { plan: base, removed: false };
  base.entries[id] = { id, deleted: true, updatedAt: Math.max(now, prev.updatedAt + 1) };
  return { plan: normalizeMealPlan(base, { now }), removed: true };
}

export function updateMealSettings(plan, patch, { now = Date.now() } = {}) {
  const base = normalizeMealPlan(plan, { now });
  const p = isObj(patch) ? patch : {};
  if ('schoolSlug' in p && !isSchoolSlug(p.schoolSlug)) throw new Error('schoolSlug must be a MealViewer school name like CanterburyStreetMagnet');
  const next = normalizeMealSettings({ ...base.settings, ...p, updatedAt: Math.max(now, base.settings.updatedAt + 1) });
  if ('schoolSlug' in p && !('schoolName' in p) && p.schoolSlug !== base.settings.schoolSlug) next.schoolName = p.schoolSlug;
  base.settings = next;
  return { plan: base, settings: next };
}

/** Live (not deleted) entries between two days, inclusive, sorted by date then meal. */
export function listMealEntries(plan, { from = '', to = '' } = {}) {
  return Object.values(normalizeMealPlan(plan).entries)
    .filter((e) => !e.deleted && (!from || e.date >= from) && (!to || e.date <= to))
    .sort((a, b) => (a.date === b.date ? MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType) : a.date < b.date ? -1 : 1));
}

/**
 * What every screen shows for a run of days: per day, per meal, the school menu (unless turned
 * off or replaced by a family meal) and the family's own meals.
 *
 * @param school  { days: [...] } from parseMealViewer / sanitizeSchoolMenu (may be null)
 * @param skipWeekends  leave Saturday and Sunday out when nothing is planned on them
 */
export function buildMealDays({ plan, school = null, from, days = 7, skipWeekends = true, showAll } = {}) {
  const p = normalizeMealPlan(plan);
  const s = p.settings;
  const all = showAll ?? s.showAllSchoolItems;
  const schoolByDay = new Map(arr(school?.days).map((d) => [d.date, d]));
  const entries = listMealEntries(p, { from, to: addDays(from, days - 1) });
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const wd = weekdayOf(date);
    const fam = entries.filter((e) => e.date === date);
    const sd = s.showSchoolMenu ? schoolByDay.get(date) : null;
    if (skipWeekends && (wd === 0 || wd === 6) && !fam.length) continue;
    const meals = {};
    for (const type of MEAL_TYPES) {
      const family = fam.filter((e) => e.mealType === type);
      const replaced = family.some((e) => e.replacesSchool);
      const sm = SCHOOL_MEALS.includes(type) && sd && !replaced ? sd[type] : null;
      const schoolMeal = sm ? { main: sm.main, extras: all ? sm.extras : [], names: mealItemNames(sm, { showAll: all }) } : null;
      if (schoolMeal || family.length) meals[type] = { school: schoolMeal, family };
    }
    out.push({
      date,
      weekday: wd,
      // Only a known school day can be "no school": a weekday MealViewer answered with nothing.
      noSchool: Boolean(s.showSchoolMenu && school && schoolByDay.has(date) && schoolByDay.get(date).noSchool && wd !== 0 && wd !== 6),
      meals
    });
  }
  return out;
}

/** The line for the 6:30 PM "Get ready for tomorrow" alert, or '' when there is nothing to say. */
export function formatTomorrowLunch(day, { heroNames = [] } = {}) {
  if (!day) return '';
  const lunch = day.meals?.lunch;
  const packed = arr(lunch?.family).find((e) => e.replacesSchool);
  if (packed) return `🍱 Tomorrow's lunch: ${packed.title} (packed, not school lunch).`;
  if (lunch?.school?.main?.length) {
    const who = heroNames.length ? ` for ${joinChoices(heroNames, 'and')}` : '';
    return `🍱 Tomorrow's school lunch${who}: ${joinChoices(lunch.school.main.map((m) => m.name))}.`;
  }
  if (day.noSchool) return '🏠 No school lunch tomorrow (no school).';
  return '';
}
