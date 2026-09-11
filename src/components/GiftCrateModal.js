/**
 * GiftCrateModal.js
 * Interactive 3D Unboxing & Delivery Crate Modal
 * Displays surprise gifts from parents (Instant Gifts & Habit Bounties)
 * featuring 3D <model-viewer> PBR reveal, WebXR AR, and voiced companion reactions.
 */

import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';

export function renderGiftCrateWidget() {
  const state = store.getState();
  const currentHeroId = state.selectedHero?.id || 'hero_1';
  const crates = (state.pendingGiftCrates || []).filter(
    c => !c.unboxed && (c.targetChildProfile === 'all' || c.targetChildProfile === currentHeroId || !c.targetChildProfile)
  );

  if (!crates.length) return '';

  const activeCrate = crates[0];
  const item = activeCrate.item || {};

  return `
    <div id="floating-gift-crate-banner" 
      class="fixed bottom-20 right-4 z-50 animate-bounce cursor-pointer group"
      onclick="window.openActiveGiftCrate && window.openActiveGiftCrate('${activeCrate.id}')">
      <div class="bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 p-1 rounded-2xl shadow-2xl shadow-amber-500/50 flex items-center gap-3 pr-4 pl-3 py-2 border-2 border-white/80 hover:scale-105 transition-transform">
        <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-3xl animate-pulse">
          🎁
        </div>
        <div class="text-left">
          <div class="text-[10px] uppercase font-black tracking-wider text-amber-950 flex items-center gap-1">
            <span class="inline-block w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
            Surprise Gift!
          </div>
          <div class="text-xs font-bold text-amber-950 truncate max-w-[130px]">
            ${item.name || 'New Hero Creation!'}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderGiftCrateModal() {
  const state = store.getState();
  const crateId = state.activeUnboxingCrateId;
  if (!crateId) return '';

  const crate = (state.pendingGiftCrates || []).find(c => c.id === crateId);
  if (!crate) return '';

  const item = crate.item || {};
  const isOpened = Boolean(crate.isOpened);
  const category = item.category || crate.category || 'gear';

  let categoryBadge = '👑 Pet Wearable Gear';
  let categoryColor = 'from-purple-500 to-indigo-600';
  if (category === 'furniture') {
    categoryBadge = '🛋️ Hero HQ Furniture';
    categoryColor = 'from-blue-500 to-cyan-600';
  } else if (category === 'toy') {
    categoryBadge = '🎾 Pet Pen Toy';
    categoryColor = 'from-emerald-500 to-teal-600';
  } else if (category === 'boss') {
    categoryBadge = '👾 AR Quest Boss';
    categoryColor = 'from-rose-500 to-red-600';
  }

  return `
    <div id="gift-crate-modal-backdrop" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div class="relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-400/50 rounded-3xl p-6 text-center text-white shadow-2xl overflow-hidden">
        
        <!-- Background Glowing Ray Aura -->
        <div class="absolute -top-24 -left-24 w-72 h-72 bg-amber-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-24 -right-24 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <!-- Close button if opened -->
        ${isOpened ? `
          <button onclick="window.closeGiftCrateModal && window.closeGiftCrateModal()" 
            class="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors">
            ✕
          </button>
        ` : ''}

        <!-- Header -->
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r ${categoryColor} text-white text-xs font-bold uppercase tracking-wider mb-3 shadow-lg">
          ${categoryBadge}
        </div>

        ${!isOpened ? `
          <!-- UNOPENED CRATE STATE -->
          <div class="py-6 flex flex-col items-center">
            <div class="relative cursor-pointer group" onclick="window.unboxGiftCrate && window.unboxGiftCrate('${crate.id}')">
              <!-- Golden Chest -->
              <div class="w-40 h-40 bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-500 rounded-3xl border-4 border-yellow-200 shadow-2xl flex items-center justify-center text-7xl shadow-amber-500/50 transform group-hover:scale-105 group-hover:rotate-1 transition-all duration-300 animate-pulse">
                🎁
              </div>
              <div class="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full shadow-md animate-bounce">
                TAP ME!
              </div>
            </div>

            <h2 class="text-2xl font-black text-white mt-6 mb-1">
              Surprise from Mom & Dad!
            </h2>
            <p class="text-slate-300 text-sm max-w-xs mb-6">
              A special 3D creation was crafted just for you! Tap the gift box to unlock it!
            </p>

            <button onclick="window.unboxGiftCrate && window.unboxGiftCrate('${crate.id}')"
              class="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-lg shadow-xl shadow-amber-500/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
              <span>✨ Open Gift Box ✨</span>
            </button>
          </div>
        ` : `
          <!-- REVEALED 3D ITEM STATE -->
          <div class="py-2 flex flex-col items-center animate-fadeIn">
            
            <!-- 3D Stage / Model Viewer -->
            <div class="w-full h-56 bg-slate-950/80 rounded-2xl border border-white/10 overflow-hidden relative mb-4 shadow-inner flex items-center justify-center">
              ${item.modelUrl ? `
                <model-viewer 
                  src="${item.modelUrl}" 
                  alt="${item.name || '3D Model'}"
                  auto-rotate 
                  camera-controls 
                  shadow-intensity="1.2"
                  ar
                  ar-modes="webxr scene-viewer quick-look"
                  style="width: 100%; height: 100%; background-color: transparent;">
                  <button slot="ar-button" class="absolute bottom-2 right-2 px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-lg">
                    📱 View in Room
                  </button>
                </model-viewer>
              ` : item.splineUrl ? `
                <iframe src="${item.splineUrl}" frameborder="0" width="100%" height="100%" class="rounded-xl"></iframe>
              ` : `
                <div class="text-6xl animate-bounce">${item.emoji || '✨'}</div>
              `}
            </div>

            <!-- Item Name & Lore -->
            <h2 class="text-2xl font-black text-amber-300 mb-1">
              ${item.name || 'Hero Creation'}
            </h2>
            <p class="text-slate-300 text-xs leading-relaxed max-w-sm mb-3">
              ${item.desc || item.description || 'A heroic parent-crafted marvel for your adventures.'}
            </p>

            <!-- Stat Buff Tag -->
            <div class="flex items-center gap-2 mb-4">
              ${item.statBonusLabel ? `
                <span class="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1">
                  ⚡ ${item.statBonusLabel}
                </span>
              ` : ''}
              ${item.comfortBuffLabel ? `
                <span class="px-3 py-1 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-bold flex items-center gap-1">
                  🛋️ ${item.comfortBuffLabel}
                </span>
              ` : ''}
              ${item.statRefillTarget ? `
                <span class="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1">
                  💖 Refills ${item.statRefillTarget.toUpperCase()}
                </span>
              ` : ''}
            </div>

            <!-- Companion Spoken Reaction -->
            ${item.petVoiceLine || item.companionReaction || item.cheerVoiceLine ? `
              <div class="w-full bg-white/5 border border-white/10 rounded-2xl p-3 flex items-start gap-2.5 text-left mb-4">
                <span class="text-2xl">🦖</span>
                <div class="flex-1 text-xs text-amber-100 font-medium italic">
                  "${item.petVoiceLine || item.companionReaction || item.cheerVoiceLine}"
                </div>
                <button onclick="window.speakCompanionText && window.speakCompanionText('${(item.petVoiceLine || item.companionReaction || item.cheerVoiceLine || '').replace(/'/g, "\\'")}')"
                  class="text-amber-400 hover:text-amber-300 p-1">
                  🔊
                </button>
              </div>
            ` : ''}

            <!-- Action Button -->
            <button onclick="window.claimAndNavigateItem && window.claimAndNavigateItem('${category}')"
              class="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 to-green-500 text-slate-950 font-black text-sm shadow-xl shadow-green-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
              <span>🚀 Use My New 3D ${category.toUpperCase()}!</span>
            </button>
          </div>
        `}
      </div>
    </div>
  `;
}

export function attachGiftCrateListeners() {
  window.openActiveGiftCrate = (crateId) => {
    store.state.activeUnboxingCrateId = crateId;
    store.notify();
  };

  window.closeGiftCrateModal = () => {
    store.state.activeUnboxingCrateId = null;
    store.notify();
  };

  window.unboxGiftCrate = (crateId) => {
    const crate = (store.state.pendingGiftCrates || []).find(c => c.id === crateId);
    if (!crate) return;

    crate.isOpened = true;
    crate.unboxed = true;

    Sound.fanfare();
    confetti({
      particleCount: 100,
      spread: 90,
      origin: { y: 0.5 },
      colors: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6']
    });

    const item = crate.item || {};
    const voiceText = item.petVoiceLine || item.companionReaction || item.cheerVoiceLine;
    if (voiceText && window.speakCompanionText) {
      window.speakCompanionText(voiceText);
    }

    store.saveState(true);
    store.notify();
  };

  window.claimAndNavigateItem = (category) => {
    window.closeGiftCrateModal();
    if (category === 'furniture') {
      store.state.activeTab = 'hero_hq';
    } else if (category === 'toy') {
      store.state.activeTab = 'pet_pen';
    } else if (category === 'boss') {
      store.state.activeTab = 'battle';
    } else {
      store.state.activeTab = 'locker';
    }
    store.notify();
  };

  window.speakCompanionText = (text) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.05;
      utter.pitch = 1.25; // Cartoon friendly pitch
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  };
}
