// -------------------------------------------------------------
// Interactive AR Toothbrush & Hygiene Battle 2.0
// Dentist-approved 4 Quadrants + Tongue Polish with 3 Hygiene Bosses
// -------------------------------------------------------------

export const HYGIENE_BOSSES = [
  {
    id: "sugar_bandit",
    name: "The Sugar Bandit King",
    title: "Sticky Candy Mastermind",
    avatar: "🍭",
    image: "/assets/bosses/sugar_bandit.jpg",
    cleansedImage: "/assets/bosses/sugar_bandit_cleansed.jpg",
    color: "#f39c12",
    accentBorder: "border-amber-500",
    gradient: "from-amber-500/20 via-orange-500/10 to-yellow-500/5",
    maxHp: 100,
    shieldHp: 6,
    shieldMilestones: [90, 30],
    shieldName: "Sticky Caramel Barrier",
    attackName: "Caramel Slime Splash",
    description: "Coats molars in sticky breakfast sugars and spits candy caramel droplets!",
    weakness: "Rapid Circle Scrub",
    difficulty: "Toddler & Kid Friendly",
    rewardCoins: 50,
    rewardXP: 75,
    rewardSparks: 15,
    trophyRelicId: 'trophy_sugar_bandit',
    meshType: 'sugar_bandit',
    bombColor: '#f39c12',
    bombName: 'Sticky Caramel Bomb',
    cleansedTitle: 'Minty Sugar Buddy 🍬',
    cleansedAvatar: '🍬✨'
  },
  {
    id: "plaque_kraken",
    name: "The Plaque Kraken",
    title: "Deep Biofilm Terror",
    avatar: "🐙",
    image: "/assets/bosses/plaque_kraken.jpg",
    cleansedImage: "/assets/bosses/plaque_kraken_cleansed.jpg",
    color: "#2ecc71",
    accentBorder: "border-emerald-500",
    gradient: "from-emerald-500/20 via-teal-500/10 to-green-500/5",
    maxHp: 120,
    shieldHp: 8,
    shieldMilestones: [80, 40],
    shieldName: "Green Biofilm Web",
    attackName: "Slime Tentacle Strike",
    description: "Spreads sticky green biofilm across back molars that dims your tooth enamel!",
    weakness: "Dual-Sensor Cadence",
    difficulty: "Explorer Challenge",
    rewardCoins: 50,
    rewardXP: 75,
    rewardSparks: 15,
    trophyRelicId: 'trophy_plaque_kraken',
    meshType: 'plaque_kraken',
    bombColor: '#2ecc71',
    bombName: 'Plaque Slime Bomb',
    cleansedTitle: 'Friendly Bubble Kraken 🐙',
    cleansedAvatar: '🐙✨'
  },
  {
    id: "cavity_knight",
    name: "The Cavity Knight",
    title: "Enamel Acid Crusher",
    avatar: "⚔️",
    image: "/assets/bosses/cavity_knight.jpg",
    cleansedImage: "/assets/bosses/cavity_knight_cleansed.jpg",
    color: "#e74c3c",
    accentBorder: "border-rose-500",
    gradient: "from-rose-500/20 via-red-500/10 to-orange-500/5",
    maxHp: 140,
    shieldHp: 10,
    shieldMilestones: [70, 30],
    shieldName: "Hardened Acid Armor",
    attackName: "Sugar Lance Thrust",
    description: "Armed with an acidic candy lance and heavy acid-corrosion armor!",
    weakness: "Full 120s Endurance",
    difficulty: "Master Hero Battle",
    rewardCoins: 50,
    rewardXP: 75,
    rewardSparks: 15,
    trophyRelicId: 'trophy_cavity_knight',
    meshType: 'cavity_knight',
    bombColor: '#e74c3c',
    bombName: 'Acid Shard Bomb',
    cleansedTitle: 'Enamel Paladin 🛡️',
    cleansedAvatar: '🛡️✨'
  },
  {
    id: "tartar_titan",
    name: "The Tartar Titan",
    title: "Crystalline Rock-Candy Golem",
    avatar: "💎",
    image: "/assets/bosses/tartar_titan.jpg",
    cleansedImage: "/assets/bosses/tartar_titan_cleansed.jpg",
    color: "#9333ea",
    accentBorder: "border-purple-500",
    gradient: "from-purple-500/20 via-indigo-500/10 to-violet-500/5",
    maxHp: 160,
    shieldHp: 12,
    shieldMilestones: [60, 20],
    shieldName: "Hardened Crystal Wall",
    attackName: "Crystal Sugar Slam",
    description: "A towering rock-candy golem made of hardened sugar crystals that dull your teeth!",
    weakness: "Circular Foam Blast",
    difficulty: "Titan Boss Battle",
    rewardCoins: 50,
    rewardXP: 75,
    rewardSparks: 15,
    trophyRelicId: 'trophy_tartar_titan',
    meshType: 'tartar_titan',
    bombColor: '#9333ea',
    bombName: 'Crystal Sugar Shard',
    cleansedTitle: 'Gemstone Golem 💎',
    cleansedAvatar: '💎✨'
  }
];

