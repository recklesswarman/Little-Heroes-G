// "Design your hero": kid avatars drawn by DiceBear (MIT code) right in the browser, no server.
// Styles and their licenses (credited on the Profile screen):
//   adventurer  Lisa Wischofsky, CC BY 4.0      big-smile  Ashley Seo, CC BY 4.0
//   fun-emoji   Davis Uche, CC BY 4.0           bottts     Pablo Stanley, free for personal use
//   pixel-art   DiceBear, CC0
// The picture is saved as a small SVG data URL on the hero (hero.avatar), plus the style and
// seed (hero.avatarDesign) so the kid can come back and keep tweaking.
import { createAvatar } from '@dicebear/core';
import * as adventurer from '@dicebear/adventurer';
import * as bigSmile from '@dicebear/big-smile';
import * as funEmoji from '@dicebear/fun-emoji';
import * as bottts from '@dicebear/bottts';
import * as pixelArt from '@dicebear/pixel-art';

export const AVATAR_STYLES = Object.freeze([
  { id: 'adventurer', label: 'Adventurer', emoji: '🧭', style: adventurer, credit: '"Adventurer" by Lisa Wischofsky, CC BY 4.0' },
  { id: 'big-smile', label: 'Big Smile', emoji: '😁', style: bigSmile, credit: '"Big Smile" by Ashley Seo, CC BY 4.0' },
  { id: 'fun-emoji', label: 'Fun Emoji', emoji: '🤪', style: funEmoji, credit: '"Fun Emoji" by Davis Uche, CC BY 4.0' },
  { id: 'bottts', label: 'Robot', emoji: '🤖', style: bottts, credit: '"Bottts" by Pablo Stanley, free for personal use' },
  { id: 'pixel-art', label: 'Pixel', emoji: '👾', style: pixelArt, credit: '"Pixel Art" by DiceBear, CC0' }
]);

export const AVATAR_BACKGROUNDS = Object.freeze(['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 'c1f4c5']);

const toBase64 = (text) => (typeof Buffer !== 'undefined'
  ? Buffer.from(text, 'utf8').toString('base64')
  : btoa(String.fromCharCode(...new TextEncoder().encode(text))));

/** One avatar as an SVG data URL (base64, so it passes safeImageUrl and the fridge filter). */
export function heroAvatarDataUrl({ style = 'adventurer', seed = 'hero', background = AVATAR_BACKGROUNDS[0] } = {}) {
  const entry = AVATAR_STYLES.find((s) => s.id === style) || AVATAR_STYLES[0];
  const bg = AVATAR_BACKGROUNDS.includes(background) ? background : AVATAR_BACKGROUNDS[0];
  const svg = createAvatar(entry.style, { seed: String(seed).slice(0, 40), backgroundColor: [bg], radius: 50 }).toString();
  return `data:image/svg+xml;base64,${toBase64(svg)}`;
}

/** Six fresh choices for a style: seeds built from the kid's name and a roll number. */
export function avatarChoices(name = 'hero', style = 'adventurer', roll = 0, count = 6) {
  return Array.from({ length: count }, (_, i) => {
    const seed = `${String(name).slice(0, 20)}-${roll}-${i}`;
    const background = AVATAR_BACKGROUNDS[(roll + i) % AVATAR_BACKGROUNDS.length];
    return { style, seed, background, url: heroAvatarDataUrl({ style, seed, background }) };
  });
}
