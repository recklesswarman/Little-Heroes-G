import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';
import { PETS_DATABASE } from '../data/petsData.js';
import { ADVENTURE_GAMES } from '../data/learningGamesData.js';
import { generate3DIcon } from '../utils/graphicsGenerator.js';

const STORAGE_KEY = 'little_heroes_adventure_master_v6';

const defaultState = {
  activeView: 'dashboard', // dashboard, quest_map, pet_pen, pet_roster, pet_detail, pet_bath, shop, ar_battle, evolution, master_fuse, dance_party, profile, parent_portal, adventures_map, adventure_game
  previousView: 'dashboard',
  selectedPetDetailId: 1,
  selectedAdventureGameId: 'phonics_forest',

  // Household Link Architecture
  household: {
    syncCode: 'HERO-8842',
    name: "The Hero Family",
    linkedDevices: 3,
    lastSync: 'Just now'
  },

  // Active Hero Profile
  selectedHero: {
    id: 'leo',
    name: 'Leo',
    title: 'Dragon Explorer',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZfP7_Cwlp4sz41asI8ymuapAKvjmqHtvI4zcMAF_XwUmibj8IheGrS5cA5QD5gmXgVxEkZM9FlWJPRZnct3x6-9SQB7zJKqkEDjJ3m95tAy3zRqS-PbmcQ4kv_9pmIfm2Py4mh3Fw083hkDookz1w4_r50SBA1jc9igDaAPFLYBFgSP2aQBz7Q4jVE-DwhMOyUEHlxDkQk6Gwc2EAFCSKs1c0QuhUOi3tkrk5MXRARKqZcYVzyJe6gA',
    color: '#2ecc71',
    level: 12,
    xp: 450,
    xpNext: 1000,
    points: 120, // ⭐ Points (Parent-approved, spent on Real-Life Rewards)
    coins: 1240,  // 🪙 Tokens (Auto-issued, spent on digital items)
    streak: 5,
    stars: 24,
    activePetId: 1
  },

  heroes: [
    {
      id: 'leo',
      name: 'Leo',
      role: 'Explorer Leader',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZfP7_Cwlp4sz41asI8ymuapAKvjmqHtvI4zcMAF_XwUmibj8IheGrS5cA5QD5gmXgVxEkZM9FlWJPRZnct3x6-9SQB7zJKqkEDjJ3m95tAy3zRqS-PbmcQ4kv_9pmIfm2Py4mh3Fw083hkDookz1w4_r50SBA1jc9igDaAPFLYBFgSP2aQBz7Q4jVE-DwhMOyUEHlxDkQk6Gwc2EAFCSKs1c0QuhUOi3tkrk5MXRARKqZcYVzyJe6gA',
      level: 12,
      points: 120,
      coins: 1240,
      activePetId: 1,
      streak: 5,
      completionRate: 92
    },
    {
      id: 'mia',
      name: 'Mia',
      role: 'Cyber Scout',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuARR2klW8usL-qhZiz0_G-YpTDfniXDjgHoCQ_TULj1qzslQkdWxX4Wq2evyu74EP6D3_HZhuWK7Ur01vaB-ih5z8SIKSqawthIwUeiiFFVbRjUfS_ESM6_-NzIkcPl9lgdpDNEqBDaoiMnhRiHE2oY84NKDgpdDwGB-ns1Pl0rX6OlqQa93LVIUhJuD5us2LFiF8zPaPCw3LYoZuCs5m2Eie-8vAsBx3XfthE2qlYBO4kcHUFrN_gtiA',
      level: 8,
      points: 85,
      coins: 820,
      activePetId: 2,
      streak: 4,
      completionRate: 88
    },
    {
      id: 'sam',
      name: 'Sam',
      role: 'Super Pup',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBt3DBwfpcbbvoWYvwpXt_crRM01oD2FlSmnTjRotHTDi6sCpEpo0HGRngqdUbBC_cgHu1T3JOXkMdw4-qLzPcPEslBONYLu1qXkoOJ6btgq7pAJfCm1FvcueHfEMAmidhqBIchTbwNZKOjkPMEDo6oKzVt1PgftBS6r7sVVYel_-bHhlmi-n4oZI1RzBckf3DMsFIgVmoLzSNj29eK9AS8dChk10e_WQuIwzYNt21e4MKdKn02dg4RWg',
      level: 3,
      points: 40,
      coins: 350,
      activePetId: 3,
      streak: 3,
      completionRate: 75
    },
    {
      id: 'alex',
      name: 'Alex',
      role: 'Knight Adventurer',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAUTWERGwaJXM82ZeJ0adcNsuOm_cR4z5CXAleJ2oKcekqKsuaZZD315RkB188DDt6fevx8guS2V20knvs93SzLKjox7deSVry-v8kiyTM-H0Kg5vmB8inoBoKz2SqYnVzUKVk9uulAHGfsUmnIs4VI7GkWcmmfE2gvPnoehqZqjhxHZuHz9Tqs_Omja5bwoX9aPmW8Xf63V9KIQsux3ucTJHZBdI2U8eRyOy7bO0XQMqe2BNGXc3SoWg',
      level: 5,
      points: 60,
      coins: 610,
      activePetId: 5,
      streak: 4,
      completionRate: 80
    }
  ],

  // Habit Islands (Preset Daily Positive Behaviors)
  habitIslands: [
    {
      id: 'drink_water',
      title: 'Drink 4 Cups of Water',
      zone: 'Habit Islands',
      icon: 'water_drop',
      image: generate3DIcon('water_drop', 'blue', 'Water'),
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
      image: generate3DIcon('nutrition', 'orange', 'Healthy'),
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
      image: generate3DIcon('dentistry', 'blue', 'Brush'),
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
      image: generate3DIcon('toys', 'yellow', 'Toys'),
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
      image: generate3DIcon('menu_book', 'green', 'Reading'),
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
      image: generate3DIcon('bedtime', 'blue', 'Sleep'),
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
  petStageMap: { 1: 2, 2: 4, 3: 4, 4: 1 },
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
      isNew: true,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAXizgI1CeB2yKrFadDQwi_izrUzn5VC61h_Pt83vwDS7sOgRgZ3uicgT9wALkvX1ci0sh5YMVO38ne8-hC2TKHNwDELgpccHrkJ0pdzoxGd6NEOSvV0Fgn44DNrZqYpjJvtTkUY8PDAAGNwSTLlqV7gPcepURR9EiQzW4JSIsm6DC1xO8iXYAz5sSPHnXKpDJeXdMdJ3dLsOkdc3AEaYvcxiGwnPk_T_zTP2rB1AKr5xKxRl0kR873Sg'
    },
    {
      id: 'hero_cape',
      title: 'Bright Blue Hero Cape',
      desc: 'Equip your avatar and pet companion with heroic flight style.',
      category: 'Avatar Gear',
      costCoins: 250,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuByKpaoALsAQKloJoaflKFN3uBQW2_wFzPx91VHRs4HwEN8nq_FFMDP4x9H1iraLFT6ts1An7aMl3x0Gr_2BEpiyfAeWPb1S-OqL_MxKDDkCzvrQcAiVG14D7Wmv4XB_VViBp4TdSvN3MTRO8KLCIWL3S3WaQUqq6-a3hWGomWph08_yJ3FzxocLQjdXxKNUrzhF_Dv-d2DEfkaWLXL4No80J3RlmfBcCreSBpPWJyHEX08C3mTUvmJNw'
    },
    {
      id: 'laser_toothbrush',
      title: 'Laser Toothbrush Sword',
      desc: 'Extra damage against Sugar Bugs in AR Toothbrush Battle Mode!',
      category: 'Weapons',
      costCoins: 150,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD_t1oRwvE1jlA6mYuARa1kila-xbhIvpGqco4NsFrzIp3HYf-AOKXJ6h0qmz4yoUj5sGBJEGG3k47tjpVTOVVpi6PklYYznwt8FgR0WNaQsOt5pu_bL12NJJi8BhBJTz_wmenjPjkJa0Ti7OHXgZH60P9sMBw3yp1NpTX5hoSsiiyu5kNMKZFB84cQhb_qOld0uo2POD-jx_IBi8XnJx9r4ackB2pxI6pssYiWzVQgcV8_JdTOZh5KTA'
    },
    {
      id: 'wizard_hat',
      title: 'Enchanted Wizard Hat',
      desc: 'Adds +20 Wisdom XP to all pet learning mini-games.',
      category: 'Avatar Gear',
      costCoins: 120,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA6ACznHbNqQYrmS2NNT3AogIWVwSpwMd_e-p5JOEqTsWkMcbR3XIie3llrmdu0UVjQ4an-bSZQypLr0rQgc-ZbZMijOEnJW2hkFFTW3YvxnvMF1p_R1DeRzyPAEVOVQn7dVbGBZjMJoNDEEPm43G_Dtol7_U9W9m9iLpImUl0NJfcdAqccaoVs6sGpX3KgGErOnZi9ufcz3KQ-E1PpdUM5P2DeTeu8ePw2Jfrbh1fbQ5aY24ZDCZ3hVw'
    },
    {
      id: 'rocket_badge',
      title: 'Hero Rocket Badge',
      desc: 'A glowing badge that speeds up daily quest completions.',
      category: 'Badges',
      costCoins: 80,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAyH49NXeiOh-BmWLvQkk4zJRjAXmtQ7hPXJ7Dk0YZRO5CkUFz9wJZbjEKmlVlh8U79KHrKqiP4gS0bQgQ2X_vEpRpK_FsuS8WN4RWDw3xj4YlvTofyTWXlgV4nmek6g1R4NxZAaqkv8M1xvOiqIKYrKpTiEJRmk0ulv958iE5iE7ORnAiln2Uw3oaopAOg7Bs6MDXSVDpMo9YKipIHHykc6vVQgFwKQvDtNbqgY1h8N4_Ealg8wrybfA'
    },
    {
      id: 'gem_trove',
      title: 'Crystal Gem Trove',
      desc: 'Stores bonus coins and shines with crystal power in your pen.',
      category: 'Badges',
      costCoins: 150,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDvEPK2k2p8UTY6a_a13uuU4xIdkdywFfYuD-6hXL6loqAk-urCnUbUGdFn-Y19eBDoygO061F0aNul90Ba2JUyfsA-w-3zw4_7pYzFDr1VberTqHQfuSPj2fUJPxNonUg9kWXhB0tivkcacloQX7aSYVFI0gMGh4LxUnHMNOb8AvPWMIBgSUdWC0sxJmD4dJJcdQnnenoMiOhVddEOJO-X7gqho3jVSHQX-aholmgf88Rvee7hDkrcng'
    },
    {
      id: 'flame_kibble_bowl',
      title: 'Flame Kibble Snack Bowl',
      desc: 'Super tasty crunchy pet food that instantly restores +30 Hunger.',
      category: 'Snacks',
      costCoins: 30,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB-3rOJgQurGLPwdAbopzrD38_Tt7Kx4XBDGzb8c4D6SyP_duGB00Hbl0jPDHHNgTri1r3B1Wg_bPaZcVSttkDJ_DdCvdMFpixvZL-t62idBUBkK-YIgAZkPm9aBKKV60saB8oSEyuSlPFh9OuQNa12-35vM3UJLyH9I_bnbsG-CLL_JWYco0EyWRF8eWdzRrr4Ize_vzuXlGXbaekGucbGHZI9m7USTT7cTWZ99v22UCg5FGizLHk1FQ'
    },
    {
      id: 'toy_chest_vault',
      title: 'Secret Toy Chest Vault',
      desc: 'Stows all your hero equipment and adds +10% to toy chore payouts.',
      category: 'Badges',
      costCoins: 180,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDy3Rfu0bcLlMPyE2iHd9P78LdbLHJNOzTdaepeadGKy-vo9vxupk8kFi7ggsSZgSTNyekoC_nPypDwUIyXCrD2-_Z96IqQYN58d5uymrFi6JV8vd3_mbXavdbQXB825ndnaEFa-xL8t9yleVWU-a8f9Cv8ehZ1dNuYJt1w-L5x05lq4gKgpqmuecxkjqj0__taxaDmJ-tSIUV6wqkf6VcM2RD4FoyEzXq6FmcZaYoeIxFG5Aa2iQtu0g'
    },
    {
      id: 'golden_armor_vest',
      title: 'Golden Dragon Armor Vest',
      desc: '+50 Defense and sparkling gold scales for your pet companion.',
      category: 'Avatar Gear',
      costCoins: 180,
      image: generate3DIcon('shield', 'green', 'Dragon Armor')
    },
    {
      id: 'bubble_soap_pack',
      title: 'Mega Blueberry Bubble Soap',
      desc: 'Extra sudsy blueberry scented bath bubbles for pet bath time.',
      category: 'Snacks',
      costCoins: 35,
      image: generate3DIcon('soap', 'blue', 'Blueberry Soap')
    },
    {
      id: 'fire_berry_treat',
      title: 'Fire Berry Snack Pack',
      desc: 'Super tasty flame berries that instantly max Hunger to 100%!',
      category: 'Snacks',
      costCoins: 25,
      image: generate3DIcon('nutrition', 'orange', 'Fire Berries')
    },
    {
      id: 'hero_glowing_cape',
      title: 'Emerald Glowing Cape',
      desc: 'A rugged hero cape that billows with emerald particles.',
      category: 'Avatar Gear',
      costCoins: 220,
      image: generate3DIcon('flag', 'green', 'Emerald Cape')
    },
    {
      id: 'disco_star_badge',
      title: 'Disco Master Badge',
      desc: 'Unlocks golden spotlight mode in Dance Party.',
      category: 'Badges',
      costCoins: 100,
      image: generate3DIcon('stars', 'yellow', 'Disco Star')
    }
  ],

  inventory: ['Enchanted Wizard Hat', 'Hero Rocket Badge', 'Crystal Gem Trove'],
  equippedPetGear: 'Enchanted Wizard Hat',

  // Parent Admin Portal: Action Approvals Queue
  pendingApprovals: [
    {
      id: 'req_1',
      kidId: 'leo',
      kidName: 'Leo',
      type: 'reward',
      title: '30 Mins Screen Time',
      costPoints: 50,
      date: 'Today, 4:15 PM',
      status: 'pending'
    },
    {
      id: 'req_2',
      kidId: 'mia',
      kidName: 'Mia',
      type: 'task_point_approval',
      title: 'Clean Up Toys & Blocks',
      zone: 'Task Forest',
      pendingPoints: 15,
      tokensAwarded: 35,
      date: 'Today, 3:30 PM',
      status: 'pending'
    }
  ],

  // Parent Admin Portal: Ledger Logs History
  taskLedgerLogs: [
    { id: 101, kid: 'Leo', action: 'Auto-Issued +30 Tokens for Morning Toothbrush Battle', payout: '+30 Tokens 🪙 (Auto-Issued)', time: '8:05 AM', status: 'Success' },
    { id: 102, kid: 'Leo', action: 'Submitted +15 Points for Parent Verification (Toothbrush Battle)', payout: '⭐ +15 Points (Pending Parent Sign-off)', time: '8:05 AM', status: 'Pending' },
    { id: 103, kid: 'Mia', action: 'Auto-Issued +15 Tokens for Drink 4 Cups of Water', payout: '+15 Tokens 🪙 (Auto-Issued)', time: '11:20 AM', status: 'Success' },
    { id: 104, kid: 'Leo', action: 'Redeemed Real-Life Reward (30 Mins Screen Time)', payout: '-50 Points ⭐ (Pending Parent Sign-off)', time: '4:15 PM', status: 'Awaiting Sign-off' }
  ],

  // Parent Settings & Difficulty Sliders
  parentSettings: {
    pin: '1234',
    arBattleDuration: 120,
    motionSensitivity: 'medium',
    voicePromptsEnabled: true,
    autoApproveHabits: false,
    dailyScreenTimeLimitMins: 45
  },

  // Reward celebration modal
  rewardModal: null
};

