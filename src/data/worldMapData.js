/**
 * World Adventure Map & Waypoint Quests Data Catalog
 * Procedural 3D Island biomes, sequential Path of Valor waypoints,
 * secret discovery shrines, and toy-box physics entities.
 * STRICT EXPLORER PALETTE: Zero pink or purple. Emerald, solar orange, amber, starlight cyan, slate.
 */

export const WORLD_BIOMES = [
  {
    id: 'whispering_meadows',
    name: 'Whispering Meadows',
    subtitle: 'Morning Trailhead & Orchard',
    timePhase: 'morning',
    color: '#2ecc71', // emerald green
    accentColor: '#27ae60',
    skyGradient: ['#0d2f22', '#145237', '#1e754f'],
    description: 'Breezy rolling emerald hills dotted with crisp fruit trees and morning birds.',
    ambientSfx: 'birds',
    bounds: { xMin: -40, xMax: -5, zMin: -40, zMax: -5 }
  },
  {
    id: 'sunken_lagoon',
    name: 'Sunken Lagoon & Falls',
    subtitle: 'Afternoon Hydration Oasis',
    timePhase: 'afternoon',
    color: '#00d2d3', // starlight cyan
    accentColor: '#01a3a4',
    skyGradient: ['#072a38', '#0b475e', '#11698e'],
    description: 'Refreshing turquoise freshwater springs fed by an ancient cliffside waterfall.',
    ambientSfx: 'waterfall',
    bounds: { xMin: 5, xMax: 40, zMin: -40, zMax: -5 }
  },
  {
    id: 'molten_volcano',
    name: 'Molten Volcano & Forge',
    subtitle: 'Evening Activity & Hearth',
    timePhase: 'evening',
    color: '#f39c12', // solar orange
    accentColor: '#d35400',
    skyGradient: ['#301b08', '#4d2806', '#693809'],
    description: 'Smoldering obsidian peaks where hero tools are forged over warm hearthstones.',
    ambientSfx: 'hearth',
    bounds: { xMin: -40, xMax: -5, zMin: 5, zMax: 40 }
  },
  {
    id: 'crystal_summit',
    name: 'Crystal Peak & Citadel',
    subtitle: 'Bedtime Twilight & Boss Summit',
    timePhase: 'bedtime',
    color: '#ffb961', // starlight amber
    accentColor: '#f1c40f',
    skyGradient: ['#09141e', '#0f2334', '#16334a'],
    description: 'Starlight crystal spires guarding the final summit before bedtime slumber.',
    ambientSfx: 'lullaby',
    bounds: { xMin: 5, xMax: 40, zMin: 5, zMax: 40 }
  }
];

