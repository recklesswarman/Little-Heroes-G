# Pet Companion Architecture & Design System Guidelines

This rule provides universal architectural guardrails, palette constraints, and component invariants for the Little Heroes 24-Pet Companion Universe, Hero HQ, Gear Studio, Pet Workouts, and Arcade mini-games.

---

## 1. Strict Color Palette Policy (Zero Purple / Pink)
- **Strictly prohibit** HEX colors in the purple/pink spectrum (`#800080`–`#ff00ff`, `#9b59b6`, `#8e44ad`).
- Permitted high-contrast, adventure-focused palette tokens:
  - **Aero Cyan / Electric Sky**: `#00d2ff`, `#00e5ff`, `#00b4d8`
  - **Bioluminescent Emerald / Jungle Mint**: `#2ecc71`, `#00f5d4`, `#10b981`
  - **Solar Amber / Thunder Gold**: `#f1c40f`, `#f39c12`, `#ffb300`, `#ffb961`
  - **Oceanic Sapphire / Abyssal Cobalt**: `#2980b9`, `#1f618d`, `#3498db`
  - **Midnight Charcoal Navy**: `#09141e`, `#121d26`, `#16212b`, `#202b35`

---

## 2. 24 Pets Universe & Archetypes
All pets belong to one of 5 distinct archetypes:
1. **Prehistoric Dinos (8)**: Rex, Raptor, Stego, Pterry, Chomper, Brachio, Dippy, Spino.
2. **Dragons & Mystics (5)**: Sparky, Aero, Blaze, Hydra, Luna.
3. **Wild Beasts (6)**: Kira, Boulder, Leo, Stripe, Fang, Barnaby.
4. **Aquatic Guardians (3)**: Gnasher, Ollie, Hydra (dual).
5. **Tech Mechs & Aviators (2)**: Cosmo, Scout, Shadow.

Every pet must have:
- An assigned daily habit category (e.g. Active Play, Morning Routine, Brush Teeth, Clean Room, Homework, Healthy Eating, Water, Bedtime).
- A specific habit perk bonus.
- An authentic 3D chunky tactile toy figurine graphic.

---

## 3. Level 1–25 Pet Progression (Zero Evolutions)
- **Evolution stages, evolution sparks, and evolution screens are permanently removed.**
- Pets progress through **Levels 1 to 25** by earning Pet Training XP.
- XP sources:
  1. Linked daily habits and chores matching the pet's archetype.
  2. Daily rotating Pet Workouts.
  3. Living Sanctuary interactions (feeding, bath, play).
  4. Arcade mini-games.
- Stat perks scale incrementally (+1% to +2% per level up to +25%/+50% at Max Level 25).
- Mastery Milestone Titles:
  - Level 1–4: **Rookie Companion**
  - Level 5–9: **Apprentice Scout**
  - Level 10–14: **Champion Guardian**
  - Level 15–19: **Master Hero**
  - Level 20–24: **Mythic Vanguard**
  - Level 25: **Apex Titan**

---

## 4. 4-Category Gear & Spotlight Slots
- Every pet has 4 equipment categories:
  1. **Masks** (Head)
  2. **Capes** (Back)
  3. **Armor** (Chest)
  4. **Boots** (Feet)
- Unlocked gear is stored in a shared Hero Wardrobe; each pet maintains its individual equipped loadout.
- Slot UI must render as **squircles** (`rounded-2xl`) with trophy-style halo spotlight glow effects colored by gear level:
  - Level 1 / Common: Slate / Ice Cyan (`shadow-[0_0_15px_rgba(0,210,255,0.45)]`)
  - Level 2 / Uncommon: Emerald Green (`shadow-[0_0_15px_rgba(46,204,113,0.5)]`)
  - Level 3 / Rare: Aero Cobalt (`shadow-[0_0_15px_rgba(52,152,219,0.6)]`)
  - Level 4 / Epic: Solar Amber (`shadow-[0_0_15px_rgba(241,196,15,0.7)]`)
  - Level 5 / Legendary: Prismatic Aurora Gold (`shadow-[0_0_20px_rgba(245,190,11,0.85)]`)

---

## 5. Hero HQ Spatial Layout Integrity
- The roaming companion in Hero HQ must be vertically centered on the room rug/pedestal (`bottom-32` or higher).
- The pet stage must **never** overlap or crowd the bottom row of interactive furniture buttons (`hq-slot-bed`, `hq-slot-petLounge`, `hq-slot-desk`, `hq-slot-decor`).
- The elevated companion stage is flanked by the 4 squircle gear spotlight slots with direct touch-to-equip interactions.

---

## 6. Deprecation of Skeletal Rigs
- Skeletal rigging code (`petSkeletalBodyService`, `petSkeletalFaceService`, `PetSkeletalFaceViewer`) is deprecated in favor of 3D chunky tactile toy figurine artwork, canvas renderers, and skeuomorphic cards.
