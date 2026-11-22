// One call gives the same feedback on Studio Publish, Shop Buy and crate open: sound, animation, item-shaped confetti.
import { Sound } from '../audio/sfx.js';
import { store } from '../state/store.js';
import { burstForItem } from '../utils/itemConfetti.js';

const RARE = new Set(['rare', 'epic', 'legendary']);

export function celebrateItem(item, { event = 'publish', origin } = {}) {
  try {
    const rare = RARE.has(String(item?.rarity || '').toLowerCase());
    if (event === 'buy') Sound.coin?.();
    else if (event === 'unbox') (rare ? Sound.fanfare : Sound.sparkle)?.();
    else Sound.fanfare?.();
    store.celebrate(event === 'buy' ? 'coins' : rare ? 'trophy' : 'confetti');
    burstForItem(item || {}, origin);
  } catch { /* celebration must never break a reward flow */ }
}
