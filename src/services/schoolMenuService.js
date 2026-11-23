// School breakfast/lunch menus in the browser (Parent Portal Meal Planner, Fridge Display on a
// joined device). Reads MealViewer directly (it allows any origin), falls back to this app's
// server (/api/meals/school), and keeps the last good copy in localStorage for 3 hours so the
// screens work offline and don't hammer MealViewer.
import { parseMealViewer, sanitizeSchoolMenu, mealViewerUrl, addDays, isSchoolSlug, DEFAULT_SCHOOL } from '../../shared/schoolMenu.js';
import { serverApiUrl } from './serverApi.js';

const TTL_MS = 3 * 60 * 60 * 1000;
const CACHE_PREFIX = 'lh-school-menu:';
const memory = new Map();

function readCache(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    const raw = globalThis.localStorage?.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const hit = JSON.parse(raw);
    const body = sanitizeSchoolMenu(hit?.body);
    const entry = { at: Number(hit?.at) || 0, body };
    memory.set(key, entry);
    return entry;
  } catch {
    return null;
  }
}

function writeCache(key, body) {
  const entry = { at: Date.now(), body };
  memory.set(key, entry);
  try {
    globalThis.localStorage?.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {}
}

/**
 * The school's menu for `days` days from `from` (YYYY-MM-DD): { school, days[] } or null.
 * Never throws.
 */
export async function loadSchoolMenu({ slug = DEFAULT_SCHOOL.slug, from, days = 7, fetchImpl = globalThis.fetch, force = false } = {}) {
  const school = isSchoolSlug(slug) ? slug : DEFAULT_SCHOOL.slug;
  const to = addDays(from, days - 1);
  const key = `${school}|${from}|${to}`;
  const hit = readCache(key);
  if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.body;
  try {
    const res = await fetchImpl(mealViewerUrl(school, from, to), { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const body = parseMealViewer(await res.json());
      writeCache(key, body);
      return body;
    }
  } catch {}
  try {
    const res = await fetchImpl(serverApiUrl(`/api/meals/school?school=${encodeURIComponent(school)}&from=${from}&days=${days}`), { cache: 'no-store' });
    if (res.ok) {
      const body = sanitizeSchoolMenu(await res.json());
      writeCache(key, body);
      return body;
    }
  } catch {}
  return hit?.body || null;
}

/** Today's date (YYYY-MM-DD) in this device's time zone. */
export function localDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Monday of the week that holds `dayKey` (weekends roll forward to the coming Monday). */
export function weekStart(dayKey) {
  const wd = new Date(`${dayKey}T00:00:00Z`).getUTCDay();
  if (wd === 6) return addDays(dayKey, 2);
  if (wd === 0) return addDays(dayKey, 1);
  return addDays(dayKey, 1 - wd);
}
