# MIGRATION_PLAN.md: Authoritative Ledger and Real-Time Household Sync

Status: revised proposal (no application code changed yet)
Audience: the engineer or agent executing the phases in section 6
Scope: Gold Points, Habit Tokens, Pet Sparks, Evolution Sparks, Hero XP, Pet XP, inventory, parent approvals, Rewards Shop, 3D Studio purchases, AI Crafting, and non-currency household sync reliability
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
  * Every device subscribes with `onSnapshot` to `wallets/{heroId}` and `approval_requests`. Because all family actions share one Function container (and parents already hit it on PIN unlock), warm operations sync across devices in ~200–350 ms; only the first tap after ~15 minutes of total family idle pays a ~1–2 s cold start, hidden on the acting device by optimistic UI.
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
| **Pet Sparks** ⚡ | `hero.petSparkMap[petId]`, plus `hero.sparks` (the active pet's value) | `addPetSparks`, `syncHabitPetCare`, completions | `deductPetSparks` (Shop items with `costSparks`) | `fieldStamps.sparks` covers only the mirror. The map is merged by whole-object spread |
| **Evolution Sparks** | `hero.evolutionSparks` | `addEvolutionSparks` | evolution flows | `fieldStamps.evolutionSparks` |
| **Hero XP** | `hero.xp` (XP into the current level), `hero.level`, `hero.xpNext` (curve: 100, then ×1.35 rounded per level) | `addXP` (and direct `hero.xp +=` in `WorldAdventureMapView.js`) | denial reversal (clamped at 0) | stamped |
| **Pet XP** | `hero.petXpMap[petId]` (XP into the level), `hero.petLevelMap[petId]` (cap 25, needs `level*100`), plus legacy household-level `state.petXpMap/petLevelMap` | `addPetTrainingXp`, `addPetCareXp` | `deductPetTrainingXp` | **None.** Not in `HERO_STAMPED_FIELDS`; `{...localH, ...cloudH}` means any incoming snapshot replaces it |
| Pet bond XP | `petSanctuary.petBondMap[petId].xp` | `PetSanctuaryCanvas.js:231` | none | none (household-level map, whole-object overwrite) |
| Streak / stars | `hero.streak`, `hero.stars` | completions | none | `Math.max` merge (cannot go down across devices) |
| Screen-time bank | `hero.screenTimeMinutes`, `screenTimeUsedToday` | `grantScreenTimeBonus` | `deductScreenTime` | stamped. **Out of scope for v1**, see open question Q2 |
| Pending approvals | `state.pendingApprovals[]`, `state.resolvedApprovals[]`, `state.taskCompletionLogs[]`, `state.taskLedgerLogs[]` | `enqueuePendingApproval` and friends | `approveParentRequest`, `rejectParentRequest`, `approveAllPendingRequests`, `clearAllPendingApprovals` | Hand-written union and tombstone merges in `hydrateFromCloud` §9 |
| Inventory | `hero.inventory[]` (ids), `hero.consumables[]` (servings), `state.inventory[]` (legacy household-wide) | purchases, gifts (`grantStudioItemToHero`), bounties, chests | `feedPetConsumableSnack`, `feedPetTreat` | set-union merge, so **items can never be removed across devices** |

Multipliers: pet gear `coin_boost` and `xp_boost` buffs are computed on the client (`getActivePetGearBuffs`) and added to awards.

### 1.3 Connected systems (sources and sinks)

**Parent approval flow (today)**
1. Kid completes a habit or task on device K: `completeHabit` / `completeTask` / `completeToothbrushBattle` / `completeAiQuest` / `claimExpeditionRewards` / `completeAdventureGame` / `completeMovementRoutine` / `unlockParentWorldChest` / `submitChoreWithPhoto` in `store.js`. Tokens, XP, and sparks are **added locally right away**, and a `task_point_approval` request is pushed into `state.pendingApprovals`, then `saveState(true)`.
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
* `parentSettings.pin` (default `'1234'`) is stored in plain text in that world-readable document, so the "parent-only" approval gate is advisory.
* Subcollections under households are denied (`match /{allChildren=**} { allow read, write: if false; }`). New ledger and domain collections need explicit rules.
* `server/householdReader.js` (Pi weekly report, fridge display) reads the household doc **unauthenticated over REST** and shows `hero.points/coins` (`shared/fridgeSnapshot.js:92`). Locking reads down would break it unless a projection is kept (`walletSummary`, section 3.7) until Phase 5 migrates the Pi reader to an authenticated path.

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
* **Scheduled / Trigger Functions (`minInstances: 0`):** `ledgerExpireHolds` (daily), `ledgerReconcileNightly` (daily), and `mirrorWalletSummary` (Firestore trigger on `wallets/{heroId}` to keep `households/{CODE}.walletSummary` fresh for the Pi/fridge REST reader).
* **Security rules:** all ledger subcollections are **read-only for household members** (`allow write: if false;`), eliminating client tampering and Rules DSL complexity.
* **Client subscriptions:** every device subscribes with `onSnapshot` to `wallets/{heroId}`, `approval_requests`, and `inventory`.
* Borrow the authorize/capture/void hold model from Blnk and `mkmbhs/ledger`, and the zero-sum double-entry invariant from Formance.

### 3.4 Consequences

* **Positive:** $0 extra monthly cost; 100% server-authoritative validation in plain TypeScript; trivial security rules; zero risk of hitting Firestore Rules' 20-access-call or 1,000-expression limits; one source of truth reachable from all four hosts; full audit trail.
* **Trade-off:** The very first ledger action after ~15 minutes of total household idle incurs a ~1–2 s cold start on Cloud Run. Optimistic UI updates the acting device in 0 ms, and all subsequent actions during the session run warm (~200–350 ms cross-device).
* **Escape hatch:** If Dj ever wants 0 ms cold starts even on the first tap of the day, setting `minInstances: 1` on the single `ledger` Function is a one-line config change (~$3–8/mo) with zero code rewrite.

### 3.5 Ledger model

**Units.** Every amount is a JavaScript safe integer. All six currencies are whole numbers (1 unit = 1 point, token, spark, or XP). `shared/ledger/core.js` rejects `NaN`, `Infinity`, fractions, and values above `Number.MAX_SAFE_INTEGER`.

**Currencies** (`shared/ledger/currencies.js`): `GOLD_POINTS`, `HABIT_TOKENS`, `PET_SPARKS` (per pet), `EVOLUTION_SPARKS`, `HERO_XP`, `PET_XP` (per pet). Later, optionally: `PET_BOND_XP`, `SCREEN_MINUTES` (Q2).

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
  delta: { GOLD_POINTS: int, HABIT_TOKENS: int, HERO_XP: int, EVOLUTION_SPARKS: int, PET_XP: int, PET_SPARKS: int, HELD_GOLD_POINTS: int },
  counterAccount: 'treasury_mint' | 'shop_sink' | 'reward_redemption_sink' | 'pet_training_sink' | 'spark_sink' | 'clawback' | 'adjustment' | 'opening_balance',
  levelBefore: int, levelAfter: int, petLevelBefore?: int, petLevelAfter?: int,
  refs: { activityType?, activityId?, requestId?, itemId?, reversesTxnId? },
  metadata?: { clampedShortfall?: { [currency]: int }, memo?: string },
  actor: { uid, deviceId, role: 'device' | 'parent' | 'system' },
  walletVersionBefore: int, walletVersionAfter: int,
  createdAt: Timestamp }
