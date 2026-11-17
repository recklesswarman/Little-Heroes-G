/**
 * brushVisionTracker.js
 *
 * Modular, client-side AI Vision Motion & Quadrant Tracker for Tooth Defenders.
 * Computes frame-to-frame pixel deltas, smoothed movement speed (0-100),
 * tracking confidence (0-100), cross-quadrant zone detection (Q1-Q5 ROIs),
 * and hysteresis-smoothed brushing state (idle | active | charging | fallback_ready).
 *
 * Pure analysis functions are exported for deterministic Node unit testing
 * as well as live 10 Hz webcam canvas processing in BattleView.
 */

import { DENTAL_QUADRANTS } from '../data/hygieneBossesData.js';

export const VISION_SENSITIVITY_PRESETS = {
  high: {
    pixelDiffThreshold: 18,
    motionRatioThreshold: 0.045,
    roiRatioThreshold: 0.055,
    speedScale: 1.25
  },
  medium: {
    pixelDiffThreshold: 25,
    motionRatioThreshold: 0.08,
    roiRatioThreshold: 0.09,
    speedScale: 1.0
  },
  low: {
    pixelDiffThreshold: 34,
    motionRatioThreshold: 0.12,
    roiRatioThreshold: 0.135,
    speedScale: 0.8
  }
};

export function getSensitivityPreset(sensitivity = 'medium') {
  return VISION_SENSITIVITY_PRESETS[sensitivity] || VISION_SENSITIVITY_PRESETS.medium;
}

/**
 * Pure pixel-delta & quadrant ROI analyzer.
 *
 * @param {Uint8ClampedArray|Uint8Array|Array} prevRgba
 * @param {Uint8ClampedArray|Uint8Array|Array} currRgba
 * @param {number} width
 * @param {number} height
 * @param {string} targetZoneId
 * @param {'low'|'medium'|'high'} sensitivity
 */
