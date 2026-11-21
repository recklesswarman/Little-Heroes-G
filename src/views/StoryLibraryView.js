/**
 * Picture Book Library -- free, openly licensed StoryWeaver books for reading time.
 *
 * Books come from StoryWeaver (https://storyweaver.org.in), whose stories are released
 * under Creative Commons Attribution 4.0 (CC BY 4.0). That license requires credit, so
 * every card shows the title, authors, illustrators and publisher, links back to the
 * book on StoryWeaver, and links the license. The shelf starts from a bundled list
 * (src/data/storyweaverSeedBooks.js) so it works offline; "More books" pulls live
 * results through the /api/storyweaver/books proxy (server/storyweaverService.js).
 * Reading itself happens on storyweaver.org.in, which needs a connection.
 */
import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { escapeHtml } from '../utils/escapeHtml.js';
import { safeImageUrl } from '../utils/safeImageUrl.js';
import { STORYWEAVER_SEED_BOOKS } from '../data/storyweaverSeedBooks.js';
import { serverApiUrl } from '../services/serverApi.js';
import {
  STORYWEAVER_LICENSE,
  STORYWEAVER_ORIGIN,
  normalizeStoryWeaverBook,
  storyWeaverAttribution,
  storyWeaverBookUrl
} from '../../shared/storyweaver/normalize.js';

const LEVEL_LABELS = {
  1: 'Level 1 · Just starting',
  2: 'Level 2 · Learning words',
  3: 'Level 3 · Reading on my own'
};

const libraryState = {
  level: 'all',
  liveBooks: [],
  nextPage: 1,
  totalPages: null,
  loading: false,
  error: ''
};

function apiUrl(path) {
  // Same-origin on the Pi / App Hosting; App Hosting's API on static hosts.
  return serverApiUrl(path);
}

function visibleBooks() {
  const seen = new Set();
  const all = [...STORYWEAVER_SEED_BOOKS, ...libraryState.liveBooks]
    .map(normalizeStoryWeaverBook)
    .filter(Boolean)
    .filter(b => {
      if (seen.has(b.slug)) return false;
      seen.add(b.slug);
      return true;
    });
  if (libraryState.level === 'all') return all;
  return all.filter(b => String(b.level) === String(libraryState.level));
}

