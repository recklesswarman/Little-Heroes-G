// Pet Companion & Rex the Dino Spoken Voice Guidance Service
// Dual-Engine Architecture:
// 1. Primary: ElevenLabs Audio via Cloudflare Worker Proxy
// 2. Resilient Fallback: High-Fidelity Cartoon Speech Synthesis with device-native 'Daniel' voice
// 3. Multi-Pet Pitch & Persona Tuning (Rex the Dino, Aqua Drake, Bella, Barnaby, Pip)
// 4. Browser Autoplay & Gesture Pre-Unlock Engine

import { store } from '../state/store.js';

const PROXY_URL = 'https://rex-voice-proxy.recklesswarman.workers.dev';

export const COMPANION_VOICE_PROFILES = {
  rex: {
    id: 'rex',
    name: 'Rex the Dino',
    pitch: 1.30,
    rate: 0.95,
    volume: 1.0,
    preferredVoice: 'daniel'
  },
  aqua_drake: {
    id: 'aqua_drake',
    name: 'Aqua Drake',
    pitch: 1.05,
    rate: 0.92,
    volume: 1.0,
    preferredVoice: 'daniel'
  },
  aqua: {
    id: 'aqua',
    name: 'Aqua Drake',
    pitch: 1.05,
    rate: 0.92,
    volume: 1.0,
    preferredVoice: 'daniel'
  },
  bella: {
    id: 'bella',
    name: 'Bella the Bunny',
    pitch: 1.45,
    rate: 1.05,
    volume: 1.0,
    preferredVoice: 'daniel'
  },
  barnaby: {
    id: 'barnaby',
    name: 'Barnaby the Bear',
    pitch: 0.85,
    rate: 0.90,
    volume: 1.0,
    preferredVoice: 'daniel'
  },
  pip: {
    id: 'pip',
    name: 'Pip the Phoenix',
    pitch: 1.35,
    rate: 1.00,
    volume: 1.0,
    preferredVoice: 'daniel'
  }
};

let currentAudio = null;
let activeUtterance = null;
let hasUserInteracted = false;
let pendingUnlockSpeech = null;
let audioContextUnlocked = false;
let sharedAudioContext = null;

function dispatchSpeechEvent(eventName, detail = {}) {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(eventName, { detail }));
    } catch {}
  }
}

/**
 * Clean stage-direction asterisks and sound action cues (*ROAR!*, *Splish splash!*)
 * so speech synthesizers speak natural, fluid words without reading punctuation aloud.
 */
export function cleanDialogueText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\*.*?\*/g, ' ')
    .replace(/\[.*?\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Track user gesture to pre-unlock Web Audio and SpeechSynthesis on mobile/WebKit
 */
if (typeof window !== 'undefined') {
  const handleFirstInteraction = () => {
    hasUserInteracted = true;
    unlockVoiceAudio();

    // Play any queued speech blocked prior to first touch
    if (pendingUnlockSpeech) {
      const { text, petId, onEnded } = pendingUnlockSpeech;
      pendingUnlockSpeech = null;
      speakCompanion(text, petId, onEnded).catch(() => {});
    }
  };

  window.addEventListener('pointerdown', handleFirstInteraction, { passive: true });
  window.addEventListener('touchstart', handleFirstInteraction, { passive: true });
  window.addEventListener('click', handleFirstInteraction, { passive: true });
  window.addEventListener('keydown', handleFirstInteraction, { passive: true });

  // Pre-load synthesis voices if available
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      // Voices loaded into browser cache
    };
  }
}

/**
 * Actively pre-unlocks browser audio pipelines on user tap/interaction
 */
