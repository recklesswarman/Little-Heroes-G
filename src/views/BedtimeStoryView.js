/**
 * Bedtime AI Storybook Adventure & Bookshelf Library View
 * Little Hero Adventures - Immersive Night-Mode Storytelling Experience
 * 
 * Strict Explorer Palette: ZERO pink or purple.
 * Only midnight slate, emerald green, starlight cyan, solar orange, and amber gold.
 * Non-blocking habit minting per kid_voice_companion_guidelines.md.
 */

import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { BEDTIME_REALMS } from '../data/bedtimeStoryData.js';
import { bedtimeStoryService } from '../services/bedtimeStoryService.js';
import { speakCompanion, stopCompanionAudio } from '../services/voiceService.js';

let activeViewMode = 'realms'; // 'realms' | 'story' | 'bookshelf'
let isNightLightOn = true;
let isMicListening = false;
let isGeneratingScene = false;
let readingSavedStory = null;
let currentSavedActIndex = 0;

export function renderBedtimeStoryView() {
  const hero = store.getState().selectedHero;
  const petId = String(hero.activePetId || '1');
  const pet = (store.getState().pets || []).find(p => String(p.id) === petId) || { name: 'Rex the Dino', avatar: '🦖' };
  const library = store.getBedtimeStoryLibrary();
  const session = bedtimeStoryService.getActiveSession();
  const mapState = store.getWorldAdventureMapState();
  const isLullabyOn = Boolean(mapState.bedtimeLullabyActive);

  return `
    <div class="min-h-screen bg-[#050f18] text-slate-100 flex flex-col justify-between selection:bg-[#00d2d3] selection:text-black relative overflow-x-hidden ${isNightLightOn ? '' : 'brightness-75 transition-all duration-700'}">
      
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
                <span>Story companion: ${pet.name}</span>
              </p>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- Night Light Dimmer Toggle -->
          <button id="toggle-night-light-btn" class="px-3 py-1.5 rounded-xl border border-surface-container-highest text-xs font-black flex items-center gap-1.5 transition-all ${
            isNightLightOn ? 'bg-[#ffb961]/20 text-[#ffb961] border-[#ffb961]/40' : 'bg-[#0f2334] text-slate-400'
          }">
            <span class="material-symbols-outlined text-sm">${isNightLightOn ? 'light_mode' : 'dark_mode'}</span>
            <span class="hidden sm:inline">${isNightLightOn ? 'Night Light On' : 'Dimmed'}</span>
          </button>

          <!-- Bedtime Lullaby Toggle -->
          <button id="toggle-story-lullaby-btn" class="px-3 py-1.5 rounded-xl border border-surface-container-highest text-xs font-black flex items-center gap-1.5 transition-all ${
            isLullabyOn ? 'bg-[#00d2d3]/20 text-[#00d2d3] border-[#00d2d3]/40 animate-pulse' : 'bg-[#0f2334] text-slate-400'
          }">
            <span class="material-symbols-outlined text-sm">music_note</span>
            <span class="hidden sm:inline">${isLullabyOn ? 'Lullaby Playing' : 'Play Lullaby'}</span>
          </button>

          <!-- Bookshelf Tab Button -->
          <button id="view-bookshelf-tab-btn" class="px-3 py-1.5 rounded-xl bg-[#0f2334] hover:bg-[#1a3850] text-[#ffb961] border border-surface-container-highest text-xs font-black flex items-center gap-1.5 active:scale-95 transition-all">
            <span class="material-symbols-outlined text-sm">auto_stories</span>
            <span>Bookshelf (${library.length})</span>
          </button>
        </div>
      </header>

      <!-- MAIN CONTENT VIEW ROUTING -->
      <main class="relative z-10 flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        ${activeViewMode === 'realms' ? renderRealmSelector(library) : ''}
        ${activeViewMode === 'story' ? renderStoryStage(session, pet, hero) : ''}
        ${activeViewMode === 'bookshelf' ? renderBookshelfLibrary(library) : ''}
      </main>

      <!-- BOTTOM ACCENT STRIP -->
      <footer class="relative z-10 bg-[#09141e]/75 backdrop-blur-md border-t border-surface-container-highest py-2.5 px-4 text-center text-xs text-slate-300 font-bold flex items-center justify-between">
        <span class="flex items-center gap-1.5 text-[11px]">
          <span class="text-[#ffb961]">✨</span>
          <span>Hero Bedtime Routine • Step 8</span>
        </span>
        <button id="footer-goto-map-btn" class="text-[#00d2d3] hover:underline flex items-center gap-1 text-[11px] font-black">
          <span>Explore 3D Adventure Island</span>
          <span class="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </footer>

    </div>
  `;
}

