/**
 * heroForgeData.js
 * 
 * Level-Gated Blueprint Tree & 3D Tinkering Lab Catalog
 * Categories: Helmets, Wings, Boots, Shields
 */

export const FORGE_CATEGORIES = [
  { id: 'helmets', label: 'Helmets', icon: 'military_tech', slot: 'head' },
  { id: 'wings', label: 'Wings & Gliders', icon: 'flight', slot: 'back' },
  { id: 'boots', label: 'Boots', icon: 'hiking', slot: 'feet' },
  { id: 'shields', label: 'Shields', icon: 'shield', slot: 'chest' }
];

export const FORGE_BLUEPRINTS = [
  // --- HELMETS (Head Slot - Habit Coin Multipliers) ---
  {
    id: 'bp_scout_goggles',
    category: 'helmets',
    slot: 'head',
    title: 'Scout Aviator Goggles',
    desc: 'Brass adventure goggles with zoom lenses for spotting shiny coins!',
    icon: 'visibility',
    requiredLevel: 1,
    requiredStreak: 0,
    costTokens: 30,
    buffType: 'coin_boost',
    buffValue: 15,
    buffDesc: '+15% Habit Coin Multiplier',
    meshType: 'goggles',
    defaultDyes: { primary: '#e89300', accent: '#f1c40f', glow: '#54e98a' },
    hqTrophy: false
  },
  {
    id: 'bp_titan_cowl',
    category: 'helmets',
    slot: 'head',
    title: 'Titan Energy Cowl',
    desc: 'Heavy alloy horned cowl with emerald visor plate for master focus.',
    icon: 'sports_kabaddi',
    requiredLevel: 3,
    requiredStreak: 3,
    costTokens: 60,
    buffType: 'coin_boost',
    buffValue: 25,
    buffDesc: '+25% Habit Coin Multiplier',
    meshType: 'cowl',
    defaultDyes: { primary: '#2ecc71', accent: '#1b7a43', glow: '#00d2d3' },
    hqTrophy: false
  },
  {
    id: 'bp_astro_dragon_helm',
    category: 'helmets',
    slot: 'head',
    title: 'Astro Dragon Helm',
    desc: 'Legendary cyber-dragon crest crowned with glowing star crystals!',
    icon: 'crown',
    requiredLevel: 5,
    requiredStreak: 5,
    costTokens: 110,
    buffType: 'coin_boost',
    buffValue: 35,
    buffDesc: '+35% Habit Coin Boost & Golden Shine',
    meshType: 'crown',
    defaultDyes: { primary: '#f1c40f', accent: '#e89300', glow: '#54e98a' },
    hqTrophy: true
  },

  // --- WINGS & GLIDERS (Back Slot - 3D Expedition Speed & Starlight Fuel) ---
  {
    id: 'bp_sparrow_glider',
    category: 'wings',
    slot: 'back',
    title: 'Sparrow Sky Glider',
    desc: 'Lightweight aerodynamic glider wings for gentle, breezy cruising.',
    icon: 'air',
    requiredLevel: 1,
    requiredStreak: 0,
    costTokens: 35,
    buffType: 'expedition_speed',
    buffValue: 15,
    buffDesc: '+15% 3D Cruise Speed',
    meshType: 'glider',
    defaultDyes: { primary: '#3498db', accent: '#00d2d3', glow: '#54e98a' },
    hqTrophy: false
  },
  {
    id: 'bp_cyber_jetpack',
    category: 'wings',
    slot: 'back',
    title: 'Cyber Rocket Jetpack',
    desc: 'Twin rocket thrusters powered by glowing cyan starlight batteries.',
    icon: 'rocket',
    requiredLevel: 3,
    requiredStreak: 3,
    costTokens: 65,
    buffType: 'expedition_speed',
    buffValue: 25,
    buffDesc: '+25% Cruise Speed & Fuel Efficiency',
    meshType: 'jetpack',
    defaultDyes: { primary: '#09141e', accent: '#f39c12', glow: '#00d2d3' },
    hqTrophy: false
  },
  {
    id: 'bp_solar_phoenix_wings',
    category: 'wings',
    slot: 'back',
    title: 'Solar Phoenix Wings',
    desc: 'Blazing mechanical wings radiating eternal starlight particles!',
    icon: 'flutter',
    requiredLevel: 6,
    requiredStreak: 7,
    costTokens: 125,
    buffType: 'expedition_speed',
    buffValue: 40,
    buffDesc: '+40% Expedition Speed & Hyper Glider Jet',
    meshType: 'wings',
    defaultDyes: { primary: '#f39c12', accent: '#f1c40f', glow: '#54e98a' },
    hqTrophy: true
  },

  // --- BOOTS (Feet Slot - Learning Mini-Game XP Multipliers) ---
  {
    id: 'bp_spring_hoppers',
    category: 'boots',
    slot: 'feet',
    title: 'Springy Grass Hoppers',
    desc: 'Coiled spring boots that add extra bounce and quick thinking.',
    icon: 'expand_less',
    requiredLevel: 2,
    requiredStreak: 0,
    costTokens: 40,
    buffType: 'xp_boost',
    buffValue: 15,
    buffDesc: '+15% Learning Game XP',
    meshType: 'boots',
    defaultDyes: { primary: '#2ecc71', accent: '#f1c40f', glow: '#00d2d3' },
    hqTrophy: false
  },
  {
    id: 'bp_neon_dashers',
    category: 'boots',
    slot: 'feet',
    title: 'Neon Hyper Dashers',
    desc: 'Sleek rocket sneakers with illuminated neon tread for lightning reflexes.',
    icon: 'directions_run',
    requiredLevel: 4,
    requiredStreak: 4,
    costTokens: 75,
    buffType: 'xp_boost',
    buffValue: 25,
    buffDesc: '+25% Learning Game XP Boost',
    meshType: 'boots',
    defaultDyes: { primary: '#00d2d3', accent: '#3498db', glow: '#54e98a' },
    hqTrophy: false
  },
  {
    id: 'bp_quantum_striders',
    category: 'boots',
    slot: 'feet',
    title: 'Quantum Striders',
    desc: 'Zero-gravity anti-grav boots that walk on cosmic starlight.',
    icon: 'sprint',
    requiredLevel: 5,
    requiredStreak: 6,
    costTokens: 115,
    buffType: 'xp_boost',
    buffValue: 35,
    buffDesc: '+35% Learning XP & Double Star Bonus',
    meshType: 'boots',
    defaultDyes: { primary: '#09141e', accent: '#00d2d3', glow: '#f39c12' },
    hqTrophy: true
  },

  // --- SHIELDS & GADGETS (Chest Slot - Boss Battle Damage Deflection) ---
  {
    id: 'bp_bubble_deflector',
    category: 'shields',
    slot: 'chest',
    title: 'Bubble Foam Deflector',
    desc: 'Pressurized bubble generator that deflects sugar splats in boss battles.',
    icon: 'shield_moon',
    requiredLevel: 2,
    requiredStreak: 0,
    costTokens: 40,
    buffType: 'shield_deflect',
    buffValue: 20,
    buffDesc: '+20% Boss Battle Shield Deflect',
    meshType: 'shield',
    defaultDyes: { primary: '#00d2d3', accent: '#3498db', glow: '#54e98a' },
    hqTrophy: false
  },
  {
    id: 'bp_aegis_of_valor',
    category: 'shields',
    slot: 'chest',
    title: 'Aegis of Valor Crest',
    desc: 'Heavy-duty knight crest with dynamic forcefield repelling plaque monsters.',
    icon: 'security',
    requiredLevel: 4,
    requiredStreak: 4,
    costTokens: 80,
    buffType: 'shield_deflect',
    buffValue: 35,
    buffDesc: '+35% Boss Shield & Faster Cadence',
    meshType: 'shield',
    defaultDyes: { primary: '#2ecc71', accent: '#e89300', glow: '#f1c40f' },
    hqTrophy: false
  },
  {
    id: 'bp_cosmic_starlight_aegis',
    category: 'shields',
    slot: 'chest',
    title: 'Cosmic Starlight Aegis',
    desc: 'Legendary celestial shield reflecting pure sunshine into dark caverns.',
    icon: 'local_police',
    requiredLevel: 7,
    requiredStreak: 7,
    costTokens: 140,
    buffType: 'shield_deflect',
    buffValue: 50,
    buffDesc: '+50% Boss Shield & Invincibility Stride',
    meshType: 'shield',
    defaultDyes: { primary: '#f1c40f', accent: '#f39c12', glow: '#00d2d3' },
    hqTrophy: true
  }
];

export function getBlueprintsByCategory(category) {
  return FORGE_BLUEPRINTS.filter(b => b.category === category);
}

export function getBlueprintById(id) {
  return FORGE_BLUEPRINTS.find(b => b.id === id) || FORGE_BLUEPRINTS[0];
}

export function isBlueprintUnlocked(blueprint, heroLevel = 1, heroStreak = 1) {
  if (!blueprint) return false;
  return heroLevel >= blueprint.requiredLevel && heroStreak >= (blueprint.requiredStreak || 0);
}
