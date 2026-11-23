/**
 * Story character sheets (shared/storyEngine/characterSheet.js): one picture per kid of their hero
 * and companion, drawn once on the free image Worker and kept on this device. Every story picture
 * sends it as a reference, so the kid's hero looks the same in every story.
 *
 * Stored per hero in localStorage as a small (480 px) JPEG, about 40-60 KB. It is drawn again when
 * the kid's avatar or companion changes, or when a parent taps "Draw it again" on the Profile.
 */
import {
  characterSheetSignature,
  characterSheetPrompt,
  characterSheetShortPrompt,
  characterSheetSeed,
  heroHairFor,
  petSkinFor
} from '../../shared/storyEngine/characterSheet.js';
import { bedtimeIllustrationService, prepareReferenceImage, isReferenceCandidate, IMAGE_MODEL } from './bedtimeIllustrationService.js';

const KEY_PREFIX = 'lh_story_sheet_';
const inFlight = new Map();

function storage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

function readSaved(heroId) {
  try {
    const raw = storage()?.getItem(KEY_PREFIX + heroId);
    const saved = raw ? JSON.parse(raw) : null;
    return saved && typeof saved === 'object' && isReferenceCandidate(saved.image) ? saved : null;
  } catch {
    return null;
  }
}

function save(heroId, value) {
  try { storage()?.setItem(KEY_PREFIX + heroId, JSON.stringify(value)); } catch { /* storage full or blocked: the sheet is redrawn next time */ }
}

/** The look inputs for a kid: { heroId, heroLook, petId, petSpecies }. */
export function sheetLook({ heroId = '', heroLook = '', petId = '', petSpecies = '' } = {}) {
  return { heroId: String(heroId || ''), heroLook: String(heroLook || ''), petId: String(petId || ''), petSpecies: String(petSpecies || '') };
}

/** Hair and pet colour the story prompts should use for this kid (fixed, matches the sheet). */
export function sheetPromptFields(look) {
  const l = sheetLook(look);
  return { heroHair: heroHairFor(l.heroId), petSkin: petSkinFor(l.heroId, l.petId) };
}

/** The saved sheet picture for this kid and look, or '' (none yet, or the look changed). */
export function getCharacterSheet(look) {
  const l = sheetLook(look);
  if (!l.heroId) return '';
  const saved = readSaved(l.heroId);
  return saved && saved.signature === characterSheetSignature(l) ? saved.image : '';
}

/** Any saved sheet for this kid (even for an older look), with when it was drawn. */
export function getSavedSheetInfo(heroId) {
  const saved = heroId ? readSaved(String(heroId)) : null;
  return saved ? { image: saved.image, createdAt: saved.createdAt || 0 } : null;
}

async function drawSheet(look, attempt, fetchImpl) {
  const apiUrl = bedtimeIllustrationService.apiUrl;
  if (!apiUrl || typeof fetchImpl !== 'function') return '';
  const res = await fetchImpl(apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: characterSheetPrompt(look),
      shortPrompt: characterSheetShortPrompt(look),
      model: IMAGE_MODEL,
      seed: characterSheetSeed(characterSheetSignature(look), attempt),
      negative_prompt: 'pink, purple, magenta, scary, dark, deformed, blurry, text, letters, extra limbs',
      format: 'base64'
    }),
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) return '';
  const type = res.headers?.get?.('content-type') || '';
  if (!type.includes('application/json')) return '';
  const data = await res.json();
  return data?.dataUri || data?.imageUrl || '';
}

/**
 * The sheet for this kid, drawing it when there is none for the current look (or `redraw` is set).
 * Resolves to a small JPEG data URI, or '' if the Worker could not draw it. Never throws.
 */
export function ensureCharacterSheet(look, { redraw = false, fetchImpl = globalThis.fetch, shrink = prepareReferenceImage, now = Date.now } = {}) {
  const l = sheetLook(look);
  if (!l.heroId) return Promise.resolve('');
  // Shrinking needs a browser canvas; without one (tests, the Pi scripts) there is nothing to draw.
  if (shrink === prepareReferenceImage && (typeof Image === 'undefined' || typeof document === 'undefined')) return Promise.resolve('');
  if (!redraw) {
    const existing = getCharacterSheet(l);
    if (existing) return Promise.resolve(existing);
  }
  const signature = characterSheetSignature(l);
  const key = `${signature}|${redraw ? 'redraw' : ''}`;
  if (inFlight.has(key)) return inFlight.get(key);
  const job = (async () => {
    try {
      const previous = readSaved(l.heroId);
      const attempt = redraw ? (Number(previous?.attempt) || 0) + 1 : 0;
      const full = await drawSheet(l, attempt, fetchImpl);
      const small = full ? await shrink(full) : '';
      if (!isReferenceCandidate(small)) return '';
      save(l.heroId, { signature, image: small, attempt, createdAt: now() });
      return small;
    } catch (err) {
      console.warn('Character sheet not drawn:', err?.message || err);
      return '';
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, job);
  return job;
}

/** Waits up to `ms` for a sheet that is being drawn; '' if it is not ready by then. */
export async function waitForCharacterSheet(look, ms = 20000) {
  const job = ensureCharacterSheet(look);
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(''), ms); });
  try {
    return await Promise.race([job, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
