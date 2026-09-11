// Hero HQ & Superhero Hideout Studio Data Catalog
// Contains Room Themes, Furniture across 5 placement slots, and Trophy generation logic.

export const ROOM_THEMES = [
  {
    id: 'dino_treehouse',
    name: '🌿 Dino Treehouse Grotto',
    shortName: 'Dino Treehouse',
    desc: 'Living treetop sanctuary with jungle vines, ancient wooden planks, and glowing canopy fireflies.',
    emoji: '🌿',
    bgGradient: 'from-emerald-950 via-teal-900 to-amber-950',
    floorColor: 'bg-emerald-900/60 border-emerald-700/50',
    wallColor: 'from-emerald-900/40 to-teal-950/80',
    accentColor: 'text-emerald-400',
    bannerBadge: 'Nature Hideout',
    ceilingStars: 'text-amber-200',
    ambientSound: 'nature'
  },
  {
    id: 'galactic_starship',
    name: '🚀 Galactic Starship Command',
    shortName: 'Starship Command',
    desc: 'Deep cosmic bridge with starlight observation viewport, neon cyan bulkheads, and warp thruster glows.',
    emoji: '🚀',
    bgGradient: 'from-slate-950 via-indigo-950 to-cyan-950',
    floorColor: 'bg-slate-900/70 border-cyan-500/40',
    wallColor: 'from-indigo-950/60 to-slate-950/90',
    accentColor: 'text-cyan-400',
    bannerBadge: 'Sci-Fi Bridge',
    ceilingStars: 'text-cyan-200',
    ambientSound: 'scifi'
  },
  {
    id: 'coral_grotto',
    name: '🌊 Starlight Coral Grotto',
    shortName: 'Coral Grotto',
    desc: 'Shimmering underwater palace with iridescent sea glass tiles, glowing pearls, and dancing ocean rays.',
    emoji: '🌊',
    bgGradient: 'from-cyan-950 via-blue-900 to-teal-950',
    floorColor: 'bg-teal-900/60 border-teal-400/40',
    wallColor: 'from-teal-950/50 to-blue-950/90',
    accentColor: 'text-teal-300',
    bannerBadge: 'Ocean Realm',
    ceilingStars: 'text-teal-200',
    ambientSound: 'water'
  },
  {
    id: 'wizard_spire',
    name: '🔮 Enchanted Wizard Spire',
    shortName: 'Wizard Spire',
    desc: 'Floating arcane chamber with mystic purple stonework, golden constellation runes, and floating spellbooks.',
    emoji: '🔮',
    bgGradient: 'from-purple-950 via-fuchsia-950 to-slate-950',
    floorColor: 'bg-purple-900/60 border-fuchsia-500/40',
    wallColor: 'from-purple-950/60 to-slate-950/90',
    accentColor: 'text-fuchsia-400',
    bannerBadge: 'Mystic Spire',
    ceilingStars: 'text-fuchsia-200',
    ambientSound: 'magic'
  },
  {
    id: 'superhero_neon',
    name: '⚡ Metro Superhero Hideout',
    shortName: 'Hero Hideout',
    desc: 'High-tech secret cavern beneath Metro City with yellow warning chevrons, titanium plating, and glowing hero crest.',
    emoji: '⚡',
    bgGradient: 'from-zinc-950 via-slate-900 to-amber-950',
    floorColor: 'bg-zinc-900/70 border-amber-500/40',
    wallColor: 'from-zinc-950/70 to-slate-950/90',
    accentColor: 'text-amber-400',
    bannerBadge: 'Metro HQ',
    ceilingStars: 'text-yellow-200',
    ambientSound: 'tech'
  }
];

export const FURNITURE_SLOTS = [
  { id: 'bed', name: 'Bed & Napping Pod', emoji: '🛏️' },
  { id: 'petLounge', name: 'Pet Play & Lounge', emoji: '🛋️' },
  { id: 'desk', name: 'Mission Desk', emoji: '🖥️' },
  { id: 'decor', name: 'Light & Decor', emoji: '💡' },
  { id: 'rug', name: 'Floor Mat & Rug', emoji: '🧶' }
];

