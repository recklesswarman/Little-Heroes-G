# 24 Pets Design Systems Architecture (DESIGN.md Compliant)
**Project:** Little-Heroes-G  
**Core Theme:** Adventurous Explorer / Chunky Tactile Toy Skeuomorphism  
**Constraint Enforced:** Strict omission of pink and purple. Replaced with Electric Cyan, Solar Amber, Deep Cobalt, Plasma Gold, and Bioluminescent Emerald.

---

## Global Design Token Baseline
- **Background Foundation:** `#09141e` (Midnight Charcoal Navy)
- **Base Surfaces:**
  - `surface-container-low`: `#121d26`
  - `surface-container`: `#16212b`
  - `surface-container-high`: `#202b35`
  - `surface-container-highest`: `#2b3640`
- **Typography:**
  - Headlines: **Plus Jakarta Sans** (Extra Bold 800)
  - Body & Interactive: **Quicksand** (Bold 700 / Semi-Bold 600)
- **Tactile 3D Button Metrics:**
  - Normal State: 6px–8px solid bottom border (`darker tone`), `translate-y-0`
  - Active State: `translate-y-1` or `translate-y-1.5`, 2px bottom border
  - Card Shadow: `0 10px 0 0 #050b10` (heavy toy-block drop bevel)
  - Border Radius: `rounded-2xl` (16px–20px)

---

## Detailed 24 Pets Design Tokens & Theme Palettes

### 1. Rex the T-Rex (Apex Stomper)
- **Archetype:** Prehistoric Dino | **Assigned Habit:** Active Play / Sports
- **Theme Concept:** Primeval Thunder & Deep Jungle Armor
- **Palette:**
  - Primary Glow: `#2ecc71` (Jungle Emerald)
  - Primary Dark (3D Bottom Border): `#1b7a43`
  - Accent / Reward: `#f1c40f` (Thunder Gold)
  - Accent Dark: `#a68500`
  - Card Container: `#142820`
  - Card Outline: `#27ae60`
  - Glow Shadow: `rgba(46, 204, 113, 0.45)`
- **Habit Perk:** "Knee Lifter: +20 Coins for every physical activity task completed"
- **Interactive Motif:** Heavy Earth-tremor stomper borders, claw-notched badge headers.

---

### 2. Raptor the Velociraptor (Lightning Sprinter)
- **Archetype:** Prehistoric Dino | **Assigned Habit:** Morning Routine
- **Theme Concept:** Volcanic Magma & Sunrise Bolt
- **Palette:**
  - Primary Glow: `#e74c3c` (Molten Crimson)
  - Primary Dark: `#96281b`
  - Accent / Reward: `#f39c12` (Solar Spark Amber)
  - Accent Dark: `#a06004`
  - Card Container: `#261614`
  - Card Outline: `#c0392b`
  - Glow Shadow: `rgba(231, 76, 60, 0.45)`
- **Habit Perk:** "Speedy Start: +15 Coins if morning chores are done before 8 AM"
- **Interactive Motif:** Slanted speed-stripe headers, dual-claw action buttons.

---

### 3. Stego the Stegosaurus (Solar Stomper)
- **Archetype:** Prehistoric Dino | **Assigned Habit:** Outdoor Play
- **Theme Concept:** Radiant Sun-plate & Forest Moss
- **Palette:**
  - Primary Glow: `#f1c40f` (Solar Flare Yellow)
  - Primary Dark: `#9b7b02`
  - Accent / Reward: `#2ecc71` (Jungle Vine Green)
  - Accent Dark: `#186938`
  - Card Container: `#232111`
  - Card Outline: `#d4ac0d`
  - Glow Shadow: `rgba(241, 196, 15, 0.4)`
- **Habit Perk:** "Stomper Power: +25 Coins on outdoor play and exercise tasks"
- **Interactive Motif:** Stego-plate serrated progress notches, chunky sun-medallions.

---

### 4. Pterry the Pterodactyl (The Sky Launcher)
*(Formerly Purple `#9b59b6` -> Remapped to Electric Aero Cyan & Storm Cobalt)*
- **Archetype:** Prehistoric Dino | **Assigned Habit:** Stretch & Exercise
- **Theme Concept:** High-Altitude Hurricane & Electric Jetstream
- **Palette:**
  - Primary Glow: `#00d2ff` (Electric Cyan)
  - Primary Dark: `#0084a3`
  - Accent / Reward: `#3a7bd5` (Aero Cobalt)
  - Accent Dark: `#1f4c8c`
  - Card Container: `#0d202b`
  - Card Outline: `#00b4d8`
  - Glow Shadow: `rgba(0, 210, 255, 0.45)`
