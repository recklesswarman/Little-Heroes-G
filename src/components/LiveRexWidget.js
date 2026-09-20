// Interactive Floating Rex the Dino Mascot & Toddler Voice Widget
// Features:
// 1. Realistic Kid-Friendly Voice Guidance via Gemini 3.8 Live and Gemini 3.1 Flash TTS
// 2. Real-time Audio Waveform Visualizer & Barge-in Interruption Handling
// 3. Tactile 3D Pet Face Canvas with Pat Head, Poke Cheek, and Roar Interactions
// 4. Toddler Pictorial Quick-Action Cards with Habit Auto-Completion
// 5. Interactive Chat & Hints Tab with Model Speed Toggle and Spoken Read-Aloud

import { store } from '../state/store.js';
import { geminiLiveService } from '../services/geminiLiveService.js';
import { rexEngine } from '../services/rexCompanionEngine.js';
import { speakCompanion, stopRex, isRexSpeaking } from '../services/voiceService.js';
import { Sound } from '../audio/sfx.js';
import { triggerInteractiveCelebration } from './InteractiveCelebrationOverlay.js';
import { renderPetSkeletalFaceViewer, initPetSkeletalFaceViewer, getActivePetSkeletalInstance } from './PetSkeletalFaceViewer.js';
import { getPetFaceProfile } from '../services/petSkeletalFaceService.js';

let activeTab = 'live'; // 'live' | 'chat'
let chatSpeedMode = 'smart'; // 'smart' | 'fast'
let chatMessages = [
  {
    id: 'msg_welcome',
    sender: 'rex',
    text: "Rawr! Hello Little Hero! I am Rex, your dinosaur champion! You can talk to me, pet my face, or tap any picture below!",
    timestamp: Date.now()
  }
];

/**
 * Generates dynamic SVG for Rex the Dino with expressions for listening, thinking, and speaking
 */
