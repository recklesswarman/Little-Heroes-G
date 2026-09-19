import { store, KID_AVATARS } from '../state/store.js';
import { firebaseAuth } from '../services/firebaseAuthService.js';
import { Sound } from '../audio/sfx.js';
import { speakRex } from '../services/voiceService.js';

let selectedAvatar = KID_AVATARS[0].url;
let authErrorMessage = '';
let isAuthLoading = false;

export function renderLandingAuthModal() {
  const state = store.getState();
  const step = (!state.isAuthenticated || !state.isHouseholdConfigured) && state.householdSetupStep === 'ready'
    ? 'auth'
    : (state.householdSetupStep || 'auth');
  const parentUser = state.household?.parentUser;
  const parentDisplayName = parentUser?.displayName || 'Parent';

  return `
    <div id="landing-auth-modal-root" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-xl overflow-y-auto select-none animate-fade-in">
      
      <!-- Background Ambient Lighting Glows -->
      <div class="fixed -top-20 -left-20 w-96 h-96 rounded-full bg-primary/20 blur-3xl pointer-events-none"></div>
      <div class="fixed -bottom-20 -right-20 w-96 h-96 rounded-full bg-secondary/20 blur-3xl pointer-events-none"></div>

      <div class="relative w-full max-w-lg bg-surface-container border-4 border-surface-container-highest/80 rounded-3xl p-5 sm:p-8 card-shadow-lg shadow-2xl flex flex-col gap-5 my-auto overflow-hidden">
        
        ${step === 'auth' ? renderWelcomeAuthScreen() : ''}
        ${step === 'choice' ? renderHouseholdChoiceScreen(parentDisplayName) : ''}
        ${step === 'create' ? renderCreateHouseholdScreen(parentDisplayName) : ''}
        ${step === 'join' ? renderJoinHouseholdScreen() : ''}

      </div>
    </div>
  `;
}

/**
 * Screen 1: Welcome Auth Wall
 * High-conversion, friendly Google 1-click login wall
 */
