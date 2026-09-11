// -------------------------------------------------------------
// Pet Expeditions & Mini-Adventures 1.0 Data Models
// Biomes, Durations, Artifacts, Illustrated Postcards, and Affinities
// -------------------------------------------------------------

export const EXPEDITION_BIOMES = [
  {
    id: "fern_woods",
    name: "Whispering Fern Woods",
    title: "Enchanted Ancient Canopy",
    icon: "forest",
    emoji: "🌲",
    color: "#2ecc71",
    accentBorder: "border-emerald-500",
    gradient: "from-emerald-500/20 via-teal-500/10 to-green-500/5",
    preferredElements: ["Earth", "Forest", "Plant", "Nature"],
    description: "Mossy hollows, sunlit tree canopies, and gentle woodland streams full of sweet berry shrubs.",
    baseSparks: 10,
    baseCoins: 35,
    baseXP: 45,
    commonDrops: ["Forest Amber Shard", "Herbal Wildberries", "Golden Acorn"],
    exclusiveGear: {
      name: "Whispering Leaf Cape",
      type: "cape",
      desc: "Woven from magical fern leaves. Adds +15% Joy boost to outdoor play.",
      icon: "spa"
    },
    postcardTheme: "woodland"
  },
  {
    id: "geode_cavern",
    name: "Crystal Geode Cavern",
    title: "Subterranean Jewel Mines",
    icon: "diamond",
    emoji: "💎",
    color: "#9b59b6",
    accentBorder: "border-purple-500",
    gradient: "from-purple-500/20 via-indigo-500/10 to-violet-500/5",
    preferredElements: ["Earth", "Metal", "Magic", "Fossil"],
    description: "Gleaming subterranean grottoes lit by giant amethyst clusters, crystal stalactites, and underground waterfalls.",
    baseSparks: 15,
    baseCoins: 45,
    baseXP: 55,
    commonDrops: ["Sparkling Amethyst Geode", "Prismatic Quartz", "Cave Mushroom Treat"],
    exclusiveGear: {
      name: "Crystal Star Aura",
      type: "aura",
      desc: "Radiates gentle purple crystal light. +20% Coin multiplier on chore completions.",
      icon: "auto_awesome"
    },
    postcardTheme: "crystals"
  },
  {
    id: "coral_reef",
    name: "Starlight Coral Reef",
    title: "Bioluminescent Tide Pools",
    icon: "water",
    emoji: "🌊",
    color: "#00bcd4",
    accentBorder: "border-cyan-500",
    gradient: "from-cyan-500/20 via-blue-500/10 to-sky-500/5",
    preferredElements: ["Water", "Ice", "Ocean", "Bubble"],
    description: "Shimmering turquoise shallows filled with bioluminescent coral, friendly dolphins, and singing tide shells.",
    baseSparks: 12,
    baseCoins: 40,
    baseXP: 50,
    commonDrops: ["Bioluminescent Pearl", "Star Coral Cluster", "Sea Glass Token"],
    exclusiveGear: {
      name: "Sea Bubble Crown",
      type: "hat",
      desc: "Adorned with shimmering ocean bubbles. Keeps companion pet 100% clean during bath time.",
      icon: "water_drop"
    },
    postcardTheme: "ocean"
  },
  {
    id: "sunfire_summit",
    name: "Sunfire Summit",
    title: "Floating Sky Peak",
    icon: "local_fire_department",
    emoji: "🌋",
    color: "#e67e22",
    accentBorder: "border-amber-500",
    gradient: "from-amber-500/20 via-orange-500/10 to-red-500/5",
    preferredElements: ["Fire", "Wind", "Cosmic", "Solar"],
    description: "A towering mountain peak that floats above the morning clouds, warmed by glowing fire crystals and golden sunshine.",
    baseSparks: 18,
    baseCoins: 50,
    baseXP: 65,
    commonDrops: ["Sunfire Ore", "Phoenix Feather", "Flame Berry Snack"],
    exclusiveGear: {
      name: "Golden Solar Helmet",
      type: "hat",
      desc: "Forged from sunlight and mountain gold. Grants +25% XP bonus in learning games.",
      icon: "sunny"
    },
    postcardTheme: "summit"
  }
];

export const EXPEDITION_DURATIONS = [
  {
    id: "quick_forage",
    label: "Quick Forage",
    emoji: "🌿",
    minutes: 15,
    description: "A breezy scout around the perimeter. 1 chore completes it instantly!",
    sparkMultiplier: 1.0,
    rewardMultiplier: 1.0,
    gearChance: 0.15
  },
  {
    id: "wilderness_trek",
    label: "Wilderness Trek",
    emoji: "🌲",
    minutes: 45,
    description: "A deeper voyage into the heart of the wild. Steady rewards and rare gems.",
    sparkMultiplier: 1.6,
    rewardMultiplier: 1.5,
    gearChance: 0.35
  },
  {
    id: "deep_expedition",
    label: "Deep Cavern Expedition",
    emoji: "🏔️",
    minutes: 120,
    description: "An epic 2-hour grand expedition with the highest yield of rare relics and sparks.",
    sparkMultiplier: 2.5,
    rewardMultiplier: 2.2,
    gearChance: 0.70
  }
];