export const PATH_OF_VALOR_WAYPOINTS = [
  {
    id: 'wp_wake_up',
    stepNumber: 1,
    title: 'Hero Awakening & Bed Making',
    shortTitle: 'Make Bed',
    biomeId: 'whispering_meadows',
    category: 'morning',
    icon: 'bed',
    color: '#2ecc71',
    rewardCoins: 15,
    rewardXp: 10,
    rewardSparks: 5,
    choreKey: 'make_bed',
    linkedBossId: null,
    coordinates: { x: -28, y: 1.5, z: -28 },
    speechPrompt: 'Good morning Little Hero! Stretch tall, make your bed neat, and claim your first trail badge!'
  },
  {
    id: 'wp_morning_teeth',
    stepNumber: 2,
    title: 'Morning Toothbrushing Shield',
    shortTitle: 'Morning Brush',
    biomeId: 'whispering_meadows',
    category: 'morning',
    icon: 'dentistry',
    color: '#2ecc71',
    rewardCoins: 25,
    rewardXp: 20,
    rewardSparks: 10,
    choreKey: 'brush_teeth_am',
    linkedBossId: 'sugar_gremlin',
    coordinates: { x: -16, y: 2.5, z: -18 },
    speechPrompt: 'Time to shine those hero teeth! Two minutes of brushing to defeat the Plaque Gremlin!'
  },
  {
    id: 'wp_hydration',
    stepNumber: 3,
    title: 'Dragon Sip Hydration',
    shortTitle: 'Drink Water',
    biomeId: 'sunken_lagoon',
    category: 'afternoon',
    icon: 'water_drop',
    color: '#00d2d3',
    rewardCoins: 15,
    rewardXp: 10,
    rewardSparks: 5,
    choreKey: 'drink_water',
    linkedBossId: null,
    coordinates: { x: 14, y: 1.8, z: -22 },
    speechPrompt: 'Splish splash! Power up your pet companion with a cool glass of freshwater!'
  },
  {
    id: 'wp_tidy_room',
    stepNumber: 4,
    title: 'Loot Stash Room Tidy',
    shortTitle: 'Tidy Toys',
    biomeId: 'sunken_lagoon',
    category: 'afternoon',
    icon: 'cleaning_services',
    color: '#00d2d3',
    rewardCoins: 20,
    rewardXp: 15,
    rewardSparks: 10,
    choreKey: 'clean_room',
    linkedBossId: null,
    coordinates: { x: 26, y: 2.2, z: -10 },
    speechPrompt: 'Sort your legendary toys and books into their hero chest! Tidy spaces make strong heroes!'
  },
  {
    id: 'wp_homework',
    stepNumber: 5,
    title: 'Scholar Forge Learning',
    shortTitle: 'Study & Read',
    biomeId: 'molten_volcano',
    category: 'evening',
    icon: 'auto_stories',
    color: '#f39c12',
    rewardCoins: 25,
    rewardXp: 25,
    rewardSparks: 15,
    choreKey: 'homework',
    linkedBossId: null,
    coordinates: { x: -18, y: 3.5, z: 16 },
    speechPrompt: 'Read 15 minutes or complete your adventure puzzle! Knowledge is your sharpest blade!'
  },
  {
    id: 'wp_workout',
    stepNumber: 6,
    title: 'Titan Dino Workout',
    shortTitle: 'Get Moving',
    biomeId: 'molten_volcano',
    category: 'evening',
    icon: 'directions_run',
    color: '#f39c12',
    rewardCoins: 20,
    rewardXp: 20,
    rewardSparks: 10,
    choreKey: 'exercise',
    linkedBossId: null,
    coordinates: { x: -28, y: 4.2, z: 28 },
    speechPrompt: 'Jump, stretch, and stomp like Rex! Burn off that energy before sundown!'
  },
  {
    id: 'wp_night_teeth',
    stepNumber: 7,
    title: 'Sugar Fortress Night Showdown',
    shortTitle: 'Night Brush',
    biomeId: 'crystal_summit',
    category: 'bedtime',
    icon: 'shield_moon',
    color: '#ffb961',
    rewardCoins: 35,
    rewardXp: 30,
    rewardSparks: 20,
    choreKey: 'brush_teeth_pm',
    linkedBossId: 'sugar_boss',
    coordinates: { x: 18, y: 5.5, z: 22 },
    speechPrompt: 'The Sugar Boss is retreating! Brush away the day to keep your smile gleaming all night long!'
  },
  {
    id: 'wp_bedtime',
    stepNumber: 8,
    title: 'Starlight Dream Slumber',
    shortTitle: 'Bedtime',
    biomeId: 'crystal_summit',
    category: 'bedtime',
    icon: 'bedtime',
    color: '#ffb961',
    rewardCoins: 25,
    rewardXp: 20,
    rewardSparks: 10,
    choreKey: 'sleep_on_time',
    linkedBossId: null,
    coordinates: { x: 30, y: 6.8, z: 30 },
    speechPrompt: 'Pyjamas on, lights dimmed, and soft lullaby playing. Rest well, hero!'
  }
];