export function unlockVoiceAudio() {
  if (typeof window === 'undefined') return;

  // 1. Resume SpeechSynthesis
  if ('speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      // Prime with silent utterance to activate iOS WebKit audio session
      const silent = new SpeechSynthesisUtterance('');
      silent.volume = 0;
      window.speechSynthesis.speak(silent);
    } catch {
      // Ignore
    }
  }

  // 2. Unlock Web Audio Context
  if (!audioContextUnlocked) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
          sharedAudioContext = new AudioCtx();
        }
        if (sharedAudioContext.state === 'suspended') {
          sharedAudioContext.resume().catch(() => {});
        }
        audioContextUnlocked = true;
      }
    } catch {
      // Ignore
    }
  }
}

/**
 * Stops all currently playing companion voice audio and speech synthesis
 */
export const stopRex = () => {
  // 1. Stop HTML5 audio element
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {
      // Ignore
    }
    currentAudio = null;
  }

  // 2. Stop browser speech synthesis
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
  activeUtterance = null;
  dispatchSpeechEvent('companion-speech-end');
};

export const stopCompanionAudio = stopRex;

/**
 * Check if the companion is currently playing audio or speaking
 */
export const isRexSpeaking = () => {
  if (currentAudio && !currentAudio.paused && !currentAudio.ended) {
    return true;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
    return true;
  }
  return false;
};

export const isCompanionSpeaking = isRexSpeaking;

/**
 * Select preferred speech synthesis voice prioritizing 'Daniel'
 */
export function selectPreferredVoice(preferredName = 'daniel') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  const voices = window.speechSynthesis.getVoices() || [];
  if (voices.length === 0) return null;

  const englishVoices = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
  const target = (preferredName || 'daniel').toLowerCase();

  // 1. Strict match for preferred voice name (e.g. Daniel, Microsoft Daniel, Apple Daniel)
  let found = englishVoices.find((v) => v.name.toLowerCase().includes(target));
  if (found) return found;

  found = voices.find((v) => v.name.toLowerCase().includes(target));
  if (found) return found;

  // 2. High-quality natural English fallbacks
  found = englishVoices.find((v) => {
    const name = v.name.toLowerCase();
    return (
      name.includes('natural') ||
      name.includes('google us') ||
      name.includes('samantha') ||
      name.includes('junior') ||
      name.includes('karen') ||
      name.includes('arthur')
    );
  });
  if (found) return found;

  // 3. First English voice or default voice
  return englishVoices[0] || voices[0] || null;
}

/**
 * Gets voice parameters for the given pet companion
 */
export function getCompanionVoiceParams(petId = 'rex') {
  const normId = String(petId || 'rex').toLowerCase().replace(/\s+/g, '_');
  return COMPANION_VOICE_PROFILES[normId] || COMPANION_VOICE_PROFILES.rex;
}

/**
 * Client-Side Cartoon Speech Synthesis with Daniel voice priority & pet tuning
 */
function speakWithSpeechSynthesis(text, petId = 'rex', onEnded = null) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (typeof onEnded === 'function') onEnded();
    return;
  }

  const cleanSpokenText = cleanDialogueText(text);
  if (!cleanSpokenText) {
    if (typeof onEnded === 'function') onEnded();
    return;
  }

  try {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanSpokenText);
    const profile = getCompanionVoiceParams(petId);

    // Natural English voice selection prioritizing 'Daniel'
    const chosenVoice = selectPreferredVoice(profile.preferredVoice || 'daniel');
    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    utterance.pitch = profile.pitch || 1.30;
    utterance.rate = profile.rate || 0.95;
    utterance.volume = profile.volume || 1.0;

    // Retain module-level reference to prevent V8 GC from stopping speech mid-sentence
    activeUtterance = utterance;

    // Dispatch speech start for skeletal face lip-sync
    dispatchSpeechEvent('companion-speech-start', { text: cleanSpokenText, petId });

    // Syllable boundary event for real-time phoneme mouth sync
    utterance.onboundary = (e) => {
      dispatchSpeechEvent('companion-speech-syllable', { text: cleanSpokenText, petId, charIndex: e.charIndex });
    };

    utterance.onend = () => {
      activeUtterance = null;
      dispatchSpeechEvent('companion-speech-end', { petId });
      if (typeof onEnded === 'function') {
        try {
          onEnded();
        } catch (e) {
          console.error('Error in voice onEnded callback:', e);
        }
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.debug('SpeechSynthesis notice:', e.error);
      }
      activeUtterance = null;
      dispatchSpeechEvent('companion-speech-end', { petId });
      if (typeof onEnded === 'function') {
        try {
          onEnded();
        } catch {}
      }
    };

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('SpeechSynthesis error:', err);
    if (typeof onEnded === 'function') onEnded();
  }
}

