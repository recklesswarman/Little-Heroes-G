import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { firebaseAuth } from '../services/firebaseAuthService.js';
import { firestoreSync } from '../services/firestoreSyncService.js';
import { persistentLink } from '../services/persistentLinkService.js';

let isHouseholdModalOpen = false;

export function renderHouseholdLinkModal() {
  if (!isHouseholdModalOpen) return '';

  const state = store.getState();
  const household = state.household;
  const parentUser = household.parentUser;
  const linkSession = persistentLink.getSession();
  const isPersistentLinked = persistentLink.isLinked();

  return `
    <div id="household-modal-backdrop" class="fixed inset-0 bg-background/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in select-none">
      <div class="bg-surface-container border-4 border-primary rounded-3xl p-6 max-w-md w-full card-shadow-lg flex flex-col gap-4 relative">
        
        <!-- Header -->
        <div class="flex justify-between items-center border-b-2 border-surface-container-highest pb-3">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-2xl" style="font-variation-settings: 'FILL' 1;">sync</span>
            <h2 class="font-headline text-xl font-black text-inverse-surface">Household Cloud Sync</h2>
          </div>
          <button id="household-modal-close" class="text-on-surface-variant hover:text-error text-2xl p-1">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- Parent Account Status / Firebase Auth Section -->
        <div class="bg-surface-container-high p-4 rounded-2xl border border-surface-container-highest flex flex-col gap-3">
          <div class="flex justify-between items-center">
            <span class="text-xs font-black uppercase text-secondary">Firebase Parent Account</span>
            ${
              isPersistentLinked
                ? `<span class="bg-primary/20 text-primary text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-primary/40 flex items-center gap-1">
                     <span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                     Persistent Link Active
                   </span>`
                : `<span class="bg-surface-container-lowest text-on-surface-variant text-[9px] font-bold px-2 py-0.5 rounded-full">
                     Standard Mode
                   </span>`
            }
          </div>
          
          ${
            parentUser
              ? `
            <div class="flex flex-col gap-2.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full overflow-hidden border-2 border-primary shadow-sm flex-shrink-0">
                    ${
                      parentUser.photoURL
                        ? `<img class="w-full h-full object-cover" src="${parentUser.photoURL}" alt="User Avatar" />`
                        : `<div class="w-full h-full bg-primary text-on-primary flex items-center justify-center font-black">${(parentUser.displayName || 'P')[0]}</div>`
                    }
                  </div>
                  <div class="flex flex-col truncate">
                    <span class="font-headline text-xs font-black text-inverse-surface truncate">${parentUser.displayName || 'Parent Admin'}</span>
                    <span class="text-[10px] text-on-surface-variant font-bold truncate">${parentUser.email || 'Cloud Account Linked'}</span>
                  </div>
                </div>

                <button id="auth-signout-btn" class="bg-surface-container-lowest text-error font-headline text-[10px] font-bold px-3 py-1.5 rounded-lg border border-error/30 hover:bg-error/10 active:scale-95 flex-shrink-0">
                  Sign Out
                </button>
              </div>

              <!-- Persistent Linking Sliding Window Badge (RFC 6749 Section 6) -->
              <div class="bg-surface-container-lowest p-2.5 rounded-xl border border-primary/30 flex flex-col gap-1 text-[10px]">
                <div class="flex items-center justify-between text-primary font-black">
                  <span class="flex items-center gap-1">
                    <span class="material-symbols-outlined text-xs">verified_user</span>
                    Persistent Linking (RFC 6749 §6)
                  </span>
                  <span class="text-on-surface-variant font-mono text-[9px]">Sliding Window</span>
                </div>
                <p class="text-on-surface-variant text-[9px] font-medium leading-tight">
                  Account remains linked across transient network drops and periodic refreshes. Active token expiration auto-extends on activity.
                </p>
                ${
                  linkSession?.expiresAt
                    ? `<span class="text-[9px] text-on-surface-variant font-bold">
                         Window Valid Through: <strong class="text-primary">${new Date(linkSession.expiresAt).toLocaleDateString()}</strong>
                       </span>`
                    : ''
                }
              </div>
            </div>
          `
              : `
            <div class="flex flex-col gap-2">
              <p class="text-[11px] text-on-surface-variant font-semibold">
                Sign in with Google to protect your Parent Portal and sync your kids' chore progress across all family devices in real time.
              </p>
              
              <!-- Google Sign In Button -->
              <button id="auth-google-signin-btn" class="w-full bg-[#ffffff] hover:bg-[#f1f5f9] text-[#1e293b] font-headline text-xs font-black py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm border border-[#cbd5e1] active:scale-98 transition-all">
                <svg class="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Sign in with Google
              </button>
            </div>
          `
          }
        </div>

        <!-- Household Sync Code Box -->
        <div class="flex flex-col items-center text-center gap-3 py-1">
          <div class="w-full bg-surface-container-lowest p-3.5 rounded-2xl border-2 border-primary/40 flex flex-col items-center gap-1 shadow-inner">
            <span class="text-[10px] font-black uppercase text-secondary tracking-widest">${household.name} Sync Code</span>
            <span class="font-headline text-2xl font-black text-primary tracking-widest">${household.syncCode}</span>
            <span class="text-[10px] text-on-surface-variant font-bold">Use on other family tablets or phones to sync this household</span>
          </div>

          <!-- Connected Devices Status & Manual Sync Trigger -->
          <div class="w-full bg-surface-container-high p-3 rounded-xl border border-surface-container-highest flex items-center justify-between text-xs font-bold">
            <span class="text-on-surface-variant flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm text-primary">devices</span>
              ${household.linkedDevices || 1} Family Devices
            </span>
            
            <div class="flex items-center gap-2">
              <button id="household-force-sync-btn" class="bg-surface-container-lowest hover:bg-surface-bright text-secondary border border-secondary/30 font-headline text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 active:scale-95 transition-all shadow-sm">
                <span class="material-symbols-outlined text-xs">refresh</span>
                Sync Now
              </button>
              <span class="text-primary flex items-center gap-1 text-[11px]">
                <span class="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                ${household.lastSync || 'Cloud Synced'}
              </span>
            </div>
          </div>

          <!-- Join Existing Household Option -->
          <div class="w-full bg-surface-container-lowest p-3 rounded-2xl border border-surface-container-highest flex flex-col gap-2">
            <span class="text-[10px] font-black uppercase text-on-surface-variant tracking-wider text-left">Join Another Household</span>
            <div class="flex gap-2">
              <input type="text" id="household-join-input" placeholder="e.g. HERO-1234" class="flex-1 bg-surface-container-high border border-surface-container-highest rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wider text-inverse-surface focus:border-secondary focus:outline-none" />
              <button id="household-join-btn" class="bg-secondary hover:brightness-110 text-on-secondary font-headline text-xs font-black px-3 py-2 rounded-xl chunky-btn-sm active:scale-95">
                Join
              </button>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-2">
          <button id="household-create-fresh-btn" class="bg-surface-container-highest hover:bg-surface-bright text-secondary font-headline text-xs font-black py-3 px-3 rounded-xl border border-surface-container-highest chunky-btn-sm flex items-center gap-1" title="Generate a brand new household and code">
            <span class="material-symbols-outlined text-sm">add_home</span>
            New
          </button>
          <button id="household-copy-btn" class="flex-1 bg-surface-container-highest hover:bg-surface-bright text-inverse-surface font-headline text-xs font-black py-3 rounded-xl border border-surface-container-low chunky-btn-sm">
            Copy Code
          </button>
          <button id="household-close-action-btn" class="flex-1 bg-primary text-on-primary font-headline text-xs font-black py-3 rounded-xl chunky-btn border-primary-container">
            Done
          </button>
        </div>

      </div>
    </div>
  `;
}