export function renderRexAvatarSvg({ isListening = false, isThinking = false, isSpeaking = false } = {}) {
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
      
      <!-- Dino Mouth -->
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
    voiceMode: 'free',
    walkieState: 'idle',
    status: 'idle',
    statusMessage: '',
    lastUserTranscript: '',
    lastRexTranscript: ''
  };

  const voiceMode = liveRex.voiceMode || geminiLiveService.voiceMode || 'free';
  const walkieState = liveRex.walkieState || geminiLiveService.walkieState || 'idle';
  const isWalkie = voiceMode === 'walkie';
  const isWalkieRecording = isWalkie && walkieState === 'recording';

  const isSpeaking = liveRex.isSpeaking || rexEngine.currentState === 'talking' || isRexSpeaking();
  const isListening = (isWalkie ? isWalkieRecording : (liveRex.isListening || rexEngine.currentState === 'listening'));
  const isThinking = liveRex.status === 'thinking' || rexEngine.currentState === 'thinking';
  const isOpen = liveRex.isOpen;

  const activePet = store?.getActivePet?.() || { id: 'rex', name: 'Rex the Dino' };
  const activePetId = String(activePet.id || 'rex').toLowerCase();
  const faceProfile = getPetFaceProfile(activePetId);
  const petName = activePet.name || faceProfile.name || 'Rex the Dino';
  const petEmoji = activePet.emoji || (faceProfile.id === 'aqua' ? '🐬' : faceProfile.id === 'bella' ? '🐰' : faceProfile.id === 'barnaby' ? '🐻' : faceProfile.id === 'pip' ? '🐥' : '🦖');

  return `
    <!-- Floating Mascot Container -->
    <div id="live-rex-container" class="fixed bottom-24 right-4 sm:bottom-28 sm:right-6 z-40 flex flex-col items-end pointer-events-none select-none">
      
      <!-- Expanded Toddler Live Voice Sheet -->
      ${
        isOpen
          ? `
        <div id="live-rex-modal-card" class="pointer-events-auto bg-surface-container rounded-4xl border-4 border-primary/50 shadow-2xl p-4 sm:p-5 mb-3 w-[94vw] max-w-sm sm:max-w-md flex flex-col gap-3 animate-scale-up backdrop-blur-xl max-h-[85vh] overflow-hidden">
          
          <!-- Card Header with Pet Info, Tab Navigation, and Close Button -->
          <div class="flex items-center justify-between border-b-2 border-surface-container-highest pb-2.5">
            <div class="flex items-center gap-2">
              <span class="text-2xl">${petEmoji}</span>
              <div>
                <h3 class="font-headline text-base sm:text-lg font-black text-inverse-surface leading-tight">${petName}</h3>
                <span class="text-[10px] font-bold text-primary flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full ${isListening ? 'bg-emerald-400 animate-ping' : isSpeaking ? 'bg-purple-400 animate-pulse' : 'bg-primary'}"></span>
                  Gemini Voice Guide
                </span>
              </div>
            </div>

            <!-- Mode Switcher Tabs -->
            <div class="flex items-center bg-surface-container-high p-0.5 rounded-full border border-surface-container-highest">
              <button id="rex-tab-live-btn" class="px-3 py-1 rounded-full text-xs font-headline font-black transition-all flex items-center gap-1 cursor-pointer ${
                activeTab === 'live' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-inverse-surface'
              }" title="Real-time Voice Conversation">
                <span class="material-symbols-outlined text-sm">mic</span>
                <span>Voice</span>
              </button>
              <button id="rex-tab-chat-btn" class="px-3 py-1 rounded-full text-xs font-headline font-black transition-all flex items-center gap-1 cursor-pointer ${
                activeTab === 'chat' ? 'bg-secondary text-on-secondary shadow-sm' : 'text-on-surface-variant hover:text-inverse-surface'
              }" title="Chat & Ask Questions">
                <span class="material-symbols-outlined text-sm">forum</span>
                <span>Chat</span>
              </button>
            </div>

            <!-- Minimize / Close Button -->
            <button id="live-rex-close-btn" class="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface-variant flex items-center justify-center chunky-btn-sm active:scale-95 cursor-pointer" title="Close Companion Window">
              <span class="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          <!-- TAB 1: LIVE VOICE & TACTILE PET CHAMPION -->
          <div id="rex-view-live" class="${activeTab === 'live' ? 'flex' : 'hidden'} flex-col gap-3 overflow-y-auto pr-1 hide-scrollbar">
            
            <!-- TWO GIANT KID-FRIENDLY TOGGLE BADGES: Talk Freely vs Walkie-Talkie -->
            <div class="grid grid-cols-2 gap-2 w-full pt-0.5">
              <button id="rex-mode-free-btn" class="py-2.5 px-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-headline font-black text-xs transition-all cursor-pointer shadow-sm active:scale-95 ${
                !isWalkie
                  ? 'bg-gradient-to-r from-emerald-500/25 to-teal-500/20 border-emerald-400 text-emerald-300 ring-2 ring-emerald-400/40 shadow-[0_0_15px_rgba(52,211,153,0.3)]'
                  : 'bg-surface-container-high border-surface-container-highest text-on-surface-variant hover:text-inverse-surface'
              }" title="Talk Freely without holding buttons">
                <span class="text-xl select-none">🗣️</span>
                <span class="flex flex-col text-left leading-tight">
                  <span class="text-[11px] font-black">Talk Freely</span>
                  <span class="text-[9px] font-bold opacity-80">Hands-Free</span>
                </span>
              </button>

              <button id="rex-mode-walkie-btn" class="py-2.5 px-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-headline font-black text-xs transition-all cursor-pointer shadow-sm active:scale-95 ${
                isWalkie
                  ? 'bg-gradient-to-r from-amber-500/25 to-orange-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-400/40 shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                  : 'bg-surface-container-high border-surface-container-highest text-on-surface-variant hover:text-inverse-surface'
              }" title="Walkie-Talkie Tap to Speak">
                <span class="text-xl select-none">📻</span>
                <span class="flex flex-col text-left leading-tight">
                  <span class="text-[11px] font-black">Walkie-Talkie</span>
                  <span class="text-[9px] font-bold opacity-80">Tap to Talk</span>
                </span>
              </button>
            </div>

            <!-- GIANT TAP-TO-TALK MASCOT HERO SECTION -->
            <div class="flex flex-col items-center justify-center pt-1 pb-1">
              <div class="group relative p-1.5 rounded-full transition-transform focus:outline-none" title="Pet or Talk to ${petName}!">
                
                <!-- Ambient Glow & Rings -->
                ${
                  isWalkieRecording
                    ? `<div class="absolute -inset-3 rounded-full bg-amber-400/40 animate-ping pointer-events-none"></div>
                       <div class="absolute -inset-1.5 rounded-full bg-orange-400/30 animate-pulse pointer-events-none"></div>`
                    : isListening
                    ? `<div class="absolute -inset-2.5 rounded-full bg-emerald-400/40 animate-ping pointer-events-none"></div>
                       <div class="absolute -inset-1 rounded-full bg-emerald-300/30 animate-pulse pointer-events-none"></div>`
                    : isThinking
                    ? `<div class="absolute -inset-2 rounded-full border-4 border-dashed border-amber-400 animate-spin pointer-events-none"></div>`
                    : isSpeaking
                    ? `<div class="absolute -inset-2.5 rounded-full bg-primary/30 animate-pulse pointer-events-none"></div>`
                    : isWalkie
                    ? `<div class="absolute -inset-1.5 rounded-full border-2 border-dashed border-amber-400/30 pointer-events-none"></div>`
                    : ''
                }

                <!-- Giant Mascot Avatar Disc with Skeletal Face Mesh (128px) -->
                <div id="rex-mascot-avatar-disc" role="button" tabindex="0" class="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-surface-container-high p-1 shadow-2xl flex items-center justify-center transition-all overflow-hidden cursor-pointer active:scale-95 ${
                  isSpeaking
                    ? 'ring-4 ring-primary border-4 border-primary shadow-[0_0_25px_rgba(16,185,129,0.6)] animate-pulse'
                    : isWalkieRecording
                    ? 'ring-4 ring-amber-400 border-4 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.8)]'
                    : isListening
                    ? 'ring-4 ring-emerald-400 border-4 border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.7)]'
                    : isThinking
                    ? 'ring-4 ring-amber-400 border-4 border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.6)]'
                    : isWalkie
                    ? 'ring-2 ring-amber-400/50 border-4 border-amber-400/40 hover:border-amber-400'
                    : 'border-4 border-primary/40 hover:border-primary group-hover:scale-105'
                }" title="${isSpeaking ? 'Tap Rex to pause talking!' : `Tap ${petName}'s face to pet or talk!`}">
                  ${renderPetSkeletalFaceViewer({
                    canvasId: 'modal-mascot-skeletal-canvas',
                    petId: activePetId,
                    width: 128,
                    height: 128,
                    isInteractive: true
                  })}
                </div>

                <!-- Action Indicator Pill -->
                <button id="modal-rex-avatar-btn" class="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-3.5 py-1 min-h-[32px] rounded-full text-[11px] font-headline font-black shadow-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer z-10 transition-transform active:scale-95 ${
                  isSpeaking
                    ? 'bg-primary text-on-primary ring-2 ring-primary-container animate-pulse'
                    : isWalkieRecording
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black animate-pulse ring-2 ring-amber-300'
                    : isWalkie
                    ? 'bg-surface-container-highest text-amber-300 border border-amber-400/60 hover:brightness-110'
                    : isListening
                    ? 'bg-emerald-500 text-white animate-pulse'
                    : isThinking
                    ? 'bg-amber-500 text-white animate-bounce'
                    : 'bg-secondary text-on-secondary hover:brightness-110'
                }">
                  <span class="material-symbols-outlined text-xs">${
                    isSpeaking
                      ? 'volume_up'
                      : isWalkieRecording
                      ? 'sensors'
                      : isWalkie
                      ? 'radio'
                      : isListening
                      ? 'mic'
                      : isThinking
                      ? 'hourglass_top'
                      : 'touch_app'
                  }</span>
                  <span>${
                    isSpeaking
                      ? 'Talking! (Tap to Pause)'
                      : isWalkieRecording
                      ? 'Tap when Done! 🚀'
                      : isWalkie
                      ? 'Tap to Talk 📻'
                      : isListening
                      ? 'Listening...'
                      : isThinking
                      ? 'Thinking...'
                      : 'Tap to Talk!'
                  }</span>
                </button>
              </div>

              <!-- Tactile Micro-Interactions (Pat Head, Poke Cheek, Roar) -->
              <div class="flex items-center gap-2 mt-4 z-10">
                <button id="rex-pat-head-btn" class="bg-surface-container-high hover:bg-surface-bright text-pink-300 hover:text-pink-200 px-3 py-1.5 min-h-[40px] rounded-full font-headline text-xs font-black border border-pink-400/40 flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer" title="Pat forehead for heart sparkles!">
                  <span>❤️</span> Pat
                </button>
                <button id="rex-poke-cheek-btn" class="bg-surface-container-high hover:bg-surface-bright text-amber-300 hover:text-amber-200 px-3 py-1.5 min-h-[40px] rounded-full font-headline text-xs font-black border border-amber-400/40 flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer" title="Poke cheek to squish & giggle!">
                  <span>🤭</span> Poke
                </button>
                <button id="rex-cheer-roar-btn" class="bg-surface-container-high hover:bg-surface-bright text-emerald-300 hover:text-emerald-200 px-3 py-1.5 min-h-[40px] rounded-full font-headline text-xs font-black border border-emerald-400/40 flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer" title="Happy Dinosaur Roar!">
                  <span>🦖</span> Roar
                </button>
              </div>

              <!-- Status Subtitle -->
              <p id="rex-status-text" class="text-xs font-headline font-bold text-on-surface-variant mt-2 text-center">
                ${
                  isSpeaking
                    ? `🗣️ ${petName} is speaking! (Tap Rex to pause)`
                    : isWalkieRecording
                    ? `📻 Walkie-Talkie: Speaking to Rex! Tap button when done!`
                    : isWalkie
                    ? `📻 Walkie-Talkie: Tap button to speak to ${petName}!`
                    : isListening
                    ? `👂 Speak now! ${petName} is listening to you!`
                    : isThinking
                    ? `🤔 ${petName} is getting your answer ready...`
                    : `Touch ${petName}'s face or pick a picture below!`
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

            <!-- Live Dialogue Preview Container (dynamically updated in place) -->
            <div id="rex-live-dialogue-container" class="flex flex-col gap-1.5 max-h-28 overflow-y-auto pr-1 hide-scrollbar transition-all ${
              (liveRex.lastUserTranscript || liveRex.lastRexTranscript) ? '' : 'hidden'
            }">
              <div id="rex-live-dialogue-user" class="bg-surface-container-high rounded-2xl rounded-tr-sm p-2 text-xs font-bold text-inverse-surface border border-surface-container-highest self-end max-w-[90%] shadow-sm ${
                liveRex.lastUserTranscript ? '' : 'hidden'
              }">
                <span class="text-[9px] uppercase font-black text-secondary block">You said:</span>
                <span id="rex-live-user-text">"${liveRex.lastUserTranscript || ''}"</span>
              </div>
              <div id="rex-live-dialogue-rex" class="bg-primary/15 rounded-2xl rounded-tl-sm p-2 text-xs font-bold text-inverse-surface border border-primary/30 self-start max-w-[90%] shadow-sm flex items-start gap-1.5 ${
                liveRex.lastRexTranscript ? '' : 'hidden'
              }">
                <span class="text-sm pt-0.5">${petEmoji}</span>
                <div>
                  <span class="text-[9px] uppercase font-black text-primary block">${petName}:</span>
                  <span id="rex-live-rex-text">"${liveRex.lastRexTranscript || ''}"</span>
                </div>
              </div>
            </div>

            <!-- PICTURE QUICK-ACTIONS (No Reading Required for Toddlers) -->
            <div class="flex flex-col gap-1.5 pt-1">
              <span class="text-[10px] font-black uppercase text-on-surface-variant text-center tracking-wider">Tap a Picture Action</span>
              <div class="grid grid-cols-4 gap-1.5 sm:gap-2">
                
                <!-- 1. ROAR -->
                <button data-rex-action="roar" data-rex-prompt="Make your best dino roar!" class="rex-toddler-action-btn min-h-[52px] bg-gradient-to-b from-emerald-500/20 to-emerald-500/10 hover:from-emerald-500/30 text-inverse-surface border-2 border-emerald-500/40 rounded-2xl p-1.5 flex flex-col items-center justify-center gap-0.5 chunky-btn active:scale-90 transition-all shadow-sm cursor-pointer" title="Roar like a dinosaur!">
                  <span class="text-xl sm:text-2xl">🦖</span>
                  <span class="font-headline text-[10px] font-black text-emerald-400">ROAR!</span>
                </button>

                <!-- 2. TEETH -->
                <button data-rex-action="teeth" data-rex-prompt="I brushed my teeth clean!" class="rex-toddler-action-btn min-h-[52px] bg-gradient-to-b from-sky-500/20 to-sky-500/10 hover:from-sky-500/30 text-inverse-surface border-2 border-sky-500/40 rounded-2xl p-1.5 flex flex-col items-center justify-center gap-0.5 chunky-btn active:scale-90 transition-all shadow-sm cursor-pointer" title="Tell Rex you brushed teeth!">
                  <span class="text-xl sm:text-2xl">🪥</span>
                  <span class="font-headline text-[10px] font-black text-sky-400">Teeth!</span>
                </button>

                <!-- 3. YAY / HIGH FIVE -->
                <button data-rex-action="yay" data-rex-prompt="High five Rex!" class="rex-toddler-action-btn min-h-[52px] bg-gradient-to-b from-amber-500/20 to-amber-500/10 hover:from-amber-500/30 text-inverse-surface border-2 border-amber-500/40 rounded-2xl p-1.5 flex flex-col items-center justify-center gap-0.5 chunky-btn active:scale-90 transition-all shadow-sm cursor-pointer" title="Give Rex a high five!">
                  <span class="text-xl sm:text-2xl">⭐</span>
                  <span class="font-headline text-[10px] font-black text-amber-400">Yay!</span>
                </button>

                <!-- 4. CLEAN TOYS -->
                <button data-rex-action="toys" data-rex-prompt="I cleaned up all my toys!" class="rex-toddler-action-btn min-h-[52px] bg-gradient-to-b from-purple-500/20 to-purple-500/10 hover:from-purple-500/30 text-inverse-surface border-2 border-purple-500/40 rounded-2xl p-1.5 flex flex-col items-center justify-center gap-0.5 chunky-btn active:scale-90 transition-all shadow-sm cursor-pointer" title="Tell Rex you cleaned toys!">
                  <span class="text-xl sm:text-2xl">🧸</span>
                  <span class="font-headline text-[10px] font-black text-purple-400">Toys!</span>
                </button>

                <!-- 5. HEALTHY SNACK -->
                <button data-rex-action="snack" data-rex-prompt="I ate my healthy fruit snack!" class="rex-toddler-action-btn min-h-[52px] bg-gradient-to-b from-rose-500/20 to-rose-500/10 hover:from-rose-500/30 text-inverse-surface border-2 border-rose-500/40 rounded-2xl p-1.5 flex flex-col items-center justify-center gap-0.5 chunky-btn active:scale-90 transition-all shadow-sm cursor-pointer" title="Tell Rex you ate healthy snacks!">
                  <span class="text-xl sm:text-2xl">🍎</span>
                  <span class="font-headline text-[10px] font-black text-rose-400">Snack!</span>
                </button>

                <!-- 6. DRINK WATER -->
                <button data-rex-action="water" data-rex-prompt="I drank fresh cool water!" class="rex-toddler-action-btn min-h-[52px] bg-gradient-to-b from-blue-500/20 to-blue-500/10 hover:from-blue-500/30 text-inverse-surface border-2 border-blue-500/40 rounded-2xl p-1.5 flex flex-col items-center justify-center gap-0.5 chunky-btn active:scale-90 transition-all shadow-sm cursor-pointer" title="Tell Rex you drank water!">
                  <span class="text-xl sm:text-2xl">💧</span>
                  <span class="font-headline text-[10px] font-black text-blue-400">Water!</span>
                </button>

                <!-- 7. CALM DINO BREATHS -->
                <button data-rex-action="breathe" data-rex-prompt="Let's take 3 calm dinosaur breaths together!" class="rex-toddler-action-btn min-h-[52px] bg-gradient-to-b from-teal-500/20 to-teal-500/10 hover:from-teal-500/30 text-inverse-surface border-2 border-teal-500/40 rounded-2xl p-1.5 flex flex-col items-center justify-center gap-0.5 chunky-btn active:scale-90 transition-all shadow-sm cursor-pointer" title="Calm dinosaur breathing exercise">
                  <span class="text-xl sm:text-2xl">🌬️</span>
                  <span class="font-headline text-[10px] font-black text-teal-400">Breathe</span>
                </button>

                <!-- 8. FUNNY JOKE -->
                <button data-rex-action="joke" data-rex-prompt="Tell me a funny dinosaur joke!" class="rex-toddler-action-btn min-h-[52px] bg-gradient-to-b from-yellow-500/20 to-yellow-500/10 hover:from-yellow-500/30 text-inverse-surface border-2 border-yellow-500/40 rounded-2xl p-1.5 flex flex-col items-center justify-center gap-0.5 chunky-btn active:scale-90 transition-all shadow-sm cursor-pointer" title="Ask Rex for a joke!">
                  <span class="text-xl sm:text-2xl">🤣</span>
                  <span class="font-headline text-[10px] font-black text-yellow-400">Joke!</span>
                </button>

              </div>
            </div>

            <!-- Bottom Live Microphone Toggle Button -->
            <div class="flex items-center gap-2 pt-1 border-t border-surface-container-highest">
              <button id="live-rex-toggle-btn" class="flex-1 py-3 px-4 rounded-2xl font-headline text-xs font-black flex items-center justify-center gap-2 chunky-btn shadow-md active:scale-95 transition-all cursor-pointer ${
                isSpeaking
                  ? 'bg-primary text-on-primary border-primary-container animate-pulse ring-2 ring-primary/50'
                  : isWalkieRecording
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 border-amber-600 animate-pulse ring-2 ring-amber-400'
                  : isWalkie
                  ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border-2 border-amber-400/50 hover:bg-amber-500/30'
                  : isListening
                  ? 'bg-emerald-500 text-white border-emerald-600 animate-pulse'
                  : 'bg-primary text-on-primary border-primary-container'
              }">
                <span class="material-symbols-outlined text-base">${
                  isSpeaking ? 'pause_circle' : isWalkieRecording ? 'sensors' : isWalkie ? 'radio' : isListening ? 'mic' : 'mic_none'
                }</span>
                <span>${
                  isSpeaking
                    ? `${petName} is Talking! (Tap to Pause)`
                    : isWalkieRecording
                    ? 'Recording... Tap to Send to Rex! 🚀'
                    : isWalkie
                    ? 'Start Talking (Walkie-Talkie 📻)'
                    : isListening
                    ? 'Listening (Tap to Pause)'
                    : 'Start Live Conversation'
                }</span>
              </button>
            </div>

          </div>

          <!-- TAB 2: CHAT & QUESTIONS THREAD (GEMINI 3.5 FLASH & 3.1 FLASH LITE) -->
          <div id="rex-view-chat" class="${activeTab === 'chat' ? 'flex' : 'hidden'} flex-col gap-2.5 overflow-hidden">
            
            <!-- Speed Mode Controls & Quick Suggestions -->
            <div class="flex items-center justify-between bg-surface-container-lowest p-2 rounded-2xl border border-surface-container-highest">
              <span class="text-[11px] font-headline font-black text-on-surface-variant flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">psychology</span>
                Gemini Model:
              </span>
              <div class="flex items-center gap-1">
                <button id="rex-model-smart-btn" class="px-2.5 py-1 rounded-full text-[10px] font-headline font-black transition-all cursor-pointer ${
                  chatSpeedMode === 'smart' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:text-inverse-surface'
                }" title="Gemini 3.5 Flash for deep thinking & fun storytelling">
                  ✨ Smart
                </button>
                <button id="rex-model-fast-btn" class="px-2.5 py-1 rounded-full text-[10px] font-headline font-black transition-all cursor-pointer ${
                  chatSpeedMode === 'fast' ? 'bg-secondary text-on-secondary shadow-xs' : 'text-on-surface-variant hover:text-inverse-surface'
                }" title="Gemini 3.1 Flash Lite for instant ultra-fast responses">
                  ⚡ Fast
                </button>
              </div>
            </div>

            <!-- Quick Ask Chips for Kids -->
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
              <button data-chat-chip="Tell me a funny dinosaur joke!" class="rex-chat-chip whitespace-nowrap bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-inverse-surface px-2.5 py-1 rounded-full text-[11px] font-headline font-bold border border-surface-container-highest active:scale-95 transition-all cursor-pointer">
                🤣 Dino Joke
              </button>
              <button data-chat-chip="How do I brush my back teeth?" class="rex-chat-chip whitespace-nowrap bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-inverse-surface px-2.5 py-1 rounded-full text-[11px] font-headline font-bold border border-surface-container-highest active:scale-95 transition-all cursor-pointer">
                🪥 Brush Molars
              </button>
              <button data-chat-chip="Give me an encouraging hint for my learning quest!" class="rex-chat-chip whitespace-nowrap bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-inverse-surface px-2.5 py-1 rounded-full text-[11px] font-headline font-bold border border-surface-container-highest active:scale-95 transition-all cursor-pointer">
                🌟 Quest Hint
              </button>
              <button data-chat-chip="Tell me a calming bedtime adventure!" class="rex-chat-chip whitespace-nowrap bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-inverse-surface px-2.5 py-1 rounded-full text-[11px] font-headline font-bold border border-surface-container-highest active:scale-95 transition-all cursor-pointer">
                🌙 Bedtime Story
              </button>
            </div>

            <!-- Scrollable Message Bubble Thread -->
            <div id="rex-chat-thread" class="flex flex-col gap-2 max-h-56 overflow-y-auto p-2 rounded-2xl bg-surface-container-lowest border border-surface-container-highest hide-scrollbar">
              ${chatMessages.map(msg => renderChatMessage(msg, petName, petEmoji)).join('')}
            </div>

            <!-- Input Bar -->
            <form id="rex-chat-form" class="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                id="rex-chat-input"
                placeholder="Ask ${petName} anything..."
                class="flex-1 bg-surface-container-lowest border-2 border-surface-container-highest focus:border-primary rounded-2xl px-3.5 py-2.5 text-xs text-inverse-surface placeholder-on-surface-variant focus:outline-none transition-colors"
                autocomplete="off"
              />
              <button type="submit" id="rex-chat-send-btn" class="w-10 h-10 min-w-[40px] min-h-[40px] rounded-2xl bg-primary text-on-primary flex items-center justify-center chunky-btn-sm active:scale-95 cursor-pointer" title="Send message">
                <span class="material-symbols-outlined text-lg">send</span>
              </button>
            </form>

          </div>

        </div>
      `
          : ''
      }

      <!-- Floating Mascot Icon Button -->
      <button id="live-rex-floating-btn" class="pointer-events-auto relative group chunky-btn active:scale-90 focus:outline-none transition-transform cursor-pointer" title="Tap to talk to ${petName}!">
        
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

        <!-- Mascot Avatar Disc with Skeletal Face Mesh -->
        <div class="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-surface-container border-4 ${
          isSpeaking ? 'border-primary ring-4 ring-primary/40' : isListening ? 'border-emerald-400 ring-4 ring-emerald-400' : 'border-primary/50'
        } p-0.5 shadow-2xl flex items-center justify-center transition-all overflow-hidden pointer-events-none">
          ${renderPetSkeletalFaceViewer({
            canvasId: 'floating-mascot-skeletal-canvas',
            petId: activePetId,
            width: 72,
            height: 72,
            isInteractive: false
          })}
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

function renderChatMessage(msg, petName, petEmoji) {
  const isRex = msg.sender === 'rex';
  return `
    <div class="flex flex-col gap-1 ${isRex ? 'items-start' : 'items-end'}" data-message-id="${msg.id || ''}">
      <div class="flex items-start gap-1.5 max-w-[88%] ${isRex ? 'flex-row' : 'flex-row-reverse'}">
        ${isRex ? `<span class="text-sm pt-0.5 select-none">${petEmoji}</span>` : ''}
        <div class="rounded-2xl p-2.5 text-xs font-bold ${
          isRex
            ? 'bg-primary/15 text-inverse-surface border border-primary/30 rounded-tl-sm'
            : 'bg-secondary text-on-secondary rounded-tr-sm'
        } shadow-xs">
          <p class="leading-relaxed">${msg.text}</p>
        </div>
        ${
          isRex
            ? `
          <button data-listen-text="${encodeURIComponent(msg.text)}" class="rex-listen-bubble-btn w-6 h-6 rounded-full bg-surface-container-high hover:bg-surface-bright text-primary flex items-center justify-center text-xs self-end mb-0.5 active:scale-90 transition-transform cursor-pointer" title="Listen in realistic dinosaur voice">
            <span class="material-symbols-outlined text-xs">volume_up</span>
          </button>
        `
            : ''
        }
      </div>
    </div>
  `;
}

export function attachLiveRexWidgetListeners() {
  const activePet = store?.getActivePet?.() || { id: 'rex', name: 'Rex the Dino' };
  const activePetId = String(activePet.id || 'rex').toLowerCase();

  // 0. Initialize Skeletal Face Rigs
  initPetSkeletalFaceViewer('floating-mascot-skeletal-canvas', { petId: activePetId, isInteractive: false });
  initPetSkeletalFaceViewer('modal-mascot-skeletal-canvas', { petId: activePetId, isInteractive: true });

  // Tab Switchers
  const tabLiveBtn = document.getElementById('rex-tab-live-btn');
  const tabChatBtn = document.getElementById('rex-tab-chat-btn');
  const viewLive = document.getElementById('rex-view-live');
  const viewChat = document.getElementById('rex-view-chat');

  if (tabLiveBtn && tabChatBtn && viewLive && viewChat) {
    tabLiveBtn.addEventListener('click', () => {
      activeTab = 'live';
      viewLive.classList.remove('hidden');
      viewLive.classList.add('flex');
      viewChat.classList.remove('flex');
      viewChat.classList.add('hidden');
      tabLiveBtn.className = 'px-3 py-1 rounded-full text-xs font-headline font-black transition-all flex items-center gap-1 cursor-pointer bg-primary text-on-primary shadow-sm';
      tabChatBtn.className = 'px-3 py-1 rounded-full text-xs font-headline font-black transition-all flex items-center gap-1 cursor-pointer text-on-surface-variant hover:text-inverse-surface';
      Sound.click();
    });

    tabChatBtn.addEventListener('click', () => {
      activeTab = 'chat';
      viewChat.classList.remove('hidden');
      viewChat.classList.add('flex');
      viewLive.classList.remove('flex');
      viewLive.classList.add('hidden');
      tabChatBtn.className = 'px-3 py-1 rounded-full text-xs font-headline font-black transition-all flex items-center gap-1 cursor-pointer bg-secondary text-on-secondary shadow-sm';
      tabLiveBtn.className = 'px-3 py-1 rounded-full text-xs font-headline font-black transition-all flex items-center gap-1 cursor-pointer text-on-surface-variant hover:text-inverse-surface';
      Sound.click();
      scrollChatToBottom();
    });
  }

  // Model speed toggles
  const modelSmartBtn = document.getElementById('rex-model-smart-btn');
  const modelFastBtn = document.getElementById('rex-model-fast-btn');
  if (modelSmartBtn && modelFastBtn) {
    modelSmartBtn.addEventListener('click', () => {
      chatSpeedMode = 'smart';
      modelSmartBtn.className = 'px-2.5 py-1 rounded-full text-[10px] font-headline font-black transition-all cursor-pointer bg-primary text-on-primary shadow-xs';
      modelFastBtn.className = 'px-2.5 py-1 rounded-full text-[10px] font-headline font-black transition-all cursor-pointer text-on-surface-variant hover:text-inverse-surface';
      Sound.click();
    });

    modelFastBtn.addEventListener('click', () => {
      chatSpeedMode = 'fast';
      modelFastBtn.className = 'px-2.5 py-1 rounded-full text-[10px] font-headline font-black transition-all cursor-pointer bg-secondary text-on-secondary shadow-xs';
      modelSmartBtn.className = 'px-2.5 py-1 rounded-full text-[10px] font-headline font-black transition-all cursor-pointer text-on-surface-variant hover:text-inverse-surface';
      Sound.click();
    });
  }

  // Voice Mode Badges (Talk Freely 🗣️ vs Walkie-Talkie 📻)
  const modeFreeBtn = document.getElementById('rex-mode-free-btn');
  const modeWalkieBtn = document.getElementById('rex-mode-walkie-btn');
  if (modeFreeBtn && modeWalkieBtn) {
    modeFreeBtn.addEventListener('click', () => {
      geminiLiveService.setVoiceMode('free');
      modeFreeBtn.className = 'py-2.5 px-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-headline font-black text-xs transition-all cursor-pointer shadow-sm active:scale-95 bg-gradient-to-r from-emerald-500/25 to-teal-500/20 border-emerald-400 text-emerald-300 ring-2 ring-emerald-400/40 shadow-[0_0_15px_rgba(52,211,153,0.3)]';
      modeWalkieBtn.className = 'py-2.5 px-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-headline font-black text-xs transition-all cursor-pointer shadow-sm active:scale-95 bg-surface-container-high border-surface-container-highest text-on-surface-variant hover:text-inverse-surface';
      Sound.click();
      if (!geminiLiveService.isActive) {
        activateLiveGeminiSession(activePetId);
      }
    });

    modeWalkieBtn.addEventListener('click', () => {
      geminiLiveService.setVoiceMode('walkie');
      modeWalkieBtn.className = 'py-2.5 px-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-headline font-black text-xs transition-all cursor-pointer shadow-sm active:scale-95 bg-gradient-to-r from-amber-500/25 to-orange-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-400/40 shadow-[0_0_15px_rgba(251,191,36,0.3)]';
      modeFreeBtn.className = 'py-2.5 px-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-headline font-black text-xs transition-all cursor-pointer shadow-sm active:scale-95 bg-surface-container-high border-surface-container-highest text-on-surface-variant hover:text-inverse-surface';
      Sound.click();
      if (!geminiLiveService.isActive) {
        activateLiveGeminiSession(activePetId);
      }
    });
  }

  // Helper to update live dialogue bubbles without tearing down DOM
  function updateLiveDialogue(userText, rexText) {
    const container = document.getElementById('rex-live-dialogue-container');
    const userBox = document.getElementById('rex-live-dialogue-user');
    const userSpan = document.getElementById('rex-live-user-text');
    const rexBox = document.getElementById('rex-live-dialogue-rex');
    const rexSpan = document.getElementById('rex-live-rex-text');

    if (container) {
      container.classList.remove('hidden');
    }
    if (userText && userBox && userSpan) {
      userBox.classList.remove('hidden');
      userSpan.textContent = `"${userText}"`;
      store.setLiveRexState({ lastUserTranscript: userText }, true);
    }
    if (rexText && rexBox && rexSpan) {
      rexBox.classList.remove('hidden');
      rexSpan.textContent = `"${rexText}"`;
      store.setLiveRexState({ lastRexTranscript: rexText }, true);
    }
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  // Core Gemini Live Activation Helper
  async function activateLiveGeminiSession(petId) {
    geminiLiveService.unlockAudio();
    rexEngine.unlockAudio();
    if (geminiLiveService.isActive) return;

    try {
      Sound.pop();
      await geminiLiveService.connect(petId);
      const pGreeting = `ROAR! I'm ${petName}! Ready for super hero adventures, Little Hero?`;
      updateLiveDialogue(null, pGreeting);
      speakCompanion(pGreeting, petId);
    } catch (liveErr) {
      console.warn("Gemini Live connection notice, activating speech recognition fallback:", liveErr);
      rexEngine.toggleListen();
      const pGreeting = `ROAR! I'm ${petName}! I'm listening! Tell me about your quests!`;
      updateLiveDialogue(null, pGreeting);
      speakCompanion(pGreeting, petId);
    }
  }

  // Tactile micro-buttons
  const patBtn = document.getElementById('rex-pat-head-btn');
  if (patBtn) {
    patBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      Sound.chirp();
      const inst = getActivePetSkeletalInstance('modal-mascot-skeletal-canvas');
      if (inst) inst.triggerForeheadPat();
      const patSpeech = "*Giggle!* That tickles! I love head pats, Little Hero! ❤️";
      updateLiveDialogue(null, patSpeech);
      if (geminiLiveService.isActive) geminiLiveService.sendTextMessage("I patted your head!");
      speakCompanion(patSpeech, activePetId);
    });
  }

  const pokeBtn = document.getElementById('rex-poke-cheek-btn');
  if (pokeBtn) {
    pokeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      Sound.pop();
      const inst = getActivePetSkeletalInstance('modal-mascot-skeletal-canvas');
      if (inst) inst.triggerCheekPoke();
      const pokeSpeech = "*Boing!* Squishy dinosaur cheeks! You're super silly! 🤭";
      updateLiveDialogue(null, pokeSpeech);
      if (geminiLiveService.isActive) geminiLiveService.sendTextMessage("I poked your cheek!");
      speakCompanion(pokeSpeech, activePetId);
    });
  }

  const roarBtn = document.getElementById('rex-cheer-roar-btn');
  if (roarBtn) {
    roarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      Sound.roar();
      triggerInteractiveCelebration();
      const inst = getActivePetSkeletalInstance('modal-mascot-skeletal-canvas');
      if (inst) inst.triggerForeheadPat();
      const roarSpeech = "*Happy Roar!* RAWR! Super Dinosaur Hero Power! 🦖⭐";
      updateLiveDialogue(null, roarSpeech);
      if (geminiLiveService.isActive) geminiLiveService.sendTextMessage("ROAR!");
      speakCompanion(roarSpeech, activePetId);
    });
  }

  // Floating mascot toggle button: Selecting companion activates Gemini Live API!
  const floatBtn = document.getElementById('live-rex-floating-btn');
  if (floatBtn) {
    floatBtn.addEventListener('click', async () => {
      Sound.click();
      rexEngine.unlockAudio();
      geminiLiveService.unlockAudio();
      const state = store.getState();
      const wasOpen = Boolean(state.liveRex?.isOpen);

      if (!wasOpen) {
        // Open modal
        store.toggleLiveRexModal(true);
        // AND ACTIVATE GEMINI LIVE API!
        await activateLiveGeminiSession(activePetId);
      } else {
        // Close modal and cleanly disconnect
        store.toggleLiveRexModal(false);
        if (geminiLiveService.isActive) {
          geminiLiveService.disconnect();
        }
        rexEngine.stop();
        stopRex();
      }
    });
  }

  // Toggle Live Audio function: Handles Tap-to-Interrupt, Walkie-Talkie, and Talk Freely modes
  const handleToggleRexLive = async () => {
    geminiLiveService.unlockAudio();
    rexEngine.unlockAudio();

    // 1. TAP-TO-INTERRUPT: If Rex is actively speaking aloud, tap immediately pauses Rex!
    if (geminiLiveService.isSpeaking || isRexSpeaking()) {
      Sound.chirp();
      geminiLiveService.interruptSpeech();
      stopRex();
      updateLiveDialogue(null, "*Gently paused!* Tap or speak whenever you're ready, Little Hero! ❤️");
      return;
    }

    // 2. WALKIE-TALKIE MODE: Tap-to-Start / Tap-to-Finish
    if (geminiLiveService.voiceMode === 'walkie') {
      if (!geminiLiveService.isActive) {
        await activateLiveGeminiSession(activePetId);
      }
      if (geminiLiveService.walkieState === 'recording') {
        geminiLiveService.finishWalkieRecording();
        const inst = getActivePetSkeletalInstance('modal-mascot-skeletal-canvas');
        if (inst?.setTargetHeadPose) inst.setTargetHeadPose(0.1, 0.1, 0.05);
      } else {
        geminiLiveService.startWalkieRecording();
        const inst = getActivePetSkeletalInstance('modal-mascot-skeletal-canvas');
        if (inst?.setTargetHeadPose) inst.setTargetHeadPose(0, -0.15, 0.08);
      }
      return;
    }

    // 3. TALK FREELY MODE (Hands-Free with adaptive VAD)
    if (geminiLiveService.isActive) {
      Sound.chirp();
      geminiLiveService.disconnect();
      stopRex();
    } else if (rexEngine.isListening) {
      rexEngine.toggleListen();
    } else {
      await activateLiveGeminiSession(activePetId);
    }
  };

  // Action pill button triggers live voice
  const giantAvatarBtn = document.getElementById('modal-rex-avatar-btn');
  if (giantAvatarBtn) {
    giantAvatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleToggleRexLive();
    });
  }

  // Giant mascot avatar disc:
  // If Rex is speaking: Tap-to-Interrupt cleanly pauses speech!
  // If Rex is quiet: loving pet interaction on tap (does NOT disconnect live mic!)
  const mascotAvatarDisc = document.getElementById('rex-mascot-avatar-disc');
  if (mascotAvatarDisc) {
    mascotAvatarDisc.addEventListener('click', (e) => {
      e.stopPropagation();
      if (geminiLiveService.isSpeaking || isRexSpeaking()) {
        Sound.chirp();
        geminiLiveService.interruptSpeech();
        stopRex();
        updateLiveDialogue(null, "*Gently paused!* Tap or speak whenever you're ready, Little Hero! ❤️");
        return;
      }
      Sound.chirp();
      const inst = getActivePetSkeletalInstance('modal-mascot-skeletal-canvas');
      if (inst) inst.triggerForeheadPat();
      const patSpeech = "*Happy dinosaur giggle!* You tickle Rex! ❤️🦖";
      updateLiveDialogue(null, patSpeech);
      speakCompanion(patSpeech, activePetId);
    });
    mascotAvatarDisc.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (geminiLiveService.isSpeaking || isRexSpeaking()) {
          geminiLiveService.interruptSpeech();
          stopRex();
          return;
        }
        Sound.chirp();
        const inst = getActivePetSkeletalInstance('modal-mascot-skeletal-canvas');
        if (inst) inst.triggerForeheadPat();
      }
    });
  }

  // Close Button
  const closeBtn = document.getElementById('live-rex-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      Sound.click();
      if (geminiLiveService.isActive) {
        geminiLiveService.disconnect();
      }
      rexEngine.stop();
      stopRex();
      store.toggleLiveRexModal(false);
    });
  }

  // Bottom Live conversation toggle button
  const toggleBtn = document.getElementById('live-rex-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      handleToggleRexLive();
    });
  }

  // Toddler Pictorial Quick-Action Buttons (Auto-complete habits & cheerful responses)
  document.querySelectorAll('.rex-toddler-action-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const prompt = btn.getAttribute('data-rex-prompt');
      const action = btn.getAttribute('data-rex-action') || '';
      if (!prompt) return;

      Sound.click();
      rexEngine.unlockAudio();
      geminiLiveService.unlockAudio();

      let rexReply = '';
      switch (action) {
        case 'roar':
          Sound.roar();
          rexReply = "*Happy Roar!* RAWR! Super Dinosaur Hero Power! 🦖⭐";
          getActivePetSkeletalInstance('modal-mascot-skeletal-canvas')?.triggerForeheadPat?.();
          triggerInteractiveCelebration();
          break;
        case 'teeth': {
          const res = store.claimCompanionHabit('teeth');
          triggerInteractiveCelebration();
          rexReply = `*Sparkle smile!* +${res.coins} Coins 🪙! Look at those shiny clean teeth! Super hero smile power! 🪥✨`;
          break;
        }
        case 'yay':
          Sound.chirp();
          triggerInteractiveCelebration();
          rexReply = "*HIGH FIVE!* Up high, down low, you are an incredible superstar! ⭐🎉";
          break;
        case 'toys': {
          const res = store.claimCompanionHabit('toys');
          triggerInteractiveCelebration();
          rexReply = `*Tidy Champion!* +${res.coins} Coins 🪙! All toys safely in their home! Great teamwork, Little Hero! 🧸⭐`;
          break;
        }
        case 'snack': {
          const res = store.claimCompanionHabit('snack');
          triggerInteractiveCelebration();
          rexReply = `*Crunch crunch!* +${res.coins} Coins 🪙! Yummy vitamins! Healthy snacks give you super dinosaur strength! 🍎🥦`;
          break;
        }
        case 'water': {
          const res = store.claimCompanionHabit('water');
          triggerInteractiveCelebration();
          rexReply = `*Gulp gulp!* +${res.coins} Coins 🪙! Super hero hydration! Cool fresh water powers up your brain and muscles! 💧🦖`;
          break;
        }
        case 'breathe':
          Sound.chirp();
          rexReply = "Let's breathe together: In 1-2-3... and gentle dragon breath out 1-2-3! Ahhh, feel how calm you are! 🌬️";
          break;
        case 'joke': {
          Sound.chirp();
          const jokes = [
            "What do you call a sleeping dinosaur? A dino-snore! *Hahaha!* 🦖💤",
            "Why did the T-Rex cross the road? To catch the super hero bus! *Giggle!* 🚌🦖",
            "What is a dinosaur's favorite school subject? His-tree-history! *Roar!* 📚🦕"
          ];
          rexReply = jokes[Math.floor(Math.random() * jokes.length)];
          break;
        }
        default:
          rexReply = `*Happy roar!* You're doing incredible, Little Hero!`;
          break;
      }

      // Show user message & Rex reply in live dialogue immediately
      updateLiveDialogue(prompt, rexReply);

      // If Gemini Live is active, also forward text to live session so server session tracks conversation
      if (geminiLiveService.isActive) {
        geminiLiveService.sendTextMessage(prompt);
      }
      speakCompanion(rexReply, activePetId);
    });
  });

  // Chat Quick Ask Chips
  document.querySelectorAll('.rex-chat-chip').forEach((chip) => {
    chip.addEventListener('click', async () => {
      const prompt = chip.getAttribute('data-chat-chip');
      if (!prompt) return;
      Sound.click();
      await handleSendChatMessage(prompt);
    });
  });

  // Chat Form Submit
  const chatForm = document.getElementById('rex-chat-form');
  const chatInput = document.getElementById('rex-chat-input');
  if (chatForm && chatInput) {
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      chatInput.value = '';
      Sound.click();
      await handleSendChatMessage(text);
    });
  }

  // Chat Listen Buttons
  attachListenButtons();

  // Waveform Visualizer Listeners
  geminiLiveService.onStateChange = (state) => {
    updateWaveformVisualizer(state);
  };

  geminiLiveService.onVolumeCallback = (volume, type) => {
    updateWaveformVolume(volume, type);
    // Real-time lip-sync mouth animation on skeletal 3D mascot rigs
    if (type === 'output' && volume > 0.02) {
      const modalSkel = getActivePetSkeletalInstance('modal-mascot-skeletal-canvas');
      const floatSkel = getActivePetSkeletalInstance('floating-mascot-skeletal-canvas');
      if (modalSkel?.setMouthOpen) modalSkel.setMouthOpen(Math.min(1, volume * 2.2));
      if (floatSkel?.setMouthOpen) floatSkel.setMouthOpen(Math.min(1, volume * 2.2));
    }
  };

  rexEngine.onStateChange = (state) => {
    updateWaveformVisualizer(state);
  };

  // Clean up any existing state update handler on window to prevent duplicate listeners
  if (typeof window !== 'undefined') {
    if (window._liveRexStateUpdateHandler) {
      window.removeEventListener('live-rex-state-update', window._liveRexStateUpdateHandler);
    }
    window._liveRexStateUpdateHandler = (event) => {
      const data = event.detail || {};
      const status = data.status || 'idle';
      const isSpeaking = status === 'talking' || status === 'speaking' || isRexSpeaking();
      const isConnecting = status === 'connecting';
      const isThinking = status === 'thinking';
      
      const isWalkie = geminiLiveService.voiceMode === 'walkie';
      const isWalkieRecording = isWalkie && (geminiLiveService.walkieState === 'recording' || data.walkieState === 'recording');
      const isListening = isWalkie ? isWalkieRecording : (status === 'listening');

      const currentPet = store?.getActivePet?.() || { id: 'rex', name: 'Rex the Dino' };
      const pName = currentPet.name || 'Rex the Dino';

      // 1. Status Text
      const statusTextEl = document.getElementById('rex-status-text');
      if (statusTextEl) {
        statusTextEl.textContent = isSpeaking
          ? `🗣️ ${pName} is speaking! (Tap Rex to pause)`
          : isConnecting
          ? `🔄 Connecting to ${pName}...`
          : isWalkieRecording
          ? `📻 Recording Walkie-Talkie! Tap when you are done!`
          : isWalkie
          ? `📻 Walkie-Talkie: Tap button to speak to ${pName}!`
          : isListening
          ? `👂 Speak now! ${pName} is listening to you!`
          : isThinking
          ? `🤔 ${pName} is getting your answer ready...`
          : `Touch ${pName}'s face or pick a picture below!`;
      }

      // 2. Giant Mascot Disc Border & Glow
      const discEl = document.getElementById('rex-mascot-avatar-disc');
      if (discEl) {
        discEl.className = `w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-surface-container-high p-1 shadow-2xl flex items-center justify-center transition-all overflow-hidden cursor-pointer active:scale-95 ${
          isSpeaking
            ? 'ring-4 ring-primary border-4 border-primary shadow-[0_0_25px_rgba(16,185,129,0.6)] animate-pulse'
            : isWalkieRecording
            ? 'ring-4 ring-amber-400 border-4 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.8)]'
            : isListening
            ? 'ring-4 ring-emerald-400 border-4 border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.7)]'
            : isThinking
            ? 'ring-4 ring-amber-400 border-4 border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.6)]'
            : isConnecting
            ? 'ring-4 ring-sky-400 border-4 border-sky-400 shadow-[0_0_25px_rgba(56,189,248,0.6)]'
            : isWalkie
            ? 'ring-2 ring-amber-400/50 border-4 border-amber-400/40 hover:border-amber-400'
            : 'border-4 border-primary/40 hover:border-primary group-hover:scale-105'
        }`;
      }

      // 3. Action Indicator Pill Button
      const pillBtnEl = document.getElementById('modal-rex-avatar-btn');
      if (pillBtnEl) {
        pillBtnEl.className = `absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-3.5 py-1 min-h-[32px] rounded-full text-[11px] font-headline font-black shadow-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer z-10 transition-transform active:scale-95 ${
          isSpeaking
            ? 'bg-primary text-on-primary ring-2 ring-primary-container animate-pulse'
            : isWalkieRecording
            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black animate-pulse ring-2 ring-amber-300'
            : isWalkie
            ? 'bg-surface-container-highest text-amber-300 border border-amber-400/60 hover:brightness-110'
            : isListening
            ? 'bg-emerald-500 text-white animate-pulse'
            : isThinking
            ? 'bg-amber-500 text-white animate-bounce'
            : isConnecting
            ? 'bg-sky-500 text-white animate-pulse'
            : 'bg-secondary text-on-secondary hover:brightness-110'
        }`;
        const icon = isSpeaking
          ? 'volume_up'
          : isWalkieRecording
          ? 'sensors'
          : isWalkie
          ? 'radio'
          : isListening
          ? 'mic'
          : isThinking
          ? 'hourglass_top'
          : isConnecting
          ? 'sync'
          : 'touch_app';
        const label = isSpeaking
          ? 'Talking! (Tap to Pause)'
          : isWalkieRecording
          ? 'Tap when Done! 🚀'
          : isWalkie
          ? 'Tap to Talk 📻'
          : isListening
          ? 'Listening...'
          : isThinking
          ? 'Thinking...'
          : isConnecting
          ? 'Connecting...'
          : 'Tap to Talk!';
        pillBtnEl.innerHTML = `<span class="material-symbols-outlined text-xs ${isConnecting ? 'animate-spin' : ''}">${icon}</span><span>${label}</span>`;
      }

      // 4. Live Dialogue Preview update
      if (data.lastUserTranscript || data.lastRexTranscript) {
        updateLiveDialogue(data.lastUserTranscript, data.lastRexTranscript);
      }

      // 5. Toggle Button
      const toggleBtnEl = document.getElementById('live-rex-toggle-btn');
      if (toggleBtnEl) {
        if (isSpeaking) {
          toggleBtnEl.className = 'flex-1 py-3 px-4 rounded-2xl font-headline text-xs font-black flex items-center justify-center gap-2 chunky-btn shadow-md active:scale-95 transition-all bg-primary text-on-primary border-primary-container animate-pulse ring-2 ring-primary/50 cursor-pointer';
          toggleBtnEl.innerHTML = `<span class="material-symbols-outlined text-base">pause_circle</span><span>${pName} is Talking! (Tap to Pause)</span>`;
        } else if (isConnecting) {
          toggleBtnEl.className = 'flex-1 py-3 px-4 rounded-2xl font-headline text-xs font-black flex items-center justify-center gap-2 chunky-btn shadow-md active:scale-95 transition-all bg-sky-500 text-white border-sky-600 animate-pulse cursor-pointer';
          toggleBtnEl.innerHTML = '<span class="material-symbols-outlined text-base animate-spin">sync</span><span>Connecting to Gemini Live...</span>';
        } else if (isWalkieRecording) {
          toggleBtnEl.className = 'flex-1 py-3 px-4 rounded-2xl font-headline text-xs font-black flex items-center justify-center gap-2 chunky-btn shadow-md active:scale-95 transition-all bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 border-amber-600 animate-pulse ring-2 ring-amber-400 cursor-pointer';
          toggleBtnEl.innerHTML = '<span class="material-symbols-outlined text-base">sensors</span><span>Recording... Tap to Send to Rex! 🚀</span>';
        } else if (isWalkie) {
          toggleBtnEl.className = 'flex-1 py-3 px-4 rounded-2xl font-headline text-xs font-black flex items-center justify-center gap-2 chunky-btn shadow-md active:scale-95 transition-all bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border-2 border-amber-400/50 hover:bg-amber-500/30 cursor-pointer';
          toggleBtnEl.innerHTML = '<span class="material-symbols-outlined text-base">radio</span><span>Start Talking (Walkie-Talkie 📻)</span>';
        } else if (isListening) {
          toggleBtnEl.className = 'flex-1 py-3 px-4 rounded-2xl font-headline text-xs font-black flex items-center justify-center gap-2 chunky-btn shadow-md active:scale-95 transition-all bg-emerald-500 text-white border-emerald-600 animate-pulse cursor-pointer';
          toggleBtnEl.innerHTML = '<span class="material-symbols-outlined text-base">mic</span><span>Listening (Tap to Pause)</span>';
        } else {
          toggleBtnEl.className = 'flex-1 py-3 px-4 rounded-2xl font-headline text-xs font-black flex items-center justify-center gap-2 chunky-btn shadow-md active:scale-95 transition-all bg-primary text-on-primary border-primary-container cursor-pointer';
          toggleBtnEl.innerHTML = '<span class="material-symbols-outlined text-base">mic_none</span><span>Start Live Conversation</span>';
        }
      }

      // 6. Floating mascot badge & ripples
      const floatBtn = document.getElementById('live-rex-floating-btn');
      if (floatBtn) {
        const badge = floatBtn.querySelector('div.absolute.-bottom-1.-right-1');
        if (badge) {
          badge.className = `absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-md border-2 border-surface ${
            isSpeaking ? 'bg-primary text-on-primary animate-bounce' : isListening ? 'bg-emerald-500 text-white animate-pulse' : 'bg-primary text-on-primary'
          }`;
          badge.innerHTML = `<span class="material-symbols-outlined text-sm">${isSpeaking ? 'volume_up' : isListening ? 'mic' : 'smart_toy'}</span>`;
        }
      }

      // 7. Skeletal Face Rig Speech Lip-Sync Animation
      const modalRig = getActivePetSkeletalInstance('modal-mascot-skeletal-canvas');
      const floatRig = getActivePetSkeletalInstance('floating-mascot-skeletal-canvas');
      if (isSpeaking) {
        modalRig?.startSpeaking?.();
        floatRig?.startSpeaking?.();
      } else {
        modalRig?.stopSpeaking?.();
        floatRig?.stopSpeaking?.();
      }
    };
    window.addEventListener('live-rex-state-update', window._liveRexStateUpdateHandler);
  }
}

