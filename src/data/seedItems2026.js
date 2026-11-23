// New Reward Shop items added 2026-11 (3 per catalog tab). Normal catalog entries merged by id on every device,
// so they are easy to review or remove. Art comes from OpenMoji (emoji) and game-icons (iconId); there is no
// placeholder 3D model. Palette rule: no pink or purple. Snacks are healthy.

import { THREE_D_ASSETS } from './threeDAssetCatalog.js';

// Real 3D models for the Shop. The picture on the card is the model's rendered thumbnail; the detail view spins the model.
const realWeapon = (assetId, rarity, price, percent) => {
  const a = THREE_D_ASSETS.find((x) => x.id === assetId);
  return base(`weapons_${assetId.replace('weapon_', '')}`, {
    name: a.name, desc: a.description, category: 'Weapons', subCategory: 'weapon', equipSlot: 'weapon', rarity, price,
    statBonusType: 'damage_boost', statBonusPercent: percent, statBonusLabel: `+${percent}% Sugar Bug Damage`,
    emoji: a.emoji, modelUrl: a.modelUrl, image: a.thumbnail, credit: a.credit, voiceLine: a.defaultVoiceLine
  });
};
const realSnack = (assetId, price, joy) => {
  const a = THREE_D_ASSETS.find((x) => x.id === assetId);
  return base(`snacks_${assetId.replace('food_', '')}`, {
    name: a.name, desc: a.description, category: 'Snacks', subCategory: 'food', rarity: 'common', price,
    statBonusType: 'joy_boost', statBonusPercent: joy, statBonusLabel: `+${joy} Joy`, usageType: 'multi_use', servingsMax: 3, maxServings: 3,
    emoji: a.emoji, modelUrl: a.modelUrl, image: a.thumbnail, credit: a.credit, voiceLine: a.defaultVoiceLine
  });
};

const base = (id, o) => ({
  id: `seed26_${id}`,
  title: o.name,
  subcategory: o.subCategory,
  costCoins: o.price,
  renderGradient: o.gradient || 'from-cyan-900/60 via-slate-900 to-slate-950',
  isUnlocked: false,
  isSeeded: true,
  ...o
});

const gear = (id, o) => base(id, { equipSlot: o.subCategory, targetPetSocket: o.subCategory, ...o });

