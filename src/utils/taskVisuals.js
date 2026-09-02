// Pure Graphical / Visual Vector Art for Little Hero Adventures
// Designed specifically for toddlers (Ages 2-5) who cannot read text.
// Every icon is a 100% visual, recognizable, colorful physical object with zero text tags.

export function getTaskVisualSvg(key = '', colorTheme = 'blue') {
  const normKey = (key || '').toLowerCase().replace(/[^a-z0-9_]/g, '');

  // 1. TOOTHBRUSH & FOAM (dentistry, morning_brush, brush)
  if (normKey.includes('brush') || normKey.includes('dentist') || normKey.includes('teeth')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <radialGradient id="tbBg" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#1e3a5f"/>
          <stop offset="100%" stop-color="#081422"/>
        </radialGradient>
        <linearGradient id="tbHandle" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#38b6ff"/>
          <stop offset="100%" stop-color="#005bb5"/>
        </linearGradient>
        <linearGradient id="tbPaste" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#54e98a"/>
          <stop offset="100%" stop-color="#00b050"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#tbBg)" stroke="#38b6ff" stroke-width="3"/>
      <!-- Shiny Tooth -->
      <path d="M 40 28 C 40 20, 50 18, 54 24 C 58 18, 68 20, 68 28 C 68 36, 62 44, 58 52 C 55 58, 53 58, 50 52 C 46 44, 40 36, 40 28 Z" fill="#ffffff" stroke="#b0e0f8" stroke-width="2"/>
      <ellipse cx="48" cy="26" rx="3" ry="5" fill="#ffffff" opacity="0.9"/>
      <!-- Tooth Sparkle -->
      <polygon points="66,16 68,22 74,24 68,26 66,32 64,26 58,24 64,22" fill="#ffd700"/>
      <!-- Toothbrush Handle -->
      <rect x="18" y="62" width="55" height="12" rx="6" transform="rotate(-40 45 68)" fill="url(#tbHandle)" stroke="#ffffff" stroke-width="1.5"/>
      <!-- Grip Pads -->
      <circle cx="24" cy="80" r="3" fill="#ffffff" opacity="0.8"/>
      <circle cx="30" cy="75" r="3" fill="#ffffff" opacity="0.8"/>
      <!-- Bristle Head -->
      <rect x="54" y="32" width="18" height="10" rx="2" transform="rotate(-40 63 37)" fill="#ffffff" stroke="#b0e0f8" stroke-width="1.5"/>
      <!-- Toothpaste Swirl -->
      <path d="M 50 34 Q 60 22 72 32" fill="none" stroke="url(#tbPaste)" stroke-width="6" stroke-linecap="round"/>
      <!-- Foamy Soap Bubbles -->
      <circle cx="36" cy="36" r="6" fill="#ffffff" opacity="0.85" stroke="#b0e0f8" stroke-width="1.5"/>
      <circle cx="42" cy="44" r="4" fill="#ffffff" opacity="0.85" stroke="#b0e0f8" stroke-width="1.5"/>
      <circle cx="70" cy="44" r="5" fill="#ffffff" opacity="0.85" stroke="#b0e0f8" stroke-width="1.5"/>
    </svg>`;
  }

  // 2. DRINK WATER (water_drop, drink_water, water, hydration)
  if (normKey.includes('water') || normKey.includes('drink') || normKey.includes('hydration')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <radialGradient id="wBg" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#113854"/>
          <stop offset="100%" stop-color="#051522"/>
        </radialGradient>
        <radialGradient id="wDrop" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#70d6ff"/>
          <stop offset="60%" stop-color="#0096ff"/>
          <stop offset="100%" stop-color="#0060b8"/>
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#wBg)" stroke="#70d6ff" stroke-width="3"/>
      <!-- Ripples -->
      <ellipse cx="50" cy="78" rx="32" ry="9" fill="none" stroke="#0096ff" stroke-width="2.5" opacity="0.6"/>
      <ellipse cx="50" cy="82" rx="22" ry="6" fill="none" stroke="#70d6ff" stroke-width="2" opacity="0.4"/>
      <!-- Big Happy Water Drop -->
      <path d="M 50 16 C 50 16, 22 52, 22 66 C 22 81.5, 34.5 90, 50 90 C 65.5 90, 78 81.5, 78 66 C 78 52, 50 16, 50 16 Z" fill="url(#wDrop)" stroke="#ffffff" stroke-width="2.5"/>
      <!-- Specular Shine -->
      <path d="M 32 60 C 32 46, 42 32, 46 26" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.85"/>
      <!-- Cute Toddler Eyes -->
      <circle cx="42" cy="65" r="4" fill="#051522"/>
      <circle cx="40.5" cy="63.5" r="1.5" fill="#ffffff"/>
      <circle cx="58" cy="65" r="4" fill="#051522"/>
      <circle cx="56.5" cy="63.5" r="1.5" fill="#ffffff"/>
      <!-- Smiling Cheeks and Mouth -->
      <path d="M 46 72 Q 50 77 54 72" fill="none" stroke="#051522" stroke-width="2.5" stroke-linecap="round"/>
      <ellipse cx="36" cy="68" rx="3" ry="2" fill="#ff8fa3" opacity="0.7"/>
      <ellipse cx="64" cy="68" rx="3" ry="2" fill="#ff8fa3" opacity="0.7"/>
      <!-- Little Splash Droplets -->
      <circle cx="74" cy="34" r="4" fill="#70d6ff" stroke="#ffffff" stroke-width="1"/>
      <circle cx="24" cy="42" r="3" fill="#70d6ff" stroke="#ffffff" stroke-width="1"/>
    </svg>`;
  }

  // 3. HEALTHY SNACK / APPLE (nutrition, healthy_snack, apple, fruit, eat)
  if (normKey.includes('snack') || normKey.includes('fruit') || normKey.includes('apple') || normKey.includes('nutrition') || normKey.includes('food')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <radialGradient id="apBg" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#423200"/>
          <stop offset="100%" stop-color="#191300"/>
        </radialGradient>
        <radialGradient id="apBody" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#72fbbb"/>
          <stop offset="40%" stop-color="#2ecc71"/>
          <stop offset="100%" stop-color="#007a33"/>
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#apBg)" stroke="#f1c40f" stroke-width="3"/>
      <!-- Brown Stem -->
      <path d="M 50 32 C 50 20, 56 16, 62 14" fill="none" stroke="#784421" stroke-width="5" stroke-linecap="round"/>
      <!-- Fresh Green Leaf -->
      <path d="M 52 24 C 64 16, 74 20, 72 32 C 60 34, 52 30, 52 24 Z" fill="#54e98a" stroke="#196f3d" stroke-width="1.5"/>
      <!-- Plump Apple Body -->
      <path d="M 50 34 C 42 26, 20 28, 18 52 C 16 72, 34 90, 48 90 C 50 90, 50 88, 52 88 C 54 88, 54 90, 56 90 C 70 90, 86 72, 84 52 C 82 28, 60 26, 50 34 Z" fill="url(#apBody)" stroke="#ffffff" stroke-width="2.5"/>
      <!-- Shiny Gloss Highlight -->
      <ellipse cx="32" cy="46" rx="8" ry="16" transform="rotate(-25 32 46)" fill="#ffffff" opacity="0.55"/>
      <!-- Gold Star Badge -->
      <polygon points="72,66 74,72 80,74 75,78 77,84 72,81 67,84 69,78 64,74 70,72" fill="#ffd700" stroke="#b38600" stroke-width="1"/>
    </svg>`;
  }

  // 4. WASH HANDS / SOAP (soap, hand_washing, wash, hands, clean_hands)
  if (normKey.includes('soap') || normKey.includes('wash') || normKey.includes('hand')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <radialGradient id="spBg" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#0e454f"/>
          <stop offset="100%" stop-color="#041c22"/>
        </radialGradient>
        <linearGradient id="spBar" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#7ef9ff"/>
          <stop offset="50%" stop-color="#00d4e0"/>
          <stop offset="100%" stop-color="#008b94"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#spBg)" stroke="#00d4e0" stroke-width="3"/>
      <!-- Water Waves at bottom -->
      <path d="M 10 78 Q 28 70 50 78 T 90 78 L 90 90 L 10 90 Z" fill="#008b94" opacity="0.5"/>
      <!-- Chunky Soap Bar -->
      <rect x="22" y="42" width="56" height="36" rx="16" fill="url(#spBar)" stroke="#ffffff" stroke-width="2.5" transform="rotate(-12 50 60)"/>
      <!-- Soap Grooves & Shimmer -->
      <path d="M 34 50 Q 50 44 66 50" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
      <!-- Big Foam Bubbles -->
      <circle cx="36" cy="30" r="12" fill="#ffffff" opacity="0.85" stroke="#7ef9ff" stroke-width="2"/>
      <circle cx="33" cy="26" r="4" fill="#ffffff"/>
      <circle cx="62" cy="24" r="14" fill="#ffffff" opacity="0.85" stroke="#7ef9ff" stroke-width="2"/>
      <circle cx="58" cy="20" r="4" fill="#ffffff"/>
      <circle cx="76" cy="44" r="10" fill="#ffffff" opacity="0.85" stroke="#7ef9ff" stroke-width="2"/>
      <circle cx="20" cy="52" r="8" fill="#ffffff" opacity="0.85" stroke="#7ef9ff" stroke-width="2"/>
      <!-- Little Star Sparkles -->
      <polygon points="50,14 52,18 56,20 52,22 50,26 48,22 44,20 48,18" fill="#ffd700"/>
      <polygon points="78,68 80,72 84,74 80,76 78,80 76,76 72,74 76,72" fill="#ffd700"/>
    </svg>`;
  }

  // 5. MAKE BED (bed, make_bed, sleep, room)
  if (normKey.includes('bed') && !normKey.includes('time')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <radialGradient id="bdBg" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#084b3f"/>
          <stop offset="100%" stop-color="#021c17"/>
        </radialGradient>
        <linearGradient id="bdQuilt" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#38b6ff"/>
          <stop offset="100%" stop-color="#005ea6"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#bdBg)" stroke="#00d67d" stroke-width="3"/>
      <!-- Wooden Bed Posts & Headboard -->
      <rect x="14" y="26" width="10" height="56" rx="4" fill="#8c5600" stroke="#523200" stroke-width="2"/>
      <rect x="76" y="38" width="10" height="44" rx="4" fill="#8c5600" stroke="#523200" stroke-width="2"/>
      <rect x="18" y="32" width="64" height="20" rx="6" fill="#a66800" stroke="#523200" stroke-width="2"/>
      <!-- Mattress Base -->
      <rect x="20" y="58" width="60" height="18" rx="4" fill="#ffffff" stroke="#b0c4de" stroke-width="2"/>
      <!-- Cozy Folded Quilt / Blanket -->
      <rect x="36" y="52" width="46" height="22" rx="6" fill="url(#bdQuilt)" stroke="#ffffff" stroke-width="2"/>
      <!-- Star on Blanket -->
      <polygon points="60,58 62,62 66,63 63,66 64,70 60,68 56,70 57,66 54,63 58,62" fill="#ffd700"/>
      <!-- Puffy Fluffy Pillows -->
      <rect x="22" y="44" width="22" height="14" rx="6" fill="#ffffff" stroke="#80d4ff" stroke-width="2"/>
      <ellipse cx="33" cy="51" rx="6" ry="3" fill="#e6f7ff"/>
      <!-- Sun Shine Rising -->
      <circle cx="72" cy="22" r="8" fill="#ffd700" stroke="#ffa500" stroke-width="1.5"/>
      <line x1="72" y1="10" x2="72" y2="13" stroke="#ffd700" stroke-width="2" stroke-linecap="round"/>
      <line x1="84" y1="22" x2="81" y2="22" stroke="#ffd700" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
  }

  // 6. TOY CHEST / CLEAN TOYS (toys, clean_toys, blocks, clean)
  if (normKey.includes('toy') || normKey.includes('block') || normKey.includes('clean_toys')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <radialGradient id="tyBg" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#4a3a00"/>
          <stop offset="100%" stop-color="#1c1600"/>
        </radialGradient>
        <linearGradient id="tyWood" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#a0652d"/>
          <stop offset="100%" stop-color="#5e3814"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#tyBg)" stroke="#ffd700" stroke-width="3"/>
      <!-- Toy Chest Base -->
      <path d="M 18 52 L 82 52 L 76 86 L 24 86 Z" fill="url(#tyWood)" stroke="#382109" stroke-width="2.5"/>
      <rect x="15" y="48" width="70" height="8" rx="3" fill="#b57639" stroke="#382109" stroke-width="2"/>
      <!-- Golden Chest Lock Clasp -->
      <rect x="46" y="52" width="8" height="10" rx="2" fill="#ffd700" stroke="#806400" stroke-width="1.5"/>
      <circle cx="50" cy="58" r="1.5" fill="#000000"/>
      <!-- Cute Teddy Bear Peeking Out -->
      <circle cx="42" cy="38" r="14" fill="#c68642" stroke="#7a4917" stroke-width="2"/>
      <circle cx="32" cy="26" r="5" fill="#c68642" stroke="#7a4917" stroke-width="1.5"/>
      <circle cx="32" cy="26" r="2.5" fill="#e0a96d"/>
      <circle cx="52" cy="26" r="5" fill="#c68642" stroke="#7a4917" stroke-width="1.5"/>
      <circle cx="52" cy="26" r="2.5" fill="#e0a96d"/>
      <!-- Bear Snout & Eyes -->
      <circle cx="38" cy="36" r="2" fill="#1a0f05"/>
      <circle cx="46" cy="36" r="2" fill="#1a0f05"/>
      <ellipse cx="42" cy="42" rx="5" ry="3.5" fill="#e0a96d"/>
      <circle cx="42" cy="40.5" r="1.5" fill="#1a0f05"/>
      <!-- Colorful Toy Building Blocks -->
      <rect x="58" y="36" width="15" height="15" rx="2" fill="#ff4757" stroke="#b31221" stroke-width="1.5"/>
      <circle cx="65.5" cy="43.5" r="3.5" fill="#ffffff" opacity="0.6"/>
      <!-- Toy Star Ball -->
      <circle cx="68" cy="66" r="8" fill="#ffd700" stroke="#e67e22" stroke-width="1.5"/>
      <polygon points="68,60 70,64 74,65 71,68 72,72 68,70 64,72 65,68 62,65 66,64" fill="#e74c3c"/>
    </svg>`;
  }

  // 7. READING / HOMEWORK / BOOK (menu_book, homework_reading, book, reading, study)
  if (normKey.includes('book') || normKey.includes('read') || normKey.includes('homework') || normKey.includes('study')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <radialGradient id="bkBg" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#114528"/>
          <stop offset="100%" stop-color="#051c0f"/>
        </radialGradient>
        <linearGradient id="bkCover" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#3498db"/>
          <stop offset="100%" stop-color="#2ecc71"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#bkBg)" stroke="#54e98a" stroke-width="3"/>
      <!-- Glow Under Book -->
      <ellipse cx="50" cy="68" rx="36" ry="12" fill="#ffd700" opacity="0.2"/>
      <!-- Thick Book Cover Base -->
      <path d="M 14 62 C 30 56, 46 62, 50 66 C 54 62, 70 56, 86 62 L 84 74 C 68 68, 54 72, 50 76 C 46 72, 32 68, 16 74 Z" fill="url(#bkCover)" stroke="#196f3d" stroke-width="2"/>
      <!-- Spread Open Pages -->
      <path d="M 18 58 C 32 50, 46 56, 50 60 L 50 36 C 46 32, 32 26, 18 34 Z" fill="#ffffff" stroke="#b0bec5" stroke-width="1.5"/>
      <path d="M 82 58 C 68 50, 54 56, 50 60 L 50 36 C 54 32, 68 26, 82 34 Z" fill="#fffef7" stroke="#b0bec5" stroke-width="1.5"/>
      <!-- Page Lines -->
      <line x1="24" y1="40" x2="44" y2="36" stroke="#3498db" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="24" y1="46" x2="40" y2="43" stroke="#3498db" stroke-width="2" stroke-linecap="round"/>
      <line x1="24" y1="52" x2="36" y2="50" stroke="#3498db" stroke-width="2" stroke-linecap="round"/>
      <polygon points="66,36 68,42 74,43 70,47 71,53 66,50 61,53 62,47 58,43 64,42" fill="#ffd700" stroke="#d4ac0d" stroke-width="1"/>
      <!-- Magic Star Sparks Leaping From Story -->
      <polygon points="50,14 52,20 58,22 52,24 50,30 48,24 42,22 48,20" fill="#ffd700" stroke="#ffffff" stroke-width="1"/>
      <circle cx="32" cy="18" r="3" fill="#54e98a"/>
      <circle cx="68" cy="18" r="2.5" fill="#ffd700"/>
      <circle cx="78" cy="28" r="3" fill="#38b6ff"/>
    </svg>`;
  }

  // 8. BEDTIME / SLEEP (bedtime, night_bedtime, moon, sleep)
  if (normKey.includes('night') || normKey.includes('sleep') || normKey.includes('bedtime') || normKey.includes('moon')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <radialGradient id="ntBg" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#12224d"/>
          <stop offset="100%" stop-color="#040917"/>
        </radialGradient>
        <radialGradient id="ntMoon" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#fff176"/>
          <stop offset="60%" stop-color="#fbc02d"/>
          <stop offset="100%" stop-color="#f57f17"/>
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#ntBg)" stroke="#ffd700" stroke-width="3"/>
      <!-- Fluffy White Cloud Base -->
      <path d="M 20 78 C 14 78, 10 72, 14 66 C 14 58, 26 54, 32 60 C 36 50, 52 48, 58 56 C 66 52, 78 56, 78 66 C 84 66, 88 72, 84 78 Z" fill="#ffffff" stroke="#b0c4de" stroke-width="2"/>
      <!-- Smiling Sleeping Crescent Moon -->
      <path d="M 54 16 C 36 16, 26 30, 26 48 C 26 66, 38 78, 54 80 C 44 72, 40 58, 42 44 C 44 30, 50 20, 54 16 Z" fill="url(#ntMoon)" stroke="#ffffff" stroke-width="2"/>
      <!-- Moon Sleeping Eye & Cheek -->
      <path d="M 32 46 Q 36 49 40 46" fill="none" stroke="#7d5700" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="36" cy="52" r="3" fill="#ff8fa3" opacity="0.8"/>
      <!-- Sleepy ZZZs -->
      <path d="M 62 26 L 70 26 L 62 34 L 70 34" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 74 16 L 80 16 L 74 22 L 80 22" fill="none" stroke="#ffd700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Twinkling Night Stars -->
      <polygon points="76,38 78,42 82,43 78,45 76,49 74,45 70,43 74,42" fill="#ffffff"/>
      <polygon points="22,32 23,35 26,36 23,37 22,40 21,37 18,36 21,35" fill="#ffd700"/>
    </svg>`;
  }

  // 9. KIND WORDS / FRIENDSHIP (favorite, gentle_words, kindness, heart, hug)
  if (normKey.includes('kind') || normKey.includes('gentle') || normKey.includes('friend') || normKey.includes('favorite') || normKey.includes('heart')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <radialGradient id="kdBg" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#0e452a"/>
          <stop offset="100%" stop-color="#03170d"/>
        </radialGradient>
        <radialGradient id="kdHeart" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#69f0ae"/>
          <stop offset="50%" stop-color="#00e676"/>
          <stop offset="100%" stop-color="#00a152"/>
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#kdBg)" stroke="#69f0ae" stroke-width="3"/>
      <!-- Glowing Heart -->
      <path d="M 50 84 C 50 84, 18 64, 18 42 C 18 28, 30 20, 42 24 C 46 26, 48 30, 50 34 C 52 30, 54 26, 58 24 C 70 20, 82 28, 82 42 C 82 64, 50 84, 50 84 Z" fill="url(#kdHeart)" stroke="#ffffff" stroke-width="3"/>
      <!-- Specular Shine on Heart -->
      <path d="M 26 38 C 26 30, 34 26, 38 28" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
      <!-- High Five Cartoon Hands in Center -->
      <circle cx="42" cy="52" r="7" fill="#ffd700" stroke="#b38600" stroke-width="1.5"/>
      <circle cx="58" cy="52" r="7" fill="#ffd700" stroke="#b38600" stroke-width="1.5"/>
      <!-- Happy Sparkles -->
      <polygon points="50,44 52,48 56,50 52,52 50,56 48,52 44,50 48,48" fill="#ffffff"/>
      <polygon points="22,18 24,22 28,23 24,25 22,29 20,25 16,23 20,22" fill="#ffd700"/>
      <polygon points="76,18 78,22 82,23 78,25 76,29 74,25 70,23 74,22" fill="#ffd700"/>
    </svg>`;
  }

  // 10. CLOTHES / LAUNDRY (checkroom, clothes, laundry)
  if (normKey.includes('checkroom') || normKey.includes('cloth') || normKey.includes('laundry')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <radialGradient id="clBg" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#143454"/>
          <stop offset="100%" stop-color="#051424"/>
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#clBg)" stroke="#38b6ff" stroke-width="3"/>
      <!-- Folded Shirt / Clothes -->
      <path d="M 25 36 L 40 28 L 50 34 L 60 28 L 75 36 L 70 48 L 62 45 L 62 76 L 38 76 L 38 45 L 30 48 Z" fill="#38b6ff" stroke="#ffffff" stroke-width="2.5"/>
      <!-- Hero Star on Chest -->
      <polygon points="50,44 53,50 59,51 55,55 56,61 50,58 44,61 45,55 41,51 47,50" fill="#ffd700"/>
      <!-- Folded Pants underneath -->
      <rect x="34" y="74" width="32" height="12" rx="3" fill="#2ecc71" stroke="#ffffff" stroke-width="1.5"/>
    </svg>`;
  }

  // 11. PET CARE / FEEDING (pets, dog, cat, feed)
  if (normKey.includes('pet') || normKey.includes('feed') || normKey.includes('dog') || normKey.includes('cat')) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
      <defs>
        <radialGradient id="ptBg" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#4a3000"/>
          <stop offset="100%" stop-color="#1a1100"/>
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#ptBg)" stroke="#f39c12" stroke-width="3"/>
      <!-- Pet Food Bowl -->
      <ellipse cx="50" cy="72" rx="34" ry="12" fill="#d35400" stroke="#a04000" stroke-width="2"/>
      <ellipse cx="50" cy="66" rx="30" ry="10" fill="#f39c12" stroke="#ffffff" stroke-width="1.5"/>
      <!-- Big Playful Paw Print -->
      <ellipse cx="50" cy="46" rx="14" ry="11" fill="#ffd700" stroke="#ffffff" stroke-width="2"/>
      <circle cx="34" cy="30" r="5.5" fill="#ffd700" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="45" cy="24" r="5.5" fill="#ffd700" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="56" cy="24" r="5.5" fill="#ffd700" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="67" cy="30" r="5.5" fill="#ffd700" stroke="#ffffff" stroke-width="1.5"/>
    </svg>`;
  }

  // DEFAULT HERO STAR BADGE (For any other chore / habit)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
    <defs>
      <radialGradient id="defBg" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#3a2c00"/>
        <stop offset="100%" stop-color="#140f00"/>
      </radialGradient>
      <radialGradient id="defStar" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#fff176"/>
        <stop offset="50%" stop-color="#ffd700"/>
        <stop offset="100%" stop-color="#f57f17"/>
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="48" fill="url(#defBg)" stroke="#ffd700" stroke-width="3"/>
    <!-- Hero Star -->
    <polygon points="50,14 61,36 85,38 67,54 73,78 50,65 27,78 33,54 15,38 39,36" fill="url(#defStar)" stroke="#ffffff" stroke-width="2.5"/>
    <circle cx="50" cy="48" r="10" fill="#ffffff" opacity="0.5"/>
    <!-- Sparkles -->
    <circle cx="24" cy="22" r="3.5" fill="#ffd700"/>
    <circle cx="76" cy="22" r="3.5" fill="#ffd700"/>
  </svg>`;
}

export function getTaskVisualDataUrl(key, colorTheme) {
  const svg = getTaskVisualSvg(key, colorTheme);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
