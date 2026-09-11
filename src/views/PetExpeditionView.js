/**
 * PetExpeditionView.js
 * 
 * High-fidelity 3D Pet Expedition View combining Stitch Tactile Toy UI
 * and the 3D On-Rails Scenic Cruise Canvas.
 */

import { store } from '../state/store.js';
import { PetExpeditionCanvas, EXPEDITION_BIOMES } from '../components/PetExpeditionCanvas.js';
import { speakCompanion } from '../services/voiceService.js';
import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';

let activeCanvasInstance = null;
let currentSpeechTimeout = null;

export function renderPetExpeditionView() {
  const state = store.getState();
  const hero = state.selectedHero || {};
  const activePet = store.getActivePet();
  const cruise = store.getExpeditionCruiseState();
  const fuel = cruise.starlightFuel || 75;
  const currentBiome = EXPEDITION_BIOMES[cruise.waypointIdx || 0] || EXPEDITION_BIOMES[0];
  const discoveredList = cruise.discoveredSecrets || [];
  const modal = cruise.activeDiscoveryModal;
  const isStreakActive = (hero.streak || 1) >= 3;

  return `
    <div class="max-w-4xl mx-auto px-2 sm:px-4 pt-3 pb-28 flex flex-col gap-4 select-none animate-fade-in">
      
      <!-- ===================================================================
           TOP COCKPIT FLIGHT DECK / NAVIGATION BAR (STITCH TACTILE TOY THEME)
           =================================================================== -->
      <div class="bg-gradient-to-b from-[#0e1c28] to-[#09141e] border-4 border-[#202b35] rounded-3xl p-3 sm:p-4 shadow-[0_8px_0_0_#050f18] flex flex-col gap-3">
        
        <!-- Upper Row: Dual View Switcher + Fuel Meter + Realm Stars -->
        <div class="flex flex-wrap items-center justify-between gap-2.5">
          
          <!-- Dual View Toggle: 3D Cruise <-> 2D Map -->
          <div class="flex items-center bg-[#050f18] p-1 rounded-2xl border-2 border-[#202b35] shadow-inner">
            <button id="expedition-view-3d-btn" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-b from-primary to-[#1b7a43] text-[#050f18] font-headline font-black text-xs shadow-[0_3px_0_0_#0d4223] active:translate-y-0.5 transition-all">
              <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">videogame_asset</span>
              <span>3D Cruise</span>
            </button>
            <button id="expedition-view-2d-btn" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-300 hover:text-white font-headline font-bold text-xs active:translate-y-0.5 transition-all">
              <span class="material-symbols-outlined text-base">map</span>
              <span>2D Quest Map</span>
            </button>
          </div>

          <!-- Starlight Fuel Tube Meter -->
          <div class="flex-1 min-w-[150px] max-w-[220px] flex flex-col gap-1 bg-[#121d26] border-2 border-primary/40 rounded-2xl p-2 shadow-inner">
            <div class="flex items-center justify-between px-1">
              <div class="flex items-center gap-1">
                <span class="material-symbols-outlined text-primary text-xs animate-pulse" style="font-variation-settings: 'FILL' 1;">bolt</span>
                <span class="text-[10px] font-headline font-black text-primary uppercase tracking-wider">STAR FUEL</span>
              </div>
              <span class="text-[11px] font-headline font-black text-white">${Math.round(fuel)}%</span>
            </div>
            <!-- Glowing Fuel Tube with hash markings -->
            <div class="relative w-full h-4 bg-[#050f18] rounded-full overflow-hidden border border-[#202b35] p-0.5 flex items-center">
              <div class="h-full rounded-full bg-gradient-to-r from-primary-container via-primary to-emerald-300 transition-all duration-300 relative overflow-hidden" style="width: ${fuel}%;">
                <div class="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.35)_50%,transparent_75%)] bg-[length:12px_12px]"></div>
              </div>
              <div class="absolute inset-0 flex justify-between px-3 pointer-events-none">
                <span class="w-px h-full bg-[#050f18]/70"></span>
                <span class="w-px h-full bg-[#050f18]/70"></span>
                <span class="w-px h-full bg-[#050f18]/70"></span>
              </div>
            </div>
          </div>

          <!-- Realm Stars Tally -->
          <div class="flex items-center gap-2 bg-[#121d26] border-2 border-secondary/60 px-3.5 py-1.5 rounded-2xl shadow-inner">
            <span class="material-symbols-outlined text-secondary text-xl" style="font-variation-settings: 'FILL' 1;">stars</span>
            <div class="flex flex-col leading-tight">
              <span class="text-sm font-headline font-black text-secondary">14 / 18 ★</span>
              <span class="text-[8px] font-headline font-bold text-slate-400 uppercase">REALM STARS</span>
            </div>
          </div>

        </div>

        <!-- Telemetry Sub-bar -->
        <div class="flex items-center justify-between text-[11px] font-headline font-bold px-3 py-1.5 bg-[#050f18]/80 border border-[#202b35] rounded-xl backdrop-blur-sm">
          <div class="flex items-center gap-1.5 text-slate-300">
            <span class="material-symbols-outlined text-cyan-400 text-sm">speed</span>
            <span>CRUISE: <span class="text-cyan-400 font-black uppercase">${cruise.speedMode} (${cruise.speedMode === 'hyper' ? '2.5x' : cruise.speedMode === 'stroll' ? '0.5x' : '1.0x'})</span></span>
          </div>
          <div class="flex items-center gap-1.5 text-slate-300">
            <span class="material-symbols-outlined text-primary text-sm">location_on</span>
            <span>BIOME: <span class="text-primary font-black">${currentBiome.title}</span></span>
          </div>
          <div class="flex items-center gap-1.5 text-secondary">
            <span class="w-2.5 h-2.5 rounded-full bg-secondary animate-ping"></span>
            <span class="text-[10px] uppercase font-black">360° CAM READY</span>
          </div>
        </div>

      </div>

      <!-- ===================================================================
           MAIN 3D EXPEDITION ON-RAILS VIEWPORT WITH TACTILE CONTROLS
           =================================================================== -->
      <div class="relative w-full rounded-4xl bg-[#050f18] border-4 border-[#202b35] shadow-[0_12px_0_0_#030910] min-h-[460px] sm:min-h-[520px] overflow-hidden flex flex-col justify-between">
        
        <!-- 3D Canvas Mount Point -->
        <div id="pet-expedition-3d-mount" class="absolute inset-0 z-0"></div>

        <!-- Touch Drag 360 Hint Badge (Disappears after drag) -->
        <div class="relative z-10 p-3 pointer-events-none flex justify-between items-start">
          <div class="bg-[#09141e]/90 border-2 border-[#202b35] px-3 py-1.5 rounded-full text-[10px] font-headline font-black text-slate-300 flex items-center gap-1.5 shadow-md">
            <span class="material-symbols-outlined text-secondary text-sm">touch_app</span>
            <span>Swipe screen to look around 360° | Tap floating chests!</span>
          </div>
          <!-- Streak Jet Status -->
          ${
            isStreakActive
              ? `
            <div class="bg-secondary/20 border-2 border-secondary px-3 py-1.5 rounded-full text-[10px] font-headline font-black text-secondary flex items-center gap-1.5 shadow-md">
              <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">local_fire_department</span>
              <span>Streak ${hero.streak}x Golden Jet Active!</span>
            </div>
            `
              : ''
          }
        </div>

        <!-- Floating Cockpit HUD Overlays: Rex Radio + Throttle Lever -->
        <div class="relative z-10 p-3 flex items-end justify-between gap-3 pointer-events-none mt-auto mb-2">
          
          <!-- Retro Radio Intercom: Rex Dino Co-Pilot -->
          <div class="pointer-events-auto flex items-start gap-2.5 max-w-[340px]">
            <!-- Speaker Box -->
            <button id="expedition-rex-speak-btn" class="relative bg-gradient-to-b from-[#16212b] to-[#0e1923] p-2 rounded-2xl border-3 border-primary shadow-[0_4px_0_0_#003919] flex flex-col items-center gap-1 shrink-0 active:translate-y-1 transition-all" title="Hear Rex Dino Co-Pilot guidance">
              <!-- Toy Antenna with glowing bulb -->
              <div class="absolute -top-3.5 left-3 w-1.5 h-3.5 bg-slate-400 rounded-t-sm">
                <span class="absolute -top-2 -left-1 w-3.5 h-3.5 rounded-full bg-primary animate-pulse border border-white"></span>
              </div>
              <img src="${activePet.avatar}" class="w-11 h-11 rounded-xl object-cover border-2 border-primary bg-[#050f18]" />
              <!-- Waveform Equalizer -->
              <div class="flex items-center justify-center gap-0.5 h-3.5 w-full bg-[#050f18] rounded px-1">
                <span class="w-1 h-2 bg-primary rounded-full animate-pulse"></span>
                <span class="w-1 h-3.5 bg-secondary rounded-full animate-pulse"></span>
                <span class="w-1 h-2.5 bg-cyan-400 rounded-full animate-pulse"></span>
                <span class="w-1 h-1.5 bg-primary rounded-full animate-pulse"></span>
              </div>
            </button>

            <!-- Toy Speech Bubble -->
            <div class="bg-gradient-to-b from-[#124227] to-[#0b2918] border-2 border-primary rounded-2xl p-3 shadow-[0_4px_0_0_#050f18] text-white flex flex-col gap-1">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[9px] font-headline font-black text-secondary uppercase tracking-wider flex items-center gap-1">
                  <span class="material-symbols-outlined text-xs">record_voice_over</span>
                  <span>CO-PILOT REX DINO</span>
                </span>
                <span class="text-[9px] font-bold text-emerald-300">Tap to hear aloud 🔊</span>
              </div>
              <p id="expedition-rex-speech-text" class="font-headline font-extrabold text-xs text-emerald-50 leading-snug">
                "Cruising through ${currentBiome.title}! Look around for floating ${currentBiome.secretTitle} and tap it to claim loot!"
              </p>
            </div>
          </div>

          <!-- 3-Speed Tactile Throttle Lever -->
          <div class="pointer-events-auto flex flex-col items-center bg-[#121d26]/95 border-2 border-[#202b35] p-2 rounded-2xl shadow-[0_6px_0_0_#050f18] backdrop-blur-md shrink-0">
            <span class="text-[8px] font-headline font-black text-slate-400 uppercase tracking-wider mb-1">THROTTLE</span>
            
            <div class="flex flex-col gap-1.5 w-20">
              <!-- Speed: Hyper -->
              <button id="throttle-hyper-btn" class="w-full py-1.5 px-1 rounded-xl font-headline font-black text-[10px] flex items-center justify-center gap-1 border transition-all ${cruise.speedMode === 'hyper' ? 'bg-gradient-to-r from-secondary to-amber-400 text-[#050f18] border-yellow-200 shadow-[0_3px_0_0_#b86a04]' : 'bg-[#1a252f] text-slate-400 border-transparent hover:text-white'}">
                <span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' 1;">local_fire_department</span>
                <span>HYPER</span>
              </button>

              <!-- Speed: Cruise -->
              <button id="throttle-cruise-btn" class="w-full py-1.5 px-1 rounded-xl font-headline font-black text-[10px] flex items-center justify-center gap-1 border transition-all ${cruise.speedMode === 'cruise' ? 'bg-gradient-to-r from-primary to-emerald-400 text-[#050f18] border-emerald-200 shadow-[0_3px_0_0_#005027]' : 'bg-[#1a252f] text-slate-400 border-transparent hover:text-white'}">
                <span class="material-symbols-outlined text-xs">rocket</span>
                <span>CRUISE</span>
              </button>

              <!-- Speed: Stroll -->
              <button id="throttle-stroll-btn" class="w-full py-1.5 px-1 rounded-xl font-headline font-black text-[10px] flex items-center justify-center gap-1 border transition-all ${cruise.speedMode === 'stroll' ? 'bg-gradient-to-r from-cyan-400 to-sky-500 text-[#050f18] border-cyan-200 shadow-[0_3px_0_0_#004970]' : 'bg-[#1a252f] text-slate-400 border-transparent hover:text-white'}">
                <span class="material-symbols-outlined text-xs">directions_walk</span>
                <span>STROLL</span>
              </button>
            </div>

            <!-- Pause / Cruise Toggle -->
            <button id="throttle-play-pause-btn" class="mt-2 w-full py-1 rounded-lg bg-[#050f18] border border-[#202b35] text-[9px] font-headline font-bold text-slate-300 flex items-center justify-center gap-1 hover:text-white">
              <span class="material-symbols-outlined text-xs">${cruise.isCruising ? 'pause' : 'play_arrow'}</span>
              <span>${cruise.isCruising ? 'Pause' : 'Resume'}</span>
            </button>
          </div>

        </div>

      </div>

      <!-- ===================================================================
           BOTTOM BIOME MILESTONE TRACKER (6 STOPS ALONG RAIL)
           =================================================================== -->
      <div class="bg-gradient-to-b from-[#0e1c28] to-[#09141e] border-4 border-[#202b35] rounded-3xl p-3 sm:p-4 shadow-[0_8px_0_0_#050f18] flex flex-col gap-3">
        
        <div class="flex items-center justify-between px-1">
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-primary text-base">explore</span>
            <span class="text-xs font-headline font-black text-white uppercase tracking-wide">Expedition Biome Stepper</span>
          </div>
          <span class="bg-[#050f18] border border-[#202b35] px-2.5 py-0.5 rounded-full text-[10px] font-headline font-black text-primary">
            Checkpoint ${(cruise.waypointIdx || 0) + 1} of 6
          </span>
        </div>

        <!-- 6 Biome Nodes Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-6 gap-2">
          ${EXPEDITION_BIOMES.map((b) => {
            const isCurrent = (cruise.waypointIdx || 0) === b.idx;
            const isDiscovered = discoveredList.includes(b.secretId);
            return `
              <button data-jump-waypoint="${b.idx}" class="p-2.5 rounded-2xl border-2 flex flex-col items-center gap-1 transition-all active:scale-95 text-center ${
                isCurrent
                  ? 'bg-secondary/20 border-secondary shadow-[0_4px_0_0_#b86a04]'
                  : isDiscovered
                  ? 'bg-primary/10 border-primary/40 text-slate-300'
                  : 'bg-[#121d26] border-[#202b35] text-slate-400 opacity-75'
              }">
                <div class="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black ${
                  isCurrent ? 'bg-secondary text-on-secondary' : isDiscovered ? 'bg-primary text-on-primary' : 'bg-[#202b35] text-slate-300'
                }">
                  <span class="material-symbols-outlined text-base">${isDiscovered ? 'check' : b.secretIcon}</span>
                </div>
                <span class="text-[10px] font-headline font-black leading-tight truncate w-full ${isCurrent ? 'text-secondary' : 'text-slate-200'}">${b.title}</span>
                <span class="text-[8px] font-bold text-slate-400 truncate w-full">${b.landmark}</span>
              </button>
            `;
          }).join('')}
        </div>

      </div>

      <!-- ===================================================================
           OPEN DISCOVERY CARD MODAL POPUP (CHUNKY TACTILE TOY STYLE)
           =================================================================== -->
      ${
        modal
          ? `
        <div id="expedition-discovery-modal-backdrop" class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div class="w-full max-w-sm bg-gradient-to-b from-[#16212b] via-[#121d26] to-[#09141e] border-4 border-secondary p-5 rounded-4xl shadow-[0_16px_35px_rgba(0,0,0,0.8),0_0_30px_rgba(243,156,18,0.35)] relative flex flex-col items-center text-center gap-3">
            
            <!-- Close Button -->
            <button id="discovery-modal-close-btn" class="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-[#050f18] border-2 border-secondary text-slate-200 hover:text-white flex items-center justify-center shadow-lg active:scale-95 transition-all">
              <span class="material-symbols-outlined text-base font-black">close</span>
            </button>

            <!-- Discovery Ribbon -->
            <div class="bg-gradient-to-r from-secondary via-amber-300 to-secondary text-[#050f18] font-headline font-black text-xs tracking-wider uppercase px-4 py-1 rounded-full shadow-[0_3px_0_0_#b86a04] border border-yellow-200 -mt-2">
              ✨ EXPEDITION DISCOVERY! ✨
            </div>

            <!-- Floating 3D Icon Graphic -->
            <div class="w-18 h-18 rounded-3xl bg-gradient-to-br from-secondary to-[#b86a04] border-3 border-yellow-200 flex items-center justify-center shadow-[0_6px_0_0_#563400] my-1">
              <span class="material-symbols-outlined text-white text-4xl" style="font-variation-settings: 'FILL' 1;">${modal.secretIcon || 'package_2'}</span>
            </div>

            <!-- Title & Desc -->
            <div class="flex flex-col gap-0.5">
              <h2 class="font-headline font-black text-xl text-white tracking-tight leading-tight">
                ${modal.secretTitle}
              </h2>
              <p class="text-xs font-bold text-slate-300">
                Spotted in ${modal.title}! ${modal.subtitle}
              </p>
            </div>

            <!-- Reward Loot Badges -->
            <div class="flex items-center justify-center gap-2.5 w-full py-1">
              <div class="flex items-center gap-1.5 bg-[#050f18] border border-secondary/60 px-3 py-1.5 rounded-2xl shadow-inner">
                <span class="material-symbols-outlined text-secondary text-lg" style="font-variation-settings: 'FILL' 1;">monetization_on</span>
                <span class="font-headline font-black text-xs text-secondary">+${modal.tokens} Tokens</span>
              </div>
              <div class="flex items-center gap-1.5 bg-[#050f18] border border-primary/60 px-3 py-1.5 rounded-2xl shadow-inner">
                <span class="material-symbols-outlined text-primary text-lg" style="font-variation-settings: 'FILL' 1;">bolt</span>
                <span class="font-headline font-black text-xs text-primary">+${modal.energy}% Energy</span>
              </div>
            </div>

            <!-- Big Chunky Claim Button -->
            <button id="discovery-modal-claim-btn" data-secret-id="${modal.secretId}" data-tokens="${modal.tokens}" data-energy="${modal.energy}" class="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-b from-primary to-[#1b7a43] text-[#050f18] font-headline font-black text-sm tracking-wide shadow-[0_6px_0_0_#005027] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 border-t border-emerald-300 mt-1">
              <span class="material-symbols-outlined text-lg" style="font-variation-settings: 'FILL' 1;">auto_awesome</span>
              <span>CLAIM EXPEDITION REWARD!</span>
            </button>

          </div>
        </div>
        `
          : ''
      }

    </div>
  `;
}

