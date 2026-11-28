/**
 * src/services/ledgerStoreBridge.js
 *
 * Phase 3: Authoritative-mode bridge installing ledgerClient.run(...) wrappers
 * for every earn, spend, approval/denial, inventory grant/revoke, catalog, rule,
 * and hero-wallet lifecycle method listed in MIGRATION_PLAN.md Section 3.13.
 *
 * - In `legacy` mode (`isLegacyLedger() === true`), every wrapped method immediately
 *   delegates to the original store method unchanged.
 * - In `authoritative` mode (`isLegacyLedger() === false`), zero client-side balance
 *   math runs: every mutation calls `ledgerClient.run(action, args)` with deterministic
 *   IDs and non-persisted optimistic overlays.
 */

import { walletService, isLegacyLedger } from './walletService.js';
import { ledgerClient } from './ledgerClient.js';
import { CURRENCIES } from '../../shared/ledger/currencies.js';
import { activityTxnId } from '../../shared/ledger/ids.js';

function makeActivityId(activityType, heroId, itemKey, cycleId) {
  return activityTxnId(heroId, activityType, itemKey, cycleId);
}

let _seq = 0;
function _nextNonce(prefix = 'op') {
  _seq += 1;
  return `${prefix}_${Date.now()}_${_seq}`;
}

function _heroId(store) {
  return store.getSelectedHero?.()?.id || store.state?.selectedHero?.id || store.state?.heroes?.[0]?.id || 'hero_1';
}

function _activePetId(store, explicitPetId = null) {
  if (explicitPetId != null) return String(explicitPetId);
  const hero = store.getSelectedHero?.() || store.state?.selectedHero;
  const profile = walletService.getHeroProfile(hero?.id);
  const pid = profile?.activePetId || hero?.activePetId || null;
  return pid != null ? String(pid) : null;
}

function _tz(store) {
  return store.state?.parentSettings?.timeZone || 'America/Los_Angeles';
}

function _today(store) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: _tz(store) }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function _wrap(store, methodName, authoritativeHandler) {
  const original = store[methodName];
  if (typeof original !== 'function') return;
  store[methodName] = function (...args) {
    if (isLegacyLedger()) {
      return original.apply(this, args);
    }
    return authoritativeHandler.call(this, original, ...args);
  };
}

/**
 * Attach authoritative-mode ledger wrappers to the singleton store instance.
 */
