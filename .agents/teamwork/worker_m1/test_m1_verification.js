import assert from 'node:assert';
import fs from 'node:fs';

console.log('🧪 Starting Milestone 1 Deep Verification Suite...\n');

// 1. Verify bedtimeStoryData.js exports and invariants
const {
  BANNED_BEDTIME_STOCK_PHRASES,
  BEDTIME_OPENING_BANKS,
  BEDTIME_WHISPER_BANKS,
  generateProceduralBedtimeStory,
  generateFullBedtimeStory,
  BEDTIME_REALMS,
  BEDTIME_MORALS,
  PLOT_ARCHETYPES
} = await import('../../../src/data/bedtimeStoryData.js');

console.log('--- 1. BANNED_BEDTIME_STOCK_PHRASES Registry ---');
assert(Array.isArray(BANNED_BEDTIME_STOCK_PHRASES), 'BANNED_BEDTIME_STOCK_PHRASES must be an array');
assert(BANNED_BEDTIME_STOCK_PHRASES.length >= 8, 'BANNED_BEDTIME_STOCK_PHRASES must have at least 8 phrases');
const requiredBanned = [
  'smiled happily beside',
  'looked up at the starry sky',
  'gazed with wonder',
  'twinkled like cheerful fireflies',
  'golden sun had dipped peacefully',
  'all was quiet now',
  'gazed at the quiet, starry night',
  'flew across the starry sky'
];
for (const phrase of requiredBanned) {
  assert(
    BANNED_BEDTIME_STOCK_PHRASES.includes(phrase),
    `Missing required banned phrase: "${phrase}"`
  );
}
console.log('  ✅ PASS: All 8 banned stock phrases registered in registry');

console.log('\n--- 2. Dynamic Sentence Banks (Openings & Whispers) ---');
assert(Array.isArray(BEDTIME_OPENING_BANKS) && BEDTIME_OPENING_BANKS.length === 4, '4 chapter opening banks');
for (let ch = 0; ch < 4; ch++) {
  assert(BEDTIME_OPENING_BANKS[ch].length >= 5, `Chapter ${ch + 1} must have 5+ openings (has ${BEDTIME_OPENING_BANKS[ch].length})`);
}
console.log('  ✅ PASS: All 4 chapters have 5+ opening structures (6 defined each)');

assert(Array.isArray(BEDTIME_WHISPER_BANKS) && BEDTIME_WHISPER_BANKS.length === 4, '4 chapter whisper banks');
for (let ch = 0; ch < 4; ch++) {
  assert(BEDTIME_WHISPER_BANKS[ch].length >= 12, `Chapter ${ch + 1} must have 12+ whisper lines (has ${BEDTIME_WHISPER_BANKS[ch].length})`);
}
console.log('  ✅ PASS: All 4 chapters have 12+ soothing whisper lines (12 defined each)');

console.log('\n--- 3. 4-Chapter Narrative Expansion & Word Count Calibration ---');
const story = generateFullBedtimeStory('space', 'brave_dark', 'Leo', 'Rex', 'Be brave at bedtime');
assert(story.success === true, 'generateFullBedtimeStory succeeds');
assert(Array.isArray(story.chapters) && story.chapters.length === 4, 'Must return exactly 4 chapters');
assert.strictEqual(story.chapters[0].chapterIndex, 0);
assert.strictEqual(story.chapters[1].chapterIndex, 1);
assert.strictEqual(story.chapters[2].chapterIndex, 2);
assert.strictEqual(story.chapters[3].chapterIndex, 3);
assert.strictEqual(story.chapters[3].isSleepingEnd, true, 'Chapter 4 is sleeping end');
assert.strictEqual(story.chapters[0].isSleepingEnd, false);
assert.strictEqual(story.chapters[1].isSleepingEnd, false);
assert.strictEqual(story.chapters[2].isSleepingEnd, false);

let totalWords = 0;
story.chapters.forEach((ch, idx) => {
  const words = ch.text.trim().split(/\s+/).length;
  totalWords += words;
  console.log(`  Chapter ${idx + 1} (${ch.title}): ${words} words`);
  assert(words >= 170 && words <= 235, `Chapter ${idx + 1} word count ${words} should be ~180-220 words`);

  // Verify zero banned stock phrases
  for (const banned of BANNED_BEDTIME_STOCK_PHRASES) {
    assert(!ch.text.toLowerCase().includes(banned.toLowerCase()), `Chapter ${idx + 1} contains banned phrase: "${banned}"`);
    assert(!ch.whisperLine.toLowerCase().includes(banned.toLowerCase()), `Chapter ${idx + 1} whisper contains banned phrase: "${banned}"`);
  }

  // Verify zero question prompts
  assert(!ch.text.includes('?'), `Chapter ${idx + 1} text must not contain question marks`);
  assert(!ch.prompt.includes('?'), `Chapter ${idx + 1} prompt must not contain question marks`);
  assert(!ch.promptQuestion.includes('?'), `Chapter ${idx + 1} promptQuestion must not contain question marks`);
});