export const FURNITURE_ITEMS = [
  // --- BEDS (Slot: bed) ---
  {
    id: 'dino_leaf_canopy',
    name: 'Dino Leaf Canopy Bed',
    slot: 'bed',
    desc: 'Hand-woven jungle hammock shaded by giant prehistoric palm fronds.',
    icon: '🍃',
    emoji: '🛏️',
    costCoins: 0,
    unlockedByDefault: true,
    interactiveType: 'sleep',
    actionPrompt: 'Take a Hero Snooze',
    themeId: 'dino_treehouse'
  },
  {
    id: 'starship_sleep_pod',
    name: 'Galactic Cryo-Pod',
    slot: 'bed',
    desc: 'Pressurized sleep chamber with bio-monitors and starlight viewscreen.',
    icon: '🚀',
    emoji: '🛸',
    costCoins: 80,
    milestoneRequirement: '3_day_brush_streak',
    reqLabel: '3-Day Brushing Streak',
    interactiveType: 'sleep',
    actionPrompt: 'Recharge Energy Core',
    themeId: 'galactic_starship'
  },
  {
    id: 'coral_shell_hammock',
    name: 'Pearl Oyster Shell Bed',
    slot: 'bed',
    desc: 'Giant gleaming clam shell lined with glowing sea velvet and pearls.',
    icon: '🦪',
    emoji: '🫧',
    costCoins: 120,
    milestoneRequirement: '5_chores_completed',
    reqLabel: 'Complete 5 Real-Life Chores',
    interactiveType: 'sleep',
    actionPrompt: 'Rest in Sea Velvet',
    themeId: 'coral_grotto'
  },
  {
    id: 'wizard_cloud_futon',
    name: 'Floating Arcane Cloud Bed',
    slot: 'bed',
    desc: 'Drifts 3 inches off the ground with soft enchanted golden star dust.',
    icon: '☁️',
    emoji: '✨',
    costCoins: 150,
    milestoneRequirement: 'learning_streak_3',
    reqLabel: '3-Day Learning Realm Streak',
    interactiveType: 'sleep',
    actionPrompt: 'Float on Cloud Nine',
    themeId: 'wizard_spire'
  },
  {
    id: 'superhero_bunker_bunk',
    name: 'Titanium Superhero Bunker Bed',
    slot: 'bed',
    desc: 'Reinforced blast-proof hero bunk with built-in gadget recharge rack.',
    icon: '🛡️',
    emoji: '⚡',
    costCoins: 200,
    milestoneRequirement: 'boss_defeat_1',
    reqLabel: 'Defeat 1 Hygiene Boss',
    interactiveType: 'sleep',
    actionPrompt: 'Power Nap for Next Mission',
    themeId: 'superhero_neon'
  },

  // --- PET LOUNGES (Slot: petLounge) ---
  {
    id: 'giant_beanbag',
    name: 'Cozy Superhero Beanbag',
    slot: 'petLounge',
    desc: 'Ultra-squishy foam beanbag where pets can cuddle up and purr.',
    icon: '🛋️',
    emoji: '🐾',
    costCoins: 0,
    unlockedByDefault: true,
    interactiveType: 'pet_nap',
    actionPrompt: 'Pet Nap Time',
    themeId: 'dino_treehouse'
  },
  {
    id: 'mini_trampoline',
    name: 'Super Boing Trampoline',
    slot: 'petLounge',
    desc: 'Springy mini trampoline! Pets jump up high and do mid-air flips!',
    icon: '🤸',
    emoji: '🎪',
    costCoins: 90,
    milestoneRequirement: 'dance_party_1',
    reqLabel: 'Complete 1 Dance Party Routine',
    interactiveType: 'trampoline_bounce',
    actionPrompt: 'Trampoline High Jump!',
    themeId: 'superhero_neon'
  },
  {
    id: 'coral_bubble_perch',
    name: 'Bioluminescent Jelly Perch',
    slot: 'petLounge',
    desc: 'Wobbly jelly cushion that gently hums ocean waves as pets relax.',
    icon: '🪸',
    emoji: '🌊',
    costCoins: 110,
    milestoneRequirement: 'pet_expedition_1',
    reqLabel: 'Send 1 Pet on an Expedition',
    interactiveType: 'pet_nap',
    actionPrompt: 'Jelly Cushion Snooze',
    themeId: 'coral_grotto'
  },
  {
    id: 'wizard_hover_cushion',
    name: 'Levitating Velvet Pillow',
    slot: 'petLounge',
    desc: 'Velvet pillow surrounded by magic rings that softly floats.',
    icon: '🔮',
    emoji: '✨',
    costCoins: 140,
    milestoneRequirement: 'learning_math_1',
    reqLabel: 'Master 1 Math Challenge',
    interactiveType: 'pet_nap',
    actionPrompt: 'Float in Mystic Comfort',
    themeId: 'wizard_spire'
  },
  {
    id: 'mecha_pet_charging_dock',
    name: 'Robo-Pet Turbo Charger',
    slot: 'petLounge',
    desc: 'High-speed companion resting pad with cute glowing power battery indicators.',
    icon: '⚡',
    emoji: '🔋',
    costCoins: 180,
    milestoneRequirement: '7_day_brush_streak',
    reqLabel: '7-Day Brushing Streak',
    interactiveType: 'pet_nap',
    actionPrompt: 'Fast Recharge Boost',
    themeId: 'galactic_starship'
  },

  // --- DESKS (Slot: desk) ---
  {
    id: 'hologram_mission_table',
    name: 'Hero Mission Desk',
    slot: 'desk',
    desc: 'Tactical wooden desk with a glowing hologram sphere showing today’s heroic quests.',
    icon: '🖥️',
    emoji: '🗺️',
    costCoins: 0,
    unlockedByDefault: true,
    interactiveType: 'hologram_spin',
    actionPrompt: 'Activate Mission Hologram',
    themeId: 'dino_treehouse'
  },
  {
    id: 'galactic_star_chart_desk',
    name: 'Deep Space Holo-Terminal',
    slot: 'desk',
    desc: 'Curved starship workstation projecting interactive galaxy constellations.',
    icon: '🌌',
    emoji: '🛰️',
    costCoins: 100,
    milestoneRequirement: 'learning_science_1',
    reqLabel: 'Pass 1 Science Challenge',
    interactiveType: 'hologram_spin',
    actionPrompt: 'Scan Star Sector',
    themeId: 'galactic_starship'
  },
  {
    id: 'alchemist_potion_bench',
    name: 'Enchanted Potion Bench',
    slot: 'desk',
    desc: 'Bubbling flasks, swirling elixir vials, and ancient spell parchment scrolls.',
    icon: '🧪',
    emoji: '⚗️',
    costCoins: 130,
    milestoneRequirement: '10_chores_completed',
    reqLabel: 'Complete 10 Real-Life Chores',
    interactiveType: 'hologram_spin',
    actionPrompt: 'Brew Sparkling Elixir',
    themeId: 'wizard_spire'
  },
  {
    id: 'underwater_sonar_station',
    name: 'Sonar Bubble Research Table',
    slot: 'desk',
    desc: 'Water-filled cylindrical console projecting deep sea acoustic sonar pings.',
    icon: '🫧',
    emoji: '📡',
    costCoins: 120,
    milestoneRequirement: '5_day_brush_streak',
    reqLabel: '5-Day Brushing Streak',
    interactiveType: 'hologram_spin',
    actionPrompt: 'Ping Ocean Sonar',
    themeId: 'coral_grotto'
  },
  {
    id: 'quantum_supercomputer',
    name: 'Hero AI Supercomputer',
    slot: 'desk',
    desc: 'Quad-screen tactical battle computer loaded with villain threat tracking.',
    icon: '🤖',
    emoji: '💻',
    costCoins: 220,
    milestoneRequirement: 'boss_defeat_3',
    reqLabel: 'Defeat 3 Hygiene Bosses',
    interactiveType: 'hologram_spin',
    actionPrompt: 'Run Global Villain Scan',
    themeId: 'superhero_neon'
  },

  // --- DECORS & LAMPS (Slot: decor) ---
  {
    id: 'starlight_projector_lamp',
    name: 'Cosmic Starlight Projector',
    slot: 'decor',
    desc: 'Projects hundreds of twinkling starlight constellations onto the hideout ceiling!',
    icon: '⭐',
    emoji: '🌟',
    costCoins: 0,
    unlockedByDefault: true,
    interactiveType: 'nightlight_toggle',
    actionPrompt: 'Toggle Starlight Night Mode',
    themeId: 'dino_treehouse'
  },
  {
    id: 'neon_water_fountain',
    name: 'Glow Wave Water Fountain',
    slot: 'decor',
    desc: 'A calming cascade of neon glowing turquoise water with gentle bubble sounds.',
    icon: '⛲',
    emoji: '💧',
    costCoins: 85,
    milestoneRequirement: '3_day_brush_streak',
    reqLabel: '3-Day Brushing Streak',
    interactiveType: 'nightlight_toggle',
    actionPrompt: 'Splash Fountain Stream',
    themeId: 'coral_grotto'
  },
  {
    id: 'jurassic_amber_lamp',
    name: 'Prehistoric Amber Glow Orb',
    slot: 'decor',
    desc: 'Warm golden amber sphere holding a fossilized starlight crystal.',
    icon: '🦕',
    emoji: '🏮',
    costCoins: 95,
    milestoneRequirement: 'pet_level_5',
    reqLabel: 'Reach Companion Pet Level 5',
    interactiveType: 'nightlight_toggle',
    actionPrompt: 'Warm Amber Glow',
    themeId: 'dino_treehouse'
  },
  {
    id: 'arcane_crystal_spire',
    name: 'Mana Crystal Pylon',
    slot: 'decor',
    desc: 'Hovering amethyst obelisk humming with gentle magical chime harmonics.',
    icon: '🔮',
    emoji: '💎',
    costCoins: 140,
    milestoneRequirement: 'learning_streak_5',
    reqLabel: '5-Day Learning Streak',
    interactiveType: 'nightlight_toggle',
    actionPrompt: 'Surge Crystal Energy',
    themeId: 'wizard_spire'
  },
  {
    id: 'superhero_signal_beacon',
    name: 'Skyline Signal Spotlight',
    slot: 'decor',
    desc: 'Heavy industrial searchlight that casts the Little Heroes crest into the sky.',
    icon: '🔦',
    emoji: '🚨',
    costCoins: 190,
    milestoneRequirement: 'boss_cavity_king',
    reqLabel: 'Defeat Cavity King Sugarfang',
    interactiveType: 'nightlight_toggle',
    actionPrompt: 'Cast Hero Skyline Signal',
    themeId: 'superhero_neon'
  },

  // --- RUGS & PLAY MATS (Slot: rug) ---
  {
    id: 'hero_road_rug',
    name: 'Hero City Play Mat',
    slot: 'rug',
    desc: 'Chunky cartoon roadways, hero towers, and rescue helipads for toy cars.',
    icon: '🛣️',
    emoji: '🚗',
    costCoins: 0,
    unlockedByDefault: true,
    interactiveType: 'rug',
    actionPrompt: 'Play on City Mat',
    themeId: 'superhero_neon'
  },
  {
    id: 'galaxy_spiral_rug',
    name: 'Cosmic Andromeda Rug',
    slot: 'rug',
    desc: 'Woven deep-space swirl with sparkling glitter stardust in spiraling arms.',
    icon: '🌀',
    emoji: '🌌',
    costCoins: 75,
    milestoneRequirement: 'dance_party_2',
    reqLabel: 'Complete 2 Movement Routines',
    interactiveType: 'rug',
    actionPrompt: 'Spin on Stardust Swirl',
    themeId: 'galactic_starship'
  },
  {
    id: 'dino_footprint_mat',
    name: 'T-Rex Tracks Moss Mat',
    slot: 'rug',
    desc: 'Soft living moss woven into huge friendly dinosaur foot outlines.',
    icon: '🐾',
    emoji: '🦖',
    costCoins: 80,
    milestoneRequirement: 'pet_expedition_2',
    reqLabel: 'Complete 2 Pet Expeditions',
    interactiveType: 'rug',
    actionPrompt: 'Step in Dino Footsteps',
    themeId: 'dino_treehouse'
  },
  {
    id: 'ocean_tide_carpet',
    name: 'Lagoon Wave Soft Carpet',
    slot: 'rug',
    desc: 'Plush aquamarine carpet contoured like rolling ocean surf waves.',
    icon: '🌊',
    emoji: '🏄',
    costCoins: 95,
    milestoneRequirement: '4_day_brush_streak',
    reqLabel: '4-Day Brushing Streak',
    interactiveType: 'rug',
    actionPrompt: 'Surf the Soft Carpet',
    themeId: 'coral_grotto'
  },
  {
    id: 'mystic_runic_circle',
    name: 'Arcane Summoning Circle',
    slot: 'rug',
    desc: 'Embroidered velvet circle inscribed with glowing ancient protection glyphs.',
    icon: '🔯',
    emoji: '✨',
    costCoins: 150,
    milestoneRequirement: '15_chores_completed',
    reqLabel: 'Complete 15 Real-Life Chores',
    interactiveType: 'rug',
    actionPrompt: 'Activate Magic Circle',
    themeId: 'wizard_spire'
  }
];

