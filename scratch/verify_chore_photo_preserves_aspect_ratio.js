import './setup_mock_env.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✅ PASS: ${msg}`); passed++; }
  else { console.error(`  ❌ FAIL: ${msg}`); failed++; }
}

// Chore proof photos must keep their full frame (a parent needs to actually
// see what was done), unlike profile avatars which are always force-cropped
// to a square. Both now share the same FileReader/Image decode pipeline in
// photoUploader.js, so this guards against that shared refactor accidentally
// re-introducing a square crop on the chore-photo path.

let capturedCanvasDims = null;
const realCreateElement = document.createElement;
document.createElement = (tag) => {
  const el = realCreateElement(tag);
  if (tag === 'canvas') {
    el.getContext = () => ({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      drawImage: () => {
        capturedCanvasDims = { width: el.width, height: el.height };
      }
    });
    el.toDataURL = () => 'data:image/jpeg;base64,mockoutput';
  }
  return el;
};

class MockWideImage {
  constructor() {
    this.width = 1600;
    this.height = 900;
    this._src = '';
  }
  set src(val) {
    this._src = val;
    setTimeout(() => { if (this.onload) this.onload(); }, 0);
  }
  get src() { return this._src; }
}
globalThis.Image = MockWideImage;

class MockFileReader {
  readAsDataURL(file) {
    setTimeout(() => {
      if (this.onload) this.onload({ target: { result: 'data:image/jpeg;base64,mock' } });
    }, 0);
  }
}
globalThis.FileReader = MockFileReader;

const { processPhotoFitWithinBounds, processProfilePhoto } = await import('../src/utils/photoUploader.js');

const fakeFile = { type: 'image/jpeg' };

console.log('\n--- 1. processPhotoFitWithinBounds preserves a non-square aspect ratio ---');
capturedCanvasDims = null;
await processPhotoFitWithinBounds(fakeFile, 800, 0.85);
assert(capturedCanvasDims !== null, 'Canvas drawImage was invoked');
assert(capturedCanvasDims.width === 800, `Longer side (width) scaled down to the 800 bound (got ${capturedCanvasDims.width})`);
assert(capturedCanvasDims.height === 450, `Shorter side scaled proportionally to preserve aspect ratio 16:9 (got ${capturedCanvasDims.height}, expected 450)`);

console.log('\n--- 2. processPhotoFitWithinBounds never upscales a smaller source image ---');
capturedCanvasDims = null;
await processPhotoFitWithinBounds(fakeFile, 4000, 0.85);
assert(capturedCanvasDims.width === 1600 && capturedCanvasDims.height === 900, `Source smaller than the bound is kept at its original size, not stretched up (got ${capturedCanvasDims.width}x${capturedCanvasDims.height})`);

console.log('\n--- 3. processProfilePhoto (avatars) still force-crops to a square ---');
capturedCanvasDims = null;
await processProfilePhoto(fakeFile, 256, 0.85);
assert(capturedCanvasDims.width === 256 && capturedCanvasDims.height === 256, `Profile photo path is unaffected by the refactor and still outputs a 256x256 square (got ${capturedCanvasDims.width}x${capturedCanvasDims.height})`);

console.log('\n=============================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('=============================================');
process.exit(failed > 0 ? 1 : 0);
