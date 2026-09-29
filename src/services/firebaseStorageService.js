/**
 * Little Heroes Adventures - Cloud Storage Service
 * 
 * Direct Firebase Storage & Google Cloud Storage SDK integration for:
 * - Chore completion photo proofs
 * - Hero avatars & toddler drawings
 * - Bedtime stories, illustrations & lullaby audio assets
 * 
 * Includes offline resilience, upload progress callbacks, metadata attribution,
 * and automatic fallbacks to preserve seamless toddler/parent UX.
 */

import {
  ref,
  uploadBytes,
  uploadBytesResumable,
  uploadString,
  getDownloadURL,
  deleteObject,
  listAll,
  getMetadata
} from "firebase/storage";
import { storage, isStorageAvailable, firebaseConfig } from "../config/firebase.js";

// Attribution tag for Google Cloud Storage operations
const STORAGE_ATTRIBUTION_METADATA = {
  agent: "gcs-skills/1.0",
  skill: "google-cloud-storage-basics",
  app: "little-heroes-adventures",
  version: "1.0.0"
};

class FirebaseStorageService {
  constructor() {
    this.storage = storage;
    this.isAvailable = isStorageAvailable && !!this.storage;
    this.bucketName = firebaseConfig?.storageBucket || "little-heroes-quest-8842.firebasestorage.app";
    this.memoryCache = new Map();
  }

  /**
   * Check if Cloud Storage is ready and available
   * @returns {boolean}
   */
  isReady() {
    return !!this.storage;
  }

  /**
   * Create a storage reference
   * @param {string} path - Storage path (e.g., 'households/abc/chores/123.webp')
   * @returns {StorageReference|null}
   */
  getRef(path) {
    if (!this.storage) {
      console.warn(`[FirebaseStorage] Storage not initialized for path: ${path}`);
      return null;
    }
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return ref(this.storage, cleanPath);
  }

