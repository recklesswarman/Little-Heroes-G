/**
 * rewardGraphics.js
 * Centralized Visual Asset Resolver & Fallback Component for Hero Shop Digital Rewards.
 * 
 * Rules:
 * - 100% kid-friendly, high-contrast, tactile 3D designer toy aesthetics.
 * - Adheres strictly to the boy-friendly palette: Cyan, Azure, Mint, Amber, Crimson (0 pink/purple).
 * - Guarantees zero "undefined" or broken image tags.
 */

import { escapeHtml } from './escapeHtml.js';

export const REWARD_ASSET_BASE_PATH = '/assets/rewards';

export const REWARD_ASSET_MAP = {
  // Weapons
  laser_toothbrush: `${REWARD_ASSET_BASE_PATH}/laser_toothbrush.svg`,
  sparkle_wand: `${REWARD_ASSET_BASE_PATH}/sparkle_wand.svg`,
  sonic_foam_cannon: `${REWARD_ASSET_BASE_PATH}/sonic_foam_cannon.svg`,
  plasma_hydra_blade: `${REWARD_ASSET_BASE_PATH}/plasma_hydra_blade.svg`,
  weapon_plasma_saber: `${REWARD_ASSET_BASE_PATH}/weapon_plasma_saber.svg`,
  weapon_hydro_blaster: `${REWARD_ASSET_BASE_PATH}/weapon_hydro_blaster.svg`,
  comet_tail_whip: `${REWARD_ASSET_BASE_PATH}/comet_tail_whip.svg`,
  storm_trident_lance: `${REWARD_ASSET_BASE_PATH}/storm_trident_lance.svg`,

  // Avatar Gear
  cowl_hero: `${REWARD_ASSET_BASE_PATH}/cowl_hero.svg`,
  hero_cape: `${REWARD_ASSET_BASE_PATH}/hero_cape.svg`,
  golden_dragon_armor: `${REWARD_ASSET_BASE_PATH}/golden_dragon_armor.svg`,
  neon_stride_boots: `${REWARD_ASSET_BASE_PATH}/neon_stride_boots.svg`,
  ember_ridge_helm: `${REWARD_ASSET_BASE_PATH}/ember_ridge_helm.svg`,
  phoenix_ember_wings: `${REWARD_ASSET_BASE_PATH}/phoenix_ember_wings.svg`,

  // Pet Gear
  crown_golden_horn: `${REWARD_ASSET_BASE_PATH}/crown_golden_horn.svg`,
  goggles_aviator: `${REWARD_ASSET_BASE_PATH}/goggles_aviator.svg`,
  tiara_phoenix: `${REWARD_ASSET_BASE_PATH}/tiara_phoenix.svg`,
  cape_shadow_wing: `${REWARD_ASSET_BASE_PATH}/cape_shadow_wing.svg`,
  cape_meteor_blaze: `${REWARD_ASSET_BASE_PATH}/cape_meteor_blaze.svg`,
  armor_obsidian_plate: `${REWARD_ASSET_BASE_PATH}/armor_obsidian_plate.svg`,
  boots_rocket_jump: `${REWARD_ASSET_BASE_PATH}/boots_rocket_jump.svg`,

  // Accessories
  wizard_hat: `${REWARD_ASSET_BASE_PATH}/wizard_hat.svg`,
  scout_headband: `${REWARD_ASSET_BASE_PATH}/scout_headband.svg`,
  astro_belt: `${REWARD_ASSET_BASE_PATH}/astro_belt.svg`,
  cosmic_compass: `${REWARD_ASSET_BASE_PATH}/cosmic_compass.svg`,

  // Badges
  mint_knight_badge: `${REWARD_ASSET_BASE_PATH}/mint_knight_badge.svg`,
  emerald_streak_medal: `${REWARD_ASSET_BASE_PATH}/emerald_streak_medal.svg`,
  cosmic_explorer_badge: `${REWARD_ASSET_BASE_PATH}/cosmic_explorer_badge.svg`,
  rocket_badge: `${REWARD_ASSET_BASE_PATH}/rocket_badge.svg`,
  bedtime_bravery_badge: `${REWARD_ASSET_BASE_PATH}/bedtime_bravery_badge.svg`,

  // Trophies
  star_trophy: `${REWARD_ASSET_BASE_PATH}/star_trophy.svg`,
  golden_champion_cup: `${REWARD_ASSET_BASE_PATH}/golden_champion_cup.svg`,
  rocket_speed_trophy: `${REWARD_ASSET_BASE_PATH}/rocket_speed_trophy.svg`,
  trophy_sugarfang: `${REWARD_ASSET_BASE_PATH}/trophy_sugarfang.svg`,
  trophy_plaque_phantom: `${REWARD_ASSET_BASE_PATH}/trophy_plaque_phantom.svg`,
  trophy_sugar_bandit: `${REWARD_ASSET_BASE_PATH}/trophy_sugar_bandit.svg`,

  // Stickers
  starlight_dino: `${REWARD_ASSET_BASE_PATH}/starlight_dino.svg`,
  cosmic_rocket: `${REWARD_ASSET_BASE_PATH}/cosmic_rocket.svg`,
  solar_ember_sticker: `${REWARD_ASSET_BASE_PATH}/solar_ember_sticker.svg`,
  aqua_bubble_sticker: `${REWARD_ASSET_BASE_PATH}/aqua_bubble_sticker.svg`,

  // Loot
  gem_trove: `${REWARD_ASSET_BASE_PATH}/gem_trove.svg`,
  star_crystal_crate: `${REWARD_ASSET_BASE_PATH}/star_crystal_crate.svg`,
  golden_dino_relic: `${REWARD_ASSET_BASE_PATH}/golden_dino_relic.svg`,
  radiant_energy_orb: `${REWARD_ASSET_BASE_PATH}/radiant_energy_orb.svg`,

  // Snacks & Pet Food
  flame_kibble_bowl: `${REWARD_ASSET_BASE_PATH}/flame_kibble_bowl.svg`,
  starlight_berry_pod: `${REWARD_ASSET_BASE_PATH}/starlight_berry_pod.svg`,
  jungle_honey_comb: `${REWARD_ASSET_BASE_PATH}/jungle_honey_comb.svg`,
  mega_bubble_soap: `${REWARD_ASSET_BASE_PATH}/mega_bubble_soap.svg`,
  food_starberry_bites: `${REWARD_ASSET_BASE_PATH}/food_starberry_bites.svg`,
  glowing_moon_melon: `${REWARD_ASSET_BASE_PATH}/glowing_moon_melon.svg`,
  thunderclap_tonic: `${REWARD_ASSET_BASE_PATH}/thunderclap_tonic.svg`,

  // Default fallback
  reward_fallback: `${REWARD_ASSET_BASE_PATH}/reward_fallback.svg`
};

