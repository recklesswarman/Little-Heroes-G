import assert from 'node:assert';
import {
  emptyStoryMemory, normalizeStoryMemory, mergeStoryMemory, commitStory, memoryForRequest,
  RECURRING_MAX, DIGEST_SEND, FRIENDS_SEND
} from '../shared/storyEngine/memory.js';
import { LEDGER_MAX, cleanLedgerDigest, cleanRecurring } from '../shared/storyEngine/ledger.js';
import { buildRequest, planBible } from '../shared/storyEngine/engine.js';
import { getBedtimeRealm, BEDTIME_MORALS } from '../src/data/bedtimeStoryData.js';

let failed = 0;
async function check(desc, fn) {
  try { await fn(); console.log(`  ok - ${desc}`); }
  catch (e) { failed++; console.error(`  FAIL - ${desc}: ${e.message}`); }
}

const realm = getBedtimeRealm('space');
const moral = BEDTIME_MORALS[0];

const bibleOf = (n, extra = {}) => ({
  title: `Story ${n}`,
  archetypeId: `bible:c${n}-t${n}`,
  characters: [
    { name: 'Zephyrina', role: 'hero' },
    { name: 'Rex', role: 'companion', traits: ['loyal'] },
    { name: extra.friend || 'Orion', role: 'helper', traits: ['glowing', 'kind'] }
  ],
  plotDNA: {
    setting: 'moon meadow', conflict: `problem number ${n} unique${n}`, helper: 'an owl', twist: `twist number ${n} unique${n}`,
    resolution: 'sharing', centralObject: `object ${n}`, arc: 'worry to sleep',
    problemType: extra.pt ?? 'lost-thing', twistType: extra.tt ?? 'swap-roles'
  }
});
const sessionOf = (n, extra = {}) => ({
  id: `story_${n}`, title: `Story ${n}`, moralId: 'brave_dark', realmId: 'space', petName: 'Rex the T-Rex',
  storyBible: extra.noBible ? undefined : bibleOf(n, extra)
});

console.log('story memory (pure)');

