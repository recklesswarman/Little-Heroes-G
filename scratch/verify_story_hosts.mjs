import './setup_mock_env.js';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { makeFirebaseGenerate } from '../src/services/firebaseEngineAdapter.js';
import { offlineChapter } from '../shared/storyEngine/engine.js';
import { offlineBedtimeResponse } from '../server/geminiService.js';

const { store } = await import('../src/state/store.js');
const { bedtimeStoryService } = await import('../src/services/bedtimeStoryService.js');
const { firebaseAI } = await import('../src/services/firebaseAILogicService.js');

let failed = 0;
async function check(desc, fn) {
  try { await fn(); console.log(`  ok - ${desc}`); }
  catch (e) { failed++; console.error(`  FAIL - ${desc}: ${e.stack?.split('\n').slice(0, 3).join(' | ') || e.message}`); }
}
process.env.TEST_SERVER_URL = 'http://test.local'; // outside a browser the route is only tried when a server URL is given
const HERO = 'Zephyrina';
const words = (n, w) => Array.from({ length: n }, () => w).join(' ');
const chapterText = (extra) => `${extra} ${words(150, 'soft')}.`;
const bibleJson = JSON.stringify({
  title: 'The Lantern Who Hummed', tone: 'cozy',
  characters: [{ name: HERO, role: 'hero', motivation: 'to help Pip', traits: ['kind'] }, { name: 'Pip', role: 'friend', motivation: 'to find a song', traits: ['shy'], visualSheet: 'a small round owl' }],
  plotDNA: { setting: 'moon meadow', conflict: 'a lost lullaby', helper: 'Pip', twist: 'the lantern hums', resolution: 'sharing the song', centralObject: 'humming lantern', arc: 'search to sleep', problemType: 'missing-sound-or-song', twistType: 'sharing-fixes-it' },
  beats: [{ summary: 'a hum', characters: [HERO] }, { summary: 'meet Pip', characters: [HERO, 'Pip'] }, { summary: 'share', characters: [HERO, 'Pip'] }, { summary: 'sleep', characters: [HERO, 'Pip'] }]
});
const chapterJson = (text) => JSON.stringify({ title: 'Chapter 1: Something Soft', chapterText: text, summary: `${HERO} took a gentle step.`, whisperLine: 'Softly now.', sleepyCue: 'Let your shoulders melt.', moralReflection: 'Kindness helps.', sceneMood: 'gentle' });
const reply = (text) => ({ response: { text: () => text } });

console.log('story engine on every host');

await check('the browser adapter: JSON mode and no-thinking first, plain retry second, empty/blocked replies throw', async () => {
  assert.strictEqual(makeFirebaseGenerate(null), null);
  assert.strictEqual(makeFirebaseGenerate({}), null);
  const seen = [];
  const model = { generateContent: async (req) => { seen.push(req.generationConfig); return reply('hello'); } };
  const gen = makeFirebaseGenerate(model);
  assert.strictEqual(await gen('p', { json: true, temperature: 0.9, maxOutputTokens: 3000 }), 'hello');
  assert.deepStrictEqual(seen[0], { temperature: 0.9, maxOutputTokens: 3000, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } });
  await gen('p');
  assert.ok(!('responseMimeType' in seen[1]));
  let calls = 0;
  const flaky = makeFirebaseGenerate({ generateContent: async (req) => { calls++; if (req.generationConfig.thinkingConfig) throw new Error('unsupported thinkingConfig'); return reply('ok'); } });
  assert.strictEqual(await flaky('p'), 'ok');
  assert.strictEqual(calls, 2);
  await assert.rejects(makeFirebaseGenerate({ generateContent: async () => reply('   ') })('p'), /empty or blocked/);
  await assert.rejects(makeFirebaseGenerate({ generateContent: async () => ({ response: { text: () => { throw new Error('blocked by safety'); } } }) })('p'), /blocked/);
});
await check('Firebase Hosting routes /api/gemini/** to the Functions API before the catch-all', () => {
  const cfg = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'));
  const rewrites = (Array.isArray(cfg.hosting) ? cfg.hosting[0] : cfg.hosting).rewrites;
  const i = rewrites.findIndex(r => r.source === '/api/gemini/**');
  const all = rewrites.findIndex(r => r.source === '**');
  assert.ok(i !== -1 && i < all, 'rewrite missing or after the catch-all');
  assert.strictEqual(rewrites[i].function.functionId, 'api');
});
await check('offline chapters respect topics to avoid: other variants first, then the sentence is dropped; the hero stays', () => {
  const request = { heroName: HERO, avoidTopics: ['spiders'] };
  let n = 0;
  const variants = [`${HERO} saw spiders on a web. All was calm.`, `${HERO} walked by a pond. Fish swam.`];
  assert.strictEqual(offlineChapter(() => ({ chapterText: variants[n++ % 2] }), 0, request).chapterText, variants[1]);
  const stubborn = offlineChapter(() => ({ chapterText: `${HERO} found spiders. The night was quiet.` }), 0, request);
  assert.ok(!/spiders/.test(stubborn.chapterText) && /quiet/.test(stubborn.chapterText) && stubborn.chapterText.includes(HERO));
  const everything = offlineChapter(() => ({ chapterText: 'Spiders everywhere.' }), 0, request);
  assert.ok(everything.chapterText.includes(HERO) && !/spiders/i.test(everything.chapterText));
  let calls = 0;
  offlineChapter(() => { calls++; return { chapterText: 'fine.' }; }, 0, { heroName: HERO, avoidTopics: [] });
  assert.strictEqual(calls, 1);
});
await check('when the server route fails, the reply is a chapter for the child who asked (never "Little Hero")', async () => {
  const r = await offlineBedtimeResponse({ heroName: 'Zephyrina', petName: 'Rex', realmId: 'space', moralId: 'brave_dark', actNumber: 2, avoidTopics: ['spiders'] });
  assert.ok((r.chapterText || r.text).includes('Zephyrina'), 'child\'s name');
  assert.ok(!/Little Hero/.test(JSON.stringify(r)));
  assert.strictEqual(r.chapterIndex, 1);
  assert.strictEqual(r.generationSource, 'procedural');
  for (const junk of [undefined, null, 'x', 7, [], { heroName: 5 }]) {
    const j = await offlineBedtimeResponse(junk);
    assert.ok(JSON.stringify(j).length > 100, 'always something usable');
  }
});

