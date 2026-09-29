const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running Firebase Storage & GCS SDK Integration Tests...');

// Setup minimal DOM / Web API mocks for Node environment
if (!global.performance) {
  global.performance = { now: () => Date.now() };
}
global.window = {
  devicePixelRatio: 1,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {}
};
global.document = {
  body: {},
  getElementById: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.localStorage = {
  _data: {},
  getItem: (k) => global.localStorage._data[k] || null,
  setItem: (k, v) => { global.localStorage._data[k] = v; },
  removeItem: (k) => { delete global.localStorage._data[k]; },
  clear: () => { global.localStorage._data = {}; }
};

async function run() {
  console.log('\n--- 1. Testing Firebase Config Storage Exports ---');
  const firebaseConfigModule = await import('../src/config/firebase.js');
  
  assert(firebaseConfigModule.firebaseConfig, 'firebaseConfig must be exported');
  assert.strictEqual(firebaseConfigModule.firebaseConfig.projectId, 'little-heroes-quest-8842', 'Project ID must match');
  assert.strictEqual(
    firebaseConfigModule.firebaseConfig.storageBucket,
    'little-heroes-quest-8842.firebasestorage.app',
    'storageBucket must be configured'
  );
  assert('storage' in firebaseConfigModule, 'storage instance must be exported');
  assert('isStorageAvailable' in firebaseConfigModule, 'isStorageAvailable flag must be exported');
  console.log('  ✅ PASS: Firebase config includes valid storageBucket and storage instance export');

  console.log('\n--- 2. Testing FirebaseStorageService API & Methods ---');
  const { firebaseStorageService } = await import('../src/services/firebaseStorageService.js');
  
  assert(typeof firebaseStorageService.isReady === 'function', 'isReady() method exists');
  assert(typeof firebaseStorageService.getRef === 'function', 'getRef() method exists');
  assert(typeof firebaseStorageService.uploadFile === 'function', 'uploadFile() method exists');
  assert(typeof firebaseStorageService.uploadDataUrl === 'function', 'uploadDataUrl() method exists');
  assert(typeof firebaseStorageService.uploadJson === 'function', 'uploadJson() method exists');
  assert(typeof firebaseStorageService.getDownloadURL === 'function', 'getDownloadURL() method exists');
  assert(typeof firebaseStorageService.deleteFile === 'function', 'deleteFile() method exists');
  assert(typeof firebaseStorageService.listAllFiles === 'function', 'listAllFiles() method exists');
  assert(typeof firebaseStorageService.uploadChorePhotoProof === 'function', 'uploadChorePhotoProof() method exists');
  assert(typeof firebaseStorageService.uploadHeroAvatar === 'function', 'uploadHeroAvatar() method exists');
  assert(typeof firebaseStorageService.uploadBedtimeStoryRecord === 'function', 'uploadBedtimeStoryRecord() method exists');
  console.log('  ✅ PASS: All required Cloud Storage methods are defined on firebaseStorageService');

  console.log('\n--- 3. Testing Offline & Fallback Data URL Upload ---');
  const sampleDataUrl = 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAkA4JaQAA3AA/vsGAA==';
  const uploadResult = await firebaseStorageService.uploadDataUrl(
    'households/test-household/chores/test_chore_123.webp',
    sampleDataUrl
  );
  
  assert(uploadResult.downloadUrl, 'Upload result must provide a downloadUrl (or fallback URI)');
  assert(uploadResult.fullPath.includes('chores/test_chore_123.webp'), 'Path must be preserved');
  console.log('  ✅ PASS: uploadDataUrl returns robust downloadUrl without uncaught exceptions');

  console.log('\n--- 4. Testing Domain-Specific Chore Photo Proof Helper ---');
  const choreProofResult = await firebaseStorageService.uploadChorePhotoProof(
    'household-abc',
    'hero-kalep',
    'brush_teeth',
    sampleDataUrl
  );
  assert(choreProofResult.downloadUrl, 'Chore proof result must contain downloadUrl');
  assert(choreProofResult.storagePath.includes('households/household-abc/chores/brush_teeth_hero-kalep_'), 'Storage path taxonomy matches spec');
  console.log('  ✅ PASS: uploadChorePhotoProof formats taxonomy: ' + choreProofResult.storagePath);

  console.log('\n--- 5. Testing Domain-Specific Hero Avatar Helper ---');
  const avatarResult = await firebaseStorageService.uploadHeroAvatar(
    'hero-kalep',
    sampleDataUrl
  );
  assert(avatarResult.downloadUrl, 'Avatar result must contain downloadUrl');
  assert(avatarResult.storagePath.includes('heroes/hero-kalep/avatar_'), 'Storage path taxonomy matches spec');
  console.log('  ✅ PASS: uploadHeroAvatar formats taxonomy: ' + avatarResult.storagePath);

  console.log('\n--- 6. Testing Storage Rules & Configuration Files ---');
  const storageRulesPath = path.resolve(__dirname, '../storage.rules');
  assert(fs.existsSync(storageRulesPath), 'storage.rules file must exist');
  const storageRulesContent = fs.readFileSync(storageRulesPath, 'utf8');
  assert(storageRulesContent.includes("rules_version = '2'"), 'storage.rules must use rules_version 2');
  assert(storageRulesContent.includes('match /households/{householdId}/{allPaths=**}'), 'storage.rules must protect households path');
  assert(storageRulesContent.includes('match /heroes/{heroId}/{allPaths=**}'), 'storage.rules must define heroes path');
  assert(storageRulesContent.includes('match /bedtime/{householdId}/{allPaths=**}'), 'storage.rules must define bedtime path');

  const firebaseJsonPath = path.resolve(__dirname, '../firebase.json');
  const firebaseJson = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'));
  assert(firebaseJson.storage && firebaseJson.storage.rules === 'storage.rules', 'firebase.json must configure storage.rules');
  console.log('  ✅ PASS: storage.rules & firebase.json are properly configured and validated');

  console.log('\n🎉 ALL FIREBASE STORAGE TESTS PASSED SUCCESSFULLY!\n');
}

run().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
