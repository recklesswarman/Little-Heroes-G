export interface HeroProfile {
  id: string;
  name: string;
  level: number;
  xp: number;
  maxXp: number;
  avatarUrl: string;
  roleTitle: string;
  lastSeen: string;
  streakDays: number;
  energy: number;
  maxEnergy: number;
  points: number; // For IRL Rewards (Stars ⭐)
  coins: number;  // For Digital Gear & Shop (🪙)
  tokens: number; // For Arcade/Games (🎟️)
  inventory: string[];
  equippedStickers?: string[];
  cardSkin?: {
    id: string;
    name: string;
    bgColor: string;
    borderColor: string;
    shadowColor: string;
  };
  equippedGear: {
    hat?: string;
    cape?: string;
    wand?: string;
    badge?: string;
  };
}

export type TaskCategory = 'task' | 'habit';

export interface TaskItem {
  id: string;
  title: string;
  category: TaskCategory;
  coinsReward: number;
  pointsReward: number;
  icon3dUrl: string;
  description?: string;
  completedToday: boolean;
  streak?: number;
  actionType?: 'instant' | 'ar_brush' | 'clean_toys' | 'feed_pet' | 'read_book' | 'water';
}

export interface PetNeedState {
  name: string;
  species: string;
  stage: 1 | 2 | 3 | 4; // 1: Egg, 2: Baby Drake, 3: Teen Drake, 4: Golden Armor Dragon Lord
  stageName: string;
  heroXp: number;
  maxHeroXp: number;
  hunger: number; // 0 - 100
  hygiene: number; // 0 - 100
  energy: number; // 0 - 100
  joy: number; // 0 - 100
  freeSnacksRemaining: number;
  maxFreeSnacks: number;
  equippedGear?: string;
  petId?: number;
  element?: string;
  habitBonus?: string;
}

export interface PetCompendiumItem {
  id: number;
  name: string;
  element: 'Earth' | 'Water' | 'Air' | 'Magic' | 'Tech' | 'Fire';
  backstory: string;
  habitBonus: string;
  baseStats: {
    hunger: number;
    hygiene: number;
    energy: number;
    joy: number;
  };
  exclusiveGear: string[];
  iconEmoji?: string;
  avatarUrl?: string;
}

export interface ShopItem {
  id: string;
  title: string;
  type: 'digital' | 'real_world';
  subCategory?: string;
  cost: number;
  currency: 'coins' | 'points';
  icon3dUrl: string;
  description: string;
  unlocked?: boolean;
  minLevel?: number;
}

export interface QuestNode {
  id: string;
  title: string;
  description: string;
  energyCost: number;
  coinsReward: number;
  status: 'completed' | 'active' | 'locked';
  xPercent: number;
  yPercent: number;
}
