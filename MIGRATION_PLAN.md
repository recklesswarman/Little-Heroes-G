# MIGRATION_PLAN.md: Authoritative Ledger and Real-Time Wallet Sync

Status: proposed (no application code changed yet)
Audience: the engineer or agent executing the phases in section 6
Scope: Gold Points, Habit Tokens, Pet Sparks, Evolution Sparks, Hero XP, Pet XP, inventory, parent approvals, Rewards Shop, 3D Studio purchases, AI Crafting

---

## 0. TL;DR

* The app is a **Vite + vanilla-JS PWA on Firebase** (Firestore, Anonymous/Google Auth, Storage, Cloud Functions v2 in TypeScript), with an Express server (`server.js`) on Firebase App Hosting and a Raspberry Pi, and a separate Python FastAPI service on Cloud Run for the AI companion. **Nothing in this repository talks to Base44.** The "Little Heroes Hub" Base44 app is a separate app with its own, unsynced copy of kid balances (section 1.6).
* **There is no server-side authority for any balance.** Every device keeps the whole family state in memory and `localStorage`, mutates balances locally (110+ call sites in `src/state/store.js`, plus direct mutations in views), and pushes the **entire household state** as one Firestore document with `setDoc(..., {merge:true})`. Other devices merge it back using per-field **last-writer-wins timestamps taken from each device's own clock**. Balances are replicated as absolute numbers, not as transactions.
* That design causes the reported bug through several independent paths (section 2): a failed or skipped push is never retried, so the approving device keeps the only copy; a device running an older build, or one whose clock is ahead, overwrites the approval and the approving device "repairs" only itself; and concurrent earns on two devices lose increments by construction. Pet XP is not timestamp-protected at all. The security rules let anyone who knows the household code (no sign-in needed) rewrite any balance, and the parent PIN sits in plain text in that same readable document.
* **Decision (ADR-001): build a native double-entry ledger inside the existing Firebase stack.** Cloud Functions (callable, Admin SDK, Firestore transactions) are the only writers. Clients subscribe with `onSnapshot` to a per-kid `wallets/{heroId}` summary document that is updated in the same transaction as the ledger entries. Do not adopt Blnk, Formance, LedgerForge, Nakama or game-transactions-backend: each adds a server and a Postgres-compatible database to run and pay for. The ledger engines have no browser real-time push, so Firestore would still be needed as a copy, leaving two sources of truth. Nakama does have real-time push, but it would replace Firebase Auth and sync for every device, and its wallet has no idempotency or holds. Section 3.2.1 covers both game backends in detail.
* Execute in 10 phases (section 6). Each phase ships on its own behind a `ledgerMode` flag (`legacy`, then `shadow`, then `authoritative`), with tests.

---

## 1. Discovered stack

### 1.1 Runtime map

| Layer | What is actually in the repo | Evidence |
|---|---|---|
| Client | Vite 6 PWA, vanilla ES modules (no React/Vue), Tailwind 4, Three.js-style canvases, `@google/model-viewer`, Spline, echarts | `package.json`, `src/main.js`, `vite.config.js` |
| Client state | One hand-written singleton store, about 12.2k lines, with a subscribe/notify pattern | `src/state/store.js` (`store`, `saveState`, `hydrateFromCloud`) |
| Local persistence | `localStorage` key `little_heroes_adventure_master_v10` (whole state) and `BroadcastChannel('little_heroes_realtime_sync')` between tabs | `store.js` `STORAGE_KEY`, `firestoreSyncService.js` |
| Cloud sync | Firebase JS SDK v12 modular Firestore: one doc `households/{CODE}`, `onSnapshot` listener and debounced (350 ms) full-state `setDoc(merge:true)` | `src/services/firestoreSyncService.js` |
| Auth | Firebase Auth: Anonymous (every device), Email/Password and Google for parents. Parent "unlock" is a client-side PIN check | `src/config/firebase.js` (`signInAnonymously`), `store.js` `parentSettings.pin`, `unlockParentSession` |
| Database | Cloud Firestore only (databases `(default)` and `default` both bound to `firestore.rules`). No RTDB, no Postgres, no SQLite | `firebase.json` |
| Security rules | `firestore.rules` (498 lines). Households readable and writable by **anyone who knows the code**, schema and size checks only | `firestore.rules` `match /households/{householdCode}` |
| Cloud Functions | TypeScript, Node 22, `firebase-functions` 7, `firebase-admin` 14. Callables: `updateCompanionSettings`, `getParentInsights`, `chatWithPet`, `verifyChoreSubmission`, `generateDailyMicroQuests`. HTTP: `api` (Gemini proxy). **None touch balances.** Deployed by `.github/workflows/firebase-functions-deploy.yml`, so the project is on the Blaze plan | `functions/src/*.ts` |
| Node server | Express 5 `server.js` on Firebase App Hosting (`littleheroes-g1`) and on the family Pi: AI, voice, fridge, meals, ntfy relays. Reads households over the **public REST API with the code** (`server/householdReader.js`) | `server.js`, `server/*.js`, `apphosting.yaml` |
| Python | `little-heroes-agy-service/` FastAPI on Cloud Run (`little-heroes-rex-agy`), AI companion agents, `firebase-admin` persistence for companion memory. **No currency logic** | `little-heroes-agy-service/main.py`, `persistence/firestore_store.py` |
| AI image gen | Cloudflare Workers AI via `server/imageGenService.js`, Firebase AI Logic (`src/services/firebaseAILogicService.js`) for the Parent Studio | |
| Hosting | GitHub Pages, Firebase Hosting (classic), Firebase App Hosting, Pi | `CLAUDE.md`, workflows |
| Tests | Node scripts in `scratch/` run by `scratch/run_all_tests.js`, with a mock DOM in `scratch/setup_mock_env.js`. **No Firestore emulator and no rules tests in CI** | `scratch/`, `.github/workflows/ci.yml` |

### 1.2 Currencies and progression values (as stored today)

All live on each hero object (`state.heroes[i]`, mirrored into `state.selectedHero`), and are pushed inside `heroesMap.{heroId}`, `heroes[]` **and** `stateSnapshot.heroes`, so three copies are written per push.

