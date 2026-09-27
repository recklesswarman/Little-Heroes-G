/**
 * Bedtime AI Storybook Adventure & Sanctuary Hub View
 * Little Hero Adventures - Immersive Night-Mode Storytelling Experience
 * 
 * Strict Explorer Palette: ZERO pink or purple.
 * Only midnight slate, emerald green, starlight cyan, solar orange, and amber gold.
 * Non-blocking habit minting per kid_voice_companion_guidelines.md.
 */

import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { BEDTIME_REALMS, BEDTIME_MORALS, CONSTELLATION_STICKERS } from '../data/bedtimeStoryData.js';
import { bedtimeStoryService } from '../services/bedtimeStoryService.js';
import { speakCompanion, stopCompanionAudio } from '../services/voiceService.js';

let activeViewMode = 'sanctuary'; // 'sanctuary' | 'story' | 'bookshelf'
let isMicListening = false;
let isGeneratingScene = false;
let readingSavedStory = null;
let currentSavedActIndex = 0;
let autoAdvanceSeconds = 15;
let autoAdvanceActive = false;
let selectedRealmId = 'space';
let activeBookshelfFilter = 'all'; // 'all' | 'favorites'

export function renderBedtimeStoryView() {
  const hero = store.getState().selectedHero;
  const petId = String(hero.activePetId || '1');
  const pet = (store.getState().pets || []).find(p => String(p.id) === petId) || { name: 'Rex the Dino', avatar: '🦖' };
  const library = store.getBedtimeStoryLibrary();
  const session = bedtimeStoryService.getActiveSession();
  const mapState = store.getWorldAdventureMapState();
  const isLullabyOn = Boolean(mapState.bedtimeLullabyActive);
  const sanctuary = store.getBedtimeSanctuaryState();
  const availableMorals = store.getAvailableBedtimeMorals(hero.id);

  return `
    <div class="min-h-screen bg-[#050f18] text-slate-100 flex flex-col justify-between selection:bg-[#00d2d3] selection:text-black relative overflow-x-hidden">
      
      <!-- Ambient Night Sky Background with Soft Twinkling Stars -->
      <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div class="absolute -top-40 -left-40 w-96 h-96 bg-[#00d2d3]/10 rounded-full blur-3xl"></div>
        <div class="absolute top-1/3 -right-40 w-96 h-96 bg-[#ffb961]/10 rounded-full blur-3xl"></div>
        <div class="absolute -bottom-40 left-1/3 w-96 h-96 bg-[#2ecc71]/10 rounded-full blur-3xl"></div>
      </div>

      <!-- TOP NIGHT-MODE HEADER -->
      <header class="relative z-10 bg-[#09141e]/90 backdrop-blur-md border-b-2 border-surface-container-highest px-4 py-3 sm:px-6 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <button id="bedtime-back-btn" class="w-10 h-10 rounded-2xl bg-[#0f2334] hover:bg-[#1a3850] text-slate-300 hover:text-white flex items-center justify-center border border-surface-container-highest active:scale-95 transition-all" title="Back">
            <span class="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div class="flex items-center gap-2">
            <span class="text-2xl">🌙</span>
            <div>
              <h1 class="font-headline font-black text-sm sm:text-base text-white tracking-wide">
                Bedtime AI Storybook
              </h1>
              <p class="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-[#00d2d3] animate-pulse"></span>
                <span>Companion: ${pet.name}</span>
                <span class="text-slate-500">•</span>
                <span class="text-[#ffb961]">Wind-Down Sanctuary</span>
              </p>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- Bedtime Lullaby Toggle -->
          <button id="toggle-story-lullaby-btn" class="px-3 py-1.5 rounded-xl border border-surface-container-highest text-xs font-black flex items-center gap-1.5 transition-all ${
            isLullabyOn ? 'bg-[#00d2d3]/20 text-[#00d2d3] border-[#00d2d3]/40 animate-pulse' : 'bg-[#0f2334] text-slate-400'
          }">
            <span class="material-symbols-outlined text-sm">music_note</span>
            <span class="hidden sm:inline">${isLullabyOn ? 'Lullaby Playing' : 'Play Lullaby'}</span>
          </button>

          <!-- Bookshelf Tab Button -->
          <button id="view-bookshelf-tab-btn" class="px-3 py-1.5 rounded-xl ${
            activeViewMode === 'bookshelf' ? 'bg-[#ffb961] text-black' : 'bg-[#0f2334] text-[#ffb961] hover:bg-[#1a3850]'
          } border border-surface-container-highest text-xs font-black flex items-center gap-1.5 active:scale-95 transition-all">
            <span class="material-symbols-outlined text-sm">auto_stories</span>
            <span>Bookshelf (${library.length})</span>
          </button>
        </div>
      </header>

      <!-- MAIN CONTENT VIEW ROUTING -->
      <main class="relative z-10 flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        ${activeViewMode === 'sanctuary' ? renderSanctuaryHub(library, sanctuary, hero, pet, availableMorals) : ''}
        ${activeViewMode === 'story' ? renderStoryStage(session, pet, hero) : ''}
        ${activeViewMode === 'bookshelf' ? renderBookshelfLibrary(library) : ''}
      </main>

      <!-- BOTTOM ACCENT STRIP -->
      <footer class="relative z-10 bg-[#09141e]/75 backdrop-blur-md border-t border-surface-container-highest py-2.5 px-4 text-center text-xs text-slate-300 font-bold flex items-center justify-between">
        <span class="flex items-center gap-1.5 text-[11px]">
          <span class="text-[#ffb961]">✨</span>
          <span>Hero Bedtime Routine • Step 8 Slumber Sanctuary</span>
        </span>
        <button id="footer-goto-map-btn" class="text-[#00d2d3] hover:underline flex items-center gap-1 text-[11px] font-black">
          <span>World Adventure Map</span>
          <span class="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </footer>

    </div>
  `;
}

