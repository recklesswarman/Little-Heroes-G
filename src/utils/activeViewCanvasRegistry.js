// Tracks the single canvas-backed view instance (PetSanctuaryCanvas,
// HeroForgeCanvas, PetExpeditionCanvas, PetSkeletalBodyCanvas, ...) that is
// currently alive. main.js replaces app.innerHTML wholesale on every view
// switch, which removes the canvas DOM node but does NOT stop the
// instance's internal requestAnimationFrame loop -- only calling its own
// destroy() does that. Each view already destroys its instance when it
// remounts onto itself; this registry lets main.js also destroy it when
// navigating away to a different view entirely.

let current = null;

export function registerActiveCanvas(instance) {
  if (current && current !== instance && typeof current.destroy === 'function') {
    try {
      current.destroy();
    } catch (e) {
      console.warn('Error destroying previous canvas view instance:', e);
    }
  }
  current = instance || null;
}

export function destroyActiveCanvas() {
  if (current && typeof current.destroy === 'function') {
    try {
      current.destroy();
    } catch (e) {
      console.warn('Error destroying canvas view instance on navigation:', e);
    }
  }
  current = null;
}
