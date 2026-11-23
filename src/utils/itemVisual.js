// One place decides what an item shows, so the Studio preview and the Shop card never drift apart.
// Order: real 3D model -> picture -> OpenMoji art -> game-icons art -> existing SVG art.
import { escapeHtml } from './escapeHtml.js';
import { safeImageUrl } from './safeImageUrl.js';
import { getRewardAssetUrl } from './rewardGraphics.js';
import { emojiArtUrl } from './emojiArt.js';
import { gameIconFor, gameIconUrl } from './gameIcons.js';
import { modelViewerLightingAttrs } from './modelViewerTint.js';

const SIZES = { card: 'w-12 h-12', detail: 'w-40 h-40', studio: 'w-full h-full' };

export function renderItemVisual(item, { size = 'card' } = {}) {
  const cls = SIZES[size] || SIZES.card;
  const alt = escapeHtml(item?.title || item?.name || 'Reward');
  const model = safeImageUrl(item?.modelUrl || '');
  if (model && size !== 'card') {
    const tint = /^#[0-9a-f]{6}$/i.test(item.modelTint || '') ? ` data-tint="${item.modelTint}"` : '';
    const poster = safeImageUrl(item.image || '');
    const idle = item.animations && /^[A-Za-z0-9_ -]{1,40}$/.test(item.animations.idle || '') ? ` autoplay animation-name="${escapeHtml(item.animations.idle)}"` : '';
    return `<model-viewer src="${escapeHtml(model)}" alt="${alt}" ${poster ? `poster="${escapeHtml(poster)}"` : ''} loading="lazy" auto-rotate camera-controls ${modelViewerLightingAttrs(item.lighting)}${tint}${idle} class="${cls}"></model-viewer>`;
  }
  const picture = safeImageUrl(item?.image || '');
  if (picture) return `<img src="${escapeHtml(picture)}" alt="${alt}" class="${cls} object-contain" />`;
  const openmoji = item?.emoji ? emojiArtUrl(item.emoji) : '';
  if (openmoji) return `<img src="${escapeHtml(openmoji)}" alt="${escapeHtml(item.emoji)}" class="${cls} object-contain" />`;
  const icon = gameIconUrl(gameIconFor(item?.iconId, item?.category));
  if (icon) return `<img src="${escapeHtml(icon)}" alt="${alt}" class="${cls} object-contain" />`;
  return `<img src="${escapeHtml(getRewardAssetUrl(item?.id, item?.category))}" alt="${alt}" class="${cls} object-contain" />`;
}