export const DEFAULT_FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%"><defs><radialGradient id="df_bg" cx="35%" cy="30%" r="70%"><stop offset="0%" stop-color="#1e3a8a"/><stop offset="60%" stop-color="#0f172a"/><stop offset="100%" stop-color="#020617"/></radialGradient><radialGradient id="df_star" cx="35%" cy="35%" r="65%"><stop offset="0%" stop-color="#ffffff"/><stop offset="50%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#d97706"/></radialGradient></defs><circle cx="60" cy="60" r="54" fill="url(#df_bg)" stroke="#fbbf24" stroke-width="3.5"/><circle cx="60" cy="60" r="32" fill="#38b6ff" stroke="#ffffff" stroke-width="2.5"/><polygon points="60,34 67,48 82,50 71,61 74,76 60,68 46,76 49,61 38,50 53,48" fill="url(#df_star)" stroke="#b45309" stroke-width="1.5"/></svg>`;

export const DEFAULT_FALLBACK_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(DEFAULT_FALLBACK_SVG)}`;

/**
 * Resolves a verified, guaranteed asset URL for any item.
 * Never returns undefined or broken URL.
 */
export function getRewardAssetUrl(itemId, category = '') {
  if (!itemId) return REWARD_ASSET_MAP.reward_fallback;

  // Direct mapping
  if (REWARD_ASSET_MAP[itemId]) {
    return REWARD_ASSET_MAP[itemId];
  }

  // Category fallback guesses
  const cat = (category || '').toLowerCase();
  if (cat.includes('weapon')) return REWARD_ASSET_MAP.laser_toothbrush;
  if (cat.includes('snack') || cat.includes('food')) return REWARD_ASSET_MAP.food_starberry_bites;
  if (cat.includes('badge')) return REWARD_ASSET_MAP.mint_knight_badge;
  if (cat.includes('trophy')) return REWARD_ASSET_MAP.golden_champion_cup;
  if (cat.includes('gear')) return REWARD_ASSET_MAP.cowl_hero;
  if (cat.includes('sticker')) return REWARD_ASSET_MAP.starlight_dino;
  if (cat.includes('loot')) return REWARD_ASSET_MAP.gem_trove;

  return REWARD_ASSET_MAP.reward_fallback;
}

/**
 * Renders a guaranteed safe HTML image tag with automatic fallback.
 * Strictly prevents "undefined" or broken image icons from ever displaying.
 */
export function renderRewardImage(item = {}, classNames = 'w-full h-full object-contain', altText = '') {
  const safeItem = item || {};
  const title = safeItem.name || safeItem.title || altText || 'Digital Reward';
  const rawUrl = safeItem.assetUrl || safeItem.image || (safeItem.id ? getRewardAssetUrl(safeItem.id, safeItem.category) : '');
  
  // Guard against string literal "undefined" or missing values
  let safeSrc = rawUrl;
  if (!safeSrc || safeSrc === 'undefined' || safeSrc === 'null') {
    safeSrc = safeItem.id ? getRewardAssetUrl(safeItem.id, safeItem.category) : REWARD_ASSET_MAP.reward_fallback;
  }

  const safeAlt = escapeHtml(title);
  const fallback = DEFAULT_FALLBACK_DATA_URI;

  return `<img class="${classNames}" src="${safeSrc}" alt="${safeAlt}" loading="lazy" onerror="if(this.src!=='${fallback}'){this.onerror=null;this.src='${fallback}';}" />`;
}

/**
 * Color-coded tactical rarity border styles.
 */
export function getRewardRarityBorderClass(rarity = 'common', isEquipped = false) {
  if (isEquipped) {
    return 'border-primary shadow-[0_0_20px_rgba(46,204,113,0.45)] ring-2 ring-primary/40';
  }

  switch ((rarity || 'common').toLowerCase()) {
    case 'legendary':
      return 'border-amber-400 hover:border-yellow-300 shadow-[0_0_22px_rgba(245,158,11,0.35)]';
    case 'epic':
      return 'border-emerald-500/70 hover:border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.3)]';
    case 'rare':
      return 'border-blue-500/60 hover:border-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.25)]';
    case 'common':
    default:
      return 'border-cyan-500/40 hover:border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]';
  }
}

/**
 * Glowing rarity pill tag for item card corners.
 */
export function getRewardRarityBadge(rarity = 'common') {
  const norm = (rarity || 'common').toLowerCase();
  switch (norm) {
    case 'legendary':
      return `<span class="px-2 py-0.5 rounded-full text-[9px] font-headline font-black uppercase bg-amber-400/20 text-amber-300 border border-amber-400/60 shadow-[0_0_8px_rgba(245,158,11,0.4)] flex items-center gap-1">⭐ Legendary</span>`;
    case 'epic':
      return `<span class="px-2 py-0.5 rounded-full text-[9px] font-headline font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/60 shadow-[0_0_8px_rgba(16,185,129,0.3)] flex items-center gap-1">✨ Epic</span>`;
    case 'rare':
      return `<span class="px-2 py-0.5 rounded-full text-[9px] font-headline font-black uppercase bg-blue-500/20 text-blue-300 border border-blue-400/60 shadow-[0_0_8px_rgba(59,130,246,0.3)] flex items-center gap-1">🔷 Rare</span>`;
    case 'common':
    default:
      return `<span class="px-2 py-0.5 rounded-full text-[9px] font-headline font-black uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-400/50 flex items-center gap-1">Common</span>`;
  }
}