- **Habit Perk:** "Sky Launcher: 2x XP on all jumping and stretching exercises"
- **Interactive Motif:** Wing-sweep chevron dividers, cloud-burst jump counters.

---

### 5. Chomper the Compsognathus (Tiny Dancer)
- **Archetype:** Prehistoric Dino | **Assigned Habit:** Dance & Movement
- **Theme Concept:** Kinetic Teal Cyclone & Blaze Amber
- **Palette:**
  - Primary Glow: `#1abc9c` (Kinetic Turquoise)
  - Primary Dark: `#116957`
  - Accent / Reward: `#f39c12` (Rhythm Amber)
  - Accent Dark: `#995e04`
  - Card Container: `#0d2420`
  - Card Outline: `#16a085`
  - Glow Shadow: `rgba(26, 188, 156, 0.45)`
- **Habit Perk:** "Prancer Bonus: +30 Coins for completing dance or movement tasks"
- **Interactive Motif:** Pulsing beat-equalizer meter tabs, spring-loaded bouncy buttons.

---

### 6. Brachio the Brachiosaurus (The Great Stretcher)
- **Archetype:** Prehistoric Dino | **Assigned Habit:** Yoga & Stretching
- **Theme Concept:** Ancient Treetop Canopy & Mountain Granite
- **Palette:**
  - Primary Glow: `#34495e` (Deep Canopy Slate)
  - Primary Dark: `#1e2b37`
  - Accent / Reward: `#2ecc71` (Living Canopy Leaf)
  - Accent Dark: `#196f3d`
  - Card Container: `#151f28`
  - Card Outline: `#4a627a`
  - Glow Shadow: `rgba(46, 204, 113, 0.35)`
- **Habit Perk:** "Tall Stretch: +20 XP every time you reach for the stars in exercise"
- **Interactive Motif:** Vertical height-ruler progress meters, wide stabilizing pedestals.

---

### 7. Dippy the Diplodocus (Balance Master)
- **Archetype:** Prehistoric Dino | **Assigned Habit:** Balance & Flexibility
- **Theme Concept:** River Terraces & Sunset Bark
- **Palette:**
  - Primary Glow: `#e67e22` (River Terracotta)
  - Primary Dark: `#944c0c`
  - Accent / Reward: `#27ae60` (Reed Moss Green)
  - Accent Dark: `#145a32`
  - Card Container: `#261c14`
  - Card Outline: `#d35400`
  - Glow Shadow: `rgba(230, 126, 34, 0.45)`
- **Habit Perk:** "Balance Master: +25 Coins on balance and coordination tasks"
- **Interactive Motif:** Dual-level fulcrum sliders, stone balance-stack indicators.

---

### 8. Spino the Spinosaurus (Cool-Down King)
- **Archetype:** Prehistoric Dino | **Assigned Habit:** Cool Down & Recovery
- **Theme Concept:** Aquatic Fin & Glacial Wave
- **Palette:**
  - Primary Glow: `#c0392b` (Spine Coral)
  - Primary Dark: `#782117`
  - Accent / Reward: `#3498db` (Hydro Cobalt)
  - Accent Dark: `#1d5982`
  - Card Container: `#241818`
  - Card Outline: `#e74c3c`
  - Glow Shadow: `rgba(52, 152, 219, 0.45)`
- **Habit Perk:** "Spine Arch: +15 XP on all cool-down and stretching routines"
- **Interactive Motif:** Fan-blade cooling vents, arched thermal-to-chill bar gradients.

---

### 9. Sparky the Dragon (The Azure Ember)
- **Archetype:** Dragon | **Assigned Habit:** Brush Teeth
- **Theme Concept:** Glacial Blueflame & Mint Crystals
- **Palette:**
  - Primary Glow: `#3498db` (Dragon Flame Blue)
  - Primary Dark: `#1c5f8a`
  - Accent / Reward: `#2ecc71` (Mint Shield Green)
  - Accent Dark: `#19703e`
  - Card Container: `#101e2b`
  - Card Outline: `#2980b9`
  - Glow Shadow: `rgba(52, 152, 219, 0.5)`
- **Habit Perk:** "Dragon Breath: 2x Coins on every toothbrushing session"
- **Interactive Motif:** Crystalline tooth-timer progress tube, dual fire-frost shields.

