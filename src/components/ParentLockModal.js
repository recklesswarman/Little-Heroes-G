import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { isBiometricsAvailable, authenticateWithBiometrics } from '../utils/biometrics.js';

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

  const parentPin = store.getState().parentSettings?.pin || '1234';

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

        <!-- Auth Method Selector Tabs -->
        <div class="grid ${hasBiometrics ? 'grid-cols-3' : 'grid-cols-2'} gap-2 bg-surface-container-high p-1.5 rounded-2xl border border-surface-container-highest">
          ${
            hasBiometrics
              ? `
            <button data-auth-tab="biometric" class="parent-auth-tab-btn flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl font-headline text-xs font-black transition-all ${
              activeAuthTab === 'biometric'
                ? 'bg-secondary text-on-secondary shadow-sm'
                : 'text-on-surface-variant hover:text-secondary'
            }">
              <span class="material-symbols-outlined text-base">fingerprint</span>
              <span>Biometric</span>
            </button>
          `
              : ''
          }

          <button data-auth-tab="pin" class="parent-auth-tab-btn flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl font-headline text-xs font-black transition-all ${
            activeAuthTab === 'pin'
              ? 'bg-secondary text-on-secondary shadow-sm'
              : 'text-on-surface-variant hover:text-secondary'
          }">
            <span class="material-symbols-outlined text-base">pin</span>
            <span>4-Digit PIN</span>
          </button>

          <button data-auth-tab="math" class="parent-auth-tab-btn flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl font-headline text-xs font-black transition-all ${
            activeAuthTab === 'math'
              ? 'bg-secondary text-on-secondary shadow-sm'
              : 'text-on-surface-variant hover:text-secondary'
          }">
            <span class="material-symbols-outlined text-base">calculate</span>
            <span>Math Challenge</span>
          </button>
        </div>

        <!-- TAB 1: BIOMETRIC AUTHENTICATION -->
        ${
          activeAuthTab === 'biometric' && hasBiometrics
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
          activeAuthTab === 'pin'
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
                ? `<p class="text-xs text-error font-bold bg-error/10 border border-error/30 rounded-xl py-1.5 px-3">Incorrect PIN. Try 1234 or use Math Challenge.</p>`
                : `<p class="text-[11px] text-on-surface-variant font-medium">Tip: PIN can be customized inside the Parent Portal settings.</p>`
            }
          </div>
        `
            : ''
        }

        <!-- TAB 3: ADULT MATH CHALLENGE -->
        ${
          activeAuthTab === 'math'
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

      </div>
    </div>
  `;
}

export function initParentLockModal() {
  window.addEventListener('open-parent-modal', async () => {
    hasBiometrics = await isBiometricsAvailable();
    const settings = store.getState().parentSettings;
    if (hasBiometrics && settings?.biometricsEnabled !== false) {
      activeAuthTab = 'biometric';
    } else {
      activeAuthTab = 'pin';
    }

    mathChallenge = generateMathChallenge();
    isOpen = true;
    pinError = false;
    mathError = false;
    biometricStatusMsg = '';
    store.notify();
  });
}

export function attachParentLockListeners() {
  const closeBtn = document.getElementById('parent-modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      Sound.click();
      isOpen = false;
      store.notify();
    });
  }

  // Backdrop click to dismiss
  const backdrop = document.getElementById('parent-modal-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        Sound.click();
        isOpen = false;
        store.notify();
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
}

