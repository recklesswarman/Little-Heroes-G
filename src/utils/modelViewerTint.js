import { getPublicBaseUrl } from './assetUrl.js';

// Recolour and light <model-viewer> models from one place (Studio preview, Shop, gift crates).

export function hexToRgbaArray(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
}

/** Tint the main material of a loaded model. Resolves false when there is nothing to tint. */
export async function tintModelViewer(mv, hex, { mode = 'primary' } = {}) {
  const rgba = hexToRgbaArray(hex);
  if (!mv || !rgba) return false;
  try {
    if (!mv.loaded) {
      await new Promise((resolve) => {
        const done = () => resolve();
        mv.addEventListener('load', done, { once: true });
        setTimeout(done, 8000);
      });
    }
    const mats = (mv.model && mv.model.materials) || [];
    if (!mats.length) return false;
    const plain = mats.filter((m) => !m.pbrMetallicRoughness?.baseColorTexture);
    let targets;
    if (mode === 'all') {
      targets = plain.length ? plain : mats;
    } else {
      const named = mats.find((m) => /body|main|base/i.test(m.name || ''));
      targets = [named || plain[0] || mats[0]];
    }
    targets.forEach((m) => m.pbrMetallicRoughness.setBaseColorFactor(rgba));
    return true;
  } catch {
    return false;
  }
}

/** Tint every model-viewer under root that carries data-tint (run after each render). */
export function applyModelTints(root = document) {
  try {
    root.querySelectorAll('model-viewer[data-tint]').forEach((mv) => {
      if (mv.dataset.tintApplied === mv.dataset.tint) return;
      mv.dataset.tintApplied = mv.dataset.tint;
      tintModelViewer(mv, mv.dataset.tint);
    });
  } catch { /* ignore */ }
}

// Studio and Cozy use real HDRI lighting from public/hdri/ (CC0, Poly Haven). Sunny uses a bright clear-sky HDRI too.
// No ?v= suffix here: model-viewer picks the HDR loader from the .hdr file name.
const hdri = (name) => `${getPublicBaseUrl()}hdri/${name}.hdr`;

export const LIGHTING_PRESETS = {
  studio: { label: 'Studio', env: hdri('studio'), exposure: '1' },
  sunny: { label: 'Sunny', env: hdri('sunny'), exposure: '1.1' },
  forest: { label: 'Forest', env: hdri('forest'), exposure: '1.5' },
  cozy: { label: 'Cozy', env: hdri('cozy'), exposure: '0.9' }
};

/** Attributes for <model-viewer> that set the item's lighting. Unknown values use the default. */
export function modelViewerLightingAttrs(lighting) {
  const p = LIGHTING_PRESETS[lighting] || LIGHTING_PRESETS.studio;
  return `environment-image="${p.env}" exposure="${p.exposure}"`;
}
