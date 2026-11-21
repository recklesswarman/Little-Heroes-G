/**
 * announcerService.js
 * Lightweight battle announcer: short, upbeat hype lines fired on key battle
 * moments (hits, streaks, mini-challenges, zone switches). Reuses the
 * project's sole TTS mechanism (window.speechSynthesis) and the existing
 * voice-selection heuristic from voiceService.js for a consistent voice,
 * instead of introducing a new provider or API call per line.
 *
 * Deliberately separate from voiceService.js's longer companion-dialogue
 * pipeline: hype lines are short, frequent, and must never block on or
 * collide with a companion's narration.
 */
import { selectPreferredVoice } from './voiceService.js';

const HYPE_LINES = {
  hit: ['Nice hit!', 'Boom!', 'Scrub power!', 'Take that!', 'Direct hit!'],
  streak: ['On fire!', "You're unstoppable!", 'Streak power!', 'Keep it going!', 'Combo master!'],
  miniChallengeStart: ['Bonus time!', 'Go go go!', 'Challenge time!', 'Speed round!'],
  miniChallengeWin: ['Challenge won!', 'Bonus coins!', 'Crushed it!', 'Awesome work!'],
  zoneSwitch: ['Zone cleared!', 'New zone!', 'Next spot!', 'Keep scrubbing!']
};

let announcerVoice = null;
let voiceLookupAttempted = false;
let lastHypeAt = 0;
const HYPE_GLOBAL_COOLDOWN_MS = 2200;
let hitSinceLastHype = 0;
const HIT_HYPE_EVERY_N = 6;

function isSpeechSynthesisAvailable() {
  return typeof window !== 'undefined' && !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function';
}

function getAnnouncerVoice() {
  if (!isSpeechSynthesisAvailable()) return null;
  if (announcerVoice || voiceLookupAttempted) return announcerVoice;
  voiceLookupAttempted = true;
  try {
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length) {
      announcerVoice = selectPreferredVoice(voices, 'daniel');
    }
  } catch (e) {
    announcerVoice = null;
  }
  return announcerVoice;
}

function pickLine(trigger) {
  const pool = HYPE_LINES[trigger];
  if (!pool || !pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Fire a short announcer hype line for a battle moment.
 * Silently skips (never queues/interrupts) if speech is unavailable,
 * already speaking, or within the global cooldown window.
 */
export function speakHype(trigger) {
  if (!isSpeechSynthesisAvailable()) return;
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) return;

  const nowMs = Date.now();
  if (nowMs - lastHypeAt < HYPE_GLOBAL_COOLDOWN_MS) return;

  if (trigger === 'hit') {
    hitSinceLastHype += 1;
    if (hitSinceLastHype < HIT_HYPE_EVERY_N) return;
    hitSinceLastHype = 0;
  }

  const line = pickLine(trigger);
  if (!line) return;

  try {
    const utterance = new window.SpeechSynthesisUtterance(line);
    const voice = getAnnouncerVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 1.15;
    utterance.pitch = 1.1;
    utterance.volume = 0.85;
    lastHypeAt = nowMs;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    // Fail silently -- hype lines are a non-critical polish layer.
  }
}

export function resetAnnouncerHitCounter() {
  hitSinceLastHype = 0;
}
