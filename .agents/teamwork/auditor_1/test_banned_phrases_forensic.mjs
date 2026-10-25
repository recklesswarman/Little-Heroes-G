import {
  generateFullBedtimeStory,
  generateProceduralBedtimeStory,
  BANNED_BEDTIME_STOCK_PHRASES,
  BEDTIME_REALMS,
  BEDTIME_MORALS
} from '../../../src/data/bedtimeStoryData.js';
import assert from 'assert';

console.log('--- Checking BANNED_BEDTIME_STOCK_PHRASES Registry ---');
assert(Array.isArray(BANNED_BEDTIME_STOCK_PHRASES), 'BANNED_BEDTIME_STOCK_PHRASES is not an array');
assert(BANNED_BEDTIME_STOCK_PHRASES.length >= 8, 'BANNED_BEDTIME_STOCK_PHRASES has fewer than 8 phrases');
console.log(`Registry contains ${BANNED_BEDTIME_STOCK_PHRASES.length} banned clichés.`);

console.log('--- Generating 100 stories across realms, morals, and random seeds ---');
let totalStories = 0;
let totalChapters = 0;

for (let i = 0; i < 100; i++) {
  const realm = BEDTIME_REALMS[i % BEDTIME_REALMS.length];
  const moral = BEDTIME_MORALS[i % BEDTIME_MORALS.length];
  const seed = Math.floor(Math.random() * 2147483647);
  const story = generateFullBedtimeStory(realm.id, moral.id, 'HeroToddler', 'Sparky', 'Sleep well little star', [], seed);

  assert.strictEqual(story.chapters.length, 4, `Story ${i} did not have 4 chapters`);
  totalStories++;

  for (let chIdx = 0; chIdx < 4; chIdx++) {
    totalChapters++;
    const chapter = story.chapters[chIdx];
    const text = (chapter.text || chapter.chapterText || '').toLowerCase();

    // Check for banned phrases
    for (const phrase of BANNED_BEDTIME_STOCK_PHRASES) {
      assert(
        !text.includes(phrase.toLowerCase()),
        `VIOLATION: Found banned phrase "${phrase}" in story ${i}, chapter ${chIdx}`
      );
    }

    // Check for question prompt elimination
    const prompt = chapter.prompt || '';
    const promptQuestion = chapter.promptQuestion || '';
    assert(
      !prompt.includes('?'),
      `VIOLATION: Found question mark in chapter prompt: "${prompt}"`
    );
    assert(
      !promptQuestion.includes('?'),
      `VIOLATION: Found question mark in chapter promptQuestion: "${promptQuestion}"`
    );

    // Check word counts (~180-220 words)
    const wordCount = (chapter.text || '').trim().split(/\s+/).filter(Boolean).length;
    assert(
      wordCount >= 160 && wordCount <= 250,
      `Word count calibration outside boundary in story ${i}, chapter ${chIdx}: ${wordCount} words`
    );
  }
}

console.log(`PASS: Tested ${totalStories} stories (${totalChapters} chapters).`);
console.log('Zero banned stock phrases detected. Zero mid-story questions detected. All word counts calibrated.');