// -------------------------------------------------------------
// Dynamic Rotating Sugar Attack Hazards (Random 1 per Battle)
// -------------------------------------------------------------
export const SUGAR_ATTACK_HAZARDS = [
  {
    id: 'smarties',
    name: 'Smarties Candies',
    shortName: 'Smarties',
    emoji: '🍬',
    color: '#f472b6',
    accentColor: '#38bdf8',
    image: '/assets/hazards/smarties.jpg',
    flavorText: 'Pastel sugar discs incoming! Swirl your toothbrush to deflect!',
    rexWarning: "Watch out, Little Hero! Smarties Candies incoming! Keep that bubble shield ready!",
    shatterType: 'tablets',
    shatterColors: ['#f472b6', '#38bdf8', '#fbbf24', '#34d399', '#c084fc']
  },
  {
    id: 'lava_cake',
    name: 'Chocolate Lava Cake',
    shortName: 'Lava Cake',
    emoji: '🌋',
    color: '#78350f',
    accentColor: '#451a03',
    image: '/assets/hazards/lava_cake.jpg',
    flavorText: 'Gooey chocolate fudge splash! Brush in circles to clean it off!',
    rexWarning: "Oh no, Chocolate Lava Cake! Molten fudge alert! Blast it with minty foam!",
    shatterType: 'fudge_splatter',
    shatterColors: ['#451a03', '#78350f', '#92400e', '#b45309']
  },
  {
    id: 'mint_icecream',
    name: 'Mint Chocolate Chip Ice Cream',
    shortName: 'Mint Ice Cream',
    emoji: '🍦',
    color: '#34d399',
    accentColor: '#10b981',
    image: '/assets/hazards/mint_icecream.jpg',
    flavorText: 'Sticky sweet ice cream scoops! Deflect the chill with your hero shield!',
    rexWarning: "Mint Chocolate Chip Ice Cream flying in! Double scoop danger! Deflect it back!",
    shatterType: 'ice_cream_splatter',
    shatterColors: ['#6ee7b7', '#a7f3d0', '#3b2014', '#10b981']
  },
  {
    id: 'soda',
    name: 'Fizzy Soda Can',
    shortName: 'Soda',
    emoji: '🥤',
    color: '#ef4444',
    accentColor: '#3b82f6',
    image: '/assets/hazards/soda.jpg',
    flavorText: 'Carbonated acid bubbles! Deflect with your bubble shield before it fizzes!',
    rexWarning: "Super Fizzy Soda blast incoming! Pop those sugary bubbles, Little Hero!",
    shatterType: 'soda_spray',
    shatterColors: ['#ef4444', '#38bdf8', '#f87171', '#ffffff']
  },
  {
    id: 'cookies',
    name: 'Chocolate Chip Cookies',
    shortName: 'Cookies',
    emoji: '🍪',
    color: '#d97706',
    accentColor: '#92400e',
    image: '/assets/hazards/cookies.jpg',
    flavorText: 'Crunchy golden cookie bombs! Break them down with diamond scrubbing power!',
    rexWarning: "Giant Chocolate Chip Cookies incoming! Crumble those villain snacks with your brush!",
    shatterType: 'cookie_crumbs',
    shatterColors: ['#d97706', '#92400e', '#451a03', '#fef3c7']
  },
  {
    id: 'gummy_bears',
    name: 'Bouncy Gummy Bears',
    shortName: 'Gummy Bears',
    emoji: '🧸',
    color: '#ec4899',
    accentColor: '#22c55e',
    image: '/assets/hazards/gummy_bears.svg',
    flavorText: 'Sticky bouncy gummy bears! Knock them away before they stick to your molars!',
    rexWarning: "Bouncy Gummy Bears on the loose! Bounce them right back at the boss!",
    shatterType: 'gummy_bounce',
    shatterColors: ['#ec4899', '#22c55e', '#eab308', '#f97316']
  },
  {
    id: 'lollipops',
    name: 'Swirled Lollipops',
    shortName: 'Lollipops',
    emoji: '🍭',
    color: '#f43f5e',
    accentColor: '#8b5cf6',
    image: '/assets/hazards/lollipops.svg',
    flavorText: 'Hard-candy rainbow spiral lollipops! Shatter the sugar armor!',
    rexWarning: "Rainbow Lollipops incoming! Use your toothbrush laser to shatter the sugar!",
    shatterType: 'candy_shards',
    shatterColors: ['#f43f5e', '#ec4899', '#8b5cf6', '#38bdf8', '#ffffff']
  }
];

