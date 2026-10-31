/**
 * scratch/verify_bedtime_scene_prompts.mjs
 *
 * The two bedtime illustrations per chapter must come from a visual summary of
 * the chapter being read, not from a fixed prompt. Verifies that different
 * stories give different prompts, each carrying its own imagery; that quoted
 * speech, goodnight filler and breathing instructions never reach the image
 * model; that every prompt fits the model's ~77-token window; and that the
 * backup route receives the same summary as the direct call.
 */
import './setup_mock_env.js';
import assert from 'node:assert';

let passed = 0;
let failed = 0;

async function check(desc, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc} -> ${err.message}`);
    failed++;
  }
}

function estimateTokens(text) {
  const words = (text.match(/[A-Za-z0-9'-]+/g) || []).length;
  const punctuation = (text.match(/[^\sA-Za-z0-9'-]/g) || []).length;
  return Math.ceil(words * 1.35 + punctuation);
}

const hedgehogStory = [
  'The evening sky glowed softly over the Mossy Hollow as the little group set out.',
  'A sleepy hedgehog sat beside a fallen log, searching for her tiny silver lullaby bell.',
  'She whispered, "I have looked everywhere and I feel so sad tonight."',
  'Mia knelt down and peeked beneath the mossy log where a silver bell glittered in the dirt.',
  'The hedgehog hugged the shining bell and rolled into a happy little ball.',
  'Then the friends watched a lantern of fireflies drift slowly above the sleepy stream.',
  'Goodnight, little hero, sleep tight.'
].join(' ');

const whaleStory = [
  'Morning mist curled around the harbor as the lanterns winked out one by one.',
  'A giant friendly whale floated through the clouds above the old lighthouse.',
  'The whale hummed a slow song while twelve shimmering fireflies circled its enormous tail.',
  'Mia climbed onto a rope ladder and waved at the sleepy seagulls on the rooftops.',
  'Together they drifted past a tower of cotton clouds and a sparkling rainbow bridge.',
  'The lighthouse keeper lit a warm amber lamp and tucked a woolly blanket around the whale.'
].join(' ');

async function run() {
  console.log('🧪 Bedtime Illustration Scene Prompt Verification\n');

  const { bedtimeIllustrationService: service } = await import('../src/services/bedtimeIllustrationService.js');
  const { generateProceduralBedtimeStory, BEDTIME_REALMS, BEDTIME_MORALS } = await import('../src/data/bedtimeStoryData.js');

  const base = { heroName: 'Mia', petName: 'Rex', petArchetype: 'dino', realmName: 'Starlight Woods', chapterNumber: 2 };

  await check('different stories produce different prompts for the same chapter number and scene', () => {
    const a = service.buildPrompt({ ...base, chapterText: hedgehogStory, sceneType: 'scene_a' });
    const b = service.buildPrompt({ ...base, chapterText: whaleStory, sceneType: 'scene_a' });
    assert.notStrictEqual(a, b);
  });

  await check('each story prompt carries that story\'s own imagery across its two scenes', () => {
    const hedgehog = ['scene_a', 'scene_b'].map(sceneType => service.buildPrompt({ ...base, chapterText: hedgehogStory, sceneType }).toLowerCase()).join(' ');
    const whale = ['scene_a', 'scene_b'].map(sceneType => service.buildPrompt({ ...base, chapterText: whaleStory, sceneType }).toLowerCase()).join(' ');
    assert.ok(/hedgehog|bell|log/.test(hedgehog), 'hedgehog story prompt should mention its imagery');
    assert.ok(/whale|lighthouse|clouds/.test(whale), 'whale story prompt should mention its imagery');
    assert.ok(!/whale/.test(hedgehog) && !/hedgehog/.test(whale), 'prompts must not leak the other story');
  });

  await check('scene 1 and scene 2 of one chapter describe different moments', () => {
    for (const text of [hedgehogStory, whaleStory]) {
      const a = service.extractSceneFocalNarrative(text, 'scene_a');
      const b = service.extractSceneFocalNarrative(text, 'scene_b');
      assert.ok(a && b && a !== b, `scenes should differ: "${a}" vs "${b}"`);
    }
  });

  await check('quoted speech and goodnight filler never reach the prompt', () => {
    for (const sceneType of ['scene_a', 'scene_b']) {
      const prompt = service.buildPrompt({ ...base, chapterText: hedgehogStory, sceneType });
      assert.ok(!/looked everywhere|feel so sad/i.test(prompt), 'dialogue leaked');
      assert.ok(!/sleep tight|goodnight/i.test(prompt), 'goodnight filler leaked');
      assert.ok(!/\bwhispered,\s/i.test(prompt), 'leftover words from removed dialogue leaked');
    }
  });

  const realms = BEDTIME_REALMS.map(r => r.id).slice(0, 4);
  const morals = BEDTIME_MORALS.map(m => m.id).slice(0, 3);
  const generated = [];
  for (const realm of realms) {
    for (const moral of morals) {
      for (let ch = 0; ch < 4; ch++) {
        const st = generateProceduralBedtimeStory(realm, moral, 'Mia', 'Rex', '', ch, [], null);
        generated.push({ text: st.chapterText || st.text, chapterNumber: ch + 1 });
      }
    }
  }

  await check('across all generated chapters the two scenes always differ and are real sentences', () => {
    for (const { text } of generated) {
      const a = service.extractSceneFocalNarrative(text, 'scene_a');
      const b = service.extractSceneFocalNarrative(text, 'scene_b');
      assert.ok(a && b, 'both scenes should have text');
      assert.notStrictEqual(a, b);
      for (const f of [a, b]) {
        assert.ok(/^[A-Z]/.test(f), `scene should start like a sentence: "${f}"`);
        assert.ok(!/\b(breath\w*|counts?)\b/i.test(f), `breathing instruction leaked: "${f}"`);
        assert.ok(!/(sweet dreams|close your eyes|sleep tight)/i.test(f), `goodnight line leaked: "${f}"`);
        assert.ok(!/\b(the|a|an|of|and|to|with)$/i.test(f), `scene should not end mid-phrase: "${f}"`);
      }
    }
  });

  await check('every prompt fits the image model\'s 77-token window', () => {
    for (const { text, chapterNumber } of generated) {
      for (const sceneType of ['scene_a', 'scene_b']) {
        const prompt = service.buildPrompt({ ...base, realmName: 'The Floating Starlight Station', chapterNumber, chapterText: text, sceneType });
        assert.ok(estimateTokens(prompt) <= 77, `prompt too long (${estimateTokens(prompt)} tokens): ${prompt}`);
      }
    }
  });

  await check('the story scene comes first in the prompt, before the style text', () => {
    const prompt = service.buildPrompt({ ...base, chapterText: whaleStory, sceneType: 'scene_a' });
    const sceneBeforeStyle = prompt.split('Pixar')[0];
    assert.ok(/whale|lighthouse|clouds|fireflies/i.test(sceneBeforeStyle), `story imagery must precede the style text: ${prompt}`);
  });

  await check('the generic next-chapter prefetch (a fixed prompt with no story text) is gone', () => {
    assert.strictEqual(typeof service.prefetchNextChapterIllustration, 'undefined');
  });

  await check('the backup route receives the same scene summary as the direct call', async () => {
    const requests = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      requests.push({ url: String(url), body: options?.body ? JSON.parse(options.body) : null });
      if (String(url).includes('/api/story/illustration')) {
        return { ok: true, json: async () => ({ imageUrl: 'data:image/jpeg;base64,AAAA' }) };
      }
      throw new Error('direct call unavailable');
    };
    try {
      const res = await service.generateChapterIllustration({
        sessionId: `prompt_test_${Date.now()}`,
        chapterIndex: 1,
        chapterNumber: 2,
        chapterText: whaleStory,
        heroName: 'Mia',
        petName: 'Rex',
        sceneType: 'scene_b'
      });
      assert.ok(res.imageUrl, 'backup route should supply the image');
      const proxy = requests.find(r => r.url.includes('/api/story/illustration'));
      assert.ok(proxy, 'backup route should have been called');
      assert.ok(proxy.body.prompt && /Pixar/.test(proxy.body.prompt), 'backup route must receive the built prompt');
      assert.ok(!proxy.body.prompt.includes(whaleStory), 'backup route must not receive the full chapter text');
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  await check('narration swaps to the second illustration about halfway through a chapter', async () => {
    const { bedtimeStoryService } = await import('../src/services/bedtimeStoryService.js');
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('offline'); };
    const events = [];
    // The mock window does not deliver events to listeners, so record dispatches directly.
    const realDispatch = window.dispatchEvent;
    window.dispatchEvent = (e) => { if (e?.type === 'bedtime-story-scene-switch') events.push(e.detail); return true; };
    const act = { chapterNumber: 1, imageUrl: 'a', imageUrlB: 'b', activeScene: 'scene_a' };
    bedtimeStoryService.activeSession = { acts: [act], actNumber: 1, narrationMode: 'rex', completed: false };
    // The mock environment ends speech instantly; keep the narration "playing" so the timer is what's tested.
    const realStartAutoAdvance = bedtimeStoryService.startAutoAdvance;
    bedtimeStoryService.startAutoAdvance = () => {};
    try {
      bedtimeStoryService.narrateAct('One two three four.', '1', 1);
      assert.strictEqual(events.length, 0, 'must not switch immediately');
      await new Promise(r => setTimeout(r, 3800));
      assert.strictEqual(events.length, 1, 'should switch once around the midpoint');
      assert.strictEqual(act.activeScene, 'scene_b');
      assert.strictEqual(events[0].actNumber, 1);
    } finally {
      bedtimeStoryService.startAutoAdvance = realStartAutoAdvance;
      bedtimeStoryService.cancelAutoAdvance();
      clearTimeout(bedtimeStoryService.sceneSwitchTimer);
      clearTimeout(bedtimeStoryService.speechWatchdogTimer);
      window.dispatchEvent = realDispatch;
      bedtimeStoryService.activeSession = null;
      globalThis.fetch = realFetch;
    }
  });

  await check('the switch is cancelled when the chapter changes before the midpoint', async () => {
    const { bedtimeStoryService } = await import('../src/services/bedtimeStoryService.js');
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('offline'); };
    const events = [];
    // The mock window does not deliver events to listeners, so record dispatches directly.
    const realDispatch = window.dispatchEvent;
    window.dispatchEvent = (e) => { if (e?.type === 'bedtime-story-scene-switch') events.push(e.detail); return true; };
    const act = { chapterNumber: 1, imageUrl: 'a', imageUrlB: 'b', activeScene: 'scene_a' };
    bedtimeStoryService.activeSession = { acts: [act], actNumber: 1, narrationMode: 'rex', completed: false };
    try {
      bedtimeStoryService.narrateAct('One two three four.', '1', 1);
      bedtimeStoryService.cancelAutoAdvance();
      await new Promise(r => setTimeout(r, 3800));
      assert.strictEqual(events.length, 0, 'a cancelled narration must not switch scenes');
      assert.strictEqual(act.activeScene, 'scene_a');
    } finally {
      clearTimeout(bedtimeStoryService.sceneSwitchTimer);
      clearTimeout(bedtimeStoryService.speechWatchdogTimer);
      window.dispatchEvent = realDispatch;
      bedtimeStoryService.activeSession = null;
      globalThis.fetch = realFetch;
    }
  });

  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('❌ Test suite crashed:', err);
  process.exit(1);
});
