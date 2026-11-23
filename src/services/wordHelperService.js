// "Tap a word" in stories: Rex says the word and a small card shows a short meaning.
//
// wrapTappableWords() turns story text into safe HTML where every word is a tappable span.
// attachWordHelper() listens for taps on those spans. Meanings come from /api/dictionary/define
// on the app server (App Hosting for the static sites). If the lookup fails, the word is still
// spoken, so nothing breaks offline.
import { escapeHtml } from '../utils/escapeHtml.js';
import { serverApiUrl } from './serverApi.js';
import { speakCompanion, isRexSpeaking } from './voiceService.js';

const WORD_PATTERN = /([A-Za-z][A-Za-z'’]*)/;
const POPOVER_ID = 'lh-word-popover';
const TAP_CLASS = 'lh-tap-word';

/** Plain text in, escaped HTML out, with each word wrapped in a tappable span. */
export function wrapTappableWords(text) {
  return String(text ?? '')
    .split(WORD_PATTERN)
    .map((part, i) => {
      if (i % 2 === 0) return escapeHtml(part);
      const clean = part.replace(/’/g, "'");
      return `<span class="${TAP_CLASS}" data-word="${escapeHtml(clean)}" role="button" tabindex="0">${escapeHtml(part)}</span>`;
    })
    .join('');
}

const cache = new Map();

/** Fetches a short meaning. Resolves to { word, phonetic, meanings } or null. */
export async function lookupWord(word, fetchImpl = globalThis.fetch) {
  const key = String(word || '').toLowerCase();
  if (!key || typeof fetchImpl !== 'function') return null;
  if (cache.has(key)) return cache.get(key);
  try {
    const res = await fetchImpl(serverApiUrl(`/api/dictionary/define?word=${encodeURIComponent(key)}`));
    const type = res.headers?.get?.('content-type') || '';
    if (!res.ok || !type.includes('json')) return null;
    const data = await res.json();
    const value = data?.ok ? { word: data.word, phonetic: data.phonetic || '', meanings: data.meanings || [], source: data.source || '' } : null;
    if (value) cache.set(key, value);
    return value;
  } catch {
    return null;
  }
}

const phonicsCache = new Map();

/** "Sound it out" parts from /api/phonics/word. Resolves to { syllables, sounds, parts } or null. */
export async function lookupPhonics(word, fetchImpl = globalThis.fetch) {
  const key = String(word || '').toLowerCase();
  if (!key || typeof fetchImpl !== 'function') return null;
  if (phonicsCache.has(key)) return phonicsCache.get(key);
  try {
    const res = await fetchImpl(serverApiUrl(`/api/phonics/word?word=${encodeURIComponent(key)}`));
    const type = res.headers?.get?.('content-type') || '';
    if (!res.ok || !type.includes('json')) return null;
    const data = await res.json();
    const value = data?.ok ? { syllables: Number(data.syllables) || 0, sounds: Array.isArray(data.sounds) ? data.sounds.slice(0, 20) : [], parts: Array.isArray(data.parts) ? data.parts.slice(0, 20) : [] } : null;
    if (value) phonicsCache.set(key, value);
    return value;
  } catch {
    return null;
  }
}

/** Sound-it-out chips: letters on top, the sound under each. textContent only. */
function phonicsRow(phonics) {
  if (!phonics || (!phonics.parts.length && !phonics.sounds.length)) return null;
  const row = el('div', 'mt-2 flex flex-wrap items-end gap-1.5 kid-read');
  row.setAttribute('data-word-phonics', '');
  const chips = phonics.parts.length ? phonics.parts : phonics.sounds.map((s) => ({ letters: '', sound: s }));
  chips.forEach((p) => {
    const chip = el('div', 'flex flex-col items-center rounded-lg bg-slate-800 border border-slate-600 px-2 py-1');
    if (p.letters) chip.appendChild(el('span', 'text-lg font-black text-white leading-none', String(p.letters)));
    chip.appendChild(el('span', 'text-[11px] font-bold text-[#00d2d3]', `/${String(p.sound)}/`));
    row.appendChild(chip);
  });
  if (phonics.syllables > 1) row.appendChild(el('span', 'ml-1 text-xs font-bold text-slate-400', `${phonics.syllables} claps`));
  return row;
}

function closePopover() {
  document.getElementById(POPOVER_ID)?.remove();
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // textContent only: dictionary text is never parsed as HTML
  return node;
}

function iconButton(attr, label, icon, className) {
  const button = el('button', `min-h-[40px] min-w-[40px] rounded-xl font-black flex items-center justify-center ${className}`);
  button.type = 'button';
  button.setAttribute(attr, '');
  button.setAttribute('aria-label', label);
  button.appendChild(el('span', 'material-symbols-outlined', icon));
  return button;
}

/** Fills the card: info = null while loading, or { phonetic, meanings }. */
function fillPopover(card, word, info, loading, phonics = null) {
  card.replaceChildren();
  const head = el('div', 'flex items-start justify-between gap-3');
  const title = el('div');
  title.appendChild(el('div', 'font-headline text-xl font-black text-white', word));
  if (info?.phonetic) title.appendChild(el('div', 'text-xs text-slate-400', info.phonetic));
  const buttons = el('div', 'flex gap-1');
  buttons.appendChild(iconButton('data-word-say', 'Hear the word', 'volume_up', 'bg-[#00d2d3] text-slate-900'));
  buttons.appendChild(iconButton('data-word-close', 'Close', 'close', 'bg-slate-700 text-white'));
  head.append(title, buttons);
  card.appendChild(head);
  const sounds = phonicsRow(phonics);
  if (sounds) card.appendChild(sounds);

  const meanings = info?.meanings || [];
  if (meanings.length > 0) {
    const list = el('ul', 'mt-2 text-sm text-slate-100 list-none p-0');
    meanings.forEach((m) => {
      const item = el('li', 'mt-1');
      if (m.partOfSpeech) item.appendChild(el('span', 'italic text-slate-400 mr-1', m.partOfSpeech));
      item.appendChild(document.createTextNode(m.definition));
      list.appendChild(item);
    });
    card.appendChild(list);
    if (info?.source) card.appendChild(el('p', 'mt-2 text-[10px] text-slate-500', `Meanings from ${info.source} (CC BY-SA)`));
  } else {
    card.appendChild(el('p', 'mt-2 text-sm text-slate-300', loading ? 'Looking it up...' : 'Tap the speaker to hear it again.'));
  }
}

/** Says a word (always works offline through the browser voice if needed). */
export function sayWord(word) {
  return speakCompanion(String(word || '').replace(/[^\w']/g, ''), { petId: 'rex' });
}

export async function showWordCard(word) {
  if (typeof document === 'undefined') return;
  closePopover();
  const card = el('div', 'fixed left-1/2 -translate-x-1/2 bottom-24 z-[90] w-[min(92vw,26rem)] rounded-2xl border-2 border-[#00d2d3]/60 bg-[#0b1d2c] p-4 shadow-2xl');
  card.id = POPOVER_ID;
  card.setAttribute('role', 'dialog');
  fillPopover(card, word, null, true);
  document.body.appendChild(card);
  card.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('[data-word-close]')) closePopover();
    else if (target?.closest('[data-word-say]')) sayWord(word);
  });
  const [info, phonics] = await Promise.all([lookupWord(word), lookupPhonics(word)]);
  if (document.getElementById(POPOVER_ID) === card) fillPopover(card, word, info, false, phonics);
}

/**
 * Makes every .lh-tap-word inside `root` respond to taps.
 * While Rex is narrating the story the tap only shows the meaning (so the narration isn't cut off);
 * the speaker button in the card says the word on request.
 */
export function attachWordHelper(root) {
  if (!root || root.__lhWordHelper) return;
  root.__lhWordHelper = true;
  const handle = (e) => {
    const el = e.target instanceof Element ? e.target.closest(`.${TAP_CLASS}`) : null;
    if (!el) return;
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    const word = el.getAttribute('data-word') || '';
    if (!word) return;
    if (!isRexSpeaking()) sayWord(word);
    showWordCard(word);
  };
  root.addEventListener('click', handle);
  root.addEventListener('keydown', handle);
}
