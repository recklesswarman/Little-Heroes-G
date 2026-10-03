/**
 * Shared image-upload pipeline: read a File, decode it, then draw it onto a
 * canvas to resize/compress before storing it as a JPEG data URL (keeps
 * payloads small for localStorage/Firestore instead of storing a raw,
 * multi-megabyte camera photo).
 */
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No file selected.'));
    }

    if (!file.type || !file.type.startsWith('image/')) {
      return reject(new Error('Please select an image file (JPEG, PNG, WEBP).'));
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unable to parse the selected image file.'));
      img.src = event.target?.result;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read the selected file.'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Crops to a centered square and compresses to a compact JPEG data URL (e.g.
 * 256x256) -- used for profile avatars, where a uniform square thumbnail is
 * wanted regardless of the source photo's shape.
 */
export function processProfilePhoto(file, maxDimension = 256, quality = 0.85) {
  return loadImageFromFile(file).then((img) => {
    const width = img.width;
    const height = img.height;
    const minSide = Math.min(width, height);
    const sourceX = (width - minSide) / 2;
    const sourceY = (height - minSide) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = maxDimension;
    canvas.height = maxDimension;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context could not be created.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(img, sourceX, sourceY, minSide, minSide, 0, 0, maxDimension, maxDimension);

    return canvas.toDataURL('image/jpeg', quality);
  });
}

/**
 * Downscales (never upscales) so the longer side fits within maxDimension,
 * preserving the original aspect ratio and full frame -- used for chore
 * proof photos, where cropping to a square could cut off the very thing a
 * parent needs to see to approve the chore.
 */
export function processPhotoFitWithinBounds(file, maxDimension = 1280, quality = 0.85) {
  return loadImageFromFile(file).then((img) => {
    const { width, height } = img;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context could not be created.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    return canvas.toDataURL('image/jpeg', quality);
  });
}