await check('anything becomes a valid empty memory; bad entries are dropped, labels outside the lists are stripped', () => {
  for (const junk of [undefined, null, 'x', 7, [], {}, { ledger: 'no', recurringCharacters: 5 }]) {
    assert.deepStrictEqual(normalizeStoryMemory(junk), emptyStoryMemory());
  }
  const m = normalizeStoryMemory({
    ledger: [null, 'x', { id: '' }, { id: 'ok', t: 5, title: 'T', pt: 'lost-thing', tt: '<script>', fp: { conflict: 'c'.repeat(300) } }],
    recurringCharacters: [{ name: '' }, null, { name: 'Pip', count: 'many', lastSeen: 'x' }]
  });
  assert.strictEqual(m.ledger.length, 1);
  assert.strictEqual(m.ledger[0].tt, '');
  assert.strictEqual(m.ledger[0].pt, 'lost-thing');
  assert.strictEqual(m.ledger[0].fp.conflict.length, 40);
  assert.deepStrictEqual(m.recurringCharacters.map(c => [c.name, c.count]), [['Pip', 1]]);
});
await check('memory is bounded: LEDGER_MAX stories, 12 friends, newest first, duplicates collapse to the newest', () => {
  const ledger = Array.from({ length: 120 }, (_, i) => ({ id: `s${i % 90}`, t: i, title: `t${i}` }));
  const m = normalizeStoryMemory({ ledger, recurringCharacters: Array.from({ length: 30 }, (_, i) => ({ name: `Friend${i}`, count: i + 1 })) });
  assert.strictEqual(m.ledger.length, LEDGER_MAX);
  assert.ok(m.ledger.every((e, i, a) => i === 0 || a[i - 1].t >= e.t));
  assert.strictEqual(new Set(m.ledger.map(e => e.id)).size, m.ledger.length);
  assert.strictEqual(m.ledger.find(e => e.id === 's0').t, 90, 'duplicate id keeps the newest copy');
  assert.strictEqual(m.recurringCharacters.length, RECURRING_MAX);
  assert.strictEqual(m.recurringCharacters[0].name, 'Friend29', 'most familiar first');
});
await check('committing a story records its plot labels and the friends met; the hero and the pet are not friends', () => {
  const m = commitStory(emptyStoryMemory(), sessionOf(1), { now: 1000 });
  assert.strictEqual(m.ledger.length, 1);
  const e = m.ledger[0];
  assert.deepStrictEqual([e.id, e.t, e.pt, e.tt, e.title], ['story_1', 1000, 'lost-thing', 'swap-roles', 'Story 1']);
  assert.ok(e.fp.conflict.includes('problem number 1'));
  assert.deepStrictEqual(m.recurringCharacters.map(c => [c.name, c.role, c.trait, c.count]), [['Orion', 'helper', 'glowing', 1]]);
  // the pet is also excluded when the bible calls it by its short name and the session has the full name
  const s = sessionOf(2); s.storyBible.characters[1] = { name: 'Rex', role: 'friend' };
  assert.ok(!commitStory(emptyStoryMemory(), s).recurringCharacters.some(c => c.name === 'Rex'));
});
await check('committing the same story twice (the app completes it from two places) changes nothing', () => {
  const once = commitStory(emptyStoryMemory(), sessionOf(1), { now: 1000 });
  const twice = commitStory(once, sessionOf(1), { now: 9999 });
  assert.strictEqual(twice.ledger.length, 1);
  assert.strictEqual(twice.ledger[0].t, 1000, 'keeps its original position in time');
  assert.strictEqual(twice.recurringCharacters[0].count, 1, 'friends are not counted twice');
});
await check('a returning friend is counted across stories; each new story goes to the front', () => {
  let m = emptyStoryMemory();
  m = commitStory(m, sessionOf(1), { now: 1 });
  m = commitStory(m, sessionOf(2), { now: 2 });
  m = commitStory(m, sessionOf(3, { friend: 'Pip' }), { now: 3 });
  assert.deepStrictEqual(m.ledger.map(e => e.id), ['story_3', 'story_2', 'story_1']);
  assert.deepStrictEqual(m.recurringCharacters.map(c => [c.name, c.count]), [['Orion', 2], ['Pip', 1]]);
});
await check('a story with no plan (offline tiers) still records its title', () => {
  const m = commitStory(emptyStoryMemory(), sessionOf(5, { noBible: true }), { now: 5 });
  assert.deepStrictEqual([m.ledger[0].title, m.ledger[0].pt, m.ledger[0].fp.conflict], ['Story 5', '', '']);
  assert.deepStrictEqual(m.recurringCharacters, []);
});
await check('60 stories keep only the newest LEDGER_MAX', () => {
  let m = emptyStoryMemory();
  for (let i = 1; i <= 60; i++) m = commitStory(m, sessionOf(i), { now: i });
  assert.strictEqual(m.ledger.length, LEDGER_MAX);
  assert.strictEqual(m.ledger[0].id, 'story_60');
  assert.strictEqual(m.ledger[LEDGER_MAX - 1].id, `story_${60 - LEDGER_MAX + 1}`);
});
await check('two devices merge by union, in any order, without losing a story and without mutating inputs', () => {
  const phone = commitStory(commitStory(emptyStoryMemory(), sessionOf(1), { now: 1 }), sessionOf(2), { now: 2 });
  const tablet = commitStory(commitStory(emptyStoryMemory(), sessionOf(1), { now: 1 }), sessionOf(3, { friend: 'Pip' }), { now: 3 });
  const before = JSON.stringify([phone, tablet]);
  const ab = mergeStoryMemory(phone, tablet);
  const ba = mergeStoryMemory(tablet, phone);
  assert.deepStrictEqual(ab, ba);
  assert.deepStrictEqual(ab.ledger.map(e => e.id), ['story_3', 'story_2', 'story_1']);
  assert.deepStrictEqual(mergeStoryMemory(ab, ab), ab, 'idempotent');
  assert.strictEqual(JSON.stringify([phone, tablet]), before);
  assert.deepStrictEqual(ab.recurringCharacters.map(c => c.name).sort(), ['Orion', 'Pip']);
  assert.deepStrictEqual(mergeStoryMemory(undefined, phone), phone);
  assert.deepStrictEqual(mergeStoryMemory(null, undefined), emptyStoryMemory());
});
await check('what a request carries is bounded, minimal and survives the server sanitizer unchanged', () => {
  let m = emptyStoryMemory();
  for (let i = 1; i <= 45; i++) m = commitStory(m, sessionOf(i, { friend: `Friend${i % 6}` }), { now: i });
  const sent = memoryForRequest(m);
  assert.strictEqual(sent.ledgerDigest.length, DIGEST_SEND);
  assert.strictEqual(sent.recurringCharacters.length, FRIENDS_SEND);
  assert.deepStrictEqual(Object.keys(sent.recurringCharacters[0]).sort(), ['name', 'role', 'trait']);
  const wire = JSON.parse(JSON.stringify(sent));
  const cleaned = cleanLedgerDigest(wire.ledgerDigest);
  assert.strictEqual(cleaned.length, DIGEST_SEND, 'the server keeps every entry the app sent');
  assert.deepStrictEqual(cleaned.map(e => [e.id, e.pt, e.tt]), wire.ledgerDigest.map(e => [e.id, e.pt, e.tt]));
  assert.strictEqual(cleaned[0].fp.conflict, wire.ledgerDigest[0].fp.conflict);
  assert.strictEqual(cleanRecurring(wire.recurringCharacters).length, FRIENDS_SEND);
});
await check('worst-case memory stays small enough for the one Firestore household document', () => {
  const long = 'x'.repeat(200);
  const full = normalizeStoryMemory({
    ledger: Array.from({ length: 200 }, (_, i) => ({
      id: `id${i}-${long}`, t: i, title: long, archetypeId: long, pt: 'missing-sound-or-song', tt: 'solves-itself-by-resting', moralId: long, realmId: long,
      fp: Object.fromEntries(['setting', 'conflict', 'helper', 'twist', 'resolution', 'centralObject', 'arc'].map(k => [k, long])),
      characters: [long, long, long, long, long, long]
    })),
    recurringCharacters: Array.from({ length: 40 }, (_, i) => ({ name: `${long}${i}`, role: long, trait: long, count: 9, lastSeen: i }))
  });
  const bytes = JSON.stringify(full).length;
  // x5 copies per child in the household document: three children must stay far below 1 MiB
  assert.ok(bytes < 30_000, `${bytes} bytes`);
  assert.ok(bytes * 5 * 3 < 450_000, `three children at the worst case: ${bytes * 15} bytes`);
});

