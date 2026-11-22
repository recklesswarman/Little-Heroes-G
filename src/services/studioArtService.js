// Small-image helpers for the Parent AI Studio.
//
// The whole household syncs as ONE Firestore document (1 MiB limit), so a full-size AI
// picture (100-300 KB of base64) must never be stored on an item. Everything here turns
// a picture into a small square WebP and, when Cloud Storage is available, keeps only a
// link in the household data.

import { firebaseStorageService } from './firebaseStorageService.js';

/** A raster picture the Studio can keep: a raster data URI or an https URL (not the SVG icon). */
export function isGeneratedPicture(url) {
  const s = String(url || '');
  return /^data:image\/(?:jpeg|png|webp);base64,/i.test(s) || /^https:\/\//i.test(s);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed to load'));
    img.src = src;
  });
}

function sourceToUrl(src) {
  if (typeof Blob !== 'undefined' && src instanceof Blob) return URL.createObjectURL(src);
  return String(src || '');
}

function encode(canvas, type, quality) {
  try {
    return canvas.toDataURL(type, quality);
  } catch {
    return '';
  }
}

/**
 * Turn any image (data URI, https URL or Blob/File) into a small square thumbnail data URI.
 * Cover-fits into size x size. Tries WebP first, then JPEG when the browser can't encode WebP.
 * Resolves '' on any failure so callers keep working with the default icon.
 */
export async function toThumbnail(src, { size = 256, type = 'image/webp', quality = 0.82 } = {}) {
  if (!src || typeof document === 'undefined' || typeof Image === 'undefined') return '';
  const url = sourceToUrl(src);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return '';
    const scale = Math.max(size / w, size / h);
    const dw = w * scale;
    const dh = h * scale;
    ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
    let out = encode(canvas, type, quality);
    if (!out.startsWith(`data:${type}`)) out = encode(canvas, 'image/jpeg', quality);
    return out.startsWith('data:image/') ? out : '';
  } catch {
    return '';
  } finally {
    if (url.startsWith('blob:')) {
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    }
  }
}

/**
 * Prepare a Studio picture for saving on an item.
 * 1. Shrink to a ~256 px WebP (about 10-25 KB).
 * 2. With Cloud Storage and a household code, upload it and return the download URL.
 * 3. Otherwise return the small data URI (small enough to live in the household document).
 * Returns '' when there is nothing usable (callers then use the default icon).
 */
export async function persistStudioImage(dataUri, { itemId, householdCode } = {}) {
  if (!isGeneratedPicture(dataUri)) return '';
  const thumb = await toThumbnail(dataUri);
  if (!thumb) return '';
  const code = String(householdCode || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const id = String(itemId || `item_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    if (code && firebaseStorageService.isReady()) {
      const res = await firebaseStorageService.uploadDataUrl(`households/${code}/studio/${id}.webp`, thumb, {
        customMetadata: { kind: 'studio-prop' }
      });
      if (res && !res.isFallback && /^https:\/\//i.test(res.downloadUrl || '')) return res.downloadUrl;
    }
  } catch (err) {
    console.warn('[studioArt] Storage upload failed, keeping the small picture inline:', err?.message || err);
  }
  return thumb;
}

/** Longest data URI the household document should ever hold for one picture. */
export const MAX_INLINE_PICTURE_CHARS = 60000;
