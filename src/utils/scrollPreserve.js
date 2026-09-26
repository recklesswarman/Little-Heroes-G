// This app fully re-renders each view/modal's DOM on every store update
// (an approval, a background sync tick, selecting an option -- anything).
// A freshly-created DOM node always starts at scroll position 0, so any
// scrollable tab/pill strip or list would otherwise snap back to the start
// the instant any unrelated state change re-renders it while it's open --
// looking stuck / like scrolling doesn't work.
//
// Call this once per render, right after the container's markup has been
// attached to the DOM, for every element that scrolls (overflow-x-auto or
// overflow-y-auto). It restores whatever position was last recorded for
// that container id and keeps tracking it going forward.
const scrollPositions = {};

export function preserveScrollPosition(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const saved = scrollPositions[containerId];
  if (saved) {
    if (typeof saved.left === 'number') el.scrollLeft = saved.left;
    if (typeof saved.top === 'number') el.scrollTop = saved.top;
  }
  el.addEventListener(
    'scroll',
    () => {
      scrollPositions[containerId] = { left: el.scrollLeft, top: el.scrollTop };
    },
    { passive: true }
  );
}
