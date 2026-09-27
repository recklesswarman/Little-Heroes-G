/**
 * Bedtime AI Storybook Data & Realm Catalog
 * Little Hero Adventures - Bedtime Storybook Engine
 * 
 * Strict Explorer Design System: ZERO pink or purple.
 * Only midnight slate, emerald green, starlight cyan, solar orange, and amber gold.
 */

export const BEDTIME_REALMS = [
  {
    id: 'space',
    name: 'Cosmic Starlight Space',
    subtitle: 'Moonlit comets, floating space stations & twinkling nebulae',
    icon: 'rocket_launch',
    emoji: '🚀',
    accentColor: '#00d2d3',
    glowColor: '#38bdf8',
    bgGradient: 'from-[#050f18] via-[#09141e] to-[#0c1e2c]',
    ambientSound: 'space_drone',
    heroHabitThemes: ['Drink clean cosmic water from a starlight thermos', 'Brush meteor dust off space-boots', 'Stow moon crystals in the tidy pouch'],
    act1Prompts: [
      'What special hero gadget should we pack into our rocket backpack?'
    ],
    act1DefaultChips: [
      { text: 'Laser Toothbrush 🪥', icon: 'cleaning_services' },
      { text: 'Star Map & Compass 🗺️', icon: 'map' },
      { text: 'Cosmic Fruit Snack 🍎', icon: 'nutrition' }
    ],
    act2Prompts: [
      'Oh look! The sleepy Moon Dragon cannot sleep because of bumpy stardust on the runway! How can our hero habit save the day?'
    ],
    act2DefaultChips: [
      { text: 'Brush Away Stardust with Toothbrush! ✨', icon: 'auto_awesome' },
      { text: 'Tidy the Lunar Runway! 🧹', icon: 'cleaning_services' },
      { text: 'Share a Warm Flask of Water! 💧', icon: 'water_drop' }
    ],
    act3Prompt: 'The Moon Dragon lets out a giant cozy yawn... The stars shine softly. Time to tuck into your zero-gravity bed, little astronaut.'
  },
  {
    id: 'dino_jungle',
    name: 'Dinosaur Fossil Jungle',
    subtitle: 'Gentle leaf-eaters, glowing fern trails & cozy volcanic hot springs',
    icon: 'pest_control',
    emoji: '🦖',
    accentColor: '#2ecc71',
    glowColor: '#86efac',
    bgGradient: 'from-[#040e0b] via-[#081c15] to-[#0d281e]',
    ambientSound: 'jungle_night',
    heroHabitThemes: ['Clean giant dinosaur teeth until they sparkle', 'Put away the jungle tools before bedtime', 'Eat healthy prehistoric crunch berries'],
    act1Prompts: [
      'Rex is putting on his explorer hat! What friendly dinosaur tool should we carry into the glowing ferns?'
    ],
    act1DefaultChips: [
      { text: 'Sparkle Toothbrush 🪥', icon: 'dentistry' },
      { text: 'Big Dino Magnifying Glass 🔍', icon: 'search' },
      { text: 'Fluffy Sleepy Pajamas 🧸', icon: 'bed' }
    ],
    act2Prompts: [
      'A tiny baby Triceratops lost their sleepy cuddle blanket in the giant fern grove! How do we help them find it?'
    ],
    act2DefaultChips: [
      { text: 'Use Toothbrush Gleam as a Flashlight! 🔦', icon: 'lightbulb' },
      { text: 'Tidy Away the Fern Leaves! 🌿', icon: 'yard' },
      { text: 'Sing a Gentle Hero Tooth-Song! 🎵', icon: 'music_note' }
    ],
    act3Prompt: 'The baby Triceratops curls up happily in a nest of soft moss. Rex yawns softly. The jungle sings a quiet cricket lullaby.'
  },
  {
    id: 'pirate_lagoon',
    name: 'Treasure Island Pirate Lagoon',
    subtitle: 'Calm starlight tides, friendly dolphin navigators & secret sea caves',
    icon: 'sailing',
    emoji: '🏴‍☠️',
    accentColor: '#00d2d3',
    glowColor: '#ffb961',
    bgGradient: 'from-[#030d14] via-[#081824] to-[#0e273a]',
    ambientSound: 'ocean_waves',
    heroHabitThemes: ['Swab and tidy the ship deck', 'Drink fresh water from the captain barrel', 'Brush pirate peg-teeth until pearl-white'],
    act1Prompts: [
      'Captain Rex is ready to raise the sail on the Starlight Sloop! What treasure gear do we bring aboard?'
    ],
    act1DefaultChips: [
      { text: 'Golden Toothbrush 🪥', icon: 'stars' },
      { text: 'Dolphin Whistle 🐬', icon: 'sports' },
      { text: 'Lantern of Sweet Dreams 🏮', icon: 'light' }
    ],
    act2Prompts: [
      'A friendly sea turtle needs help finding the peaceful Lagoon of Slumber, but the coral reef is scattered with stray seashells! What do we do?'
    ],
    act2DefaultChips: [
      { text: 'Tidy Up the Seashells into Buckets! 🐚', icon: 'bucket' },
      { text: 'Polish Coral with Pearly Toothpaste! ✨', icon: 'sparkles' },
      { text: 'Give Turtle a Sip of Cool Water! 🌊', icon: 'water' }
    ],
    act3Prompt: 'The sea turtle glides gently into the calm turquoise cove. Waves lap softly against the sand. Rest your weary sea-legs, brave captain.'
  },
  {
    id: 'enchanted_castle',
    name: 'Enchanted Knight Citadel',
    subtitle: 'Cozy hearthstone fires, gentle sleepy gargoyles & constellation towers',
    icon: 'fort',
    emoji: '🏰',
    accentColor: '#ffb961',
    glowColor: '#f39c12',
    bgGradient: 'from-[#0e161a] via-[#16232a] to-[#1e2f38]',
    ambientSound: 'hearth_fire',
    heroHabitThemes: ['Polish shiny knight armor', 'Tidy away wooden swords and toy shields', 'Sip warm milk or water before bed'],
    act1Prompts: [
      'Sir Rex the Brave is polishing his round shield! What noble knight supply should we pack for the midnight patrol?'
    ],
    act1DefaultChips: [
      { text: 'Shield of Pearly White Smiles 🛡️', icon: 'shield' },
      { text: 'Golden Toothbrush Lance ⚔️', icon: 'brush' },
      { text: 'Fluffy Royal Velvet Robe 👑', icon: 'styler' }
    ],
    act2Prompts: [
      'The Castle Keep has a chilly draft because the great toy chest was left wide open in the courtyard! How does our hero fix it?'
    ],
    act2DefaultChips: [
      { text: 'Heroically Tidy All the Toys Inside! 🧸', icon: 'inventory_2' },
      { text: 'Brush the Dragon Bedtime Whiskers! 🐉', icon: 'face' },
      { text: 'Hang a Starry Sleeping Banner! 🚩', icon: 'flag' }
    ],
    act3Prompt: 'The stone hearth crackles with warmth. The friendly castle dragon curls up like a kitten at the foot of your hero bed. Sleep tight, valiant knight.'
  }
];

