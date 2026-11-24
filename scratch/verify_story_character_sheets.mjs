// Story character sheets: one picture per kid of hero + companion, drawn once on the image Worker,
// kept on the device and sent as a reference with every story picture.
import './setup_mock_env.js';
import assert from 'node:assert/strict';
import {
  HAIR_LOOKS, PET_SKINS, heroHairFor, petSkinFor, characterSheetSignature, characterSheetSeed,
  characterSheetPrompt, characterSheetShortPrompt
} from '../shared/storyEngine/characterSheet.js';
import { buildRequest } from '../shared/storyEngine/engine.js';
import { buildScenePlan } from '../shared/storyEngine/scenes.js';
import { ensureCharacterSheet, getCharacterSheet, getSavedSheetInfo, sheetPromptFields } from '../src/services/characterSheetService.js';
import { bedtimeStoryService } from '../src/services/bedtimeStoryService.js';
import { store } from '../src/state/store.js';
import { renderProfileView } from '../src/views/ProfileView.js';

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✅ ${name}`); } catch (err) { failures++; console.error(`  ❌ ${name}\n     ${err.stack || err.message}`); }
}

const look = { heroId: 'hero_milo', heroLook: 'in a green dragon-hood explorer outfit', petId: '1', petSpecies: 'T-Rex' };
const fakeImage = (tag) => `data:image/jpeg;base64,${Buffer.from(`${tag}-`.repeat(400)).toString('base64')}`;

await test('fixed look per kid: hair, pet colour, seed and prompt', () => {
  assert.ok(HAIR_LOOKS.includes(heroHairFor('hero_milo')));
  assert.equal(heroHairFor('hero_milo'), heroHairFor('hero_milo'));
  assert.ok(PET_SKINS.includes(petSkinFor('hero_milo', '1')));
  const sig = characterSheetSignature(look);
  assert.notEqual(sig, characterSheetSignature({ ...look, heroLook: 'in a golden lion-mane hood' }), 'new avatar, new sheet');
  assert.notEqual(sig, characterSheetSignature({ ...look, petId: '2' }), 'new pet, new sheet');
  assert.equal(characterSheetSeed(sig), characterSheetSeed(sig));
  assert.notEqual(characterSheetSeed(sig, 0), characterSheetSeed(sig, 1));
  const prompt = characterSheetPrompt(look);
  assert.ok(prompt.includes(heroHairFor('hero_milo')) && prompt.includes('dragon-hood') && prompt.includes('t-rex'));
  assert.ok(!/milo/i.test(prompt), 'no names in the prompt');
  assert.ok(prompt.length < 2000);
  assert.ok(characterSheetShortPrompt(look).split(/\s+/).length < 40);
});

await test('stories use the same hair and pet colour as the sheet', () => {
  const fields = sheetPromptFields(look);
  const req = buildRequest({ heroName: 'Milo', petSpecies: 'T-Rex', ...fields, heroHair2: 'x' });
  assert.equal(req.heroHair, fields.heroHair);
  assert.equal(req.petSkin, fields.petSkin);
  assert.equal(buildRequest({ heroName: 'K', heroHair: 'bright pink hair' }).heroHair, '', 'only the fixed choices');
  const bible = { title: 'A Night Trip', characters: [{ name: 'Milo', role: 'hero' }, { name: 'Rex', role: 'companion' }] };
  const chapterText = 'Milo and Rex walked through the glowing forest to the lake. They found a lantern by the water.';
  const plan = JSON.stringify(buildScenePlan({ chapterText, bible, request: req, chapterIndex: 0 }));
  assert.ok(plan.includes(fields.heroHair), 'scene prompt uses the sheet hair');
  assert.ok(plan.includes(fields.petSkin), 'scene prompt uses the sheet pet colour');
});

await test('drawn once on the Worker, kept on the device, redrawn on request or a new look', async () => {
  localStorage.clear();
  const calls = [];
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push(body);
    return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({ dataUri: fakeImage(`full${calls.length}`) }) };
  };
  const shrink = async (u) => u.replace('full', 'small');
  const a = await ensureCharacterSheet(look, { fetchImpl, shrink, now: () => 1000 });
  assert.ok(a.includes('data:image/jpeg'));
  assert.equal(calls.length, 1);
  assert.ok(calls[0].prompt.includes('Character reference sheet') && calls[0].seed > 0 && !calls[0].referenceImages);
  assert.equal(getCharacterSheet(look), a);
  assert.equal(await ensureCharacterSheet(look, { fetchImpl, shrink }), a, 'cached');
  assert.equal(calls.length, 1);
  assert.equal(getCharacterSheet({ ...look, heroLook: 'in a golden lion-mane hood' }), '', 'look changed');
  assert.ok(getSavedSheetInfo('hero_milo').createdAt === 1000);
  const b = await ensureCharacterSheet(look, { redraw: true, fetchImpl, shrink });
  assert.notEqual(b, a);
  assert.notEqual(calls[1].seed, calls[0].seed, 'redraw uses a new seed');
  const failed = await ensureCharacterSheet({ ...look, heroId: 'hero_nova' }, { fetchImpl: async () => ({ ok: false }), shrink });
  assert.equal(failed, '');
  assert.equal(getSavedSheetInfo('hero_nova'), null);
  assert.equal(await ensureCharacterSheet(look, { fetchImpl: async () => { throw new Error('offline'); }, shrink, redraw: true }), '', 'never throws');
  assert.equal(getCharacterSheet(look), b, 'a failed redraw keeps the old sheet');
});

await test('story pictures send the sheet (chapter 1) and the sheet + first picture (chapter 2 on)', () => {
  const hero = store.getState().selectedHero;
  const session = { heroId: hero.id, petId: '1', petName: 'Rex', childContext: { activePet: { name: 'Rex the T-Rex' } }, acts: [] };
  localStorage.clear();
  assert.deepEqual(bedtimeStoryService.storyReferenceImages(session, 1), [], 'nothing yet');
  const sheet = fakeImage('sheet');
  const sheetLookNow = bedtimeStoryService.sheetLookFor(session);
  localStorage.setItem(`lh_story_sheet_${hero.id}`, JSON.stringify({ signature: characterSheetSignature(sheetLookNow), image: sheet }));
  assert.deepEqual(bedtimeStoryService.storyReferenceImages(session, 1), [sheet]);
  const first = fakeImage('page1');
  session.acts = [{ imageUrl: first }];
  assert.deepEqual(bedtimeStoryService.storyReferenceImages(session, 2), [sheet, first]);
  const body = bedtimeStoryService.buildStoryRequestBody(session, 1, '', { realm: { id: 'space' }, moral: { id: 'kindness' } });
  assert.equal(body.heroHair, heroHairFor(hero.id));
  assert.equal(body.petSkin, petSkinFor(hero.id, '1'));
});

await test('Profile shows the Story look card with a draw button', () => {
  const hero = store.getState().selectedHero;
  localStorage.clear();
  let html = renderProfileView();
  assert.ok(html.includes('data-story-sheet') && html.includes('Draw my story look'));
  const pet = { id: String(hero.activePetId || '1') };
  const sig = characterSheetSignature(bedtimeStoryService.sheetLookFor({ heroId: hero.id, petId: pet.id, childContext: { activePet: { name: '' } } }));
  // The Profile reads the same look as the story service for the default pet.
  const image = fakeImage('profile');
  localStorage.setItem(`lh_story_sheet_${hero.id}`, JSON.stringify({ signature: sig, image }));
  html = renderProfileView();
  assert.ok(html.includes('data-story-sheet-img') || html.includes('next story draws a new look'));
});

if (failures) {
  console.error(`\n❌ ${failures} story character sheet check(s) failed`);
  process.exit(1);
}
console.log('\n✅ Story character sheet checks passed');
