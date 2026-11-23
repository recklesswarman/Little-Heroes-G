// School breakfast and lunch menus from MealViewer (schools.mealviewer.com).
//
// MealViewer's public site is backed by a JSON API that needs no key:
//   GET https://api.mealviewer.com/api/v4/school/<School>/<MM-DD-YYYY>/<MM-DD-YYYY>/0
// It answers with menuSchedules[] (one per day) -> menuBlocks[] (Breakfast, Lunch, after-school
// blocks) -> cafeteriaLineList.data[] -> foodItemList.data[] (item_Name, item_Type).
// It sends Access-Control-Allow-Origin: *, so browsers can call it directly; the Pi and
// App Hosting call it too (server/mealsService.js).
//
// Pure: this file turns that response into a small, clean shape every screen shares:
//   { school, days: [{ date, noSchool, breakfast: { main, extras }, lunch: { main, extras } }] }
// "main" are the main dishes (what the fridge shows by default); "extras" are the rest
// (fruit, veggies, sides, milk, sauces), shown only when a parent turns "Show all items" on.
// After-school blocks (supper, snack) are left out on purpose.

export const DEFAULT_SCHOOL = Object.freeze({ slug: 'CanterburyStreetMagnet', name: 'Canterbury Street Magnet' });
export const MEALVIEWER_API = 'https://api.mealviewer.com/api/v4/school';
export const SCHOOL_MEALS = Object.freeze(['breakfast', 'lunch']);

const arr = (v) => (Array.isArray(v) ? v : []);

export function isSchoolSlug(slug) {
  return typeof slug === 'string' && /^[A-Za-z0-9][A-Za-z0-9-]{2,79}$/.test(slug);
}

export function isDayKey(d) {
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
}

/** 'YYYY-MM-DD' -> 'MM-DD-YYYY', the date format MealViewer's URLs use. */
export function toMealViewerDate(dayKey) {
  const [y, m, d] = dayKey.split('-');
  return `${m}-${d}-${y}`;
}

