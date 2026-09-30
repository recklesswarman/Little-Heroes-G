/**
 * digitalRewardsCatalog.js
 * Curated High-Resolution Digital Rewards Catalog for Little Hero Adventures
 * Strictly adheres to the boy-focused palette (Electric Azure, Cosmic Cyan, Emerald Mint, Solar Amber, Heroic Crimson; 0 pink/purple).
 * 
 * Categories:
 * 1. Weapons (AR Toothbrush & Sugar Bug Battle tools)
 * 2. Avatar & Pet Gear (Equippable onto Head, Back, Chest, Paws)
 * 3. Badges & Trophies (Habit milestone artifacts granting persistent perks)
 * 4. Snacks & Pet Food (Consumable treats with single-use vs multi-use servings)
 */

export const REWARD_CATEGORIES = {
  WEAPONS: 'Weapons',
  GEAR: 'Avatar Gear',
  BADGES: 'Badges',
  SNACKS: 'Snacks'
};

export const STAT_BOOST_TYPES = [
  { id: 'damage_boost', label: 'AR Battle Damage', icon: 'swords', color: '#ef4444' },
  { id: 'defense_boost', label: 'Shield & Armor', icon: 'shield', color: '#10b981' },
  { id: 'coin_boost', label: 'Extra Habit Tokens', icon: 'monetization_on', color: '#f59e0b' },
  { id: 'xp_boost', label: 'Quest XP Multiplier', icon: 'star', color: '#06b6d4' },
  { id: 'speed_boost', label: 'Quest Speed Haste', icon: 'bolt', color: '#3b82f6' },
  { id: 'joy_boost', label: 'Companion Happiness', icon: 'favorite', color: '#10b981' },
  { id: 'energy_boost', label: 'Energy Restoration', icon: 'battery_charging_full', color: '#f59e0b' },
  { id: 'hygiene_boost', label: 'Cleanliness Recovery', icon: 'water_drop', color: '#06b6d4' }
];

