/**
 * Pure JavaScript MD5 implementation (RFC 1321)
 * Zero dependencies, compatible with Browser, Node.js, and Cloudflare Workers.
 */

// Per-round shift amounts
const S = [
  7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,
  5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,
  4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,
  6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21
];

// Binary integer constants table: floor(2^32 * abs(sin(i + 1))) for i from 0 to 63
const K = new Uint32Array([
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
  0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
  0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
  0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
  0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
  0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
  0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
  0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
  0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
  0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
  0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
  0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
  0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
  0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
  0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
  0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
]);

function rotateLeft(x, n) {
  return (x << n) | (x >>> (32 - n));
}

function stringToUtf8Bytes(str) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  // Fallback for minimal runtimes without TextEncoder
  const utf8 = [];
  for (let i = 0; i < str.length; i++) {
    let charcode = str.charCodeAt(i);
    if (charcode < 0x80) {
      utf8.push(charcode);
    } else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6),
                0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8.push(0xe0 | (charcode >> 12),
                0x80 | ((charcode >> 6) & 0x3f),
                0x80 | (charcode & 0x3f));
    } else {
      // Surrogate pair
      i++;
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      utf8.push(0xf0 | (charcode >> 18),
                0x80 | ((charcode >> 12) & 0x3f),
                0x80 | ((charcode >> 6) & 0x3f),
                0x80 | (charcode & 0x3f));
    }
  }
  return new Uint8Array(utf8);
}

/**
 * Computes MD5 32-character hexadecimal digest for a given input string.
 * @param {string} input - Text to hash
 * @returns {string} 32-character lowercase hex MD5 string
 */
export function computeMd5(input) {
  const str = input == null ? '' : String(input);
  const bytes = stringToUtf8Bytes(str);
  const byteLength = bytes.length;
  const bitLength = byteLength * 8;

  // Pre-processing: padding
  // Find total length in bytes multiple of 64: byteLength + 1 (0x80) + padding + 8 bytes length = 64 * N
  const paddingBytesNeeded = ((56 - ((byteLength + 1) % 64)) + 64) % 64;
  const totalLength = byteLength + 1 + paddingBytesNeeded + 8;

  const padded = new Uint8Array(totalLength);
  padded.set(bytes);
  padded[byteLength] = 0x80;

  // Append length in bits as 64-bit little-endian integer
  const view = new DataView(padded.buffer);
  view.setUint32(totalLength - 8, bitLength >>> 0, true);
  view.setUint32(totalLength - 4, Math.floor(bitLength / 0x100000000) >>> 0, true);

  // Initialize hash state variables (RFC 1321)
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  // Process message in 16-word (64-byte) chunks
  const numBlocks = totalLength / 64;
  for (let b = 0; b < numBlocks; b++) {
    const offset = b * 64;
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) {
      M[j] = view.getUint32(offset + j * 4, true);
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) {
        F = (B & C) | ((~B) & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | ((~D) & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | (~D));
        g = (7 * i) % 16;
      }

      const temp = D;
      D = C;
      C = B;
      B = (B + rotateLeft((A + F + K[i] + M[g]) | 0, S[i])) | 0;
      A = temp;
    }

    a0 = (a0 + A) | 0;
    b0 = (b0 + B) | 0;
    c0 = (c0 + C) | 0;
    d0 = (d0 + D) | 0;
  }

  // Format 128-bit state as 32 hex chars (little-endian)
  const hexParts = [a0, b0, c0, d0].map(val => {
    const b0Hex = (val & 0xff).toString(16).padStart(2, '0');
    const b1Hex = ((val >>> 8) & 0xff).toString(16).padStart(2, '0');
    const b2Hex = ((val >>> 16) & 0xff).toString(16).padStart(2, '0');
    const b3Hex = ((val >>> 24) & 0xff).toString(16).padStart(2, '0');
    return b0Hex + b1Hex + b2Hex + b3Hex;
  });

  return hexParts.join('');
}

export default computeMd5;
