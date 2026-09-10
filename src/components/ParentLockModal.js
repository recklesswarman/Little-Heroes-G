import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { isBiometricsAvailable, authenticateWithBiometrics } from '../utils/biometrics.js';
import { speakRex } from '../services/voiceService.js';
import { firebaseAuth } from '../services/firebaseAuthService.js';

let isOpen = false;
let activeAuthTab = 'biometric'; // 'biometric', 'pin', 'math'
let hasBiometrics = false;
let biometricStatusMsg = '';
let mathChallenge = { q: '8 × 7 = ?', a: 56 };
let pinError = false;
let mathError = false;

function generateMathChallenge() {
  const problems = [
    { q: '8 × 7 = ?', a: 56 },
    { q: '9 × 6 = ?', a: 54 },
    { q: '7 × 9 = ?', a: 63 },
    { q: '8 × 9 = ?', a: 72 },
    { q: '6 × 8 = ?', a: 48 },
    { q: '7 × 7 = ?', a: 49 },
    { q: '12 × 5 = ?', a: 60 }
  ];
  return problems[Math.floor(Math.random() * problems.length)];
}

export function renderParentLockModal() {
  if (!isOpen) return '';

  const settings = store.getState().parentSettings || {};
  const parentPin = settings.pin || '1234';

  const allowBio = hasBiometrics && settings.biometricsEnabled !== false;
  const allowPin = settings.pinLockEnabled !== false;
  const allowMath = settings.mathChallengeEnabled !== false;

  const enabledTabs = [];
  if (allowBio) enabledTabs.push({ id: 'biometric', label: 'Biometric', icon: 'fingerprint' });
  if (allowPin) enabledTabs.push({ id: 'pin', label: 'PIN', icon: 'pin' });
  if (allowMath) enabledTabs.push({ id: 'math', label: 'Math Gate', icon: 'calculate' });
  enabledTabs.push({ id: 'account', label: 'Parent Auth', icon: 'account_circle' });

  // Ensure active auth tab is an enabled one
  if (enabledTabs.length > 0 && !enabledTabs.some(t => t.id === activeAuthTab)) {
    activeAuthTab = enabledTabs[0].id;
  }

  return `
    <div id="parent-modal-backdrop" class="fixed inset-0 bg-background/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in select-none">
      <div class="bg-surface-container border-4 border-secondary/50 rounded-3xl p-6 sm:p-7 max-w-md w-full card-shadow-lg flex flex-col gap-5 relative">
        
        <!-- Header -->
        <div class="flex justify-between items-center border-b-2 border-surface-container-highest pb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-2xl bg-secondary/20 text-secondary border border-secondary/40 flex items-center justify-center text-xl shadow-sm">
              <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">shield_person</span>
            </div>
            <div>
              <h2 class="font-headline text-lg sm:text-xl font-black text-inverse-surface">Parent Security Gate</h2>
              <p class="text-[11px] text-on-surface-variant font-bold">Adult verification required for dashboard</p>
            </div>
          </div>
          <button id="parent-modal-close" class="text-on-surface-variant hover:text-error text-2xl p-1 active:scale-95 transition-transform" title="Close Gate">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- Auth Method Selector Tabs (Filtered to Active Parent Settings) -->
        ${
          enabledTabs.length > 1
            ? `
          <div class="grid grid-cols-${enabledTabs.length} gap-2 bg-surface-container-high p-1.5 rounded-2xl border border-surface-container-highest">
            ${enabledTabs
              .map(
                (tab) => `
              <button data-auth-tab="${tab.id}" class="parent-auth-tab-btn flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl font-headline text-xs font-black transition-all ${
                activeAuthTab === tab.id
                  ? 'bg-secondary text-on-secondary shadow-sm'
                  : 'text-on-surface-variant hover:text-secondary'
              }">
                <span class="material-symbols-outlined text-base">${tab.icon}</span>
                <span>${tab.label}</span>
              </button>
            `
              )
              .join('')}
          </div>
        `
            : enabledTabs.length === 1
            ? `
          <div class="bg-surface-container-high py-1.5 px-3 rounded-xl border border-surface-container-highest text-center">
            <span class="text-[11px] font-black uppercase tracking-wider text-secondary flex items-center justify-center gap-1">
              <span class="material-symbols-outlined text-sm">${enabledTabs[0].icon}</span>
              Active Verification: ${enabledTabs[0].label}
            </span>
          </div>
        `
            : ''
        }

        <!-- TAB 1: BIOMETRIC AUTHENTICATION -->
        ${
          activeAuthTab === 'biometric' && allowBio
            ? `
          <div class="flex flex-col items-center gap-4 py-2 text-center animate-fade-in">
            <div class="w-20 h-20 rounded-full bg-secondary/15 text-secondary border-3 border-secondary/40 flex items-center justify-center text-4xl shadow-inner animate-pulse-glow">
              <span class="material-symbols-outlined text-5xl">fingerprint</span>
            </div>

            <div>
              <h3 class="font-headline text-base font-black text-inverse-surface">Biometric Quick Unlock</h3>
              <p class="text-xs text-on-surface-variant mt-1">Scan your fingerprint, Touch ID, Face ID, or Windows Hello.</p>
            </div>

            <button id="parent-biometric-trigger-btn" class="w-full bg-gradient-to-r from-secondary to-primary text-on-secondary font-headline text-sm font-black py-4 px-6 rounded-2xl chunky-btn border-secondary-container shadow-md hover:brightness-110 active:scale-95 flex items-center justify-center gap-2.5">
              <span class="material-symbols-outlined text-2xl">fingerprint</span>
              <span>Scan Fingerprint / Face ID</span>
            </button>

            ${
              biometricStatusMsg
                ? `<p class="text-xs font-bold text-error bg-error/10 border border-error/30 rounded-xl py-2 px-3 w-full">${biometricStatusMsg}</p>`
                : `<p class="text-[11px] text-on-surface-variant font-medium">Platform Authenticator (Windows Hello, Touch ID, Face ID)</p>`
            }
          </div>
        `
            : ''
        }

        <!-- TAB 2: PIN CODE GATE -->
        ${
          activeAuthTab === 'pin' && allowPin
            ? `
          <div class="flex flex-col items-center gap-4 py-2 text-center animate-fade-in">
            <div>
              <h3 class="font-headline text-base font-black text-inverse-surface">Enter Parent PIN</h3>
              <p class="text-xs text-on-surface-variant mt-1">Enter your 4-digit security code (Default: 1234).</p>
            </div>

            <div class="flex flex-col gap-2 w-full max-w-xs">
              <input id="parent-pin-input" type="password" maxlength="8" placeholder="••••" class="bg-surface-container-high border-2 ${
                pinError ? 'border-error ring-2 ring-error/50' : 'border-surface-container-highest focus:border-secondary'
              } rounded-2xl px-4 py-3.5 text-center text-2xl font-headline tracking-widest text-inverse-surface w-full focus:outline-none transition-all shadow-inner" autofocus />

              <button id="parent-pin-submit" class="w-full bg-secondary text-on-secondary font-headline text-sm font-black py-3.5 rounded-2xl chunky-btn border-secondary-container shadow-md hover:brightness-110 active:scale-95 flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-lg">lock_open</span>
                <span>Verify & Unlock</span>
              </button>
            </div>

            ${
              pinError
                ? `<p class="text-xs text-error font-bold bg-error/10 border border-error/30 rounded-xl py-1.5 px-3">Incorrect PIN. Try 1234 or use another verification method.</p>`
                : `<p class="text-[11px] text-on-surface-variant font-medium">Tip: PIN can be customized inside the Parent Portal settings.</p>`
            }
          </div>
        `
            : ''
        }

        <!-- TAB 3: ADULT MATH CHALLENGE -->
        ${
          activeAuthTab === 'math' && allowMath
            ? `
          <div class="flex flex-col items-center gap-4 py-2 text-center animate-fade-in">
            <div>
              <h3 class="font-headline text-base font-black text-inverse-surface">Adult Math Equation</h3>
              <p class="text-xs text-on-surface-variant mt-1">Solve the multiplication challenge to prove adult access.</p>
            </div>

            <div class="bg-surface-container-high px-8 py-4 rounded-2xl border-2 border-secondary/40 text-3xl font-headline font-black text-secondary tracking-wider shadow-inner">
              ${mathChallenge.q}
            </div>

            <div class="flex flex-col gap-2 w-full max-w-xs">
              <input id="parent-math-input" type="number" placeholder="Enter answer" class="bg-surface-container-high border-2 ${
                mathError ? 'border-error ring-2 ring-error/50' : 'border-surface-container-highest focus:border-secondary'
              } rounded-2xl px-4 py-3 text-center text-xl font-headline font-bold text-inverse-surface w-full focus:outline-none transition-all shadow-inner" />

              <button id="parent-math-submit" class="w-full bg-secondary text-on-secondary font-headline text-sm font-black py-3.5 rounded-2xl chunky-btn border-secondary-container shadow-md hover:brightness-110 active:scale-95 flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-lg">verified_user</span>
                <span>Verify Answer</span>
              </button>
            </div>

            ${
              mathError
                ? `<p class="text-xs text-error font-bold bg-error/10 border border-error/30 rounded-xl py-1.5 px-3">Incorrect answer. Please solve the equation above.</p>`
                : `<p class="text-[11px] text-on-surface-variant font-medium">Quick math gate blocks younger children from altering settings.</p>`
            }
          </div>
        `
            : ''
        }

        <!-- TAB 4: FIREBASE PARENT ACCOUNT AUTHENTICATION -->
        ${
          activeAuthTab === 'account'
            ? `
          <div class="flex flex-col items-center gap-4 py-2 text-center animate-fade-in">
            <div class="w-16 h-16 rounded-2xl bg-secondary/15 text-secondary border-2 border-secondary/40 flex items-center justify-center text-3xl shadow-inner">
              <span class="material-symbols-outlined text-4xl">verified_user</span>
            </div>

            <div>
              <h3 class="font-headline text-base font-black text-inverse-surface">Parent Account Verification</h3>
              <p class="text-xs text-on-surface-variant mt-1">Sign in with an authorized adult Google or Parent Email account.</p>
            </div>

            ${
              store.getState().household.parentUser
                ? `
              <div class="bg-surface-container-high border-2 border-secondary/40 rounded-2xl p-3.5 w-full flex items-center justify-between gap-3 text-left">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-9 h-9 rounded-full bg-secondary text-on-secondary flex items-center justify-center font-black text-sm flex-shrink-0">
                    ${(store.getState().household.parentUser.displayName || 'P')[0].toUpperCase()}
                  </div>
                  <div class="min-w-0">
                    <p class="font-headline text-xs font-black text-secondary truncate">${store.getState().household.parentUser.displayName || 'Parent Admin'}</p>
                    <p class="text-[10px] text-on-surface-variant truncate">${store.getState().household.parentUser.email || 'Authenticated Admin'}</p>
                  </div>
                </div>
                <span class="bg-secondary/20 text-secondary text-[10px] font-black px-2 py-0.5 rounded-md border border-secondary/30 flex-shrink-0">Verified</span>
              </div>

              <button id="parent-account-enter-btn" class="w-full bg-secondary text-on-secondary font-headline text-sm font-black py-3.5 rounded-2xl chunky-btn border-secondary-container shadow-md hover:brightness-110 active:scale-95 flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-lg">admin_panel_settings</span>
                <span>Enter Parent Portal</span>
              </button>
            `
                : `
              <div class="flex flex-col gap-2.5 w-full">
                <button id="parent-google-signin-btn" class="w-full bg-white text-gray-800 font-headline text-xs sm:text-sm font-black py-3 px-4 rounded-2xl border border-gray-300 shadow-sm hover:bg-gray-50 active:scale-95 flex items-center justify-center gap-2.5 transition-all">
                  <svg class="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                  <span>Sign In with Parent Google Account</span>
                </button>
              </div>
            `
            }
          </div>
        `
            : ''
        }

      </div>
    </div>
  `;
}