/**
 * Unified Spoken Voice Entrypoint for Pet Companions
 * 1. Prepares dialogue text by stripping asterisks/stage directions.
 * 2. Attempts Cloudflare Worker ElevenLabs Proxy with fast timeout (1.8s).
 * 3. Gracefully and seamlessly falls back to Daniel SpeechSynthesis if offline, rate limited, or errored.
 */
export const speakCompanion = async (text, petIdOrOptions = 'rex', onEnded = null) => {
  if (!text || typeof text !== 'string' || !text.trim()) return;

  let petId = 'rex';
  let callback = onEnded;

  if (typeof petIdOrOptions === 'string') {
    petId = petIdOrOptions;
  } else if (typeof petIdOrOptions === 'function') {
    callback = petIdOrOptions;
  } else if (petIdOrOptions && typeof petIdOrOptions === 'object') {
    petId = petIdOrOptions.petId || 'rex';
    if (petIdOrOptions.onEnded) callback = petIdOrOptions.onEnded;
  }

  // If no explicit petId given or default rex, check active pet in store
  if (!petId || petId === 'rex') {
    try {
      const active = store?.getActivePet?.();
      if (active?.id) petId = active.id;
    } catch {}
  }

  const cleanSpoken = cleanDialogueText(text);
  if (!cleanSpoken) return;

  // Immediately stop any prior speech output
  stopRex();

  // If user has not interacted yet, queue speech so it fires on their first tap
  if (!hasUserInteracted) {
    pendingUnlockSpeech = { text: cleanSpoken, petId, onEnded: callback };
  }

  // 1. Attempt Cloudflare Worker ElevenLabs Proxy (Fast 1.8s timeout)
  let proxySucceeded = false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800);

    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: cleanSpoken, petId }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const audioBlob = await response.blob();
      if (audioBlob && audioBlob.size > 0) {
        const audioUrl = URL.createObjectURL(audioBlob);
        currentAudio = new Audio(audioUrl);
        dispatchSpeechEvent('companion-speech-start', { text: cleanSpoken, petId });

        let syllableInterval = setInterval(() => {
          if (!currentAudio || currentAudio.paused || currentAudio.ended) {
            clearInterval(syllableInterval);
            return;
          }
          dispatchSpeechEvent('companion-speech-syllable', { text: cleanSpoken, petId });
        }, 115);

        currentAudio.onended = () => {
          clearInterval(syllableInterval);
          URL.revokeObjectURL(audioUrl);
          currentAudio = null;
          dispatchSpeechEvent('companion-speech-end', { petId });
          if (typeof callback === 'function') callback();
        };

        currentAudio.onerror = () => {
          clearInterval(syllableInterval);
          URL.revokeObjectURL(audioUrl);
          currentAudio = null;
          // Fallback to speech synthesis if audio playback errors
          speakWithSpeechSynthesis(cleanSpoken, petId, callback);
        };

        await currentAudio.play();
        proxySucceeded = true;
      }
    }
  } catch {
    // Proxy failed (e.g. 402 payment required, network timeout, offline, or autoplay blocked)
    proxySucceeded = false;
  }

  // 2. Resilient Client-Side Speech Synthesis Fallback (Daniel Voice)
  if (!proxySucceeded) {
    speakWithSpeechSynthesis(cleanSpoken, petId, callback);
  }
};

/**
 * Flagship alias for backward compatibility across existing calls
 */
export const speakRex = async (text, onEnded = null) => {
  return speakCompanion(text, 'rex', onEnded);
};
