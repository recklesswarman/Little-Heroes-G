import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';
import { PETS_DATABASE } from '../data/petsData.js';
import { ADVENTURE_GAMES } from '../data/learningGamesData.js';
import { MOVEMENT_ROUTINES, getMovementRoutine } from '../data/movementRoutinesData.js';
import { PROFILE_THEMES } from '../data/profileThemesData.js';
import { generate3DIcon } from '../utils/graphicsGenerator.js';
import { triggerInteractiveCelebration, closeInteractiveCelebration } from '../components/InteractiveCelebrationOverlay.js';
import { ROUTINES, HABIT_ISLANDS } from '../constants/routines.js';
import { HYGIENE_BOSSES, DENTAL_BADGES, getHygieneBoss } from '../data/hygieneBossesData.js';
import {
  EXPEDITION_BIOMES,
  EXPEDITION_DURATIONS,
  EXPEDITION_ARTIFACTS,
  getExpeditionBiome,
  getExpeditionDuration,
  calculateExpeditionAffinity,
  generateExpeditionRewards
} from '../data/petExpeditionsData.js';
import {
  ROOM_THEMES,
  FURNITURE_SLOTS,
  FURNITURE_ITEMS,
  getHQTheme,
  getFurnitureItem,
  getTrophiesForDisplay
} from '../data/heroHQData.js';
import { PET_GEAR_CATALOG, calculateActiveGearBuffs, formatStatBonusName } from '../data/petGearStudioData.js';
import { speakCompanion } from '../services/voiceService.js';