export function getHQTheme(themeId) {
  return ROOM_THEMES.find(t => t.id === themeId) || ROOM_THEMES[0];
}

export function getFurnitureItem(furnitureId) {
  return FURNITURE_ITEMS.find(f => f.id === furnitureId) || null;
}

export function getFurnitureForSlot(slot) {
  return FURNITURE_ITEMS.filter(f => f.slot === slot);
}

/**
 * Compiles a rich list of trophies earned across the app:
 * - Hygiene Bosses Defeated
 * - Dance Party Movement Routines
 * - Learning Realm Badges
 * - Pet Expedition Honors
 * - Habit Streak Milestones
 */
export function getTrophiesForDisplay(storeState = {}) {
  const trophies = [];

  // 1. Starter / Rookie Hero Trophy (Always unlocked so the child immediately has proud achievements)
  trophies.push({
    id: 'rookie_hero_crest',
    title: 'Honorary Little Hero Crest',
    category: 'Heroic Journey',
    emoji: '🎖️',
    iconColor: 'from-amber-400 to-yellow-500',
    dateEarned: 'First Day',
    lore: 'Awarded to every brave child who starts their epic quest to build real-world superhero habits!',
    rexPraise: 'ROAR! You are an official member of the Little Heroes League! Wear this badge with pride!'
  });

  // 2. Hygiene Battles Trophies
  const hygiene = storeState.hygieneBattle || {};
  const bossesDefeated = hygiene.bossesDefeated || [];
  if (bossesDefeated.includes('sugarfang') || hygiene.sugarfangDefeated) {
    trophies.push({
      id: 'trophy_sugarfang',
      title: 'Cavity Crusher Cup',
      category: 'Toothbrush Battles',
      emoji: '🏆',
      iconColor: 'from-emerald-400 to-teal-500',
      dateEarned: 'Boss Defeated',
      lore: 'Forged from defeated sugar crystals after vanquishing Cavity King Sugarfang in epic 2-minute combat!',
      rexPraise: 'Cavity King had no chance against your sparkling toothbrush powers! Your smile shines like diamond armor!'
    });
  }
  if (bossesDefeated.includes('plaque_phantom') || hygiene.phantomDefeated) {
    trophies.push({
      id: 'trophy_plaque_phantom',
      title: 'Ghostbuster Gum Goblet',
      category: 'Toothbrush Battles',
      emoji: '👻',
      iconColor: 'from-indigo-400 to-purple-500',
      dateEarned: 'Boss Defeated',
      lore: 'Vanished the sneaky Plaque Phantom who tried hiding between the molars.',
      rexPraise: 'Those back teeth are spotlessly clean! The Plaque Phantom has run away forever!'
    });
  }

  // 3. Movement / Dance Party Trophies
  const danceRoutines = storeState.movementRoutines || storeState.dancePartyHistory || [];
  const completedRoutinesCount = Array.isArray(danceRoutines) ? danceRoutines.length : (storeState.movementCompletedCount || 0);
  if (completedRoutinesCount >= 1 || storeState.danceChampion) {
    trophies.push({
      id: 'trophy_dance_star',
      title: 'Groove Master Disco Star',
      category: 'Movement Routines',
      emoji: '⭐',
      iconColor: 'from-pink-400 to-rose-500',
      dateEarned: `${completedRoutinesCount || 1} Workouts`,
      lore: 'Presented for dancing with heart, burning hero stamina, and showing unmatched rhythm.',
      rexPraise: 'You got some incredible dance moves! My tail was wagging the whole time!'
    });
  }

  // 4. Learning Adventures Trophies
  const learningProgress = storeState.learningGames || {};
  const completedSubjects = learningProgress.completedSubjects || [];
  if (completedSubjects.length > 0 || learningProgress.totalStars >= 5) {
    trophies.push({
      id: 'trophy_scholar_owl',
      title: 'Master Brain Golden Owl',
      category: 'Learning Realm',
      emoji: '🦉',
      iconColor: 'from-blue-400 to-cyan-500',
      dateEarned: 'Knowledge Master',
      lore: 'Given to scholars who solve tricky math puzzles, spell word challenges, and explore scientific mysteries.',
      rexPraise: 'Your brain is like a superhero supercomputer! Brilliant thinking, partner!'
    });
  }

  // 5. Pet Companion & Expedition Trophies
  const expeditions = storeState.petExpeditions || {};
  const completedExp = expeditions.completedExpeditions || [];
  if (completedExp.length >= 1 || storeState.expeditionChampion) {
    trophies.push({
      id: 'trophy_explorer_compass',
      title: 'Pioneer Explorer Golden Compass',
      category: 'Pet Expeditions',
      emoji: '🧭',
      iconColor: 'from-amber-500 to-orange-600',
      dateEarned: `${completedExp.length || 1} Expeditions`,
      lore: 'Earned by dispatching companion pets across the Whispering Woods and Crystal Caverns to find rare treasures.',
      rexPraise: 'A true explorer! You and your pets have uncovered secrets across the whole kingdom!'
    });
  }

  // 6. Real-life Habit Streak Trophy
  const streak = storeState.habitStreak || storeState.brushStreak || 3;
  if (streak >= 3) {
    trophies.push({
      id: 'trophy_habit_flame',
      title: 'Golden Consistency Torch',
      category: 'Habit Mastery',
      emoji: '🔥',
      iconColor: 'from-red-500 to-amber-500',
      dateEarned: `${streak} Day Streak`,
      lore: 'Honors heroes who complete their real-life morning and bedtime routines every single day without skipping.',
      rexPraise: 'Consistency is what turns heroes into legends! Look at that blazing habit streak!'
    });
  }

  // 7. Chores Hero Trophy
  const choresCompleted = storeState.choresCompletedCount || storeState.completedTasksCount || 5;
  if (choresCompleted >= 3) {
    trophies.push({
      id: 'trophy_chore_shield',
      title: 'Family Champion Silver Shield',
      category: 'Real-Life Chores',
      emoji: '🛡️',
      iconColor: 'from-cyan-400 to-blue-600',
      dateEarned: `${choresCompleted} Chores Done`,
      lore: 'Awarded for helping around the house—making beds, picking up toys, and being an everyday hero!',
      rexPraise: 'You are the most helpful hero in the whole universe! Parents and pets salute you!'
    });
  }

  return trophies;
}
