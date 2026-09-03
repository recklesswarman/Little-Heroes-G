import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';
import { PETS_DATABASE } from '../data/petsData.js';
import { ADVENTURE_GAMES } from '../data/learningGamesData.js';
import { PROFILE_THEMES } from '../data/profileThemesData.js';
import { generate3DIcon } from '../utils/graphicsGenerator.js';

export const KID_AVATARS = [
  { id: 'avatar_dragon', label: 'Dragon Explorer', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZfP7_Cwlp4sz41asI8ymuapAKvjmqHtvI4zcMAF_XwUmibj8IheGrS5cA5QD5gmXgVxEkZM9FlWJPRZnct3x6-9SQB7zJKqkEDjJ3m95tAy3zRqS-PbmcQ4kv_9pmIfm2Py4mh3Fw083hkDookz1w4_r50SBA1jc9igDaAPFLYBFgSP2aQBz7Q4jVE-DwhMOyUEHlxDkQk6Gwc2EAFCSKs1c0QuhUOi3tkrk5MXRARKqZcYVzyJe6gA' },
  { id: 'avatar_cyber', label: 'Cyber Scout', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuARR2klW8usL-qhZiz0_G-YpTDfniXDjgHoCQ_TULj1qzslQkdWxX4Wq2evyu74EP6D3_HZhuWK7Ur01vaB-ih5z8SIKSqawthIwUeiiFFVbRjUfS_ESM6_-NzIkcPl9lgdpDNEqBDaoiMnhRiHE2oY84NKDgpdDwGB-ns1Pl0rX6OlqQa93LVIUhJuD5us2LFiF8zPaPCw3LYoZuCs5m2Eie-8vAsBx3XfthE2qlYBO4kcHUFrN_gtiA' },
  { id: 'avatar_superpup', label: 'Super Pup', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBt3DBwfpcbbvoWYvwpXt_crRM01oD2FlSmnTjRotHTDi6sCpEpo0HGRngqdUbBC_cgHu1T3JOXkMdw4-qLzPcPEslBONYLu1qXkoOJ6btgq7pAJfCm1FvcueHfEMAmidhqBIchTbwNZKOjkPMEDo6oKzVt1PgftBS6r7sVVYel_-bHhlmi-n4oZI1RzBckf3DMsFIgVmoLzSNj29eK9AS8dChk10e_WQuIwzYNt21e4MKdKn02dg4RWg' },
  { id: 'avatar_space', label: 'Knight Adventurer', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAUTWERGwaJXM82ZeJ0adcNsuOm_cR4z5CXAleJ2oKcekqKsuaZZD315RkB188DDt6fevx8guS2V20knvs93SzLKjox7deSVry-v8kiyTM-H0Kg5vmB8inoBoKz2SqYnVzUKVk9uulAHGfsUmnIs4VI7GkWcmmfE2gvPnoehqZqjhxHZuHz9Tqs_Omja5bwoX9aPmW8Xf63V9KIQsux3ucTJHZBdI2U8eRyOy7bO0XQMqe2BNGXc3SoWg' }
];

export const STORAGE_KEY = 'little_heroes_adventure_master_v8';

const defaultState = {
  activeView: 'dashboard', // dashboard, quest_map, pet_pen, pet_roster, pet_detail, pet_bath, shop, ar_battle, evolution, master_fuse, dance_party, profile, parent_portal, adventures_map, adventure_game
  previousView: 'dashboard',
  selectedPetDetailId: 1,
  selectedAdventureGameId: 'phonics_forest',

  // Household Link Architecture
  household: {
    syncCode: 'HERO-' + Math.floor(1000 + Math.random() * 9000),
    name: "The Hero Family",
    linkedDevices: 1,
    lastSync: 'Just now'
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
    unlockedThemes: ['theme_dragon_emerald']
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
      unlockedThemes: ['theme_dragon_emerald']
    }
  ],

  // Kids Profile Themes Catalog
  profileThemes: PROFILE_THEMES,

  // Habit Islands (Preset Daily Positive Behaviors)
  habitIslands: [
    {
      id: 'drink_water',
      title: 'Drink 4 Cups of Water',
      zone: 'Habit Islands',
      icon: 'water_drop',
      image: 'https://lh3.googleusercontent.com/aida/AEtjO1UzuPyYfcmxTdgFkS7zVXE_cJPQZ_8THyZMImMQJSuKOlmj5XN-fzGpRfNfQbgp1fWNbj0SzKTYNtL-1pB0PYaLboMlYJtzU6aIK9Uf_rS9vtVcOC8Ie2RfY1345DwpVOzbVQHKJrAhqax3pO3Av7HgBkh_L67bjW2St8Ki5V8M3DNT6Je6PDlS3i6-gTGU_ERuJrWlDrNnJ0xllQuAd4ll4-djz6va-q_LEpDzRulgJ53Za2xPHw3dxa88',
      coins: 15,  // 🪙 Tokens auto-issued
      points: 5,  // ⭐ Points pending parent approval
      xp: 20,
      completed: true,
      pointsApproved: true,
      desc: 'Keep your hydration meter full with crystal spring water.'
    },
    {
      id: 'gentle_words',
      title: 'Use Kind & Gentle Words',
      zone: 'Habit Islands',
      icon: 'favorite',
      image: generate3DIcon('favorite', 'green', 'Kindness'),
      coins: 20,
      points: 10,
      xp: 25,
      completed: false,
      pointsApproved: false,
      desc: 'Spread kindness to siblings, parents, and friends today.'
    },
    {
      id: 'healthy_snack',
      title: 'Eat Fruit or Veggie Snack',
      zone: 'Habit Islands',
      icon: 'nutrition',
      image: 'https://lh3.googleusercontent.com/aida/AEtjO1UuCPRIp3bcNODtjcuPUYCb1k8R-X-wt8M4SkdedZ2UK8gVYhXWdqlH4ec0QrR5LVQimn-_uMnv97sofFVP_bwtOabQeHT0SHtxVe59gKb1Qch1Id9HwPaHU7YYyQbnId78QZLhbJun88sn97HnxETpeh6fgMNmuextDnU3-fqKj7z6PsFQnV57jxpzaVtbulYuS9DNbp78rG73z_clyox8dQva9TbjJr4dzkiz-ytPCGJyopeRhjPTAts',
      coins: 20,
      points: 5,
      xp: 20,
      completed: false,
      pointsApproved: false,
      desc: 'Crunch on apples, carrots, or berries for instant vitality.'
    },
    {
      id: 'hand_washing',
      title: 'Wash Hands (20 Secs)',
      zone: 'Habit Islands',
      icon: 'soap',
      image: generate3DIcon('soap', 'blue', 'Clean Hands'),
      coins: 10,
      points: 5,
      xp: 15,
      completed: true,
      pointsApproved: true,
      desc: 'Scrub all suds clean before meals and after playing outside.'
    }
  ],

  // Task Forest (Scheduled Chores & Routines with Time Windows)
  taskForest: [
    {
      id: 'morning_brush',
      title: 'Morning Toothbrush AR Battle',
      zone: 'Task Forest',
      icon: 'dentistry',
      image: 'https://lh3.googleusercontent.com/aida/AEtjO1Xt9GeFqjAL58hS_PuyIhL5_ZJ68ze3DFHgw6czaVkv6UJsQjulgSW1SVNMN5R-83AzzqbFfTVTa4A3XBDHsR7ggE9m-inrmcjBUsbdqo4InwRTA2VU1ndafKJJx--9Vzt17F9tgoYWYwsDyOtf2V78XpSPNIMUWsSQI1pjREuzdqsCbyFXDBadq8CPlJrx2MeHIOsKCpfe0VbcWqtPhzKdzzmlIhcK4Xgujh-Msp9KagAkWDWYiClbQ-bk',
      timeWindow: '6:00 AM - 9:00 AM',
      coins: 30,  // 🪙 Tokens auto-issued
      points: 15, // ⭐ Points pending parent approval
      xp: 50,
      completed: false,
      pointsApproved: false,
      isAR: true,
      desc: 'Hands-free 2-minute scrubbing battle against the Sugar Boss.'
    },
    {
      id: 'make_bed',
      title: 'Make Your Hero Bed',
      zone: 'Task Forest',
      icon: 'bed',
      image: generate3DIcon('bed', 'teal', 'Bed'),
      timeWindow: 'Morning',
      coins: 20,
      points: 10,
      xp: 30,
      completed: false,
      pointsApproved: false,
      desc: 'Pull up sheets, tuck blankets, and align pillows neatly.'
    },
    {
      id: 'clean_toys',
      title: 'Clean Up Toys & Blocks',
      zone: 'Task Forest',
      icon: 'toys',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDy3Rfu0bcLlMPyE2iHd9P78LdbLHJNOzTdaepeadGKy-vo9vxupk8kFi7ggsSZgSTNyekoC_nPypDwUIyXCrD2-_Z96IqQYN58d5uymrFi6JV8vd3_mbXavdbQXB825ndnaEFa-xL8t9yleVWU-a8f9Cv8ehZ1dNuYJt1w-L5x05lq4gKgpqmuecxkjqj0__taxaDmJ-tSIUV6wqkf6VcM2RD4FoyEzXq6FmcZaYoeIxFG5Aa2iQtu0g',
      timeWindow: 'Afternoon',
      coins: 35,
      points: 15,
      xp: 45,
      completed: false,
      pointsApproved: false,
      desc: 'Stow shields, cars, and blocks into the toy chest.'
    },
    {
      id: 'homework_reading',
      title: 'Homework / 15m Reading',
      zone: 'Task Forest',
      icon: 'menu_book',
      image: 'https://lh3.googleusercontent.com/aida/AEtjO1Upn8eSGHYCBegCuVLlrK1tRsouPnIA7kav9jbPpHhAoX1EjtcrZeJnUHVFFwl3TFnSvW9rdiO4wx3Ro8M-yIyeLHNgZCvYVs8VhIwrBWqp8iG9M-F5Iz_qjN6edcr4atCBHVtrvW1EC0ZjuQi8SkrCwSMCrmSx7FCMR2tVWjXu7RxLOO_qn7eO27ahLpkcv5Ark-EaT3t0C-BmvG7vMZgOK5_DDLyOHFGD3VGC0WcSc8lDGcSpqbwCjfNY',
      timeWindow: '3:00 PM - 6:00 PM',
      coins: 30,
      points: 20,
      xp: 40,
      completed: false,
      pointsApproved: false,
      desc: 'Level up your brain power with stories or worksheets.'
    },
    {
      id: 'night_bedtime',
      title: 'Bedtime Routine on Time',
      zone: 'Task Forest',
      icon: 'bedtime',
      image: 'https://lh3.googleusercontent.com/aida/AEtjO1V97aePfWQmnVShMtBQbima_UDU0i6-8HfQ2n8qhGdoWZLbB0i92sJK2agutlVgGgj3HAVeKGYApMLb1pekmHEwMkum3IwJUH4kInnyo5LBApPp19gD5ihwha1vyRfG_5DcQtw5IfYwtwF_GMpbfQe_LUwyYPZBWnYua0Y7r8WKi-bax1d06QI0zeSdnmNrDwzQi6nSmBkbPGLaL5iHGxpziVKKaZ155rUBdz8_jIVpxWQS0D3-Vpacbi8',
      timeWindow: '7:30 PM - 8:30 PM',
      coins: 40,
      points: 25,
      xp: 60,
      completed: false,
      pointsApproved: false,
      desc: 'Pajamas on, lights dimmed, and ready for sleep.'
    }
  ],

  // 24 Pets Universe & Active Pet State
  pets: PETS_DATABASE,
  petStageMap: {},
  petSelectionModal: { isOpen: false, type: 'starter' },
  petStatsMap: {
    1: { hunger: 75, hygiene: 90, energy: 65, joy: 85 }
  },

  fusedPets: [],

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

  // Parent Admin Portal: Action Approvals Queue
  pendingApprovals: [],

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
  rewardModal: null
};

class Store {
  constructor() {
    this.subscribers = new Set();
    this.isParentSessionUnlocked = false;
    this.state = this.loadState();
  }

  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('little_heroes_adventure_master_v7');
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
        }

        // Never restore to parent_portal while locked on reload
        if (parsed.activeView === 'parent_portal') {
          parsed.activeView = 'dashboard';
        }
        parsed.parentUnlocked = false;

        // Upgrade habit & chore images so toddlers get rich graphical visual icons without text
        if (parsed.habitIslands) {
          parsed.habitIslands.forEach((h) => {
            if (!h.image || h.image.includes('text%20x') || h.image.includes('%3Ctext')) {
              const def = defaultState.habitIslands.find((d) => d.id === h.id);
              if (def) h.image = def.image;
            }
          });
        }
        if (parsed.taskForest) {
          parsed.taskForest.forEach((t) => {
            if (!t.image || t.image.includes('text%20x') || t.image.includes('%3Ctext')) {
              const def = defaultState.taskForest.find((d) => d.id === t.id);
              if (def) t.image = def.image;
            }
          });
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

  saveState() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
      if (this.syncService) {
        this.syncService.pushStateToCloud();
      } else {
        import('../services/firestoreSyncService.js').then(({ firestoreSync }) => {
          this.syncService = firestoreSync;
          firestoreSync.pushStateToCloud();
        }).catch(() => {});
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
    this.saveState();
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
    this.saveState();
  }

  deleteTask(taskId, zone) {
    if (zone === 'Habit Islands') {
      this.state.habitIslands = this.state.habitIslands.filter(t => t.id !== taskId);
    } else {
      this.state.taskForest = this.state.taskForest.filter(t => t.id !== taskId);
    }
    this.state.pendingApprovals = this.state.pendingApprovals.filter(r => r.taskId !== taskId);
    Sound.click();
    this.saveState();
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
    this.saveState();
  }

  deleteRealLifeReward(rewardId) {
    this.state.realLifeRewards = this.state.realLifeRewards.filter(r => r.id !== rewardId);
    this.state.pendingApprovals = this.state.pendingApprovals.filter(r => r.rewardId !== rewardId);
    Sound.click();
    this.saveState();
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
    this.saveState();
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
      this.saveState();
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

    Sound.fanfare();
    confetti({ particleCount: 80, spread: 90 });
    this.showReward('Profile Theme Unlocked!', `"${theme.name}" is now equipped on your hero profile!`, 0, 25, null, 'palette');
    this.saveState();
  }

  equipProfileTheme(themeId) {
    const theme = this.state.profileThemes.find(t => t.id === themeId);
    if (theme) {
      this.state.selectedHero.equippedProfileTheme = themeId;
      const h = this.state.heroes.find(hero => hero.id === this.state.selectedHero.id);
      if (h) h.equippedProfileTheme = themeId;
      Sound.click();
      this.showReward('Theme Equipped!', `"${theme.name}" is now styling your hero profile!`, 0, 0, null, 'palette');
      this.saveState();
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
      this.saveState();
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
      this.saveState();
    }
  }

  // HABIT ISLANDS COMPLETION
  toggleHabitIsland(habitId) {
    const habit = this.state.habitIslands.find((h) => h.id === habitId);
    if (!habit) return;

    // Check if habit is currently pending approval
    const isPending = (habit.completed && !habit.pointsApproved) || 
      (this.state.pendingApprovals && this.state.pendingApprovals.some(r => r.taskId === habit.id && r.status === 'pending'));

    if (isPending) {
      // Per requirements: All habits are always able to be selected, but when pending approval:
      // - NO message modal or banner
      // - NO duplicate tokens auto-issued until parent approves original request first
      Sound.click();
      return;
    }

    if (!habit.completed) {
      habit.completed = true;
      habit.pointsApproved = false;

      // 🪙 Tokens are auto-issued immediately (only upon first completion)
      this.state.selectedHero.coins += habit.coins;
      this.addXP(habit.xp);
      Sound.coin();
      Sound.fanfare();

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#2ecc71', '#ffb961', '#3498db', '#f1c40f']
      });

      // ⭐ Points are queued for Parent Approval
      const approvalReqId = 'task_habit_' + habit.id + '_' + Date.now();
      this.state.pendingApprovals.push({
        id: approvalReqId,
        kidId: this.state.selectedHero.id,
        kidName: this.state.selectedHero.name,
        type: 'task_point_approval',
        taskId: habit.id,
        title: habit.title,
        zone: 'Habit Islands',
        pendingPoints: habit.points,
        tokensAwarded: habit.coins,
        date: 'Just now',
        status: 'pending'
      });

      this.logAction(`${this.state.selectedHero.name} logged '${habit.title}'`, `+${habit.coins} Tokens 🪙 auto-issued. (${habit.points} Points ⭐ pending Parent Approval)`);
      this.showReward(
        `Habit Logged!`,
        `🪙 +${habit.coins} Habit Tokens auto-added to wallet!\n⭐ +${habit.points} Gold Points sent to Parent for approval.`,
        habit.coins,
        habit.xp,
        habit.image,
        habit.icon
      );
    } else {
      // Already approved by parent
      Sound.click();
    }
    this.saveState();
  }

  // TASK FOREST CHORE COMPLETION
  toggleTaskForest(taskId) {
    const task = this.state.taskForest.find((t) => t.id === taskId);
    if (!task) return;

    // Check if task is currently pending approval
    const isPending = (task.completed && !task.pointsApproved) || 
      (this.state.pendingApprovals && this.state.pendingApprovals.some(r => r.taskId === task.id && r.status === 'pending'));

    if (isPending) {
      // Per requirements: All tasks are always able to be selected, but when pending approval:
      // - NO message modal or banner
      // - NO duplicate tokens auto-issued until parent approves original request first
      Sound.click();
      return;
    }

    if (!task.completed) {
      task.completed = true;
      task.pointsApproved = false;

      // 🪙 Tokens are auto-issued immediately (only upon first completion)
      this.state.selectedHero.coins += task.coins;
      this.addXP(task.xp);
      Sound.coin();
      Sound.fanfare();

      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#2ecc71', '#54e98a', '#f1c40f']
      });

      // ⭐ Points are queued for Parent Approval
      const approvalReqId = 'task_chore_' + task.id + '_' + Date.now();
      this.state.pendingApprovals.push({
        id: approvalReqId,
        kidId: this.state.selectedHero.id,
        kidName: this.state.selectedHero.name,
        type: 'task_point_approval',
        taskId: task.id,
        title: task.title,
        zone: 'Task Forest',
        pendingPoints: task.points,
        tokensAwarded: task.coins,
        date: 'Just now',
        status: 'pending'
      });

      this.logAction(`${this.state.selectedHero.name} finished '${task.title}'`, `+${task.coins} Tokens 🪙 auto-issued. (${task.points} Points ⭐ pending Parent Approval)`);
      this.showReward(
        `Chore Done: ${task.title}!`,
        `🪙 +${task.coins} Habit Tokens auto-added to wallet!\n⭐ +${task.points} Gold Points sent to Parent for approval.`,
        task.coins,
        task.xp,
        task.image,
        task.icon
      );
    } else {
      // Already approved by parent
      Sound.click();
    }
    this.saveState();
  }

  // TOOTHBRUSH AR BATTLE COMPLETION
  completeToothbrushBattle() {
    const task = this.state.taskForest.find((t) => t.id === 'morning_brush');
    if (task) {
      task.completed = true;
      task.pointsApproved = false;
    }

    // Check if already has a pending approval
    const isPending = this.state.pendingApprovals && this.state.pendingApprovals.some(r => r.taskId === 'morning_brush' && r.status === 'pending');

    if (isPending) {
      // Already pending approval: celebration sound, but no duplicate tokens until parent approves
      Sound.fanfare();
      this.showReward(
        'SUGAR VILLAIN DEFEATED!',
        'Great toothbrush battle hero! Your reward request is pending parent approval in the Parent Portal.',
        0,
        0,
        task?.image || generate3DIcon('dentistry', 'blue', 'Brush'),
        'dentistry'
      );
      this.saveState();
      return;
    }

    this.state.selectedHero.coins += 30;
    this.addXP(50);

    const approvalReqId = 'task_ar_brush_' + Date.now();
    this.state.pendingApprovals.push({
      id: approvalReqId,
      kidId: this.state.selectedHero.id,
      kidName: this.state.selectedHero.name,
      type: 'task_point_approval',
      taskId: 'morning_brush',
      title: 'Morning Toothbrush AR Battle (2:00 Routine)',
      zone: 'Task Forest',
      pendingPoints: 15,
      tokensAwarded: 30,
      date: 'Just now',
      status: 'pending'
    });

    this.logAction(`${this.state.selectedHero.name} finished 2-min Toothbrush AR Battle`, `+30 Tokens 🪙 auto-issued. (+15 Points ⭐ sent to Parent for approval)`);
    this.showReward(
      'SUGAR VILLAIN DEFEATED!',
      '🪙 +30 Habit Tokens auto-added to your wallet!\n⭐ +15 Gold Points submitted to Parent for review & credit.',
      30,
      50,
      task?.image || generate3DIcon('dentistry', 'blue', 'Brush'),
      'dentistry'
    );
    this.saveState();
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
    Sound.chirp();
    Sound.coin();
    this.saveState();
  }

  playWithPet(petId) {
    const id = petId || this.state.selectedHero.activePetId || 1;
    if (!this.state.petStatsMap[id]) this.state.petStatsMap[id] = { hunger: 75, hygiene: 90, energy: 65, joy: 85 };
    const stats = this.state.petStatsMap[id];

    // Increases BOTH Joy and Energy (not decreasing)
    stats.joy = Math.min(100, stats.joy + 20);
    stats.energy = Math.min(100, stats.energy + 15);
    this.addXP(15);
    Sound.chirp();
    this.saveState();
  }

  equipPetGear(gearTitle, petId) {
    const id = petId || this.state.selectedHero?.activePetId || 1;
    if (!this.state.equippedGearMap) {
      this.state.equippedGearMap = {};
    }
    this.state.equippedGearMap[id] = gearTitle;
    this.state.equippedPetGear = gearTitle;
    if (this.state.selectedHero) {
      this.state.selectedHero.equippedPetGear = gearTitle;
    }
    Sound.fanfare();
    confetti({
      particleCount: 45,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#f1c40f', '#2ecc71', '#3498db']
    });
    this.saveState();
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
    this.saveState();
    this.notify();
  }

  getEquippedPetGear(petId) {
    const id = petId || this.state.selectedHero?.activePetId || 1;
    if (this.state.equippedGearMap && this.state.equippedGearMap[id] !== undefined) {
      return this.state.equippedGearMap[id];
    }
    return this.state.selectedHero?.equippedPetGear || this.state.equippedPetGear || null;
  }

  bathPetProgress(amount = 20, petId) {
    const id = petId || this.state.selectedHero.activePetId || 1;
    if (!this.state.petStatsMap[id]) this.state.petStatsMap[id] = { hunger: 75, hygiene: 60, energy: 65, joy: 85 };
    const stats = this.state.petStatsMap[id];
    stats.hygiene = Math.min(100, (stats.hygiene || 60) + amount);
    this.saveState();
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
    this.saveState();
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
    Sound.fanfare();
    confetti({ particleCount: 140, spread: 100, origin: { y: 0.5 } });

    let title = 'First Companion Adopted!';
    let msg = `Welcome ${pet?.name || 'your pet'}! They start at Stage 1 (Mystic Egg/Hatchling). Brush, complete habits, and feed them to evolve!`;
    if (type === 'second_pet') {
      title = '2nd Free Pet Unlocked!';
      msg = `${pet?.name} joined your team at Stage 1 for evolving your first pet to Stage 2!`;
    } else if (type === 'third_pet') {
      title = '3rd Free Pet Unlocked!';
      msg = `${pet?.name} joined your team at Stage 1 for evolving your first two pets through all 4 stages into Golden Titans!`;
    }

    this.showReward(title, msg, 50, 0, pet?.avatar, 'pets');
    this.saveState();
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
    this.saveState();
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
    this.saveState();
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
      this.saveState();

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

  masterFusePets(petId1, petId2) {
    const pet1 = this.state.pets.find(p => p.id === petId1);
    const pet2 = this.state.pets.find(p => p.id === petId2);
    if (!pet1 || !pet2) return;

    const hybridId = 100 + this.state.fusedPets.length + 1;
    const hybridPet = {
      id: hybridId,
      name: `${pet1.name.split(' ')[0]}-${pet2.name.split(' ')[0]} Titan`,
      title: "The Master Fusion Ascendant",
      element: `${pet1.element} & ${pet2.element}`,
      color: "#f1c40f",
      accentColor: "#2ecc71",
      avatar: pet1.evolvedAvatar || pet1.avatar,
      backstory: `Forged in the Master Fusion Chamber by combining the heroic essences of ${pet1.name} and ${pet2.name}! Possesses cosmic power!`,
      habitBonus: "Master Synergy: Grants +50% Tokens on ALL completed daily chores!",
      baseStats: { hunger: 100, hygiene: 100, energy: 100, joy: 100 },
      evolutionStages: ["Fusion Spark", "Cyber Core", "Titan Vanguard", "Cosmic Sovereign"],
      exclusiveGear: [
        { name: "Infinity Fusion Core", desc: "Doubles token yields globally", unlocked: true, icon: "auto_awesome" },
        { name: "Cosmic Sun Wings", desc: "Immunity to task failure", unlocked: true, icon: "flight" }
      ]
    };

    this.state.pets.push(hybridPet);
    this.state.fusedPets.push(hybridPet);
    this.state.petStageMap[hybridId] = 4;
    this.state.selectedHero.activePetId = hybridId;

    Sound.levelUp();
    Sound.fanfare();
    confetti({
      particleCount: 200,
      spread: 140,
      origin: { y: 0.4 },
      colors: ['#f1c40f', '#54e98a', '#3498db', '#ffffff']
    });

    this.showReward(
      'MASTER FUSE SUCCESS!',
      `Created ${hybridPet.name}! Equipped as your new active companion!`,
      150,
      200,
      hybridPet.avatar,
      'auto_awesome'
    );
    this.saveState();
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
    this.saveState();
  }

  buyDigitalGear(gearId) {
    const item = this.state.digitalGear.find((i) => i.id === gearId);
    if (!item) return;

    if (this.state.inventory.includes(item.title)) {
      this.state.equippedPetGear = item.title;
      Sound.fanfare();
      confetti({ particleCount: 40, spread: 50 });
      this.showReward(
        'Gear Equipped!',
        `Your avatar and pet companion are now equipped with ${item.title}!`,
        0,
        0,
        item.image
      );
      this.saveState();
      return;
    }

    if (this.state.selectedHero.coins < item.costCoins) {
      Sound.hit();
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
    this.addXP(25);
    Sound.coin();
    Sound.fanfare();

    confetti({
      particleCount: 80,
      spread: 90,
      origin: { y: 0.6 },
      colors: ['#f1c40f', '#2ecc71', '#ffb961']
    });

    this.logAction(`${this.state.selectedHero.name} bought ${item.title}`, `Cost: ${item.costCoins} Tokens 🪙`);
    this.showReward(
      `Unlocked & Equipped: ${item.title}!`,
      'Added to inventory and active companion! Great job saving your tokens!',
      0,
      25,
      item.image
    );
    this.saveState();
  }

  approveParentRequest(reqId) {
    const reqIndex = this.state.pendingApprovals.findIndex(r => r.id === reqId);
    if (reqIndex === -1) return;
    const req = this.state.pendingApprovals[reqIndex];

    const hero = this.state.heroes.find(h => h.id === req.kidId) || this.state.selectedHero;

    if (req.type === 'task_point_approval' || req.type === 'task') {
      const pointsToAward = req.pendingPoints || req.rewardPoints || 10;
      hero.points += pointsToAward;
      if (this.state.selectedHero.id === hero.id) {
        this.state.selectedHero.points = hero.points;
      }

      let taskItem = null;
      if (req.taskId) {
        const habit = this.state.habitIslands.find(h => h.id === req.taskId);
        if (habit) { habit.pointsApproved = true; taskItem = habit; }
        const task = this.state.taskForest.find(t => t.id === req.taskId);
        if (task) { task.pointsApproved = true; taskItem = task; }
      }

      this.logAction(`Parent verified '${req.title}' for ${req.kidName}`, `+${pointsToAward} Points ⭐ Credited to Balance`);
      this.showReward(
        'Points Approved!',
        `+${pointsToAward} Gold Points ⭐ officially credited to ${req.kidName}'s wallet!`,
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
    this.saveState();
  }

  rejectParentRequest(reqId) {
    const reqIndex = this.state.pendingApprovals.findIndex(r => r.id === reqId);
    if (reqIndex === -1) return;
    const req = this.state.pendingApprovals[reqIndex];

    if (req.type === 'task_point_approval' || req.type === 'task') {
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
    this.saveState();
  }

  // Clear all pending parent approval notifications and reset buttons across all tasks & habits
  clearAllPendingApprovals() {
    // 1. Clear state.pendingApprovals
    this.state.pendingApprovals = [];

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
    this.saveState();
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
    this.saveState();
    this.notify();
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
    this.state.petStatsMap[id].energy -= game.energyCost;

    if (isWin) {
      this.state.selectedHero.coins += game.rewardCoins;
      this.addXP(game.rewardXP);
      this.state.petStatsMap[id].joy = Math.min(100, this.state.petStatsMap[id].joy + 15);
      Sound.fanfare();
      confetti({ particleCount: 80, spread: 90, origin: { y: 0.6 } });
      this.showReward(
        'Adventure Cleared!',
        `You mastered ${game.title}! +${game.rewardCoins} Habit Tokens auto-added & +${game.rewardXP} XP!`,
        game.rewardCoins,
        game.rewardXP,
        null,
        game.icon
      );
    }
    this.saveState();
  }

  switchHero(heroId) {
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
      this.state.selectedHero.level = hero.level;
      this.state.selectedHero.points = hero.points;
      this.state.selectedHero.coins = hero.coins;
      this.state.selectedHero.activePetId = hero.activePetId || (hero.unlockedPetIds[0] || null);
      this.state.selectedHero.unlockedPetIds = [...hero.unlockedPetIds];
      this.state.selectedHero.hasChosenStarterPet = hero.hasChosenStarterPet;
      this.state.selectedHero.habitatSlots = hero.habitatSlots;
      this.state.selectedHero.streak = hero.streak;
      this.state.selectedHero.gameDifficulty = hero.gameDifficulty || 'medium';
      this.state.selectedHero.equippedProfileTheme = hero.equippedProfileTheme || 'theme_dragon_emerald';
      this.state.selectedHero.unlockedThemes = hero.unlockedThemes || ['theme_dragon_emerald'];

      // Synchronize global petStageMap with this hero's petStageMap
      this.state.petStageMap = { ...hero.petStageMap };

      Sound.fanfare();
      this.saveState();
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
      activePetId: null,
      unlockedPetIds: [],
      hasChosenStarterPet: false,
      habitatSlots: 1,
      petStageMap: {},
      streak: 1,
      completionRate: 100,
      gameDifficulty: gameDifficulty || 'medium',
      equippedProfileTheme: 'theme_dragon_emerald',
      unlockedThemes: ['theme_dragon_emerald']
    };
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
    if (updatedData.coins !== undefined) hero.coins = Math.max(0, Number(updatedData.coins));
    if (updatedData.points !== undefined) hero.points = Math.max(0, Number(updatedData.points));

    // If currently active hero was edited, synchronize selectedHero
    if (this.state.selectedHero.id === heroId) {
      this.state.selectedHero.name = hero.name;
      this.state.selectedHero.title = hero.role;
      this.state.selectedHero.avatar = hero.avatar;
      this.state.selectedHero.gameDifficulty = hero.gameDifficulty;
      this.state.selectedHero.level = hero.level;
      this.state.selectedHero.coins = hero.coins;
      this.state.selectedHero.points = hero.points;
    }

    this.saveState();
    Sound.fanfare();
  }

  // Delete a Kid Profile
  deleteHero(heroId) {
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
      this.state.heroes.push(freshHero);
      this.switchHero(freshHero.id);
    } else if (this.state.selectedHero.id === heroId) {
      // Switch active hero to the first remaining kid
      this.switchHero(this.state.heroes[0].id);
    } else {
      this.saveState();
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
    this.saveState();
    Sound.fanfare();

    // Connect to new Firestore household document
    import('../services/firestoreSyncService.js').then(({ firestoreSync }) => {
      firestoreSync.startSync(newSyncCode);
    }).catch(() => {});

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
    this.notify();
  }

  isParentUnlocked() {
    return this.isParentSessionUnlocked === true;
  }

  isEasyMode() {
    const hero = this.state.selectedHero;
    if (!hero) return false;
    return (
      hero.gameDifficulty === 'easy' ||
      hero.difficulty === 'easy' ||
      (hero.age && hero.age <= 4)
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
    this.saveState();
    this.notify();
  }

  /**
   * Hydrate store with real-time cloud data from Firestore
   * Automatically updates heroes, tasks, habits, inventory, and persists to localStorage
   */
  hydrateFromCloud(cloudData) {
    if (!cloudData) return;

    // 1. Household Details
    if (cloudData.householdName) {
      this.state.household.name = cloudData.householdName;
    }
    if (cloudData.syncCode || cloudData.householdCode) {
      this.state.household.syncCode = (cloudData.syncCode || cloudData.householdCode).trim().toUpperCase();
    }
    this.state.household.lastSync = 'Synced Just Now';

    // 2. Heroes
    if (cloudData.heroes && Array.isArray(cloudData.heroes) && cloudData.heroes.length > 0) {
      this.state.heroes = cloudData.heroes;

      // Sync active selectedHero
      const currentId = this.state.selectedHero?.id;
      const matchedHero = this.state.heroes.find((h) => h.id === currentId);
      const baseHero = matchedHero || this.state.heroes[0];

      this.state.selectedHero = {
        ...defaultState.selectedHero,
        ...baseHero,
        name: baseHero.name,
        title: baseHero.role || baseHero.title,
        avatar: baseHero.avatar,
        coins: baseHero.coins ?? 0,
        points: baseHero.points ?? 0,
        level: baseHero.level ?? 1,
        activePetId: baseHero.activePetId || (baseHero.unlockedPetIds?.[0] || null),
        unlockedPetIds: baseHero.unlockedPetIds || [],
        hasChosenStarterPet: baseHero.hasChosenStarterPet ?? (baseHero.unlockedPetIds?.length > 0),
        habitatSlots: baseHero.habitatSlots || 1,
        petStageMap: baseHero.petStageMap || {},
        streak: baseHero.streak || 1,
        completionRate: baseHero.completionRate ?? 100,
        gameDifficulty: baseHero.gameDifficulty || 'medium',
        equippedProfileTheme: baseHero.equippedProfileTheme || 'theme_dragon_emerald',
        unlockedThemes: baseHero.unlockedThemes || ['theme_dragon_emerald']
      };
    }

    // 3. Approvals, Chores, Habits, Settings
    if (cloudData.pendingApprovals !== undefined) {
      this.state.pendingApprovals = Array.isArray(cloudData.pendingApprovals) ? cloudData.pendingApprovals : [];
    }
    if (cloudData.petStatsMap) this.state.petStatsMap = { ...this.state.petStatsMap, ...cloudData.petStatsMap };
    if (cloudData.petStageMap) this.state.petStageMap = { ...this.state.petStageMap, ...cloudData.petStageMap };
    if (cloudData.equippedGearMap) this.state.equippedGearMap = { ...this.state.equippedGearMap, ...cloudData.equippedGearMap };
    if (cloudData.equippedPetGear !== undefined) this.state.equippedPetGear = cloudData.equippedPetGear;
    if (cloudData.taskForest && Array.isArray(cloudData.taskForest)) this.state.taskForest = cloudData.taskForest;
    if (cloudData.habitIslands && Array.isArray(cloudData.habitIslands)) this.state.habitIslands = cloudData.habitIslands;
    if (cloudData.realLifeRewards && Array.isArray(cloudData.realLifeRewards)) this.state.realLifeRewards = cloudData.realLifeRewards;
    if (cloudData.digitalGear && Array.isArray(cloudData.digitalGear)) this.state.digitalGear = cloudData.digitalGear;
    if (cloudData.inventory && Array.isArray(cloudData.inventory)) this.state.inventory = cloudData.inventory;
    if (cloudData.parentSettings) this.state.parentSettings = { ...this.state.parentSettings, ...cloudData.parentSettings };
    if (cloudData.profileThemes && Array.isArray(cloudData.profileThemes)) this.state.profileThemes = cloudData.profileThemes;

    // 4. Linked Devices Count
    if (cloudData.devices && typeof cloudData.devices === 'object') {
      const now = Date.now();
      const activeDevs = Object.entries(cloudData.devices).filter(([, dev]) => {
        if (!dev || !dev.lastSeen) return true;
        return now - new Date(dev.lastSeen).getTime() < 86400000 * 3;
      });
      this.state.household.linkedDevices = Math.max(1, activeDevs.length);
    }

    // 5. Persist to actual localStorage key
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

  resetAllProgress() {
    this.state = JSON.parse(JSON.stringify(defaultState));
    this.saveState();
  }
}

export const store = new Store();
