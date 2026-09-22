// Pet Gear Studio & Runway Catalog Data
// Defines equippable companion gear items across 4 categories:
// Masks, Capes, Armor, Boots (with head/back/chest/feet aliases for compatibility).
// Zero purple/pink: Electric Cyan, Emerald Mint, Solar Amber, Oceanic Blue.

export const GEAR_CATEGORIES = {
  MASKS: 'masks',
  CAPES: 'capes',
  ARMOR: 'armor',
  BOOTS: 'boots'
};

// Aliases for legacy socket names
export const GEAR_SOCKETS = {
  HEAD: 'masks',
  BACK: 'capes',
  CHEST: 'armor',
  FEET: 'boots',
  head: 'masks',
  back: 'capes',
  chest: 'armor',
  feet: 'boots'
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
  masks: [
    {
      id: 'cowl_hero',
      name: 'Hero Cowl',
      category: 'masks',
      socket: 'head',
      icon: 'masks',
      level: 1,
      levelLabel: 'Lv.1 Common',
      desc: 'Sleek aerodynamic cowl with hero ear-guards.',
      unlocked: true,
      defaultColor: '#ef4444',
      aura: 'none',
      statBonusType: 'damage_boost',
      statBonusPercent: 15,
      statBonusLabel: '+15% AR Boss Damage'
    },
    {
      id: 'crown_golden_horn',
      name: 'Golden Horn Crown',
      category: 'masks',
      socket: 'head',
      icon: 'crown',
      level: 3,
      levelLabel: 'Lv.3 Rare',
      desc: 'Regal crown with polished golden spikes.',
      unlocked: true,
      defaultColor: '#f59e0b',
      aura: 'stardust',
      statBonusType: 'coin_boost',
      statBonusPercent: 20,
      statBonusLabel: '+20% Habit Coins'
    },
    {
      id: 'goggles_aviator',
      name: 'Sky-Captain Goggles',
      category: 'masks',
      socket: 'head',
      icon: 'visibility',
      level: 2,
      levelLabel: 'Lv.2 Uncommon',
      desc: 'Steampunk brass flying goggles with tinted lenses.',
      unlocked: false,
      unlockReq: '3-Day Habit Streak',
      defaultColor: '#d97706',
      aura: 'wind',
      statBonusType: 'xp_boost',
      statBonusPercent: 15,
      statBonusLabel: '+15% Quest XP'
    },
    {
      id: 'tiara_phoenix',
      name: 'Phoenix Fire Tiara',
      category: 'masks',
      socket: 'head',
      icon: 'local_fire_department',
      level: 4,
      levelLabel: 'Lv.4 Epic',
      desc: 'Flaming crest tiara glowing with solar embers.',
      unlocked: false,
      unlockReq: 'Brush Teeth 5 Times',
      defaultColor: '#f97316',
      aura: 'fire',
      statBonusType: 'damage_boost',
      statBonusPercent: 25,
      statBonusLabel: '+25% AR Boss Damage'
    },
    {
      id: 'visor_cyber_tech',
      name: 'Cyber Sentinel Visor',
      category: 'masks',
      socket: 'head',
      icon: 'smart_toy',
      level: 5,
      levelLabel: 'Lv.5 Legendary',
      desc: 'High-tech neon holographic HUD visor.',
      unlocked: false,
      unlockReq: 'Complete 10 Chores',
      defaultColor: '#00f5d4',
      aura: 'electric',
      statBonusType: 'speed_boost',
      statBonusPercent: 30,
      statBonusLabel: '+30% Habit Speed'
    }
  ],
  capes: [
    {
      id: 'cape_classic',
      name: 'Fluttering Hero Cape',
      category: 'capes',
      socket: 'back',
      icon: 'shield',
      level: 1,
      levelLabel: 'Lv.1 Common',
      desc: 'Regal flowing superhero cape with dynamic spring cloth physics.',
      unlocked: true,
      defaultColor: '#ef4444',
      hasClothPhysics: true,
      aura: 'none',
      statBonusType: 'speed_boost',
      statBonusPercent: 15,
      statBonusLabel: '+15% Runway Speed'
    },
    {
      id: 'wings_meteor',
      name: 'Meteor Glider Wings',
      category: 'capes',
      socket: 'back',
      icon: 'flight',
      level: 3,
      levelLabel: 'Lv.3 Rare',
      desc: 'Aero-wing gliders with glowing stardust thrusters.',
      unlocked: false,
      unlockReq: 'Active Play 3 Times',
      defaultColor: '#3b82f6',
      hasClothPhysics: false,
      aura: 'stardust',
      statBonusType: 'speed_boost',
      statBonusPercent: 25,
      statBonusLabel: '+25% Speed & Agility'
    },
    {
      id: 'jetpack_boosters',
      name: 'Twin Turbo Jetpack',
      category: 'capes',
      socket: 'back',
      icon: 'rocket_launch',
      level: 4,
      levelLabel: 'Lv.4 Epic',
      desc: 'High-thrust rocket boosters with smoke and flame trails.',
      unlocked: false,
      unlockReq: 'Reach Hero Level 3',
      defaultColor: '#f97316',
      hasClothPhysics: false,
      aura: 'fire',
      statBonusType: 'speed_boost',
      statBonusPercent: 30,
      statBonusLabel: '+30% Speed & Boost'
    },
    {
      id: 'cloak_moonlight',
      name: 'Moonlight Star Cloak',
      category: 'capes',
      socket: 'back',
      icon: 'bedtime',
      level: 5,
      levelLabel: 'Lv.5 Legendary',
      desc: 'Silky nighttime cloak shimmering with constellation stars.',
      unlocked: false,
      unlockReq: 'Bedtime Routine Streak',
      defaultColor: '#00d2ff',
      hasClothPhysics: true,
      aura: 'cosmic',
      statBonusType: 'xp_boost',
      statBonusPercent: 35,
      statBonusLabel: '+35% Bedtime & Quest XP'
    }
  ],
  armor: [
    {
      id: 'collar_titan',
      name: 'Titan Spiked Collar',
      category: 'armor',
      socket: 'chest',
      icon: 'fitness_center',
      level: 1,
      levelLabel: 'Lv.1 Common',
      desc: 'Heavy-duty spiked collar radiating raw strength.',
      unlocked: true,
      defaultColor: '#475569',
      aura: 'none',
      statBonusType: 'defense_boost',
      statBonusPercent: 20,
      statBonusLabel: '+20% Pet Defense'
    },
    {
      id: 'plate_golden_crest',
      name: 'Golden Crest Plate',
      category: 'armor',
      socket: 'chest',
      icon: 'shield',
      level: 3,
      levelLabel: 'Lv.3 Rare',
      desc: 'Polished golden armor plate with the Hero Star crest.',
      unlocked: false,
      unlockReq: 'Clean Toys 5 Times',
      defaultColor: '#fbbf24',
      aura: 'stardust',
      statBonusType: 'defense_boost',
      statBonusPercent: 25,
      statBonusLabel: '+25% Pet Defense'
    },
    {
      id: 'harness_power_gem',
      name: 'Power Gem Harness',
      category: 'armor',
      socket: 'chest',
      icon: 'diamond',
      level: 4,
      levelLabel: 'Lv.4 Epic',
      desc: 'Elemental energy harness holding a glowing cosmic prism.',
      unlocked: false,
      unlockReq: 'Defeat Any Sugar Boss',
      defaultColor: '#10b981',
      aura: 'electric',
      statBonusType: 'damage_boost',
      statBonusPercent: 30,
      statBonusLabel: '+30% Elemental Power'
    },
    {
      id: 'exosuit_cyber_plate',
      name: 'Cyber Sentinel Exoplate',
      category: 'armor',
      socket: 'chest',
      icon: 'memory',
      level: 5,
      levelLabel: 'Lv.5 Legendary',
      desc: 'Reinforced titanium alloy chestplate with glowing circuit nodes.',
      unlocked: false,
      unlockReq: 'Complete 15 Quests',
      defaultColor: '#00f5d4',
      aura: 'electric',
      statBonusType: 'damage_boost',
      statBonusPercent: 35,
      statBonusLabel: '+35% Boss Damage & Defense'
    }
  ],
  boots: [
    {
      id: 'boots_speed_neon',
      name: 'Neon Speed Boots',
      category: 'boots',
      socket: 'feet',
      icon: 'sprint',
      level: 1,
      levelLabel: 'Lv.1 Common',
      desc: 'Aerodynamic boots leaving glowing light trails when running.',
      unlocked: true,
      defaultColor: '#10b981',
      aura: 'electric',
      statBonusType: 'speed_boost',
      statBonusPercent: 25,
      statBonusLabel: '+25% Lightning Speed'
    },
    {
      id: 'bands_sparkle_ankle',
      name: 'Starlight Ankle Bands',
      category: 'boots',
      socket: 'feet',
      icon: 'stars',
      level: 2,
      levelLabel: 'Lv.2 Uncommon',
      desc: 'Magical bands bursting with sparkling stardust steps.',
      unlocked: false,
      unlockReq: 'Complete Dance Routine',
      defaultColor: '#00d2ff',
      aura: 'stardust',
      statBonusType: 'coin_boost',
      statBonusPercent: 20,
      statBonusLabel: '+20% Habit Coins'
    },
    {
      id: 'pads_lava_stomp',
      name: 'Lava Stomp Greaves',
      category: 'boots',
      socket: 'feet',
      icon: 'volcano',
      level: 4,
      levelLabel: 'Lv.4 Epic',
      desc: 'Molten stone greaves that crackle with volcanic embers.',
      unlocked: false,
      unlockReq: 'Reach Hero Level 4',
      defaultColor: '#f97316',
      aura: 'fire',
      statBonusType: 'damage_boost',
      statBonusPercent: 30,
      statBonusLabel: '+30% Stomp Power'
    },
    {
      id: 'boots_quantum_striders',
      name: 'Quantum Hyper-Striders',
      category: 'boots',
      socket: 'feet',
      icon: 'fast_forward',
      level: 5,
      levelLabel: 'Lv.5 Legendary',
      desc: 'Zero-gravity anti-matter boots that leave trails of gold spark.',
      unlocked: false,
      unlockReq: '30-Day Super Streak',
      defaultColor: '#f1c40f',
      aura: 'cosmic',
      statBonusType: 'speed_boost',
      statBonusPercent: 35,
      statBonusLabel: '+35% Ultra Speed & Coins'
    }
  ]
};

