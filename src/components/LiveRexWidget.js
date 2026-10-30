// Interactive Floating Companion Mascot Widget (Zero-Lag Preset Phrase Rotation)
// Features:
// 1. Expressive Animated Skeletal Face Canvas (`PetSkeletalFaceViewer`) with blinks,
//    ear/horn spring physics, head tilts, and real-time phoneme lip-sync.
// 2. Zero-Lag Tap-to-Speak Rotation through parent-editable preset/seeded phrases
//    pre-cached via the self-hosted Kokoro TTS microservice.
// 3. Pure Facial Animation & Aura Ring feedback (no blocking chat modal or speech bubble).
// 4. Strict Explorer Palette compliance (zero pink or purple).

import { store } from '../state/store.js';
import { escapeHtml } from '../utils/escapeHtml.js';
import { speakCompanion, isRexSpeaking, unlockVoiceAudio, warmUpKokoroTts, prewarmPhrasesAudio } from '../services/voiceService.js';
import { Sound } from '../audio/sfx.js';
import {
  renderPetSkeletalFaceViewer,
  initPetSkeletalFaceViewer,
  getActivePetSkeletalInstance
} from './PetSkeletalFaceViewer.js';

let lastTapTimestamp = 0;
let reactionCounter = 0;
let prewarmedPetSignature = '';

export function getKidProfileName() {
  const state = store?.getState?.() || {};
  const hero = store?.getSelectedHero?.() || state?.selectedHero || (state?.heroes && state?.heroes[0]) || {};
  return hero?.name?.trim() || 'Little Hero';
}

export function playEmotionSFX(emotion) {
  const emo = (emotion || '').toLowerCase();
  if (emo === 'excited' || emo === 'playful' || emo === 'energetic') {
    Sound.roar?.();
  } else if (emo === 'proud' || emo === 'cheering') {
    Sound.pop?.();
  } else if (emo === 'sleepy' || emo === 'gentle' || emo === 'calm') {
    Sound.click?.();
  } else {
    Sound.chirp?.();
  }
}

// Preserved no-op export for backward compatibility with any external caller
export function addChatMessage() {}

/**
 * Generates dynamic Explorer-Palette SVG for Rex the Dino
 */