export function initHouseholdModal() {
  window.addEventListener('open-household-modal', () => {
    isHouseholdModalOpen = true;
    store.notify();
  });
  const code = store.getState().household.syncCode || 'HERO-8842';
  firestoreSync.startSync(code);
}

export function attachHouseholdLinkModalListeners() {
  const closeBtn = document.getElementById('household-modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      isHouseholdModalOpen = false;
      Sound.click();
      store.notify();
    });
  }

  const closeActionBtn = document.getElementById('household-close-action-btn');
  if (closeActionBtn) {
    closeActionBtn.addEventListener('click', () => {
      isHouseholdModalOpen = false;
      Sound.click();
      store.notify();
    });
  }

  const googleBtn = document.getElementById('auth-google-signin-btn');
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      googleBtn.disabled = true;
      googleBtn.innerHTML = `
        <span class="inline-block animate-spin mr-2">🔄</span> Connecting to Google...
      `;
      try {
        await firebaseAuth.signInWithGoogle();
      } finally {
        googleBtn.disabled = false;
      }
    });
  }

  const signOutBtn = document.getElementById('auth-signout-btn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      firebaseAuth.signOut();
    });
  }

  const forceSyncBtn = document.getElementById('household-force-sync-btn');
  if (forceSyncBtn) {
    forceSyncBtn.addEventListener('click', async () => {
      forceSyncBtn.disabled = true;
      forceSyncBtn.textContent = 'Syncing...';
      await firestoreSync.syncNow();
      Sound.fanfare();
      forceSyncBtn.textContent = 'Synced!';
      setTimeout(() => {
        forceSyncBtn.disabled = false;
        forceSyncBtn.innerHTML = `
          <span class="material-symbols-outlined text-xs">refresh</span>
          Sync Now
        `;
      }, 1500);
    });
  }

  const copyBtn = document.getElementById('household-copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const code = store.getState().household.syncCode || 'HERO-8842';
      navigator.clipboard?.writeText(code).catch(() => {});
      Sound.fanfare();
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy Code';
      }, 1500);
    });
  }

  const createFreshBtn = document.getElementById('household-create-fresh-btn');
  if (createFreshBtn) {
    createFreshBtn.addEventListener('click', () => {
      const familyName = prompt('Enter Family Household Name:', store.getState().household.name || 'The Hero Family');
      if (familyName) {
        store.createNewHousehold(familyName);
        store.notify();
      }
    });
  }

  const joinBtn = document.getElementById('household-join-btn');
  if (joinBtn) {
    joinBtn.addEventListener('click', async () => {
      const input = document.getElementById('household-join-input');
      const code = input?.value?.trim().toUpperCase();
      if (code) {
        joinBtn.disabled = true;
        joinBtn.textContent = 'Linking...';
        const res = await firestoreSync.joinHousehold(code);
        joinBtn.disabled = false;
        joinBtn.textContent = 'Join';

        if (res.success) {
          Sound.fanfare();
          alert(
            res.isNew
              ? `Created new Household Cloud Sync for code ${code}! Other devices can now join with this code.`
              : `Successfully linked to Household ${code}! Synced all kids and family data in real time.`
          );
          isHouseholdModalOpen = false;
          store.notify();
        } else {
          alert(`Could not link to household: ${res.error || 'Please check the code and try again.'}`);
        }
      }
    });
  }
}
