// Interactive Floating Rex the Dino Mascot & Live Voice Widget
// Provides real-time audio waveforms, live dialogue transcriptions, and quick voice actions.

import { store } from '../state/store.js';
import { geminiLiveService } from '../services/geminiLiveService.js';
import { Sound } from '../audio/sfx.js';
import { triggerInteractiveCelebration } from './InteractiveCelebrationOverlay.js';
import { talkToRex, playRexVoice } from '../services/heroAgentService.js';


// SVG Icon for Rex the Dino
const REX_AVATAR_SVG = `
  <svg class="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="46" fill="#10B981" />
    <path d="M50 8C26.8 8 8 26.8 8 50C8 73.2 26.8 92 50 92C73.2 92 92 73.2 92 50C92 26.8 73.2 8 50 8Z" fill="url(#rex-grad)" />
    <!-- Spikes -->
    <path d="M28 20L34 10L40 20Z" fill="#F59E0B" />
    <path d="M44 16L50 6L56 16Z" fill="#F59E0B" />
    <path d="M60 20L66 10L72 20Z" fill="#F59E0B" />
    <!-- Cheeks & Snout -->
    <ellipse cx="50" cy="58" rx="26" ry="20" fill="#34D399" />
    <!-- Eyes -->
    <circle cx="38" cy="42" r="7" fill="#FFFFFF" />
    <circle cx="39" cy="42" r="3.5" fill="#0F172A" />
    <circle cx="40" cy="40" r="1.5" fill="#FFFFFF" />
    <circle cx="62" cy="42" r="7" fill="#FFFFFF" />
    <circle cx="61" cy="42" r="3.5" fill="#0F172A" />
    <circle cx="60" cy="40" r="1.5" fill="#FFFFFF" />
    <!-- Nostrils -->
    <circle cx="46" cy="54" r="2" fill="#059669" />
    <circle cx="54" cy="54" r="2" fill="#059669" />
    <!-- Big Happy Dino Smile -->
    <path d="M40 64C45 70 55 70 60 64" stroke="#065F46" stroke-width="4" stroke-linecap="round" />
    <!-- Rosie Cheeks -->
    <ellipse cx="30" cy="54" rx="4" ry="2.5" fill="#F87171" opacity="0.6" />
    <ellipse cx="70" cy="54" rx="4" ry="2.5" fill="#F87171" opacity="0.6" />
    <defs>
      <linearGradient id="rex-grad" x1="8" y1="8" x2="92" y2="92" gradientUnits="userSpaceOnUse">
        <stop stop-color="#10B981" />
        <stop offset="1" stop-color="#059669" />
      </linearGradient>
    </defs>
  </svg>
`;

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

  const isConnected = liveRex.isConnected;
  const isSpeaking = liveRex.isSpeaking;
  const isListening = liveRex.isListening && !isSpeaking;
  const isOpen = liveRex.isOpen;

  return `
    <!-- Floating Mascot Container -->
    <div id="live-rex-container" class="fixed bottom-24 right-4 sm:bottom-28 sm:right-6 z-40 flex flex-col items-end pointer-events-none select-none">
      
      <!-- Expanded Live Voice Sheet / Card -->
      ${
        isOpen
          ? `
        <div id="live-rex-modal-card" class="pointer-events-auto bg-surface-container rounded-3xl border-4 border-primary/40 shadow-2xl p-5 mb-3 w-[92vw] max-w-sm flex flex-col gap-4 animate-scale-up backdrop-blur-xl">
          
          <!-- Card Header -->
          <div class="flex items-center justify-between border-b-2 border-surface-container-highest pb-3">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-2xl bg-primary/20 border-2 border-primary flex items-center justify-center p-1 shadow-inner">
                ${REX_AVATAR_SVG}
              </div>
              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <h3 class="font-headline text-base font-black text-inverse-surface">Rex the Dino</h3>
                  <span class="text-[9px] font-black px-2 py-0.5 rounded-full ${
                    isSpeaking
                      ? 'bg-primary text-on-primary animate-pulse'
                      : isListening
                      ? 'bg-secondary text-on-secondary animate-pulse'
                      : isConnected
                      ? 'bg-surface-bright text-primary'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }">
                    ${isSpeaking ? '🗣️ Speaking' : isListening ? '👂 Listening' : isConnected ? '🟢 Online' : '⚪ Sleeping'}
                  </span>
                </div>
                <span class="text-[11px] text-on-surface-variant font-bold">Live AI Toddler Companion</span>
              </div>
            </div>

            <!-- Minimize / Close Button -->
            <button id="live-rex-close-btn" class="w-8 h-8 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface-variant flex items-center justify-center chunky-btn-sm active:scale-95" title="Close Rex Window">
              <span class="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          <!-- Real-Time Waveform Visualizer -->
          <div class="bg-surface-container-lowest rounded-2xl p-4 border-2 border-surface-container-highest flex flex-col items-center justify-center gap-2 shadow-inner">
            <div class="flex items-center justify-center gap-1.5 h-10 w-full" id="rex-waveform-bars">
              <div class="rex-wave-bar w-2 bg-primary rounded-full transition-all duration-75 h-2" data-bar="0"></div>
              <div class="rex-wave-bar w-2 bg-primary rounded-full transition-all duration-75 h-4" data-bar="1"></div>
              <div class="rex-wave-bar w-2 bg-secondary rounded-full transition-all duration-75 h-6" data-bar="2"></div>
              <div class="rex-wave-bar w-2 bg-primary rounded-full transition-all duration-75 h-8" data-bar="3"></div>
              <div class="rex-wave-bar w-2 bg-secondary rounded-full transition-all duration-75 h-6" data-bar="4"></div>
              <div class="rex-wave-bar w-2 bg-primary rounded-full transition-all duration-75 h-4" data-bar="5"></div>
              <div class="rex-wave-bar w-2 bg-primary rounded-full transition-all duration-75 h-2" data-bar="6"></div>
            </div>
            <p id="rex-status-text" class="text-xs font-headline font-black text-primary text-center">
              ${liveRex.statusMessage || (isConnected ? 'Rex is listening! Say your answer aloud!' : 'Tap "Wake Up Rex" to chat!')}
            </p>
          </div>

          <!-- Live Transcripts Display -->
          <div class="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1 hide-scrollbar">
            ${
              liveRex.lastUserTranscript
                ? `
              <div class="bg-surface-container-high rounded-2xl rounded-tr-sm p-3 text-xs font-bold text-inverse-surface border border-surface-container-highest self-end max-w-[85%] animate-fade-in shadow-sm">
                <span class="text-[10px] uppercase font-black text-secondary block mb-0.5">Little Hero:</span>
                "${liveRex.lastUserTranscript}"
              </div>
            `
                : ''
            }
            ${
              liveRex.lastRexTranscript
                ? `
              <div class="bg-primary/15 rounded-2xl rounded-tl-sm p-3 text-xs font-bold text-inverse-surface border border-primary/30 self-start max-w-[85%] animate-fade-in shadow-sm">
                <span class="text-[10px] uppercase font-black text-primary block mb-0.5 flex items-center gap-1">
                  <span>🦖 Rex:</span>
                </span>
                "${liveRex.lastRexTranscript}"
              </div>
            `
                : ''
            }
          </div>

          <!-- Quick Spoken Toddler Prompts -->
          <div class="grid grid-cols-2 gap-2">
            <button data-rex-prompt="Rex, give me a hint for this question!" class="rex-quick-prompt-btn bg-surface-container-high hover:bg-surface-bright text-inverse-surface font-headline text-[11px] font-black p-2.5 rounded-xl border border-surface-container-highest chunky-btn flex items-center gap-1.5 active:scale-95 text-left">
              <span>💡</span> <span>Give Me a Hint</span>
            </button>
            <button data-rex-prompt="Rex, help me count!" class="rex-quick-prompt-btn bg-surface-container-high hover:bg-surface-bright text-inverse-surface font-headline text-[11px] font-black p-2.5 rounded-xl border border-surface-container-highest chunky-btn flex items-center gap-1.5 active:scale-95 text-left">
              <span>🔢</span> <span>Help Me Count</span>
            </button>
            <button data-rex-prompt="Rex, say something silly and roar!" class="rex-quick-prompt-btn bg-surface-container-high hover:bg-surface-bright text-inverse-surface font-headline text-[11px] font-black p-2.5 rounded-xl border border-surface-container-highest chunky-btn flex items-center gap-1.5 active:scale-95 text-left">
              <span>🦖</span> <span>Dino Roar!</span>
            </button>
            <button id="rex-cheer-btn" class="bg-surface-container-high hover:bg-surface-bright text-inverse-surface font-headline text-[11px] font-black p-2.5 rounded-xl border border-surface-container-highest chunky-btn flex items-center gap-1.5 active:scale-95 text-left">
              <span>⭐</span> <span>Hero Cheer!</span>
            </button>
          </div>

          <!-- Main Action Bar (Connect / Disconnect) -->
          <div class="flex items-center gap-2 pt-1 border-t border-surface-container-highest">
            <button id="live-rex-toggle-btn" class="flex-1 py-3 px-4 rounded-2xl font-headline text-xs font-black flex items-center justify-center gap-2 chunky-btn shadow-md active:scale-95 transition-all ${
              isConnected
                ? 'bg-error text-on-error border-error-container'
                : 'bg-primary text-on-primary border-primary-container'
            }">
              <span class="material-symbols-outlined text-base">${isConnected ? 'mic_off' : 'mic'}</span>
              <span>${isConnected ? 'Disconnect Mic' : 'Wake Up Rex (Live Voice)'}</span>
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
          <div class="absolute -inset-2 rounded-full bg-primary/20 animate-pulse pointer-events-none"></div>
        `
            : ''
        }

        <!-- Mascot Avatar Disc -->
        <div class="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-surface-container border-4 ${
          isSpeaking ? 'border-primary ring-4 ring-primary/40' : isListening ? 'border-secondary ring-4 ring-secondary/40' : isConnected ? 'border-primary' : 'border-surface-container-highest'
        } p-1 shadow-2xl flex items-center justify-center transition-all">
          ${REX_AVATAR_SVG}
        </div>

        <!-- Status Pill Badge -->
        <div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-md border-2 border-surface ${
          isSpeaking ? 'bg-primary text-on-primary animate-bounce' : isListening ? 'bg-secondary text-on-secondary' : isConnected ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'
        }">
          <span class="material-symbols-outlined text-sm">${isSpeaking ? 'volume_up' : isListening ? 'mic' : isConnected ? 'check' : 'mic_none'}</span>
        </div>
      </button>

    </div>
  `;
}

