/**
 * threeDAssetCatalog.js
 * Curated Kid-Safe 3D Asset Catalog for Little Hero Adventures
 * Supports GLB/GLTF models (rendered via <model-viewer> with WebXR AR)
 * and Spline 3D scenes (rendered via @splinetool/runtime or Spline iframe).
 */

import { resolvePublicAssetUrl } from '../utils/assetUrl.js';

// Real, themed models (CC0). Files live in public/models/<pack>/<name>.glb with a 256 px picture in
// public/assets/rewards/seed/models/. Credits are listed in public/models/LICENSES.md and Settings > Credits.
const model = (path) => resolvePublicAssetUrl(`models/${path}.glb`);
const thumb = (path) => resolvePublicAssetUrl(`assets/rewards/seed/models/${path}.webp`);
const KENNEY = { author: 'Kenney', license: 'CC0', sourceUrl: 'https://kenney.nl' };
const QUATERNIUS = { author: 'Quaternius', license: 'CC0', sourceUrl: 'https://quaternius.com' };
const ANIM = { idle: 'Idle', walk: 'Walk', cheer: 'Jump' };
const FLY = { idle: 'Flying_Idle', cheer: 'Flying_Idle' };
const FLY_PLAIN = { idle: 'Flying', cheer: 'Flying' }; // the Cute Monsters dragon only has a plain Flying loop

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
  pet: {
    id: 'pet',
    name: '3D Pet Companions',
    emoji: '🐾',
    description: 'Living 3D companion creatures with habit bonding, gear attachments, and starlight evolution.'
  },
  boss: {
    id: 'boss',
    name: 'AR Quest Bosses',
    emoji: '👾',
    description: 'Formidable 3D hygiene and chore boss monsters for AR battles.'
  },
  weapon: {
    id: 'weapon',
    name: 'AR Battle Weapons',
    emoji: '⚔️',
    description: 'Heroic combat blasters, sabers & hammers equipped for AR boss battles.'
  },
  food: {
    id: 'food',
    name: 'Pet Treats & Snacks',
    emoji: '🍎',
    description: 'Consumable nutrient bites refilling companion fullness, energy and joy.'
  }
};

