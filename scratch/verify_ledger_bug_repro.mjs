import assert from 'node:assert/strict';
import './setup_mock_env.js';
import { store } from '../src/state/store.js';
import { DIGITAL_REWARDS_CATALOG } from '../src/data/digitalRewardsCatalog.js';
import {
  firestoreSync,
  buildCloudStateSnapshot,
  buildSlimDigitalGear,
  REDUNDANT_SNAPSHOT_KEYS
} from '../src/services/firestoreSyncService.js';

const EXPECTED_LEGACY_FAILURE = (label, detail) => {
  console.log(`  ⚠️  EXPECTED_LEGACY_FAILURE [${label}]: ${detail}`);
};

function isDeleteFieldSentinel(val) {
  return Boolean(val && typeof val === 'object' && (val._methodName === 'deleteField' || val.__op === 'deleteField'));
}

/**
 * In-memory Firestore setDoc(..., { merge: true }) simulator that honors deleteField() sentinels.
 */
function applyFirestoreMerge(target, incoming) {
  const out = (target && typeof target === 'object' && !Array.isArray(target)) ? { ...target } : {};
  for (const [k, v] of Object.entries(incoming || {})) {
    if (isDeleteFieldSentinel(v)) {
      delete out[k];
    } else if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      out[k] = applyFirestoreMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function serializedBytes(obj) {
  return Buffer.byteLength(JSON.stringify(obj, (_k, v) => (isDeleteFieldSentinel(v) ? '__DELETE__' : v)), 'utf8');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('🧪 Running Phase 0: Ledger Bug Repro & Sync Stabilization Tests...');

  // Configure a clean one-kid reference household
  const state = store.getState();
  state.isAuthenticated = true;
  state.isHouseholdConfigured = true;
  state.isDeviceRevoked = false;
  state.household = {
    ...(state.household || {}),
    name: 'Phase 0 Reference Family',
    syncCode: 'PHASE0TEST'
  };
  const primaryHero = state.heroes[0];
  assert.ok(primaryHero, 'Expected at least one hero in default state');
  state.heroes = [primaryHero];
  state.selectedHero = primaryHero;
  firestoreSync.currentCode = 'PHASE0TEST';

  const origSetDoc = firestoreSync._setDoc;
  const origEnsureAuth = firestoreSync._ensureAuthReady;
  const origBaseDelay = firestoreSync.retryBaseDelayMs;
  const origMaxDelay = firestoreSync.retryMaxDelayMs;

  // Prevent Part 1 hydrateFromCloud calls from touching the real network
  firestoreSync._ensureAuthReady = async () => ({ uid: 'test-uid' });
  firestoreSync._setDoc = async () => {};

  try {
    // =========================================================================
    // PART 1: Document today's legacy failure modes (EXPECTED_LEGACY_FAILURE)
    // =========================================================================

    // (a) R4: Lost update on concurrent coins += across two devices
    {
      const baseCoins = 100;
      const now = Date.now();
      primaryHero.coins = baseCoins + 10; // Device A adds +10 -> 110
      primaryHero.tokens = primaryHero.coins;
      primaryHero.fieldStamps = { ...(primaryHero.fieldStamps || {}), coins: now, tokens: now };
      store.syncSelectedHeroWithHeroes();

      // Device B concurrently started from 100 and added +15 -> 115, stamped 5ms later
      const cloudHeroB = {
        ...JSON.parse(JSON.stringify(primaryHero)),
        coins: baseCoins + 15,
        tokens: baseCoins + 15,
        fieldStamps: { ...(primaryHero.fieldStamps || {}), coins: now + 5, tokens: now + 5 }
      };
      store.hydrateFromCloud({
        syncCode: 'PHASE0TEST',
        heroes: [cloudHeroB],
        heroesMap: { [primaryHero.id]: cloudHeroB }
      });
      const mergedCoins = store.getState().heroes[0].coins;
      assert.equal(mergedCoins, 115, 'LWW merge picks device B absolute value (115), discarding device A +10');
      assert.notEqual(mergedCoins, 125, 'R4 reproduced: concurrent increments do not add up to 125');
      EXPECTED_LEGACY_FAILURE('R4 concurrent coins+=', `expected 125, LWW produced ${mergedCoins}`);
    }

    // (b) R5: Pet XP overwrite (petXpMap not protected by fieldStamps)
    {
      const h = store.getState().heroes[0];
      h.petXpMap = { 1: 85 };
      store.syncSelectedHeroWithHeroes();
      const staleCloudHero = {
        ...JSON.parse(JSON.stringify(h)),
        petXpMap: { 1: 10 }
      };
      store.hydrateFromCloud({
        syncCode: 'PHASE0TEST',
        heroes: [staleCloudHero],
        heroesMap: { [h.id]: staleCloudHero }
      });
      const afterXp = store.getState().heroes[0].petXpMap?.[1];
      assert.equal(afterXp, 10, 'R5 reproduced: incoming snapshot overwrites local petXpMap wholesale');
      EXPECTED_LEGACY_FAILURE('R5 petXpMap overwrite', `local 85 overwritten by cloud ${afterXp}`);
    }

    // (c) R3: Skewed device clock beats a later parent approval
    {
      const h = store.getState().heroes[0];
      const realNow = Date.now();
      h.points = 125; // Parent approved +25 at realNow
      h.fieldStamps = { ...(h.fieldStamps || {}), points: realNow };
      store.syncSelectedHeroWithHeroes();

      // Kid tablet whose clock is 60s fast pushes old points=100 with future stamp
      const skewedCloudHero = {
        ...JSON.parse(JSON.stringify(h)),
        points: 100,
        fieldStamps: { ...(h.fieldStamps || {}), points: realNow + 60_000 }
      };
      store.hydrateFromCloud({
        syncCode: 'PHASE0TEST',
        heroes: [skewedCloudHero],
        heroesMap: { [h.id]: skewedCloudHero }
      });
      const mergedPoints = store.getState().heroes[0].points;
      assert.equal(mergedPoints, 100, 'R3 reproduced: future device clock stamp beats real later approval');
      EXPECTED_LEGACY_FAILURE('R3 skewed clock', `parent approval 125 lost to skewed-clock ${mergedPoints}`);
    }

    // (d) R1: Document legacy failure (failed push left approving device alone) AND verify Phase 0 fix
    {
      EXPECTED_LEGACY_FAILURE('R1 failed push (pre-Phase 0)', 'previously _doPush caught errors without retrying and ensureAuthReady sat outside try');
    }

    // =========================================================================
    // PART 2: Phase 0 Acceptance Criteria (MUST PASS)
    // =========================================================================

    // Drain any deferred repair-push timers scheduled by Part 1 hydrateFromCloud calls
    await sleep(20);
    if (firestoreSync.debounceTimer) {
      clearTimeout(firestoreSync.debounceTimer);
      firestoreSync.debounceTimer = null;
    }
    firestoreSync._clearRetryTimer();
    firestoreSync.pushInFlight = false;
    firestoreSync.pushPending = false;
    firestoreSync.isPushing = false;
    firestoreSync.retryBaseDelayMs = 40;
    firestoreSync.retryMaxDelayMs = 160;
    firestoreSync.retryDelayMs = 40;
    firestoreSync.pushFailures = [];
    firestoreSync.lastPushError = null;
    localStorage.removeItem('firestore_quota_exhausted_until');

    // 2.1: Simulated setDoc fails twice, then succeeds via automatic backoff retry
    let attempts = 0;
    let lastPayload = null;
    firestoreSync._ensureAuthReady = async () => ({ uid: 'test-uid' });
    firestoreSync._setDoc = async (_ref, payload) => {
      attempts++;
      if (attempts <= 2) {
        const err = new Error('transient unavailable');
        err.code = attempts === 1 ? 'unavailable' : 'deadline-exceeded';
        throw err;
      }
      lastPayload = payload;
    };

    await firestoreSync._doPush();
    assert.equal(attempts, 1);
    assert.equal(firestoreSync.lastPushError, 'unavailable');
    assert.equal(firestoreSync.getSyncHealth().mode, 'error');
    assert.equal(firestoreSync.getSyncHealth().lastErrorCode, 'unavailable');

    // Wait for automatic retries (40ms + 80ms + buffer)
    await sleep(250);
    assert.equal(attempts, 3, 'Expected automatic backoff retries to succeed on 3rd attempt');
    assert.equal(firestoreSync.lastPushError, null, 'lastPushError should clear after successful retry');
    assert.equal(firestoreSync.getSyncHealth().mode, 'ok');
    assert.equal(firestoreSync.pushFailures.length, 2);
    assert.equal(firestoreSync.pushFailures[0].code, 'unavailable');
    assert.equal(firestoreSync.pushFailures[1].code, 'deadline-exceeded');
    console.log('  ✅ setDoc failure retries with exponential backoff and succeeds');

    // 2.2: ensureAuthReady rejection is caught inside try, recorded, and retried
    let authAttempts = 0;
    let setDocCalls = 0;
    firestoreSync.retryDelayMs = 40;
    firestoreSync._ensureAuthReady = async () => {
      authAttempts++;
      if (authAttempts === 1) {
        const err = new Error('auth failed');
        err.code = 'auth/network-request-failed';
        throw err;
      }
      return { uid: 'test-uid' };
    };
    firestoreSync._setDoc = async (_ref, payload) => {
      setDocCalls++;
      lastPayload = payload;
    };

    await firestoreSync._doPush();
    assert.equal(authAttempts, 1);
    assert.equal(setDocCalls, 0);
    assert.equal(firestoreSync.lastPushError, 'auth/network-request-failed');
    await sleep(120);
    assert.equal(authAttempts, 2, 'Expected ensureAuthReady rejection to trigger retry');
    assert.equal(setDocCalls, 1, 'Expected push to succeed after auth recovers');
    assert.equal(firestoreSync.lastPushError, null);
    console.log('  ✅ ensureAuthReady rejection caught inside try, recorded, and retried');

    // 2.3: Quota cooldown schedules automatic retry once cooldown expires
    let quotaTriggered = false;
    let postQuotaPushes = 0;
    firestoreSync._ensureAuthReady = async () => ({ uid: 'test-uid' });
    firestoreSync._setDoc = async () => {
      if (!quotaTriggered) {
        quotaTriggered = true;
        firestoreSync.markQuotaExhausted(new Error('resource-exhausted'), 60);
        firestoreSync._recordPushFailure('quota');
        firestoreSync.lastPushError = 'quota';
        return;
      }
      postQuotaPushes++;
    };
    await firestoreSync._doPush();
    assert.equal(firestoreSync.getSyncHealth().mode, 'paused');
    await sleep(180);
    assert.equal(postQuotaPushes, 1, 'Expected one automatic push after quota cooldown expired');
    assert.equal(firestoreSync.lastPushError, null);
    console.log('  ✅ Quota cooldown automatically schedules retry upon expiry');

    // 2.4: Ring buffer caps at 20 entries
    firestoreSync.pushFailures = [];
    for (let i = 0; i < 25; i++) {
      firestoreSync._recordPushFailure(`err-${i}`);
    }
    assert.equal(firestoreSync.pushFailures.length, 20, 'pushFailures ring buffer must cap at 20');
    assert.equal(firestoreSync.pushFailures[0].code, 'err-5');
    assert.equal(firestoreSync.pushFailures[19].code, 'err-24');
    console.log('  ✅ pushFailures ring buffer caps at 20 entries');

    // 2.5: Payload slimming (< 150 KB) & stored-doc shrinking via deleteField()
    // Simulate a legacy bloated stored doc with redundant copies inside stateSnapshot & full digitalGear
    const legacyStoredDoc = {
      stateSnapshot: {
        ...buildCloudStateSnapshot(state, { includeDeletes: false }),
        heroes: JSON.parse(JSON.stringify(state.heroes)),
        selectedHero: JSON.parse(JSON.stringify(state.selectedHero)),
        digitalGear: JSON.parse(JSON.stringify(DIGITAL_REWARDS_CATALOG)),
        pets: JSON.parse(JSON.stringify(state.pets)),
        heroHQ: JSON.parse(JSON.stringify(state.heroHQ))
      },
      heroes: JSON.parse(JSON.stringify(state.heroes)),
      selectedHero: JSON.parse(JSON.stringify(state.selectedHero)),
      digitalGear: JSON.parse(JSON.stringify(DIGITAL_REWARDS_CATALOG)),
      pets: JSON.parse(JSON.stringify(state.pets)),
      heroHQ: JSON.parse(JSON.stringify(state.heroHQ))
    };
    const legacyStoredBytes = serializedBytes(legacyStoredDoc);

    // Push slimmed payload into the simulated Firestore doc
    let storedDocAfterPush = legacyStoredDoc;
    let pushedPayload = null;
    firestoreSync._setDoc = async (_ref, payload) => {
      pushedPayload = payload;
      storedDocAfterPush = applyFirestoreMerge(storedDocAfterPush, payload);
    };
    await firestoreSync._doPush();

    const pushedBytes = serializedBytes(pushedPayload);
    const storedAfterBytes = serializedBytes(storedDocAfterPush);
    console.log(`  📊 Reference 1-kid payload: ${(pushedBytes / 1024).toFixed(1)} KB | Stored doc: ${(legacyStoredBytes / 1024).toFixed(1)} KB → ${(storedAfterBytes / 1024).toFixed(1)} KB`);

    assert.ok(pushedBytes < 150 * 1024, `Expected push payload < 150 KB, got ${(pushedBytes / 1024).toFixed(1)} KB`);
    assert.ok(storedAfterBytes < legacyStoredBytes - 100 * 1024, 'Expected stored household doc to shrink significantly');
    for (const k of REDUNDANT_SNAPSHOT_KEYS) {
      assert.equal(Object.prototype.hasOwnProperty.call(storedDocAfterPush.stateSnapshot, k), false, `Expected stateSnapshot.${k} to be deleted from stored doc`);
    }
    console.log('  ✅ Push payload < 150 KB and stored household doc physically shrunk via deleteField()');

    // 2.6: Slimmed digitalGear push preserves all default shop items AND parent's custom prices/Studio items
    const sampleDefault = DIGITAL_REWARDS_CATALOG[0];
    assert.ok(sampleDefault && sampleDefault.id, 'Expected at least one default gear item');
    const repricedItem = { ...sampleDefault, costCoins: 777 };
    const customStudioItem = { id: 'studio_custom_phase0', name: 'Phase 0 Plasma Blade', costCoins: 123, category: 'Weapons' };
    const parentGear = [
      repricedItem,
      ...DIGITAL_REWARDS_CATALOG.slice(1).map((x) => ({ ...x })),
      customStudioItem
    ];
    const slimGear = buildSlimDigitalGear(parentGear);
    assert.equal(slimGear.length, 2, 'buildSlimDigitalGear should only emit modified defaults and custom items');

    // Hydrate on a receiving device
    store.hydrateFromCloud({
      syncCode: 'PHASE0TEST',
      digitalGear: slimGear
    });
    const hydratedGear = store.getState().digitalGear;
    assert.equal(hydratedGear.length, DIGITAL_REWARDS_CATALOG.length + 1, 'Receiving device must keep all default items plus custom item');
    assert.equal(hydratedGear.find((g) => g.id === sampleDefault.id)?.costCoins, 777, 'Parent custom price must apply');
    assert.equal(hydratedGear.find((g) => g.id === 'studio_custom_phase0')?.name, 'Phase 0 Plasma Blade', 'Custom studio item must appear');
    console.log('  ✅ Slimmed digitalGear preserves every default item and parent custom prices');

    // 2.7: Furniture buyer recording (unlockHQFurniture, checkHQMilestoneUnlocks, grantStudioItemToHero) & sync merge
    const h1 = store.getState().heroes[0];
    h1.coins = 5000;
    h1.tokens = 5000;
    store.getState().selectedHero = h1;
    store.getState().heroHQ.unlockedFurnitureIds = [...(store.getState().heroHQ.unlockedFurnitureIds || [])];
    store.getState().heroHQ.furnitureOwners = {};

    // Grant Studio furniture to hero_1
    store.grantStudioItemToHero({ id: 'furn_studio_test', name: 'Test Throne', category: 'furniture' }, 'furniture', h1.id);
    assert.equal(store.getState().heroHQ.furnitureOwners['furn_studio_test'], h1.id, 'grantStudioItemToHero must record buyer');

    // Milestone unlock records selected hero
    store.getState().brushStreak = 10;
    store.checkHQMilestoneUnlocks();
    const milestoneRecorded = Object.values(store.getState().heroHQ.furnitureOwners).includes(h1.id);
    assert.ok(milestoneRecorded, 'checkHQMilestoneUnlocks must record owner in furnitureOwners');

    // Buy furniture via unlockHQFurniture
    store.getState().heroHQ.unlockedFurnitureIds = store.getState().heroHQ.unlockedFurnitureIds.filter((id) => id !== 'neon_arcade_cabinet');
    delete store.getState().heroHQ.furnitureOwners['neon_arcade_cabinet'];
    const buyRes = store.unlockHQFurniture('neon_arcade_cabinet', false);
    if (buyRes.success) {
      assert.equal(store.getState().heroHQ.furnitureOwners['neon_arcade_cabinet'], h1.id, 'unlockHQFurniture must record buyer');
    }

    // Two-device merge: local device recorded item_dev_a for hero_a, cloud recorded item_dev_b for hero_b
    // Also include a conflicting stale stateSnapshot.heroHQ to prove skip list protects it
    store.getState().heroHQ.furnitureOwners = { item_dev_a: 'hero_a' };
    store.hydrateFromCloud({
      syncCode: 'PHASE0TEST',
      stateSnapshot: {
        heroHQ: {
          unlockedFurnitureIds: ['dino_leaf_canopy'],
          furnitureOwners: { stale_only: 'hero_stale' }
        }
      },
      heroHQ: {
        unlockedFurnitureIds: ['dino_leaf_canopy', 'item_dev_b'],
        furnitureOwners: { item_dev_b: 'hero_b', item_dev_a: 'hero_other_conflict' }
      }
    });
    const mergedOwners = store.getState().heroHQ.furnitureOwners;
    assert.equal(mergedOwners.item_dev_a, 'hero_a', 'Local owner must be preserved on conflict');
    assert.equal(mergedOwners.item_dev_b, 'hero_b', 'Remote owner must be unioned in');
    assert.equal(mergedOwners.stale_only, undefined, 'stateSnapshot.heroHQ must not overwrite furnitureOwners');
    console.log('  ✅ Furniture buyer recording and two-device furnitureOwners union merge verified');
  } finally {
    firestoreSync._setDoc = origSetDoc;
    firestoreSync._ensureAuthReady = origEnsureAuth;
    firestoreSync.retryBaseDelayMs = origBaseDelay;
    firestoreSync.retryMaxDelayMs = origMaxDelay;
    firestoreSync._clearRetryTimer();
    if (firestoreSync.quotaRetryTimer) {
      clearTimeout(firestoreSync.quotaRetryTimer);
      firestoreSync.quotaRetryTimer = null;
    }
    localStorage.removeItem('firestore_quota_exhausted_until');
  }

  console.log('✅ All Phase 0 tests passed!');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Phase 0 test failed:', err);
  process.exit(1);
});