/**
 * Screen 1: Bedtime Sanctuary Hub Flow & Customizer
 * Chains evening habits: 1. Brush Teeth -> 2. Pajamas & Tidy -> 3. Storybook
 */
function renderSanctuaryHub(library, sanctuary, hero, pet, availableMorals) {
  const today = new Date().toDateString();
  const isPajamasDone = sanctuary.pajamasCompletedDate === today;
  const isTeethDone = Boolean(hero.dentalHabits?.bedtimeBrushDate === today || hero.taskForest?.some(t => t.id === 'teeth' && t.completed));
  const narrationMode = sanctuary.narrationMode || 'rex';
  const selectedMoralId = sanctuary.selectedMoralId || (availableMorals[0]?.id || 'brave_dark');

  return `
    <div class="flex flex-col gap-6 animate-fade-in text-left">
      
      <!-- HERO WELCOME BANNER -->
      <div class="relative bg-gradient-to-r from-[#091e2b] via-[#0f2d40] to-[#091e2b] border-2 border-[#00d2d3]/30 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-4 text-left">
          <div class="w-16 h-16 rounded-2xl bg-[#050f18] border-2 border-[#00d2d3] flex items-center justify-center text-3xl shadow-inner flex-shrink-0">
            ${pet.avatar || '🦖'}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#00d2d3]/20 text-[#00d2d3] border border-[#00d2d3]/40">
                Evening Wind-Down
              </span>
              <span class="text-xs text-slate-300 font-bold">• 4-5 Min Adventure</span>
            </div>
            <h2 class="font-headline font-black text-xl sm:text-2xl text-white mt-1">
              Good evening, ${hero.name}!
            </h2>
            <p class="text-xs text-slate-300 max-w-md mt-0.5">
              ${pet.name} is ready for bed! Complete your evening routine steps to embark on tonight's non-repeating bedtime story!
            </p>
          </div>
        </div>

        <!-- Bookshelf Preview Pill -->
        <button id="hub-open-bookshelf-btn" class="px-4 py-2.5 rounded-2xl bg-[#050f18] hover:bg-[#0c1f2d] border border-surface-container-highest text-[#ffb961] font-headline font-black text-xs flex items-center gap-2 active:scale-95 transition-all flex-shrink-0">
          <span class="material-symbols-outlined text-base">auto_stories</span>
          <span>Bookshelf (${library.length} Stories)</span>
        </button>
      </div>

      <!-- 3-STEP EVENING WIND-DOWN PROGRESSION -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        
        <!-- STEP 1: BRUSH TEETH -->
        <div class="bg-[#09141e] border-2 ${isTeethDone ? 'border-[#2ecc71]/40 bg-[#081c15]' : 'border-surface-container-highest'} rounded-2xl p-4 flex flex-col justify-between gap-3">
          <div class="flex items-start justify-between">
            <div class="w-10 h-10 rounded-xl bg-[#0f2334] flex items-center justify-center text-xl">🪥</div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
              isTeethDone ? 'bg-[#2ecc71]/20 text-[#2ecc71]' : 'bg-[#ffb961]/20 text-[#ffb961]'
            }">
              ${isTeethDone ? 'Completed ✨' : 'Step 1'}
            </span>
          </div>
          <div>
            <h3 class="font-headline font-black text-sm text-white">Evening Toothbrush</h3>
            <p class="text-[11px] text-slate-300">Fight sugar bugs for 2 sparkling minutes</p>
          </div>
          <button id="step-launch-toothbrush-btn" class="w-full py-2 rounded-xl ${
            isTeethDone ? 'bg-[#0f2334] text-slate-300' : 'bg-[#2ecc71] text-black font-black'
          } font-headline text-xs flex items-center justify-center gap-1 active:scale-95 transition-all">
            <span class="material-symbols-outlined text-sm">${isTeethDone ? 'check_circle' : 'dentistry'}</span>
            <span>${isTeethDone ? 'Brushed Clean' : 'Start 2-Min Routine'}</span>
          </button>
        </div>

        <!-- STEP 2: PAJAMAS & TIDY UP -->
        <div class="bg-[#09141e] border-2 ${isPajamasDone ? 'border-[#2ecc71]/40 bg-[#081c15]' : 'border-surface-container-highest'} rounded-2xl p-4 flex flex-col justify-between gap-3">
          <div class="flex items-start justify-between">
            <div class="w-10 h-10 rounded-xl bg-[#0f2334] flex items-center justify-center text-xl">🧸</div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
              isPajamasDone ? 'bg-[#2ecc71]/20 text-[#2ecc71]' : 'bg-[#00d2d3]/20 text-[#00d2d3]'
            }">
              ${isPajamasDone ? 'Completed ✨' : 'Step 2'}
            </span>
          </div>
          <div>
            <h3 class="font-headline font-black text-sm text-white">Pajamas & Tidy Up</h3>
            <p class="text-[11px] text-slate-300">Tuck away toys & put on cozy bedtime clothes</p>
          </div>
          <button id="step-complete-pajamas-btn" class="w-full py-2 rounded-xl ${
            isPajamasDone ? 'bg-[#0f2334] text-slate-300' : 'bg-[#00d2d3] text-black font-black'
          } font-headline text-xs flex items-center justify-center gap-1 active:scale-95 transition-all">
            <span class="material-symbols-outlined text-sm">${isPajamasDone ? 'verified' : 'touch_app'}</span>
            <span>${isPajamasDone ? 'Pajamas On (+15 🪙)' : 'Tidy & Put on Pajamas (+15 🪙)'}</span>
          </button>
        </div>

        <!-- STEP 3: BEDTIME AI STORYBOOK -->
        <div class="bg-[#09141e] border-2 border-[#ffb961]/40 rounded-2xl p-4 flex flex-col justify-between gap-3">
          <div class="flex items-start justify-between">
            <div class="w-10 h-10 rounded-xl bg-[#0f2334] flex items-center justify-center text-xl">📖</div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#ffb961]/20 text-[#ffb961]">
              Step 3
            </span>
          </div>
          <div>
            <h3 class="font-headline font-black text-sm text-white">Bedtime AI Storybook</h3>
            <p class="text-[11px] text-slate-300">4-Chapter calming adventure with ${pet.name}</p>
          </div>
          <a href="#storybook-customizer-anchor" class="w-full py-2 rounded-xl bg-[#ffb961] text-black font-headline font-black text-xs flex items-center justify-center gap-1 active:scale-95 transition-all">
            <span>Choose Story Below ⬇️</span>
          </a>
        </div>

      </div>

      <!-- PARENT-GUIDED PROMPT CUSTOMIZER SECTION -->
      <div id="storybook-customizer-anchor" class="bg-[#09141e] border-2 border-surface-container-highest rounded-3xl p-5 sm:p-6 flex flex-col gap-6">
        
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-container-highest pb-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xl">✨</span>
              <h3 class="font-headline font-black text-base sm:text-lg text-white">
                Tonight's Story Customizer
              </h3>
            </div>
            <p class="text-xs text-slate-300 mt-0.5">
              Unique 4-5 minute narrative arc. Guaranteed to never repeat previous bedtime plots!
            </p>
          </div>

          <!-- Dual Narration Toggle -->
          <div class="flex items-center gap-1.5 bg-[#050f18] p-1.5 rounded-2xl border border-surface-container-highest self-start sm:self-auto">
            <button id="toggle-narration-rex" class="px-3 py-1.5 rounded-xl text-xs font-headline font-black flex items-center gap-1.5 transition-all ${
              narrationMode === 'rex' ? 'bg-[#00d2d3] text-black' : 'text-slate-400 hover:text-white'
            }">
              <span>🦖</span>
              <span>Rex Narrates</span>
            </button>
            <button id="toggle-narration-parent" class="px-3 py-1.5 rounded-xl text-xs font-headline font-black flex items-center gap-1.5 transition-all ${
              narrationMode === 'parent' ? 'bg-[#ffb961] text-black' : 'text-slate-400 hover:text-white'
            }">
              <span>📖</span>
              <span>Parent Read Aloud</span>
            </button>
          </div>
        </div>

        <!-- 1. REALM SELECTION (4 CANONICAL REALMS) -->
        <div>
          <label class="block text-xs font-headline font-black uppercase text-slate-300 tracking-wider mb-2.5">
            1. Select Fantasy Realm:
          </label>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            ${BEDTIME_REALMS.map((realm) => {
              const isSelected = realm.id === selectedRealmId;
              return `
                <button data-select-realm="${realm.id}" class="group text-left p-4 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'border-[#00d2d3] bg-[#0c2233] shadow-[0_0_20px_rgba(0,210,211,0.25)]'
                    : 'border-surface-container-highest bg-[#07131d] hover:border-slate-500'
                }">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-2xl">${realm.emoji}</span>
                    <span class="material-symbols-outlined text-sm ${isSelected ? 'text-[#00d2d3]' : 'text-slate-500'}">
                      ${isSelected ? 'radio_button_checked' : 'radio_button_unchecked'}
                    </span>
                  </div>
                  <h4 class="font-headline font-black text-sm text-white group-hover:text-[#00d2d3] transition-colors">
                    ${realm.name}
                  </h4>
                  <p class="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    ${realm.subtitle}
                  </p>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 2. 30-DAY NON-REPEATING MORAL WHEEL -->
        <div>
          <div class="flex items-center justify-between mb-2.5">
            <label class="block text-xs font-headline font-black uppercase text-slate-300 tracking-wider">
              2. Today's Bedtime Moral & Growth Lesson:
            </label>
            <span class="text-[11px] font-bold text-[#2ecc71] flex items-center gap-1">
              <span class="material-symbols-outlined text-xs">lock_clock</span>
              <span>30-Day Anti-Repetition Active</span>
            </span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            ${availableMorals.map((moral) => {
              const isChosen = moral.id === selectedMoralId;
              return `
                <button data-select-moral="${moral.id}" class="p-3 rounded-2xl border-2 text-left transition-all ${
                  isChosen
                    ? 'border-[#ffb961] bg-[#1a2318] shadow-md'
                    : 'border-surface-container-highest bg-[#07131d] hover:border-slate-500'
                }">
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="text-xl">${moral.emoji}</span>
                    <span class="material-symbols-outlined text-xs ${isChosen ? 'text-[#ffb961]' : 'text-slate-600'}">
                      ${isChosen ? 'check_circle' : 'circle'}
                    </span>
                  </div>
                  <h5 class="font-headline font-black text-xs text-white leading-tight">
                    ${moral.name}
                  </h5>
                  <p class="text-[10px] text-slate-400 line-clamp-2 mt-1">
                    ${moral.tagline}
                  </p>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 3. CUSTOM BEDTIME WISH / PARENT NOTE -->
        <div>
          <label class="block text-xs font-headline font-black uppercase text-slate-300 tracking-wider mb-1.5">
            3. Optional Bedtime Wish or Real-Life Detail:
          </label>
          <div class="relative">
            <input 
              id="custom-bedtime-wish-input" 
              type="text" 
              maxlength="90"
              placeholder="e.g. Liam was brave at swimming today, or lost his cozy blue socks..." 
              value="${sanctuary.customBedtimeWish || ''}" 
              class="w-full px-4 py-3 rounded-2xl bg-[#050f18] border-2 border-surface-container-highest text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00d2d3] transition-all"
            />
            <span class="absolute right-3.5 top-3.5 text-xs text-slate-500">✨</span>
          </div>
        </div>

        <!-- LAUNCH BUTTON -->
        <button id="start-custom-story-btn" class="w-full py-4 rounded-2xl bg-gradient-to-r from-[#00d2d3] via-[#2ecc71] to-[#ffb961] text-[#050f18] font-headline font-black text-base tracking-wide shadow-[0_6px_0_0_#050f18] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer">
          <span class="material-symbols-outlined text-2xl">auto_stories</span>
          <span>LAUNCH 4-CHAPTER BEDTIME STORY (~4–5 MINS)</span>
        </button>

      </div>

    </div>
  `;
}

/**
 * Screen 2: 4-Chapter Interactive Storybook Cinema
 */
function renderStoryStage(session, pet, hero) {
  if (!session) return '';
  const currentActNumber = session.actNumber;
  const currentAct = session.acts[currentActNumber - 1] || session.acts[0] || {};
  const isLastAct = currentActNumber === 4;
  const isParentMode = session.narrationMode === 'parent';

  return `
    <div class="flex flex-col gap-4 animate-fade-in text-left">
      
      <!-- CHAPTER PROGRESS HEADER -->
      <div class="flex items-center justify-between bg-[#09141e] px-4 py-2.5 rounded-2xl border border-surface-container-highest">
        <div class="flex items-center gap-2">
          <span class="text-xl">${session.realmEmoji || '📖'}</span>
          <div>
            <h3 class="font-headline font-black text-xs text-white">
              ${session.realmName} • Chapter ${currentActNumber} of 4
            </h3>
            <p class="text-[10px] text-slate-400 font-bold">
              Moral: ${session.moralName || 'Bravery & Sleep'}
            </p>
          </div>
        </div>

        <!-- Progress Dots & Auto-Advance Badge -->
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1.5">
            ${[1, 2, 3, 4].map(step => `
              <div class="w-2.5 h-2.5 rounded-full transition-all ${
                step === currentActNumber
                  ? 'bg-[#00d2d3] scale-125 shadow-[0_0_8px_#00d2d3]'
                  : step < currentActNumber
                    ? 'bg-[#2ecc71]'
                    : 'bg-surface-container-highest'
              }"></div>
            `).join('')}
          </div>

          <!-- Sleep Auto-Advance Indicator -->
          <div id="autoadvance-pill" class="px-2.5 py-1 rounded-xl bg-[#050f18] border border-surface-container-highest text-[10px] font-black text-[#ffb961] flex items-center gap-1">
            <span class="material-symbols-outlined text-xs animate-spin">timelapse</span>
            <span id="autoadvance-text">Sleep Auto-Advance (15s)</span>
          </div>
        </div>
      </div>

      <!-- INTERACTIVE ILLUSTRATION STAGE -->
      <div id="interactive-illustration-container" class="relative bg-[#050f18] rounded-3xl sm:rounded-4xl border-4 border-surface-container-highest shadow-[0_16px_0_0_#030910] min-h-[300px] sm:min-h-[420px] overflow-hidden flex items-center justify-center transition-all cursor-pointer" title="Tap stars or scenery for gentle lullaby chimes!">
        
        <!-- Rendered SVG Art -->
        <div class="w-full h-full flex items-center justify-center select-none pointer-events-auto">
          ${currentAct.svgArt || '<div class="text-slate-500">Starlight scene loading...</div>'}
        </div>

        <!-- Tap-To-Chime Hint Overlay -->
        <div class="absolute top-3 left-3 bg-[#09141e]/80 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] font-bold text-[#00d2d3] border border-[#00d2d3]/30 pointer-events-none flex items-center gap-1">
          <span>✨</span>
          <span>Tap stars & scene for chimes!</span>
        </div>

        <!-- Narration Mode Watermark -->
        <div class="absolute top-3 right-3 bg-[#09141e]/80 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] font-bold text-[#ffb961] border border-[#ffb961]/30 pointer-events-none flex items-center gap-1">
          <span>${isParentMode ? '📖 Parent Reading Mode' : '🦖 Rex Narrating'}</span>
        </div>

        ${isGeneratingScene ? `
          <div class="absolute inset-0 bg-[#050f18]/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-20">
            <div class="w-12 h-12 rounded-full border-4 border-[#00d2d3] border-t-transparent animate-spin"></div>
            <p class="font-headline font-black text-sm text-[#00d2d3] animate-pulse">
              Rex is whispering Chapter ${currentActNumber}...
            </p>
          </div>
        ` : ''}

      </div>

      <!-- STORY NARRATIVE & CONTROLS CARD -->
      <div class="bg-[#09141e] border-2 border-surface-container-highest rounded-3xl p-5 sm:p-6 text-left flex flex-col gap-4">
        
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-black uppercase text-[#00d2d3] tracking-wider">
              ${currentAct.title || `Chapter ${currentActNumber}`}
            </span>
            <button id="story-replay-voice-btn" class="text-xs text-slate-400 hover:text-white flex items-center gap-1" title="Read Aloud Again">
              <span class="material-symbols-outlined text-sm">volume_up</span>
              <span>Replay Voice</span>
            </button>
          </div>
          
          <p class="font-body text-base sm:text-lg text-slate-100 leading-relaxed font-semibold">
            ${currentAct.text || ''}
          </p>
        </div>

        ${currentAct.promptQuestion ? `
          <div class="bg-[#0c2233] p-3 rounded-2xl border border-[#00d2d3]/30 text-xs sm:text-sm text-[#ffb961] font-headline font-bold flex items-center gap-2">
            <span class="text-lg">❓</span>
            <span>${currentAct.promptQuestion}</span>
          </div>
        ` : ''}

        <!-- TODDLER INTERACTION CONTROLS -->
        ${!isLastAct ? `
          <div class="flex flex-col sm:flex-row items-center gap-3 pt-2">
            
            <!-- Microphone Button -->
            <button id="story-mic-btn" class="w-full sm:w-auto px-6 py-3.5 rounded-2xl font-headline font-black text-xs sm:text-sm tracking-wide shadow-[0_4px_0_0_#050f18] active:translate-y-1 active:shadow-none flex items-center justify-center gap-2.5 cursor-pointer transition-all ${
              isMicListening
                ? 'bg-red-500 text-white animate-pulse border-2 border-white'
                : 'bg-gradient-to-r from-[#00d2d3] to-[#0284c7] text-[#050f18]'
            }">
              <span class="material-symbols-outlined text-xl">${isMicListening ? 'mic' : 'mic_none'}</span>
              <span>${isMicListening ? 'LISTENING... SPEAK!' : 'SPEAK TO REX'}</span>
            </button>

            <!-- Quick Suggestion Chips -->
            <div class="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-center sm:justify-start">
              ${(currentAct.suggestionChips || []).map((chip) => `
                <button data-select-chip="${chip.text || chip}" class="px-3.5 py-2.5 rounded-xl bg-[#1b3d58] hover:bg-[#255073] text-white border border-surface-container-highest text-xs font-bold active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer">
                  <span>${chip.text || chip}</span>
                </button>
              `).join('')}
            </div>

            <!-- Manual Next Page Button -->
            <button id="story-manual-turn-page-btn" class="sm:ml-auto w-full sm:w-auto px-4 py-3 rounded-xl bg-[#0f2334] hover:bg-[#1a3850] text-[#00d2d3] border border-[#00d2d3]/40 font-headline font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all">
              <span>Turn Page ➡️</span>
            </button>

          </div>
        ` : `
          <!-- CHAPTER 4 SLUMBER CONCLUSION & STAMPED STICKER -->
          <div class="bg-gradient-to-r from-[#081c15] via-[#0b241c] to-[#0f2334] p-5 rounded-2xl border-2 border-[#2ecc71]/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
            <div class="flex items-center gap-3">
              <div class="w-14 h-14 rounded-2xl bg-[#050f18] border-2 border-[#ffb961] flex items-center justify-center text-3xl shadow-[0_0_15px_rgba(255,185,97,0.4)] flex-shrink-0 animate-bounce">
                ${session.constellationStickerEmoji || '✨'}
              </div>
              <div>
                <span class="text-[10px] font-black uppercase text-[#2ecc71] flex items-center gap-1">
                  <span class="material-symbols-outlined text-xs">verified</span>
                  <span>Bedtime Slumber Complete!</span>
                </span>
                <h4 class="font-headline font-black text-sm text-white">
                  Earned ${session.constellationStickerName || 'Starlight Star'}! +30 Tokens 🪙 +20 XP ⭐
                </h4>
                <p class="text-[11px] text-slate-400">
                  Ambient lullaby looping... Sweet dreams under the stars.
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2 w-full sm:w-auto">
              <button id="story-save-bookshelf-btn" class="w-full sm:w-auto px-4 py-3 rounded-xl bg-[#ffb961] text-black font-headline font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md">
                <span class="material-symbols-outlined text-sm">bookmark</span>
                <span>Save to Bookshelf</span>
              </button>
              <button id="story-finish-return-btn" class="w-full sm:w-auto px-4 py-3 rounded-xl bg-[#0f2334] hover:bg-[#1a3850] text-slate-200 border border-surface-container-highest font-headline font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                <span>Close</span>
              </button>
            </div>
          </div>
        `}

      </div>

    </div>
  `;
}