export function attachLiveRexWidgetListeners() {
  // 1. Floating button toggle
  const floatBtn = document.getElementById('live-rex-floating-btn');
  if (floatBtn) {
    floatBtn.addEventListener('click', () => {
      Sound.click();
      const state = store.getState();
      const nextOpen = !state.liveRex?.isOpen;
      store.toggleLiveRexModal(nextOpen);

      // If opening and not yet connected, auto-connect for seamless toddler experience
      if (nextOpen && !geminiLiveService.isConnected) {
        geminiLiveService.connect().catch((err) => {
          console.warn('Auto-connect on Rex tap:', err);
        });
      }
    });
  }

  // 2. Close modal button
  const closeBtn = document.getElementById('live-rex-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      Sound.click();
      store.toggleLiveRexModal(false);
    });
  }

  // 3. Connect / Disconnect Toggle Button
  const toggleBtn = document.getElementById('live-rex-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', async () => {
      Sound.chirp();
      if (geminiLiveService.isConnected) {
        geminiLiveService.disconnect();
      } else {
        await geminiLiveService.connect();
      }
    });
  }

  // 4. Quick prompt buttons
  document.querySelectorAll('.rex-quick-prompt-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const prompt = btn.getAttribute('data-rex-prompt');
      if (!prompt) return;
      Sound.click();

      if (geminiLiveService.isConnected && geminiLiveService.ws?.readyState === WebSocket.OPEN) {
        // Send via realtime Live API
        geminiLiveService.ws.send(
          JSON.stringify({
            clientContent: {
              turns: [
                {
                  role: 'user',
                  parts: [{ text: prompt }]
                }
              ],
              turnComplete: true
            }
          })
        );
      } else {
        // Send via live deployed Gemini Cloud Function (with Interactions fallback)
        try {
          store.setLiveRexState({
            lastUserTranscript: prompt,
            status: 'connecting',
            statusMessage: 'Rex is thinking...'
          });
          const heroId = store.getState().selectedHero?.id || 'hero_demo_1';
          const reply = await talkToRex(prompt, heroId);
          store.setLiveRexState({
            lastRexTranscript: reply,
            status: 'speaking',
            statusMessage: 'Rex is talking!'
          });
          playRexVoice(reply);
          setTimeout(() => {
            store.setLiveRexState({ status: 'idle', statusMessage: 'Rex is ready!' });
          }, 3500);
        } catch {
          await geminiLiveService.askRexInteractions(prompt);
        }
      }
    });
  });

  // 5. Hero cheer button
  const cheerBtn = document.getElementById('rex-cheer-btn');
  if (cheerBtn) {
    cheerBtn.addEventListener('click', () => {
      Sound.fanfare();
      triggerInteractiveCelebration();
      if (geminiLiveService.isConnected) {
        geminiLiveService.ws.send(
          JSON.stringify({
            clientContent: {
              turns: [
                {
                  role: 'user',
                  parts: [{ text: "Rex, celebrate with me! Super Hero Power!" }]
                }
              ],
              turnComplete: true
            }
          })
        );
      }
    });
  }

  // 6. Connect live volume visualizer animation hook
  geminiLiveService.onVolumeCallback = (volume, type) => {
    const bars = document.querySelectorAll('.rex-wave-bar');
    if (bars && bars.length > 0) {
      bars.forEach((bar, idx) => {
        const factor = Math.sin((idx + 1) * 0.8) * 0.5 + 0.5;
        const minHeight = 4;
        const maxHeight = 36;
        const height = Math.max(minHeight, Math.round(minHeight + volume * maxHeight * factor));
        bar.style.height = `${height}px`;
        if (type === 'output') {
          bar.style.backgroundColor = '#10B981'; // Emerald/green when Rex speaks
        } else {
          bar.style.backgroundColor = '#38BDF8'; // Sky blue when child speaks
        }
      });
    }
  };
}
