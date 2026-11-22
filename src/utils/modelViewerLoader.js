// Loads Google's <model-viewer> web component from our own bundle (not Google's CDN),
// and only the first time a page actually shows a 3D model.
let pending = null;

export function ensureModelViewer() {
  if (typeof window === 'undefined' || typeof customElements === 'undefined') return Promise.resolve(false);
  if (customElements.get('model-viewer')) return Promise.resolve(true);
  if (!pending) {
    pending = import('@google/model-viewer')
      .then(() => true)
      .catch((err) => {
        pending = null; // allow a retry on the next render
        console.warn('[model-viewer] could not load:', err?.message || err);
        return false;
      });
  }
  return pending;
}

/** Call after a render: loads the component only if the page contains a <model-viewer>. */
export function ensureModelViewerIfUsed(root = document) {
  try {
    if (root.querySelector && root.querySelector('model-viewer')) return ensureModelViewer();
  } catch { /* ignore */ }
  return Promise.resolve(false);
}