export const SECRET_SHRINES = [
  {
    id: 'shrine_orchard',
    name: 'Ancient Golden Apple Tree',
    biomeId: 'whispering_meadows',
    hint: 'Shake the grandest leafy tree in Whispering Meadows 3 times!',
    icon: 'nutrition',
    color: '#2ecc71',
    coordinates: { x: -34, y: 2.0, z: -12 },
    rewardCoins: 35,
    rewardSparks: 15,
    itemGranted: 'golden_apple',
    speechDiscovery: 'You found the Golden Apple Tree! Sweet treats for your companion pet!'
  },
  {
    id: 'shrine_waterfall',
    name: 'Mermaid Waterfall Grotto',
    biomeId: 'sunken_lagoon',
    hint: 'Tap the rushing curtain of the lagoon waterfall!',
    icon: 'water',
    color: '#00d2d3',
    coordinates: { x: 32, y: 3.0, z: -30 },
    rewardCoins: 45,
    rewardSparks: 20,
    itemGranted: 'ocean_pearl',
    speechDiscovery: 'Splish! A secret cave behind the waterfall! Sparkle gems found!'
  },
  {
    id: 'shrine_anvil',
    name: 'Titan Obsidian Anvil',
    biomeId: 'molten_volcano',
    hint: 'Tap the glowing magma stone beside the volcanic ridge!',
    icon: 'hardware',
    color: '#f39c12',
    coordinates: { x: -12, y: 4.8, z: 32 },
    rewardCoins: 50,
    rewardSparks: 25,
    itemGranted: 'fire_ember',
    speechDiscovery: 'Clang! The Titan Anvil awakens! Pure hero courage forged!'
  },
  {
    id: 'shrine_rune_circle',
    name: 'Starlight Chime Monoliths',
    biomeId: 'crystal_summit',
    hint: 'Ring the 3 crystal monoliths at the summit in harmony!',
    icon: 'music_note',
    color: '#ffb961',
    coordinates: { x: 20, y: 6.0, z: 12 },
    rewardCoins: 60,
    rewardSparks: 30,
    itemGranted: 'starlight_crystal',
    speechDiscovery: 'Harmonic melody unlocked! The constellations shine brightly upon your companion!'
  }
];

export const TOY_BOX_ENTITIES = [
  {
    id: 'tree_apple_1',
    type: 'fruit_tree',
    biomeId: 'whispering_meadows',
    coordinates: { x: -22, y: 1.2, z: -32 },
    fruitType: 'apple',
    color: '#27ae60',
    label: 'Snack Tree'
  },
  {
    id: 'tree_starberry_1',
    type: 'fruit_tree',
    biomeId: 'whispering_meadows',
    coordinates: { x: -32, y: 1.5, z: -20 },
    fruitType: 'starberry',
    color: '#00d2d3',
    label: 'Starberry Bush'
  },
  {
    id: 'waterfall_cascade',
    type: 'waterfall',
    biomeId: 'sunken_lagoon',
    coordinates: { x: 28, y: 2.8, z: -28 },
    color: '#00d2d3',
    label: 'Lagoon Falls'
  },
  {
    id: 'monolith_rune_1',
    type: 'rune_monolith',
    biomeId: 'crystal_summit',
    coordinates: { x: 12, y: 5.2, z: 15 },
    pitch: 261.63, // C4
    label: 'Alpha Rune'
  },
  {
    id: 'monolith_rune_2',
    type: 'rune_monolith',
    biomeId: 'crystal_summit',
    coordinates: { x: 18, y: 5.5, z: 16 },
    pitch: 329.63, // E4
    label: 'Delta Rune'
  },
  {
    id: 'monolith_rune_3',
    type: 'rune_monolith',
    biomeId: 'crystal_summit',
    coordinates: { x: 24, y: 5.8, z: 15 },
    pitch: 392.00, // G4
    label: 'Omega Rune'
  }
];

