import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { isPlatformPasskeyAvailable, authenticateWithPasskey } from '../services/passkeyClient.js';
import { ledgerClient } from '../services/ledgerClient.js';
import { isLegacyLedger } from '../services/walletService.js';
import { speakRex } from '../services/voiceService.js';
import { escapeHtml } from '../utils/escapeHtml.js';

let isOpen = false;
let activeAuthTab = 'pin'; // 'fingerprint' | 'pin'
let hasPasskey = false;
let passkeyStatusMsg = '';
let pinErrorMsg = '';
let isVerifying = false;

export function renderParentLockModal() {
  if (!isOpen) return '';

  const settings = store.getState().parentSettings || {};
  // WebAuthn passkeys require HTTPS; plain HTTP (e.g. Pi kiosk) shows PIN tab only.
  const allowFingerprint = hasPasskey && settings.biometricsEnabled !== false;
  const allowPin = true;

  const enabledTabs = [];
  if (allowFingerprint) enabledTabs.push({ id: 'fingerprint', label: 'Fingerprint', icon: 'fingerprint' });
  if (allowPin) enabledTabs.push({ id: 'pin', label: 'PIN', icon: 'pin' });

  if (enabledTabs.length > 0 && !enabledTabs.some((t) => t.id === activeAuthTab)) {
    activeAuthTab = enabledTabs[0].id;
  }

  const tabGridClass = enabledTabs.length === 2 ? 'grid-cols-2' : 'grid-cols-1';

  return `
    <div id="parent-modal-backdrop" class="fixed inset-0 bg-background/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in select-none">
      <div class="bg-surface-container border-4 border-secondary/50 rounded-3xl p-6 sm:p-7 max-w-md w-full max-h-[90vh] overflow-y-auto my-auto card-shadow-lg flex flex-col gap-5 relative">

        <!-- Header -->
        <div class="flex justify-between items-center border-b-2 border-surface-container-highest pb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-2xl bg-secondary/20 text-secondary border border-secondary/40 flex items-center justify-center text-xl shadow-xs">
              <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">shield_person</span>
            </div>
            <div>
              <h2 class="font-headline text-lg sm:text-xl font-black text-inverse-surface">Parent Security Gate</h2>
              <p class="text-[11px] text-on-surface-variant font-bold">Adult verification required for dashboard</p>
            </div>
          </div>
          <button id="parent-modal-close" class="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl flex items-center justify-center text-on-surface-variant hover:text-error text-2xl active:scale-95 transition-transform" title="Close Gate">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- Two-tab selector: Fingerprint & PIN -->
        ${
          enabledTabs.length > 1
            ? `
          <div class="grid ${tabGridClass} gap-2 bg-surface-container-high p-1.5 rounded-2xl border border-surface-container-highest">
            ${enabledTabs
              .map(
                (tab) => `
              <button data-auth-tab="${tab.id}" class="parent-auth-tab-btn min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl font-headline text-xs font-black transition-all ${
                activeAuthTab === tab.id
                  ? 'bg-secondary text-on-secondary shadow-xs'
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
            : `
          <div class="bg-surface-container-high py-1.5 px-3 rounded-xl border border-surface-container-highest text-center">
            <span class="text-[11px] font-black uppercase tracking-wider text-secondary flex items-center justify-center gap-1">
              <span class="material-symbols-outlined text-sm">${enabledTabs[0].icon}</span>
              Active Verification: ${enabledTabs[0].label}
            </span>
          </div>
        `
        }

        <!-- TAB 1: FINGERPRINT / PASSKEY AUTHENTICATION -->
        ${
          activeAuthTab === 'fingerprint' && allowFingerprint
            ? `
          <div class="flex flex-col items-center gap-4 py-2 text-center animate-fade-in">
            <div class="w-20 h-20 rounded-full bg-secondary/15 text-secondary border-3 border-secondary/40 flex items-center justify-center text-4xl shadow-inner animate-pulse-glow">
              <span class="material-symbols-outlined text-5xl">fingerprint</span>
            </div>

            <div>
              <h3 class="font-headline text-base font-black text-inverse-surface">Fingerprint / Passkey Unlock</h3>
              <p class="text-xs text-on-surface-variant mt-1">Verify with Touch ID, Face ID, fingerprint, or Windows Hello.</p>
            </div>

            <button id="parent-biometric-trigger-btn" ${isVerifying ? 'disabled' : ''} class="w-full bg-linear-to-r from-secondary to-primary text-on-secondary font-headline text-sm font-black py-4 px-6 rounded-2xl chunky-btn border-secondary-container shadow-md hover:brightness-110 active:scale-95 flex items-center justify-center gap-2.5 disabled:opacity-60">
              <span class="material-symbols-outlined text-2xl">fingerprint</span>
              <span>${isVerifying ? 'Verifying…' : 'Scan Fingerprint / Face ID'}</span>
            </button>

            ${
              passkeyStatusMsg
                ? `<p class="text-xs font-bold text-error bg-error/10 border border-error/30 rounded-xl py-2 px-3 w-full">${escapeHtml(passkeyStatusMsg)}</p>`
                : `<p class="text-[11px] text-on-surface-variant font-medium">Server-verified WebAuthn passkey (set up in Parent Portal Settings)</p>`
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
              <p class="text-xs text-on-surface-variant mt-1">Enter your parent security code.</p>
            </div>

            <div class="flex flex-col gap-2 w-full max-w-xs">
              <input id="parent-pin-input" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="8" placeholder="••••" class="bg-surface-container-high border-2 ${
                pinErrorMsg ? 'border-error ring-2 ring-error/50' : 'border-surface-container-highest focus:border-secondary'
              } rounded-2xl px-4 py-3.5 text-center text-2xl font-headline tracking-widest text-inverse-surface w-full focus:outline-hidden transition-all shadow-inner" autofocus />

              <button id="parent-pin-submit" ${isVerifying ? 'disabled' : ''} class="w-full bg-secondary text-on-secondary font-headline text-sm font-black py-3.5 rounded-2xl chunky-btn border-secondary-container shadow-md hover:brightness-110 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60">
                <span class="material-symbols-outlined text-lg">lock_open</span>
                <span>${isVerifying ? 'Checking…' : 'Verify & Unlock'}</span>
              </button>
            </div>

            ${
              pinErrorMsg
                ? `<p class="text-xs text-error font-bold bg-error/10 border border-error/30 rounded-xl py-1.5 px-3">${escapeHtml(pinErrorMsg)}</p>`
                : `<p class="text-[11px] text-on-surface-variant font-medium">Tip: PIN can be customized inside the Parent Portal settings.</p>`
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
  pinErrorMsg = '';
  passkeyStatusMsg = '';
  isVerifying = false;
  if (store.getState().activeView === 'parent_portal' && !store.isParentUnlocked()) {
    store.state.activeView = 'dashboard';
    store.saveState();
  }
  store.notify();
}

export function initParentLockModal() {
  window.addEventListener('open-parent-modal', async () => {
    hasPasskey = await isPlatformPasskeyAvailable();
    const settings = store.getState().parentSettings || {};
    const allowFingerprint = hasPasskey && settings.biometricsEnabled !== false;

    activeAuthTab = allowFingerprint ? 'fingerprint' : 'pin';
    isOpen = true;
    pinErrorMsg = '';
    passkeyStatusMsg = '';
    isVerifying = false;
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

  const backdrop = document.getElementById('parent-modal-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        Sound.click();
        closeParentModal();
      }
    });
  }

  document.querySelectorAll('.parent-auth-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-auth-tab');
      if (tab) {
        activeAuthTab = tab;
        pinErrorMsg = '';
        passkeyStatusMsg = '';
        Sound.click();
        store.notify();
      }
    });
  });

  // FINGERPRINT / PASSKEY AUTH TRIGGER
  const bioTriggerBtn = document.getElementById('parent-biometric-trigger-btn');
  if (bioTriggerBtn) {
    bioTriggerBtn.addEventListener('click', async () => {
      if (isVerifying) return;
      Sound.click();
      isVerifying = true;
      passkeyStatusMsg = '';
      store.notify();
      try {
        const result = await authenticateWithPasskey();
        if (result && result.unlocked) {
          Sound.fanfare();
          isOpen = false;
          isVerifying = false;
          store.unlockParentSession(result.expiresAtMs);
        } else {
          throw new Error('Passkey verification did not return an unlocked session.');
        }
      } catch (err) {
        console.warn('Passkey auth error:', err);
        Sound.hit();
        isVerifying = false;
        passkeyStatusMsg = err?.message || 'Fingerprint scan failed or was cancelled. Try your PIN.';
        store.notify();
      }
    });
  }

  // PIN SUBMISSION
  const pinInput = document.getElementById('parent-pin-input');
  const pinSubmit = document.getElementById('parent-pin-submit');
  if (pinSubmit && pinInput) {
    const handlePinCheck = async () => {
      if (isVerifying) return;
      const val = pinInput.value.trim();
      if (!val) {
        Sound.hit();
        pinErrorMsg = 'Please enter your PIN.';
        store.notify();
        return;
      }

      if (isLegacyLedger()) {
        if (store.verifyParentPin(val)) {
          Sound.fanfare();
          isOpen = false;
          pinErrorMsg = '';
          store.unlockParentSession();
        } else {
          Sound.hit();
          pinErrorMsg = 'Incorrect PIN. Try again.';
          store.notify();
        }
        return;
      }

      isVerifying = true;
      pinErrorMsg = '';
      store.notify();
      try {
        const res = await ledgerClient.run('verifyParentPin', { pin: val }, { queueOnNetworkError: false });
        if (res && res.unlocked) {
          Sound.fanfare();
          isOpen = false;
          isVerifying = false;
          store.unlockParentSession(res.expiresAtMs);
        } else {
          throw new Error('Incorrect PIN.');
        }
      } catch (err) {
        Sound.hit();
        isVerifying = false;
        pinErrorMsg = err?.message || 'Incorrect PIN. Try again.';
        store.notify();
      }
    };

    pinSubmit.addEventListener('click', handlePinCheck);
    pinInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') handlePinCheck();
    });
  }
}
