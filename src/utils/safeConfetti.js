import confetti from 'canvas-confetti';

// canvas-confetti needs a live `document` (it manages its own internal
// <canvas>), so any call site that might run before the DOM is ready, or in
// a non-browser context, used to repeat the same
// `typeof confetti === 'function' && typeof document !== 'undefined' &&
// document.body` guard plus a try/catch around it. This is that check, once.
export function safeConfetti(options) {
  try {
    if (typeof confetti === 'function' && typeof document !== 'undefined' && document.body) {
      confetti(options);
    }
  } catch (e) {}
}