export const LANDMARK_ARCHETYPES = [
  {
    type: 'fort',
    name: 'Hero Fortress Tower',
    icon: 'castle',
    emoji: '🏰',
    color: '#2ecc71',
    description: 'A valiant stone fortress tower with battlements and waving banner.'
  },
  {
    type: 'lighthouse',
    name: 'Kindness Beacon',
    icon: 'wb_incandescent',
    emoji: '🗼',
    color: '#00d2d3',
    description: 'A coastal beacon casting a rotating ray of starlight guidance.'
  },
  {
    type: 'observatory',
    name: 'Scholar Telescope Dome',
    icon: 'telescope',
    emoji: '🔭',
    color: '#ffb961',
    description: 'An astronomical dome with brass telescope gazing into constellations.'
  },
  {
    type: 'fossil_dig',
    name: 'Titan Dino Dig Site',
    icon: 'footprint',
    emoji: '🦴',
    color: '#f39c12',
    description: 'An ancient excavation featuring giant dinosaur fossil footprints.'
  },
  {
    type: 'launchpad',
    name: 'Starlight Rocket Launchpad',
    icon: 'rocket_launch',
    emoji: '🚀',
    color: '#00d2d3',
    description: 'A space launch station with a sleek rocket ready for orbit.'
  },
  {
    type: 'crystal_tree',
    name: 'Wishing Crystal Tree',
    icon: 'psychiatry',
    emoji: '🌲',
    color: '#2ecc71',
    description: 'A prism tree with leaves made of glittering, chime-singing gems.'
  },
  {
    type: 'hearth_cabin',
    name: 'Cozy Explorer Cabin',
    icon: 'cottage',
    emoji: '🛖',
    color: '#f39c12',
    description: 'A rustic timber cabin with warm lantern glow and puffing chimney.'
  }
];

export const BIOME_PLACEMENT_PRESETS = [
  {
    id: 'meadow_hillside',
    name: 'Meadow Hillside',
    biomeId: 'whispering_meadows',
    coordinates: { x: -26, y: 2.2, z: -12 }
  },
  {
    id: 'orchard_clearing',
    name: 'Orchard Clearing',
    biomeId: 'whispering_meadows',
    coordinates: { x: -14, y: 2.0, z: -26 }
  },
  {
    id: 'lagoon_shore',
    name: 'Lagoon Shore',
    biomeId: 'sunken_lagoon',
    coordinates: { x: 22, y: 1.8, z: -16 }
  },
  {
    id: 'waterfall_bluff',
    name: 'Waterfall Bluff',
    biomeId: 'sunken_lagoon',
    coordinates: { x: 34, y: 2.5, z: -22 }
  },
  {
    id: 'volcano_ridge',
    name: 'Volcano Ridge',
    biomeId: 'molten_volcano',
    coordinates: { x: -24, y: 3.8, z: 22 }
  },
  {
    id: 'forge_cavern',
    name: 'Forge Cavern Entrance',
    biomeId: 'molten_volcano',
    coordinates: { x: -12, y: 3.5, z: 28 }
  },
  {
    id: 'summit_peak',
    name: 'Starlight Summit Peak',
    biomeId: 'crystal_summit',
    coordinates: { x: 26, y: 6.2, z: 24 }
  },
  {
    id: 'crystal_plateau',
    name: 'Crystal Plateau',
    biomeId: 'crystal_summit',
    coordinates: { x: 14, y: 5.5, z: 32 }
  }
];

export const SEASONS_DATA = {
  spring: {
    id: 'spring',
    name: 'Spring Blossom',
    icon: '🌸',
    accentColor: '#2ecc71',
    particleType: 'petal',
    particleColor: '#86efac',
    ambientSfx: 'birds',
    description: 'Drifting petals and brisk morning birdsong across the meadows'
  },
  summer: {
    id: 'summer',
    name: 'Summer Sunbeams',
    icon: '☀️',
    accentColor: '#ffb961',
    particleType: 'sunbeam',
    particleColor: '#ffb961',
    ambientSfx: 'breeze',
    description: 'Radiant golden sunbeams and sparkling lagoon water reflections'
  },
  autumn: {
    id: 'autumn',
    name: 'Autumn Harvest',
    icon: '🍂',
    accentColor: '#f39c12',
    particleType: 'leaf',
    particleColor: '#f39c12',
    ambientSfx: 'leaves',
    description: 'Golden amber harvest leaves swirling across the terrain'
  },
  winter: {
    id: 'winter',
    name: 'Winter Frost & Aurora',
    icon: '❄️',
    accentColor: '#00d2d3',
    particleType: 'snow',
    particleColor: '#e0f2fe',
    auroraColors: ['#2ecc71', '#00d2d3', '#38bdf8'],
    ambientSfx: 'wind',
    description: 'Crystalline snowflakes and emerald-cyan aurora ribbons in the night sky'
  }
};

