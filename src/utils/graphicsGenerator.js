// 3D Graphic & Icon Generator for Little Heroes
// Produces chunky, high-contrast, tactile 3D SVG icons matching the dark green, blue, yellow, and orange theme (strict: NO pink/purple).
// 100% graphical/visual vector art without any text tags so toddlers can easily identify tasks.

import { getTaskVisualDataUrl } from './taskVisuals.js';

export function generate3DIcon(iconName, bgTheme = 'green', label = '') {
  return getTaskVisualDataUrl(iconName || label, bgTheme);
}