| Product name | Field(s) | Earned by | Spent by | Cross-device protection today |
|---|---|---|---|---|
| **Gold Points** ⭐ | `hero.points` | Parent approval of a `task_point_approval` request (`approveParentRequest`, store.js about line 6709) | Real-life reward: kid requests (`redeemRealLifeReward`, about line 6087), parent approval deducts (`approveParentRequest`, `req.type === 'reward'`) | `fieldStamps.points` (device-clock LWW) |
| **Habit Tokens** 🪙 | `hero.coins`, mirrored in `hero.tokens` | Auto-issued on task, habit, battle, quest, expedition, map, workout and dance completion; +50 per hero level-up (`addXP`); arcade | `buyPet` (150), `buyDigitalGear`, `buyAndEquipGear`, `buyProfileTheme`, `buyHabitatSlot`, `buyTreatPack`, `unlockHQFurniture`, Studio items in the Shop | `fieldStamps.coins/tokens` |
| **Pet Sparks** ⚡ | `hero.petSparkMap[petId]`, plus `hero.sparks` (the active pet's value) | `addPetSparks`, `syncHabitPetCare`, completions | `deductPetSparks` (Shop items with `costSparks`) | `fieldStamps.sparks` covers only the mirror. The map is merged by whole-object spread |
| **Evolution Sparks** | `hero.evolutionSparks` | `addEvolutionSparks` | evolution flows | `fieldStamps.evolutionSparks` |
| **Hero XP** | `hero.xp` (XP into the current level), `hero.level`, `hero.xpNext` (curve: 100, then ×1.35 rounded per level) | `addXP` (and direct `hero.xp +=` in `WorldAdventureMapView.js`) | clawback on reject | stamped |
| **Pet XP** | `hero.petXpMap[petId]` (XP into the level), `hero.petLevelMap[petId]` (cap 25, needs `level*100`), plus legacy household-level `state.petXpMap/petLevelMap` | `addPetTrainingXp`, `addPetCareXp` | `deductPetTrainingXp` | **None.** Not in `HERO_STAMPED_FIELDS`; `{...localH, ...cloudH}` means any incoming snapshot replaces it |
| Pet bond XP | `petSanctuary.petBondMap[petId].xp` | `PetSanctuaryCanvas.js:231` | none | none (household-level map, whole-object overwrite) |
| Streak / stars | `hero.streak`, `hero.stars` | completions | none | `Math.max` merge (cannot go down across devices) |
| Screen-time bank | `hero.screenTimeMinutes`, `screenTimeUsedToday` | `grantScreenTimeBonus` | `deductScreenTime` | stamped. **Out of scope for v1**, see open question Q6 |
| Pending approvals | `state.pendingApprovals[]`, `state.resolvedApprovals[]`, `state.taskCompletionLogs[]`, `state.taskLedgerLogs[]` | `enqueuePendingApproval` and friends | `approveParentRequest`, `rejectParentRequest`, `approveAllPendingRequests`, `clearAllPendingApprovals` | Hand-written union and tombstone merges in `hydrateFromCloud` §9 |
| Inventory | `hero.inventory[]` (ids), `hero.consumables[]` (servings), `state.inventory[]` (legacy household-wide) | purchases, gifts (`grantStudioItemToHero`), bounties, chests | `feedPetConsumableSnack`, `feedPetTreat` | set-union merge, so **items can never be removed across devices** |

Multipliers: pet gear `coin_boost` and `xp_boost` buffs are computed on the client (`getActivePetGearBuffs`) and added to awards.

### 1.3 Connected systems (sources and sinks)

**Parent approval flow (today)**
1. Kid completes a habit or task on device K: `completeHabit` / `completeTask` / `completeToothbrushBattle` / `completeAiQuest` / `claimExpeditionRewards` / `completeAdventureGame` / `completeMovementRoutine` / `unlockParentWorldChest` / `submitChoreWithPhoto` in `store.js`. Tokens, XP and sparks are **added locally right away**, and a `task_point_approval` request is pushed into `state.pendingApprovals`, then `saveState(true)`.
2. `saveState` runs `syncSelectedHeroWithHeroes()`, `stampHeroFieldChanges()` (which stamps changed fields with `Date.now()` of K), writes `localStorage`, broadcasts to other tabs, then `firestoreSync.pushStateToCloud(true)`.
3. `_doPush` builds the **whole state** (`stateSnapshot` plus about 60 top-level fields, about 390 KB for a fresh one-kid household, measured with the store's default state) and calls `setDoc(households/CODE, ..., {merge:true})`.
4. Parent device P gets the snapshot in `onSnapshot`, then `store.hydrateFromCloud`, and the request appears in the Parent Portal (`ParentPortalView.js:4865` calls `store.approveParentRequest(id)`).
5. `approveParentRequest` does `hero.points += pendingPoints` **on P only**, marks the log approved, splices the request, `markApprovalResolved`, then `saveState(true)`, which pushes P's whole state again.
6. Every other device must receive P's push **and** win the per-field timestamp merge in `hydrateFromCloud` §3 (`resolve('points', …)`) for the approval to appear.

**Rewards Shop** (`src/views/ShopView.js` calls `store.buyDigitalGear`, `buyProfileTheme`, `redeemRealLifeReward`, `feedPetConsumableSnack`): the price comes from the client catalog (`digitalGear`, which a parent can re-price in `ParentPortalView.js:1528`). The balance check (`currentCoins < coinCost`) and the deduction run locally, and the inventory append is local. There is no reservation for Gold Point rewards: a kid can file several reward requests that together exceed their balance, and approval then clamps at 0 (`Math.max(0, points - costPoints)`), so the later rewards are free.

**3D Studio** (Parent Portal "AI Studio", `ParentPortalView.js` about lines 6700 to 7180; store `addParentCustomWeapon/Gear/Furniture/Toy/Food/Boss`, `grantStudioItemToHero`, `checkAndAwardHabitBounties`): parents create items (name, price `costCoins`, stats, 3D model URL, a thumbnail through `studioArtService.persistStudioImage` to Cloud Storage). Delivery is `instant_gift` (crate), `habit_bounty`, or `shop` listing. Kids buy listed items with Habit Tokens through the normal Shop path (`buyDigitalGear` / `buyAndEquipGear`). Equipping (`equipPetStudioGear`, `equipHeroWeapon`) is free and only changes cosmetic or buff state. Rendering is triggered by `store.notify()`.

**AI Crafting**: the "AI" generations (Studio concept art and models through Firebase AI Logic, story illustrations through Cloudflare Workers AI) **are free today and charge no currency**. No credit, hold or refund logic exists. The hold, capture and void design in section 3.6 is therefore forward-looking. It is only needed if the family wants kids to spend Habit Tokens on generations (open question Q4).

### 1.4 Other direct balance mutations outside the store (must be migrated)

* `src/views/DancePartyView.js` lines 1390, 1760, 1818, 1900, 2002, 2060: `store.getState().selectedHero.coins += …`
* `src/views/WorldAdventureMapView.js` lines 874, 875, 912, 913: `hero.coins += 25; hero.xp += 20`
* `src/components/PetSanctuaryCanvas.js:231`: pet bond XP
* `src/views/ParentPortalView.js` lines 5096 to 5114 edit **reward rates** (`habit.coins`, `chore.points`), not balances. Those become `reward_rules` (section 3.8).

### 1.5 Current security posture relevant to currency

* `households/{code}`: `allow get` with only a valid code format, `allow update` through `isAllowedHouseholdSyncUpdate`, which requires **no auth** and validates shape and size only. Anyone who knows the household code can set any kid's `points`, `coins` and XP to any value.
* `parentSettings.pin` (default `'1234'`) is stored in plain text in that world-readable document, so the "parent-only" approval gate is advisory.
* Subcollections under households are denied (`match /{allChildren=**} { allow read, write: if false; }`). New ledger collections need explicit rules.
* `server/householdReader.js` (Pi weekly report, fridge display) reads the household doc **unauthenticated over REST** and shows `hero.points/coins` (`shared/fridgeSnapshot.js:92`). Locking reads down would break it unless a projection is kept (section 3.7).

### 1.6 Base44 ("Little Heroes Hub")

* This repo has no Base44 SDK, no Base44 URLs and no Base44 entities. The Firebase app does not read or write the Hub.
* The Hub (read through the Base44 connector, one sample record each, read-only) holds its **own** kid balances on the `Kid` entity (`total_points`, `weekly_points`, `banked_points`, `tokens`, `habit_coins`, streaks) and its own `TaskCompletion` records with `status: pending`. Its last kid update in the sample was mid-November 2026. It is a second, independent source of truth for the same family.
* Base44 constraints relevant to a ledger: entity CRUD with row-level security and Deno backend functions. There are no documented multi-record ACID transactions (needed to write balanced postings, a balance and an idempotency record atomically), and there is no supported way to run custom Firestore-style listeners from this PWA. **The ledger should not live in Base44.** Dj has confirmed that moving the ledger off Base44 is acceptable. Whether the Hub is retired, frozen, or becomes a read-only client of this ledger's API is open question Q1.

---

## 2. Root-cause analysis: why approvals stay on the approving device

The underlying cause is architectural: **balances are client-authoritative absolute numbers replicated by last-writer-wins over one shared document, with device clocks as the arbiter.** The specific paths below each trap an approval on device P. They are listed by likelihood, all confirmed by reading the code. Section 6, Phase 0 adds telemetry to measure which ones fire in production.

| # | Failure path | Where | Effect |
|---|---|---|---|
| R1 | **Failed push is never retried.** `_doPush` catches any error, sets `lastPushError`, and returns. Nothing reschedules. `await ensureAuthReady()` sits **outside** the `try`, so an anonymous sign-in failure rejects silently. During a quota cooldown (`markQuotaExhausted`, 60 s), `pushStateToCloud` returns early **without scheduling a retry**. | `firestoreSyncService.js` `pushStateToCloud`, `_doPush` | P's `hero.points` and `localStorage` are updated, the cloud is not, and P shows the points. Others never see them until P happens to save something else successfully. |
| R2 | **Stale or older-build writer and one-sided repair.** A device on an older service-worker build, or a kiosk tablet (Fridge mode) that has not reloaded, pushes `heroesMap` with an old `points` and a missing or older stamp. P's `hydrateFromCloud` sees its local stamp is newer, keeps its own value and sets `repairPushNeeded`. The repair push can be overwritten again by the next stale push. | `store.js` `hydrateFromCloud` §3 `resolve()`, `repairPushNeeded` | P keeps showing approved points. The cloud copy, which every other device reads, keeps flipping back. This matches "only on the approving device". |
| R3 | **Device-clock timestamps.** `stampHeroFieldChanges` uses `Date.now()` of each device. A kid tablet whose clock runs ahead stamps any local change to `points` (for example after a profile switch rewrites the mirror) with a "future" time that beats P's real, later approval. | `store.js` `stampHeroFieldChanges`, `resolve()` | P's approval loses the merge on every device except P. |
| R4 | **Lost updates on counters.** Two devices each add to `coins` or `xp` (kid tablet plus kid phone, or an earn plus a reject clawback). The merge keeps one device's absolute value and discards the other increment. | design | Balances silently drift by the "losing" amount. |
| R5 | **Pet XP and the pet-spark map are not protected at all.** `petXpMap`, `petLevelMap`, `petSparkMap` (except the active-pet mirror) and `consumables` are merged with `{...localH, ...cloudH}`, so whichever snapshot arrives last wins wholesale. | `hydrateFromCloud` §3 | Pet XP earned on one device is erased by any other device's next push. |
| R6 | **Echo suppression by session id.** Snapshots whose `lastWriterSessionId` equals this session are skipped entirely. With `merge:true`, a snapshot that also carries another device's concurrent fields is ignored. | `firestoreSyncService.js` `startSync` | Remote changes that coincide with a local write are dropped until the next remote write. |
| R7 | **Document size and write amplification.** Each save rewrites about 390 KB or more (two full copies of the catalog, `digitalGear` about 140 KB, `pets`, every log) against Firestore's 1 MiB document limit and the daily write quota the code already guards against. Growth in `taskCompletionLogs` (rules allow 1000), `bedtimeStoryLibrary` (200), Studio items and story text moves the household toward `invalid-argument: exceeds maximum size`, which hits R1. | `_doPush`, `buildCloudStateSnapshot` | Every push from every device fails once the limit is crossed. Each device then shows only its own changes. |

Other currency vulnerabilities found (fixed by the same migration):

* V1: Anyone with the household code can write any balance without signing in (section 1.5).
* V2: Parent PIN is readable by every kid device. Approvals are not authenticated.
* V3: Reward requests do not reserve Gold Points, so over-redemption is possible and clamping makes extra rewards free.
* V4: Prices, reward amounts and pet-gear buffs are taken from client data, so a modified client can award itself anything.
* V5: Reject clawback (`rejectParentRequest`) clamps at 0, so tokens spent before a reject are never recovered. That is acceptable as a policy, but today it is accidental.
* V6: Inventory uses set-union merge, so a consumed or removed item reappears from another device.
* V7: `approveAllPendingRequests` approves requests from the local list. A request already rejected on another device but not yet synced here gets approved too.

---

## 3. ADR-001: Where the ledger lives

### 3.1 Context

* Requirements: an atomic, append-only double-entry ledger; integer amounts; idempotency on every mutation; holds for async jobs; real-time propagation to every device in under 500 ms; automatic re-sync on reconnect. Offline operation is **not** required.
* Constraints: a one-family hobby project with no ops team. It already pays for and deploys Firebase (Blaze, Functions, App Hosting), and has a Pi at home. Clients are static PWAs on four hosts, including GitHub Pages, so any backend must be reachable cross-origin with Firebase Auth tokens.
* Scale: about 1 household, under 10 kids, under 10 devices, and at most a few hundred ledger transactions per day. Contention is per kid wallet, roughly 1 write per second at worst.

### 3.2 Options considered

Repository facts were read from the GitHub search API on 2026-11-25.

| Option | What it gives | What it lacks for this app | Ops and cost to add |
|---|---|---|---|
| **Blnk** (`blnkfinance/blnk`, Go, Apache-2.0, about 600★, active) | Balances, inflight (hold) transactions, bulk, reconciliation, webhooks | No browser real-time API; its own auth model; built for fiat money (precision and identity overhead) | Cloud Run service, Cloud SQL Postgres and Redis (it uses a queue). Needs a sync bridge into Firestore for the UI |
| **Formance Ledger** (`formancehq/ledger`, Go, MIT, about 1.5k★, active) | Numscript for atomic multi-party postings, mature double-entry | Same as above; Numscript is a second language to maintain | Cloud Run and Postgres, plus a projection to Firestore |
| **LedgerForge** (`devaccuracy/ledgerforge`, Go, Apache-2.0, about 325★, last push Oct 2026) | Integer math, audit hash chain, spending limits, approval holds | Younger project, smaller community; no client fan-out | Cloud Run, Postgres and Redis |
| **mkmbhs/ledger** (Go, MIT, 2★) | Small reference for idempotent transfers and authorize/capture/void | Reference code, not maintained as a product | Same as above. Useful only as **design reference** |
| **Nakama** (`heroiclabs/nakama`, Go, Apache-2.0, about 13.8k★, active) | Per-user wallets, a wallet history table, real-time sockets and notifications, a JS runtime for server code, leaderboards | Replaces Firebase Auth and sync on every device. Single-entry wallet with no idempotency and no holds (section 3.2.1) | Always-on Go server and CockroachDB or Postgres. The largest migration of all options |
| **Viid21/game-transactions-backend** (TypeScript/NestJS, MIT, 0★) | Steam real-money checkout for Unity: order, then confirm, then grant inventory exactly once | No virtual currency, no balances, no earning, no real-time (section 3.2.1) | NestJS service and Postgres |
| **Base44 (Hub)** | Already holds kid balances for the Hub app | No multi-record transactions, no listeners in this PWA, separate app (section 1.6) | Rejected. Dj confirmed moving off it is fine |
| **Native: Firestore transactions in Cloud Functions** (chosen) | Atomic multi-document transactions (up to 500 writes), server timestamps, `onSnapshot` fan-out to every client including GitHub Pages, Firebase Auth already on every device, rules to forbid client writes, emulator for tests | We write and own the ledger code (about 1.5k lines of TypeScript and tests). Firestore has no SQL reporting. Callable cold starts | **No new infrastructure.** Optional `minInstances: 1` on the ledger functions to remove cold starts (a small monthly cost; check the GCP pricing calculator before enabling, see Q3) |

#### 3.2.1 Deep dive: Nakama and game-transactions-backend

Both repositories were cloned and read at their default branch on 2026-11-25. File paths below are in those repositories.

**Viid21/game-transactions-backend** (NestJS 11, Prisma "prisma-next", PostgreSQL, Vitest; Unity client folder)
* What it is: a starter for **real-money Steam microtransactions** in a Unity game. `backend/src/orders/orders.service.ts` creates an `Order` priced in cents. Steam authorizes payment in its overlay. `confirmPurchase` then grants `Inventory` inside one Postgres transaction. A unique `Fulfillment(orderId)` row is the "grant only once" guard.
* Data model (`backend/src/prisma/contract.prisma`): `Product`, `Player`, `Order`, `Transaction` (payment-provider record), `Fulfillment`, `Inventory`. There is **no wallet, no balance, no virtual currency, no earning path and no ledger**. Auth is Steam session tickets, or a fake provider, issuing its own JWTs (`src/auth/providers/`).
* Real-time: none. Clients poll REST.
* Fit for Little Heroes: **poor**. It solves "a payment processor said yes, now grant the item once". Little Heroes needs "kid earns tokens from chores and spends them in the shop, and every device sees it". About 90% of what this app needs (earn, approve, spend, holds, XP, live updates) would be new code on top of it. It would also add a NestJS service and a Postgres database to host.
* Worth borrowing: the pattern of a **unique "fulfillment" row as the idempotency claim**, written in the same transaction as the grant. That is exactly how `idempotency_keys` works in section 3.9, so the plan already matches it.

**heroiclabs/nakama** (Go 1.x, pgx v5, CockroachDB or Postgres required; Go, Lua and TypeScript/JS server runtimes; official JS client `@heroiclabs/nakama-js`)
* Wallet (`server/core_wallet.go`): each user has one `wallet` JSON map of `currency → int64` on the `users` row. `updateWallets` locks rows with `SELECT … FOR UPDATE`, adds each changeset, and **rejects any result below 0** (`WalletNegativeError`). If ledger recording is on, it inserts the changeset into `wallet_ledger (id, user_id, changeset JSONB, metadata JSONB, create_time)` (`migrate/sql/20180103142001_initial_schema.sql`). Integers only, atomic, and auditable. Good.
* What it lacks against our requirements:
  * **Not double-entry.** A ledger row is a one-sided changeset for one user, with no counter-account (no mint or sink), so totals cannot be reconciled by "everything sums to zero". This can be emulated with a system user, but nothing enforces it.
  * **No idempotency key** on wallet updates. A retried RPC adds twice unless our own runtime code stores and checks keys in Nakama storage.
  * **No holds or reservations.** Reward requests and AI-crafting escrow would be custom runtime code.
  * **Wallet changes are not pushed automatically.** Server code must call `nk.notificationSend` or a stream after every update for other devices to hear about it (`server/core_notification.go`). Real-time works only while each device holds an open WebSocket.
* Identity: wallets belong to **Nakama users**. Each kid profile would become a Nakama user. A shared tablet switching between kids, and a parent approving for a kid, would need custom auth (`AuthenticateCustom`) plus server RPCs that act for another user. All of that replaces Firebase Anonymous/Google sign-in and the household-code join on every device.
* Hosting: a long-running Go server (WebSockets) plus CockroachDB or Postgres. That doesn't fit serverless Cloud Functions. Realistic homes are a small VM or Cloud Run with min instances plus Cloud SQL, Heroic Labs' paid managed cloud, or the family Pi. The Pi would put the kids' balances on home hardware and the home network, behind Tailscale Funnel, which is a reliability risk for the only copy of the balances.
* Overlap with Firebase: the app would still need Firestore for everything that is not currency (settings, tasks, stories, studio items, meal plan), so devices would keep two live connections and two auth systems.
* Fit for Little Heroes: **workable but the most expensive path.** It gives real-time push and a safe wallet out of the box. We would still write idempotency, holds, double-entry discipline, approval flows and a Firebase-to-Nakama identity bridge. We would also take on a database and a server that must stay up.

**Scorecard against this app's needs**

| Need | Native Firestore ledger (chosen) | Nakama | game-transactions-backend |
|---|---|---|---|
| Atomic balance change | Yes (Firestore transaction) | Yes (`FOR UPDATE`) | Inventory only |
| Double-entry, sums to zero | Yes (enforced in core) | No (single-entry changesets) | No balances |
| Idempotency keys | Yes (built in, section 3.9) | Custom code | Per order only (`Fulfillment`) |
| Holds (reward requests, AI crafting) | Yes (section 3.6) | Custom code | No |
| Live updates to every device | Yes, `onSnapshot` (already used) | Yes, sockets and notifications sent by our code | No |
| Works from GitHub Pages and Firebase Hosting | Yes | Yes (needs CORS and a public endpoint) | Yes (needs CORS and a public endpoint) |
| Keeps Firebase Auth and household-code join | Yes | No (new user model) | No (Steam or own JWT) |
| New infrastructure | None | Go server, database | NestJS server, Postgres |
| Effort beyond the ledger itself | Low | High (identity bridge, two sync systems) | Very high (build the economy) |

**Conclusion:** the deep dive does not change ADR-001. game-transactions-backend is a real-money checkout template, not a virtual-currency ledger. Nakama is a capable game server, but its wallet still needs the same idempotency, holds and approval code we would write natively, and adopting it means swapping out sign-in and sync on every device and running a database. Revisit Nakama only if the app grows multiplayer features (live co-op, chat, matchmaking) that Firebase handles poorly.

### 3.3 Decision

Implement the double-entry ledger **natively in Firestore**, written only by **Cloud Functions v2 callables** using the Admin SDK in transactions. Expose state to clients only through read-only Firestore documents that clients subscribe to with `onSnapshot`. Borrow the authorize/capture/void hold model from Blnk and `mkmbhs/ledger` and the "postings must sum to zero" invariant from Formance, without running either.

### 3.4 Consequences

* Positive: one source of truth that is already reachable from all four hosts; real-time comes from the platform; no new servers, databases or credentials; rules make client tampering impossible; every change has an audit trail.
* Negative: we own the correctness of the ledger core, which is mitigated by a pure, fully unit-tested core (Phase 1) and emulator integration tests (Phase 2). Earn and spend now need a network round trip, which is acceptable because offline mode is not required. Optimistic UI hides latency (section 4.3).
* Rejected alternatives can be revisited if the app ever serves many families. The ledger core interface (section 3.5) is storage-agnostic, so a Postgres-backed engine could replace the Firestore adapter later.

### 3.5 Ledger model

**Units.** Every amount is a JavaScript safe integer in the currency's smallest unit. All six currencies are already whole numbers, so 1 minor unit equals 1 point, token, spark or XP. Reject any non-integer, `NaN`, negative transfer amount or value above `Number.MAX_SAFE_INTEGER` at the API boundary (zod or a hand-written validator).

**Currencies** (`functions/src/ledger/currencies.ts`):
`GOLD_POINTS`, `HABIT_TOKENS`, `PET_SPARKS` (scoped per pet), `EVOLUTION_SPARKS`, `HERO_XP`, `PET_XP` (scoped per pet). Optional later: `PET_BOND_XP`, `SCREEN_MINUTES` (Q6).

**Accounts.** Id format is `{scope}:{owner}:{currency}[:{petId}]`
* Kid accounts: `hero:{heroId}:GOLD_POINTS`, `hero:{heroId}:PET_SPARKS:{petId}`, and so on. Normal balance is credit; balance must stay at or above 0, and `available = balance - held` must stay at or above 0.
* System accounts, per household, allowed to go negative:
  `sys:treasury_mint:{CUR}` (source of all earned value), `sys:opening_balance:{CUR}` (backfill source), `sys:shop_sink:{CUR}`, `sys:reward_redemption_sink:GOLD_POINTS`, `sys:ai_crafting_sink:{CUR}`, `sys:pet_training_sink:PET_XP` (for `deductPetTrainingXp`), `sys:clawback:{CUR}` (reject reversals), `sys:adjustment:{CUR}` (parent manual corrections).
* XP is modeled as a ledger currency so every change is auditable and idempotent. Level is **derived** from cumulative XP and never stored as a source of truth.

**Transaction** = 1 to n balanced postings. Invariant: for each currency in the transaction, the signed amounts sum to 0. Every transaction carries `type`, `idempotencyKey`, `actor`, `refs`, `createdAt` (server timestamp) and an optional `reversesTxnId`.

**Transaction types** (enum): `EARN_ACTIVITY`, `APPROVE_TASK_POINTS`, `REJECT_TASK_CLAWBACK`, `REWARD_REQUEST_HOLD`, `REWARD_APPROVE_CAPTURE`, `REWARD_REJECT_VOID`, `SHOP_PURCHASE`, `LEVEL_UP_BONUS`, `PET_XP_SPEND`, `SPARK_SPEND`, `AI_CRAFT_HOLD`, `AI_CRAFT_CAPTURE`, `AI_CRAFT_VOID`, `PARENT_ADJUSTMENT`, `OPENING_BALANCE`, `GIFT_GRANT` (inventory only, zero-amount).

### 3.6 Holds (authorize, capture, void)

Use the reservation model: a hold does not move money; it increases `held` on the kid account.
* `authorize(account, amount, ttl)` needs `available >= amount`. It creates `holds/{holdId}` with `status: 'authorized'`, `expiresAt`, and adds `held += amount`.
* `capture(holdId)` needs `status == 'authorized'`. In one transaction it posts kid to sink for `amount` (or less, never more), reduces `held`, and sets `status: 'captured', captureTxnId`.
* `void(holdId)` sets `held -= amount` and `status: 'voided'`.
* Expiry: a scheduled function `ledgerExpireHolds` (every 15 minutes) voids authorized holds past `expiresAt`.
* Uses: **reward requests** (V3) hold Gold Points at request time; **AI Crafting**, if it starts charging (Q4), holds before generation, captures on success, voids on failure or timeout. For an async AI job, the job record stores `holdId`; the success path calls `capture`, and every error path including the expiry sweep calls `void`. Idempotency keys make double capture or void a no-op.

### 3.7 Firestore data model

Everything new lives under `households/{CODE}/…` so the existing household-code scoping and future multi-household support stay natural.

```
households/{CODE}                         (existing doc; gains server-only fields below)
  ledgerMode: 'legacy' | 'shadow' | 'authoritative'     // server-written only
  syncSchemaVersion: number                              // minimum client schema allowed to push
  walletSummary: { [heroId]: { points, coins, sparks, xp, level, ... , version } }  // server-written projection for the Pi/fridge REST readers

households/{CODE}/members/{uid}
  { uid, role: 'parent' | 'device', deviceId, displayName?, joinedAt, lastSeenAt }

households/{CODE}/accounts/{accountId}
  { accountId, scope: 'hero'|'sys', ownerId, currency, petId?,
    balance: int, held: int, allowNegative: bool,
    version: int, lastTxnId, createdAt, updatedAt }

households/{CODE}/wallets/{heroId}             // the ONE doc a client listens to per kid
  { heroId, version: int, lastTxnId, updatedAt,
    balances: { GOLD_POINTS, HABIT_TOKENS, EVOLUTION_SPARKS, HERO_XP }: int,
    held:     { GOLD_POINTS, HABIT_TOKENS, ... }: int,
    pets: { [petId]: { PET_XP: int, PET_SPARKS: int, level: int, xpIntoLevel: int, xpForNext: int } },
    hero: { level: int, xpIntoLevel: int, xpForNext: int },
    pendingApprovalCount: int }

households/{CODE}/ledger_transactions/{txnId}   // append-only
  { txnId, type, idempotencyKey, postings: [{ accountId, currency, amount: int }],
    actor: { uid, role, deviceId }, refs: { approvalId?, itemId?, holdId?, activityId? },
    reversesTxnId?, memo, createdAt: serverTimestamp }

households/{CODE}/ledger_entries/{txnId}_{n}    // one per posting, for per-account history queries
  { txnId, n, accountId, heroId?, currency, amount: int, balanceAfter: int, createdAt }

households/{CODE}/holds/{holdId}
  { holdId, accountId, heroId, currency, amount: int, status: 'authorized'|'captured'|'voided'|'expired',
    purpose: 'reward_request'|'ai_craft', refs, expiresAt, authorizeTxnId?, captureTxnId?, createdAt, updatedAt }

households/{CODE}/idempotency_keys/{sha256(key)}
  { key, requestHash, txnId, result (JSON, small), status: 'committed', createdAt, expireAt }  // Firestore TTL on expireAt (30 days)

households/{CODE}/inventory/{heroId}__{itemId}
  { heroId, itemId, kind: 'gear'|'theme'|'pet'|'consumable'|'furniture'|'weapon'|'habitat_slot',
    qty: int, servingsRemaining?: int, acquiredTxnId, source: 'shop'|'gift'|'bounty'|'chest'|'backfill',
    updatedAt }

households/{CODE}/approval_requests/{requestId}
  { requestId, kind: 'task_points'|'reward', heroId, taskId?, rewardId?, title,
    amount: int (points to award or cost), holdId?, earnTxnId? (the auto-issued tokens/xp txn, for clawback),
    status: 'pending'|'approved'|'rejected'|'cancelled', createdBy, resolvedBy?, resolvedAt?, createdAt }

households/{CODE}/catalog/{itemId}              // server-trusted prices (parent-editable via callable)
  { itemId, kind, title, costCoins: int, costSparks: int, costPoints: int, active: bool, updatedAt }

households/{CODE}/reward_rules/{activityType}   // server-trusted earn amounts and daily caps
  { activityType, tokens: int, xp: int, sparks: int, points: int, dailyCap?: int, updatedAt }

households/{CODE}/private/parentAuth            // never client-readable
  { pinHash, pinSalt, algo: 'scrypt', failedAttempts, lockedUntil }

households/{CODE}/parent_sessions/{uid}
  { uid, expiresAt }                                     // written by verifyParentPin
```

Index needs: `ledger_entries` by `(accountId, createdAt desc)` and `(heroId, createdAt desc)`; `approval_requests` by `(status, createdAt desc)`; `holds` by `(status, expiresAt)`. Add them to a new `firestore.indexes.json` and reference it from `firebase.json`.

### 3.8 Callable API (`functions/src/ledger/api.ts`)

Every callable: requires `request.auth`; requires a `members/{uid}` doc for the household; validates input; requires `idempotencyKey` (a UUIDv4 from the client, or deterministic where noted); runs one Firestore transaction; returns `{ txnId, wallet }`.

| Callable | Caller | Behaviour |
|---|---|---|
| `ledgerJoinHousehold({code, deviceId})` | any signed-in device | Code must exist, then upsert `members/{uid}` with role `device` (role `parent` if uid is in `parentUids`). Same trust as today: the code is the secret |
| `ledgerVerifyParentPin({code, pin})` | device | scrypt-compare with `private/parentAuth`, rate-limit (5 tries, then 15 min lock), write `parent_sessions/{uid}` (20 min) |
| `ledgerSetParentPin({code, newPin})` | parent | Hash and store; remove `parentSettings.pin` from the household doc |
| `ledgerRecordActivity({code, heroId, activityType, activityId, petId?})` | device | Look up `reward_rules/{activityType}`, apply server-side gear buff (capped at 50%), enforce `dailyCap`. Post `EARN_ACTIVITY` (mint to kid: tokens, XP, sparks); derive level-ups and post `LEVEL_UP_BONUS` (+50 tokens per level crossed); if the rule has `points > 0`, create `approval_requests` `task_points` with `earnTxnId`. Idempotency key is **deterministic**: `activity:{heroId}:{activityType}:{activityId}`, so a retry or a second device cannot double-award |
| `ledgerApproveRequest({code, requestId})` | parent (uid in `parentUids` **or** a live `parent_sessions/{uid}`) | `task_points`: mint points (`APPROVE_TASK_POINTS`). `reward`: capture hold (`REWARD_APPROVE_CAPTURE`). Status `pending` to `approved`. Key: `approve:{requestId}` |
| `ledgerRejectRequest({code, requestId, clawback: true})` | parent | `task_points`: reverse `earnTxnId` up to available balance (`REJECT_TASK_CLAWBACK`, shortfall recorded in memo). `reward`: void hold. Key: `reject:{requestId}` |
| `ledgerApproveAll({code, requestIds[]})` | parent | Loops server-side over **explicit ids that are still pending** (fixes V7) |
| `ledgerRequestReward({code, heroId, rewardId})` | device | Authorize a hold on `GOLD_POINTS` for the catalog cost and create an `approval_requests` reward |
| `ledgerPurchase({code, heroId, itemId, petId?, qty})` | device | Price from `catalog/{itemId}`; checks; post kid to `shop_sink` (tokens and/or sparks); upsert `inventory` in the same transaction; handles pets (150), themes, habitat slots, treats, furniture |
| `ledgerConsume({code, heroId, itemId})` | device | Decrement `servingsRemaining`, no currency |
| `ledgerSpend({code, heroId, currency, amount, reason, petId?})` | device | Generic sink for `deductPetTrainingXp` and `deductPetSparks` uses with a whitelisted `reason` |
| `ledgerHoldAuthorize / Capture / Void` | server-internal (AI jobs) and parent | Section 3.6 |
| `ledgerAdjust({code, heroId, currency, amount, memo})` | parent | `PARENT_ADJUSTMENT` against `sys:adjustment` |
| `ledgerUpsertCatalog / ledgerUpsertRewardRules` | parent | Replaces client-side pricing edits (`ParentPortalView.js:1528`, 5096 to 5114) |

Shared code: put currency enums, the XP curves and the level derivation in `shared/ledger/` (plain ES modules) so the client renders the same level math the server enforces. The functions build must include it; either copy it during `functions` prebuild or set `rootDir` accordingly.

### 3.9 Transaction algorithm (core, storage-agnostic)

```
postTransaction(store, { householdId, type, idempotencyKey, postings, actor, refs, holdOps, inventoryOps, requestHash }):
  runTransaction:
    1. idem = get idempotency_keys/sha256(key)
       if idem exists: if idem.requestHash != requestHash -> throw ALREADY_EXISTS_DIFFERENT_PAYLOAD
                       else return idem.result               // exactly-once
    2. read every touched account, wallet, hold and inventory doc (ALL reads before ANY write)
    3. validate: integers; per-currency sum == 0; for non-negative accounts
       balance' >= 0 and (balance' - held') >= 0; hold state transitions legal
    4. write ledger_transactions/{txnId}, ledger_entries/{txnId}_{n} (with balanceAfter),
       accounts (balance, held, version+1), wallets/{heroId} (recomputed fields, version+1),
       holds, inventory, approval_requests status, idempotency_keys
    5. return { txnId, wallet }
```
`txnId` is a ULID generated before the transaction so retries of the Firestore transaction reuse it. Keep each transaction under 500 writes; a single kid action touches fewer than 20.

### 3.10 Security rules (additions to `firestore.rules`)

```
function isMember(code) {
  return request.auth != null &&
         exists(/databases/$(database)/documents/households/$(code)/members/$(request.auth.uid));
}

match /households/{code} {
  // existing get/create rules stay (Pi REST reader depends on get-by-code)
  allow update: if <existing conditions>
    // server-only fields can never be written by clients
    && !request.resource.data.diff(resource.data).affectedKeys()
         .hasAny(['ledgerMode', 'syncSchemaVersion', 'walletSummary'])
    // once authoritative, only clients on the new schema may push, and they may not touch approvals
    && (resource.data.get('ledgerMode', 'legacy') != 'authoritative' || (
          request.resource.data.get('clientSchemaVersion', 0) >= resource.data.get('syncSchemaVersion', 0)
          && !request.resource.data.diff(resource.data).affectedKeys()
               .hasAny(['pendingApprovals', 'resolvedApprovals', 'inventory'])
       ));

  match /members/{uid}             { allow get: if request.auth != null && request.auth.uid == uid; allow list: if isMember(code); allow write: if false; }
  match /wallets/{heroId}          { allow read: if isMember(code); allow write: if false; }
  match /accounts/{id}             { allow read: if isMember(code); allow write: if false; }
  match /ledger_transactions/{id}  { allow read: if isMember(code); allow write: if false; }
  match /ledger_entries/{id}       { allow read: if isMember(code); allow write: if false; }
  match /holds/{id}                { allow read: if isMember(code); allow write: if false; }
  match /inventory/{id}            { allow read: if isMember(code); allow write: if false; }
  match /approval_requests/{id}    { allow read: if isMember(code); allow write: if false; }
  match /catalog/{id}              { allow read: if isMember(code); allow write: if false; }
  match /reward_rules/{id}         { allow read: if isMember(code); allow write: if false; }
  match /idempotency_keys/{id}     { allow read, write: if false; }
  match /private/{id}              { allow read, write: if false; }
  match /parent_sessions/{uid}     { allow get: if request.auth != null && request.auth.uid == uid; allow write: if false; }
  match /{other=**}                { allow read, write: if false; }
}
```
Notes: the explicit sub-matches must sit **before** the existing `match /{allChildren=**}` deny, or replace it. Rules are additive, so make sure no other match grants writes. The Admin SDK bypasses rules, which is what the functions rely on.

### 3.11 Migration and backfill strategy

* `ledgerMode` per household: `legacy` (today) goes to `shadow` (clients still mutate locally **and** call the ledger; the ledger is not yet displayed; a nightly reconciliation compares them), then to `authoritative` (the UI reads wallets; local mutation code is removed; old clients are blocked by `syncSchemaVersion`).
* Backfill script `scripts/ledger/backfill.mjs` (Admin SDK, run by a person from a laptop or Cloud Shell; **not** a client):
  1. `--household CODE [--dry-run] [--freeze]`. With `--freeze`, set `ledgerMode: 'migrating'` first (clients show a "Updating your treasure chest…" banner and disable earn and spend buttons), then read the household doc **fresh**.
  2. For each hero, take values from `heroesMap[heroId]` (fallback `heroes[]`). Choose the larger of `coins` and `tokens` for Habit Tokens and **log the disagreement**.
  3. Convert XP to cumulative:
     * Hero: `cum = Σ_{k=1}^{level-1} t_k + xp`, where `t_1 = 100` and `t_{k+1} = round(t_k × 1.35)` (the same as `addXP`). If the stored `xpNext` differs from `t_level`, log an anomaly and keep `level`.
     * Pet: `cum = 50 × L × (L − 1) + xp` (from `needed = level × 100`, cap 25). Use `hero.petXpMap/petLevelMap`, falling back to household-level maps only for pets with no hero copy.
  4. Pet Sparks per pet: `petSparkMap[petId]`. If the map lacks the active pet, use `hero.sparks` for it.
  5. Post one `OPENING_BALANCE` transaction per hero (from `sys:opening_balance:{CUR}`) with idempotency key `backfill:v1:{CODE}:{heroId}`. Re-running is a no-op.
  6. Inventory: one `inventory` doc per id in `hero.inventory` and per entry in `hero.consumables`, with `source: 'backfill'`.
  7. Pending approvals: convert each `pendingApprovals` entry **not** in `resolvedApprovals` into `approval_requests`. For `reward` requests, authorize a hold. If funds are insufficient, mark it `needs_parent_review` and list it in the report.
  8. Seed `catalog` from `DIGITAL_REWARDS_CATALOG`, `THREE_D_ASSETS`, `state.digitalGear` prices and parent custom items, and seed `reward_rules` from the current hard-coded amounts (habit and task `coins/points/xp`, battle, expedition, map +25/+20, dance +5/+25/+30, level-up +50).
  9. Write `walletSummary`, then set `ledgerMode: 'shadow'` (or `'authoritative'` when invoked with `--cutover`).
  10. Emit `scripts/ledger/reports/{CODE}-{timestamp}.json` with before values, after wallets and every anomaly. `--dry-run` writes nothing and prints the report.
* Rollback: `scripts/ledger/rollback.mjs --household CODE` sets `ledgerMode: 'legacy'` and copies `wallets` back into `heroesMap` balance fields with fresh stamps. The ledger collections are kept for audit.

---

## 4. Real-time sync and reconnect design

### 4.1 Subscriptions

* New `src/services/walletService.js`:
  * `start(code)`: `onSnapshot(collection(db, 'households', code, 'wallets'), {includeMetadataChanges: true}, …)` plus `onSnapshot(query(approval_requests, where('status','==','pending')))`.
  * Keeps `walletsById` in memory. Each snapshot replaces a wallet only if `incoming.version >= current.version` (monotonic; protects against out-of-order delivery).
  * Exposes `getWallet(heroId)`, `subscribe(fn)`, and `status: 'connecting'|'live'|'reconnecting'|'stale'`. `snapshot.metadata.fromCache === true` means `stale`.
* `store.js` getters (`getPetXp`, `getPetLevel`, `getPetSparks`, the hero header, ShopView affordability) read from `walletService`, **never** from `hero.points/coins/xp` once `ledgerMode === 'authoritative'`.
* Firestore cache: keep the default memory cache for these listeners (no `persistentLocalCache`) so a cold start can never show an old offline balance as live. Render "…" with a shimmer until the first `fromCache === false` snapshot arrives.

### 4.2 Latency budget (target p95 under 500 ms, warm)

| Step | Typical |
|---|---|
| Client callable request to Cloud Functions (us-central1) | 60 to 150 ms |
| Firestore transaction (5 to 15 reads and writes) | 50 to 150 ms |
| Commit to `onSnapshot` delivery on other devices | 50 to 200 ms |
| **Total** | about 160 to 500 ms |

Cold starts (1 to 3 s or more) break the budget. Mitigation options: (a) `minInstances: 1` on a **single** `ledger` callable (route all operations through one function with an `op` field) to keep one warm instance, or (b) accept occasional cold starts with optimistic UI. Recommend (a) pending budget confirmation (Q3). Phase 7 measures real p95 with `scripts/ledger/latency_probe.mjs` (two Admin-SDK-free web clients via Playwright against a staging household).

### 4.3 Optimistic UI without trusting the client

* `walletService.applyOptimistic(heroId, deltas, idempotencyKey)` stores a pending overlay `{key, deltas, createdAt}`. The displayed balance is server wallet plus the sum of pending deltas.
* When the callable resolves, drop the overlay; the server `wallet` in the response, or the snapshot, already includes it. On error, drop the overlay and show the server's message ("Not enough Habit Tokens").
* Overlays older than 10 s with no response are dropped, and the callable is retried with the **same** key.
* Overlays never write to `localStorage` and never feed back into `hero.*` fields.

### 4.4 Reconnect and returning devices

* Firestore listeners resume automatically and deliver the latest server state. The wallet version check makes that the truth.
* An outbox in `sessionStorage` (`ledger_outbox_v1`) holds `{op, args, idempotencyKey, firstAttemptAt}` for every callable not yet acknowledged. On `online`, `visibilitychange` (visible) and every `walletService` status change to `live`, it flushes in order. Retries are exactly-once through idempotency keys. Entries older than 24 h are dropped and shown as "That action didn't reach the server."
* While `navigator.onLine === false` or the status is not `live` for more than 2 s, disable earn and spend buttons and show a small "Reconnecting…" pill. This is allowed because offline mode is out of scope.
* On reconnect, also call `getDocsFromServer(wallets)` once to force a server read, in case the device was suspended long enough that the SDK only has a cached view.
* Legacy `localStorage` state no longer carries balances in authoritative mode. `_serializeStateForLocalStorage` strips the currency fields so nothing stale can resurface.

### 4.5 What stays on the legacy household-doc sync

Non-currency state (settings, task definitions, story library, meal plan, Studio item definitions, pets' cosmetic state) keeps the current `firestoreSyncService` path for now. In authoritative mode:
* `_doPush` and `buildCloudStateSnapshot` exclude `points, coins, tokens, xp, level, xpNext, sparks, evolutionSparks, petSparkMap, petXpMap, petLevelMap, inventory, consumables, pendingApprovals, resolvedApprovals`, and add `clientSchemaVersion: 2`.
* `hydrateFromCloud` ignores those fields.
* Phase 9 (optional, later) splits the remaining household doc into per-domain subcollections to remove the 1 MiB and write-amplification risk (R7).

---

## 5. Open questions for Dj

| # | Question | Default if unanswered |
|---|---|---|
| Q1 | Is the Base44 "Little Heroes Hub" still in use by the family? Should it be (a) retired, (b) frozen read-only, or (c) fed from this ledger through a small read API? Should its existing Hub balances be merged into the Firebase ledger, or ignored? | (a) retire, and do not merge Hub balances |
| Q2 | Which devices are parents? Today any device unlocks the Parent Portal with the PIN. Is a PIN-verified server session (20 minutes) enough, or must parents sign in with Google on their own phones? | PIN session, plus Google sign-in honored when present |
| Q3 | Monthly budget for a warm ledger instance (`minInstances: 1`) to keep updates under 500 ms? | Ship with `minInstances: 0`; measure; ask again with real numbers |
| Q4 | Should AI Crafting cost kids anything (for example, Habit Tokens per generated picture)? Today it is free. | Free; hold, capture and void stay built but unused |
| Q5 | When a parent rejects a chore after the kid already spent the auto-issued tokens, claw back only what is left (today's behaviour), or allow a negative balance? | Claw back what is left, record the shortfall |
| Q6 | Should the Screen-Time bank and pet bond XP also move to the ledger in v1? | No, v2 |
| Q7 | Are there households besides yours (friends or family using the same deployment) that the backfill must cover? | Only your household, plus a generic script for others |
| Q8 | To confirm which root cause fires most, may Phase 0 telemetry log push failures to the Pi's Umami or ntfy (no kid names, only error codes)? | Yes, error codes only |

---

## 6. Phased execution checklist

General rules for every phase:
* Follow `CLAUDE.md`: run `npm run build` and `node scratch/run_all_tests.js` before pushing; register every new `scratch/verify_*.mjs` in `scratch/run_all_tests.js`; one PR per phase into `main`; confirm both deploy workflows after merge.
* `functions/` changes must pass `npm --prefix functions run lint` and `npm --prefix functions run build`.
* No floats: add an ESLint rule or a test that fails on `parseFloat`, `toFixed` or `/` arithmetic inside `functions/src/ledger/` and `shared/ledger/`, except in the documented XP curve helper (which uses `Math.round`).
* Never ship a phase that leaves `ledgerMode` defaulting to anything other than `legacy` until Phase 8.

### Phase 0: Instrument and reproduce (no behaviour change)
**Files:** `src/services/firestoreSyncService.js`, `scratch/verify_ledger_bug_repro.mjs` (new), `scratch/run_all_tests.js`
1. In `_doPush`, move `await ensureAuthReady()` inside `try`. On any failure, record `{code, at}` in a ring buffer `this.pushFailures` (last 20) and **schedule a retry** with exponential backoff (2 s, 4 s, 8 s, up to 60 s) while `lastPushError` is set. When the quota cooldown ends, schedule one push.
2. Show `getSyncHealth()` with the last error code in the Parent Portal sync card (it already exists; add the code).
3. Repro test: simulate two store instances (re-import the store with separate mock `localStorage`) sharing an in-memory "cloud doc" with `merge:true` semantics, and assert today's failures: (a) R4 lost update on concurrent `coins +=`; (b) R5 pet XP overwrite; (c) R3 skewed clock beats a later approval; (d) R1 a failed push leaves P alone with the approval. Mark these as **expected-fail** (`EXPECTED_LEGACY_FAILURE`) so the suite stays green; Phase 8 flips them to must-pass.
**Acceptance:** build passes; repro test documents all four behaviours; a push failure now retries (unit test with a fake `setDoc` that fails twice then succeeds).

### Phase 1: Pure ledger core
**Files (new):** `shared/ledger/currencies.js`, `shared/ledger/xpCurves.js`, `functions/src/ledger/core.ts`, `functions/src/ledger/types.ts`, `functions/src/ledger/validate.ts`, `functions/src/ledger/__tests__/core.test.ts`; add `"test": "node --test lib/ledger/__tests__"` to `functions/package.json` (run after `tsc`); CI step in `.github/workflows/ci.yml`.
* `core.ts` exposes `planTransaction(state, request) -> { writes, wallet, result }`, operating on a plain in-memory snapshot (no Firestore imports).
* `xpCurves.js`: `heroLevelFromCumulative(cum)`, `heroCumulativeFrom(level, xpIntoLevel)`, `petLevelFromCumulative(cum)`, `petCumulativeFrom(level, xp)`. These must match `addXP` and `addPetTrainingXp` exactly.
**Tests (must pass):** postings sum to zero per currency; rejects non-integers, NaN, Infinity and negative amounts; non-negative accounts cannot go below 0; `available` respects holds; hold transitions (authorized to captured, authorized to voided; captured cannot be voided; double capture is a no-op with the same key); idempotency with the same key and same payload returns the same result; the same key with a different payload throws; level-up crossing 3 levels mints exactly 3 × 50 tokens; XP curve round-trip for every hero level 1 to 60 and pet level 1 to 25; property test of 1,000 random earn and spend sequences where the sum of all account balances is 0 and no kid account is negative.

### Phase 2: Firestore adapter and callables (behind `ledgerMode`)
**Files (new):** `functions/src/ledger/firestoreAdapter.ts`, `functions/src/ledger/api.ts`, `functions/src/ledger/rewardRules.ts`, `functions/src/ledger/catalog.ts`, `functions/src/ledger/expireHolds.ts`; export from `functions/src/index.ts`; `firestore.indexes.json`; `firebase.json` (indexes and emulators block).
* Single callable `ledger` with `{op, ...}` routing, `region: 'us-central1'`, `enforceAppCheck: false` (unchanged posture), `minInstances` read from a parameter (default 0).
* Emulator tests: `functions/src/ledger/__tests__/integration.test.ts` using `@firebase/rules-unit-testing` or the Admin SDK against `FIRESTORE_EMULATOR_HOST`; add a CI job that runs `firebase emulators:exec --only firestore,functions,auth "npm --prefix functions run test:integration"` (requires Java in CI: `actions/setup-java@v4`).
**Tests:** for each op, the happy path plus insufficient funds plus a duplicate key; 20 parallel `recordActivity` calls with the same `activityId` produce exactly one transaction; 20 parallel purchases with funds for 3 produce exactly 3 successes; reward request, then approve, captures and lowers `held`; reward request, then reject, voids; an expired hold is voided by `expireHolds`; reject clawback with the balance already spent claws back only what is available and records the shortfall; approval by a non-parent fails with `permission-denied`.

### Phase 3: Membership and parent authentication
**Files:** `functions/src/ledger/auth.ts` (new), `src/services/ledgerClient.js` (new, a thin `httpsCallable` wrapper with an outbox), `src/services/firestoreSyncService.js` (call `ledgerJoinHousehold` in `joinHousehold` and on startup if not a member), `src/components/ParentLockModal.js` and `store.unlockParentSession` (verify the PIN server-side; keep the client check as fallback in `legacy` mode only).
* Migrate the PIN: `ledgerSetParentPin` is called once by the backfill from the current `parentSettings.pin`, then `parentSettings.pin` is deleted from the household doc and `isParentUnlocked` relies on `parent_sessions`.
**Tests:** emulator: a non-member cannot read wallets; a member can; PIN brute force locks after 5 attempts; a session expires after 20 minutes; `scratch/verify_parent_pin_server_session.mjs` checks the client wrapper with a mocked callable.

### Phase 4: Security rules
**Files:** `firestore.rules`, `functions/src/ledger/__tests__/rules.test.ts` (or `scratch/verify_ledger_rules.mjs` run under the emulator).
**Tests:** client writes to every ledger collection are denied; clients cannot change `ledgerMode`, `syncSchemaVersion` or `walletSummary`; in `authoritative` mode a push with `clientSchemaVersion: 1` is denied and with `2` is allowed; a push touching `pendingApprovals` in authoritative mode is denied; existing legacy flows still pass (run the existing `scratch/verify_firestore_rules_and_sync.mjs`).
**Acceptance:** `firebase deploy --only firestore:rules` dry-run (`--dry-run` is not available for rules, so use the emulator plus `firebase firestore:rules:check` if available, otherwise compile via the emulator start).

### Phase 5: Backfill and shadow mode
**Files (new):** `scripts/ledger/backfill.mjs`, `scripts/ledger/rollback.mjs`, `scripts/ledger/reconcile.mjs`, `scripts/ledger/README.md`; `functions/src/ledger/reconcileNightly.ts` (scheduled, compares `walletSummary` to `heroesMap` balances in shadow mode, writes `households/{CODE}/ledger_reports/{date}`); `functions/src/ledger/mirrorWalletSummary.ts` (`onDocumentWritten('households/{code}/wallets/{heroId}')` writes `walletSummary.{heroId}` on the household doc for the Pi and fridge readers).
* Client in shadow mode: each existing earn or spend site **also** calls the ledger op with the same idempotency key it will use later (do this in Phase 7's helper so call sites change only once; in Phase 5 wire just the 6 highest-volume paths: `completeHabit`, `completeTask`, `approveParentRequest`, `rejectParentRequest`, `redeemRealLifeReward`, `buyDigitalGear`).
**Tests:** backfill on fixture households in `scratch/fixtures/ledger/` (one kid, three kids, a skewed `coins` vs `tokens` pair, a pet at the level cap, a reward request exceeding the balance) gives exact expected wallets; re-running the backfill is a no-op; rollback restores `heroesMap` values; the XP conversion round-trips.
**Run order for the real household:** `--dry-run`, then Dj reviews the report, then `--freeze`, then shadow for 3 or more days with 0 unexplained drift in nightly reports.

### Phase 6: Client wallet read path
**Files:** `src/services/walletService.js` (new), `src/state/store.js` (getters: `getPetXp`, `getPetLevel`, `getPetSparks`, `getActivePetSparks`, header and Shop balances), `src/components/TopHeader.js`, `src/views/ShopView.js`, `src/views/DashboardView.js`, `src/views/PetDetailView.js`, `src/views/ParentPortalView.js` (approval queue from `approval_requests`), `shared/fridgeSnapshot.js` (read `walletSummary` first).
* Every read goes through a `balanceOf(heroId, currency, petId?)` helper that returns the wallet value in `authoritative` mode and the legacy hero field otherwise.
**Tests:** `scratch/verify_wallet_service.mjs`: version monotonicity (an older snapshot is ignored); optimistic overlay add and clear; `fromCache` marks the status stale; the header shows "…" before the first server snapshot; the fridge snapshot prefers `walletSummary`.

### Phase 7: Client write path (all mutation sites)
**Files:** `src/services/ledgerClient.js`; `src/state/store.js` (every method in section 1.2 and 1.3: `completeHabit`, `completeTask`, `claimCompanionHabit`, `submitChoreWithPhoto`, `completeToothbrushBattle`, `claimExpeditionRewards`, `completeAiQuest`, `addXP`, `addCoins`, `addPetTrainingXp`, `addPetCareXp`, `deductPetTrainingXp`, `addPetSparks`, `deductPetSparks`, `addEvolutionSparks`, `recordWorkoutCompletion`, `syncHabitPetCare`, `completeAdventureGame`, `completeMovementRoutine`, `completePetBathReward`, `awardTaskCareSynergy`, `unlockParentWorldChest`, `completeWaypointChore`, `completeBedtimeStory` if it awards, `buyPet`, `buyProfileTheme`, `buyHabitatSlot`, `buyAndEquipGear`, `buyDigitalGear`, `buyTreatPack`, `feedPetConsumableSnack`, `feedPetTreat`, `unlockHQFurniture`, `grantStudioItemToHero`, `checkAndAwardHabitBounties`, `redeemRealLifeReward`, `approveParentRequest`, `rejectParentRequest`, `approveAllPendingRequests`, `clearAllPendingApprovals`); `src/views/DancePartyView.js`, `src/views/WorldAdventureMapView.js`, `src/components/PetSanctuaryCanvas.js` (replace direct `+=` with `store.recordActivity(...)`); `src/views/ParentPortalView.js` (price and rate editors call `ledgerUpsertCatalog` / `ledgerUpsertRewardRules`).
* Pattern: each method computes **no amounts**. It calls `ledgerClient.op(...)` with a deterministic `activityId` (task id plus local date plus slot, for example `morning_brush:2026-11-25:am`), applies an optimistic overlay, and keeps the celebration and sound effects as today.
* Add a static guard test `scratch/verify_no_direct_balance_mutation.mjs` that greps `src/` for `\.(coins|points|tokens|xp|sparks|evolutionSparks)\s*(\+=|-=)` and `petXpMap\[.*\]\s*=` outside `walletService.js` and the legacy-mode branch, and fails if any are found.
**Tests:** every existing scratch test that asserts balances still passes in `legacy` mode; new `scratch/verify_ledger_write_paths.mjs` runs each store method in `authoritative` mode with a mocked `ledgerClient` and asserts the exact op, args and deterministic key.

### Phase 8: Cutover
**Files:** `src/services/firestoreSyncService.js` (strip currency, approval and inventory fields from `_doPush` and `buildCloudStateSnapshot`; send `clientSchemaVersion: 2`), `src/state/store.js` (`hydrateFromCloud` ignores those fields in authoritative mode; `_serializeStateForLocalStorage` strips them; remove currency names from `HERO_STAMPED_FIELDS`), `scripts/ledger/backfill.mjs --cutover`.
* Steps: deploy the client (both static hosts plus App Hosting, and wait for the PWA auto-update), run backfill `--cutover` (final opening balances are taken from the shadow wallets, **not** re-read from `heroesMap`), set `syncSchemaVersion: 2` so stragglers on old builds are rejected by the rules.
**Tests:** flip Phase 0's expected-fail repro cases to must-pass against the new path: concurrent earns on two simulated devices sum correctly; approval on P appears on K through the wallet snapshot; skewed clocks have no effect; a failed callable retries from the outbox exactly once.
**Live verification:** with two real devices, approve on the phone and see the tablet update in under 1 s; airplane-mode the tablet, approve on the phone, re-enable, and see the tablet converge within 2 s.

### Phase 9: Hardening and cleanup (optional follow-ups)
* Remove the legacy `points/coins/xp/...` fields from household docs (`scripts/ledger/strip_legacy_fields.mjs`).
* Split the remaining household doc into subcollections (settings, tasks, stories, studio items) to remove the 1 MiB ceiling (R7).
* Tighten `households/{code}` reads to members only, after the Pi reader moves to `walletSummary` through an authenticated service account.
* Screen-time bank and pet bond XP as ledger currencies (Q6).
* A monitoring alert (ntfy) when nightly reconciliation finds drift or when `ledger` callable errors exceed 1% per hour.

---

## 7. Definition of done (whole migration)

1. No client code writes a balance, XP, inventory or approval status; a static test enforces this.
2. Firestore rules deny all client writes to ledger collections, and the emulator test suite proves it.
3. Every earn, spend, approve, reject, purchase and hold is a balanced, idempotent ledger transaction, with integer amounts only.
4. Approving on one device updates every other online device's wallet in under 500 ms p95 when warm, and a device returning from offline shows the server balance within 2 s of reconnecting.
5. Re-submitting any operation (network retry, double tap, two devices) never double-awards or double-charges; proven by concurrency tests.
6. Backfilled balances match pre-migration balances exactly, with anomalies listed in the report and signed off by Dj.
7. `npm run build`, `node scratch/run_all_tests.js`, the functions unit tests, the integration tests and the rules tests all pass in CI, and both deploy workflows succeed on the merge commit.
