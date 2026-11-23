// School menus and the Meal Planner API.
//
// 1. GET /api/meals/school?from=YYYY-MM-DD&days=7[&school=CanterburyStreetMagnet]
//    Public (school menus are public): the school's breakfast and lunch from MealViewer,
//    cleaned up by shared/schoolMenu.js and cached for 3 hours. Browsers can also read
//    MealViewer directly; this is the fallback, and what the Pi's fridge and 6:30 PM alert use.
//
// 2. The Meal Planner API under /api/meals/v1 (docs/meal-planner-api.md), so another app
//    (Dj's recipe vault / meal planner) can read and control this app's meal planner:
//      GET    /api/meals/v1/plan?from&days      days with school + family meals, settings
//      GET    /api/meals/v1/entries?from&to     the family's planned meals
//      PUT    /api/meals/v1/entries/:id         add or replace a meal (id chosen by the caller)
//      POST   /api/meals/v1/entries             add a meal (id made here)
//      DELETE /api/meals/v1/entries/:id
//      GET    /api/meals/v1/settings / PATCH /api/meals/v1/settings
//      GET    /api/meals/v1/school?from&days
//    Every call needs "Authorization: Bearer <MEALS_API_TOKEN>". The household is the first of
//    HOUSEHOLD_CODES (as for the fridge display). Writes go to the household document's
//    stateSnapshot.mealPlan in Firestore, so every family device picks them up live.
import { timingSafeEqual } from 'node:crypto';
import { parseMealViewer, mealViewerUrl, isSchoolSlug, isDayKey, addDays, DEFAULT_SCHOOL } from '../shared/schoolMenu.js';
import {
  normalizeMealPlan, buildMealDays, listMealEntries, upsertMealEntry, removeMealEntry, updateMealSettings, isEntryId, MEAL_TYPES
} from '../shared/mealPlan.js';
import { dayKey, DEFAULT_TIME_ZONE } from '../shared/familyInsights.js';
import { fetchHousehold, householdCodesFromEnv, updateHouseholdField } from './householdReader.js';

const SCHOOL_TTL_MS = 3 * 60 * 60 * 1000;
const SCHOOL_FAIL_TTL_MS = 5 * 60 * 1000;
const MAX_DAYS = 31;
export const MEAL_PLAN_FIELD = 'stateSnapshot.mealPlan';
const API_WRITER_ID = 'meals-api';