function attachListenButtons() {
  document.querySelectorAll('.rex-listen-bubble-btn').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const rawText = btn.getAttribute('data-listen-text');
      if (!rawText) return;
      const text = decodeURIComponent(rawText);
      const activePetId = store?.getActivePet?.()?.id || 'rex';
      Sound.pop();
      geminiLiveService.updateStatus('speaking', 'Rex is reading aloud!');
      speakCompanion(text, activePetId, () => {
        geminiLiveService.updateStatus('idle', 'Rex is ready!');
      });
    };
  });
}

async function handleSendChatMessage(text) {
  const activePet = store?.getActivePet?.() || { id: 'rex', name: 'Rex the Dino' };
  const petName = activePet.name || 'Rex the Dino';
  const petEmoji = activePet.emoji || '🦖';
  const thread = document.getElementById('rex-chat-thread');

  // 1. Add user message
  const userMsg = {
    id: 'user_' + Date.now(),
    sender: 'user',
    text,
    timestamp: Date.now()
  };
  chatMessages.push(userMsg);

  if (thread) {
    thread.insertAdjacentHTML('beforeend', renderChatMessage(userMsg, petName, petEmoji));
    scrollChatToBottom();
  }

  // 2. Add placeholder thinking bubble
  const thinkingId = 'thinking_' + Date.now();
  if (thread) {
    thread.insertAdjacentHTML('beforeend', `
      <div id="${thinkingId}" class="flex items-center gap-1.5 text-xs text-on-surface-variant font-bold animate-pulse">
        <span>${petEmoji}</span>
        <span>${petName} is thinking...</span>
      </div>
    `);
    scrollChatToBottom();
  }

  // 3. Request reply from server
  try {
    const reply = await geminiLiveService.askRexChat(text, chatSpeedMode);
    const thinkEl = document.getElementById(thinkingId);
    if (thinkEl) thinkEl.remove();

    if (reply) {
      const rexMsg = {
        id: 'rex_' + Date.now(),
        sender: 'rex',
        text: reply,
        timestamp: Date.now()
      };
      chatMessages.push(rexMsg);
      if (thread) {
        thread.insertAdjacentHTML('beforeend', renderChatMessage(rexMsg, petName, petEmoji));
        scrollChatToBottom();
        attachListenButtons();
      }
    }
  } catch (err) {
    const thinkEl = document.getElementById(thinkingId);
    if (thinkEl) thinkEl.remove();
  }
}

function scrollChatToBottom() {
  const thread = document.getElementById('rex-chat-thread');
  if (thread) {
    thread.scrollTop = thread.scrollHeight;
  }
}

function updateWaveformVisualizer(state) {
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
}

function updateWaveformVolume(volume, type) {
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
}