/**
 * Screen 1: Realm Selection & Bookshelf Teaser
 */
function renderRealmSelector(library) {
  return `
    <div class="flex flex-col gap-6 animate-fade-in">
      
      <!-- HERO PROLOGUE BANNER -->
      <div class="bg-gradient-to-r from-[#09141e] via-[#0f2334] to-[#122838] border-3 border-[#00d2d3]/50 rounded-4xl p-6 sm:p-8 shadow-[0_12px_0_0_#030910] flex flex-col sm:flex-row items-center justify-between gap-6">
        <div class="flex items-center gap-4 text-left">
          <div class="w-16 h-16 rounded-3xl bg-[#00d2d3]/20 border-2 border-[#00d2d3] flex items-center justify-center text-4xl shrink-0 shadow-inner">
            <span>✨</span>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-[#f39c12] text-black">Cozy Sleep Routine</span>
              <span class="text-xs font-bold text-slate-300">Earn +30 🪙 +15 ⚡</span>
            </div>
            <h2 class="font-headline text-xl sm:text-2xl font-black text-white mt-1">
              Choose Tonight's Bedtime Realm
            </h2>
            <p class="text-xs sm:text-sm text-slate-300 font-semibold mt-1">
              Rex will tell you a cozy interactive story where your good habits unlock magical dreams!
            </p>
          </div>
        </div>

        ${library.length > 0 ? `
          <button id="hero-banner-bookshelf-btn" class="shrink-0 px-4 py-3 rounded-2xl bg-[#1b3d58] hover:bg-[#255073] text-[#ffb961] border border-primary/40 font-headline font-black text-xs flex items-center gap-2 active:scale-95 transition-all">
            <span class="material-symbols-outlined text-base">auto_stories</span>
            <span>Open Saved Books (${library.length})</span>
          </button>
        ` : ''}
      </div>

      <!-- 4 CANONICAL BEDTIME REALM CARDS -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${BEDTIME_REALMS.map((realm) => `
          <div class="bg-gradient-to-br ${realm.bgGradient} rounded-3xl p-5 border-2 border-surface-container-highest shadow-[0_8px_0_0_#050f18] hover:border-primary/60 transition-all flex flex-col justify-between gap-4 group">
            <div class="flex items-start gap-4">
              <div class="w-14 h-14 rounded-2xl bg-[#09141e] border-2 flex items-center justify-center text-3xl shrink-0 shadow-md group-hover:scale-105 transition-transform" style="border-color: ${realm.accentColor};">
                <span>${realm.emoji}</span>
              </div>
              <div class="flex flex-col text-left">
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-black uppercase text-slate-400">Realm</span>
                  <span class="text-slate-400">•</span>
                  <span class="text-[10px] font-black uppercase" style="color: ${realm.accentColor};">${realm.name.split(' ')[0]}</span>
                </div>
                <h3 class="font-headline text-lg font-black text-white leading-tight">
                  ${realm.name}
                </h3>
                <p class="text-xs text-slate-300 font-medium mt-1 leading-relaxed">
                  ${realm.subtitle}
                </p>
              </div>
            </div>

            <!-- Realm Habits Preview Chips -->
            <div class="flex flex-wrap gap-1.5">
              ${realm.heroHabitThemes.slice(0, 2).map(habit => `
                <span class="text-[10px] font-bold bg-[#09141e]/80 text-slate-300 px-2 py-0.5 rounded-lg border border-surface-container-highest">
                  ★ ${habit}
                </span>
              `).join('')}
            </div>

            <button data-select-realm="${realm.id}" class="w-full py-3 rounded-2xl text-black font-headline font-black text-xs sm:text-sm tracking-wide shadow-[0_4px_0_0_#030910] active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 cursor-pointer transition-all" style="background-color: ${realm.accentColor};">
              <span>EXPLORE THIS STORY</span>
              <span class="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>
        `).join('')}
      </div>

    </div>
  `;
}