export const THREE_D_ASSETS = [
  // --- WEAPONS (AR Combat Weapons) ---
  {
    id: 'weapon_plasma_saber',
    category: 'weapon',
    name: 'Star-Plasma Saber',
    emoji: '⚡',
    badge: 'AR Saber',
    description: 'Crackling energy blade forged from pure starlight to defeat plaque titans!',
    format: 'glb',
    modelUrl: model('quaternius/cubeworld/Sword_Diamond'),
    thumbnail: thumb('quaternius/cubeworld/Sword_Diamond'),
    credit: QUATERNIUS,
    defaultStat: 'damage_boost',
    defaultMultiplier: 1.25,
    defaultPrice: 60,
    tags: ['sword', 'saber', 'blade', 'laser', 'plasma', 'weapon'],
    defaultVoiceLine: "Rex says: Strike true with the power of starlight, little hero!"
  },
  {
    id: 'weapon_hydro_blaster',
    category: 'weapon',
    name: 'Turbo Hydro Blaster',
    emoji: '🔫',
    badge: 'AR Blaster',
    description: 'Rapid stream water blaster dissolving tartar villains in AR battles!',
    format: 'glb',
    modelUrl: model('kenney/blasters/blaster-b'),
    thumbnail: thumb('kenney/blasters/blaster-b'),
    credit: KENNEY,
    defaultStat: 'damage_boost',
    defaultMultiplier: 1.20,
    defaultPrice: 50,
    tags: ['blaster', 'water', 'hydro', 'cannon', 'gun', 'weapon'],
    defaultVoiceLine: "Rex says: Clean blast engaged! Wash away that sugary tartar!"
  },
  {
    id: 'weapon_meteor_hammer',
    category: 'weapon',
    name: 'Meteor Shockwave Hammer',
    emoji: '🔨',
    badge: 'AR Hammer',
    description: 'Heavy kinetic smasher that sends tooth decay gremlins flying!',
    format: 'glb',
    modelUrl: model('quaternius/cubeworld/Sword_Gold'),
    thumbnail: thumb('quaternius/cubeworld/Sword_Gold'),
    credit: QUATERNIUS,
    defaultStat: 'damage_boost',
    defaultMultiplier: 1.30,
    defaultPrice: 75,
    tags: ['hammer', 'smasher', 'meteor', 'shockwave', 'weapon'],
    defaultVoiceLine: "Rex says: Boom! Big hammer smash defeats the sugar bugs!"
  },
  // --- FOOD (Pet Treats & Snacks) ---
  {
    id: 'food_stardust_apple',
    category: 'food',
    name: 'Stardust Golden Apple',
    emoji: '🍎',
    badge: 'Crisp Fruit',
    description: 'Sun-ripened crunchy golden apple infused with orchard starlight vitamins.',
    format: 'glb',
    modelUrl: model('kenney/food/apple'),
    thumbnail: thumb('kenney/food/apple'),
    credit: KENNEY,
    defaultStat: 'hunger',
    defaultMultiplier: 1.25,
    defaultPrice: 20,
    tags: ['apple', 'fruit', 'snack', 'food', 'healthy', 'orchard'],
    defaultVoiceLine: "Rex says: Crunch crunch! Sweet and healthy for big hero energy!"
  },
  {
    id: 'food_jungle_honeycomb',
    category: 'food',
    name: 'Wild Jungle Honeycomb',
    emoji: '🍯',
    badge: 'Golden Treat',
    description: 'Golden honeycomb clusters dripping with sweet wildflower nectar.',
    format: 'glb',
    modelUrl: model('kenney/food/pineapple'),
    thumbnail: thumb('kenney/food/pineapple'),
    credit: KENNEY,
    defaultStat: 'joy',
    defaultMultiplier: 1.20,
    defaultPrice: 25,
    tags: ['honey', 'comb', 'sweet', 'treat', 'snack', 'jungle'],
    defaultVoiceLine: "Rex says: Mmm, so sweet! Pet joy levels are reaching the stars!"
  },
  {
    id: 'food_starberry_bites',
    category: 'food',
    name: 'Cosmic Starberry Bites',
    title: 'Cosmic Starberry Bites',
    emoji: '🍓',
    badge: 'Sweet Fruit',
    description: 'Juicy glowing cosmic berries giving huge companion energy and joy.',
    format: 'glb',
    modelUrl: model('kenney/food/strawberry'),
    thumbnail: thumb('kenney/food/strawberry'),
    credit: KENNEY,
    defaultStat: 'hunger',
    defaultMultiplier: 1.25,
    defaultPrice: 35,
    costCoins: 35,
    usageType: 'multi_use',
    maxServings: 3,
    servingsMax: 3,
    tags: ['berry', 'starberry', 'fruit', 'snack', 'food', 'cosmic'],
    defaultVoiceLine: "Rex says: Starberries are super juicy and full of turbo energy!"
  },
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
    modelUrl: model('kenney/furniture/bedBunk'),
    thumbnail: thumb('kenney/furniture/bedBunk'),
    credit: KENNEY,
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
    modelUrl: model('kenney/furniture/desk'),
    thumbnail: thumb('kenney/furniture/desk'),
    credit: KENNEY,
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
    modelUrl: model('kenney/furniture/loungeChairRelax'),
    thumbnail: thumb('kenney/furniture/loungeChairRelax'),
    credit: KENNEY,
    furnType: 'lounge',
    comfort: 40,
    defaultPrice: 210,
    tags: ['sofa', 'chair', 'lounge', 'cloud', 'relax', 'marshmallow'],
    defaultVoiceLine: "Ahhh, pure marshmallow comfort! Time to recharge our hero batteries!"
  },

  // --- TOYS (Pet Pen Sanctuary) ---

  // --- BOSSES (AR Battles) ---
  {
    id: 'boss_plaque_dragon',
    category: 'boss',
    name: 'Lord Plaque the Cavity Dragon',
    emoji: '🐲',
    badge: '3D AR Boss',
    description: 'A fiery dragon coated in sugary plaque armor who fears foamy toothpaste.',
    format: 'glb',
    modelUrl: model('quaternius/cute-monsters/YellowDragon'),
    thumbnail: thumb('quaternius/cute-monsters/YellowDragon'),
    credit: QUATERNIUS,
    animations: FLY_PLAIN,
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
    modelUrl: model('quaternius/monsters/Goleling'),
    thumbnail: thumb('quaternius/monsters/Goleling'),
    credit: QUATERNIUS,
    animations: FLY,
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
    modelUrl: model('quaternius/monsters/GreenSpikyBlob'),
    thumbnail: thumb('quaternius/monsters/GreenSpikyBlob'),
    credit: QUATERNIUS,
    animations: ANIM,
    domain: 'bath',
    hp: 280,
    rewardCoins: 75,
    taunt: "Everything will stick to my sweet sticky syrup puddle!",
    rallyCall: "Power up the bubble bath scrub! Wash away the sticky syrup!",
    tags: ['slime', 'sugar', 'bath', 'soap', 'clean', 'boss']
  },

  // --- 3D PET COMPANIONS (6 Archetypes) ---
  {
    id: 'pet_rex_dino',
    category: 'pet',
    name: 'Rex the Earth Dino',
    emoji: '🦖',
    badge: '3D Dino Companion',
    description: 'Chunky emerald prehistoric dino who stomps through chores and protects teeth enamel.',
    format: 'glb',
    modelUrl: model('quaternius/monsters/Dino'),
    thumbnail: thumb('quaternius/monsters/Dino'),
    credit: QUATERNIUS,
    animations: ANIM,
    archetype: 'dino',
    primaryColor: '#2ecc71',
    accentColor: '#f39c12',
    bellyColor: '#6bfe9c',
    assignedHabit: 'clean_toys',
    habitBonusDesc: '+25% Toy Cleaning Coins & +20% Colosseum Assist Damage',
    tags: ['dino', 'rex', 'earth', 'green', 'clean', 'loyal'],
    defaultVoiceLine: "ROAR! Let's stomp some chores and keep our smile sparkling clean!"
  },
  {
    id: 'pet_sparky_dragon',
    category: 'pet',
    name: 'Sparky the Azure Dragon',
    emoji: '🐉',
    badge: '3D Dragon Companion',
    description: 'Playful sky dragon who loves soaring loops, active sports, and fire sneezes.',
    format: 'glb',
    modelUrl: model('quaternius/monsters/Dragon'),
    thumbnail: thumb('quaternius/monsters/Dragon'),
    credit: QUATERNIUS,
    animations: FLY,
    archetype: 'dragon',
    primaryColor: '#00d2d3',
    accentColor: '#ffb961',
    bellyColor: '#cce5ff',
    assignedHabit: 'active_play',
    habitBonusDesc: '+25% Active Play Coins & +25% 3D Expedition Speed',
    tags: ['dragon', 'fire', 'azure', 'flying', 'sports', 'speed'],
    defaultVoiceLine: "FWOOSH! Ready to fly high and power up our habits, Hero!"
  },
  {
    id: 'pet_barnaby_bear',
    category: 'pet',
    name: 'Barnaby the Cozy Bear',
    emoji: '🐻',
    badge: '3D Beast Companion',
    description: 'Warm golden woodland bear who loves honey snacks and peaceful bedtime routines.',
    format: 'glb',
    modelUrl: model('quaternius/cute-monsters/Panda'),
    thumbnail: thumb('quaternius/cute-monsters/Panda'),
    credit: QUATERNIUS,
    animations: ANIM,
    archetype: 'beast',
    primaryColor: '#f39c12',
    accentColor: '#2ecc71',
    bellyColor: '#ffddb9',
    assignedHabit: 'bedtime_routine',
    habitBonusDesc: '+30% Bedtime Routine Joy & +15 Daily Token Generation',
    tags: ['bear', 'beast', 'cozy', 'bedtime', 'honey', 'snack'],
    defaultVoiceLine: "Cozy hugs and sweet dreams! Great job completing today's superhero quests!"
  },
  {
    id: 'pet_hydro_turtle',
    category: 'pet',
    name: 'Hydro the Tidal Turtle',
    emoji: '🐢',
    badge: '3D Aquatic Companion',
    description: 'Armored sea turtle with crystal water shell who reminds kids to drink plenty of water.',
    format: 'glb',
    modelUrl: model('quaternius/monsters/Frog'),
    thumbnail: thumb('quaternius/monsters/Frog'),
    credit: QUATERNIUS,
    animations: ANIM,
    archetype: 'aquatic',
    primaryColor: '#008889',
    accentColor: '#54e98a',
    bellyColor: '#48dbfb',
    assignedHabit: 'drink_water',
    habitBonusDesc: '+20 Coins & +10 XP every time you log water intake',
    tags: ['turtle', 'water', 'aquatic', 'hydrate', 'ocean', 'shell'],
    defaultVoiceLine: "Splash! Stay hydrated, Little Hero! Water fuels our super muscles!"
  },
  {
    id: 'pet_bolt_cyber_pup',
    category: 'pet',
    name: 'Bolt the Cyber Mecha-Pup',
    emoji: '🤖',
    badge: '3D Robotic Companion',
    description: 'Futuristic robotic pup with glowing antenna and turbo charging speed.',
    format: 'glb',
    modelUrl: model('quaternius/monsters/Dog'),
    thumbnail: thumb('quaternius/monsters/Dog'),
    credit: QUATERNIUS,
    animations: ANIM,
    archetype: 'robot',
    primaryColor: '#121d26',
    accentColor: '#00d2d3',
    bellyColor: '#2b3640',
    assignedHabit: 'learning_challenge',
    habitBonusDesc: '+30% Learning Challenge Points & Fast Recharge Boost',
    tags: ['robot', 'mecha', 'cyber', 'dog', 'future', 'tech'],
    defaultVoiceLine: "Beep boop! All systems operational! Brainpower maximum!"
  },
  {
    id: 'pet_celeste_astral_fox',
    category: 'pet',
    name: 'Celeste the Astral Fox',
    emoji: '🦊',
    badge: '3D Mystic Companion',
    description: 'Celestial starlight fox who leaves glowing stardust footprints and loves reading.',
    format: 'glb',
    modelUrl: model('quaternius/monsters/Cat'),
    thumbnail: thumb('quaternius/monsters/Cat'),
    credit: QUATERNIUS,
    animations: ANIM,
    archetype: 'mystic',
    primaryColor: '#ffb961',
    accentColor: '#00d2d3',
    bellyColor: '#ffe5b4',
    assignedHabit: 'reading_time',
    habitBonusDesc: '+40% Reading XP & Starlight Aura in Hero HQ',
    tags: ['fox', 'mystic', 'astral', 'stars', 'reading', 'celestial'],
    defaultVoiceLine: "The stars shine brightly on curious minds! Let's read an epic tale!"
  },
  // --- REAL MODELS ADDED 2026-11 (CC0 packs by Kenney and Quaternius) ---
  // Weapons: foam-dart style blasters, no realistic guns.
  ...[
    ['weapon_foam_blaster_a', 'blaster-a', 'Splash Foam Blaster', 'A cyan foam-dart blaster. Safe, loud and very splashy.', 1.2, 50],
    ['weapon_foam_blaster_d', 'blaster-d', 'Turbo Foam Blaster', 'Rapid-fire foam darts that pop plaque bubbles.', 1.25, 60],
    ['weapon_foam_blaster_h', 'blaster-h', 'Mini Foam Blaster', 'Small, quick and easy to carry on any quest.', 1.15, 40],
    ['weapon_foam_blaster_o', 'blaster-o', 'Mega Foam Blaster', 'The biggest foam blaster in the hero toy box.', 1.3, 75]
  ].map(([id, file, name, description, mult, price]) => ({
    id, category: 'weapon', name, emoji: '🔫', badge: 'Foam Blaster', description, format: 'glb',
    modelUrl: model(`kenney/blasters/${file}`), thumbnail: thumb(`kenney/blasters/${file}`), credit: KENNEY,
    defaultStat: 'damage_boost', defaultMultiplier: mult, defaultPrice: price,
    tags: ['blaster', 'foam', 'dart', 'toy', 'weapon', 'water'],
    defaultVoiceLine: 'Rex says: Pop pop pop! Those plaque bubbles never stood a chance!'
  })),
  // Pet snacks (healthy only).
  ...[
    ['food_banana', 'banana', 'Sunny Banana', '🍌', 'Soft and sweet, a perfect energy snack.', ['banana', 'fruit', 'yellow']],
    ['food_carrot', 'carrot', 'Crunchy Carrot', '🥕', 'Crunchy carrot for strong eyes and happy teeth.', ['carrot', 'vegetable', 'orange']],
    ['food_broccoli', 'broccoli', 'Tiny Tree Broccoli', '🥦', 'Little green trees full of hero vitamins.', ['broccoli', 'vegetable', 'green']],
    ['food_watermelon', 'watermelon', 'Watermelon Slice', '🍉', 'Cool, juicy and great on a hot day.', ['watermelon', 'fruit', 'juicy']],
    ['food_grapes', 'grapes', 'Grape Bunch', '🍇', 'A juicy bunch of grapes for a happy tummy.', ['grapes', 'fruit']],
    ['food_corn', 'corn', 'Golden Corn', '🌽', 'Sweet golden corn straight from the field.', ['corn', 'vegetable', 'yellow']]
  ].map(([id, file, name, emoji, description, tags]) => ({
    id, category: 'food', name, emoji, badge: 'Healthy Snack', description, format: 'glb',
    modelUrl: model(`kenney/food/${file}`), thumbnail: thumb(`kenney/food/${file}`), credit: KENNEY,
    defaultStat: 'hunger', defaultMultiplier: 1.2, defaultPrice: 20, tags: ['snack', 'food', 'healthy', ...tags],
    defaultVoiceLine: 'Rex says: Yum! Healthy food makes a big, strong hero!'
  })),
  // Hero HQ furniture.
  ...[
    ['furniture_rug_round', 'rugRound', 'Round Play Rug', 'rug', '🟠', 'A big round rug for building, playing and cuddling.', 20, 90],
    ['furniture_reading_lamp', 'lampRoundFloor', 'Reading Lamp', 'decor', '💡', 'A warm lamp for bedtime stories.', 15, 80],
    ['furniture_bookcase', 'bookcaseOpen', 'Story Bookcase', 'decor', '📚', 'Open shelves for every adventure book.', 20, 120],
    ['furniture_teddy', 'bear', 'Cuddle Teddy', 'decor', '🧸', 'A soft teddy bear who loves a good hug.', 25, 70],
    ['furniture_potted_plant', 'pottedPlant', 'Leafy Plant', 'decor', '🪴', 'A friendly plant that makes the room feel alive.', 15, 60]
  ].map(([id, file, name, furnType, emoji, description, comfort, price]) => ({
    id, category: 'furniture', name, emoji, badge: 'Hero HQ', description, format: 'glb',
    modelUrl: model(`kenney/furniture/${file}`), thumbnail: thumb(`kenney/furniture/${file}`), credit: KENNEY,
    furnType, comfort, defaultPrice: price, tags: ['furniture', 'room', furnType],
    defaultVoiceLine: 'Aaah, so cozy! This room is just right.'
  })),
  // Pet Pen toys.
  ...[
    ['toy_racer', 'craft_racer', 'Zoom Racer', '🏎️', 'A speedy racer for zooming around the pen.'],
    ['toy_speeder_a', 'craft_speederA', 'Orange Speeder', '🚀', 'Whooosh! This little speeder never slows down.'],
    ['toy_speeder_c', 'craft_speederC', 'Star Speeder', '🛸', 'Spins and glides across the whole sanctuary.'],
    ['toy_rover', 'rover', 'Moon Rover', '🚙', 'Rolls over bumps and craters with ease.']
  ].map(([id, file, name, emoji, description]) => ({
    id, category: 'toy', name, emoji, badge: 'Pet Toy', description, format: 'glb',
    modelUrl: model(`kenney/space/${file}`), thumbnail: thumb(`kenney/space/${file}`), credit: KENNEY,
    statRefillTarget: 'joy', refillPotency: 40, sparkBonus: 20, tags: ['toy', 'vehicle', 'play', 'fun'],
    defaultVoiceLine: 'Vroom vroom! Again, again!'
  })),
  // More companions.
  ...[
    ['pet_pip_penguin', 'quaternius/cute-monsters/Penguin', 'Pip the Penguin', 'beast', ANIM],
    ['pet_pudge_pig', 'quaternius/cute-monsters/Pig', 'Pudge the Pig', 'beast', ANIM],
    ['pet_hop_bunny', 'quaternius/monsters/Bunny', 'Hop the Bunny', 'beast', ANIM],
    ['pet_squidle', 'quaternius/monsters/Squidle', 'Squidle the Sea Sprite', 'aquatic', FLY],
    ['pet_misty_ghost', 'quaternius/monsters/Ghost', 'Misty the Friendly Ghost', 'mystic', FLY],
    ['pet_finn_fish', 'quaternius/monsters/Fish', 'Finn the Fish', 'aquatic', ANIM]
  ].map(([id, path, name, archetype, animations]) => ({
    id, category: 'pet', name, emoji: '🐾', badge: '3D Companion', description: `${name} is a gentle friend who loves helping with chores.`, format: 'glb',
    modelUrl: model(path), thumbnail: thumb(path), credit: QUATERNIUS, animations,
    archetype, primaryColor: '#38bdf8', accentColor: '#facc15', bellyColor: '#e0f2fe', assignedHabit: 'clean_toys',
    habitBonusDesc: '+20% Toy Cleaning Coins', tags: [archetype, name.toLowerCase(), 'pet', 'friend'],
    defaultVoiceLine: "Hi friend! Ready for today's quests?"
  })),
  // More bosses (silly, never scary).
  ...[
    ['boss_gloom_ghost', 'quaternius/monsters/Ghost', 'Gloomy Bedtime Ghost', 'bedtime', 'Boo! I will keep you up all night!', 'Lights out and snuggle in! Chase the gloom away!', FLY],
    ['boss_screen_alien', 'quaternius/cute-monsters/Alien', 'Screen-Time Alien', 'screens', 'Ha ha! One more video, one more video!', 'Power down and play outside! Beam that alien home!', ANIM],
    ['boss_sugar_cyclops', 'quaternius/cute-monsters/Cyclops', 'Sugar Cyclops', 'nutrition', 'I only eat candy! Try to stop me!', 'Eat your colourful foods and take its sweet tooth away!', ANIM]
  ].map(([id, path, name, domain, taunt, rallyCall, animations]) => ({
    id, category: 'boss', name, emoji: '👾', badge: '3D Quest Boss', description: `${name} is a silly monster who needs a hero to show it a better way.`, format: 'glb',
    modelUrl: model(path), thumbnail: thumb(path), credit: QUATERNIUS, animations,
    domain, hp: 300, rewardCoins: 80, taunt, rallyCall, tags: ['monster', 'boss', domain]
  }))
];

/**
 * Get 3D assets filtered by category
 * @param {'gear'|'furniture'|'toy'|'boss'|'pet'} category
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
 * @param {'gear'|'furniture'|'toy'|'boss'|'pet'} category
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