/**
 * Screen 3: Bookshelf Library View & Saved Chapter Reader
 */
function renderBookshelfLibrary(library) {
  if (readingSavedStory) {
    const chapters = readingSavedStory.acts || readingSavedStory.chapters || [];
    const act = chapters[currentSavedActIndex] || chapters[0] || {};
    return `
      <div class="flex flex-col gap-5 animate-fade-in text-left">
        <div class="flex items-center justify-between bg-[#09141e] p-3 rounded-2xl border border-surface-container-highest">
          <button id="close-reading-saved-btn" class="text-xs text-[#00d2d3] font-black flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">arrow_back</span>
            <span>Back to Bookshelf</span>
          </button>
          <span class="font-headline font-black text-xs text-white truncate max-w-xs">
            ${readingSavedStory.title} (Ch ${currentSavedActIndex + 1} of ${chapters.length})
          </span>
          <div class="flex items-center gap-1.5">
            <button id="saved-story-prev-act" class="w-8 h-8 rounded-lg bg-[#0f2334] text-white flex items-center justify-center disabled:opacity-30" ${currentSavedActIndex === 0 ? 'disabled' : ''}>
              ‹
            </button>
            <button id="saved-story-next-act" class="w-8 h-8 rounded-lg bg-[#0f2334] text-white flex items-center justify-center disabled:opacity-30" ${currentSavedActIndex >= chapters.length - 1 ? 'disabled' : ''}>
              ›
            </button>
          </div>
        </div>

        <div class="relative bg-[#050f18] rounded-3xl sm:rounded-4xl border-4 border-surface-container-highest shadow-[0_16px_0_0_#030910] min-h-[300px] overflow-hidden flex items-center justify-center">
          ${act.svgArt || ''}
        </div>

        <div class="bg-[#09141e] border-2 border-surface-container-highest rounded-3xl p-5 text-left flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h3 class="font-headline font-black text-base text-white">${act.title || `Chapter ${currentSavedActIndex + 1}`}</h3>
            <button data-toggle-fav="${readingSavedStory.id}" class="text-sm ${readingSavedStory.isFavorite ? 'text-[#ffb961]' : 'text-slate-500'}">
              ${readingSavedStory.isFavorite ? '★ Favorited' : '☆ Favorite'}
            </button>
          </div>
          <p class="font-body text-base text-slate-200 leading-relaxed">${act.text || ''}</p>
          ${act.childChoice ? `
            <div class="bg-[#0f2334] px-3 py-1.5 rounded-xl border border-[#00d2d3]/30 text-xs text-[#ffb961] font-bold">
              ★ Hero Choice: "${act.childChoice}"
            </div>
          ` : ''}
          <div class="flex items-center gap-2 pt-2">
            <button id="saved-act-read-aloud-btn" class="px-4 py-2 rounded-xl bg-[#00d2d3] text-black font-headline font-black text-xs flex items-center gap-1.5 active:scale-95">
              <span class="material-symbols-outlined text-sm">volume_up</span>
              <span>Rex Read Aloud</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  const filteredLibrary = activeBookshelfFilter === 'favorites' 
    ? library.filter(s => s.isFavorite) 
    : library;

  return `
    <div class="flex flex-col gap-6 animate-fade-in text-left">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="font-headline font-black text-xl text-white">Bedtime Bookshelf Album</h2>
          <p class="text-xs text-slate-400 font-semibold">Replay completed adventures with Rex or Parent Read Aloud!</p>
        </div>
        
        <div class="flex items-center gap-2">
          <!-- Filter Tabs -->
          <div class="bg-[#09141e] p-1 rounded-xl border border-surface-container-highest flex items-center gap-1">
            <button id="filter-bookshelf-all" class="px-3 py-1 rounded-lg text-xs font-bold ${
              activeBookshelfFilter === 'all' ? 'bg-[#00d2d3] text-black' : 'text-slate-400'
            }">
              All (${library.length})
            </button>
            <button id="filter-bookshelf-favs" class="px-3 py-1 rounded-lg text-xs font-bold ${
              activeBookshelfFilter === 'favorites' ? 'bg-[#ffb961] text-black' : 'text-slate-400'
            }">
              Favorites ⭐
            </button>
          </div>

          <button id="bookshelf-new-adventure-btn" class="px-3.5 py-1.5 rounded-xl bg-[#2ecc71] text-black font-headline font-black text-xs flex items-center gap-1.5 active:scale-95 shadow">
            <span class="material-symbols-outlined text-sm">add</span>
            <span>New Story</span>
          </button>
        </div>
      </div>

      ${filteredLibrary.length === 0 ? `
        <div class="bg-[#09141e] rounded-3xl p-10 border-2 border-surface-container-highest text-center flex flex-col items-center gap-3">
          <span class="text-5xl">📚</span>
          <h3 class="font-headline font-black text-lg text-white">No Stories Found</h3>
          <p class="text-xs text-slate-400 max-w-sm">
            ${activeBookshelfFilter === 'favorites' ? 'You have not favorited any bedtime stories yet!' : 'Complete your first bedtime adventure to store your illustrated storybook here!'}
          </p>
          <button id="empty-bookshelf-start-btn" class="mt-2 px-5 py-2.5 rounded-xl bg-[#00d2d3] text-black font-headline font-black text-xs shadow active:scale-95">
            Start a Bedtime Story
          </button>
        </div>
      ` : `
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          ${filteredLibrary.map((story) => {
            const formattedDate = new Date(story.savedAt || story.createdAt || Date.now()).toLocaleDateString();
            const sticker = CONSTELLATION_STICKERS.find(s => s.id === story.constellationStickerId);
            return `
              <div class="bg-[#09141e] rounded-3xl p-4 border-2 border-surface-container-highest shadow-md hover:border-[#00d2d3]/50 transition-all flex flex-col justify-between gap-3 relative">
                <div>
                  <div class="flex items-center justify-between text-xs text-slate-400 font-bold mb-2">
                    <span class="flex items-center gap-1">
                      <span>${story.realmEmoji || '📖'}</span>
                      <span>${story.realmName || 'Adventure'}</span>
                    </span>
                    <button data-toggle-fav="${story.id}" class="text-base ${story.isFavorite ? 'text-[#ffb961]' : 'text-slate-600 hover:text-slate-400'}">
                      ${story.isFavorite ? '★' : '☆'}
                    </button>
                  </div>

                  <h3 class="font-headline font-black text-sm text-white leading-tight">
                    ${story.title}
                  </h3>

                  <!-- Constellation Badge Ribbon -->
                  ${sticker ? `
                    <div class="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#050f18] border border-[#ffb961]/30 w-fit">
                      <span class="text-sm">${sticker.emoji}</span>
                      <span class="text-[10px] font-bold text-[#ffb961]">${sticker.name}</span>
                    </div>
                  ` : ''}

                  <p class="text-[11px] text-slate-400 mt-2 line-clamp-2">
                    ${story.acts && story.acts[0] ? story.acts[0].text : 'A magical bedtime adventure'}
                  </p>
                </div>

                <div class="flex items-center justify-between gap-2 pt-2 border-t border-surface-container-highest/60 text-xs text-slate-400">
                  <span>${formattedDate}</span>
                  <button data-open-saved-story="${story.id}" class="px-3.5 py-1.5 rounded-xl bg-[#1b3d58] hover:bg-[#255073] text-[#00d2d3] font-headline font-black text-xs flex items-center gap-1 active:scale-95 transition-all">
                    <span class="material-symbols-outlined text-sm">menu_book</span>
                    <span>Read</span>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;
}

