// Weather for the Fridge Display's "what to wear" card and weather "get ready" chores.
//
// Open-Meteo (https://open-meteo.com) needs no key and is free for non-commercial use. The
// Pi fetches it hourly (server/weatherService.js) and hands it out with the calendar plan,
// so every device shows the same forecast. Pure, no I/O.

// Canterbury Street Magnet School, Worcester MA. WEATHER_LAT / WEATHER_LON override it.
export const DEFAULT_WEATHER_PLACE = { lat: 42.2459, lon: -71.8059, name: 'Worcester' };

export function openMeteoUrl({ lat = DEFAULT_WEATHER_PLACE.lat, lon = DEFAULT_WEATHER_PLACE.lon, timeZone = 'America/New_York', days = 3 } = {}) {
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,snowfall_sum,uv_index_max,wind_speed_10m_max',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone: timeZone,
    forecast_days: String(Math.max(1, Math.min(7, days)))
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

/** WMO weather code -> a kid-friendly word and emoji. */
export function describeWeatherCode(code) {
  const c = Number(code);
  if (c === 0) return { label: 'Sunny', emoji: '☀️' };
  if (c === 1 || c === 2) return { label: 'Partly cloudy', emoji: '⛅' };
  if (c === 3) return { label: 'Cloudy', emoji: '☁️' };
  if (c === 45 || c === 48) return { label: 'Foggy', emoji: '🌫️' };
  if (c >= 51 && c <= 57) return { label: 'Drizzle', emoji: '🌦️' };
  if (c >= 61 && c <= 67) return { label: 'Rain', emoji: '🌧️' };
  if (c >= 71 && c <= 77) return { label: 'Snow', emoji: '❄️' };
  if (c >= 80 && c <= 82) return { label: 'Showers', emoji: '🌦️' };
  if (c === 85 || c === 86) return { label: 'Snow showers', emoji: '🌨️' };
  if (c >= 95) return { label: 'Thunderstorms', emoji: '⛈️' };
  return { label: 'Weather', emoji: '🌤️' };
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const isRainCode = (c) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95;
const isSnowCode = (c) => (c >= 71 && c <= 77) || c === 85 || c === 86;

/** Open-Meteo's JSON -> { current, days: [{ date, code, label, emoji, high, low, rainChance, snow, uv, wind }] }. */
export function parseOpenMeteo(json) {
  const d = json?.daily || {};
  const dates = Array.isArray(d.time) ? d.time : [];
  const days = dates.slice(0, 7).map((date, i) => {
    const code = num(d.weather_code?.[i]) ?? -1;
    return {
      date: String(date).slice(0, 10),
      code,
      ...describeWeatherCode(code),
      high: num(d.temperature_2m_max?.[i]) === null ? null : Math.round(d.temperature_2m_max[i]),
      low: num(d.temperature_2m_min?.[i]) === null ? null : Math.round(d.temperature_2m_min[i]),
      rainChance: num(d.precipitation_probability_max?.[i]) ?? 0,
      snow: num(d.snowfall_sum?.[i]) ?? 0,
      uv: num(d.uv_index_max?.[i]) ?? 0,
      wind: num(d.wind_speed_10m_max?.[i]) ?? 0
    };
  }).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date));
  const cur = json?.current;
  const current = cur && num(cur.temperature_2m) !== null
    ? { temp: Math.round(cur.temperature_2m), code: num(cur.weather_code) ?? -1, ...describeWeatherCode(cur.weather_code) }
    : null;
  return { current, days };
}

/** What to wear for one forecast day, warmest layer first. Each tip: { id, emoji, text }. */
export function whatToWear(day) {
  if (!day) return [];
  const tips = [];
  const low = day.low ?? day.high;
  const high = day.high ?? day.low;
  if (low !== null && low !== undefined) {
    if (low < 32) tips.push({ id: 'winter', emoji: '🧤', text: 'Winter coat, hat and mittens' });
    else if (low < 45) tips.push({ id: 'coat', emoji: '🧥', text: 'Warm coat' });
    else if (low < 60) tips.push({ id: 'jacket', emoji: '🧥', text: 'Jacket or sweatshirt' });
  }
  if (high !== null && high !== undefined && high >= 80) tips.push({ id: 'shorts', emoji: '🩳', text: 'Shorts and a T-shirt' });
  if (day.snow > 0.2 || isSnowCode(day.code)) tips.push({ id: 'snow', emoji: '🥾', text: 'Snow boots and snow pants' });
  else if (day.rainChance >= 50 || isRainCode(day.code)) tips.push({ id: 'rain', emoji: '☔', text: 'Raincoat and rain boots' });
  if (day.uv >= 6) tips.push({ id: 'sun', emoji: '🧴', text: 'Sunscreen and a sun hat' });
  if (!tips.length) tips.push({ id: 'comfy', emoji: '👕', text: 'Comfy clothes, nice day!' });
  return tips;
}

/** The trimmed forecast the fridge shows (today, tomorrow). */
export function fridgeWeather(weather, today) {
  if (!weather || !Array.isArray(weather.days)) return null;
  const days = weather.days.filter((d) => d.date >= today).slice(0, 2).map((d) => ({
    date: d.date,
    label: String(d.label || '').slice(0, 20),
    emoji: String(d.emoji || '🌤️').slice(0, 4),
    high: d.high,
    low: d.low,
    rainChance: d.rainChance,
    wear: whatToWear(d).slice(0, 3)
  }));
  if (!days.length) return null;
  const c = weather.current;
  return { current: c ? { temp: c.temp, label: String(c.label || '').slice(0, 20), emoji: String(c.emoji || '🌤️').slice(0, 4) } : null, days };
}

const WEATHER_PREP = {
  snow: { key: 'snow', title: 'Put your snow boots by the door', emoji: '🥾', icon: 'ac_unit', why: (d) => `Snow tomorrow` },
  rain: { key: 'umbrella', title: 'Pack your umbrella and raincoat', emoji: '☔', icon: 'umbrella', why: (d) => `Rain tomorrow (${d.rainChance}%)` },
  winter: { key: 'mittens', title: 'Lay out your hat and mittens', emoji: '🧤', icon: 'checkroom', why: (d) => `Cold tomorrow (low ${d.low}°)` }
};

/**
 * Weather "get ready" chores for tonight, in the calendar plan's prepTasks shape
 * (store.applyCalendarPlan). `schoolKidsFor(day)` returns the kids with school that day;
 * a chore is only added for them (no umbrella reminders on a Saturday).
 */
export function weatherPrepTasks(weather, today, heroes = [], { schoolKidsFor = () => heroes } = {}) {
  if (!weather || !Array.isArray(weather.days) || !/^\d{4}-\d{2}-\d{2}$/.test(today || '')) return [];
  const tomorrow = weather.days.find((d) => d.date > today);
  if (!tomorrow) return [];
  const kids = (schoolKidsFor(tomorrow.date) || []).filter((h) => h && h.id);
  if (!kids.length) return [];
  const tips = whatToWear(tomorrow).map((t) => t.id);
  const rule = tips.includes('snow') ? WEATHER_PREP.snow : tips.includes('rain') ? WEATHER_PREP.rain : tips.includes('winter') ? WEATHER_PREP.winter : null;
  if (!rule) return [];
  return [{
    id: `cal_wx_${tomorrow.date}_${rule.key}`,
    title: rule.title,
    emoji: rule.emoji,
    icon: rule.icon,
    showOn: today,
    eventDay: tomorrow.date,
    eventTitle: rule.why(tomorrow),
    eventTime: '',
    heroIds: kids.map((h) => String(h.id)),
    weather: true
  }];
}
