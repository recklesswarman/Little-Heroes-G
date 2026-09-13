export function makePetSvg(emoji, bgGradient, glowColor) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
    <defs>
      <radialGradient id="bg-${glowColor.replace('#','')}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${glowColor}" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#0f172a" stop-opacity="0.95"/>
      </radialGradient>
      <filter id="glow-${glowColor.replace('#','')}">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="${glowColor}" flood-opacity="0.6"/>
      </filter>
    </defs>
    <circle cx="60" cy="60" r="54" fill="url(#bg-${glowColor.replace('#','')})" stroke="${glowColor}" stroke-width="3"/>
    <circle cx="60" cy="60" r="44" fill="#1e293b" stroke="#334155" stroke-width="2"/>
    <text x="60" y="74" font-size="48" text-anchor="middle" filter="url(#glow-${glowColor.replace('#','')})">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PETS_DATABASE = [
  {
    id: '1',
    name: 'Rex the T-Rex',
    title: 'The Apex Stomper',
    element: 'Earth & Thunder',
    color: '#2ecc71',
    accentColor: '#f1c40f',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDnxgEa6LgbgAkDctHBACUsubrRh0U8vMmbJxq4ACCWYwyxf7800JbNv-noivBha5t7iGBEgs-YsbsGmoo1xKaGtP49xpYLBxuV_-5Xeem4_4CfYg8RwvbaFbrHewRdEcY_Kqgh2Ep9mGvfKL3wxqEK9KBXuBiBTkrgdgQeIzjdJY4AMhn6WLNE-9UrpirWUPIn35lB_Z8hsegZ5dYgugCCqy5JsNgkzB8tu-dvmgFCDFLsddPsW8GwUA',
    evolvedAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDnxgEa6LgbgAkDctHBACUsubrRh0U8vMmbJxq4ACCWYwyxf7800JbNv-noivBha5t7iGBEgs-YsbsGmoo1xKaGtP49xpYLBxuV_-5Xeem4_4CfYg8RwvbaFbrHewRdEcY_Kqgh2Ep9mGvfKL3wxqEK9KBXuBiBTkrgdgQeIzjdJY4AMhn6WLNE-9UrpirWUPIn35lB_Z8hsegZ5dYgugCCqy5JsNgkzB8tu-dvmgFCDFLsddPsW8GwUA',
    backstory: 'Rex burst out of the Prehistoric Jungle with the most thunderous roar ever heard! He stomps so hard the ground shakes, and he loves coaching little heroes to run faster and lift their knees higher than any dino in the land!',
    habitBonus: 'Knee Lifter: +20 Coins for every physical activity task completed',
    assignedHabit: 'Active Play / Sports',
    baseStats: { hunger: 90, hygiene: 60, energy: 100, joy: 90 },
    evolutionStages: ['Tiny Hatchling', 'Jungle Crusher', 'Armored Titan', 'Apex Cyber T-Rex'],
    exclusiveGear: [
      { name: 'Titanium Spiked Collar', desc: '+30 Strength on all physical tasks', icon: 'military_tech' },
      { name: 'Stomper Dino Boots', desc: 'Doubles running speed in workouts', icon: 'directions_run' },
      { name: 'Roar Megaphone', desc: '+15% XP on all active play quests', icon: 'campaign' }
    ],
    archetype: 'dino',
    workoutId: 'trex_run'
  },
  {
    id: '2',
    name: 'Raptor the Velociraptor',
    title: 'The Lightning Sprinter',
    element: 'Wind & Speed',
    color: '#e74c3c',
    accentColor: '#f1c40f',
    avatar: makePetSvg('🦎', 'Raptor', '#e74c3c'),
    evolvedAvatar: makePetSvg('🦎', 'Raptor', '#e74c3c'),
    backstory: 'Raptor dashes so fast that lightning bolts trail behind her claws! She is the first one up every morning and dares little heroes to run in place as fast as their legs can go — she will always run faster!',
    habitBonus: 'Speedy Start: +15 Coins if morning chores are done before 8 AM',
    assignedHabit: 'Morning Routine',
    baseStats: { hunger: 75, hygiene: 70, energy: 100, joy: 95 },
    evolutionStages: ['Claw Hatchling', 'Jungle Scout', 'Storm Runner', 'Galactic Apex Raptor'],
    exclusiveGear: [
      { name: 'Speed Shades', desc: 'Reduces daily task cooldowns by 20%', icon: 'speed' },
      { name: 'Raptor Claws', desc: '+25% Coins on morning routine completions', icon: 'back_hand' },
      { name: 'Sunrise Bell', desc: 'Bonus sparkle notification at 7 AM', icon: 'notifications_active' }
    ],
    archetype: 'dino',
    workoutId: 'velociraptor_run'
  },
  {
    id: '3',
    name: 'Stego the Stegosaurus',
    title: 'The Solar Stomper',
    element: 'Earth & Sun',
    color: '#f1c40f',
    accentColor: '#2ecc71',
    avatar: makePetSvg('🦕', 'Stego', '#f1c40f'),
    evolvedAvatar: makePetSvg('🦕', 'Stego', '#f1c40f'),
    backstory: 'Stego has magnificent solar plates on his back that soak up sunshine energy while he plays outside! He loves showing little heroes how to stomp loudly on their hands and feet just like a real stegosaurus charging through the meadow.',
    habitBonus: 'Stomper Power: +25 Coins on outdoor play and exercise tasks',
    assignedHabit: 'Outdoor Play',
    baseStats: { hunger: 85, hygiene: 65, energy: 90, joy: 85 },
    evolutionStages: ['Plate Egg', 'Sunray Hatchling', 'Solar Guardian', 'Radiant Titan Stego'],
    exclusiveGear: [
      { name: 'Sun Absorption Hat', desc: '+20 Energy on sunny-day tasks', icon: 'light_mode' },
      { name: 'Golden Tail Spikes', desc: 'Doubles outdoor play coin rewards', icon: 'change_history' },
      { name: 'Stomp Pad', desc: '+15 Joy during movement exercises', icon: 'nature_people' }
    ],
    archetype: 'dino',
    workoutId: 'stegosaurus_walks'
  },
  {
    id: '4',
    name: 'Pterry the Pterodactyl',
    title: 'The Sky Launcher',
    element: 'Air & Storm',
    color: '#9b59b6',
    accentColor: '#3498db',
    avatar: makePetSvg('🦇', 'Pterry', '#9b59b6'),
    evolvedAvatar: makePetSvg('🦇', 'Pterry', '#9b59b6'),
    backstory: 'Pterry soars above the clouds with wings spread wide, diving through storm clouds and popping back up higher than ever! She challenges little heroes to spread their arms like wings and jump as high as they can reach into the sky.',
    habitBonus: 'Sky Launcher: 2x XP on all jumping and stretching exercises',
    assignedHabit: 'Stretch & Exercise',
    baseStats: { hunger: 70, hygiene: 80, energy: 95, joy: 90 },
    evolutionStages: ['Wind Egg', 'Sky Hatchling', 'Storm Wing', 'Cosmic Apex Pterodactyl'],
    exclusiveGear: [
      { name: 'Aero Goggles', desc: '+15% XP on all stretch tasks', icon: 'flight' },
      { name: 'Thundercloud Wing Bands', desc: 'Doubles jumping exercise rewards', icon: 'fitness_center' },
      { name: 'Altitude Cape', desc: 'Soars through challenge quests faster', icon: 'cloud' }
    ],
    archetype: 'dino',
    workoutId: 'pterodactyl_takeoff'
  },
  {
    id: '5',
    name: 'Chomper the Compsognathus',
    title: 'The Tiny Dancer',
    element: 'Fire & Rhythm',
    color: '#1abc9c',
    accentColor: '#f39c12',
    avatar: makePetSvg('🦖', 'Chomper', '#1abc9c'),
    evolvedAvatar: makePetSvg('🦖', 'Chomper', '#1abc9c'),
    backstory: 'Chomper may be the smallest dino in the sanctuary, but he has the biggest dance moves! He bounces left and right crossing his little legs so fast they blur. No hero can out-prance this tiny teal tornado of energy!',
    habitBonus: 'Prancer Bonus: +30 Coins for completing dance or movement tasks',
    assignedHabit: 'Dance & Movement',
    baseStats: { hunger: 80, hygiene: 75, energy: 95, joy: 100 },
    evolutionStages: ['Tiny Egg', 'Bounce Hatchling', 'Rhythm Scout', 'Electric Apex Chomper'],
    exclusiveGear: [
      { name: 'Glow Dance Shoes', desc: '+25% Joy from all dance activities', icon: 'music_note' },
      { name: 'Sparkle Bowtie', desc: 'Doubles Dance Party coin rewards', icon: 'stars' },
      { name: 'Rhythm Wristband', desc: '+20 XP on movement milestone tasks', icon: 'headphones' }
    ],
    archetype: 'dino',
    workoutId: 'compsognathus_prance'
  },
  {
    id: '6',
    name: 'Brachio the Brachiosaurus',
    title: 'The Great Stretcher',
    element: 'Earth & Nature',
    color: '#34495e',
    accentColor: '#2ecc71',
    avatar: makePetSvg('🦕', 'Brachio', '#34495e'),
    evolvedAvatar: makePetSvg('🦕', 'Brachio', '#34495e'),
    backstory: 'Brachio reaches the very tops of the tallest trees with his incredibly long neck! He shows little heroes that stretching tall on tip toes and reaching for the stars is how you grow strong. How high can YOU reach, little hero?',
    habitBonus: 'Tall Stretch: +20 XP every time you reach for the stars in exercise',
    assignedHabit: 'Yoga & Stretching',
    baseStats: { hunger: 90, hygiene: 70, energy: 75, joy: 85 },
    evolutionStages: ['Long-Neck Egg', 'Sapling Hatchling', 'Canopy Grazer', 'Ancient Titan Brachio'],
    exclusiveGear: [
      { name: 'Yoga Mat Saddle', desc: '+30% XP on all stretching routines', icon: 'self_improvement' },
      { name: 'Treetop Leaf Crown', desc: '+20 Coins on daily calm-down tasks', icon: 'eco' },
      { name: 'Giant Stretchy Scarf', desc: 'Unlocks bonus flexibility challenges', icon: 'straighten' }
    ],
    archetype: 'dino',
    workoutId: 'brachiosaurus_stretch'
  },
  {
    id: '7',
    name: 'Dippy the Diplodocus',
    title: 'The Balance Master',
    element: 'Earth & Water',
    color: '#e67e22',
    accentColor: '#2ecc71',
    avatar: makePetSvg('🦕', 'Dippy', '#e67e22'),
    evolvedAvatar: makePetSvg('🦕', 'Dippy', '#e67e22'),
    backstory: 'Dippy balances perfectly on floating logs using his incredible long tail as a counterweight! He coaches little heroes through the ancient Diplodocus move: on hands and knees, reach one arm and opposite leg out, and feel the balance power!',
    habitBonus: 'Balance Master: +25 Coins on balance and coordination tasks',
    assignedHabit: 'Balance & Flexibility',
    baseStats: { hunger: 85, hygiene: 75, energy: 80, joy: 85 },
    evolutionStages: ['Wobble Egg', 'Log Hatchling', 'River Balancer', 'Majestic Diplodocus Champion'],
    exclusiveGear: [
      { name: 'Balance Beam Bridge', desc: 'Doubles coordination task rewards', icon: 'line_weight' },
      { name: 'Golden Tail Ring', desc: '+20 XP on all balance exercises', icon: 'toll' },
      { name: 'Grip Boosters', desc: 'No slipping during workout moves!', icon: 'pan_tool' }
    ],
    archetype: 'dino',
    workoutId: 'diplodocus'
  },
  {
    id: '8',
    name: 'Spino the Spinosaurus',
    title: 'The Cool-Down King',
    element: 'Water & Wind',
    color: '#c0392b',
    accentColor: '#3498db',
    avatar: makePetSvg('🦖', 'Spino', '#c0392b'),
    evolvedAvatar: makePetSvg('🦖', 'Spino', '#c0392b'),
    backstory: 'Spino has a magnificent sail fin on his back that fans the air to cool him down after mighty adventures. He teaches little heroes the most important dino move of all: the Spinosaurus Stretch, arching your back to the sky like a real sail!',
    habitBonus: 'Spine Arch: +15 XP on all cool-down and stretching routines',
    assignedHabit: 'Cool Down & Recovery',
    baseStats: { hunger: 85, hygiene: 80, energy: 80, joy: 85 },
    evolutionStages: ['Sail Egg', 'River Hatchling', 'Fin Guardian', 'Legendary Spinosaurus Apex'],
    exclusiveGear: [
      { name: 'Cooling Fin Towel', desc: '+20 Hygiene after every workout', icon: 'water_drop' },
      { name: 'Aerodynamic Spine Fin', desc: '+25 XP on recovery activities', icon: 'air' },
      { name: 'Hero Water Bottle', desc: 'Stay hydrated, +10 Energy daily', icon: 'local_drink' }
    ],
    archetype: 'dino',
    workoutId: 'spinosaurus_stretch'
  },
  {
    id: '9',
    name: 'Sparky the Dragon',
    title: 'The Azure Ember',
    element: 'Fire & Wind',
    color: '#3498db',
    accentColor: '#2ecc71',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB-tO1SdRfRGAdffGZiLQxMfvzeWK75gnu-8V_g3uY_1zZSyW7V1gBj5eL8EaKNQ0bEYLoIJX8_MrJKE_FTNyJjWhMiDyFXcs11Vql8nzDOSXfGFkzBKSaEB6DiOvappqJJhiqFEEvVhDhFMqzCkZED1YDgAFVWcQOc0dn4cWiyd34yVJc9c7aF6_UYRrB4Ml5we64YPZuC17yjouHWXCGyOnqDbruj8B6sXSWQEcYhnNXJ0t-S4k1JPw',
    evolvedAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDAvmAOJ-g5TCJ7D4hM4PwtYHzTqQIYXOXhyWWDLDwhFMsBsPo7n1ZGFO7zgvDn8HsRTM1JluNg3gfIf-eDB6hqJ99SjsMCUHu-38PB79ADYgi0JrOC9cBOFyISVmxDFfso5KGTDn5nvPC2czsyoxTzdGH06Q-BHf5MQ97JziKb9qhzHgaYK8E0NyHUrFPTwQwa25aDebL2R2Dv_YyQ0X5GB1nmv7j9Lj51M97tF_RyxtbuZk08SRx7rg',
    backstory: 'Sparky was found atop Ember Mountain snoring softly in a bed of glowing crystals. He loves practicing tiny fire sneezes that blast away cavity germs, and his flame-fresh breath is always minty clean after every brushing session!',
    habitBonus: 'Dragon Breath: 2x Coins on every toothbrushing session',
    assignedHabit: 'Brush Teeth',
    baseStats: { hunger: 80, hygiene: 85, energy: 90, joy: 95 },
    evolutionStages: ['Mystic Egg', 'Azure Hatchling', 'Armored Teen Dragon', 'Golden Titan Dragon'],
    exclusiveGear: [
      { name: 'Mint Flame Shield', desc: 'Defends against sugar cavity germs', icon: 'shield' },
      { name: 'Sparkle Floss Lance', desc: '+30% Boss damage in Toothbrush Battles', icon: 'flare' },
      { name: 'Dragon Toothbrush', desc: '+25 Coins on 2-minute streak completions', icon: 'clean_hands' }
    ],
    archetype: 'dragon',
    workoutId: null
  },
  {
    id: '10',
    name: 'Aero the Griffin',
    title: 'The Solar Sentinel',
    element: 'Light & Air',
    color: '#f1c40f',
    accentColor: '#3498db',
    avatar: makePetSvg('🦅', 'Aero', '#f1c40f'),
    evolvedAvatar: makePetSvg('🦅', 'Aero', '#f1c40f'),
    backstory: 'Aero guards the golden constellations all night, soaring between star clusters with eagle-sharp eyes that can spot a homework assignment from three kingdoms away. He believes every little hero who studies gets a little more magical each day!',
    habitBonus: 'Eagle Eye: +25% XP on all homework and reading tasks',
    assignedHabit: 'Homework & Reading',
    baseStats: { hunger: 65, hygiene: 85, energy: 85, joy: 90 },
    evolutionStages: ['Star Chick', 'Griffin Guard', 'Solar Monarch', 'Apex Cosmic Griffin'],
    exclusiveGear: [
      { name: 'Mystic Reading Specs', desc: 'Reveals hidden bonus stars in books', icon: 'menu_book' },
      { name: 'Starlight Feather Pen', desc: '+30 Hero XP per study hour logged', icon: 'edit' },
      { name: 'Ancient Scroll Case', desc: 'Unlocks bonus Phonics learning adventures', icon: 'inventory' }
    ],
    archetype: 'mystic',
    workoutId: null
  },
  {
    id: '11',
    name: 'Blaze the Phoenix',
    title: 'The Midnight Flame',
    element: 'Fire & Stars',
    color: '#e74c3c',
    accentColor: '#f39c12',
    avatar: makePetSvg('🔥', 'Blaze', '#e74c3c'),
    evolvedAvatar: makePetSvg('🔥', 'Blaze', '#e74c3c'),
    backstory: 'Blaze rises from golden ashes each morning, brighter than ever before! Each evening she dims her flames to a warm cozy glow, wrapping little heroes in a soft ember light that makes falling asleep feel like drifting through a warm sunset sky.',
    habitBonus: 'Cozy Embers: +20 Coins for completing your bedtime routine on time',
    assignedHabit: 'Bedtime Routine',
    baseStats: { hunger: 70, hygiene: 80, energy: 75, joy: 95 },
    evolutionStages: ['Ember Egg', 'Flame Chick', 'Phoenix Blazer', 'Immortal Radiant Phoenix'],
    exclusiveGear: [
      { name: 'Starlight Nightcap', desc: 'Guarantees sweet dreams each night', icon: 'bedtime' },
      { name: 'Ash-Soft Blanket', desc: '+25 Joy from completing bedtime routine', icon: 'bed' },
      { name: 'Dream Catcher Ring', desc: '+10 Energy every morning after full routine', icon: 'filter_drama' }
    ],
    archetype: 'mystic',
    workoutId: null
  },
  {
    id: '12',
    name: 'Hydra the Sea Serpent',
    title: 'The Tidal Guardian',
    element: 'Water & Ice',
    color: '#2980b9',
    accentColor: '#1abc9c',
    avatar: makePetSvg('🐍', 'Hydra', '#2980b9'),
    evolvedAvatar: makePetSvg('🐍', 'Hydra', '#2980b9'),
    backstory: 'Hydra glides through crystal rivers carrying pure spring water to all the little heroes in the sanctuary! She knows the ancient secret: drinking water is the most powerful magic of all, making every adventure easier and every hero stronger!',
    habitBonus: 'Wave Rider: +15 XP every time you drink a cup of water',
    assignedHabit: 'Drink Water',
    baseStats: { hunger: 70, hygiene: 95, energy: 80, joy: 85 },
    evolutionStages: ['River Pearl', 'Tide Hatchling', 'Sea Guardian', 'Leviathan Ocean Hydra'],
    exclusiveGear: [
      { name: 'Crystal Coral Cup', desc: 'Each water log gives +5 bonus XP', icon: 'local_cafe' },
      { name: 'Scale Polish Kit', desc: 'Hygiene drains 30% slower', icon: 'water' },
      { name: 'Deep Ocean Gem', desc: '+20 Coins on completing hydration goals', icon: 'diamond' }
    ],
    archetype: 'aquatic',
    workoutId: null
  },
  {
    id: '13',
    name: 'Luna the Unicorn',
    title: 'The Rainbow Weaver',
    element: 'Light & Magic',
    color: '#9b59b6',
    accentColor: '#f1c40f',
    avatar: makePetSvg('🦄', 'Luna', '#9b59b6'),
    evolvedAvatar: makePetSvg('🦄', 'Luna', '#9b59b6'),
    backstory: 'Luna gallops across rainbow bridges leaving trails of sparkling stardust! She loves building magical block towers and painting every color in the sky. Luna believes that creativity makes you a true hero, and she wants to see what amazing things YOU will create today!',
    habitBonus: 'Magic Spark: +25% Coins on all creative play and art tasks',
    assignedHabit: 'Creative Play',
    baseStats: { hunger: 65, hygiene: 90, energy: 85, joy: 100 },
    evolutionStages: ['Moonbeam Egg', 'Rainbow Foal', 'Star Unicorn', 'Celestial Cosmos Luna'],
    exclusiveGear: [
      { name: 'Rainbow Paintbrush', desc: 'Paints with every color, +30% Art XP', icon: 'brush' },
      { name: 'Glitter Horn Crown', desc: 'Doubles creative challenge rewards', icon: 'star' },
      { name: 'Stardust Palette', desc: 'Unlocks bonus craft mini-games', icon: 'palette' }
    ],
    archetype: 'mystic',
    workoutId: null
  },
  {
    id: '14',
    name: 'Kira the Kirin',
    title: 'The Order Keeper',
    element: 'Wind & Nature',
    color: '#f39c12',
    accentColor: '#2ecc71',
    avatar: makePetSvg('🦌', 'Kira', '#f39c12'),
    evolvedAvatar: makePetSvg('🦌', 'Kira', '#f39c12'),
    backstory: 'Kira trots through her enchanted forest clearing, making sure every leaf is in the perfect spot and every pinecone is exactly where it belongs. She believes a tidy space is a magical space, and she will inspire YOU to feel the same!',
    habitBonus: 'Tidy Hooves: +30 XP when you clean your room completely',
    assignedHabit: 'Clean Room',
    baseStats: { hunger: 75, hygiene: 90, energy: 80, joy: 85 },
    evolutionStages: ['Forest Seed', 'Bamboo Fawn', 'Kirin Knight', 'Golden Celestial Kira'],
    exclusiveGear: [
      { name: 'Enchanted Dust Sweeper', desc: '+25 Coins on room cleaning tasks', icon: 'cleaning_services' },
      { name: 'Magical Toy Basket', desc: 'Auto-sorts items for +15 XP bonus', icon: 'shopping_basket' },
      { name: 'Golden Clean Bell', desc: 'Chimes when room is spotless, +20 Joy', icon: 'notifications' }
    ],
    archetype: 'mystic',
    workoutId: null
  },
  {
    id: '15',
    name: 'Boulder the Crystal Golem',
    title: 'The Iron Fortress',
    element: 'Stone & Earth',
    color: '#95a5a6',
    accentColor: '#2ecc71',
    avatar: makePetSvg('🪨', 'Boulder', '#95a5a6'),
    evolvedAvatar: makePetSvg('🪨', 'Boulder', '#95a5a6'),
    backstory: 'Boulder is built from pure ancient crystal and grows stronger with every vegetable he crunches! He proves that eating healthy food is what makes you truly unbreakable. Spinach gives him diamond-hard knuckles and carrots light up his glowing crystal eyes!',
    habitBonus: 'Rock Solid: +20 Coins for every healthy meal or snack logged',
    assignedHabit: 'Healthy Eating',
    baseStats: { hunger: 95, hygiene: 65, energy: 85, joy: 75 },
    evolutionStages: ['Pebble Golem', 'Quartz Scout', 'Crystal Titan', 'Diamond Apex Boulder'],
    exclusiveGear: [
      { name: 'Crystal Spoon', desc: '+25% XP on healthy eating tasks', icon: 'restaurant' },
      { name: 'Veggie Shield', desc: 'Prevents energy drain from junk food', icon: 'spa' },
      { name: 'Geode Power Bowl', desc: 'Doubles nutrition habit coin rewards', icon: 'fastfood' }
    ],
    archetype: 'beast',
    workoutId: null
  },
  {
    id: '16',
    name: 'Cosmo the Cyber Mech',
    title: 'The Quantum Hound',
    element: 'Tech & Cosmic',
    color: '#8e44ad',
    accentColor: '#3498db',
    avatar: makePetSvg('🤖', 'Cosmo', '#8e44ad'),
    evolvedAvatar: makePetSvg('🤖', 'Cosmo', '#8e44ad'),
    backstory: 'Cosmo travels across digital galaxies downloading knowledge at the speed of light! His holographic visor projects math puzzles and reading challenges in mid-air. He believes that every learning game is a secret upgrade to your brain mega-processor!',
    habitBonus: 'Data Download: 2x XP on all learning games and educational quests',
    assignedHabit: 'Learning Games',
    baseStats: { hunger: 70, hygiene: 85, energy: 95, joy: 90 },
    evolutionStages: ['Nano Pup', 'Cyber Hound', 'Quantum Vanguard', 'Galactic Apex Cosmo'],
    exclusiveGear: [
      { name: 'Logic Chip Collar', desc: '+30% Coins on learning game streaks', icon: 'memory' },
      { name: 'Holo Puzzle Screen', desc: 'Reveals hidden bonus stages in games', icon: 'tv' },
      { name: 'Infinite Smart Battery', desc: '+20 Energy daily for learning tasks', icon: 'battery_full' }
    ],
    archetype: 'robot',
    workoutId: null
  },
  {
    id: '17',
    name: 'Leo the Lion',
    title: 'The Pride Leader',
    element: 'Fire & Heart',
    color: '#f1c40f',
    accentColor: '#e67e22',
    avatar: makePetSvg('🦁', 'Leo', '#f1c40f'),
    evolvedAvatar: makePetSvg('🦁', 'Leo', '#f1c40f'),
    backstory: 'Leo leads his pride across the golden savannah and never leaves anyone behind! He teaches little heroes that real strength comes from working together as a team. Whether it is chores, homework, or adventures, the pride always finishes stronger together!',
    habitBonus: 'Pride Leader: +20 XP on all teamwork and cooperative tasks',
    assignedHabit: 'Teamwork',
    baseStats: { hunger: 90, hygiene: 70, energy: 90, joy: 90 },
    evolutionStages: ['Cub Scout', 'Mane Apprentice', 'Savannah King', 'Legendary Solar Leo'],
    exclusiveGear: [
      { name: 'Golden King Crown', desc: '+25% Coins on teamwork completions', icon: 'crown' },
      { name: 'Pride Friendship Crest', desc: 'Boosts sibling and group task rewards', icon: 'group' },
      { name: 'Roar Champion Medal', desc: '+30 XP on quest milestone completions', icon: 'emoji_events' }
    ],
    archetype: 'beast',
    workoutId: null
  },
  {
    id: '18',
    name: 'Stripe the Tiger',
    title: 'The Clean Paws',
    element: 'Water & Nature',
    color: '#e67e22',
    accentColor: '#2ecc71',
    avatar: makePetSvg('🐅', 'Stripe', '#e67e22'),
    evolvedAvatar: makePetSvg('🐅', 'Stripe', '#e67e22'),
    backstory: 'Stripe glowing orange stripes get brighter every time she scrubs her paws clean before a meal! She loves the soapy bubbles and warm water, and she roars with delight every single time, making handwashing the most exciting moment of her jungle day!',
    habitBonus: 'Clean Paws: +15 Coins every time you wash your hands before meals',
    assignedHabit: 'Wash Hands',
    baseStats: { hunger: 85, hygiene: 95, energy: 85, joy: 85 },
    evolutionStages: ['Stripe Cub', 'Jungle Scout', 'Tiger Champion', 'Radiant Apex Stripe'],
    exclusiveGear: [
      { name: 'Jungle Fruit Soap Bar', desc: '+20% Hygiene boost on each handwash', icon: 'soap' },
      { name: 'Hero Towel Cape', desc: 'Instant hygiene restore after bath', icon: 'dry' },
      { name: 'Splash Paw Guards', desc: 'Doubles hygiene task coin rewards', icon: 'water_drop' }
    ],
    archetype: 'beast',
    workoutId: null
  },
  {
    id: '19',
    name: 'Fang the Wolf',
    title: 'The Moonlight Scout',
    element: 'Shadow & Wind',
    color: '#7f8c8d',
    accentColor: '#2ecc71',
    avatar: makePetSvg('🐺', 'Fang', '#7f8c8d'),
    evolvedAvatar: makePetSvg('🐺', 'Fang', '#7f8c8d'),
    backstory: 'Fang howls at the moon every night, but only AFTER brushing those magnificent fangs until they sparkle like silver in the moonlight! He hears every toothbrush being picked up from miles away and howls with pride when little heroes keep their streak going!',
    habitBonus: 'Moonlight Shine: +20 XP for each completed toothbrushing session',
    assignedHabit: 'Brush Teeth',
    baseStats: { hunger: 80, hygiene: 85, energy: 90, joy: 85 },
    evolutionStages: ['Shadow Pup', 'Timber Wolf', 'Moon Hunter', 'Fenrir Alpha Wolf'],
    exclusiveGear: [
      { name: 'Silver Moon Crest', desc: 'Nighttime hygiene bonus +25%', icon: 'nightlight' },
      { name: 'Fang Guard Shield', desc: 'Prevents cavity boss attacks', icon: 'health_and_safety' },
      { name: 'Pack Howl Horn', desc: 'Group brushing rewards doubled', icon: 'campaign' }
    ],
    archetype: 'beast',
    workoutId: null
  },
  {
    id: '20',
    name: 'Scout the Eagle',
    title: 'The Sky Sentinel',
    element: 'Air & Light',
    color: '#3498db',
    accentColor: '#f1c40f',
    avatar: makePetSvg('🦅', 'Scout', '#3498db'),
    evolvedAvatar: makePetSvg('🦅', 'Scout', '#3498db'),
    backstory: 'Scout soars above the clouds spotting the best books from a mile high and diving to rescue lost homework scrolls before the wind carries them away! He has read every book in every library across all five kingdoms and is always hungry for more knowledge!',
    habitBonus: 'Sky Reader: +15 Coins on every homework and reading task completed',
    assignedHabit: 'Homework & Reading',
    baseStats: { hunger: 65, hygiene: 80, energy: 90, joy: 85 },
    evolutionStages: ['Sky Eaglet', 'Cloud Glider', 'Storm Talon Eagle', 'Solar Phoenix Lord'],
    exclusiveGear: [
      { name: 'Talon Bookmark', desc: '+20% XP on reading quests', icon: 'bookmark' },
      { name: 'Aviator Cap', desc: '+15 Speed on all quest map tasks', icon: 'flight' },
      { name: 'Golden Library Card', desc: 'Unlocks bonus Phonics adventures', icon: 'library_books' }
    ],
    archetype: 'mystic',
    workoutId: null
  },
  {
    id: '21',
    name: 'Gnasher the Shark',
    title: 'The Deep Diver',
    element: 'Water & Steel',
    color: '#3498db',
    accentColor: '#f1c40f',
    avatar: makePetSvg('🦈', 'Gnasher', '#3498db'),
    evolvedAvatar: makePetSvg('🦈', 'Gnasher', '#3498db'),
    backstory: 'Gnasher slices through the deepest ocean trenches with effortless grace, then surfaces at sundown for his most important ritual: a full bedtime routine before the ocean tucks him in under the waves. He never misses a single night, no matter how epic the swim!',
    habitBonus: 'Deep Rest: +25% XP for completing the full bedtime routine',
    assignedHabit: 'Bedtime Routine',
    baseStats: { hunger: 85, hygiene: 85, energy: 70, joy: 80 },
    evolutionStages: ['Reef Pup', 'Deep Diver', 'Steel Fin Shark', 'Megalodon Apex Gnasher'],
    exclusiveGear: [
      { name: 'Kelp Sleep Mask', desc: '+15 Energy every morning after full bedtime', icon: 'visibility_off' },
      { name: 'Buoyant Dream Fin', desc: '+20 Joy from bedtime routine completion', icon: 'sailing' },
      { name: 'Ocean Lullaby Shell', desc: 'Plays calming sounds, +10 XP at night', icon: 'music_note' }
    ],
    archetype: 'aquatic',
    workoutId: null
  },
  {
    id: '22',
    name: 'Shadow the Panther',
    title: 'The Silent Sweeper',
    element: 'Shadow & Earth',
    color: '#2c3e50',
    accentColor: '#9b59b6',
    avatar: makePetSvg('🐆', 'Shadow', '#2c3e50'),
    evolvedAvatar: makePetSvg('🐆', 'Shadow', '#2c3e50'),
    backstory: 'Shadow moves in pure silence, pouncing on scattered toys and chaos before anyone even notices! By the time you blink, every toy is where it belongs and the room is spotless. She makes tidying up look like the coolest ninja skill in the world!',
    habitBonus: 'Stealth Sweeper: +20 Coins for cleaning your room without being asked',
    assignedHabit: 'Clean Room',
    baseStats: { hunger: 80, hygiene: 85, energy: 90, joy: 85 },
    evolutionStages: ['Shadow Kitten', 'Jungle Prowler', 'Midnight Panther', 'Phantom Apex Shadow'],
    exclusiveGear: [
      { name: 'Ninja Silent Paws', desc: 'Speed-cleans rooms, +25% XP', icon: 'pets' },
      { name: 'Stealth Dark Cloak', desc: 'Room stays clean 20% longer', icon: 'dark_mode' },
      { name: 'Champion Toy Bag', desc: 'Holds 2x more items for +15 bonus Coins', icon: 'backpack' }
    ],
    archetype: 'beast',
    workoutId: null
  },
  {
    id: '23',
    name: 'Barnaby the Bear',
    title: 'The Honey Woodsman',
    element: 'Nature & Heart',
    color: '#d35400',
    accentColor: '#f1c40f',
    avatar: makePetSvg('🐻', 'Barnaby', '#d35400'),
    evolvedAvatar: makePetSvg('🐻', 'Barnaby', '#d35400'),
    backstory: 'Barnaby wandered out of the Whispering Woods with a pot of golden honey and the biggest appetite for healthy snacks! He gives the coziest bear hugs and always makes sure little heroes eat their fruits and veggies before the adventure can begin!',
    habitBonus: 'Bear Hug Boost: +15 XP for every healthy meal or snack logged',
    assignedHabit: 'Healthy Eating',
    baseStats: { hunger: 95, hygiene: 70, energy: 75, joy: 95 },
    evolutionStages: ['Woodland Cub', 'Forest Ranger', 'Grizzly Knight', 'Ursine Forest Lord'],
    exclusiveGear: [
      { name: 'Golden Honey Pot', desc: '+25 Joy on healthy eating tasks', icon: 'hive' },
      { name: 'Wild Berry Basket', desc: '+20% Coins on nutrition habit completions', icon: 'shopping_basket' },
      { name: 'Forest Lumberjack Hat', desc: '+10 Energy after every healthy meal', icon: 'park' }
    ],
    archetype: 'beast',
    workoutId: null
  },
  {
    id: '24',
    name: 'Ollie the Otter',
    title: 'The River Craftmaster',
    element: 'Water & Tech',
    color: '#2980b9',
    accentColor: '#2ecc71',
    avatar: makePetSvg('🦦', 'Ollie', '#2980b9'),
    evolvedAvatar: makePetSvg('🦦', 'Ollie', '#2980b9'),
    backstory: 'Ollie floats on his back in crystal brooks, using his clever paws to craft the most amazing river dams and tiny otter inventions! He believes that building something with your own hands, whether a Lego tower or a crayon masterpiece, is the greatest superpower of all!',
    habitBonus: 'River Builder: 2x Coins on all creative play and craft tasks',
    assignedHabit: 'Creative Play',
    baseStats: { hunger: 80, hygiene: 95, energy: 85, joy: 95 },
    evolutionStages: ['Pebble Pup', 'River Scout', 'Hydro Otter', 'Poseidon Craft Champion'],
    exclusiveGear: [
      { name: 'Master Building Blocks', desc: '+30% XP on creative challenges', icon: 'view_in_ar' },
      { name: 'Treasure Otter Pouch', desc: 'Holds bonus craft rewards', icon: 'cases' },
      { name: 'River Crafting Toolkit', desc: 'Unlocks secret art mini-games', icon: 'handyman' }
    ],
    archetype: 'aquatic',
    workoutId: null
  }
];