export function addDays(dayKey, n) {
  const t = Date.parse(`${dayKey}T00:00:00Z`) + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekdayOf(dayKey) {
  return new Date(Date.parse(`${dayKey}T00:00:00Z`)).getUTCDay();
}

export function mealViewerUrl(slug, fromDay, toDay) {
  if (!isSchoolSlug(slug)) throw new Error('Invalid school name');
  if (!isDayKey(fromDay) || !isDayKey(toDay)) throw new Error('Invalid date');
  return `${MEALVIEWER_API}/${encodeURIComponent(slug)}/${toMealViewerDate(fromDay)}/${toMealViewerDate(toDay)}/0`;
}

/** A school site link or a bare name -> the MealViewer school name ("CanterburyStreetMagnet"). */
export function schoolSlugFrom(input) {
  const raw = String(input || '').trim();
  const m = raw.match(/mealviewer\.com\/school\/([A-Za-z0-9-]+)/i);
  const slug = m ? m[1] : raw.replace(/\s+/g, '');
  return isSchoolSlug(slug) ? slug : '';
}

const CODE_PATTERNS = [
  /\bWPS\s*\d+\b/gi, // cafeteria recipe codes ("WPS 27", "WPS26")
  /\bUSDA\s+Bean\b/gi, // "Hummus USDA Bean" -> "Hummus"
  /\(ED\)/gi,
  /\bUSDA\b/gi,
  /\bCACFP\b/gi,
  /\bIW\b/g, // individually wrapped
  /\bSEC\b/gi,
  /\bEle\b/g,
  /\bBulk\b/gi
];

function titleCase(s) {
  return s.toLowerCase().replace(/(^|[\s(/&-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
}

/** "APPLES,RAW,WITH SKIN - WPS26" -> "Apples"; "WG Trix Cereal" -> "Trix Cereal". */
export function cleanFoodName(name) {
  let s = typeof name === 'string' ? name.replace(/[\u0000-\u001f\u007f]/g, ' ') : '';
  for (const re of CODE_PATTERNS) s = s.replace(re, ' ');
  // USDA-style "APPLES,RAW,WITH SKIN" / "Peas, Frozen" / "Clementines, RAW": keep the food itself.
  if (s.includes(',')) s = s.split(',')[0];
  s = s.replace(/^\s*(WG|LF)\s+/i, '').replace(/\bMustart\b/gi, 'Mustard');
  s = s.replace(/\s+-\s*$/, '').replace(/\s+/g, ' ').trim();
  if (s && s === s.toUpperCase() && /[A-Z]{3}/.test(s)) s = titleCase(s);
  return s.slice(0, 60);
}

const GROUPS = {
  ENTREES: 'main',
  BREAKFAST: 'main',
  'BREAD/ROLLS/STARCH': 'side',
  VEGETABLES: 'veggie',
  FRUIT: 'fruit',
  MILK: 'milk',
  SAUCE: 'sauce',
  SNACKS: 'snack',
  MISCELLANEOUS: 'side'
};
export const EXTRA_GROUP_LABELS = Object.freeze({ side: 'Sides', veggie: 'Veggies', fruit: 'Fruit', milk: 'Milk', sauce: 'Sauces', snack: 'Snacks' });
const GROUP_ORDER = ['side', 'veggie', 'fruit', 'milk', 'sauce', 'snack'];

export function foodGroup(itemType) {
  return GROUPS[String(itemType || '').trim().toUpperCase()] || 'side';
}

const EMOJI_RULES = [
  [/pizza|lunchable/i, '🍕'], [/burger/i, '🍔'], [/hot ?dog|corn ?dog/i, '🌭'], [/taco|nacho|burrito|quesadilla/i, '🌮'],
  [/chicken|drumstick|nugget|tender/i, '🍗'], [/sandwich|sunbutter|wrap|sub\b|panini|grilled cheese/i, '🥪'],
  [/pasta|spaghetti|mac|noodle|lasagna|ravioli/i, '🍝'], [/rice/i, '🍚'], [/soup|chili/i, '🍲'], [/salad/i, '🥗'],
  [/pancake/i, '🥞'], [/waffle/i, '🧇'], [/bagel/i, '🥯'], [/muffin|zeezee|bar\b|loaf/i, '🧁'], [/cereal|cheerios|granola|crunch|puff|trix/i, '🥣'],
  [/egg|omelet/i, '🍳'], [/yogurt|parfait/i, '🥛'], [/toast|bread|biscuit|french/i, '🍞'], [/fish|tuna/i, '🐟'], [/cheese/i, '🧀'],
  [/apple/i, '🍎'], [/orange|clementine/i, '🍊'], [/banana/i, '🍌'], [/carrot/i, '🥕'], [/broccoli/i, '🥦'], [/milk/i, '🥛']
];

export function foodEmoji(name, fallback = '🍽️') {
  for (const [re, e] of EMOJI_RULES) if (re.test(name)) return e;
  return fallback;
}

function mealKey(blockName) {
  const b = String(blockName || '').toLowerCase();
  if (/after\s*school|supper|snack|dinner/.test(b)) return null;
  if (/breakfast/.test(b)) return 'breakfast';
  if (/lunch/.test(b)) return 'lunch';
  return null;
}

function emptyMeal() {
  return { main: [], extras: [] };
}

function addItem(meal, rawName, itemType) {
  const name = cleanFoodName(rawName);
  if (!name) return;
  const key = name.toLowerCase();
  if (meal.main.some((m) => m.name.toLowerCase() === key) || meal.extras.some((m) => m.name.toLowerCase() === key)) return;
  const group = foodGroup(itemType);
  if (group === 'main') {
    if (meal.main.length < 12) meal.main.push({ name, emoji: foodEmoji(name) });
  } else if (meal.extras.length < 30) {
    meal.extras.push({ name, group });
  }
}

/**
 * MealViewer response -> { school, days[] } sorted by date. A day with no breakfast or lunch
 * comes back as { noSchool: true } (holidays and weekends look the same in MealViewer).
 */
export function parseMealViewer(json) {
  const school = typeof json?.physicalLocation?.name === 'string' ? json.physicalLocation.name.trim().slice(0, 80) : '';
  const byDate = new Map();
  for (const sched of arr(json?.menuSchedules)) {
    const date = String(sched?.dateInformation?.dateFull || '').slice(0, 10);
    if (!isDayKey(date)) continue;
    const day = byDate.get(date) || { date, breakfast: null, lunch: null };
    for (const block of arr(sched?.menuBlocks)) {
      const key = mealKey(block?.blockName);
      if (!key) continue;
      day[key] = day[key] || emptyMeal();
      for (const line of arr(block?.cafeteriaLineList?.data)) {
        for (const item of arr(line?.foodItemList?.data)) addItem(day[key], item?.item_Name, item?.item_Type);
      }
    }
    byDate.set(date, day);
  }
  const days = [...byDate.values()]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((d) => {
      for (const k of SCHOOL_MEALS) {
        if (d[k]) d[k].extras.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
        if (d[k] && !d[k].main.length && !d[k].extras.length) d[k] = null;
      }
      return { ...d, noSchool: !d.breakfast && !d.lunch };
    });
  return { school, days };
}

/** Validate a school-menu payload that came over the wire (a browser cache or our own server). */
export function sanitizeSchoolMenu(input) {
  const cleanMeal = (m) => {
    if (!m || typeof m !== 'object') return null;
    const main = arr(m.main).slice(0, 12).map((i) => ({ name: cleanFoodName(i?.name), emoji: typeof i?.emoji === 'string' ? i.emoji.slice(0, 4) : '🍽️' })).filter((i) => i.name);
    const extras = arr(m.extras).slice(0, 30).map((i) => ({ name: cleanFoodName(i?.name), group: EXTRA_GROUP_LABELS[i?.group] ? i.group : 'side' })).filter((i) => i.name);
    return main.length || extras.length ? { main, extras } : null;
  };
  const days = arr(input?.days).filter((d) => isDayKey(d?.date)).slice(0, 62).map((d) => {
    const breakfast = cleanMeal(d.breakfast);
    const lunch = cleanMeal(d.lunch);
    return { date: d.date, breakfast, lunch, noSchool: !breakfast && !lunch };
  });
  return { school: typeof input?.school === 'string' ? input.school.slice(0, 80) : '', days };
}

/** Names to show for one school meal: main dishes, plus everything else when showAll is on. */
export function mealItemNames(meal, { showAll = false } = {}) {
  if (!meal) return [];
  const names = meal.main.map((m) => m.name);
  return showAll ? names.concat(meal.extras.map((e) => e.name)) : names;
}

/** "A, B or C" */
export function joinChoices(names, word = 'or') {
  const list = arr(names).filter(Boolean);
  if (list.length <= 1) return list[0] || '';
  return `${list.slice(0, -1).join(', ')} ${word} ${list[list.length - 1]}`;
}