/** School menu fetcher with a small in-memory cache (per school + date range). */
export function createSchoolMenuFetcher({ fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const cache = new Map();
  return async function getSchoolMenu(slug, from, days) {
    const to = addDays(from, days - 1);
    const key = `${slug}|${from}|${to}`;
    const hit = cache.get(key);
    if (hit && now() < hit.until) {
      if (hit.error) throw hit.error;
      return hit.body;
    }
    try {
      const res = await fetchImpl(mealViewerUrl(slug, from, to), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`MealViewer returned ${res.status}`);
      const body = { ...parseMealViewer(await res.json()), slug, from, to, fetchedAt: new Date(now()).toISOString() };
      cache.set(key, { body, until: now() + SCHOOL_TTL_MS });
      if (cache.size > 50) cache.delete(cache.keys().next().value);
      return body;
    } catch (err) {
      if (hit?.body) return { ...hit.body, stale: true };
      cache.set(key, { error: err, until: now() + SCHOOL_FAIL_TTL_MS });
      throw err;
    }
  };
}

export const getSchoolMenu = createSchoolMenuFetcher();

function rangeFrom(query, env, now) {
  const today = dayKey(now(), env.REPORT_TIME_ZONE || DEFAULT_TIME_ZONE);
  const from = isDayKey(query?.from) ? query.from : today;
  let days = Number.parseInt(query?.days, 10);
  if (isDayKey(query?.to) && query.to >= from) days = Math.round((Date.parse(`${query.to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
  if (!Number.isFinite(days) || days < 1) days = 7;
  return { from, days: Math.min(days, MAX_DAYS) };
}

/** The family's school (settings) or SCHOOL_MENU_SLUG or Canterbury Street Magnet. */
function schoolSlugFor(plan, env) {
  if (plan?.settings?.schoolSlug && isSchoolSlug(plan.settings.schoolSlug)) return plan.settings.schoolSlug;
  return isSchoolSlug(env.SCHOOL_MENU_SLUG) ? env.SCHOOL_MENU_SLUG : DEFAULT_SCHOOL.slug;
}

export function readBearer(req) {
  const h = String(req.headers?.authorization || '');
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

function tokenMatches(given, expected) {
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Build the meal-planner days for the household (used by the API, the fridge and the alert).
 * Never throws for a MealViewer outage: school meals just come back empty with schoolError set.
 */
export async function buildHouseholdMealDays(state, { from, days, env = process.env, schoolMenu = getSchoolMenu, skipWeekends = true } = {}) {
  const plan = normalizeMealPlan(state?.mealPlan);
  let school = null;
  let schoolError = '';
  if (plan.settings.showSchoolMenu) {
    try {
      school = await schoolMenu(schoolSlugFor(plan, env), from, days);
    } catch (err) {
      schoolError = err?.message || 'School menu unavailable';
    }
  }
  return { plan, school, schoolError, days: buildMealDays({ plan, school, from, days, skipWeekends }) };
}

export function createMealsHandlers({ env = process.env, fetchHouseholdImpl = fetchHousehold, updateField = updateHouseholdField, schoolMenu = getSchoolMenu, now = () => Date.now() } = {}) {
  const household = () => householdCodesFromEnv(env)[0] || '';

  async function handleSchool(req, res) {
    res.setHeader('Cache-Control', 'public, max-age=900');
    const school = req.query?.school || env.SCHOOL_MENU_SLUG || DEFAULT_SCHOOL.slug;
    if (!isSchoolSlug(school)) return res.status(400).json({ error: 'school must be a MealViewer school name like CanterburyStreetMagnet' });
    const { from, days } = rangeFrom(req.query, env, now);
    try {
      return res.json(await schoolMenu(school, from, days));
    } catch (err) {
      console.warn('School menu failed:', err?.message || err);
      return res.status(502).json({ error: 'Could not load the school menu right now' });
    }
  }

  /** Bearer-token gate for /api/meals/v1. */
  function requireToken(req, res, next) {
    res.setHeader('Cache-Control', 'no-store');
    const expected = String(env.MEALS_API_TOKEN || '');
    if (expected.length < 24) return res.status(503).json({ error: 'The Meal Planner API is off. Set MEALS_API_TOKEN (24+ characters) on this server.' });
    if (!tokenMatches(readBearer(req), expected)) return res.status(401).json({ error: 'Missing or wrong API token' });
    if (!household()) return res.status(503).json({ error: 'Set HOUSEHOLD_CODES on this server to use the Meal Planner API' });
    return next();
  }

  async function readPlanState() {
    return fetchHouseholdImpl(household());
  }

  /** Apply fn(plan) -> { plan, ...result } to the stored plan and return the result. */
  async function writePlan(fn) {
    let result = null;
    await updateField(household(), MEAL_PLAN_FIELD, (current) => {
      result = fn(normalizeMealPlan(current, { now: now() }));
      return result.plan;
    }, {
      extra: { lastWriterSessionId: API_WRITER_ID, lastWriterDeviceId: API_WRITER_ID, updatedAt: new Date(now()).toISOString() }
    });
    return result;
  }

  const fail = (res, err, fallback = 'Could not reach the household right now') => {
    const msg = err?.message || '';
    if (/must be|required|Invalid/i.test(msg)) return res.status(400).json({ error: msg });
    console.warn('Meal Planner API:', msg || err);
    return res.status(502).json({ error: fallback });
  };

  return {
    handleSchool,
    requireToken,

    async getPlan(req, res) {
      try {
        const { from, days } = rangeFrom(req.query, env, now);
        const state = await readPlanState();
        const out = await buildHouseholdMealDays(state, { from, days, env, schoolMenu, skipWeekends: req.query?.weekends !== 'true' });
        return res.json({ from, days: out.days, settings: out.plan.settings, school: out.school ? { name: out.school.school, slug: out.school.slug } : null, schoolError: out.schoolError || undefined });
      } catch (err) {
        return fail(res, err);
      }
    },

    async getSchoolForHousehold(req, res) {
      try {
        const { from, days } = rangeFrom(req.query, env, now);
        const plan = normalizeMealPlan((await readPlanState())?.mealPlan);
        return res.json(await schoolMenu(schoolSlugFor(plan, env), from, days));
      } catch (err) {
        return fail(res, err, 'Could not load the school menu right now');
      }
    },

    async listEntries(req, res) {
      try {
        const plan = normalizeMealPlan((await readPlanState())?.mealPlan);
        const from = isDayKey(req.query?.from) ? req.query.from : '';
        const to = isDayKey(req.query?.to) ? req.query.to : '';
        return res.json({ entries: listMealEntries(plan, { from, to }) });
      } catch (err) {
        return fail(res, err);
      }
    },

    async putEntry(req, res) {
      const id = req.params?.id;
      if (!isEntryId(id)) return res.status(400).json({ error: 'id may use letters, numbers and _ . : - (up to 80)' });
      try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const { entry } = await writePlan((plan) => upsertMealEntry(plan, { source: 'api', ...body, id }, { now: now() }));
        return res.json({ entry });
      } catch (err) {
        return fail(res, err);
      }
    },

    async postEntry(req, res) {
      try {
        const body = req.body && typeof req.body === 'object' ? { ...req.body } : {};
        delete body.id;
        const { entry } = await writePlan((plan) => upsertMealEntry(plan, { source: 'api', ...body }, { now: now() }));
        return res.status(201).json({ entry });
      } catch (err) {
        return fail(res, err);
      }
    },

    async deleteEntry(req, res) {
      const id = req.params?.id;
      if (!isEntryId(id)) return res.status(400).json({ error: 'Invalid id' });
      try {
        const { removed } = await writePlan((plan) => removeMealEntry(plan, id, { now: now() }));
        return removed ? res.json({ deleted: id }) : res.status(404).json({ error: 'No meal with that id' });
      } catch (err) {
        return fail(res, err);
      }
    },

    async getSettings(req, res) {
      try {
        return res.json({ settings: normalizeMealPlan((await readPlanState())?.mealPlan).settings, mealTypes: MEAL_TYPES });
      } catch (err) {
        return fail(res, err);
      }
    },

    async patchSettings(req, res) {
      try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const allowed = ['showSchoolMenu', 'showAllSchoolItems', 'schoolSlug', 'schoolName', 'tomorrowLunchAlert'];
        const patch = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
        const { settings } = await writePlan((plan) => updateMealSettings(plan, patch, { now: now() }));
        return res.json({ settings });
      } catch (err) {
        return fail(res, err);
      }
    }
  };
}

/** Mount the routes. `limiter` is applied to every meals route. */
export function mountMealsRoutes(app, express, { limiter = (req, res, next) => next(), handlers = createMealsHandlers() } = {}) {
  app.get('/api/meals/school', limiter, handlers.handleSchool);
  const api = express.Router();
  api.use(limiter, handlers.requireToken);
  api.get('/plan', handlers.getPlan);
  api.get('/school', handlers.getSchoolForHousehold);
  api.get('/entries', handlers.listEntries);
  api.post('/entries', handlers.postEntry);
  api.put('/entries/:id', handlers.putEntry);
  api.delete('/entries/:id', handlers.deleteEntry);
  api.get('/settings', handlers.getSettings);
  api.patch('/settings', handlers.patchSettings);
  app.use('/api/meals/v1', api);
  return handlers;
}
