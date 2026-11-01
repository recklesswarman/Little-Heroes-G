import './setup_mock_env.js';
import assert from 'node:assert';
import { commitStory, emptyStoryMemory, normalizeStoryMemory } from '../shared/storyEngine/memory.js';

const { store } = await import('../src/state/store.js');

let failed = 0;
async function check(desc, fn) {
  try { await fn(); console.log(`  ok - ${desc}`); }
  catch (e) { failed++; console.error(`  FAIL - ${desc}: ${e.stack?.split('\n').slice(0, 3).join(' | ') || e.message}`); }
}

const mkHero = (id, name) => ({
  id, name, role: 'Adventurer', avatar: '', level: 1, points: 0, coins: 0, tokens: 0, xp: 0,
  activePetId: '1', unlockedPetIds: ['1'], hasChosenStarterPet: true
});
const bibleOf = (n, friend = 'Orion') => ({
  title: `Story ${n}`, archetypeId: `bible:c${n}-t${n}`,
  characters: [{ name: 'Hero', role: 'hero' }, { name: 'Rex', role: 'companion' }, { name: friend, role: 'helper', traits: ['kind'] }],
  plotDNA: { setting: 's', conflict: `conflict ${n}`, helper: 'owl', twist: `twist ${n}`, resolution: 'r', centralObject: `o${n}`, arc: 'a', problemType: 'lost-thing', twistType: 'swap-roles' }
});
const sessionOf = (n, friend) => ({ id: `story_${n}`, title: `Story ${n}`, moralId: 'brave_dark', realmId: 'space', petName: 'Rex the T-Rex', storyBible: bibleOf(n, friend) });

function resetTwoKids() {
  store.state.heroes = [mkHero('hero_a', 'Ada'), mkHero('hero_b', 'Ben')];
  store.state.selectedHero = { ...store.state.selectedHero, ...mkHero('hero_a', 'Ada'), storyMemory: undefined };
  store.state.selectedKidId = 'hero_a';
  store.state.bedtimeStoryLibrary = [];
}
const idsOf = (memory) => memory.ledger.map(e => e.id);

console.log('story memory in the store');

await check('a new or unmigrated child reads as an empty, valid memory', () => {
  resetTwoKids();
  assert.deepStrictEqual(store.getStoryMemory('hero_a'), emptyStoryMemory());
  assert.deepStrictEqual(store.getStoryMemory('hero_b'), emptyStoryMemory());
  assert.deepStrictEqual(store.getStoryMemory('nobody'), emptyStoryMemory());
});

await check('committing remembers the story on the selected child and in their heroes[] record', () => {
  resetTwoKids();
  store.commitStoryMemory('hero_a', sessionOf(1));
  assert.deepStrictEqual(idsOf(store.getStoryMemory('hero_a')), ['story_1']);
  assert.deepStrictEqual(idsOf(normalizeStoryMemory(store.state.heroes.find(h => h.id === 'hero_a').storyMemory)), ['story_1']);
  assert.deepStrictEqual(idsOf(store.getStoryMemory('hero_b')), []);
});

await check('siblings never see each other\'s stories, across switches in both directions', () => {
  resetTwoKids();
  store.commitStoryMemory('hero_a', sessionOf(1, 'Orion'));
  store.switchHero('hero_b');
  assert.strictEqual(store.state.selectedHero.id, 'hero_b');
  assert.deepStrictEqual(idsOf(normalizeStoryMemory(store.state.selectedHero.storyMemory)), [], 'Ben starts with none of Ada\'s stories');
  store.commitStoryMemory('hero_b', sessionOf(2, 'Pip'));
  store.switchHero('hero_a');
  assert.deepStrictEqual(idsOf(store.getStoryMemory('hero_a')), ['story_1']);
  assert.deepStrictEqual(idsOf(store.getStoryMemory('hero_b')), ['story_2']);
  assert.deepStrictEqual(store.getStoryMemory('hero_a').recurringCharacters.map(c => c.name), ['Orion']);
  assert.deepStrictEqual(store.getStoryMemory('hero_b').recurringCharacters.map(c => c.name), ['Pip']);
  store.switchHero('hero_b');
  assert.deepStrictEqual(idsOf(normalizeStoryMemory(store.state.selectedHero.storyMemory)), ['story_2']);
});