console.log(`  Total Story Words: ${totalWords} words (~750-850 words target)`);
assert(totalWords >= 740 && totalWords <= 860, `Total words ${totalWords} should be ~750-850 words`);
console.log('  ✅ PASS: 4-chapter narrative length and calibration verified (~7.5 minutes reading time)');

console.log('\n--- 4. High-Entropy Seed Rotation & Progressive Arcs ---');
const storyA = generateFullBedtimeStory('space', 'brave_dark', 'Leo', 'Rex', '', [], 1001);
const storyB = generateFullBedtimeStory('space', 'brave_dark', 'Leo', 'Rex', '', [], 9999);
assert(storyA.chapters[0].text !== storyB.chapters[0].text, 'Different seeds produce different chapter 1 text');
assert(storyA.chapters[1].text !== storyB.chapters[1].text, 'Different seeds produce different chapter 2 text');
console.log('  ✅ PASS: Seed entropy rotates openings, sentence banks, and archetypes');

console.log('\n--- 5. Server, Cloud Function & AGY Agent Inspection ---');
const geminiCode = fs.readFileSync('server/geminiService.js', 'utf8');
assert(geminiCode.includes('ANTI-REPETITION MANDATE'), 'geminiService includes ANTI-REPETITION MANDATE');
assert(geminiCode.includes('recentOpenings'), 'geminiService supports recentOpenings');
assert(geminiCode.includes('BANNED CLICHÉS'), 'geminiService includes BANNED CLICHÉS negative constraint');
assert(geminiCode.includes('parsed.chapters.length >= 4'), 'geminiService parses at least 4 chapters');
assert(geminiCode.includes('slice(0, 4)'), 'geminiService slices 4 chapters');
assert(geminiCode.includes('reqIdx >= 3'), 'geminiService marks isSleepingEnd at index 3');
console.log('  ✅ PASS: server/geminiService.js negative constraints and 4-chapter schema verified');

const voiceApiCode = fs.readFileSync('functions/src/voiceApi.ts', 'utf8');
assert(voiceApiCode.includes('ANTI-REPETITION MANDATE'), 'voiceApi includes ANTI-REPETITION MANDATE');
assert(voiceApiCode.includes('recentOpenings'), 'voiceApi supports recentOpenings');
assert(voiceApiCode.includes('BANNED CLICHÉS'), 'voiceApi includes BANNED CLICHÉS negative constraint');
assert(voiceApiCode.includes('parsed.chapters.length >= 4'), 'voiceApi parses at least 4 chapters');
assert(voiceApiCode.includes('slice(0, 4)'), 'voiceApi slices 4 chapters');
assert(voiceApiCode.includes('reqIdx >= 3'), 'voiceApi marks isSleepingEnd at index 3');
for (const banned of BANNED_BEDTIME_STOCK_PHRASES) {
  // Banned phrases should only appear in the negative constraint list, never in the fallback story text
  const occurrences = voiceApiCode.split(banned).length - 1;
  assert(occurrences <= 1, `Banned phrase "${banned}" should only occur in the anti-repetition constraint list`);
}
console.log('  ✅ PASS: functions/src/voiceApi.ts negative constraints and 4-chapter fallback verified');

const agyCode = fs.readFileSync('little-heroes-agy-service/agents/bedtime_narrator.py', 'utf8');
assert(agyCode.includes('STRICTLY BANNED PHRASES'), 'bedtime_narrator includes STRICTLY BANNED PHRASES');
assert(agyCode.includes('~180-220 words'), 'bedtime_narrator specifies ~180-220 words per chapter');
assert(agyCode.includes('NO QUESTIONS'), 'bedtime_narrator specifies NO QUESTIONS');
assert(agyCode.includes('past_openings'), 'bedtime_narrator supports past_openings');
console.log('  ✅ PASS: little-heroes-agy-service/agents/bedtime_narrator.py constraints and guidelines verified');

console.log('\n=========================================');
console.log('🎉 ALL MILESTONE 1 VERIFICATION CHECKS PASSED!');
console.log('=========================================\n');
