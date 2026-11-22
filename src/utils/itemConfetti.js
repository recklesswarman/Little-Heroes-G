// Confetti in the shape of the item itself (emoji or a simple star/gem path). Lazy-loaded, skipped with reduced motion.
const CATEGORY_COLORS = {
  weapons: ['#06b6d4', '#3b82f6', '#fbbf24'],
  loot: ['#fbbf24', '#10b981', '#06b6d4'],
  snacks: ['#f97316', '#10b981', '#fbbf24'],
  badges: ['#fbbf24', '#3b82f6'],
  trophies: ['#fbbf24', '#f59e0b']
};
const shapeCache = new Map();

function prefersReducedMotion() {
  try { return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export function confettiColorsFor(item) {
  if (item && /^#[0-9a-f]{6}$/i.test(item.modelTint || '')) return [item.modelTint, '#fbbf24'];
  return CATEGORY_COLORS[String(item?.category || '').toLowerCase()] || ['#fbbf24', '#06b6d4', '#10b981'];
}

/** Burst confetti shaped like the item. origin is { x, y } in 0..1 (defaults to the middle). */
export async function burstForItem(item, origin = { x: 0.5, y: 0.6 }) {
  if (typeof document === 'undefined' || prefersReducedMotion()) return false;
  try {
    const confetti = (await import('canvas-confetti')).default;
    const colors = confettiColorsFor(item);
    const options = { particleCount: 60, spread: 70, origin, colors, disableForReducedMotion: true, scalar: 1.4 };
    const emoji = item && item.emoji ? String(item.emoji) : '';
    if (emoji && typeof confetti.shapeFromText === 'function') {
      if (!shapeCache.has(emoji)) shapeCache.set(emoji, confetti.shapeFromText({ text: emoji, scalar: 2 }));
      options.shapes = [shapeCache.get(emoji)];
      options.scalar = 2;
    } else {
      options.shapes = ['star'];
    }
    confetti(options);
    return true;
  } catch {
    return false;
  }
}