export const SEED_2026_ITEMS = [
  // Weapons
  base('weapons_brick_saber', { name: 'Brick Saber', desc: 'A glowing sword built from snap-together bricks. Build it, swing it, win!', category: 'Weapons', subCategory: 'weapon', equipSlot: 'weapon', rarity: 'common', price: 120, statBonusType: 'damage_boost', statBonusPercent: 20, statBonusLabel: '+20% Sugar Bug Damage', iconId: 'swords', voiceLine: 'Click, clack! Brick Saber ready for battle!' }),
  base('weapons_bubble_blaster', { name: 'Bubble Blaster', desc: 'Fires giant soapy bubbles that pop plaque monsters clean away.', category: 'Weapons', subCategory: 'weapon', equipSlot: 'weapon', rarity: 'rare', price: 260, statBonusType: 'damage_boost', statBonusPercent: 25, statBonusLabel: '+25% Bubble Blast Damage', emoji: '🌊', iconId: 'lightning', voiceLine: 'Pop pop pop! Bubbles away!' }),
  base('weapons_starlight_mallet', { name: 'Starlight Mallet', desc: 'A big friendly hammer that sends sparkles flying with every smash.', category: 'Weapons', subCategory: 'weapon', equipSlot: 'weapon', rarity: 'epic', price: 400, statBonusType: 'damage_boost', statBonusPercent: 35, statBonusLabel: '+35% Smash Damage', iconId: 'hammer', voiceLine: 'Bonk! Starlight Mallet to the rescue!' }),
  // Avatar Gear
  gear('gear_explorer_cap', { name: 'Explorer Cap', desc: 'A sturdy cap for hikes, maps and big discoveries.', category: 'Avatar Gear', subCategory: 'head', rarity: 'common', price: 130, statBonusType: 'xp_boost', statBonusPercent: 10, statBonusLabel: '+10% Quest XP', iconId: 'helm', voiceLine: 'Adventure time, explorer!' }),
  gear('gear_rocket_backpack', { name: 'Rocket Backpack', desc: 'A little jet pack that makes every quest feel faster.', category: 'Avatar Gear', subCategory: 'back', rarity: 'rare', price: 240, statBonusType: 'speed_boost', statBonusPercent: 15, statBonusLabel: '+15% Quest Speed', emoji: '🚀', voiceLine: '3, 2, 1, blast off!' }),
  gear('gear_star_boots', { name: 'Star Boots', desc: 'Light-up boots that leave a trail of stars.', category: 'Avatar Gear', subCategory: 'feet', rarity: 'common', price: 160, statBonusType: 'speed_boost', statBonusPercent: 10, statBonusLabel: '+10% Quest Speed', emoji: '🌟', voiceLine: 'Sparkle steps!' }),
  // Pet Gear
  gear('petgear_leaf_crown', { name: 'Leaf Crown', desc: 'A woodland crown woven from tiny green leaves.', category: 'Pet Gear', subCategory: 'head', rarity: 'common', price: 190, statBonusType: 'joy_boost', statBonusPercent: 15, statBonusLabel: '+15% Companion Joy', iconId: 'crown', voiceLine: 'Fit for a forest king!' }),
  gear('petgear_brick_jetpack', { name: 'Brick Jetpack', desc: 'Built from bricks, flies on pure imagination.', category: 'Pet Gear', subCategory: 'back', rarity: 'rare', price: 280, statBonusType: 'energy_boost', statBonusPercent: 20, statBonusLabel: '+20% Energy', iconId: 'rocket', voiceLine: 'Whoosh! Look at me fly!' }),
  gear('petgear_ocean_scarf', { name: 'Ocean Scarf', desc: 'A cool blue scarf that ripples like a wave.', category: 'Pet Gear', subCategory: 'chest', rarity: 'common', price: 200, statBonusType: 'hygiene_boost', statBonusPercent: 15, statBonusLabel: '+15% Cleanliness', emoji: '🌊', voiceLine: 'Splashy and snug!' }),
  // Accessories
  gear('acc_sun_visor', { name: 'Sun Visor', desc: 'Keeps the bright sunshine out of your hero eyes.', category: 'Accessories', subCategory: 'accessory', rarity: 'common', price: 90, statBonusType: 'xp_boost', statBonusPercent: 5, statBonusLabel: '+5% Quest XP', iconId: 'helm', voiceLine: 'Sunny day, hero day!' }),
  gear('acc_compass_clip', { name: 'Compass Badge-Clip', desc: 'Always points toward the next big adventure.', category: 'Accessories', subCategory: 'accessory', rarity: 'rare', price: 180, statBonusType: 'coin_boost', statBonusPercent: 8, statBonusLabel: '+8% Habit Tokens', emoji: '🎯', voiceLine: 'North, south, east, quest!' }),
  gear('acc_hero_watch', { name: 'Hero Watch', desc: 'A wrist watch that counts down to your next win.', category: 'Accessories', subCategory: 'accessory', rarity: 'epic', price: 320, statBonusType: 'speed_boost', statBonusPercent: 12, statBonusLabel: '+12% Quest Speed', iconId: 'lightning', voiceLine: 'Tick tock, hero clock!' }),
  // Badges
  base('badges_brick_builder', { name: 'Brick Builder Badge', desc: 'For building something amazing, one brick at a time.', category: 'Badges', subCategory: 'badge', rarity: 'common', price: 100, statBonusType: 'xp_boost', statBonusPercent: 5, statBonusLabel: '+5% Quest XP', iconId: 'shield', voiceLine: 'Builder badge unlocked!' }),
  base('badges_model_maker', { name: 'Model Maker Badge', desc: 'For making and creating with your own two hands.', category: 'Badges', subCategory: 'badge', rarity: 'rare', price: 150, statBonusType: 'xp_boost', statBonusPercent: 8, statBonusLabel: '+8% Quest XP', emoji: '🏆', voiceLine: 'Great making, maker!' }),
  base('badges_snack_scientist', { name: 'Snack Scientist Badge', desc: 'For trying new healthy foods like a real food scientist.', category: 'Badges', subCategory: 'badge', rarity: 'common', price: 110, statBonusType: 'joy_boost', statBonusPercent: 8, statBonusLabel: '+8% Companion Joy', emoji: '🥦', voiceLine: 'Science says: yum!' }),
  // Trophies
  base('trophies_toy_car_cup', { name: 'Toy Car Cup', desc: 'A shiny cup for the fastest tidy-up racer in the house.', category: 'Trophies', subCategory: 'trophy', rarity: 'common', price: 130, statBonusType: 'coin_boost', statBonusPercent: 5, statBonusLabel: '+5% Habit Tokens', iconId: 'trophy', voiceLine: 'Vroom vroom, champion!' }),
  base('trophies_golden_brick_tower', { name: 'Golden Brick Tower', desc: 'A tall gold tower for a streak that kept growing.', category: 'Trophies', subCategory: 'trophy', rarity: 'epic', price: 340, statBonusType: 'coin_boost', statBonusPercent: 10, statBonusLabel: '+10% Habit Tokens', iconId: 'castle', voiceLine: 'Up, up, up, and gold!' }),
  base('trophies_pet_parade', { name: 'Pet Parade Trophy', desc: 'For taking great care of your companion every day.', category: 'Trophies', subCategory: 'trophy', rarity: 'rare', price: 220, statBonusType: 'joy_boost', statBonusPercent: 10, statBonusLabel: '+10% Companion Joy', emoji: '🐶', iconId: 'trophy', voiceLine: 'Best pet parent ever!' }),
  // Stickers
  base('stickers_happy_dino', { name: 'Happy Dino Sticker', desc: 'A smiling dino for your sticker album.', category: 'Stickers', subCategory: 'sticker', rarity: 'common', price: 35, statBonusType: 'joy_boost', statBonusPercent: 5, statBonusLabel: '+5% Joy', emoji: '🦖', voiceLine: 'Rawr! Sticker time!' }),
  base('stickers_brave_dragon', { name: 'Brave Dragon Sticker', desc: 'A brave little dragon who never gives up.', category: 'Stickers', subCategory: 'sticker', rarity: 'common', price: 40, statBonusType: 'joy_boost', statBonusPercent: 5, statBonusLabel: '+5% Joy', emoji: '🐉', voiceLine: 'Fire and friendship!' }),
  base('stickers_cuddle_turtle', { name: 'Cuddle Turtle Sticker', desc: 'A slow and steady turtle for calm bedtimes.', category: 'Stickers', subCategory: 'sticker', rarity: 'common', price: 45, statBonusType: 'joy_boost', statBonusPercent: 5, statBonusLabel: '+5% Bedtime Calm', emoji: '🐢', voiceLine: 'Slow and steady wins!' }),
  // Loot
  base('loot_mystery_brick_box', { name: 'Mystery Brick Box', desc: 'What is inside? Only a brave hero will find out!', category: 'Loot', subCategory: 'loot', rarity: 'common', price: 190, statBonusType: 'coin_boost', statBonusPercent: 5, statBonusLabel: 'Surprise bonus', iconId: 'gems', emoji: '🎁', voiceLine: 'Open it up!' }),
  base('loot_treasure_food_crate', { name: 'Treasure Food Crate', desc: 'A crate packed with yummy surprises for your pet.', category: 'Loot', subCategory: 'loot', rarity: 'rare', price: 280, statBonusType: 'joy_boost', statBonusPercent: 10, statBonusLabel: 'Pet treat surprise', emoji: '🍎', voiceLine: 'Snack treasure found!' }),
  base('loot_starlight_toy_chest', { name: 'Starlight Toy Chest', desc: 'A glowing chest full of starry toy treasures.', category: 'Loot', subCategory: 'loot', rarity: 'epic', price: 420, statBonusType: 'coin_boost', statBonusPercent: 10, statBonusLabel: 'Big surprise bonus', emoji: '🌟', iconId: 'gems', voiceLine: 'A whole chest of stars!' }),
  // Snacks
  base('snacks_rainbow_carrots', { name: 'Rainbow Carrot Sticks', desc: 'Crunchy orange carrot sticks. Great for hungry companions.', category: 'Snacks', subCategory: 'food', rarity: 'common', price: 25, statBonusType: 'energy_boost', statBonusPercent: 25, statBonusLabel: '+25 Energy / Hunger', usageType: 'multi_use', servingsMax: 3, maxServings: 3, emoji: '🥕', voiceLine: 'Crunch crunch!' }),
  base('snacks_blueberry_stack', { name: 'Blueberry Stack', desc: 'A juicy stack of plump blueberries for a happy tummy.', category: 'Snacks', subCategory: 'food', rarity: 'common', price: 30, statBonusType: 'joy_boost', statBonusPercent: 30, statBonusLabel: '+30 Joy', usageType: 'multi_use', servingsMax: 3, maxServings: 3, emoji: '🍇', voiceLine: 'Berry good!' }),
  base('snacks_melon_moon', { name: 'Melon Moon Slice', desc: 'A cool, juicy melon slice shaped like the moon.', category: 'Snacks', subCategory: 'food', rarity: 'common', price: 35, statBonusType: 'energy_boost', statBonusPercent: 30, statBonusLabel: '+30 Energy / Hunger', usageType: 'multi_use', servingsMax: 3, maxServings: 3, emoji: '🍉', voiceLine: 'Cool and sweet!' }),
  // Real 3D models (CC0, Kenney): spin them in the Shop detail view.
  realWeapon('weapon_foam_blaster_h', 'common', 110, 15),
  realWeapon('weapon_foam_blaster_a', 'common', 140, 20),
  realWeapon('weapon_foam_blaster_d', 'rare', 220, 25),
  realWeapon('weapon_foam_blaster_o', 'epic', 320, 30),
  realSnack('food_banana', 25, 30),
  realSnack('food_broccoli', 30, 35),
  realSnack('food_grapes', 30, 30),
  realSnack('food_corn', 30, 30)
];