await check('committing for a child who is not selected writes only to that child', () => {
  resetTwoKids();
  store.commitStoryMemory('hero_b', sessionOf(7));
  assert.deepStrictEqual(idsOf(store.getStoryMemory('hero_b')), ['story_7']);
  assert.deepStrictEqual(idsOf(store.getStoryMemory('hero_a')), []);
  assert.deepStrictEqual(idsOf(normalizeStoryMemory(store.state.selectedHero.storyMemory)), []);
  assert.strictEqual(store.commitStoryMemory('nobody', sessionOf(8)), null);
  assert.strictEqual(store.commitStoryMemory('hero_a', null), null);
});

await check('completing a story remembers it even when the reward is already pending approval', () => {
  resetTwoKids();
  const real = store.isTaskPendingApproval;
  store.isTaskPendingApproval = () => true;
  try {
    const result = store.completeBedtimeStory(sessionOf(3));
    assert.strictEqual(result.alreadyPending, true);
  } finally {
    store.isTaskPendingApproval = real;
  }
  assert.deepStrictEqual(idsOf(store.getStoryMemory('hero_a')), ['story_3']);
});

await check('completing the same story twice does not duplicate it or count its friends twice', () => {
  resetTwoKids();
  const real = store.isTaskPendingApproval;
  store.isTaskPendingApproval = () => true;
  try {
    store.completeBedtimeStory(sessionOf(4));
    store.completeBedtimeStory(sessionOf(4));
  } finally {
    store.isTaskPendingApproval = real;
  }
  const m = store.getStoryMemory('hero_a');
  assert.deepStrictEqual(idsOf(m), ['story_4']);
  assert.strictEqual(m.recurringCharacters[0].count, 1);
});

await check('flushing the selected child into heroes[] never drops stories (union, not overwrite)', () => {
  resetTwoKids();
  const hero = store.state.heroes.find(h => h.id === 'hero_a');
  hero.storyMemory = commitStory(emptyStoryMemory(), sessionOf(10), { now: 10 });   // only in heroes[]
  store.state.selectedHero.storyMemory = commitStory(emptyStoryMemory(), sessionOf(11), { now: 11 }); // only on selectedHero
  store.syncSelectedHeroWithHeroes();
  assert.deepStrictEqual(idsOf(normalizeStoryMemory(store.state.heroes.find(h => h.id === 'hero_a').storyMemory)), ['story_11', 'story_10']);
});

await check('a second device\'s stories merge in from the cloud by union, and the local ones survive', () => {
  resetTwoKids();
  store.commitStoryMemory('hero_a', sessionOf(1, 'Orion'));
  const cloudHero = {
    ...mkHero('hero_a', 'Ada'),
    storyMemory: commitStory(commitStory(emptyStoryMemory(), sessionOf(1, 'Orion'), { now: 1 }), sessionOf(2, 'Pip'), { now: 2 })
  };
  store.hydrateFromCloud({ heroes: [cloudHero, mkHero('hero_b', 'Ben')], deletedHeroIds: [] });
  const ids = idsOf(store.getStoryMemory('hero_a'));
  assert.ok(ids.includes('story_1') && ids.includes('story_2'), `ids: ${ids}`);
  assert.strictEqual(new Set(ids).size, ids.length);
  assert.deepStrictEqual(idsOf(normalizeStoryMemory(store.state.selectedHero.storyMemory)).sort(), ['story_1', 'story_2']);
  assert.deepStrictEqual(store.getStoryMemory('hero_b').ledger, [], 'the sibling is untouched');
});

await check('a cloud copy with no memory (an older device) does not erase local memory', () => {
  resetTwoKids();
  store.commitStoryMemory('hero_a', sessionOf(5));
  store.hydrateFromCloud({ heroes: [mkHero('hero_a', 'Ada'), mkHero('hero_b', 'Ben')], deletedHeroIds: [] });
  assert.deepStrictEqual(idsOf(store.getStoryMemory('hero_a')), ['story_5']);
});

await check('garbage memory arriving from the cloud is neutralized, not trusted', () => {
  resetTwoKids();
  store.hydrateFromCloud({
    heroes: [{ ...mkHero('hero_a', 'Ada'), storyMemory: { ledger: ['x', null, { id: 'ok', t: 1, title: 'T', pt: '<script>' }], recurringCharacters: 'no' } }, mkHero('hero_b', 'Ben')],
    deletedHeroIds: []
  });
  const m = store.getStoryMemory('hero_a');
  assert.deepStrictEqual(idsOf(m), ['ok']);
  assert.strictEqual(m.ledger[0].pt, '');
  assert.deepStrictEqual(m.recurringCharacters, []);
});

if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log('all passed');
process.exit(0);
