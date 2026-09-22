// 24 Pets Universe & Tactile Toy Architecture Data Catalog
// Fully complies with DESIGN.md and Adventurous Explorer guidelines:
// Zero pink/purple palette, Level 1-25 progression, 5 archetypes, chunky 3D toy figurines.

export function makePetSvg(emoji, bgGradient, glowColor) {
  const cleanGlow = (glowColor || '#2ecc71').replace('#', '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="bg-${cleanGlow}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#${cleanGlow}" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#09141e" stop-opacity="0.95"/>
      </radialGradient>
      <filter id="glow-${cleanGlow}">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#${cleanGlow}" flood-opacity="0.6"/>
      </filter>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#bg-${cleanGlow})" stroke="#${cleanGlow}" stroke-width="3"/>
    <circle cx="60" cy="60" r="44" fill="#16212b" stroke="#202b35" stroke-width="2"/>
    <text x="60" y="74" font-size="48" text-anchor="middle" filter="url(#glow-${cleanGlow})">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PET_ARCHETYPES = {
  dino: { id: 'dino', name: 'Prehistoric Dino', emoji: '🦖', badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', count: 8 },
  mystic: { id: 'mystic', name: 'Dragons & Mystics', emoji: '🐉', badgeBg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40', count: 5 },
  beast: { id: 'beast', name: 'Wild Beasts', emoji: '🦁', badgeBg: 'bg-amber-500/20 text-amber-400 border-amber-500/40', count: 6 },
  aquatic: { id: 'aquatic', name: 'Aquatic Guardians', emoji: '🦈', badgeBg: 'bg-blue-500/20 text-blue-400 border-blue-500/40', count: 3 },
  mech: { id: 'mech', name: 'Tech Mechs', emoji: '🤖', badgeBg: 'bg-teal-500/20 text-teal-300 border-teal-500/40', count: 2 }
};

export const PETS_DATABASE = [
  // 1. Rex the T-Rex (Prehistoric Dino)
  {
    id: '1',
    key: 'rex',
    name: 'Rex the T-Rex',
    shortName: 'Rex',
    title: 'The Apex Stomper',
    archetype: 'dino',
    element: 'Earth & Thunder',
    color: '#2ecc71',
    accentColor: '#f1c40f',
    darkColor: '#1b7a43',
    cardContainer: '#142820',
    cardOutline: '#27ae60',
    avatar: '/assets/pets/rex.png',
    image: '/assets/pets/rex.png',
    emoji: '🦖',
    backstory: 'Rex burst out of the Primeval Jungle with thunderous stomps! He loves high-knees running, sports, and cheering heroes on during active play.',
    assignedHabit: 'Active Play / Sports',
    habitBonus: 'Knee Lifter: +20 Coins on physical activity and sports tasks',
    statBonusType: 'coin_boost',
    baseBonusPercent: 20,
    maxLevel: 25,
    workoutId: 'trex_run',
    workoutName: "Rex's Knee-Lifter Stomp",
    workoutInstructions: 'Put elbows in armpits, run in place, and lift knees high as the ground shakes!',
    exclusiveGear: [
      { name: 'Titanium Dino Boots', desc: '+25% Running Speed in workouts', icon: 'directions_run', category: 'boots', level: 3 },
      { name: 'Thunder Roar Crest', desc: '+20% Coins on physical quests', icon: 'campaign', category: 'masks', level: 2 }
    ]
  },
  // 2. Raptor the Velociraptor (Prehistoric Dino)
  {
    id: '2',
    key: 'raptor',
    name: 'Raptor the Velociraptor',
    shortName: 'Raptor',
    title: 'The Lightning Sprinter',
    archetype: 'dino',
    element: 'Volcanic Magma & Sunrise Bolt',
    color: '#e74c3c',
    accentColor: '#f39c12',
    darkColor: '#96281b',
    cardContainer: '#261614',
    cardOutline: '#c0392b',
    avatar: '/assets/pets/raptor.png',
    image: '/assets/pets/raptor.png',
    emoji: '🦎',
    backstory: 'Raptor dashes so fast that volcanic sparks trail her claws. She is up before dawn and challenges heroes to complete morning routines in record time!',
    assignedHabit: 'Morning Routine',
    habitBonus: 'Speedy Start: +15 Coins for morning chores finished before 8 AM',
    statBonusType: 'coin_boost',
    baseBonusPercent: 15,
    maxLevel: 25,
    workoutId: 'velociraptor_run',
    workoutName: "Raptor's Lightning Sprint",
    workoutInstructions: 'Sprint in place on your toes as fast as humanly possible!',
    exclusiveGear: [
      { name: 'Sunrise Speed Mask', desc: '+20% Speed on morning tasks', icon: 'speed', category: 'masks', level: 2 }
    ]
  },
  // 3. Stego the Stegosaurus (Prehistoric Dino)
  {
    id: '3',
    key: 'stego',
    name: 'Stego the Stegosaurus',
    shortName: 'Stego',
    title: 'The Solar Stomper',
    archetype: 'dino',
    element: 'Radiant Sun-Plate & Forest Moss',
    color: '#f1c40f',
    accentColor: '#2ecc71',
    darkColor: '#9b7b02',
    cardContainer: '#232111',
    cardOutline: '#d4ac0d',
    avatar: '/assets/pets/stego.png',
    image: '/assets/pets/stego.png',
    emoji: '🦕',
    backstory: 'Stego has glorious solar plates that absorb sunlight during outdoor play. Stomp loudly on hands and feet across the meadow!',
    assignedHabit: 'Outdoor Play',
    habitBonus: 'Stomper Power: +25 Coins on outdoor play and exercise tasks',
    statBonusType: 'coin_boost',
    baseBonusPercent: 25,
    maxLevel: 25,
    workoutId: 'stegosaurus_walks',
    workoutName: "Stego's Heavy Four-Foot Stomp",
    workoutInstructions: 'Hands and feet on the ground, hips high, stomp forward and backward loudly!',
    exclusiveGear: [
      { name: 'Sunplate Solar Armor', desc: '+25% Outdoor Play Rewards', icon: 'shield', category: 'armor', level: 3 }
    ]
  },
  // 4. Pterry the Pterodactyl (Prehistoric Dino)
  {
    id: '4',
    key: 'pterry',
    name: 'Pterry the Pterodactyl',
    shortName: 'Pterry',
    title: 'The Sky Launcher',
    archetype: 'dino',
    element: 'High-Altitude Aero Jetstream',
    color: '#00d2ff',
    accentColor: '#3a7bd5',
    darkColor: '#0084a3',
    cardContainer: '#0d202b',
    cardOutline: '#00b4d8',
    avatar: '/assets/pets/pterry.png',
    image: '/assets/pets/pterry.png',
    emoji: '🦇',
    backstory: 'Pterry catches updrafts with massive cyan wings! She challenges little heroes to spread their arms wide and launch as high as they can jump.',
    assignedHabit: 'Stretch & Exercise',
    habitBonus: 'Sky Launcher: 2x XP on all jumping and stretching exercises',
    statBonusType: 'xp_boost',
    baseBonusPercent: 30,
    maxLevel: 25,
    workoutId: 'pterodactyl_takeoff',
    workoutName: "Pterry's Sky Launcher Take-Off",
    workoutInstructions: 'Spread arms wide, flap in giant circles, and jump up high into the clouds!',
    exclusiveGear: [
      { name: 'Aero Glider Cape', desc: 'Springy jumping cape physics', icon: 'flight', category: 'capes', level: 3 }
    ]
  },
  // 5. Chomper the Compsognathus (Prehistoric Dino)
  {
    id: '5',
    key: 'chomper',
    name: 'Chomper the Compsognathus',
    shortName: 'Chomper',
    title: 'The Tiny Dancer',
    archetype: 'dino',
    element: 'Kinetic Teal Cyclone',
    color: '#1abc9c',
    accentColor: '#f39c12',
    darkColor: '#116957',
    cardContainer: '#0d2420',
    cardOutline: '#16a085',
    avatar: '/assets/pets/chomper.png',
    image: '/assets/pets/chomper.png',
    emoji: '🦖',
    backstory: 'Tiny, energetic, and completely rhythm-obsessed! Chomper dances across rocks and logs, inspiring heroes to groove to every beat.',
    assignedHabit: 'Dance & Movement',
    habitBonus: 'Prancer Bonus: +30 Coins for completing dance or movement routines',
    statBonusType: 'coin_boost',
    baseBonusPercent: 30,
    maxLevel: 25,
    workoutId: 'compsognathus_prance',
    workoutName: "Chomper's Beat Prance",
    workoutInstructions: 'Jump left and right, crossing one leg behind the other to the beat!',
    exclusiveGear: [
      { name: 'Neon Rhythm Boots', desc: '+25% Arcade Dance Scores', icon: 'music_note', category: 'boots', level: 2 }
    ]
  },
  // 6. Brachio the Brachiosaurus (Prehistoric Dino)
  {
    id: '6',
    key: 'brachio',
    name: 'Brachio the Brachiosaurus',
    shortName: 'Brachio',
    title: 'The Great Stretcher',
    archetype: 'dino',
    element: 'Ancient Treetop Canopy & Granite',
    color: '#34495e',
    accentColor: '#2ecc71',
    darkColor: '#1e2b37',
    cardContainer: '#151f28',
    cardOutline: '#4a627a',
    avatar: '/assets/pets/brachio.png',
    image: '/assets/pets/brachio.png',
    emoji: '🦕',
    backstory: 'Gentle, towering, and patient. Brachio reaches for the sweetest leaves atop the tallest canopy trees and guides calm, tall stretches.',
    assignedHabit: 'Yoga & Stretching',
    habitBonus: 'Tall Stretch: +20 XP every time you reach for the stars in exercise',
    statBonusType: 'xp_boost',
    baseBonusPercent: 20,
    maxLevel: 25,
    workoutId: 'brachiosaurus_stretch',
    workoutName: "Brachio's Star Reach",
    workoutInstructions: 'Stand tall, reach both arms up to the ceiling, and stretch high on your tiptoes!',
    exclusiveGear: [
      { name: 'Canopy Moss Cloak', desc: '+20% Calm Meditation XP', icon: 'spa', category: 'capes', level: 2 }
    ]
  },
  // 7. Dippy the Diplodocus (Prehistoric Dino)
  {
    id: '7',
    key: 'dippy',
    name: 'Dippy the Diplodocus',
    shortName: 'Dippy',
    title: 'The Balance Master',
    archetype: 'dino',
    element: 'River Terraces & Sunset Bark',
    color: '#e67e22',
    accentColor: '#27ae60',
    darkColor: '#944c0c',
    cardContainer: '#261c14',
    cardOutline: '#d35400',
    avatar: '/assets/pets/dippy.png',
    image: '/assets/pets/dippy.png',
    emoji: '🦕',
    backstory: 'With an impossibly long neck and whip-like balancing tail, Dippy crosses rushing river stepping-stones without ever wobbling.',
    assignedHabit: 'Balance & Flexibility',
    habitBonus: 'Balance Master: +25 Coins on balance and coordination tasks',
    statBonusType: 'coin_boost',
    baseBonusPercent: 25,
    maxLevel: 25,
    workoutId: 'diplodocus_balance',
    workoutName: "Dippy's Bird-Dog Balance",
    workoutInstructions: 'On hands and knees, stretch right arm forward and left leg backward! Hold and switch!',
    exclusiveGear: [
      { name: 'River Stone Boots', desc: '+20% Balance Stability', icon: 'hiking', category: 'boots', level: 2 }
    ]
  },
  // 8. Spino the Spinosaurus (Prehistoric Dino)
  {
    id: '8',
    key: 'spino',
    name: 'Spino the Spinosaurus',
    shortName: 'Spino',
    title: 'The Cool-Down King',
    archetype: 'dino',
    element: 'Aquatic Fin & Coral Chill',
    color: '#c0392b',
    accentColor: '#3498db',
    darkColor: '#782117',
    cardContainer: '#241818',
    cardOutline: '#e74c3c',
    avatar: '/assets/pets/spino.png',
    image: '/assets/pets/spino.png',
    emoji: '🐊',
    backstory: 'Spino cools down by gliding through river lagoons, using his tall sail-fin like a breeze catcher to relax tired muscles after big adventures.',
    assignedHabit: 'Cool Down & Recovery',
    habitBonus: 'Spine Arch: +15 XP on all cool-down and stretching routines',
    statBonusType: 'xp_boost',
    baseBonusPercent: 15,
    maxLevel: 25,
    workoutId: 'spinosaurus_stretch',
    workoutName: "Spino's Spine-Arch Cool Down",
    workoutInstructions: 'On all fours, tuck your chin, round your back up like a dino sail, and breathe slow!',
    exclusiveGear: [
      { name: 'Hydro Fin Armor', desc: '+15% Recovery XP after battles', icon: 'water', category: 'armor', level: 2 }
    ]
  },
  // 9. Sparky the Dragon (Dragons & Mystics)
  {
    id: '9',
    key: 'sparky',
    name: 'Sparky the Dragon',
    shortName: 'Sparky',
    title: 'The Azure Ember',
    archetype: 'mystic',
    element: 'Glacial Blueflame & Mint Crystals',
    color: '#3498db',
    accentColor: '#2ecc71',
    darkColor: '#1c5f8a',
    cardContainer: '#101e2b',
    cardOutline: '#2980b9',
    avatar: '/assets/pets/sparky.png',
    image: '/assets/pets/sparky.png',
    emoji: '🐉',
    backstory: 'Sparky breathes cool minty dragon sparks! His pearly teeth shine bright, and he coaches heroes to brush every tooth until it gleams.',
    assignedHabit: 'Brush Teeth',
    habitBonus: 'Dragon Breath: 2x Coins on every toothbrushing session',
    statBonusType: 'coin_boost',
    baseBonusPercent: 30,
    maxLevel: 25,
    workoutId: 'dragon_flame_reach',
    workoutName: "Sparky's Azure Flame Stretch",
    workoutInstructions: 'Take a deep breath, puff up your chest, and reach both arms wide with dragon power!',
    exclusiveGear: [
      { name: 'Azure Flame Mask', desc: '+25% Toothbrush Boss Deflect', icon: 'masks', category: 'masks', level: 3 }
    ]
  },
  // 10. Aero the Griffin (Dragons & Mystics)
  {
    id: '10',
    key: 'aero',
    name: 'Aero the Griffin',
    shortName: 'Aero',
    title: 'The Solar Sentinel',
    archetype: 'mystic',
    element: 'Golden Citadel Sunbeam & High Wind',
    color: '#f1c40f',
    accentColor: '#3498db',
    darkColor: '#9b7b02',
    cardContainer: '#242214',
    cardOutline: '#f39c12',
    avatar: '/assets/pets/aero.png',
    image: '/assets/pets/aero.png',
    emoji: '🦅',
    backstory: 'With the keen eyesight of an eagle and the heart of a lion, Aero guards study spires and boosts concentration during homework and reading.',
    assignedHabit: 'Homework & Reading',
    habitBonus: 'Eagle Eye: +25% XP on all homework and reading tasks',
    statBonusType: 'xp_boost',
    baseBonusPercent: 25,
    maxLevel: 25,
    workoutId: 'griffin_wing_glide',
    workoutName: "Aero's Citadel Wing Glide",
    workoutInstructions: 'Extend arms horizontally like wings, balance on one foot for 5 seconds, then switch!',
    exclusiveGear: [
      { name: 'Sunbeam Feather Cape', desc: '+25% Focus and XP Bonus', icon: 'auto_awesome', category: 'capes', level: 3 }
    ]
  },
  // 11. Blaze the Phoenix (Dragons & Mystics)
  {
    id: '11',
    key: 'blaze',
    name: 'Blaze the Phoenix',
    shortName: 'Blaze',
    title: 'The Midnight Flame',
    archetype: 'mystic',
    element: 'Sunset Embers & Nightfall Hearth',
    color: '#e74c3c',
    accentColor: '#f39c12',
    darkColor: '#96281b',
    cardContainer: '#261715',
    cardOutline: '#d35400',
    avatar: '/assets/pets/blaze.png',
    image: '/assets/pets/blaze.png',
    emoji: '🦚',
    backstory: 'Blaze glows with gentle campfire warmth that lulls the sanctuary to rest. Completing evening bedtime routines fills her tailfeathers with stardust.',
    assignedHabit: 'Bedtime Routine',
    habitBonus: 'Cozy Embers: +20 Coins for completing bedtime routine on time',
    statBonusType: 'coin_boost',
    baseBonusPercent: 20,
    maxLevel: 25,
    workoutId: 'phoenix_hearth_sway',
    workoutName: "Blaze's Cozy Slumber Sway",
    workoutInstructions: 'Gently sway arms from side to side like warm flickering candle flames, breathing deeply.',
    exclusiveGear: [
      { name: 'Starlight Hearth Cape', desc: '+20% Bedtime Habit Rewards', icon: 'bedtime', category: 'capes', level: 3 }
    ]
  },
  // 12. Hydra the Sea Serpent (Aquatic Guardians)
  {
    id: '12',
    key: 'hydra',
    name: 'Hydra the Sea Serpent',
    shortName: 'Hydra',
    title: 'The Tidal Guardian',
    archetype: 'aquatic',
    element: 'Abyssal Trench & Pure Spring Ice',
    color: '#2980b9',
    accentColor: '#1abc9c',
    darkColor: '#174a6b',
    cardContainer: '#0f1e29',
    cardOutline: '#3498db',
    avatar: '/assets/pets/hydra.png',
    image: '/assets/pets/hydra.png',
    emoji: '🐍',
    backstory: 'A friendly aquatic serpent who glides through coral reefs. Hydra reminds little heroes that staying hydrated with cool water fuels superpowers!',
    assignedHabit: 'Drink Water',
    habitBonus: 'Wave Rider: +15 XP every time you drink a cup of fresh water',
    statBonusType: 'xp_boost',
    baseBonusPercent: 15,
    maxLevel: 25,
    workoutId: 'sea_serpent_tide_flow',
    workoutName: "Hydra's Ocean Wave Flow",
    workoutInstructions: 'Roll shoulders back and undulate arms like shimmering ocean waves across the tide!',
    exclusiveGear: [
      { name: 'Aquifer Scale Armor', desc: '+20% Water Logging XP', icon: 'water_drop', category: 'armor', level: 3 }
    ]
  },
  // 13. Luna the Unicorn (Dragons & Mystics)
  {
    id: '13',
    key: 'luna',
    name: 'Luna the Unicorn',
    shortName: 'Luna',
    title: 'The Rainbow Weaver',
    archetype: 'mystic',
    element: 'Aurora Electric Cyan & Prismatic Solar Beam',
    color: '#00e5ff',
    accentColor: '#ffb300',
    darkColor: '#008ea0',
    cardContainer: '#0d2229',
    cardOutline: '#00b0ff',
    avatar: '/assets/pets/luna.png',
    image: '/assets/pets/luna.png',
    emoji: '🦄',
    backstory: 'Luna leaves sparkling aurora trails with every playful prance. She loves drawing, building blocks, and all kinds of colorful creative play!',
    assignedHabit: 'Creative Play',
    habitBonus: 'Magic Spark: +25% Coins on all creative play and craft tasks',
    statBonusType: 'coin_boost',
    baseBonusPercent: 25,
    maxLevel: 25,
    workoutId: 'unicorn_starlight_spin',
    workoutName: "Luna's Aurora Starlight Spin",
    workoutInstructions: 'Twirl slowly with arms out, hop lightly on one foot, and strike a heroic magic pose!',
    exclusiveGear: [
      { name: 'Prismatic Horn Mask', desc: '+25% Crafting & Creative Tokens', icon: 'auto_fix_high', category: 'masks', level: 4 }
    ]
  },
  // 14. Kira the Kirin (Wild Beasts)
  {
    id: '14',
    key: 'kira',
    name: 'Kira the Kirin',
    shortName: 'Kira',
    title: 'The Order Keeper',
    archetype: 'beast',
    element: 'Bamboo Jade & Golden Sun-Hoof',
    color: '#f39c12',
    accentColor: '#2ecc71',
    darkColor: '#945d04',
    cardContainer: '#221c11',
    cardOutline: '#e67e22',
    avatar: '/assets/pets/kira.png',
    image: '/assets/pets/kira.png',
    emoji: '🦌',
    backstory: 'Kira walks so lightly that not even a blade of grass bends. She brings harmony, order, and spotless tidiness to messy bedrooms and play spaces.',
    assignedHabit: 'Clean Room',
    habitBonus: 'Tidy Hooves: +30 XP when you clean and organize your room',
    statBonusType: 'xp_boost',
    baseBonusPercent: 30,
    maxLevel: 25,
    workoutId: 'kirin_bamboo_leap',
    workoutName: "Kira's Bamboo High-Step",
    workoutInstructions: 'Step high over pretend bamboo logs, lifting each knee gently to tap with hands!',
    exclusiveGear: [
      { name: 'Golden Antler Mask', desc: '+25% Room Cleanup XP', icon: 'cleaning_services', category: 'masks', level: 3 }
    ]
  },
  // 15. Boulder the Crystal Golem (Wild Beasts)
  {
    id: '15',
    key: 'boulder',
    name: 'Boulder the Crystal Golem',
    shortName: 'Boulder',
    title: 'The Iron Fortress',
    archetype: 'beast',
    element: 'Raw Obsidian, Titanium & Emerald Core',
    color: '#7f8c8d',
    accentColor: '#2ecc71',
    darkColor: '#485253',
    cardContainer: '#192022',
    cardOutline: '#95a5a6',
    avatar: '/assets/pets/boulder.png',
    image: '/assets/pets/boulder.png',
    emoji: '💎',
    backstory: 'Carved from ancient crystal stone, Boulder gets unbreakable strength from nutrient-rich vegetables and wholesome healthy meals.',
    assignedHabit: 'Healthy Eating',
    habitBonus: 'Rock Solid: +20 Coins for every healthy meal or veggie snack logged',
    statBonusType: 'coin_boost',
    baseBonusPercent: 20,
    maxLevel: 25,
    workoutId: 'golem_iron_power',
    workoutName: "Boulder's Iron Squat Stomp",
    workoutInstructions: 'Lower into a deep sturdy squat with chest up, hold for 3 seconds, then stand tall!',
    exclusiveGear: [
      { name: 'Titanium Chestplate Armor', desc: '+20% Healthy Meal Tokens', icon: 'restaurant', category: 'armor', level: 3 }
    ]
  },
  // 16. Cosmo the Cyber Mech (Tech Mechs)
  {
    id: '16',
    key: 'cosmo',
    name: 'Cosmo the Cyber Mech',
    shortName: 'Cosmo',
    title: 'The Quantum Hound',
    archetype: 'mech',
    element: 'Quantum Laser Cyan & Plasma Amber',
    color: '#00f5d4',
    accentColor: '#ffbe0b',
    darkColor: '#009682',
    cardContainer: '#0a1f22',
    cardOutline: '#00bbf9',
    avatar: '/assets/pets/cosmo.png',
    image: '/assets/pets/cosmo.png',
    emoji: '🤖',
    backstory: 'Powered by quantum circuit boards, Cosmo loves math puzzles, memory challenges, and high-tech educational quest games.',
    assignedHabit: 'Learning Games',
    habitBonus: 'Data Download: 2x XP on all learning games and memory quests',
    statBonusType: 'xp_boost',
    baseBonusPercent: 35,
    maxLevel: 25,
    workoutId: 'cyber_quantum_dash',
    workoutName: "Cosmo's Circuit Quantum Dash",
    workoutInstructions: 'Quick-feet tap in place! Tap left, tap right, jump high to hit the laser target!',
    exclusiveGear: [
      { name: 'Quantum Visor Mask', desc: '+30% Learning Game Accuracy', icon: 'smart_toy', category: 'masks', level: 4 }
    ]
  },
  // 17. Leo the Lion (Wild Beasts)
  {
    id: '17',
    key: 'leo',
    name: 'Leo the Lion',
    shortName: 'Leo',
    title: 'The Pride Leader',
    archetype: 'beast',
    element: 'Savannah Sunburst & Royal Amber',
    color: '#f1c40f',
    accentColor: '#e67e22',
    darkColor: '#9b7b02',
    cardContainer: '#262112',
    cardOutline: '#f39c12',
    avatar: '/assets/pets/leo.png',
    image: '/assets/pets/leo.png',
    emoji: '🦁',
    backstory: 'Noble, loyal, and brave. Leo unites all sanctuary companions, encouraging teamwork and kind cooperation between siblings and friends.',
    assignedHabit: 'Teamwork',
    habitBonus: 'Pride Leader: +20 XP on all teamwork and cooperative family tasks',
    statBonusType: 'xp_boost',
    baseBonusPercent: 20,
    maxLevel: 25,
    workoutId: 'lion_pride_roar_march',
    workoutName: "Leo's Royal Pride March",
    workoutInstructions: 'March proudly with your head held high, puffing your chest and striking a proud lion pose!',
    exclusiveGear: [
      { name: 'Savannah Royal Cape', desc: '+20% Teamwork Bonus', icon: 'group', category: 'capes', level: 3 }
    ]
  },
  // 18. Stripe the Tiger (Wild Beasts)
  {
    id: '18',
    key: 'stripe',
    name: 'Stripe the Tiger',
    shortName: 'Stripe',
    title: 'The Clean Paws',
    archetype: 'beast',
    element: 'Jungle Blaze Orange & Soapy Mint',
    color: '#e67e22',
    accentColor: '#2ecc71',
    darkColor: '#8f4a0c',
    cardContainer: '#241b12',
    cardOutline: '#d35400',
    avatar: '/assets/pets/stripe.png',
    image: '/assets/pets/stripe.png',
    emoji: '🐯',
    backstory: 'Stripe never eats without scrubbing his paws spotless first! He loves warm bubbles and makes handwashing feel like a splashing jungle game.',
    assignedHabit: 'Wash Hands',
    habitBonus: 'Clean Paws: +15 Coins every time you wash your hands before meals',
    statBonusType: 'coin_boost',
    baseBonusPercent: 15,
    maxLevel: 25,
    workoutId: 'tiger_clean_paws_scrub',
    workoutName: "Stripe's Soapy Scrub Splash",
    workoutInstructions: 'Rub hands together in rapid circles, washing between fingers, then flick water away!',
    exclusiveGear: [
      { name: 'Soapy Foam Boots', desc: '+15% Hygiene Streak Tokens', icon: 'soap', category: 'boots', level: 2 }
    ]
  },
  // 19. Fang the Wolf (Wild Beasts)
  {
    id: '19',
    key: 'fang',
    name: 'Fang the Wolf',
    shortName: 'Fang',
    title: 'The Moonlight Scout',
    archetype: 'beast',
    element: 'Arctic Moon Timber & Glacier Silver',
    color: '#95a5a6',
    accentColor: '#2ecc71',
    darkColor: '#546364',
    cardContainer: '#171f22',
    cardOutline: '#7f8c8d',
    avatar: '/assets/pets/fang.png',
    image: '/assets/pets/fang.png',
    emoji: '🐺',
    backstory: 'Fang guards the arctic forest beneath the full moon. His white fangs gleam brightly, and he keeps watch over morning and night brushing.',
    assignedHabit: 'Brush Teeth',
    habitBonus: 'Moonlight Shine: +20 XP for each completed 2-minute brushing session',
    statBonusType: 'xp_boost',
    baseBonusPercent: 20,
    maxLevel: 25,
    workoutId: 'wolf_moon_brush_patrol',
    workoutName: "Fang's Arctic Moon Prowl",
    workoutInstructions: 'Creep low on silent paws across the carpet, then jump up and howl with joy!',
    exclusiveGear: [
      { name: 'Glacier Fang Mask', desc: '+20% Toothbrushing XP', icon: 'pets', category: 'masks', level: 3 }
    ]
  },
  // 20. Scout the Eagle (Tech Mechs / Aviators)
  {
    id: '20',
    key: 'scout',
    name: 'Scout the Eagle',
    shortName: 'Scout',
    title: 'The Sky Sentinel',
    archetype: 'mech',
    element: 'High Air Glider & Solar Beacon',
    color: '#3498db',
    accentColor: '#f1c40f',
    darkColor: '#1d5a83',
    cardContainer: '#121e29',
    cardOutline: '#2980b9',
    avatar: '/assets/pets/scout.png',
    image: '/assets/pets/scout.png',
    emoji: '🦅',
    backstory: 'Equipped with holographic navigational scopes, Scout spots open books and homework quests from miles above the clouds.',
    assignedHabit: 'Homework & Reading',
    habitBonus: 'Sky Reader: +15 Coins on every homework and reading task completed',
    statBonusType: 'coin_boost',
    baseBonusPercent: 15,
    maxLevel: 25,
    workoutId: 'eagle_sky_focus_dive',
    workoutName: "Scout's Precision Focus Glide",
    workoutInstructions: 'Stand on one leg, arms stretched forward, look straight ahead without blinking for 8 seconds!',
    exclusiveGear: [
      { name: 'Aero Scope Mask', desc: '+20% Study Reading Coins', icon: 'menu_book', category: 'masks', level: 3 }
    ]
  },
  // 21. Gnasher the Shark (Aquatic Guardians)
  {
    id: '21',
    key: 'gnasher',
    name: 'Gnasher the Shark',
    shortName: 'Gnasher',
    title: 'The Deep Diver',
    archetype: 'aquatic',
    element: 'Midnight Submersible & Bioluminescent Gold',
    color: '#1f618d',
    accentColor: '#f1c40f',
    darkColor: '#123c58',
    cardContainer: '#0d1924',
    cardOutline: '#2980b9',
    avatar: '/assets/pets/gnasher.png',
    image: '/assets/pets/gnasher.png',
    emoji: '🦈',
    backstory: 'In the calm, silent waters of the deep abyss, Gnasher swims in slow, rhythmic circles to help little heroes transition peacefully into dreamland.',
    assignedHabit: 'Bedtime Routine',
    habitBonus: 'Deep Rest: +25% XP for completing the full bedtime routine',
    statBonusType: 'xp_boost',
    baseBonusPercent: 25,
    maxLevel: 25,
    workoutId: 'shark_deep_rest_drift',
    workoutName: "Gnasher's Abyssal Drift",
    workoutInstructions: 'Lie back flat or sit comfortably, breathe in for 4 seconds, breathe out for 4 seconds.',
    exclusiveGear: [
      { name: 'Bioluminescent Fin Armor', desc: '+25% Sleep Routine Bonus', icon: 'nightlight', category: 'armor', level: 3 }
    ]
  },
  // 22. Shadow the Panther (Wild Beasts)
  {
    id: '22',
    key: 'shadow',
    name: 'Shadow the Panther',
    shortName: 'Shadow',
    title: 'The Silent Sweeper',
    archetype: 'beast',
    element: 'Stealth Carbon & Night-Vision Emerald',
    color: '#2c3e50',
    accentColor: '#00e676',
    darkColor: '#17212b',
    cardContainer: '#111a22',
    cardOutline: '#00c853',
    avatar: '/assets/pets/shadow.png',
    image: '/assets/pets/shadow.png',
    emoji: '🐆',
    backstory: 'Shadow moves completely undetected. Toys, clothes, and clutter vanish into their bins before anyone even notices he has arrived!',
    assignedHabit: 'Clean Room',
    habitBonus: 'Stealth Sweeper: +20 Coins for cleaning your room without being asked',
    statBonusType: 'coin_boost',
    baseBonusPercent: 20,
    maxLevel: 25,
    workoutId: 'panther_stealth_step',
    workoutName: "Shadow's Silent Stealth Steps",
    workoutInstructions: 'Step across the floor as silently as a ninja panther — make ZERO sound for 20 seconds!',
    exclusiveGear: [
      { name: 'Night-Vision Visor Mask', desc: '+20% Stealth Cleaning Coins', icon: 'visibility', category: 'masks', level: 3 }
    ]
  },
  // 23. Barnaby the Bear (Wild Beasts)
  {
    id: '23',
    key: 'barnaby',
    name: 'Barnaby the Bear',
    shortName: 'Barnaby',
    title: 'The Honey Woodsman',
    archetype: 'beast',
    element: 'Woodland Cedar & Wildflower Honey',
    color: '#d35400',
    accentColor: '#f1c40f',
    darkColor: '#7f3100',
    cardContainer: '#241810',
    cardOutline: '#e67e22',
    avatar: '/assets/pets/barnaby.png',
    image: '/assets/pets/barnaby.png',
    emoji: '🐻',
    backstory: 'Barnaby loves crunchy berries, fresh apples, and warm wholesome meals. He gives big bear hugs to heroes who finish their veggies!',
    assignedHabit: 'Healthy Eating',
    habitBonus: 'Bear Hug Boost: +15 XP for every healthy meal or snack logged',
    statBonusType: 'xp_boost',
    baseBonusPercent: 15,
    maxLevel: 25,
    workoutId: 'bear_honey_hug_reach',
    workoutName: "Barnaby's Big Bear Reach",
    workoutInstructions: 'Reach both arms wide for a gigantic bear hug, squeeze tight, and breathe in deeply!',
    exclusiveGear: [
      { name: 'Honeycomb Woodsman Boots', desc: '+15% Nutrition Quest XP', icon: 'forest', category: 'boots', level: 2 }
    ]
  },
  // 24. Ollie the Otter (Aquatic Guardians)
  {
    id: '24',
    key: 'ollie',
    name: 'Ollie the Otter',
    shortName: 'Ollie',
    title: 'The River Craftmaster',
    archetype: 'aquatic',
    element: 'River Pebble & Rapid Foam Emerald',
    color: '#2980b9',
    accentColor: '#2ecc71',
    darkColor: '#154868',
    cardContainer: '#101e29',
    cardOutline: '#1abc9c',
    avatar: '/assets/pets/ollie.png',
    image: '/assets/pets/ollie.png',
    emoji: '🦦',
    backstory: 'Ollie floats happily on his back while assembling pebble castles and wooden stick rafts. Crafting and building are his favorite superpowers!',
    assignedHabit: 'Creative Play',
    habitBonus: 'River Builder: 2x Coins on all creative play and craft tasks',
    statBonusType: 'coin_boost',
    baseBonusPercent: 25,
    maxLevel: 25,
    workoutId: 'otter_river_paddle_tap',
    workoutName: "Ollie's River Paddle Tap",
    workoutInstructions: 'Sit with feet out, tap feet quickly like otter flippers, and pat your belly in rhythm!',
    exclusiveGear: [
      { name: 'River Pebble Armor', desc: '+25% Crafting & Building Tokens', icon: 'handyman', category: 'armor', level: 3 }
    ]
  }
];

export const PET_EMOJIS = {};
PETS_DATABASE.forEach(p => {
  PET_EMOJIS[p.id] = p.emoji;
  PET_EMOJIS[p.key] = p.emoji;
});

export const SANCTUARY_TREATS = [
  { id: 'crunchy_apple', name: 'Crunchy Orchard Apple', emoji: '🍎', color: '#e74c3c', hunger: 25, hungerFill: 25, energyFill: 15, joyBoost: 10, xpBoost: 20, costCoins: 0, unlockedByDefault: true, lore: 'Crisp sweet apple picked from the Sanctuary Meadow trees.' },
  { id: 'star_berry', name: 'Cosmic Starberry', emoji: '🍓', color: '#ffb961', hunger: 35, hungerFill: 35, energyFill: 25, joyBoost: 20, xpBoost: 35, costCoins: 10, unlockedByDefault: true, lore: 'Bursting with sparkling stardust juice that fills companions with joyful energy!' },
  { id: 'honey_crunch', name: 'Golden Honey Crunch', emoji: '🍯', color: '#f39c12', hunger: 45, hungerFill: 45, energyFill: 30, joyBoost: 25, xpBoost: 45, costCoins: 15, unlockedByDefault: true, lore: 'Sweet honeycomb cluster with golden sun crunch.' },
  { id: 'super_carrot', name: 'Heroic Mega Carrot', emoji: '🥕', color: '#e67e22', hunger: 50, hungerFill: 50, energyFill: 40, joyBoost: 30, xpBoost: 55, costCoins: 20, unlockedByDefault: true, lore: 'Super-charged with vibrant vitamin power for giant high leaps!' }
];

export function getPetArchetype(pet) {
  if (!pet) return PET_ARCHETYPES.dino;
  const key = typeof pet === 'string' ? pet : (pet.archetype || 'dino');
  return PET_ARCHETYPES[key] || PET_ARCHETYPES.dino;
}

export function getPetLevelData(level = 1) {
  const lvl = Math.max(1, Math.min(25, Math.floor(level || 1)));
  
  let milestoneTitle = 'Rookie Companion';
  let badgeIcon = 'pets';
  let badgeColor = 'text-cyan-400 bg-cyan-950/60 border-cyan-400/40';

  if (lvl >= 25) {
    milestoneTitle = 'Apex Titan';
    badgeIcon = 'military_tech';
    badgeColor = 'text-amber-300 bg-amber-950/60 border-amber-400/50';
  } else if (lvl >= 20) {
    milestoneTitle = 'Mythic Vanguard';
    badgeIcon = 'auto_awesome';
    badgeColor = 'text-teal-300 bg-teal-950/60 border-teal-400/50';
  } else if (lvl >= 15) {
    milestoneTitle = 'Master Hero';
    badgeIcon = 'verified';
    badgeColor = 'text-emerald-400 bg-emerald-950/60 border-emerald-400/40';
  } else if (lvl >= 10) {
    milestoneTitle = 'Champion Guardian';
    badgeIcon = 'shield';
    badgeColor = 'text-blue-400 bg-blue-950/60 border-blue-400/40';
  } else if (lvl >= 5) {
    milestoneTitle = 'Apprentice Scout';
    badgeIcon = 'stars';
    badgeColor = 'text-yellow-300 bg-yellow-950/60 border-yellow-400/40';
  }

  // +2% stat bonus per level above 1, up to +48% bonus at Level 25
  const incrementalBonusPercent = (lvl - 1) * 2;
  const xpNeededForNext = lvl < 25 ? lvl * 100 : 0;

  return {
    level: lvl,
    maxLevel: 25,
    title: milestoneTitle,
    badgeIcon,
    badgeColor,
    bonusPercent: incrementalBonusPercent,
    xpNeededForNext
  };
}

export function calculatePetStatBonus(pet, level = 1) {
  if (!pet) return { bonusPercent: 0, label: '+0%' };
  const lvlData = getPetLevelData(level);
  const base = pet.baseBonusPercent || 15;
  const totalPercent = base + lvlData.bonusPercent;
  return {
    bonusPercent: totalPercent,
    label: `+${totalPercent}%`,
    statType: pet.statBonusType || 'coin_boost',
    milestoneTitle: lvlData.title
  };
}

export function getPetBondBonus(level = 1) {
  return getPetLevelData(level);
}

export function getPetById(id) {
  if (id === undefined || id === null) return PETS_DATABASE[0];
  const idStr = String(id).toLowerCase().trim();
  return PETS_DATABASE.find(p => 
    String(p.id).toLowerCase() === idStr ||
    (p.key && p.key.toLowerCase() === idStr) ||
    p.name.toLowerCase().includes(idStr) ||
    p.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(idStr.replace(/[^a-z0-9]/g, ''))
  ) || PETS_DATABASE[0];
}

export function getDailyRotatingPetCoach() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const petIdx = dayOfYear % PETS_DATABASE.length;
  return PETS_DATABASE[petIdx] || PETS_DATABASE[0];
}
