// Small <model-viewer> used inside tiles (Hero HQ slots, Pet Pen toys). Same lighting, tint and idle animation as the Shop.
import { escapeHtml } from './escapeHtml.js';
import { safeImageUrl } from './safeImageUrl.js';
import { modelViewerLightingAttrs } from './modelViewerTint.js';

export function renderInlineModel(item, { style = 'width:100%;height:60px;background:transparent;', controls = true } = {}) {
  const src = safeImageUrl(item?.modelUrl || '');
  if (!src) return '';
  const poster = safeImageUrl(item.thumbnail || item.image || '');
  const tint = /^#[0-9a-f]{6}$/i.test(item.modelTint || '') ? ` data-tint="${item.modelTint}"` : '';
  const idle = item.animations && /^[A-Za-z0-9_ -]{1,40}$/.test(item.animations.idle || '')
    ? ` autoplay animation-name="${escapeHtml(item.animations.idle)}"` : '';
  return `<model-viewer src="${escapeHtml(src)}" alt="${escapeHtml(item.name || 'Model')}" ${poster ? `poster="${escapeHtml(poster)}"` : ''} loading="lazy" auto-rotate${controls ? ' camera-controls' : ''} shadow-intensity="1" interaction-prompt="none" ${modelViewerLightingAttrs(item.lighting)}${tint}${idle} style="${escapeHtml(style)}"></model-viewer>`;
}
