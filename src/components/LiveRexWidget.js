// Interactive Floating Rex the Dino Mascot & Toddler Voice Widget
// Features giant tap-to-talk avatar, auto-audio unlock, animated waveforms,
// sound cues, and oversized picture quick-actions for 3-4 year olds.

import { store } from '../state/store.js';
import { geminiLiveService } from '../services/geminiLiveService.js';
import { Sound } from '../audio/sfx.js';
import { triggerInteractiveCelebration } from './InteractiveCelebrationOverlay.js';
import { rexEngine } from '../services/rexCompanionEngine.js';

/**
 * Generates dynamic SVG for Rex the Dino with expressions for listening, thinking, and speaking
 */
export function renderRexAvatarSvg({ isListening = false, isThinking = false, isSpeaking = false } = {}) {
  // Dynamic eye pupil sizes
  const pupilRadius = isListening ? "4.5" : isThinking ? "2.5" : "3.5";
  const eyeOuterRadius = isListening ? "8" : "7";

  return `
    <svg class="w-full h-full select-none" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="46" fill="#10B981" />
      <path d="M50 8C26.8 8 8 26.8 8 50C8 73.2 26.8 92 50 92C73.2 92 92 73.2 92 50C92 26.8 73.2 8 50 8Z" fill="url(#rex-grad-toddler)" />
      
      <!-- Spikes -->
      <path d="M28 20L34 10L40 20Z" fill="#F59E0B" />
      <path d="M44 16L50 6L56 16Z" fill="#F59E0B" />
      <path d="M60 20L66 10L72 20Z" fill="#F59E0B" />
      
      <!-- Cheeks & Snout -->
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
      
      <!-- Dino Mouth (Opens dynamically when speaking) -->
      ${
        isSpeaking
          ? `<ellipse cx="50" cy="65" rx="9" ry="6" fill="#065F46" />
             <path d="M45 62Q50 66 55 62" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" />`
          : isListening
          ? `<path d="M38 63C44 72 56 72 62 63" stroke="#065F46" stroke-width="4.5" stroke-linecap="round" />`
          : `<path d="M40 64C45 70 55 70 60 64" stroke="#065F46" stroke-width="4" stroke-linecap="round" />`
      }
      
      <!-- Rosie Cheeks -->
      <ellipse cx="30" cy="54" rx="4.5" ry="3" fill="#F87171" opacity="0.75" />
      <ellipse cx="70" cy="54" rx="4.5" ry="3" fill="#F87171" opacity="0.75" />
      
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
  const liveRex = state.liveRex || {
    isOpen: false,
    isConnected: false,
    isListening: false,
    isSpeaking: false,
    status: 'idle',
    statusMessage: '',
    lastUserTranscript: '',
    lastRexTranscript: ''
  };

  const isSpeaking = liveRex.isSpeaking || rexEngine.currentState === 'talking';
  const isListening = liveRex.isListening || rexEngine.currentState === 'listening';
  const isThinking = rexEngine.currentState === 'thinking';
  const isOpen = liveRex.isOpen;

  return `
    <!-- Floating Mascot Container -->
    <div id="live-rex-container" class="fixed bottom-24 right-4 sm:bottom-28 sm:right-6 z-40 flex flex-col items-end pointer-events-none select-none">
      
      <!-- Expanded Toddler Live Voice Sheet -->
      ${
        isOpen
          ? `
        <div id="live-rex-modal-card" class="pointer-events-auto bg-surface-container rounded-4xl border-4 border-primary/50 shadow-2xl p-5 mb-3 w-[94vw] max-w-sm flex flex-col gap-4 animate-scale-up backdrop-blur-xl">
          
          <!-- Card Header with Close Button -->
          <div class="flex items-center justify-between border-b-2 border-surface-container-highest pb-2">
            <div class="flex items-center gap-2">
              <span class="text-xl">🦖</span>
              <h3 class="font-headline text-lg font-black text-inverse-surface">Rex the Dino</h3>
            </div>

            <!-- Minimize / Close Button -->
            <button id="live-rex-close-btn" class="w-8 h-8 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface-variant flex items-center justify-center chunky-btn-sm active:scale-95" title="Close Rex Window">
              <span class="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          <!-- GIANT TAP-TO-TALK MASCOT HERO SECTION -->
          <div class="flex flex-col items-center justify-center pt-1 pb-2">
            <button id="modal-rex-avatar-btn" class="group relative p-1.5 rounded-full transition-transform active:scale-90 focus:outline-none cursor-pointer" title="Tap Rex to Talk!">
              
              <!-- Ambient Glow & Rings -->
              ${
                isListening
                  ? `<div class="absolute -inset-2.5 rounded-full bg-emerald-400/40 animate-ping pointer-events-none"></div>
                     <div class="absolute -inset-1 rounded-full bg-emerald-300/30 animate-pulse pointer-events-none"></div>`
                  : isThinking
                  ? `<div class="absolute -inset-2 rounded-full border-4 border-dashed border-amber-400 animate-spin pointer-events-none"></div>`
                  : isSpeaking
                  ? `<div class="absolute -inset-2.5 rounded-full bg-primary/30 animate-pulse pointer-events-none"></div>`
                  : ''
              }

              <!-- Giant Mascot Avatar Disc (112px on mobile, 128px on sm) -->
              <div class="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-surface-container-high p-1.5 shadow-2xl flex items-center justify-center transition-all ${
                isListening
                  ? 'animate-bounce ring-4 ring-emerald-400 border-4 border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.7)]'
                  : isThinking
                  ? 'ring-4 ring-amber-400 border-4 border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.6)]'
                  : isSpeaking
                  ? 'ring-4 ring-primary border-4 border-primary shadow-[0_0_25px_rgba(16,185,129,0.6)]'
                  : 'border-4 border-primary/40 hover:border-primary group-hover:scale-105'
              }">
                ${renderRexAvatarSvg({ isListening, isThinking, isSpeaking })}
              </div>

              <!-- Action Indicator Pill -->
              <div class="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-headline font-black shadow-lg flex items-center gap-1.5 whitespace-nowrap ${
                isListening
                  ? 'bg-emerald-500 text-white animate-pulse'
                  : isThinking
                  ? 'bg-amber-500 text-white animate-bounce'
                  : isSpeaking
                  ? 'bg-primary text-on-primary'
                  : 'bg-secondary text-on-secondary hover:brightness-110'
              }">
                <span class="material-symbols-outlined text-xs">${
                  isListening ? 'mic' : isThinking ? 'hourglass_top' : isSpeaking ? 'volume_up' : 'touch_app'
                }</span>
                <span>${
                  isListening ? 'Listening...' : isThinking ? 'Thinking...' : isSpeaking ? 'Talking!' : 'Tap to Talk!'
                }</span>
              </div>
            </button>

            <!-- Status Subtitle -->
            <p id="rex-status-text" class="text-xs font-headline font-bold text-on-surface-variant mt-5 text-center">
              ${
                isListening
                  ? '👂 Speak now! Rex is listening to you!'
                  : isThinking
                  ? '🤔 Rex is getting your answer ready...'
                  : isSpeaking
                  ? '🦖 Rex is speaking!'
                  : 'Tap Rex\'s face or choose a picture below!'
              }
            </p>
          </div>

          <!-- Real-Time Waveform Visualizer -->
          <div class="bg-surface-container-lowest rounded-2xl p-2.5 border-2 border-surface-container-highest flex items-center justify-center gap-1.5 shadow-inner">
            <div class="flex items-center justify-center gap-1.5 h-7 w-full" id="rex-waveform-bars">
              <div class="rex-wave-bar w-2 bg-primary rounded-full transition-all duration-75 ${isSpeaking ? 'animate-pulse' : ''} h-2" data-bar="0"></div>
              <div class="rex-wave-bar w-2 bg-primary rounded-full transition-all duration-75 ${isSpeaking ? 'animate-pulse' : ''} h-4" data-bar="1"></div>
              <div class="rex-wave-bar w-2 bg-secondary rounded-full transition-all duration-75 ${isSpeaking ? 'animate-pulse' : ''} h-6" data-bar="2"></div>
              <div class="rex-wave-bar w-2 bg-primary rounded-full transition-all duration-75 ${isSpeaking ? 'animate-pulse' : ''} h-5" data-bar="3"></div>
              <div class="rex-wave-bar w-2 bg-secondary rounded-full transition-all duration-75 ${isSpeaking ? 'animate-pulse' : ''} h-6" data-bar="4"></div>
              <div class="rex-wave-bar w-2 bg-primary rounded-full transition-all duration-75 ${isSpeaking ? 'animate-pulse' : ''} h-4" data-bar="5"></div>
              <div class="rex-wave-bar w-2 bg-primary rounded-full transition-all duration-75 ${isSpeaking ? 'animate-pulse' : ''} h-2" data-bar="6"></div>
            </div>
          </div>

          <!-- Dialogue Transcript (Short & Sweet) -->
          ${
            liveRex.lastUserTranscript || liveRex.lastRexTranscript
              ? `
            <div class="flex flex-col gap-1.5 max-h-32 overflow-y-auto pr-1 hide-scrollbar">
              ${
                liveRex.lastUserTranscript
                  ? `
                <div class="bg-surface-container-high rounded-2xl rounded-tr-sm p-2 text-xs font-bold text-inverse-surface border border-surface-container-highest self-end max-w-[90%] shadow-sm">
                  <span class="text-[9px] uppercase font-black text-secondary block">You:</span>
                  "${liveRex.lastUserTranscript}"
                </div>
              `
                  : ''
              }
              ${
                liveRex.lastRexTranscript
                  ? `
                <div class="bg-primary/15 rounded-2xl rounded-tl-sm p-2 text-xs font-bold text-inverse-surface border border-primary/30 self-start max-w-[90%] shadow-sm">
                  <span class="text-[9px] uppercase font-black text-primary block flex items-center gap-1">
                    <span>🦖 Rex:</span>
                  </span>
                  "${liveRex.lastRexTranscript}"
                </div>
              `
                  : ''
              }
            </div>
          `
              : ''
          }

          <!-- PICTURE QUICK-ACTIONS (No Reading Required for Toddlers) -->
          <div class="flex flex-col gap-1.5">
            <span class="text-[10px] font-black uppercase text-on-surface-variant text-center tracking-wider">Quick Picture Actions</span>
            <div class="grid grid-cols-3 gap-2">
              
              <!-- 1. ROAR -->
              <button data-rex-prompt="Make your best dino roar!" class="rex-toddler-action-btn bg-gradient-to-b from-emerald-500/20 to-emerald-500/10 hover:from-emerald-500/30 hover:to-emerald-500/20 text-inverse-surface border-2 border-emerald-500/40 rounded-2xl p-2 flex flex-col items-center justify-center gap-1 chunky-btn active:scale-90 transition-all shadow-sm">
                <span class="text-2xl sm:text-3xl">🦖</span>
                <span class="font-headline text-[11px] font-black text-emerald-400">ROAR!</span>
              </button>

              <!-- 2. TEETH -->
              <button data-rex-prompt="I brushed my teeth!" class="rex-toddler-action-btn bg-gradient-to-b from-sky-500/20 to-sky-500/10 hover:from-sky-500/30 hover:to-sky-500/20 text-inverse-surface border-2 border-sky-500/40 rounded-2xl p-2 flex flex-col items-center justify-center gap-1 chunky-btn active:scale-90 transition-all shadow-sm">
                <span class="text-2xl sm:text-3xl">🪥</span>
                <span class="font-headline text-[11px] font-black text-sky-400">Teeth!</span>
              </button>

              <!-- 3. YAY / HIGH FIVE -->
              <button data-rex-prompt="High five Rex!" class="rex-toddler-action-btn bg-gradient-to-b from-amber-500/20 to-amber-500/10 hover:from-amber-500/30 hover:to-amber-500/20 text-inverse-surface border-2 border-amber-500/40 rounded-2xl p-2 flex flex-col items-center justify-center gap-1 chunky-btn active:scale-90 transition-all shadow-sm">
                <span class="text-2xl sm:text-3xl">⭐</span>
                <span class="font-headline text-[11px] font-black text-amber-400">Yay!</span>
              </button>

              <!-- 4. CLEAN TOYS -->
              <button data-rex-prompt="I cleaned up all my toys!" class="rex-toddler-action-btn bg-gradient-to-b from-purple-500/20 to-purple-500/10 hover:from-purple-500/30 hover:to-purple-500/20 text-inverse-surface border-2 border-purple-500/40 rounded-2xl p-2 flex flex-col items-center justify-center gap-1 chunky-btn active:scale-90 transition-all shadow-sm">
                <span class="text-2xl sm:text-3xl">🧸</span>
                <span class="font-headline text-[11px] font-black text-purple-400">Toys!</span>
              </button>

              <!-- 5. HEALTHY SNACK -->
              <button data-rex-prompt="I ate my healthy snack!" class="rex-toddler-action-btn bg-gradient-to-b from-rose-500/20 to-rose-500/10 hover:from-rose-500/30 hover:to-rose-500/20 text-inverse-surface border-2 border-rose-500/40 rounded-2xl p-2 flex flex-col items-center justify-center gap-1 chunky-btn active:scale-90 transition-all shadow-sm">
                <span class="text-2xl sm:text-3xl">🍎</span>
                <span class="font-headline text-[11px] font-black text-rose-400">Snack!</span>
              </button>

              <!-- 6. DRINK WATER -->
              <button data-rex-prompt="I drank fresh water!" class="rex-toddler-action-btn bg-gradient-to-b from-blue-500/20 to-blue-500/10 hover:from-blue-500/30 hover:to-blue-500/20 text-inverse-surface border-2 border-blue-500/40 rounded-2xl p-2 flex flex-col items-center justify-center gap-1 chunky-btn active:scale-90 transition-all shadow-sm">
                <span class="text-2xl sm:text-3xl">💧</span>
                <span class="font-headline text-[11px] font-black text-blue-400">Water!</span>
              </button>

            </div>
          </div>

          <!-- Bottom Toggle Microphone Bar -->
          <div class="flex items-center gap-2 pt-1 border-t border-surface-container-highest">
            <button id="live-rex-toggle-btn" class="flex-1 py-3 px-4 rounded-2xl font-headline text-xs font-black flex items-center justify-center gap-2 chunky-btn shadow-md active:scale-95 transition-all ${
              isListening
                ? 'bg-emerald-500 text-white border-emerald-600 animate-pulse'
                : 'bg-primary text-on-primary border-primary-container'
            }">
              <span class="material-symbols-outlined text-base">${isListening ? 'mic' : 'mic_none'}</span>
              <span>${isListening ? 'Listening (Tap to Stop)' : 'Start Microphone'}</span>
            </button>
          </div>

        </div>
      `
          : ''
      }

      <!-- Floating Mascot Icon Button -->
      <button id="live-rex-floating-btn" class="pointer-events-auto relative group chunky-btn active:scale-90 focus:outline-none transition-transform" title="Tap to talk to Rex the Dino!">
        
        <!-- Ripple Effect Animations when Listening or Speaking -->
        ${
          isSpeaking
            ? `
          <div class="absolute -inset-3 rounded-full bg-primary/30 animate-ping pointer-events-none"></div>
          <div class="absolute -inset-1.5 rounded-full bg-secondary/40 animate-pulse pointer-events-none"></div>
        `
            : isListening
            ? `
          <div class="absolute -inset-2.5 rounded-full bg-emerald-400/30 animate-pulse pointer-events-none"></div>
        `
            : ''
        }

        <!-- Mascot Avatar Disc -->
        <div class="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-surface-container border-4 ${
          isSpeaking ? 'border-primary ring-4 ring-primary/40' : isListening ? 'border-emerald-400 ring-4 ring-emerald-400' : 'border-primary/50'
        } p-1 shadow-2xl flex items-center justify-center transition-all">
          ${renderRexAvatarSvg({ isListening, isThinking, isSpeaking })}
        </div>

        <!-- Status Pill Badge -->
        <div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-md border-2 border-surface ${
          isSpeaking ? 'bg-primary text-on-primary animate-bounce' : isListening ? 'bg-emerald-500 text-white animate-pulse' : 'bg-primary text-on-primary'
        }">
          <span class="material-symbols-outlined text-sm">${isSpeaking ? 'volume_up' : isListening ? 'mic' : 'smart_toy'}</span>
        </div>
      </button>

    </div>
  `;
}

