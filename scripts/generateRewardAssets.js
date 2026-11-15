/**
 * generateRewardAssets.js
 * Generates high-contrast, tactile 3D kid-friendly SVG illustrations for all Hero Shop items.
 * Boy-friendly palette: Electric Azure, Cosmic Cyan, Emerald Mint, Solar Amber/Gold, Heroic Crimson/Orange.
 * ZERO pink (#ec4899), ZERO purple (#a855f7).
 */

import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('public/assets/rewards');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

export const REWARD_SVGS = {
  // ==========================================
  // 1. WEAPONS
  // ==========================================
  'laser_toothbrush': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="ltb_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#164e63"/>
        <stop offset="60%" stop-color="#083344"/>
        <stop offset="100%" stop-color="#02151e"/>
      </radialGradient>
      <linearGradient id="ltb_beam" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#67e8f9"/>
        <stop offset="50%" stop-color="#06b6d4"/>
        <stop offset="100%" stop-color="#0284c7"/>
      </linearGradient>
      <linearGradient id="ltb_hilt" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#e2e8f0"/>
        <stop offset="50%" stop-color="#94a3b8"/>
        <stop offset="100%" stop-color="#475569"/>
      </linearGradient>
      <linearGradient id="ltb_mint" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#6ee7b7"/>
        <stop offset="100%" stop-color="#10b981"/>
      </linearGradient>
      <filter id="ltb_glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
    </defs>
    <!-- Background Orb -->
    <circle cx="60" cy="60" r="54" fill="url(#ltb_bg)" stroke="#22d3ee" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Outer Glow Aura -->
    <path d="M 35 85 L 85 35" stroke="#22d3ee" stroke-width="18" stroke-linecap="round" opacity="0.4" filter="url(#ltb_glow)"/>
    <!-- Laser Saber Blade -->
    <path d="M 40 80 L 88 32" stroke="url(#ltb_beam)" stroke-width="12" stroke-linecap="round"/>
    <path d="M 42 78 L 86 34" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round"/>
    <!-- Mint Toothbrush Bristles on Saber -->
    <path d="M 75 25 L 95 45" stroke="url(#ltb_mint)" stroke-width="7" stroke-linecap="round"/>
    <circle cx="92" cy="28" r="4.5" fill="#34d399" filter="url(#ltb_glow)"/>
    <circle cx="98" cy="38" r="3" fill="#67e8f9"/>
    <!-- Hilt & Guard -->
    <rect x="24" y="80" width="22" height="12" rx="4" transform="rotate(-45 35 86)" fill="url(#ltb_hilt)" stroke="#0f172a" stroke-width="2"/>
    <circle cx="28" cy="92" r="5" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5"/>
    <!-- Sparkles -->
    <polygon points="60,20 63,27 70,29 63,31 60,38 57,31 50,29 57,27" fill="#fde047"/>
    <polygon points="26,45 28,50 33,51 28,52 26,57 24,52 19,51 24,50" fill="#67e8f9"/>
  </svg>`,

  'sparkle_wand': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="sw_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#78350f"/>
        <stop offset="60%" stop-color="#451a03"/>
        <stop offset="100%" stop-color="#1c0a00"/>
      </radialGradient>
      <linearGradient id="sw_gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="40%" stop-color="#f59e0b"/>
        <stop offset="100%" stop-color="#b45309"/>
      </linearGradient>
      <radialGradient id="sw_star" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="40%" stop-color="#fde047"/>
        <stop offset="100%" stop-color="#f59e0b"/>
      </radialGradient>
      <filter id="sw_glow">
        <feGaussianBlur stdDeviation="3.5" result="glow"/>
        <feComposite in="SourceGraphic" in2="glow" operator="over"/>
      </filter>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#sw_bg)" stroke="#fbbf24" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Blaster Staff Body -->
    <rect x="30" y="55" width="55" height="10" rx="5" transform="rotate(-45 57 60)" fill="url(#sw_gold)" stroke="#0f172a" stroke-width="2"/>
    <rect x="22" y="80" width="16" height="14" rx="3" transform="rotate(-45 30 87)" fill="#0284c7" stroke="#38b6ff" stroke-width="2"/>
    <!-- Energy Core Rings -->
    <ellipse cx="55" cy="55" rx="8" ry="14" transform="rotate(-45 55 55)" fill="none" stroke="#38b6ff" stroke-width="3"/>
    <ellipse cx="65" cy="45" rx="10" ry="16" transform="rotate(-45 65 45)" fill="none" stroke="#22d3ee" stroke-width="3"/>
    <!-- Giant Solar Star Tip -->
    <g transform="translate(82, 32)" filter="url(#sw_glow)">
      <circle cx="0" cy="0" r="16" fill="url(#sw_star)" stroke="#ffffff" stroke-width="2"/>
      <polygon points="0,-22 6,-6 22,0 6,6 0,22 -6,6 -22,0 -6,-6" fill="#fef08a"/>
      <circle cx="0" cy="0" r="6" fill="#ffffff"/>
    </g>
    <!-- Sparks -->
    <circle cx="95" cy="18" r="3" fill="#ffffff"/>
    <circle cx="70" cy="18" r="2.5" fill="#fde047"/>
    <circle cx="102" cy="45" r="3" fill="#38b6ff"/>
  </svg>`,

  'sonic_foam_cannon': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="sfc_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#064e3b"/>
        <stop offset="60%" stop-color="#022c22"/>
        <stop offset="100%" stop-color="#01150f"/>
      </radialGradient>
      <linearGradient id="sfc_barrel" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#34d399"/>
        <stop offset="50%" stop-color="#059669"/>
        <stop offset="100%" stop-color="#064e3b"/>
      </linearGradient>
      <radialGradient id="sfc_bubble" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="60%" stop-color="#a7f3d0"/>
        <stop offset="100%" stop-color="#34d399"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#sfc_bg)" stroke="#34d399" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Cannon Stock & Grip -->
    <rect x="25" y="70" width="28" height="14" rx="4" transform="rotate(30 39 77)" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>
    <rect x="38" y="55" width="40" height="20" rx="6" transform="rotate(-25 58 65)" fill="url(#sfc_barrel)" stroke="#0f172a" stroke-width="2.5"/>
    <!-- Cannon Nozzle -->
    <ellipse cx="78" cy="46" rx="9" ry="16" transform="rotate(-25 78 46)" fill="#047857" stroke="#6ee7b7" stroke-width="3"/>
    <!-- Foam Bubbles Expanding -->
    <circle cx="86" cy="38" r="10" fill="url(#sfc_bubble)" stroke="#ffffff" stroke-width="2"/>
    <circle cx="98" cy="30" r="14" fill="url(#sfc_bubble)" stroke="#ffffff" stroke-width="2"/>
    <circle cx="102" cy="50" r="8" fill="url(#sfc_bubble)" stroke="#ffffff" stroke-width="1.5"/>
    <circle cx="90" cy="58" r="6" fill="url(#sfc_bubble)" stroke="#ffffff" stroke-width="1.5"/>
    <ellipse cx="94" cy="26" rx="4" ry="2" fill="#ffffff"/>
    <ellipse cx="82" cy="35" rx="3" ry="1.5" fill="#ffffff"/>
  </svg>`,

  'plasma_hydra_blade': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="phb_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#1e3a8a"/>
        <stop offset="60%" stop-color="#172554"/>
        <stop offset="100%" stop-color="#0a0f29"/>
      </radialGradient>
      <linearGradient id="phb_blade" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#93c5fd"/>
        <stop offset="40%" stop-color="#3b82f6"/>
        <stop offset="100%" stop-color="#1d4ed8"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#phb_bg)" stroke="#38b6ff" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Triple Hydra Plasma Slices -->
    <path d="M 38 88 Q 65 55 90 22 Q 80 48 52 82 Z" fill="url(#phb_blade)" stroke="#93c5fd" stroke-width="2"/>
    <path d="M 44 86 Q 72 45 98 28 Q 84 55 58 84 Z" fill="#60a5fa" stroke="#ffffff" stroke-width="1.5" opacity="0.8"/>
    <path d="M 32 82 Q 52 50 78 26 Q 66 52 42 78 Z" fill="#2563eb" stroke="#93c5fd" stroke-width="1.5" opacity="0.9"/>
    <!-- Hydra Fang Crossguard -->
    <path d="M 28 85 L 48 95 L 42 75 Z" fill="#f59e0b" stroke="#b45309" stroke-width="2"/>
    <rect x="18" y="90" width="14" height="8" rx="3" transform="rotate(-40 25 94)" fill="#334155" stroke="#0f172a" stroke-width="1.5"/>
    <circle cx="22" cy="100" r="4" fill="#38b6ff" stroke="#ffffff" stroke-width="1.5"/>
    <!-- Energy Sparkles -->
    <polygon points="90,16 92,21 97,22 92,23 90,28 88,23 83,22 88,21" fill="#38b6ff"/>
  </svg>`,

  'weapon_plasma_saber': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="wps_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#083344"/>
        <stop offset="60%" stop-color="#082f49"/>
        <stop offset="100%" stop-color="#030712"/>
      </radialGradient>
      <linearGradient id="wps_beam" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="30%" stop-color="#38b6ff"/>
        <stop offset="70%" stop-color="#0284c7"/>
        <stop offset="100%" stop-color="#0369a1"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#wps_bg)" stroke="#38b6ff" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Beam Core -->
    <path d="M 34 84 L 88 30" stroke="#38b6ff" stroke-width="16" stroke-linecap="round" opacity="0.35"/>
    <path d="M 36 82 L 86 32" stroke="url(#wps_beam)" stroke-width="9" stroke-linecap="round"/>
    <path d="M 38 80 L 84 34" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>
    <!-- Plasma Lightning Bolts -->
    <path d="M 50 62 L 56 52 L 52 50 L 60 42" stroke="#fde047" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 64 48 L 70 38 L 66 36 L 74 28" stroke="#fde047" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Cybernetic Hilt -->
    <rect x="22" y="80" width="22" height="12" rx="3" transform="rotate(-45 33 86)" fill="#475569" stroke="#0f172a" stroke-width="2"/>
    <rect x="20" y="84" width="8" height="6" rx="2" transform="rotate(-45 24 87)" fill="#f59e0b"/>
  </svg>`,

  'weapon_hydro_blaster': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="whb_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#0369a1"/>
        <stop offset="60%" stop-color="#075985"/>
        <stop offset="100%" stop-color="#0c2a44"/>
      </radialGradient>
      <linearGradient id="whb_body" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#38b6ff"/>
        <stop offset="50%" stop-color="#0284c7"/>
        <stop offset="100%" stop-color="#0369a1"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#whb_bg)" stroke="#38b6ff" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Water Pressure Tank -->
    <rect x="30" y="38" width="36" height="18" rx="9" transform="rotate(-20 48 47)" fill="#22d3ee" stroke="#ffffff" stroke-width="2"/>
    <!-- Blaster Housing -->
    <path d="M 32 68 L 72 52 L 76 64 L 46 76 L 36 86 Z" fill="url(#whb_body)" stroke="#0f172a" stroke-width="2.5"/>
    <!-- Dual Nozzles -->
    <rect x="72" y="48" width="14" height="6" rx="2" transform="rotate(-20 79 51)" fill="#f59e0b" stroke="#0f172a" stroke-width="1.5"/>
    <rect x="74" y="58" width="14" height="6" rx="2" transform="rotate(-20 81 61)" fill="#f59e0b" stroke="#0f172a" stroke-width="1.5"/>
    <!-- Hydro Water Blast Waves -->
    <path d="M 88 44 Q 102 38 108 46 Q 96 52 88 48 Z" fill="#67e8f9" stroke="#ffffff" stroke-width="1.5"/>
    <path d="M 90 56 Q 106 52 110 60 Q 98 64 90 58 Z" fill="#38b6ff" stroke="#ffffff" stroke-width="1.5"/>
    <circle cx="106" cy="38" r="3.5" fill="#ffffff"/>
    <circle cx="112" cy="52" r="2.5" fill="#67e8f9"/>
  </svg>`,

  'comet_tail_whip': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="ctw_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#1e1b4b"/>
        <stop offset="60%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#020617"/>
      </radialGradient>
      <linearGradient id="ctw_streak" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fde047"/>
        <stop offset="40%" stop-color="#f97316"/>
        <stop offset="80%" stop-color="#0284c7"/>
        <stop offset="100%" stop-color="#38b6ff"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#ctw_bg)" stroke="#38b6ff" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Glowing Whip Trail -->
    <path d="M 30 85 C 45 70, 45 40, 70 35 C 85 30, 95 45, 90 60 C 85 75, 100 80, 105 72" fill="none" stroke="url(#ctw_streak)" stroke-width="7" stroke-linecap="round"/>
    <path d="M 30 85 C 45 70, 45 40, 70 35 C 85 30, 95 45, 90 60 C 85 75, 100 80, 105 72" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
    <!-- Handle -->
    <rect x="20" y="80" width="18" height="10" rx="3" transform="rotate(-45 29 85)" fill="#334155" stroke="#f59e0b" stroke-width="2"/>
    <!-- Comet Core Star at Tip -->
    <polygon points="105,65 107,70 112,71 107,73 105,78 103,73 98,71 103,70" fill="#fef08a"/>
    <circle cx="105" cy="71" r="3" fill="#ffffff"/>
  </svg>`,

  'storm_trident_lance': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="stl_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#064e3b"/>
        <stop offset="60%" stop-color="#0f2b38"/>
        <stop offset="100%" stop-color="#02141c"/>
      </radialGradient>
      <linearGradient id="stl_metal" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#67e8f9"/>
        <stop offset="50%" stop-color="#0891b2"/>
        <stop offset="100%" stop-color="#155e75"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#stl_bg)" stroke="#22d3ee" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Shaft -->
    <line x1="28" y1="92" x2="74" y2="46" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/>
    <!-- Trident Prongs -->
    <path d="M 62 58 L 92 28 L 86 22 L 68 40 Z" fill="url(#stl_metal)" stroke="#ffffff" stroke-width="1.5"/>
    <path d="M 52 50 L 78 24 L 72 20 L 56 38 Z" fill="url(#stl_metal)" stroke="#22d3ee" stroke-width="1.5"/>
    <path d="M 70 66 L 98 38 L 94 32 L 76 52 Z" fill="url(#stl_metal)" stroke="#22d3ee" stroke-width="1.5"/>
    <!-- Electric Sparks -->
    <path d="M 80 18 L 84 26 L 80 28 L 88 34" stroke="#fde047" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <circle cx="92" cy="28" r="3" fill="#ffffff"/>
  </svg>`,

  // ==========================================
  // 2. AVATAR GEAR
  // ==========================================
  'cowl_hero': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="ch_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#064e3b"/>
        <stop offset="60%" stop-color="#022c22"/>
        <stop offset="100%" stop-color="#01150f"/>
      </radialGradient>
      <linearGradient id="ch_mask" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#10b981"/>
        <stop offset="50%" stop-color="#059669"/>
        <stop offset="100%" stop-color="#047857"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#ch_bg)" stroke="#10b981" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Hero Mask Shell -->
    <path d="M 30 52 C 30 35, 42 30, 60 30 C 78 30, 90 35, 90 52 C 90 70, 78 80, 60 84 C 42 80, 30 70, 30 52 Z" fill="url(#ch_mask)" stroke="#0f172a" stroke-width="3"/>
    <!-- Winged Ear Guards -->
    <path d="M 28 42 L 16 32 L 28 50 Z" fill="#047857" stroke="#0f172a" stroke-width="2"/>
    <path d="M 92 42 L 104 32 L 92 50 Z" fill="#047857" stroke="#0f172a" stroke-width="2"/>
    <!-- Glowing Visor Goggles -->
    <path d="M 38 52 Q 48 46 58 52 Q 48 62 38 52 Z" fill="#22d3ee" stroke="#ffffff" stroke-width="2"/>
    <path d="M 62 52 Q 72 46 82 52 Q 72 62 62 52 Z" fill="#22d3ee" stroke="#ffffff" stroke-width="2"/>
    <circle cx="48" cy="51" r="3" fill="#ffffff"/>
    <circle cx="72" cy="51" r="3" fill="#ffffff"/>
    <!-- Crest Badge -->
    <polygon points="60,34 65,42 55,42" fill="#fbbf24" stroke="#b45309" stroke-width="1"/>
  </svg>`,

  'hero_cape': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="hc_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#083344"/>
        <stop offset="60%" stop-color="#0e3a53"/>
        <stop offset="100%" stop-color="#02141c"/>
      </radialGradient>
      <linearGradient id="hc_cape" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#38b6ff"/>
        <stop offset="50%" stop-color="#0284c7"/>
        <stop offset="100%" stop-color="#0369a1"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#hc_bg)" stroke="#38b6ff" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Jet Glide Cape Fabric -->
    <path d="M 45 36 C 55 38, 65 38, 75 36 C 85 55, 96 82, 88 94 C 76 86, 68 90, 60 84 C 52 90, 44 86, 32 94 C 24 82, 35 55, 45 36 Z" fill="url(#hc_cape)" stroke="#0f172a" stroke-width="3"/>
    <!-- Cape Folds -->
    <path d="M 48 40 Q 52 65 42 85" fill="none" stroke="#67e8f9" stroke-width="2" opacity="0.7"/>
    <path d="M 72 40 Q 68 65 78 85" fill="none" stroke="#67e8f9" stroke-width="2" opacity="0.7"/>
    <!-- Gold Jet Clasps -->
    <circle cx="46" cy="36" r="6" fill="#fbbf24" stroke="#d97706" stroke-width="2"/>
    <circle cx="74" cy="36" r="6" fill="#fbbf24" stroke="#d97706" stroke-width="2"/>
    <line x1="52" y1="36" x2="68" y2="36" stroke="#fbbf24" stroke-width="3"/>
    <!-- Thruster Jets -->
    <rect x="54" y="26" width="12" height="10" rx="3" fill="#64748b" stroke="#334155" stroke-width="1.5"/>
    <polygon points="56,26 60,18 64,26" fill="#f97316"/>
  </svg>`,

  'golden_dragon_armor': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="gda_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#78350f"/>
        <stop offset="60%" stop-color="#451a03"/>
        <stop offset="100%" stop-color="#1c0a00"/>
      </radialGradient>
      <linearGradient id="gda_gold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="40%" stop-color="#f59e0b"/>
        <stop offset="100%" stop-color="#b45309"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#gda_bg)" stroke="#f59e0b" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Dragon Chest Plate -->
    <path d="M 40 32 L 80 32 L 90 55 L 60 96 L 30 55 Z" fill="url(#gda_gold)" stroke="#0f172a" stroke-width="3"/>
    <!-- Overlapping Scales -->
    <path d="M 44 45 Q 60 52 76 45" fill="none" stroke="#78350f" stroke-width="2.5"/>
    <path d="M 48 58 Q 60 65 72 58" fill="none" stroke="#78350f" stroke-width="2.5"/>
    <path d="M 52 70 Q 60 76 68 70" fill="none" stroke="#78350f" stroke-width="2.5"/>
    <!-- Dragon Gem Inset -->
    <polygon points="60,40 68,48 60,56 52,48" fill="#38b6ff" stroke="#ffffff" stroke-width="1.5"/>
    <circle cx="60" cy="48" r="2.5" fill="#ffffff"/>
  </svg>`,

  'neon_stride_boots': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="nsb_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#1e3a8a"/>
        <stop offset="60%" stop-color="#172554"/>
        <stop offset="100%" stop-color="#0b112c"/>
      </radialGradient>
      <linearGradient id="nsb_boot" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#38b6ff"/>
        <stop offset="60%" stop-color="#2563eb"/>
        <stop offset="100%" stop-color="#1d4ed8"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#nsb_bg)" stroke="#38b6ff" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Left Boot -->
    <path d="M 36 40 L 52 40 L 50 62 L 64 68 C 66 74, 62 82, 54 82 L 32 82 C 28 82, 28 72, 34 68 Z" fill="url(#nsb_boot)" stroke="#0f172a" stroke-width="2.5"/>
    <rect x="28" y="78" width="36" height="6" rx="3" fill="#22d3ee" stroke="#ffffff" stroke-width="1.5"/>
    <!-- Right Boot -->
    <path d="M 62 36 L 78 36 L 76 58 L 90 64 C 92 70, 88 78, 80 78 L 58 78 C 54 78, 54 68, 60 64 Z" fill="url(#nsb_boot)" stroke="#0f172a" stroke-width="2.5"/>
    <rect x="54" y="74" width="36" height="6" rx="3" fill="#22d3ee" stroke="#ffffff" stroke-width="1.5"/>
    <!-- Neon Soles Glowing -->
    <path d="M 32 82 Q 46 86 60 82" stroke="#fde047" stroke-width="3" fill="none"/>
    <path d="M 58 78 Q 72 82 86 78" stroke="#fde047" stroke-width="3" fill="none"/>
  </svg>`,

  'ember_ridge_helm': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="erh_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#7c2d12"/>
        <stop offset="60%" stop-color="#431407"/>
        <stop offset="100%" stop-color="#1a0601"/>
      </radialGradient>
      <linearGradient id="erh_iron" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#64748b"/>
        <stop offset="60%" stop-color="#334155"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#erh_bg)" stroke="#ea580c" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Helmet Dome -->
    <path d="M 32 58 C 32 38, 44 28, 60 28 C 76 28, 88 38, 88 58 L 88 78 L 74 78 L 70 66 L 50 66 L 46 78 L 32 78 Z" fill="url(#erh_iron)" stroke="#0f172a" stroke-width="3"/>
    <!-- Volcanic Ember Ridge Spikes -->
    <polygon points="60,18 64,30 56,30" fill="#f97316" stroke="#ea580c" stroke-width="1.5"/>
    <polygon points="50,22 54,32 46,32" fill="#f97316" stroke="#ea580c" stroke-width="1.5"/>
    <polygon points="70,22 74,32 66,32" fill="#f97316" stroke="#ea580c" stroke-width="1.5"/>
    <!-- Glowing Visor Slit -->
    <rect x="42" y="52" width="36" height="8" rx="3" fill="#fde047" stroke="#ea580c" stroke-width="1.5"/>
    <rect x="44" y="54" width="32" height="4" rx="1.5" fill="#ffffff"/>
  </svg>`,

  'phoenix_ember_wings': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="pew_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#9a3412"/>
        <stop offset="60%" stop-color="#431407"/>
        <stop offset="100%" stop-color="#1f0701"/>
      </radialGradient>
      <linearGradient id="pew_wing" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="30%" stop-color="#f97316"/>
        <stop offset="80%" stop-color="#ea580c"/>
        <stop offset="100%" stop-color="#b91c1c"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#pew_bg)" stroke="#f97316" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Left Wing Feathers -->
    <path d="M 54 62 C 40 45, 20 40, 16 52 C 14 62, 30 75, 52 72 Z" fill="url(#pew_wing)" stroke="#0f172a" stroke-width="2"/>
    <path d="M 52 56 C 36 35, 22 28, 20 38 C 18 48, 32 60, 50 64 Z" fill="url(#pew_wing)" stroke="#0f172a" stroke-width="2"/>
    <!-- Right Wing Feathers -->
    <path d="M 66 62 C 80 45, 100 40, 104 52 C 106 62, 90 75, 68 72 Z" fill="url(#pew_wing)" stroke="#0f172a" stroke-width="2"/>
    <path d="M 68 56 C 84 35, 98 28, 100 38 C 102 48, 88 60, 70 64 Z" fill="url(#pew_wing)" stroke="#0f172a" stroke-width="2"/>
    <!-- Center Phoenix Core Gem -->
    <circle cx="60" cy="64" r="8" fill="#fbbf24" stroke="#d97706" stroke-width="2"/>
    <circle cx="60" cy="64" r="4" fill="#ffffff"/>
  </svg>`,

  // ==========================================
  // 3. PET GEAR
  // ==========================================
  'crown_golden_horn': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="cgh_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#78350f"/>
        <stop offset="60%" stop-color="#451a03"/>
        <stop offset="100%" stop-color="#1c0a00"/>
      </radialGradient>
      <linearGradient id="cgh_gold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="40%" stop-color="#f59e0b"/>
        <stop offset="100%" stop-color="#b45309"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#cgh_bg)" stroke="#f59e0b" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Crown Base -->
    <rect x="28" y="65" width="64" height="12" rx="4" fill="url(#cgh_gold)" stroke="#0f172a" stroke-width="2.5"/>
    <!-- Crown Spikes & Horns -->
    <polygon points="32,65 38,40 48,65" fill="url(#cgh_gold)" stroke="#0f172a" stroke-width="2"/>
    <polygon points="50,65 60,30 70,65" fill="url(#cgh_gold)" stroke="#0f172a" stroke-width="2"/>
    <polygon points="72,65 82,40 88,65" fill="url(#cgh_gold)" stroke="#0f172a" stroke-width="2"/>
    <!-- Dino Horn Tips -->
    <circle cx="38" cy="40" r="4" fill="#38b6ff" stroke="#ffffff" stroke-width="1.5"/>
    <circle cx="60" cy="30" r="5" fill="#10b981" stroke="#ffffff" stroke-width="1.5"/>
    <circle cx="82" cy="40" r="4" fill="#38b6ff" stroke="#ffffff" stroke-width="1.5"/>
    <!-- Gems in band -->
    <circle cx="44" cy="71" r="3" fill="#ef4444"/>
    <circle cx="60" cy="71" r="3" fill="#38b6ff"/>
    <circle cx="76" cy="71" r="3" fill="#10b981"/>
  </svg>`,

  'goggles_aviator': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="ga_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#075985"/>
        <stop offset="60%" stop-color="#0c4a6e"/>
        <stop offset="100%" stop-color="#041f30"/>
      </radialGradient>
      <linearGradient id="ga_brass" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fde047"/>
        <stop offset="50%" stop-color="#d97706"/>
        <stop offset="100%" stop-color="#92400e"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#ga_bg)" stroke="#38b6ff" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Leather Strap -->
    <rect x="20" y="55" width="80" height="10" rx="3" fill="#475569" stroke="#0f172a" stroke-width="2"/>
    <!-- Left Lens Frame -->
    <circle cx="44" cy="60" r="18" fill="url(#ga_brass)" stroke="#0f172a" stroke-width="2.5"/>
    <circle cx="44" cy="60" r="13" fill="#0284c7" stroke="#38b6ff" stroke-width="2"/>
    <ellipse cx="40" cy="55" rx="6" ry="3" transform="rotate(-30 40 55)" fill="#ffffff" opacity="0.8"/>
    <!-- Right Lens Frame -->
    <circle cx="76" cy="60" r="18" fill="url(#ga_brass)" stroke="#0f172a" stroke-width="2.5"/>
    <circle cx="76" cy="60" r="13" fill="#0284c7" stroke="#38b6ff" stroke-width="2"/>
    <ellipse cx="72" cy="55" rx="6" ry="3" transform="rotate(-30 72 55)" fill="#ffffff" opacity="0.8"/>
    <!-- Bridge -->
    <rect x="58" y="58" width="4" height="4" rx="1" fill="#f59e0b" stroke="#0f172a" stroke-width="1.5"/>
  </svg>`,

  'tiara_phoenix': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="tp_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#9a3412"/>
        <stop offset="60%" stop-color="#431407"/>
        <stop offset="100%" stop-color="#1f0701"/>
      </radialGradient>
      <linearGradient id="tp_flame" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="50%" stop-color="#f97316"/>
        <stop offset="100%" stop-color="#dc2626"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#tp_bg)" stroke="#f97316" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Phoenix Feather Tiara -->
    <path d="M 30 72 Q 60 78 90 72 L 86 64 Q 60 70 34 64 Z" fill="#fbbf24" stroke="#0f172a" stroke-width="2"/>
    <!-- Rising Solar Feathers -->
    <path d="M 60 28 C 65 42, 68 55, 60 68 C 52 55, 55 42, 60 28 Z" fill="url(#tp_flame)" stroke="#ea580c" stroke-width="1.5"/>
    <path d="M 45 38 C 50 48, 52 58, 48 68 C 42 58, 40 48, 45 38 Z" fill="url(#tp_flame)" stroke="#ea580c" stroke-width="1.5"/>
    <path d="M 75 38 C 80 48, 78 58, 72 68 C 70 58, 72 48, 75 38 Z" fill="url(#tp_flame)" stroke="#ea580c" stroke-width="1.5"/>
    <!-- Center Fire Gem -->
    <circle cx="60" cy="66" r="4.5" fill="#ffffff" stroke="#f59e0b" stroke-width="2"/>
  </svg>`,

  'cape_shadow_wing': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="csw_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="60%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#020617"/>
      </radialGradient>
      <linearGradient id="csw_shade" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#475569"/>
        <stop offset="50%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#090d16"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#csw_bg)" stroke="#38b6ff" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Wing Cape -->
    <path d="M 46 38 C 55 40, 65 40, 74 38 C 92 60, 102 85, 92 92 C 80 84, 70 90, 60 82 C 50 90, 40 84, 28 92 C 18 85, 28 60, 46 38 Z" fill="url(#csw_shade)" stroke="#38b6ff" stroke-width="2.5"/>
    <!-- Silver Trim -->
    <path d="M 28 92 Q 40 84 50 90 Q 60 82 70 90 Q 80 84 92 92" fill="none" stroke="#38b6ff" stroke-width="2.5"/>
    <circle cx="48" cy="38" r="5" fill="#38b6ff"/>
    <circle cx="72" cy="38" r="5" fill="#38b6ff"/>
  </svg>`,

  'cape_meteor_blaze': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="cmb_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#7c2d12"/>
        <stop offset="60%" stop-color="#431407"/>
        <stop offset="100%" stop-color="#1a0601"/>
      </radialGradient>
      <linearGradient id="cmb_fire" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="40%" stop-color="#f97316"/>
        <stop offset="100%" stop-color="#b91c1c"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#cmb_bg)" stroke="#f59e0b" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <path d="M 44 36 C 55 38, 65 38, 76 36 C 90 62, 98 88, 88 94 C 76 86, 68 90, 60 84 C 52 90, 44 86, 32 94 C 22 88, 30 62, 44 36 Z" fill="url(#cmb_fire)" stroke="#0f172a" stroke-width="2.5"/>
    <circle cx="46" cy="36" r="5.5" fill="#fbbf24" stroke="#d97706" stroke-width="1.5"/>
    <circle cx="74" cy="36" r="5.5" fill="#fbbf24" stroke="#d97706" stroke-width="1.5"/>
  </svg>`,

  'armor_obsidian_plate': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="aop_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="60%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#020617"/>
      </radialGradient>
      <linearGradient id="aop_steel" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#475569"/>
        <stop offset="50%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#aop_bg)" stroke="#38b6ff" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Obsidian Armor Vest -->
    <path d="M 38 34 L 82 34 L 88 56 L 60 94 L 32 56 Z" fill="url(#aop_steel)" stroke="#38b6ff" stroke-width="2.5"/>
    <!-- Azure Power Lines -->
    <line x1="60" y1="38" x2="60" y2="86" stroke="#38b6ff" stroke-width="3"/>
    <line x1="44" y1="52" x2="76" y2="52" stroke="#38b6ff" stroke-width="2"/>
    <circle cx="60" cy="52" r="5" fill="#ffffff" stroke="#0284c7" stroke-width="2"/>
  </svg>`,

  'boots_rocket_jump': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="brj_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#047857"/>
        <stop offset="60%" stop-color="#064e3b"/>
        <stop offset="100%" stop-color="#022c22"/>
      </radialGradient>
      <linearGradient id="brj_boot" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#34d399"/>
        <stop offset="60%" stop-color="#059669"/>
        <stop offset="100%" stop-color="#047857"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#brj_bg)" stroke="#34d399" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Left Paw Boot -->
    <path d="M 34 42 L 50 42 L 48 64 L 62 70 C 64 76, 60 82, 52 82 L 30 82 C 26 82, 26 72, 32 68 Z" fill="url(#brj_boot)" stroke="#0f172a" stroke-width="2.5"/>
    <rect x="26" y="78" width="36" height="5" rx="2.5" fill="#f59e0b" stroke="#ffffff" stroke-width="1"/>
    <!-- Right Paw Boot -->
    <path d="M 60 38 L 76 38 L 74 60 L 88 66 C 90 72, 86 78, 78 78 L 56 78 C 52 78, 52 68, 58 64 Z" fill="url(#brj_boot)" stroke="#0f172a" stroke-width="2.5"/>
    <rect x="52" y="74" width="36" height="5" rx="2.5" fill="#f59e0b" stroke="#ffffff" stroke-width="1"/>
    <!-- Mini Rocket Exhaust -->
    <polygon points="26,84 20,92 28,90" fill="#f97316"/>
    <polygon points="52,80 46,88 54,86" fill="#f97316"/>
  </svg>`,

  // ==========================================
  // 4. ACCESSORIES
  // ==========================================
  'wizard_hat': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="wh_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="60%" stop-color="#020617"/>
        <stop offset="100%" stop-color="#000000"/>
      </radialGradient>
      <linearGradient id="wh_hat" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#38b6ff"/>
        <stop offset="50%" stop-color="#1d4ed8"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#wh_bg)" stroke="#38b6ff" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Brim -->
    <ellipse cx="60" cy="84" rx="42" ry="12" fill="#1e3a8a" stroke="#38b6ff" stroke-width="3"/>
    <!-- Cone -->
    <path d="M 28 82 Q 45 45 52 26 Q 64 24 66 32 Q 72 52 92 82 Z" fill="url(#wh_hat)" stroke="#0f172a" stroke-width="2.5"/>
    <!-- Gold Stars on Hat -->
    <polygon points="55,42 57,46 62,47 58,49 59,54 55,51 51,54 52,49 48,47 53,46" fill="#fde047"/>
    <polygon points="68,62 70,65 74,66 71,68 72,72 68,70 65,72 66,68 63,66 67,65" fill="#fde047"/>
    <!-- Star at Tip -->
    <circle cx="56" cy="24" r="5" fill="#fbbf24" stroke="#ffffff" stroke-width="1.5"/>
  </svg>`,

  'scout_headband': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="shb_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#064e3b"/>
        <stop offset="60%" stop-color="#022c22"/>
        <stop offset="100%" stop-color="#01150f"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#shb_bg)" stroke="#10b981" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Band -->
    <path d="M 24 58 Q 60 72 96 58 L 94 68 Q 60 82 26 68 Z" fill="#10b981" stroke="#0f172a" stroke-width="2.5"/>
    <!-- Center Hero Scout Star -->
    <circle cx="60" cy="65" r="12" fill="#f59e0b" stroke="#ffffff" stroke-width="2"/>
    <polygon points="60,56 63,62 70,63 65,67 66,74 60,70 54,74 55,67 50,63 57,62" fill="#ffffff"/>
  </svg>`,

  'astro_belt': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="ab_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#0c4a6e"/>
        <stop offset="60%" stop-color="#075985"/>
        <stop offset="100%" stop-color="#021f30"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#ab_bg)" stroke="#0284c7" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Belt Strap -->
    <rect x="20" y="54" width="80" height="12" rx="3" fill="#334155" stroke="#0f172a" stroke-width="2"/>
    <!-- Pouches -->
    <rect x="26" y="50" width="16" height="20" rx="3" fill="#64748b" stroke="#0f172a" stroke-width="1.5"/>
    <rect x="78" y="50" width="16" height="20" rx="3" fill="#64748b" stroke="#0f172a" stroke-width="1.5"/>
    <!-- Buckle -->
    <circle cx="60" cy="60" r="14" fill="#f59e0b" stroke="#ffffff" stroke-width="2.5"/>
    <circle cx="60" cy="60" r="7" fill="#38b6ff"/>
  </svg>`,

  'cosmic_compass': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="cc_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#78350f"/>
        <stop offset="60%" stop-color="#451a03"/>
        <stop offset="100%" stop-color="#1c0a00"/>
      </radialGradient>
      <radialGradient id="cc_dial" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="50%" stop-color="#e2e8f0"/>
        <stop offset="100%" stop-color="#94a3b8"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#cc_bg)" stroke="#f59e0b" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Compass Casing -->
    <circle cx="60" cy="62" r="32" fill="#f59e0b" stroke="#78350f" stroke-width="3"/>
    <circle cx="60" cy="62" r="25" fill="url(#cc_dial)" stroke="#0f172a" stroke-width="2"/>
    <circle cx="60" cy="30" r="6" fill="none" stroke="#f59e0b" stroke-width="3"/>
    <!-- Needle -->
    <polygon points="60,44 65,62 60,60 55,62" fill="#ef4444"/>
    <polygon points="60,80 65,62 60,64 55,62" fill="#3b82f6"/>
    <circle cx="60" cy="62" r="3.5" fill="#f59e0b"/>
  </svg>`,

  // ==========================================
  // 5. BADGES
  // ==========================================
  'mint_knight_badge': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="mkb_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#064e3b"/>
        <stop offset="60%" stop-color="#022c22"/>
        <stop offset="100%" stop-color="#01150f"/>
      </radialGradient>
      <linearGradient id="mkb_crest" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#34d399"/>
        <stop offset="50%" stop-color="#059669"/>
        <stop offset="100%" stop-color="#047857"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#mkb_bg)" stroke="#34d399" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Shield Crest -->
    <path d="M 36 34 L 84 34 C 84 62, 70 82, 60 92 C 50 82, 36 62, 36 34 Z" fill="url(#mkb_crest)" stroke="#ffffff" stroke-width="3"/>
    <!-- Shiny Tooth Motif -->
    <path d="M 50 48 C 50 42, 57 40, 60 44 C 63 40, 70 42, 70 48 C 70 56, 66 64, 63 70 C 61 74, 59 74, 57 70 C 54 64, 50 56, 50 48 Z" fill="#ffffff"/>
    <polygon points="70,40 72,44 76,45 72,46 70,50 68,46 64,45 68,44" fill="#fde047"/>
  </svg>`,

  'emerald_streak_medal': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="esm_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#047857"/>
        <stop offset="60%" stop-color="#064e3b"/>
        <stop offset="100%" stop-color="#022c22"/>
      </radialGradient>
      <radialGradient id="esm_gem" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#a7f3d0"/>
        <stop offset="40%" stop-color="#34d399"/>
        <stop offset="100%" stop-color="#059669"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#esm_bg)" stroke="#34d399" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Ribbon -->
    <polygon points="44,22 60,46 52,46 36,22" fill="#38b6ff"/>
    <polygon points="76,22 60,46 68,46 84,22" fill="#0284c7"/>
    <!-- Gold Medallion Rim -->
    <circle cx="60" cy="68" r="26" fill="#f59e0b" stroke="#d97706" stroke-width="2.5"/>
    <!-- Emerald Center Stone -->
    <polygon points="60,48 78,58 78,78 60,88 42,78 42,58" fill="url(#esm_gem)" stroke="#ffffff" stroke-width="2"/>
    <polygon points="60,54 72,61 72,75 60,82 48,75 48,61" fill="#6ee7b7" opacity="0.6"/>
  </svg>`,

  'cosmic_explorer_badge': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="ceb_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#075985"/>
        <stop offset="60%" stop-color="#0c4a6e"/>
        <stop offset="100%" stop-color="#041f30"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#ceb_bg)" stroke="#38b6ff" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Explorer Starburst Badge -->
    <polygon points="60,22 69,42 90,36 78,54 96,66 74,72 80,94 60,84 40,94 46,72 24,66 42,54 30,36 51,42" fill="#38b6ff" stroke="#ffffff" stroke-width="2.5"/>
    <circle cx="60" cy="60" r="18" fill="#f59e0b" stroke="#ffffff" stroke-width="2"/>
    <polygon points="60,48 64,56 72,57 66,63 68,71 60,67 52,71 54,63 48,57 56,56" fill="#ffffff"/>
  </svg>`,

  'rocket_badge': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="rb_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#1e3a8a"/>
        <stop offset="60%" stop-color="#172554"/>
        <stop offset="100%" stop-color="#0b112c"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#rb_bg)" stroke="#38b6ff" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Rocket Ship Body -->
    <path d="M 60 25 C 72 40, 75 65, 75 75 L 45 75 C 45 65, 48 40, 60 25 Z" fill="#ffffff" stroke="#0f172a" stroke-width="2.5"/>
    <!-- Fins -->
    <path d="M 45 65 L 32 78 L 45 76 Z" fill="#38b6ff" stroke="#0f172a" stroke-width="2"/>
    <path d="M 75 65 L 88 78 L 75 76 Z" fill="#38b6ff" stroke="#0f172a" stroke-width="2"/>
    <!-- Porthole Window -->
    <circle cx="60" cy="50" r="9" fill="#0284c7" stroke="#38b6ff" stroke-width="2.5"/>
    <circle cx="58" cy="48" r="3" fill="#ffffff"/>
    <!-- Rocket Flame -->
    <polygon points="50,75 60,96 70,75 60,82" fill="#f97316"/>
    <polygon points="54,75 60,90 66,75" fill="#fde047"/>
  </svg>`,

  'bedtime_bravery_badge': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="bbb_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#1e1b4b"/>
        <stop offset="60%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#020617"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#bbb_bg)" stroke="#fbbf24" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Moon & Star Shield -->
    <circle cx="60" cy="60" r="28" fill="#1e3a8a" stroke="#fbbf24" stroke-width="2.5"/>
    <!-- Golden Crescent Moon -->
    <path d="M 66 40 C 50 42, 42 56, 46 72 C 54 84, 72 84, 80 74 C 64 74, 56 62, 66 40 Z" fill="#fbbf24"/>
    <polygon points="72,42 74,45 78,46 75,48 76,52 72,50 68,52 69,48 66,46 70,45" fill="#ffffff"/>
  </svg>`,

  // ==========================================
  // 6. TROPHIES
  // ==========================================
  'star_trophy': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="st_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#78350f"/>
        <stop offset="60%" stop-color="#451a03"/>
        <stop offset="100%" stop-color="#1c0a00"/>
      </radialGradient>
      <radialGradient id="st_star" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="40%" stop-color="#fde047"/>
        <stop offset="100%" stop-color="#f59e0b"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#st_bg)" stroke="#fbbf24" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Pedestal Base -->
    <rect x="36" y="85" width="48" height="12" rx="3" fill="#334155" stroke="#0f172a" stroke-width="2"/>
    <rect x="44" y="78" width="32" height="8" rx="2" fill="#64748b" stroke="#0f172a" stroke-width="1.5"/>
    <polygon points="52,78 60,65 68,78" fill="#f59e0b"/>
    <!-- Giant Shiny Star -->
    <polygon points="60,20 68,38 88,40 73,54 78,74 60,62 42,74 47,54 32,40 52,38" fill="url(#st_star)" stroke="#b45309" stroke-width="2.5"/>
    <polygon points="60,28 65,40 78,42 68,51 71,64 60,56 49,64 52,51 42,42 55,40" fill="#ffffff" opacity="0.45"/>
  </svg>`,

  'golden_champion_cup': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="gcc_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#78350f"/>
        <stop offset="60%" stop-color="#451a03"/>
        <stop offset="100%" stop-color="#1c0a00"/>
      </radialGradient>
      <linearGradient id="gcc_gold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="40%" stop-color="#f59e0b"/>
        <stop offset="100%" stop-color="#b45309"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#gcc_bg)" stroke="#fbbf24" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Trophy Handles -->
    <path d="M 36 40 C 20 40, 20 62, 38 66" fill="none" stroke="#f59e0b" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M 84 40 C 100 40, 100 62, 82 66" fill="none" stroke="#f59e0b" stroke-width="4.5" stroke-linecap="round"/>
    <!-- Cup Body -->
    <path d="M 36 32 L 84 32 L 80 58 C 80 72, 70 78, 60 78 C 50 78, 40 72, 40 58 Z" fill="url(#gcc_gold)" stroke="#78350f" stroke-width="2.5"/>
    <!-- Stem and Base -->
    <rect x="56" y="78" width="8" height="12" fill="#d97706" stroke="#78350f" stroke-width="1.5"/>
    <rect x="40" y="88" width="40" height="10" rx="3" fill="#334155" stroke="#0f172a" stroke-width="2"/>
    <circle cx="60" cy="50" r="6" fill="#38b6ff" stroke="#ffffff" stroke-width="1.5"/>
  </svg>`,

  'rocket_speed_trophy': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="rst_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#075985"/>
        <stop offset="60%" stop-color="#0c4a6e"/>
        <stop offset="100%" stop-color="#041f30"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#rst_bg)" stroke="#38b6ff" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Orbit Rings -->
    <ellipse cx="60" cy="55" rx="36" ry="14" transform="rotate(-25 60 55)" fill="none" stroke="#fde047" stroke-width="3.5"/>
    <!-- Golden Rocket ascending -->
    <path d="M 68 28 C 76 38, 78 54, 76 62 L 52 50 C 55 42, 60 32, 68 28 Z" fill="#f59e0b" stroke="#ffffff" stroke-width="2"/>
    <!-- Pedestal Base -->
    <rect x="36" y="86" width="48" height="12" rx="3" fill="#1e293b" stroke="#38b6ff" stroke-width="2"/>
    <circle cx="68" cy="40" r="4" fill="#38b6ff"/>
  </svg>`,

  'trophy_sugarfang': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="tsf_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#064e3b"/>
        <stop offset="60%" stop-color="#022c22"/>
        <stop offset="100%" stop-color="#01150f"/>
      </radialGradient>
      <linearGradient id="tsf_goblet" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#6ee7b7"/>
        <stop offset="50%" stop-color="#10b981"/>
        <stop offset="100%" stop-color="#047857"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#tsf_bg)" stroke="#34d399" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Goblet -->
    <path d="M 38 34 L 82 34 L 78 58 C 78 72, 68 76, 60 76 C 52 76, 42 72, 42 58 Z" fill="url(#tsf_goblet)" stroke="#ffffff" stroke-width="2.5"/>
    <rect x="56" y="76" width="8" height="12" fill="#047857"/>
    <rect x="40" y="88" width="40" height="10" rx="3" fill="#334155" stroke="#10b981" stroke-width="2"/>
    <!-- Toothbrush Crossed Inside -->
    <line x1="44" y1="38" x2="76" y2="54" stroke="#38b6ff" stroke-width="4" stroke-linecap="round"/>
    <line x1="76" y1="38" x2="44" y2="54" stroke="#38b6ff" stroke-width="4" stroke-linecap="round"/>
    <circle cx="60" cy="46" r="5" fill="#fde047"/>
  </svg>`,

  'trophy_plaque_phantom': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="tpp_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#1e3a8a"/>
        <stop offset="60%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#020617"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#tpp_bg)" stroke="#38b6ff" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Pedestal Base -->
    <rect x="38" y="86" width="44" height="12" rx="3" fill="#334155" stroke="#38b6ff" stroke-width="2"/>
    <!-- Purified Little Ghost Figurine (Friendly Hero Buddy) -->
    <path d="M 42 46 C 42 32, 50 26, 60 26 C 70 26, 78 32, 78 46 L 78 74 C 74 70, 70 76, 66 72 C 62 76, 58 70, 54 74 C 50 70, 46 76, 42 72 Z" fill="#ffffff" stroke="#93c5fd" stroke-width="2.5"/>
    <!-- Happy Eyes & Smile -->
    <circle cx="52" cy="44" r="3.5" fill="#0284c7"/>
    <circle cx="68" cy="44" r="3.5" fill="#0284c7"/>
    <path d="M 54 52 Q 60 58 66 52" stroke="#0284c7" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="60" cy="22" r="4" fill="#fbbf24"/>
  </svg>`,

  'trophy_sugar_bandit': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="tsb_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#78350f"/>
        <stop offset="60%" stop-color="#451a03"/>
        <stop offset="100%" stop-color="#1c0a00"/>
      </radialGradient>
      <linearGradient id="tsb_gold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="40%" stop-color="#f59e0b"/>
        <stop offset="100%" stop-color="#b45309"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#tsb_bg)" stroke="#f59e0b" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Pedestal Base -->
    <rect x="36" y="86" width="48" height="12" rx="3" fill="#334155" stroke="#f59e0b" stroke-width="2"/>
    <!-- Purified Solid Gold Candy Crown -->
    <rect x="34" y="66" width="52" height="12" rx="3" fill="url(#tsb_gold)" stroke="#0f172a" stroke-width="2"/>
    <polygon points="36,66 42,42 50,66" fill="url(#tsb_gold)" stroke="#0f172a" stroke-width="2"/>
    <polygon points="52,66 60,34 68,66" fill="url(#tsb_gold)" stroke="#0f172a" stroke-width="2"/>
    <polygon points="70,66 78,42 84,66" fill="url(#tsb_gold)" stroke="#0f172a" stroke-width="2"/>
    <circle cx="60" cy="34" r="5" fill="#38b6ff" stroke="#ffffff" stroke-width="1.5"/>
    <circle cx="42" cy="42" r="4" fill="#10b981" stroke="#ffffff" stroke-width="1.5"/>
    <circle cx="78" cy="42" r="4" fill="#10b981" stroke="#ffffff" stroke-width="1.5"/>
  </svg>`,

  // ==========================================
  // 7. STICKERS
  // ==========================================
  'starlight_dino': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="sd_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#064e3b"/>
        <stop offset="60%" stop-color="#022c22"/>
        <stop offset="100%" stop-color="#01150f"/>
      </radialGradient>
    </defs>
    <!-- White Die-Cut Sticker Border -->
    <circle cx="60" cy="60" r="54" fill="url(#sd_bg)" stroke="#ffffff" stroke-width="4.5"/>
    <!-- Rex Dino Silhouette & Glow -->
    <path d="M 45 74 C 40 68, 42 50, 48 40 C 54 32, 70 28, 82 34 C 84 40, 78 44, 76 48 L 84 50 L 78 56 L 74 54 C 70 66, 68 74, 58 76 Z" fill="#10b981" stroke="#34d399" stroke-width="2.5"/>
    <!-- Eye & Teeth -->
    <circle cx="74" cy="38" r="3" fill="#ffffff"/>
    <polygon points="78,50 82,50 80,53" fill="#ffffff"/>
    <!-- Constellation Stars & Lines -->
    <line x1="48" y1="40" x2="60" y2="32" stroke="#fde047" stroke-width="1.5" stroke-dasharray="2 2"/>
    <line x1="60" y1="32" x2="74" y2="38" stroke="#fde047" stroke-width="1.5" stroke-dasharray="2 2"/>
    <circle cx="48" cy="40" r="3.5" fill="#fde047"/>
    <circle cx="60" cy="32" r="4" fill="#ffffff"/>
    <circle cx="74" cy="38" r="4.5" fill="#fde047"/>
    <circle cx="58" cy="76" r="3" fill="#fde047"/>
  </svg>`,

  'cosmic_rocket': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="cr_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#075985"/>
        <stop offset="60%" stop-color="#0c4a6e"/>
        <stop offset="100%" stop-color="#041f30"/>
      </radialGradient>
    </defs>
    <!-- White Die-Cut Sticker Outline -->
    <circle cx="60" cy="60" r="54" fill="url(#cr_bg)" stroke="#ffffff" stroke-width="4.5"/>
    <!-- Comet Hopper Rocket -->
    <path d="M 68 28 C 80 40, 80 62, 76 72 L 48 58 C 50 48, 56 34, 68 28 Z" fill="#38b6ff" stroke="#0f172a" stroke-width="2"/>
    <!-- Wings -->
    <path d="M 48 58 L 34 66 L 48 72 Z" fill="#0284c7" stroke="#0f172a" stroke-width="1.5"/>
    <path d="M 76 72 L 78 88 L 66 80 Z" fill="#0284c7" stroke="#0f172a" stroke-width="1.5"/>
    <circle cx="66" cy="46" r="6" fill="#ffffff"/>
    <circle cx="66" cy="46" r="3" fill="#0284c7"/>
    <!-- Stars Around -->
    <polygon points="90,30 92,34 96,35 92,36 90,40 88,36 84,35 88,34" fill="#fde047"/>
    <polygon points="34,40 36,44 40,45 36,46 34,50 32,46 28,45 32,44" fill="#fde047"/>
  </svg>`,

  'solar_ember_sticker': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="ses_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#7c2d12"/>
        <stop offset="60%" stop-color="#431407"/>
        <stop offset="100%" stop-color="#1a0601"/>
      </radialGradient>
      <radialGradient id="ses_flame" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="30%" stop-color="#fde047"/>
        <stop offset="70%" stop-color="#f97316"/>
        <stop offset="100%" stop-color="#dc2626"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#ses_bg)" stroke="#ffffff" stroke-width="4.5"/>
    <!-- Giant Fire Flame Sticker -->
    <path d="M 60 22 C 68 36, 84 50, 84 68 C 84 82, 74 92, 60 92 C 46 92, 36 82, 36 68 C 36 54, 48 40, 52 34 C 52 44, 56 48, 60 42 C 62 34, 58 26, 60 22 Z" fill="url(#ses_flame)" stroke="#0f172a" stroke-width="2.5"/>
    <path d="M 60 52 C 66 62, 70 70, 70 76 C 70 82, 66 86, 60 86 C 54 86, 50 82, 50 76 C 50 68, 56 60, 60 52 Z" fill="#ffffff" opacity="0.6"/>
  </svg>`,

  'aqua_bubble_sticker': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="abs_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#0369a1"/>
        <stop offset="60%" stop-color="#075985"/>
        <stop offset="100%" stop-color="#0c2a44"/>
      </radialGradient>
      <radialGradient id="abs_b" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="50%" stop-color="#67e8f9"/>
        <stop offset="100%" stop-color="#0284c7"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#abs_bg)" stroke="#ffffff" stroke-width="4.5"/>
    <!-- Main Sparkling Bubble -->
    <circle cx="60" cy="60" r="28" fill="url(#abs_b)" stroke="#ffffff" stroke-width="3"/>
    <ellipse cx="50" cy="46" rx="8" ry="4" transform="rotate(-30 50 46)" fill="#ffffff" opacity="0.9"/>
    <!-- Mini Bubbles -->
    <circle cx="86" cy="40" r="10" fill="url(#abs_b)" stroke="#ffffff" stroke-width="2"/>
    <circle cx="36" cy="74" r="8" fill="url(#abs_b)" stroke="#ffffff" stroke-width="1.5"/>
    <polygon points="60,20 62,24 66,25 62,26 60,30 58,26 54,25 58,24" fill="#fde047"/>
  </svg>`,

  // ==========================================
  // 8. LOOT
  // ==========================================
  'gem_trove': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="gt_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#1e3a8a"/>
        <stop offset="60%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#020617"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#gt_bg)" stroke="#38b6ff" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Treasure Chest Base -->
    <rect x="30" y="56" width="60" height="32" rx="4" fill="#78350f" stroke="#0f172a" stroke-width="2.5"/>
    <!-- Gold Chest Trim -->
    <rect x="28" y="54" width="64" height="6" fill="#f59e0b" stroke="#0f172a" stroke-width="1.5"/>
    <!-- Chest Lid Open -->
    <path d="M 28 54 C 28 38, 92 38, 92 54 Z" fill="#b45309" stroke="#0f172a" stroke-width="2.5"/>
    <!-- Spilling Gems -->
    <polygon points="50,42 62,40 68,52 56,58 46,48" fill="#38b6ff" stroke="#ffffff" stroke-width="1.5"/>
    <polygon points="64,36 76,40 74,52 62,48" fill="#10b981" stroke="#ffffff" stroke-width="1.5"/>
    <polygon points="40,48 50,46 52,58 42,56" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5"/>
    <!-- Keyhole -->
    <circle cx="60" cy="70" r="4" fill="#f59e0b"/>
    <rect x="58" y="70" width="4" height="6" fill="#f59e0b"/>
  </svg>`,

  'star_crystal_crate': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="scc_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#0c4a6e"/>
        <stop offset="60%" stop-color="#075985"/>
        <stop offset="100%" stop-color="#021f30"/>
      </radialGradient>
      <linearGradient id="scc_crystal" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="50%" stop-color="#67e8f9"/>
        <stop offset="100%" stop-color="#0284c7"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#scc_bg)" stroke="#22d3ee" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Sci-Fi Energy Crate -->
    <rect x="32" y="44" width="56" height="46" rx="6" fill="#1e293b" stroke="#22d3ee" stroke-width="3"/>
    <!-- Cross Braces -->
    <line x1="32" y1="44" x2="88" y2="90" stroke="#334155" stroke-width="3"/>
    <line x1="88" y1="44" x2="32" y2="90" stroke="#334155" stroke-width="3"/>
    <!-- Giant Glowing Crystal on top -->
    <polygon points="60,18 72,36 60,54 48,36" fill="url(#scc_crystal)" stroke="#ffffff" stroke-width="2"/>
    <polygon points="60,26 68,36 60,46 52,36" fill="#ffffff" opacity="0.6"/>
  </svg>`,

  'golden_dino_relic': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="gdr_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#78350f"/>
        <stop offset="60%" stop-color="#451a03"/>
        <stop offset="100%" stop-color="#1c0a00"/>
      </radialGradient>
      <radialGradient id="gdr_amber" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="40%" stop-color="#f59e0b"/>
        <stop offset="100%" stop-color="#b45309"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#gdr_bg)" stroke="#f59e0b" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Amber Stone Teardrop -->
    <path d="M 60 22 C 78 44, 88 64, 88 74 C 88 88, 76 96, 60 96 C 44 96, 32 88, 32 74 C 32 64, 42 44, 60 22 Z" fill="url(#gdr_amber)" stroke="#0f172a" stroke-width="3"/>
    <!-- Dino Tooth / Claw Fossil Inside -->
    <path d="M 54 48 C 66 54, 72 68, 64 78 C 58 74, 52 64, 54 48 Z" fill="#78350f" opacity="0.75"/>
    <ellipse cx="48" cy="45" rx="8" ry="4" transform="rotate(-40 48 45)" fill="#ffffff" opacity="0.65"/>
  </svg>`,

  'radiant_energy_orb': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="reo_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#064e3b"/>
        <stop offset="60%" stop-color="#0f2b38"/>
        <stop offset="100%" stop-color="#02141c"/>
      </radialGradient>
      <radialGradient id="reo_core" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="40%" stop-color="#22d3ee"/>
        <stop offset="70%" stop-color="#0284c7"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#reo_bg)" stroke="#22d3ee" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Glowing Plasma Sphere -->
    <circle cx="60" cy="60" r="28" fill="url(#reo_core)" stroke="#ffffff" stroke-width="2.5"/>
    <!-- Planetary Gyro Rings -->
    <ellipse cx="60" cy="60" rx="38" ry="14" transform="rotate(35 60 60)" fill="none" stroke="#f59e0b" stroke-width="3"/>
    <ellipse cx="60" cy="60" rx="38" ry="14" transform="rotate(-35 60 60)" fill="none" stroke="#34d399" stroke-width="3"/>
    <circle cx="60" cy="60" r="8" fill="#ffffff"/>
  </svg>`,

  // ==========================================
  // 9. SNACKS & PET FOOD
  // ==========================================
  'flame_kibble_bowl': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="fkb_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#78350f"/>
        <stop offset="60%" stop-color="#451a03"/>
        <stop offset="100%" stop-color="#1c0a00"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#fkb_bg)" stroke="#f59e0b" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Dino Feeding Bowl -->
    <ellipse cx="60" cy="74" rx="38" ry="14" fill="#0284c7" stroke="#0f172a" stroke-width="3"/>
    <path d="M 22 74 C 22 90, 98 90, 98 74 Z" fill="#0369a1" stroke="#0f172a" stroke-width="3"/>
    <!-- Crunchy Flame Kibble Puffs -->
    <circle cx="48" cy="68" r="8" fill="#f97316" stroke="#b45309" stroke-width="1.5"/>
    <circle cx="62" cy="65" r="9" fill="#f59e0b" stroke="#b45309" stroke-width="1.5"/>
    <circle cx="74" cy="68" r="8" fill="#f97316" stroke="#b45309" stroke-width="1.5"/>
    <circle cx="56" cy="58" r="8" fill="#fde047" stroke="#b45309" stroke-width="1.5"/>
    <circle cx="68" cy="58" r="7" fill="#ea580c" stroke="#b45309" stroke-width="1.5"/>
    <!-- Steam / Warmth -->
    <path d="M 52 46 Q 50 38 54 32" stroke="#fbbf24" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M 68 46 Q 70 38 66 32" stroke="#fbbf24" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>`,

  'starlight_berry_pod': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="sbp_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#1e3a8a"/>
        <stop offset="60%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#020617"/>
      </radialGradient>
      <radialGradient id="sbp_berry" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#93c5fd"/>
        <stop offset="50%" stop-color="#3b82f6"/>
        <stop offset="100%" stop-color="#1d4ed8"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#sbp_bg)" stroke="#38b6ff" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Stem & Leaves -->
    <path d="M 60 30 Q 64 42 60 48" stroke="#10b981" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M 60 42 Q 74 34 80 40 Q 70 48 60 44 Z" fill="#10b981" stroke="#047857" stroke-width="1.5"/>
    <path d="M 60 42 Q 46 34 40 40 Q 50 48 60 44 Z" fill="#10b981" stroke="#047857" stroke-width="1.5"/>
    <!-- Triple Cluster of Glow Berries -->
    <circle cx="48" cy="68" r="14" fill="url(#sbp_berry)" stroke="#ffffff" stroke-width="2"/>
    <circle cx="72" cy="68" r="14" fill="url(#sbp_berry)" stroke="#ffffff" stroke-width="2"/>
    <circle cx="60" cy="56" r="15" fill="url(#sbp_berry)" stroke="#ffffff" stroke-width="2"/>
    <!-- Sparkles -->
    <circle cx="56" cy="52" r="3.5" fill="#ffffff"/>
    <circle cx="44" cy="64" r="3" fill="#ffffff"/>
    <circle cx="68" cy="64" r="3" fill="#ffffff"/>
  </svg>`,

  'jungle_honey_comb': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="jhc_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#78350f"/>
        <stop offset="60%" stop-color="#451a03"/>
        <stop offset="100%" stop-color="#1c0a00"/>
      </radialGradient>
      <radialGradient id="jhc_amber" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="50%" stop-color="#f59e0b"/>
        <stop offset="100%" stop-color="#b45309"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#jhc_bg)" stroke="#fbbf24" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Hexagonal Honeycomb Core -->
    <polygon points="60,32 78,42 78,64 60,74 42,64 42,42" fill="url(#jhc_amber)" stroke="#0f172a" stroke-width="3"/>
    <polygon points="78,42 96,52 96,74 78,84 60,74 60,52" fill="url(#jhc_amber)" stroke="#0f172a" stroke-width="3"/>
    <polygon points="42,42 60,52 60,74 42,84 24,74 24,52" fill="url(#jhc_amber)" stroke="#0f172a" stroke-width="3"/>
    <!-- Honey Drops Dripping -->
    <path d="M 60 74 C 64 82, 66 88, 60 92 C 54 88, 56 82, 60 74 Z" fill="#fde047" stroke="#b45309" stroke-width="1.5"/>
    <circle cx="60" cy="50" r="4" fill="#ffffff" opacity="0.7"/>
  </svg>`,

  'mega_bubble_soap': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="mbs_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#0c4a6e"/>
        <stop offset="60%" stop-color="#075985"/>
        <stop offset="100%" stop-color="#021f30"/>
      </radialGradient>
      <linearGradient id="mbs_bar" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#67e8f9"/>
        <stop offset="50%" stop-color="#06b6d4"/>
        <stop offset="100%" stop-color="#0891b2"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#mbs_bg)" stroke="#22d3ee" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Soap Bar -->
    <rect x="32" y="52" width="56" height="34" rx="10" transform="rotate(-15 60 69)" fill="url(#mbs_bar)" stroke="#ffffff" stroke-width="3"/>
    <ellipse cx="58" cy="64" rx="14" ry="5" transform="rotate(-15 58 64)" fill="#ffffff" opacity="0.6"/>
    <!-- Bubbles Rising -->
    <circle cx="45" cy="40" r="9" fill="#e0f2fe" stroke="#ffffff" stroke-width="2"/>
    <circle cx="68" cy="32" r="13" fill="#e0f2fe" stroke="#ffffff" stroke-width="2.5"/>
    <circle cx="84" cy="46" r="7" fill="#e0f2fe" stroke="#ffffff" stroke-width="1.5"/>
    <ellipse cx="64" cy="28" rx="4" ry="2" fill="#ffffff"/>
  </svg>`,

  'food_starberry_bites': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="fsb_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#1e3a8a"/>
        <stop offset="60%" stop-color="#172554"/>
        <stop offset="100%" stop-color="#0b112c"/>
      </radialGradient>
      <radialGradient id="fsb_berry" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#f87171"/>
        <stop offset="40%" stop-color="#ef4444"/>
        <stop offset="100%" stop-color="#b91c1c"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#fsb_bg)" stroke="#38b6ff" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Strawberry Heart Shape -->
    <path d="M 60 40 C 44 26, 28 42, 36 62 C 42 78, 56 88, 60 92 C 64 88, 78 78, 84 62 C 92 42, 76 26, 60 40 Z" fill="url(#fsb_berry)" stroke="#0f172a" stroke-width="2.5"/>
    <!-- Green Cap Leaves -->
    <path d="M 60 38 L 48 30 L 54 42 L 60 38 L 66 42 L 72 30 Z" fill="#10b981" stroke="#047857" stroke-width="1.5"/>
    <!-- Golden Starlight Seeds -->
    <circle cx="48" cy="52" r="2" fill="#fde047"/>
    <circle cx="60" cy="54" r="2" fill="#fde047"/>
    <circle cx="72" cy="52" r="2" fill="#fde047"/>
    <circle cx="54" cy="66" r="2" fill="#fde047"/>
    <circle cx="66" cy="66" r="2" fill="#fde047"/>
    <circle cx="60" cy="78" r="2" fill="#fde047"/>
  </svg>`,

  'glowing_moon_melon': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="gmm_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#064e3b"/>
        <stop offset="60%" stop-color="#022c22"/>
        <stop offset="100%" stop-color="#01150f"/>
      </radialGradient>
      <linearGradient id="gmm_rind" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#34d399"/>
        <stop offset="100%" stop-color="#059669"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#gmm_bg)" stroke="#34d399" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Melon Slice (Crescent) -->
    <path d="M 28 48 C 36 82, 84 82, 92 48 C 82 72, 38 72, 28 48 Z" fill="url(#gmm_rind)" stroke="#0f172a" stroke-width="2.5"/>
    <!-- Glowing Meat -->
    <path d="M 32 50 C 40 76, 80 76, 88 50 C 78 66, 42 66, 32 50 Z" fill="#22d3ee" stroke="#ffffff" stroke-width="1.5"/>
    <!-- Seeds -->
    <circle cx="46" cy="56" r="2" fill="#0f172a"/>
    <circle cx="56" cy="60" r="2" fill="#0f172a"/>
    <circle cx="66" cy="60" r="2" fill="#0f172a"/>
    <circle cx="74" cy="56" r="2" fill="#0f172a"/>
  </svg>`,

  'thunderclap_tonic': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="tct_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#075985"/>
        <stop offset="60%" stop-color="#0c4a6e"/>
        <stop offset="100%" stop-color="#041f30"/>
      </radialGradient>
      <linearGradient id="tct_potion" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#67e8f9"/>
        <stop offset="50%" stop-color="#06b6d4"/>
        <stop offset="100%" stop-color="#0284c7"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#tct_bg)" stroke="#38b6ff" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <!-- Cork Stopper -->
    <rect x="52" y="24" width="16" height="8" rx="2" fill="#b45309" stroke="#0f172a" stroke-width="1.5"/>
    <rect x="54" y="32" width="12" height="8" fill="#e2e8f0" stroke="#0f172a" stroke-width="1.5"/>
    <!-- Flask Bottle -->
    <path d="M 54 40 L 36 78 C 32 86, 40 94, 50 94 L 70 94 C 80 94, 88 86, 84 78 L 66 40 Z" fill="#e2e8f0" stroke="#0f172a" stroke-width="2.5" opacity="0.3"/>
    <!-- Glowing Potion Liquid -->
    <path d="M 52 56 L 40 80 C 38 86, 44 92, 50 92 L 70 92 C 76 92, 82 86, 80 80 L 68 56 Z" fill="url(#tct_potion)" stroke="#22d3ee" stroke-width="2"/>
    <!-- Lightning Bolt On Bottle -->
    <polygon points="60,60 66,70 60,72 64,84 54,74 60,72" fill="#fde047" stroke="#ffffff" stroke-width="1"/>
  </svg>`,

  // Default / Fallback Reward Asset
  'reward_fallback': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="rf_bg" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#1e3a8a"/>
        <stop offset="60%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#020617"/>
      </radialGradient>
      <radialGradient id="rf_star" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="50%" stop-color="#fbbf24"/>
        <stop offset="100%" stop-color="#d97706"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#rf_bg)" stroke="#fbbf24" stroke-width="3.5"/>
    <ellipse cx="50" cy="24" rx="28" ry="12" fill="#ffffff" opacity="0.12"/>
    <circle cx="60" cy="60" r="32" fill="#38b6ff" stroke="#ffffff" stroke-width="2.5"/>
    <polygon points="60,34 67,48 82,50 71,61 74,76 60,68 46,76 49,61 38,50 53,48" fill="url(#rf_star)" stroke="#b45309" stroke-width="1.5"/>
  </svg>`
};

console.log('Writing SVG files to ' + OUT_DIR);
let count = 0;
for (const [key, svg] of Object.entries(REWARD_SVGS)) {
  const filePath = path.join(OUT_DIR, `${key}.svg`);
  fs.writeFileSync(filePath, svg.trim(), 'utf8');
  count++;
}
console.log(`Successfully generated ${count} SVG assets in ${OUT_DIR}!`);