export const PET_EMOJIS = {
  '1': '🦖', '2': '🦎', '3': '🦕', '4': '🦇', '5': '🦖', '6': '🦕', '7': '🦕', '8': '🐊',
  '9': '🐉', '10': '🦅', '11': '🦚', '12': '🐍', '13': '🦄', '14': '🦌', '15': '💎', '16': '🤖',
  '17': '🦁', '18': '🐯', '19': '🐺', '20': '🦅', '21': '🦈', '22': '🐆', '23': '🐻', '24': '🦦'
};

PETS_DATABASE.forEach(p => {
  if (!p.emoji) {
    p.emoji = PET_EMOJIS[p.id] || '🐾';
  }
});

export const PET_ARCHETYPES = {
  dino: { id: 'dino', name: 'Prehistoric Dino', emoji: '🦖' },
  dragon: { id: 'dragon', name: 'Dragon', emoji: '🐉' },
  beast: { id: 'beast', name: 'Beast', emoji: '🐻' },
  aquatic: { id: 'aquatic', name: 'Aquatic', emoji: '🦈' },
  robot: { id: 'robot', name: 'Robot', emoji: '🤖' },
  mystic: { id: 'mystic', name: 'Mystic', emoji: '✨' }
};

export const SANCTUARY_TREATS = [
  { id: 'crunchy_apple', name: 'Crunchy Orchard Apple', emoji: '🍎', color: '#e74c3c', hunger: 25, hungerFill: 25, energyFill: 15, joyBoost: 10, bondXp: 20, costCoins: 0, unlockedByDefault: true, lore: 'Crisp sweet apple picked from the Sanctuary Meadow trees.' },
  { id: 'star_berry', name: 'Cosmic Starberry', emoji: '🍓', color: '#ffb961', hunger: 35, hungerFill: 35, energyFill: 25, joyBoost: 20, bondXp: 35, costCoins: 10, unlockedByDefault: true, lore: 'Bursting with sparkling stardust juice that fills companions with joyful energy!' },
  { id: 'honey_crunch', name: 'Golden Honey Crunch', emoji: '🍯', color: '#f39c12', hunger: 45, hungerFill: 45, energyFill: 30, joyBoost: 25, bondXp: 45, costCoins: 15, unlockedByDefault: true, lore: 'Sweet honeycomb cluster with golden sun crunch.' },
  { id: 'super_carrot', name: 'Heroic Mega Carrot', emoji: '🥕', color: '#e67e22', hunger: 50, hungerFill: 50, energyFill: 40, joyBoost: 30, bondXp: 55, costCoins: 20, unlockedByDefault: true, lore: 'Super-charged with vibrant vitamin power for giant high leaps!' }
];

