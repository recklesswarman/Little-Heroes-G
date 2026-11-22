// OpenMoji art for emoji, so Stickers and Snacks look the same on every device.
// Only the emoji listed in OPENMOJI_AVAILABLE ship with the app; anything else keeps the plain emoji.
import { resolvePublicAssetUrl } from './assetUrl.js';

export const OPENMOJI_AVAILABLE = new Set([
  '1F308', '1F30A', '1F31F', '1F33D', '1F347', '1F349', '1F34A', '1F34C', '1F34E', '1F353', '1F36A', '1F36D',
  '1F36F', '1F381', '1F3AF', '1F3C6', '1F3F9', '1F409', '1F422', '1F430', '1F431', '1F436', '1F451', '1F48E',
  '1F525', '1F680', '1F6E1', '1F916', '1F955', '1F95B', '1F95C', '1F95D', '1F966', '1F981', '1F984', '1F98A',
  '1F995', '1F996', '1F9C0', '1F9C1', '1F9C3', '1F9D6', '1F9F8', '2694', '2B50'
]);

/** '🍎' -> '1F34E' (uppercase hex, '-' joined, FE0F dropped as OpenMoji names its files). */
export function emojiHexcode(emoji) {
  return Array.from(String(emoji || ''))
    .map((ch) => ch.codePointAt(0))
    .filter((cp) => cp !== 0xFE0F && cp !== 0x200D)
    .map((cp) => cp.toString(16).toUpperCase())
    .join('-');
}

/** URL of the OpenMoji SVG for an emoji, or '' when we don't ship one. */
export function emojiArtUrl(emoji) {
  const hex = emojiHexcode(emoji);
  return OPENMOJI_AVAILABLE.has(hex) ? resolvePublicAssetUrl(`assets/icons/openmoji/${hex}.svg`) : '';
}