function renderBookCard(book) {
  const cover = safeImageUrl(book.cover);
  const href = escapeHtml(storyWeaverBookUrl(book.slug));
  const authors = book.authors.length ? escapeHtml(book.authors.join(', ')) : 'Unknown author';
  const illustrators = book.illustrators.length ? escapeHtml(book.illustrators.join(', ')) : '';
  return `
    <article class="bg-[#09141e] border-2 border-surface-container-highest rounded-3xl overflow-hidden flex flex-col" data-book-slug="${escapeHtml(book.slug)}">
      <a href="${href}" target="_blank" rel="noopener noreferrer" class="story-library-read-link block aspect-[4/3] bg-[#0f2334] overflow-hidden" data-slug="${escapeHtml(book.slug)}" aria-label="Read ${escapeHtml(book.title)} on StoryWeaver">
        ${cover
          ? `<img src="${escapeHtml(cover)}" alt="Cover of ${escapeHtml(book.title)}" loading="lazy" class="w-full h-full object-cover" />`
          : `<div class="w-full h-full flex items-center justify-center text-5xl">📖</div>`}
      </a>
      <div class="p-3 flex flex-col gap-1.5 flex-1">
        <div class="flex items-center gap-1.5 flex-wrap">
          ${book.level ? `<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#00d2d3]/15 text-[#00d2d3] border border-[#00d2d3]/30">Level ${book.level}</span>` : ''}
          ${book.hasAudio ? `<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#ffb961]/15 text-[#ffb961] border border-[#ffb961]/30">🔊 Read-along</span>` : ''}
        </div>
        <h3 class="font-headline font-black text-sm text-white leading-tight">${escapeHtml(book.title)}</h3>
        ${book.description ? `<p class="text-[11px] text-slate-400 leading-snug line-clamp-3">${escapeHtml(book.description)}</p>` : ''}
        <p class="text-[10px] text-slate-400 leading-snug mt-auto story-attribution" title="${escapeHtml(storyWeaverAttribution(book))}">
          Written by ${authors}${illustrators ? `, illustrated by ${illustrators}` : ''}.
          ${book.publisher ? `Published by ${escapeHtml(book.publisher)} on ` : 'From '}<a href="${href}" target="_blank" rel="noopener noreferrer" class="underline text-[#00d2d3]">StoryWeaver</a>.
          <a href="${STORYWEAVER_LICENSE.url}" target="_blank" rel="noopener noreferrer license" class="underline">${STORYWEAVER_LICENSE.name}</a>
        </p>
        <a href="${href}" target="_blank" rel="noopener noreferrer" class="story-library-read-link mt-1 w-full py-2 min-h-[40px] rounded-xl bg-linear-to-r from-[#00d2d3] to-primary-container text-surface-container-lowest font-headline font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all" data-slug="${escapeHtml(book.slug)}">
          <span class="material-symbols-outlined text-base">menu_book</span> Read this book
        </a>
      </div>
    </article>
  `;
}

export function renderStoryLibraryView() {
  const books = visibleBooks();
  const levelChip = (value, label) => `
    <button class="story-library-level-btn px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-black border transition-all ${
      String(libraryState.level) === String(value)
        ? 'bg-[#00d2d3] text-black border-[#00d2d3]'
        : 'bg-surface-container-lowest text-slate-300 border-surface-container-highest'
    }" data-level="${value}">${label}</button>`;
  const canLoadMore = !libraryState.totalPages || libraryState.nextPage <= libraryState.totalPages;
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

  return `
    <div class="min-h-screen bg-[#050f18] px-3 py-3 sm:px-6 sm:py-5 flex flex-col gap-4 pb-28">
      <header class="flex items-center gap-3">
        <button id="story-library-back-btn" class="w-10 h-10 rounded-2xl bg-[#0f2334] text-slate-300 flex items-center justify-center border border-surface-container-highest active:scale-95 transition-all shrink-0" title="Back">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <div class="min-w-0">
          <h2 class="font-headline font-black text-xl sm:text-2xl text-white">Picture Book Library</h2>
          <p class="text-xs text-slate-400">Free stories to read together, from StoryWeaver.</p>
        </div>
      </header>

      <div class="flex gap-2 flex-wrap">
        ${levelChip('all', 'All books')}
        ${[1, 2, 3].map(l => levelChip(l, LEVEL_LABELS[l])).join('')}
      </div>

      ${isOffline ? `<p class="text-xs text-[#ffb961] font-bold">You're offline. You can browse the shelf, but opening a book needs the internet.</p>` : ''}

      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        ${books.length ? books.map(renderBookCard).join('') : `<p class="col-span-full text-sm text-slate-400">No books at this level yet. Tap "More books" to look for some.</p>`}
      </div>

      <div class="flex flex-col items-center gap-2">
        ${canLoadMore ? `
          <button id="story-library-more-btn" class="px-5 py-2.5 min-h-[44px] rounded-2xl bg-[#0f2334] text-[#00d2d3] border border-[#00d2d3]/40 font-headline font-black text-sm active:scale-95 transition-all ${libraryState.loading ? 'opacity-60' : ''}" ${libraryState.loading ? 'disabled' : ''}>
            ${libraryState.loading ? 'Looking for books…' : 'More books'}
          </button>` : ''}
        ${libraryState.error ? `<p class="text-xs text-rose-300">${escapeHtml(libraryState.error)}</p>` : ''}
      </div>

      <footer class="text-[10px] text-slate-500 leading-relaxed border-t border-surface-container-highest pt-3">
        Stories, illustrations and covers come from <a href="${STORYWEAVER_ORIGIN}" target="_blank" rel="noopener noreferrer" class="underline">StoryWeaver</a>,
        a Pratham Books platform, and are shared under the
        <a href="${STORYWEAVER_LICENSE.url}" target="_blank" rel="noopener noreferrer license" class="underline">Creative Commons Attribution 4.0 license</a>.
        Each book's credits are shown on its card. Little Heroes doesn't change the stories.
      </footer>
    </div>
  `;
}

export async function loadMoreStoryWeaverBooks(fetchImpl = globalThis.fetch) {
  if (libraryState.loading) return;
  libraryState.loading = true;
  libraryState.error = '';
  store.notify();
  try {
    const level = libraryState.level === 'all' ? '' : `&level=${encodeURIComponent(libraryState.level)}`;
    const resp = await fetchImpl(apiUrl(`/api/storyweaver/books?page=${libraryState.nextPage}${level}`));
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.ok) throw new Error(json.error || 'StoryWeaver is unreachable right now.');
    libraryState.liveBooks.push(...(json.books || []));
    libraryState.totalPages = json.totalPages || libraryState.totalPages;
    libraryState.nextPage += 1;
  } catch (err) {
    libraryState.error = "Couldn't reach StoryWeaver just now. The books on the shelf still work.";
  } finally {
    libraryState.loading = false;
    store.notify();
  }
}

export function attachStoryLibraryListeners() {
  document.getElementById('story-library-back-btn')?.addEventListener('click', () => {
    Sound.bloop();
    store.navigate('bedtime_sanctuary');
  });
  document.querySelectorAll('.story-library-level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      Sound.bloop();
      const next = btn.getAttribute('data-level') || 'all';
      if (next !== String(libraryState.level)) {
        libraryState.level = next;
        libraryState.liveBooks = [];
        libraryState.nextPage = 1;
        libraryState.totalPages = null;
        libraryState.error = '';
      }
      store.notify();
    });
  });
  document.getElementById('story-library-more-btn')?.addEventListener('click', () => {
    Sound.bloop();
    loadMoreStoryWeaverBooks();
  });
}

export function __resetStoryLibraryStateForTests() {
  Object.assign(libraryState, { level: 'all', liveBooks: [], nextPage: 1, totalPages: null, loading: false, error: '' });
}
