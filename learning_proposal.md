# Learning Proposal: 24 Pets Universe & Tactile Toy Architecture Guidelines (/learn)

## 1. Context & Motivation
Following the comprehensive overhaul of the Little Heroes companion system from legacy evolutions and skeletal animation rigs to the **Adventurous Explorer 24-Pet Chunky Tactile Toy System**, this rule captures and enforces the foundational domain invariants across all future code additions.

---

## 2. Classification: Workspace Rule
**Target Path:** `.agents/rules/pet_companion_architecture_guidelines.md`  
**Rationale:** Universal architectural guardrails, palette constraints, and component invariants that apply to any file touching pets, hero HQ, gear studio, workouts, and arcade mini-games.

---

## 3. Proposed Rule Invariants

### A. Strict Color Palette Policy (Zero Purple/Pink)
- In accordance with `24_pets_design_systems_architecture.md`, strictly omit HEX values in the purple/pink range (`#800080`–`#ff00ff`, `#9b59b6`, `#8e44ad`).
- Replace with:
  - High-Energy Aero Cyan (`#00d2ff`, `#00e5ff`)
  - Quantum Mint / Bioluminescent Emerald (`#00f5d4`, `#2ecc71`)
  - Solar Amber / Thunder Gold (`#f39c12`, `#ffb300`, `#f1c40f`)
  - Deep Oceanic Cobalt (`#2980b9`, `#1f618d`)

### B. Pet Progression: Level 1–25 (No Evolutions)
- Pet evolution stages, evolution sparks, and evolution views are permanently removed.
- All 24 pets progress from **Level 1 to 25** via Pet Training XP.
- XP is gained through:
  1. Linked daily habits and chores matching the pet's assigned habit archetype.
  2. Daily rotating Pet Workouts.
  3. Living Sanctuary interactions (feeding, bath, play).
  4. Arcade mini-games.
- Stat perks scale incrementally (+1% to +2% per level up to +25%/+50% at Max Level 25).
- Mastery Milestones at Levels 5 (Apprentice), 10 (Champion), 15 (Master), 20 (Mythic), and 25 (Apex Titan).

### C. 4-Category Gear & Spotlight Slots
- Every pet features 4 distinct equipment categories:
  1. **Masks** (Head)
  2. **Capes** (Back)
  3. **Armor** (Chest)
  4. **Boots** (Feet)
- Unlocked gear lives in a shared Hero Wardrobe; each pet maintains its individual equipped slot configuration.
- Slot UI must use **squircle** icons (`rounded-2xl`) with trophy-style halo spotlight glow effects colored by gear level / rarity:
  - Level 1 / Common: Slate / Ice Cyan (`rgba(0, 210, 255, 0.45)`)
  - Level 2 / Uncommon: Emerald Green (`rgba(46, 204, 113, 0.5)`)
  - Level 3 / Rare: Aero Cobalt (`rgba(52, 152, 219, 0.6)`)
  - Level 4 / Epic: Solar Amber (`rgba(241, 196, 15, 0.7)`)
  - Level 5 / Legendary: Prismatic Aurora Gold (`rgba(245, 190, 11, 0.85)`)

### D. Tactile Skeuomorphism & Deprecated Skeletons
- 2D/3D skeletal rigging services (`petSkeletalBodyService`, `petSkeletalFaceService`) are replaced by chunky tactile 3D designer toy figurine artwork, canvas renderers, and interactive skeuomorphic cards.
- Interactive touch targets must maintain minimum `54px` tap areas with 3D bottom bevels (`border-b-[6px]` or `border-b-[8px]`).

### E. Hero HQ Spatial Layout Integrity
- The companion pet in Hero HQ must be positioned at the room's vertical center (`bottom-32` or higher) on the central rug/pedestal.
- Pets must never overlap or crowd the bottom row of interactive furniture buttons (`hq-slot-bed`, `hq-slot-petLounge`, `hq-slot-desk`, `hq-slot-decor`).
- Flank the elevated pet stage with the 4 gear spotlight squircle slots.
