// StoryWeaver picture-book search proxy.
// The browser can't always call storyweaver.org.in directly (CORS, offline
// static hosts), so the Express server and the Vite dev/preview server expose
// GET /api/storyweaver/books?level=1&page=1 and forward it to StoryWeaver's
// public books-search API. Results are trimmed to the fields the app shows
// (including the CC BY 4.0 attribution fields) and cached in memory.
import { buildStoryWeaverSearchUrl, normalizeStoryWeaverBook } from '../shared/storyweaver/normalize.js';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const cache = new Map();

export async function searchStoryWeaverBooks({ level, page = 1, perPage = 12 } = {}, fetchImpl = globalThis.fetch) {
  const url = buildStoryWeaverSearchUrl({ level, page, perPage });
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const resp = await fetchImpl(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'LittleHeroes-family-app/1.0' },
      signal: controller.signal
    });
    if (!resp.ok) throw new Error(`StoryWeaver responded ${resp.status}`);
    const json = await resp.json();
    const books = (Array.isArray(json?.data) ? json.data : [])
      .map(normalizeStoryWeaverBook)
      .filter(Boolean);
    const value = {
      books,
      page: Number(json?.metadata?.page) || Number(page) || 1,
      totalPages: Number(json?.metadata?.totalPages) || null
    };
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
    cache.set(url, { at: Date.now(), value });
    return value;
  } finally {
    clearTimeout(timer);
  }
}

/** Express-style handler (also used by the Vite middleware shim, which adds res.status/res.json). */
export async function handleStoryWeaverBooksRequest(req, res) {
  try {
    const query = req.query || Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
    const result = await searchStoryWeaverBooks({ level: query.level, page: query.page });
    res.setHeader?.('Cache-Control', 'public, max-age=3600');
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    return res.status(502).json({ ok: false, error: 'StoryWeaver is unreachable right now.', detail: String(err?.message || err) });
  }
}

export function __clearStoryWeaverCacheForTests() {
  cache.clear();
}
