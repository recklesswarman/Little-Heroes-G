// Pet Gear Studio & Runway Catalog Data
// Defines equippable companion gear items, bone socket attachments,
// elemental aura effects, color dye palettes, and unlock criteria.

export const GEAR_SOCKETS = {
  HEAD: 'head',
  BACK: 'back',
  CHEST: 'chest',
  FEET: 'feet'
};

export const COLOR_DYES = [
  { id: 'ruby_hero', name: 'Heroic Crimson', hex: '#ef4444', border: '#b91c1c' },
  { id: 'emerald_spark', name: 'Emerald Spark', hex: '#10b981', border: '#047857' },
  { id: 'cosmic_cyan', name: 'Cosmic Cyan', hex: '#06b6d4', border: '#0e7490' },
  { id: 'electric_blue', name: 'Electric Azure', hex: '#3b82f6', border: '#1d4ed8' },
  { id: 'amber_flame', name: 'Amber Flame', hex: '#f59e0b', border: '#b45309' },
  { id: 'sunset_orange', name: 'Sunset Blaze', hex: '#f97316', border: '#c2410c' },
  { id: 'royal_gold', name: 'Royal Gold', hex: '#fbbf24', border: '#d97706' },
  { id: 'shadow_slate', name: 'Shadow Obsidian', hex: '#334155', border: '#0f172a' }
];

export const PET_GEAR_CATALOG = {
  head: [
    {
      id: 'cowl_hero',
      name: 'Hero Cowl',
      socket: 'head',
      icon: 'masks',
      desc: 'Sleek aerodynamic cowl with hero ear-guards.',
      unlocked: true,
      defaultColor: '#ef4444',
      aura: 'none'
    },
    {
      id: 'crown_golden_horn',
      name: 'Golden Horn Crown',
      socket: 'head',
      icon: 'crown',
      desc: 'Regal crown with polished golden spikes.',
      unlocked: true,
      defaultColor: '#f59e0b',
      aura: 'stardust'
    },
    {
      id: 'goggles_aviator',
      name: 'Sky-Captain Goggles',
      socket: 'head',
      icon: 'visibility',
      desc: 'Steampunk brass flying goggles with tinted lenses.',
      unlocked: false,
      unlockReq: '3-Day Habit Streak',
      defaultColor: '#d97706',
      aura: 'wind'
    },
    {
      id: 'tiara_phoenix',
      name: 'Phoenix Fire Tiara',
      socket: 'head',
      icon: 'local_fire_department',
      desc: 'Flaming crest tiara glowing with solar embers.',
      unlocked: false,
      unlockReq: 'Brush Teeth 5 Times',
      defaultColor: '#f97316',
      aura: 'fire'
    },
    {
      id: 'visor_cyber_tech',
      name: 'Cyber Sentinel Visor',
      socket: 'head',
      icon: 'smart_toy',
      desc: 'High-tech neon holographic HUD visor.',
      unlocked: false,
      unlockReq: 'Complete 10 Chores',
      defaultColor: '#06b6d4',
      aura: 'electric'
    }
  ],
  back: [
    {
      id: 'cape_classic',
      name: 'Fluttering Hero Cape',
      socket: 'back',
      icon: 'shield',
      desc: 'Regal flowing superhero cape with dynamic spring cloth physics.',
      unlocked: true,
      defaultColor: '#ef4444',
      hasClothPhysics: true,
      aura: 'none'
    },
    {
      id: 'wings_meteor',
      name: 'Meteor Glider Wings',
      socket: 'back',
      icon: 'flight',
      desc: 'Aero-wing gliders with glowing stardust thrusters.',
      unlocked: false,
      unlockReq: 'Active Play 3 Times',
      defaultColor: '#3b82f6',
      hasClothPhysics: false,
      aura: 'stardust'
    },
    {
      id: 'jetpack_boosters',
      name: 'Twin Turbo Jetpack',
      socket: 'back',
      icon: 'rocket_launch',
      desc: 'High-thrust rocket boosters with smoke and flame trails.',
      unlocked: false,
      unlockReq: 'Reach Hero Level 3',
      defaultColor: '#f97316',
      hasClothPhysics: false,
      aura: 'fire'
    },
    {
      id: 'cloak_moonlight',
      name: 'Moonlight Star Cloak',
      socket: 'back',
      icon: 'bedtime',
      desc: 'Silky nighttime cloak shimmering with constellation stars.',
      unlocked: false,
      unlockReq: 'Bedtime Routine Streak',
      defaultColor: '#4f46e5',
      hasClothPhysics: true,
      aura: 'cosmic'
    }
  ],
  chest: [
    {
      id: 'collar_titan',
      name: 'Titan Spiked Collar',
      socket: 'chest',
      icon: 'fitness_center',
      desc: 'Heavy-duty spiked collar radiating raw strength.',
      unlocked: true,
      defaultColor: '#475569',
      aura: 'none'
    },
    {
      id: 'plate_golden_crest',
      name: 'Golden Crest Plate',
      socket: 'chest',
      icon: 'shield',
      desc: 'Polished golden armor plate with the Hero Star crest.',
      unlocked: false,
      unlockReq: 'Clean Toys 5 Times',
      defaultColor: '#fbbf24',
      aura: 'stardust'
    },
    {
      id: 'harness_power_gem',
      name: 'Power Gem Harness',
      socket: 'chest',
      icon: 'diamond',
      desc: 'Elemental energy harness holding a glowing cosmic prism.',
      unlocked: false,
      unlockReq: 'Defeat Any Sugar Boss',
      defaultColor: '#10b981',
      aura: 'electric'
    }
  ],
  feet: [
    {
      id: 'boots_speed_neon',
      name: 'Neon Speed Boots',
      socket: 'feet',
      icon: 'sprint',
      desc: 'Aerodynamic boots leaving glowing light trails when running.',
      unlocked: true,
      defaultColor: '#10b981',
      aura: 'electric'
    },
    {
      id: 'bands_sparkle_ankle',
      name: 'Starlight Ankle Bands',
      socket: 'feet',
      icon: 'stars',
      desc: 'Magical bands bursting with sparkling confetti steps.',
      unlocked: false,
      unlockReq: 'Complete Dance Routine',
      defaultColor: '#ec4899',
      aura: 'stardust'
    },
    {
      id: 'pads_lava_stomp',
      name: 'Lava Stomp Greaves',
      socket: 'feet',
      icon: 'volcano',
      desc: 'Molten stone greaves that crackle with volcanic embers.',
      unlocked: false,
      unlockReq: 'Reach Hero Level 4',
      defaultColor: '#f97316',
      aura: 'fire'
    }
  ]
};

export function getGearItem(socket, gearId) {
  const list = PET_GEAR_CATALOG[socket] || [];
  return list.find(item => item.id === gearId) || null;
}

export function getAllGearForSocket(socket) {
  return PET_GEAR_CATALOG[socket] || [];
}
