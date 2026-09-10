import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db, ensureAuth } from '../lib/firebase';
import { HeroProfile, PetNeedState, ShopItem } from '../types';
import { INITIAL_HEROES, INITIAL_PET, INITIAL_SHOP_ITEMS } from '../data/initialData';

const USERS_COLLECTION = 'users';

export interface UserFirestoreDoc {
  id: string;
  name: string;
  level: number;
  xp: number;
  maxXp: number;
  coins: number;
  points: number;
  tokens: number;
  energy: number;
  maxEnergy: number;
  streakDays: number;
  avatarUrl: string;
  roleTitle: string;
  lastSeen: string;
  inventory: string[];
  unlockedShopItemIds: string[];
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
  pet?: PetNeedState;
  updatedAt?: any;
}

/**
 * Converts a HeroProfile to a clean Firestore document payload
 */
export const heroToFirestoreDoc = (
  hero: HeroProfile,
  unlockedShopItemIds?: string[],
  pet?: PetNeedState
): UserFirestoreDoc => {
  return {
    id: hero.id,
    name: hero.name,
    level: hero.level || 1,
    xp: hero.xp || 0,
    maxXp: hero.maxXp || 200,
    coins: hero.coins ?? 50,
    points: hero.points ?? 10,
    tokens: hero.tokens ?? 5,
    energy: hero.energy ?? 30,
    maxEnergy: hero.maxEnergy ?? 30,
    streakDays: hero.streakDays ?? 1,
    avatarUrl: hero.avatarUrl || '',
    roleTitle: hero.roleTitle || 'Adventurer',
    lastSeen: hero.lastSeen || new Date().toISOString(),
    inventory: hero.inventory || [],
    unlockedShopItemIds: unlockedShopItemIds || hero.inventory || [],
    equippedStickers: hero.equippedStickers || ['💧', '📚', '🦷'],
    cardSkin: hero.cardSkin || {
      id: 'skin-blue',
      name: 'Classic Blue',
      bgColor: '#1E293B',
      borderColor: '#3498DB',
      shadowColor: '#2980B9',
    },
    equippedGear: hero.equippedGear || {},
    pet: pet || INITIAL_PET,
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Subscribes to all hero profiles in Firestore 'users' collection in real time using onSnapshot.
 * Any update on any device (XP, coins, pet, stickers, gear) reflects immediately.
 */
export const subscribeToAllHeroes = (
  onUpdate: (result: {
    heroes: HeroProfile[];
    unlockedShopItemIds: Record<string, string[]>;
    petStates: Record<string, PetNeedState>;
  }) => void,
  onError?: (error: Error) => void
) => {
  ensureAuth().catch((e) => console.warn('ensureAuth error:', e));
  const usersCol = collection(db, USERS_COLLECTION);

  return onSnapshot(
    usersCol,
    async (snapshot) => {
      if (snapshot.empty) {
        console.log('🌱 Seeding initial hero profiles to Firestore users collection in real time...');
        const seededHeroes: HeroProfile[] = [];
        const shopMap: Record<string, string[]> = {};
        const petMap: Record<string, PetNeedState> = {};

        for (const hero of INITIAL_HEROES) {
          const initialShopUnlocked = INITIAL_SHOP_ITEMS.filter((i) => i.unlocked).map((i) => i.id);
          const docPayload = heroToFirestoreDoc(hero, initialShopUnlocked, INITIAL_PET);
          await setDoc(doc(db, USERS_COLLECTION, hero.id), docPayload);
          seededHeroes.push(hero);
          shopMap[hero.id] = initialShopUnlocked;
          petMap[hero.id] = INITIAL_PET;
        }

        onUpdate({
          heroes: seededHeroes,
          unlockedShopItemIds: shopMap,
          petStates: petMap,
        });
        return;
      }

      const heroes: HeroProfile[] = [];
      const shopMap: Record<string, string[]> = {};
      const petMap: Record<string, PetNeedState> = {};

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as UserFirestoreDoc;
        const heroProfile: HeroProfile = {
          id: data.id || docSnap.id,
          name: data.name || 'Hero',
          level: data.level ?? 1,
          xp: data.xp ?? 0,
          maxXp: data.maxXp ?? 200,
          coins: data.coins ?? 50,
          points: data.points ?? 10,
          tokens: data.tokens ?? 5,
          energy: data.energy ?? 30,
          maxEnergy: data.maxEnergy ?? 30,
          streakDays: data.streakDays ?? 1,
          avatarUrl: data.avatarUrl || '',
          roleTitle: data.roleTitle || 'Hero',
          lastSeen: data.lastSeen || 'Active now',
          inventory: data.inventory || [],
          equippedStickers: data.equippedStickers || ['💧', '📚', '🦷'],
          cardSkin: data.cardSkin,
          equippedGear: data.equippedGear || {},
        };

        heroes.push(heroProfile);
        shopMap[heroProfile.id] = data.unlockedShopItemIds || data.inventory || [];
        if (data.pet) {
          petMap[heroProfile.id] = data.pet;
        }
      });

      onUpdate({
        heroes,
        unlockedShopItemIds: shopMap,
        petStates: petMap,
      });
    },
    (err) => {
      console.warn('subscribeToAllHeroes error:', err);
      if (onError) onError(err);
    }
  );
};