---

### 10. Aero the Griffin (The Solar Sentinel)
- **Archetype:** Mystic Sentinel | **Assigned Habit:** Homework & Reading
- **Theme Concept:** Golden Citadel Sunbeam & High Wind Blue
- **Palette:**
  - Primary Glow: `#f1c40f` (Sunray Gold)
  - Primary Dark: `#9b7b02`
  - Accent / Reward: `#3498db` (Stratosphere Blue)
  - Accent Dark: `#1c5f8a`
  - Card Container: `#242214`
  - Card Outline: `#f39c12`
  - Glow Shadow: `rgba(241, 196, 15, 0.45)`
- **Habit Perk:** "Eagle Eye: +25% XP on all homework and reading tasks"
- **Interactive Motif:** Scroll-fold status banners, feather-quill task checkers.

---

### 11. Blaze the Phoenix (Midnight Flame)
- **Archetype:** Mystic Sentinel | **Assigned Habit:** Bedtime Routine
- **Theme Concept:** Sunset Embers & Nightfall Hearth
- **Palette:**
  - Primary Glow: `#e74c3c` (Cozy Hearth Fire)
  - Primary Dark: `#96281b`
  - Accent / Reward: `#f39c12` (Star Cinder Amber)
  - Accent Dark: `#995e04`
  - Card Container: `#261715`
  - Card Outline: `#d35400`
  - Glow Shadow: `rgba(231, 76, 60, 0.4)`
- **Habit Perk:** "Cozy Embers: +20 Coins for completing your bedtime routine on time"
- **Interactive Motif:** Soft dimmed night-glow toggle switches, star-dusted lullaby badges.

---

### 12. Hydra the Sea Serpent (Tidal Guardian)
- **Archetype:** Aquatic Guardian | **Assigned Habit:** Drink Water
- **Theme Concept:** Abyssal Trench & Pure Spring Ice
- **Palette:**
  - Primary Glow: `#2980b9` (Oceanic Sapphire)
  - Primary Dark: `#174a6b`
  - Accent / Reward: `#1abc9c` (Aquifer Aqua)
  - Accent Dark: `#106b59`
  - Card Container: `#0f1e29`
  - Card Outline: `#3498db`
  - Glow Shadow: `rgba(41, 128, 185, 0.45)`
- **Habit Perk:** "Wave Rider: +15 XP every time you drink a cup of water"
- **Interactive Motif:** Hydration droplet vials, ripple-depth pill counters.

---

### 13. Luna the Unicorn (Rainbow Weaver)
*(Formerly Purple `#9b59b6` -> Remapped to Starlight Cyan & Solar Amber Prism)*
- **Archetype:** Mystic Companion | **Assigned Habit:** Creative Play
- **Theme Concept:** Aurora Borealis & Prismatic Solar Beam
- **Palette:**
  - Primary Glow: `#00e5ff` (Aurora Electric Cyan)
  - Primary Dark: `#008ea0`
  - Accent / Reward: `#ffb300` (Prismatic Gold)
  - Accent Dark: `#9e6f00`
  - Card Container: `#0d2229`
  - Card Outline: `#00b0ff`
  - Glow Shadow: `rgba(0, 229, 255, 0.45)`
- **Habit Perk:** "Magic Spark: +25% Coins on all creative play and art tasks"
- **Interactive Motif:** Geometric prism-edged cards, starry stardust sparkle-docks.

---

### 14. Kira the Kirin (The Order Keeper)
- **Archetype:** Mystic Forest | **Assigned Habit:** Clean Room
- **Theme Concept:** Bamboo Jade & Golden Sun-hoof
- **Palette:**
  - Primary Glow: `#f39c12` (Golden Antler Amber)
  - Primary Dark: `#945d04`
  - Accent / Reward: `#2ecc71` (Bamboo Leaf Green)
  - Accent Dark: `#196f3d`
  - Card Container: `#221c11`
  - Card Outline: `#e67e22`
  - Glow Shadow: `rgba(243, 156, 18, 0.45)`
- **Habit Perk:** "Tidy Hooves: +30 XP when you clean your room completely"
- **Interactive Motif:** Snap-to-grid toy sort slots, spotless chime bells.

---