export const KID_AVATARS = [
  { id: 'avatar_dragon', label: 'Dragon Explorer', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZfP7_Cwlp4sz41asI8ymuapAKvjmqHtvI4zcMAF_XwUmibj8IheGrS5cA5QD5gmXgVxEkZM9FlWJPRZnct3x6-9SQB7zJKqkEDjJ3m95tAy3zRqS-PbmcQ4kv_9pmIfm2Py4mh3Fw083hkDookz1w4_r50SBA1jc9igDaAPFLYBFgSP2aQBz7Q4jVE-DwhMOyUEHlxDkQk6Gwc2EAFCSKs1c0QuhUOi3tkrk5MXRARKqZcYVzyJe6gA' },
  { id: 'avatar_cyber', label: 'Cyber Scout', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuARR2klW8usL-qhZiz0_G-YpTDfniXDjgHoCQ_TULj1qzslQkdWxX4Wq2evyu74EP6D3_HZhuWK7Ur01vaB-ih5z8SIKSqawthIwUeiiFFVbRjUfS_ESM6_-NzIkcPl9lgdpDNEqBDaoiMnhRiHE2oY84NKDgpdDwGB-ns1Pl0rX6OlqQa93LVIUhJuD5us2LFiF8zPaPCw3LYoZuCs5m2Eie-8vAsBx3XfthE2qlYBO4kcHUFrN_gtiA' },
  { id: 'avatar_superpup', label: 'Super Pup', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBt3DBwfpcbbvoWYvwpXt_crRM01oD2FlSmnTjRotHTDi6sCpEpo0HGRngqdUbBC_cgHu1T3JOXkMdw4-qLzPcPEslBONYLu1qXkoOJ6btgq7pAJfCm1FvcueHfEMAmidhqBIchTbwNZKOjkPMEDo6oKzVt1PgftBS6r7sVVYel_-bHhlmi-n4oZI1RzBckf3DMsFIgVmoLzSNj29eK9AS8dChk10e_WQuIwzYNt21e4MKdKn02dg4RWg' },
  { id: 'avatar_space', label: 'Knight Adventurer', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAUTWERGwaJXM82ZeJ0adcNsuOm_cR4z5CXAleJ2oKcekqKsuaZZD315RkB188DDt6fevx8guS2V20knvs93SzLKjox7deSVry-v8kiyTM-H0Kg5vmB8inoBoKz2SqYnVzUKVk9uulAHGfsUmnIs4VI7GkWcmmfE2gvPnoehqZqjhxHZuHz9Tqs_Omja5bwoX9aPmW8Xf63V9KIQsux3ucTJHZBdI2U8eRyOy7bO0XQMqe2BNGXc3SoWg' }
];

export const STORAGE_KEY = 'little_heroes_adventure_master_v8';

const defaultState = {
  activeView: 'dashboard', // dashboard, quest_map, pet_pen, pet_roster, pet_detail, pet_bath, shop, ar_battle, evolution, dance_party, profile, parent_portal, adventures_map, adventure_game
  previousView: 'dashboard',
  selectedPetDetailId: 1,
  selectedAdventureGameId: 'phonics_forest',
  parentCustomGear: [],

  // Household Link Architecture & Parent User Administration
  household: {
    syncCode: 'HERO-1555',
    name: "The Hero Family",
    linkedDevices: 1,
    lastSync: 'Just now',
    parents: [
      {
        uid: 'parent_default_admin',
        email: 'parent@hero.family',
        displayName: 'Family Admin',
        role: 'owner',
        addedAt: new Date().toISOString()
      }
    ],
    parentUids: ['parent_default_admin'],
    parentEmails: ['parent@hero.family']
  },

  // Active Hero Profile (Starts with 0 pets, prompts starter choice at Stage 1)
  selectedHero: {
    id: 'hero_1',
    name: 'Little Hero',
    title: 'Brave Adventurer',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZfP7_Cwlp4sz41asI8ymuapAKvjmqHtvI4zcMAF_XwUmibj8IheGrS5cA5QD5gmXgVxEkZM9FlWJPRZnct3x6-9SQB7zJKqkEDjJ3m95tAy3zRqS-PbmcQ4kv_9pmIfm2Py4mh3Fw083hkDookz1w4_r50SBA1jc9igDaAPFLYBFgSP2aQBz7Q4jVE-DwhMOyUEHlxDkQk6Gwc2EAFCSKs1c0QuhUOi3tkrk5MXRARKqZcYVzyJe6gA',
    color: '#2ecc71',
    level: 1,
    xp: 0,
    xpNext: 100,
    points: 0, // ⭐ Points (Parent-approved, spent on Real-Life Rewards)
    coins: 0,  // 🪙 Tokens (Auto-issued, spent on digital items)
    streak: 1,
    stars: 0,
    activePetId: null,
    unlockedPetIds: [],
    hasChosenStarterPet: false,
    habitatSlots: 1,
    petStageMap: {},
    gameDifficulty: 'medium', // 'easy' (Toddler 3-4), 'medium' (Kids 5-6), 'hard' (Kids 7-9)
    equippedProfileTheme: 'theme_dragon_emerald',
    unlockedThemes: ['theme_dragon_emerald'],
    equippedPetGearMap: {
      1: { head: 'crown_golden_horn', back: 'cape_classic', chest: 'collar_titan', feet: 'boots_speed_neon' }
    },
    customGearDyesMap: {
      1: { head: '#f59e0b', back: '#ef4444', chest: '#475569', feet: '#10b981' }
    },
    savedHeroCards: [],
    screenTimeMinutes: 45,
    screenTimeUsedToday: 15,
    dailyMaxScreenTime: 60,
    bedtimeCurfew: '20:00',
    screenTimeRate: 2, // 2 minutes per point
    isScreenTimePaused: false,
    screenTimeLockMessage: 'Rex says: Great job today! Time to play outside or get cozy for bedtime! 🦖🌙'
  },

  heroes: [
    {
      id: 'hero_1',
      name: 'Little Hero',
      role: 'Brave Adventurer',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZfP7_Cwlp4sz41asI8ymuapAKvjmqHtvI4zcMAF_XwUmibj8IheGrS5cA5QD5gmXgVxEkZM9FlWJPRZnct3x6-9SQB7zJKqkEDjJ3m95tAy3zRqS-PbmcQ4kv_9pmIfm2Py4mh3Fw083hkDookz1w4_r50SBA1jc9igDaAPFLYBFgSP2aQBz7Q4jVE-DwhMOyUEHlxDkQk6Gwc2EAFCSKs1c0QuhUOi3tkrk5MXRARKqZcYVzyJe6gA',
      level: 1,
      points: 0,
      coins: 0,
      activePetId: null,
      unlockedPetIds: [],
      hasChosenStarterPet: false,
      habitatSlots: 1,
      petStageMap: {},
      streak: 1,
      completionRate: 100,
      gameDifficulty: 'medium',
      equippedProfileTheme: 'theme_dragon_emerald',
      unlockedThemes: ['theme_dragon_emerald'],
      equippedPetGearMap: {
        1: { head: 'hero_cowl', back: 'fluttering_cape', chest: 'titan_collar', feet: 'neon_speed_boots' }
      },
      customGearDyesMap: {
        1: { head: '#E74C3C', back: '#3498DB', chest: '#F1C40F', feet: '#2ECC71' }
      },
      savedHeroCards: [],
      screenTimeMinutes: 45,
      screenTimeUsedToday: 15,
      dailyMaxScreenTime: 60,
      bedtimeCurfew: '20:00',
      screenTimeRate: 2,
      isScreenTimePaused: false,
      screenTimeLockMessage: 'Rex says: Great job today! Time to play outside or get cozy for bedtime! 🦖🌙'
    }
  ],

  // Kids Profile Themes Catalog
  profileThemes: PROFILE_THEMES,

  // Habit Islands (Preset Daily Positive Behaviors)
  habitIslands: HABIT_ISLANDS,

  // Task Forest (Scheduled Chores & Routines with Time Windows)
  taskForest: ROUTINES,

  // AI Spark Autonomous Micro-Quests (Dynamic Gemini 2.5 Flash Subagent Quests)
  aiQuests: [],

  // 24 Pets Universe & Active Pet State
  pets: PETS_DATABASE,
  petStageMap: {},
  petSelectionModal: { isOpen: false, type: 'starter' },
  petStatsMap: {
    1: { hunger: 75, hygiene: 90, energy: 65, joy: 85 }
  },

  // Recently Unlocked Badges & Trophies
  recentlyUnlocked: [
    {
      id: 'rocket_badge',
      title: 'Hero Rocket Badge',
      type: 'Sticker',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAyH49NXeiOh-BmWLvQkk4zJRjAXmtQ7hPXJ7Dk0YZRO5CkUFz9wJZbjEKmlVlh8U79KHrKqiP4gS0bQgQ2X_vEpRpK_FsuS8WN4RWDw3xj4YlvTofyTWXlgV4nmek6g1R4NxZAaqkv8M1xvOiqIKYrKpTiEJRmk0ulv958iE5iE7ORnAiln2Uw3oaopAOg7Bs6MDXSVDpMo9YKipIHHykc6vVQgFwKQvDtNbqgY1h8N4_Ealg8wrybfA'
    },
    {
      id: 'wizard_hat',
      title: 'Enchanted Wizard Hat',
      type: 'Accessory',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA6ACznHbNqQYrmS2NNT3AogIWVwSpwMd_e-p5JOEqTsWkMcbR3XIie3llrmdu0UVjQ4an-bSZQypLr0rQgc-ZbZMijOEnJW2hkFFTW3YvxnvMF1p_R1DeRzyPAEVOVQn7dVbGBZjMJoNDEEPm43G_Dtol7_U9W9m9iLpImUl0NJfcdAqccaoVs6sGpX3KgGErOnZi9ufcz3KQ-E1PpdUM5P2DeTeu8ePw2Jfrbh1fbQ5aY24ZDCZ3hVw'
    },
    {
      id: 'gem_trove',
      title: 'Crystal Gem Trove',
      type: 'Loot',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDvEPK2k2p8UTY6a_a13uuU4xIdkdywFfYuD-6hXL6loqAk-urCnUbUGdFn-Y19eBDoygO061F0aNul90Ba2JUyfsA-w-3zw4_7pYzFDr1VberTqHQfuSPj2fUJPxNonUg9kWXhB0tivkcacloQX7aSYVFI0gMGh4LxUnHMNOb8AvPWMIBgSUdWC0sxJmD4dJJcdQnnenoMiOhVddEOJO-X7gqho3jVSHQX-aholmgf88Rvee7hDkrcng'
    },
    {
      id: 'star_trophy',
      title: 'Awesome Job Star',
      type: 'Trophy',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCRc98XgkYDVOMyeI8_DdTn3brkamdypKZHAOHiWsvdNuYooda2iad8wDRiiTg9NR7rD8mcxuoBFBUSLVrLtnLcoaHCbw6GFUY2IfxfuNNEN9DPOp4_YImncAcHdrg87C8_VAKhcU1QWSn2sjlLyzlzjCEfIZxtp8wUJW0A31Lq1dR2UtL-5WrB4Kv37wm8UqStqA4r7vMt9-HC2m0J2DnH2ho2MRAB876n6T2djlx3G7-pBq9V44VbVg'
    }
  ],

  // Real-Life Rewards (Cost Points ⭐ - Require Parent Approval)
  realLifeRewards: [
    {
      id: 'screen_time_30',
      title: '30 Mins Screen Time',
      costPoints: 50,
      category: 'Experience',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDwiXWKTRUssFcvO0VMZY2in_ykLU01sI-ExsT7r1iZ5IYPdXgoGenpe_WcpSW7knWFGxwUuaGEP6QNYiVfkaxHhafEBCn2l4MbgvVGne9r6jXt72AXHiv7oLLDUs1yabcVjJxK2snZXlLwl8LlucgAhUnpE8UmVXc12s9i83BpaxYnZ7WPOy9ZbWOrR0xhzixCUzxXzcGa37zI_kzLf3vZXf4Nq7aQBpBN4IKSWKeI8idkBZb0sfccCA',
      desc: 'Trade points for 30 minutes of tablet or video game time.'
    },
    {
      id: 'movie_night_choice',
      title: 'Friday Movie Night Choice',
      costPoints: 100,
      category: 'Experience',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBUe50x9hrDqEWJxXpxkk28HCtzzxp6iu_ptP2y58CFG0TUggFK7d1Od69VrYxsjxKtR1o6lrgPgx15Okec05jU_vNxJ7s_ipwXZJM3ladFoPyuhGcPzItrUorX1NF1ilxi2r1K2g00ulLRfOqSTdr0ZuPk5gyY8B0mB2UBw0XjqX8qfM8-Z_Oa_VasXsvbo_FHt7MMlgZ_O9HNsr4L1wxT131GZyCKiOLQOBHTGSONdgB_qqkkRex0Kw',
      desc: 'You get to pick the family movie and have popcorn this Friday!'
    },
    {
      id: 'park_trip',
      title: 'Adventure Park Outing',
      costPoints: 120,
      category: 'Outing',
      image: generate3DIcon('park', 'green', 'Park Trip'),
      desc: 'Go play at the playground, swings, and bike paths with parents!'
    },
    {
      id: 'special_treat',
      title: 'Ice Cream / Smoothie Choice',
      costPoints: 60,
      category: 'Treat',
      image: generate3DIcon('icecream', 'yellow', 'Ice Cream'),
      desc: 'Pick your favorite ice cream scoop or fruit smoothie flavor.'
    },
    {
      id: 'late_bedtime',
      title: '30 Mins Weekend Late Bedtime',
      costPoints: 80,
      category: 'Privilege',
      image: generate3DIcon('hotel', 'orange', 'Late Night'),
      desc: 'Stay up an extra 30 minutes on Friday or Saturday night.'
    }
  ],

  // Digital Goods Catalog (Cost Habit Tokens 🪙 - Auto-Issued & Instant Unlock)
  digitalGear: [
    {
      id: 'sparkle_wand',
      title: 'Sparkle Magic Wand',
      desc: 'A powerful glowing weapon emitting sparkly blue particles.',
      category: 'Weapons',
      costCoins: 750,
      statBonusPercent: 25,
      statBonusType: 'xp_boost',
      isNew: true,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAXizgI1CeB2yKrFadDQwi_izrUzn5VC61h_Pt83vwDS7sOgRgZ3uicgT9wALkvX1ci0sh5YMVO38ne8-hC2TKHNwDELgpccHrkJ0pdzoxGd6NEOSvV0Fgn44DNrZqYpjJvtTkUY8PDAAGNwSTLlqV7gPcepURR9EiQzW4JSIsm6DC1xO8iXYAz5sSPHnXKpDJeXdMdJ3dLsOkdc3AEaYvcxiGwnPk_T_zTP2rB1AKr5xKxRl0kR873Sg'
    },
    {
      id: 'hero_cape',
      title: 'Bright Blue Hero Cape',
      desc: 'Equip your avatar and pet companion with heroic flight style.',
      category: 'Avatar Gear',
      costCoins: 250,
      statBonusPercent: 20,
      statBonusType: 'speed_boost',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuByKpaoALsAQKloJoaflKFN3uBQW2_wFzPx91VHRs4HwEN8nq_FFMDP4x9H1iraLFT6ts1An7aMl3x0Gr_2BEpiyfAeWPb1S-OqL_MxKDDkCzvrQcAiVG14D7Wmv4XB_VViBp4TdSvN3MTRO8KLCIWL3S3WaQUqq6-a3hWGomWph08_yJ3FzxocLQjdXxKNUrzhF_Dv-d2DEfkaWLXL4No80J3RlmfBcCreSBpPWJyHEX08C3mTUvmJNw'
    },
    {
      id: 'laser_toothbrush',
      title: 'Laser Toothbrush Sword',
      desc: 'Extra damage against Sugar Bugs in AR Toothbrush Battle Mode!',
      category: 'Weapons',
      costCoins: 150,
      statBonusPercent: 30,
      statBonusType: 'damage_boost',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD_t1oRwvE1jlA6mYuARa1kila-xbhIvpGqco4NsFrzIp3HYf-AOKXJ6h0qmz4yoUj5sGBJEGG3k47tjpVTOVVpi6PklYYznwt8FgR0WNaQsOt5pu_bL12NJJi8BhBJTz_wmenjPjkJa0Ti7OHXgZH60P9sMBw3yp1NpTX5hoSsiiyu5kNMKZFB84cQhb_qOld0uo2POD-jx_IBi8XnJx9r4ackB2pxI6pssYiWzVQgcV8_JdTOZh5KTA'
    },
    {
      id: 'wizard_hat',
      title: 'Enchanted Wizard Hat',
      desc: 'Adds +20 Wisdom XP to all pet learning mini-games.',
      category: 'Avatar Gear',
      costCoins: 120,
      statBonusPercent: 20,
      statBonusType: 'xp_boost',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA6ACznHbNqQYrmS2NNT3AogIWVwSpwMd_e-p5JOEqTsWkMcbR3XIie3llrmdu0UVjQ4an-bSZQypLr0rQgc-ZbZMijOEnJW2hkFFTW3YvxnvMF1p_R1DeRzyPAEVOVQn7dVbGBZjMJoNDEEPm43G_Dtol7_U9W9m9iLpImUl0NJfcdAqccaoVs6sGpX3KgGErOnZi9ufcz3KQ-E1PpdUM5P2DeTeu8ePw2Jfrbh1fbQ5aY24ZDCZ3hVw'
    },
    {
      id: 'rocket_badge',
      title: 'Hero Rocket Badge',
      desc: 'A glowing badge that speeds up daily quest completions.',
      category: 'Badges',
      costCoins: 80,
      statBonusPercent: 15,
      statBonusType: 'speed_boost',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAyH49NXeiOh-BmWLvQkk4zJRjAXmtQ7hPXJ7Dk0YZRO5CkUFz9wJZbjEKmlVlh8U79KHrKqiP4gS0bQgQ2X_vEpRpK_FsuS8WN4RWDw3xj4YlvTofyTWXlgV4nmek6g1R4NxZAaqkv8M1xvOiqIKYrKpTiEJRmk0ulv958iE5iE7ORnAiln2Uw3oaopAOg7Bs6MDXSVDpMo9YKipIHHykc6vVQgFwKQvDtNbqgY1h8N4_Ealg8wrybfA'
    },
    {
      id: 'gem_trove',
      title: 'Crystal Gem Trove',
      desc: 'Stores bonus coins and shines with crystal power in your pen.',
      category: 'Badges',
      costCoins: 150,
      statBonusPercent: 15,
      statBonusType: 'coin_boost',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDvEPK2k2p8UTY6a_a13uuU4xIdkdywFfYuD-6hXL6loqAk-urCnUbUGdFn-Y19eBDoygO061F0aNul90Ba2JUyfsA-w-3zw4_7pYzFDr1VberTqHQfuSPj2fUJPxNonUg9kWXhB0tivkcacloQX7aSYVFI0gMGh4LxUnHMNOb8AvPWMIBgSUdWC0sxJmD4dJJcdQnnenoMiOhVddEOJO-X7gqho3jVSHQX-aholmgf88Rvee7hDkrcng'
    },
    {
      id: 'mint_knight_badge',
      title: 'Mint Knight Badge',
      desc: 'Earned by defeating the Sugar Boss in the 2-minute Toothbrush AR Battle! Radiates minty fresh dental defense.',
      category: 'Badges',
      costCoins: 0,
      statBonusPercent: 35,
      statBonusType: 'defense_boost',
      icon: 'military_tech',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDvEPK2k2p8UTY6a_a13uuU4xIdkdywFfYuD-6hXL6loqAk-urCnUbUGdFn-Y19eBDoygO061F0aNul90Ba2JUyfsA-w-3zw4_7pYzFDr1VberTqHQfuSPj2fUJPxNonUg9kWXhB0tivkcacloQX7aSYVFI0gMGh4LxUnHMNOb8AvPWMIBgSUdWC0sxJmD4dJJcdQnnenoMiOhVddEOJO-X7gqho3jVSHQX-aholmgf88Rvee7hDkrcng'
    },
    {
      id: 'flame_kibble_bowl',
      title: 'Flame Kibble Snack Bowl',
      desc: 'Super tasty crunchy pet food that instantly restores +30 Hunger.',
      category: 'Snacks',
      costCoins: 30,
      statBonusPercent: 30,
      statBonusType: 'joy_boost',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB-3rOJgQurGLPwdAbopzrD38_Tt7Kx4XBDGzb8c4D6SyP_duGB00Hbl0jPDHHNgTri1r3B1Wg_bPaZcVSttkDJ_DdCvdMFpixvZL-t62idBUBkK-YIgAZkPm9aBKKV60saB8oSEyuSlPFh9OuQNa12-35vM3UJLyH9I_bnbsG-CLL_JWYco0EyWRF8eWdzRrr4Ize_vzuXlGXbaekGucbGHZI9m7USTT7cTWZ99v22UCg5FGizLHk1FQ'
    },
    {
      id: 'toy_chest_vault',
      title: 'Secret Toy Chest Vault',
      desc: 'Stows all your hero equipment and adds +10% to toy chore payouts.',
      category: 'Badges',
      costCoins: 180,
      statBonusPercent: 10,
      statBonusType: 'coin_boost',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDy3Rfu0bcLlMPyE2iHd9P78LdbLHJNOzTdaepeadGKy-vo9vxupk8kFi7ggsSZgSTNyekoC_nPypDwUIyXCrD2-_Z96IqQYN58d5uymrFi6JV8vd3_mbXavdbQXB825ndnaEFa-xL8t9yleVWU-a8f9Cv8ehZ1dNuYJt1w-L5x05lq4gKgpqmuecxkjqj0__taxaDmJ-tSIUV6wqkf6VcM2RD4FoyEzXq6FmcZaYoeIxFG5Aa2iQtu0g'
    },
    {
      id: 'golden_armor_vest',
      title: 'Golden Dragon Armor Vest',
      desc: '+50 Defense and sparkling gold scales for your pet companion.',
      category: 'Avatar Gear',
      costCoins: 180,
      statBonusPercent: 50,
      statBonusType: 'defense_boost',
      image: generate3DIcon('shield', 'green', 'Dragon Armor')
    },
    {
      id: 'bubble_soap_pack',
      title: 'Mega Blueberry Bubble Soap',
      desc: 'Extra sudsy blueberry scented bath bubbles for pet bath time.',
      category: 'Snacks',
      costCoins: 35,
      statBonusPercent: 25,
      statBonusType: 'hygiene_boost',
      image: generate3DIcon('soap', 'blue', 'Blueberry Soap')
    },
    {
      id: 'fire_berry_treat',
      title: 'Fire Berry Snack Pack',
      desc: 'Super tasty flame berries that instantly max Hunger to 100%!',
      category: 'Snacks',
      costCoins: 25,
      statBonusPercent: 25,
      statBonusType: 'energy_boost',
      image: generate3DIcon('nutrition', 'orange', 'Fire Berries')
    },
    {
      id: 'hero_glowing_cape',
      title: 'Emerald Glowing Cape',
      desc: 'A rugged hero cape that billows with emerald particles.',
      category: 'Avatar Gear',
      costCoins: 220,
      statBonusPercent: 30,
      statBonusType: 'defense_boost',
      image: generate3DIcon('flag', 'green', 'Emerald Cape')
    },
    {
      id: 'disco_star_badge',
      title: 'Disco Master Badge',
      desc: 'Unlocks golden spotlight mode in Dance Party.',
      category: 'Badges',
      costCoins: 100,
      statBonusPercent: 20,
      statBonusType: 'coin_boost',
      image: generate3DIcon('stars', 'yellow', 'Disco Star')
    },
    {
      id: 'rex_the_dino_companion',
      title: 'Rex the Dino',
      desc: 'Adopt Rex the Dino! Strong, loyal guardian who loves big adventures and cleaning toys!',
      category: 'Avatar Gear',
      costCoins: 200,
      statBonusPercent: 35,
      statBonusType: 'defense_boost',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDnxgEa6LgbgAkDctHBACUsubrRh0U8vMmbJxq4ACCWYwyxf7800JbNv-noivBha5t7iGBEgs-YsbsGmoo1xKaGtP49xpYLBxuV_-5Xeem4_4CfYg8RwvbaFbrHewRdEcY_Kqgh2Ep9mGvfKL3wxqEK9KBXuBiBTkrgdgQeIzjdJY4AMhn6WLNE-9UrpirWUPIn35lB_Z8hsegZ5dYgugCCqy5JsNgkzB8tu-dvmgFCDFLsddPsW8GwUA'
    },
    {
      id: 'rex_spiked_collar',
      title: 'Rex Heavy Spiked Collar',
      desc: 'Rex the Dino\'s favorite gear! Adds +20 Strength to Toy Cleaning chores.',
      category: 'Avatar Gear',
      costCoins: 120,
      statBonusPercent: 20,
      statBonusType: 'strength_boost',
      image: generate3DIcon('fitness_center', 'green', 'Rex Collar')
    }
  ],

  inventory: ['Enchanted Wizard Hat', 'Hero Rocket Badge', 'Crystal Gem Trove'],
  equippedPetGear: 'Enchanted Wizard Hat',
  equippedPetGearSlots: {
    1: { hat: 'Enchanted Wizard Hat', cape: null, aura: null }
  },
  equippedPetGearMap: {
    1: { head: 'crown_golden_horn', back: 'cape_classic', chest: 'collar_titan', feet: 'boots_speed_neon' }
  },
  customGearDyesMap: {
    1: { head: '#f59e0b', back: '#ef4444', chest: '#475569', feet: '#10b981' }
  },
  savedHeroCards: [],
  activeRunwayModal: {
    isOpen: false,
    petId: null,
    currentPose: 'idle'
  },
  petSparkMap: {
    1: 65
  },
  petStreakShield: {
    available: true,
    usedThisWeek: false,
    lastProtectedDate: null
  },
  petLockerModal: {
    isOpen: false,
    petId: null
  },
  gameMasteryMap: {},
  movementSessionHistory: [],
  dentalBadges: ['enamel_guardian'],
  dentalBattleHistory: [],
  lastBrushedMorning: null,
  lastBrushedEvening: null,
    // Hero HQ & Superhero Hideout Studio
  heroHQ: {
    themeId: 'dino_treehouse',
    isNightMode: false,
    equippedFurniture: {
      bed: 'dino_leaf_canopy',
      petLounge: 'giant_beanbag',
      desk: 'hologram_mission_table',
      decor: 'starlight_projector_lamp',
      rug: 'hero_road_rug'
    },
    unlockedFurnitureIds: [
      'dino_leaf_canopy',
      'giant_beanbag',
      'hologram_mission_table',
      'starlight_projector_lamp',
      'hero_road_rug'
    ],
    featuredTrophyIds: ['rookie_hero_crest'],
    redecorateDrawerOpen: false,
    redecorateActiveCategory: 'themes'
  },
  activeExpeditions: [],
  expeditionHistory: [],
  unlockedArtifacts: [],
  expeditionModal: { isOpen: false, selectedPetId: null, selectedBiomeId: 'fern_woods', selectedDuration: 15, snackPacked: false, activeTab: 'dispatch' },

  // Parent Admin Portal: Action Approvals Queue
  pendingApprovals: [],

  // Dedicated Timestamped Routine & Task Completion Audit Trail
  taskCompletionLogs: [],

  // Parent Admin Portal: Ledger Logs History
  taskLedgerLogs: [],

  // Parent Settings & Difficulty Sliders
  parentSettings: {
    pin: '1234',
    pinLockEnabled: true,
    biometricsEnabled: true,
    mathChallengeEnabled: true,
    arBattleDuration: 120,
    motionSensitivity: 'medium',
    voicePromptsEnabled: true,
    autoApproveHabits: false,
    dailyScreenTimeLimitMins: 45,
    biometricCredentialId: null
  },

  // Reward celebration modal
  rewardModal: null,

  // Mystery Surprise Unboxing (Glowing Egg / Treasure Chest)
  mysterySurprise: null,

  // Live Interactive Rex the Dino (Gemini Live & Interactions API)
  liveRex: {
    isOpen: false,
    isConnected: false,
    isListening: false,
    isSpeaking: false,
    status: 'idle',
    statusMessage: '',
    lastUserTranscript: '',
    lastRexTranscript: '',
    geminiApiKey: '',
    voiceName: 'Puck',
    autoListenInQuests: true
  },

  // Deleted kid profiles tracked to prevent resurrection across concurrent devices
  deletedHeroIds: [],

  // Active connected devices in household
  devices: {}
};

class Store {
  constructor() {
    this.subscribers = new Set();
    this.isParentSessionUnlocked = false;
    this.syncService = null;
    this.state = this.loadState();
  }

  setSyncService(service) {
    this.syncService = service;
  }

  loadState() {
    try {
      const saved = typeof localStorage !== 'undefined' 
        ? (localStorage.getItem(STORAGE_KEY) || localStorage.getItem('little_heroes_adventure_master_v7'))
        : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        const testIds = ['leo', 'mia', 'sam', 'alex'];
        const isPureMock = parsed.heroes && parsed.heroes.length === 4 && parsed.heroes.every((h) => testIds.includes(h.id));
        if (isPureMock) {
          parsed.heroes = defaultState.heroes;
          parsed.selectedHero = defaultState.selectedHero;
          parsed.pendingApprovals = [];
        }

        // Migration for Pet Progression Architecture
        if (parsed.heroes && parsed.heroes.length > 0) {
          parsed.heroes.forEach((h) => {
            if (!h.unlockedPetIds) {
              h.unlockedPetIds = h.activePetId ? [h.activePetId] : [];
            }
            if (h.hasChosenStarterPet === undefined) {
              h.hasChosenStarterPet = h.unlockedPetIds.length > 0;
            }
            if (!h.habitatSlots) {
              h.habitatSlots = Math.max(1, h.unlockedPetIds.length);
            }
            if (!h.petStageMap) {
              h.petStageMap = {};
              h.unlockedPetIds.forEach((pId) => {
                h.petStageMap[pId] = 1; // Stage 1!
              });
            }
            // Screen Time Bank Migration
            if (h.screenTimeMinutes === undefined) h.screenTimeMinutes = 45;
            if (h.screenTimeUsedToday === undefined) h.screenTimeUsedToday = 15;
            if (h.dailyMaxScreenTime === undefined) h.dailyMaxScreenTime = 60;
            if (h.bedtimeCurfew === undefined) h.bedtimeCurfew = '20:00';
            if (h.screenTimeRate === undefined) h.screenTimeRate = 2;
            if (h.isScreenTimePaused === undefined) h.isScreenTimePaused = false;
            if (!h.screenTimeLockMessage) h.screenTimeLockMessage = 'Rex says: Great job today! Time to play outside or get cozy for bedtime! 🦖🌙';
          });
        }

        if (parsed.selectedHero) {
          if (!parsed.selectedHero.unlockedPetIds) {
            parsed.selectedHero.unlockedPetIds = parsed.selectedHero.activePetId ? [parsed.selectedHero.activePetId] : [];
          }
          if (parsed.selectedHero.hasChosenStarterPet === undefined) {
            parsed.selectedHero.hasChosenStarterPet = parsed.selectedHero.unlockedPetIds.length > 0;
          }
          if (!parsed.selectedHero.habitatSlots) {
            parsed.selectedHero.habitatSlots = Math.max(1, parsed.selectedHero.unlockedPetIds.length);
          }
          if (!parsed.selectedHero.petStageMap) {
            parsed.selectedHero.petStageMap = {};
            parsed.selectedHero.unlockedPetIds.forEach((pId) => {
              parsed.selectedHero.petStageMap[pId] = 1;
            });
          }
          if (parsed.selectedHero.screenTimeMinutes === undefined) parsed.selectedHero.screenTimeMinutes = 45;
          if (parsed.selectedHero.screenTimeUsedToday === undefined) parsed.selectedHero.screenTimeUsedToday = 15;
          if (parsed.selectedHero.dailyMaxScreenTime === undefined) parsed.selectedHero.dailyMaxScreenTime = 60;
          if (parsed.selectedHero.bedtimeCurfew === undefined) parsed.selectedHero.bedtimeCurfew = '20:00';
          if (parsed.selectedHero.screenTimeRate === undefined) parsed.selectedHero.screenTimeRate = 2;
          if (parsed.selectedHero.isScreenTimePaused === undefined) parsed.selectedHero.isScreenTimePaused = false;
          if (!parsed.selectedHero.screenTimeLockMessage) parsed.selectedHero.screenTimeLockMessage = 'Rex says: Great job today! Time to play outside or get cozy for bedtime! 🦖🌙';
        }

        // Never restore to parent_portal while locked on reload
        if (parsed.activeView === 'parent_portal') {
          parsed.activeView = 'dashboard';
        }
        parsed.parentUnlocked = false;

        if (!parsed.taskCompletionLogs || !Array.isArray(parsed.taskCompletionLogs)) {
          parsed.taskCompletionLogs = [];
        }
        if (!parsed.movementSessionHistory || !Array.isArray(parsed.movementSessionHistory)) {
          parsed.movementSessionHistory = [];
        }
        if (!parsed.dentalBadges || !Array.isArray(parsed.dentalBadges)) {
          parsed.dentalBadges = ['enamel_guardian'];
        }
        if (!parsed.dentalBattleHistory || !Array.isArray(parsed.dentalBattleHistory)) {
          parsed.dentalBattleHistory = [];
        }
        if (!parsed.activeExpeditions || !Array.isArray(parsed.activeExpeditions)) {
          parsed.activeExpeditions = [];
        }
        if (!parsed.expeditionHistory || !Array.isArray(parsed.expeditionHistory)) {
          parsed.expeditionHistory = [];
        }
                if (!parsed.heroHQ || typeof parsed.heroHQ !== 'object') {
          parsed.heroHQ = JSON.parse(JSON.stringify(defaultState.heroHQ));
        } else {
          parsed.heroHQ = {
            ...defaultState.heroHQ,
            ...parsed.heroHQ,
            equippedFurniture: {
              ...defaultState.heroHQ.equippedFurniture,
              ...(parsed.heroHQ.equippedFurniture || {})
            },
            unlockedFurnitureIds: Array.isArray(parsed.heroHQ.unlockedFurnitureIds)
              ? Array.from(new Set([...defaultState.heroHQ.unlockedFurnitureIds, ...parsed.heroHQ.unlockedFurnitureIds]))
              : [...defaultState.heroHQ.unlockedFurnitureIds],
            featuredTrophyIds: Array.isArray(parsed.heroHQ.featuredTrophyIds)
              ? parsed.heroHQ.featuredTrophyIds
              : [...defaultState.heroHQ.featuredTrophyIds]
          };
        }
        if (!parsed.unlockedArtifacts || !Array.isArray(parsed.unlockedArtifacts)) {
          parsed.unlockedArtifacts = [];
        }
        if (!parsed.expeditionModal) {
          parsed.expeditionModal = { isOpen: false, selectedPetId: null, selectedBiomeId: 'fern_woods', selectedDuration: 15, snackPacked: false, activeTab: 'dispatch' };
        }
        if (!parsed.parentCustomGear || !Array.isArray(parsed.parentCustomGear)) {
          parsed.parentCustomGear = [];
        }
        // Hydrate parent custom gear into PET_GEAR_CATALOG and digitalGear
        parsed.parentCustomGear.forEach(item => {
          if (item && item.socket && PET_GEAR_CATALOG[item.socket]) {
            const inCatalog = PET_GEAR_CATALOG[item.socket].some(g => g.id === item.id);
            if (!inCatalog) {
              PET_GEAR_CATALOG[item.socket].unshift(item);
            }
          }
          if (item && parsed.digitalGear && Array.isArray(parsed.digitalGear)) {
            const inDigital = parsed.digitalGear.some(g => g.id === item.id);
            if (!inDigital) {
              parsed.digitalGear.unshift(item);
            }
          }
        });

        // Determine currently pending task IDs so we only preserve pending flags for active requests
        const pendingTaskIds = new Set(
          (parsed.pendingApprovals || [])
            .filter((r) => r.status === 'pending')
            .map((r) => r.taskId)
        );

        // Upgrade habit & chore icons to ensure Material Symbols render with zero broken images
        // and sanitize legacy permanent lockouts so routines are repeatable
        if (parsed.habitIslands) {
          parsed.habitIslands.forEach((h) => {
            const def = HABIT_ISLANDS.find((d) => d.id === h.id);
            if (def) {
              h.icon = def.icon;
            }
            delete h.image;
            if (!pendingTaskIds.has(h.id)) {
              h.completed = false;
              h.pointsApproved = false;
            }
          });
        } else {
          parsed.habitIslands = HABIT_ISLANDS;
        }

        if (parsed.taskForest) {
          parsed.taskForest.forEach((t) => {
            const def = ROUTINES.find((d) => d.id === t.id);
            if (def) {
              t.icon = def.icon;
            }
            delete t.image;
            if (!pendingTaskIds.has(t.id)) {
              t.completed = false;
              t.pointsApproved = false;
            }
          });
        } else {
          parsed.taskForest = ROUTINES;
        }

        if (!parsed.household) {
          parsed.household = { ...defaultState.household };
        }
        if (!parsed.household.parents || !Array.isArray(parsed.household.parents) || parsed.household.parents.length === 0) {
          parsed.household.parents = [...defaultState.household.parents];
          parsed.household.parentUids = [...defaultState.household.parentUids];
          parsed.household.parentEmails = [...defaultState.household.parentEmails];
        }

        if (!parsed.petSparkMap || typeof parsed.petSparkMap !== 'object') {
          parsed.petSparkMap = { ...defaultState.petSparkMap };
        }
        if (!parsed.petStreakShield) {
          parsed.petStreakShield = { ...defaultState.petStreakShield };
        }
        if (!parsed.equippedPetGearSlots || typeof parsed.equippedPetGearSlots !== 'object') {
          parsed.equippedPetGearSlots = { ...defaultState.equippedPetGearSlots };
        }
        if (!parsed.equippedPetGearMap || typeof parsed.equippedPetGearMap !== 'object') {
          parsed.equippedPetGearMap = { ...defaultState.equippedPetGearMap };
        }
        if (!parsed.customGearDyesMap || typeof parsed.customGearDyesMap !== 'object') {
          parsed.customGearDyesMap = { ...defaultState.customGearDyesMap };
        }
        if (!parsed.savedHeroCards || !Array.isArray(parsed.savedHeroCards)) {
          parsed.savedHeroCards = [];
        }
        if (!parsed.activeRunwayModal) {
          parsed.activeRunwayModal = { isOpen: false, petId: null, currentPose: 'idle' };
        }
        if (!parsed.petLockerModal) {
          parsed.petLockerModal = { isOpen: false, petId: null };
        }
        if (!parsed.gameMasteryMap || typeof parsed.gameMasteryMap !== 'object') {
          parsed.gameMasteryMap = {};
        }

        return { ...defaultState, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load store state', e);
    }
    return JSON.parse(JSON.stringify(defaultState));
  }

  setSyncService(service) {
    this.syncService = service;
  }

  /**
   * Keep selectedHero and heroes array 100% in sync at all times.
   * Ensures coins, points, level, xp, active pets, and game stats are never lost or stale.
   */
  syncSelectedHeroWithHeroes() {
    if (!this.state || !this.state.selectedHero || !this.state.heroes) return;
    const heroId = this.state.selectedHero.id;
    const idx = this.state.heroes.findIndex((h) => h.id === heroId);

    const sHero = this.state.selectedHero;
    const updatedHero = {
      ...(idx !== -1 ? this.state.heroes[idx] : {}),
      id: heroId,
      name: sHero.name || 'Little Hero',
      role: sHero.title || sHero.role || 'Adventurer',
      title: sHero.title || sHero.role || 'Adventurer',
      avatar: sHero.avatar,
      level: sHero.level ?? 1,
      xp: sHero.xp ?? 0,
      xpNext: sHero.xpNext || 100,
      coins: Math.max(0, Number(sHero.coins) || 0),
      points: Math.max(0, Number(sHero.points) || 0),
      tokens: Math.max(0, Number(sHero.tokens ?? sHero.coins) || 0),
      activePetId: sHero.activePetId || null,
      unlockedPetIds: [...(sHero.unlockedPetIds || [])],
      hasChosenStarterPet: sHero.hasChosenStarterPet ?? ((sHero.unlockedPetIds || []).length > 0),
      habitatSlots: sHero.habitatSlots || 1,
      petStageMap: { ...(sHero.petStageMap || {}) },
      streak: sHero.streak || 1,
      stars: sHero.stars || 0,
      completionRate: sHero.completionRate ?? 100,
      gameDifficulty: sHero.gameDifficulty || 'medium',
      equippedProfileTheme: sHero.equippedProfileTheme || 'theme_dragon_emerald',
      unlockedThemes: [...(sHero.unlockedThemes || ['theme_dragon_emerald'])],
      equippedGear: { ...(sHero.equippedGear || {}) },
      equippedPetGearMap: { ...(sHero.equippedPetGearMap || this.state.equippedPetGearMap || {}) },
      customGearDyesMap: { ...(sHero.customGearDyesMap || this.state.customGearDyesMap || {}) },
      savedHeroCards: [...(sHero.savedHeroCards || this.state.savedHeroCards || [])],
      inventory: [...(sHero.inventory || [])],
      lastUpdated: Date.now()
    };

    if (idx !== -1) {
      this.state.heroes[idx] = updatedHero;
    } else {
      this.state.heroes.push(updatedHero);
    }
  }

  saveState(immediate = false) {
    try {
      this.syncSelectedHeroWithHeroes();
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
      if (this.syncService) {
        this.syncService.pushStateToCloud(immediate);
      }
    } catch (e) {
      console.warn('Failed to save store state', e);
    }
    this.notify();
  }

  subscribe(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  notify() {
    for (const fn of this.subscribers) {
      try {
        fn(this.state);
      } catch (e) {
        console.error('Subscriber error', e);
      }
    }
  }

  getState() {
    return this.state;
  }

  navigate(viewName, params = {}) {
    if (viewName === 'parent_portal' && !this.isParentUnlocked()) {
      window.dispatchEvent(new CustomEvent('open-parent-modal'));
      return;
    }

    if (this.state.activeView !== viewName) {
      this.state.previousView = this.state.activeView;
      this.state.activeView = viewName;
      if (params.petId) this.state.selectedPetDetailId = params.petId;
      if (params.gameId) this.state.selectedAdventureGameId = params.gameId;
      Sound.click();
      this.saveState();
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // When kid selects the pet pen for the first time after profile creation:
      if (viewName === 'hero_hq') {
        this.checkHQMilestoneUnlocks();
      }
      if (viewName === 'pet_pen') {
        const hero = this.state.selectedHero;
        if (!hero?.hasChosenStarterPet || !hero?.unlockedPetIds || hero.unlockedPetIds.length === 0) {
          setTimeout(() => {
            this.openPetSelectionModal('starter');
          }, 350);
        }
      }
    } else if (viewName === 'pet_pen') {
      const hero = this.state.selectedHero;
      if (!hero?.hasChosenStarterPet || !hero?.unlockedPetIds || hero.unlockedPetIds.length === 0) {
        this.openPetSelectionModal('starter');
      }
    }
  }

  getActivePet() {
    const hero = this.state.selectedHero;
    const petId = hero?.activePetId || (hero?.unlockedPetIds?.[0] || 1);
    const petData = this.state.pets.find((p) => p.id === petId) || PETS_DATABASE.find((p) => p.id === petId) || this.state.pets[0] || PETS_DATABASE[0];
    const stage = this.state.petStageMap?.[petId] || hero?.petStageMap?.[petId] || 1;
    const stats = this.state.petStatsMap?.[petId] || { hunger: 75, hygiene: 90, energy: 65, joy: 85 };
    const currentAvatar = (stage >= 3 && petData?.evolvedAvatar) ? petData.evolvedAvatar : (petData?.avatar || PETS_DATABASE[0].avatar);
    return { ...petData, stage, ...stats, image: currentAvatar, avatar: currentAvatar };
  }

  setActivePet(petId) {
    this.state.selectedHero.activePetId = petId;
    const pet = this.state.pets.find(p => p.id === petId) || PETS_DATABASE.find(p => p.id === petId);
    const petImg = pet?.avatar || pet?.evolvedAvatar;
    
    Sound.fanfare();
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    this.showReward(
      'Companion Equipped!',
      `You are now adventuring with ${pet?.name || 'your pet'}!`,
      0,
      0,
      petImg,
      'pets'
    );
    this.saveState(true);
  }

  // 1. ADD NEW TASK / ROUTINE (Parent Portal)
  addNewTask(taskData) {
    const isHabit = taskData.zone === 'Habit Islands';
    const newId = 'task_' + Date.now();
    
    const iconName = taskData.icon || (isHabit ? 'favorite' : 'checklist');
    const colorTheme = isHabit ? 'green' : 'blue';
    const generatedGraphic = generate3DIcon(iconName, colorTheme, taskData.title.slice(0, 12));

    const newItem = {
      id: newId,
      title: taskData.title,
      zone: taskData.zone || 'Task Forest',
      icon: iconName,
      image: generatedGraphic,
      timeWindow: taskData.timeWindow || 'Daily',
      coins: parseInt(taskData.coins) || 20,
      points: parseInt(taskData.points) || 10,
      xp: parseInt(taskData.xp) || 30,
      completed: false,
      pointsApproved: false,
      desc: taskData.desc || 'Custom parent-assigned task routine.'
    };

    if (isHabit) {
      this.state.habitIslands.push(newItem);
    } else {
      this.state.taskForest.push(newItem);
    }

    this.logAction(`Parent created new chore: '${newItem.title}'`, `+${newItem.coins} Tokens 🪙, +${newItem.points} Points ⭐`);
    Sound.fanfare();
    confetti({ particleCount: 60, spread: 70 });
    this.showReward(
      'Task Added Successfully!',
      `"${newItem.title}" is now active in ${newItem.zone} for your kids!`,
      0,
      0,
      newItem.image,
      newItem.icon
    );
    this.saveState(true);
  }

  deleteTask(taskId, zone) {
    if (zone === 'Habit Islands') {
      this.state.habitIslands = this.state.habitIslands.filter(t => t.id !== taskId);
    } else {
      this.state.taskForest = this.state.taskForest.filter(t => t.id !== taskId);
    }
    this.state.pendingApprovals = this.state.pendingApprovals.filter(r => r.taskId !== taskId);
    Sound.click();
    this.saveState(true);
  }

  // 2. ADD NEW REAL-LIFE REWARD (Parent Portal)
  addNewRealLifeReward(rewardData) {
    const newId = 'reward_' + Date.now();
    const iconName = rewardData.icon || 'card_giftcard';
    const category = rewardData.category || 'Experience';
    const colorTheme = category === 'Treat' ? 'yellow' : category === 'Outing' ? 'green' : 'orange';
    const generatedGraphic = generate3DIcon(iconName, colorTheme, rewardData.title.slice(0, 14));

    const newReward = {
      id: newId,
      title: rewardData.title,
      costPoints: parseInt(rewardData.costPoints) || 50,
      category: category,
      image: generatedGraphic,
      icon: iconName,
      desc: rewardData.desc || 'Custom parent-created privilege.'
    };

    this.state.realLifeRewards.push(newReward);
    this.logAction(`Parent created real-life reward: '${newReward.title}'`, `Cost: ${newReward.costPoints} Points ⭐`);
    Sound.fanfare();
    confetti({ particleCount: 70, spread: 80 });
    this.showReward(
      'Reward Added to Shop!',
      `"${newReward.title}" is now available in the Hero Shop for ${newReward.costPoints} Points ⭐!`,
      0,
      0,
      newReward.image,
      newReward.icon
    );
    this.saveState(true);
  }

  deleteRealLifeReward(rewardId) {
    this.state.realLifeRewards = this.state.realLifeRewards.filter(r => r.id !== rewardId);
    this.state.pendingApprovals = this.state.pendingApprovals.filter(r => r.rewardId !== rewardId);
    Sound.click();
    this.saveState(true);
  }

  // 3. EDIT PRICING & INVENTORY FOR ALL ITEMS (Parent Portal)
  updateAllPricing(realLifeMap, digitalMap, themesMap = {}, statBonusMap = {}) {
    // Update real life reward points costs
    this.state.realLifeRewards.forEach(r => {
      if (realLifeMap[r.id] !== undefined) {
        r.costPoints = Math.max(1, parseInt(realLifeMap[r.id]) || r.costPoints);
      }
    });

    // Update digital gear token costs and stat bonus percentages
    this.state.digitalGear.forEach(g => {
      if (digitalMap[g.id] !== undefined) {
        g.costCoins = Math.max(1, parseInt(digitalMap[g.id]) || g.costCoins);
      }
      if (statBonusMap[g.id] !== undefined) {
        if (typeof statBonusMap[g.id] === 'object') {
          g.statBonusPercent = Math.max(0, parseInt(statBonusMap[g.id].percent) || 0);
          if (statBonusMap[g.id].type) {
            g.statBonusType = statBonusMap[g.id].type;
          }
        } else {
          g.statBonusPercent = Math.max(0, parseInt(statBonusMap[g.id]) || 0);
        }
      }
    });

    // Update profile themes token costs
    if (this.state.profileThemes) {
      this.state.profileThemes.forEach(t => {
        if (themesMap[t.id] !== undefined) {
          t.costCoins = Math.max(1, parseInt(themesMap[t.id]) || t.costCoins);
        }
      });
    }

    this.logAction('Parent updated shop pricing & stat bonuses', 'Shop prices and stat bonus percentages updated');
    Sound.fanfare();
    this.showReward('Pricing & Stats Updated!', 'All reward prices and stat bonus percentages have been updated in the Hero Shop!', 0, 0, null, 'payments');
    this.saveState(true);
  }

  // 4. PER-KID DIFFICULTY CONTROLS (Parent Portal)
  setKidDifficulty(kidId, difficultyLevel) {
    const hero = this.state.heroes.find(h => h.id === kidId);
    if (hero) {
      hero.gameDifficulty = difficultyLevel;
      if (this.state.selectedHero.id === kidId) {
        this.state.selectedHero.gameDifficulty = difficultyLevel;
      }
      this.logAction(`Parent set ${hero.name}'s learning level to ${difficultyLevel.toUpperCase()}`, `Learning Level: ${difficultyLevel}`);
      Sound.click();
      this.saveState(true);
    }
  }

  // 5. PROFILE THEMES (Buy & Equip)
  buyProfileTheme(themeId) {
    const theme = this.state.profileThemes.find(t => t.id === themeId);
    if (!theme) return;

    if (this.state.selectedHero.unlockedThemes?.includes(themeId)) {
      this.equipProfileTheme(themeId);
      return;
    }

    if (this.state.selectedHero.coins < theme.costCoins) {
      Sound.hit();
      this.showReward('Need More Tokens!', `You need ${theme.costCoins - this.state.selectedHero.coins} more Habit Tokens to unlock this profile theme!`, 0, 0, null, 'palette');
      return;
    }

    this.state.selectedHero.coins -= theme.costCoins;
    if (!this.state.selectedHero.unlockedThemes) this.state.selectedHero.unlockedThemes = [];
    this.state.selectedHero.unlockedThemes.push(themeId);
    this.state.selectedHero.equippedProfileTheme = themeId;
    
    // Update active hero in heroes array
    const h = this.state.heroes.find(hero => hero.id === this.state.selectedHero.id);
    if (h) {
      if (!h.unlockedThemes) h.unlockedThemes = [];
      h.unlockedThemes.push(themeId);
      h.equippedProfileTheme = themeId;
    }

    this.saveState(true);

    // Mystery Surprise Unboxing: Theme arrives in a Glowing Treasure Chest!
    this.openMysterySurprise({
      type: 'chest',
      title: `${theme.name} Theme`,
      image: null,
      icon: 'palette',
      desc: `"${theme.name}" is now unlocked and equipped on your hero profile!`,
      category: 'Profile Theme',
      xpEarned: 25
    });
  }

  equipProfileTheme(themeId) {
    const theme = this.state.profileThemes.find(t => t.id === themeId);
    if (theme) {
      this.state.selectedHero.equippedProfileTheme = themeId;
      const h = this.state.heroes.find(hero => hero.id === this.state.selectedHero.id);
      if (h) h.equippedProfileTheme = themeId;
      Sound.click();
      this.showReward('Theme Equipped!', `"${theme.name}" is now styling your hero profile!`, 0, 0, null, 'palette');
      this.saveState(true);
    }
  }

  // 6. AI REWARD GENERATOR STUDIO WITH 3D GRAPHIC ENGINE
  async generateAIReward(name, type, description, costCoins) {
    try {
      const { firebaseAI } = await import('../services/firebaseAILogicService.js');
      const newItem = await firebaseAI.generateRewardItem(name, type, costCoins);
      if (description && description.trim()) {
        newItem.desc = description.trim();
      }

      if (type === 'theme') {
        const themeId = 'theme_' + Date.now();
        const customTheme = {
          id: themeId,
          name: newItem.title,
          desc: newItem.desc,
          costCoins: newItem.costCoins,
          primaryColor: newItem.colorTheme === 'blue' ? '#3498db' : newItem.colorTheme === 'yellow' ? '#f1c40f' : newItem.colorTheme === 'orange' ? '#e89300' : '#2ecc71',
          accentColor: newItem.colorTheme === 'blue' ? '#a3d3ff' : newItem.colorTheme === 'yellow' ? '#ffec85' : newItem.colorTheme === 'orange' ? '#ffb961' : '#54e98a',
          bgGradient: newItem.colorTheme === 'blue' 
            ? 'from-[#061826] via-[#0c2b42] to-[#030d14]'
            : newItem.colorTheme === 'yellow'
            ? 'from-[#2b2000] via-[#473600] to-[#140f00]'
            : newItem.colorTheme === 'orange'
            ? 'from-[#291700] via-[#4a2b00] to-[#120a00]'
            : 'from-[#081c15] via-[#0d281e] to-[#040e0b]',
          cardBorder: 'border-primary/50',
          badgeIcon: newItem.iconSymbol || 'palette',
          bannerPattern: '✨'
        };
        this.state.profileThemes.push(customTheme);
      }

      this.state.digitalGear.unshift(newItem);
      this.logAction(`Parent AI Studio generated new ${type}: '${newItem.title}'`, `Price: ${newItem.costCoins} Tokens 🪙`);
      Sound.fanfare();
      confetti({ particleCount: 80, spread: 90 });
      this.showReward(
        '✨ AI Item Published Live!',
        `"${newItem.title}" is now live in the Hero Shop for ${newItem.costCoins} Habit Tokens!`,
        0,
        0,
        newItem.image,
        'auto_awesome'
      );
      this.saveState(true);
    } catch (e) {
      console.warn("AI generation fallback:", e);
      const iconName = type === 'badge' ? 'military_tech' : type === 'weapon' ? 'colorize' : type === 'snack' ? 'nutrition' : type === 'theme' ? 'palette' : 'shield';
      const colorTheme = type === 'weapon' ? 'blue' : type === 'badge' ? 'yellow' : type === 'snack' ? 'orange' : 'green';
      const generatedGraphic = generate3DIcon(iconName, colorTheme, name.slice(0, 12));

      const newItem = {
        id: 'ai_' + Date.now(),
        title: name,
        desc: description || 'AI Generated custom digital reward created by Parent Admin.',
        category: type === 'gear' ? 'Avatar Gear' : type === 'badge' ? 'Badges' : type === 'weapon' ? 'Weapons' : type === 'theme' ? 'Profile Themes' : 'Snacks',
        costCoins: parseInt(costCoins) || 100,
        image: generatedGraphic,
        isNew: true
      };

      if (type === 'theme') {
        this.state.profileThemes.push({
          id: 'theme_' + Date.now(),
          name: name,
          desc: description,
          costCoins: parseInt(costCoins) || 250,
          primaryColor: '#2ecc71',
          accentColor: '#54e98a',
          bgGradient: 'from-[#081c15] via-[#0d281e] to-[#040e0b]',
          cardBorder: 'border-[#2ecc71]/50',
          badgeIcon: 'palette',
          bannerPattern: '🎨'
        });
      }

      this.state.digitalGear.unshift(newItem);
      this.showReward(
        '✨ AI Item Published Live!',
        `"${newItem.title}" is now live in the Hero Shop for ${newItem.costCoins} Habit Tokens!`,
        0,
        0,
        newItem.image,
        'auto_awesome'
      );
      this.saveState(true);
    }
  }

  // ROUTINE & TASK QUERY HELPERS
  isTaskPendingApproval(taskId, heroId = null) {
    const kidId = heroId || this.state.selectedHero?.id;
    return (this.state.pendingApprovals || []).some(
      (r) => r.taskId === taskId && (!kidId || r.kidId === kidId) && r.status === 'pending'
    );
  }

  getTaskCompletions(taskId, heroId = null) {
    const kidId = heroId || this.state.selectedHero?.id;
    return (this.state.taskCompletionLogs || []).filter(
      (l) => l.taskId === taskId && (!kidId || l.heroId === kidId)
    );
  }

  getTaskCompletionsToday(taskId, heroId = null) {
    const todayStr = new Date().toISOString().split('T')[0];
    return this.getTaskCompletions(taskId, heroId).filter((l) => {
      const logDay = (l.completedAt || '').split('T')[0];
      return logDay === todayStr;
    });
  }

  // HABIT ISLANDS COMPLETION
  toggleHabitIsland(habitId) {
    const habit = this.state.habitIslands.find((h) => h.id === habitId);
    if (!habit) return;

    const currentHero = this.state.selectedHero;
    const heroId = currentHero?.id || 'hero_1';

    // Check if habit is currently pending approval for this hero
    const isPending = this.isTaskPendingApproval(habit.id, heroId);

    if (isPending) {
      // Per requirements: All habits remain clickable, but when pending approval:
      // - NO duplicate tokens auto-issued until parent approves original request first
      Sound.click();
      this.showReward(
        'Waiting for Parent Sign-Off',
        `"${habit.title}" is currently pending review in the Parent Portal! Once approved, your Gold Points ⭐ will be credited!`,
        0,
        0,
        null,
        'hourglass_top'
      );
      return;
    }

    const logId = 'compl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const approvalReqId = 'task_habit_' + habit.id + '_' + Date.now();
    const nowIso = new Date().toISOString();

    const completionLog = {
      id: logId,
      taskId: habit.id,
      taskTitle: habit.title,
      zone: 'Habit Islands',
      heroId: heroId,
      heroName: currentHero.name,
      completedAt: nowIso,
      timestamp: Date.now(),
      dateString: new Date().toLocaleDateString(),
      timeString: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      coinsAwarded: habit.coins,
      pointsAwarded: habit.points,
      xpAwarded: habit.xp,
      status: 'pending',
      approvalRequestId: approvalReqId,
      approvedAt: null,
      rejectedAt: null
    };

    if (!this.state.taskCompletionLogs) {
      this.state.taskCompletionLogs = [];
    }
    this.state.taskCompletionLogs.unshift(completionLog);
    if (this.state.taskCompletionLogs.length > 200) {
      this.state.taskCompletionLogs.pop();
    }

    // Set temporary pending flag for active card UI state
    habit.completed = true;
    habit.pointsApproved = false;

    // Factor in Pet Gear Stat Buffs
    const petBuffs = this.getActivePetGearBuffs ? this.getActivePetGearBuffs(currentHero.activePetId) : { coin_boost: 0, xp_boost: 0 };
    const bonusCoins = petBuffs.coin_boost > 0 ? Math.ceil((habit.coins || 10) * (petBuffs.coin_boost / 100)) : 0;
    const finalCoins = (habit.coins || 10) + bonusCoins;
    const bonusXP = petBuffs.xp_boost > 0 ? Math.ceil((habit.xp || 15) * (petBuffs.xp_boost / 100)) : 0;
    const finalXP = (habit.xp || 15) + bonusXP;

    // 🪙 Tokens are auto-issued immediately (with pet gear boost)
    currentHero.coins += finalCoins;
    this.addXP(finalXP);
    this.awardTaskCareSynergy(habit.id, 'habit');
    Sound.coin();
    Sound.fanfare();

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#2ecc71', '#ffb961', '#3498db', '#f1c40f']
    });

    // Interactive Particle Celebration: flood screen with stars kids can pop & swipe!
    triggerInteractiveCelebration(45);

    // ⭐ Points are queued for Parent Approval
    this.state.pendingApprovals.push({
      id: approvalReqId,
      logId: logId,
      kidId: currentHero.id,
      kidName: currentHero.name,
      type: 'task_point_approval',
      taskId: habit.id,
      title: habit.title,
      zone: 'Habit Islands',
      pendingPoints: habit.points,
      tokensAwarded: finalCoins,
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: nowIso,
      status: 'pending'
    });

    const buffMsg = bonusCoins > 0 ? ` (Includes +${bonusCoins} Pet Gear Buff! 🐾)` : '';
    this.logAction(`${currentHero.name} logged '${habit.title}'`, `+${finalCoins} Tokens 🪙 auto-issued${buffMsg}. (${habit.points} Points ⭐ pending Parent Approval)`);
    this.showReward(
      `Habit Logged!`,
      `🪙 +${finalCoins} Habit Tokens auto-added to wallet!${buffMsg}\n⭐ +${habit.points} Gold Points sent to Parent for approval.`,
      finalCoins,
      finalXP,
      habit.image,
      habit.icon
    );

    this.saveState(true);
  }

  // TASK FOREST CHORE COMPLETION
  toggleTaskForest(taskId) {
    const task = this.state.taskForest.find((t) => t.id === taskId);
    if (!task) return;

    const currentHero = this.state.selectedHero;
    const heroId = currentHero?.id || 'hero_1';

    // Check if task is currently pending approval
    const isPending = this.isTaskPendingApproval(task.id, heroId);

    if (isPending) {
      Sound.click();
      this.showReward(
        'Waiting for Parent Sign-Off',
        `"${task.title}" is currently pending review in the Parent Portal! Once approved, your Gold Points ⭐ will be credited!`,
        0,
        0,
        null,
        'hourglass_top'
      );
      return;
    }

    const logId = 'compl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const approvalReqId = 'task_chore_' + task.id + '_' + Date.now();
    const nowIso = new Date().toISOString();

    const completionLog = {
      id: logId,
      taskId: task.id,
      taskTitle: task.title,
      zone: 'Task Forest',
      heroId: heroId,
      heroName: currentHero.name,
      completedAt: nowIso,
      timestamp: Date.now(),
      dateString: new Date().toLocaleDateString(),
      timeString: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      coinsAwarded: task.coins,
      pointsAwarded: task.points,
      xpAwarded: task.xp,
      status: 'pending',
      approvalRequestId: approvalReqId,
      approvedAt: null,
      rejectedAt: null
    };

    if (!this.state.taskCompletionLogs) {
      this.state.taskCompletionLogs = [];
    }
    this.state.taskCompletionLogs.unshift(completionLog);
    if (this.state.taskCompletionLogs.length > 200) {
      this.state.taskCompletionLogs.pop();
    }

    task.completed = true;
    task.pointsApproved = false;

    // Factor in Pet Gear Stat Buffs
    const petBuffs = this.getActivePetGearBuffs ? this.getActivePetGearBuffs(currentHero.activePetId) : { coin_boost: 0, xp_boost: 0 };
    const bonusCoins = petBuffs.coin_boost > 0 ? Math.ceil((task.coins || 15) * (petBuffs.coin_boost / 100)) : 0;
    const finalCoins = (task.coins || 15) + bonusCoins;
    const bonusXP = petBuffs.xp_boost > 0 ? Math.ceil((task.xp || 20) * (petBuffs.xp_boost / 100)) : 0;
    const finalXP = (task.xp || 20) + bonusXP;

    // 🪙 Tokens are auto-issued immediately (with pet gear boost)
    currentHero.coins += finalCoins;
    this.addXP(finalXP);
    this.awardTaskCareSynergy(task.id, 'task');
    Sound.coin();
    Sound.fanfare();

    confetti({
      particleCount: 70,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#2ecc71', '#54e98a', '#f1c40f']
    });

    // Interactive Particle Celebration: flood screen with stars kids can pop & swipe!
    triggerInteractiveCelebration(45);

    // ⭐ Points are queued for Parent Approval
    this.state.pendingApprovals.push({
      id: approvalReqId,
      logId: logId,
      kidId: currentHero.id,
      kidName: currentHero.name,
      type: 'task_point_approval',
      taskId: task.id,
      title: task.title,
      zone: 'Task Forest',
      pendingPoints: task.points,
      tokensAwarded: finalCoins,
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: nowIso,
      status: 'pending'
    });

    const buffMsg = bonusCoins > 0 ? ` (Includes +${bonusCoins} Pet Gear Buff! 🐾)` : '';
    this.logAction(`${currentHero.name} finished '${task.title}'`, `+${finalCoins} Tokens 🪙 auto-issued${buffMsg}. (${task.points} Points ⭐ pending Parent Approval)`);
    this.showReward(
      `Chore Done: ${task.title}!`,
      `🪙 +${finalCoins} Habit Tokens auto-added to wallet!${buffMsg}\n⭐ +${task.points} Gold Points sent to Parent for approval.`,
      finalCoins,
      finalXP,
      task.image,
      task.icon
    );

    this.saveState(true);
  }

  // SUBMIT CHORE WITH OPTIONAL PHOTO PROOF (+5 BONUS TOKENS & AI VISION CONFIRMATION)
  submitChoreWithPhoto({ task, photoUrl, aiConfidence = 92, aiFeedback = '', kidFeedback = '', badgeEarned = 'Photo Master' }) {
    if (!task) return;
    const currentHero = this.state.selectedHero;
    const heroId = currentHero?.id || 'hero_1';

    const logId = 'compl_photo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const approvalReqId = 'task_chore_photo_' + task.id + '_' + Date.now();
    const nowIso = new Date().toISOString();

    const bonusCoins = 5; // +5 Bonus for snapping photo proof!
    const totalCoins = (task.coins || 15) + bonusCoins;

    const completionLog = {
      id: logId,
      taskId: task.id,
      taskTitle: task.title,
      zone: task.zone || 'Task Forest',
      heroId: heroId,
      heroName: currentHero.name,
      completedAt: nowIso,
      timestamp: Date.now(),
      dateString: new Date().toLocaleDateString(),
      timeString: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      coinsAwarded: totalCoins,
      pointsAwarded: task.points || 10,
      xpAwarded: (task.xp || 20) + 15,
      status: 'pending',
      approvalRequestId: approvalReqId,
      hasPhotoProof: true,
      photoUrl: photoUrl,
      aiConfidence: aiConfidence,
      aiFeedback: aiFeedback,
      badgeEarned: badgeEarned,
      approvedAt: null,
      rejectedAt: null
    };

    if (!this.state.taskCompletionLogs) {
      this.state.taskCompletionLogs = [];
    }
    this.state.taskCompletionLogs.unshift(completionLog);
    if (this.state.taskCompletionLogs.length > 200) {
      this.state.taskCompletionLogs.pop();
    }

    task.completed = true;
    task.pointsApproved = false;

    // 🪙 Tokens auto-issued with +5 bonus
    currentHero.coins += totalCoins;
    this.addXP((task.xp || 20) + 15);
    this.awardTaskCareSynergy(task.id, 'photo_chore');
    Sound.coin();
    Sound.fanfare();

    // Enqueue into pending approvals with photo evidence and AI badge
    this.state.pendingApprovals.push({
      id: approvalReqId,
      logId: logId,
      kidId: currentHero.id,
      kidName: currentHero.name,
      type: 'task_point_approval',
      taskId: task.id,
      title: task.title,
      zone: task.zone || 'Task Forest',
      pendingPoints: task.points || 10,
      tokensAwarded: totalCoins,
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: nowIso,
      status: 'pending',
      hasPhotoProof: true,
      photoUrl: photoUrl,
      aiConfidence: aiConfidence,
      aiFeedback: aiFeedback,
      badgeEarned: badgeEarned
    });

    this.logAction(
      `${currentHero.name} snapped photo proof for '${task.title}'`,
      `+${totalCoins} Tokens 🪙 auto-issued (incl. +5 bonus!). AI Verified: ${aiConfidence}% confidence.`
    );

    this.showReward(
      '📸 Proof Sent to Rex & Parents!',
      `${kidFeedback || `Rex says: Incredible job, ${currentHero.name}!`} \n\n🪙 +${totalCoins} Tokens (Includes +5 Photo Bonus!)\n⭐ +${task.points || 10} Gold Points sent to Parent Inbox!`,
      totalCoins,
      (task.xp || 20) + 15,
      photoUrl,
      'photo_camera'
    );

    this.saveState(true);
    this.notify();
  }

  // TOOTHBRUSH AR BATTLE COMPLETION 2.0
  completeToothbrushBattle(bossId = 'sugar_bandit', durationSec = 120, avgCadence = 85) {
    const boss = getHygieneBoss(bossId);
    const currentHero = this.state.selectedHero;
    const heroId = currentHero?.id || 'hero_1';
    const nowIso = new Date().toISOString();
    const todayStr = new Date().toDateString();
    const currentHour = new Date().getHours();

    const baseCoins = boss.rewardCoins || 50;
    const baseXp = boss.rewardXP || 75;
    const sparksEarned = boss.rewardSparks || 15;

    const activePet = this.getActivePet();
    const petId = activePet?.id || this.state.selectedHero?.activePetId || 1;
    const petBuffs = this.getActivePetGearBuffs ? this.getActivePetGearBuffs(petId) : { damage_boost: 0, xp_boost: 0, coin_boost: 0 };

    const damageBonusCoins = petBuffs.damage_boost > 0 ? Math.ceil(baseCoins * (petBuffs.damage_boost / 100)) : 0;
    const coinsEarned = baseCoins + damageBonusCoins;
    const xpBonus = petBuffs.xp_boost > 0 ? Math.ceil(baseXp * (petBuffs.xp_boost / 100)) : 0;
    const xpEarned = baseXp + xpBonus;

    // 1. Award Currency and Hero XP
    currentHero.coins = (currentHero.coins || 0) + coinsEarned;
    this.addXP(xpEarned);

    // 2. Active Companion Pet Sparks & Vitality Boost
    this.addEvolutionSparks(petId, sparksEarned);
    if (!this.state.petStatsMap[petId]) {
      this.state.petStatsMap[petId] = { hunger: 75, hygiene: 90, energy: 65, joy: 85 };
    }
    const pStats = this.state.petStatsMap[petId];
    pStats.hygiene = Math.min(100, (pStats.hygiene || 70) + 30);
    pStats.joy = Math.min(100, (pStats.joy || 80) + 20);

    // 3. Morning / Bedtime Habit Auto-Verification
    const isMorning = currentHour < 14;
    if (isMorning) {
      this.state.lastBrushedMorning = todayStr;
      const morningTask = this.state.taskForest.find(t => t.id === 'morning_brush');
      if (morningTask) {
        morningTask.completed = true;
        morningTask.pointsApproved = true;
      }
    } else {
      this.state.lastBrushedEvening = todayStr;
      const eveningTask = this.state.taskForest.find(t => t.id === 'bedtime_brush');
      if (eveningTask) {
        eveningTask.completed = true;
        eveningTask.pointsApproved = true;
      }
    }
    const habitBrush = this.state.habitIslands.find(h => h.id === 'brush_teeth');
    if (habitBrush) {
      habitBrush.completed = true;
      habitBrush.pointsApproved = true;
    }

    // 4. Plaque Buster Mastery Badges Evaluation
    if (!this.state.dentalBadges || !Array.isArray(this.state.dentalBadges)) {
      this.state.dentalBadges = [];
    }
    const newlyAwardedBadges = [];
    const awardBadge = (badgeId) => {
      if (!this.state.dentalBadges.includes(badgeId)) {
        this.state.dentalBadges.push(badgeId);
        newlyAwardedBadges.push(badgeId);
      }
    };

    // Enamel Guardian: Completed full duration (at least 90s or 120s)
    if (durationSec >= 90) {
      awardBadge('enamel_guardian');
    }
    // Plaque Buster: Defeated Plaque Kraken
    if (bossId === 'plaque_kraken') {
      awardBadge('plaque_buster');
    }
    // Diamond Grin: Precision Cadence >= 80%
    if (avgCadence >= 80) {
      awardBadge('diamond_grin');
    }
    // Twice-a-Day Champion: Brushed both AM & PM on same day
    if (this.state.lastBrushedMorning === todayStr && this.state.lastBrushedEvening === todayStr) {
      awardBadge('twice_a_day');
    }

    // Also add Mint Knight Badge / Dental Badges to Inventory if not present
    if (!this.state.inventory) this.state.inventory = [];
    if (!this.state.inventory.includes('Mint Knight Badge')) {
      this.state.inventory.push('Mint Knight Badge');
    }
    if (!currentHero.inventory) currentHero.inventory = [];
    if (!currentHero.inventory.includes('Mint Knight Badge')) {
      currentHero.inventory.push('Mint Knight Badge');
    }

    // 5. Record Dental Battle History
    if (!this.state.dentalBattleHistory) {
      this.state.dentalBattleHistory = [];
    }
    const battleRecord = {
      id: 'dental_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      bossId: boss.id,
      bossName: boss.name,
      bossAvatar: boss.avatar,
      durationSec: durationSec,
      avgCadence: avgCadence,
      quadrantsCleaned: 4,
      sparksAwarded: sparksEarned,
      coinsAwarded: coinsEarned,
      xpAwarded: xpEarned,
      newlyAwardedBadges: newlyAwardedBadges,
      timestamp: Date.now(),
      dateIso: nowIso,
      dateString: new Date().toLocaleDateString(),
      timeString: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    this.state.dentalBattleHistory.unshift(battleRecord);
    if (this.state.dentalBattleHistory.length > 100) {
      this.state.dentalBattleHistory.pop();
    }

    // 6. Audit Log for Parent Portal Pillar 1 & Pillar 2
    const completionLog = {
      id: 'brush_log_' + Date.now(),
      taskId: isMorning ? 'morning_brush' : 'bedtime_brush',
      taskTitle: `Toothbrush AR Battle: Defeated ${boss.name}`,
      zone: 'Hygiene AR Battle',
      category: 'hygiene',
      durationMinutes: Math.round(durationSec / 60),
      durationSec: durationSec,
      avgCadence: avgCadence,
      bossId: boss.id,
      heroId: currentHero.id,
      heroName: currentHero.name,
      completedAt: nowIso,
      timestamp: Date.now(),
      dateString: new Date().toLocaleDateString(),
      timeString: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      coinsAwarded: coinsEarned,
      pointsAwarded: 15,
      xpAwarded: xpEarned,
      sparksAwarded: sparksEarned,
      status: 'approved',
      approvedAt: nowIso
    };

    if (!this.state.taskCompletionLogs) {
      this.state.taskCompletionLogs = [];
    }
    this.state.taskCompletionLogs.unshift(completionLog);
    if (this.state.taskCompletionLogs.length > 200) {
      this.state.taskCompletionLogs.pop();
    }

    this.applyChoreTurboBoost(15, 'Toothbrush AR Battle');
    this.logAction(
      `${currentHero.name} defeated ${boss.name} in Toothbrush Battle! 🪥🦷`,
      `+${coinsEarned} Tokens 🪙, +${xpEarned} XP, +${sparksEarned} Sparks ⚡ for active companion pet, +30 Hygiene!`
    );

    // 7. Audio & Confetti Celebration
    Sound.fanfare();
    confetti({
      particleCount: 160,
      spread: 110,
      origin: { y: 0.5 },
      colors: ['#54e98a', '#ffb961', '#38bdf8', '#f1c40f', '#ec4899']
    });

    const badgeMessage = newlyAwardedBadges.length > 0
      ? `\n🎖️ UNLOCKED BADGES: ${newlyAwardedBadges.map(b => DENTAL_BADGES.find(db => db.id === b)?.name || b).join(', ')}!`
      : '';

    this.showReward(
      `${boss.name.toUpperCase()} DEFEATED! 🏆`,
      `🪙 +${coinsEarned} Habit Tokens & ⭐ +15 Points auto-awarded!\n⚡ +${sparksEarned} Evolution Sparks & +30% Hygiene for pet!\n🦷 All 4 Oral Quadrants Gleaming White!${badgeMessage}`,
      coinsEarned,
      xpEarned,
      null,
      'military_tech'
    );

    this.saveState(true);
    this.notify();

    return {
      coins: coinsEarned,
      xp: xpEarned,
      sparks: sparksEarned,
      newlyAwardedBadges,
      boss
    };
  }

  getDentalBadges() {
    const unlockedIds = this.state.dentalBadges || ['enamel_guardian'];
    return DENTAL_BADGES.map(b => ({
      ...b,
      unlocked: unlockedIds.includes(b.id)
    }));
  }


  // ---------------------------------------------------------
  // PET EXPEDITIONS & MINI-ADVENTURES 1.0
  // ---------------------------------------------------------

  openExpeditionModal(petId = null, tab = 'dispatch') {
    if (!this.state.expeditionModal) {
      this.state.expeditionModal = { isOpen: false, selectedPetId: null, selectedBiomeId: 'fern_woods', selectedDuration: 15, snackPacked: false, activeTab: 'dispatch' };
    }
    this.state.expeditionModal.isOpen = true;
    this.state.expeditionModal.activeTab = tab;
    if (petId) {
      this.state.expeditionModal.selectedPetId = petId;
    } else if (!this.state.expeditionModal.selectedPetId) {
      // Pick first idle unlocked pet
      const unlockedIds = this.state.selectedHero?.unlockedPetIds || [1];
      const activeExpeditionPetIds = (this.state.activeExpeditions || []).map(e => e.petId);
      const idlePetId = unlockedIds.find(id => !activeExpeditionPetIds.includes(id));
      this.state.expeditionModal.selectedPetId = idlePetId || unlockedIds[0] || 1;
    }
    this.notify();
  }

  closeExpeditionModal() {
    if (this.state.expeditionModal) {
      this.state.expeditionModal.isOpen = false;
    }
    this.notify();
  }

  setExpeditionModalTab(tab) {
    if (this.state.expeditionModal) {
      this.state.expeditionModal.activeTab = tab;
      this.notify();
    }
  }

  startPetExpedition(petId, biomeId = 'fern_woods', durationMinutes = 15, snackPacked = false) {
    if (!this.state.activeExpeditions) {
      this.state.activeExpeditions = [];
    }

    const heroLevel = this.state.selectedHero?.level || 1;
    const maxSlots = heroLevel >= 3 ? 2 : 1;

    if (this.state.activeExpeditions.length >= maxSlots) {
      return {
        success: false,
        error: `Maximum active expeditions reached (${maxSlots}/${maxSlots}). Reach Hero Level 3 to unlock Slot 2!`
      };
    }

    const pId = Number(petId);
    const isAlreadyExploring = this.state.activeExpeditions.some(e => e.petId === pId);
    if (isAlreadyExploring) {
      return {
        success: false,
        error: 'This companion pet is already exploring! Pick another pet.'
      };
    }

    const pet = this.state.pets.find(p => p.id === pId) || this.state.pets[0];
    const biome = getExpeditionBiome(biomeId);
    const affinity = calculateExpeditionAffinity(pet, biomeId);

    // If snack packed, deduct small treat tokens (free if insufficient)
    if (snackPacked && (this.state.selectedHero.coins || 0) >= 5) {
      this.state.selectedHero.coins -= 5;
    }

    const now = Date.now();
    const durationMs = durationMinutes * 60 * 1000;
    const expeditionRecord = {
      id: 'exp_' + now + '_' + Math.random().toString(36).substring(2, 6),
      petId: pId,
      petName: pet.name,
      petAvatar: pet.avatar,
      biomeId: biome.id,
      biomeName: biome.name,
      biomeEmoji: biome.emoji,
      durationMinutes: durationMinutes,
      startTime: now,
      endTime: now + durationMs,
      snackPacked: snackPacked,
      affinityBonus: affinity.hasAffinity
    };

    this.state.activeExpeditions.push(expeditionRecord);

    this.logAction(
      `${pet.name} departed for ${biome.name}! 🎒🗺️`,
      `${durationMinutes}-min expedition • ${affinity.hasAffinity ? '+35% Affinity Bonus 🌟' : 'Perimeter Exploration'}`
    );

    Sound.tap();
    if (this.state.expeditionModal) {
      this.state.expeditionModal.activeTab = 'active';
    }

    this.saveState(true);
    this.notify();

    return {
      success: true,
      expedition: expeditionRecord
    };
  }

  applyChoreTurboBoost(minutes = 15, sourceTaskTitle = 'Chore Completion') {
    const active = this.state.activeExpeditions || [];
    if (active.length === 0) return { boostedCount: 0 };

    let completedAny = false;
    const now = Date.now();

    active.forEach(exp => {
      const cutMs = minutes * 60 * 1000;
      exp.endTime = Math.max(now, exp.endTime - cutMs);
      if (exp.endTime <= now) {
        completedAny = true;
      }
    });

    this.logAction(
      `🚀 Chore Turbo Boost: -${minutes} mins travel time!`,
      `Triggered by ${sourceTaskTitle}. Active expeditions rushed closer to home!`
    );

    this.saveState(true);
    this.notify();

    return {
      boostedCount: active.length,
      completedAny: completedAny
    };
  }

  claimExpeditionRewards(expeditionId) {
    if (!this.state.activeExpeditions) return null;
    const expIdx = this.state.activeExpeditions.findIndex(e => e.id === expeditionId);
    if (expIdx === -1) return null;

    const expedition = this.state.activeExpeditions[expIdx];
    const pet = this.state.pets.find(p => p.id === expedition.petId) || this.state.pets[0];
    const currentHero = this.state.selectedHero;

    const rewards = generateExpeditionRewards(expedition, pet);

    // 1. Award Evolution Sparks to exploring pet
    this.addEvolutionSparks(pet.id, rewards.sparksAwarded);

    // 2. Award Tokens & XP to hero
    currentHero.coins = (currentHero.coins || 0) + rewards.coinsAwarded;
    this.addXP(rewards.xpAwarded);

    // 3. Companion Pet Joy & Energy Boost
    if (!this.state.petStatsMap[pet.id]) {
      this.state.petStatsMap[pet.id] = { hunger: 75, hygiene: 90, energy: 65, joy: 85 };
    }
    const pStats = this.state.petStatsMap[pet.id];
    pStats.joy = Math.min(100, (pStats.joy || 80) + 25);
    pStats.energy = Math.min(100, (pStats.energy || 70) + 15);

    // 4. Artifact Drop
    if (rewards.artifactDropped) {
      if (!this.state.unlockedArtifacts) this.state.unlockedArtifacts = [];
      const alreadyHas = this.state.unlockedArtifacts.some(a => a.id === rewards.artifactDropped.id);
      if (!alreadyHas) {
        this.state.unlockedArtifacts.push(rewards.artifactDropped);
      }
    }

    // 5. Exclusive Pet Gear Drop
    if (rewards.gearDropped) {
      if (!this.state.inventory) this.state.inventory = [];
      if (!this.state.inventory.includes(rewards.gearDropped.name)) {
        this.state.inventory.push(rewards.gearDropped.name);
      }
      if (!currentHero.inventory) currentHero.inventory = [];
      if (!currentHero.inventory.includes(rewards.gearDropped.name)) {
        currentHero.inventory.push(rewards.gearDropped.name);
      }
    }

    // 6. Save Postcard to Expedition History
    if (!this.state.expeditionHistory) this.state.expeditionHistory = [];
    this.state.expeditionHistory.unshift({
      ...expedition,
      claimedAt: Date.now(),
      rewards: rewards,
      postcard: rewards.postcard
    });
    if (this.state.expeditionHistory.length > 100) {
      this.state.expeditionHistory.pop();
    }

    // Remove from active expeditions
    this.state.activeExpeditions.splice(expIdx, 1);

    // 7. Audit Log for Parent Portal
    const nowIso = new Date().toISOString();
    const completionLog = {
      id: 'exp_log_' + Date.now(),
      taskId: 'expedition_' + expedition.biomeId,
      taskTitle: `Pet Expedition: ${pet.name} returned from ${expedition.biomeName}`,
      zone: 'Pet Expeditions',
      category: 'companion_exploration',
      durationMinutes: expedition.durationMinutes,
      petId: pet.id,
      petName: pet.name,
      biomeId: expedition.biomeId,
      heroId: currentHero.id,
      heroName: currentHero.name,
      completedAt: nowIso,
      timestamp: Date.now(),
      dateString: new Date().toLocaleDateString(),
      timeString: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      coinsAwarded: rewards.coinsAwarded,
      pointsAwarded: 10,
      xpAwarded: rewards.xpAwarded,
      sparksAwarded: rewards.sparksAwarded,
      status: 'approved',
      approvedAt: nowIso
    };
    if (!this.state.taskCompletionLogs) this.state.taskCompletionLogs = [];
    this.state.taskCompletionLogs.unshift(completionLog);
    if (this.state.taskCompletionLogs.length > 200) {
      this.state.taskCompletionLogs.pop();
    }

    this.logAction(
      `${pet.name} returned from ${expedition.biomeName}! 🎒✨`,
      `+${rewards.sparksAwarded} Sparks ⚡, +${rewards.coinsAwarded} Coins 🪙, +${rewards.xpAwarded} XP${rewards.artifactDropped ? ' & Found ' + rewards.artifactDropped.name : ''}`
    );

    Sound.fanfare();
    confetti({
      particleCount: 140,
      spread: 100,
      origin: { y: 0.5 },
      colors: ['#2ecc71', '#3498db', '#9b59b6', '#f39c12', '#00bcd4']
    });

    const dropMessage = rewards.artifactDropped
      ? `\n🏺 DISCOVERED ARTIFACT: "${rewards.artifactDropped.name}" added to Souvenir Shelf!`
      : '';
    const gearMessage = rewards.gearDropped
      ? `\n🧢 EXCLUSIVE GEAR: "${rewards.gearDropped.name}" added to Pet Locker!`
      : '';

    this.showReward(
      `${pet.name.toUpperCase()} RETURNED! 🎒🎉`,
      `⚡ +${rewards.sparksAwarded} Evolution Sparks for ${pet.name}!\n🪙 +${rewards.coinsAwarded} Habit Tokens & +${rewards.xpAwarded} XP!\n💌 New illustrated postcard added to your Journal!${dropMessage}${gearMessage}`,
      rewards.coinsAwarded,
      rewards.xpAwarded,
      null,
      'explore'
    );

    this.saveState(true);
    this.notify();

    return {
      rewards,
      pet,
      expedition
    };
  }

  recallPetExpedition(expeditionId) {
    if (!this.state.activeExpeditions) return false;
    const idx = this.state.activeExpeditions.findIndex(e => e.id === expeditionId);
    if (idx === -1) return false;

    const exp = this.state.activeExpeditions[idx];
    this.state.activeExpeditions.splice(idx, 1);

    this.logAction(
      `${exp.petName} was safely recalled home 🏡`,
      `Expedition to ${exp.biomeName} cancelled without penalty.`
    );

    Sound.tap();
    this.saveState(true);
    this.notify();
    return true;
  }

  getExpeditionStats() {
    const history = this.state.expeditionHistory || [];
    const active = this.state.activeExpeditions || [];
    const artifacts = this.state.unlockedArtifacts || [];

    const totalSparksForaged = history.reduce((sum, h) => sum + (h.rewards?.sparksAwarded || 0), 0);
    const totalMinutesExplored = history.reduce((sum, h) => sum + (h.durationMinutes || 0), 0);

    return {
      activeCount: active.length,
      completedCount: history.length,
      totalSparksForaged,
      totalMinutesExplored,
      artifactsCount: artifacts.length,
      recentPostcards: history.map(h => h.postcard).filter(Boolean).slice(0, 10)
    };
  }

  getDentalStats() {
    const history = this.state.dentalBattleHistory || [];
    const totalBattles = history.length;
    const avgCadenceAll = totalBattles > 0
      ? Math.round(history.reduce((sum, h) => sum + (h.avgCadence || 80), 0) / totalBattles)
      : 85;
    const bossesDefeated = {
      sugar_bandit: history.filter(h => h.bossId === 'sugar_bandit').length,
      plaque_kraken: history.filter(h => h.bossId === 'plaque_kraken').length,
      cavity_knight: history.filter(h => h.bossId === 'cavity_knight').length
    };
    return {
      totalBattles,
      avgCadence: avgCadenceAll,
      bossesDefeated,
      badges: this.getDentalBadges(),
      recentBattles: history.slice(0, 10)
    };
  }

  // ---------------------------------------------------------
  // AI SPARK AUTONOMOUS MICRO-QUESTS
  // ---------------------------------------------------------
  setAiQuests(quests) {
    this.state.aiQuests = Array.isArray(quests) ? quests : [];
    this.saveState(true);
  }

  getAiQuests() {
    return this.state.aiQuests || [];
  }

  completeAiQuest(questId, verifiedResult = null) {
    const quest = (this.state.aiQuests || []).find((q) => q.id === questId);
    if (!quest) return;

    const currentHero = this.state.selectedHero;
    const heroId = currentHero?.id || 'hero_1';

    const coins = verifiedResult?.coinsEarned ?? quest.coinReward ?? 25;
    const points = verifiedResult?.pointsEarned ?? quest.pointReward ?? 10;
    const xp = verifiedResult?.xpEarned ?? quest.xpReward ?? 35;

    const logId = 'compl_ai_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const approvalReqId = 'task_ai_' + quest.id + '_' + Date.now();
    const nowIso = new Date().toISOString();

    const completionLog = {
      id: logId,
      taskId: quest.id,
      taskTitle: quest.title,
      zone: 'AI Spark Quests',
      heroId: heroId,
      heroName: currentHero.name,
      completedAt: nowIso,
      timestamp: Date.now(),
      dateString: new Date().toLocaleDateString(),
      timeString: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      coinsAwarded: coins,
      pointsAwarded: points,
      xpAwarded: xp,
      status: 'pending',
      approvalRequestId: approvalReqId,
      approvedAt: null,
      rejectedAt: null
    };

    if (!this.state.taskCompletionLogs) {
      this.state.taskCompletionLogs = [];
    }
    this.state.taskCompletionLogs.unshift(completionLog);
    if (this.state.taskCompletionLogs.length > 200) {
      this.state.taskCompletionLogs.pop();
    }

    quest.completed = true;

    currentHero.coins += coins;
    this.addXP(xp);
    this.awardTaskCareSynergy(quest.id, 'ai_quest');
    Sound.coin();
    Sound.fanfare();

    confetti({
      particleCount: 60,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#3498db', '#f1c40f', '#2ecc71', '#9b59b6']
    });
    triggerInteractiveCelebration(40);

    this.state.pendingApprovals.push({
      id: approvalReqId,
      logId: logId,
      kidId: currentHero.id,
      kidName: currentHero.name,
      type: 'task_point_approval',
      taskId: quest.id,
      title: quest.title,
      zone: 'AI Spark Quests',
      pendingPoints: points,
      tokensAwarded: coins,
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: nowIso,
      status: 'pending'
    });

    this.logAction(`${currentHero.name} completed AI Spark Quest: '${quest.title}'`, `+${coins} Tokens 🪙 auto-issued. (${points} Points ⭐ pending Parent Approval)`);
    this.showReward(
      `Spark Quest Done!`,
      `🪙 +${coins} Habit Tokens auto-added to wallet!\n⭐ +${points} Gold Points sent to Parent for approval.`,
      coins,
      xp,
      null,
      quest.icon || 'auto_awesome'
    );

    this.saveState(true);
  }

  addXP(amount) {
    const hero = this.state.selectedHero;
    hero.xp += amount;
    if (hero.xp >= hero.xpNext) {
      hero.level += 1;
      hero.xp = hero.xp - hero.xpNext;
      hero.xpNext = Math.round(hero.xpNext * 1.35);
      hero.coins += 50;
      Sound.levelUp();
      Sound.sparkle();
      Sound.coin();

      confetti({
        particleCount: 120,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#f1c40f', '#2ecc71', '#54e98a', '#ffffff']
      });

      this.showReward(
        `LEVEL UP! Hero Level ${hero.level}!`,
        'You unlocked new equipment and earned +50 Bonus Tokens!',
        50,
        0,
        hero.avatar,
        'military_tech'
      );
    }
  }

  feedPet(petId) {
    const id = petId || this.state.selectedHero.activePetId || 1;
    if (!this.state.petStatsMap[id]) this.state.petStatsMap[id] = { hunger: 75, hygiene: 90, energy: 65, joy: 85 };
    const stats = this.state.petStatsMap[id];
    const activePet = this.getActivePet();

    if (stats.hunger >= 100) {
      this.showReward(
        'Your Pet is Full!',
        'Your companion has plenty of energy right now!',
        0,
        0,
        activePet.avatar,
        'nutrition'
      );
      return;
    }

    stats.hunger = Math.min(100, stats.hunger + 25);
    stats.joy = Math.min(100, stats.joy + 15);
    stats.energy = Math.min(100, stats.energy + 20);
    this.addXP(10);
    Sound.crunch();
    Sound.chirp();
    this.saveState(true);
  }

  playWithPet(petId) {
    const id = petId || this.state.selectedHero.activePetId || 1;
    if (!this.state.petStatsMap[id]) this.state.petStatsMap[id] = { hunger: 75, hygiene: 90, energy: 65, joy: 85 };
    const stats = this.state.petStatsMap[id];

    // Increases BOTH Joy and Energy (not decreasing)
    stats.joy = Math.min(100, stats.joy + 20);
    stats.energy = Math.min(100, stats.energy + 15);
    this.addXP(15);
    Sound.boing();
    Sound.chirp();
    this.saveState(true);
  }

  equipPetGear(gearTitle, petId, gearId) {
    if (['head', 'back', 'chest', 'feet'].includes(petId)) {
      return this.equipPetStudioGear(gearTitle, petId, gearId);
    }
    const id = petId || this.state.selectedHero?.activePetId || 1;
    if (!this.state.equippedGearMap) {
      this.state.equippedGearMap = {};
    }
    this.state.equippedGearMap[id] = gearTitle;
    this.state.equippedPetGear = gearTitle;
    if (this.state.selectedHero) {
      this.state.selectedHero.equippedPetGear = gearTitle;
    }
    Sound.sparkle();
    Sound.fanfare();
    confetti({
      particleCount: 45,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#f1c40f', '#2ecc71', '#3498db']
    });
    this.saveState(true);
    this.notify();
  }

  unequipPetGear(petId) {
    const id = petId || this.state.selectedHero?.activePetId || 1;
    if (!this.state.equippedGearMap) {
      this.state.equippedGearMap = {};
    }
    this.state.equippedGearMap[id] = null;
    this.state.equippedPetGear = null;
    if (this.state.selectedHero) {
      this.state.selectedHero.equippedPetGear = null;
    }
    Sound.click();
    this.saveState(true);
    this.notify();
  }

  getEquippedPetGear(petId) {
    const id = petId || this.state.selectedHero?.activePetId || 1;
    if (this.state.equippedGearMap && this.state.equippedGearMap[id] !== undefined) {
      return this.state.equippedGearMap[id];
    }
    return this.state.selectedHero?.equippedPetGear || this.state.equippedPetGear || null;
  }

  getEquippedPetGearSlots(petId) {
    const id = petId || this.state.selectedHero?.activePetId || 1;
    if (!this.state.equippedPetGearSlots) {
      this.state.equippedPetGearSlots = {};
    }
    if (!this.state.equippedPetGearSlots[id]) {
      this.state.equippedPetGearSlots[id] = { hat: 'Enchanted Wizard Hat', cape: null, aura: null };
    }
    return { hat: null, cape: null, aura: null, ...this.state.equippedPetGearSlots[id] };
  }

  equipPetSlotGear(petId, slot, itemTitle) {
    const id = petId || this.state.selectedHero?.activePetId || 1;
    if (!this.state.equippedPetGearSlots) {
      this.state.equippedPetGearSlots = {};
    }
    if (!this.state.equippedPetGearSlots[id]) {
      this.state.equippedPetGearSlots[id] = { hat: null, cape: null, aura: null };
    }

    // Toggle off if same item is clicked
    if (this.state.equippedPetGearSlots[id][slot] === itemTitle) {
      this.state.equippedPetGearSlots[id][slot] = null;
    } else {
      this.state.equippedPetGearSlots[id][slot] = itemTitle;
    }

    // Sync legacy equippedPetGear if slot is hat
    if (slot === 'hat') {
      this.state.equippedPetGear = this.state.equippedPetGearSlots[id].hat;
      if (this.state.selectedHero) {
        this.state.selectedHero.equippedPetGear = this.state.equippedPetGearSlots[id].hat;
      }
    }

    Sound.sparkle();
    confetti({
      particleCount: 35,
      spread: 50,
      origin: { y: 0.6 }
    });
    this.saveState(true);
    this.notify();
  }

  openPetLockerModal(petId) {
    const id = petId || this.getActivePet().id;
    this.state.petLockerModal = { isOpen: true, petId: id };
    this.notify();
  }

  closePetLockerModal() {
    this.state.petLockerModal = { isOpen: false, petId: null };
    this.notify();
  }

  // --- PET GEAR STUDIO & SKELETAL RIG METHODS ---

  getEquippedPetStudioGear(petId) {
    const id = petId || this.state.selectedHero?.activePetId || 1;
    if (!this.state.equippedPetGearMap) {
      this.state.equippedPetGearMap = {};
    }
    if (!this.state.equippedPetGearMap[id]) {
      this.state.equippedPetGearMap[id] = { head: 'crown_golden_horn', back: 'cape_classic', chest: 'collar_titan', feet: 'boots_speed_neon' };
    }
    return { head: null, back: null, chest: null, feet: null, ...this.state.equippedPetGearMap[id] };
  }

  equipPetStudioGear(petId, slot, gearId) {
    const id = petId || this.state.selectedHero?.activePetId || 1;
    if (!this.state.equippedPetGearMap) {
      this.state.equippedPetGearMap = {};
    }
    if (!this.state.equippedPetGearMap[id]) {
      this.state.equippedPetGearMap[id] = { head: null, back: null, chest: null, feet: null };
    }

    // Toggle off if already equipped
    if (this.state.equippedPetGearMap[id][slot] === gearId) {
      this.state.equippedPetGearMap[id][slot] = null;
    } else {
      this.state.equippedPetGearMap[id][slot] = gearId;
    }

    if (this.state.selectedHero) {
      if (!this.state.selectedHero.equippedPetGearMap) this.state.selectedHero.equippedPetGearMap = {};
      this.state.selectedHero.equippedPetGearMap[id] = { ...this.state.equippedPetGearMap[id] };
    }

    Sound.gearSnap();
    confetti({
      particleCount: 25,
      spread: 45,
      origin: { y: 0.6 }
    });
    this.saveState(true);
    this.notify();
    return this.state.equippedPetGearMap[id];
  }

  getCustomGearDyes(petId) {
    const id = petId || this.state.selectedHero?.activePetId || 1;
    if (!this.state.customGearDyesMap) {
      this.state.customGearDyesMap = {};
    }
    if (!this.state.customGearDyesMap[id]) {
      this.state.customGearDyesMap[id] = { head: '#f59e0b', back: '#ef4444', chest: '#475569', feet: '#10b981' };
    }
    return { head: null, back: null, chest: null, feet: null, ...this.state.customGearDyesMap[id] };
  }

  setCustomGearDye(petId, slot, colorHex) {
    const id = petId || this.state.selectedHero?.activePetId || 1;
    if (!this.state.customGearDyesMap) {
      this.state.customGearDyesMap = {};
    }
    if (!this.state.customGearDyesMap[id]) {
      this.state.customGearDyesMap[id] = {};
    }
    this.state.customGearDyesMap[id][slot] = colorHex;

    if (this.state.selectedHero) {
      if (!this.state.selectedHero.customGearDyesMap) this.state.selectedHero.customGearDyesMap = {};
      this.state.selectedHero.customGearDyesMap[id] = { ...this.state.customGearDyesMap[id] };
    }

    Sound.sparkle();
    this.saveState(true);
    this.notify();
    return this.state.customGearDyesMap[id];
  }

  getActivePetGearBuffs(petId = null) {
    const id = petId || this.state.selectedHero?.activePetId || 1;
    const equipped = this.getEquippedPetStudioGear(id);
    return calculateActiveGearBuffs(equipped);
  }

  getParentCustomGear() {
    return this.state.parentCustomGear || [];
  }

  publishCustomAIGear(gearItem) {
    if (!gearItem || (!gearItem.name && !gearItem.title)) return null;

    const socket = gearItem.socket || gearItem.targetPetSocket || 'head';
    const name = gearItem.name || gearItem.title || 'Custom Hero Gear';
    const gear = {
      ...gearItem,
      id: gearItem.id || `ai_gear_${Date.now()}`,
      name,
      title: name,
      socket,
      targetPetSocket: socket,
      isParentCrafted: true,
      isCustomAI: true,
      unlocked: false,
      statBonusType: gearItem.statBonusType || (socket === 'feet' ? 'speed_boost' : socket === 'chest' ? 'defense_boost' : socket === 'head' ? 'damage_boost' : 'xp_boost'),
      statBonusPercent: Number(gearItem.statBonusPercent) || 25,
      statBonusLabel: gearItem.statBonusLabel || `+${gearItem.statBonusPercent || 25}% ${formatStatBonusName(gearItem.statBonusType)}`,
      costCoins: Number(gearItem.costCoins || gearItem.coinPrice) || 150,
      createdAt: gearItem.createdAt || new Date().toISOString()
    };

    if (!this.state.parentCustomGear) this.state.parentCustomGear = [];
    const existingIdx = this.state.parentCustomGear.findIndex(g => g.id === gear.id);
    if (existingIdx >= 0) {
      this.state.parentCustomGear[existingIdx] = gear;
    } else {
      this.state.parentCustomGear.unshift(gear);
    }

    if (!this.state.digitalGear) this.state.digitalGear = [];
    const digIdx = this.state.digitalGear.findIndex(g => g.id === gear.id);
    if (digIdx >= 0) {
      this.state.digitalGear[digIdx] = gear;
    } else {
      this.state.digitalGear.unshift(gear);
    }

    if (PET_GEAR_CATALOG[socket]) {
      const catIdx = PET_GEAR_CATALOG[socket].findIndex(g => g.id === gear.id);
      if (catIdx >= 0) {
        PET_GEAR_CATALOG[socket][catIdx] = gear;
      } else {
        PET_GEAR_CATALOG[socket].unshift(gear);
      }
    }

    this.logAction(
      `Parent crafted 3D Pet Gear: '${gear.name}'`,
      `Published to Hero Shop for ${gear.costCoins} Tokens 🪙. (${gear.statBonusLabel})`
    );

    Sound.fanfare();
    confetti({ particleCount: 75, spread: 80, origin: { y: 0.6 } });
    this.showReward(
      '✨ 3D Pet Gear Published!',
      `"${gear.name}" is now live in the Hero Shop!\n🪙 Price: ${gear.costCoins} Habit Tokens\n⚡ Bonus: ${gear.statBonusLabel}\n🐾 Ready to equip on your companion pets!`,
      0,
      0,
      gear.image,
      gear.icon || 'auto_awesome'
    );

    this.saveState(true);
    this.notify();
    return gear;
  }

  deleteCustomAIGear(gearId) {
    if (!gearId) return false;

    if (this.state.parentCustomGear) {
      const item = this.state.parentCustomGear.find(g => g.id === gearId);
      this.state.parentCustomGear = this.state.parentCustomGear.filter(g => g.id !== gearId);
      if (item && item.socket && PET_GEAR_CATALOG[item.socket]) {
        PET_GEAR_CATALOG[item.socket] = PET_GEAR_CATALOG[item.socket].filter(g => g.id !== gearId);
      }
    }

    if (this.state.digitalGear) {
      this.state.digitalGear = this.state.digitalGear.filter(g => g.id !== gearId);
    }

    Sound.click();
    this.saveState(true);
    this.notify();
    return true;
  }

  getSavedHeroCards() {
    return this.state.savedHeroCards || [];
  }

  saveHeroCard(cardData) {
    if (!this.state.savedHeroCards) {
      this.state.savedHeroCards = [];
    }
    const newCard = {
      id: 'hero_card_' + Date.now(),
      createdAt: new Date().toISOString(),
      dateStr: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      ...cardData
    };
    this.state.savedHeroCards.unshift(newCard);
    if (this.state.savedHeroCards.length > 50) {
      this.state.savedHeroCards = this.state.savedHeroCards.slice(0, 50);
    }
    if (this.state.selectedHero) {
      this.state.selectedHero.savedHeroCards = [...this.state.savedHeroCards];
    }
    Sound.cameraShutter();
    confetti({
      particleCount: 50,
      spread: 65,
      origin: { y: 0.5 }
    });
    this.saveState(true);
    this.notify();
    return newCard;
  }

  deleteHeroCard(cardId) {
    if (!this.state.savedHeroCards) return;
    this.state.savedHeroCards = this.state.savedHeroCards.filter(c => c.id !== cardId);
    if (this.state.selectedHero) {
      this.state.selectedHero.savedHeroCards = [...this.state.savedHeroCards];
    }
    Sound.pop();
    this.saveState(true);
    this.notify();
  }

  openPetRunwayModal(petId) {
    const id = petId || this.getActivePet().id;
    this.state.activeRunwayModal = { isOpen: true, petId: id, currentPose: 'hero_landing' };
    Sound.whoosh();
    this.notify();
  }

  closePetRunwayModal() {
    this.state.activeRunwayModal = { isOpen: false, petId: null, currentPose: 'idle' };
    Sound.pop();
    this.notify();
  }

  getPetSparks(petId) {
    const id = petId || this.state.selectedHero?.activePetId || 1;
    if (!this.state.petSparkMap) {
      this.state.petSparkMap = {};
    }
    if (this.state.petSparkMap[id] === undefined) {
      this.state.petSparkMap[id] = 65; // High initial sparks for immediate toddler satisfaction
    }
    return this.state.petSparkMap[id];
  }

  addEvolutionSparks(petId, amount = 15) {
    const id = petId || this.state.selectedHero?.activePetId || 1;
    if (!this.state.petSparkMap) {
      this.state.petSparkMap = {};
    }
    const current = this.getPetSparks(id);
    const next = Math.min(100, current + amount);
    this.state.petSparkMap[id] = next;
    return next;
  }

  getPetStreakShield() {
    if (!this.state.petStreakShield) {
      this.state.petStreakShield = { available: true, usedThisWeek: false, lastProtectedDate: null };
    }
    const activePet = this.getActivePet();
    const stats = this.state.petStatsMap?.[activePet?.id] || { joy: 85 };
    const isHappy = (stats.joy || 80) >= 60;
    return {
      ...this.state.petStreakShield,
      isActive: isHappy && this.state.petStreakShield.available && !this.state.petStreakShield.usedThisWeek
    };
  }

  feedAllPetsPicnic() {
    const hero = this.state.selectedHero;
    const cost = 15;
    if (hero.coins < cost) {
      Sound.hit();
      this.showReward(
        'Need 15 Habit Tokens! 🧺',
        `You need 15 Tokens 🪙 to host a Group Treat Picnic! Complete a chore or brush teeth to earn more tokens!`,
        0,
        0,
        null,
        'shopping_basket'
      );
      return false;
    }

    hero.coins -= cost;
    Sound.picnicChime();
    Sound.snackMunch();

    const unlockedIds = hero.unlockedPetIds && hero.unlockedPetIds.length > 0
      ? hero.unlockedPetIds
      : [hero.activePetId || 1];

    unlockedIds.forEach(pId => {
      if (!this.state.petStatsMap[pId]) {
        this.state.petStatsMap[pId] = { hunger: 70, hygiene: 85, energy: 65, joy: 80 };
      }
      const s = this.state.petStatsMap[pId];
      s.hunger = Math.min(100, (s.hunger || 70) + 30);
      s.joy = Math.min(100, (s.joy || 80) + 25);
      s.energy = Math.min(100, (s.energy || 65) + 20);
      this.addEvolutionSparks(pId, 10);
    });

    this.addXP(25);
    confetti({
      particleCount: 80,
      spread: 90,
      origin: { y: 0.6 },
      colors: ['#2ecc71', '#f1c40f', '#e67e22', '#e74c3c', '#9b59b6']
    });

    this.logAction(
      `${hero.name} hosted a Sanctuary Group Treat Picnic!`,
      `All companions ate fresh fruit snacks: +30 Fullness, +25 Joy, +20 Energy & +10 Evolution Sparks!`
    );

    this.showReward(
      'Group Treat Picnic Time! 🧺🍎',
      `All ${unlockedIds.length} companion(s) gathered at the picnic clearing! Everyone gained +10 Evolution Sparks ⚡ and full bellies!`,
      0,
      25,
      null,
      'restaurant'
    );

    this.saveState(true);
    this.notify();
    return true;
  }

  feedSinglePet(petId) {
    const id = petId || this.state.selectedHero?.activePetId || 1;
    const hero = this.state.selectedHero;
    const cost = 5;

    if (hero.coins < cost) {
      Sound.hit();
      this.showReward(
        'Need 5 Habit Tokens! 🍎',
        `You need 5 Tokens 🪙 for a crunchy snack treat! Complete a chore to earn tokens!`,
        0,
        0,
        null,
        'nutrition'
      );
      return false;
    }

    hero.coins -= cost;
    if (!this.state.petStatsMap[id]) {
      this.state.petStatsMap[id] = { hunger: 70, hygiene: 85, energy: 65, joy: 80 };
    }
    const stats = this.state.petStatsMap[id];
    stats.hunger = Math.min(100, (stats.hunger || 70) + 25);
    stats.joy = Math.min(100, (stats.joy || 80) + 15);
    stats.energy = Math.min(100, (stats.energy || 65) + 10);
    this.addEvolutionSparks(id, 5);
    this.addXP(10);

    Sound.snackMunch();
    Sound.chirp();
    confetti({
      particleCount: 35,
      spread: 50,
      origin: { y: 0.7 }
    });

    const pet = this.state.pets.find(p => p.id === id) || PETS_DATABASE.find(p => p.id === id);
    this.logAction(
      `${hero.name} fed ${pet?.name || 'companion'} a snack`,
      `+25 Fullness, +15 Joy, +5 Evolution Sparks ⚡`
    );

    this.saveState(true);
    this.notify();
    return true;
  }

  petHugPet(petId) {
    const id = petId || this.state.selectedHero?.activePetId || 1;
    if (!this.state.petStatsMap[id]) {
      this.state.petStatsMap[id] = { hunger: 75, hygiene: 90, energy: 65, joy: 85 };
    }
    const stats = this.state.petStatsMap[id];
    stats.joy = Math.min(100, (stats.joy || 80) + 20);
    stats.energy = Math.min(100, (stats.energy || 65) + 10);
    this.addEvolutionSparks(id, 5);
    this.addXP(15);
    Sound.boing();
    Sound.chirp();
    this.saveState(true);
    this.notify();
  }

  setActiveCompanion(petId) {
    this.setActivePet(petId);
  }

  awardTaskCareSynergy(taskId, type = 'chore') {
    const activePet = this.getActivePet();
    if (!activePet || !activePet.id) return;
    const petId = activePet.id;
    const sparkAmount = type === 'ar_battle' ? 10 : 15;
    this.addEvolutionSparks(petId, sparkAmount);

    if (!this.state.petStatsMap[petId]) {
      this.state.petStatsMap[petId] = { hunger: 75, hygiene: 90, energy: 65, joy: 85 };
    }
    const stats = this.state.petStatsMap[petId];
    stats.joy = Math.min(100, (stats.joy || 80) + 5);
    stats.energy = Math.min(100, (stats.energy || 70) + 5);
    this.applyChoreTurboBoost(15, taskId);
    this.saveState(true);
  }

  evolvePetStage(petId) {
    const id = petId || this.state.selectedHero?.activePetId || 1;
    const currentStage = this.state.petStageMap[id] || 1;
    const hero = this.state.heroes.find(h => h.id === this.state.selectedHero.id) || this.state.selectedHero;
    const petData = this.state.pets.find(p => p.id === id) || PETS_DATABASE.find(p => p.id === id) || this.state.pets[0];

    if (currentStage < 4) {
      const nextStage = currentStage + 1;
      this.state.petStageMap[id] = nextStage;
      if (!hero.petStageMap) hero.petStageMap = {};
      hero.petStageMap[id] = nextStage;

      if (!this.state.petSparkMap) this.state.petSparkMap = {};
      this.state.petSparkMap[id] = 0;

      this.addXP(100);
      this.state.selectedHero.coins += 100;
      Sound.evolutionAscent();
      Sound.fanfare();

      const stageTitle = petData?.evolutionStages?.[nextStage - 1] || `Stage ${nextStage}`;
      this.logAction(
        `${hero.name}'s companion ${petData?.name || 'companion'} evolved to ${stageTitle}!`,
        `Advanced to Stage ${nextStage}! +100 Coins 🪙 & +100 XP awarded!`
      );

      this.saveState(true);

      const unlocked = hero.unlockedPetIds || [];
      const firstPetId = unlocked[0];

      if (id === firstPetId && nextStage >= 2 && unlocked.length === 1) {
        setTimeout(() => {
          this.openPetSelectionModal('second_pet');
        }, 1500);
      }

      if (unlocked.length === 2) {
        const p1 = unlocked[0];
        const p2 = unlocked[1];
        const s1 = hero.petStageMap[p1] || this.state.petStageMap[p1] || 1;
        const s2 = hero.petStageMap[p2] || this.state.petStageMap[p2] || 1;
        if (s1 >= 4 && s2 >= 4) {
          setTimeout(() => {
            this.openPetSelectionModal('third_pet');
          }, 1500);
        }
      }
      return nextStage;
    }
    return currentStage;
  }

  bathPetProgress(amount = 20, petId) {
    const id = petId || this.state.selectedHero.activePetId || 1;
    if (!this.state.petStatsMap[id]) this.state.petStatsMap[id] = { hunger: 75, hygiene: 60, energy: 65, joy: 85 };
    const stats = this.state.petStatsMap[id];
    stats.hygiene = Math.min(100, (stats.hygiene || 60) + amount);
    this.saveState(true);
  }

  completePetBathReward(petId) {
    const id = petId || this.state.selectedHero.activePetId || 1;
    if (!this.state.petStatsMap[id]) this.state.petStatsMap[id] = { hunger: 75, hygiene: 60, energy: 65, joy: 85 };
    const stats = this.state.petStatsMap[id];
    const activePet = this.getActivePet();

    stats.hygiene = 100;
    stats.joy = 100;
    this.state.selectedHero.coins += 25;
    this.addXP(35);
    Sound.sparkle();
    Sound.coin();
    Sound.fanfare();
    confetti({
      particleCount: 80,
      spread: 90,
      origin: { y: 0.6 },
      colors: ['#2ecc71', '#3498db', '#f1c40f', '#00d2d3']
    });

    this.logAction(
      `${this.state.selectedHero.name} washed and blow-dried ${activePet.name}`,
      `+25 Tokens 🪙 & +35 XP awarded! Pet is 100% clean and fluffy warm.`
    );

    this.showReward(
      'Sparkling Squeaky Clean & Fluffy!',
      `You fully washed and blow-dried ${activePet.name}!\n🪙 +25 Habit Tokens auto-added to your wallet!\n⭐ +35 Adventure XP!`,
      25,
      35,
      activePet.avatar || activePet.image,
      'bathtub'
    );
    this.saveState(true);
    this.notify();
  }

  openPetSelectionModal(type = 'starter') {
    this.state.petSelectionModal = { isOpen: true, type };
    this.notify();
  }

  closePetSelectionModal() {
    this.state.petSelectionModal = { isOpen: false, type: null };
    this.notify();
  }

  choosePet(petId, type = 'starter') {
    const hero = this.state.heroes.find(h => h.id === this.state.selectedHero.id) || this.state.selectedHero;
    if (!hero.unlockedPetIds) hero.unlockedPetIds = [];
    if (!hero.petStageMap) hero.petStageMap = {};

    if (!hero.unlockedPetIds.includes(petId)) {
      hero.unlockedPetIds.push(petId);
    }
    hero.petStageMap[petId] = 1; // Always Stage 1!
    hero.activePetId = petId;
    this.state.petStageMap[petId] = 1;

    if (type === 'starter') {
      hero.hasChosenStarterPet = true;
      hero.habitatSlots = Math.max(1, hero.habitatSlots || 1);
    } else if (type === 'second_pet') {
      hero.habitatSlots = Math.max(2, hero.habitatSlots || 2);
    } else if (type === 'third_pet') {
      hero.habitatSlots = Math.max(3, hero.habitatSlots || 3);
    }

    this.state.selectedHero.activePetId = petId;
    this.state.selectedHero.unlockedPetIds = [...hero.unlockedPetIds];
    this.state.selectedHero.hasChosenStarterPet = true;
    this.state.selectedHero.habitatSlots = hero.habitatSlots;

    this.closePetSelectionModal();

    const pet = this.state.pets.find(p => p.id === petId);
    this.saveState(true);

    // Mystery Surprise Unboxing: Pet arrives in a Glowing Mystic Egg!
    this.openMysterySurprise({
      type: 'egg',
      title: `${pet?.name || 'Companion'} Hatched!`,
      image: pet?.avatar,
      icon: 'egg',
      desc: `Welcome ${pet?.name || 'your pet'}! They start at Stage 1 (Mystic Hatchling). Complete habits and brush to evolve together!`,
      category: 'Pet Companion',
      coinsEarned: 50,
      xpEarned: 35
    });
  }

  buyHabitatSlot() {
    const hero = this.state.heroes.find(h => h.id === this.state.selectedHero.id) || this.state.selectedHero;
    const currentSlots = hero.habitatSlots || Math.max(1, hero.unlockedPetIds?.length || 1);
    const cost = 250;

    if (this.state.selectedHero.coins < cost) {
      alert(`You need ${cost} Habit Coins (🪙) to unlock a new Habitat Slot! Complete your daily habits and routines to earn more coins.`);
      return false;
    }

    this.state.selectedHero.coins -= cost;
    hero.coins = this.state.selectedHero.coins;
    hero.habitatSlots = currentSlots + 1;
    this.state.selectedHero.habitatSlots = hero.habitatSlots;

    Sound.fanfare();
    confetti({ particleCount: 90, spread: 80, origin: { y: 0.5 } });
    this.showReward(
      'Habitat Slot Unlocked! 🏠',
      `You unlocked Habitat Slot #${hero.habitatSlots}! You can now adopt an additional companion into your sanctuary!`,
      0,
      0,
      null,
      'holiday_village'
    );
    this.saveState(true);
    return true;
  }

  adoptPetIntoSlot(petId) {
    const hero = this.state.heroes.find(h => h.id === this.state.selectedHero.id) || this.state.selectedHero;
    if (!hero.unlockedPetIds) hero.unlockedPetIds = [];
    if (!hero.petStageMap) hero.petStageMap = {};

    const currentSlots = hero.habitatSlots || 1;
    if (hero.unlockedPetIds.includes(petId)) {
      this.setActivePet(petId);
      return;
    }

    if (hero.unlockedPetIds.length >= currentSlots) {
      if (confirm(`Your Habitat Slots are full (${hero.unlockedPetIds.length}/${currentSlots})! Would you like to unlock a new Habitat Slot for 250 Habit Coins (🪙)?`)) {
        if (this.buyHabitatSlot()) {
          this.adoptPetIntoSlot(petId);
        }
      }
      return;
    }

    hero.unlockedPetIds.push(petId);
    hero.petStageMap[petId] = 1; // Starts at Stage 1!
    this.state.petStageMap[petId] = 1;
    this.state.selectedHero.unlockedPetIds = [...hero.unlockedPetIds];

    const pet = this.state.pets.find(p => p.id === petId);
    Sound.fanfare();
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
    this.showReward(
      'New Companion Adopted! 🐾',
      `${pet?.name || 'Your new companion'} has moved into your Habitat at Stage 1!`,
      0,
      0,
      pet?.avatar,
      'pets'
    );
    this.setActivePet(petId);
    this.saveState(true);
  }

  evolvePet(petId) {
    const id = petId || this.state.selectedHero.activePetId || 1;
    const currentStage = this.state.petStageMap[id] || 1;
    const activePet = this.getActivePet();
    const hero = this.state.heroes.find(h => h.id === this.state.selectedHero.id) || this.state.selectedHero;

    if (currentStage < 4) {
      const nextStage = currentStage + 1;
      this.state.petStageMap[id] = nextStage;
      if (!hero.petStageMap) hero.petStageMap = {};
      hero.petStageMap[id] = nextStage;
      if (!this.state.petSparkMap) this.state.petSparkMap = {};
      this.state.petSparkMap[id] = 0;

      this.addXP(100);
      this.state.selectedHero.coins += 100;
      Sound.levelUp();
      Sound.fanfare();
      confetti({
        particleCount: 150,
        spread: 120,
        origin: { y: 0.4 },
        colors: ['#2ecc71', '#ffb961', '#f1c40f', '#00d67d']
      });
      this.showReward(
        'BIG EVOLUTION!',
        `Your companion advanced to Stage ${nextStage}! New Golden Armor and Powers Unlocked!`,
        100,
        100,
        activePet.evolvedAvatar || activePet.avatar,
        'military_tech'
      );
      this.saveState(true);

      // Check milestones for 2nd and 3rd free pet choices:
      const unlocked = hero.unlockedPetIds || [];
      const firstPetId = unlocked[0];

      // Milestone 1: First pet evolves to Stage 2 -> unlocks 2nd free pet!
      if (id === firstPetId && nextStage >= 2 && unlocked.length === 1) {
        setTimeout(() => {
          this.openPetSelectionModal('second_pet');
        }, 1200);
      }

      // Milestone 2: First 2 pets both reach Stage 4 -> unlocks 3rd free pet!
      if (unlocked.length === 2) {
        const p1 = unlocked[0];
        const p2 = unlocked[1];
        const s1 = hero.petStageMap[p1] || this.state.petStageMap[p1] || 1;
        const s2 = hero.petStageMap[p2] || this.state.petStageMap[p2] || 1;
        if (s1 >= 4 && s2 >= 4) {
          setTimeout(() => {
            this.openPetSelectionModal('third_pet');
          }, 1200);
        }
      }
    }
  }


  redeemRealLifeReward(rewardId) {
    const reward = this.state.realLifeRewards.find(r => r.id === rewardId);
    if (!reward) return;

    if (this.state.selectedHero.points < reward.costPoints) {
      Sound.hit();
      this.showReward(
        'Need More Gold Points!',
        `You have ${this.state.selectedHero.points} Points. Complete more Task Forest chores and have a parent verify them to earn ${reward.costPoints} Points!`,
        0,
        0,
        reward.image,
        reward.icon
      );
      return;
    }

    const newApproval = {
      id: 'req_' + Date.now(),
      kidId: this.state.selectedHero.id,
      kidName: this.state.selectedHero.name,
      type: 'reward',
      rewardId: reward.id,
      title: reward.title,
      costPoints: reward.costPoints,
      date: 'Just now',
      status: 'pending'
    };

    this.state.pendingApprovals.push(newApproval);
    Sound.coin();
    this.logAction(`${this.state.selectedHero.name} requested reward '${reward.title}'`, `Cost: ${reward.costPoints} Points ⭐ (Awaiting Parent Sign-off)`);
    this.showReward(
      'Request Sent to Parent!',
      `Your request for "${reward.title}" was submitted to the Parent Admin Inbox for sign-off!`,
      0,
      0,
      reward.image,
      reward.icon
    );
    this.saveState(true);
  }

  buyDigitalGear(gearId) {
    const item = this.state.digitalGear.find((i) => i.id === gearId);
    if (!item) return;

    if (this.state.inventory.includes(item.title)) {
      this.state.equippedPetGear = item.title;
      Sound.sparkle();
      Sound.fanfare();
      confetti({ particleCount: 40, spread: 50 });
      this.showReward(
        'Gear Equipped!',
        `Your avatar and pet companion are now equipped with ${item.title}!`,
        0,
        0,
        item.image
      );
      this.saveState(true);
      return;
    }

    if (this.state.selectedHero.coins < item.costCoins) {
      Sound.deny();
      this.showReward(
        'Not Enough Habit Tokens!',
        `You need ${item.costCoins - this.state.selectedHero.coins} more Habit Tokens. Complete chores and play mini-games to earn more tokens!`,
        0,
        0,
        item.image
      );
      return;
    }

    this.state.selectedHero.coins -= item.costCoins;
    this.state.inventory.push(item.title);
    this.state.equippedPetGear = item.title;

    // Equip wearable pet studio gear & speak companion reaction line
    if (item.socket || item.isParentCrafted) {
      const activePetId = this.getActivePet()?.id || this.state.selectedHero?.activePetId || 1;
      const targetSocket = item.socket || 'head';
      this.equipPetStudioGear(activePetId, targetSocket, item.id);
      if (PET_GEAR_CATALOG[targetSocket]) {
        const catItem = PET_GEAR_CATALOG[targetSocket].find(g => g.id === item.id);
        if (catItem) catItem.unlocked = true;
      }
      if (item.petVoiceLine) {
        try {
          speakCompanion(item.petVoiceLine, activePetId);
        } catch (e) {
          console.warn("Companion voice line playback failed:", e);
        }
      }
    }

    this.addXP(25);
    Sound.coin();
    this.logAction(`${this.state.selectedHero.name} bought ${item.title}`, `Cost: ${item.costCoins} Tokens 🪙`);
    this.saveState(true);

    // Mystery Surprise Unboxing Mechanics:
    // Pets arrive in a Glowing Egg; all other digital content arrives in a Glowing Treasure Chest!
    const isPet = item.id.includes('rex') || item.id.includes('pet') || (item.category && item.category.toLowerCase().includes('companion'));
    this.openMysterySurprise({
      type: isPet ? 'egg' : 'chest',
      title: item.title,
      image: item.image,
      icon: item.icon,
      desc: item.desc,
      category: item.category,
      statBonusPercent: item.statBonusPercent,
      statBonusType: item.statBonusType,
      xpEarned: 25
    });
  }

  approveParentRequest(reqId) {
    const reqIndex = this.state.pendingApprovals.findIndex(r => r.id === reqId);
    if (reqIndex === -1) return;
    const req = this.state.pendingApprovals[reqIndex];

    const hero = this.state.heroes.find(h => h.id === req.kidId) || this.state.selectedHero;

    if (req.type === 'task_point_approval' || req.type === 'task') {
      const pointsToAward = req.pendingPoints || req.rewardPoints || 10;
      hero.points += pointsToAward;

      // Screen Time & Privileges Bank conversion: points convert to screen time minutes!
      const rate = hero.screenTimeRate !== undefined ? hero.screenTimeRate : 2;
      const earnedMinutes = pointsToAward * rate;
      hero.screenTimeMinutes = (hero.screenTimeMinutes || 0) + earnedMinutes;

      if (this.state.selectedHero.id === hero.id) {
        this.state.selectedHero.points = hero.points;
        this.state.selectedHero.screenTimeMinutes = hero.screenTimeMinutes;
      }

      // 1. Update the structured completion log record
      const nowIso = new Date().toISOString();
      if (this.state.taskCompletionLogs) {
        const logEntry = this.state.taskCompletionLogs.find(l => 
          (req.logId && l.id === req.logId) || 
          (l.approvalRequestId === req.id) ||
          (l.taskId === req.taskId && l.heroId === req.kidId && l.status === 'pending')
        );
        if (logEntry) {
          logEntry.status = 'approved';
          logEntry.approvedAt = nowIso;
        }
      }

      // 2. Release routine definition so kid is NOT locked out for subsequent cycles/times/days!
      let taskItem = null;
      if (req.taskId) {
        const habit = this.state.habitIslands.find(h => h.id === req.taskId);
        if (habit) {
          habit.completed = false;
          habit.pointsApproved = false;
          taskItem = habit;
        }
        const task = this.state.taskForest.find(t => t.id === req.taskId);
        if (task) {
          task.completed = false;
          task.pointsApproved = false;
          taskItem = task;
        }

        // Also release on all heroes copies
        if (this.state.heroes) {
          this.state.heroes.forEach((h) => {
            if (h.habitIslands) {
              const hh = h.habitIslands.find(x => x.id === req.taskId);
              if (hh) { hh.completed = false; hh.pointsApproved = false; }
            }
            if (h.taskForest) {
              const tt = h.taskForest.find(x => x.id === req.taskId);
              if (tt) { tt.completed = false; tt.pointsApproved = false; }
            }
          });
        }
        if (this.state.selectedHero) {
          if (this.state.selectedHero.habitIslands) {
            const hh = this.state.selectedHero.habitIslands.find(x => x.id === req.taskId);
            if (hh) { hh.completed = false; hh.pointsApproved = false; }
          }
          if (this.state.selectedHero.taskForest) {
            const tt = this.state.selectedHero.taskForest.find(x => x.id === req.taskId);
            if (tt) { tt.completed = false; tt.pointsApproved = false; }
          }
        }
      }

      this.logAction(
        `Parent verified '${req.title}' for ${req.kidName}`,
        `+${pointsToAward} Points ⭐ & +${earnedMinutes}m Screen Time Credited to Bank`
      );
      this.showReward(
        'Points & Screen Time Approved!',
        `+${pointsToAward} Gold Points ⭐ & +${earnedMinutes}m Screen Time ⏱️ credited to ${req.kidName}'s bank!`,
        0,
        0,
        taskItem?.image || null,
        'stars'
      );
    } else if (req.type === 'reward') {
      hero.points = Math.max(0, hero.points - req.costPoints);
      if (this.state.selectedHero.id === hero.id) {
        this.state.selectedHero.points = hero.points;
      }
      const rewardItem = this.state.realLifeRewards.find(r => r.id === req.rewardId);
      this.logAction(`Parent fulfilled reward '${req.title}' for ${req.kidName}`, `-${req.costPoints} Points ⭐ Deducted`);
      this.showReward(
        'Reward Approved!',
        `"${req.title}" has been signed off! Have fun enjoying your reward!`,
        0,
        0,
        rewardItem?.image || null,
        'card_giftcard'
      );
    }

    this.state.pendingApprovals.splice(reqIndex, 1);
    Sound.fanfare();
    this.saveState(true);
  }

  rejectParentRequest(reqId) {
    const reqIndex = this.state.pendingApprovals.findIndex(r => r.id === reqId);
    if (reqIndex === -1) return;
    const req = this.state.pendingApprovals[reqIndex];

    if (req.type === 'task_point_approval' || req.type === 'task') {
      const nowIso = new Date().toISOString();
      if (this.state.taskCompletionLogs) {
        const logEntry = this.state.taskCompletionLogs.find(l => 
          (req.logId && l.id === req.logId) || 
          (l.approvalRequestId === req.id) ||
          (l.taskId === req.taskId && l.heroId === req.kidId && l.status === 'pending')
        );
        if (logEntry) {
          logEntry.status = 'rejected';
          logEntry.rejectedAt = nowIso;
        }
      }

      if (req.taskId) {
        const habit = this.state.habitIslands.find(h => h.id === req.taskId);
        if (habit) {
          habit.completed = false;
          habit.pointsApproved = false;
        }
        const task = this.state.taskForest.find(t => t.id === req.taskId);
        if (task) {
          task.completed = false;
          task.pointsApproved = false;
        }
        if (this.state.heroes) {
          this.state.heroes.forEach((h) => {
            if (h.habitIslands) {
              const hh = h.habitIslands.find(x => x.id === req.taskId);
              if (hh) { hh.completed = false; hh.pointsApproved = false; }
            }
            if (h.taskForest) {
              const tt = h.taskForest.find(x => x.id === req.taskId);
              if (tt) { tt.completed = false; tt.pointsApproved = false; }
            }
          });
        }
        if (this.state.selectedHero) {
          if (this.state.selectedHero.habitIslands) {
            const hh = this.state.selectedHero.habitIslands.find(x => x.id === req.taskId);
            if (hh) { hh.completed = false; hh.pointsApproved = false; }
          }
          if (this.state.selectedHero.taskForest) {
            const tt = this.state.selectedHero.taskForest.find(x => x.id === req.taskId);
            if (tt) { tt.completed = false; tt.pointsApproved = false; }
          }
        }
      }
      this.logAction(`Parent rejected Point Approval for '${req.title}' (${req.kidName})`, `0 Points ⭐ Issued`);
      this.showReward(
        'Request Rejected',
        `Point approval for "${req.title}" was declined. Button reset to ready.`,
        0,
        0,
        null,
        'cancel'
      );
    } else if (req.type === 'reward') {
      this.logAction(`Parent declined reward '${req.title}' for ${req.kidName}`, `0 Points Deducted`);
      this.showReward(
        'Reward Declined',
        `The request for "${req.title}" was declined by parent.`,
        0,
        0,
        null,
        'cancel'
      );
    }

    this.state.pendingApprovals.splice(reqIndex, 1);
    Sound.click();
    this.saveState(true);
  }

  // Clear all pending parent approval notifications and reset buttons across all tasks & habits
  clearAllPendingApprovals() {
    // 1. Clear state.pendingApprovals
    this.state.pendingApprovals = [];

    // Mark pending logs as cleared
    const nowIso = new Date().toISOString();
    if (this.state.taskCompletionLogs) {
      this.state.taskCompletionLogs.forEach(l => {
        if (l.status === 'pending') {
          l.status = 'rejected';
          l.rejectedAt = nowIso;
        }
      });
    }

    // 2. Reset all habit islands to uncompleted / not pending
    if (this.state.habitIslands) {
      this.state.habitIslands.forEach((h) => {
        h.completed = false;
        h.pointsApproved = false;
      });
    }

    // 3. Reset all task forest chores to uncompleted / not pending
    if (this.state.taskForest) {
      this.state.taskForest.forEach((t) => {
        t.completed = false;
        t.pointsApproved = false;
      });
    }

    // 4. Also reset on all heroes in this.state.heroes and selectedHero
    if (this.state.heroes) {
      this.state.heroes.forEach((hero) => {
        if (hero.habitIslands) {
          hero.habitIslands.forEach((h) => {
            h.completed = false;
            h.pointsApproved = false;
          });
        }
        if (hero.taskForest) {
          hero.taskForest.forEach((t) => {
            t.completed = false;
            t.pointsApproved = false;
          });
        }
      });
    }
    if (this.state.selectedHero) {
      if (this.state.selectedHero.habitIslands) {
        this.state.selectedHero.habitIslands.forEach((h) => {
          h.completed = false;
          h.pointsApproved = false;
        });
      }
      if (this.state.selectedHero.taskForest) {
        this.state.selectedHero.taskForest.forEach((t) => {
          t.completed = false;
          t.pointsApproved = false;
        });
      }
    }

    this.logAction('Parent Cleared All Pending Approvals', 'All pending approval notifications and button states were reset to ready.');
    this.saveState(true);
    Sound.fanfare();
    this.showReward(
      'Pending Notifications Cleared!',
      'All pending parent approval notifications on buttons have been cleared and reset to ready across all tasks & habits.',
      0,
      0,
      null,
      'cleaning_services'
    );
    this.notify();
  }

  // Approve all pending requests in queue
  approveAllPendingRequests() {
    if (!this.state.pendingApprovals || this.state.pendingApprovals.length === 0) return;
    const reqs = [...this.state.pendingApprovals];
    reqs.forEach((req) => {
      this.approveParentRequest(req.id);
    });
    this.saveState(true);
    this.notify();
  }

  // SCREEN TIME & PRIVILEGES BANK METHODS
  grantScreenTimeBonus(heroId, minutes = 15) {
    const hero = this.state.heroes.find(h => h.id === heroId) || this.state.selectedHero;
    if (!hero) return;
    hero.screenTimeMinutes = (hero.screenTimeMinutes || 0) + minutes;
    if (this.state.selectedHero.id === hero.id) {
      this.state.selectedHero.screenTimeMinutes = hero.screenTimeMinutes;
    }
    this.logAction(`Parent granted +${minutes}m screen time bonus for ${hero.name}`, `New balance: ${hero.screenTimeMinutes} minutes`);
    Sound.coin();
    this.saveState(true);
    this.notify();
  }

  deductScreenTime(heroId, minutes = 15) {
    const hero = this.state.heroes.find(h => h.id === heroId) || this.state.selectedHero;
    if (!hero) return;
    hero.screenTimeMinutes = Math.max(0, (hero.screenTimeMinutes || 0) - minutes);
    if (this.state.selectedHero.id === hero.id) {
      this.state.selectedHero.screenTimeMinutes = hero.screenTimeMinutes;
    }
    this.logAction(`Parent deducted ${minutes}m screen time for ${hero.name}`, `New balance: ${hero.screenTimeMinutes} minutes`);
    Sound.click();
    this.saveState(true);
    this.notify();
  }

  toggleScreenTimePause(heroId) {
    const hero = this.state.heroes.find(h => h.id === heroId) || this.state.selectedHero;
    if (!hero) return;
    hero.isScreenTimePaused = !hero.isScreenTimePaused;
    if (this.state.selectedHero.id === hero.id) {
      this.state.selectedHero.isScreenTimePaused = hero.isScreenTimePaused;
    }
    const status = hero.isScreenTimePaused ? 'PAUSED / LOCKED' : 'RESUMED';
    this.logAction(`Parent ${status} screen time for ${hero.name}`, `Active lock status: ${hero.isScreenTimePaused}`);
    Sound.click();
    this.saveState(true);
    this.notify();
  }

  updateScreenTimeSettings(heroId, { dailyMaxScreenTime, bedtimeCurfew, screenTimeRate, screenTimeLockMessage }) {
    const targets = heroId === 'all' 
      ? this.state.heroes 
      : [this.state.heroes.find(h => h.id === heroId) || this.state.selectedHero];

    targets.forEach(h => {
      if (!h) return;
      if (dailyMaxScreenTime !== undefined) h.dailyMaxScreenTime = Number(dailyMaxScreenTime);
      if (bedtimeCurfew !== undefined) h.bedtimeCurfew = bedtimeCurfew;
      if (screenTimeRate !== undefined) h.screenTimeRate = Number(screenTimeRate);
      if (screenTimeLockMessage !== undefined) h.screenTimeLockMessage = screenTimeLockMessage;
      if (this.state.selectedHero.id === h.id) {
        Object.assign(this.state.selectedHero, {
          dailyMaxScreenTime: h.dailyMaxScreenTime,
          bedtimeCurfew: h.bedtimeCurfew,
          screenTimeRate: h.screenTimeRate,
          screenTimeLockMessage: h.screenTimeLockMessage
        });
      }
    });

    this.logAction('Parent updated Screen Time governance rules', `Rate: ${screenTimeRate || 2}m/pt, Curfew: ${bedtimeCurfew || '20:00'}`);
    this.saveState(true);
    this.notify();
  }

  getGameMastery(gameId) {
    if (!this.state.gameMasteryMap) {
      this.state.gameMasteryMap = {};
    }
    return {
      stars: 0,
      completedCount: 0,
      highScore: 0,
      ...(this.state.gameMasteryMap[gameId] || {})
    };
  }

  setGameDifficulty(difficulty) {
    if (!['easy', 'medium', 'hard'].includes(difficulty)) return;
    if (this.state.selectedHero) {
      this.state.selectedHero.gameDifficulty = difficulty;
    }
    if (this.state.heroes) {
      const hero = this.state.heroes.find(h => h.id === this.state.selectedHero?.id);
      if (hero) hero.gameDifficulty = difficulty;
    }
    Sound.click();
    this.saveState(true);
    this.notify();
  }

  completeAdventureGame(gameId, score = 3, maxScore = 3) {
    const game = ADVENTURE_GAMES.find(g => g.id === gameId);
    if (!game) return { stars: 1, coins: 25, xp: 30, sparks: 10 };

    const currentHero = this.state.selectedHero;
    const activePet = this.getActivePet();
    const petId = activePet.id || 1;

    // Calculate stars earned (1 to 3)
    let starsEarned = 1;
    if (score >= maxScore) {
      starsEarned = 3;
    } else if (score >= Math.ceil(maxScore * 0.6)) {
      starsEarned = 2;
    }

    if (!this.state.gameMasteryMap) {
      this.state.gameMasteryMap = {};
    }
    const prevMastery = this.state.gameMasteryMap[gameId] || { stars: 0, completedCount: 0, highScore: 0 };
    const newStars = Math.max(prevMastery.stars || 0, starsEarned);
    this.state.gameMasteryMap[gameId] = {
      stars: newStars,
      completedCount: (prevMastery.completedCount || 0) + 1,
      highScore: Math.max(prevMastery.highScore || 0, score),
      lastPlayed: new Date().toISOString()
    };

    // Calculate rewards
    const baseCoins = game.rewardCoins || 25;
    const bonusCoins = starsEarned === 3 ? 15 : starsEarned === 2 ? 10 : 5;
    const totalCoins = baseCoins + bonusCoins;
    const totalXP = (game.rewardXP || 30) + (starsEarned * 10);
    const sparksEarned = 10;

    // Auto-issue coins & XP
    currentHero.coins = (currentHero.coins || 0) + totalCoins;
    this.addXP(totalXP);

    // Grant +10 Evolution Sparks to companion
    this.addEvolutionSparks(petId, sparksEarned);

    // Boost Joy and Energy of active companion
    if (!this.state.petStatsMap[petId]) {
      this.state.petStatsMap[petId] = { hunger: 75, hygiene: 90, energy: 65, joy: 85 };
    }
    const pStats = this.state.petStatsMap[petId];
    pStats.joy = Math.min(100, (pStats.joy || 80) + 15);
    pStats.energy = Math.min(100, (pStats.energy || 70) + 10);

    // Log to taskCompletionLogs for Parent Portal Pillar 2 (Cognitive & Motor Milestones) sync
    const nowIso = new Date().toISOString();
    const completionLog = {
      id: 'adv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      taskId: gameId,
      taskTitle: game.title,
      zone: 'Adventure Learning Games',
      subject: game.subject,
      realm: game.realm || game.title,
      starsEarned: starsEarned,
      score: score,
      maxScore: maxScore,
      heroId: currentHero.id,
      heroName: currentHero.name,
      completedAt: nowIso,
      timestamp: Date.now(),
      dateString: new Date().toLocaleDateString(),
      timeString: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      coinsAwarded: totalCoins,
      pointsAwarded: starsEarned * 5,
      xpAwarded: totalXP,
      status: 'approved',
      approvedAt: nowIso
    };

    if (!this.state.taskCompletionLogs) {
      this.state.taskCompletionLogs = [];
    }
    this.state.taskCompletionLogs.unshift(completionLog);
    if (this.state.taskCompletionLogs.length > 200) {
      this.state.taskCompletionLogs.pop();
    }

    this.logAction(
      `${currentHero.name} mastered ${game.realm || game.title} (${starsEarned}⭐)`,
      `+${totalCoins} Tokens 🪙, +${totalXP} XP, +${sparksEarned} Evolution Sparks ⚡ for ${activePet.name}`
    );

    Sound.fanfare();
    confetti({
      particleCount: 100,
      spread: 90,
      origin: { y: 0.5 },
      colors: ['#f1c40f', '#2ecc71', '#3498db', '#e67e22', '#9b59b6']
    });

    this.saveState(true);
    this.notify();

    return {
      stars: starsEarned,
      coins: totalCoins,
      xp: totalXP,
      sparks: sparksEarned
    };
  }

  completeMovementRoutine(routineId, durationMinutes = 2, posesCompleted = 4, feverBursts = 1) {
    const routine = getMovementRoutine(routineId);
    const currentHero = this.state.selectedHero;
    const activePet = this.getActivePet();
    const petId = activePet.id || 1;

    const coinsEarned = routine.rewardCoins || 40;
    const xpEarned = routine.rewardXP || 60;
    const sparksEarned = (routine.rewardSparks || 10) + (feverBursts > 1 ? 5 : 0);

    // 1. Rewards to Hero
    currentHero.coins = (currentHero.coins || 0) + coinsEarned;
    this.addXP(xpEarned);

    // 2. Active Pet Evolution Sparks & Vitality Boosts
    this.addEvolutionSparks(petId, sparksEarned);
    if (!this.state.petStatsMap[petId]) {
      this.state.petStatsMap[petId] = { hunger: 75, hygiene: 90, energy: 65, joy: 85 };
    }
    const pStats = this.state.petStatsMap[petId];
    pStats.joy = Math.min(100, (pStats.joy || 80) + 25);
    pStats.energy = Math.min(100, (pStats.energy || 70) + 20);

    // 3. Movement Session History
    if (!this.state.movementSessionHistory) {
      this.state.movementSessionHistory = [];
    }
    const sessionRecord = {
      id: 'move_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      routineId: routine.id,
      title: routine.title,
      category: routine.category,
      badge: routine.badge,
      durationMinutes: durationMinutes,
      posesCompleted: posesCompleted,
      feverBursts: feverBursts,
      pediatricMarker: routine.pediatricMarker,
      timestamp: Date.now(),
      dateIso: new Date().toISOString(),
      dateString: new Date().toLocaleDateString(),
      timeString: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    this.state.movementSessionHistory.unshift(sessionRecord);
    if (this.state.movementSessionHistory.length > 100) {
      this.state.movementSessionHistory.pop();
    }

    // 4. Audit Log for Parent Portal Pillar 2 (Cognitive & Motor Milestones) & Pillar 4
    const nowIso = new Date().toISOString();
    const completionLog = {
      id: 'move_log_' + Date.now(),
      taskId: routine.id,
      taskTitle: routine.title,
      zone: 'Gross Motor & Dance Party',
      category: 'gross_motor',
      pediatricMarker: routine.pediatricMarker,
      durationMinutes: durationMinutes,
      posesCompleted: posesCompleted,
      feverBursts: feverBursts,
      heroId: currentHero.id,
      heroName: currentHero.name,
      completedAt: nowIso,
      timestamp: Date.now(),
      dateString: new Date().toLocaleDateString(),
      timeString: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      coinsAwarded: coinsEarned,
      pointsAwarded: 10,
      xpAwarded: xpEarned,
      sparksAwarded: sparksEarned,
      status: 'approved',
      approvedAt: nowIso
    };

    if (!this.state.taskCompletionLogs) {
      this.state.taskCompletionLogs = [];
    }
    this.state.taskCompletionLogs.unshift(completionLog);
    if (this.state.taskCompletionLogs.length > 200) {
      this.state.taskCompletionLogs.pop();
    }

    this.applyChoreTurboBoost(15, 'Movement Routine: ' + routine.title);
    this.logAction(
      `${currentHero.name} rocked ${routine.title}! 🕺💃`,
      `+${coinsEarned} Tokens 🪙, +${xpEarned} XP, +${sparksEarned} Sparks ⚡ for ${activePet.name} (${durationMinutes} mins active)`
    );

    Sound.fanfare();
    confetti({
      particleCount: 120,
      spread: 100,
      origin: { y: 0.5 },
      colors: ['#f39c12', '#e74c3c', '#9b59b6', '#2ecc71', '#00bcd4']
    });

    this.saveState(true);
    this.notify();

    return {
      coins: coinsEarned,
      xp: xpEarned,
      sparks: sparksEarned,
      durationMinutes: durationMinutes,
      routine: routine
    };
  }

  getMovementStats() {
    const history = this.state.movementSessionHistory || [];
    const totalMinutes = history.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
    const morningCount = history.filter(s => s.routineId === 'morning_wake_up').length;
    const afternoonCount = history.filter(s => s.routineId === 'afternoon_wiggle').length;
    const bedtimeCount = history.filter(s => s.routineId === 'bedtime_wind_down').length;
    const freestyleCount = history.filter(s => s.routineId === 'freestyle_disco').length;
    const feverBurstsTotal = history.reduce((acc, s) => acc + (s.feverBursts || 0), 0);

    return {
      totalSessions: history.length,
      totalMinutes,
      morningCount,
      afternoonCount,
      bedtimeCount,
      freestyleCount,
      feverBurstsTotal,
      recentSessions: history.slice(0, 10)
    };
  }

  playAdventureGame(gameId, isWin) {
    const game = ADVENTURE_GAMES.find(g => g.id === gameId);
    if (!game) return;

    const activePet = this.getActivePet();
    if (activePet.energy < game.energyCost) {
      this.showReward(
        'Pet Needs Energy!',
        'Feed snacks or let your pet rest to restore energy before playing!',
        0,
        0,
        activePet.avatar,
        'battery_low'
      );
      return;
    }

    const id = this.state.selectedHero.activePetId || 1;
    if (this.state.petStatsMap[id]) {
      this.state.petStatsMap[id].energy = Math.max(0, (this.state.petStatsMap[id].energy || 50) - game.energyCost);
    }

    if (isWin) {
      this.completeAdventureGame(gameId, 3, 3);
    }
  }

  switchHero(heroId) {
    // 1. Sync outgoing selectedHero state back into heroes array first
    this.syncSelectedHeroWithHeroes();

    const hero = this.state.heroes.find((h) => h.id === heroId);
    if (hero) {
      if (!hero.unlockedPetIds) {
        hero.unlockedPetIds = hero.activePetId ? [hero.activePetId] : [];
      }
      if (hero.hasChosenStarterPet === undefined) {
        hero.hasChosenStarterPet = hero.unlockedPetIds.length > 0;
      }
      if (!hero.habitatSlots) {
        hero.habitatSlots = Math.max(1, hero.unlockedPetIds.length);
      }
      if (!hero.petStageMap) {
        hero.petStageMap = {};
        hero.unlockedPetIds.forEach((pId) => {
          hero.petStageMap[pId] = 1; // Stage 1!
        });
      }

      this.state.selectedHero.id = hero.id;
      this.state.selectedHero.name = hero.name;
      this.state.selectedHero.title = hero.role;
      this.state.selectedHero.avatar = hero.avatar;
      this.state.selectedHero.level = hero.level || 1;
      this.state.selectedHero.points = hero.points || 0;
      this.state.selectedHero.coins = hero.coins || 0;
      this.state.selectedHero.xp = hero.xp || 0;
      this.state.selectedHero.xpNext = hero.xpNext || 100;
      this.state.selectedHero.activePetId = hero.activePetId || (hero.unlockedPetIds[0] || null);
      this.state.selectedHero.unlockedPetIds = [...hero.unlockedPetIds];
      this.state.selectedHero.hasChosenStarterPet = hero.hasChosenStarterPet;
      this.state.selectedHero.habitatSlots = hero.habitatSlots;
      this.state.selectedHero.streak = hero.streak || 1;
      this.state.selectedHero.gameDifficulty = hero.gameDifficulty || 'medium';
      this.state.selectedHero.equippedProfileTheme = hero.equippedProfileTheme || 'theme_dragon_emerald';
      this.state.selectedHero.unlockedThemes = hero.unlockedThemes || ['theme_dragon_emerald'];

      // Synchronize global petStageMap with this hero's petStageMap
      this.state.petStageMap = { ...hero.petStageMap };

      Sound.fanfare();
      this.saveState(true);
    }
  }

  // Add a new Kid Profile
  addHero({ name, role = 'Adventurer', avatar, gameDifficulty = 'medium', level = 1, coins = 0, points = 0 }) {
    if (!name || !name.trim()) return;
    const newHero = {
      id: 'hero_' + Date.now(),
      name: name.trim(),
      role: role.trim() || 'Adventurer',
      avatar: avatar || KID_AVATARS[0].url,
      level: Number(level) || 1,
      points: Number(points) || 0,
      coins: Number(coins) || 0,
      tokens: Number(coins) || 0,
      activePetId: null,
      unlockedPetIds: [],
      hasChosenStarterPet: false,
      habitatSlots: 1,
      petStageMap: {},
      streak: 1,
      completionRate: 100,
      gameDifficulty: gameDifficulty || 'medium',
      equippedProfileTheme: 'theme_dragon_emerald',
      unlockedThemes: ['theme_dragon_emerald'],
      equippedGear: {},
      inventory: []
    };
    if (this.state.deletedHeroIds) {
      this.state.deletedHeroIds = this.state.deletedHeroIds.filter((id) => id !== newHero.id);
    }
    this.state.heroes.push(newHero);
    this.switchHero(newHero.id);
    return newHero;
  }

  // Edit an existing Kid Profile
  editHero(heroId, updatedData) {
    const hero = this.state.heroes.find((h) => h.id === heroId);
    if (!hero) return;
    if (updatedData.name !== undefined) hero.name = updatedData.name.trim() || hero.name;
    if (updatedData.role !== undefined) hero.role = updatedData.role.trim() || hero.role;
    if (updatedData.avatar !== undefined) hero.avatar = updatedData.avatar;
    if (updatedData.gameDifficulty !== undefined) hero.gameDifficulty = updatedData.gameDifficulty;
    if (updatedData.level !== undefined) hero.level = Math.max(1, Number(updatedData.level));
    if (updatedData.coins !== undefined) {
      hero.coins = Math.max(0, Number(updatedData.coins));
      hero.tokens = hero.coins;
    }
    if (updatedData.points !== undefined) hero.points = Math.max(0, Number(updatedData.points));

    // If currently active hero was edited, synchronize selectedHero
    if (this.state.selectedHero.id === heroId) {
      this.state.selectedHero.name = hero.name;
      this.state.selectedHero.title = hero.role;
      this.state.selectedHero.avatar = hero.avatar;
      this.state.selectedHero.gameDifficulty = hero.gameDifficulty;
      this.state.selectedHero.level = hero.level;
      this.state.selectedHero.coins = hero.coins;
      this.state.selectedHero.tokens = hero.coins;
      this.state.selectedHero.points = hero.points;
    }

    this.saveState(true);
    Sound.fanfare();
  }

  // Delete a Kid Profile
  deleteHero(heroId) {
    if (!this.state.deletedHeroIds) this.state.deletedHeroIds = [];
    if (!this.state.deletedHeroIds.includes(heroId)) {
      this.state.deletedHeroIds.push(heroId);
    }
    if (this.state.pendingApprovals) {
      this.state.pendingApprovals = this.state.pendingApprovals.filter((p) => p.kidId !== heroId);
    }
    this.state.heroes = this.state.heroes.filter((h) => h.id !== heroId);
    if (this.state.heroes.length === 0) {
      // Ensure there's always at least 1 hero
      const freshHero = {
        id: 'hero_' + Date.now(),
        name: 'Little Hero',
        role: 'Brave Adventurer',
        avatar: KID_AVATARS[0].url,
        level: 1,
        points: 0,
        coins: 0,
        tokens: 0,
        activePetId: null,
        unlockedPetIds: [],
        hasChosenStarterPet: false,
        habitatSlots: 1,
        petStageMap: {},
        streak: 1,
        completionRate: 100,
        gameDifficulty: 'medium',
        equippedProfileTheme: 'theme_dragon_emerald',
        unlockedThemes: ['theme_dragon_emerald'],
        equippedGear: {},
        inventory: []
      };
      this.state.heroes.push(freshHero);
      this.switchHero(freshHero.id);
    } else if (this.state.selectedHero.id === heroId) {
      // Switch active hero to the first remaining kid
      this.switchHero(this.state.heroes[0].id);
    } else {
      this.saveState(true);
    }
    Sound.hit();
  }

  // Create a brand new household
  createNewHousehold(familyName = 'The Hero Family') {
    const newSyncCode = 'HERO-' + Math.floor(1000 + Math.random() * 9000);
    this.state.household = {
      syncCode: newSyncCode,
      name: familyName.trim() || 'The Hero Family',
      linkedDevices: 1,
      lastSync: 'Created Just Now'
    };
    this.state.pendingApprovals = [];
    this.saveState(true);
    Sound.fanfare();

    // Connect to new Firestore household document
    if (this.syncService) {
      this.syncService.startSync(newSyncCode);
    }

    return newSyncCode;
  }

  // Remove test kids and reset to clean state
  removeTestKids() {
    const cleanHero = {
      id: 'hero_' + Date.now(),
      name: 'Little Hero',
      role: 'Brave Adventurer',
      avatar: KID_AVATARS[0].url,
      level: 1,
      points: 0,
      coins: 0,
      activePetId: null,
      unlockedPetIds: [],
      hasChosenStarterPet: false,
      habitatSlots: 1,
      petStageMap: {},
      streak: 1,
      completionRate: 100,
      gameDifficulty: 'medium',
      equippedProfileTheme: 'theme_dragon_emerald',
      unlockedThemes: ['theme_dragon_emerald']
    };
    this.state.heroes = [cleanHero];
    this.state.pendingApprovals = [];
    this.state.taskLedgerLogs = [];
    this.switchHero(cleanHero.id);
    Sound.fanfare();
  }

  logAction(action, payout) {
    this.state.taskLedgerLogs.unshift({
      id: Date.now(),
      kid: this.state.selectedHero.name,
      action: action,
      payout: payout,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'Recorded'
    });
    if (this.state.taskLedgerLogs.length > 50) this.state.taskLedgerLogs.pop();
  }

  showReward(title, message, coins = 0, xp = 0, image = null, icon = null) {
    this.state.rewardModal = { title, message, coins, xp, image, icon };
    this.notify();
  }

  closeReward() {
    this.state.rewardModal = null;
    closeInteractiveCelebration();
    this.notify();
  }

  openMysterySurprise(data) {
    this.state.mysterySurprise = {
      isOpen: true,
      type: data.type || 'chest', // 'egg' for pets, 'chest' for all other digital content
      title: data.title || 'Mystery Reward',
      image: data.image || null,
      icon: data.icon || (data.type === 'egg' ? 'egg' : 'inventory_2'),
      desc: data.desc || '',
      category: data.category || 'Digital Content',
      statBonusPercent: data.statBonusPercent || 0,
      statBonusType: data.statBonusType || '',
      coinsEarned: data.coinsEarned || 0,
      xpEarned: data.xpEarned || 0,
      onComplete: data.onComplete || null
    };
    this.notify();
  }

  closeMysterySurprise() {
    if (this.state.mysterySurprise?.onComplete) {
      try {
        this.state.mysterySurprise.onComplete();
      } catch (e) {
        console.error('Error in onComplete callback:', e);
      }
    }
    this.state.mysterySurprise = null;
    this.notify();
  }

  toggleLiveRexModal(forceOpen) {
    if (!this.state.liveRex) {
      this.state.liveRex = { ...defaultState.liveRex };
    }
    this.state.liveRex.isOpen = typeof forceOpen === 'boolean' ? forceOpen : !this.state.liveRex.isOpen;
    this.notify();
  }

  setLiveRexState(partial, skipNotify = false) {
    if (!this.state.liveRex) {
      this.state.liveRex = { ...defaultState.liveRex };
    }
    this.state.liveRex = { ...this.state.liveRex, ...partial };
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('live-rex-state-update', { detail: this.state.liveRex }));
    }
    if (!skipNotify) {
      this.notify();
    }
  }

  setLiveRexApiKey(key) {
    if (!this.state.liveRex) {
      this.state.liveRex = { ...defaultState.liveRex };
    }
    this.state.liveRex.geminiApiKey = key;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('gemini_api_key', key);
    }
    this.saveState();
    this.notify();
  }

  setLiveRexVoice(voice) {
    if (!this.state.liveRex) {
      this.state.liveRex = { ...defaultState.liveRex };
    }
    this.state.liveRex.voiceName = voice;
    this.saveState();
    this.notify();
  }

  isParentUnlocked() {
    return this.isParentSessionUnlocked === true;
  }

  isEasyMode() {
    const hero = this.state.selectedHero;
    if (!hero) return false;
    const diff = (hero.gameDifficulty || hero.difficulty || hero.learningLevel || '').toLowerCase();
    const role = (hero.role || hero.title || '').toLowerCase();
    return (
      diff === 'easy' ||
      diff === 'toddler' ||
      role.includes('toddler') ||
      (hero.age !== undefined && hero.age !== null && Number(hero.age) <= 4)
    );
  }

  unlockParentSession() {
    this.isParentSessionUnlocked = true;
    this.navigate('parent_portal');
  }

  lockParentSession() {
    this.isParentSessionUnlocked = false;
    if (this.state.activeView === 'parent_portal') {
      this.navigate('dashboard');
    } else {
      this.notify();
    }
  }

  updateParentSettings(newSettings) {
    this.state.parentSettings = { ...this.state.parentSettings, ...newSettings };
    this.saveState(true);
    this.notify();
  }

  addParentUser({ email, displayName, role = 'admin', uid = null }) {
    if (!email || !email.includes('@')) {
      return { success: false, error: 'Please provide a valid email address.' };
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!this.state.household.parents) this.state.household.parents = [];
    if (!this.state.household.parentUids) this.state.household.parentUids = [];
    if (!this.state.household.parentEmails) this.state.household.parentEmails = [];

    const existing = this.state.household.parents.find(p => (p.email || '').toLowerCase() === cleanEmail);
    if (existing) {
      return { success: false, error: 'This parent is already added to the household.' };
    }

    const parentId = uid || ('parent_' + cleanEmail.replace(/[^a-z0-9]/g, '_'));
    const newParent = {
      uid: parentId,
      email: cleanEmail,
      displayName: displayName || cleanEmail.split('@')[0] || 'Parent Admin',
      role: role || 'admin',
      addedAt: new Date().toISOString()
    };

    this.state.household.parents.push(newParent);
    if (!this.state.household.parentUids.includes(parentId)) {
      this.state.household.parentUids.push(parentId);
    }
    if (!this.state.household.parentEmails.includes(cleanEmail)) {
      this.state.household.parentEmails.push(cleanEmail);
    }

    this.saveState(true);
    this.notify();
    return { success: true, parent: newParent };
  }

  removeParentUser(parentUidOrEmail) {
    const parents = this.state.household.parents || [];
    if (parents.length <= 1) {
      return { success: false, error: 'Cannot remove the only parent administrator of the household.' };
    }
    const target = parents.find(p => p.uid === parentUidOrEmail || p.email === parentUidOrEmail);
    if (!target) {
      return { success: false, error: 'Parent not found in household.' };
    }
    this.state.household.parents = parents.filter(p => p !== target);
    this.state.household.parentUids = (this.state.household.parentUids || []).filter(id => id !== target.uid);
    this.state.household.parentEmails = (this.state.household.parentEmails || []).filter(em => em !== target.email);

    this.saveState(true);
    this.notify();
    return { success: true };
  }

  isCurrentUserParent() {
    const currentUid = this.state.household.parentUser?.uid;
    const currentEmail = this.state.household.parentUser?.email?.toLowerCase();
    const parentUids = this.state.household.parentUids || [];
    const parentEmails = (this.state.household.parentEmails || []).map(e => e.toLowerCase());

    if (currentUid && parentUids.includes(currentUid)) return true;
    if (currentEmail && parentEmails.includes(currentEmail)) return true;
    return this.isParentUnlocked();
  }

  /**
   * Hydrate store with real-time cloud data from Firestore
   * Automatically updates heroes, tasks, habits, inventory, and persists to localStorage
   */
  hydrateFromCloud(cloudData) {
    if (!cloudData) return;

    // 1. Household Details & Parent Administrators
    if (cloudData.householdName) {
      this.state.household.name = cloudData.householdName;
    }
    const incomingCode = (cloudData.syncCode || cloudData.householdCode);
    if (incomingCode) {
      this.state.household.syncCode = incomingCode.trim().toUpperCase();
    }
    if (cloudData.parents && Array.isArray(cloudData.parents)) {
      this.state.household.parents = cloudData.parents;
    }
    if (cloudData.parentUids && Array.isArray(cloudData.parentUids)) {
      this.state.household.parentUids = cloudData.parentUids;
    }
    if (cloudData.parentEmails && Array.isArray(cloudData.parentEmails)) {
      this.state.household.parentEmails = cloudData.parentEmails;
    }
    this.state.household.lastSync = 'Synced Just Now';

    // 2. Deleted Heroes Tracking (Prevents resurrecting deleted kids across devices)
    if (cloudData.deletedHeroIds && Array.isArray(cloudData.deletedHeroIds)) {
      this.state.deletedHeroIds = Array.from(new Set([
        ...(this.state.deletedHeroIds || []),
        ...cloudData.deletedHeroIds
      ]));
    }
    const deletedHeroIdsSet = new Set(this.state.deletedHeroIds || []);

    // 3. Heroes & Kid Profiles (Smart Merge from heroesMap AND heroes array)
    let incomingHeroes = [];
    if (cloudData.heroesMap && typeof cloudData.heroesMap === 'object') {
      incomingHeroes = Object.values(cloudData.heroesMap).filter(Boolean);
    }
    if (Array.isArray(cloudData.heroes)) {
      cloudData.heroes.forEach((h) => {
        if (h && h.id && !incomingHeroes.some((existing) => existing && existing.id === h.id)) {
          incomingHeroes.push(h);
        }
      });
    }

    if (incomingHeroes.length > 0) {
      // Filter out any hero that was deleted
      incomingHeroes = incomingHeroes.filter((h) => h && h.id && !deletedHeroIdsSet.has(h.id));

      // Merge with local heroes so no kids or progress are dropped
      const mergedHeroes = incomingHeroes.map((cloudH) => {
        const localH = (this.state.heroes || []).find((h) => h.id === cloudH.id);
        const unlockedPetIds = Array.from(new Set([
          ...(cloudH.unlockedPetIds || []),
          ...(localH?.unlockedPetIds || [])
        ]));
        const petStageMap = {
          ...(localH?.petStageMap || {}),
          ...(cloudH.petStageMap || {})
        };
        // Preserve highest pet stage achieved
        Object.keys(petStageMap).forEach((pId) => {
          petStageMap[pId] = Math.max(
            localH?.petStageMap?.[pId] || 1,
            cloudH?.petStageMap?.[pId] || 1
          );
        });

        return {
          ...defaultState.selectedHero,
          ...localH,
          ...cloudH,
          coins: cloudH.coins !== undefined ? Number(cloudH.coins) : (localH?.coins ?? 0),
          points: cloudH.points !== undefined ? Number(cloudH.points) : (localH?.points ?? 0),
          tokens: cloudH.tokens !== undefined ? Number(cloudH.tokens) : (localH?.tokens ?? (cloudH.coins !== undefined ? Number(cloudH.coins) : 0)),
          level: Math.max(cloudH.level || 1, localH?.level || 1),
          xp: cloudH.xp !== undefined ? Number(cloudH.xp) : (localH?.xp ?? 0),
          xpNext: cloudH.xpNext || localH?.xpNext || 100,
          unlockedPetIds,
          petStageMap,
          habitatSlots: Math.max(cloudH.habitatSlots || 1, localH?.habitatSlots || 1, unlockedPetIds.length || 1),
          hasChosenStarterPet: cloudH.hasChosenStarterPet ?? (unlockedPetIds.length > 0),
          activePetId: cloudH.activePetId || localH?.activePetId || (unlockedPetIds[0] || null),
          streak: Math.max(cloudH.streak || 1, localH?.streak || 1),
          stars: Math.max(cloudH.stars || 0, localH?.stars || 0),
          role: cloudH.role || localH?.role || cloudH.title || 'Brave Adventurer',
          title: cloudH.title || localH?.title || cloudH.role || 'Brave Adventurer',
          avatar: cloudH.avatar || localH?.avatar || defaultState.selectedHero.avatar,
          gameDifficulty: cloudH.gameDifficulty || localH?.gameDifficulty || 'medium',
          equippedProfileTheme: cloudH.equippedProfileTheme || localH?.equippedProfileTheme || 'theme_dragon_emerald',
          unlockedThemes: Array.from(new Set([...(cloudH.unlockedThemes || []), ...(localH?.unlockedThemes || ['theme_dragon_emerald'])])),
          equippedGear: { ...(localH?.equippedGear || {}), ...(cloudH.equippedGear || {}) },
          inventory: Array.from(new Set([...(localH?.inventory || []), ...(cloudH.inventory || [])]))
        };
      });

      // Also preserve any local heroes that aren't yet in incomingHeroes AND not deleted
      (this.state.heroes || []).forEach((localH) => {
        if (localH && localH.id && !deletedHeroIdsSet.has(localH.id) && !mergedHeroes.some((h) => h.id === localH.id)) {
          mergedHeroes.push(localH);
        }
      });

      if (mergedHeroes.length === 0) {
        // Guarantee at least 1 hero
        const freshHero = {
          id: 'hero_' + Date.now(),
          name: 'Little Hero',
          role: 'Brave Adventurer',
          avatar: KID_AVATARS[0]?.url || defaultState.selectedHero.avatar,
          level: 1,
          points: 0,
          coins: 0,
          tokens: 0,
          activePetId: null,
          unlockedPetIds: [],
          hasChosenStarterPet: false,
          habitatSlots: 1,
          petStageMap: {},
          streak: 1,
          completionRate: 100,
          gameDifficulty: 'medium',
          equippedProfileTheme: 'theme_dragon_emerald',
          unlockedThemes: ['theme_dragon_emerald'],
          equippedGear: {},
          inventory: []
        };
        mergedHeroes.push(freshHero);
      }

      this.state.heroes = mergedHeroes;

      // Update active selectedHero with matching merged data (preserve active kid on this device)
      const currentId = this.state.selectedHero?.id;
      let matchedHero = this.state.heroes.find((h) => h.id === currentId);
      if (!matchedHero) {
        matchedHero = this.state.heroes[0];
      }
      if (matchedHero) {
        this.state.selectedHero = {
          ...defaultState.selectedHero,
          ...matchedHero
        };
      }
    }

    // 4. Pet Stats & Evolution Maps
    if (cloudData.petStatsMap) {
      this.state.petStatsMap = { ...this.state.petStatsMap, ...cloudData.petStatsMap };
    }
    if (cloudData.petStageMap) {
      this.state.petStageMap = { ...this.state.petStageMap, ...cloudData.petStageMap };
      if (this.state.selectedHero) {
        this.state.selectedHero.petStageMap = { ...this.state.selectedHero.petStageMap, ...cloudData.petStageMap };
      }
    }
    if (cloudData.equippedGearMap) {
      this.state.equippedGearMap = { ...this.state.equippedGearMap, ...cloudData.equippedGearMap };
    }
    if (cloudData.equippedPetGear !== undefined) {
      this.state.equippedPetGear = cloudData.equippedPetGear;
      if (this.state.selectedHero) {
        this.state.selectedHero.equippedPetGear = cloudData.equippedPetGear;
      }
    }
    if (cloudData.pets && Array.isArray(cloudData.pets)) {
      this.state.pets = cloudData.pets;
    }

    // 5. Autonomous Micro-Quests (AI Spark) & Badges/Trophies
    if (cloudData.aiQuests && Array.isArray(cloudData.aiQuests)) {
      this.state.aiQuests = cloudData.aiQuests;
    }
    if (cloudData.recentlyUnlocked && Array.isArray(cloudData.recentlyUnlocked)) {
      this.state.recentlyUnlocked = cloudData.recentlyUnlocked;
    }

    // 6. Chores, Habits, Rewards, Inventory, Rex Guardrails & Progress
    if (cloudData.taskForest && Array.isArray(cloudData.taskForest)) {
      this.state.taskForest = cloudData.taskForest;
    }
    if (cloudData.habitIslands && Array.isArray(cloudData.habitIslands)) {
      this.state.habitIslands = cloudData.habitIslands;
    }
    if (cloudData.realLifeRewards && Array.isArray(cloudData.realLifeRewards)) {
      this.state.realLifeRewards = cloudData.realLifeRewards;
    }
    if (cloudData.digitalGear && Array.isArray(cloudData.digitalGear)) {
      this.state.digitalGear = cloudData.digitalGear;
    }
    if (cloudData.inventory && Array.isArray(cloudData.inventory)) {
      this.state.inventory = Array.from(new Set([...(this.state.inventory || []), ...cloudData.inventory]));
    }
    if (cloudData.liveRex && typeof cloudData.liveRex === 'object') {
      this.state.liveRex = {
        ...this.state.liveRex,
        ...cloudData.liveRex,
        isOpen: this.state.liveRex.isOpen || cloudData.liveRex.isOpen || false,
        voiceName: cloudData.liveRex.voiceName || this.state.liveRex.voiceName || 'Puck',
        autoListenInQuests: cloudData.liveRex.autoListenInQuests ?? this.state.liveRex.autoListenInQuests ?? true,
        geminiApiKey: cloudData.liveRex.geminiApiKey || this.state.liveRex.geminiApiKey || '',
        status: cloudData.liveRex.status || this.state.liveRex.status || 'idle',
        statusMessage: cloudData.liveRex.statusMessage || this.state.liveRex.statusMessage || '',
        lastRexTranscript: cloudData.liveRex.lastRexTranscript || this.state.liveRex.lastRexTranscript || '',
        lastUserTranscript: cloudData.liveRex.lastUserTranscript || this.state.liveRex.lastUserTranscript || ''
      };
    }
    if (cloudData.parentSettings) {
      this.state.parentSettings = { ...this.state.parentSettings, ...cloudData.parentSettings };
    }
    if (cloudData.profileThemes && Array.isArray(cloudData.profileThemes)) {
      this.state.profileThemes = cloudData.profileThemes;
    }
    if (cloudData.gameProgress) {
      this.state.gameProgress = { ...(this.state.gameProgress || {}), ...cloudData.gameProgress };
    }

    // 7. Smart Merge Completion & Ledger Logs (Prevents dropped concurrent logs across devices)
    if (cloudData.taskCompletionLogs && Array.isArray(cloudData.taskCompletionLogs)) {
      const logMap = new Map();
      (this.state.taskCompletionLogs || []).forEach((log) => {
        if (log && log.id) logMap.set(log.id, log);
      });
      cloudData.taskCompletionLogs.forEach((log) => {
        if (log && log.id) {
          const existing = logMap.get(log.id);
          logMap.set(log.id, { ...(existing || {}), ...log });
        }
      });
      this.state.taskCompletionLogs = Array.from(logMap.values())
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 300);
    }
    if (cloudData.taskLedgerLogs && Array.isArray(cloudData.taskLedgerLogs)) {
      const ledgerMap = new Map();
      (this.state.taskLedgerLogs || []).forEach((log) => {
        if (log && log.id) ledgerMap.set(log.id, log);
      });
      cloudData.taskLedgerLogs.forEach((log) => {
        if (log && log.id) {
          const existing = ledgerMap.get(log.id);
          ledgerMap.set(log.id, { ...(existing || {}), ...log });
        }
      });
      this.state.taskLedgerLogs = Array.from(ledgerMap.values())
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 300);
    }

    // 8. Approvals Queue (Authoritative Cloud with In-Flight Local Preservation)
    if (cloudData.pendingApprovals !== undefined && Array.isArray(cloudData.pendingApprovals)) {
      const resolvedLogIds = new Set(
        (this.state.taskCompletionLogs || [])
          .filter((l) => l.status === 'approved' || l.status === 'rejected')
          .map((l) => l.approvalRequestId || l.id)
      );
      const unconfirmedLocal = (this.state.pendingApprovals || []).filter((localReq) => {
        if (!localReq || !localReq.id) return false;
        if (resolvedLogIds.has(localReq.id)) return false;
        const inCloud = cloudData.pendingApprovals.some((c) => c.id === localReq.id);
        if (inCloud) return false;
        const ageMs = localReq.timestamp ? (Date.now() - new Date(localReq.timestamp).getTime()) : 0;
        return ageMs > 0 && ageMs < 45000;
      });
      this.state.pendingApprovals = [...cloudData.pendingApprovals, ...unconfirmedLocal];
    }

    // 9. Linked Devices Presence Tracking
    if (cloudData.devices && typeof cloudData.devices === 'object') {
      this.state.devices = { ...(this.state.devices || {}), ...cloudData.devices };
      const now = Date.now();
      const activeDevs = Object.entries(this.state.devices).filter(([, dev]) => {
        if (!dev || !dev.lastSeen) return true;
        return now - new Date(dev.lastSeen).getTime() < 86400000 * 3;
      });
      this.state.household.linkedDevices = Math.max(1, activeDevs.length);
    }

    // 6. Persist to actual localStorage key
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
    } catch (e) {
      console.warn('Could not save hydrated state to localStorage:', e);
    }

    // 6. Notify subscribers and trigger immediate UI re-render
    this.notify();
  }

  // --- HERO HQ & SUPERHERO HIDEOUT STUDIO ACTIONS ---
  setHQTheme(themeId) {
    if (!this.state.heroHQ) {
      this.state.heroHQ = JSON.parse(JSON.stringify(defaultState.heroHQ));
    }
    const theme = getHQTheme(themeId);
    this.state.heroHQ.themeId = theme.id;
    Sound.sparkle();
    this.saveState();
    this.notify();
    return theme;
  }

  toggleHQNightMode(forceState = null) {
    if (!this.state.heroHQ) {
      this.state.heroHQ = JSON.parse(JSON.stringify(defaultState.heroHQ));
    }
    this.state.heroHQ.isNightMode = forceState !== null ? Boolean(forceState) : !this.state.heroHQ.isNightMode;
    Sound.lightSwitch();
    this.saveState();
    this.notify();
    return this.state.heroHQ.isNightMode;
  }

  equipHQFurniture(slot, furnitureId) {
    if (!this.state.heroHQ) {
      this.state.heroHQ = JSON.parse(JSON.stringify(defaultState.heroHQ));
    }
    const item = getFurnitureItem(furnitureId);
    if (!item) return false;

    if (!this.state.heroHQ.unlockedFurnitureIds.includes(furnitureId)) {
      return false;
    }

    this.state.heroHQ.equippedFurniture[slot] = furnitureId;
    Sound.placeFurniture();
    this.saveState();
    this.notify();
    return true;
  }

  unlockHQFurniture(furnitureId, autoEquip = true) {
    if (!this.state.heroHQ) {
      this.state.heroHQ = JSON.parse(JSON.stringify(defaultState.heroHQ));
    }
    const item = getFurnitureItem(furnitureId);
    if (!item) return { success: false, reason: 'Item not found' };

    if (this.state.heroHQ.unlockedFurnitureIds.includes(furnitureId)) {
      if (autoEquip && item.slot) {
        this.equipHQFurniture(item.slot, furnitureId);
      }
      return { success: true, reason: 'Already unlocked' };
    }

    const currentCoins = this.state.selectedHero?.coins || 0;
    const cost = item.costCoins || 0;

    if (cost > 0 && currentCoins < cost) {
      Sound.pop();
      return { success: false, reason: `Need ${cost - currentCoins} more Tokens 🪙` };
    }

    if (cost > 0) {
      this.state.selectedHero.coins = Math.max(0, currentCoins - cost);
    }

    this.state.heroHQ.unlockedFurnitureIds.push(furnitureId);
    if (autoEquip && item.slot) {
      this.state.heroHQ.equippedFurniture[item.slot] = furnitureId;
    }

    Sound.fanfare();
    Sound.placeFurniture();
    try {
      confetti({
        particleCount: 75,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch (e) {}

    this.showReward(
      `Unlocked: ${item.name}!`,
      `Your new ${item.name} is ready in Hero HQ!\n🪙 Spent ${cost} Tokens. Tap to interact anytime!`,
      cost,
      25,
      item.emoji,
      'place'
    );

    this.saveState(true);
    this.notify();
    return { success: true, item };
  }

  setFeaturedTrophy(slotIndex, trophyId) {
    if (!this.state.heroHQ) {
      this.state.heroHQ = JSON.parse(JSON.stringify(defaultState.heroHQ));
    }
    if (!Array.isArray(this.state.heroHQ.featuredTrophyIds)) {
      this.state.heroHQ.featuredTrophyIds = ['rookie_hero_crest'];
    }
    const list = [...this.state.heroHQ.featuredTrophyIds];
    while (list.length < 4) {
      list.push(null);
    }
    if (slotIndex >= 0 && slotIndex < 4) {
      list[slotIndex] = trophyId;
    }
    this.state.heroHQ.featuredTrophyIds = list;
    Sound.sparkle();
    this.saveState();
    this.notify();
    return true;
  }

  setHQRedecorateDrawer(isOpen, activeCategory = null) {
    if (!this.state.heroHQ) {
      this.state.heroHQ = JSON.parse(JSON.stringify(defaultState.heroHQ));
    }
    this.state.heroHQ.redecorateDrawerOpen = Boolean(isOpen);
    if (activeCategory) {
      this.state.heroHQ.redecorateActiveCategory = activeCategory;
    }
    Sound.whoosh();
    this.saveState();
    this.notify();
  }

  getHQStats() {
    const heroHQ = this.state.heroHQ || defaultState.heroHQ;
    const theme = getHQTheme(heroHQ.themeId);
    const trophies = getTrophiesForDisplay(this.state);
    const unlockedCount = (heroHQ.unlockedFurnitureIds || []).length;
    const totalFurnitureCount = FURNITURE_ITEMS.length;
    return {
      theme,
      themeId: heroHQ.themeId,
      isNightMode: Boolean(heroHQ.isNightMode),
      equippedFurniture: heroHQ.equippedFurniture || {},
      unlockedCount,
      totalFurnitureCount,
      trophiesCount: trophies.length,
      coins: this.state.selectedHero?.coins || 0
    };
  }

  checkHQMilestoneUnlocks() {
    if (!this.state.heroHQ) {
      this.state.heroHQ = JSON.parse(JSON.stringify(defaultState.heroHQ));
    }
    const unlocked = new Set(this.state.heroHQ.unlockedFurnitureIds || []);
    const newlyUnlocked = [];

    const brushStreak = this.state.brushStreak || this.state.selectedHero?.streak || 0;
    const choreCount = (this.state.choresCompletedCount || 0) + (this.state.taskCompletionLogs?.length || 0);
    const danceCount = this.state.movementSessionHistory?.length || 0;
    const expCount = this.state.expeditionHistory?.length || 0;
    const bossDefeatCount = (this.state.dentalBattleHistory?.length || 0) + (this.state.hygieneBattle?.bossesDefeated?.length || 0);
    const learningStars = this.state.learningGames?.totalStars || 0;

    FURNITURE_ITEMS.forEach(item => {
      if (unlocked.has(item.id)) return;
      if (!item.milestoneRequirement) return;

      let qualifies = false;
      switch (item.milestoneRequirement) {
        case '3_day_brush_streak':
          qualifies = brushStreak >= 3;
          break;
        case '4_day_brush_streak':
          qualifies = brushStreak >= 4;
          break;
        case '5_day_brush_streak':
          qualifies = brushStreak >= 5;
          break;
        case '7_day_brush_streak':
          qualifies = brushStreak >= 7;
          break;
        case '5_chores_completed':
          qualifies = choreCount >= 5;
          break;
        case '10_chores_completed':
          qualifies = choreCount >= 10;
          break;
        case '15_chores_completed':
          qualifies = choreCount >= 15;
          break;
        case 'dance_party_1':
          qualifies = danceCount >= 1;
          break;
        case 'dance_party_2':
          qualifies = danceCount >= 2;
          break;
        case 'pet_expedition_1':
          qualifies = expCount >= 1;
          break;
        case 'pet_expedition_2':
          qualifies = expCount >= 2;
          break;
        case 'pet_level_5':
          qualifies = (this.state.selectedHero?.level || 1) >= 5;
          break;
        case 'learning_streak_3':
          qualifies = learningStars >= 3;
          break;
        case 'learning_streak_5':
          qualifies = learningStars >= 5;
          break;
        case 'learning_math_1':
          qualifies = Boolean(this.state.learningGames?.mathPassed || this.state.gameMasteryMap?.math);
          break;
        case 'learning_science_1':
          qualifies = Boolean(this.state.learningGames?.sciencePassed || this.state.gameMasteryMap?.science);
          break;
        case 'boss_defeat_1':
          qualifies = bossDefeatCount >= 1;
          break;
        case 'boss_defeat_3':
          qualifies = bossDefeatCount >= 3;
          break;
        case 'boss_cavity_king':
          qualifies = Boolean(this.state.dentalBadges?.includes('cavity_crusher') || this.state.hygieneBattle?.sugarfangDefeated);
          break;
        default:
          break;
      }

      if (qualifies) {
        this.state.heroHQ.unlockedFurnitureIds.push(item.id);
        unlocked.add(item.id);
        newlyUnlocked.push(item);
      }
    });

    if (newlyUnlocked.length > 0) {
      this.saveState(true);
      this.notify();
    }
    return newlyUnlocked;
  }

  resetAllProgress() {
    this.state = JSON.parse(JSON.stringify(defaultState));
    this.saveState(true);
  }
}

export const store = new Store();
