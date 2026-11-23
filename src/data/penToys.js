// Starter toys that are always in the Pet Pen toy box (the parent's own Studio toys are added on top).
// Real CC0 models by Kenney, see public/models/LICENSES.md. Playing gives Joy only, with no XP, so it cannot be farmed.
import { THREE_D_ASSETS } from './threeDAssetCatalog.js';

export const STARTER_PEN_TOYS = THREE_D_ASSETS
  .filter((a) => a.category === 'toy' && a.thumbnail)
  .map((a) => ({
    id: `starter_${a.id}`,
    name: a.name,
    desc: a.description,
    emoji: a.emoji,
    modelUrl: a.modelUrl,
    thumbnail: a.thumbnail,
    credit: a.credit,
    isStarter: true,
    statRefillType: 'joy',
    statRefillTarget: 'joy',
    statRefillAmount: 20,
    petVoiceLine: a.defaultVoiceLine
  }));

export function getStarterPenToy(id) {
  return STARTER_PEN_TOYS.find((t) => t.id === id) || null;
}
