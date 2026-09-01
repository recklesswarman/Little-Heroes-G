import React, { useState, useEffect, useRef } from 'react';
import { HeroProfile, TaskItem, PetNeedState, ShopItem } from './types';
import { INITIAL_HEROES, INITIAL_TASKS, INITIAL_PET, INITIAL_SHOP_ITEMS } from './data/initialData';
import { sounds } from './utils/audio';
import {
  loadHeroesFromFirestore,
  saveHeroProfileToFirestore,
  subscribeToHeroDocument,
} from './services/heroFirestoreService';

import { BackgroundShader } from './components/BackgroundShader';
import { HeaderHUD } from './components/HeaderHUD';
import { ProfileSelection } from './components/ProfileSelection';
import { KidDashboard } from './components/KidDashboard';
import { ARToothbrushBattle } from './components/ARToothbrushBattle';
import { PetPenMatrix } from './components/PetPenMatrix';
import { PetDanceParty } from './components/PetDanceParty';
import { HeroRewardsShop } from './components/HeroRewardsShop';
import { AdventureMap } from './components/AdventureMap';
import { HeroThemingEngine } from './components/HeroThemingEngine';
import { PetCompendium } from './components/PetCompendium';
import { ParentPortal } from './components/ParentPortal';
import { PetCompendiumItem } from './types';

type AppView =
  | 'profile_select'
  | 'dashboard'
  | 'ar_toothbrush'
  | 'pet_pen'
  | 'dance_party'
  | 'rewards_shop'
  | 'adventure_map'
  | 'hero_theming'
  | 'pet_compendium'
  | 'parent_portal';