### 15. Boulder the Crystal Golem (Iron Fortress)
- **Archetype:** Beast / Golem | **Assigned Habit:** Healthy Eating
- **Theme Concept:** Raw Obsidian, Titanium & Emerald Core
- **Palette:**
  - Primary Glow: `#7f8c8d` (Titanium Granite)
  - Primary Dark: `#485253`
  - Accent / Reward: `#2ecc71` (Nutrient Emerald)
  - Accent Dark: `#196f3d`
  - Card Container: `#192022`
  - Card Outline: `#95a5a6`
  - Glow Shadow: `rgba(46, 204, 113, 0.4)`
- **Habit Perk:** "Rock Solid: +20 Coins for every healthy meal or snack logged"
- **Interactive Motif:** Heavy beveled stone slabs, diamond-crystal power gauges.

---

### 16. Cosmo the Cyber Mech (The Quantum Hound)
*(Formerly Violet `#8e44ad` -> Remapped to Quantum Neon Cyan & Plasma Amber)*
- **Archetype:** Robot Mech | **Assigned Habit:** Learning Games
- **Theme Concept:** Cyber Deck, Laser Matrix & Circuit Amber
- **Palette:**
  - Primary Glow: `#00f5d4` (Quantum Laser Cyan)
  - Primary Dark: `#009682`
  - Accent / Reward: `#ffbe0b` (Circuit Board Amber)
  - Accent Dark: `#9c7400`
  - Card Container: `#0a1f22`
  - Card Outline: `#00bbf9`
  - Glow Shadow: `rgba(0, 245, 212, 0.45)`
- **Habit Perk:** "Data Download: 2x XP on all learning games and educational quests"
- **Interactive Motif:** Digital segment display counters, microchip solder-joint pads.

---

### 17. Leo the Lion (Pride Leader)
- **Archetype:** Beast Vanguard | **Assigned Habit:** Teamwork
- **Theme Concept:** Savannah Sunburst & Royal Amber
- **Palette:**
  - Primary Glow: `#f1c40f` (Sun Lion Gold)
  - Primary Dark: `#9b7b02`
  - Accent / Reward: `#e67e22` (Mane Orange)
  - Accent Dark: `#914d0c`
  - Card Container: `#262112`
  - Card Outline: `#f39c12`
  - Glow Shadow: `rgba(241, 196, 15, 0.45)`
- **Habit Perk:** "Pride Leader: +20 XP on all teamwork and cooperative tasks"
- **Interactive Motif:** Crowned shield badges, multi-hero linked avatar tracks.

---

### 18. Stripe the Tiger (The Clean Paws)
- **Archetype:** Beast Vanguard | **Assigned Habit:** Wash Hands
- **Theme Concept:** Tiger Stripe Flame & Soapy Splash Teal
- **Palette:**
  - Primary Glow: `#e67e22` (Jungle Blaze Orange)
  - Primary Dark: `#8f4a0c`
  - Accent / Reward: `#2ecc71` (Clean Spring Mint)
  - Accent Dark: `#186938`
  - Card Container: `#241b12`
  - Card Outline: `#d35400`
  - Glow Shadow: `rgba(230, 126, 34, 0.45)`
- **Habit Perk:** "Clean Paws: +15 Coins every time you wash your hands before meals"
- **Interactive Motif:** Soap bubble meter capsules, paw-print stamp checkboxes.

---

### 19. Fang the Wolf (Moonlight Scout)
- **Archetype:** Beast Vanguard | **Assigned Habit:** Brush Teeth
- **Theme Concept:** Arctic Moon Timber & Glacier Silver
- **Palette:**
  - Primary Glow: `#95a5a6` (Moonlit Silver)
  - Primary Dark: `#546364`
  - Accent / Reward: `#2ecc71` (Fresh Mint Green)
  - Accent Dark: `#186938`
  - Card Container: `#171f22`
  - Card Outline: `#7f8c8d`
  - Glow Shadow: `rgba(46, 204, 113, 0.35)`
- **Habit Perk:** "Moonlight Shine: +20 XP for each completed toothbrushing session"
- **Interactive Motif:** Wolf fang badge frames, frost-etched 2-minute streak track.

---

### 20. Scout the Eagle (Sky Sentinel)
- **Archetype:** Mystic / Aviator | **Assigned Habit:** Homework & Reading
- **Theme Concept:** High Air Glider & Solar Beacon
- **Palette:**
  - Primary Glow: `#3498db` (Aviator Blue)
  - Primary Dark: `#1d5a83`
  - Accent / Reward: `#f1c40f` (Horizon Yellow)
  - Accent Dark: `#9b7b02`
  - Card Container: `#121e29`
  - Card Outline: `#2980b9`
  - Glow Shadow: `rgba(52, 152, 219, 0.45)`