/**
 * Loads all hero profiles from Firestore using onSnapshot subscription.
 */
export const loadHeroesFromFirestore = (): Promise<{
  heroes: HeroProfile[];
  unlockedShopItemIds: Record<string, string[]>;
  petStates: Record<string, PetNeedState>;
}> => {
  return new Promise((resolve) => {
    let unsub: (() => void) | null = null;
    unsub = subscribeToAllHeroes(
      (res) => {
        if (unsub) {
          unsub();
          unsub = null;
        }
        resolve(res);
      },
      (err) => {
        console.warn('loadHeroesFromFirestore fallback:', err);
        resolve({
          heroes: INITIAL_HEROES,
          unlockedShopItemIds: {},
          petStates: {},
        });
      }
    );
  });
};

/**
 * Saves or updates a kid's HeroProfile in Firestore 'users/{heroId}'
 */
export const saveHeroProfileToFirestore = async (
  hero: HeroProfile,
  unlockedShopItemIds?: string[],
  pet?: PetNeedState
): Promise<boolean> => {
  try {
    await ensureAuth();
    const userDocRef = doc(db, USERS_COLLECTION, hero.id);
    const payload = heroToFirestoreDoc(hero, unlockedShopItemIds, pet);
    await setDoc(userDocRef, payload, { merge: true });
    return true;
  } catch (error) {
    console.error(`Failed to save hero ${hero.id} to Firestore:`, error);
    return false;
  }
};

/**
 * Updates stats specifically (coins, points, xp, level) in Firestore
 */
export const updateHeroStatsInFirestore = async (
  heroId: string,
  stats: {
    coins?: number;
    points?: number;
    xp?: number;
    level?: number;
    streakDays?: number;
    energy?: number;
    inventory?: string[];
    unlockedShopItemIds?: string[];
    equippedStickers?: string[];
    cardSkin?: any;
    equippedGear?: any;
    pet?: PetNeedState;
  }
): Promise<boolean> => {
  try {
    await ensureAuth();
    const userDocRef = doc(db, USERS_COLLECTION, heroId);
    await updateDoc(userDocRef, {
      ...stats,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error(`Failed to update hero stats in Firestore for ${heroId}:`, error);
    return false;
  }
};

/**
 * Sets up a real-time listener for a kid's hero document
 */
export const subscribeToHeroDocument = (
  heroId: string,
  onUpdate: (data: UserFirestoreDoc) => void
) => {
  const userDocRef = doc(db, USERS_COLLECTION, heroId);
  return onSnapshot(
    userDocRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data() as UserFirestoreDoc);
      }
    },
    (err) => {
      console.warn('Firestore snapshot error:', err);
    }
  );
};