  /**
   * Upload a File or Blob with optional progress tracking
   * @param {string} path - Target storage path
   * @param {Blob|File} fileOrBlob - File or Blob object
   * @param {Object} [options] - Options including metadata and onProgress callback
   * @returns {Promise<{ downloadUrl: string, fullPath: string, size: number, name: string }>}
   */
  async uploadFile(path, fileOrBlob, options = {}) {
    const { onProgress, metadata = {} } = options;
    const storageRef = this.getRef(path);

    if (!storageRef) {
      console.warn(`[FirebaseStorage] Storage unavailable. Using local fallback for ${path}`);
      return this._handleFallbackUpload(path, fileOrBlob);
    }

    const mergedMetadata = {
      contentType: fileOrBlob.type || 'application/octet-stream',
      customMetadata: {
        ...STORAGE_ATTRIBUTION_METADATA,
        ...(metadata.customMetadata || {}),
        uploadedAt: new Date().toISOString()
      },
      ...metadata
    };

    try {
      if (typeof onProgress === 'function') {
        const uploadTask = uploadBytesResumable(storageRef, fileOrBlob, mergedMetadata);

        return new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              onProgress({
                progress: Math.round(progress),
                bytesTransferred: snapshot.bytesTransferred,
                totalBytes: snapshot.totalBytes,
                state: snapshot.state
              });
            },
            (error) => {
              console.error(`[FirebaseStorage] Resumable upload failed for ${path}:`, error);
              resolve(this._handleFallbackUpload(path, fileOrBlob));
            },
            async () => {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve({
                downloadUrl,
                fullPath: uploadTask.snapshot.ref.fullPath,
                name: uploadTask.snapshot.ref.name,
                size: uploadTask.snapshot.totalBytes
              });
            }
          );
        });
      } else {
        const snapshot = await uploadBytes(storageRef, fileOrBlob, mergedMetadata);
        const downloadUrl = await getDownloadURL(snapshot.ref);
        return {
          downloadUrl,
          fullPath: snapshot.ref.fullPath,
          name: snapshot.ref.name,
          size: snapshot.metadata.size
        };
      }
    } catch (err) {
      console.error(`[FirebaseStorage] Upload failed for ${path}:`, err);
      return this._handleFallbackUpload(path, fileOrBlob);
    }
  }

  /**
   * Upload a base64 / data-url string directly to Cloud Storage
   * @param {string} path - Target storage path
   * @param {string} dataUrl - 'data:image/webp;base64,...' or raw base64 string
   * @param {Object} [options] - Optional custom metadata
   * @returns {Promise<{ downloadUrl: string, fullPath: string }>}
   */
  async uploadDataUrl(path, dataUrl, options = {}) {
    const storageRef = this.getRef(path);

    if (!storageRef || !dataUrl) {
      console.warn(`[FirebaseStorage] Storage unavailable or invalid data URL for ${path}`);
      return {
        downloadUrl: dataUrl,
        fullPath: path,
        isFallback: true
      };
    }

    try {
      // Determine format
      const isDataUrl = dataUrl.startsWith('data:');
      const format = isDataUrl ? 'data_url' : 'base64';

      // Detect MIME type from header if data URL
      let contentType = 'image/webp';
      if (isDataUrl) {
        const match = dataUrl.match(/^data:([^;]+);/);
        if (match) contentType = match[1];
      }

      const metadata = {
        contentType,
        customMetadata: {
          ...STORAGE_ATTRIBUTION_METADATA,
          ...(options.customMetadata || {}),
          uploadedAt: new Date().toISOString()
        }
      };

      const snapshot = await uploadString(storageRef, dataUrl, format, metadata);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      return {
        downloadUrl,
        fullPath: snapshot.ref.fullPath,
        name: snapshot.ref.name,
        isFallback: false
      };
    } catch (err) {
      console.error(`[FirebaseStorage] uploadDataUrl failed for ${path}:`, err);
      return {
        downloadUrl: dataUrl,
        fullPath: path,
        isFallback: true,
        error: err.message
      };
    }
  }

  /**
   * Upload a JavaScript object as a JSON object file in Cloud Storage
   * @param {string} path - Storage path (e.g. 'bedtime/stories/story_123.json')
   * @param {Object} jsonObject - The data to serialize
   * @param {Object} [options]
   * @returns {Promise<{ downloadUrl: string, fullPath: string }>}
   */
  async uploadJson(path, jsonObject, options = {}) {
    const jsonString = JSON.stringify(jsonObject, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    return this.uploadFile(path, blob, {
      ...options,
      metadata: {
        contentType: 'application/json',
        ...(options.metadata || {})
      }
    });
  }

  /**
   * Retrieve the public / signed download URL for an object
   * @param {string} path - Storage path
   * @returns {Promise<string|null>}
   */
  async getDownloadURL(path) {
    const storageRef = this.getRef(path);
    if (!storageRef) {
      return this.memoryCache.get(path) || null;
    }

    try {
      return await getDownloadURL(storageRef);
    } catch (err) {
      console.warn(`[FirebaseStorage] Failed to get download URL for ${path}:`, err.message);
      return this.memoryCache.get(path) || null;
    }
  }

  /**
   * Delete an object from Cloud Storage
   * @param {string} path - Storage path
   * @returns {Promise<boolean>}
   */
  async deleteFile(path) {
    const storageRef = this.getRef(path);
    if (!storageRef) return false;

    try {
      await deleteObject(storageRef);
      this.memoryCache.delete(path);
      return true;
    } catch (err) {
      console.error(`[FirebaseStorage] Delete failed for ${path}:`, err);
      return false;
    }
  }

  /**
   * List all objects and prefixes in a storage folder
   * @param {string} folderPath - Path to directory
   * @returns {Promise<{ items: Array<{ name: string, fullPath: string }>, prefixes: string[] }>}
   */
  async listAllFiles(folderPath) {
    const storageRef = this.getRef(folderPath);
    if (!storageRef) return { items: [], prefixes: [] };

    try {
      const res = await listAll(storageRef);
      const items = res.items.map(item => ({
        name: item.name,
        fullPath: item.fullPath
      }));
      const prefixes = res.prefixes.map(prefix => prefix.fullPath);
      return { items, prefixes };
    } catch (err) {
      console.error(`[FirebaseStorage] listAll failed for ${folderPath}:`, err);
      return { items: [], prefixes: [] };
    }
  }

  // =========================================================================
  // DOMAIN-SPECIFIC HIGH-LEVEL HELPERS
  // =========================================================================

  /**
   * Specialized helper to upload a Chore Photo Proof
   * Path: households/{householdId}/chores/{choreId}_{timestamp}.webp
   * @param {string} householdId - Household identifier
   * @param {string} heroId - Hero completing the chore
   * @param {string} choreId - Chore identifier
   * @param {string|Blob|File} imageSource - Base64 data URL, Blob, or File
   * @returns {Promise<{ downloadUrl: string, storagePath: string, isFallback: boolean }>}
   */
  async uploadChorePhotoProof(householdId = 'demo-household', heroId = 'hero', choreId = 'chore', imageSource) {
    const safeHousehold = householdId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeChore = choreId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = Date.now();
    const storagePath = `households/${safeHousehold}/chores/${safeChore}_${heroId}_${timestamp}.webp`;

    const customMetadata = {
      householdId: safeHousehold,
      heroId,
      choreId: safeChore,
      category: 'chore_proof'
    };

    if (typeof imageSource === 'string' && imageSource.startsWith('data:')) {
      const res = await this.uploadDataUrl(storagePath, imageSource, { customMetadata });
      return {
        downloadUrl: res.downloadUrl,
        storagePath: res.fullPath,
        isFallback: !!res.isFallback
      };
    } else if (imageSource instanceof Blob || (typeof File !== 'undefined' && imageSource instanceof File)) {
      const res = await this.uploadFile(storagePath, imageSource, {
        metadata: { customMetadata }
      });
      return {
        downloadUrl: res.downloadUrl,
        storagePath: res.fullPath,
        isFallback: !!res.isFallback
      };
    } else {
      console.warn('[FirebaseStorage] Invalid imageSource provided for chore proof');
      return {
        downloadUrl: typeof imageSource === 'string' ? imageSource : '',
        storagePath,
        isFallback: true
      };
    }
  }

  /**
   * Specialized helper to upload a custom Hero Avatar image
   * Path: heroes/{heroId}/avatar_{timestamp}.webp
   * @param {string} heroId - Hero identifier
   * @param {string|Blob} imageSource - Data URL or Blob
   * @returns {Promise<{ downloadUrl: string, storagePath: string }>}
   */
  async uploadHeroAvatar(heroId = 'default_hero', imageSource) {
    const safeHeroId = heroId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = Date.now();
    const storagePath = `heroes/${safeHeroId}/avatar_${timestamp}.webp`;

    const customMetadata = {
      heroId: safeHeroId,
      category: 'hero_avatar'
    };

    if (typeof imageSource === 'string' && imageSource.startsWith('data:')) {
      const res = await this.uploadDataUrl(storagePath, imageSource, { customMetadata });
      return {
        downloadUrl: res.downloadUrl,
        storagePath: res.fullPath
      };
    } else {
      const res = await this.uploadFile(storagePath, imageSource, {
        metadata: { customMetadata }
      });
      return {
        downloadUrl: res.downloadUrl,
        storagePath: res.fullPath
      };
    }
  }

  /**
   * Specialized helper to archive a Bedtime Story Session JSON
   * Path: bedtime/{householdId}/stories/{storyId}.json
   * @param {string} householdId - Household identifier
   * @param {string} storyId - Unique story session ID
   * @param {Object} storyData - Complete story chapters and prompt data
   * @returns {Promise<{ downloadUrl: string, storagePath: string }>}
   */
  async uploadBedtimeStoryRecord(householdId = 'demo-household', storyId, storyData) {
    const safeHousehold = householdId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeStoryId = (storyId || `story_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const storagePath = `bedtime/${safeHousehold}/stories/${safeStoryId}.json`;

    const res = await this.uploadJson(storagePath, storyData, {
      metadata: {
        customMetadata: {
          householdId: safeHousehold,
          storyId: safeStoryId,
          category: 'bedtime_story'
        }
      }
    });

    return {
      downloadUrl: res.downloadUrl,
      storagePath: res.fullPath
    };
  }

  // =========================================================================
  // INTERNAL FALLBACK UTILITIES
  // =========================================================================

  _handleFallbackUpload(path, fileOrBlob) {
    let fallbackUrl = '';
    if (typeof fileOrBlob === 'string') {
      fallbackUrl = fileOrBlob;
    } else if (typeof URL !== 'undefined' && URL.createObjectURL && fileOrBlob instanceof Blob) {
      try {
        fallbackUrl = URL.createObjectURL(fileOrBlob);
      } catch {
        fallbackUrl = '';
      }
    }

    if (fallbackUrl) {
      this.memoryCache.set(path, fallbackUrl);
    }

    return {
      downloadUrl: fallbackUrl,
      fullPath: path,
      name: path.split('/').pop(),
      size: fileOrBlob.size || 0,
      isFallback: true
    };
  }
}

export const firebaseStorageService = new FirebaseStorageService();