```

**Transaction types:** `EARN_ACTIVITY` (includes any `LEVEL_UP_BONUS` in the same transaction), `APPROVE_TASK_POINTS`, `REJECT_TASK_CLAWBACK` (clamped at 0), `REWARD_REQUEST_HOLD`, `REWARD_APPROVE_CAPTURE`, `REWARD_REJECT_VOID`, `SHOP_PURCHASE`, `PET_XP_SPEND`, `SPARK_SPEND`, `CONSUME` (inventory only, zero deltas), `GIFT_GRANT` (inventory only), `PARENT_ADJUSTMENT`, `OPENING_BALANCE`. No AI-crafting types (AI Crafting is parent-only and free).

### 3.6 Holds (reward requests only)

* Reservation model: a hold does not deduct Gold Points; it raises `held.GOLD_POINTS` on the wallet.
* Request (`REWARD_REQUEST_HOLD`): requires `balance - held >= cost` (price read server-side from `catalog/{rewardId}`). Creates `holds/{requestId}` (`status: 'authorized'`, `amount`, `expiresAt` = now + 14 days) and `approval_requests/{requestId}`.
* Approve (`REWARD_APPROVE_CAPTURE`, parent session required): `balance -= cost`, `held -= cost`, hold → `captured`, request → `approved`.
* Reject (`REWARD_REJECT_VOID`, parent session required) or expiry (`ledgerExpireHolds`, daily): `held -= cost`, hold → `voided`/`expired`, request → `rejected`/`expired`.
* The hold document ID equals `requestId`, so double taps or concurrent devices cannot create duplicate holds.

### 3.7 Firestore data model

Everything new lives under `households/{CODE}/…`.

```
households/{CODE}                         (existing doc; gains server-only fields)
  ledgerMode: 'legacy' | 'migrating' | 'authoritative'   // set by backfill/rollback scripts only
  walletSummary: { [heroId]: { points, coins, sparks, xp, level, version } }   // written by trigger for Pi/fridge

households/{CODE}/members/{uid}
  { uid, role: 'parent' | 'device', deviceId, joinedAt }            // written by ledger(joinHousehold)

households/{CODE}/parent_sessions/{uid}
  { uid, expiresAt }                                                // written by ledger(verifyParentPin), 20 min TTL

households/{CODE}/private/parentAuth
  { pinHash, pinSalt, algo: 'scrypt', failedAttempts, lockedUntil } // Admin SDK only