export function attachPetExpeditionListeners() {
  const mountEl = document.getElementById('pet-expedition-3d-mount');
  if (mountEl) {
    if (activeCanvasInstance) {
      activeCanvasInstance.destroy();
      activeCanvasInstance = null;
    }

    // Mount 3D Canvas
    activeCanvasInstance = new PetExpeditionCanvas(
      mountEl,
      (biome) => {
        // When secret reticle is clicked in 3D scene
        Sound.click();
        store.openExpeditionDiscoveryModal(biome);
      },
      (newBiome) => {
        // When crossing waypoint milestone
        const speechEl = document.getElementById('expedition-rex-speech-text');
        if (speechEl) {
          speechEl.textContent = `"Approaching ${newBiome.title}! Keep your eyes peeled for the ${newBiome.secretTitle}!"`;
        }
      }
    );
  }

  // Dual View Toggle Buttons
  const btn3D = document.getElementById('expedition-view-3d-btn');
  const btn2D = document.getElementById('expedition-view-2d-btn');

  if (btn2D) {
    btn2D.addEventListener('click', () => {
      Sound.click();
      store.setExpeditionViewMode('2d');
      store.navigate('quest_map');
    });
  }

  // Throttle Speed Buttons
  const btnHyper = document.getElementById('throttle-hyper-btn');
  const btnCruise = document.getElementById('throttle-cruise-btn');
  const btnStroll = document.getElementById('throttle-stroll-btn');
  const btnPlayPause = document.getElementById('throttle-play-pause-btn');

  if (btnHyper) {
    btnHyper.addEventListener('click', () => {
      Sound.success();
      store.setExpeditionSpeed('hyper');
      speakCompanion("Hyper Glider engaged! Full throttle!");
    });
  }

  if (btnCruise) {
    btnCruise.addEventListener('click', () => {
      Sound.click();
      store.setExpeditionSpeed('cruise');
    });
  }

  if (btnStroll) {
    btnStroll.addEventListener('click', () => {
      Sound.click();
      store.setExpeditionSpeed('stroll');
    });
  }

  if (btnPlayPause) {
    btnPlayPause.addEventListener('click', () => {
      Sound.click();
      const cruise = store.getExpeditionCruiseState();
      cruise.isCruising = !cruise.isCruising;
      store.saveState(true);
      store.notify();
    });
  }

  // Waypoint Jump Buttons
  document.querySelectorAll('[data-jump-waypoint]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-jump-waypoint'), 10);
      Sound.click();
      store.setExpeditionWaypoint(idx);
      if (activeCanvasInstance) {
        activeCanvasInstance.progress = (idx / EXPEDITION_BIOMES.length);
      }
    });
  });

  // Rex Speak Audio Button
  const btnRexSpeak = document.getElementById('expedition-rex-speak-btn');
  if (btnRexSpeak) {
    btnRexSpeak.addEventListener('click', () => {
      Sound.click();
      const cruise = store.getExpeditionCruiseState();
      const currentBiome = EXPEDITION_BIOMES[cruise.waypointIdx || 0] || EXPEDITION_BIOMES[0];
      const phrases = [
        `Rex says: We're soaring past ${currentBiome.title}! Can you spot the floating ${currentBiome.secretTitle}?`,
        "Swipe the screen to look all around in 360 degrees! The sky islands are full of wonders!",
        "Every chore you finish in real life powers up our Starlight Fuel tank!",
        "Hang on tight! We are making great headway on our realm adventure!"
      ];
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
      speakCompanion(phrase);
    });
  }

  // Discovery Modal Claim & Close Handlers
  const modalCloseBtn = document.getElementById('discovery-modal-close-btn');
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => {
      Sound.click();
      store.closeExpeditionDiscoveryModal();
    });
  }

  const modalClaimBtn = document.getElementById('discovery-modal-claim-btn');
  if (modalClaimBtn) {
    modalClaimBtn.addEventListener('click', (e) => {
      const secretId = e.currentTarget.getAttribute('data-secret-id');
      const tokens = parseInt(e.currentTarget.getAttribute('data-tokens') || '25', 10);
      const energy = parseInt(e.currentTarget.getAttribute('data-energy') || '10', 10);

      store.claimExpeditionSecret(secretId, { tokens, energy });
      store.closeExpeditionDiscoveryModal();
    });
  }
}
