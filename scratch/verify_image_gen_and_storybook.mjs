import assert from 'assert';
import { buildBedtimeIllustrationPrompt, handleStoryIllustrationRequest } from '../server/imageGenService.js';
import { bedtimeIllustrationService } from '../src/services/bedtimeIllustrationService.js';
import { generateProceduralBedtimeStory, getBedtimeRealm } from '../src/data/bedtimeStoryData.js';

console.log('--- Starting Bedtime AI Storybook & Image Generator Verification ---');

// Test 1: Prompt Builder adheres to 3D Pixar / Claymation & Explorer Palette
console.log('1. Testing Prompt Construction & Guardrails...');
const prompt = buildBedtimeIllustrationPrompt({
  chapterNumber: 2,
  chapterTitle: 'Whispering Willow Bridge',
  chapterText: 'Liam held the Starlight Lantern high as Rex trotted gently beside the glowing moss.',
  realmId: 'enchanted_forest',
  realmName: 'Enchanted Forest',
  heroName: 'Liam',
  petName: 'Rex',
  petArchetype: 'dino',
  magicItem: 'Starlight Lantern'
});

assert(typeof prompt === 'string' && prompt.length > 50, 'Prompt must be a non-empty string');
assert(prompt.includes('Pixar') || prompt.includes('claymation'), 'Prompt must specify 3D Pixar/claymation style');
assert(prompt.includes('Liam'), 'Prompt must include child hero name');
assert(prompt.includes('Rex'), 'Prompt must include pet companion name');
assert(prompt.includes('Starlight Lantern'), 'Prompt must include magic item');
assert(prompt.includes('Explorer Palette'), 'Prompt must enforce Explorer Palette');
assert(prompt.toLowerCase().includes('no pink') && prompt.toLowerCase().includes('no purple'), 'Prompt must strictly forbid pink/purple');
console.log('✓ Prompt Builder verified with Pixar style and Explorer Palette guardrails.');

// Test 2: In-Memory Cache in bedtimeIllustrationService
console.log('2. Testing Illustration Service Caching...');
const cacheKey = bedtimeIllustrationService.getCacheKey({
  chapterNumber: 1,
  realmId: 'space',
  heroName: 'Liam',
  petName: 'Rex'
});
assert.strictEqual(cacheKey, 'space_ch1_Liam_Rex', 'Cache key must match format');

bedtimeIllustrationService.illustrationCache.set(cacheKey, 'data:image/svg+xml;base64,TEST');
assert.strictEqual(bedtimeIllustrationService.illustrationCache.get(cacheKey), 'data:image/svg+xml;base64,TEST');
bedtimeIllustrationService.illustrationCache.delete(cacheKey);
console.log('✓ In-memory caching verified.');

// Test 3: Fallback SVG generation complies with Explorer Palette
console.log('3. Testing Fallback SVG Palette Compliance...');
const fallbackDataUri = bedtimeIllustrationService.generateFallbackIllustration({
  chapterNumber: 1,
  chapterTitle: 'Star Station',
  realmId: 'space',
  realmName: 'Cosmic Star Station',
  heroName: 'Liam',
  petName: 'Rex',
  magicItem: 'Starlight Lantern'
});

assert(fallbackDataUri.startsWith('data:image/svg+xml;utf8,'), 'Must return an SVG data URI');
const decodedSvg = decodeURIComponent(fallbackDataUri);
assert(!decodedSvg.toLowerCase().includes('#ff69b4') && !decodedSvg.toLowerCase().includes('#ff1493') && !decodedSvg.toLowerCase().includes('#800080'), 'Fallback SVG must not have pink or purple');
assert(decodedSvg.includes('#00d2d3') || decodedSvg.includes('#050f18'), 'Fallback SVG must use Explorer Palette');
console.log('✓ Fallback SVG generation verified.');

// Test 4: Server route handler with mock req/res
console.log('4. Testing Server Route handleStoryIllustrationRequest...');
let mockResStatus = 200;
let mockResJson = null;
const mockRes = {
  status(code) { mockResStatus = code; return this; },
  json(data) { mockResJson = data; return this; }
};

await handleStoryIllustrationRequest({
  body: {
    chapterNumber: 1,
    chapterTitle: 'Starlight Launch',
    realmId: 'space',
    realmName: 'Cosmic Star Station',
    heroName: 'Liam',
    petName: 'Rex'
  }
}, mockRes);

assert(mockResJson && mockResJson.success === true, 'Server handler must succeed');
assert(mockResJson.imageUrl && mockResJson.imageUrl.startsWith('data:image/'), 'Server handler must return data URI');
console.log(`✓ Server Route handleStoryIllustrationRequest verified! Image source: ${mockResJson.imageUrl.slice(0, 30)}...`);

// Test 5: Procedural Story Descriptor & Act Integration
console.log('5. Testing Procedural Bedtime Story Integration...');
const realm = getBedtimeRealm('space');
assert(realm && realm.id === 'space', 'Realm space must exist');
const proceduralAct = generateProceduralBedtimeStory('space', 'brave_dark', 'Liam', 'Rex', 'Lost Blue Socks', 0, []);
assert(proceduralAct.title && proceduralAct.chapterText, 'Procedural act must generate title and text');
console.log(`✓ Procedural act generated: "${proceduralAct.title}"`);

console.log('\n--- All Bedtime AI Storybook & Image Generator Verifications Passed! ---');