// Aliases for head, back, chest, feet compatibility
PET_GEAR_CATALOG.head = PET_GEAR_CATALOG.masks;
PET_GEAR_CATALOG.back = PET_GEAR_CATALOG.capes;
PET_GEAR_CATALOG.chest = PET_GEAR_CATALOG.armor;
PET_GEAR_CATALOG.feet = PET_GEAR_CATALOG.boots;

export function normalizeGearSlot(slotKey) {
  if (!slotKey) return 'masks';
  const k = slotKey.toLowerCase();
  if (k === 'head' || k === 'masks' || k === 'mask') return 'masks';
  if (k === 'back' || k === 'capes' || k === 'cape') return 'capes';
  if (k === 'chest' || k === 'armor') return 'armor';
  if (k === 'feet' || k === 'boots' || k === 'boot') return 'boots';
  return 'masks';
}

export function getGearItem(socketOrCategory, gearId) {
  const norm = normalizeGearSlot(socketOrCategory);
  const list = PET_GEAR_CATALOG[norm] || [];
  return list.find(item => item.id === gearId) || null;
}

export function getAllGearForSocket(socketOrCategory) {
  const norm = normalizeGearSlot(socketOrCategory);
  return PET_GEAR_CATALOG[norm] || [];
}

export function getGearHaloStyle(level = 1) {
  const lvl = Math.max(1, Math.min(5, Math.floor(level || 1)));
  switch (lvl) {
    case 5:
      return {
        beam: 'from-amber-300/35 via-yellow-400/10 to-transparent',
        haloShadow: 'shadow-[0_0_20px_rgba(245,190,11,0.85)]',
        border: 'border-yellow-300',
        bg: 'bg-yellow-950/60',
        text: 'text-amber-200',
        glowRgba: 'rgba(245, 190, 11, 0.85)',
        badge: 'Lv.5 Legendary'
      };
    case 4:
      return {
        beam: 'from-amber-400/25 via-orange-400/10 to-transparent',
        haloShadow: 'shadow-[0_0_18px_rgba(241,196,15,0.7)]',
        border: 'border-amber-400',
        bg: 'bg-amber-950/60',
        text: 'text-amber-300',
        glowRgba: 'rgba(241, 196, 15, 0.7)',
        badge: 'Lv.4 Epic'
      };
    case 3:
      return {
        beam: 'from-blue-400/25 via-cyan-400/10 to-transparent',
        haloShadow: 'shadow-[0_0_15px_rgba(52,152,219,0.6)]',
        border: 'border-blue-400',
        bg: 'bg-blue-950/60',
        text: 'text-cyan-300',
        glowRgba: 'rgba(52, 152, 219, 0.6)',
        badge: 'Lv.3 Rare'
      };
    case 2:
      return {
        beam: 'from-emerald-400/25 via-teal-400/10 to-transparent',
        haloShadow: 'shadow-[0_0_15px_rgba(46,204,113,0.5)]',
        border: 'border-emerald-400',
        bg: 'bg-emerald-950/60',
        text: 'text-emerald-300',
        glowRgba: 'rgba(46, 204, 113, 0.5)',
        badge: 'Lv.2 Uncommon'
      };
    default:
      return {
        beam: 'from-cyan-300/20 via-slate-400/10 to-transparent',
        haloShadow: 'shadow-[0_0_15px_rgba(0,210,255,0.45)]',
        border: 'border-cyan-400/60',
        bg: 'bg-cyan-950/40',
        text: 'text-cyan-200',
        glowRgba: 'rgba(0, 210, 255, 0.45)',
        badge: 'Lv.1 Common'
      };
  }
}