function renderWelcomeAuthScreen() {
  const state = store.getState();
  const existingCode = (state.household?.syncCode || '').trim().toUpperCase();
  const existingName = state.household?.name || 'My Family';
  const hasParent = Boolean(
    state.household?.parentUser?.uid ||
    state.household?.parentUser?.email ||
    (state.household?.parents && state.household.parents.length > 0) ||
    (state.household?.parentEmails && state.household.parentEmails.length > 0)
  );
  const hasCustomHeroes = Array.isArray(state.heroes) && (
    state.heroes.length > 1 ||
    state.heroes.some(h => (
      (h.name && h.name !== 'Little Hero') ||
      (h.points && Number(h.points) > 0) ||
      (h.coins && Number(h.coins) > 0) ||
      (h.level && Number(h.level) > 1)
    ))
  );
  const hasExistingHousehold = Boolean((existingCode && existingCode.length >= 4) || hasParent || hasCustomHeroes);
  const displayCode = (existingCode && existingCode.length >= 4) ? existingCode : 'HERO-8842';

  return `
    <!-- Top Mascot & Title -->
    <div class="flex flex-col items-center text-center gap-3">
      <div class="relative">
        <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-primary via-emerald-500 to-teal-400 p-1 shadow-lg shadow-primary/30 flex items-center justify-center animate-bounce">
          <span class="text-4xl sm:text-5xl select-none" role="img" aria-label="Rex">🦖</span>
        </div>
        <span class="absolute -bottom-2 -right-2 bg-amber-400 text-slate-950 font-headline font-black text-[10px] px-2.5 py-0.5 rounded-full border-2 border-slate-900 shadow">
          FAMILY SAFE
        </span>
      </div>

      <div class="flex flex-col gap-1">
        <h1 class="font-headline text-2xl sm:text-3xl font-black text-white tracking-tight">
          Little Hero Adventures
        </h1>
        <p class="text-xs sm:text-sm text-slate-300 font-bold max-w-sm mx-auto leading-relaxed">
          Gamified habits, 3D companion pets, and real-time cross-device sync for your household.
        </p>
      </div>
    </div>

    <!-- Feature Pillars -->
    <div class="grid grid-cols-1 gap-2.5 bg-surface-container-high/60 p-3.5 sm:p-4 rounded-2xl border border-surface-container-highest/60 text-left">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 text-lg">
          🛡️
        </div>
        <div class="flex flex-col min-w-0">
          <span class="font-headline text-xs font-black text-white">Private & Isolated Family Cloud</span>
          <span class="text-[11px] text-slate-400 font-medium truncate">No stranger data. Your family habits stay private.</span>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-secondary/20 text-secondary flex items-center justify-center flex-shrink-0 text-lg">
          📱
        </div>
        <div class="flex flex-col min-w-0">
          <span class="font-headline text-xs font-black text-white">Real-Time Multi-Device Sync</span>
          <span class="text-[11px] text-slate-400 font-medium truncate">Parents' phones and kids' tablets update together instantly.</span>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center flex-shrink-0 text-lg">
          🪥
        </div>
        <div class="flex flex-col min-w-0">
          <span class="font-headline text-xs font-black text-white">Dentist-Approved Fun</span>
          <span class="text-[11px] text-slate-400 font-medium truncate">2-minute AR tooth timer, chore bounties & dino workouts.</span>
        </div>
      </div>
    </div>

    <!-- Error Notice if any -->
    ${authErrorMessage ? `
      <div class="bg-rose-500/20 border-2 border-rose-500/50 rounded-2xl p-3 text-rose-300 text-xs font-bold flex items-center gap-2">
        <span class="material-symbols-outlined text-base">warning</span>
        <span>${authErrorMessage}</span>
      </div>
    ` : ''}

    ${hasExistingHousehold ? `
      <!-- Active Household Detected: 1-Click Resume Button -->
      <button 
        id="auth-resume-household-btn" 
        class="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-primary hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-headline text-base sm:text-lg font-black py-4 px-6 min-h-[56px] rounded-2xl shadow-xl flex items-center justify-center gap-2.5 border-b-4 border-emerald-700 active:translate-y-1 active:border-b-0 transition-all cursor-pointer ring-2 ring-emerald-400/40"
      >
        <span class="text-xl">🏠</span>
        <span>Resume ${existingName} (${displayCode})</span>
        <span class="text-xl">➔</span>
      </button>

      <div class="flex items-center gap-3 my-0.5">
        <div class="h-px bg-surface-container-highest/80 flex-1"></div>
        <span class="text-[10px] uppercase font-black tracking-wider text-slate-400">or sign in with google</span>
        <div class="h-px bg-surface-container-highest/80 flex-1"></div>
      </div>
    ` : ''}

    <!-- 1-Click Google Sign-In Action Button (Minimum 56px touch target) -->
    <div class="flex flex-col gap-2.5 pt-1">
      <button 
        id="auth-google-signin-btn" 
        class="w-full bg-white hover:bg-slate-100 text-slate-900 font-headline text-base sm:text-lg font-black py-4 px-6 min-h-[56px] rounded-2xl shadow-xl flex items-center justify-center gap-3 border-b-4 border-slate-300 active:translate-y-1 active:border-b-0 transition-all cursor-pointer ${isAuthLoading ? 'opacity-60 pointer-events-none' : ''}"
        ${isAuthLoading ? 'disabled' : ''}
      >
        <!-- Official Google 'G' SVG Logo -->
        <svg class="w-6 h-6 flex-shrink-0" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        <span>${isAuthLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
      </button>

      <p class="text-[11px] text-slate-400 text-center font-medium">
        Secure 1-click parent login • No passwords required
      </p>

      <div class="flex items-center gap-3 my-0.5">
        <div class="h-px bg-surface-container-highest/80 flex-1"></div>
        <span class="text-[10px] uppercase font-black tracking-wider text-slate-400">or</span>
        <div class="h-px bg-surface-container-highest/80 flex-1"></div>
      </div>

      <!-- Quick Sync Code Link for Children's Tablets & Secondary Devices -->
      <button 
        id="auth-enter-code-direct-btn"
        class="w-full bg-surface-container-high hover:bg-surface-bright text-secondary hover:text-white font-headline text-sm sm:text-base font-bold py-3.5 px-4 min-h-[48px] rounded-2xl border border-secondary/40 hover:border-secondary flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
      >
        <span>🔗 I Have a Family Sync Code (HERO-XXXX)</span>
      </button>
    </div>
  `;
}

/**
 * Screen 2: Household Choice Screen (New Google Account)
 * 2-Card Choice: Create New Family vs Join Existing Household
 */
