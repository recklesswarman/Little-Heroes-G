// Fridge extras: NASA's space picture of the day, one kid-friendly "On this day" fact from
// Wikipedia, and today's sunset for the bedtime countdown and evening theme.
//
// All three are free: NASA APOD (api.nasa.gov, DEMO_KEY or a free NASA_API_KEY), Wikipedia's
// "On this day" feed (CC BY-SA, credited on the card) and sunrise-sunset.org (free, credited).
// The server fetches and caches them once a day (server/fridgeExtrasService.js). Pure, no I/O.

const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const httpsUrl = (u) => (typeof u === 'string' && /^https:\/\/[^\s"'<>\\]+$/i.test(u) && u.length < 1000 ? u : '');
const isDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

export function apodUrl(apiKey = 'DEMO_KEY', date = '') {
  const q = new URLSearchParams({ api_key: apiKey || 'DEMO_KEY', thumbs: 'true' });
  if (isDay(date)) q.set('date', date);
  return `https://api.nasa.gov/planetary/apod?${q}`;
}

/** First sentence (or two short ones) of a text, cut to `max` characters at a word. */
export function firstSentence(text, max = 160) {
  const t = clean(text, 2000);
  const m = t.match(/^(.{20,}?[.!?])(\s|$)/);
  let out = m ? m[1] : t;
  if (out.length > max) out = `${out.slice(0, max).replace(/\s+\S*$/, '')}…`;
  return out;
}

/** NASA APOD JSON -> { date, title, image, credit, fact } or null (videos without a thumbnail). */
export function parseApod(json) {
  if (!json || typeof json !== 'object') return null;
  const image = json.media_type === 'image' ? httpsUrl(json.url) : httpsUrl(json.thumbnail_url);
  if (!image) return null;
  return {
    date: isDay(json.date) ? json.date : '',
    title: clean(json.title, 80),
    image,
    credit: clean(json.copyright, 80) || 'NASA',
    fact: firstSentence(json.explanation, 180)
  };
}

export function onThisDayUrl(month, day) {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/${mm}/${dd}`;
}

// Words that keep an event off a kids' screen when there is no AI filter to rewrite it.
const GROWN_UP = /\b(war|wars|battle|kill|killed|killing|dies|died|death|dead|murder|assassinat\w*|attack\w*|bomb\w*|massacre|genocide|shoot\w*|shot|terror\w*|execut\w*|crash\w*|disaster|earthquake|flood|famine|riot\w*|invasion|invade\w*|army|military|troops|weapon\w*|nuclear|slave\w*|prison\w*|arrest\w*|coup|revolt|rebellion|surrender\w*|siege|sank|sink|plague|epidemic|pandemic|hijack\w*|explosion|fire|burn\w*|victims?|casualt\w*|genocid\w*|nazi\w*|holocaust|abuse|scandal|sex\w*|drug\w*|alcohol|religio\w*|election|elected|president|politic\w*|party|treaty|independence|colon\w*|empire)\b/i;
// Topics kids love; events that mention one come first.
const KID_FRIENDLY = /\b(first|invent\w*|discover\w*|launch\w*|space|moon|planet|astronaut\w*|rocket|satellite|zoo|animal\w*|dinosaur\w*|fossil\w*|museum|park|opened|book|story|cartoon|film|movie|music|song|toy|game|sport\w*|olympic\w*|record|bridge|tower|telescope|comet|star|computer|robot|science|scientist|patent\w*|flight|airplane|train|car|bicycle)\b/i;

/** Wikipedia "On this day" JSON -> the kid-friendliest few events, each { year, text, title, link }. */
export function pickOnThisDay(json, { max = 6 } = {}) {
  const list = Array.isArray(json?.selected) ? json.selected : Array.isArray(json?.events) ? json.events : [];
  return list
    .map((e) => ({
      year: Number.isInteger(e?.year) ? e.year : null,
      text: clean(e?.text, 240),
      title: clean(e?.pages?.[0]?.titles?.normalized || e?.pages?.[0]?.title, 80).replace(/_/g, ' '),
      link: httpsUrl(e?.pages?.[0]?.content_urls?.desktop?.page)
    }))
    .filter((e) => e.year && e.text && !GROWN_UP.test(e.text))
    .sort((a, b) => Number(KID_FRIENDLY.test(b.text)) - Number(KID_FRIENDLY.test(a.text)))
    .slice(0, max);
}

/** Prompt for Gemini to retell one event for a 4- and a 7-year-old (or say SKIP). */
export const ON_THIS_DAY_PROMPT = [
  'You write one fun fact for a family fridge screen read by a 4-year-old and a 7-year-old.',
  'You get a few things that happened on today\'s date in history. Pick the one a young child would enjoy most',
  '(inventions, space, animals, firsts, sports, books, music). Never pick anything about war, violence, death,',
  'disasters, crime, politics or religion. Retell it in ONE short sentence of at most 22 simple words,',
  'starting with "On this day in <year>," and ending with "!". If none are suitable, answer exactly SKIP.'
].join(' ');

/** Checks the model's answer: one short sentence that starts right, or null. */
export function cleanKidFact(text) {
  const t = clean(String(text || '').replace(/[*_#`]/g, ''), 220);
  if (!t || /^skip\b/i.test(t)) return null;
  if (!/^On this day in \d{3,4},/i.test(t)) return null;
  if (t.split(/\s+/).length > 30 || GROWN_UP.test(t)) return null;
  return t;
}