export function analyzeFrameDelta(
  prevRgba,
  currRgba,
  width = 64,
  height = 48,
  targetZoneId = 'q1',
  sensitivity = 'medium'
) {
  const emptyResult = {
    motionRatio: 0,
    targetRoiRatio: 0,
    movementSpeed: 0,
    confidence: 0,
    detectedZoneId: null,
    targetZoneMatch: false,
    zoneScores: { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 },
    hasMotion: false
  };

  if (!prevRgba || !currRgba || width <= 0 || height <= 0) {
    return emptyResult;
  }

  const expectedLen = width * height * 4;
  if (prevRgba.length < expectedLen || currRgba.length < expectedLen) {
    return emptyResult;
  }

  const cfg = getSensitivityPreset(sensitivity);
  const scaleX = width / 64;
  const scaleY = height / 48;

  let diffPixels = 0;
  let totalDeltaEnergy = 0;
  const totalPixels = width * height;

  for (let i = 0; i < expectedLen; i += 4) {
    const rDiff = Math.abs(currRgba[i] - prevRgba[i]);
    const gDiff = Math.abs(currRgba[i + 1] - prevRgba[i + 1]);
    const bDiff = Math.abs(currRgba[i + 2] - prevRgba[i + 2]);
    const avgDiff = (rDiff + gDiff + bDiff) / 3;
    if (avgDiff > cfg.pixelDiffThreshold) {
      diffPixels++;
      totalDeltaEnergy += avgDiff;
    }
  }

  const motionRatio = totalPixels > 0 ? diffPixels / totalPixels : 0;

  // Evaluate motion density across all 5 dental quadrant ROIs
  const zoneScores = { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 };
  let bestZoneId = null;
  let bestZoneScore = 0;

  for (const quad of DENTAL_QUADRANTS) {
    const roi = quad.roi || { minX: 8, maxX: 56, minY: 12, maxY: 44 };
    const xStart = Math.max(0, Math.floor(roi.minX * scaleX));
    const xEnd = Math.min(width, Math.ceil(roi.maxX * scaleX));
    const yStart = Math.max(0, Math.floor(roi.minY * scaleY));
    const yEnd = Math.min(height, Math.ceil(roi.maxY * scaleY));

    let roiDiffs = 0;
    let roiCount = 0;

    for (let y = yStart; y < yEnd; y++) {
      const rowOffset = y * width;
      for (let x = xStart; x < xEnd; x++) {
        const idx = (rowOffset + x) * 4;
        const rDiff = Math.abs(currRgba[idx] - prevRgba[idx]);
        const gDiff = Math.abs(currRgba[idx + 1] - prevRgba[idx + 1]);
        const bDiff = Math.abs(currRgba[idx + 2] - prevRgba[idx + 2]);
        if ((rDiff + gDiff + bDiff) / 3 > cfg.pixelDiffThreshold) {
          roiDiffs++;
        }
        roiCount++;
      }
    }

    const score = roiCount > 0 ? roiDiffs / roiCount : 0;
    zoneScores[quad.id] = Number(score.toFixed(4));
    if (score > bestZoneScore) {
      bestZoneScore = score;
      bestZoneId = quad.id;
    }
  }

  const targetRoiRatio = zoneScores[targetZoneId] ?? 0;
  const hasMotion =
    motionRatio >= cfg.motionRatioThreshold ||
    targetRoiRatio >= cfg.roiRatioThreshold ||
    bestZoneScore >= cfg.roiRatioThreshold;

  const detectedZoneId = bestZoneScore >= cfg.roiRatioThreshold * 0.5 ? bestZoneId : null;
  const targetZoneMatch = Boolean(
    hasMotion && (detectedZoneId === targetZoneId || targetRoiRatio >= cfg.roiRatioThreshold)
  );

  // Normalized movement speed (0-100) from coverage + pixel intensity
  const meanMovingDelta = diffPixels > 0 ? totalDeltaEnergy / diffPixels : 0;
  const ratioComponent = Math.min(1, motionRatio / 0.28);
  const roiComponent = Math.min(1, Math.max(targetRoiRatio, bestZoneScore) / 0.35);
  const intensityComponent = Math.min(1, meanMovingDelta / 110);
  const rawSpeed = ((ratioComponent * 0.45) + (roiComponent * 0.35) + (intensityComponent * 0.20)) * 100 * cfg.speedScale;
  const movementSpeed = hasMotion ? Math.max(20, Math.min(100, Math.round(rawSpeed))) : 0;

  // Confidence (0-100): high when localized brush motion is detected; slightly penalized for huge full-frame camera shake
  let confidence = 0;
  if (hasMotion) {
    const localizationBonus = targetZoneMatch ? 22 : 10;
    const strengthScore = Math.min(72, Math.round(Math.max(roiComponent, ratioComponent) * 72));
    const shakePenalty = motionRatio > 0.85 && targetRoiRatio > 0.85 ? 18 : 0;
    confidence = Math.max(25, Math.min(100, 15 + strengthScore + localizationBonus - shakePenalty));
  }

  return {
    motionRatio: Number(motionRatio.toFixed(4)),
    targetRoiRatio: Number(targetRoiRatio.toFixed(4)),
    movementSpeed,
    confidence,
    detectedZoneId,
    targetZoneMatch,
    zoneScores,
    hasMotion
  };
}

export class BrushVisionTracker {
  constructor(options = {}) {
    this.hysteresisMs = typeof options.hysteresisMs === 'number' ? options.hysteresisMs : 650;
    this.reset();
  }

  reset() {
    this.mode = 'vision'; // 'vision' | 'audio' | 'fallback'
    this.state = 'idle'; // 'idle' | 'active' | 'charging' | 'fallback_ready'
    this.isBrushing = false;
    this.movementSpeed = 0;
    this.confidence = 0;
    this.detectedZoneId = null;
    this.targetZoneId = 'q1';
    this.targetZoneMatch = false;
    this.motionRatio = 0;
    this.hasMotion = false;
    this.lastMotionTimestamp = 0;
    this.prevFrame = null;
    this.frameWidth = 0;
    this.frameHeight = 0;
  }

  setMode(mode = 'vision') {
    const valid = ['vision', 'audio', 'fallback'].includes(mode) ? mode : 'vision';
    this.mode = valid;
    if (valid === 'fallback' && !this.isBrushing) {
      this.state = 'fallback_ready';
    } else if (valid !== 'fallback' && this.state === 'fallback_ready') {
      this.state = this.isBrushing ? 'active' : 'idle';
    }
    return this.getSnapshot();
  }