// ---- the app's tiers -------------------------------------------------------------------------------
const realFetch = globalThis.fetch;
const realFlags = { ready: firebaseAI.isAiReady, getStoryModel: firebaseAI.getStoryModel };
let storyCalls;
function mockFetch(route) {
  storyCalls = [];
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('/api/gemini/bedtime-story')) {
      storyCalls.push(JSON.parse(opts.body));
      return route();
    }
    if (String(url).includes('/api/rex/')) storyCalls.push({ agy: true });
    return { ok: false, status: 503, headers: { get: () => '' }, json: async () => ({}), arrayBuffer: async () => new ArrayBuffer(0) };
  };
}
const htmlRoute = () => ({ ok: true, status: 200, headers: { get: () => 'text/html; charset=utf-8' }, json: async () => { throw new SyntaxError('Unexpected token <'); } });
const modelFor = (calls) => ({
  generateContent: async (rq) => {
    const prompt = rq.contents[0].parts[0].text;
    calls.push(prompt.includes('planning a calming') ? 'plan' : 'chapter');
    return reply(prompt.includes('planning a calming') ? bibleJson : chapterJson(chapterText(`${HERO} walked.`)));
  }
});
function newSession() {
  return {
    id: 'story_t', heroId: 'hero_1', heroName: HERO, petName: 'Rex the T-Rex', petId: 'rex', realmId: 'space', moralId: 'brave_dark',
    customWish: '', userChoices: [], acts: [], childContext: { activePet: { name: 'Rex the T-Rex', shortName: 'Rex' }, antiRepetition: {} }
  };
}
async function runAct(routeOrNull, { ai = true } = {}) {
  const modelCalls = [];
  mockFetch(routeOrNull || (() => { throw new TypeError('network down'); }));
  firebaseAI.isAiReady = ai;
  firebaseAI.getStoryModel = () => (ai ? modelFor(modelCalls) : null);
  const session = newSession();
  bedtimeStoryService.activeSession = session;
  const act = await bedtimeStoryService.generateAct(1, '');
  return { act, session, modelCalls };
}

await check('a host with no route (HTML page, 404, 500 or no network) runs the engine in the browser with the model', async () => {
  for (const route of [htmlRoute, () => ({ ok: false, status: 404, headers: { get: () => 'text/html' }, json: async () => ({}) }), () => ({ ok: false, status: 500, headers: { get: () => 'application/json' }, json: async () => ({ error: 'x' }) }), null]) {
    const { act, session, modelCalls } = await runAct(route);
    assert.ok(act.text.includes(HERO) && act.text.length > 100, 'story text with the hero');
    assert.deepStrictEqual(modelCalls, ['plan', 'chapter'], `model calls: ${modelCalls}`);
    assert.strictEqual(session.storyBible?.title, 'The Lantern Who Hummed', 'the plan travels with the session');
    assert.strictEqual(act.scenePlan?.scenes?.length, 2, 'pictures are planned too');
  }
  assert.ok(!storyCalls.some(c => c.agy), 'the old AGY narrator is never called');
});
await check('with no AI at all the browser engine still plans and weaves an offline chapter with the child\'s name', async () => {
  const { act, session, modelCalls } = await runAct(htmlRoute, { ai: false });
  assert.deepStrictEqual(modelCalls, []);
  assert.ok(act.text.includes(HERO), act.text.slice(0, 80));
  assert.ok(session.storyBible && session.storyBible.characters[0].name === HERO);
});
await check('a working server route is used as before (the browser engine is not run)', async () => {
  const serverChapter = { success: true, chapterText: `${HERO} stepped onto the moonlit path and listened to the quiet.`, title: 'Chapter 1: Server', storyBible: JSON.parse(bibleJson) };
  const { act, modelCalls } = await runAct(() => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => serverChapter }));
  assert.ok(act.text.includes('moonlit path'));
  assert.deepStrictEqual(modelCalls, []);
});
await check('every route is sent the same request: hero, pet species, avatar look and the parent controls', async () => {
  store.state.heroes = [{ id: 'hero_1', name: HERO, avatar: '' }];
  store.updateStoryControls({ avoidTopics: ['spiders'], researchEnabled: false });
  store.setStoryProfile('hero_1', { pronouns: 'she', petPronouns: 'it', tone: 'silly' });
  await runAct(htmlRoute);
  const sent = storyCalls[0];
  assert.deepStrictEqual([sent.heroName, sent.petSpecies, sent.pronouns, sent.petPronouns, sent.tone, sent.researchEnabled], [HERO, 'T-Rex', 'she', 'it', 'silly', false]);
  assert.deepStrictEqual(sent.avoidTopics, ['spiders']);
});

globalThis.fetch = realFetch;
firebaseAI.isAiReady = realFlags.ready;
firebaseAI.getStoryModel = realFlags.getStoryModel;
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log('all passed');
process.exit(0);
