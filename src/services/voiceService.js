// Rex the Dino Spoken Voice Guidance Service
// Dual-Engine Architecture:
// 1. Primary: ElevenLabs Audio via Cloudflare Worker Proxy
// 2. Resilient Fallback: Cartoon Dino Client-Side Speech Synthesis (pitch: 1.28, rate: 0.93)
// 3. Browser Autoplay & Gesture Unlock Queue

const PROXY_URL = 'https://rex-voice-proxy.recklesswarman.workers.dev';

let currentAudio = null;
let activeUtterance = null;
let hasUserInteracted = false;
let pendingUnlockSpeech = null;

// Track first user gesture to unlock Web Audio & SpeechSynthesis
if (typeof window !== 'undefined') {
  const handleFirstInteraction = () => {
    hasUserInteracted = true;

    // If SpeechSynthesis is available, wake it up
    if ('speechSynthesis' in window && window.speechSynthesis.paused) {
      try {
        window.speechSynthesis.resume();
      } catch {
        // Ignore
      }
    }

    // Play any queued toddler speech that was blocked prior to first touch
    if (pendingUnlockSpeech) {
      const { text, onEnded } = pendingUnlockSpeech;
      pendingUnlockSpeech = null;
      speakRex(text, onEnded).catch(() => {});
    }
  };

  window.addEventListener('pointerdown', handleFirstInteraction, { passive: true });
  window.addEventListener('touchstart', handleFirstInteraction, { passive: true });
  window.addEventListener('click', handleFirstInteraction, { passive: true });
  window.addEventListener('keydown', handleFirstInteraction, { passive: true });

  // Pre-load synthesis voices if available
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      // Voices populated
    };
  }
}

/**
 * Stops all currently active Rex voice output (both audio element and speech synthesis)
 */
export const stopRex = () => {
  // 1. Stop HTML5 audio
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {
      // Ignore pause error
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
};

/**
 * Check if Rex is currently playing audio or speaking
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

/**
 * Fallback to browser SpeechSynthesis with cartoon dino voice parameters
 */
function speakWithSpeechSynthesis(text, onEnded = null) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnded) onEnded();
    return;
  }

  try {
    // Cancel any stuck utterances
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Natural English voice selection for Rex the Dino - switched to "Daniel"
    const voices = window.speechSynthesis.getVoices() || [];
    const englishVoices = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));

    // 1. Prioritize voice "Daniel" (e.g. Daniel, Microsoft Daniel, Daniel (Natural), Apple Daniel)
    let preferredVoice = englishVoices.find((v) => v.name.toLowerCase().includes('daniel'));
    if (!preferredVoice) {
      preferredVoice = voices.find((v) => v.name.toLowerCase().includes('daniel'));
    }

    // 2. Resilient fallback to other natural English voices if Daniel is not installed on device
    if (!preferredVoice) {
      preferredVoice = englishVoices.find((v) => {
        const name = v.name.toLowerCase();
        return (
          name.includes('natural') ||
          name.includes('google us') ||
          name.includes('samantha') ||
          name.includes('karen') ||
          name.includes('junior')
        );
      }) || englishVoices[0] || voices[0];
    }

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    // Cartoon Dino Voice Pitch & Cadence Tuning (energetic, clear for toddlers)
    utterance.pitch = 1.28;
    utterance.rate = 0.93;
    utterance.volume = 1.0;

    // Retain module-level reference to prevent V8 GC from stopping speech mid-sentence
    activeUtterance = utterance;

    utterance.onend = () => {
      activeUtterance = null;
      if (typeof onEnded === 'function') {
        try {
          onEnded();
        } catch (e) {
          console.error('Error in Rex onEnded callback:', e);
        }
      }
    };

    utterance.onerror = (e) => {
      // If cancelled intentionally via stopRex(), do not treat as error
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.debug('SpeechSynthesis notice:', e.error);
      }
      activeUtterance = null;
      if (typeof onEnded === 'function') {
        try {
          onEnded();
        } catch {
          // Ignore
        }
      }
    };

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('SpeechSynthesis fallback error:', err);
    if (typeof onEnded === 'function') onEnded();
  }
}

/**
 * Main Spoken Voice Entrypoint for Rex the Dino
 * Tries ElevenLabs via Cloudflare Worker proxy, automatically falling back
 * to the Cartoon Dino Speech Synthesizer if offline, rate limited, 402, or erroring.
 */
export const speakRex = async (text, onEnded = null) => {
  if (!text || typeof text !== 'string' || !text.trim()) return;
  const cleanText = text.trim();

  // Cut off active playback immediately to prevent overlapping lines
  stopRex();

  // If user has not interacted yet, queue this speech so it fires on their first tap
  if (!hasUserInteracted) {
    pendingUnlockSpeech = { text: cleanText, onEnded };
  }

  // 1. Attempt Cloudflare Worker ElevenLabs Proxy
  let proxySucceeded = false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2600); // 2.6s fast timeout

    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: cleanText }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const audioBlob = await response.blob();
      if (audioBlob && audioBlob.size > 0) {
        const audioUrl = URL.createObjectURL(audioBlob);
        currentAudio = new Audio(audioUrl);

        if (onEnded) {
          currentAudio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            currentAudio = null;
            onEnded();
          };
        } else {
          currentAudio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            currentAudio = null;
          };
        }

        await currentAudio.play();
        proxySucceeded = true;
      }
    }
  } catch {
    // Proxy failed (e.g. 402 payment required, network timeout, offline, or autoplay blocked)
    proxySucceeded = false;
  }

  // 2. Seamless Client-Side Cartoon Dino Voice Fallback
  if (!proxySucceeded) {
    speakWithSpeechSynthesis(cleanText, onEnded);
  }
};