  processFrame(rgbaData, width = 64, height = 48, targetZoneId = 'q1', sensitivity = 'medium', nowMs = Date.now()) {
    this.targetZoneId = targetZoneId || 'q1';
    if (!rgbaData || width <= 0 || height <= 0) {
      return this.tickIdleCheck(nowMs);
    }

    const expectedLen = width * height * 4;
    if (rgbaData.length < expectedLen) {
      return this.tickIdleCheck(nowMs);
    }

    if (!this.prevFrame || this.frameWidth !== width || this.frameHeight !== height) {
      this.prevFrame = new Uint8ClampedArray(rgbaData.subarray(0, expectedLen));
      this.frameWidth = width;
      this.frameHeight = height;
      return this.getSnapshot();
    }

    const delta = analyzeFrameDelta(this.prevFrame, rgbaData, width, height, this.targetZoneId, sensitivity);
    this.prevFrame.set(rgbaData.subarray(0, expectedLen));

    this.motionRatio = delta.motionRatio;
    this.hasMotion = delta.hasMotion;
    this.detectedZoneId = delta.detectedZoneId;
    this.targetZoneMatch = delta.targetZoneMatch;

    if (delta.hasMotion) {
      this.lastMotionTimestamp = nowMs;
      this.isBrushing = true;
      this.movementSpeed = this.movementSpeed > 0
        ? Math.round(this.movementSpeed * 0.45 + delta.movementSpeed * 0.55)
        : delta.movementSpeed;
      this.confidence = this.confidence > 0
        ? Math.round(this.confidence * 0.45 + delta.confidence * 0.55)
        : delta.confidence;
      this.state = (this.movementSpeed >= 55 && this.confidence >= 65) ? 'charging' : 'active';
    } else {
      this.tickIdleCheck(nowMs);
    }

    return this.getSnapshot();
  }

  tickIdleCheck(nowMs = Date.now()) {
    const withinHysteresis =
      this.lastMotionTimestamp > 0 &&
      (nowMs - this.lastMotionTimestamp) <= this.hysteresisMs;

    if (withinHysteresis) {
      this.isBrushing = true;
      this.movementSpeed = Math.max(0, Math.round(this.movementSpeed * 0.85));
      this.confidence = Math.max(0, Math.round(this.confidence * 0.85));
      this.state = this.movementSpeed >= 55 ? 'charging' : 'active';
    } else {
      this.isBrushing = false;
      this.hasMotion = false;
      this.movementSpeed = 0;
      this.confidence = 0;
      this.targetZoneMatch = false;
      this.state = this.mode === 'fallback' ? 'fallback_ready' : 'idle';
    }
    return this.getSnapshot();
  }

  recordAudioSignal({ isScrubbing, cadenceScore = 0 } = {}, targetZoneId = 'q1', nowMs = Date.now()) {
    this.targetZoneId = targetZoneId || this.targetZoneId;
    if (isScrubbing) {
      this.lastMotionTimestamp = nowMs;
      this.isBrushing = true;
      this.movementSpeed = Math.max(20, Math.min(100, Math.round(cadenceScore)));
      this.confidence = Math.max(40, Math.min(100, Math.round(cadenceScore)));
      this.state = this.movementSpeed >= 55 ? 'charging' : 'active';
    } else {
      this.tickIdleCheck(nowMs);
    }
    return this.getSnapshot();
  }

  recordManualInput(targetZoneId = 'q1', nowMs = Date.now()) {
    this.targetZoneId = targetZoneId || this.targetZoneId;
    this.lastMotionTimestamp = nowMs;
    this.isBrushing = true;
    this.movementSpeed = Math.max(this.movementSpeed, 75);
    this.confidence = 100;
    this.targetZoneMatch = true;
    this.state = 'charging';
    return this.getSnapshot();
  }

  getSnapshot() {
    const stateLabel = this.mode === 'fallback' && !this.isBrushing
      ? 'fallback'
      : (this.isBrushing ? 'brushing' : 'idle');

    return {
      mode: this.mode,
      state: this.state,
      stateLabel,
      isBrushing: this.isBrushing,
      movementSpeed: this.movementSpeed,
      confidence: this.confidence,
      detectedZoneId: this.detectedZoneId,
      targetZoneId: this.targetZoneId,
      targetZoneMatch: this.targetZoneMatch,
      motionRatio: this.motionRatio,
      hasMotion: this.hasMotion
    };
  }
}

export const brushVisionTracker = new BrushVisionTracker();
