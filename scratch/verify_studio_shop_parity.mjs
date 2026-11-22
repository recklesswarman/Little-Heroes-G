// What the parent sees in the Studio is what the kid sees in the Shop: both use the same shared renderers.
import './setup_mock_env.js';
import { renderItemVisual } from '../src/utils/itemVisual.js';
import { renderItemCredit } from '../src/utils/itemCredit.js';
import { emojiArtUrl, emojiHexcode } from '../src/utils/emojiArt.js';
import { gameIconFor, gameIconUrl } from '../src/utils/gameIcons.js';
import { modelViewerLightingAttrs, hexToRgbaArray } from '../src/utils/modelViewerTint.js';

let passed = 0, failed = 0;
const assert = (c, m) => { if (c) { console.log(`  ✅ PASS: ${m}`); passed++; } else { console.error(`  ❌ FAIL: ${m}`); failed++; } };

console.log('🪞 --- Studio / Shop parity --- 🪞');
const model = { id: 'x1', name: 'Rocket', category: 'Loot', modelUrl: 'https://example.com/a.glb', modelTint: '#06b6d4', lighting: 'sunny', image: 'https://example.com/a.webp' };
const studio = renderItemVisual(model, { size: 'studio' });
const detail = renderItemVisual(model, { size: 'detail' });
assert(studio.includes('<model-viewer') && detail.includes('<model-viewer'), 'model items show a 3D model in Studio and Shop detail');
assert(studio.includes('data-tint="#06b6d4"') && detail.includes('data-tint="#06b6d4"'), 'both carry the same tint');
assert(studio.includes(modelViewerLightingAttrs('sunny')) && detail.includes(modelViewerLightingAttrs('sunny')), 'both carry the same lighting');
assert(renderItemVisual(model, { size: 'card' }).includes('<img'), 'list cards use the picture, not a model, to save data');

const evil = { id: 'e', name: '"><script>alert(1)</script>', image: 'javascript:alert(1)', modelUrl: 'javascript:alert(1)', modelTint: 'red"onload="x' };
const out = renderItemVisual(evil, { size: 'studio' });
assert(!out.includes('<script') && !out.includes('javascript:') && !out.includes('onload='), 'hostile item fields are neutralised');

assert(emojiHexcode('🍎') === '1F34E', 'emoji hexcode matches OpenMoji naming');
assert(emojiHexcode('🧙‍♂️') === '1F9D9-2642', 'ZWJ and FE0F are dropped');
assert(emojiArtUrl('🍎').endsWith('assets/icons/openmoji/1F34E.svg'), 'an emoji we ship maps to its OpenMoji file');
assert(emojiArtUrl('🪐') === '', 'an emoji we do not ship keeps the plain emoji');
const sticker = renderItemVisual({ id: 's', name: 'Apple', emoji: '🍎', category: 'Snacks' }, { size: 'card' });
assert(sticker.includes('openmoji/1F34E.svg'), 'emoji-only items show OpenMoji art');
const weapon = renderItemVisual({ id: 'w', name: 'Blade', category: 'Weapons' }, { size: 'card' });
assert(gameIconFor('', 'Weapons') === 'swords' && gameIconUrl('swords').includes('game-icons'), 'weapons fall back to game-icons art');
assert(weapon.includes('<img'), 'picture-less weapons still render an image');

assert(renderItemCredit({ credit: { title: 'Rocket', author: 'Quaternius', license: 'CC0' } }).includes('by Quaternius'), 'credit line shows the author');
assert(!renderItemCredit({ credit: '<b>x</b>' }).includes('<b>'), 'credit text is escaped');
assert(renderItemCredit({}) === '', 'no credit means no line');
assert(JSON.stringify(hexToRgbaArray('#ff0000')) === '[1,0,0,1]' && hexToRgbaArray('nope') === null, 'hex to rgba works and rejects junk');

console.log(`\nTEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
process.exit(failed ? 1 : 0);
