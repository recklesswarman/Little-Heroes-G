// The household syncs as one 1 MiB Firestore document, so the Studio must never keep a full-size picture.
import './setup_mock_env.js';
import { isGeneratedPicture, toThumbnail, persistStudioImage, MAX_INLINE_PICTURE_CHARS } from '../src/services/studioArtService.js';

let passed = 0, failed = 0;
const assert = (c, m) => { if (c) { console.log(`  ✅ PASS: ${m}`); passed++; } else { console.error(`  ❌ FAIL: ${m}`); failed++; } };

console.log('🖼️ --- Studio image budget --- 🖼️');
assert(isGeneratedPicture('data:image/png;base64,AAAA'), 'a raster data URI counts as a picture');
assert(isGeneratedPicture('https://example.com/a.webp'), 'an https URL counts as a picture');
assert(!isGeneratedPicture('data:image/svg+xml;base64,AAAA'), 'the SVG fallback icon does not count');
assert(!isGeneratedPicture(''), 'empty is not a picture');
assert(!isGeneratedPicture('javascript:alert(1)'), 'a script URL is not a picture');
assert(MAX_INLINE_PICTURE_CHARS <= 60000, 'inline pictures stay under 60,000 characters');
assert((await toThumbnail('')) === '', 'thumbnail of nothing is empty (callers keep the default icon)');
assert((await persistStudioImage('data:image/svg+xml;base64,AAAA')) === '', 'persist skips the SVG fallback');

console.log(`\nTEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
process.exit(failed ? 1 : 0);