await check('seam: a story the app remembers makes the server planner avoid it next time', async () => {
  const memory = commitStory(emptyStoryMemory(), sessionOf(1, { pt: 'too-bright-or-loud', tt: 'fear-was-friend' }), { now: 1 });
  const body = { heroName: 'Zephyrina', ...memoryForRequest(memory) };
  const request = buildRequest(JSON.parse(JSON.stringify(body)), { realm, moral });
  assert.strictEqual(request.ledgerDigest.length, 1);
  const plan = (conflict, twist, pt, tt) => JSON.stringify({
    characters: [{ name: 'Zephyrina' }, { name: 'Pip' }],
    plotDNA: { setting: 's', conflict, helper: 'owl', twist, resolution: 'r', centralObject: 'o', arc: 'a', problemType: pt, twistType: tt }
  });
  const prompts = [];
  const answers = [plan('a comet nursery glows too much', 'the folds are a quilt', 'too-bright-or-loud', 'fear-was-friend'), plan('a kite that cannot find home', 'it was hiding in plain sight', 'journey-or-way-home', 'hidden-in-plain-sight')];
  let i = 0;
  const generate = async (p) => { prompts.push(p); return answers[Math.min(i++, 1)]; };
  const out = await planBible({ generate, request });
  assert.strictEqual(out.ledgerCheck.attempts, 2, 'same theme as the remembered story is replanned');
  assert.strictEqual(out.bible.plotDNA.problemType, 'journey-or-way-home');
  assert.ok(prompts[0].includes('RECENT THEMES') && prompts[0].includes('too-bright-or-loud'));
});

if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log('all passed');
