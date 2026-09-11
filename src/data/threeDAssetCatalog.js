/**
 * threeDAssetCatalog.js
 * Curated Kid-Safe 3D Asset Catalog for Little Hero Adventures
 * Supports GLB/GLTF models (rendered via <model-viewer> with WebXR AR)
 * and Spline 3D scenes (rendered via @splinetool/runtime or Spline iframe).
 */

export const THREE_D_CATEGORIES = {
  gear: {
    id: 'gear',
    name: 'Pet Wearable Gear',
    emoji: '👑',
    description: 'Heroic 3D wearables equipped to companion pets with active stat buffs.'
  },
  furniture: {
    id: 'furniture',
    name: 'Hero HQ Furniture',
    emoji: '🛋️',
    description: '3D furniture for the superhero hideout room granting Comfort XP & energy.'
  },
  toy: {
    id: 'toy',
    name: 'Pet Pen Interactive Toys',
    emoji: '🎾',
    description: 'Interactive 3D play objects refilling companion needs and Joy in the sanctuary.'
  },
  boss: {
    id: 'boss',
    name: 'AR Quest Bosses',
    emoji: '👾',
    description: 'Formidable 3D hygiene and chore boss monsters for AR battles.'
  }
};

export const THREE_D_ASSETS = [
  // --- GEAR (Pet Wearables) ---
  {
    id: 'gear_cyber_visor',
    category: 'gear',
    name: 'Cyber Sentinel Visor',
    emoji: '🥽',
    badge: '3D AR Visor',
    description: 'High-tech cybernetic HUD visor with glowing laser scanline optics.',
    format: 'glb',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    splineUrl: 'https://my.spline.design/nexbotrobotcharacterconcept-0e5a939f4d436155949d012435df1782/',
    poster: 'https://modelviewer.dev/shared-assets/models/Astronaut.webp',
    slot: 'head',
    archetype: 'visor',
    defaultStat: 'speed_boost',
    defaultMultiplier: 1.35,
    defaultPrice: 150,
    tags: ['cyber', 'future', 'robot', 'speed', 'goggles', 'visor'],
    defaultVoiceLine: "Beep boop! My cyber sensors detect awesome adventures ahead!"
  },
  {
    id: 'gear_phoenix_wings',
    category: 'gear',
    name: 'Phoenix Flame Glider Wings',
    emoji: '🔥',
    badge: '3D Glider',
    description: 'Aerodynamic solar-charged glider wings that trail blazing stardust.',
    format: 'glb',
    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DragonAttenuation/glTF-Binary/DragonAttenuation.glb',
    splineUrl: 'https://my.spline.design/interactivecubes-9975b36711585efad636c28bf16dbd7d/',
    slot: 'back',
    archetype: 'wings',
    defaultStat: 'xp_boost',
    defaultMultiplier: 1.40,
    defaultPrice: 200,
    tags: ['fire', 'wings', 'phoenix', 'dragon', 'glider', 'flight'],
    defaultVoiceLine: "FWOOSH! Spread your wings, hero, we're soaring to new heights!"
  },
  {
    id: 'gear_turbo_jetpack',
    category: 'gear',
    name: 'Twin-Turbo Rocket Jetpack',
    emoji: '🚀',
    badge: '3D Thruster',
    description: 'Dual titanium rocket boosters with animated exhaust flames.',
    format: 'glb',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/RobotExpressive.glb',
    splineUrl: 'https://my.spline.design/nexbotrobotcharacterconcept-0e5a939f4d436155949d012435df1782/',
    slot: 'back',
    archetype: 'jetpack',
    defaultStat: 'damage_boost',
    defaultMultiplier: 1.30,
    defaultPrice: 180,
    tags: ['rocket', 'jetpack', 'space', 'boost', 'turbo'],
    defaultVoiceLine: "3... 2... 1... BLAST OFF! Nothing can slow us down now!"
  },
  {
    id: 'gear_starlight_cloak',
    category: 'gear',
    name: 'Starlight Constellation Cloak',
    emoji: '✨',
    badge: '3D Cloth',
    description: 'Woven with threads of celestial stardust that flutter in the breeze.',
    format: 'glb',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/NeilArmstrong.glb',
    splineUrl: 'https://my.spline.design/interactivecubes-9975b36711585efad636c28bf16dbd7d/',
    slot: 'back',
    archetype: 'cape',
    defaultStat: 'coin_boost',
    defaultMultiplier: 1.45,
    defaultPrice: 220,
    tags: ['stars', 'cloak', 'cape', 'magic', 'constellation'],
    defaultVoiceLine: "The stars shine brighter whenever we help our family!"
  },

  // --- FURNITURE (Hero HQ) ---
  {
    id: 'furniture_star_pod_bed',
    category: 'furniture',
    name: 'Cosmic Pod Capsule Bed',
    emoji: '🛏️',
    badge: '3D Sleep Pod',
    description: 'A zero-gravity hyper-sleep bed with soft anti-grav pillows and starry glow.',
    format: 'glb',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    splineUrl: 'https://my.spline.design/roomrelaxingcopy-46ee388a10e6d6cbb1d3d63964dbfb9f/',
    furnType: 'bed',
    comfort: 45,
    defaultPrice: 250,
    tags: ['bed', 'sleep', 'rest', 'pod', 'capsule', 'space'],
    defaultVoiceLine: "Yaaawn... curl up right here, hero. You did so great today!"
  },
  {
    id: 'furniture_holo_desk',
    category: 'furniture',
    name: 'Hologram Mission Station',
    emoji: '💻',
    badge: '3D Workstation',
    description: 'Futuristic command console with glowing holographic radar displays.',
    format: 'glb',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/RobotExpressive.glb',
    splineUrl: 'https://my.spline.design/minihouseconcept-9a738bfd53ff9d5e7d56e9c968db7460/',
    furnType: 'desk',
    comfort: 35,
    defaultPrice: 190,
    tags: ['desk', 'computer', 'mission', 'tech', 'hologram'],
    defaultVoiceLine: "Mission logged! Checking off habits makes our superhero team unstoppable!"
  },
  {
    id: 'furniture_cloud_lounge',
    category: 'furniture',
    name: 'Marshmallow Cloud Sofa',
    emoji: '☁️',
    badge: '3D Sofa',
    description: 'Ultra-soft floating cloud sofa that gently contours to tired superhero paws.',
    format: 'glb',
    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/ToyCar/glTF-Binary/ToyCar.glb',
    splineUrl: 'https://my.spline.design/roomrelaxingcopy-46ee388a10e6d6cbb1d3d63964dbfb9f/',
    furnType: 'lounge',
    comfort: 40,
    defaultPrice: 210,
    tags: ['sofa', 'chair', 'lounge', 'cloud', 'relax', 'marshmallow'],
    defaultVoiceLine: "Ahhh, pure marshmallow comfort! Time to recharge our hero batteries!"
  },

  // --- TOYS (Pet Pen Sanctuary) ---
  {
    id: 'toy_gravity_trampoline',
    category: 'toy',
    name: 'Anti-Gravity Bounce Trampoline',
    emoji: '🤸',
    badge: '3D Bounce',
    description: 'Bounces companion pets high into the air with playful spark trails.',
    format: 'glb',
    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb',
    splineUrl: 'https://my.spline.design/interactivecubes-9975b36711585efad636c28bf16dbd7d/',
    statRefillTarget: 'joy',
    refillPotency: 50,
    sparkBonus: 25,
    tags: ['trampoline', 'bounce', 'jump', 'joy', 'fun'],
    defaultVoiceLine: "BOING! Wheee! I can almost touch the clouds from up here!"
  },
  {
    id: 'toy_dino_bone',
    category: 'toy',
    name: 'Golden T-Rex Power Bone',
    emoji: '🦴',
    badge: '3D Chew Toy',
    description: 'A hearty prehistoric treat that restores full energy and strength.',
    format: 'glb',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/shishkebab.glb',
    splineUrl: 'https://my.spline.design/interactivecubes-9975b36711585efad636c28bf16dbd7d/',
    statRefillTarget: 'fullness',
    refillPotency: 45,
    sparkBonus: 20,
    tags: ['bone', 'treat', 'food', 'snack', 'dino'],
    defaultVoiceLine: "CHOMP! Crunchy and delicious! My dino tummy is super happy!"
  },
  {
    id: 'toy_star_orb',
    category: 'toy',
    name: 'Magic Pulsing Star Orb',
    emoji: '🔮',
    badge: '3D Star Orb',
    description: 'Glows with celestial magic when rolled, rolling back playfully on command.',
    format: 'glb',
    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DragonAttenuation/glTF-Binary/DragonAttenuation.glb',
    splineUrl: 'https://my.spline.design/interactivecubes-9975b36711585efad636c28bf16dbd7d/',
    statRefillTarget: 'energy',
    refillPotency: 40,
    sparkBonus: 15,
    tags: ['orb', 'ball', 'magic', 'energy', 'roll'],
    defaultVoiceLine: "Look at it glow! Chasing this magic star fills me with pure energy!"
  },

  // --- BOSSES (AR Battles) ---
  {
    id: 'boss_plaque_dragon',
    category: 'boss',
    name: 'Lord Plaque the Cavity Dragon',
    emoji: '🐲',
    badge: '3D AR Boss',
    description: 'A fiery dragon coated in sugary plaque armor who fears foamy toothpaste.',
    format: 'glb',
    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DragonAttenuation/glTF-Binary/DragonAttenuation.glb',
    splineUrl: 'https://my.spline.design/nexbotrobotcharacterconcept-0e5a939f4d436155949d012435df1782/',
    domain: 'toothbrush',
    hp: 350,
    rewardCoins: 90,
    taunt: "Mwahaha! My sticky sugar scales will withstand any toothbrush!",
    rallyCall: "Grab your toothbrush sword! Bubble up and brush away the plaque!",
    tags: ['dragon', 'plaque', 'teeth', 'sugar', 'monster', 'boss']
  },
  {
    id: 'boss_cavity_golem',
    category: 'boss',
    name: 'Tartar Stone Golem',
    emoji: '🗿',
    badge: '3D AR Boss',
    description: 'An ancient giant made of hardened tartar rocks vulnerable to minty foam.',
    format: 'glb',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/RobotExpressive.glb',
    splineUrl: 'https://my.spline.design/interactivecubes-9975b36711585efad636c28bf16dbd7d/',
    domain: 'toothbrush',
    hp: 400,
    rewardCoins: 110,
    taunt: "I am unbreakable stone! No ordinary brush can crack my armor!",
    rallyCall: "Two minutes of steady circles will shatter this rocky tartar!",
    tags: ['golem', 'tartar', 'stone', 'teeth', 'rock', 'boss']
  },
  {
    id: 'boss_sugar_slime',
    category: 'boss',
    name: 'Queen Saccharine Slime',
    emoji: '🍯',
    badge: '3D AR Boss',
    description: 'A bubbly puddle of sweet syrup that dissolves with warm water and soap.',
    format: 'glb',
    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/ToyCar/glTF-Binary/ToyCar.glb',
    splineUrl: 'https://my.spline.design/interactivecubes-9975b36711585efad636c28bf16dbd7d/',
    domain: 'bath',
    hp: 280,
    rewardCoins: 75,
    taunt: "Everything will stick to my sweet sticky syrup puddle!",
    rallyCall: "Power up the bubble bath scrub! Wash away the sticky syrup!",
    tags: ['slime', 'sugar', 'bath', 'soap', 'clean', 'boss']
  }
];

