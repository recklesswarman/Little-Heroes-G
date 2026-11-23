// Open-Meteo forecast for the Fridge Display and weather "get ready" chores (shared/weather.js).
// No key needed. Cached for an hour; on a failed fetch the last good forecast is kept for
// up to 6 hours so the fridge doesn't go blank on a network blip.
//
//   WEATHER_LAT / WEATHER_LON   where to forecast (default: Canterbury Street Magnet, Worcester)
//   WEATHER_DISABLED=true       turn it off
import { openMeteoUrl, parseOpenMeteo, DEFAULT_WEATHER_PLACE } from '../shared/weather.js';

const TTL_MS = 60 * 60 * 1000;
const STALE_MS = 6 * TTL_MS;
const FAIL_RETRY_MS = 5 * 60 * 1000;

export function weatherPlaceFromEnv(env = process.env) {
  const lat = Number(env.WEATHER_LAT);
  const lon = Number(env.WEATHER_LON);
  const ok = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && String(env.WEATHER_LAT || '').trim() !== '';
  return ok ? { lat, lon } : { lat: DEFAULT_WEATHER_PLACE.lat, lon: DEFAULT_WEATHER_PLACE.lon };
}

export function createWeatherService({ env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  let cache = { at: 0, body: null, failedAt: 0 };

  /** The parsed forecast, or null when it is off or unavailable. Never throws. */
  async function get() {
    if (env.WEATHER_DISABLED === 'true' || typeof fetchImpl !== 'function') return null;
    if (cache.body && now() - cache.at < TTL_MS) return cache.body;
    if (cache.failedAt && now() - cache.failedAt < FAIL_RETRY_MS) return cache.body && now() - cache.at < STALE_MS ? cache.body : null;
    try {
      const timeZone = env.CALENDAR_TIME_ZONE || env.REPORT_TIME_ZONE || 'America/New_York';
      const res = await fetchImpl(openMeteoUrl({ ...weatherPlaceFromEnv(env), timeZone }), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
      const body = { ...parseOpenMeteo(await res.json()), fetchedAt: new Date(now()).toISOString() };
      if (!body.days.length) throw new Error('Open-Meteo sent no days');
      cache = { at: now(), body, failedAt: 0 };
      return body;
    } catch (err) {
      console.warn('Weather unavailable:', err?.message || err);
      cache.failedAt = now();
      return cache.body && now() - cache.at < STALE_MS ? cache.body : null;
    }
  }

  return { get };
}

export const weatherService = createWeatherService();