export function getPetArchetype(pet) {
  if (!pet) return PET_ARCHETYPES.dino;
  const key = typeof pet === 'string' ? pet : pet.archetype;
  return (key && PET_ARCHETYPES[key]) ? PET_ARCHETYPES[key] : PET_ARCHETYPES.dino;
}

export function getPetBondBonus(level = 1) {
  const lvl = Math.max(1, Math.min(10, Math.floor(level || 1)));
  const titles = [
    'New Companion',
    'Playful Buddy',
    'Trusted Friend',
    'Heroic Partner',
    'Loyal Guardian',
    'Adventure Champion',
    'Starlight Ally',
    'Invincible Bond',
    'Mythic Duo',
    'Inseparable Soulmate'
  ];

  return {
    level: lvl,
    title: titles[lvl - 1] || 'Loyal Guardian',
    coinBoostPercent: lvl * 5, // +5% to +50%
    bossDeflectAssistDamage: 10 + (lvl * 3),
    expeditionFuelBonus: lvl >= 5 ? 25 : 0,
    pearlyGleam: lvl >= 5,
    pearlyGleamPerk: lvl >= 5,
    xpToNext: lvl < 10 ? lvl * 100 : 0
  };
}

export function getPetById(id) {
  if (id === undefined || id === null) return PETS_DATABASE[0];
  const idStr = String(id).toLowerCase().trim();
  return PETS_DATABASE.find(p => 
    String(p.id).toLowerCase() === idStr ||
    p.name.toLowerCase().includes(idStr) ||
    p.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(idStr.replace(/[^a-z0-9]/g, ''))
  ) || PETS_DATABASE[0];
}
