// Per-child story memory: the plot ledger (what stories this child has had) and the friends they
// have met (recurring characters). Pure functions over plain objects, so the client store, the
// cloud-merge code and the tests all use the same logic. Nothing here touches the DOM or storage.
//
// Shape: { ledger: [fingerprint...], recurringCharacters: [{name, role, trait, count, lastSeen}] }
// - ledger entries come from ledger.js fingerprintFromBible(); newest first; at most LEDGER_MAX.
// - every function returns a NEW object and never mutates its input.
// - merging is a union by id / name, so two devices can never overwrite each other's stories.

import { fingerprintFromBible, FP_FIELDS, LEDGER_MAX, cleanProblemType, cleanTwistType } from './ledger.js';

export const RECURRING_MAX = 12;
/** How much memory a request carries to the server. */
export const DIGEST_SEND = 30;
export const FRIENDS_SEND = 3;

const trim = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max).trim();

export function emptyStoryMemory() {
  return { ledger: [], recurringCharacters: [] };
}

function cleanEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = trim(raw.id, 60);
  if (!id) return null;
  const fp = {};
  for (const field of FP_FIELDS) fp[field] = trim(raw.fp?.[field], 40);
  return {
    id,
    t: Number(raw.t) || 0,
    title: trim(raw.title, 60),
    archetypeId: trim(raw.archetypeId, 60),
    pt: cleanProblemType(raw.pt),
    tt: cleanTwistType(raw.tt),
    moralId: trim(raw.moralId, 40),
    realmId: trim(raw.realmId, 40),
    fp,
    characters: (Array.isArray(raw.characters) ? raw.characters : []).map(n => trim(n, 24)).filter(Boolean).slice(0, 5)
  };
}

function cleanFriend(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = trim(raw.name, 24);
  if (!name) return null;
  return {
    name,
    role: trim(raw.role, 24),
    trait: trim(raw.trait, 24),
    count: Math.max(1, Math.floor(Number(raw.count)) || 1),
    lastSeen: Number(raw.lastSeen) || 0
  };
}

/** Coerce anything (old saves, cloud data, undefined) into a valid, bounded memory. */
export function normalizeStoryMemory(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};

  const byId = new Map();
  for (const e of Array.isArray(src.ledger) ? src.ledger : []) {
    const entry = cleanEntry(e);
    if (!entry) continue;
    const have = byId.get(entry.id);
    if (!have || entry.t >= have.t) byId.set(entry.id, entry);
  }
  const ledger = [...byId.values()].sort((a, b) => b.t - a.t).slice(0, LEDGER_MAX);

  const byName = new Map();
  for (const f of Array.isArray(src.recurringCharacters) ? src.recurringCharacters : []) {
    const friend = cleanFriend(f);
    if (!friend) continue;
    const key = friend.name.toLowerCase();
    const have = byName.get(key);
    if (!have) { byName.set(key, friend); continue; }
    const newer = friend.lastSeen >= have.lastSeen ? friend : have;
    byName.set(key, { ...newer, count: Math.max(friend.count, have.count), lastSeen: Math.max(friend.lastSeen, have.lastSeen) });
  }
  const recurringCharacters = [...byName.values()]
    .sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen)
    .slice(0, RECURRING_MAX);

  return { ledger, recurringCharacters };
}

/** Union of two memories (two devices, or a stale copy and a fresh one). Idempotent and order-independent. */
export function mergeStoryMemory(a, b) {
  const x = a && typeof a === 'object' ? a : {};
  const y = b && typeof b === 'object' ? b : {};
  return normalizeStoryMemory({
    ledger: [...(Array.isArray(x.ledger) ? x.ledger : []), ...(Array.isArray(y.ledger) ? y.ledger : [])],
    recurringCharacters: [
      ...(Array.isArray(x.recurringCharacters) ? x.recurringCharacters : []),
      ...(Array.isArray(y.recurringCharacters) ? y.recurringCharacters : [])
    ]
  });
}

function isPet(character, petName) {
  if (character?.role === 'companion') return true;
  const name = trim(character?.name, 40).toLowerCase();
  const pet = trim(petName, 60).toLowerCase();
  return !!name && !!pet && (pet === name || pet.startsWith(`${name} `));
}

/**
 * Record a finished story. `session` is the saved story session ({id, title, moralId, realmId,
 * petName, storyBible}). Idempotent by session id: committing the same story twice (the app does)
 * refreshes the entry but does not count its friends twice.
 */
export function commitStory(memory, session, { now = Date.now() } = {}) {
  const base = normalizeStoryMemory(memory);
  if (!session || typeof session !== 'object') return base;

  const id = trim(session.id, 60) || `story_${now}`;
  const existing = base.ledger.find(e => e.id === id);
  const bible = session.storyBible && typeof session.storyBible === 'object' ? session.storyBible : null;

  let entry;
  if (bible?.plotDNA) {
    entry = fingerprintFromBible(bible, {
      id, t: existing ? existing.t : now, title: session.title || bible.title,
      moralId: session.moralId, realmId: session.realmId
    });
  } else {
    // No story plan (offline tiers): keep the title so it is still avoided by name.
    entry = cleanEntry({ id, t: existing ? existing.t : now, title: session.title || 'Bedtime Story', moralId: session.moralId, realmId: session.realmId });
  }

  let friends = base.recurringCharacters;
  if (!existing && bible && Array.isArray(bible.characters)) {
    const met = bible.characters
      .filter((c, i) => i > 0 && c?.role !== 'hero' && !isPet(c, session.petName))
      .map(c => cleanFriend({
        name: c.name, role: c.role, trait: Array.isArray(c.traits) ? c.traits[0] : '', count: 1, lastSeen: now
      }))
      .filter(Boolean);
    friends = [...friends];
    for (const f of met) {
      const i = friends.findIndex(x => x.name.toLowerCase() === f.name.toLowerCase());
      if (i === -1) friends.push(f);
      else friends[i] = { ...friends[i], role: f.role || friends[i].role, trait: f.trait || friends[i].trait, count: friends[i].count + 1, lastSeen: now };
    }
  }

  return normalizeStoryMemory({ ledger: [entry, ...base.ledger.filter(e => e.id !== id)], recurringCharacters: friends });
}

/** What a chapter-1 request sends: the newest fingerprints and the child's most familiar friends. */
export function memoryForRequest(memory) {
  const m = normalizeStoryMemory(memory);
  return {
    ledgerDigest: m.ledger.slice(0, DIGEST_SEND),
    recurringCharacters: m.recurringCharacters.slice(0, FRIENDS_SEND).map(({ name, role, trait }) => ({ name, role, trait }))
  };
}
