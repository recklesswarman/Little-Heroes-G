# MIGRATION_PLAN.md: Authoritative Ledger and Real-Time Household Sync

Status: revised proposal (no application code changed yet)
Audience: the engineer or agent executing the phases in section 6
Scope: Gold Points, Habit Tokens, Pet Sparks (Evolution Sparks is only a display mirror of the active pet's sparks), Hero XP, Pet XP, inventory (including pets and habitat slots), parent approvals, Rewards Shop, 3D Studio purchases, AI Crafting, and non-currency household sync reliability
Decisions recorded from Dj (2026-11-25):
- Parent unlock: **PIN and fingerprint are equal ways in, both checked by the server** (fingerprint becomes a WebAuthn passkey verified by the `ledger` Function). No Google sign-in required for parents.
- **The Math Gate is removed entirely** (its unlock tab, the `mathChallengeEnabled` setting and its Parent Portal toggle).
- **One link for the whole app is a required goal** (Phase 6): the three public links caused confusion about which address to use.
- AI Crafting is parent-only and costs no currency.
- **Stick with current rule for task/habit denials (no negative balances):** per `.agents/rules/task_and_currency_lifecycle_rules.md`, denying a submission deducts auto-issued Tokens, Hero XP, and Pet Sparks **clamped at 0** — balances never go negative.
- Prefer free options ($0/mo) over an always-warm server (section 3.12).

This plan is for review only. Implementation happens after Dj approves it.

---

## 0. TL;DR

* The app is a **Vite + vanilla-JS PWA on Firebase** (Firestore, Anonymous/Google Auth, Storage, Cloud Functions v2 in TypeScript), with an Express server (`server.js`) on Firebase App Hosting and a Raspberry Pi, and a separate Python FastAPI service on Cloud Run for the AI companion.
* **There is no server-side authority for any balance.** Every device keeps the whole family state in memory and `localStorage`, mutates balances locally (110+ call sites in `src/state/store.js`, plus direct mutations in views), and pushes the **entire household state** as one Firestore document with `setDoc(..., {merge:true})`. Other devices merge it back using per-field **last-writer-wins timestamps taken from each device's own clock**. Balances are replicated as absolute numbers, not as transactions.
* That design causes the reported sync bugs through several independent paths (section 2): a failed or skipped push is never retried, so the approving device keeps the only copy; a device running an older build, or one whose clock is ahead, overwrites the approval and the approving device "repairs" only itself; concurrent earns on two devices lose increments by construction; Pet XP is not timestamp-protected at all; and the monolithic document (~390 KB+ with triple hero copies and static catalogs) grows toward Firestore's 1 MiB limit, threatening both currency and non-currency data. Meanwhile, security rules let anyone who knows the household code rewrite any balance without signing in, and the parent PIN sits in plain text in that same readable document.
* **Decision (ADR-001): build a native double-entry ledger inside the existing Firebase stack using a single consolidated Cloud Function v2 (`minInstances: 0`, `preferRest: true`), at $0 extra monthly cost.**
  * Every balance/approval/inventory mutation goes through one server-side callable (`ledger`) running an Admin SDK Firestore transaction backed by a shared, unit-testable ledger core (`shared/ledger/`).
  * `firestore.rules` stays simple and airtight (`allow read: if isMember(code); allow write: if false;` on all ledger subcollections), avoiding the brittle Firestore Security Rules limits (20 document-access calls per transaction, 1,000-expression ceiling, no loops for nested map immutability) that make rules-validated client transactions ("Native B") fragile.
  * Every device subscribes with `onSnapshot` to `wallets/{heroId}` and `approval_requests`. Because all family actions share one Function container (and parents already hit it on PIN unlock), warm operations sync across devices in ~200–350 ms; only the first tap after ~15 minutes of total family idle pays a ~2–4 s cold start, hidden on the acting device by optimistic UI.
  * Do not adopt Blnk, Formance, LedgerForge, Nakama, or `game-transactions-backend`: each adds a separate server and SQL database to host and maintain without fitting Firebase Auth or real-time browser sync.
* Execute in **7 focused phases (Phases 0–6)** (section 6). Phase 0 ships immediately to stop failed-push data loss and shrink the monolithic household document. Phase 6 consolidates the app onto one link.

---

## 1. Discovered stack

### 1.1 Runtime map

| Layer | What is actually in the repo | Evidence |
|---|---|---|
| Client | Vite 6 PWA, vanilla ES modules (no React/Vue), Tailwind 4, Three.js-style canvases, `@google/model-viewer`, Spline, echarts | `package.json`, `src/main.js`, `vite.config.js` |
| Client state | One hand-written singleton store, about 12.2k lines, with a subscribe/notify pattern | `src/state/store.js` (`store`, `saveState`, `hydrateFromCloud`) |
| Local persistence | `localStorage` key `little_heroes_adventure_master_v10` (whole state) and `BroadcastChannel('little_heroes_realtime_sync')` between tabs | `store.js` `STORAGE_KEY`, `firestoreSyncService.js` |
| Cloud sync | Firebase JS SDK v12 modular Firestore: one doc `households/{CODE}`, `onSnapshot` listener and debounced (350 ms) full-state `setDoc(merge:true)` | `src/services/firestoreSyncService.js` |
| Auth | Firebase Auth: Anonymous (every device), Email/Password and Google for parents. Parent "unlock" is purely client-side, through three gates in `ParentLockModal.js`: Biometric (`src/utils/biometrics.js`), PIN (`store.verifyParentPin`) and a Math Gate; `pinLockEnabled` can be off | `src/config/firebase.js` (`signInAnonymously`), `store.js` `parentSettings.pin`, `unlockParentSession`, `src/components/ParentLockModal.js` |
| Database | Cloud Firestore only (databases `(default)` and `default` both bound to `firestore.rules`). No RTDB, no Postgres, no SQLite | `firebase.json` |
| Security rules | `firestore.rules` (499 lines). Households readable and writable by **anyone who knows the code**, schema and size checks only | `firestore.rules` `match /households/{householdCode}` |
| Cloud Functions | TypeScript, Node 22, `firebase-functions` 7, `firebase-admin` 14. Callables: `updateCompanionSettings`, `getParentInsights`, `chatWithPet`, `verifyChoreSubmission`, `generateDailyMicroQuests`. HTTP: `api` (Gemini proxy). **None touch balances.** Deployed by `.github/workflows/firebase-functions-deploy.yml`, so the project is on the Blaze plan | `functions/src/*.ts` |
| Node server | Express 5 `server.js` on Firebase App Hosting (`littleheroes-g1`, `minInstances: 0`) and on the family Pi: AI, voice, fridge, meals, ntfy relays. Reads households over the **public REST API with the code** (`server/householdReader.js`) | `server.js`, `server/*.js`, `apphosting.yaml` |
| Python | `little-heroes-agy-service/` FastAPI on Cloud Run (`little-heroes-rex-agy`), AI companion agents, `firebase-admin` persistence for companion memory. **No currency logic** | `little-heroes-agy-service/main.py`, `persistence/firestore_store.py` |
| AI image gen | Cloudflare Workers AI via `server/imageGenService.js`, Firebase AI Logic (`src/services/firebaseAILogicService.js`) for the Parent Studio | |
| Hosting | GitHub Pages, Firebase Hosting (classic), Firebase App Hosting, Pi | `CLAUDE.md`, workflows |
| Tests | Node scripts in `scratch/` run by `scratch/run_all_tests.js`, with a mock DOM in `scratch/setup_mock_env.js`. **No Firestore emulator and no rules tests in CI** | `scratch/`, `.github/workflows/ci.yml` |

### 1.2 Currencies and progression values (as stored today)

All live on each hero object (`state.heroes[i]`, mirrored into `state.selectedHero`), and are pushed inside `heroesMap.{heroId}`, `heroes[]`, **and** `stateSnapshot.heroes`, so three copies are written per push.

| Product name | Field(s) | Earned by | Spent by | Cross-device protection today |
|---|---|---|---|---|
| **Gold Points** ⭐ | `hero.points` | Parent approval of a `task_point_approval` request (`approveParentRequest`, `store.js`) | Real-life reward: kid requests (`redeemRealLifeReward`), parent approval deducts (`approveParentRequest`, `req.type === 'reward'`) | `fieldStamps.points` (device-clock LWW) |
| **Habit Tokens** 🪙 | `hero.coins`, mirrored in `hero.tokens` | Auto-issued on task, habit, battle, quest, expedition, map, workout and dance completion; +50 per hero level-up (`addXP`); arcade | `buyPet` (150), `buyDigitalGear`, `buyAndEquipGear`, `buyProfileTheme`, `buyHabitatSlot`, `buyTreatPack`, `unlockHQFurniture`, Studio items in the Shop | `fieldStamps.coins/tokens` |
| **Pet Sparks** ⚡ | `hero.petSparkMap[petId]`, plus `hero.sparks` (the active pet's value) and a household fallback `state.petSparkMap[`${heroId}_${petId}`]` / `state.petSparkMap[petId]` (read order in `getPetSparks`) | `addPetSparks` (**every award also adds 2× the amount as Pet XP**: `addPetSparks` → `addPetCareXp` → `addPetTrainingXp(amount * 2)`), `syncHabitPetCare`, completions | `deductPetSparks` (Shop items with `costSparks`) | `fieldStamps.sparks` covers only the mirror. The map is merged by whole-object spread |
| Evolution Sparks (**not a separate currency**) | `hero.evolutionSparks` | Nothing of its own: `addEvolutionSparks` just calls `addPetSparks`, and `addPetSparks` / `deductPetSparks` set `evolutionSparks = sparks = petSparkMap[pet]` (store.js ~10826, ~10858) | Same as Pet Sparks | `fieldStamps.evolutionSparks` (mirror only). **The ledger has no separate Evolution Sparks balance**; it is shown from the active pet's `PET_SPARKS` |
| **Hero XP** | `hero.xp` (XP into the current level), `hero.level`, `hero.xpNext` (curve: 100, then ×1.35 rounded per level) | `addXP` (and direct `hero.xp +=` in `WorldAdventureMapView.js`) | denial reversal (clamped at 0) | stamped |
| **Pet XP** | `hero.petXpMap[petId]` (XP into the level), `hero.petLevelMap[petId]` (cap 25, needs `level*100`), plus legacy household-level `state.petXpMap/petLevelMap` | `addPetTrainingXp`, `addPetCareXp` | `deductPetTrainingXp` | **None.** Not in `HERO_STAMPED_FIELDS`; `{...localH, ...cloudH}` means any incoming snapshot replaces it |
| Pet bond XP | `petSanctuary.petBondMap[petId].xp` | `PetSanctuaryCanvas.js:231` | none | none (household-level map, whole-object overwrite) |
| Streak / stars | `hero.streak`, `hero.stars` | completions | none | `Math.max` merge (cannot go down across devices) |
| Screen-time bank | `hero.screenTimeMinutes`, `screenTimeUsedToday` | `grantScreenTimeBonus` | `deductScreenTime` | stamped. **Out of scope for v1**, see open question Q2 |
| Pending approvals | `state.pendingApprovals[]`, `state.resolvedApprovals[]`, `state.taskCompletionLogs[]`, `state.taskLedgerLogs[]` | `enqueuePendingApproval` and friends | `approveParentRequest`, `rejectParentRequest`, `approveAllPendingRequests`, `clearAllPendingApprovals` | Hand-written union and tombstone merges in `hydrateFromCloud` §9 |
| Inventory | `hero.inventory[]` (ids), `hero.consumables[]` (servings), `state.inventory[]` (legacy household-wide) | purchases, gifts (`grantStudioItemToHero`), bounties, chests, expedition gear drops (`claimExpeditionRewards`), the toothbrush battle's "Mint Knight Badge" | `feedPetConsumableSnack`, `feedPetTreat`; parent deletes (`deleteCustomAIFurniture`, `deleteCustomAIFood`) | set-union merge, so **items can never be removed across devices** |
| Pets and habitat slots | `hero.unlockedPetIds[]`, `hero.habitatSlots`, `hero.hasChosenStarterPet` | `buyPet`, `buyHabitatSlot`, `choosePet` (free starter; `second_pet` / `third_pet` also raise `habitatSlots` to 2 / 3 for free), `adoptPetIntoSlot` (free into an open slot), `hatchMagicEgg` (eggs come from `addCustomAIPet` egg delivery), `addCustomAIPet` instant delivery, `editHero` | none | set-union merge |

Multipliers: pet gear `coin_boost` and `xp_boost` buffs are computed on the client (`getActivePetGearBuffs`) and added to awards.

### 1.3 Connected systems (sources and sinks)

**Parent approval flow (today)**
1. Kid completes a habit or task on device K: `toggleHabitIsland` / `toggleTaskForest` / `completeToothbrushBattle` / `completeAiQuest` / `claimExpeditionRewards` / `discoverWorldSecret` / `interactWithCustomLandmark` / `completeAdventureGame` / `completeMovementRoutine` / `unlockParentWorldChest` / `submitChoreWithPhoto` and the others marked approval-gated in section 3.13, in `store.js`. Tokens, XP, and sparks are **added locally right away**, and a `task_point_approval` request is pushed into `state.pendingApprovals`, then `saveState(true)`.
2. `saveState` runs `syncSelectedHeroWithHeroes()`, `stampHeroFieldChanges()` (which stamps changed fields with `Date.now()` of K), writes `localStorage`, broadcasts to other tabs, then `firestoreSync.pushStateToCloud(true)`.
3. `_doPush` builds the **whole state** (`stateSnapshot` plus ~60 top-level fields, ~390 KB for a fresh one-kid household) and calls `setDoc(households/CODE, ..., {merge:true})`.
4. Parent device P gets the snapshot in `onSnapshot`, then `store.hydrateFromCloud`, and the request appears in the Parent Portal (`ParentPortalView.js` calls `store.approveParentRequest(id)`).
5. `approveParentRequest` does `hero.points += pendingPoints` **on P only**, marks the log approved, splices the request, `markApprovalResolved`, then `saveState(true)`, which pushes P's whole state again.
6. Every other device must receive P's push **and** win the per-field timestamp merge in `hydrateFromCloud` §3 (`resolve('points', …)`) for the approval to appear.

**Rewards Shop** (`src/views/ShopView.js` calls `store.buyDigitalGear`, `buyProfileTheme`, `redeemRealLifeReward`, `feedPetConsumableSnack`): the price comes from the client catalog (`digitalGear`, which a parent can re-price in `ParentPortalView.js`). The balance check and deduction run locally, and the inventory append is local. There is no reservation for Gold Point rewards: a kid can file several reward requests that together exceed their balance, and approval then clamps at 0 (`Math.max(0, points - costPoints)`), making later rewards free.

**3D Studio** (Parent Portal "AI Studio"): parents create items (name, price `costCoins`, stats, 3D model URL, thumbnail via `studioArtService.persistStudioImage` to Cloud Storage). Delivery is `instant_gift` (crate), `habit_bounty`, or `shop` listing. Kids buy listed items with Habit Tokens through the normal Shop path. Equipping is free and only changes cosmetic or buff state.

**AI Crafting**: AI generations (Studio concept art/models via Firebase AI Logic, story illustrations via Cloudflare Workers AI) **are free and charge no currency**. **Decision (Dj): AI Crafting stays parent-only and never touches a balance**, so the ledger has no AI-crafting sink or AI holds. Gating the Studio's AI endpoints behind a parent session is included in Phase 5.

### 1.4 Other direct balance mutations outside the store (must be migrated)

* `src/views/DancePartyView.js` lines 1390, 1760, 1818, 1900, 2002, 2060: `store.getState().selectedHero.coins += …`
* `src/views/WorldAdventureMapView.js` lines 874, 875, 912, 913: `hero.coins += 25; hero.xp += 20`
* `src/components/PetSanctuaryCanvas.js:231`: pet bond XP
* `src/views/ParentPortalView.js` lines 5096 to 5114 edit **reward rates** (`habit.coins`, `chore.points`), not balances. Those become `reward_rules` (section 3.8).

### 1.5 Current security posture relevant to currency

* `households/{code}`: `allow get` with only a valid code format, `allow update` through `isAllowedHouseholdSyncUpdate`, which requires **no auth** and validates shape and size only. Anyone who knows the household code can set any kid's `points`, `coins`, and XP to any value.
* `parentSettings.pin` (default `'1234'`) is stored in plain text in that world-readable document, so the "parent-only" approval gate is advisory. It is there **twice**: top-level `parentSettings.pin` and `stateSnapshot.parentSettings.pin` (`buildCloudStateSnapshot` copies every state key that is not local-only), and it is also in every device's `localStorage` copy of the state, so every push writes it back.
* Subcollections under households are denied (`match /{allChildren=**} { allow read, write: if false; }`). New ledger and domain collections need explicit rules.
* `server/householdReader.js` (Pi weekly report, fridge display) reads the household doc **unauthenticated over REST** and shows `hero.points/coins` (`shared/fridgeSnapshot.js:92`). Locking reads down would break it unless a projection is kept (`households/{CODE}/public/walletSummary`, section 3.7) until Phase 5 migrates the Pi reader to an authenticated path.
* The Pi server also **writes** the household doc: `server/mealsService.js` calls `updateHouseholdField` (`server/householdReader.js`), an unauthenticated REST PATCH of `stateSnapshot.mealPlan`. Phase 5 must move both the reads and this write to a service account (Admin SDK) before rules require membership, or meal planning breaks.

---

## 2. Root-cause analysis: why approvals and data fail to sync across devices

The underlying cause is architectural: **balances and household state are client-authoritative snapshots replicated by last-writer-wins over one shared document, with device clocks as the arbiter.** The specific paths below each trap updates on one device (all confirmed in the code):

| # | Failure path | Where | Effect |
|---|---|---|---|
| R1 | **Failed push is never retried.** `_doPush` catches any error, sets `lastPushError`, and returns without rescheduling. `await ensureAuthReady()` sits **outside** the `try`, so an anonymous sign-in failure rejects silently. During a quota cooldown (`markQuotaExhausted`, 60 s), `pushStateToCloud` returns early **without scheduling a retry**. | `firestoreSyncService.js` `pushStateToCloud`, `_doPush` | P's `hero.points` and `localStorage` are updated, the cloud is not, and P shows the points. Others never see them until P happens to save something else successfully. |
| R2 | **Stale or older-build writer and one-sided repair.** A device on an older service-worker build, or a kiosk tablet (Fridge mode) that has not reloaded, pushes `heroesMap` with an old `points` and a missing or older stamp. P's `hydrateFromCloud` sees its local stamp is newer, keeps its own value, and sets `repairPushNeeded`. The repair push can be overwritten again by the next stale push. | `store.js` `hydrateFromCloud` §3 `resolve()`, `repairPushNeeded` | P keeps showing approved points. The cloud copy, which every other device reads, keeps flipping back. |
| R3 | **Device-clock timestamps.** `stampHeroFieldChanges` uses `Date.now()` of each device. A kid tablet whose clock runs ahead stamps any local change with a "future" time that beats P's real, later approval. | `store.js` `stampHeroFieldChanges`, `resolve()` | P's approval loses the merge on every device except P. |
| R4 | **Lost updates on counters.** Two devices each add to `coins` or `xp`. The merge keeps one device's absolute value and discards the other increment. | design | Balances silently drift by the "losing" amount. |
| R5 | **Pet XP and the pet-spark map are not protected at all.** `petXpMap`, `petLevelMap`, `petSparkMap` (except the active-pet mirror), and `consumables` are merged with `{...localH, ...cloudH}`, so whichever snapshot arrives last wins wholesale. | `hydrateFromCloud` §3 | Pet XP earned on one device is erased by any other device's next push. |
| R6 | **Echo suppression by session id.** Snapshots whose `lastWriterSessionId` equals this session are skipped entirely. With `merge:true`, a snapshot that also carries another device's concurrent fields is ignored. | `firestoreSyncService.js` `startSync` | Remote changes (both currency and non-currency) that coincide with a local write are dropped until the next remote write. |
| R7 | **Document size and write amplification.** Each save rewrites ~390 KB or more (three copies of heroes, ~140 KB of static `digitalGear`, `pets`, every log) against Firestore's 1 MiB document limit and daily write quota. Growth in `taskCompletionLogs` (rules allow 1000), `bedtimeStoryLibrary` (200), Studio items, and story text moves the household toward `invalid-argument: exceeds maximum size`, which triggers R1. | `_doPush`, `buildCloudStateSnapshot` | Every push from every device fails once the limit is crossed — freezing both currencies and non-currency data on the originating device. |

Other currency issues fixed by the same migration:

* V1: Anyone with the household code can write any balance without signing in (section 1.5).
* V2: Parent PIN is readable by every kid device; approvals are not authenticated.
* V3: Reward requests do not reserve Gold Points, so over-redemption is possible and clamping makes extra rewards free.
* V4: Prices, reward amounts, and pet-gear buffs are taken from client data, so a modified client can award itself anything.
* V5: Inventory uses set-union merge, so a consumed or removed item reappears from another device.
* V6: `approveAllPendingRequests` approves requests from the local list; a request already rejected on another device but not yet synced here gets approved too.

*(Note on task/habit denial: per `.agents/rules/task_and_currency_lifecycle_rules.md` and Dj's confirmation, deducting auto-issued Tokens, Hero XP, and Pet Sparks clamped at 0 is the **intended** behavior — balances must never go negative.)*

---

## 3. ADR-001: Where the ledger lives

### 3.1 Context

* Requirements: an atomic, append-only double-entry ledger; integer amounts; strict `>= 0` balance invariant (including clamped-at-0 denial reversals); idempotency on every mutation; holds for reward requests; fast real-time propagation to every device; automatic re-sync on reconnect; and reliable non-currency data sync. Offline writes are **not** required (brief blips are handled via a persistent retry outbox).
* Constraints: a one-family hobby project with no ops team, on Firebase's Blaze plan (Functions are deployed), with a Pi at home. **No new monthly costs ($0/mo)** (Dj, section 3.12). Until Phase 6, clients are PWAs on four hosts (GitHub Pages, classic Firebase Hosting, App Hosting, Pi), so the backend must be reachable cross-origin with Firebase Auth. Phase 6 consolidates to one link; the ledger must not depend on any host-specific behaviour.
* Scale: ~1 household, <10 kids, <10 devices, and at most a few hundred ledger transactions per day. Contention is per kid wallet, well under 1 write per second.

### 3.2 Options considered

Repository facts were verified via the GitHub API and source inspection.

| Option | What it gives | What it lacks / risks for this app | Ops and cost to add |
|---|---|---|---|
| **Blnk** (`blnkfinance/blnk`, Go, Apache-2.0, ~600★, active) | Balances, inflight (hold) transactions, bulk, reconciliation, webhooks | No browser real-time API; own auth model; built for fiat money | Cloud Run, Cloud SQL Postgres, Redis, plus a bridge into Firestore |
| **Formance Ledger** (`formancehq/ledger`, Go, MIT, ~1.5k★, active) | Numscript for atomic multi-party postings, mature double-entry | Same as above; Numscript is a second language to maintain | Cloud Run and Postgres, plus a projection to Firestore |
| **LedgerForge** (`devaccuracy/ledgerforge`, Go, Apache-2.0, ~325★) | Integer math, audit hash chain, spending limits, approval holds | Younger project; no client fan-out | Cloud Run, Postgres, and Redis |
| **mkmbhs/ledger** (Go, MIT, 2★) | Small reference for idempotent transfers and authorize/capture/void | Reference code, not maintained as a product | Useful only as **design reference** |
| **Nakama** (`heroiclabs/nakama`, Go, Apache-2.0, ~13.8k★, active) | Per-user wallets, wallet history, real-time sockets and notifications | Replaces Firebase Auth and sync on every device. Single-entry wallet with no idempotency and no holds (section 3.2.1) | Always-on Go server and CockroachDB or Postgres |
| **Viid21/game-transactions-backend** (TypeScript/NestJS, MIT, 0★) | Steam real-money checkout for Unity: order → confirm → grant inventory once | No virtual currency, no balances, no earning, no real-time (section 3.2.1) | NestJS service and Postgres |
| **Native B: Client transactions checked by Firestore Security Rules** | Zero cold starts on the hot path (~150–400 ms) | **Hits hard Firestore Rules limits:** max **20** `get`/`exists`/`getAfter`/`existsAfter` calls across an entire multi-doc transaction (10 per write), max 1,000 expressions per request, and no loops to verify untouched keys in nested maps (`pets`, `activityCounts`). Duplicates all ledger logic into an unergonomic DSL. Parents still pay a Function cold start on PIN unlock anyway. | No new services ($0/mo), but high maintenance and security-bug risk |
| **Native A (chosen): Single consolidated Cloud Function v2 (`minInstances: 0`, `preferRest: true`) as the only writer** | **100% server-authoritative** in clean, unit-testable TypeScript (`shared/ledger/`); `firestore.rules` is ~20 lines (`allow write: if false`); no Rules 20-call/1,000-expression ceiling; Admin SDK `runTransaction` updates `wallets/{heroId}` and pushes to all devices via `onSnapshot` | First call after ~15 min of total family idle pays a ~1–2 s cold start (mitigated by `preferRest: true`, lazy imports, single shared container, and 0 ms optimistic UI on the acting device). Warm calls sync in ~200–350 ms. | **No new services and $0/month** inside Cloud Run & Firestore free allowances (section 3.12) |

#### 3.2.1 Deep dive: Nakama and game-transactions-backend

* **Viid21/game-transactions-backend** (NestJS, Prisma, PostgreSQL): a starter for real-money Steam microtransactions (`Order` → `confirmPurchase` → `Fulfillment` → `Inventory`). No wallet, no virtual currency, no earning, no real-time. Worth borrowing: writing a **unique idempotency record in the same transaction** as the grant.
* **heroiclabs/nakama** (Go, CockroachDB/Postgres): provides integer `int64` wallets (`server/core_wallet.go`) and `wallet_ledger`, but is **single-entry** (no counter-accounts), has **no idempotency keys** or **holds**, requires manual `nk.notificationSend` over WebSockets for real-time updates, and forces replacing Firebase Auth/household-code join with Nakama user accounts plus hosting an always-on Go server + SQL DB.

**Scorecard against this app's needs**

| Need | Native A (chosen) | Native B (Rules) | Nakama | game-transactions-backend |
|---|---|---|---|---|
| Atomic balance change | Yes (Admin SDK tx) | Yes (Client tx) | Yes (`FOR UPDATE`) | Inventory only |
| Double-entry record | Yes | Yes | No (single-entry) | No balances |
| Idempotency keys | Yes (`txnId` doc) | Yes (`txnId` doc) | Custom code | Per order only |
| Holds for reward requests | Yes (section 3.6) | Yes | Custom code | No |
| Clamped-at-0 denial reversal | Yes (exact clamped delta) | Complex in Rules | Custom code | No balances |
| Live updates to every device | Yes, `onSnapshot` | Yes, `onSnapshot` | Manual notifications | No |
| Simple, auditable security rules | **Yes (`write: if false`)** | No (400+ lines, 20-call risk) | N/A | N/A |
| Keeps Firebase Auth & household join | Yes | Yes | No | No |
| New infrastructure / monthly cost | **None ($0/mo)** | None ($0/mo) | Go server + SQL DB | NestJS + Postgres |

### 3.3 Decision

Implement the double-entry ledger **natively in Firestore** as **Native A**:
* **Single consolidated callable Cloud Function `ledger` (v2, Node 22, `minInstances: 0`, Admin SDK with `preferRest: true`):** handles every ledger mutation, membership join, and parent unlock (PIN verification/update and passkey registration/verification) via an `action` dispatch. Sharing one container across all actions keeps it warm during active family sessions (e.g., kid completes a chore or parent enters PIN → subsequent approvals and shop buys run warm in ~200–350 ms).
* **Scheduled / Trigger Functions (`minInstances: 0`):** `ledgerReconcileNightly` (daily, incremental, section 3.8), and `mirrorWalletSummary` (Firestore trigger on `wallets/{heroId}` to keep `households/{CODE}/public/walletSummary` fresh for the Pi/fridge REST reader).
* **Security rules:** all ledger subcollections are **read-only for household members** (`allow write: if false;`), eliminating client tampering and Rules DSL complexity.
* **Client subscriptions:** every device subscribes with `onSnapshot` to `wallets/{heroId}`, `approval_requests`, and `inventory`.
* Borrow the authorize/capture/void hold model from Blnk and `mkmbhs/ledger`, and the zero-sum double-entry invariant from Formance.

### 3.4 Consequences

* **Positive:** $0 extra monthly cost; 100% server-authoritative validation in plain TypeScript; trivial security rules; zero risk of hitting Firestore Rules' 20-access-call or 1,000-expression limits; one source of truth reachable from every link while they still exist, and from the one link after Phase 6; full audit trail.
* **Trade-off:** The very first ledger action after ~15 minutes of total household idle incurs a ~2–4 s cold start on Cloud Run (section 3.12). Optimistic UI updates the acting device in 0 ms, and all subsequent actions during the session run warm (~200–350 ms cross-device).
* **Escape hatch:** If Dj ever wants 0 ms cold starts even on the first tap of the day, setting `minInstances: 1` on the single `ledger` Function is a one-line config change (~$3–8/mo) with zero code rewrite.

### 3.5 Ledger model

**Units.** Every amount is a JavaScript safe integer. All five currencies are whole numbers (1 unit = 1 point, token, spark, or XP). `shared/ledger/core.js` rejects `NaN`, `Infinity`, fractions, and values above `Number.MAX_SAFE_INTEGER`.

**Currencies** (`shared/ledger/currencies.js`): `GOLD_POINTS`, `HABIT_TOKENS`, `PET_SPARKS` (per pet), `HERO_XP`, `PET_XP` (per pet). Later, optionally: `PET_BOND_XP`, `SCREEN_MINUTES` (Q2).

**No `EVOLUTION_SPARKS` currency.** In today's code `evolutionSparks` is only a copy of the active pet's sparks (section 1.2). The client shows "Evolution Sparks" from the active pet's `PET_SPARKS`, `addEvolutionSparks` maps to a `PET_SPARKS` award, and the backfill ignores `hero.evolutionSparks` (it logs any hero where it differs from the active pet's sparks). A separate balance would count the same sparks twice.

**Pet Sparks also pay Pet XP (keep today's coupling).** Every `PET_SPARKS` award in `core.js` also adds `2 × sparks` to that pet's `PET_XP` in the same transaction, exactly as `addPetSparks` → `addPetCareXp` does today. A `reward_rules.petXp` amount is paid **on top** of that and is seeded only from activities that call `addPetTrainingXp` / `addPetCareXp` directly. Spark *spends* do not remove Pet XP (today's `deductPetSparks` doesn't either).

**Accounts.**
* **Kid accounts:** one per kid and currency (per pet for pet currencies), materialized on `wallets/{heroId}`.
* **System accounts (per household):** `treasury_mint`, `opening_balance`, `shop_sink`, `reward_redemption_sink`, `pet_training_sink`, `spark_sink`, `clawback`, `adjustment`. Computed from the opposite side of `ledger_transactions` during nightly reconciliation.
* **XP as a ledger currency:** cumulative XP is stored on the wallet; hero level and pet level are **derived** from cumulative XP using `shared/ledger/curves.js` and stored on the wallet as a convenience.

**Strict non-negative invariant & denial reversal (Dj's decision / `.agents/rules/task_and_currency_lifecycle_rules.md`).**
* **Every kid balance must remain `>= 0` for all transaction types.**
* When a parent denies a task/habit submission (`REJECT_TASK_CLAWBACK`), the server reads the original earn transaction (`earnTxnId`) and, for each auto-issued currency (Tokens, Hero XP, Pet Sparks, Pet XP), computes the **clamped deduction**:
  ```
  actualDeduction = Math.min(currentWalletBalance, originalAward)
  delta = -actualDeduction   // guarantees balanceAfter >= 0
  ```
* The `clawback` system counter-account is credited with `+actualDeduction`, so the transaction remains strictly double-entry and zero-sum while never taking a kid's balance below 0. If `actualDeduction < originalAward` (because the kid already spent some tokens), the shortfall is recorded in `metadata.clampedShortfall` for audit visibility, and the task/habit resets to uncompleted with a "Needs Redo" prompt.

**Transaction document** (`ledger_transactions/{txnId}`, where `txnId` is the deterministic idempotency key — created once, immutable):
```
{ txnId, type, heroId, petId?,
  delta: { GOLD_POINTS: int, HABIT_TOKENS: int, HERO_XP: int, PET_XP: int, PET_SPARKS: int },
  heldDelta?: { GOLD_POINTS: int },   // hold changes kept OUT of delta so delta stays zero-sum with counterAccount
  counterAccount: 'treasury_mint' | 'shop_sink' | 'reward_redemption_sink' | 'pet_training_sink' | 'spark_sink' | 'clawback' | 'adjustment' | 'opening_balance',
  levelBefore: int, levelAfter: int, petLevelBefore?: int, petLevelAfter?: int,
  refs: { activityType?, activityId?, requestId?, itemId?, reversesTxnId? },
  metadata?: { clampedShortfall?: { [currency]: int }, memo?: string,
              legacyAward?: { HABIT_TOKENS, HERO_XP, PET_SPARKS, PET_XP, preBattleLevel?, levelsGained? } }, // backfill earn records only (section 3.11 step 7)
  actor: { uid, deviceId, role: 'device' | 'parent' | 'system' },
  walletVersionBefore: int, walletVersionAfter: int,
  createdAt: Timestamp }
```

**Transaction types:** `EARN_ACTIVITY` (includes any `LEVEL_UP_BONUS` in the same transaction), `APPROVE_TASK_POINTS`, `REJECT_TASK_CLAWBACK` (clamped at 0), `REWARD_REQUEST_HOLD`, `REWARD_APPROVE_CAPTURE`, `REWARD_REJECT_VOID`, `SHOP_PURCHASE`, `PET_XP_SPEND`, `SPARK_SPEND`, `CONSUME` (inventory only, zero deltas), `GIFT_GRANT` (inventory only), `ITEM_REVOKE` (inventory only, parent), `PARENT_ADJUSTMENT`, `OPENING_BALANCE`. No AI-crafting types (AI Crafting is parent-only and free).

### 3.6 Holds (reward requests only)

* Reservation model: a hold does not deduct Gold Points; it raises `held.GOLD_POINTS` on the wallet.
* Request (`REWARD_REQUEST_HOLD`): requires `balance - held >= cost` (price read server-side from `catalog/reward:{rewardId}`). Creates `holds/{requestId}` (`status: 'authorized'`, `amount`) and `approval_requests/{requestId}`. **No expiry:** per `.agents/rules/task_and_currency_lifecycle_rules.md` rule 4, pending approvals never disappear because of time limits; a hold stays until a parent approves or rejects it.
* Approve (`REWARD_APPROVE_CAPTURE`, parent session required): `balance -= cost`, `held -= cost`, hold → `captured`, request → `approved`.
* Reject (`REWARD_REJECT_VOID`, parent session required): `held -= cost`, hold → `voided`, request → `rejected`.
* The hold document ID equals `requestId`, so double taps or concurrent devices cannot create duplicate holds.

### 3.7 Firestore data model

Everything new lives under `households/{CODE}/…`.

```
households/{CODE}                         (existing doc; gains server-only fields)
  ledgerMode: 'legacy' | 'migrating' | 'authoritative'   // set by backfill/rollback scripts only
  // walletSummary does NOT live here (see public/walletSummary below): every wallet change would
  // otherwise rewrite this ~100+ KB doc and resend it to every listening device.
  // A device must be listed in members/{uid} before it can read any ledger data (section 3.8, joinHousehold).

households/{CODE}/public/walletSummary                             // written by mirrorWalletSummary trigger only
  { heroes: { [heroId]: { points, coins, sparks, xp, level, version } }, updatedAt }
  // get-readable with the household code, like the household doc today, so the Pi/fridge reader
  // (server/householdReader.js) keeps working before Phase 5 moves it to a service account.

households/{CODE}/members/{uid}
  { uid, role: 'parent' | 'device', deviceId, joinedAt }            // written by ledger(joinHousehold)

households/{CODE}/parent_sessions/{uid}
  { uid, expiresAt }                                                // written by ledger(verifyParentPin), 20 min TTL

households/{CODE}/private/parentAuth
  { pinHash, pinSalt, algo: 'scrypt', failedAttempts, lockedUntil } // Admin SDK only

households/{CODE}/private/preCutoverSnapshot
  { savedAt, householdDoc: <full copy of households/{CODE} taken right after --freeze> } // Admin SDK only, used by rollback.mjs
  // Includes the plain-text PIN until Dj confirms the cutover is good; then cleanup_snapshot.mjs deletes it.

households/{CODE}/private/passkeys
  { credentials: { [credentialId]: { publicKey, counter, transports, label, rpId, createdAt } } } // Admin SDK only

households/{CODE}/passkey_challenges/{uid}
  { challenge, kind: 'register' | 'authenticate', expiresAt }      // Admin SDK only, 5-min TTL, deleted on use

households/{CODE}/heroes/{heroId}                                    // kid profile (NOT balances); client-writable, section 3.10
  { id, name, role, avatar, avatarDesign, gameDifficulty, activePetId, equippedGear, equippedPetGearMap,
    customGearDyesMap, savedHeroCards, storyMemory, storyProfile, streak, stars, screenTime* settings,
    companionTurnsToday, companionTurnsDate, arcadeHighScores,
    hq: { themeId, isNightMode, equippedFurniture: { [slot]: furnitureId } },   // each kid's own HQ (was household heroHQ)
    updatedAt, ... }
  // Never contains: points, coins, tokens, xp, level, xpNext, sparks, evolutionSparks, petSparkMap,
  // petXpMap, petLevelMap, inventory, consumables, unlockedPetIds, habitatSlots, unlockedThemes

households/{CODE}/wallets/{heroId}                                   // subscribed via onSnapshot
  { heroId, version: int, lastTxnId, updatedAt,
    balances: { GOLD_POINTS, HABIT_TOKENS, HERO_XP }: int,
    held:     { GOLD_POINTS }: int,
    heroLevel: int,
    pets: { [petId]: { PET_XP: int, PET_SPARKS: int, level: int } },
    activityCounts: { [activityType]: { day: 'YYYY-MM-DD', count: int } },  // day in ledger_config/household.timeZone, not UTC
    needsRedo: { [lockKey]: { requestId, rejectedAt } } }             // set on rejectTask, cleared on next recordActivity

households/{CODE}/ledger_transactions/{txnId}                        // append-only, section 3.5

households/{CODE}/holds/{requestId}
  { requestId, heroId, amount: int, status: 'authorized'|'captured'|'voided', createdAt, updatedAt }

households/{CODE}/approval_requests/{requestId}
  { requestId, kind: 'task_points'|'reward', heroId, taskId?, rewardId?, title,
    amount: int, earnTxnId?, cycleId?, status: 'pending'|'approved'|'rejected',
    createdBy, resolvedBy?, resolvedAt?, createdAt }

households/{CODE}/inventory/{ownerId}__{itemId}                     // ownerId = heroId (every kind, HQ furniture included)
  { ownerId, itemId, kind, qty: int, servingsRemaining?: int, lastTxnId, updatedAt }
  // kind: 'digital_gear' | 'pet_gear' | 'consumable' | 'treat' | 'studio_item' | 'theme' | 'pet' | 'habitat_slot' | 'hq_furniture'
  //       | 'badge' (e.g. 'Mint Knight Badge') | 'egg' (an unhatched parent AI pet egg, consumed by hatching)
  // Pets and slots: a kid can own at most 1 + (habitat_slot qty) pets, checked by the server on every pet grant or
  // purchase except parent grants, the same limit adoptPetIntoSlot enforces today. choosePet 'second_pet' / 'third_pet'
  // raise the free slot count to 2 / 3 (grantItem reason 'starter_pet', habitat_slot qty set to at least 1 / 2).
  // Entitlements that live on the hero or household today become inventory docs, granted in the SAME
  // transaction as the charge: unlockedPetIds -> kind 'pet'; habitatSlots -> kind 'habitat_slot' (qty = extra slots);
  // unlockedThemes -> kind 'theme'; state.inventory (pet gear, keyed by item NAME today) -> kind 'pet_gear'
  // keyed by item id; heroHQ.unlockedFurnitureIds -> kind 'hq_furniture', ownerId = heroId (per kid, Dj 2026-11-25:
  // every kid sees the whole furniture catalog, but each kid pays for each item to own it and place it in their own HQ).
  // Starter furniture (defaultState.heroHQ.unlockedFurnitureIds) and any catalog item with costCoins 0 are owned by
  // every kid without an inventory doc.
  // Equipping (equippedGear, equippedPetGearMap, heroes/{heroId}.hq.equippedFurniture, activePetId) stays a free
  // profile/household field, but the client only offers items the inventory shows as owned.

households/{CODE}/activity_locks/{heroId}__{lockKey}                // "one pending completion per task/habit"
  // lockKey = canonicalTaskId(taskId) = getTaskAliasGroup(taskId)[0] for EVERY approval-gated request that has a taskId,
  // habit/task or not. Today's alias groups (store.js getTaskAliasGroup) cross activity types: 'bedtime_story' is in the
  // sleep group, 'pajamas_tidy' in the clean-room group, 'toothbrush_adventure_battle' in the bedtime-brush group and the
  // 'wp_*' waypoint chores in their habit groups. Sharing the lock keeps today's rule that a kid cannot claim a habit and
  // its matching activity in one cycle. A taskId in no group is its own key (e.g. 'expedition_fern_woods', a shrine id,
  // a landmark id, a quest id). shared/ledger/ids.js keeps a copy of the alias table; a test checks it equals store.js.
  // wallet.needsRedo uses the same lockKey.
  { heroId, taskId, cycleId, requestId, earnTxnId, status: 'pending', createdAt }
  // created by recordActivity for approval-gated tasks, deleted by approveTaskPoints / rejectTask

households/{CODE}/catalog/{kind}:{itemId}                            // prices; parent-editable via Function
  { itemId, kind, title, costCoins: int, costSparks: int, costPoints: int, servingsPerPurchase?: int, active: bool }
  // Doc id is '{kind}:{itemId}' (e.g. 'reward:r1', 'digital_gear:g7', 'fee:expedition') so ids from different
  // catalogs cannot collide. kind 'fee' = a fixed Habit Token charge with no inventory grant
  // ('fee:expedition' 5, 'fee:picnic' 15, 'fee:feed_single_pet' at today's price).

households/{CODE}/reward_rules/{ruleId}                              // earn amounts; parent-editable via Function
  // ruleId = 'habit:{habitId}' or 'task:{taskId}' for per-item parent-edited payouts,
  // or generic '{activityType}' (e.g. 'dance_party', 'world_map', 'pet_bath') for fixed-payout activities.
  { ruleId, activityType, tokens: int, xp: int, sparks: int, petXp: int, points: int, dailyCap: int, maxBuffPercent: int }
  // petXp is paid on top of the automatic 2 × sparks Pet XP (section 3.5). points = Gold Points paid on approval
  // (today: req.pendingPoints || req.rewardPoints || 10).

households/{CODE}/ledger_config/curves                               // written by backfill script
  { heroCumXp: [int, ...], petMaxLevel: 25, levelUpBonusTokens: 50 }

households/{CODE}/ledger_config/household                           // written by backfill / parent settings via Function
  { timeZone: 'America/New_York' }   // IANA zone from the parent's device at backfill; activityCounts.day and dailyCap use it

households/{CODE}/ledger_reports/{date}                              // nightly reconciliation output
```

**Indexes (`firestore.indexes.json`):**
* `ledger_transactions`: `(heroId ASC, createdAt DESC)`
* `ledger_transactions`: `(heroId ASC, walletVersionAfter ASC)` (nightly reconcile)
* `approval_requests`: `(status ASC, createdAt DESC)`
* `holds`: `(status ASC, createdAt DESC)`
* Attach `"indexes": "firestore.indexes.json"` to the Firestore database blocks in `firebase.json` (note: `firebase.json` currently declares both `(default)` and `default`). Because the Firestore emulator does **not** enforce missing composite indexes, Phase 4 includes a production/staging query smoke test after deploying indexes.

### 3.8 Ledger operations

All interactive operations are handled by one callable Cloud Function (`ledger({ code, action, args, idemId? })`), which verifies Firebase Auth + household membership (and active `parent_sessions/{uid}` for parent actions) and executes an Admin SDK `db.runTransaction(...)`.

| Action | Who | Writes | Server validation (TypeScript) |
|---|---|---|---|
| `joinHousehold` | any authed uid with valid code | `members/{uid}` (with `deviceLabel`, `lastSeenAt`) | Household exists; device not in `revokedDeviceIds`; role `'parent'` if uid in `parentUids`. **Called on every app start** (idempotent: an existing member only gets `lastSeenAt` refreshed), from Phase 3 onward while the household is still legacy, so every device is a member before cutover. Each link is a separate origin, so a device joins once per link until Phase 6 |
| `revokeDevice` | parent session | deletes `members/{uid}` and `parent_sessions/{uid}` for that device, adds to `revokedDeviceIds` | Replaces today's client-only revoke so a revoked device loses read access immediately |
| `createHousehold` | any authed uid | `households/{CODE}`, `members/{uid}` (role `parent`), `ledger_config/*`, then `openWallet` for the first kid | Replaces today's client-only household creation in `authoritative` builds so the creator is a member from the start |
| `openWallet` | parent session | `wallets/{heroId}` (all zero or starting values), txn `OPENING_BALANCE`, `heroes/{heroId}` | Called by `addHero` (which today accepts starting `coins`, `points`, `level`); `txnId = open_{heroId}`; starting level converted to cumulative XP |
| `closeWallet` | parent session | wallet `archived: true`, txn zeroing balances to `adjustment` | Called by `deleteHero`; history kept for audit |
| `verifyParentPin` | member | `parent_sessions/{uid}` | `scrypt` compare against `private/parentAuth`; 5 wrong PINs lock **PIN entry only** for 15 min (household-wide, so new anonymous uids can't bypass it); a uid in `parentUids` (Google-signed-in parent) bypasses the lockout. A PIN lockout never blocks passkey sign-in, so a kid typing wrong PINs cannot lock a parent out of both ways in (Google sign-in is optional); 20-min session |
| `setParentPin` | parent session or `parentUids` | `private/parentAuth` | Valid 4–8 digit PIN; re-hashes with fresh salt |
| `passkeyRegisterBegin` / `passkeyRegisterFinish` | parent session (so a passkey can only be added after a PIN or existing-passkey unlock) | `passkey_challenges/{uid}`, `private/passkeys` | WebAuthn registration verified server-side (e.g. `@simplewebauthn/server`); `rpId` and expected origin must match the app's link (one passkey set per link until Phase 6); user verification required |
| `passkeyAuthBegin` / `passkeyAuthFinish` | member | `passkey_challenges/{uid}`, `private/passkeys` (counter), `parent_sessions/{uid}` | Challenge single-use and unexpired; signature valid for a stored credential; enforce `newCounter > storedCounter` **only when `newCounter > 0 || storedCounter > 0`** (synced platform passkeys such as Apple Face ID/Touch ID and Google Password Manager return `0` on every sign-in per WebAuthn spec); then issues the same 20-min parent session as `verifyParentPin`; works even while PIN entry is locked. Failed assertions use their **own** counter (5 failures lock passkey sign-in for 15 min), never the PIN counter |
| `removePasskey` | parent session | `private/passkeys` | Removes one credential |
| `recordActivity` | member | txn (`EARN_ACTIVITY`), wallet, optional `approval_requests` + `activity_locks` | `txnId = act_{heroId}_{activityType}_{activityId}_{cycleId}`. `cycleId` is a client UUID created once per completion attempt and stored in the outbox, so retries dedupe but tomorrow's (or the next cycle's) completion is a new transaction. Never key on the task id alone. Amounts read from `reward_rules/habit:{habitId}` or `reward_rules/task:{taskId}` for habits and tasks (using the canonical alias id), else `reward_rules/{activityType}` (table in section 3.13); Pet XP = `rule.petXp + 2 × sparks` (section 3.5); a habit or task with no rule is refused and logged, never paid a guessed amount, plus bounded pet-gear buff (`<= maxBuffPercent`); `activityCounts <= dailyCap` (arcade also keeps its own per-day coin cap); for approval-gated activities, reads `activity_locks/{heroId}__{lockKey}` in the transaction and refuses if one exists, else creates it and clears `wallet.needsRedo[lockKey]`; recomputes hero/pet levels + 50 tokens per level crossed |
| `approveTaskPoints` | parent session | txn (`APPROVE_TASK_POINTS`), wallet, request → `approved`, deletes `activity_locks` doc | Request `pending`; `delta.GOLD_POINTS == request.amount`; `txnId = approve_{requestId}` |
| `rejectTask` | parent session | txn (`REJECT_TASK_CLAWBACK`), wallet (sets `needsRedo[lockKey]`), request → `rejected`, deletes `activity_locks` doc | Request `pending`; reads `earnTxnId`; deducts `min(balance, originalAward)` per currency, **clamped at 0, never negative** (Tokens including any level-up bonus, Hero XP, Pet Sparks, Pet XP, as `rejectParentRequest` does today); sets `wallet.needsRedo[lockKey] = { requestId, rejectedAt }` so kid tablets show "Needs Redo" over the existing wallet listener; `txnId = reject_{requestId}` |
| `requestReward` | member | txn (`REWARD_REQUEST_HOLD`), wallet `held`, hold, request | Price from `catalog/reward:{rewardId}`; `balance - held >= cost`; one hold per `requestId` |
| `approveReward` / `rejectReward` | parent session | txn, wallet, hold, request | Hold `authorized`; capture deducts `balance` & `held`, void releases `held` |
| `purchase` | member | txn (`SHOP_PURCHASE`), wallet, inventory | Prices from `catalog/{kind}:{itemId}`; fixed fees (`fee:expedition`, `fee:picnic`, `fee:feed_single_pet`) charge Habit Tokens and grant nothing; a `pet` purchase checks the habitat-slot limit; items priced in Pet Sparks require `petId` (the sparks come from that pet's balance, as `deductPetSparks` does today); `balance - held >= price`; grants the inventory doc in the same transaction (entitlement kinds in section 3.7: one-time kinds refuse if already owned; `habitat_slot` increments; consumables add servings); `txnId = buy_{heroId}_{itemId}_{clientUuid}`. Covers every spend in section 3.13 |
| `grantItem` | parent session for parent reasons, member for the free reasons | txn (`GIFT_GRANT`, zero currency deltas), inventory for the named `heroId` | **Parent reasons:** `parent_gift` (gifts, custom AI furniture/food), `studio_crate`, `parent_pet` (`addCustomAIPet` instant delivery to the target kid or every kid; egg delivery grants kind `egg` instead), `parent_edit` (`editHero` adding pets or slots). **Member reasons** (free items only; never an item with a catalog price above 0): `hq_milestone` and `boss_trophy` (item carries that `milestoneRequirement` / trophy id), `battle_badge` (once per kid), `expedition_drop` (needs the `refs.activityId` of that expedition's earn transaction; one drop per expedition), `starter_pet` (`choosePet`: kid has no pet yet for `'starter'`; `second_pet` / `third_pet` also raise free slots to 2 / 3), `adopt` (`adoptPetIntoSlot`: free pets only, slot limit checked), `egg_hatch` (`hatchMagicEgg`: consumes that kid's `egg` doc and grants the pet). One-time kinds: `txnId = grant_{heroId}_{itemId}` |
| `revokeItem` | parent session | txn (`ITEM_REVOKE`, zero currency deltas), deletes or decrements inventory | Used by `deleteCustomAIFurniture`, `deleteCustomAIFood` (for every kid who owns it) and `editHero` removing a pet or slot; never refunds; `txnId = revoke_{heroId}_{itemId}_{clientUuid}` |
| `consume` | member | txn (`CONSUME`), inventory | `servingsRemaining >= 1`, decrements by 1 |
| `spend` | member | txn (`PET_XP_SPEND` / `SPARK_SPEND`), wallet | `reason` in allowlist; `amount <= available`; levels recomputed |
| `upsertCatalog` / `upsertRewardRules` | parent session | `catalog` / `reward_rules` | Integer bounds `[0, 100000]` |
| `adjust` | parent session | txn (`PARENT_ADJUSTMENT`), wallet | Result stays `>= 0`; memo recorded. Used by the Parent Portal kid editor (`editHero` with `coins`, `points` or `level`); a level edit becomes the Hero XP delta to that level's cumulative threshold |
| `ledgerReconcileNightly` | scheduled Function (daily) | `ledger_reports/{date}`, `ledger_config/reconcile` (checkpoint per wallet) | For each wallet, reads only transactions with `walletVersionAfter > checkpointVersion` (not by `createdAt`, which can arrive out of order), checks `checkpointBalance + sum(deltas) == wallet.balances` and `held` likewise, and that `walletVersionBefore/After` run without gaps; then moves the checkpoint. (A "kid + system accounts sum to zero" check is always true when system accounts are derived from the same transactions, so it proves nothing.) Incremental reads keep it inside the free tier as history grows |
| `mirrorWalletSummary` | Firestore trigger on `wallets/{heroId}` | `households/{CODE}/public/walletSummary` (never the household doc) | Keeps Pi/fridge summary current. Writing it into `households/{CODE}` would resend the whole household doc (~100+ KB) to every listening device on every wallet change: at ~300 ops/day and 6 devices that is roughly 8–21 GB/month of egress against a 10 GiB free allowance |

`approveAll` is a client loop over **explicit request IDs that are still `pending`** in the live `approval_requests` listener (fixes V6), calling `approveTaskPoints` / `approveReward` per ID. Likewise, `clearAllPendingApprovals` loops over explicit `pending` request IDs calling `rejectTask` / `rejectReward` (so holds are voided, activity locks are deleted, and clamped reversals are recorded cleanly).

**Task and habit lock state.** Today the `completed` / `pointsApproved` flags live in the household-level `habitIslands` and `taskForest` arrays, which the Function doesn't own. In `authoritative` mode the client stops using those flags for locking: a task shows as "waiting for parent" exactly while a pending `approval_requests` doc exists for that kid and task, and as "Needs Redo" while `wallet.needsRedo[lockKey]` is present (set by `rejectTask` and cleared by the next `recordActivity`, requiring no extra listener on rejected requests). Approve or reject on any device therefore updates every device through the existing `wallets` and `approval_requests` listeners.

### 3.9 Transaction algorithm (shared core)

`shared/ledger/core.js` is plain ES-module JavaScript with zero Firebase imports, shared by the Cloud Function, backfill script, and unit tests.

**Deployment of the shared core (required).** Firebase deploys each Functions codebase folder independently (`firebase.json` `functions[]`), so the dedicated `functions-ledger/` codebase (section 3.12) cannot import `../shared/ledger`. Follow the story engine pattern already in the repo (`shared/storyEngine/` + `scripts/sync-story-engine.mjs` + `scratch/verify_story_engine_sync.mjs`):
* `shared/ledger/` is the source of truth (used by the client, backfill script, and tests).
* `scripts/sync-ledger-core.mjs` copies it byte-for-byte into `functions-ledger/src/core/` (compiled by `tsc` with `allowJs: true`, verified with a runtime `require()` smoke test in Phase 1).
* `scratch/verify_ledger_core_sync.mjs` fails if the two copies differ, so CI catches drift, and every change to the core touches `functions-ledger/**`, which triggers the Functions deploy (`.github/workflows/firebase-functions-deploy.yml` updated in Phase 2 to watch and build both `functions/` and `functions-ledger/`).
* The handler imports only from `./core/`, never from outside `functions-ledger/`.

```js
// Pure planner: shared/ledger/core.js
plan(op, { wallet, tables, request?, hold?, inventory?, earnTxn?, now, actor })
  -> { txnDoc, walletAfter, extraWrites: [{ path, data }], error? }

// Server handler: functions-ledger/src/handler.ts
db.runTransaction(async (tx) => {
  const existingTxn = await tx.get(txnRef(idemId));
  if (existingTxn.exists) {
    const walletSnap = await tx.get(walletRef);
    return { alreadyDone: true, wallet: walletSnap.data() };  // exactly-once
  }
  // All reads before any write
  const walletSnap = await tx.get(walletRef);
  const tableDocs = await readRequiredTables(tx, op, args);
  const result = plan(op, { wallet: walletSnap.data(), tables: tableDocs, ... });
  if (result.error) throw new HttpsError('failed-precondition', result.error);
  tx.create(txnRef(idemId), result.txnDoc);
  tx.update(walletRef, result.walletAfter);
  for (const w of result.extraWrites) tx.set(w.ref, w.data, { merge: false });
  return { alreadyDone: false, wallet: result.walletAfter };
});
```

### 3.10 Security rules (`firestore.rules`)

Because all ledger writes happen via the Admin SDK inside `ledger`, the rules are short, fast, and easy to audit.

**Merge, don't replace (S9).** `firestore.rules` is already about 500 lines with other `match` blocks (other collections and existing household rules). Add the functions and nested matches below into the existing household block and keep every other block as it is; the trailing `match /{other=**}` deny applies only inside that household path. The existing rules tests (`scratch/verify_firestore_rules_and_sync.mjs` and friends) must still pass (Phase 2).

**Edit the existing block, don't add a second one.** The existing block is `match /households/{householdCode}` (firestore.rules ~line 398), so use `householdCode` wherever this section says `code`, and change its existing `allow update` line in place. Firestore combines `allow` rules with OR: a second `match /households/...` block or a second `allow update` would leave the old, looser rule in force and silently cancel the authoritative-mode deny. Replace its `match /{allChildren=**} { allow read, write: if false; }` with the nested matches below.


```
function LEDGER_HERO_FIELDS() {
  return ['points', 'coins', 'tokens', 'xp', 'level', 'xpNext', 'sparks', 'evolutionSparks',
          'petSparkMap', 'petXpMap', 'petLevelMap', 'inventory', 'consumables',
          'unlockedPetIds', 'habitatSlots', 'unlockedThemes', 'fieldStamps'];
}

function stateSnapshotLedgerFieldsChanged() {
  let reqSnap = request.resource.data.get('stateSnapshot', {});
  let resSnap = resource.data.get('stateSnapshot', {});
  return 'stateSnapshot' in request.resource.data && request.resource.data.stateSnapshot is map
    && (reqSnap.get('heroes', null) != resSnap.get('heroes', null)
        || reqSnap.get('heroesMap', null) != resSnap.get('heroesMap', null)
        || reqSnap.get('pendingApprovals', null) != resSnap.get('pendingApprovals', null)
        || reqSnap.get('resolvedApprovals', null) != resSnap.get('resolvedApprovals', null)
        || reqSnap.get('inventory', null) != resSnap.get('inventory', null)
        || reqSnap.get('heroHQ', null) != resSnap.get('heroHQ', null)
        || reqSnap.get('selectedHero', null) != resSnap.get('selectedHero', null)
        || reqSnap.get('petXpMap', null) != resSnap.get('petXpMap', null)
        || reqSnap.get('petLevelMap', null) != resSnap.get('petLevelMap', null)
        || reqSnap.get('petSparkMap', null) != resSnap.get('petSparkMap', null));
}

// The plain-text PIN must never come back once the backfill deletes it (both copies).
function pinReintroduced() {
  return 'pin' in request.resource.data.get('parentSettings', {})
    || 'pin' in request.resource.data.get('stateSnapshot', {}).get('parentSettings', {});
}

function isMember(code) {
  return request.auth != null
    && exists(/databases/$(database)/documents/households/$(code)/members/$(request.auth.uid));
}

match /households/{code} {
  // Existing get/create rules remain until Phase 5 moves the Pi reader to a service account
  allow update: if <existing conditions>
    && !request.resource.data.diff(resource.data).affectedKeys()
         .hasAny(['ledgerMode'])
    // In migrating and authoritative mode, refuse every key that carries balances, approvals, inventory or hero
    // profiles. New clients no longer write these keys at all (hero profiles moved to heroes/{heroId}),
    // so only old builds are refused; they reload onto the new build via the service-worker auto-update.
    // Applies in 'migrating' too, so an old or offline client cannot change balances during the backfill freeze.
    && (resource.data.get('ledgerMode', 'legacy') == 'legacy' || (
        !request.resource.data.diff(resource.data).affectedKeys()
          .hasAny(['heroes', 'heroesMap', 'pendingApprovals', 'resolvedApprovals', 'inventory', 'heroHQ',
                   'selectedHero', 'petXpMap', 'petLevelMap'])
        && !stateSnapshotLedgerFieldsChanged()
        && !pinReintroduced()));
  // Do NOT gate on a client-sent schema version: the app writes with setDoc(..., {merge: true}), and
  // request.resource.data is the document AFTER the merge, so once any new client has stored
  // clientSchemaVersion: 2, an old client's write inherits that value and passes.

  // Kid profiles (non-currency). One doc per kid so a per-doc field check is possible; a single
  // heroesMap cannot be checked per kid because rules have no loops.
  match /heroes/{heroId} {
    allow read: if isMember(code);
    allow update: if isMember(code)
      && request.resource.data.id == heroId
      && !request.resource.data.keys().hasAny(LEDGER_HERO_FIELDS())   // see list in section 3.7
      && request.resource.data.size() < 200;                         // field-count guard
    allow create, delete: if false;                                  // addHero/deleteHero go through ledger (openWallet/closeWallet)
  }

  // Ledger subcollections: member read-only, server writes only
  match /wallets/{heroId}            { allow read: if isMember(code); allow write: if false; }
  match /ledger_transactions/{txnId} { allow read: if isMember(code); allow write: if false; }
  match /holds/{id}                  { allow read: if isMember(code); allow write: if false; }
  match /approval_requests/{id}      { allow read: if isMember(code); allow write: if false; }
  match /inventory/{id}              { allow read: if isMember(code); allow write: if false; }
  match /activity_locks/{id}         { allow read: if isMember(code); allow write: if false; }
  match /catalog/{id}                { allow read: if isMember(code); allow write: if false; }
  match /reward_rules/{id}           { allow read: if isMember(code); allow write: if false; }
  match /ledger_config/{id}          { allow read: if isMember(code); allow write: if false; }
  match /ledger_reports/{id}         { allow read: if isMember(code); allow write: if false; }

  // Pi/fridge summary: readable with the code (like the household doc today), server writes only
  match /public/{id}                 { allow get: if <existing household get condition>; allow list, write: if false; }

  // Auth & private docs
  match /members/{uid}               { allow get: if request.auth != null && request.auth.uid == uid; allow list: if isMember(code); allow write: if false; }
  match /parent_sessions/{uid}       { allow get: if request.auth != null && request.auth.uid == uid; allow write: if false; }
  match /private/{id}                { allow read, write: if false; }
  match /passkey_challenges/{uid}    { allow read, write: if false; }

  match /{other=**}                  { allow read, write: if false; }
}
```

### 3.11 Migration and backfill strategy

For a single-family household, we avoid a noisy partial shadow mode (which would drift on unshadowed paths) in favor of thorough emulator testing followed by a clean, reversible cutover:

* `ledgerMode` per household: `legacy` (today) → `migrating` (brief freeze during backfill) → `authoritative`.
* Backfill script `scripts/ledger/backfill.mjs` (Admin SDK):
  1. `--household CODE [--dry-run] [--freeze] [--cutover]`. `--freeze` sets `ledgerMode: 'migrating'` (clients show "Updating your treasure chest…" and disable earn/spend buttons; the rules also refuse ledger keys from that moment, section 3.10), **waits about 2 minutes** so in-flight and offline-retry pushes land or fail, then re-reads the household doc and saves a full copy of it to `private/preCutoverSnapshot`.
  1b. `--dry-run` lists every joined device (`members`, with `deviceLabel` and `lastSeenAt`). **Cutover waits until every device the family uses appears there** (each one has opened the new build once).
  2. For each hero, read from `heroesMap[heroId]` (fallback `heroes[]`). For Habit Tokens take `Math.max(coins, tokens)` and log any disagreement. Ignore `evolutionSparks` (a mirror, section 3.5); list any hero where it differs from the active pet's sparks.
  3. Convert XP to cumulative (`hero`: `t_1 = 100`, `t_{k+1} = round(t_k × 1.35)`; `pet`: `50 × L × (L - 1) + xp`, cap 25) and write `ledger_config/curves`. Each hero stores its own `xpNext`, and today's denial code rounds it back down with `round(xpNext / 1.35)`, so it can be off the curve: keep each kid's current level and XP-into-level exactly, list every hero whose `xpNext != curve(level)` in the report for Dj, and never lower a level during backfill.
  4. Pet Sparks per pet, in exactly `getPetSparks`'s order: `hero.petSparkMap[petId]` → household `stateSnapshot.petSparkMap['{heroId}_{petId}']` → `hero.sparks` (active pet only) → household `stateSnapshot.petSparkMap[petId]` → 0. Pet XP and level likewise follow `getPetXp` / `getPetLevel`: `hero.petXpMap` / `hero.petLevelMap` first, then the household `petXpMap` / `petLevelMap`.
  5. Create each `wallets/{heroId}` and one `OPENING_BALANCE` transaction (`txnId = backfill_v1_{heroId}`, idempotent on re-run).
  6. Migrate into `inventory/{ownerId}__{itemId}`: `hero.inventory`, `hero.consumables`, `hero.unlockedPetIds` (kind `pet`), `hero.habitatSlots` above 1 (kind `habitat_slot`), `hero.unlockedThemes` (kind `theme`), household `state.inventory` pet gear (kind `pet_gear`, map item names to ids and list any unmatched names in the report), and `heroHQ.unlockedFurnitureIds` (kind `hq_furniture`). **Only the kid who bought an item keeps it (Dj 2026-11-25).** The buyer is taken, in order, from: (a) `heroHQ.furnitureOwners[itemId]`, which Phase 0 starts recording on every unlock; (b) for parent custom AI furniture, the item's `targetChildProfile` when it names one kid (`'all'` means every kid). Starter and free items get no docs (every kid owns them). Today's app keeps **no record of who bought furniture before Phase 0** (`unlockHQFurniture` only adds the id to the shared `unlockedFurnitureIds` and lowers the selected kid's tokens), so any unlocked item with no buyer from (a) or (b) is **granted to nobody** (Dj 2026-11-25: none of the older items were bought, so no kid starts with them). `--dry-run` lists those items under "Furniture not carried over" for information only; it does not hold up cutover. The report lists the furniture granted per kid.
  6c. Copy the household `heroHQ` layout (dropping any placed item that kid does not own after step 6, so the slot falls back to that kid's starter item) (`themeId`, `isNightMode`, `equippedFurniture`) into each kid's `heroes/{heroId}.hq`, so every kid starts with the room they see today and changes it independently from then on.
  6b. Copy each hero's non-currency profile fields into `heroes/{heroId}` (everything except `LEDGER_HERO_FIELDS`, section 3.10). From cutover the client reads and writes profiles only there.
  7. Convert unresolved `pendingApprovals` into `approval_requests` (and `activity_locks` for task requests, keyed by the canonical alias lockKey). Gold Points `amount` = `req.pendingPoints || req.rewardPoints || 10`, as `approveParentRequest` pays today. **Each pending task request also gets a backfill earn record** so a later denial can take back what was paid: a zero-delta `ledger_transactions/backfill_earn_{requestId}` (the award is already inside the opening balance) with `metadata.legacyAward` copied from the request's own fields, the same ones `rejectParentRequest` uses today: `HABIT_TOKENS = tokensAwarded + levelUpBonusCoins`, `HERO_XP = xpAwarded`, `PET_SPARKS = sparksAwarded`, `PET_XP = petTrainingXpAwarded`, plus `preBattleLevel` / `levelsGained`. Set the request's `earnTxnId` to it. `rejectTask` reads `metadata.legacyAward` when the earn record is a backfill one and clamps at 0 as usual. For reward requests, create a hold; if funds are short, flag `needs_parent_review` in the report.
  8. Seed `catalog` (doc ids `{kind}:{itemId}`) and `reward_rules` from current catalogs and rates. Wardrobe pet gear has no price field today, so seed it with `getGearPrice`'s exact formula (`costCoins` if set, else `max(50, level × 50)`); add the `fee:*` items with today's amounts (`startPetExpedition` 5, `feedAllPetsPicnic` 15, `feedSinglePet` as coded). Seed `reward_rules.petXp` only from direct `addPetTrainingXp` / `addPetCareXp` calls, since sparks already pay 2× as Pet XP (section 3.5). one `habit:{habitId}` row per existing habit, one `task:{taskId}` row per existing task (canonical alias ids), one generic row per fixed `activityType` in section 3.13 (default `dailyCap: 20`, `maxBuffPercent: 50`), and every `realLifeRewards` entry as a `catalog` item of kind `reward`.
  8b. Write `ledger_config/household.timeZone`.
  9. Hash `parentSettings.pin` into `private/parentAuth` and delete **both** plain-text copies from the household doc: `parentSettings.pin` and `stateSnapshot.parentSettings.pin` (`FieldValue.delete()` on each). From then on the rules refuse any write that puts either back (section 3.10), and authoritative-mode clients drop `pin` from local state and `localStorage` (Phase 3).
  10. Write `public/walletSummary`, set `ledgerMode: 'authoritative'`, and save `scripts/ledger/reports/{CODE}-{timestamp}.json`.
* **Rollback (full, S2):** `scripts/ledger/rollback.mjs --household CODE` sets `ledgerMode: 'migrating'`, then rebuilds the legacy household doc from `private/preCutoverSnapshot` plus everything that happened after cutover:
  * balances: read directly from each `wallets/{heroId}` doc (never add cumulative `ledger_transactions` XP deltas onto legacy XP-into-level fields), converting cumulative `HERO_XP` and `PET_XP` back to `{ level, xp, xpNext }` / `petLevelMap` / `petXpMap` via `shared/ledger/curves.js`, and write into `heroesMap` (and `heroes[]`) with fresh stamps;
  * hero profiles: each `heroes/{heroId}` doc copied back over the snapshot's profile fields (avatar, active pet, gear equipped after cutover);
  * approvals: `approval_requests` still `pending` go back into `pendingApprovals` (note: holds never deducted from `wallet.balances.GOLD_POINTS`, so do **not** add `held.GOLD_POINTS` back to `points`); resolved ones go into `resolvedApprovals`;
  * inventory: `inventory/*` docs back into `unlockedPetIds`, `habitatSlots`, `unlockedThemes`, `hero.inventory`/`consumables` (kind `badge` too), `state.inventory`, unhatched `egg` docs back into `petSanctuary.unhatchedEggs`, and `heroHQ.unlockedFurnitureIds` (the union of every kid's furniture, since the legacy app has one shared HQ; layout from the snapshot);
  * the PIN from the snapshot back into `parentSettings.pin` (only while the snapshot still holds it);
  then sets `ledgerMode: 'legacy'`. Ledger collections are preserved for audit. `scripts/ledger/cleanup_snapshot.mjs` deletes `private/preCutoverSnapshot` once Dj confirms the cutover is good.
* **Rollback window:** `rollback.mjs` works only until Phase 5 starts. Phase 5 strips the legacy fields and moves data into subcollections that the legacy app cannot read. Run `cleanup_snapshot.mjs` and close the rollback option at the start of Phase 5, not before.

### 3.12 Cost and billing

* **Consolidated `ledger` Cloud Function v2 (`minInstances: 0`, 256 MiB, `preferRest: true`):**
  * Cloud Run free allowance: 180,000 vCPU-seconds, 360,000 GiB-seconds, 2 million requests/month.
  * At ~300 family ops/day (~9,000/month, ~0.2 s compute each), usage is ~1,800 vCPU-seconds/month — **<1% of the free tier ($0/month)**.
  * *(Optional future upgrade: `minInstances: 1` at 256 MiB would cost ~$3–8/month if Dj ever wants zero cold starts even on the first tap of the day.)*
  * **Cold start realism:** `functions/src/index.ts` imports every module at load (`@google/genai`, express), and every Cloud Run service loads the whole bundle. Put `ledger` and its scheduled/trigger functions in their **own codebase**, `functions-ledger/` (a second `codebase` entry in `firebase.json`), so its cold start loads only Firestore Admin. Even so, plan for 2–4 s on a cold start, not 1–2 s.
* **Artifact Registry:** each Functions codebase stores container images, and storage above 0.5 GB/month is billed. A second codebase (`functions-ledger/`) adds images on every deploy, so set a cleanup policy once (`firebase functions:artifacts:setpolicy`, keep the last few images) in Phase 2.
* **Cloud Scheduler:** 3 free jobs per billing account. This plan adds 1 (`ledgerReconcileNightly`); check that the account has no other scheduled jobs.
* **Firestore usage:**
  * Free daily allowance: 50,000 reads, 20,000 writes, 20,000 deletes.
  * One ledger op = ~3–4 writes + ~3–4 server reads + 1 `onSnapshot` read per connected device (plus one billed read per request for the `exists()` call inside `isMember`, which is negligible). At 300 ops/day across 6 devices, that is ~1,200 writes and ~3,000 reads/day — well inside the free tier.

### 3.13 Every balance touchpoint (complete list for Phase 3)

Every function below must call the ledger in `authoritative` mode; `scratch/verify_ledger_write_paths.mjs` checks each one. Variable-payout items (habits and tasks) are keyed in `reward_rules` by item ID (`habit:{habitId}`, `task:{taskId}`), with Parent Portal create/edit flows calling `upsertRewardRules`; fixed-payout activities use the generic `activityType` as the `reward_rules` doc ID. The backfill seeds every existing habit, task, and fixed activity with today's amounts.

**Earns (`recordActivity`)**

| Code path (`src/state/store.js` unless noted) | `activityType` / `ruleId` | Approval-gated (creates a `task_point_approval` today; executor re-checks each) |
|---|---|---|
| `toggleHabitIsland` | `habit` (rule `habit:{habitId}`) | yes |
| `toggleTaskForest` | `task` (rule `task:{taskId}`) | yes |
| `submitChoreWithPhoto` | `photo_chore` | yes |
| `claimCompanionHabit` | `companion_habit` | yes |
| `completeToothbrushBattle` | `toothbrush_battle` | yes |
| `completeAiQuest` | `ai_quest` | yes |
| `completeAdventureGame` | `adventure_game` | yes |
| `completeMovementRoutine` | `movement_routine` | yes |
| `unlockParentWorldChest` | `world_chest` | yes |
| `completeWaypointChore` | `waypoint_chore` | yes |
| `completePajamasTidyStep` | `pajamas_tidy` | yes |
| `completeBedtimeStory` | `bedtime_story` | yes |
| `claimExpeditionRewards` (both awards; its `gearDropped` item is a separate `grantItem` `expedition_drop`) | `expedition` | **yes** (creates a `task_point_approval`, taskId `expedition_{biomeId}`, store.js ~4136) |
| `completePetBathReward` | `pet_bath` | no |
| `recordArcadeResult` (`src/arcade/ArcadeModal.js`; keeps its daily coin cap) | `arcade` | no |
| `discoverWorldSecret` | `world_secret` | **yes** (store.js ~11068) |
| `interactWithCustomLandmark` | `custom_landmark` | **yes** (store.js ~11324) |
| `recordToyBoxInteraction` | `toy_box` | no |
| `addCoins` (all callers) | caller's type | per caller |
| `addXP` level-up bonus (+50 tokens per level) | folded into the same `EARN_ACTIVITY` | n/a |
| `addPetSparks`, `syncHabitPetCare`, `addEvolutionSparks` (= Pet Sparks; there is no separate Evolution Sparks balance) | folded into the calling activity; each spark award also pays `2 × sparks` Pet XP | n/a |
| `addPetTrainingXp` (5 calls in `src/views/DancePartyView.js`, 1 in `src/views/PetSanctuaryView.js`), `addPetCareXp` (doubles the amount) | `pet_training`, `pet_care` | no |
| `src/views/DancePartyView.js` lines 1390, 1760, 1818, 1900, 2002, 2060 | `dance_party` | no |
| `src/views/WorldAdventureMapView.js` lines 874–875, 912–913 | `world_map` | no |

`submitTaskForApproval` and `addPendingApproval` (store.js ~3805–3846) build approval requests from caller-supplied points and have no callers today: delete them in Phase 3 rather than migrate them.

Do this check during Phase 3: if any other place found by `verify_no_direct_balance_mutation.mjs` changes a balance, add it to this table before migrating it. Out of scope for v1 (Q2): `PetSanctuaryCanvas.js:231` pet bond XP, `grantScreenTimeBonus`, `deductScreenTime`.

**Spends (`purchase`, `spend`, `consume`)**

| Code path | Currency | Grants |
|---|---|---|
| `buyPet` (150) | Habit Tokens | inventory `pet` |
| `buyHabitatSlot` (250) | Habit Tokens | inventory `habitat_slot` |
| `buyProfileTheme` | Habit Tokens | inventory `theme` |
| `buyDigitalGear`, Studio items listed in the Shop | Habit Tokens / Pet Sparks | inventory `digital_gear` / `studio_item` |
| `buyAndEquipGear` | Habit Tokens | inventory `pet_gear` (keyed by item id, not name) |
| `buyTreatPack` | Habit Tokens | inventory `treat` |
| `unlockHQFurniture` | Habit Tokens, paid by the selected kid | inventory `hq_furniture`, owner = that kid (each kid buys their own copy; already owned by that kid → just place it) |
| `checkHQMilestoneUnlocks` (milestones counted for the selected kid) | none | `grantItem` reason `hq_milestone`, owner = that kid |
| Boss trophy relic added to HQ (`store.js` ~line 3727) | none | `grantItem` reason `boss_trophy`, owner = the kid who won |
| `publishCustomAIFurniture` with `instant_gift` | none | `grantItem` reason `parent_gift` for each kid in `targetChildProfile` (`'all'` = one grant per kid) |
| `startPetExpedition` (5) | Habit Tokens | none (`purchase` of `fee:expedition`) |
| `feedAllPetsPicnic` (15), `feedSinglePet` | Habit Tokens | none (`purchase` of `fee:picnic` / `fee:feed_single_pet`) |
| `choosePet` (starter, `second_pet`, `third_pet`) | none | `grantItem` reason `starter_pet` (pet, plus free slots up to 2 / 3) |
| `adoptPetIntoSlot` | none (its "slots full" path calls `buyHabitatSlot`) | `grantItem` reason `adopt` (slot limit checked) |
| `hatchMagicEgg` | none | `grantItem` reason `egg_hatch` (consumes the kid's `egg` doc) |
| `addCustomAIPet` | none | `grantItem` reason `parent_pet` per target kid (`'all'` = every kid); egg delivery grants kind `egg` |
| `claimExpeditionRewards` gear drop | none | `grantItem` reason `expedition_drop` |
| Toothbrush battle "Mint Knight Badge" (`completeToothbrushBattle` ~3551) | none | `grantItem` reason `battle_badge` (kind `badge`) |
| `deleteCustomAIFurniture`, `deleteCustomAIFood` | none | `revokeItem` for every kid who owns it |
| `deductPetSparks` (Shop `costSparks`) | Pet Sparks | per item |
| `deductPetTrainingXp` | Pet XP | none |
| `feedPetConsumableSnack`, `feedPetTreat` | none | `consume` |
| `redeemRealLifeReward` | Gold Points | `requestReward` (hold) |
| `grantStudioItemToHero` (parent gift / crate; furniture goes to that kid only) | none | `grantItem` (`GIFT_GRANT`) |
| `editHero` with `coins`/`points`/`level` (Parent Portal) | any | `adjust` |
| `editHero` with `unlockedPetIds` / `habitatSlots` | none | `grantItem` reason `parent_edit` / `revokeItem` |
| `addHero` / `deleteHero` | starting values | `openWallet` / `closeWallet` |

**Catalog and rule writers (`upsertCatalog`, `upsertRewardRules`)**

Every place a parent changes a price or payout must also call the Function in `authoritative` mode, or the server keeps charging and paying the old amounts.

| Code path | Writes |
|---|---|
| Parent Portal rate editor (`src/views/ParentPortalView.js` ~lines 5096–5114) | `upsertRewardRules` for the edited habit/task or activity |
| Habit and task create / edit / delete (Parent Portal, `store.js`) | `upsertRewardRules` `habit:{habitId}` / `task:{taskId}` (delete sets the rule inactive) |
| Real-life rewards editor | `upsertCatalog` kind `reward` |
| Shop re-pricing and Studio items listed in the Shop | `upsertCatalog` (`digital_gear` / `studio_item`) |

---

## 4. Real-time sync and reconnect design

### 4.1 Subscriptions

* New `src/services/walletService.js`:
  * `start(code)`: attaches `onSnapshot` to `wallets`, `query(approval_requests, where('status', '==', 'pending'))`, and `inventory` (filtered by active `heroId` or household).
  * Keeps `walletsById` in memory; replaces a wallet only if `incoming.version >= current.version`.
  * Exposes `getWallet(heroId)`, `balanceOf(heroId, currency, petId?)`, `subscribe(fn)`, and `status: 'connecting'|'live'|'reconnecting'|'stale'` (`fromCache === true` marks `stale`).
* Keep default memory cache (no `persistentLocalCache`) so stale offline balances never appear as live. Show `"…"` until the first `fromCache === false` snapshot.

### 4.2 Latency profile

| Scenario | Acting device (optimistic UI) | Other online devices (`onSnapshot`) |
|---|---|---|
| Warm container (active family session / after PIN unlock) | **0 ms** | **~200–350 ms** |
| Cold container (first tap after ~15 min of total family idle) | **0 ms** | **~2–4 s** (own codebase, `preferRest: true`) |

### 4.3 Optimistic UI

* `walletService.applyOptimistic(heroId, deltas, txnId)` adds a pending overlay; displayed balance = `Math.max(0, serverWallet + pendingOverlays)`.
* When the `onSnapshot` listener delivers `wallet.lastTxnId === txnId` (or a newer version), the overlay clears. On server rejection, the overlay drops and the UI displays the server error (e.g., "Not enough Habit Tokens").
* Overlays never write to `localStorage` or legacy `hero.*` fields.

### 4.4 Reconnect and persistent outbox

* Firestore listeners resume automatically on reconnect and deliver the authoritative server state; on `online` / `visibilitychange`, trigger `getDocsFromServer(wallets)` once for immediate convergence.
* **Persistent outbox in `localStorage` (`ledger_outbox_v1`)** (not `sessionStorage`, which iOS/Android PWAs wipe on background eviction): stores `{ op, args, idemId, firstAttemptAt }` for any in-flight call that fails due to network loss. Retries in FIFO order on `online`, `visibilitychange`, and when `walletService` becomes `live`. Deterministic `idemId` guarantees retries are exactly-once. Entries older than 24 h are discarded with a user-visible notice.
* While offline or not `live` for >2 s, disable earn/spend buttons and show a small `"Reconnecting…"` pill.
* In `authoritative` mode, `_serializeStateForLocalStorage` strips currency, approval, and inventory fields so stale numbers can never resurface.

### 4.5 Non-currency data sync (addressed in Phase 0 + Phase 5)

Currency sync is only half the problem — non-currency data (chores, habits, bedtime stories, Studio items, settings) currently shares the same ~390 KB+ monolithic `households/{CODE}` document:
* **Phase 0 (immediate):** stop writing triple hero copies (`stateSnapshot.heroes` + `heroes[]` + `heroesMap`) and stop syncing static catalog blobs (`digitalGear` ~140 KB) on every save, cutting payload size by >60% and adding retry/backoff on `_doPush`.
* **Phase 4 (cutover):** strip all currency, approval, and inventory fields from `_doPush` and `buildCloudStateSnapshot`, and stop sending every key the authoritative-mode rules refuse (section 3.10): `heroes`, `heroesMap`, `selectedHero`, `pendingApprovals`, `resolvedApprovals`, `inventory`, `heroHQ`, `petXpMap`, `petLevelMap`, the same keys inside `stateSnapshot` (plus `stateSnapshot.petSparkMap`), and `parentSettings.pin` in both places (hero profiles move to `heroes/{heroId}`). A test pushes once in authoritative mode against the emulator rules and must succeed.
* **Phase 5 (required, not optional):** move large/frequently-mutated non-currency collections (`bedtimeStoryLibrary`, `taskCompletionLogs`, `taskForest`, `habitIslands`, parent Studio custom items) into dedicated subcollections under `households/{CODE}` with their own `onSnapshot` listeners, eliminating the 1 MiB ceiling (R7) and session echo-suppression drops (R6) across the entire app.

---

## 5. Decisions and remaining open questions

**Decided by Dj (2026-11-25):**

| Topic | Decision | Where it shows up |
|---|---|---|
| Parent authentication | PIN and fingerprint are equal, both server-checked; fingerprint is a WebAuthn passkey (no Google sign-in required) | `ledger(verifyParentPin)`, `passkey*` actions, `parent_sessions` (sections 3.7, 3.8) |
| Math Gate | Removed entirely | Phase 3 (`ParentLockModal.js`, Parent Portal settings) |
| One link | Required: the whole app on one address | Phase 6 |
| Warm server cost | Prefer $0/mo; no always-warm instance | Consolidated `ledger` Function, `minInstances: 0` (section 3.12) |
| AI Crafting | Parents only, no currency cost | Section 1.3; gated in Phase 5 |
| Reward request holds | Never expire; they stay until a parent acts (rule 4 of the lifecycle rules; Dj reconfirmed 2026-11-25) | Section 3.6 |
| HQ furniture (was Q6) | Per kid: every kid sees the whole catalog, but each kid pays for each item to own it and place it in their own HQ. Each kid also has their own HQ layout. At backfill, only the kid who bought an item keeps it (buyer records start in Phase 0). Items unlocked before Phase 0 were never bought, so no kid starts with them (was Q7) | Sections 3.7, 3.8 (`grantItem`), 3.11 step 6/6c, 3.13; Phase 3 |
| Task/habit denial reversal | **Stick with current rule (no negative balances; Dj reconfirmed 2026-11-25)** — deduct auto-issued Tokens, Hero XP, and Pet Sparks **clamped at 0** | Section 3.5; aligns with `.agents/rules/task_and_currency_lifecycle_rules.md` |

**Still open (defaults apply if unanswered):**

| # | Question | Default |
|---|---|---|
| Q1 | Are there households besides yours (friends/family on the same deployment) that the backfill must cover? | Only your household, plus a generic script for others |
| Q2 | Should the Screen-Time bank and pet bond XP move to the ledger in v1? | No, v2 |
| Q3 | May Phase 0 log push error codes (no kid names) to the Pi's Umami/ntfy to track real-world sync errors? | Yes, error codes only |
| Q4 | Default daily cap per activity type | 20 per kid per activity type per day, parent-editable |
| Q5 | Should the household's other 2 free Cloud Scheduler jobs stay free? | Assume yes; one new job |

---

## 6. Phased execution checklist

General rules for every phase:
* Run `npm run build` and `node scratch/run_all_tests.js` before pushing; register every new `scratch/verify_*.mjs` in `scratch/run_all_tests.js`; one PR per phase into `main`; verify CI and deploy workflows after merge.
* `functions/` and `functions-ledger/` changes must pass `npm --prefix <dir> run lint` and `npm --prefix <dir> run build`.
* No floats inside `shared/ledger/` (enforced by static test; only the documented XP curve helper uses `Math.round`).
* `ledgerMode` stays `'legacy'` until Phase 4 cutover. Client phases ship to production while the household is still legacy, so every new client test runs in **both** modes (`legacy` and `authoritative`).
* **Firestore rules and indexes are not deployed by any workflow today** (the deploy workflows run `--only functions` and hosting). Phase 2 updates `.github/workflows/firebase-functions-deploy.yml` to watch `functions/**`, `functions-ledger/**`, `firestore.rules`, and `firestore.indexes.json`, build both codebases, and run `firebase deploy --only functions,firestore:rules,firestore:indexes`. `firebase.json` binds rules to two databases, `(default)` and `default`; the app uses `(default)` (`src/config/firebase.js`), so confirm whether `default` is used anywhere and drop it if not.
* The emulator CI job needs Java 21 (`actions/setup-java`) and `firebase-tools`.

### Phase 0: Immediate sync stabilization & payload slimming
**Files:** `src/services/firestoreSyncService.js`, `src/state/store.js`, `src/views/ParentPortalView.js`, `scratch/verify_ledger_bug_repro.mjs` (new), `scratch/run_all_tests.js`
1. Move `await ensureAuthReady()` inside `try` in `_doPush`. Record failures in a 20-entry ring buffer (`this.pushFailures`) and **schedule exponential-backoff retries** (2 s, 4 s, 8 s, up to 60 s) whenever a push fails or a quota cooldown expires.
2. Surface the last error code in the Parent Portal sync health card (`getSyncHealth()`).
3. Shrink `households/{CODE}` payload immediately: eliminate duplicate static catalog blobs (`digitalGear` defaults) and redundant hero copies inside `stateSnapshot` where top-level `heroesMap` already exists.
   **Order matters:** `hydrateFromCloud` (store.js, near line 9354) replaces `state.digitalGear` with the cloud array wholesale. First change hydrate to merge: defaults from code, then cloud entries by id (parent re-prices and custom Studio items override or add; `deletedCustomItemIds` removes), following the CLAUDE.md catalog reconciliation rule. Only then push just the parent-changed and custom entries. Shipping the slimming without the merge would make other devices lose every default shop item; omitting the field entirely would stop parent re-pricing from syncing. Also add `digitalGear` to the `localOnlyKeys` skip list of the `stateSnapshot` loop in `hydrateFromCloud` (~line 8726), which today assigns `stateSnapshot.digitalGear` wholesale before the top-level merge runs.
   **Delete, don't just stop sending.** `setDoc(..., {merge: true})` keeps any key a client stops sending, so the stored document does not shrink by itself. When a slimmed client pushes, send `deleteField()` once for each dropped key (`stateSnapshot.heroes`, `stateSnapshot.digitalGear`, and any other removed copy). Old builds will keep re-adding them until they reload, so send the deletes on every push for the first week, then once a day.
4. Start recording furniture buyers: `unlockHQFurniture`, `checkHQMilestoneUnlocks`, the boss trophy relic unlock and `grantStudioItemToHero` set `heroHQ.furnitureOwners[itemId] = heroId` (the selected or target kid) whenever they add to `unlockedFurnitureIds`. Nothing else changes yet (still one shared HQ); this gives the backfill a buyer for every item unlocked from now on (section 3.11 step 6). **Protect the records from sync:** `hydrateFromCloud` merges `heroHQ` with `{...local, ...cloud}` (~line 9253), which would replace this device's whole `furnitureOwners` map with another device's. Merge `furnitureOwners` key by key (union; on a conflict keep the existing owner), and add `heroHQ` to the `stateSnapshot` loop's skip list so the snapshot copy cannot overwrite it first.
5. Add `scratch/verify_ledger_bug_repro.mjs` documenting today's R1, R3, R4, and R5 failures (marked `EXPECTED_LEGACY_FAILURE`; converted to must-pass in Phase 4).
**Acceptance:** build and all tests pass; simulated `setDoc` failures (including an `ensureAuthReady` rejection and a quota cooldown) retry and succeed; a one-kid reference fixture's push payload is under 150 KB **and the stored household document, read back after the push, has shrunk by the removed keys** (record payload and stored size before/after in the PR); two devices that each record a different furniture buyer both keep both records after syncing; a device that receives a slimmed push still shows every default shop item and the parent's custom prices. Buying, earning or being given furniture records the kid in `heroHQ.furnitureOwners`.

### Phase 1: Shared ledger core
**Files (new):** `shared/ledger/currencies.js`, `shared/ledger/curves.js`, `shared/ledger/ids.js`, `shared/ledger/core.js`, `scripts/sync-ledger-core.mjs`, `functions-ledger/package.json`, `functions-ledger/tsconfig.json`, `functions-ledger/src/core/*` (synced copy), `scratch/verify_ledger_core.mjs`, `scratch/verify_ledger_core_sync.mjs`
* Pure ES-module `plan(op, inputs)` for every ledger operation in section 3.8, with strict `>= 0` invariant and clamped-at-0 `REJECT_TASK_CLAWBACK`.
* Exact hero/pet XP curve helpers matching `addXP` and `addPetTrainingXp`.
* Deterministic Firestore-safe transaction IDs (`act_…`, `approve_…`, `reject_…`, `buy_…`, `backfill_v1_…`).
**Tests:** every plan balances (zero-sum); integers only; all balances `>= 0` on every op; denial reversal clamps at 0 and records `clampedShortfall` when kid spent tokens; holds (authorize/capture/void; no expiry); multi-level-up awards exactly 50 tokens per level; a spark award adds `2 × sparks` Pet XP to that pet; there is no `EVOLUTION_SPARKS` currency; `ids.js`'s alias table equals `getTaskAliasGroup` in `store.js` (e.g. `bedtime_story` and `sleep_on_time` give the same lockKey); 1,000 random operation sequences keep `sum(kid balances) + sum(system accounts) == 0`; `verify_ledger_core_sync.mjs` passes (the Functions copy is byte-identical).
**Acceptance:** `npm --prefix functions-ledger run build` compiles `functions-ledger/src/core/` with no imports from outside `functions-ledger/`, and a Node `require()` smoke test loads the compiled CommonJS output cleanly.

### Phase 2: Consolidated `ledger` Cloud Function & Security Rules
**Files:** `functions-ledger/src/index.ts`, `functions-ledger/src/auth.ts`, `functions-ledger/src/passkeys.ts`, `functions-ledger/src/handler.ts`, `functions-ledger/package.json` (add `@simplewebauthn/server`), `firestore.rules`, `firestore.indexes.json` (new), `firebase.json` (add `functions-ledger` codebase, indexes, and emulator config), `scratch/verify_ledger_emulator.mjs` (new), `.github/workflows/ci.yml` (add Firestore/Auth/Functions emulator job), `.github/workflows/firebase-functions-deploy.yml` (build/deploy `functions-ledger` + `firestore:rules,firestore:indexes`)
* Single consolidated `ledger` callable (`minInstances: 0`, `preferRest: true` on Admin SDK, lazy imports) dispatching all actions in section 3.8.
* Simple, airtight `firestore.rules` (section 3.10): all ledger subcollections are member-read / client-write-denied. Merge into the existing ~500-line file; keep every other `match` block.
**Tests (emulator):**
* Non-members cannot read wallets; members can; all direct client writes to ledger subcollections are denied.
* 5 wrong PINs lock for 15 min; parent session expires after 20 min; parent actions fail without live session.
* Passkeys: registration needs a live parent session; authentication with a valid assertion issues a parent session; synced passkeys returning `counter === 0` succeed on repeated logins (`0 → 0`), while a non-increasing non-zero counter, replayed challenge, wrong origin/rpId, or unknown credential is rejected.
* Rules: a member can update `heroes/{heroId}` profile fields, direct client `create`/`delete` on `heroes/{heroId}` is denied, and any update including a `LEDGER_HERO_FIELDS` key is denied; in `authoritative` mode a household write that changes `heroesMap`, `heroes`, `pendingApprovals`, `resolvedApprovals`, `inventory`, or those fields inside `stateSnapshot` is denied even when the stored doc already has `clientSchemaVersion: 2` (regression test for the merge bypass).
* 20 parallel `recordActivity` calls with the same `activityId` produce exactly 1 transaction; 20 parallel purchases with funds for 3 produce exactly 3.
* Reward hold → approve captures and lowers `held`; hold → reject voids.
* Denial after kid spent tokens clamps balance at 0 (never negative), records `clampedShortfall`, sets `wallet.needsRedo[lockKey]`, and deletes the activity lock; next completion clears `wallet.needsRedo[lockKey]`.
* Per-habit/per-task `reward_rules` (`habit:{habitId}`, `task:{taskId}`) override generic defaults.
* The same habit completed on two different days produces two transactions; a retry of one completion produces one; a second completion while one is pending is refused.
* A purchase grants its inventory doc in the same transaction; buying a one-time item twice is refused; a failed charge grants nothing.
* `revokeDevice` removes read access at once; `openWallet` for a new kid then `recordActivity` works; Google-signed-in parent bypasses the PIN lockout.
* Rules and indexes deploy through the workflow step (check the deploy log). The Artifact Registry cleanup policy is set (section 3.12).
* Daily cap and `maxBuffPercent` enforced, counted by day in the household time zone (a completion at 11:30 pm and one at 12:30 am local are on different days); existing legacy rules tests still pass.
* In `migrating` mode, a household write that changes a ledger key is denied.
* `public/walletSummary` is readable with the code and not writable by clients; a wallet change does not touch `households/{CODE}`.
* `joinHousehold` twice for the same uid is a no-op apart from `lastSeenAt`; `createHousehold` makes the creator a parent member.
* HQ furniture: kid A buys an item → A owns it and A's tokens drop; kid B still sees it in the catalog as not owned and must pay to own it; A buying it twice is refused; a kid-called `grantItem` for a paid item is refused; a parent gift with target `'all'` grants one copy per kid.
* Two task ids in one alias group share one activity lock, including across activity types (a pending `bedtime_story` refuses `sleep_on_time` for that kid, and `pajamas_tidy` refuses `clean_room`); a Pet Sparks purchase without `petId` is refused.
* Expedition, world secret and custom landmark completions create a pending `approval_requests` doc and pay Gold Points only on approval.
* Pets: a kid with no pet can take a free starter; a second free starter is refused; `adopt` past the slot limit is refused; `egg_hatch` without an `egg` doc is refused; a kid-called `grantItem` with a parent reason is refused; `revokeItem` needs a parent session.
* PIN: in `authoritative` mode a household write that adds `parentSettings.pin` or `stateSnapshot.parentSettings.pin` is denied; a write that changes `selectedHero`, `petXpMap` or `petLevelMap` (top level or in `stateSnapshot`) is denied.
* Lockout: after 5 wrong PINs, a valid passkey still opens a parent session; 5 failed passkey assertions lock only passkey sign-in.
* A backfilled pending task request (with `metadata.legacyAward`) rejected after the kid spent some tokens claws back exactly what the legacy code would, clamped at 0.
* Reconcile catches a transaction written with an older `createdAt` but a newer `walletVersionAfter`.

### Phase 3: Client wallet read & write paths
**Files:** `src/services/walletService.js` (new), `src/services/ledgerClient.js` (new, with `localStorage` outbox `ledger_outbox_v1`), `src/components/ParentLockModal.js`, `src/state/store.js` (all currency getters & ~40 mutation sites), `src/components/TopHeader.js`, `src/views/HeroHQView.js`, `src/views/ShopView.js`, `src/views/DashboardView.js`, `src/views/PetDetailView.js`, `src/views/ParentPortalView.js`, `src/views/DancePartyView.js`, `src/views/WorldAdventureMapView.js`, `src/components/PetSanctuaryCanvas.js`, `shared/fridgeSnapshot.js`
* **Join on every start (S1):** call `ledger(joinHousehold)` on every app start, in both modes, as soon as auth is ready. Parent Portal gets a "Devices" list from `members` (label, last seen, revoke button). Household creation goes through `ledger(createHousehold)`. Trade-off: each device must open the app once after this ships (before cutover) and joins once per link until Phase 6.
* All reads go through `walletService.balanceOf(heroId, currency, petId?)` in `authoritative` mode.
* All mutations call `ledgerClient.run(action, args)` with deterministic IDs and optimistic overlays — **no client-computed balance math**.
* Static guard `scratch/verify_no_direct_balance_mutation.mjs` fails on direct balance mutations in `src/` outside `walletService.js` and legacy-mode branches. Legacy branches must be marked so the guard can find them: wrap them in `if (isLegacyLedger()) { ... }` (one helper in `walletService.js`) or put a `// LEGACY_LEDGER` comment on the line; anything else counts as a violation.
* `ParentLockModal.js`: two tabs only, PIN and Fingerprint. PIN calls `ledger(verifyParentPin)`; Fingerprint calls `passkeyAuthBegin`/`navigator.credentials.get`/`passkeyAuthFinish`. The portal opens only after the server returns a session. Remove the Math Gate tab, `generateMathChallenge`, `mathChallengeEnabled` and its Parent Portal toggle ("Gates Active" count becomes PIN + Fingerprint). Add "Set up fingerprint on this device" in Parent Portal settings (calls `passkeyRegister*`). **Decide the final address (Phase 6 step 2) before shipping passkeys,** because a passkey works only on the domain it was made on; passkeys made on a temporary address must be set up again. The Pi kiosk served over plain `http` cannot use passkeys (WebAuthn needs HTTPS), so it shows the PIN tab only. `src/utils/biometrics.js` is replaced by the passkey flow. In `authoritative` mode the client removes `pin` from `state.parentSettings` (and so from `localStorage` and every push), and `store.verifyParentPin`'s local compare is deleted.
* **Per-kid Hero HQ:** `HeroHQView.js`, `DashboardView.js` and `TopHeader.js` read the HQ layout from the selected kid's `heroes/{heroId}.hq` and ownership from that kid's `inventory`. The redecorate drawer shows the whole furniture catalog to every kid; items the kid doesn't own show the price and a Buy button, owned ones a Place button. `equipHQFurniture` refuses an item the kid doesn't own (starter and free items always count as owned). Remove the household `heroHQ` from `_doPush` in `authoritative` mode. In `legacy` mode behaviour is unchanged (shared HQ).
* In `authoritative` mode, `_doPush` stops sending `heroes`, `heroesMap` and `stateSnapshot.heroes`; hero profile edits write `heroes/{heroId}` (with its own `onSnapshot`) using `updateDoc` with **only the changed fields** (never a full-profile `setDoc`), so two devices editing different fields don't overwrite each other. Counters (`companionTurnsToday`, `screenTimeUsedToday`, screen-time minute grants) use `increment()`.
**Tests:** `scratch/verify_wallet_service.mjs` (version monotonicity, optimistic overlay add/clear, `fromCache` stale status, `"…"` before first server snapshot); `scratch/verify_ledger_write_paths.mjs` (every store/view mutation site calls expected action + deterministic ID); outbox retry test using `localStorage`; task lock shown from `approval_requests` and "Needs Redo" shown from `wallet.needsRedo` (approve/reject on device A updates device B); every row of section 3.13 covered (including the catalog and rule writers); per-kid HQ test (kid A places furniture and changes theme; kid B's HQ is unchanged; B cannot place A's paid item); two-device profile test (device A changes avatar while device B changes active pet: both survive; both add companion turns: the count adds up); `joinHousehold` runs on start in legacy mode; starter pet, adopt, egg hatch, parent AI pet, expedition gear drop, battle badge and custom item delete each call the expected `grantItem` / `revokeItem` reason; the Evolution Sparks display equals the active pet's `PET_SPARKS`.
**Acceptance:** with a test household in `authoritative` mode on the emulator, every earn and spend in section 3.13 changes the wallet only through the Function; `verify_no_direct_balance_mutation.mjs` passes; the same build behaves exactly as today in `legacy` mode (existing tests pass unchanged).

### Phase 4: Backfill, cutover & background jobs
**Files:** `scripts/ledger/backfill.mjs`, `scripts/ledger/rollback.mjs`, `scripts/ledger/cleanup_snapshot.mjs`, `scripts/ledger/README.md`, `server/householdReader.js`, `functions-ledger/src/reconcileNightly.ts`, `functions-ledger/src/mirrorWalletSummary.ts`, `src/services/firestoreSyncService.js` (strip currency/approval/inventory/hero fields), `src/state/store.js` (`hydrateFromCloud` & `_serializeStateForLocalStorage` strip those fields in `authoritative` mode)
* Deploy Functions, rules, composite indexes, and client to all hosting targets; run a **production composite-index smoke test** on `approval_requests`, `holds`, and **both** `ledger_transactions` indexes (`(heroId, createdAt DESC)` and `(heroId, walletVersionAfter ASC)`).
* Point `server/householdReader.js` at `households/{CODE}/public/walletSummary` for balances (falls back to legacy fields while `ledgerMode` is `legacy`).
* **Rollback rehearsal on the emulator** before touching production: copy of a real household → backfill → cut over → earn, buy, change avatar, leave one approval pending → `rollback.mjs` → the legacy app shows the new balances, purchase, avatar and pending approval.
* Execute backfill: `--dry-run` → Dj reviews report (including the joined-devices list; wait until every family device is listed) → `--freeze` → `--cutover` (sets `ledgerMode: 'authoritative'`, migrates PIN, copies hero profiles into `heroes/{heroId}`).
* After cutover: each kid's HQ looks as it did before except for items that kid doesn't own, and each furniture item is owned only by its recorded buyer (or target kid for custom gifts).
* After cutover: on a kid device, change avatar and active pet → the change appears on the parent phone (proves profile sync still works under the new rules).
* Phase 0's repro cases now pass on the authoritative path.
**Live check:** approve on parent phone → kid tablet updates in <500 ms (warm) / <4 s (cold); put tablet in airplane mode, approve on phone, reconnect → tablet converges within 2 s.

### Phase 5: Non-currency data sync & security hardening
**Files:** `src/services/firestoreSyncService.js`, `src/state/store.js`, `firestore.rules`, `scripts/ledger/strip_legacy_fields.mjs`, `server/householdReader.js`
1. Split large non-currency domains (`bedtimeStoryLibrary`, `taskCompletionLogs`, `taskForest`, `habitIslands`, parent Studio custom items) into subcollections under `households/{CODE}` with dedicated `onSnapshot` listeners, eliminating the 1 MiB ceiling (R7) and session echo-suppression drops (R6) for all app data.
2. Strip legacy currency fields from `households/{CODE}` (`strip_legacy_fields.mjs`).
3. Move the Pi/fridge reader **and the meals writer** (`server/mealsService.js` → `updateHouseholdField`) to a service account (Admin SDK) before tightening `households/{CODE}` and `households/{CODE}/public/{id}` reads and writes to members only (or Admin SDK only for `public/walletSummary`).
4. Require a live parent session for Parent Studio AI generation endpoints (`/api/ai/image`, Firebase AI Logic Studio calls).
5. Optional: ntfy alert if `ledgerReconcileNightly` detects drift; screen-time bank / pet bond XP as ledger currencies (Q2).
**Tests:** emulator rules tests for each new subcollection (member read/write, non-member denied); a household with 1,000 task logs and 200 stories still syncs (no single doc over 500 KB); Pi weekly report, fridge display and meal plan writes work with the service account.
**Acceptance:** non-members can no longer read the household doc; Pi features keep working; the largest household document stays well under 1 MiB.

### Phase 6: One link for the whole app (required)
Today the same build is served from four places. App Hosting (`littleheroes-g1`) runs `server.js` on the same origin and is the only fully featured link; GitHub Pages and classic Firebase Hosting are static and call App Hosting's API across origins (`VITE_SERVER_API_BASE`, `src/services/serverApi.js`); the Pi runs its own copy plus Pi-only services. Each link is a separate browser origin, so one tablet opened from two links has two `localStorage` copies, two anonymous sign-ins and two service workers, and the sync code treats it as two devices. Passkeys are also bound to one address.
**Files:** `.github/workflows/deploy.yml`, `.github/workflows/firebase-hosting-deploy.yml`, `.github/workflows/deploy-pi.yml`, `firebase.json` (hosting redirects, and the new address in `auth.providers.googleSignIn.authorizedRedirectUris`), `apphosting.yaml`, `CLAUDE.md` ("Deploy Everywhere"), `.agents/rules/multi_deployment_and_cache_sync_guidelines.md`, `src/views/` join/rejoin screen
1. **After Phase 0 ships (no code):** tell the family to use the App Hosting link only. Before switching a device, open its old link once and check the Parent Portal sync card says "Synced just now", so nothing saved only on that link is left behind.
2. Pick the one link: App Hosting, ideally behind a custom domain so it can move later without breaking bookmarks or passkeys. Dj confirms the address **before Phase 3 ships passkeys** (passkeys are tied to the address). If it is a custom domain, add it to Firebase Auth's **Authorized domains** (Firebase console → Authentication → Settings) and to `firebase.json` Google sign-in redirect URIs, or parents' Google sign-in fails on the new link.
3. After Phase 4 cutover (so no unsynced local state is stranded): GitHub Pages and classic Firebase Hosting serve only a redirect page/rule to the one link, keeping path and hash; stop publishing app builds there. Update `CLAUDE.md` and `.agents/rules/multi_deployment_and_cache_sync_guidelines.md` so deployment rules cover the one link (plus the Pi as a back end).
4. The Pi stays a back end (voice relay, Pi-hole, meals), not a separate app link. The fridge kiosk browser opens the one link instead of the app copy the Pi serves, and `deploy-pi.yml` stops publishing the app build for the kiosk (it still deploys `server.js` and the Pi services); the Pi's own app address serves a redirect like the other old links.
5. A one-time "Join with your household code" screen on the new link (harmless after cutover: balances come from the server). Parents set up fingerprint once on the new link.
6. First-load speed: static assets served with long-lived cache headers so only `/api` pays App Hosting cold starts (`minInstances: 0`).
**Acceptance:** every feature works from the one link on a kid tablet and a parent phone; the old links land on it with path preserved; the linked-devices count in the Parent Portal equals the real number of devices.

---

## 7. Definition of done (whole migration)

1. No client code mutates a balance, XP, inventory item, or approval status except through `ledgerClient` → `ledger` Cloud Function; enforced by a static test.
2. All ledger subcollections deny direct client writes in `firestore.rules`; emulator tests prove non-member reads, direct writes, expired parent sessions, and invalid mutations are rejected. (Membership comes from `joinHousehold` with the household code, so reading balances still needs only the code, as today. What changes is that writes need the server and parent actions need the PIN or a passkey.)
3. Every earn, spend, approval, clamped-at-0 denial reversal, purchase (with its unlock granted in the same transaction), and hold is a balanced, idempotent, non-negative integer ledger transaction, covering every row of section 3.13; repeat habits on later days are never deduplicated away.
4. Approving on one device updates online devices in <500 ms when warm (~2–4 s on cold start), and offline/reconnecting devices converge within 2 s of reconnecting without losing queued actions across PWA reloads (`localStorage` outbox).
5. Retrying any operation (network retry, double tap, concurrent devices) never double-awards or double-charges.
6. Backfilled balances match pre-migration balances with anomalies reviewed by Dj, every family device joined before cutover, and the full `rollback.mjs` (balances, profiles, pending approvals, inventory) is rehearsed on the emulator.
7. Non-currency household data is slimmed (Phase 0) and split into subcollections (Phase 5) so all app data syncs reliably without approaching Firestore's 1 MiB limit.
8. Parents unlock only with the PIN or a passkey, both verified by the server; no plain-text PIN remains anywhere in the household doc or `localStorage`; a PIN lockout cannot block passkey sign-in; the Math Gate is gone.
9. The whole app is reached from one link; the old links redirect to it.
10. $0/month extra infrastructure cost (`minInstances: 0`); `npm run build`, `node scratch/run_all_tests.js`, emulator tests, and both `functions` and `functions-ledger` lint/build all pass in CI and deploy cleanly.
