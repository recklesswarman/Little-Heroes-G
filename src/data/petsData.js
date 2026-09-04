// 24 Unique Pets of the Little Heroes Universe
// Purely creature/pet companions with distinct lore, element colors, and stats.
// Strictly NO item/shop mixups.

function makePetSvg(emoji, bgGradient, glowColor) {
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
    id: 1,
    name: "Sparky the Dragon",
    title: "The Azure Ember",
    element: "Fire & Wind",
    color: "#3498db",
    accentColor: "#2ecc71",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuB-tO1SdRfRGAdffGZiLQxMfvzeWK75gnu-8V_g3uY_1zZSyW7V1gBj5eL8EaKNQ0bEYLoIJX8_MrJKE_FTNyJjWhMiDyFXcs11Vql8nzDOSXfGFkzBKSaEB6DiOvappqJJhiqFEEvVhDhFMqzCkZED1YDgAFVWcQOc0dn4cWiyd34yVJc9c7aF6_UYRrB4Ml5we64YPZuC17yjouHWXCGyOnqDbruj8B6sXSWQEcYhnNXJ0t-S4k1JPw",
    evolvedAvatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDAvmAOJ-g5TCJ7D4hM4PwtYHzTqQIYXOXhyWWDLDwhFMsBsPo7n1ZGFO7zgvDn8HsRTM1JluNg3gfIf-eDB6hqJ99SjsMCUHu-38PB79ADYgi0JrOC9cBOFyISVmxDFfso5KGTDn5nvPC2czsyoxTzdGH06Q-BHf5MQ97JziKb9qhzHgaYK8E0NyHUrFPTwQwa25aDebL2R2Dv_YyQ0X5GB1nmv7j9Lj51M97tF_RyxtbuZk08SRx7rg",
    backstory: "Sparky was found atop Ember Mountain snoring softly in a bed of glowing crystals. He loves practicing tiny fire sneezes and flying loops around the canopy trees!",
    habitBonus: "Flame Stamina: Grants +25% Habit Coins from Physical Activity & Sports tasks.",
    assignedHabit: "Active Play / Sports",
    baseStats: { hunger: 80, hygiene: 65, energy: 90, joy: 95 },
    evolutionStages: ["Mystic Egg", "Azure Hatchling", "Armored Teen Dragon", "Golden Titan Dragon"],
    exclusiveGear: [
      { name: "Golden Crest Plate", desc: "+30 Defense in Boss Battles", unlocked: true, icon: "shield" },
      { name: "Flame Core Ring", desc: "+15% Coin drops on all tasks", unlocked: false, icon: "local_fire_department" },
      { name: "Solar Wing Spikes", desc: "Doubles flying mini-game speed", unlocked: false, icon: "flight" }
    ]
  },
  {
    id: 2,
    name: "Rex the Dino",
    title: "The Loyal Guardian",
    element: "Earth & Forest",
    color: "#2ecc71",
    accentColor: "#f39c12",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDnxgEa6LgbgAkDctHBACUsubrRh0U8vMmbJxq4ACCWYwyxf7800JbNv-noivBha5t7iGBEgs-YsbsGmoo1xKaGtP49xpYLBxuV_-5Xeem4_4CfYg8RwvbaFbrHewRdEcY_Kqgh2Ep9mGvfKL3wxqEK9KBXuBiBTkrgdgQeIzjdJY4AMhn6WLNE-9UrpirWUPIn35lB_Z8hsegZ5dYgugCCqy5JsNgkzB8tu-dvmgFCDFLsddPsW8GwUA",
    backstory: "Rex stomped out of the Prehistoric Jungle looking for big adventures and crunchy snacks. He is indestructible, cheerful, and loves helping pack away heavy toys!",
    habitBonus: "Tidy Titan: Grants +5 Bonus Points when completing 'Clean Toy Chest'.",
    assignedHabit: "Clean Toys",
    baseStats: { hunger: 85, hygiene: 60, energy: 95, joy: 90 },
    evolutionStages: ["Fossil Egg", "Baby Rex", "Jungle Crusher", "Apex Cyber Dino"],
    exclusiveGear: [
      { name: "Heavy Spiked Collar", desc: "Adds +20 Strength to Toy Cleaning", unlocked: true, icon: "fitness_center" },
      { name: "Titanium Tail Club", desc: "Instantly smashes through quest obstacles", unlocked: false, icon: "sports_kabaddi" },
      { name: "Golden Horn Crown", desc: "+25% XP multiplier", unlocked: false, icon: "military_tech" }
    ]
  },
  {
    id: 3,
    name: "Barnaby the Bear",
    title: "The Honey Woodsman",
    element: "Nature",
    color: "#f39c12",
    accentColor: "#2ecc71",
    avatar: makePetSvg("🐻", "bear", "#f39c12"),
    backstory: "Barnaby wandered out of the Whispering Woods with a pot of golden honey. He gives the coziest hugs and knows all about setting up warm bedtimes!",
    habitBonus: "Sleep Champion: Grants +10 Gold Points on 'Bedtime Routine' completed on time.",
    assignedHabit: "Bedtime Routine",
    baseStats: { hunger: 70, hygiene: 75, energy: 60, joy: 95 },
    evolutionStages: ["Woodland Cub", "Forest Ranger", "Grizzly Knight", "Ursine Forest Lord"],
    exclusiveGear: [
      { name: "Honey Pot Helmet", desc: "Protects against nighttime monster dreams", unlocked: true, icon: "shield" },
      { name: "Cozy Plaid Scarf", desc: "Increases Bedtime Joy by +30%", unlocked: false, icon: "checkroom" },
      { name: "Pine Tree Shield", desc: "+10 Daily Coin generation", unlocked: false, icon: "park" }
    ]
  },
  {
    id: 4,
    name: "Hydro the Turtle",
    title: "The Tidal Tank",
    element: "Water",
    color: "#007bff",
    accentColor: "#2ecc71",
    avatar: makePetSvg("🐢", "turtle", "#007bff"),
    backstory: "Hydro swims the deepest crystal rivers and carries pure spring water to all woodland heroes. He never gets thirsty and reminds everyone to drink up!",
    habitBonus: "Aqua Surge: Grants +20 Coins and +10 XP every time you log a water cup.",
    assignedHabit: "Drink Water",
    baseStats: { hunger: 75, hygiene: 95, energy: 70, joy: 85 },
    evolutionStages: ["River Pebble", "Splash Turtle", "Shell Tank", "Leviathan Protector"],
    exclusiveGear: [
      { name: "Coral Plated Shell", desc: "Reflects enemy germ attacks", unlocked: true, icon: "security" },
      { name: "Hydro Jet Boosters", desc: "Boosts Hygiene recovery in Bath Time by +50%", unlocked: false, icon: "speed" },
      { name: "Pearl Goggles", desc: "Unlocks underwater exploration quests", unlocked: false, icon: "visibility" }
    ]
  },
  {
    id: 5,
    name: "Gnasher the Shark",
    title: "The Cavity Crusher",
    element: "Water & Steel",
    color: "#3498db",
    accentColor: "#f1c40f",
    avatar: makePetSvg("🦈", "shark", "#3498db"),
    backstory: "Gnasher has 300 ultra-clean teeth that sparkle like diamonds in the ocean. He loves hunting Sugar Bugs and turning them into bubbles!",
    habitBonus: "Laser Bite: Deals 2x damage during Toothbrush AR Boss Battles!",
    assignedHabit: "Brush Teeth",
    baseStats: { hunger: 90, hygiene: 100, energy: 90, joy: 80 },
    evolutionStages: ["Chomp Egg", "Reef Pup", "Steel Fin Shark", "Megalodon Apex"],
    exclusiveGear: [
      { name: "Diamond Toothguard", desc: "Triples brushing battle critical hits", unlocked: true, icon: "dentistry" },
      { name: "Sonar Fin Laser", desc: "Auto-targets hidden cavity monsters", unlocked: false, icon: "radar" },
      { name: "Golden Shark Belt", desc: "+50 Coins on 2-min toothbrush streak", unlocked: false, icon: "stars" }
    ]
  },
  {
    id: 6,
    name: "Bolt the Cheetah",
    title: "The Electric Sprinter",
    element: "Lightning",
    color: "#f1c40f",
    accentColor: "#007bff",
    avatar: makePetSvg("🐆", "cheetah", "#f1c40f"),
    backstory: "Bolt runs so fast that lightning sparks trail behind his sneakers! He loves outdoor tag, morning stretches, and racing clouds.",
    habitBonus: "Speedy Morning: +15 Coins if morning chores are finished before 8:00 AM.",
    assignedHabit: "Morning Routine",
    baseStats: { hunger: 85, hygiene: 70, energy: 100, joy: 90 },
    evolutionStages: ["Spark Cub", "Quickrunner", "Thunder Fang", "Cosmic Velocity Cheetah"],
    exclusiveGear: [
      { name: "Shockwave Sneakers", desc: "Speeds up daily task cooldowns", unlocked: true, icon: "electric_bolt" },
      { name: "Thunder Visor", desc: "+20% Points on outdoor tasks", unlocked: false, icon: "wb_sunny" },
      { name: "Plasma Tail Band", desc: "Lightning burst on quest completion", unlocked: false, icon: "flare" }
    ]
  },
  {
    id: 7,
    name: "Archie the Scholar Owl",
    title: "The Wisdom Sage",
    element: "Air & Mind",
    color: "#202b35",
    accentColor: "#f1c40f",
    avatar: makePetSvg("🦉", "owl", "#f1c40f"),
    backstory: "Archie lives inside the Grand Library of Hero Mountain. He reads 10 books before breakfast and knows ancient spells to help with schoolwork!",
    habitBonus: "Brain Boost: Awards 2x XP for all Reading and Homework quests.",
    assignedHabit: "Homework & Reading",
    baseStats: { hunger: 60, hygiene: 85, energy: 80, joy: 90 },
    evolutionStages: ["Fledgling", "Book Owl", "Grand Scholar", "Celestial Chrono Owl"],
    exclusiveGear: [
      { name: "Mystic Reading Specs", desc: "Highlights secret bonuses in books", unlocked: true, icon: "auto_stories" },
      { name: "Rune Scroll Cape", desc: "+30 Hero XP per study hour", unlocked: false, icon: "history_edu" },
      { name: "Starlight Quill", desc: "Unlocks bonus Phonics learning mini-games", unlocked: false, icon: "draw" }
    ]
  },
  {
    id: 8,
    name: "Titan the Rhino",
    title: "The Iron Fortress",
    element: "Metal & Earth",
    color: "#2b3640",
    accentColor: "#54e98a",
    avatar: makePetSvg("🦏", "rhino", "#54e98a"),
    backstory: "Titan's horn is forged from enchanted steel. Nothing can knock him down, and he loves helping tidy up heavy backpacks and shoes!",
    habitBonus: "Steadfast Shield: Prevents streak losses even if you miss a day once a week.",
    assignedHabit: "Put Away Shoes/Backpack",
    baseStats: { hunger: 90, hygiene: 60, energy: 85, joy: 75 },
    evolutionStages: ["Pebble Rhino", "Bulldozer", "Iron Crusher", "Titanium Colossus"],
    exclusiveGear: [
      { name: "Steel Horn Guard", desc: "Adds +40 Durability to Pet Pen", unlocked: true, icon: "shield" },
      { name: "Reinforced Plating", desc: "+10% Coin boost on heavy chores", unlocked: false, icon: "build" },
      { name: "Anvil Stompers", desc: "Shakes loose extra coins on tasks", unlocked: false, icon: "construction" }
    ]
  },
  {
    id: 9,
    name: "Flipper the Penguin",
    title: "The Arctic Knight",
    element: "Ice & Water",
    color: "#a3d3ff",
    accentColor: "#ffb961",
    avatar: makePetSvg("🐧", "penguin", "#a3d3ff"),
    backstory: "Flipper slides down icebergs with unmatched agility. He keeps himself clean and fresh like an arctic breeze!",
    habitBonus: "Frost Hygiene: Cleanliness stat drains 50% slower after taking a bath.",
    assignedHabit: "Daily Bath / Shower",
    baseStats: { hunger: 70, hygiene: 100, energy: 80, joy: 90 },
    evolutionStages: ["Ice Egg", "Snowy Chick", "Frost Knight", "Blizzard Emperor"],
    exclusiveGear: [
      { name: "Snow Goggles", desc: "Immunity to dirty suds in Bathtub mode", unlocked: true, icon: "ac_unit" },
      { name: "Frozen Cape", desc: "+25 Joy when playing water mini-games", unlocked: false, icon: "flutter" },
      { name: "Icicle Lance", desc: "Freezes Sugar Boss for 5 seconds in AR Battle", unlocked: false, icon: "dew_point" }
    ]
  },
  {
    id: 10,
    name: "Fang the Wolf",
    title: "The Moonlight Scout",
    element: "Shadow & Wind",
    color: "#16212b",
    accentColor: "#54e98a",
    avatar: makePetSvg("🐺", "wolf", "#54e98a"),
    backstory: "Fang leads his pack through misty pine valleys. He is loyal, attentive, and hears the sound of chores being completed from miles away!",
    habitBonus: "Pack Leader: +15% XP if you and your siblings complete all daily tasks.",
    assignedHabit: "Team / Sibling Help",
    baseStats: { hunger: 80, hygiene: 75, energy: 95, joy: 85 },
    evolutionStages: ["Shadow Pup", "Timber Wolf", "Moon Hunter", "Fenrir Alpha"],
    exclusiveGear: [
      { name: "Moonlight Crest", desc: "Nighttime habit point bonus +20%", unlocked: true, icon: "nightlight" },
      { name: "Shadowfang Claws", desc: "Extra damage against germ minions", unlocked: false, icon: "pets" },
      { name: "Alpha Banner", desc: "Boosts all sibling coin yields", unlocked: false, icon: "flag" }
    ]
  },
  {
    id: 11,
    name: "Chip the Beaver",
    title: "The Master Builder",
    element: "Wood & Tech",
    color: "#e89300",
    accentColor: "#2ecc71",
    avatar: makePetSvg("🦫", "beaver", "#e89300"),
    backstory: "Chip builds incredible wooden forts and bridges across rushing rivers. He loves craft projects, Lego building, and keeping his toolbox organized.",
    habitBonus: "Builder Buff: +30 Coins for creative homework, art, or building projects.",
    assignedHabit: "Art & Craft Cleanup",
    baseStats: { hunger: 75, hygiene: 70, energy: 90, joy: 95 },
    evolutionStages: ["Twig Kit", "Log Engineer", "Dam Commander", "Titanium Constructor"],
    exclusiveGear: [
      { name: "Yellow Safety Hardhat", desc: "Guarantees no failed chore attempts", unlocked: true, icon: "engineering" },
      { name: "Timber Toolbelt", desc: "Unlocks extra craft rewards in shop", unlocked: false, icon: "handyman" },
      { name: "Chainsaw Tail", desc: "Instantly harvests +50 Energy in pet pen", unlocked: false, icon: "electric_bolt" }
    ]
  },
  {
    id: 12,
    name: "Rocky the Mountain Ram",
    title: "The Peak Climber",
    element: "Stone",
    color: "#202b35",
    accentColor: "#ffb961",
    avatar: makePetSvg("🐏", "ram", "#ffb961"),
    backstory: "Rocky leaps up sheer cliff walls with boundless energy. He teaches young heroes that no goal is too high if you take it one step at a time!",
    habitBonus: "Climber Resolve: Reaching 7-day streak awards a bonus 100 Habit Coins.",
    assignedHabit: "Streak Maintenance",
    baseStats: { hunger: 80, hygiene: 65, energy: 95, joy: 85 },
    evolutionStages: ["Stone Lamb", "Cliff Hopper", "Iron Horn", "Mountain Sovereign"],
    exclusiveGear: [
      { name: "Granite Horns", desc: "Smashes through locked quest map barriers", unlocked: true, icon: "terrain" },
      { name: "Climber Carabiners", desc: "+15% Star rating score on Quest Map", unlocked: false, icon: "hiking" },
      { name: "Sunburst Bell", desc: "Chimes upon milestone completion", unlocked: false, icon: "notifications_active" }
    ]
  },
  {
    id: 13,
    name: "Scout the Eagle",
    title: "The Sky Sentinel",
    element: "Air",
    color: "#3498db",
    accentColor: "#f1c40f",
    avatar: makePetSvg("🦅", "eagle", "#3498db"),
    backstory: "Scout soars high above the clouds spotting lost items and guiding heroes through storms with eagle-eyed precision.",
    habitBonus: "Eagle Eye: Alerts you with special glowing sparkles when rare shop sales occur.",
    assignedHabit: "Find & Organize Items",
    baseStats: { hunger: 70, hygiene: 80, energy: 90, joy: 85 },
    evolutionStages: ["Sky Eaglet", "Cloud Glider", "Storm Talon", "Solar Phoenix Lord"],
    exclusiveGear: [
      { name: "Golden Aviator Goggles", desc: "Reveals hidden bonus stars on Quest Map", unlocked: true, icon: "visibility" },
      { name: "Feathered Wind Cloak", desc: "+20 Speed in all Pet Adventures", unlocked: false, icon: "air" },
      { name: "Talon Daggers", desc: "Adds +35 Damage in AR Toothbrush Battle", unlocked: false, icon: "colorize" }
    ]
  },
  {
    id: 14,
    name: "Grizzly the Gorilla",
    title: "The Jungle Titan",
    element: "Earth",
    color: "#121d26",
    accentColor: "#2ecc71",
    avatar: makePetSvg("🦍", "gorilla", "#2ecc71"),
    backstory: "Grizzly is the kindest giant in the canopy. He loves bananas, jungle gymnastics, and showing little heroes how to eat healthy foods!",
    habitBonus: "Nutrition Power: Eating vegetables or healthy snacks awards +35 Coins.",
    assignedHabit: "Healthy Eating",
    baseStats: { hunger: 95, hygiene: 65, energy: 90, joy: 90 },
    evolutionStages: ["Banana Baby", "Silverback Scout", "Jungle King", "Ancient Kong Titan"],
    exclusiveGear: [
      { name: "Emerald Chest Guard", desc: "+50% Joy from healthy snack rewards", unlocked: true, icon: "eco" },
      { name: "Bongo Drums", desc: "Unlocks extra jungle rhythm tracks in Dance Party", unlocked: false, icon: "speaker" },
      { name: "Vibrant Banana Belt", desc: "Instantly refills hunger bar once daily", unlocked: false, icon: "nutrition" }
    ]
  },
  {
    id: 15,
    name: "Dash the Fox",
    title: "The Clever Trickster",
    element: "Fire & Mind",
    color: "#e89300",
    accentColor: "#54e98a",
    avatar: makePetSvg("🦊", "fox", "#e89300"),
    backstory: "Dash weaves through dense brambles solving ancient riddles. He loves puzzle games, math quests, and finding hidden treasure chests.",
    habitBonus: "Puzzle Prodigy: 2x Coins earned from Phonics and Math Learning Adventures.",
    assignedHabit: "Learning Games",
    baseStats: { hunger: 75, hygiene: 80, energy: 90, joy: 95 },
    evolutionStages: ["Fox Kit", "Bramble Scout", "Kitsune Blade", "Solar Firefox Archon"],
    exclusiveGear: [
      { name: "Trickster Mask", desc: "Doubles daily puzzle streak score", unlocked: true, icon: "masks" },
      { name: "Flame Tail Band", desc: "Illuminates dark caves in Quest Map", unlocked: false, icon: "flare" },
      { name: "Golden Compass", desc: "Finds extra coin drops in every chore", unlocked: false, icon: "explore" }
    ]
  },
  {
    id: 16,
    name: "Bubbles the Hippo",
    title: "The Mud & Suds Hero",
    element: "Water",
    color: "#2b3640",
    accentColor: "#3498db",
    avatar: makePetSvg("🦛", "hippo", "#3498db"),
    backstory: "Bubbles plays in the mud all afternoon, but always takes the biggest, sudsiest bubble baths right before supper!",
    habitBonus: "Mega Suds: Bathtub minigame finishes in half the time with triple bubble points!",
    assignedHabit: "Wash Hands & Bath",
    baseStats: { hunger: 90, hygiene: 90, energy: 75, joy: 95 },
    evolutionStages: ["Mud Calf", "River Guardian", "Hydro Behemoth", "Oceanic Titan Hippo"],
    exclusiveGear: [
      { name: "Rubber Ducky Cap", desc: "+30 Joy during bathtime", unlocked: true, icon: "water_drop" },
      { name: "Soap Cannon", desc: "Blasts suds across the whole bathtub", unlocked: false, icon: "soap" },
      { name: "Spa Towel Cape", desc: "Instantly dries pet after washing", unlocked: false, icon: "air" }
    ]
  },
  {
    id: 17,
    name: "Vortex the Falcon",
    title: "The Windblade",
    element: "Wind",
    color: "#007bff",
    accentColor: "#54e98a",
    avatar: makePetSvg("🦅", "falcon", "#007bff"),
    backstory: "Vortex cuts through hurricanes and storms with wings made of compressed wind blades. He inspires young heroes to never give up!",
    habitBonus: "Gale Speed: Unlocks instant fast-travel across all Quest Map realms.",
    assignedHabit: "Quick Chores",
    baseStats: { hunger: 70, hygiene: 85, energy: 95, joy: 90 },
    evolutionStages: ["Wind Chick", "Gust Falcon", "Tempest Wing", "Hurricanic Sky God"],
    exclusiveGear: [
      { name: "Wind Feather Helm", desc: "+20 Speed in all learning games", unlocked: true, icon: "flight_takeoff" },
      { name: "Aero Turbine", desc: "Blows away cavity germs in AR battle", unlocked: false, icon: "air" },
      { name: "Sonic Screech Ring", desc: "+25% XP multiplier on all map tasks", unlocked: false, icon: "volume_up" }
    ]
  },
  {
    id: 18,
    name: "Sir Hoots the Knight Owl",
    title: "The Midnight Watcher",
    element: "Steel & Light",
    color: "#202b35",
    accentColor: "#f1c40f",
    avatar: makePetSvg("🦉", "knight_owl", "#2ecc71"),
    backstory: "Sir Hoots stands guard on castle ramparts all night so every hero child sleeps peacefully without fear.",
    habitBonus: "Night Guard: Double Points earned on evening chores completed before 9:00 PM.",
    assignedHabit: "Nighttime Routine",
    baseStats: { hunger: 65, hygiene: 85, energy: 80, joy: 90 },
    evolutionStages: ["Squire Owl", "Knight Vanguard", "Paladin Feather", "Solar Arch-Guardian"],
    exclusiveGear: [
      { name: "Plate Armor Helmet", desc: "Blocks all nightmare monsters", unlocked: true, icon: "security" },
      { name: "Sunlit Lance", desc: "+30 Boss damage in Sugar Battle", unlocked: false, icon: "flash_on" },
      { name: "Golden Shield of Valor", desc: "+50 Coins upon full day completion", unlocked: false, icon: "shield" }
    ]
  },
  {
    id: 19,
    name: "Blaze the Saber Cat",
    title: "The Flame Prowler",
    element: "Fire",
    color: "#e89300",
    accentColor: "#f1c40f",
    avatar: makePetSvg("🐯", "saber_cat", "#e89300"),
    backstory: "Blaze leaps over roaring fire chasms. He has fiery glowing stripes and a playful roar that inspires bravery!",
    habitBonus: "Courage Boost: Completing hard tasks awards +40 Bonus Habit Coins.",
    assignedHabit: "Challenge Quests",
    baseStats: { hunger: 85, hygiene: 70, energy: 95, joy: 90 },
    evolutionStages: ["Cinder Kitten", "Flame Stalker", "Inferno Saber", "Volcanic Apex Cat"],
    exclusiveGear: [
      { name: "Ember Claws", desc: "Scratches through quest cooldowns", unlocked: true, icon: "pets" },
      { name: "Solar Mane Harness", desc: "+25% XP on challenge chores", unlocked: false, icon: "wb_sunny" },
      { name: "Magma Paws", desc: "Leaves glowing footprints on Quest Map", unlocked: false, icon: "whatshot" }
    ]
  },
  {
    id: 20,
    name: "Ollie the Sea Otter",
    title: "The River Scrubber",
    element: "Water",
    color: "#3498db",
    accentColor: "#2ecc71",
    avatar: makePetSvg("🦦", "otter", "#3498db"),
    backstory: "Ollie floats on his back in crystal brooks, scrubbing his whiskers with shiny river stones. He loves cleanliness!",
    habitBonus: "Soap Master: Hands-washing tasks give +10 Bonus Gold Points.",
    assignedHabit: "Wash Hands Before Meals",
    baseStats: { hunger: 75, hygiene: 100, energy: 85, joy: 95 },
    evolutionStages: ["Pebble Pup", "River Scout", "Hydro Otter", "Poseidon Sea Champion"],
    exclusiveGear: [
      { name: "Polished River Stone", desc: "+30% Hygiene boost on snacks", unlocked: true, icon: "lens" },
      { name: "Kelp Scarf", desc: "Adds bubbles to all pet minigames", unlocked: false, icon: "water" },
      { name: "Seashell Shield", desc: "Blocks all dirty germs in AR battle", unlocked: false, icon: "shield" }
    ]
  },
  {
    id: 21,
    name: "Spike the Hedgehog",
    title: "The Bristle Guardian",
    element: "Earth & Nature",
    color: "#2ecc71",
    accentColor: "#f1c40f",
    avatar: makePetSvg("🦔", "hedgehog", "#2ecc71"),
    backstory: "Spike curls into a tough little ball when danger is near. His bristles act like natural toothbrushes against cavity germs!",
    habitBonus: "Bristle Sweep: Adds +20% coins to all teeth-cleaning routines.",
    assignedHabit: "Morning & Night Brushing",
    baseStats: { hunger: 70, hygiene: 90, energy: 80, joy: 90 },
    evolutionStages: ["Sprout Hog", "Bristle Scout", "Thorn Knight", "Armored Quilled Titan"],
    exclusiveGear: [
      { name: "Golden Quills", desc: "Reflects cavity monster attacks", unlocked: true, icon: "flare" },
      { name: "Apple Shield", desc: "Converts healthy snacks into extra XP", unlocked: false, icon: "nutrition" },
      { name: "Speed Roller Boots", desc: "Doubles speed in Pet Adventure games", unlocked: false, icon: "speed" }
    ]
  },
  {
    id: 22,
    name: "Rocky the Iron Boar",
    title: "The Mud Bulldozer",
    element: "Earth & Steel",
    color: "#2b3640",
    accentColor: "#e89300",
    avatar: makePetSvg("🐗", "boar", "#e89300"),
    backstory: "Rocky charges through tangled forests to clear paths for little heroes. He never tires and helps haul heavy laundry baskets!",
    habitBonus: "Chore Crusher: +30 Coins on helping parents with laundry or trash chores.",
    assignedHabit: "Household Chores",
    baseStats: { hunger: 90, hygiene: 60, energy: 95, joy: 85 },
    evolutionStages: ["Piglet Scout", "Tusk Charger", "Iron Boar", "Steel Golem Behemoth"],
    exclusiveGear: [
      { name: "Titanium Tusk Plating", desc: "+40 Chore completion strength", unlocked: true, icon: "hardware" },
      { name: "Mud Guard Chaps", desc: "Keeps pet clean after outdoor play", unlocked: false, icon: "dry_cleaning" },
      { name: "Trophy Belt", desc: "+25% Point bonus on all weekend tasks", unlocked: false, icon: "military_tech" }
    ]
  },
  {
    id: 23,
    name: "Aero the Star Griffin",
    title: "The Solar Sentinel",
    element: "Light & Air",
    color: "#f1c40f",
    accentColor: "#007bff",
    avatar: makePetSvg("🦅", "griffin", "#f1c40f"),
    backstory: "Aero guards the constellations across the night sky. He shines brightly to guide young heroes on their quest journeys.",
    habitBonus: "Star Radiance: All real-life rewards cost 15% fewer Points to redeem in the shop!",
    assignedHabit: "All Daily Quests",
    baseStats: { hunger: 80, hygiene: 90, energy: 95, joy: 100 },
    evolutionStages: ["Star Chick", "Griffin Guard", "Solar Monarch", "Apex Cosmic Griffin"],
    exclusiveGear: [
      { name: "Solar Crown of Stars", desc: "Reduces all shop Point costs by 15%", unlocked: true, icon: "stars" },
      { name: "Golden Feather Pauldrons", desc: "+50% XP from Boss battles", unlocked: false, icon: "shield" },
      { name: "Cosmic Beam Tail", desc: "Instantly defeats Sugar Minions", unlocked: false, icon: "flare" }
    ]
  },
  {
    id: 24,
    name: "Cosmo the Cyber Pup",
    title: "The Quantum Hound",
    element: "Tech & Cosmic",
    color: "#007bff",
    accentColor: "#2ecc71",
    avatar: makePetSvg("🐶", "cyber_pup", "#007bff"),
    backstory: "Cosmo travels across digital galaxies helping young adventurers learn code, math, and heroic habits!",
    habitBonus: "Master Key: Unlocks bonus multiplier on all in-app mini-games.",
    assignedHabit: "Master Quests",
    baseStats: { hunger: 85, hygiene: 85, energy: 100, joy: 100 },
    evolutionStages: ["Nano Pup", "Cyber Hound", "Quantum Vanguard", "Galactic Apex Hound"],
    exclusiveGear: [
      { name: "Holographic Visor", desc: "Displays instant solutions in learning games", unlocked: true, icon: "smart_toy" },
      { name: "Quantum Jetpack", desc: "Unlimited Energy in Pet Adventures", unlocked: false, icon: "rocket_launch" },
      { name: "Cosmic Spark Collar", desc: "Doubles all Habit Coin payouts globally", unlocked: false, icon: "auto_awesome" }
    ]
  }
];