/**
 * Screen 2: Interactive Story Stage
 */
function renderStoryStage(session, pet, hero) {
  if (!session || !session.acts || session.acts.length === 0) {
    return `
      <div class="text-center py-20 flex flex-col items-center gap-4">
        <span class="material-symbols-outlined text-5xl text-[#00d2d3] animate-spin">cyclone</span>
        <h2 class="font-headline text-xl font-black text-white">Opening the Bedtime Storybook...</h2>
      </div>
    `;
  }

  const currentAct = session.acts[session.actNumber - 1] || session.acts[session.acts.length - 1];
  const isAct3 = currentAct.actNumber === 3;

  return `
    <div class="flex flex-col gap-5 animate-fade-in">
      
      <!-- TOP CHAPTER STEPPER -->
      <div class="flex items-center justify-between bg-[#09141e]/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-surface-container-highest shadow">
        <div class="flex items-center gap-2">
          <span class="text-xl">${session.realmEmoji}</span>
          <span class="font-headline font-black text-xs sm:text-sm text-white">${session.realmName}</span>
        </div>

        <!-- 3-Act Step Dots -->
        <div class="flex items-center gap-2">
          ${[1, 2, 3].map(step => `
            <div class="flex items-center gap-1">
              <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                session.actNumber === step
                  ? 'bg-[#00d2d3] text-black ring-2 ring-[#00d2d3]/50 ring-offset-2 ring-offset-[#09141e]'
                  : session.actNumber > step
                    ? 'bg-[#2ecc71] text-black'
                    : 'bg-[#0f2334] text-slate-500'
              }">
                ${session.actNumber > step ? '✓' : step}
              </div>
              ${step < 3 ? '<div class="w-3 h-0.5 bg-surface-container-highest"></div>' : ''}
            </div>
          `).join('')}
        </div>

        <button id="story-choose-different-realm-btn" class="text-xs text-slate-400 hover:text-white font-bold flex items-center gap-1">
          <span>Change Realm</span>
        </button>
      </div>

      <!-- CENTER ILLUSTRATED SCENE VIGNETTE -->
      <div class="relative bg-[#050f18] rounded-4xl border-4 border-surface-container-highest shadow-[0_16px_0_0_#030910] min-h-[300px] sm:min-h-[420px] overflow-hidden flex items-center justify-center">
        ${currentAct.svgArt}

        ${isGeneratingScene ? `
          <div class="absolute inset-0 bg-[#050f18]/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-20">
            <span class="material-symbols-outlined text-4xl text-[#ffb961] animate-spin">auto_awesome</span>
            <p class="font-headline font-black text-sm text-[#ffb961] animate-pulse">Rex is weaving your next scene...</p>
          </div>
        ` : ''}

        <!-- Top Right Act Tag -->
        <div class="absolute top-4 right-4 bg-[#09141e]/90 backdrop-blur-md px-3 py-1 rounded-xl border border-surface-container-highest text-[10px] font-black uppercase text-[#ffb961]">
          Act ${currentAct.actNumber} of 3
        </div>
      </div>

      <!-- SPOKEN NARRATIVE TEXT BLOCK -->
      <div class="bg-[#09141e] border-3 border-surface-container-highest rounded-3xl p-5 sm:p-6 shadow-md flex flex-col gap-4">
        
        <div class="flex items-start gap-4">
          <!-- Rex Companion Disc -->
          <div class="w-14 h-14 rounded-2xl bg-[#0f2334] border-2 border-[#2ecc71] flex items-center justify-center text-3xl shrink-0 shadow-inner relative group cursor-pointer" id="story-pet-disc" title="Tap to hear Rex again!">
            <span>🦖</span>
            <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#2ecc71] text-black flex items-center justify-center text-[10px] font-black">
              🔊
            </div>
          </div>

          <div class="flex-1 text-left">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-black uppercase text-[#2ecc71]">
                ${pet.name} Narrating
              </span>
              <button id="story-replay-voice-btn" class="bg-[#0f2334] hover:bg-[#1a3850] text-[#00d2d3] border border-[#00d2d3]/30 px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 active:scale-95 cursor-pointer">
                <span class="material-symbols-outlined text-xs">volume_up</span>
                <span>Listen Again</span>
              </button>
            </div>
            <p class="font-body text-sm sm:text-base text-white font-medium mt-1 leading-relaxed">
              "${currentAct.text}"
            </p>
          </div>
        </div>

        <!-- WHIMSICAL PROMPT & TODDLER INPUT -->
        <div class="border-t border-surface-container-highest/60 pt-4 flex flex-col gap-3">
          
          <div class="bg-[#0f2334] p-3.5 rounded-2xl border border-surface-container-highest text-left">
            <span class="text-[10px] font-black uppercase text-[#ffb961] flex items-center gap-1">
              <span class="material-symbols-outlined text-xs">help</span>
              <span>Hero Bedtime Question</span>
            </span>
            <p class="font-headline font-black text-sm text-white mt-0.5">
              ${currentAct.promptQuestion}
            </p>
          </div>

          ${!isAct3 ? `
            <!-- DUAL SPEECH & QUICK CHIPS -->
            <div class="flex flex-col sm:flex-row items-center gap-3">
              
              <!-- Large Tactile Microphone Button -->
              <button id="story-mic-btn" class="w-full sm:w-auto px-6 py-3.5 rounded-2xl font-headline font-black text-xs sm:text-sm tracking-wide shadow-[0_4px_0_0_#050f18] active:translate-y-1 active:shadow-none flex items-center justify-center gap-2.5 cursor-pointer transition-all ${
                isMicListening
                  ? 'bg-red-500 text-white animate-pulse border-2 border-white'
                  : 'bg-gradient-to-r from-[#00d2d3] to-[#0284c7] text-[#050f18]'
              }">
                <span class="material-symbols-outlined text-xl">${isMicListening ? 'mic' : 'mic_none'}</span>
                <span>${isMicListening ? 'LISTENING... SPEAK!' : 'TAP & SPEAK TO REX'}</span>
              </button>

              <!-- Quick Suggestion Chips Container -->
              <div class="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-center sm:justify-start">
                ${(currentAct.suggestionChips || []).map((chip, idx) => `
                  <button data-select-chip="${chip.text || chip}" class="px-3.5 py-2.5 rounded-xl bg-[#1b3d58] hover:bg-[#255073] text-white border border-surface-container-highest text-xs font-bold active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer">
                    <span>${chip.text || chip}</span>
                  </button>
                `).join('')}
              </div>

            </div>
          ` : `
            <!-- ACT 3 BEDTIME CONCLUSION CONTROLS -->
            <div class="bg-gradient-to-r from-[#081c15] to-[#0f2334] p-4 rounded-2xl border-2 border-[#2ecc71]/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
              <div>
                <span class="text-[10px] font-black uppercase text-[#2ecc71] flex items-center gap-1">
                  <span class="material-symbols-outlined text-xs">verified</span>
                  <span>Bedtime Slumber Complete!</span>
                </span>
                <h4 class="font-headline font-black text-sm text-white">
                  Sweet dreams, Little Hero! +30 Tokens 🪙 +15 Sparks ⚡
                </h4>
              </div>

              <div class="flex items-center gap-2 w-full sm:w-auto">
                <button id="story-save-bookshelf-btn" class="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#ffb961] text-black font-headline font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                  <span class="material-symbols-outlined text-sm">bookmark</span>
                  <span>Save to Bookshelf</span>
                </button>
                <button id="story-finish-return-btn" class="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#0f2334] hover:bg-[#1a3850] text-slate-200 border border-surface-container-highest font-headline font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                  <span>Close Story</span>
                </button>
              </div>
            </div>
          `}

        </div>

      </div>

    </div>
  `;
}