function renderHouseholdChoiceScreen(parentDisplayName) {
  return `
    <div class="flex flex-col items-center text-center gap-2">
      <div class="w-14 h-14 rounded-2xl bg-secondary/20 text-secondary border border-secondary/40 flex items-center justify-center text-2xl shadow-sm">
        👋
      </div>
      <h2 class="font-headline text-xl sm:text-2xl font-black text-white">
        Welcome, ${parentDisplayName}!
      </h2>
      <p class="text-xs sm:text-sm text-slate-300 font-bold max-w-sm mx-auto">
        Your account is verified. How would you like to set up your family devices?
      </p>
    </div>

    <!-- 2 Setup Choices -->
    <div class="grid grid-cols-1 gap-4 pt-2">
      
      <!-- Option A: Create New Household -->
      <button 
        id="choice-create-new-btn"
        class="bg-surface-container-high hover:bg-surface-bright border-2 border-primary/50 hover:border-primary rounded-3xl p-4 sm:p-5 flex items-center gap-4 text-left transition-all active:scale-98 group card-shadow cursor-pointer min-h-[90px]"
      >
        <div class="w-14 h-14 rounded-2xl bg-primary/20 text-primary flex items-center justify-center text-3xl flex-shrink-0 group-hover:scale-105 transition-transform border border-primary/30">
          🏰
        </div>
        <div class="flex flex-col min-w-0 flex-1">
          <div class="flex items-center justify-between">
            <span class="font-headline text-base sm:text-lg font-black text-white group-hover:text-primary transition-colors">
              Create New Household
            </span>
            <span class="bg-primary/20 text-primary text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-primary/30">
              NEW FAMILY
            </span>
          </div>
          <p class="text-xs text-slate-300 font-medium mt-1">
            Set up a fresh family account, add your first child hero, and get your unique sync code.
          </p>
        </div>
      </button>

      <!-- Option B: Join Existing Household -->
      <button 
        id="choice-join-existing-btn"
        class="bg-surface-container-high hover:bg-surface-bright border-2 border-secondary/50 hover:border-secondary rounded-3xl p-4 sm:p-5 flex items-center gap-4 text-left transition-all active:scale-98 group card-shadow cursor-pointer min-h-[90px]"
      >
        <div class="w-14 h-14 rounded-2xl bg-secondary/20 text-secondary flex items-center justify-center text-3xl flex-shrink-0 group-hover:scale-105 transition-transform border border-secondary/30">
          🔗
        </div>
        <div class="flex flex-col min-w-0 flex-1">
          <div class="flex items-center justify-between">
            <span class="font-headline text-base sm:text-lg font-black text-white group-hover:text-secondary transition-colors">
              Join Existing Household
            </span>
            <span class="bg-secondary/20 text-secondary text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-secondary/30">
              I HAVE A CODE
            </span>
          </div>
          <p class="text-xs text-slate-300 font-medium mt-1">
            Already have a family code on another phone or tablet? Enter your HERO-XXXX code to sync.
          </p>
        </div>
      </button>

    </div>
  `;
}

/**
 * Screen 3: Create New Household Form
 */