export function renderRexAvatarSvg({ isListening = false, isThinking = false, isSpeaking = false } = {}) {
  const pupilRadius = isListening ? '4.5' : isThinking ? '2.5' : '3.5';
  const eyeOuterRadius = isListening ? '8' : '7';

  return `
    <svg class="w-full h-full select-none" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="46" fill="#10B981" />
      <path d="M50 8C26.8 8 8 26.8 8 50C8 73.2 26.8 92 50 92C73.2 92 92 73.2 92 50C92 26.8 73.2 8 50 8Z" fill="url(#rex-grad-toddler)" />

      <!-- Spikes -->
      <path d="M28 20L34 10L40 20Z" fill="#F59E0B" />
      <path d="M44 16L50 6L56 16Z" fill="#F59E0B" />
      <path d="M60 20L66 10L72 20Z" fill="#F59E0B" />

      <!-- Snout -->
      <ellipse cx="50" cy="58" rx="26" ry="20" fill="#34D399" />

      <!-- Eyes Left -->
      <circle cx="38" cy="42" r="${eyeOuterRadius}" fill="#FFFFFF" />
      <circle cx="39" cy="42" r="${pupilRadius}" fill="#0F172A" />
      <circle cx="40" cy="40" r="1.8" fill="#FFFFFF" />

      <!-- Eyes Right -->
      <circle cx="62" cy="42" r="${eyeOuterRadius}" fill="#FFFFFF" />
      <circle cx="61" cy="42" r="${pupilRadius}" fill="#0F172A" />
      <circle cx="60" cy="40" r="1.8" fill="#FFFFFF" />

      <!-- Nostrils -->
      <circle cx="46" cy="54" r="2" fill="#059669" />
      <circle cx="54" cy="54" r="2" fill="#059669" />

      <!-- Dino Mouth -->
      ${
        isSpeaking
          ? `<ellipse cx="50" cy="65" rx="9" ry="6" fill="#065F46" />
             <path d="M45 62Q50 66 55 62" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" />`
          : `<path d="M40 64C45 70 55 70 60 64" stroke="#065F46" stroke-width="4" stroke-linecap="round" />`
      }

      <!-- Warm Solar Amber Cheeks (strictly Explorer Palette) -->
      <ellipse cx="30" cy="54" rx="4.5" ry="3" fill="#FFB961" opacity="0.8" />
      <ellipse cx="70" cy="54" rx="4.5" ry="3" fill="#FFB961" opacity="0.8" />

      <defs>
        <linearGradient id="rex-grad-toddler" x1="8" y1="8" x2="92" y2="92" gradientUnits="userSpaceOnUse">
          <stop stop-color="#10B981" />
          <stop offset="1" stop-color="#059669" />
        </linearGradient>
      </defs>
    </svg>
  `;
}

export function renderLiveRexWidget() {
  const state = store.getState();
  const liveRex = state.liveRex || {};
  const isSpeaking = Boolean(liveRex.isSpeaking) || isRexSpeaking();
  const activePet = store.getActivePet?.() || { id: 'rex', name: 'Rex the Dino', emoji: '🦖' };
  const petName = escapeHtml(activePet.name || 'Rex the Dino');
  const petId = String(activePet.id || 'rex');

  return `
    <div id="live-rex-container" class="fixed bottom-20 right-3 sm:bottom-24 sm:right-5 z-50 flex items-center justify-center select-none">
      <button
        id="live-rex-floating-btn"
        type="button"
        aria-label="Tap ${petName} for a hero cheer"
        title="Tap ${petName}"
        class="relative w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-[#09141e] border-3 ${
          isSpeaking
            ? 'border-[#00d2d3] ring-4 ring-[#10b981]/50 shadow-[0_0_24px_rgba(0,210,211,0.65)] scale-105'
            : 'border-[#10b981]/80 hover:border-[#00d2d3] shadow-[0_6px_16px_rgba(0,0,0,0.55)] hover:scale-105'
        } flex items-center justify-center p-0.5 transition-all duration-200 active:scale-90 cursor-pointer group"
      >
        <!-- Animated Aura Ripples (Visual Response Indicator - Zero Text Bubble) -->
        <span
          id="live-rex-speaking-rings"
          class="absolute -inset-1.5 rounded-full border-2 border-[#00d2d3] pointer-events-none transition-opacity duration-200 ${
            isSpeaking ? 'opacity-90 animate-ping' : 'opacity-0'
          }"
        ></span>

        <!-- Animated Procedural Skeletal Companion Face -->
        <div class="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-[#0f2334] pointer-events-none">
          ${renderPetSkeletalFaceViewer({
            canvasId: 'floating-mascot-skeletal-canvas',
            petId,
            width: 48,
            height: 48,
            isInteractive: false,
            className: 'w-full h-full pointer-events-none'
          })}
        </div>

        <!-- Subtle Audio Motion Badge -->
        <div
          id="live-rex-status-badge"
          class="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-md border-2 border-[#09141e] pointer-events-none transition-all ${
            isSpeaking
              ? 'bg-[#00d2d3] text-slate-950 animate-bounce'
              : 'bg-[#10b981] text-slate-950 group-hover:bg-[#ffb961]'
          }"
        >
          <span class="material-symbols-outlined text-[12px]">${isSpeaking ? 'volume_up' : 'pets'}</span>
        </div>
      </button>
    </div>
  `;
}

function syncFloatingWidgetVisualState(speaking) {
  const btn = document.getElementById('live-rex-floating-btn');
  const rings = document.getElementById('live-rex-speaking-rings');
  const badge = document.getElementById('live-rex-status-badge');
  const floatRig = getActivePetSkeletalInstance('floating-mascot-skeletal-canvas');

  if (speaking) {
    floatRig?.startSpeaking?.();
    if (btn) {
      btn.classList.remove('border-[#10b981]/80');
      btn.classList.add('border-[#00d2d3]', 'ring-4', 'ring-[#10b981]/50', 'shadow-[0_0_24px_rgba(0,210,211,0.65)]', 'scale-105');
    }
    if (rings) {
      rings.classList.remove('opacity-0');
      rings.classList.add('opacity-90', 'animate-ping');
    }
    if (badge) {
      badge.className = 'absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-md border-2 border-[#09141e] pointer-events-none transition-all bg-[#00d2d3] text-slate-950 animate-bounce';
      badge.innerHTML = '<span class="material-symbols-outlined text-[12px]">volume_up</span>';
    }
  } else {
    floatRig?.stopSpeaking?.();
    if (btn) {
      btn.classList.remove('border-[#00d2d3]', 'ring-4', 'ring-[#10b981]/50', 'shadow-[0_0_24px_rgba(0,210,211,0.65)]', 'scale-105');
      btn.classList.add('border-[#10b981]/80');
    }
    if (rings) {
      rings.classList.remove('opacity-90', 'animate-ping');
      rings.classList.add('opacity-0');
    }
    if (badge) {
      badge.className = 'absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-md border-2 border-[#09141e] pointer-events-none transition-all bg-[#10b981] text-slate-950 group-hover:bg-[#ffb961]';
      badge.innerHTML = '<span class="material-symbols-outlined text-[12px]">pets</span>';
    }
  }
}

export function attachLiveRexWidgetListeners() {
  if (typeof document === 'undefined') return;
  const floatingBtn = document.getElementById('live-rex-floating-btn');
  if (!floatingBtn) return;

  const activePet = store.getActivePet?.() || { id: 'rex', name: 'Rex the Dino' };
  const activePetId = String(activePet.id || 'rex');

  // 1. Mount skeletal face rig on the floating companion disc
  const rig = initPetSkeletalFaceViewer('floating-mascot-skeletal-canvas', {
    petId: activePetId,
    isInteractive: false
  });
  if (isRexSpeaking()) {
    rig?.startSpeaking?.();
  }

  // 2. Warm up Kokoro TTS & pre-cache all preset/custom phrases for the active pet
  warmUpKokoroTts();
  const phrases = (store.getCompanionPhrases?.() || []).map((p) => p.text).filter(Boolean);
  const sig = `${activePetId}:${phrases.length}`;
  if (sig !== prewarmedPetSignature && phrases.length > 0) {
    prewarmedPetSignature = sig;
    setTimeout(() => {
      prewarmPhrasesAudio(phrases, activePetId).catch(() => {});
    }, 300);
  }

  // 3. Zero-Lag Tap-to-Speak Handler (Random Preset Phrase + Expressive Facial Animation)
  floatingBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const now = Date.now();
    if (now - lastTapTimestamp < 220) return;
    lastTapTimestamp = now;

    unlockVoiceAudio();

    const currentPet = store.getActivePet?.() || { id: 'rex' };
    const petId = String(currentPet.id || 'rex');
    const picked = store.pickRandomCompanionPhrase?.() || {
      id: 'cp_default',
      category: 'encouragement',
      text: 'Rawr! You are doing an amazing job today, Little Hero!'
    };

    const kidName = getKidProfileName();
    const spokenText = String(picked.text || '').replace(/\{name\}/gi, kidName);

    // Trigger tactile facial expression (alternating forehead pat & cheek poke joy) + lip-sync
    const floatRig = getActivePetSkeletalInstance('floating-mascot-skeletal-canvas');
    reactionCounter++;
    if (reactionCounter % 2 === 0) {
      floatRig?.triggerCheekPoke?.();
    } else {
      floatRig?.triggerForeheadPat?.();
    }
    playEmotionSFX(picked.category === 'playful' ? 'playful' : 'proud');
    syncFloatingWidgetVisualState(true);

    speakCompanion(spokenText, petId, () => {
      syncFloatingWidgetVisualState(false);
    });
  };

  // 4. Global Speech Lip-Sync Listeners (keeps facial rig animated for ALL app voice lines)
  if (typeof window !== 'undefined') {
    if (window._liveRexCompanionSpeechStart) {
      window.removeEventListener('companion-speech-start', window._liveRexCompanionSpeechStart);
    }
    if (window._liveRexCompanionSpeechEnd) {
      window.removeEventListener('companion-speech-end', window._liveRexCompanionSpeechEnd);
    }
    window._liveRexCompanionSpeechStart = () => syncFloatingWidgetVisualState(true);
    window._liveRexCompanionSpeechEnd = () => syncFloatingWidgetVisualState(false);
    window.addEventListener('companion-speech-start', window._liveRexCompanionSpeechStart);
    window.addEventListener('companion-speech-end', window._liveRexCompanionSpeechEnd);
  }
}