export const DIGITAL_REWARDS_CATALOG = [
  // =========================================================================
  // 1. WEAPONS (AR Battle Tools)
  // =========================================================================
  {
    id: 'laser_toothbrush',
    name: 'Laser Toothbrush Sword',
    title: 'Laser Toothbrush Sword',
    desc: 'High-energy dental saber that vaporizes sugar bugs with minty laser slashes!',
    category: 'Weapons',
    subcategory: 'weapon',
    costCoins: 150,
    statBonusType: 'damage_boost',
    statBonusPercent: 35,
    statBonusLabel: '+35% Sugar Bug Damage',
    image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2694.png',
    renderGradient: 'from-cyan-900/60 via-slate-900 to-blue-950/80',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    splineUrl: 'https://my.spline.design/interactivecube-3d748f328f411b0e5272a832389d3c52/',
    voiceLine: "Roar! Equip your Laser Toothbrush Sword to blast away cavity monsters in 2 minutes flat!",
    isStarter: true
  },
  {
    id: 'sparkle_wand',
    name: 'Cosmic Starlight Blaster',
    title: 'Cosmic Starlight Blaster',
    desc: 'Radiates bursts of solar starlight to vaporize cavity bosses with intense solar beams.',
    category: 'Weapons',
    subcategory: 'weapon',
    costCoins: 280,
    statBonusType: 'damage_boost',
    statBonusPercent: 25,
    statBonusLabel: '+25% Solar Blast Damage',
    image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2728.png',
    renderGradient: 'from-amber-900/60 via-slate-900 to-yellow-950/80',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    voiceLine: "Zzap! The Starlight Blaster lights up the dark and vaporizes cavity bugs with solar blasts!"
  },
  {
    id: 'sonic_foam_cannon',
    name: 'Sonic Foam Cannon',
    title: 'Sonic Foam Cannon',
    desc: 'Launches hyper-sonic cleansing foam bubbles that immobilize plaque villains.',
    category: 'Weapons',
    subcategory: 'weapon',
    costCoins: 360,
    statBonusType: 'damage_boost',
    statBonusPercent: 45,
    statBonusLabel: '+45% Stun Damage',
    image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1fa99.png',
    renderGradient: 'from-emerald-900/60 via-slate-900 to-teal-950/80',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    voiceLine: "Whoosh! The Sonic Foam Cannon leaves tooth villains completely squeaky clean!"
  },
  {
    id: 'plasma_hydra_blade',
    name: 'Plasma Hydra Blade',
    title: 'Plasma Hydra Blade',
    desc: 'Forged from oceanic energy crystals, delivering swift three-hit combo strikes.',
    category: 'Weapons',
    subcategory: 'weapon',
    costCoins: 480,
    statBonusType: 'damage_boost',
    statBonusPercent: 55,
    statBonusLabel: '+55% Combo Damage',
    image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f5e1.png',
    renderGradient: 'from-blue-900/60 via-slate-900 to-cyan-950/80',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    voiceLine: "Unstoppable! The Plasma Hydra Blade unleashes triple-slice dino combos!"
  },
  {
    id: 'weapon_plasma_saber',
    name: 'Star-Plasma Saber',
    title: 'Star-Plasma Saber',
    desc: 'Crackling energy blade forged from pure starlight to defeat plaque titans in AR battles!',
    category: 'Weapons',
    subcategory: 'weapon',
    costCoins: 60,
    statBonusType: 'damage_boost',
    statBonusPercent: 25,
    statBonusLabel: '+25% AR Saber Damage',
    image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/26a1.png',
    renderGradient: 'from-cyan-900/60 via-slate-900 to-blue-950/80',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    splineUrl: 'https://prod.spline.design/J3y4v4k5l6m7n8o9/scene.splinecode',
    voiceLine: "Rex says: Strike true with the power of starlight, little hero!"
  },
  {
    id: 'weapon_hydro_blaster',
    name: 'Turbo Hydro Blaster',
    title: 'Turbo Hydro Blaster',
    desc: 'Rapid stream water blaster dissolving tartar villains in AR battles!',
    category: 'Weapons',
    subcategory: 'weapon',
    costCoins: 50,
    statBonusType: 'damage_boost',
    statBonusPercent: 20,
    statBonusLabel: '+20% Hydro Blast Damage',
    image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f52b.png',
    renderGradient: 'from-blue-900/60 via-slate-900 to-cyan-950/80',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/RobotExpressive.glb',
    splineUrl: 'https://prod.spline.design/qE2M7oP9a1b2c3d4/scene.splinecode',
    voiceLine: "Rex says: Clean blast engaged! Wash away that sugary tartar!"
  },

  // =========================================================================
  // 2. AVATAR & PET GEAR (Equippable Sockets)
  // =========================================================================
  {
    id: 'cowl_hero',
    name: 'Hero Guardian Cowl',
    title: 'Hero Guardian Cowl',
    desc: 'Aerodynamic hero mask with glowing night-vision goggles for bedtime adventures.',
    category: 'Avatar Gear',
    subcategory: 'head',
    targetPetSocket: 'head',
    costCoins: 120,
    statBonusType: 'defense_boost',
    statBonusPercent: 20,
    statBonusLabel: '+20% Defense & Focus',
    image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f97d.png',
    renderGradient: 'from-emerald-900/60 via-slate-900 to-slate-950',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    voiceLine: "Look sharp, Little Hero! That Guardian Cowl makes you look like a legendary superhero!",
    isStarter: true
  },
  {
    id: 'hero_cape',
    name: 'Cosmic Jet Glide Cape',
    title: 'Cosmic Jet Glide Cape',
    desc: 'Aerodynamic twin-tail flight cape with twin micro-thrusters for supersonic quests.',
    category: 'Avatar Gear',
    subcategory: 'back',
    targetPetSocket: 'back',
    costCoins: 220,
    statBonusType: 'speed_boost',
    statBonusPercent: 25,
    statBonusLabel: '+25% Quest Haste',
    image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f9b8.png',
    renderGradient: 'from-cyan-900/60 via-slate-900 to-slate-950',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    voiceLine: "Up, up, and away! With your Jet Glide Cape, no daily chore can slow us down!"
  },
  {
    id: 'golden_dragon_armor',
    name: 'Titan Dragon Scale Vest',
    title: 'Titan Dragon Scale Vest',
    desc: 'Forged from unbreakable golden scales providing maximum protection for pet companions.',
    category: 'Avatar Gear',
    subcategory: 'chest',
    targetPetSocket: 'chest',
    costCoins: 350,
    statBonusType: 'defense_boost',
    statBonusPercent: 40,
    statBonusLabel: '+40% Companion Armor',
    image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f6e1.png',
    renderGradient: 'from-amber-900/60 via-slate-900 to-slate-950',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    voiceLine: "Mighty scales! That Titan Dragon Armor makes your pet companion invincible in battle!"
  },
  {
    id: 'neon_stride_boots',
    name: 'Neon Hyper Stride Boots',
    title: 'Neon Hyper Stride Boots',
    desc: 'Spring-loaded magnetic hero boots for high jumping and lightning chore speed.',
    category: 'Avatar Gear',
    subcategory: 'feet',
    targetPetSocket: 'feet',
    costCoins: 190,
    statBonusType: 'speed_boost',
    statBonusPercent: 20,
    statBonusLabel: '+20% Speed & Agility',
    image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f97e.png',
    renderGradient: 'from-blue-900/60 via-slate-900 to-slate-950',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    voiceLine: "Spring into action! Neon Stride Boots let us dash through chores in record time!"
  },

  // =========================================================================
  // 3. BADGES & TROPHIES (Persistent Perks)
  // =========================================================================
  {
    id: 'mint_knight_badge',
    name: 'Mint Knight Battle Crest',
    title: 'Mint Knight Battle Crest',
    desc: 'Awarded to heroes who master morning and evening tooth brushing routines.',
    category: 'Badges',
    subcategory: 'trophy',
    costCoins: 90,
    statBonusType: 'hygiene_boost',
    statBonusPercent: 30,
    statBonusLabel: '+30% Habit Consistency',
    image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f3c6.png',
    renderGradient: 'from-emerald-900/60 via-slate-900 to-slate-950',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    voiceLine: "A badge of supreme honor! The Mint Knight Crest shines brightly in your Hero HQ!"
  },
  {
    id: 'rocket_speed_trophy',
    name: 'Starlight Orbit Trophy',
    title: 'Starlight Orbit Trophy',
    desc: 'Celebrates 5 consecutive days of timely bedtime and sleep routines.',
    category: 'Badges',
    subcategory: 'trophy',
    costCoins: 140,
    statBonusType: 'xp_boost',
    statBonusPercent: 20,
    statBonusLabel: '+20% Bedtime XP',
    image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f680.png',
    renderGradient: 'from-cyan-900/60 via-slate-900 to-slate-950',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    voiceLine: "Blasting into dreamland! This Starlight Trophy celebrates your awesome sleep habits!"
  },
  {
    id: 'golden_champion_cup',
    name: 'Grand Hero Champion Cup',
    title: 'Grand Hero Champion Cup',
    desc: 'Radiant golden trophy commemorating mastery across chores, hygiene, and learning.',
    category: 'Badges',
    subcategory: 'trophy',
    costCoins: 300,
    statBonusType: 'coin_boost',
    statBonusPercent: 30,
    statBonusLabel: '+30% Coin Multiplier',
    image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f947.png',
    renderGradient: 'from-amber-900/60 via-slate-900 to-slate-950',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    voiceLine: "Champions of the universe! Display this golden cup proudly on your HQ pedestal!"
  },

  // =========================================================================
  // 4. PET FOOD & TREATS (Consumable Servings Engine)
  // =========================================================================
  {
    id: 'flame_kibble_bowl',
    name: 'Crunchy Flame Kibble',
    title: 'Crunchy Flame Kibble',
    desc: 'Warm flame-roasted dino crunchies that replenish companion hunger and boost energy.',
    category: 'Snacks',
    subcategory: 'food',
    costCoins: 35,
    statBonusType: 'energy_boost',
    statBonusPercent: 30,
    statBonusLabel: '+30 Energy / Hunger',
    usageType: 'multi_use',
    servingsMax: 3,
    maxServings: 3,
    image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1fad9.png',
    renderGradient: 'from-amber-900/60 via-slate-900 to-slate-950',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    voiceLine: "Yum yum! Flame Kibble is full of crunchy power to keep our dinos roaring strong!"
  },
  {
    id: 'starlight_berry_pod',
    name: 'Starlight Solar Berries',
    title: 'Starlight Solar Berries',
    desc: 'Glow-in-the-dark juicy berries picked from celestial vines. Restores huge joy and happiness.',
    category: 'Snacks',
    subcategory: 'food',
    costCoins: 45,
    statBonusType: 'joy_boost',
    statBonusPercent: 40,
    statBonusLabel: '+40 Joy & Happiness',
    usageType: 'multi_use',
    servingsMax: 5,
    maxServings: 5,
    image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1fad0.png',
    renderGradient: 'from-blue-900/60 via-slate-900 to-slate-950',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    voiceLine: "So sweet and juicy! Your pet companion does happy backflips after eating Starlight Berries!"
  },
  {
    id: 'jungle_honey_comb',
    name: 'Wild Amber Honeycomb',
    title: 'Wild Amber Honeycomb',
    desc: 'Golden wild honey treat for a massive instant vitality boost.',
    category: 'Snacks',
    subcategory: 'food',
    costCoins: 25,
    statBonusType: 'energy_boost',
    statBonusPercent: 50,
    statBonusLabel: '+50 Instant Energy',
    usageType: 'single_use',
    servingsMax: 1,
    maxServings: 1,
    image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f36f.png',
    renderGradient: 'from-yellow-900/60 via-slate-900 to-slate-950',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    voiceLine: "Pure golden energy! One single taste gives your pet an instant super boost!"
  },
  {
    id: 'mega_bubble_soap',
    name: 'Oceanic Bubble Bath Soap',
    title: 'Oceanic Bubble Bath Soap',
    desc: 'Hypoallergenic sudsy soap for pet bath time that leaves coats sparkling and clean.',
    category: 'Snacks',
    subcategory: 'food',
    costCoins: 40,
    statBonusType: 'hygiene_boost',
    statBonusPercent: 45,
    statBonusLabel: '+45 Hygiene & Sparkle',
    usageType: 'multi_use',
    servingsMax: 4,
    maxServings: 4,
    image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1fae7.png',
    renderGradient: 'from-cyan-900/60 via-slate-900 to-slate-950',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    voiceLine: "Splish splash! Sudsy bubbles make bath time the most fun part of the day!"
  },
  {
    id: 'food_starberry_bites',
    name: 'Cosmic Starberry Bites',
    title: 'Cosmic Starberry Bites',
    desc: 'Juicy glowing cosmic berries giving huge companion energy and joy.',
    category: 'Snacks',
    subcategory: 'food',
    costCoins: 35,
    statBonusType: 'energy_boost',
    statBonusPercent: 35,
    statBonusLabel: '+35 Energy & Fullness',
    usageType: 'multi_use',
    servingsMax: 3,
    maxServings: 3,
    image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f353.png',
    renderGradient: 'from-blue-900/60 via-slate-900 to-slate-950',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    splineUrl: 'https://prod.spline.design/starberry/scene.splinecode',
    voiceLine: "Rex says: Starberries are super juicy and full of turbo energy!"
  }
];

export function getDigitalRewardById(id) {
  return DIGITAL_REWARDS_CATALOG.find(item => item.id === id) || null;
}

export function getAllRewardsByCategory(category) {
  return DIGITAL_REWARDS_CATALOG.filter(item => item.category === category);
}