function renderCreateHouseholdScreen(parentDisplayName) {
  const defaultFamilyName = `The ${parentDisplayName.split(' ')[0] || 'Hero'} Family`;

  return `
    <!-- Top Back and Header -->
    <div class="flex items-center justify-between border-b border-surface-container-highest pb-3">
      <button id="auth-back-to-choice-btn" class="text-on-surface-variant hover:text-white font-headline text-xs font-black flex items-center gap-1 min-h-[44px] px-2 active:scale-95">
        <span class="material-symbols-outlined text-base">arrow_back</span> Back
      </button>
      <span class="text-[11px] font-black uppercase tracking-wider text-primary">Family Setup</span>
      <div class="w-10"></div>
    </div>

    <div class="flex flex-col gap-1 text-center">
      <h2 class="font-headline text-xl sm:text-2xl font-black text-white">
        Name Your Household 🏰
      </h2>
      <p class="text-xs text-slate-300 font-bold">
        Takes 30 seconds. You can customize anytime in the Parent Portal.
      </p>
    </div>

    <form id="new-household-form" class="flex flex-col gap-4">
      
      <!-- Field 1: Family Name -->
      <div class="flex flex-col gap-1.5 text-left">
        <label for="input-family-name" class="font-headline text-xs font-black text-slate-200">
          Family Name:
        </label>
        <input 
          id="input-family-name" 
          type="text" 
          value="${defaultFamilyName}" 
          placeholder="e.g. The Hero Family"
          required
          class="bg-surface-container-high border-2 border-surface-container-highest focus:border-primary rounded-2xl px-4 py-3 text-sm font-bold text-white w-full focus:outline-none transition-all shadow-inner min-h-[50px]"
        />
      </div>

      <!-- Field 2: First Child Name -->
      <div class="flex flex-col gap-1.5 text-left">
        <label for="input-child-name" class="font-headline text-xs font-black text-slate-200">
          First Child's Name:
        </label>
        <input 
          id="input-child-name" 
          type="text" 
          placeholder="e.g. Leo or Kaleb" 
          required
          class="bg-surface-container-high border-2 border-surface-container-highest focus:border-primary rounded-2xl px-4 py-3 text-sm font-bold text-white w-full focus:outline-none transition-all shadow-inner min-h-[50px]"
        />
      </div>

      <!-- Field 3: Child Avatar Selection -->
      <div class="flex flex-col gap-2 text-left">
        <label class="font-headline text-xs font-black text-slate-200">
          Choose Starter Hero Avatar:
        </label>
        <div class="grid grid-cols-4 gap-2.5">
          ${KID_AVATARS.map((av) => {
            const isSelected = selectedAvatar === av.url;
            return `
              <button 
                type="button" 
                data-avatar-url="${av.url}" 
                class="landing-avatar-btn relative rounded-2xl p-1 border-3 transition-all active:scale-95 min-h-[64px] flex items-center justify-center ${isSelected ? 'border-primary bg-primary/20 scale-105 shadow-md ring-2 ring-primary/50' : 'border-surface-container-highest bg-surface-container-high hover:border-surface-bright'}"
                title="${av.label}"
              >
                <img src="${av.url}" alt="${av.label}" class="w-12 h-12 rounded-xl object-cover" />
                ${isSelected ? `
                  <div class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-slate-950 flex items-center justify-center text-xs font-black shadow">
                    ✓
                  </div>
                ` : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Included Starter Pack Preview -->
      <div class="bg-primary/10 border border-primary/30 rounded-2xl p-3 text-left flex flex-col gap-1 text-[11px] font-bold text-slate-300">
        <span class="text-primary font-black uppercase text-[10px] tracking-wider">🌟 Included Starter Habits:</span>
        <div class="flex items-center gap-1.5 text-slate-200">
          <span>✓ 🪥 Morning & Bedtime Toothbrushing</span>
        </div>
        <div class="flex items-center gap-1.5 text-slate-200">
          <span>✓ 🧸 Clean Up Toys & Bed</span>
        </div>
        <div class="flex items-center gap-1.5 text-slate-200">
          <span>✓ 💧 Hydration & Healthy Habits</span>
        </div>
      </div>

      <!-- Submit Action Button -->
      <button 
        type="submit" 
        id="btn-launch-family"
        class="w-full bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-400 text-slate-950 font-headline text-base sm:text-lg font-black py-4 px-6 min-h-[56px] rounded-2xl shadow-xl flex items-center justify-center gap-2 border-b-4 border-emerald-600 active:translate-y-1 active:border-b-0 transition-all cursor-pointer mt-1"
      >
        <span>Launch Family Adventure!</span>
        <span class="text-xl">🚀</span>
      </button>

    </form>
  `;
}

/**
 * Screen 4: Join Existing Household Form
 */
function renderJoinHouseholdScreen() {
  return `
    <!-- Top Back and Header -->
    <div class="flex items-center justify-between border-b border-surface-container-highest pb-3">
      <button id="auth-back-to-choice-btn" class="text-on-surface-variant hover:text-white font-headline text-xs font-black flex items-center gap-1 min-h-[44px] px-2 active:scale-95">
        <span class="material-symbols-outlined text-base">arrow_back</span> Back
      </button>
      <span class="text-[11px] font-black uppercase tracking-wider text-secondary">Device Link</span>
      <div class="w-10"></div>
    </div>

    <div class="flex flex-col gap-1 text-center">
      <h2 class="font-headline text-xl sm:text-2xl font-black text-white">
        Enter Family Sync Code 🔗
      </h2>
      <p class="text-xs text-slate-300 font-bold">
        Find this in your family's Parent Portal on any linked device.
      </p>
    </div>

    <form id="join-household-form" class="flex flex-col gap-4 pt-2">
      
      <div class="flex flex-col gap-1.5 text-left">
        <label for="input-join-code" class="font-headline text-xs font-black text-slate-200">
          Family Sync Code:
        </label>
        <input 
          id="input-join-code" 
          type="text" 
          placeholder="HERO-XXXX" 
          required
          maxlength="12"
          class="bg-surface-container-high border-2 border-surface-container-highest focus:border-secondary rounded-2xl px-4 py-3 text-center text-xl sm:text-2xl font-headline tracking-widest font-black text-secondary uppercase w-full focus:outline-none transition-all shadow-inner min-h-[56px]"
        />
        <p class="text-[11px] text-slate-400 font-medium text-center mt-1">
          Example format: <span class="text-secondary font-bold font-mono">HERO-8842</span>
        </p>
      </div>

      <!-- Submit Action Button -->
      <button 
        type="submit" 
        id="btn-join-family"
        class="w-full bg-gradient-to-r from-secondary to-amber-500 hover:from-secondary/90 hover:to-amber-400 text-slate-950 font-headline text-base sm:text-lg font-black py-4 px-6 min-h-[56px] rounded-2xl shadow-xl flex items-center justify-center gap-2 border-b-4 border-amber-600 active:translate-y-1 active:border-b-0 transition-all cursor-pointer mt-2"
      >
        <span>Connect & Sync Device</span>
        <span class="text-xl">🚀</span>
      </button>

    </form>
  `;
}

/**
 * Attach interactive event listeners for all screens
 */
export function attachLandingAuthModalListeners() {
  // 1. Resume Household Button (Instant 1-click restore)
  const resumeBtn = document.getElementById('auth-resume-household-btn');
  if (resumeBtn) {
    resumeBtn.addEventListener('click', () => {
      Sound.fanfare();
      const state = store.getState();
      state.isAuthenticated = true;
      state.isHouseholdConfigured = true;
      state.householdSetupStep = 'ready';
      if (!state.household.syncCode || state.household.syncCode.trim().length < 4) {
        state.household.syncCode = 'HERO-8842';
      }
      store.saveState(true);
      store.notify();
    });
  }

  // 2. Direct Enter Code Button from Screen 1
  const enterCodeDirectBtn = document.getElementById('auth-enter-code-direct-btn');
  if (enterCodeDirectBtn) {
    enterCodeDirectBtn.addEventListener('click', () => {
      Sound.click();
      store.setHouseholdSetupStep('join');
    });
  }

  // 3. Google Sign-In Button
  const googleBtn = document.getElementById('auth-google-signin-btn');
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      Sound.click();
      isAuthLoading = true;
      authErrorMessage = '';
      store.notify();

      try {
        await firebaseAuth.signInWithGoogle();
      } catch (err) {
        console.warn("Sign-in error:", err);
        authErrorMessage = err?.message || 'Google sign-in could not be completed. Please try again.';
      } finally {
        isAuthLoading = false;
        store.notify();
      }
    });
  }

  // 4. Choice Buttons (Create vs Join)
  const choiceCreateBtn = document.getElementById('choice-create-new-btn');
  if (choiceCreateBtn) {
    choiceCreateBtn.addEventListener('click', () => {
      Sound.click();
      store.setHouseholdSetupStep('create');
    });
  }

  const choiceJoinBtn = document.getElementById('choice-join-existing-btn');
  if (choiceJoinBtn) {
    choiceJoinBtn.addEventListener('click', () => {
      Sound.click();
      store.setHouseholdSetupStep('join');
    });
  }

  // 5. Back Button (Smart navigation: return to choice if parent logged in, otherwise return to auth)
  const backBtn = document.getElementById('auth-back-to-choice-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      Sound.click();
      const parentUser = store.getState().household?.parentUser;
      if (parentUser && parentUser.uid) {
        store.setHouseholdSetupStep('choice');
      } else {
        store.setHouseholdSetupStep('auth');
      }
    });
  }

  // 4. Avatar Picker in Create Form
  document.querySelectorAll('.landing-avatar-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      Sound.click();
      selectedAvatar = btn.getAttribute('data-avatar-url');
      store.notify();
    });
  });

  // 5. Create New Household Form Submit
  const newHouseholdForm = document.getElementById('new-household-form');
  if (newHouseholdForm) {
    newHouseholdForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const familyNameInput = document.getElementById('input-family-name');
      const childNameInput = document.getElementById('input-child-name');

      const familyName = familyNameInput?.value?.trim() || 'The Hero Family';
      const childName = childNameInput?.value?.trim() || 'Little Hero';

      Sound.fanfare();
      await store.initNewHousehold({
        familyName,
        childName,
        avatar: selectedAvatar
      });

      speakRex(`*Happy roar!* Welcome to Little Hero Adventures, ${childName}! Let's be great heroes together!`);
    });
  }

  // 6. Join Existing Household Form Submit
  const joinHouseholdForm = document.getElementById('join-household-form');
  if (joinHouseholdForm) {
    joinHouseholdForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const codeInput = document.getElementById('input-join-code');
      const syncCode = codeInput?.value?.trim()?.toUpperCase();

      if (!syncCode) return;

      Sound.click();
      const result = await store.joinExistingHousehold(syncCode);
      if (result?.success) {
        Sound.fanfare();
        speakRex(`Hooray! Connected to ${result.householdName || 'your household'}! All devices are in sync!`);
      } else {
        alert(result?.error || 'Could not connect with that sync code. Please verify the code on your family device.');
      }
    });
  }
}