households/{CODE}/private/passkeys
  { credentials: { [credentialId]: { publicKey, counter, transports, label, rpId, createdAt } } } // Admin SDK only

households/{CODE}/passkey_challenges/{uid}
  { challenge, kind: 'register' | 'authenticate', expiresAt }      // Admin SDK only, 5-min TTL, deleted on use

households/{CODE}/heroes/{heroId}                                    // kid profile (NOT balances); client-writable, section 3.10
  { id, name, role, avatar, avatarDesign, gameDifficulty, activePetId, equippedGear, equippedPetGearMap,
    customGearDyesMap, savedHeroCards, storyMemory, storyProfile, streak, stars, screenTime* settings,
    companionTurnsToday, companionTurnsDate, arcadeHighScores, updatedAt, ... }
  // Never contains: points, coins, tokens, xp, level, xpNext, sparks, evolutionSparks, petSparkMap,
  // petXpMap, petLevelMap, inventory, consumables, unlockedPetIds, habitatSlots, unlockedThemes

households/{CODE}/wallets/{heroId}                                   // subscribed via onSnapshot
  { heroId, version: int, lastTxnId, updatedAt,
    balances: { GOLD_POINTS, HABIT_TOKENS, EVOLUTION_SPARKS, HERO_XP }: int,
    held:     { GOLD_POINTS }: int,
    heroLevel: int,
    pets: { [petId]: { PET_XP: int, PET_SPARKS: int, level: int } },
    activityCounts: { [activityType]: { day: 'YYYY-MM-DD', count: int } } }

households/{CODE}/ledger_transactions/{txnId}                        // append-only, section 3.5

households/{CODE}/holds/{requestId}
  { requestId, heroId, amount: int, status: 'authorized'|'captured'|'voided'|'expired', expiresAt, createdAt, updatedAt }

households/{CODE}/approval_requests/{requestId}
  { requestId, kind: 'task_points'|'reward', heroId, taskId?, rewardId?, title,
    amount: int, earnTxnId?, status: 'pending'|'approved'|'rejected'|'expired',
    createdBy, resolvedBy?, resolvedAt?, createdAt }

households/{CODE}/inventory/{heroId}__{itemId}
  { heroId, itemId, kind, qty: int, servingsRemaining?: int, lastTxnId, updatedAt }

households/{CODE}/catalog/{itemId}                                   // prices; parent-editable via Function
  { itemId, kind, title, costCoins: int, costSparks: int, costPoints: int, servingsPerPurchase?: int, active: bool }

households/{CODE}/reward_rules/{activityType}                        // earn amounts; parent-editable via Function
  { activityType, tokens: int, xp: int, sparks: int, evolutionSparks: int, petXp: int, points: int, dailyCap: int, maxBuffPercent: int }

households/{CODE}/ledger_config/curves                               // written by backfill script
  { heroCumXp: [int, ...], petMaxLevel: 25, levelUpBonusTokens: 50 }

