/**
 * Utility for handling user profile photo uploads.
 * Crops to a centered square and compresses to a compact JPEG data URL (e.g. 256x256),
 * ensuring fast loading, low memory usage, and seamless storage in localStorage/Firestore.
 */
export function processProfilePhoto(file, maxDimension = 256, quality = 0.85) {
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

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const width = img.width;
          const height = img.height;

          // Perform center-square crop
          const minSide = Math.min(width, height);
          const sourceX = (width - minSide) / 2;
          const sourceY = (height - minSide) / 2;

          canvas.width = maxDimension;
          canvas.height = maxDimension;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Canvas context could not be created.'));
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Draw the centered square cropped image
          ctx.drawImage(
            img,
            sourceX,
            sourceY,
            minSide,
            minSide,
            0,
            0,
            maxDimension,
            maxDimension
          );

          // Convert to efficient JPEG Data URL
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => {
        reject(new Error('Unable to parse the selected image file.'));
      };

      img.src = event.target?.result;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read the selected file.'));
    };

    reader.readAsDataURL(file);
  });
}