export const EXPEDITION_ARTIFACTS = [
  {
    id: "forest_amber",
    name: "Ancient Forest Amber",
    emoji: "🍯",
    biomeId: "fern_woods",
    rarity: "Rare",
    desc: "A warm golden gem preserving a tiny glowing prehistoric leaf from the oldest canopy trees."
  },
  {
    id: "amethyst_geode",
    name: "Prismatic Amethyst Geode",
    emoji: "🔮",
    biomeId: "geode_cavern",
    rarity: "Epic",
    desc: "A hollow stone glittering with deep purple violet crystal points that chime like music."
  },
  {
    id: "star_coral",
    name: "Luminescent Star Coral",
    emoji: "🪸",
    biomeId: "coral_reef",
    rarity: "Rare",
    desc: "A gentle living coral branch that glows with soothing turquoise light in the dark."
  },
  {
    id: "phoenix_feather",
    name: "Golden Phoenix Feather",
    emoji: "🪶",
    biomeId: "sunfire_summit",
    rarity: "Legendary",
    desc: "A feather that never cools down and radiates warm starlight across the pet pen."
  }
];

export const EXPEDITION_POSTCARD_TEMPLATES = [
  {
    biomeId: "fern_woods",
    postcardTitle: "Greetings from Whispering Ferns! 🌲",
    stories: [
      "{petName} discovered a hidden clearing full of giant glowing ferns and shared sweet wildberries with a friendly family of hedgehog scouts!",
      "{petName} flew over the winding emerald river, finding an ancient hollow tree where woodland birds sang morning melodies!",
      "{petName} chased bouncing sunlight sparkles down a mossy path and unearthed an ancient golden souvenir!"
    ]
  },
  {
    biomeId: "geode_cavern",
    postcardTitle: "Shining Echoes from Geode Caverns! 💎",
    stories: [
      "{petName} tapped on giant amethyst crystals to play a secret musical scale that made the entire subterranean cave sparkle!",
      "{petName} slid down a smooth purple crystal chute into a pool of warm mineral water lit by glowing mushrooms!",
      "{petName} met an ancient crystal mole who traded sparkling geode shards for a friendly pet high-five!"
    ]
  },
  {
    biomeId: "coral_reef",
    postcardTitle: "Splashes from Starlight Reef! 🌊",
    stories: [
      "{petName} swam alongside playful baby sea turtles across glowing turquoise tide pools and collected pearly sea shells!",
      "{petName} blew giant sudsy bubbles underwater and watched colorful reef fish do acrobatic somersaults!",
      "{petName} found a secret tide grotto where bioluminescent starfish formed a glowing smiling constellation!"
    ]
  },
  {
    biomeId: "sunfire_summit",
    postcardTitle: "Warm Winds from Sunfire Summit! 🌋",
    stories: [
      "{petName} soared higher than the clouds to the warm peak of Sunfire Summit, basking in golden sunrise energy!",
      "{petName} practiced fire-dancing with the warm mountain breeze and roasted flame berries over golden lava pebbles!",
      "{petName} stood atop the highest floating sky crag and gave an epic victory roar heard across the whole valley!"
    ]
  }
];

export function getExpeditionBiome(biomeId) {
  return EXPEDITION_BIOMES.find(b => b.id === biomeId) || EXPEDITION_BIOMES[0];
}

export function getExpeditionDuration(durationId) {
  return EXPEDITION_DURATIONS.find(d => d.id === durationId) || EXPEDITION_DURATIONS[0];
}

export function calculateExpeditionAffinity(pet, biomeId) {
  if (!pet) return { hasAffinity: false, multiplier: 1.0, label: "Standard Exploration" };
  const biome = getExpeditionBiome(biomeId);
  const petElementStr = (pet.element || "").toLowerCase();
  
  const matches = biome.preferredElements.some(elem => 
    petElementStr.includes(elem.toLowerCase())
  );

  if (matches) {
    return {
      hasAffinity: true,
      multiplier: 1.35, // +35% rare loot & spark bonus!
      label: "✨ Elemental Affinity Match (+35% Rare Drops & Sparks!)"
    };
  }

  return {
    hasAffinity: false,
    multiplier: 1.0,
    label: "Standard Exploration"
  };
}

export function generateExpeditionRewards(expedition, pet) {
  const biome = getExpeditionBiome(expedition.biomeId);
  const duration = EXPEDITION_DURATIONS.find(d => d.minutes === expedition.durationMinutes) || EXPEDITION_DURATIONS[0];
  const affinity = calculateExpeditionAffinity(pet, expedition.biomeId);

  const snackBonus = expedition.snackPacked ? 1.2 : 1.0;
  const totalMult = duration.rewardMultiplier * affinity.multiplier * snackBonus;

  const sparksAwarded = Math.round(biome.baseSparks * duration.sparkMultiplier * affinity.multiplier * snackBonus);
  const coinsAwarded = Math.round(biome.baseCoins * totalMult);
  const xpAwarded = Math.round(biome.baseXP * totalMult);

  // Determine artifact drop
  const potentialArtifact = EXPEDITION_ARTIFACTS.find(a => a.biomeId === expedition.biomeId);
  const artifactDropped = (Math.random() < duration.gearChance) ? potentialArtifact : null;

  // Determine exclusive gear drop
  const gearDropped = (Math.random() < (duration.gearChance * 0.7)) ? biome.exclusiveGear : null;

  // Select postcard story
  const template = EXPEDITION_POSTCARD_TEMPLATES.find(t => t.biomeId === expedition.biomeId) || EXPEDITION_POSTCARD_TEMPLATES[0];
  const rawStory = template.stories[Math.floor(Math.random() * template.stories.length)];
  const petName = pet ? pet.name : "Your Companion";
  const finalStory = rawStory.replace(/{petName}/g, petName);

  return {
    sparksAwarded,
    coinsAwarded,
    xpAwarded,
    artifactDropped,
    gearDropped,
    postcard: {
      id: "post_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      title: template.postcardTitle,
      story: finalStory,
      biomeId: biome.id,
      biomeName: biome.name,
      biomeEmoji: biome.emoji,
      petId: pet ? pet.id : 1,
      petName: petName,
      timestamp: Date.now(),
      dateString: new Date().toLocaleDateString(),
      timeString: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  };
}