export function attachLiveRexWidgetListeners() {
  // 1. Floating mascot button toggle
  const floatBtn = document.getElementById('live-rex-floating-btn');
  if (floatBtn) {
    floatBtn.addEventListener('click', () => {
      Sound.click();
      rexEngine.unlockAudio();
      const state = store.getState();
      const nextOpen = !state.liveRex?.isOpen;
      store.toggleLiveRexModal(nextOpen);
    });
  }

  // Helper to toggle real-time bidirectional Gemini Live session with fallback
  const handleToggleRexLive = async () => {
    geminiLiveService.unlockAudio();
    rexEngine.unlockAudio();
    if (geminiLiveService.isActive) {
      Sound.chirp();
      geminiLiveService.disconnect();
    } else if (rexEngine.isListening) {
      rexEngine.toggleListen();
    } else {
      Sound.pop();
      try {
        await geminiLiveService.connect();
      } catch (liveErr) {
        console.warn("Rex Live WebSocket fallback to local speech engine:", liveErr);
        rexEngine.toggleListen();
      }
    }
  };

  // 2. Giant Mascot Face Tap-to-Talk (Header/Hero)
  const giantAvatarBtn = document.getElementById('modal-rex-avatar-btn');
  if (giantAvatarBtn) {
    giantAvatarBtn.addEventListener('click', () => {
      handleToggleRexLive();
    });
  }

  // 3. Close modal button
  const closeBtn = document.getElementById('live-rex-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      Sound.click();
      if (geminiLiveService.isActive) {
        geminiLiveService.disconnect();
      }
      if (rexEngine.isListening) {
        rexEngine.toggleListen();
      }
      store.toggleLiveRexModal(false);
    });
  }

  // 4. Connect / Disconnect Toggle Button
  const toggleBtn = document.getElementById('live-rex-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      handleToggleRexLive();
    });
  }

  // 5. Picture Quick-Action Buttons (Toddler Pictorial Chips)
  document.querySelectorAll('.rex-toddler-action-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const prompt = btn.getAttribute('data-rex-prompt');
      if (!prompt) return;
      Sound.click();
      rexEngine.unlockAudio();
      geminiLiveService.unlockAudio();
      await rexEngine.sendToRex(prompt);
    });
  });

  // 6. Connect Gemini Live Session State & Volume Listeners for Visualizer
  geminiLiveService.onStateChange = (state) => {
    const bars = document.querySelectorAll('.rex-wave-bar');
    if (bars && bars.length > 0) {
      if (state === 'speaking' || state === 'talking') {
        bars.forEach((bar, i) => {
          bar.style.height = `${12 + (i % 3) * 8}px`;
          bar.style.backgroundColor = '#10B981';
        });
      } else if (state === 'listening') {
        bars.forEach((bar, i) => {
          bar.style.height = `${8 + ((i + 1) % 4) * 6}px`;
          bar.style.backgroundColor = '#34D399';
        });
      } else {
        bars.forEach((bar) => {
          bar.style.height = '4px';
          bar.style.backgroundColor = '#6EE7B7';
        });
      }
    }
  };

  geminiLiveService.onVolumeCallback = (volume, type) => {
    const bars = document.querySelectorAll('.rex-wave-bar');
    if (bars && bars.length > 0) {
      bars.forEach((bar, idx) => {
        const factor = Math.sin((idx + 1) * 0.8) * 0.5 + 0.5;
        const minHeight = 4;
        const maxHeight = 30;
        const height = Math.max(minHeight, Math.round(minHeight + volume * maxHeight * factor));
        bar.style.height = `${height}px`;
        bar.style.backgroundColor = type === 'output' ? '#10B981' : '#34D399';
      });
    }
  };

  // 7. Connect Rex Engine State Change Listener for UI Updates (Fallback Engine)
  rexEngine.onStateChange = (newState) => {
    // Dynamic waveform animation
    const bars = document.querySelectorAll('.rex-wave-bar');
    if (bars && bars.length > 0) {
      if (newState === 'talking') {
        bars.forEach((bar, i) => {
          bar.style.height = `${10 + (i % 3) * 8}px`;
          bar.style.backgroundColor = '#10B981';
        });
      } else if (newState === 'listening') {
        bars.forEach((bar, i) => {
          bar.style.height = `${8 + ((i + 1) % 4) * 6}px`;
          bar.style.backgroundColor = '#34D399';
        });
      } else {
        bars.forEach((bar) => {
          bar.style.height = '4px';
          bar.style.backgroundColor = '#6EE7B7';
        });
      }
    }
  };

  // 7. Gemini Live Service audio volume visualizer hook (if active)
  geminiLiveService.onVolumeCallback = (volume, type) => {
    const bars = document.querySelectorAll('.rex-wave-bar');
    if (bars && bars.length > 0) {
      bars.forEach((bar, idx) => {
        const factor = Math.sin((idx + 1) * 0.8) * 0.5 + 0.5;
        const minHeight = 4;
        const maxHeight = 30;
        const height = Math.max(minHeight, Math.round(minHeight + volume * maxHeight * factor));
        bar.style.height = `${height}px`;
        bar.style.backgroundColor = type === 'output' ? '#10B981' : '#38BDF8';
      });
    }
  };
}