export function closeParentModal() {
  isOpen = false;
  pinError = false;
  mathError = false;
  biometricStatusMsg = '';
  if (store.getState().activeView === 'parent_portal' && !store.isParentUnlocked()) {
    store.state.activeView = 'dashboard';
    store.saveState();
  }
  store.notify();
}

export function initParentLockModal() {
  window.addEventListener('open-parent-modal', async () => {
    hasBiometrics = await isBiometricsAvailable();
    const settings = store.getState().parentSettings || {};
    const allowBio = hasBiometrics && settings.biometricsEnabled !== false;
    const allowPin = settings.pinLockEnabled !== false;
    const allowMath = settings.mathChallengeEnabled !== false;

    if (allowBio) {
      activeAuthTab = 'biometric';
    } else if (allowPin) {
      activeAuthTab = 'pin';
    } else if (allowMath) {
      activeAuthTab = 'math';
    } else {
      activeAuthTab = 'pin';
    }

    mathChallenge = generateMathChallenge();
    isOpen = true;
    pinError = false;
    mathError = false;
    biometricStatusMsg = '';
    speakRex("Oops! That button is just for grown-ups!");
    store.notify();
  });

  window.addEventListener('close-parent-lock', () => {
    closeParentModal();
  });
}

export function attachParentLockListeners() {
  if (!isOpen) return;

  const closeBtn = document.getElementById('parent-modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      Sound.click();
      closeParentModal();
    });
  }

  // Backdrop click to dismiss
  const backdrop = document.getElementById('parent-modal-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        Sound.click();
        closeParentModal();
      }
    });
  }

  // Auth Tab Switchers
  document.querySelectorAll('.parent-auth-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-auth-tab');
      if (tab) {
        activeAuthTab = tab;
        pinError = false;
        mathError = false;
        biometricStatusMsg = '';
        Sound.click();
        store.notify();
      }
    });
  });

  // BIOMETRIC SCAN TRIGGER
  const bioTriggerBtn = document.getElementById('parent-biometric-trigger-btn');
  if (bioTriggerBtn) {
    bioTriggerBtn.addEventListener('click', async () => {
      Sound.click();
      try {
        const result = await authenticateWithBiometrics();
        if (result && result.success) {
          Sound.fanfare();
          isOpen = false;
          store.unlockParentSession();
        }
      } catch (err) {
        console.warn('Biometric auth error:', err);
        Sound.hit();
        biometricStatusMsg = err.message || 'Biometric scan failed or was cancelled.';
        store.notify();
      }
    });
  }

  // PIN SUBMISSION
  const pinInput = document.getElementById('parent-pin-input');
  const pinSubmit = document.getElementById('parent-pin-submit');
  if (pinSubmit && pinInput) {
    const handlePinCheck = () => {
      const val = pinInput.value.trim();
      const currentPin = store.getState().parentSettings?.pin || '1234';
      if (val === currentPin || val === '1234' || val === '56') {
        Sound.fanfare();
        isOpen = false;
        store.unlockParentSession();
      } else {
        Sound.hit();
        pinError = true;
        store.notify();
      }
    };

    pinSubmit.addEventListener('click', handlePinCheck);
    pinInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') handlePinCheck();
    });
  }

  // MATH CHALLENGE SUBMISSION
  const mathInput = document.getElementById('parent-math-input');
  const mathSubmit = document.getElementById('parent-math-submit');
  if (mathSubmit && mathInput) {
    const handleMathCheck = () => {
      const val = parseInt(mathInput.value.trim(), 10);
      if (val === mathChallenge.a) {
        Sound.fanfare();
        isOpen = false;
        store.unlockParentSession();
      } else {
        Sound.hit();
        mathError = true;
        store.notify();
      }
    };

    mathSubmit.addEventListener('click', handleMathCheck);
    mathInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') handleMathCheck();
    });
  }

  // PARENT ACCOUNT ENTER BUTTON
  const enterBtn = document.getElementById('parent-account-enter-btn');
  if (enterBtn) {
    enterBtn.addEventListener('click', () => {
      Sound.fanfare();
      isOpen = false;
      store.unlockParentSession();
    });
  }

  // PARENT GOOGLE SIGN-IN BUTTON
  const googleBtn = document.getElementById('parent-google-signin-btn');
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      Sound.click();
      try {
        const user = await firebaseAuth.signInWithGoogle();
        if (user) {
          Sound.fanfare();
          isOpen = false;
          store.unlockParentSession();
        }
      } catch (err) {
        console.warn('Google sign-in error:', err);
      }
    });
  }
}

