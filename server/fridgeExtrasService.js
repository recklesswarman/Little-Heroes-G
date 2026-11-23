// Fridge extras (shared/fridgeExtras.js): NASA's space picture, one "On this day" fact and
// today's sunset, fetched once a day and cached. Public data only, so GET /api/fridge/extras
// answers any device (the Pi's fridge gets the same thing inside /api/fridge/snapshot).
//
//   NASA_API_KEY        free key from api.nasa.gov (DEMO_KEY is used until one is set)
//   GEMINI_API_KEY      retells the history fact for kids (without it a strict word filter picks one)
//   WEATHER_LAT / LON   where the sunset is (default: Worcester, same as the weather card)
//   FRIDGE_EXTRAS_DISABLED=true   turn it all off
import { apodUrl, parseApod, onThisDayUrl, pickOnThisDay, ON_THIS_DAY_PROMPT, cleanKidFact, plainKidFact, sunUrl, parseSun } from '../shared/fridgeExtras.js';
import { dayKey, DEFAULT_TIME_ZONE } from '../shared/familyInsights.js';
import { getGeminiClient } from './geminiService.js';
import { weatherPlaceFromEnv } from './weatherService.js';

const FAIL_RETRY_MS = 30 * 60 * 1000;
const FACT_MODEL = 'gemini-3.1-flash-lite';

async function getJson(fetchImpl, url, timeoutMs = 10000) {
  const res = await fetchImpl(url, { headers: { Accept: 'application/json', 'User-Agent': 'little-heroes-family-fridge' }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${new URL(url).hostname} returned ${res.status}`);
  return res.json();
}

async function geminiKidFact(events) {
  const ai = getGeminiClient();
  if (!ai?.models?.generateContent || !events.length) return null;
  const list = events.map((e) => `${e.year}: ${e.text}`).join('\n');
  const response = await ai.models.generateContent({
    model: FACT_MODEL,
    contents: list,
    config: { systemInstruction: ON_THIS_DAY_PROMPT, maxOutputTokens: 80, temperature: 0.4 }
  });
  return cleanKidFact(response?.text);
}

export function createFridgeExtrasService({ env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now(), kidFact = geminiKidFact } = {}) {
  // One slot per extra: { day, value, failedAt }
  const slots = { space: {}, history: {}, sun: {} };

  async function daily(name, today, load) {
    const slot = slots[name];
    if (slot.day === today && slot.value) return slot.value;
    if (slot.day === today && slot.failedAt && now() - slot.failedAt < FAIL_RETRY_MS) return slot.stale || null;
    try {
      const value = await load();
      slots[name] = { day: today, value, stale: value || slot.stale || null };
      return value;
    } catch (err) {
      console.warn(`Fridge ${name} unavailable:`, err?.message || err);
      slots[name] = { day: today, value: null, failedAt: now(), stale: slot.value || slot.stale || null };
      return slots[name].stale;
    }
  }

  /** { space, history, sun } for today; any of them may be null. Never throws. */
  async function get() {
    if (env.FRIDGE_EXTRAS_DISABLED === 'true' || typeof fetchImpl !== 'function') return { space: null, history: null, sun: null };
    const timeZone = env.CALENDAR_TIME_ZONE || env.REPORT_TIME_ZONE || DEFAULT_TIME_ZONE;
    const today = dayKey(now(), timeZone);
    const [, mm, dd] = today.split('-');
    const [space, history, sun] = await Promise.all([
      daily('space', today, async () => parseApod(await getJson(fetchImpl, apodUrl(env.NASA_API_KEY || 'DEMO_KEY')))),
      daily('history', today, async () => {
        const events = pickOnThisDay(await getJson(fetchImpl, onThisDayUrl(mm, dd)));
        let fact = null;
        try { fact = cleanKidFact(await kidFact(events)); } catch { fact = null; }
        const pick = events[0];
        const text = fact || plainKidFact(pick);
        return text ? { text, source: 'Wikipedia', link: pick?.link || '' } : null;
      }),
      daily('sun', today, async () => {
        const { lat, lon } = weatherPlaceFromEnv(env);
        return parseSun(await getJson(fetchImpl, sunUrl(lat, lon, today, timeZone)));
      })
    ]);
    return { space, history, sun };
  }

  async function handleExtrasRequest(req, res) {
    res.setHeader('Cache-Control', 'public, max-age=900');
    return res.json(await get());
  }

  return { get, handleExtrasRequest };
}

export const fridgeExtrasService = createFridgeExtrasService();