export function getSugarHazardById(id) {
  return SUGAR_ATTACK_HAZARDS.find(h => h.id === id) || SUGAR_ATTACK_HAZARDS[0];
}

export const DENTAL_BADGES = [
  {
    id: "enamel_guardian",
    name: "Enamel Guardian",
    icon: "🛡️",
    desc: "Complete the full 120-second 4-quadrant brushing routine.",
    category: "Routine Endurance"
  },
  {
    id: "plaque_buster",
    name: "Plaque Buster",
    icon: "🦷",
    desc: "Defeat The Plaque Kraken in an epic dental duel.",
    category: "Boss Mastery"
  },
  {
    id: "diamond_grin",
    name: "Diamond Grin",
    icon: "💎",
    desc: "Maintain >80% scrub cadence across all 4 oral quadrants.",
    category: "Precision Cadence"
  },
  {
    id: "twice_a_day",
    name: "Twice-a-Day Champion",
    icon: "☀️🌙",
    desc: "Brush teeth both in the morning and at bedtime on the same day.",
    category: "Habit Streak"
  }
];

export const DENTAL_QUADRANTS = [
  {
    id: "q1",
    zone: 1,
    name: "Upper Right Molars",
    shortName: "Upper Right",
    icon: "🦷",
    cellId: "quadrant-cell-tr",
    startTime: 120,
    endTime: 90,
    instruction: "Scrub circular circles on your top right molars!",
    coachMessage: "Zone 1: Upper Right! Scrub round and round on your top right teeth!",
    brushPosition: { x: 65, y: 35, rotation: -20 },
    roi: { minX: 32, maxX: 56, minY: 12, maxY: 28 }
  },
  {
    id: "q2",
    zone: 2,
    name: "Upper Left Molars",
    shortName: "Upper Left",
    icon: "🦷",
    cellId: "quadrant-cell-tl",
    startTime: 90,
    endTime: 60,
    instruction: "Switch over to top left teeth! Round and round!",
    coachMessage: "Zone 2: Upper Left! Keep circling on your top left teeth!",
    brushPosition: { x: 35, y: 35, rotation: 20 },
    roi: { minX: 8, maxX: 32, minY: 12, maxY: 28 }
  },
  {
    id: "q3",
    zone: 3,
    name: "Lower Right Chewing Surfaces",
    shortName: "Lower Right",
    icon: "🦷",
    cellId: "quadrant-cell-br",
    startTime: 60,
    endTime: 30,
    instruction: "Down to bottom right teeth! Gentle circles on chew surfaces!",
    coachMessage: "Zone 3: Halfway there! Bottom right teeth next! Keep scrubbing!",
    brushPosition: { x: 65, y: 65, rotation: -15 },
    roi: { minX: 32, maxX: 56, minY: 28, maxY: 44 }
  },
  {
    id: "q4",
    zone: 4,
    name: "Lower Left Chewing Surfaces",
    shortName: "Lower Left",
    icon: "🦷",
    cellId: "quadrant-cell-bl",
    startTime: 30,
    endTime: 10,
    instruction: "Bottom left side! Clean away cavity bugs!",
    coachMessage: "Zone 4: Bottom left side! Clean away those cavity bugs!",
    brushPosition: { x: 35, y: 65, rotation: 15 },
    roi: { minX: 8, maxX: 32, minY: 28, maxY: 44 }
  },
  {
    id: "q5",
    zone: 5,
    name: "Tongue Polish & Minty Breath",
    shortName: "Tongue Polish",
    icon: "👅",
    cellId: "quadrant-cell-tongue",
    startTime: 10,
    endTime: 0,
    instruction: "Gentle tongue polish for fresh minty breath!",
    coachMessage: "Final 10 seconds: Gentle tongue polish for a shiny mint smile!",
    brushPosition: { x: 50, y: 50, rotation: 0 },
    roi: { minX: 20, maxX: 44, minY: 20, maxY: 40 }
  }
];

export function getHygieneBoss(bossId) {
  return HYGIENE_BOSSES.find(b => b.id === bossId) || HYGIENE_BOSSES[0];
}

export function getDentalQuadrant(secs, totalSecs = 120) {
  const ratio = Math.max(0, Math.min(1, secs / totalSecs));
  if (ratio > 0.75) return DENTAL_QUADRANTS[0];
  if (ratio > 0.50) return DENTAL_QUADRANTS[1];
  if (ratio > 0.25) return DENTAL_QUADRANTS[2];
  if (ratio > 0.083) return DENTAL_QUADRANTS[3];
  return DENTAL_QUADRANTS[4];
}
