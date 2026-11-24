// Story sparks must make sense to a 4- and a 7-year-old (Dj, 2026-11-24: the weekly refresh in PR 133
// produced mood lines and riddles like "a glowing silver orb" instead of story starts).
// storySparkProblems() is the guard the refresh job now applies to every new seed, and every
// reviewed seed already in the pool must pass it too.
import assert from 'node:assert/strict';
import { storySparkProblems, isStorySpark, mergeCandidates, buildDistillPrompt } from '../shared/storyEngine/seedRefresh.js';
import { REVIEWED_SEEDS } from '../shared/storyEngine/seedPoolReviewed.js';
import { CLEAN_SEED_POOL } from '../shared/storyEngine/seeds.js';

let failed = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  ✅ ${name}`); } catch (err) { failed += 1; console.error(`  ❌ ${name}\n     ${err.message}`); }
};

check('every reviewed seed has a clear who and a story turn', () => {
  const bad = REVIEWED_SEEDS.filter((s) => !isStorySpark(s.text)).map((s) => `${s.id}: ${s.text} (${storySparkProblems(s.text).join('; ')})`);
  assert.deepEqual(bad, []);
  const loaded = new Set(CLEAN_SEED_POOL.map((s) => s.id));
  assert.ok(REVIEWED_SEEDS.every((s) => loaded.has(s.id)), 'every reviewed seed survives cleanSeed()');
});

check('mood lines and riddles from the PR 133 run are refused', () => {
  for (const t of [
    'Soft beams of pale light bounce gently across the cool evening ground.',
    'A glowing silver orb plays hide and seek behind soft drifting evening clouds.',
    'Tiny particles of stardust drift slowly down onto quiet grey hills.',
    'Tiny twinkling creatures flash peacefully across a warm summer meadow.',
    'The quiet night sky wraps the sleepy world below in a calm blanket of dark velvet.',
    'A moon.'
  ]) assert.ok(!isStorySpark(t), `should be refused: ${t}`);
});

check('plain story starts are accepted', () => {
  for (const t of [
    'A little firefly forgets how to blink, so her friends help her find her glow again.',
    'The moon wants to see the sunflowers, so it stays up a little later one morning.',
    'A girl sees a big lumpy shape under the blanket, and it turns out to be her sleepy kitten.'
  ]) assert.deepEqual(storySparkProblems(t), [], t);
});

check('the refresh job drops nonsense candidates before they reach a pull request', () => {
  const out = mergeCandidates(CLEAN_SEED_POOL, [
    'Soft beams of pale light bounce gently across the cool evening ground.',
    'A shy hedgehog wants to join the snow party but worries its spikes will pop the balloons.'
  ], { kind: 'nature', source: 't', date: new Date('2026-12-01') });
  assert.deepEqual(out.map((s) => s.text), ['A shy hedgehog wants to join the snow party but worries its spikes will pop the balloons.']);
});

check('the model is asked for a plain who and a story turn, with good and bad examples', () => {
  const p = buildDistillPrompt('nature', 'text');
  assert.match(p, /clear WHO/);
  assert.match(p, /story turn/);
  assert.match(p, /Bad \(riddle\)/);
});

if (failed) { console.error(`\n❌ ${failed} story spark check(s) failed`); process.exit(1); }
console.log('\nAll story spark checks passed');