households/{CODE}/ledger_reports/{date}                              // nightly reconciliation output
```

**Indexes (`firestore.indexes.json`):**
* `ledger_transactions`: `(heroId ASC, createdAt DESC)`
* `approval_requests`: `(status ASC, createdAt DESC)`
* `holds`: `(status ASC, expiresAt ASC)`
* Attach `"indexes": "firestore.indexes.json"` to the Firestore database blocks in `firebase.json` (note: `firebase.json` currently declares both `(default)` and `default`). Because the Firestore emulator does **not** enforce missing composite indexes, Phase 4 includes a production/staging query smoke test after deploying indexes.

### 3.8 Ledger operations

All interactive operations are handled by one callable Cloud Function (`ledger({ code, action, args, idemId? })`), which verifies Firebase Auth + household membership (and active `parent_sessions/{uid}` for parent actions) and executes an Admin SDK `db.runTransaction(...)`.

| Action | Who | Writes | Server validation (TypeScript) |
|---|---|---|---|
| `joinHousehold` | any authed uid with valid code | `members/{uid}` | Household exists; device not in `revokedDeviceIds`; role `'parent'` if uid in `parentUids` |
| `verifyParentPin` | member | `parent_sessions/{uid}` | `scrypt` compare against `private/parentAuth`; 5 wrong tries lock for 15 min; 20-min session |
| `setParentPin` | parent session or `parentUids` | `private/parentAuth` | Valid 4–8 digit PIN; re-hashes with fresh salt |
| `passkeyRegisterBegin` / `passkeyRegisterFinish` | parent session (so a passkey can only be added after a PIN or existing-passkey unlock) | `passkey_challenges/{uid}`, `private/passkeys` | WebAuthn registration verified server-side (e.g. `@simplewebauthn/server`); `rpId` and expected origin must match the app's link (one passkey set per link until Phase 6); user verification required |
| `passkeyAuthBegin` / `passkeyAuthFinish` | member | `passkey_challenges/{uid}`, `private/passkeys` (counter), `parent_sessions/{uid}` | Challenge single-use and unexpired; signature valid for a stored credential; counter increases; then issues the same 20-min parent session as `verifyParentPin`; failures count toward the same lockout |
| `removePasskey` | parent session | `private/passkeys` | Removes one credential |
| `recordActivity` | member | txn (`EARN_ACTIVITY`), wallet, optional `approval_requests` | Deterministic `txnId = act_{heroId}_{activityType}_{activityId}`; amounts read from `reward_rules` + bounded pet-gear buff (`<= maxBuffPercent`); `activityCounts <= dailyCap`; enforces "one active pending completion per task/habit"; recomputes hero/pet levels + 50 tokens per level crossed |
| `approveTaskPoints` | parent session | txn (`APPROVE_TASK_POINTS`), wallet, request → `approved` | Request `pending`; `delta.GOLD_POINTS == request.amount`; `txnId = approve_{requestId}` |
| `rejectTask` | parent session | txn (`REJECT_TASK_CLAWBACK`), wallet, request → `rejected` | Request `pending`; reads `earnTxnId`; deducts `min(balance, originalAward)` per currency (clamped at 0); `txnId = reject_{requestId}` |
| `requestReward` | member | txn (`REWARD_REQUEST_HOLD`), wallet `held`, hold, request | Price from `catalog/{rewardId}`; `balance - held >= cost`; one hold per `requestId` |
| `approveReward` / `rejectReward` | parent session | txn, wallet, hold, request | Hold `authorized`; capture deducts `balance` & `held`, void releases `held` |
| `purchase` | member | txn (`SHOP_PURCHASE`), wallet, inventory | Prices from `catalog/{itemId}`; `balance - held >= price`; increments `qty`/servings; `txnId = buy_{heroId}_{itemId}_{clientUuid}` |
| `consume` | member | txn (`CONSUME`), inventory | `servingsRemaining >= 1`, decrements by 1 |
| `spend` | member | txn (`PET_XP_SPEND` / `SPARK_SPEND`), wallet | `reason` in allowlist; `amount <= available`; levels recomputed |
| `upsertCatalog` / `upsertRewardRules` | parent session | `catalog` / `reward_rules` | Integer bounds `[0, 100000]` |
| `adjust` | parent session | txn (`PARENT_ADJUSTMENT`), wallet | Result stays `>= 0`; memo recorded |
| `ledgerExpireHolds` | scheduled Function (daily) | holds, wallets, requests | Releases holds past `expiresAt` |
| `ledgerReconcileNightly` | scheduled Function (daily) | `ledger_reports/{date}` | Verifies `sum(kid balances) + sum(system accounts) == 0` per currency |
| `mirrorWalletSummary` | Firestore trigger on `wallets/{heroId}` | `households/{CODE}.walletSummary` | Keeps Pi/fridge summary current |

`approveAll` is a client loop over **explicit request IDs that are still `pending`** in the live `approval_requests` listener (fixes V6), calling `approveTaskPoints` / `approveReward` per ID.

### 3.9 Transaction algorithm (shared core)

`shared/ledger/core.js` is plain ES-module JavaScript with zero Firebase imports, shared by the Cloud Function, backfill script, and unit tests.

**Deployment of the shared core (required).** Firebase deploys only the `functions/` folder (`firebase.json` `"source": "functions"`), `functions/tsconfig.json` compiles only `src`, and `.github/workflows/firebase-functions-deploy.yml` runs only on `functions/**` changes. So the Function cannot import `../shared/ledger`. Follow the story engine pattern already in the repo (`shared/storyEngine/` + `functions/src/storyEngine/` + `scripts/sync-story-engine.mjs` + `scratch/verify_story_engine_sync.mjs`):
* `shared/ledger/` is the source of truth (used by the client, backfill script and tests).
* `scripts/sync-ledger-core.mjs` copies it byte-for-byte into `functions/src/ledger/core/` (compiled by `tsc` with `allowJs`, which is already on).
* `scratch/verify_ledger_core_sync.mjs` fails if the two copies differ, so CI catches drift, and every change to the core also touches `functions/**`, which triggers the Functions deploy.
* The handler imports only from `./core/`, never from outside `functions/`.

```js
// Pure planner: shared/ledger/core.js
plan(op, { wallet, tables, request?, hold?, inventory?, earnTxn?, now, actor })
  -> { txnDoc, walletAfter, extraWrites: [{ path, data }], error? }

// Server handler: functions/src/ledger/handler.ts
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

Because all ledger writes happen via the Admin SDK inside `ledger`, the rules are short, fast, and easy to audit:

```
function LEDGER_HERO_FIELDS() {
  return ['points', 'coins', 'tokens', 'xp', 'level', 'xpNext', 'sparks', 'evolutionSparks',
          'petSparkMap', 'petXpMap', 'petLevelMap', 'inventory', 'consumables',
          'unlockedPetIds', 'habitatSlots', 'unlockedThemes', 'fieldStamps'];
}

function stateSnapshotHeroesChanged() {
  return 'stateSnapshot' in request.resource.data && request.resource.data.stateSnapshot is map
    && request.resource.data.stateSnapshot.get('heroes', null) != resource.data.get('stateSnapshot', {}).get('heroes', null);
}

function isMember(code) {
  return request.auth != null
    && exists(/databases/$(database)/documents/households/$(code)/members/$(request.auth.uid));
}

match /households/{code} {
  // Existing get/create rules remain until Phase 5 moves Pi reader to authenticated walletSummary
  allow update: if <existing conditions>
    && !request.resource.data.diff(resource.data).affectedKeys()
         .hasAny(['ledgerMode', 'walletSummary'])
    // In authoritative mode, refuse every key that carries balances, approvals, inventory or hero
    // profiles. New clients no longer write these keys at all (hero profiles moved to heroes/{heroId}),
    // so only old builds are refused; they reload onto the new build via the service-worker auto-update.
    && (resource.data.get('ledgerMode', 'legacy') != 'authoritative' || (
        !request.resource.data.diff(resource.data).affectedKeys()
          .hasAny(['heroes', 'heroesMap', 'pendingApprovals', 'resolvedApprovals', 'inventory'])
        && !stateSnapshotHeroesChanged()));
  // Do NOT gate on a client-sent schema version: the app writes with setDoc(..., {merge: true}), and
  // request.resource.data is the document AFTER the merge, so once any new client has stored
  // clientSchemaVersion: 2, an old client's write inherits that value and passes.

  // Kid profiles (non-currency). One doc per kid so a per-doc field check is possible; a single
  // heroesMap cannot be checked per kid because rules have no loops.
  match /heroes/{heroId} {
    allow read: if isMember(code);
    allow create, update: if isMember(code)
      && request.resource.data.id == heroId
      && !request.resource.data.keys().hasAny(LEDGER_HERO_FIELDS())   // see list in section 3.7
      && request.resource.data.size() < 200;                         // field-count guard
    allow delete: if false;                                          // deleteHero goes through ledger
  }

  // Ledger subcollections: member read-only, server writes only
  match /wallets/{heroId}            { allow read: if isMember(code); allow write: if false; }
  match /ledger_transactions/{txnId} { allow read: if isMember(code); allow write: if false; }
  match /holds/{id}                  { allow read: if isMember(code); allow write: if false; }
  match /approval_requests/{id}      { allow read: if isMember(code); allow write: if false; }
  match /inventory/{id}              { allow read: if isMember(code); allow write: if false; }
  match /catalog/{id}                { allow read: if isMember(code); allow write: if false; }
  match /reward_rules/{id}           { allow read: if isMember(code); allow write: if false; }
  match /ledger_config/{id}          { allow read: if isMember(code); allow write: if false; }
  match /ledger_reports/{id}         { allow read: if isMember(code); allow write: if false; }

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
  1. `--household CODE [--dry-run] [--freeze] [--cutover]`. `--freeze` sets `ledgerMode: 'migrating'` (clients show "Updating your treasure chest…" and disable earn/spend buttons), then re-reads the household doc.
  2. For each hero, read from `heroesMap[heroId]` (fallback `heroes[]`). For Habit Tokens take `Math.max(coins, tokens)` and log any disagreement.
  3. Convert XP to cumulative (`hero`: `t_1 = 100`, `t_{k+1} = round(t_k × 1.35)`; `pet`: `50 × L × (L - 1) + xp`, cap 25) and write `ledger_config/curves`.
  4. Pet Sparks per pet from `petSparkMap[petId]` (fallback `hero.sparks` for active pet).
  5. Create each `wallets/{heroId}` and one `OPENING_BALANCE` transaction (`txnId = backfill_v1_{heroId}`, idempotent on re-run).
  6. Migrate `hero.inventory` and `hero.consumables` into `inventory/{heroId}__{itemId}`.
  6b. Copy each hero's non-currency profile fields into `heroes/{heroId}` (everything except `LEDGER_HERO_FIELDS`, section 3.10). From cutover the client reads and writes profiles only there.
  7. Convert unresolved `pendingApprovals` into `approval_requests`. For reward requests, create a hold; if funds are short, flag `needs_parent_review` in the report.
  8. Seed `catalog` and `reward_rules` from current catalogs and rates (default `dailyCap: 20`, `maxBuffPercent: 50`).
  9. Hash `parentSettings.pin` into `private/parentAuth` and delete plain-text `parentSettings.pin` from the household doc.
  10. Write `walletSummary`, set `ledgerMode: 'authoritative'`, and save `scripts/ledger/reports/{CODE}-{timestamp}.json`.
* **Rollback:** `scripts/ledger/rollback.mjs --household CODE` sets `ledgerMode: 'legacy'` and copies wallet balances back into `heroesMap` with fresh stamps. Ledger collections are preserved for audit.

### 3.12 Cost and billing

* **Consolidated `ledger` Cloud Function v2 (`minInstances: 0`, 256 MiB, `preferRest: true`):**
  * Cloud Run free allowance: 180,000 vCPU-seconds, 360,000 GiB-seconds, 2 million requests/month.
  * At ~300 family ops/day (~9,000/month, ~0.2 s compute each), usage is ~1,800 vCPU-seconds/month — **<1% of the free tier ($0/month)**.
  * *(Optional future upgrade: `minInstances: 1` at 256 MiB would cost ~$3–8/month if Dj ever wants zero cold starts even on the first tap of the day.)*
* **Firestore usage:**
  * Free daily allowance: 50,000 reads, 20,000 writes, 20,000 deletes.
  * One ledger op = ~3–4 writes + ~3–4 server reads + 1 `onSnapshot` read per connected device (and **zero** Rules `get()`/`getAfter()` reads). At 300 ops/day across 6 devices, that is ~1,200 writes and ~3,000 reads/day — well inside the free tier.

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
| Cold container (first tap after ~15 min of total family idle) | **0 ms** | **~1.2–2.0 s** (with `preferRest: true` + lazy imports) |

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
* **Phase 4 (cutover):** strip all currency, approval, and inventory fields from `_doPush` and `buildCloudStateSnapshot`, and stop sending `heroes`/`heroesMap`/`stateSnapshot.heroes` (hero profiles move to `heroes/{heroId}`); the rules refuse those keys in authoritative mode.
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
| Task/habit denial reversal | **Stick with current rule (no negative balances)** — deduct auto-issued Tokens, Hero XP, and Pet Sparks **clamped at 0** | Section 3.5; aligns with `.agents/rules/task_and_currency_lifecycle_rules.md` |

**Still open (defaults apply if unanswered):**

| # | Question | Default |
|---|---|---|
| Q1 | Are there households besides yours (friends/family on the same deployment) that the backfill must cover? | Only your household, plus a generic script for others |
| Q2 | Should the Screen-Time bank and pet bond XP move to the ledger in v1? | No, v2 |
| Q3 | May Phase 0 log push error codes (no kid names) to the Pi's Umami/ntfy to track real-world sync errors? | Yes, error codes only |
| Q4 | Default daily cap per activity type | 20 per kid per activity type per day, parent-editable |

---

## 6. Phased execution checklist

General rules for every phase:
* Run `npm run build` and `node scratch/run_all_tests.js` before pushing; register every new `scratch/verify_*.mjs` in `scratch/run_all_tests.js`; one PR per phase into `main`; verify CI and deploy workflows after merge.
* `functions/` changes must pass `npm --prefix functions run lint` and `npm --prefix functions run build`.
* No floats inside `shared/ledger/` (enforced by static test; only the documented XP curve helper uses `Math.round`).
* `ledgerMode` stays `'legacy'` until Phase 4 cutover.

### Phase 0: Immediate sync stabilization & payload slimming
**Files:** `src/services/firestoreSyncService.js`, `src/views/ParentPortalView.js`, `scratch/verify_ledger_bug_repro.mjs` (new), `scratch/run_all_tests.js`
1. Move `await ensureAuthReady()` inside `try` in `_doPush`. Record failures in a 20-entry ring buffer (`this.pushFailures`) and **schedule exponential-backoff retries** (2 s, 4 s, 8 s, up to 60 s) whenever a push fails or a quota cooldown expires.
2. Surface the last error code in the Parent Portal sync health card (`getSyncHealth()`).
3. Shrink `households/{CODE}` payload immediately: eliminate duplicate static catalog blobs (`digitalGear` defaults) and redundant hero copies inside `stateSnapshot` where top-level `heroesMap` already exists.
4. Add `scratch/verify_ledger_bug_repro.mjs` documenting today's R1, R3, R4, and R5 failures (marked `EXPECTED_LEGACY_FAILURE`; converted to must-pass in Phase 4).
**Acceptance:** build and all tests pass; simulated `setDoc` failures retry and succeed; household payload size drops significantly.

### Phase 1: Shared ledger core
**Files (new):** `shared/ledger/currencies.js`, `shared/ledger/curves.js`, `shared/ledger/ids.js`, `shared/ledger/core.js`, `scripts/sync-ledger-core.mjs`, `functions/src/ledger/core/*` (synced copy), `scratch/verify_ledger_core.mjs`, `scratch/verify_ledger_core_sync.mjs`
* Pure ES-module `plan(op, inputs)` for every ledger operation in section 3.8, with strict `>= 0` invariant and clamped-at-0 `REJECT_TASK_CLAWBACK`.
* Exact hero/pet XP curve helpers matching `addXP` and `addPetTrainingXp`.
* Deterministic Firestore-safe transaction IDs (`act_…`, `approve_…`, `reject_…`, `buy_…`, `backfill_v1_…`).
**Tests:** every plan balances (zero-sum); integers only; all balances `>= 0` on every op; denial reversal clamps at 0 and records `clampedShortfall` when kid spent tokens; holds (authorize/capture/void/expire); multi-level-up awards exactly 50 tokens per level; 1,000 random operation sequences keep `sum(kid balances) + sum(system accounts) == 0`; `verify_ledger_core_sync.mjs` passes (the Functions copy is byte-identical).
**Acceptance:** `npm --prefix functions run build` compiles `functions/src/ledger/core/` with no imports from outside `functions/`.

### Phase 2: Consolidated `ledger` Cloud Function & Security Rules
**Files:** `functions/src/ledger/index.ts`, `functions/src/ledger/auth.ts`, `functions/src/ledger/passkeys.ts`, `functions/src/ledger/handler.ts`, `functions/package.json` (add `@simplewebauthn/server`), `functions/src/index.ts`, `firestore.rules`, `firestore.indexes.json` (new), `firebase.json` (indexes + emulator config), `scratch/verify_ledger_emulator.mjs` (new), `.github/workflows/ci.yml` (add Firestore/Auth/Functions emulator job)
* Single consolidated `ledger` callable (`minInstances: 0`, `preferRest: true` on Admin SDK, lazy imports) dispatching all actions in section 3.8.
* Simple, airtight `firestore.rules` (section 3.10): all ledger subcollections are member-read / client-write-denied.
**Tests (emulator):**
* Non-members cannot read wallets; members can; all direct client writes to ledger subcollections are denied.
* 5 wrong PINs lock for 15 min; parent session expires after 20 min; parent actions fail without live session.
* Passkeys: registration needs a live parent session; authentication with a valid assertion issues a parent session; a replayed challenge, wrong origin/rpId, unknown credential or non-increasing counter is rejected.
* Rules: a member can write `heroes/{heroId}` profile fields but any write including a `LEDGER_HERO_FIELDS` key is denied; in `authoritative` mode a household write that changes `heroesMap`, `heroes` or `stateSnapshot.heroes` is denied even when the stored doc already has `clientSchemaVersion: 2` (regression test for the merge bypass).
* 20 parallel `recordActivity` calls with the same `activityId` produce exactly 1 transaction; 20 parallel purchases with funds for 3 produce exactly 3.
* Reward hold → approve captures and lowers `held`; hold → reject voids.
* Denial after kid spent tokens clamps balance at 0 (never negative) and resets task/habit.
* Daily cap and `maxBuffPercent` enforced; existing legacy rules tests still pass.

### Phase 3: Client wallet read & write paths
**Files:** `src/services/walletService.js` (new), `src/services/ledgerClient.js` (new, with `localStorage` outbox `ledger_outbox_v1`), `src/components/ParentLockModal.js`, `src/state/store.js` (all currency getters & ~40 mutation sites), `src/components/TopHeader.js`, `src/views/ShopView.js`, `src/views/DashboardView.js`, `src/views/PetDetailView.js`, `src/views/ParentPortalView.js`, `src/views/DancePartyView.js`, `src/views/WorldAdventureMapView.js`, `src/components/PetSanctuaryCanvas.js`, `shared/fridgeSnapshot.js`
* All reads go through `walletService.balanceOf(heroId, currency, petId?)` in `authoritative` mode.
* All mutations call `ledgerClient.run(action, args)` with deterministic IDs and optimistic overlays — **no client-computed balance math**.
* Static guard `scratch/verify_no_direct_balance_mutation.mjs` fails on direct balance mutations in `src/` outside `walletService.js` and legacy-mode branches.
* `ParentLockModal.js`: two tabs only, PIN and Fingerprint. PIN calls `ledger(verifyParentPin)`; Fingerprint calls `passkeyAuthBegin`/`navigator.credentials.get`/`passkeyAuthFinish`. The portal opens only after the server returns a session. Remove the Math Gate tab, `generateMathChallenge`, `mathChallengeEnabled` and its Parent Portal toggle ("Gates Active" count becomes PIN + Fingerprint). Add "Set up fingerprint on this device" in Parent Portal settings (calls `passkeyRegister*`). `src/utils/biometrics.js` is replaced by the passkey flow.
* In `authoritative` mode, `_doPush` stops sending `heroes`, `heroesMap` and `stateSnapshot.heroes`; hero profile edits write `heroes/{heroId}` (with its own `onSnapshot`).
**Tests:** `scratch/verify_wallet_service.mjs` (version monotonicity, optimistic overlay add/clear, `fromCache` stale status, `"…"` before first server snapshot); `scratch/verify_ledger_write_paths.mjs` (every store/view mutation site calls expected action + deterministic ID); outbox retry test using `localStorage`.

### Phase 4: Backfill, cutover & background jobs
**Files:** `scripts/ledger/backfill.mjs`, `scripts/ledger/rollback.mjs`, `scripts/ledger/README.md`, `functions/src/ledger/expireHolds.ts`, `functions/src/ledger/reconcileNightly.ts`, `functions/src/ledger/mirrorWalletSummary.ts`, `src/services/firestoreSyncService.js` (strip currency/approval/inventory/hero fields), `src/state/store.js` (`hydrateFromCloud` & `_serializeStateForLocalStorage` strip those fields in `authoritative` mode)
* Deploy Functions, rules, composite indexes, and client to all hosting targets; run a **production composite-index smoke test** on `approval_requests`, `ledger_transactions`, and `holds`.
* Execute backfill: `--dry-run` → Dj reviews report → `--freeze` → `--cutover` (sets `ledgerMode: 'authoritative'`, migrates PIN, copies hero profiles into `heroes/{heroId}`).
* After cutover: on a kid device, change avatar and active pet → the change appears on the parent phone (proves profile sync still works under the new rules).
* Phase 0's repro cases now pass on the authoritative path.
**Live check:** approve on parent phone → kid tablet updates in <500 ms (warm) / <2 s (cold); put tablet in airplane mode, approve on phone, reconnect → tablet converges within 2 s.

### Phase 5: Non-currency data sync & security hardening
**Files:** `src/services/firestoreSyncService.js`, `src/state/store.js`, `firestore.rules`, `scripts/ledger/strip_legacy_fields.mjs`, `server/householdReader.js`
1. Split large non-currency domains (`bedtimeStoryLibrary`, `taskCompletionLogs`, `taskForest`, `habitIslands`, parent Studio custom items) into subcollections under `households/{CODE}` with dedicated `onSnapshot` listeners, eliminating the 1 MiB ceiling (R7) and session echo-suppression drops (R6) for all app data.
2. Strip legacy currency fields from `households/{CODE}` (`strip_legacy_fields.mjs`).
3. Move Pi/fridge reader to an authenticated path for `walletSummary` and tighten `households/{CODE}` reads to members only.
4. Require a live parent session for Parent Studio AI generation endpoints (`/api/ai/image`, Firebase AI Logic Studio calls).
5. Optional: ntfy alert if `ledgerReconcileNightly` detects drift; screen-time bank / pet bond XP as ledger currencies (Q2).

### Phase 6: One link for the whole app (required)
Today the same build is served from four places. App Hosting (`littleheroes-g1`) runs `server.js` on the same origin and is the only fully featured link; GitHub Pages and classic Firebase Hosting are static and call App Hosting's API across origins (`VITE_SERVER_API_BASE`, `src/services/serverApi.js`); the Pi runs its own copy plus Pi-only services. Each link is a separate browser origin, so one tablet opened from two links has two `localStorage` copies, two anonymous sign-ins and two service workers, and the sync code treats it as two devices. Passkeys are also bound to one address.
**Files:** `.github/workflows/deploy.yml`, `.github/workflows/firebase-hosting-deploy.yml`, `firebase.json` (hosting redirects), `apphosting.yaml`, `CLAUDE.md` ("Deploy Everywhere"), `src/views/` join/rejoin screen
1. **Now (no code):** tell the family to use the App Hosting link only.
2. Pick the one link: App Hosting, ideally behind a custom domain so it can move later without breaking bookmarks or passkeys. Dj confirms the address.
3. After Phase 4 cutover (so no unsynced local state is stranded): GitHub Pages and classic Firebase Hosting serve only a redirect page/rule to the one link, keeping path and hash; stop publishing app builds there. Update `CLAUDE.md` so "Deploy Everywhere" covers the one link (plus the Pi as a back end).
4. The Pi stays a back end (voice relay, Pi-hole, meals, fridge kiosk), not a separate app link.
5. A one-time "Join with your household code" screen on the new link (harmless after cutover: balances come from the server). Parents set up fingerprint once on the new link.
6. First-load speed: static assets served with long-lived cache headers so only `/api` pays App Hosting cold starts (`minInstances: 0`).
**Acceptance:** every feature works from the one link on a kid tablet and a parent phone; the old links land on it with path preserved; the linked-devices count in the Parent Portal equals the real number of devices.

---

## 7. Definition of done (whole migration)

1. No client code mutates a balance, XP, inventory item, or approval status except through `ledgerClient` → `ledger` Cloud Function; enforced by a static test.
2. All ledger subcollections deny direct client writes in `firestore.rules`; emulator tests prove unauthorized reads, direct writes, expired parent sessions, and invalid mutations are rejected.
3. Every earn, spend, approval, clamped-at-0 denial reversal, purchase, and hold is a balanced, idempotent, non-negative integer ledger transaction.
4. Approving on one device updates online devices in <500 ms when warm (~1–2 s on cold start), and offline/reconnecting devices converge within 2 s of reconnecting without losing queued actions across PWA reloads (`localStorage` outbox).
5. Retrying any operation (network retry, double tap, concurrent devices) never double-awards or double-charges.
6. Backfilled balances match pre-migration balances with anomalies reviewed by Dj, and `rollback.mjs` is tested.
7. Non-currency household data is slimmed (Phase 0) and split into subcollections (Phase 5) so all app data syncs reliably without approaching Firestore's 1 MiB limit.
8. Parents unlock only with the PIN or a passkey, both verified by the server; the Math Gate is gone.
9. The whole app is reached from one link; the old links redirect to it.
10. $0/month extra infrastructure cost (`minInstances: 0`); `npm run build`, `node scratch/run_all_tests.js`, emulator tests, and `functions` lint/build all pass in CI and deploy cleanly.