/**
 * Event Handlers Wiring
 */
export function setupBedtimeStoryListeners() {
  // Navigation / Back
  document.getElementById('bedtime-back-btn')?.addEventListener('click', () => {
    Sound.bloop();
    stopCompanionAudio();
    bedtimeStoryService.cancelAutoAdvance();
    if (activeViewMode === 'story' || activeViewMode === 'bookshelf') {
      activeViewMode = 'sanctuary';
      readingSavedStory = null;
      store.notify();
    } else {
      store.navigate('dashboard');
    }
  });

  // Footer map navigation
  document.getElementById('footer-goto-map-btn')?.addEventListener('click', () => {
    Sound.tap();
    stopCompanionAudio();
    bedtimeStoryService.cancelAutoAdvance();
    store.navigate('world_map');
  });

  // Toggle Bedtime Lullaby
  document.getElementById('toggle-story-lullaby-btn')?.addEventListener('click', () => {
    Sound.tap();
    store.toggleBedtimeLullaby();
  });

  // View Bookshelf Tab
  document.getElementById('view-bookshelf-tab-btn')?.addEventListener('click', () => {
    Sound.bloop();
    activeViewMode = activeViewMode === 'bookshelf' ? 'sanctuary' : 'bookshelf';
    readingSavedStory = null;
    store.notify();
  });

  document.getElementById('hub-open-bookshelf-btn')?.addEventListener('click', () => {
    Sound.bloop();
    activeViewMode = 'bookshelf';
    readingSavedStory = null;
    store.notify();
  });

  document.getElementById('bookshelf-new-adventure-btn')?.addEventListener('click', () => {
    Sound.bloop();
    activeViewMode = 'sanctuary';
    readingSavedStory = null;
    store.notify();
  });

  document.getElementById('empty-bookshelf-start-btn')?.addEventListener('click', () => {
    Sound.bloop();
    activeViewMode = 'sanctuary';
    store.notify();
  });

  // Routine Step 1: Launch Toothbrush routine
  document.getElementById('step-launch-toothbrush-btn')?.addEventListener('click', () => {
    Sound.tap();
    store.navigate('dental_battle');
  });

  // Routine Step 2: Complete Pajamas & Tidy Up
  document.getElementById('step-complete-pajamas-btn')?.addEventListener('click', () => {
    Sound.fanfare();
    store.completePajamasTidyStep();
  });

  // Narration Mode Toggle (Rex vs Parent)
  document.getElementById('toggle-narration-rex')?.addEventListener('click', () => {
    Sound.tap();
    store.updateBedtimeSanctuaryState({ narrationMode: 'rex' });
  });

  document.getElementById('toggle-narration-parent')?.addEventListener('click', () => {
    Sound.tap();
    store.updateBedtimeSanctuaryState({ narrationMode: 'parent' });
  });

  // Select Realm in Customizer
  document.querySelectorAll('[data-select-realm]').forEach(btn => {
    btn.addEventListener('click', () => {
      const realmId = btn.getAttribute('data-select-realm');
      Sound.chirp();
      selectedRealmId = realmId;
      store.notify();
    });
  });

  // Select Moral in Customizer
  document.querySelectorAll('[data-select-moral]').forEach(btn => {
    btn.addEventListener('click', () => {
      const moralId = btn.getAttribute('data-select-moral');
      Sound.tap();
      store.updateBedtimeSanctuaryState({ selectedMoralId: moralId });
    });
  });

  // Custom Wish Input Sync
  const wishInput = document.getElementById('custom-bedtime-wish-input');
  if (wishInput) {
    wishInput.addEventListener('input', (e) => {
      store.getBedtimeSanctuaryState().customBedtimeWish = e.target.value;
    });
  }

  // Launch Custom Bedtime Story Button
  document.getElementById('start-custom-story-btn')?.addEventListener('click', async () => {
    Sound.fanfare();
    const sanctuary = store.getBedtimeSanctuaryState();
    const wish = (document.getElementById('custom-bedtime-wish-input')?.value || sanctuary.customBedtimeWish || '').trim();
    sanctuary.customBedtimeWish = wish;

    activeViewMode = 'story';
    isGeneratingScene = true;
    store.notify();

    await bedtimeStoryService.startStory(selectedRealmId, sanctuary.selectedMoralId, wish, sanctuary.narrationMode);
    isGeneratingScene = false;
    store.notify();
  });

  // Interactive Illustration Tap -> Chime SFX
  const illustrationContainer = document.getElementById('interactive-illustration-container');
  if (illustrationContainer) {
    illustrationContainer.addEventListener('click', (e) => {
      const target = e.target;
      const chimeVal = target.getAttribute('data-chime') || target.closest('[data-chime]')?.getAttribute('data-chime');
      const freq = chimeVal ? parseFloat(chimeVal) : null;
      Sound.playBedtimeChime(freq);
      bedtimeStoryService.cancelAutoAdvance();
    });
  }

  // Mic Button Speech Recognition
  const micBtn = document.getElementById('story-mic-btn');
  if (micBtn) {
    micBtn.addEventListener('click', () => {
      Sound.tap();
      bedtimeStoryService.cancelAutoAdvance();
      if (isMicListening) {
        bedtimeStoryService.stopListening();
        isMicListening = false;
        store.notify();
      } else {
        isMicListening = true;
        store.notify();

        bedtimeStoryService.startListening(
          async (transcript) => {
            isMicListening = false;
            isGeneratingScene = true;
            store.notify();

            await bedtimeStoryService.advanceStory(transcript);
            isGeneratingScene = false;
            store.notify();
          },
          (err) => {
            console.warn('Speech err:', err);
            isMicListening = false;
            store.notify();
          },
          () => {
            isMicListening = false;
            store.notify();
          }
        );
      }
    });
  }

  // Quick Suggestion Chips
  document.querySelectorAll('[data-select-chip]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const chipText = btn.getAttribute('data-select-chip');
      Sound.tap();
      bedtimeStoryService.cancelAutoAdvance();
      isGeneratingScene = true;
      store.notify();

      await bedtimeStoryService.advanceStory(chipText);
      isGeneratingScene = false;
      store.notify();
    });
  });

  // Manual Turn Page Button
  document.getElementById('story-manual-turn-page-btn')?.addEventListener('click', async () => {
    Sound.whoosh();
    bedtimeStoryService.cancelAutoAdvance();
    isGeneratingScene = true;
    store.notify();

    await bedtimeStoryService.advanceStory();
    isGeneratingScene = false;
    store.notify();
  });

  // Replay Voice Button
  document.getElementById('story-replay-voice-btn')?.addEventListener('click', () => {
    Sound.bloop();
    bedtimeStoryService.cancelAutoAdvance();
    const session = bedtimeStoryService.getActiveSession();
    if (session && session.acts) {
      const currentAct = session.acts[session.actNumber - 1];
      if (currentAct) {
        speakCompanion(currentAct.text, session.petId);
      }
    }
  });

  // Finish and return
  document.getElementById('story-finish-return-btn')?.addEventListener('click', () => {
    Sound.tap();
    stopCompanionAudio();
    bedtimeStoryService.cancelAutoAdvance();
    activeViewMode = 'sanctuary';
    store.notify();
  });

  document.getElementById('story-save-bookshelf-btn')?.addEventListener('click', () => {
    Sound.fanfare();
    bedtimeStoryService.cancelAutoAdvance();
    activeViewMode = 'bookshelf';
    store.notify();
  });

  // Bookshelf Filter Tabs
  document.getElementById('filter-bookshelf-all')?.addEventListener('click', () => {
    Sound.tap();
    activeBookshelfFilter = 'all';
    store.notify();
  });

  document.getElementById('filter-bookshelf-favs')?.addEventListener('click', () => {
    Sound.tap();
    activeBookshelfFilter = 'favorites';
    store.notify();
  });

  // Toggle Favorite
  document.querySelectorAll('[data-toggle-fav]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const storyId = btn.getAttribute('data-toggle-fav');
      Sound.coin();
      store.toggleFavoriteBedtimeStory(storyId);
    });
  });

  // Open Saved Story for reading
  document.querySelectorAll('[data-open-saved-story]').forEach(btn => {
    btn.addEventListener('click', () => {
      const storyId = btn.getAttribute('data-open-saved-story');
      const library = store.getBedtimeStoryLibrary();
      const story = library.find(s => s.id === storyId);
      if (story) {
        Sound.bloop();
        readingSavedStory = story;
        currentSavedActIndex = 0;
        store.notify();
      }
    });
  });

  document.getElementById('close-reading-saved-btn')?.addEventListener('click', () => {
    Sound.bloop();
    stopCompanionAudio();
    readingSavedStory = null;
    store.notify();
  });

  document.getElementById('saved-story-prev-act')?.addEventListener('click', () => {
    if (currentSavedActIndex > 0) {
      Sound.tap();
      currentSavedActIndex--;
      store.notify();
    }
  });

  document.getElementById('saved-story-next-act')?.addEventListener('click', () => {
    const chapters = readingSavedStory?.acts || readingSavedStory?.chapters || [];
    if (readingSavedStory && currentSavedActIndex < chapters.length - 1) {
      Sound.tap();
      currentSavedActIndex++;
      store.notify();
    }
  });

  document.getElementById('saved-act-read-aloud-btn')?.addEventListener('click', () => {
    if (readingSavedStory) {
      const chapters = readingSavedStory.acts || readingSavedStory.chapters || [];
      const act = chapters[currentSavedActIndex];
      if (act) {
        Sound.bloop();
        speakCompanion(act.text, readingSavedStory.petId || '1');
      }
    }
  });

  // Listen for AutoAdvance tick custom events to update UI
  if (typeof window !== 'undefined' && !window._bedtimeStoryAutoAdvanceListenerAttached) {
    window._bedtimeStoryAutoAdvanceListenerAttached = true;
    window.addEventListener('bedtime-story-autoadvance-tick', (e) => {
      const pill = document.getElementById('autoadvance-pill');
      const text = document.getElementById('autoadvance-text');
      if (pill && text && e.detail) {
        if (e.detail.active) {
          pill.style.display = 'flex';
          text.textContent = `Auto-Advance (${e.detail.secondsRemaining}s)`;
        } else {
          pill.style.display = 'none';
        }
      }
    });
  }
}
