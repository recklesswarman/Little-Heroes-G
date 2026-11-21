// Tiny PCM helpers for the voice lab: whisper.cpp wants 16 kHz mono 16-bit WAV.

/** Linear-interpolation resample of mono Float32 samples. */
export function resampleMono(samples, fromRate, toRate = 16000) {
  if (!samples?.length || fromRate === toRate) return Float32Array.from(samples || []);
  const ratio = fromRate / toRate;
  const outLength = Math.max(1, Math.floor(samples.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const frac = pos - i0;
    out[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
  }
  return out;
}

/** Mix an AudioBuffer-like object ({numberOfChannels, getChannelData}) down to mono. */
export function toMono(audioBuffer) {
  const channels = audioBuffer.numberOfChannels || 1;
  const first = audioBuffer.getChannelData(0);
  if (channels === 1) return Float32Array.from(first);
  const out = new Float32Array(first.length);
  for (let c = 0; c < channels; c++) {
    const data = audioBuffer.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += data[i] / channels;
  }
  return out;
}

/** Encode mono Float32 samples as a 16-bit PCM WAV (ArrayBuffer). */
export function encodeWav(samples, sampleRate = 16000) {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}