/** A plain retelling when there is no AI: "On this day in 1969, Apollo 11 ...". */
export function plainKidFact(event) {
  if (!event) return null;
  const s = firstSentence(event.text, 150).replace(/[.…]$/, '');
  return `On this day in ${event.year}, ${s}!`;
}

export function sunUrl(lat, lon, date, timeZone = 'America/New_York') {
  const q = new URLSearchParams({ lat: String(lat), lng: String(lon), formatted: '0', date: isDay(date) ? date : 'today', tzid: timeZone });
  return `https://api.sunrise-sunset.org/json?${q}`;
}

/** sunrise-sunset.org JSON -> { sunrise, sunset } as ISO strings, or null. */
export function parseSun(json) {
  const r = json?.results;
  if (json?.status !== 'OK' || !r) return null;
  const ok = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
  return ok(r.sunrise) && ok(r.sunset) ? { sunrise: new Date(r.sunrise).toISOString(), sunset: new Date(r.sunset).toISOString() } : null;
}

/**
 * Evening state for the fridge at `now`:
 *  { evening: after sunset (or 6 PM without a sunset), bedtimeIn: minutes until bedtime when it
 *    is within 2 hours, night: at or after bedtime (until 6 AM) }
 */
export function eveningState(now = new Date(), { bedtimeHour = 20, sunset = '' } = {}) {
  const hour = Number.isInteger(bedtimeHour) && bedtimeHour >= 17 && bedtimeHour <= 23 ? bedtimeHour : 20;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const bed = hour * 60;
  const night = minutes >= bed || minutes < 6 * 60;
  const sunsetAt = sunset && !Number.isNaN(Date.parse(sunset)) ? new Date(sunset) : null;
  const sunsetMinutes = sunsetAt ? sunsetAt.getHours() * 60 + sunsetAt.getMinutes() : 18 * 60;
  const evening = !night && minutes >= Math.min(sunsetMinutes, bed);
  const left = bed - minutes;
  return { night, evening, bedtimeIn: !night && left > 0 && left <= 120 ? left : null, bedtimeHour: hour };
}

/** "1 hour 20 minutes" / "45 minutes" */
export function formatCountdown(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const part = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  return [h ? part(h, 'hour') : '', m || !h ? part(m, 'minute') : ''].filter(Boolean).join(' ');
}
