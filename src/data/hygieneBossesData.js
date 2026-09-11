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
    rewardSparks: 15
  },
  {
    id: "plaque_kraken",
    name: "The Plaque Kraken",
    title: "Deep Biofilm Terror",
    avatar: "🐙",
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
    rewardSparks: 15
  },
  {
    id: "cavity_knight",
    name: "The Cavity Knight",
    title: "Enamel Acid Crusher",
    avatar: "⚔️",
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
    rewardSparks: 15
  }
];

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
    brushPosition: { x: 62, y: 35, rotation: -20 },
    roi: { minX: 32, maxX: 54, minY: 14, maxY: 29 }
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
    brushPosition: { x: 38, y: 35, rotation: 20 },
    roi: { minX: 10, maxX: 32, minY: 14, maxY: 29 }
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
    brushPosition: { x: 62, y: 65, rotation: -15 },
    roi: { minX: 32, maxX: 54, minY: 29, maxY: 44 }
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
    brushPosition: { x: 38, y: 65, rotation: 15 },
    roi: { minX: 10, maxX: 32, minY: 29, maxY: 44 }
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
    brushPosition: { x: 50, y: 52, rotation: 0 },
    roi: { minX: 20, maxX: 44, minY: 22, maxY: 38 }
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
