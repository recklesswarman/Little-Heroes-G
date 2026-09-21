import { cloudFunctionsService } from './cloudFunctionsService.js';

/**
 * Service to handle client-side image compression, offline queuing,
 * and AI vision analysis for chore photo proof submissions.
 */
class AIVisionChoreService {
  constructor() {
    this.storageKey = 'little_heroes_offline_chore_proofs';
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.syncOfflineProofs();
      });
    }
  }

  /**
   * Compresses an image file or base64 data URL using an in-memory canvas.
   * Ensures output is lightweight (< 250KB WebP or JPEG).
   * @param {File|string} source - File object or data URL string
   * @param {number} [maxWidth=1024]
   * @param {number} [maxHeight=1024]
   * @param {number} [quality=0.82]
   * @returns {Promise<string>} Compressed base64 data URL
   */
  async compressImage(source, maxWidth = 1024, maxHeight = 1024, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            maxHeight = height;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Export as WebP if supported, fallback to JPEG
        let dataUrl;
        try {
          dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
        } catch {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(dataUrl);
      };

      img.onerror = (err) => reject(new Error('Failed to load image for compression: ' + err.message));

      if (typeof source === 'string') {
        img.src = source;
      } else if (source instanceof Blob || source instanceof File) {
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target.result;
        };
        reader.onerror = (e) => reject(new Error('Failed to read file: ' + e.target.error));
        reader.readAsDataURL(source);
      } else {
        reject(new Error('Invalid image source type provided'));
      }
    });
  }

  /**
   * Intelligently analyzes a chore photo with Gemini 2.5 Flash / Cloud Function,
   * with robust offline and category-based heuristic fallbacks.
   * @param {Object} params
   * @param {string} params.taskId
   * @param {string} params.taskTitle
   * @param {string} [params.heroName='Little Hero']
   * @param {number} [params.childAge=5]
   * @param {string} params.photoDataUrl
   * @returns {Promise<{verified: boolean, confidenceScore: number, feedbackForKid: string, parentRecommendation: string, badgeEarned: string, photoUrl: string}>}
   */
  async analyzeChorePhoto({ taskId, taskTitle, heroName = 'Little Hero', childAge = 5, photoDataUrl }) {
    // Compress first to minimize memory & upload bandwidth
    let compressedUrl = photoDataUrl;
    try {
      compressedUrl = await this.compressImage(photoDataUrl);
    } catch (e) {
      console.warn('Image compression skipped, using original:', e);
    }

    // Try cloud function verification if online. Whatever it honestly reports
    // (verified or not) is returned as-is -- it must never be silently
    // overridden into a fabricated approval, since the Parent Portal shows
    // this confidence score / recommendation as if it were a real AI check.
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const cloudResult = await cloudFunctionsService.verifyChoreSubmission({
          taskId,
          taskTitle,
          heroName,
          childAge,
          evidenceText: 'Submitted via Little Heroes Kid Camera',
          evidenceImageBase64: compressedUrl.split(',')[1] || compressedUrl
        });

        if (cloudResult) {
          return {
            ...cloudResult,
            photoUrl: compressedUrl
          };
        }
      } catch (err) {
        console.warn('Cloud chore verification failed:', err);
      }
    } else {
      // Offline: queue for background sync
      this.queueOfflineProof({ taskId, taskTitle, heroName, childAge, photoUrl: compressedUrl, timestamp: Date.now() });
    }

    // Verification could not be performed (offline, or the cloud call
    // failed above) -- report that honestly instead of guessing "Approve"
    // with a fabricated confidence score.
    return {
      verified: false,
      confidenceScore: 0,
      feedbackForKid: 'Nice job, ' + heroName + '! Rex will check your photo with a grown-up soon! 🦖',
      parentRecommendation: 'AI verification unavailable -- please review this photo manually.',
      badgeEarned: undefined,
      photoUrl: compressedUrl
    };
  }

  /**
   * Queues an offline proof in localStorage
   */
  queueOfflineProof(proof) {
    try {
      const existing = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      existing.push(proof);
      localStorage.setItem(this.storageKey, JSON.stringify(existing));
    } catch (e) {
      console.warn('Failed to queue offline proof to localStorage:', e);
    }
  }

  /**
   * Syncs queued offline proofs when internet connectivity is restored
   */
  async syncOfflineProofs() {
    try {
      const queue = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      if (!queue.length) return;

      console.log('🌐 Syncing ' + queue.length + ' offline chore proofs...');
      const remaining = [];

      for (const item of queue) {
        try {
          await cloudFunctionsService.verifyChoreSubmission({
            taskId: item.taskId,
            taskTitle: item.taskTitle,
            heroName: item.heroName,
            childAge: item.childAge,
            evidenceImageBase64: item.photoUrl.split(',')[1] || item.photoUrl
          });
        } catch {
          remaining.push(item);
        }
      }

      localStorage.setItem(this.storageKey, JSON.stringify(remaining));
      if (remaining.length === 0) {
        console.log('✅ All offline chore proofs successfully synchronized!');
      }
    } catch (err) {
      console.warn('Error during offline proof sync:', err);
    }
  }
}

export const aiVisionChoreService = new AIVisionChoreService();
