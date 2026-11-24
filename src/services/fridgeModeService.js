// Fridge mode: a per-device switch (top header 🧊 button) that turns this tablet into the
// Fridge Display. It is saved on this device only, so the kitchen tablet stays a fridge board
// after a reload or restart while the kids' tablets keep the normal app.
export const FRIDGE_MODE_KEY = 'lh_fridge_mode';

function storage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

/** True when this device was switched to fridge mode. */
export function isFridgeMode() {
  try { return storage()?.getItem(FRIDGE_MODE_KEY) === 'on'; } catch { return false; }
}

/** Turns fridge mode on or off for this device. Returns the new state. */
export function setFridgeMode(on) {
  try {
    const s = storage();
    if (on) s?.setItem(FRIDGE_MODE_KEY, 'on');
    else s?.removeItem(FRIDGE_MODE_KEY);
  } catch { /* private window: works until reload */ }
  return Boolean(on);
}
