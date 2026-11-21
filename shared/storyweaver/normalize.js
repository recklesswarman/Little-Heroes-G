// Shared helpers for StoryWeaver (https://storyweaver.org.in), used by the
// Express/Vite proxy (server/storyweaverService.js) and the browser view
// (src/views/StoryLibraryView.js). StoryWeaver releases its stories under
// Creative Commons Attribution 4.0 (CC BY 4.0), so every book we show keeps
// its title, authors, illustrators, publisher, a link back to the book and a
// link to the license.

export const STORYWEAVER_ORIGIN = 'https://storyweaver.org.in';
export const STORYWEAVER_LICENSE = {
  name: 'CC BY 4.0',
  url: 'https://creativecommons.org/licenses/by/4.0/'
};
export const STORYWEAVER_LEVELS = [1, 2, 3, 4];

const SLUG_RE = /^[0-9]+-[a-z0-9-]+$/i;
const COVER_HOST_RE = /^https:\/\/(?:storage\.googleapis\.com\/static\.storyweaver\.org\.in|static\.storyweaver\.org\.in)\//i;

function cleanText(value, max = 400) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function names(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map(p => cleanText(typeof p === 'string' ? p : p?.name, 80))
    .filter(Boolean)
    .slice(0, 6);
}

function pickCover(coverImage) {
  const sizes = Array.isArray(coverImage?.sizes) ? coverImage.sizes : [];
  // size4 (~550px wide) is plenty for a phone card and much lighter than size7.
  const preferred = sizes[3] || sizes[sizes.length - 1] || sizes[0];
  const url = String(preferred?.url || '');
  return COVER_HOST_RE.test(url) ? url : '';
}

/** Turn one raw books-search record into the small shape the app uses. Returns null if unusable. */
export function normalizeStoryWeaverBook(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const slug = cleanText(raw.slug, 160);
  if (!SLUG_RE.test(slug)) return null;
  const title = cleanText(raw.title || raw.name, 160);
  if (!title) return null;
  const level = Number.parseInt(raw.level, 10);
  return {
    id: Number(raw.id) || Number.parseInt(slug, 10),
    slug,
    title,
    level: Number.isFinite(level) ? level : null,
    language: cleanText(raw.language, 40) || 'English',
    description: cleanText(raw.description, 400),
    authors: names(raw.authors),
    illustrators: names(raw.illustrators),
    publisher: cleanText(raw.publisher?.name || raw.publisher, 120),
    cover: typeof raw.cover === 'string' ? (COVER_HOST_RE.test(raw.cover) ? raw.cover : '') : pickCover(raw.coverImage),
    hasAudio: Boolean(raw.isAudio ?? raw.hasAudio)
  };
}

export function storyWeaverBookUrl(slug) {
  return SLUG_RE.test(String(slug || '')) ? `${STORYWEAVER_ORIGIN}/en/stories/${slug}` : STORYWEAVER_ORIGIN;
}

/** Plain-text CC BY 4.0 attribution line for one book. */
export function storyWeaverAttribution(book) {
  const parts = [`"${book.title}"`];
  if (book.authors?.length) parts.push(`written by ${book.authors.join(', ')}`);
  if (book.illustrators?.length) parts.push(`illustrated by ${book.illustrators.join(', ')}`);
  let line = parts.join(', ');
  if (book.publisher) line += `, published by ${book.publisher}`;
  line += ` on StoryWeaver. Licensed under ${STORYWEAVER_LICENSE.name}.`;
  return line;
}

/** Build the StoryWeaver books-search URL for a level and page (the API ignores free-text queries). */
export function buildStoryWeaverSearchUrl({ level, page = 1, perPage = 12, language = 'English' } = {}) {
  const params = new URLSearchParams();
  params.set('page', String(Math.max(1, Math.min(50, Number(page) || 1))));
  params.set('per_page', String(Math.max(1, Math.min(24, Number(perPage) || 12))));
  params.append('search[languages][]', language);
  const lvl = Number(level);
  if (STORYWEAVER_LEVELS.includes(lvl)) params.append('search[levels][]', String(lvl));
  params.set('search[sort]', 'Ratings');
  return `${STORYWEAVER_ORIGIN}/api/v1/books-search?${params.toString()}`;
}