class Store {
  constructor() {
    this.subscribers = new Set();
    this.state = this.loadState();
  }

  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...defaultState, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load store state', e);
    }
    return JSON.parse(JSON.stringify(defaultState));
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      import('../services/firestoreSyncService.js').then(({ firestoreSync }) => {
        firestoreSync.pushStateToCloud();
      }).catch(() => {});
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
    if (this.state.activeView !== viewName) {
      this.state.previousView = this.state.activeView;
      this.state.activeView = viewName;
      if (params.petId) this.state.selectedPetDetailId = params.petId;
      if (params.gameId) this.state.selectedAdventureGameId = params.gameId;
      Sound.click();
      this.saveState();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  getActivePet() {
    const petId = this.state.selectedHero.activePetId || 1;
    const petData = this.state.pets.find((p) => p.id === petId) || this.state.pets[0];
    const stage = this.state.petStageMap[petId] || 2;
    const stats = this.state.petStatsMap[petId] || { hunger: 75, hygiene: 90, energy: 65, joy: 85 };
    return { ...petData, stage, ...stats };
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
  updateAllPricing(realLifeMap, digitalMap) {
    // Update real life reward points costs
    this.state.realLifeRewards.forEach(r => {
      if (realLifeMap[r.id] !== undefined) {
        r.costPoints = Math.max(1, parseInt(realLifeMap[r.id]) || r.costPoints);
      }
    });

    // Update digital gear token costs
    this.state.digitalGear.forEach(g => {
      if (digitalMap[g.id] !== undefined) {
        g.costCoins = Math.max(1, parseInt(digitalMap[g.id]) || g.costCoins);
      }
    });

    this.logAction('Parent updated shop pricing matrix', 'Shop prices updated');
    Sound.fanfare();
    this.showReward('Pricing Updated!', 'All reward prices have been updated in the Hero Shop!', 0, 0, null, 'payments');
    this.saveState();
  }

  // 4. AI REWARD GENERATOR STUDIO WITH 3D GRAPHIC ENGINE
  async generateAIReward(name, type, description, costCoins) {
    try {
      const { firebaseAI } = await import('../services/firebaseAILogicService.js');
      const newItem = await firebaseAI.generateRewardItem(name, type, costCoins);
      if (description && description.trim()) {
        newItem.desc = description.trim();
      }

      this.state.digitalGear.unshift(newItem);
      this.logAction(`Parent AI Studio generated new reward '${newItem.title}'`, `Price: ${newItem.costCoins} Tokens 🪙`);
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
      const iconName = type === 'badge' ? 'military_tech' : type === 'weapon' ? 'colorize' : type === 'snack' ? 'nutrition' : 'shield';
      const colorTheme = type === 'weapon' ? 'blue' : type === 'badge' ? 'yellow' : type === 'snack' ? 'orange' : 'green';
      const generatedGraphic = generate3DIcon(iconName, colorTheme, name.slice(0, 12));

      const newItem = {
        id: 'ai_' + Date.now(),
        title: name,
        desc: description || 'AI Generated custom digital reward created by Parent Admin.',
        category: type === 'gear' ? 'Avatar Gear' : type === 'badge' ? 'Badges' : type === 'weapon' ? 'Weapons' : 'Snacks',
        costCoins: parseInt(costCoins) || 100,
        image: generatedGraphic,
        isNew: true
      };

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

    if (!habit.completed) {
      habit.completed = true;
      habit.pointsApproved = false;

      // 🪙 Tokens are auto-issued immediately
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
      habit.completed = false;
      habit.pointsApproved = false;
      this.state.pendingApprovals = this.state.pendingApprovals.filter(r => r.taskId !== habit.id);
      Sound.click();
    }
    this.saveState();
  }

  // TASK FOREST CHORE COMPLETION
  toggleTaskForest(taskId) {
    const task = this.state.taskForest.find((t) => t.id === taskId);
    if (!task) return;

    if (!task.completed) {
      task.completed = true;
      task.pointsApproved = false;

      // 🪙 Tokens are auto-issued immediately
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
      task.completed = false;
      task.pointsApproved = false;
      this.state.pendingApprovals = this.state.pendingApprovals.filter(r => r.taskId !== task.id);
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

    stats.joy = Math.min(100, stats.joy + 20);
    stats.energy = Math.max(10, stats.energy - 10);
    this.addXP(15);
    Sound.chirp();
    this.saveState();
  }

  bathPetProgress(amount = 20, petId) {
    const id = petId || this.state.selectedHero.activePetId || 1;
    if (!this.state.petStatsMap[id]) this.state.petStatsMap[id] = { hunger: 75, hygiene: 90, energy: 65, joy: 85 };
    const stats = this.state.petStatsMap[id];
    const activePet = this.getActivePet();

    stats.hygiene = Math.min(100, stats.hygiene + amount);
    if (stats.hygiene === 100) {
      stats.joy = Math.min(100, stats.joy + 20);
      this.state.selectedHero.coins += 20;
      this.addXP(25);
      Sound.fanfare();
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      this.showReward(
        'Sparkling Squeaky Clean!',
        'Your pet smells like fresh blueberry bubbles! +20 Habit Tokens auto-issued & +25 XP!',
        20,
        25,
        activePet.avatar,
        'soap'
      );
    }
    this.saveState();
  }

  evolvePet(petId) {
    const id = petId || this.state.selectedHero.activePetId || 1;
    const currentStage = this.state.petStageMap[id] || 1;
    const activePet = this.getActivePet();

    if (currentStage < 4) {
      this.state.petStageMap[id] = currentStage + 1;
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
        `Your companion advanced to Stage ${this.state.petStageMap[id]}! New Golden Armor and Powers Unlocked!`,
        100,
        100,
        activePet.evolvedAvatar || activePet.avatar,
        'military_tech'
      );
      this.saveState();
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
      this.logAction(`Parent rejected Point Approval for '${req.title}' (${req.kidName})`, `0 Points ⭐ Issued`);
      this.showReward(
        'Request Rejected',
        `Point approval for "${req.title}" was declined. 0 Points issued.`,
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
      this.state.selectedHero.id = hero.id;
      this.state.selectedHero.name = hero.name;
      this.state.selectedHero.title = hero.role;
      this.state.selectedHero.avatar = hero.avatar;
      this.state.selectedHero.level = hero.level;
      this.state.selectedHero.points = hero.points;
      this.state.selectedHero.coins = hero.coins;
      this.state.selectedHero.activePetId = hero.activePetId || 1;
      this.state.selectedHero.streak = hero.streak;
      Sound.fanfare();
      this.saveState();
    }
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

  resetAllProgress() {
    this.state = JSON.parse(JSON.stringify(defaultState));
    this.saveState();
  }
}

export const store = new Store();