/**
 * Get 3D assets filtered by category
 * @param {'gear'|'furniture'|'toy'|'boss'} category
 */
export function getThreeDAssetsByCategory(category) {
  if (!category) return THREE_D_ASSETS;
  return THREE_D_ASSETS.filter(a => a.category === category);
}

/**
 * Find 3D asset by ID
 * @param {string} id
 */
export function getThreeDAssetById(id) {
  return THREE_D_ASSETS.find(a => a.id === id) || null;
}

/**
 * Smart Search: Finds the best matching 3D asset from a user concept string
 * @param {string} prompt
 * @param {'gear'|'furniture'|'toy'|'boss'} category
 */
export function matchBestThreeDAsset(prompt = '', category = 'gear') {
  const pool = getThreeDAssetsByCategory(category);
  if (!pool.length) return null;
  const p = (prompt || '').toLowerCase();

  let best = pool[0];
  let maxScore = -1;

  for (const asset of pool) {
    let score = 0;
    if (p.includes(asset.name.toLowerCase())) score += 10;
    if (p.includes((asset.archetype || asset.furnType || asset.domain || '').toLowerCase())) score += 5;
    for (const tag of asset.tags || []) {
      if (p.includes(tag)) score += 3;
    }
    if (score > maxScore) {
      maxScore = score;
      best = asset;
    }
  }

  return best;
}
