// Story character sheets: one picture per kid of their hero and companion, standing side by side.
// The picture is drawn once on the free image Worker (Cloudflare Workers AI, FLUX), kept on the
// device, and sent as a reference with every story picture (FLUX.2 klein), so the hero has the
// same face, hair and outfit in every story, not only within one story.
//
// The look is fixed per kid: hair and pet colour are picked from the hero id (not the story), and
// the picture seed comes from the same id, so another device draws (nearly) the same sheet.
// Pure, no I/O: used by the browser (src/services/characterSheetService.js) and the story engine.
import { hashString } from './seeds.js';
import { detailedLook, DEFAULT_HERO_LOOK_DETAILED } from './avatarLook.js';

export const HAIR_LOOKS = ['short wavy brown hair', 'soft curly dark hair', 'short ginger hair', 'straight black hair'];
export const PET_SKINS = ['soft emerald green', 'warm amber orange', 'gentle teal', 'sunny golden yellow'];

const clean = (v, max = 40) => String(v || '').replace(/[^A-Za-z0-9 '\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** The kid's fixed hair look, from their hero id. */
export function heroHairFor(heroId) {
  return HAIR_LOOKS[hashString(`hair|${heroId || 'hero'}`) % HAIR_LOOKS.length];
}

/** The companion's fixed colour, from the hero id and the pet. */
export function petSkinFor(heroId, petId = '') {
  return PET_SKINS[hashString(`skin|${heroId || 'hero'}|${petId || 'pet'}`) % PET_SKINS.length];
}

/** Hair / pet colour from a request, only when it is one of the fixed choices (else ''). */
export const pickHair = (v) => (HAIR_LOOKS.includes(v) ? v : '');
export const pickSkin = (v) => (PET_SKINS.includes(v) ? v : '');

/**
 * What the sheet depends on. When any of it changes (new avatar, new pet), the sheet is drawn again.
 * { heroId, heroLook, petId, petSpecies } -> short string.
 */
export function characterSheetSignature({ heroId = '', heroLook = '', petId = '', petSpecies = '' } = {}) {
  return `v1|${clean(heroId, 60)}|${clean(heroLook, 60)}|${clean(petId, 30)}|${clean(petSpecies, 30)}`.toLowerCase();
}

/** Picture seed for the sheet (same on every device for the same kid and look). */
export function characterSheetSeed(signature, attempt = 0) {
  return (hashString(`${signature}|${attempt}`) % 2147483646) + 1;
}

/** The FLUX prompt for one kid's sheet. No names, no photos: only the fixed look words. */
export function characterSheetPrompt({ heroId = '', heroLook = '', petId = '', petSpecies = '' } = {}) {
  const outfit = detailedLook(heroLook) || (heroLook ? clean(heroLook, 80) : DEFAULT_HERO_LOOK_DETAILED);
  const species = clean(petSpecies, 30).toLowerCase() || 'baby dinosaur';
  return [
    'Character reference sheet for a children\'s bedtime storybook, soft 3D clay toy art style like a gentle animated film.',
    `On the left, a cheerful young child with ${heroHairFor(heroId)}, round rosy cheeks and a big happy smile, ${outfit}, standing and facing the viewer, full body, head to toe.`,
    `On the right, their best friend, a cute small ${species} with ${petSkinFor(heroId, petId)} skin and a soft cream belly, big kind eyes, standing and facing the viewer, full body.`,
    'Both are fully visible, side by side, evenly lit, plain warm cream background, no scenery, no text, no letters.',
    'Calm cozy colours: blues, greens, warm yellows and creams, no pink or purple.'
  ].join(' ');
}

/** Short version for the SDXL fallbacks (they read ~77 tokens). */
export function characterSheetShortPrompt({ heroId = '', heroLook = '', petSpecies = '' } = {}) {
  const species = clean(petSpecies, 30).toLowerCase() || 'baby dinosaur';
  return `3D clay storybook character sheet, happy child with ${heroHairFor(heroId)} ${clean(heroLook, 50) || 'in cozy pajamas'}, beside a cute ${species}, full body, plain cream background`;
}