/**
 * Generate Procedural Animated Fallback SVG Vignettes
 * Guaranteed 100% offline-ready, strictly adhering to zero pink/purple palette.
 */
export function generateFallbackSvg(realmId, actNumber, customItemText = '') {
  const realm = BEDTIME_REALMS.find(r => r.id === realmId) || BEDTIME_REALMS[0];
  const safeText = (customItemText || '').replace(/[<>&"]/g, '').slice(0, 32);

  if (realmId === 'space') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" class="w-full h-full rounded-3xl overflow-hidden shadow-2xl">
        <defs>
          <linearGradient id="spaceSky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#050f18"/>
            <stop offset="60%" stop-color="#091b29"/>
            <stop offset="100%" stop-color="#0f2b3e"/>
          </linearGradient>
          <radialGradient id="nebulaGlow" cx="60%" cy="30%" r="50%">
            <stop offset="0%" stop-color="#00d2d3" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#050f18" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ffb961"/>
            <stop offset="60%" stop-color="#f39c12"/>
            <stop offset="100%" stop-color="#050f18" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <!-- Sky -->
        <rect width="800" height="500" fill="url(#spaceSky)"/>
        <rect width="800" height="500" fill="url(#nebulaGlow)"/>
        
        <!-- Stars -->
        <g fill="#ffffff">
          <circle cx="80" cy="60" r="2.5" opacity="0.8"/>
          <circle cx="200" cy="90" r="1.5" opacity="0.6"/>
          <circle cx="340" cy="40" r="2.0" opacity="0.9"/>
          <circle cx="520" cy="75" r="1.8" opacity="0.7"/>
          <circle cx="680" cy="50" r="2.2" opacity="0.8"/>
          <circle cx="150" cy="180" r="1.5" opacity="0.5"/>
          <circle cx="720" cy="190" r="2.0" opacity="0.6"/>
          <circle cx="600" cy="240" r="1.5" opacity="0.8"/>
          <circle cx="100" cy="300" r="2.0" opacity="0.5"/>
        </g>
        
        <!-- Glowing Sleepy Moon -->
        <circle cx="650" cy="130" r="65" fill="#ffb961" opacity="0.15"/>
        <circle cx="650" cy="130" r="45" fill="#ffb961"/>
        <circle cx="665" cy="120" r="42" fill="#091b29"/>
        
        <!-- Asteroid Surface -->
        <path d="M-20 420 Q180 370 400 410 T820 400 L820 520 L-20 520 Z" fill="#122736"/>
        <path d="M-20 450 Q220 410 480 440 T820 430 L820 520 L-20 520 Z" fill="#091520"/>
        
        <!-- Retro Rocket Ship -->
        <g transform="translate(180, 240) rotate(-15)">
          <path d="M0 -70 Q35 0 35 60 L-35 60 Q-35 0 0 -70 Z" fill="#e0f2fe"/>
          <path d="M-35 40 L-60 70 L-35 60 Z" fill="#00d2d3"/>
          <path d="M35 40 L60 70 L35 60 Z" fill="#00d2d3"/>
          <circle cx="0" cy="0" r="16" fill="#091b29" stroke="#ffb961" stroke-width="4"/>
          <!-- Rocket Flame (Soft Amber) -->
          <path d="M-20 60 Q0 110 0 110 Q0 110 20 60 Z" fill="#f39c12" opacity="0.85"/>
          <path d="M-10 60 Q0 90 0 90 Q0 90 10 60 Z" fill="#ffb961"/>
        </g>

        <!-- Companion Rex with Space Helmet -->
        <g transform="translate(420, 310)">
          <!-- Body -->
          <ellipse cx="40" cy="65" rx="35" ry="40" fill="#2ecc71"/>
          <ellipse cx="45" cy="70" rx="20" ry="25" fill="#86efac"/>
          <!-- Tail -->
          <path d="M10 80 Q-25 90 -40 70 Q-15 65 10 70 Z" fill="#2ecc71"/>
          <!-- Head -->
          <circle cx="65" cy="25" r="30" fill="#2ecc71"/>
          <ellipse cx="78" cy="28" rx="14" ry="10" fill="#2ecc71"/>
          <!-- Eye (Happy Sleepy Arch) -->
          <path d="M68 20 Q75 14 82 20" stroke="#050f18" stroke-width="3" fill="none" stroke-linecap="round"/>
          <!-- Glass Fishbowl Helmet -->
          <circle cx="68" cy="22" r="38" fill="#00d2d3" fill-opacity="0.25" stroke="#00d2d3" stroke-width="3"/>
          <ellipse cx="55" cy="10" rx="10" ry="5" fill="#ffffff" fill-opacity="0.5" transform="rotate(-30 55 10)"/>
          <!-- Feet -->
          <ellipse cx="25" cy="105" rx="12" ry="7" fill="#27ae60"/>
          <ellipse cx="55" cy="105" rx="12" ry="7" fill="#27ae60"/>
        </g>

        ${safeText ? `
          <!-- Hero Choice Item Banner -->
          <g transform="translate(400, 465)">
            <rect x="-180" y="-22" width="360" height="38" rx="19" fill="#050f18" fill-opacity="0.85" stroke="#ffb961" stroke-width="2"/>
            <text x="0" y="2" text-anchor="middle" fill="#ffb961" font-family="sans-serif" font-weight="900" font-size="13">
              HERO GEAR: ${safeText.toUpperCase()}
            </text>
          </g>
        ` : ''}
      </svg>
    `;
  }

  if (realmId === 'dino_jungle') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" class="w-full h-full rounded-3xl overflow-hidden shadow-2xl">
        <defs>
          <linearGradient id="jungleSky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#040e0b"/>
            <stop offset="60%" stop-color="#081c15"/>
            <stop offset="100%" stop-color="#0e2a20"/>
          </linearGradient>
          <radialGradient id="fireflyGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#86efac"/>
            <stop offset="60%" stop-color="#2ecc71" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="#081c15" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <!-- Sky -->
        <rect width="800" height="500" fill="url(#jungleSky)"/>
        
        <!-- Stars through canopy -->
        <g fill="#ffffff" opacity="0.6">
          <circle cx="120" cy="50" r="1.5"/>
          <circle cx="240" cy="35" r="2.0"/>
          <circle cx="450" cy="65" r="1.8"/>
          <circle cx="680" cy="40" r="1.5"/>
        </g>
        
        <!-- Prehistoric Moon -->
        <circle cx="680" cy="110" r="45" fill="#ffb961" opacity="0.85"/>
        <circle cx="660" cy="100" r="8" fill="#f39c12" opacity="0.4"/>

        <!-- Distant Mountain Silhouettes -->
        <polygon points="50,380 220,240 380,380" fill="#061611"/>
        <polygon points="280,390 460,200 640,390" fill="#081e17"/>

        <!-- Giant Jungle Ferns and Vines -->
        <path d="M-10 160 Q120 180 180 290 Q90 280 -10 240 Z" fill="#0d3324"/>
        <path d="M810 140 Q690 170 630 310 Q720 290 810 230 Z" fill="#0d3324"/>
        
        <!-- Ground Layer with Soft Moss -->
        <path d="M-20 410 Q200 370 420 400 T820 390 L820 520 L-20 520 Z" fill="#0f3b2a"/>
        <path d="M-20 445 Q260 415 500 435 T820 420 L820 520 L-20 520 Z" fill="#0a261b"/>

        <!-- Floating Glowing Fireflies -->
        <g>
          <circle cx="220" cy="320" r="15" fill="url(#fireflyGlow)"/>
          <circle cx="220" cy="320" r="3" fill="#ffffff"/>
          <circle cx="360" cy="280" r="18" fill="url(#fireflyGlow)"/>
          <circle cx="360" cy="280" r="3.5" fill="#ffffff"/>
          <circle cx="580" cy="310" r="16" fill="url(#fireflyGlow)"/>
          <circle cx="580" cy="310" r="3" fill="#ffffff"/>
        </g>

        <!-- Cozy Sleepy Dinosaur Nest -->
        <ellipse cx="400" cy="410" rx="90" ry="25" fill="#061611"/>
        <!-- Straw/Moss lines -->
        <path d="M320 415 Q400 430 480 415" stroke="#ffb961" stroke-width="4" fill="none" opacity="0.6"/>
        <path d="M335 405 Q400 422 465 405" stroke="#2ecc71" stroke-width="3" fill="none" opacity="0.5"/>

        <!-- Rex & Baby Dino in Nest -->
        <g transform="translate(370, 335)">
          <ellipse cx="30" cy="50" rx="35" ry="30" fill="#2ecc71"/>
          <circle cx="55" cy="25" r="22" fill="#2ecc71"/>
          <!-- Sweet Sleeping Arch Eyes -->
          <path d="M50 22 Q56 16 62 22" stroke="#040e0b" stroke-width="3" fill="none" stroke-linecap="round"/>
          <circle cx="68" cy="18" r="4" fill="#86efac" opacity="0.7"/>
          <!-- Nightcap -->
          <polygon points="55,10 75,-15 45,5" fill="#f39c12"/>
          <circle cx="75" cy="-15" r="5" fill="#ffb961"/>
        </g>

        ${safeText ? `
          <!-- Hero Choice Item Banner -->
          <g transform="translate(400, 465)">
            <rect x="-180" y="-22" width="360" height="38" rx="19" fill="#040e0b" fill-opacity="0.85" stroke="#2ecc71" stroke-width="2"/>
            <text x="0" y="2" text-anchor="middle" fill="#86efac" font-family="sans-serif" font-weight="900" font-size="13">
              DINO GEAR: ${safeText.toUpperCase()}
            </text>
          </g>
        ` : ''}
      </svg>
    `;
  }

  if (realmId === 'pirate_lagoon') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" class="w-full h-full rounded-3xl overflow-hidden shadow-2xl">
        <defs>
          <linearGradient id="oceanSky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#030d14"/>
            <stop offset="60%" stop-color="#071b28"/>
            <stop offset="100%" stop-color="#0b283b"/>
          </linearGradient>
          <linearGradient id="lagoonWater" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#00d2d3" stop-opacity="0.6"/>
            <stop offset="50%" stop-color="#072233"/>
            <stop offset="100%" stop-color="#030d14"/>
          </linearGradient>
        </defs>
        <!-- Sky -->
        <rect width="800" height="500" fill="url(#oceanSky)"/>
        
        <!-- Stars -->
        <g fill="#ffffff" opacity="0.8">
          <circle cx="100" cy="50" r="2.0"/>
          <circle cx="280" cy="70" r="1.5"/>
          <circle cx="440" cy="40" r="2.2"/>
          <circle cx="620" cy="65" r="1.8"/>
        </g>
        
        <!-- Starlight Moon Reflection -->
        <circle cx="400" cy="100" r="50" fill="#ffb961" opacity="0.9"/>
        <circle cx="420" cy="90" r="45" fill="#071b28"/>

        <!-- Distant Tropical Island with Palm Tree -->
        <path d="M50 360 Q180 320 300 360 Z" fill="#081e2b"/>
        <path d="M160 340 Q170 270 190 230" stroke="#05141d" stroke-width="8" stroke-linecap="round"/>
        <path d="M190 230 Q150 210 110 220" stroke="#2ecc71" stroke-width="6" stroke-linecap="round"/>
        <path d="M190 230 Q220 200 260 210" stroke="#2ecc71" stroke-width="6" stroke-linecap="round"/>

        <!-- Sea Surface & Waves -->
        <rect y="340" width="800" height="160" fill="url(#lagoonWater)"/>
        <path d="M0 350 Q100 340 200 350 T400 350 T600 350 T800 350 L800 500 L0 500 Z" fill="#092233" opacity="0.8"/>
        <path d="M0 375 Q120 365 240 375 T480 375 T720 375 T800 375 L800 500 L0 500 Z" fill="#061824" opacity="0.9"/>

        <!-- Friendly Ship / Raft with Lantern -->
        <g transform="translate(360, 270)">
          <!-- Hull -->
          <path d="M-50 70 L50 70 L35 100 L-35 100 Z" fill="#ffb961" stroke="#f39c12" stroke-width="3"/>
          <!-- Mast & White Sail -->
          <line x1="0" y1="70" x2="0" y2="0" stroke="#050f18" stroke-width="5"/>
          <path d="M0 10 Q35 30 0 65 Z" fill="#e0f2fe"/>
          <!-- Golden Lantern -->
          <circle cx="35" cy="55" r="14" fill="#ffb961" opacity="0.4"/>
          <circle cx="35" cy="55" r="6" fill="#ffb961"/>
          <!-- Rex Sailor with Eye Patch sleeping -->
          <circle cx="-10" cy="50" r="18" fill="#2ecc71"/>
          <path d="M-15 50 Q-10 45 -5 50" stroke="#050f18" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        </g>

        ${safeText ? `
          <!-- Hero Choice Item Banner -->
          <g transform="translate(400, 465)">
            <rect x="-180" y="-22" width="360" height="38" rx="19" fill="#030d14" fill-opacity="0.85" stroke="#00d2d3" stroke-width="2"/>
            <text x="0" y="2" text-anchor="middle" fill="#00d2d3" font-family="sans-serif" font-weight="900" font-size="13">
              PIRATE GEAR: ${safeText.toUpperCase()}
            </text>
          </g>
        ` : ''}
      </svg>
    `;
  }

  // enchanted_castle
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" class="w-full h-full rounded-3xl overflow-hidden shadow-2xl">
      <defs>
        <linearGradient id="castleSky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0a1217"/>
          <stop offset="60%" stop-color="#121e25"/>
          <stop offset="100%" stop-color="#1b2a33"/>
        </linearGradient>
      </defs>
      <!-- Sky -->
      <rect width="800" height="500" fill="url(#castleSky)"/>
      
      <!-- Stars -->
      <g fill="#ffffff" opacity="0.75">
        <circle cx="90" cy="40" r="2.0"/>
        <circle cx="210" cy="65" r="1.5"/>
        <circle cx="400" cy="35" r="2.2"/>
        <circle cx="650" cy="55" r="1.8"/>
      </g>
      
      <!-- Starlight Golden Moon -->
      <circle cx="160" cy="110" r="45" fill="#ffb961" opacity="0.9"/>
      <circle cx="180" cy="100" r="42" fill="#121e25"/>

      <!-- Stone Castle Turrets & Battlements -->
      <rect x="240" y="220" width="320" height="200" fill="#14222b"/>
      <!-- Turret Left -->
      <rect x="210" y="160" width="70" height="260" fill="#182a36"/>
      <polygon points="210,160 245,100 280,160" fill="#ffb961"/>
      <!-- Turret Right -->
      <rect x="520" y="160" width="70" height="260" fill="#182a36"/>
      <polygon points="520,160 555,100 590,160" fill="#ffb961"/>
      
      <!-- Glowing Warm Hearth Windows -->
      <rect x="375" y="270" width="50" height="70" rx="25" fill="#f39c12"/>
      <rect x="235" y="200" width="20" height="35" rx="10" fill="#ffb961"/>
      <rect x="545" y="200" width="20" height="35" rx="10" fill="#ffb961"/>

      <!-- Waving Pennant Flag -->
      <polygon points="245,100 245,70 290,85" fill="#2ecc71"/>

      <!-- Ground Hill -->
      <path d="M-20 420 Q400 370 820 420 L820 520 L-20 520 Z" fill="#0d171d"/>

      <!-- Sleeping Friendly Mini Dragon -->
      <g transform="translate(380, 360)">
        <ellipse cx="25" cy="35" rx="35" ry="25" fill="#2ecc71"/>
        <circle cx="50" cy="20" r="18" fill="#2ecc71"/>
        <path d="M45 18 Q50 12 55 18" stroke="#0a1217" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <!-- Soft Snore Bubble -->
        <circle cx="68" cy="8" r="6" fill="#e0f2fe" opacity="0.6"/>
        <text x="66" y="11" font-size="8" fill="#0a1217" font-weight="900">z</text>
      </g>

      ${safeText ? `
        <!-- Hero Choice Item Banner -->
        <g transform="translate(400, 465)">
          <rect x="-180" y="-22" width="360" height="38" rx="19" fill="#0a1217" fill-opacity="0.85" stroke="#ffb961" stroke-width="2"/>
          <text x="0" y="2" text-anchor="middle" fill="#ffb961" font-family="sans-serif" font-weight="900" font-size="13">
            KNIGHT GEAR: ${safeText.toUpperCase()}
          </text>
        </g>
      ` : ''}
    </svg>
  `;
}
