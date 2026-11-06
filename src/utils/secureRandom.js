const UINT32_RANGE = 0x100000000;

export function secureRandomHex(byteLength = 16) {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function secureRandomInteger(min, max) {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max || max - min + 1 > UINT32_RANGE) {
    throw new RangeError('Random integer bounds must be safe integers within the 32-bit range.');
  }

  const range = max - min + 1;
  const limit = Math.floor(UINT32_RANGE / range) * range;
  const sample = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(sample);
  } while (sample[0] >= limit);

  return min + (sample[0] % range);
}