/**
 * Screen 3: Bookshelf Library View
 */
function renderBookshelfLibrary(library) {
  if (readingSavedStory) {
    const act = readingSavedStory.acts[currentSavedActIndex] || readingSavedStory.acts[0];
    return `
      <div class="flex flex-col gap-5 animate-fade-in">
        <div class="flex items-center justify-between bg-[#09141e] p-3 rounded-2xl border border-surface-container-highest">
          <button id="close-reading-saved-btn" class="text-xs text-[#00d2d3] font-black flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">arrow_back</span>
            <span>Back to Bookshelf</span>
          </button>
          <span class="font-headline font-black text-xs text-white">
            ${readingSavedStory.title} (Act ${currentSavedActIndex + 1} of ${readingSavedStory.acts.length})
          </span>
          <div class="flex items-center gap-1.5">
            <button id="saved-story-prev-act" class="w-7 h-7 rounded-lg bg-[#0f2334] text-white flex items-center justify-center disabled:opacity-30" ${currentSavedActIndex === 0 ? 'disabled' : ''}>
              ‹
            </button>
            <button id="saved-story-next-act" class="w-7 h-7 rounded-lg bg-[#0f2334] text-white flex items-center justify-center disabled:opacity-30" ${currentSavedActIndex >= readingSavedStory.acts.length - 1 ? 'disabled' : ''}>
              ›
            </button>
          </div>
        </div>

        <div class="relative bg-[#050f18] rounded-4xl border-4 border-surface-container-highest shadow-[0_16px_0_0_#030910] min-h-[300px] overflow-hidden flex items-center justify-center">
          ${act.svgArt}
        </div>

        <div class="bg-[#09141e] border-3 border-surface-container-highest rounded-3xl p-5 text-left flex flex-col gap-3">
          <h3 class="font-headline font-black text-base text-white">${act.title}</h3>
          <p class="font-body text-sm text-slate-200">${act.text}</p>
          ${act.childChoice ? `
            <div class="bg-[#0f2334] px-3 py-1.5 rounded-xl border border-primary/30 text-xs text-[#ffb961] font-bold">
              ★ Hero Choice: "${act.childChoice}"
            </div>
          ` : ''}
          <button id="saved-act-read-aloud-btn" class="self-start mt-2 px-3.5 py-1.5 rounded-xl bg-[#00d2d3] text-black font-headline font-black text-xs flex items-center gap-1.5">
            <span class="material-symbols-outlined text-sm">volume_up</span>
            <span>Read Aloud</span>
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="flex flex-col gap-6 animate-fade-in text-left">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-headline font-black text-xl text-white">Your Bedtime Bookshelf</h2>
          <p class="text-xs text-slate-400 font-semibold">Re-read previous bedtime adventures anytime!</p>
        </div>
        <button id="bookshelf-new-adventure-btn" class="px-4 py-2 rounded-xl bg-[#00d2d3] text-black font-headline font-black text-xs flex items-center gap-1.5 active:scale-95 shadow">
          <span class="material-symbols-outlined text-sm">add</span>
          <span>New Story</span>
        </button>
      </div>

      ${library.length === 0 ? `
        <div class="bg-[#09141e] rounded-3xl p-10 border-2 border-surface-container-highest text-center flex flex-col items-center gap-3">
          <span class="text-5xl">📚</span>
          <h3 class="font-headline font-black text-lg text-white">Your Bookshelf is Empty</h3>
          <p class="text-xs text-slate-400 max-w-sm">Complete your first bedtime adventure with Rex to store your storybook here!</p>
          <button id="empty-bookshelf-start-btn" class="mt-2 px-5 py-2.5 rounded-xl bg-[#2ecc71] text-black font-headline font-black text-xs shadow active:scale-95">
            Start a Bedtime Story
          </button>
        </div>
      ` : `
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          ${library.map((story) => {
            const formattedDate = new Date(story.savedAt || story.createdAt || Date.now()).toLocaleDateString();
            return `
              <div class="bg-[#09141e] rounded-3xl p-4 border-2 border-surface-container-highest shadow-md hover:border-[#00d2d3]/50 transition-all flex flex-col justify-between gap-3">
                <div>
                  <div class="flex items-center justify-between text-xs text-slate-400 font-bold mb-2">
                    <span>${story.realmEmoji || '📖'} ${story.realmName || 'Adventure'}</span>
                    <span>${formattedDate}</span>
                  </div>
                  <h3 class="font-headline font-black text-sm text-white leading-tight">
                    ${story.title}
                  </h3>
                  <p class="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    ${story.acts && story.acts[0] ? story.acts[0].text : 'A magical journey with Rex'}
                  </p>
                </div>

                <button data-open-saved-story="${story.id}" class="w-full py-2.5 rounded-xl bg-[#1b3d58] hover:bg-[#255073] text-[#00d2d3] font-headline font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                  <span class="material-symbols-outlined text-sm">menu_book</span>
                  <span>Read Story</span>
                </button>
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
    if (activeViewMode === 'story' || activeViewMode === 'bookshelf') {
      activeViewMode = 'realms';
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
    store.navigate('world_map');
  });

  // Toggle Night Light Dimmer
  document.getElementById('toggle-night-light-btn')?.addEventListener('click', () => {
    Sound.tap();
    isNightLightOn = !isNightLightOn;
    store.notify();
  });

  // Toggle Bedtime Lullaby
  document.getElementById('toggle-story-lullaby-btn')?.addEventListener('click', () => {
    Sound.tap();
    store.toggleBedtimeLullaby();
    store.notify();
  });

  // View Bookshelf Tab
  document.getElementById('view-bookshelf-tab-btn')?.addEventListener('click', () => {
    Sound.bloop();
    activeViewMode = activeViewMode === 'bookshelf' ? 'realms' : 'bookshelf';
    readingSavedStory = null;
    store.notify();
  });

  document.getElementById('hero-banner-bookshelf-btn')?.addEventListener('click', () => {
    Sound.bloop();
    activeViewMode = 'bookshelf';
    readingSavedStory = null;
    store.notify();
  });

  document.getElementById('bookshelf-new-adventure-btn')?.addEventListener('click', () => {
    Sound.bloop();
    activeViewMode = 'realms';
    readingSavedStory = null;
    store.notify();
  });

  document.getElementById('empty-bookshelf-start-btn')?.addEventListener('click', () => {
    Sound.bloop();
    activeViewMode = 'realms';
    store.notify();
  });

  // Choose Different Realm from Story Stage
  document.getElementById('story-choose-different-realm-btn')?.addEventListener('click', () => {
    Sound.bloop();
    stopCompanionAudio();
    activeViewMode = 'realms';
    store.notify();
  });

  // Select Realm to Start Story
  document.querySelectorAll('[data-select-realm]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const realmId = btn.getAttribute('data-select-realm');
      Sound.chirp();
      activeViewMode = 'story';
      isGeneratingScene = true;
      store.notify();

      await bedtimeStoryService.startStory(realmId);
      isGeneratingScene = false;
      store.notify();
    });
  });

  // Mic Button Speech Recognition
  const micBtn = document.getElementById('story-mic-btn');
  if (micBtn) {
    micBtn.addEventListener('click', () => {
      Sound.tap();
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
      isGeneratingScene = true;
      store.notify();

      await bedtimeStoryService.advanceStory(chipText);
      isGeneratingScene = false;
      store.notify();
    });
  });

  // Replay Voice Button & Pet Disc
  const replayVoice = () => {
    Sound.bloop();
    const session = bedtimeStoryService.getActiveSession();
    if (session && session.acts) {
      const currentAct = session.acts[session.actNumber - 1];
      if (currentAct) {
        speakCompanion(currentAct.text, session.petId);
      }
    }
  };

  document.getElementById('story-replay-voice-btn')?.addEventListener('click', replayVoice);
  document.getElementById('story-pet-disc')?.addEventListener('click', replayVoice);

  // Finish and return
  document.getElementById('story-finish-return-btn')?.addEventListener('click', () => {
    Sound.tap();
    stopCompanionAudio();
    store.navigate('world_map');
  });

  document.getElementById('story-save-bookshelf-btn')?.addEventListener('click', () => {
    Sound.fanfare();
    activeViewMode = 'bookshelf';
    store.notify();
  });

  // Saved Story Reading Handlers
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
    if (readingSavedStory && currentSavedActIndex < readingSavedStory.acts.length - 1) {
      Sound.tap();
      currentSavedActIndex++;
      store.notify();
    }
  });

  document.getElementById('saved-act-read-aloud-btn')?.addEventListener('click', () => {
    if (readingSavedStory) {
      const act = readingSavedStory.acts[currentSavedActIndex];
      if (act) {
        Sound.bloop();
        speakCompanion(act.text, readingSavedStory.petId || '1');
      }
    }
  });
}