export function attachLedgerBridge(store) {
  if (!store || store.__ledgerBridgeAttached) return store;
  store.__ledgerBridgeAttached = true;

  // Keep UI and store state in sync whenever authoritative walletService listeners update
  let _notifyingFromWallet = false;
  walletService.subscribe(() => {
    if (_notifyingFromWallet || isLegacyLedger()) return;
    _notifyingFromWallet = true;
    try {
      // Sync live hero profiles (non-currency fields + per-kid HQ) into store.state.heroes
      const profiles = walletService.getAllHeroProfiles();
      if (profiles.length > 0 && Array.isArray(store.state?.heroes)) {
        const byId = new Map(store.state.heroes.filter(Boolean).map((h) => [h.id, h]));
        for (const prof of profiles) {
          if (!prof || !prof.id) continue;
          const existing = byId.get(prof.id);
          if (existing) {
            Object.assign(existing, prof);
          } else {
            store.state.heroes.push({ ...prof });
            byId.set(prof.id, store.state.heroes[store.state.heroes.length - 1]);
          }
        }
        if (store.state.selectedHero?.id && byId.has(store.state.selectedHero.id)) {
          Object.assign(store.state.selectedHero, byId.get(store.state.selectedHero.id));
        }
      }

      // Sync live pending approval_requests into store.state.pendingApprovals for Parent Portal
      const livePending = walletService.getPendingApprovals();
      if (store.state) {
        store.state.pendingApprovals = livePending.map((req) => ({
          ...req,
          kidId: req.kidId || req.heroId,
          rewardPoints: req.rewardPoints ?? req.amount ?? req.points ?? 0
        }));
      }

      if (typeof store.notify === 'function') {
        store.notify();
      }
    } finally {
      _notifyingFromWallet = false;
    }
  });

  // =========================================================================
  // 1. EARNS (recordActivity)
  // =========================================================================

  _wrap(store, 'toggleHabitIsland', function (_orig, habitId) {
    const heroId = _heroId(this);
    const petId = _activePetId(this);
    const habit = (this.state.habitIslands || []).find((h) => h.id === habitId);
    const actId = makeActivityId('habit', heroId, habitId, _today(this));
    return ledgerClient.run('recordActivity', {
      heroId,
      activityType: 'habit',
      activityId: actId,
      taskId: habitId,
      title: habit?.title || habit?.name || habitId,
      petId
    }, {
      idemId: actId,
      optimistic: habit ? {
        heroId,
        txnId: actId,
        deltas: {
          [CURRENCIES.HABIT_TOKENS]: Number(habit.coins) || 0,
          [CURRENCIES.HERO_XP]: Number(habit.xp) || 0
        }
      } : undefined
    });
  });

  _wrap(store, 'toggleTaskForest', function (_orig, taskId) {
    const heroId = _heroId(this);
    const petId = _activePetId(this);
    const task = (this.state.taskForest || []).find((t) => t.id === taskId);
    const actId = makeActivityId('task', heroId, taskId, _today(this));
    return ledgerClient.run('recordActivity', {
      heroId,
      activityType: 'task',
      activityId: actId,
      taskId,
      title: task?.title || task?.name || taskId,
      petId
    }, {
      idemId: actId,
      optimistic: task ? {
        heroId,
        txnId: actId,
        deltas: {
          [CURRENCIES.HABIT_TOKENS]: Number(task.coins) || 0,
          [CURRENCIES.HERO_XP]: Number(task.xp) || 0
        }
      } : undefined
    });
  });

  _wrap(store, 'completeToothbrushBattle', function (_orig, bossId = 'sugar_bandit', durationSec = 120, avgCadence = 85, combatStats = {}) {
    const heroId = _heroId(this);
    const petId = _activePetId(this);
    const actId = makeActivityId('toothbrush_battle', heroId, `${bossId}_${_today(this)}`, _nextNonce('tb'));
    const actPromise = ledgerClient.run('recordActivity', {
      heroId,
      activityType: 'toothbrush_battle',
      activityId: actId,
      taskId: 'brush_teeth',
      title: 'Toothbrush Adventure Battle',
      petId,
      metadata: { bossId, durationSec, avgCadence, combatStats }
    }, { idemId: actId });

    // Mint Knight Badge grant (Section 3.13)
    const badgeTxn = `${actId}_badge`;
    ledgerClient.run('grantItem', {
      heroId,
      kind: 'badge',
      itemId: 'mint_knight_badge',
      reason: 'battle_badge',
      clientTxnId: badgeTxn
    }, { idemId: badgeTxn }).catch(() => {});

    return actPromise;
  });

  _wrap(store, 'completeAiQuest', function (_orig, questId, verifiedResult = null) {
    const heroId = _heroId(this);
    const actId = makeActivityId('ai_quest', heroId, questId, _today(this));
    return ledgerClient.run('recordActivity', {
      heroId,
      activityType: 'ai_quest',
      activityId: actId,
      taskId: questId,
      petId: _activePetId(this),
      metadata: { verifiedResult }
    }, { idemId: actId });
  });

  _wrap(store, 'completeAdventureGame', function (_orig, gameId, score = 3, maxScore = 3) {
    const heroId = _heroId(this);
    const actId = makeActivityId('adventure_game', heroId, gameId, _nextNonce('adv'));
    return ledgerClient.run('recordActivity', {
      heroId,
      activityType: 'adventure_game',
      activityId: actId,
      taskId: gameId,
      petId: _activePetId(this),
      metadata: { score, maxScore }
    }, { idemId: actId });
  });

  _wrap(store, 'completeMovementRoutine', function (_orig, routineId, durationMinutes = 2, posesCompleted = 4, feverBursts = 1) {
    const heroId = _heroId(this);
    const actId = makeActivityId('movement_routine', heroId, routineId, _nextNonce('mov'));
    return ledgerClient.run('recordActivity', {
      heroId,
      activityType: 'movement_routine',
      activityId: actId,
      taskId: routineId,
      petId: _activePetId(this),
      metadata: { durationMinutes, posesCompleted, feverBursts }
    }, { idemId: actId });
  });

  _wrap(store, 'unlockParentWorldChest', function (_orig, chestId) {
    const heroId = _heroId(this);
    const actId = makeActivityId('world_chest', heroId, chestId, _today(this));
    return ledgerClient.run('recordActivity', {
      heroId,
      activityType: 'world_chest',
      activityId: actId,
      taskId: chestId,
      petId: _activePetId(this)
    }, { idemId: actId });
  });

  _wrap(store, 'completeWaypointChore', function (_orig, waypointId) {
    const heroId = _heroId(this);
    const actId = makeActivityId('waypoint_chore', heroId, waypointId, _today(this));
    return ledgerClient.run('recordActivity', {
      heroId,
      activityType: 'waypoint_chore',
      activityId: actId,
      taskId: waypointId,
      petId: _activePetId(this)
    }, { idemId: actId });
  });

  _wrap(store, 'completePajamasTidyStep', function () {
    const heroId = _heroId(this);
    const actId = makeActivityId('pajamas_tidy', heroId, 'pajamas_tidy', _today(this));
    return ledgerClient.run('recordActivity', {
      heroId,
      activityType: 'pajamas_tidy',
      activityId: actId,
      taskId: 'pajamas_tidy',
      petId: _activePetId(this)
    }, { idemId: actId });
  });

  _wrap(store, 'completeBedtimeStory', function (_orig, storyData) {
    const heroId = _heroId(this);
    const storyId = storyData?.id || 'bedtime_story';
    const actId = makeActivityId('bedtime_story', heroId, storyId, _today(this));
    return ledgerClient.run('recordActivity', {
      heroId,
      activityType: 'bedtime_story',
      activityId: actId,
      taskId: 'bedtime_story',
      title: storyData?.title || 'Bedtime Story',
      petId: _activePetId(this)
    }, { idemId: actId });
  });

  _wrap(store, 'claimExpeditionRewards', function (_orig, expeditionId) {
    const heroId = _heroId(this);
    const exp = (this.state.activeExpeditions || []).find((e) => e.id === expeditionId);
    const biomeId = exp?.biomeId || expeditionId;
    const actId = makeActivityId('expedition', heroId, `expedition_${biomeId}`, expeditionId);
    const p = ledgerClient.run('recordActivity', {
      heroId,
      activityType: 'expedition',
      activityId: actId,
      taskId: `expedition_${biomeId}`,
      petId: exp?.petId ? String(exp.petId) : _activePetId(this)
    }, { idemId: actId });

    if (exp?.gearDropped) {
      const dropId = typeof exp.gearDropped === 'string' ? exp.gearDropped : exp.gearDropped.id;
      if (dropId) {
        const dropTxn = `${actId}_drop_${dropId}`;
        ledgerClient.run('grantItem', {
          heroId,
          kind: 'pet_gear',
          itemId: dropId,
          reason: 'expedition_drop',
          clientTxnId: dropTxn
        }, { idemId: dropTxn }).catch(() => {});
      }
    }
    return p;
  });

  _wrap(store, 'completePetBathReward', function (_orig, petId) {
    const heroId = _heroId(this);
    const pid = _activePetId(this, petId);
    const actId = makeActivityId('pet_bath', heroId, pid || 'pet', _nextNonce('bath'));
    return ledgerClient.run('recordActivity', {
      heroId,
      activityType: 'pet_bath',
      activityId: actId,
      petId: pid
    }, { idemId: actId });
  });

  _wrap(store, 'recordArcadeResult', function (_orig, gameId, score = 0, options = {}) {
    const heroId = _heroId(this);
    const actId = makeActivityId('arcade', heroId, gameId, _nextNonce('arc'));
    return ledgerClient.run('recordActivity', {
      heroId,
      activityType: 'arcade',
      activityId: actId,
      taskId: gameId,
      metadata: { score, options }
    }, { idemId: actId });
  });

  _wrap(store, 'discoverWorldSecret', function (_orig, shrineId) {
    const heroId = _heroId(this);
    const actId = makeActivityId('world_secret', heroId, shrineId, _today(this));
    return ledgerClient.run('recordActivity', {
      heroId,
      activityType: 'world_secret',
      activityId: actId,
      taskId: shrineId,
      petId: _activePetId(this)
    }, { idemId: actId });
  });

  _wrap(store, 'interactWithCustomLandmark', function (_orig, landmarkId) {
    const heroId = _heroId(this);
    const actId = makeActivityId('custom_landmark', heroId, landmarkId, _today(this));
    return ledgerClient.run('recordActivity', {
      heroId,
      activityType: 'custom_landmark',
      activityId: actId,
      taskId: landmarkId,
      petId: _activePetId(this)
    }, { idemId: actId });
  });

  _wrap(store, 'recordToyBoxInteraction', function (_orig, type) {
    const heroId = _heroId(this);
    const actId = makeActivityId('toy_box', heroId, type || 'toy', _nextNonce('toy'));
    return ledgerClient.run('recordActivity', {
      heroId,
      activityType: 'toy_box',
      activityId: actId,
      taskId: type || 'toy',
      petId: _activePetId(this)
    }, { idemId: actId });
  });

  _wrap(store, 'addCoins', function (_orig, amount) {
    const amt = Math.trunc(Number(amount) || 0);
    if (amt <= 0) return null;
    const heroId = _heroId(this);
    const actId = makeActivityId('bonus_coins', heroId, 'coins', _nextNonce('coins'));
    return ledgerClient.run('recordActivity', {
      heroId,
      activityType: 'toy_box',
      activityId: actId,
      requestedTokens: amt
    }, {
      idemId: actId,
      optimistic: { heroId, txnId: actId, deltas: { [CURRENCIES.HABIT_TOKENS]: amt } }
    });
  });

  _wrap(store, 'addXP', function (_orig, amount) {
    const amt = Math.trunc(Number(amount) || 0);
    if (amt <= 0) return null;
    const heroId = _heroId(this);
    const actId = makeActivityId('bonus_xp', heroId, 'xp', _nextNonce('xp'));
    return ledgerClient.run('recordActivity', {
      heroId,
      activityType: 'toy_box',
      activityId: actId,
      requestedXp: amt
    }, {
      idemId: actId,
      optimistic: { heroId, txnId: actId, deltas: { [CURRENCIES.HERO_XP]: amt } }
    });
  });

  _wrap(store, 'addPetSparks', function (_orig, petId, amount = 15, heroIdArg = null) {
    const amt = Math.trunc(Number(amount) || 0);
    if (amt <= 0) return null;
    const heroId = heroIdArg || _heroId(this);
    const pid = _activePetId(this, petId);
    const actId = makeActivityId('pet_care', heroId, pid || 'pet', _nextNonce('sparks'));
    return ledgerClient.run('recordActivity', {
      heroId,
      activityType: 'pet_care',
      activityId: actId,
      petId: pid,
      requestedSparks: amt
    }, {
      idemId: actId,
      optimistic: pid ? {
        heroId,
        txnId: actId,
        deltas: {
          [`${CURRENCIES.PET_SPARKS}:${pid}`]: amt,
          [`${CURRENCIES.PET_XP}:${pid}`]: amt * 2
        }
      } : undefined
    });
  });

  _wrap(store, 'addEvolutionSparks', function (_orig, petId, amount = 15) {
    // Evolution Sparks is a display mirror of active pet's PET_SPARKS (no separate currency)
    return this.addPetSparks(petId, amount);
  });

  _wrap(store, 'syncHabitPetCare', function (_orig, habitId, type = 'habit', petId = null, awardSparks = true) {
    if (!awardSparks) return null;
    return this.addPetSparks(petId, 10);
  });

  _wrap(store, 'addPetTrainingXp', function (_orig, petId, amount = 25) {
    const amt = Math.trunc(Number(amount) || 0);
    if (amt <= 0) return null;
    const heroId = _heroId(this);
    const pid = _activePetId(this, petId);
    const actId = makeActivityId('pet_training', heroId, pid || 'pet', _nextNonce('ptrain'));
    return ledgerClient.run('recordActivity', {
      heroId,
      activityType: 'pet_training',
      activityId: actId,
      petId: pid,
      requestedPetXp: amt
    }, {
      idemId: actId,
      optimistic: pid ? { heroId, txnId: actId, deltas: { [`${CURRENCIES.PET_XP}:${pid}`]: amt } } : undefined
    });
  });

  _wrap(store, 'addPetCareXp', function (_orig, petId, amount = 15) {
    const amt = Math.trunc(Number(amount) || 0) * 2;
    if (amt <= 0) return null;
    const heroId = _heroId(this);
    const pid = _activePetId(this, petId);
    const actId = makeActivityId('pet_care', heroId, pid || 'pet', _nextNonce('pcare'));
    return ledgerClient.run('recordActivity', {
      heroId,
      activityType: 'pet_care',
      activityId: actId,
      petId: pid,
      requestedPetXp: amt
    }, {
      idemId: actId,
      optimistic: pid ? { heroId, txnId: actId, deltas: { [`${CURRENCIES.PET_XP}:${pid}`]: amt } } : undefined
    });
  });

  // =========================================================================
  // 2. PARENT APPROVALS & DENIALS
  // =========================================================================

  _wrap(store, 'approveParentRequest', function (_orig, reqId) {
    const pending = walletService.getPendingApprovals().find((r) => r.id === reqId);
    if (pending && (pending.type === 'reward_redemption' || pending.holdId)) {
      return ledgerClient.run('captureRewardHold', {
        holdId: pending.holdId || reqId,
        approvalId: reqId
      }, { queueOnNetworkError: false });
    }
    return ledgerClient.run('approveActivity', { approvalId: reqId }, { queueOnNetworkError: false });
  });

  _wrap(store, 'rejectParentRequest', function (_orig, reqId) {
    const pending = walletService.getPendingApprovals().find((r) => r.id === reqId);
    if (pending && (pending.type === 'reward_redemption' || pending.holdId)) {
      return ledgerClient.run('voidRewardHold', {
        holdId: pending.holdId || reqId,
        approvalId: reqId
      }, { queueOnNetworkError: false });
    }
    return ledgerClient.run('denyActivity', { approvalId: reqId }, { queueOnNetworkError: false });
  });

  _wrap(store, 'approveAllPendingRequests', function () {
    const pending = walletService.getPendingApprovals();
    return Promise.all(pending.map((req) => this.approveParentRequest(req.id)));
  });

  // =========================================================================
  // 3. SPENDS, PURCHASES, HOLDS, GRANTS & REVOKES
  // =========================================================================

  _wrap(store, 'buyPet', function (_orig, petId) {
    const heroId = _heroId(this);
    const clientTxnId = _nextNonce(`buy_pet_${petId}`);
    return ledgerClient.run('purchaseItem', {
      heroId,
      kind: 'pet',
      itemId: String(petId),
      clientTxnId
    }, {
      idemId: clientTxnId,
      optimistic: { heroId, txnId: clientTxnId, deltas: { [CURRENCIES.HABIT_TOKENS]: -150 } }
    });
  });

  _wrap(store, 'buyHabitatSlot', function () {
    const heroId = _heroId(this);
    const clientTxnId = _nextNonce('buy_habitat_slot');
    return ledgerClient.run('purchaseItem', {
      heroId,
      kind: 'habitat_slot',
      itemId: 'habitat_slot',
      clientTxnId
    }, {
      idemId: clientTxnId,
      optimistic: { heroId, txnId: clientTxnId, deltas: { [CURRENCIES.HABIT_TOKENS]: -250 } }
    });
  });

  _wrap(store, 'buyProfileTheme', function (_orig, themeId) {
    const heroId = _heroId(this);
    const clientTxnId = _nextNonce(`buy_theme_${themeId}`);
    return ledgerClient.run('purchaseItem', {
      heroId,
      kind: 'theme',
      itemId: String(themeId),
      clientTxnId
    }, { idemId: clientTxnId });
  });

  _wrap(store, 'buyDigitalGear', function (_orig, gearId) {
    const heroId = _heroId(this);
    const gear = (this.state.digitalGear || []).find((g) => g.id === gearId);
    const petId = _activePetId(this);
    const clientTxnId = _nextNonce(`buy_gear_${gearId}`);
    return ledgerClient.run('purchaseItem', {
      heroId,
      kind: gear?.isCustomStudio ? 'studio_item' : 'digital_gear',
      itemId: String(gearId),
      petId,
      clientTxnId
    }, { idemId: clientTxnId });
  });

  _wrap(store, 'buyAndEquipGear', function (_orig, petId, slot, item) {
    const heroId = _heroId(this);
    const itemId = typeof item === 'string' ? item : (item?.id || item?.name);
    const clientTxnId = _nextNonce(`buy_pet_gear_${itemId}`);
    return ledgerClient.run('purchaseItem', {
      heroId,
      kind: 'pet_gear',
      itemId: String(itemId),
      petId: _activePetId(this, petId),
      metadata: { slot },
      clientTxnId
    }, { idemId: clientTxnId });
  });

  _wrap(store, 'buyTreatPack', function (_orig, treatId) {
    const heroId = _heroId(this);
    const clientTxnId = _nextNonce(`buy_treat_${treatId}`);
    return ledgerClient.run('purchaseItem', {
      heroId,
      kind: 'treat',
      itemId: String(treatId),
      clientTxnId
    }, { idemId: clientTxnId });
  });

  _wrap(store, 'unlockHQFurniture', function (_orig, furnitureId, autoEquip = true) {
    const heroId = _heroId(this);
    if (this.isHQFurnitureOwnedByHero(heroId, furnitureId)) {
      if (autoEquip) {
        const slot = (this.state.parentCustomFurniture || []).find((f) => f.id === furnitureId)?.slot;
        if (slot) this.equipHQFurniture(slot, furnitureId);
      }
      return Promise.resolve({ alreadyOwned: true });
    }
    const clientTxnId = _nextNonce(`buy_hq_${furnitureId}`);
    return ledgerClient.run('purchaseItem', {
      heroId,
      kind: 'hq_furniture',
      itemId: String(furnitureId),
      clientTxnId
    }, { idemId: clientTxnId });
  });

  _wrap(store, 'equipHQFurniture', function (_orig, slot, furnitureId) {
    const heroId = _heroId(this);
    if (furnitureId && !this.isHQFurnitureOwnedByHero(heroId, furnitureId)) {
      return { success: false, error: 'You must unlock this item first!' };
    }
    const currentHq = this.getHeroHQ(heroId);
    const placedFurniture = { ...(currentHq.placedFurniture || {}), [slot]: furnitureId || null };
    const code = this.state.household?.syncCode;
    return ledgerClient.updateHeroProfileFields(code, heroId, {
      hq: { ...currentHq, placedFurniture }
    });
  });

  _wrap(store, 'checkHQMilestoneUnlocks', function (_orig, milestoneItemIds = []) {
    const heroId = _heroId(this);
    if (!Array.isArray(milestoneItemIds) || milestoneItemIds.length === 0) return [];
    return Promise.all(milestoneItemIds.map((itemId) => {
      const clientTxnId = `hq_milestone_${heroId}_${itemId}`;
      return ledgerClient.run('grantItem', {
        heroId,
        kind: 'hq_furniture',
        itemId: String(itemId),
        reason: 'hq_milestone',
        clientTxnId
      }, { idemId: clientTxnId });
    }));
  });

  _wrap(store, 'publishCustomAIFurniture', function (_orig, item) {
    if (!item) return null;
    const itemId = item.id || `furn_${Date.now()}`;
    const promises = [];
    if (item.deliveryMode === 'instant_gift') {
      const targets = item.targetChildProfile === 'all'
        ? (this.state.heroes || []).map((h) => h.id)
        : [item.targetChildProfile || _heroId(this)];
      for (const hid of targets) {
        const clientTxnId = `gift_furn_${hid}_${itemId}`;
        promises.push(ledgerClient.run('grantItem', {
          heroId: hid,
          kind: 'hq_furniture',
          itemId,
          reason: 'parent_gift',
          clientTxnId
        }, { idemId: clientTxnId }));
      }
    } else {
      promises.push(ledgerClient.run('saveCatalogItem', {
        itemId,
        kind: 'hq_furniture',
        title: item.name || item.title || itemId,
        currency: CURRENCIES.HABIT_TOKENS,
        price: Number(item.costCoins) || 50,
        active: true
      }));
    }
    return Promise.all(promises);
  });

  _wrap(store, 'startPetExpedition', function (_orig, petId, biomeId = 'fern_woods', durationMinutes = 15, snackPacked = false) {
    const heroId = _heroId(this);
    const clientTxnId = _nextNonce(`fee_exp_${biomeId}`);
    return ledgerClient.run('purchaseItem', {
      heroId,
      kind: 'fee',
      itemId: 'fee:expedition',
      petId: _activePetId(this, petId),
      metadata: { biomeId, durationMinutes, snackPacked },
      clientTxnId
    }, {
      idemId: clientTxnId,
      optimistic: { heroId, txnId: clientTxnId, deltas: { [CURRENCIES.HABIT_TOKENS]: -5 } }
    });
  });

  _wrap(store, 'feedAllPetsPicnic', function () {
    const heroId = _heroId(this);
    const clientTxnId = _nextNonce('fee_picnic');
    return ledgerClient.run('purchaseItem', {
      heroId,
      kind: 'fee',
      itemId: 'fee:picnic',
      clientTxnId
    }, {
      idemId: clientTxnId,
      optimistic: { heroId, txnId: clientTxnId, deltas: { [CURRENCIES.HABIT_TOKENS]: -15 } }
    });
  });

  _wrap(store, 'feedSinglePet', function (_orig, petId) {
    const heroId = _heroId(this);
    const clientTxnId = _nextNonce(`fee_feed_${petId}`);
    return ledgerClient.run('purchaseItem', {
      heroId,
      kind: 'fee',
      itemId: 'fee:feed_single_pet',
      petId: _activePetId(this, petId),
      clientTxnId
    }, { idemId: clientTxnId });
  });

  _wrap(store, 'choosePet', function (_orig, petId, type = 'starter') {
    const heroId = _heroId(this);
    const clientTxnId = `starter_pet_${heroId}_${type}_${petId}`;
    return ledgerClient.run('grantItem', {
      heroId,
      kind: 'pet',
      itemId: String(petId),
      reason: 'starter_pet',
      metadata: { type },
      clientTxnId
    }, { idemId: clientTxnId });
  });

  _wrap(store, 'adoptPetIntoSlot', function (_orig, petId) {
    const heroId = _heroId(this);
    const clientTxnId = _nextNonce(`adopt_pet_${petId}`);
    return ledgerClient.run('grantItem', {
      heroId,
      kind: 'pet',
      itemId: String(petId),
      reason: 'adopt',
      clientTxnId
    }, { idemId: clientTxnId });
  });

  _wrap(store, 'hatchMagicEgg', function (_orig, eggId) {
    const heroId = _heroId(this);
    const clientTxnId = `egg_hatch_${heroId}_${eggId}`;
    return ledgerClient.run('grantItem', {
      heroId,
      kind: 'pet',
      itemId: String(eggId),
      reason: 'egg_hatch',
      eggId: String(eggId),
      clientTxnId
    }, { idemId: clientTxnId });
  });

  _wrap(store, 'addCustomAIPet', function (_orig, petConfig, deliveryMode = 'egg') {
    if (!petConfig) return null;
    const itemId = petConfig.id || `custom_pet_${Date.now()}`;
    const kind = deliveryMode === 'egg' ? 'egg' : 'pet';
    const targets = petConfig.targetChildProfile === 'all'
      ? (this.state.heroes || []).map((h) => h.id)
      : [petConfig.targetChildProfile || _heroId(this)];
    return Promise.all(targets.map((hid) => {
      const clientTxnId = `parent_pet_${hid}_${itemId}`;
      return ledgerClient.run('grantItem', {
        heroId: hid,
        kind,
        itemId,
        reason: 'parent_pet',
        clientTxnId
      }, { idemId: clientTxnId });
    }));
  });

  _wrap(store, 'deleteCustomAIFurniture', function (_orig, furnitureId) {
    const heroes = this.state.heroes || [];
    return Promise.all(heroes.map((h) => ledgerClient.run('revokeItem', {
      heroId: h.id,
      kind: 'hq_furniture',
      itemId: String(furnitureId)
    }, { queueOnNetworkError: false }).catch(() => {})));
  });

  _wrap(store, 'deleteCustomAIFood', function (_orig, foodId) {
    const heroes = this.state.heroes || [];
    return Promise.all(heroes.map((h) => ledgerClient.run('revokeItem', {
      heroId: h.id,
      kind: 'treat',
      itemId: String(foodId)
    }, { queueOnNetworkError: false }).catch(() => {})));
  });

  _wrap(store, 'deductPetSparks', function (_orig, petId, amount = 100, heroIdArg = null) {
    const heroId = heroIdArg || _heroId(this);
    const pid = _activePetId(this, petId);
    const clientTxnId = _nextNonce(`spend_sparks_${pid}`);
    return ledgerClient.run('purchaseItem', {
      heroId,
      kind: 'digital_gear',
      itemId: `sparks_spend_${pid}`,
      currency: CURRENCIES.PET_SPARKS,
      petId: pid,
      amount: Math.trunc(Number(amount) || 0),
      clientTxnId
    }, { idemId: clientTxnId });
  });

  _wrap(store, 'deductPetTrainingXp', function (_orig, petId, amount = 0, heroIdArg = null) {
    const heroId = heroIdArg || _heroId(this);
    const pid = _activePetId(this, petId);
    const clientTxnId = _nextNonce(`spend_pet_xp_${pid}`);
    return ledgerClient.run('grantBonus', {
      heroId,
      currency: CURRENCIES.PET_XP,
      petId: pid,
      delta: -Math.abs(Math.trunc(Number(amount) || 0)),
      reason: 'pet_xp_deduct',
      clientTxnId
    }, { idemId: clientTxnId });
  });

  _wrap(store, 'feedPetConsumableSnack', function (_orig, snackId) {
    const heroId = _heroId(this);
    const clientTxnId = _nextNonce(`consume_snack_${snackId}`);
    return ledgerClient.run('consumeItem', {
      heroId,
      itemId: String(snackId),
      quantity: 1,
      petId: _activePetId(this),
      clientTxnId
    }, { idemId: clientTxnId });
  });

  _wrap(store, 'feedPetTreat', function (_orig, petId = null, treatId = 'crunchy_apple') {
    const heroId = _heroId(this);
    const clientTxnId = _nextNonce(`consume_treat_${treatId}`);
    return ledgerClient.run('consumeItem', {
      heroId,
      itemId: String(treatId),
      quantity: 1,
      petId: _activePetId(this, petId),
      clientTxnId
    }, { idemId: clientTxnId });
  });

  _wrap(store, 'redeemRealLifeReward', function (_orig, rewardId) {
    const heroId = _heroId(this);
    const reward = (this.state.realLifeRewards || []).find((r) => r.id === rewardId);
    const clientTxnId = _nextNonce(`hold_reward_${rewardId}`);
    return ledgerClient.run('authorizeRewardHold', {
      heroId,
      rewardId: String(rewardId),
      title: reward?.title || String(rewardId),
      clientTxnId
    }, { idemId: clientTxnId });
  });

  _wrap(store, 'grantStudioItemToHero', function (_orig, item, category, heroIdArg) {
    const heroId = heroIdArg || _heroId(this);
    const itemId = typeof item === 'string' ? item : (item?.id || `studio_${Date.now()}`);
    const kind = category === 'furniture' ? 'hq_furniture' : 'studio_item';
    const clientTxnId = _nextNonce(`gift_${heroId}_${itemId}`);
    return ledgerClient.run('grantItem', {
      heroId,
      kind,
      itemId: String(itemId),
      reason: 'parent_gift',
      clientTxnId
    }, { idemId: clientTxnId });
  });

  // =========================================================================
  // 4. HERO LIFECYCLE & PROFILE EDITS
  // =========================================================================

  _wrap(store, 'addHero', function (_orig, data = {}) {
    const heroId = data.id || `hero_${Date.now()}`;
    return ledgerClient.run('openWallet', {
      heroId,
      name: data.name || 'Little Hero',
      role: data.role || 'Adventurer',
      avatar: data.avatar || '',
      starting: {
        coins: Number(data.coins) || 0,
        points: Number(data.points) || 0,
        level: Number(data.level) || 1
      }
    }, { queueOnNetworkError: false });
  });

  _wrap(store, 'deleteHero', function (_orig, heroId) {
    return ledgerClient.run('closeWallet', { heroId }, { queueOnNetworkError: false });
  });

  _wrap(store, 'editHero', function (_orig, heroId, updatedData = {}) {
    const promises = [];
    const profilePatch = {};
    const ledgerAdjust = {};
    const LEDGER_KEYS = new Set(['coins', 'points', 'xp', 'level', 'sparks', 'evolutionSparks', 'unlockedPetIds', 'habitatSlots']);

    for (const [k, v] of Object.entries(updatedData)) {
      if (LEDGER_KEYS.has(k)) {
        ledgerAdjust[k] = v;
      } else {
        profilePatch[k] = v;
      }
    }

    if (Object.keys(profilePatch).length > 0) {
      promises.push(ledgerClient.updateHeroProfileFields(this.state.household?.syncCode, heroId, profilePatch));
    }

    if (ledgerAdjust.coins !== undefined || ledgerAdjust.points !== undefined || ledgerAdjust.level !== undefined) {
      const clientTxnId = _nextNonce(`adjust_${heroId}`);
      promises.push(ledgerClient.run('grantBonus', {
        heroId,
        reason: 'parent_edit',
        adjust: ledgerAdjust,
        clientTxnId
      }, { queueOnNetworkError: false }));
    }

    return Promise.all(promises);
  });

  // =========================================================================
  // 5. CATALOG & REWARD RULE WRITERS
  // =========================================================================

  _wrap(store, 'addNewTask', function (orig, taskData) {
    const res = orig.call(this, taskData);
    const id = taskData?.id || res?.id;
    const isHabit = taskData?.zone === 'habit' || taskData?.zone === 'habits';
    if (id) {
      ledgerClient.run('saveRewardRule', {
        ruleId: `${isHabit ? 'habit' : 'task'}:${id}`,
        activityType: isHabit ? 'habit' : 'task',
        autoTokens: Number(taskData?.coins) || 0,
        autoXp: Number(taskData?.xp) || 0,
        autoSparks: Number(taskData?.sparks) || 0,
        pendingGoldPoints: Number(taskData?.points) || 0,
        requiresApproval: true,
        active: true
      }).catch(() => {});
    }
    return res;
  });

  _wrap(store, 'deleteTask', function (orig, taskId, zone) {
    const res = orig.call(this, taskId, zone);
    const isHabit = zone === 'habit' || zone === 'habits';
    if (taskId) {
      ledgerClient.run('deleteRewardRule', {
        ruleId: `${isHabit ? 'habit' : 'task'}:${taskId}`
      }).catch(() => {});
    }
    return res;
  });

  _wrap(store, 'deleteRealLifeReward', function (orig, rewardId) {
    const res = orig.call(this, rewardId);
    if (rewardId) {
      ledgerClient.run('deleteCatalogItem', { itemId: String(rewardId) }).catch(() => {});
    }
    return res;
  });

  _wrap(store, 'updateAllPricing', function (orig, realLifeMap = {}, digitalMap = {}, themesMap = {}, statBonusMap = {}, foodSettingsMap = {}) {
    const res = orig.call(this, realLifeMap, digitalMap, themesMap, statBonusMap, foodSettingsMap);
    const updates = [];
    for (const [id, cost] of Object.entries(realLifeMap || {})) {
      updates.push(ledgerClient.run('saveCatalogItem', {
        itemId: id,
        kind: 'reward',
        currency: CURRENCIES.GOLD_POINTS,
        price: Math.max(1, parseInt(cost, 10) || 1),
        active: true
      }).catch(() => {}));
    }
    for (const [id, cost] of Object.entries(digitalMap || {})) {
      updates.push(ledgerClient.run('saveCatalogItem', {
        itemId: id,
        kind: 'digital_gear',
        currency: CURRENCIES.HABIT_TOKENS,
        price: Math.max(1, parseInt(cost, 10) || 1),
        active: true
      }).catch(() => {}));
    }
    for (const [id, cost] of Object.entries(themesMap || {})) {
      updates.push(ledgerClient.run('saveCatalogItem', {
        itemId: id,
        kind: 'theme',
        currency: CURRENCIES.HABIT_TOKENS,
        price: Math.max(1, parseInt(cost, 10) || 1),
        active: true
      }).catch(() => {}));
    }
    return Promise.all(updates).then(() => res);
  });

  return store;
}