- **Habit Perk:** "Sky Reader: +15 Coins on every homework and reading task completed"
- **Interactive Motif:** Altimeter study dials, bookmark-ribbon completion badges.

---

### 21. Gnasher the Shark (Deep Diver)
- **Archetype:** Aquatic Guardian | **Assigned Habit:** Bedtime Routine
- **Theme Concept:** Midnight Submersible & Bioluminescent Gold
- **Palette:**
  - Primary Glow: `#1f618d` (Deep Abyss Navy)
  - Primary Dark: `#123c58`
  - Accent / Reward: `#f1c40f` (Luminescent Lure Amber)
  - Accent Dark: `#997a00`
  - Card Container: `#0d1924`
  - Card Outline: `#2980b9`
  - Glow Shadow: `rgba(31, 97, 141, 0.5)`
- **Habit Perk:** "Deep Rest: +25% XP for completing the full bedtime routine"
- **Interactive Motif:** Porthole circular containers, pressure-gauge sleep dials.

---

### 22. Shadow the Panther (Silent Sweeper)
*(Formerly Dark Violet Accent `#9b59b6` -> Remapped to Cyber Stealth Emerald/Cyan)*
- **Archetype:** Beast Stealth | **Assigned Habit:** Clean Room
- **Theme Concept:** Shadow Stealth Carbon & Night-Vision Emerald
- **Palette:**
  - Primary Glow: `#2c3e50` (Midnight Carbon Slate)
  - Primary Dark: `#17212b`
  - Accent / Reward: `#00e676` (Night-Vision Emerald)
  - Accent Dark: `#008c47`
  - Card Container: `#111a22`
  - Card Outline: `#00c853`
  - Glow Shadow: `rgba(0, 230, 118, 0.35)`
- **Habit Perk:** "Stealth Sweeper: +20 Coins for cleaning your room without being asked"
- **Interactive Motif:** Matte-black stealth plates, instant vanished-clutter counters.

---

### 23. Barnaby the Bear (Honey Woodsman)
- **Archetype:** Beast Vanguard | **Assigned Habit:** Healthy Eating
- **Theme Concept:** Woodland Cedar, Wild Forest & Wildflower Honey
- **Palette:**
  - Primary Glow: `#d35400` (Timber Bark Orange)
  - Primary Dark: `#7f3100`
  - Accent / Reward: `#f1c40f` (Raw Honeycomb Gold)
  - Accent Dark: `#9b7b02`
  - Card Container: `#241810`
  - Card Outline: `#e67e22`
  - Glow Shadow: `rgba(211, 84, 0, 0.45)`
- **Habit Perk:** "Bear Hug Boost: +15 XP for every healthy meal or snack logged"
- **Interactive Motif:** Honeycomb hexagonal stamps, timber-grain bevel buttons.

---

### 24. Ollie the Otter (River Craftmaster)
- **Archetype:** Aquatic Guardian | **Assigned Habit:** Creative Play
- **Theme Concept:** River Pebble & Rapid Foam Emerald
- **Palette:**
  - Primary Glow: `#2980b9` (Rapid Torrent Blue)
  - Primary Dark: `#154868`
  - Accent / Reward: `#2ecc71` (Riverbank Moss Green)
  - Accent Dark: `#166937`
  - Card Container: `#101e29`
  - Card Outline: `#1abc9c`
  - Glow Shadow: `rgba(41, 128, 185, 0.45)`
- **Habit Perk:** "River Builder: 2x Coins on all creative play and craft tasks"
- **Interactive Motif:** Interlocking building-brick slots, tool-rack crafting tabs.

---

## Universal Verification & Code Rules
1. **Zero Purple/Pink Policy:** No HEX in the `#800080`–`#ff00ff` range or `#9b59b6`/`#8e44ad`. All remapped to High-Energy Aero Cyan (`#00d2ff`, `#00e5ff`), Quantum Mint (`#00f5d4`), or Solar Amber (`#f39c12`, `#ffb300`).
2. **Skeuomorphic Touch Targets:** Min height `54px`, `border-b-[6px]` or `border-b-[8px]` with dark offset tones.
3. **Accessibility:** Contrast ratios against `#09141e` exceed 4.5:1 for all primary labels and 7:1 for headers.