export default function App() {
  // Load persisted state or fallback to defaults
  const [heroes, setHeroes] = useState<HeroProfile[]>(() => {
    const saved = localStorage.getItem('lh_heroes');
    return saved ? JSON.parse(saved) : INITIAL_HEROES;
  });

  const [activeHeroId, setActiveHeroId] = useState<string | null>(() => {
    return localStorage.getItem('lh_active_hero_id') || 'hero-1';
  });

  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    const saved = localStorage.getItem('lh_tasks');
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });

  const [petState, setPetState] = useState<PetNeedState>(() => {
    const saved = localStorage.getItem('lh_pet');
    return saved ? JSON.parse(saved) : INITIAL_PET;
  });

  const [shopItems, setShopItems] = useState<ShopItem[]>(() => {
    const saved = localStorage.getItem('lh_shop');
    return saved ? JSON.parse(saved) : INITIAL_SHOP_ITEMS;
  });

  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [celebrationEffect, setCelebrationEffect] = useState(false);
  const [cloudSynced, setCloudSynced] = useState<boolean>(false);

  // Firestore Initialization & Data Hydration
  useEffect(() => {
    let isMounted = true;
    const initFirestoreData = async () => {
      try {
        const { heroes: cloudHeroes, unlockedShopItemIds, petStates } =
          await loadHeroesFromFirestore();

        if (!isMounted) return;

        if (cloudHeroes && cloudHeroes.length > 0) {
          setHeroes(cloudHeroes);
          const currentActiveId = activeHeroId || cloudHeroes[0].id;
          const currentHero = cloudHeroes.find((h) => h.id === currentActiveId) || cloudHeroes[0];

          // Sync unlocked shop items based on active hero inventory
          const unlockedIds = unlockedShopItemIds[currentHero.id] || currentHero.inventory || [];
          setShopItems((prevItems) =>
            prevItems.map((item) => ({
              ...item,
              unlocked: unlockedIds.includes(item.id) || item.unlocked,
            }))
          );

          // Sync Pet state from Firestore
          if (petStates[currentHero.id]) {
            setPetState(petStates[currentHero.id]);
          }
        }
        setCloudSynced(true);
      } catch (err) {
        console.warn('Firestore initial fetch fallback:', err);
      }
    };

    initFirestoreData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Real-time listener for current active hero profile in Firestore
  useEffect(() => {
    if (!activeHeroId) return;

    const unsubscribe = subscribeToHeroDocument(activeHeroId, (data) => {
      setCloudSynced(true);
      setHeroes((prev) =>
        prev.map((h) => {
          if (h.id === activeHeroId) {
            return {
              ...h,
              coins: data.coins ?? h.coins,
              points: data.points ?? h.points,
              xp: data.xp ?? h.xp,
              maxXp: data.maxXp ?? h.maxXp,
              level: data.level ?? h.level,
              inventory: data.inventory || h.inventory,
              equippedStickers: data.equippedStickers || h.equippedStickers,
              cardSkin: data.cardSkin || h.cardSkin,
              equippedGear: data.equippedGear || h.equippedGear,
            };
          }
          return h;
        })
      );

      if (data.unlockedShopItemIds || data.inventory) {
        const unlocked = data.unlockedShopItemIds || data.inventory || [];
        setShopItems((prev) =>
          prev.map((item) => ({
            ...item,
            unlocked: unlocked.includes(item.id) || item.unlocked,
          }))
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeHeroId]);

  // Local storage backup persistence
  useEffect(() => {
    localStorage.setItem('lh_heroes', JSON.stringify(heroes));
  }, [heroes]);

  useEffect(() => {
    if (activeHeroId) {
      localStorage.setItem('lh_active_hero_id', activeHeroId);
    }
  }, [activeHeroId]);

  useEffect(() => {
    localStorage.setItem('lh_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('lh_pet', JSON.stringify(petState));
  }, [petState]);

  useEffect(() => {
    localStorage.setItem('lh_shop', JSON.stringify(shopItems));
  }, [shopItems]);

  const activeHero = heroes.find((h) => h.id === activeHeroId) || heroes[0];

  // Helper to update active hero and persist to Firestore
  const updateActiveHero = (updater: (prev: HeroProfile) => HeroProfile) => {
    setHeroes((prevList) => {
      const nextList = prevList.map((h) => (h.id === activeHero.id ? updater(h) : h));
      const updatedHero = nextList.find((h) => h.id === activeHero.id);
      if (updatedHero) {
        const unlockedIds = shopItems.filter((i) => i.unlocked).map((i) => i.id);
        saveHeroProfileToFirestore(updatedHero, unlockedIds, petState);
      }
      return nextList;
    });
  };

  // Complete a Task
  const handleCompleteTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completedToday: true } : t))
    );

    updateActiveHero((h) => ({
      ...h,
      coins: h.coins + task.coinsReward,
      points: h.points + task.pointsReward,
      xp: Math.min(h.maxXp, h.xp + 25),
    }));

    // Trigger celebration shader briefly
    setCelebrationEffect(true);
    setTimeout(() => setCelebrationEffect(false), 2500);
  };

  // AR Toothbrush Reward flow
  const handleARRewardEarned = (coinsEarned: number, pointsEarned: number) => {
    updateActiveHero((h) => ({
      ...h,
      coins: h.coins + coinsEarned,
      points: h.points + pointsEarned,
      xp: Math.min(h.maxXp, h.xp + 50),
    }));

    // Mark brush task as done
    setTasks((prev) =>
      prev.map((t) =>
        t.actionType === 'ar_brush' ? { ...t, completedToday: true } : t
      )
    );

    setCelebrationEffect(true);
    setTimeout(() => setCelebrationEffect(false), 3000);
    setCurrentView('dashboard');
  };

  // Shop Purchase - Persists coins/points deduction & unlocked inventory to Firestore
  const handlePurchaseShopItem = (item: ShopItem) => {
    let newCoins = activeHero.coins;
    let newPoints = activeHero.points;

    if (item.currency === 'coins') {
      if (activeHero.coins < item.cost) return;
      newCoins = activeHero.coins - item.cost;
    } else {
      if (activeHero.points < item.cost) return;
      newPoints = activeHero.points - item.cost;
    }

    const nextInventory = Array.from(new Set([...(activeHero.inventory || []), item.id]));

    const updatedHero: HeroProfile = {
      ...activeHero,
      coins: newCoins,
      points: newPoints,
      inventory: nextInventory,
    };

    setHeroes((prev) =>
      prev.map((h) => (h.id === updatedHero.id ? updatedHero : h))
    );

    setShopItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, unlocked: true } : i))
    );

    const allUnlocked = Array.from(
      new Set([...shopItems.filter((i) => i.unlocked).map((i) => i.id), item.id])
    );

    saveHeroProfileToFirestore(updatedHero, allUnlocked, petState);
  };

  // Spend coins
  const handleSpendCoins = (amount: number): boolean => {
    if (activeHero.coins < amount) {
      alert("Not enough Habit Coins! Finish chores in the Forest!");
      return false;
    }
    updateActiveHero((h) => ({ ...h, coins: h.coins - amount }));
    return true;
  };

  const handleAddCoins = (amount: number) => {
    updateActiveHero((h) => ({ ...h, coins: h.coins + amount }));
  };

  const handleCreateNewHero = (name: string, avatarUrl: string) => {
    const newHero: HeroProfile = {
      id: `hero-${Date.now()}`,
      name,
      avatarUrl,
      level: 1,
      roleTitle: 'Rookie Adventurer',
      lastSeen: 'Active today',
      points: 10,
      coins: 50,
      tokens: 5,
      energy: 30,
      maxEnergy: 30,
      streakDays: 1,
      xp: 0,
      maxXp: 200,
      inventory: [],
      equippedGear: {},
      equippedStickers: ['💧', '📚', '🦷'],
    };
    setHeroes((prev) => [...prev, newHero]);
    setActiveHeroId(newHero.id);
    saveHeroProfileToFirestore(newHero, [], INITIAL_PET);
    setCurrentView('dashboard');
  };

  const handleSelectActivePet = (newPet: PetCompendiumItem) => {
    const updatedPet: PetNeedState = {
      ...petState,
      name: newPet.name,
      species: `${newPet.element} Guardian`,
      element: newPet.element,
      habitBonus: newPet.habitBonus,
      hunger: newPet.baseStats.hunger,
      hygiene: newPet.baseStats.hygiene,
      energy: newPet.baseStats.energy,
      joy: newPet.baseStats.joy,
      petId: newPet.id,
    };
    setPetState(updatedPet);
    const unlockedIds = shopItems.filter((i) => i.unlocked).map((i) => i.id);
    saveHeroProfileToFirestore(activeHero, unlockedIds, updatedPet);
  };

  const handleUpdatePetState = (updater: PetNeedState | ((prev: PetNeedState) => PetNeedState)) => {
    setPetState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const unlockedIds = shopItems.filter((i) => i.unlocked).map((i) => i.id);
      saveHeroProfileToFirestore(activeHero, unlockedIds, next);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#09141e] text-white flex flex-col relative selection:bg-[#54e98a] selection:text-black">
      {/* Dynamic Starry WebGL Background */}
      <BackgroundShader mode={celebrationEffect ? 'celebration' : 'ambient'} />

      {/* Top HUD (Shown on non-fullscreen views) */}
      {currentView !== 'profile_select' &&
        currentView !== 'ar_toothbrush' &&
        currentView !== 'dance_party' &&
        currentView !== 'parent_portal' && (
          <HeaderHUD
            hero={activeHero}
            soundEnabled={soundEnabled}
            cloudSynced={cloudSynced}
            onToggleSound={() => {
              const next = sounds.toggleSound();
              setSoundEnabled(next);
            }}
            onOpenParentLock={() => setCurrentView('parent_portal')}
            onSwitchProfile={() => setCurrentView('profile_select')}
          />
        )}

      {/* VIEW ROUTER */}
      <main className="flex-1 w-full">
        {currentView === 'profile_select' && (
          <ProfileSelection
            heroes={heroes}
            onSelectHero={(hero) => {
              setActiveHeroId(hero.id);
              setCurrentView('dashboard');
            }}
            onOpenParentLock={() => setCurrentView('parent_portal')}
            onCreateHero={handleCreateNewHero}
          />
        )}

        {currentView === 'dashboard' && (
          <KidDashboard
            hero={activeHero}
            tasks={tasks}
            pet={petState}
            onCompleteTask={handleCompleteTask}
            onOpenARBrush={() => setCurrentView('ar_toothbrush')}
            onOpenPetMatrix={() => setCurrentView('pet_pen')}
            onOpenShop={() => setCurrentView('rewards_shop')}
            onOpenAdventureMap={() => setCurrentView('adventure_map')}
            onOpenTheming={() => setCurrentView('hero_theming')}
            onOpenPetCompendium={() => setCurrentView('pet_compendium')}
          />
        )}

        {currentView === 'hero_theming' && (
          <HeroThemingEngine
            hero={activeHero}
            onUpdateHero={(updatedHero) => {
              setHeroes((prev) =>
                prev.map((h) => (h.id === updatedHero.id ? updatedHero : h))
              );
              const unlockedIds = shopItems.filter((i) => i.unlocked).map((i) => i.id);
              saveHeroProfileToFirestore(updatedHero, unlockedIds, petState);
            }}
            onClose={() => setCurrentView('dashboard')}
          />
        )}

        {currentView === 'pet_compendium' && (
          <PetCompendium
            activePet={petState}
            onSelectActivePet={handleSelectActivePet}
            onClose={() => setCurrentView('dashboard')}
          />
        )}

        {currentView === 'ar_toothbrush' && (
          <ARToothbrushBattle
            onExit={() => setCurrentView('dashboard')}
            onRewardEarned={handleARRewardEarned}
          />
        )}

        {currentView === 'pet_pen' && (
          <PetPenMatrix
            pet={petState}
            coins={activeHero.coins}
            onUpdatePet={handleUpdatePetState}
            onSpendCoins={handleSpendCoins}
            onAddCoins={handleAddCoins}
            onBackToDashboard={() => setCurrentView('dashboard')}
            onLaunchDanceParty={() => setCurrentView('dance_party')}
            onOpenAdventureMap={() => setCurrentView('adventure_map')}
            onOpenPetCompendium={() => setCurrentView('pet_compendium')}
          />
        )}

        {currentView === 'dance_party' && (
          <PetDanceParty
            onExit={() => setCurrentView('pet_pen')}
            onDanceComplete={(coinsEarned) => {
              handleAddCoins(coinsEarned);
              setCelebrationEffect(true);
              setTimeout(() => setCelebrationEffect(false), 2500);
              setCurrentView('pet_pen');
            }}
          />
        )}

        {currentView === 'rewards_shop' && (
          <HeroRewardsShop
            hero={activeHero}
            shopItems={shopItems}
            onPurchaseItem={handlePurchaseShopItem}
            onBack={() => setCurrentView('dashboard')}
          />
        )}

        {currentView === 'adventure_map' && (
          <AdventureMap
            hero={activeHero}
            onBack={() => setCurrentView('dashboard')}
            onRewardEarned={(c, p) => {
              updateActiveHero((h) => ({ ...h, coins: h.coins + c, points: h.points + p }));
            }}
          />
        )}

        {currentView === 'parent_portal' && (
          <ParentPortal
            heroes={heroes}
            tasks={tasks}
            shopItems={shopItems}
            onAddTask={(newTask) => {
              const fullTask: TaskItem = {
                ...newTask,
                id: `task-${Date.now()}`,
                completedToday: false,
              };
              setTasks((prev) => [...prev, fullTask]);
            }}
            onDeleteTask={(taskId) => {
              setTasks((prev) => prev.filter((t) => t.id !== taskId));
            }}
            onToggleTaskActive={(taskId) => {
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === taskId ? { ...t, completedToday: !t.completedToday } : t
                )
              );
            }}
            onAdjustHeroBalance={(heroId, deltaCoins, deltaPoints) => {
              setHeroes((prev) => {
                const nextList = prev.map((h) =>
                  h.id === heroId
                    ? { ...h, coins: h.coins + deltaCoins, points: h.points + deltaPoints }
                    : h
                );
                const updatedHero = nextList.find((h) => h.id === heroId);
                if (updatedHero) {
                  const unlockedIds = shopItems.filter((i) => i.unlocked).map((i) => i.id);
                  saveHeroProfileToFirestore(updatedHero, unlockedIds, petState);
                }
                return nextList;
              });
            }}
            onExit={() => setCurrentView('dashboard')}
          />
        )}
      </main>
    </div>
  );
}