export function formatStatBonusName(type) {
  switch (type) {
    case 'damage_boost': return 'AR Boss Damage';
    case 'coin_boost': return 'Habit Coins';
    case 'xp_boost': return 'Quest XP';
    case 'speed_boost': return 'Runway & Habit Speed';
    case 'defense_boost': return 'Pet Defense & Vitality';
    case 'expedition_speed': return '3D Expedition Speed';
    case 'expedition_fuel': return 'Starlight Fuel Saver';
    case 'shield_deflect': return 'Boss Shield Deflect';
    default: return 'Hero Power';
  }
}

export function calculateActiveGearBuffs(equippedMap = {}) {
  const result = {
    damage_boost: 0,
    coin_boost: 0,
    xp_boost: 0,
    speed_boost: 0,
    defense_boost: 0,
    expedition_speed: 0,
    expedition_fuel: 0,
    shield_deflect: 0,
    summary: []
  };

  const categories = ['masks', 'capes', 'armor', 'boots'];
  categories.forEach(cat => {
    // Check both standard category and socket aliases
    const val = equippedMap[cat] || (cat === 'masks' ? equippedMap.head : cat === 'capes' ? equippedMap.back : cat === 'armor' ? equippedMap.chest : equippedMap.feet);
    if (!val) return;
    const item = (typeof val === 'object' && val !== null) ? val : getGearItem(cat, val);
    if (!item || !item.statBonusType) return;

    const percent = Number(item.statBonusPercent) || 0;
    if (result[item.statBonusType] !== undefined) {
      result[item.statBonusType] += percent;
    }
    result.summary.push({
      category: cat,
      slot: cat,
      gearId: item.id,
      gearName: item.name || item.id,
      type: item.statBonusType,
      percent,
      level: item.level || 1,
      label: item.statBonusLabel || `+${percent}% ${formatStatBonusName(item.statBonusType)}`
    });
  });

  result.coinMultiplier = Number((1 + result.coin_boost / 100).toFixed(2));
  result.xpMultiplier = Number((1 + result.xp_boost / 100).toFixed(2));
  result.damageMultiplier = Number((1 + result.damage_boost / 100).toFixed(2));
  result.speedMultiplier = Number((1 + result.speed_boost / 100).toFixed(2));
  result.defenseMultiplier = Number((1 + result.defense_boost / 100).toFixed(2));
  result.activeBuffLabels = result.summary.map(s => s.label);

  return result;
}
