# MIGRATION_PLAN.md: Authoritative Ledger and Real-Time Wallet Sync

Status: proposed (no application code changed yet)
Audience: the engineer or agent executing the phases in section 6
Scope: Gold Points, Habit Tokens, Pet Sparks, Evolution Sparks, Hero XP, Pet XP, inventory, parent approvals, Rewards Shop, 3D Studio purchases, AI Crafting
Decisions recorded from Dj (2026-11-25): parent PIN checked by the server is enough; AI Crafting is parent-only and costs no currency; a chore rejected after the kid spent its tokens may take the balance negative; prefer free options over an always-warm server (section 3.12). This plan is for review only. Implementation happens after Dj approves it.

---

## 0. TL;DR

* The app is a **Vite + vanilla-JS PWA on Firebase** (Firestore, Anonymous/Google Auth, Storage, Cloud Functions v2 in TypeScript), with an Express server (`server.js`) on Firebase App Hosting and a Raspberry Pi, and a separate Python FastAPI service on Cloud Run for the AI companion.
* **There is no server-side authority for any balance.** Every device keeps the whole family state in memory and `localStorage`, mutates balances locally (110+ call sites in `src/state/store.js`, plus direct mutations in views), and pushes the **entire household state** as one Firestore document with `setDoc(..., {merge:true})`. Other devices merge it back using per-field **last-writer-wins timestamps taken from each device's own clock**. Balances are replicated as absolute numbers, not as transactions.
* That design causes the reported bug through several independent paths (section 2): a failed or skipped push is never retried, so the approving device keeps the only copy; a device running an older build, or one whose clock is ahead, overwrites the approval and the approving device "repairs" only itself; and concurrent earns on two devices lose increments by construction. Pet XP is not timestamp-protected at all. The security rules let anyone who knows the household code (no sign-in needed) rewrite any balance, and the parent PIN sits in plain text in that same readable document.
* **Decision (ADR-001): build a native double-entry ledger inside the existing Firebase stack, at no extra cost.** Everyday operations (earn, approve, reject, buy, request a reward) run as **client-side Firestore transactions that the security rules check line by line** (amount matches the server-side price or reward table, balance after equals balance before plus the change, one entry per idempotency key, parent session required for approvals). Rare privileged operations (join household, verify parent PIN, expire holds, nightly reconciliation) run in Cloud Functions with no always-warm instance. Every device subscribes with `onSnapshot` to a per-kid `wallets/{heroId}` document that is updated in the same transaction as the ledger entry, so other devices see changes in roughly 150 to 400 ms with no cold starts and no new monthly bill. Do not adopt Blnk, Formance, LedgerForge, Nakama or game-transactions-backend: each adds a server and a Postgres-compatible database to run and pay for. The ledger engines have no browser real-time push, so Firestore would still be needed as a copy, leaving two sources of truth. Nakama does have real-time push, but it would replace Firebase Auth and sync for every device, and its wallet has no idempotency or holds. Section 3.2.1 covers both game backends in detail.
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
| Screen-time bank | `hero.screenTimeMinutes`, `screenTimeUsedToday` | `grantScreenTimeBonus` | `deductScreenTime` | stamped. **Out of scope for v1**, see open question Q2 |
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

**AI Crafting**: the "AI" generations (Studio concept art and models through Firebase AI Logic, story illustrations through Cloudflare Workers AI) **are free today and charge no currency**. No credit, hold or refund logic exists. **Decision (Dj): AI Crafting stays parent-only and never touches a balance**, so the ledger has no AI-crafting sink or AI holds. Items a parent crafts reach kids only through the normal gift, bounty or Shop paths. Gating the Studio's AI endpoints so only a parent session can call them is a separate hardening item (Phase 9).

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
* V5: Reject clawback (`rejectParentRequest`) clamps at 0, so tokens spent before a reject are never recovered. **Decision (Dj): the clawback takes the full amount, even if the balance goes negative** (section 3.5).
* V6: Inventory uses set-union merge, so a consumed or removed item reappears from another device.
* V7: `approveAllPendingRequests` approves requests from the local list. A request already rejected on another device but not yet synced here gets approved too.

---

## 3. ADR-001: Where the ledger lives

### 3.1 Context

* Requirements: an atomic, append-only double-entry ledger; integer amounts; idempotency on every mutation; holds for reward requests; real-time propagation to every device in under 500 ms; automatic re-sync on reconnect. Offline operation is **not** required.
* Constraints: a one-family hobby project with no ops team, on Firebase's Blaze plan (Functions are deployed), with a Pi at home. **No new monthly costs if a free design meets the requirements** (Dj, section 3.12). Clients are static PWAs on four hosts, including GitHub Pages, so the backend must be reachable cross-origin with Firebase Auth.
* Scale: about 1 household, under 10 kids, under 10 devices, and at most a few hundred ledger transactions per day. Contention is per kid wallet, well under 1 write per second.

### 3.2 Options considered

Repository facts were read from the GitHub search API and, for the two game backends, from cloned source on 2026-11-25.

| Option | What it gives | What it lacks for this app | Ops and cost to add |
|---|---|---|---|
| **Blnk** (`blnkfinance/blnk`, Go, Apache-2.0, about 600★, active) | Balances, inflight (hold) transactions, bulk, reconciliation, webhooks | No browser real-time API; its own auth model; built for fiat money | Cloud Run service, Cloud SQL Postgres and Redis, plus a bridge into Firestore for the UI |
| **Formance Ledger** (`formancehq/ledger`, Go, MIT, about 1.5k★, active) | Numscript for atomic multi-party postings, mature double-entry | Same as above; Numscript is a second language to maintain | Cloud Run and Postgres, plus a projection to Firestore |
| **LedgerForge** (`devaccuracy/ledgerforge`, Go, Apache-2.0, about 325★, last push Oct 2026) | Integer math, audit hash chain, spending limits, approval holds | Younger project; no client fan-out | Cloud Run, Postgres and Redis |
| **mkmbhs/ledger** (Go, MIT, 2★) | Small reference for idempotent transfers and authorize/capture/void | Reference code, not maintained as a product | Same as above. Useful only as **design reference** |
| **Nakama** (`heroiclabs/nakama`, Go, Apache-2.0, about 13.8k★, active) | Per-user wallets, a wallet history table, real-time sockets and notifications, a JS runtime for server code | Replaces Firebase Auth and sync on every device. Single-entry wallet with no idempotency and no holds (section 3.2.1) | Always-on Go server and CockroachDB or Postgres. The largest migration of all options |
| **Viid21/game-transactions-backend** (TypeScript/NestJS, MIT, 0★) | Steam real-money checkout for Unity: order, then confirm, then grant inventory exactly once | No virtual currency, no balances, no earning, no real-time (section 3.2.1) | NestJS service and Postgres |
| **Native A: Cloud Functions as the only writer** | Server-side transactions (Admin SDK), all logic in TypeScript, rules simply deny client writes | Every operation pays a callable round trip. With no warm instance, a family's sporadic traffic mostly hits **cold starts (about 1 to 3 s)**, missing the 500 ms target. Staying warm costs money (section 3.12) | No new services. About $3 to $8 a month for one warm instance, or slow cross-device updates |
| **Native B: client transactions checked by security rules, Functions only for rare privileged work** (chosen) | Firestore commits in about 100 to 300 ms and pushes to every listener; no cold start in the hot path; rules can compare a document before and after the batch (`get` / `getAfter`) and read price and reward tables, so a client cannot invent amounts | Rules are a small, strict language (no loops, at most 10 document reads per write and 20 per batch), so each operation must have a fixed shape. More careful rules tests | **No new services and no new monthly cost** at this family's volume (section 3.12) |

#### 3.2.1 Deep dive: Nakama and game-transactions-backend

Both repositories were cloned and read at their default branch on 2026-11-25. File paths below are in those repositories.

**Viid21/game-transactions-backend** (NestJS 11, Prisma "prisma-next", PostgreSQL, Vitest; Unity client folder)
* What it is: a starter for **real-money Steam microtransactions** in a Unity game. `backend/src/orders/orders.service.ts` creates an `Order` priced in cents. Steam authorizes payment in its overlay. `confirmPurchase` then grants `Inventory` inside one Postgres transaction. A unique `Fulfillment(orderId)` row is the "grant only once" guard.
* Data model (`backend/src/prisma/contract.prisma`): `Product`, `Player`, `Order`, `Transaction` (payment-provider record), `Fulfillment`, `Inventory`. There is **no wallet, no balance, no virtual currency, no earning path and no ledger**. Auth is Steam session tickets, or a fake provider, issuing its own JWTs (`src/auth/providers/`).
* Real-time: none. Clients poll REST.
* Fit for Little Heroes: **poor**. It solves "a payment processor said yes, now grant the item once". Little Heroes needs "kid earns tokens from chores and spends them in the shop, and every device sees it". About 90% of what this app needs (earn, approve, spend, holds, XP, live updates) would be new code on top of it, plus a NestJS service and a Postgres database to host.
* Worth borrowing: a **unique row as the idempotency claim**, written in the same transaction as the grant. This plan does the same: the ledger transaction's document id is the idempotency key and can only be created once (section 3.9).

**heroiclabs/nakama** (Go, pgx v5, CockroachDB or Postgres required; Go, Lua and TypeScript/JS server runtimes; official JS client `@heroiclabs/nakama-js`)
* Wallet (`server/core_wallet.go`): each user has one `wallet` JSON map of `currency → int64` on the `users` row. `updateWallets` locks rows with `SELECT … FOR UPDATE`, adds each changeset, and **rejects any result below 0** (`WalletNegativeError`). If ledger recording is on, it inserts the changeset into `wallet_ledger (id, user_id, changeset JSONB, metadata JSONB, create_time)` (`migrate/sql/20180103142001_initial_schema.sql`). Integers only, atomic, and auditable.
* What it lacks against our requirements:
  * **Not double-entry.** A ledger row is a one-sided changeset for one user, with no counter-account (no mint or sink), so totals cannot be reconciled by "everything sums to zero".
  * **No idempotency key** on wallet updates. A retried RPC adds twice unless our own runtime code stores and checks keys.
  * **No holds or reservations.** Reward requests would be custom runtime code.
  * **No negative balances**, which Dj wants for clawbacks (section 3.5), without custom workarounds.
  * **Wallet changes are not pushed automatically.** Server code must call `nk.notificationSend` or a stream after every update (`server/core_notification.go`). Real-time works only while each device holds an open WebSocket.
* Identity: wallets belong to **Nakama users**. Each kid profile would become a Nakama user. A shared tablet switching between kids, and a parent approving for a kid, would need custom auth (`AuthenticateCustom`) plus server RPCs that act for another user. That replaces Firebase Anonymous/Google sign-in and the household-code join on every device.
* Hosting: a long-running Go server (WebSockets) plus CockroachDB or Postgres. Realistic homes are a small VM or Cloud Run with min instances plus Cloud SQL, Heroic Labs' paid managed cloud, or the family Pi. The Pi would put the kids' balances on home hardware and the home network, behind Tailscale Funnel.
* Overlap with Firebase: the app would still need Firestore for everything that is not currency, so devices would keep two live connections and two auth systems.
* Fit for Little Heroes: **workable but the most expensive path.**

**Scorecard against this app's needs**

| Need | Native B (chosen) | Nakama | game-transactions-backend |
|---|---|---|---|
| Atomic balance change | Yes (Firestore transaction) | Yes (`FOR UPDATE`) | Inventory only |
| Double-entry record | Yes (both sides in every transaction document) | No (single-entry changesets) | No balances |
| Idempotency keys | Yes (transaction id = key, create-once) | Custom code | Per order only (`Fulfillment`) |
| Holds for reward requests | Yes (section 3.6) | Custom code | No |
| Negative balance after clawback | Yes (only for clawbacks) | Custom code | No balances |
| Live updates to every device | Yes, `onSnapshot` (already used) | Yes, if our code sends notifications | No |
| Keeps Firebase Auth and household-code join | Yes | No (new user model) | No (Steam or own JWT) |
| New infrastructure and monthly cost | None | Go server, database | NestJS server, Postgres |

**Conclusion:** neither game backend fits better. game-transactions-backend is a real-money checkout template, not a virtual-currency ledger. Nakama is a capable game server, but its wallet still needs the same idempotency, holds and approval code, and adopting it means swapping out sign-in and sync on every device and running a database. Revisit Nakama only if the app grows multiplayer features (live co-op, chat, matchmaking).

No open-source project was found on GitHub that implements a rules-validated Firestore ledger ready to reuse (searches on 2026-11-25 for Firestore ledger, wallet and virtual-currency repositories returned only unrelated apps). The pattern itself is documented by Firebase: "Data validation for atomic operations" with `getAfter()` (https://firebase.google.com/docs/firestore/manage-data/transactions) and the access-call limits (https://firebase.google.com/docs/firestore/security/rules-conditions).

### 3.3 Decision

Implement the double-entry ledger **natively in Firestore** as **Native B**:
* **Hot path (earn, level-up bonus, task approval, reject and clawback, reward request, reward approve and reject, shop purchase, consume, generic spend, parent price edits):** the client builds one Firestore transaction with a shared, tested ledger core (`shared/ledger/`). Security rules accept it only if every number checks out against server-held tables and the before and after state.
* **Privileged or rare path (Cloud Functions, `minInstances: 0`):** join household (membership), verify and set the parent PIN (writes a 20-minute `parent_sessions/{uid}` document), expire stale holds (scheduled), nightly reconciliation (scheduled), mirror wallet totals into the household doc for the Pi and fridge (trigger), and the backfill script (Admin SDK, run by hand).
* Clients read balances only from `wallets/{heroId}` documents through `onSnapshot`.
* Borrow the authorize/capture/void hold model from Blnk and `mkmbhs/ledger`, and the "postings sum to zero" invariant from Formance, without running either.

### 3.4 Consequences

* Positive: no new servers, databases or monthly bills; cross-device updates in about 150 to 400 ms (Firestore commit plus listener push) with no cold starts; one source of truth reachable from all four hosts; tampering is blocked by rules; every change has an audit trail.
* Negative: rules must be written and tested carefully, and every operation must have a fixed document shape the rules can check without loops. A modified client could still claim an activity it did not do, which is equally true with Cloud Functions because activities are reported by the device; daily caps (section 3.8) limit the damage.
* Escape hatch: the ledger core (section 3.9) is storage-agnostic plain JavaScript, so the same operations can be moved into a Cloud Function later (Native A) by calling the core from the server instead of the client, with the rules switched to deny client writes. Do this if the rules ever become unmanageable or if Dj later accepts the warm-instance cost.

### 3.5 Ledger model

**Units.** Every amount is a JavaScript safe integer. All six currencies are already whole numbers, so 1 unit equals 1 point, token, spark or XP. Rules check `is int` on every amount; the core rejects `NaN`, `Infinity`, fractions and values above `Number.MAX_SAFE_INTEGER`.

**Currencies** (`shared/ledger/currencies.js`): `GOLD_POINTS`, `HABIT_TOKENS`, `PET_SPARKS` (per pet), `EVOLUTION_SPARKS`, `HERO_XP`, `PET_XP` (per pet). Later, optionally: `PET_BOND_XP`, `SCREEN_MINUTES` (Q2).

**Accounts.**
* Kid accounts, one per kid and currency (per pet for pet currencies). Their balances are materialized on `wallets/{heroId}`.
* System accounts, per household: `treasury_mint` (source of everything earned), `opening_balance` (backfill), `shop_sink`, `reward_redemption_sink`, `pet_training_sink`, `spark_sink`, `clawback`, `adjustment`. System accounts are not materialized as documents. Their balances are the sum of the opposite sides of all transactions, computed by the nightly reconciliation. This keeps each client transaction within the rules' read limits.
* XP is a ledger currency so every change is auditable and idempotent. Levels are **derived** from cumulative XP and stored on the wallet only as a checked convenience.

**Negative balances (Dj's decision).** Kid balances must stay at 0 or above for every transaction type **except** `REJECT_TASK_CLAWBACK`, which subtracts the full amount originally awarded even if that takes the balance below 0. While a balance is negative, spends in that currency are refused (`available = balance - held` must cover the price) and new earnings pay the deficit down first. The UI shows a negative balance in red with "Paying back: N".

**Transaction document** (`ledger_transactions/{txnId}`, where `txnId` is the idempotency key, so it can be created once and never changed):
```
{ txnId, type, heroId, petId?,
  delta: { GOLD_POINTS: int, HABIT_TOKENS: int, HERO_XP: int, EVOLUTION_SPARKS: int, PET_XP: int, PET_SPARKS: int, HELD_GOLD_POINTS: int },
  counterAccount: 'treasury_mint' | 'shop_sink' | 'reward_redemption_sink' | 'pet_training_sink' | 'spark_sink' | 'clawback' | 'adjustment' | 'opening_balance',
  levelBefore: int, levelAfter: int, petLevelBefore?: int, petLevelAfter?: int,
  refs: { activityType?, activityId?, requestId?, itemId?, reversesTxnId? },
  actor: { uid, deviceId, role: 'device' | 'parent' | 'system' },
  walletVersionBefore: int, walletVersionAfter: int,
  createdAt: request.time }
```
The fixed `delta` map (always all keys, zeros where unused) is what lets the rules check every currency without loops. Double-entry: each nonzero kid-side delta is balanced by the opposite amount on `counterAccount`; the record therefore always sums to zero, and the nightly reconciliation proves it (sum of all kid balances plus all system balances equals 0 per currency).

**Transaction types:** `EARN_ACTIVITY` (includes any `LEVEL_UP_BONUS` in the same transaction), `APPROVE_TASK_POINTS`, `REJECT_TASK_CLAWBACK`, `REWARD_REQUEST_HOLD`, `REWARD_APPROVE_CAPTURE`, `REWARD_REJECT_VOID`, `SHOP_PURCHASE`, `PET_XP_SPEND`, `SPARK_SPEND`, `CONSUME` (inventory only, zero deltas), `GIFT_GRANT` (inventory only), `PARENT_ADJUSTMENT`, `OPENING_BALANCE`. No AI-crafting types (Dj: AI Crafting is parent-only and free).

### 3.6 Holds (reward requests only)

* Reservation model: a hold does not move points; it raises `held.GOLD_POINTS` on the wallet.
* Request (`REWARD_REQUEST_HOLD`): needs `balance - held >= cost`, where `cost` is read by the rules from `catalog/{rewardId}`. Creates `holds/{requestId}` (`status: 'authorized'`, `amount`, `expiresAt` = now + 14 days) and `approval_requests/{requestId}`.
* Approve (`REWARD_APPROVE_CAPTURE`, parent session required): balance minus cost, held minus cost, hold `captured`, request `approved`.
* Reject (`REWARD_REJECT_VOID`, parent session required) or expiry (scheduled Function `ledgerExpireHolds`, daily): held minus cost, hold `voided` or `expired`, request `rejected` or `expired`.
* The hold document id equals the request id, so a double tap or a second device cannot create two holds for one request.

### 3.7 Firestore data model

Everything new lives under `households/{CODE}/…`.

```
households/{CODE}                         (existing doc; gains server-only fields)
  ledgerMode: 'legacy' | 'shadow' | 'migrating' | 'authoritative'   // set by the backfill script only
  syncSchemaVersion: int                                            // minimum client schema allowed to push
  walletSummary: { [heroId]: { points, coins, sparks, xp, level, version } }   // written by a Function, for the Pi/fridge REST readers

households/{CODE}/members/{uid}
  { uid, role: 'parent' | 'device', deviceId, joinedAt }            // written by ledgerJoinHousehold

households/{CODE}/parent_sessions/{uid}
  { uid, expiresAt }                                                // written by ledgerVerifyParentPin (20 min)

households/{CODE}/private/parentAuth
  { pinHash, pinSalt, algo: 'scrypt', failedAttempts, lockedUntil } // Functions only

households/{CODE}/wallets/{heroId}                                   // the doc every device listens to
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

households/{CODE}/catalog/{itemId}                                   // prices; parent-editable
  { itemId, kind, title, costCoins: int, costSparks: int, costPoints: int, servingsPerPurchase?: int, active: bool }

households/{CODE}/reward_rules/{activityType}                        // earn amounts; parent-editable
  { activityType, tokens: int, xp: int, sparks: int, evolutionSparks: int, petXp: int, points: int, dailyCap: int, maxBuffPercent: int }

households/{CODE}/ledger_config/curves                               // written by the backfill script
  { heroCumXp: [int, ...],   // heroCumXp[L] = total XP needed to reach level L+1 (index 0 = 0), levels 1..100
    petMaxLevel: 25, levelUpBonusTokens: 50 }

households/{CODE}/ledger_reports/{date}                              // nightly reconciliation output
```

Indexes (`firestore.indexes.json`, referenced from `firebase.json`): `ledger_transactions` by `(heroId, createdAt desc)`; `approval_requests` by `(status, createdAt desc)`; `holds` by `(status, expiresAt)`.

### 3.8 Ledger operations

All hot-path operations are **client transactions** (`runTransaction` in `src/services/ledgerClient.js`) that read the wallet and the relevant table documents, call the shared core to compute the new state, and write: the transaction document, the wallet, and any request, hold or inventory document. "Rules check" lists what the security rules verify.

| Operation | Who | Writes | Rules check (beyond membership) |
|---|---|---|---|
| `recordActivity(heroId, activityType, activityId, petId?)` | any member device | txn (`EARN_ACTIVITY`), wallet, and if `points > 0` an `approval_requests` `task_points` | txn id = `act_{heroId}_{activityType}_{activityId}` (so a retry or a second device cannot double-award); each delta equals `reward_rules` value, or for tokens and XP lies between the base and base plus `maxBuffPercent` (pet-gear buff); `activityCounts` incremented and at most `dailyCap`; hero level and pet level match the curves; level-up bonus tokens = 50 × levels crossed; wallet version +1 |
| `approveTaskPoints(requestId)` | parent session | txn (`APPROVE_TASK_POINTS`), wallet, request status | `parent_sessions/{uid}.expiresAt > request.time`; request was `pending`; `delta.GOLD_POINTS == request.amount`; txn id = `approve_{requestId}` |
| `rejectTask(requestId)` | parent session | txn (`REJECT_TASK_CLAWBACK`), wallet, request status | parent session; request `pending`; each delta is the exact negative of the earn transaction `earnTxnId` (read with `get`); **balance may go negative**; txn id = `reject_{requestId}` |
| `requestReward(heroId, rewardId)` | any member device | txn (`REWARD_REQUEST_HOLD`), wallet `held`, hold, request | `cost == catalog.costPoints`; `balance - held >= cost` after; one hold per request id |
| `approveReward(requestId)` / `rejectReward(requestId)` | parent session | txn, wallet, hold, request | parent session; hold `authorized`; deltas equal the hold amount |
| `purchase(heroId, itemId, petId?)` | any member device | txn (`SHOP_PURCHASE`), wallet, inventory | prices read from `catalog/{itemId}`; `balance - held >= price` after; inventory `qty` (or servings) incremented by exactly the catalog amount; txn id = `buy_{heroId}_{itemId}_{clientUuid}` |
| `consume(heroId, itemId)` | any member device | txn (`CONSUME`), inventory | servings decrease by exactly 1 and stay ≥ 0 |
| `spend(heroId, currency, amount, reason, petId?)` | any member device | txn (`PET_XP_SPEND` / `SPARK_SPEND`), wallet | `reason` in a fixed list; amount ≤ available; levels recomputed |
| `upsertCatalog` / `upsertRewardRules` | parent session | catalog / reward_rules | parent session; integer fields within sane bounds (0 to 100,000) |
| `adjust(heroId, currency, amount, memo)` | parent session | txn (`PARENT_ADJUSTMENT`), wallet | parent session |
| `ledgerJoinHousehold({code, deviceId})` | Cloud Function | members | n/a (Admin SDK). Code must exist; role `parent` if the uid is in `parentUids` |
| `ledgerVerifyParentPin({code, pin})` | Cloud Function | parent_sessions | scrypt compare; 5 wrong tries lock for 15 minutes |
| `ledgerSetParentPin({code, newPin})` | Cloud Function | private/parentAuth | caller has a live parent session (or is in `parentUids`) |
| `ledgerExpireHolds` | scheduled Function (daily) | holds, wallets, requests | n/a |
| `ledgerReconcileNightly` | scheduled Function (daily) | ledger_reports | n/a |
| `mirrorWalletSummary` | Firestore trigger on `wallets/{heroId}` | household `walletSummary` | n/a |

`approveAll` is a client loop over **explicit request ids that are still pending** in the live `approval_requests` listener (fixes V7). Each approval is its own transaction.

### 3.9 Transaction algorithm (shared core)

`shared/ledger/core.js` is plain ES-module JavaScript with no Firebase imports. It is used by the client (to build each transaction), by the Functions (reconciliation, hold expiry) and by the backfill script.

```
plan(op, { wallet, tables, request?, hold?, inventory?, earnTxn?, now, actor }) ->
  { txnDoc, walletAfter, extraWrites: [{path, data}], error? }

ledgerClient.run(op, args):
  idemId = deterministicId(op, args)               // e.g. act_{hero}_{type}_{activityId}
  runTransaction(db, async (tx) => {
    if ((await tx.get(txnRef(idemId))).exists()) return ALREADY_DONE     // exactly-once
    read wallet + needed table docs (all reads before any write)
    const p = plan(op, …); if (p.error) throw p.error
    tx.set(txnRef(idemId), p.txnDoc)               // create-only by rules
    tx.update(walletRef, p.walletAfter)            // version + 1
    p.extraWrites.forEach(w => tx.set(w.path, w.data))
  })
```
A permission-denied on the create because the transaction already exists is treated as success. Keep every operation under the rules limits (10 document reads per write, 20 per transaction); the rules tests in Phase 2 assert the worst case for each operation.

### 3.10 Security rules (sketch for `firestore.rules`)

```
function db() { return /databases/$(database)/documents; }
function isMember(code) { return request.auth != null && exists(/$(db())/households/$(code)/members/$(request.auth.uid)); }
function isParentSession(code) {
  let s = get(/$(db())/households/$(code)/parent_sessions/$(request.auth.uid));
  return s != null && s.data.expiresAt > request.time;
}
function walletBefore(code, hero) { return get(/$(db())/households/$(code)/wallets/$(hero)).data; }
function walletAfter(code, hero)  { return getAfter(/$(db())/households/$(code)/wallets/$(hero)).data; }
function deltaMatches(code, t) {   // every currency: after == before + delta
  let b = walletBefore(code, t.heroId); let a = walletAfter(code, t.heroId);
  return a.version == b.version + 1 && a.lastTxnId == t.txnId
    && a.balances.GOLD_POINTS == b.balances.GOLD_POINTS + t.delta.GOLD_POINTS
    && a.balances.HABIT_TOKENS == b.balances.HABIT_TOKENS + t.delta.HABIT_TOKENS
    && a.balances.HERO_XP == b.balances.HERO_XP + t.delta.HERO_XP
    && a.balances.EVOLUTION_SPARKS == b.balances.EVOLUTION_SPARKS + t.delta.EVOLUTION_SPARKS
    && a.held.GOLD_POINTS == b.held.GOLD_POINTS + t.delta.HELD_GOLD_POINTS;
    // pet currencies checked the same way on a.pets[t.petId] when t.petId != null
}

match /households/{code} {
  // existing get/create rules stay (the Pi REST reader depends on get-by-code)
  allow update: if <existing conditions>
    && !request.resource.data.diff(resource.data).affectedKeys()
         .hasAny(['ledgerMode', 'syncSchemaVersion', 'walletSummary'])
    && (resource.data.get('ledgerMode', 'legacy') != 'authoritative' || (
          request.resource.data.get('clientSchemaVersion', 0) >= resource.data.get('syncSchemaVersion', 0)
          && !request.resource.data.diff(resource.data).affectedKeys()
               .hasAny(['pendingApprovals', 'resolvedApprovals', 'inventory', 'heroesMap', 'heroes'])  // see Phase 8 note
       ));

  match /ledger_transactions/{txnId} {
    allow read: if isMember(code);
    allow create: if isMember(code)
      && request.resource.data.txnId == txnId
      && request.resource.data.createdAt == request.time
      && request.resource.data.actor.uid == request.auth.uid
      && deltaMatches(code, request.resource.data)
      && typeIsValid(code, request.resource.data);     // per-type checks from section 3.8
    allow update, delete: if false;                    // append-only, and create-once = idempotency
  }
  match /wallets/{heroId} {
    allow read: if isMember(code);
    // a wallet may only change together with a new transaction that explains it
    allow update: if isMember(code)
      && request.resource.data.lastTxnId != resource.data.lastTxnId
      && !exists(/$(db())/households/$(code)/ledger_transactions/$(request.resource.data.lastTxnId))
      && existsAfter(/$(db())/households/$(code)/ledger_transactions/$(request.resource.data.lastTxnId));
    allow create, delete: if false;                    // created by the backfill (Admin SDK)
  }
  match /approval_requests/{id} { allow read: if isMember(code); allow create, update: if <matching txn existsAfter and fields consistent>; allow delete: if false; }
  match /holds/{id}             { allow read: if isMember(code); allow create, update: if <matching txn existsAfter>; allow delete: if false; }
  match /inventory/{id}         { allow read: if isMember(code); allow create, update: if <matching txn existsAfter>; allow delete: if false; }
  match /catalog/{id}           { allow read: if isMember(code); allow write: if isMember(code) && isParentSession(code) && <int bounds>; }
  match /reward_rules/{id}      { allow read: if isMember(code); allow write: if isMember(code) && isParentSession(code) && <int bounds>; }
  match /ledger_config/{id}     { allow read: if isMember(code); allow write: if false; }
  match /members/{uid}          { allow get: if request.auth != null && request.auth.uid == uid; allow list: if isMember(code); allow write: if false; }
  match /parent_sessions/{uid}  { allow get: if request.auth != null && request.auth.uid == uid; allow write: if false; }
  match /private/{id}           { allow read, write: if false; }
  match /ledger_reports/{id}    { allow read: if isMember(code); allow write: if false; }
  match /{other=**}             { allow read, write: if false; }
}
```
Notes:
* The explicit sub-matches must replace the existing `match /{allChildren=**}` deny under households.
* `typeIsValid` is a set of per-type functions (one per row of section 3.8). Rules functions allow at most 10 `let` bindings and a call depth of 10, so split them into small helpers.
* Rules read the reward table, catalog and curves with `get()`; repeated `get`s of the same document within one request are cached and count once.
* Admin SDK writes (Functions, backfill) bypass rules.

### 3.11 Migration and backfill strategy

* `ledgerMode` per household: `legacy` (today), then `shadow` (clients still mutate locally **and** write the ledger; the ledger is not yet shown; a nightly report compares them), then `authoritative` (the UI reads wallets; local mutation code removed; old clients blocked by `syncSchemaVersion`).
* Backfill script `scripts/ledger/backfill.mjs` (Admin SDK, run by a person from a laptop or Cloud Shell):
  1. `--household CODE [--dry-run] [--freeze] [--cutover]`. `--freeze` first sets `ledgerMode: 'migrating'` (clients show "Updating your treasure chest…" and disable earn and spend buttons), then re-reads the household doc.
  2. For each hero, take values from `heroesMap[heroId]` (fallback `heroes[]`). For Habit Tokens use the larger of `coins` and `tokens` and **log the disagreement**.
  3. Convert XP to cumulative. Hero: `cum = Σ_{k=1}^{level-1} t_k + xp`, with `t_1 = 100` and `t_{k+1} = round(t_k × 1.35)` (same as `addXP`); if `xpNext` differs from `t_level`, log an anomaly and keep `level`. Pet: `cum = 50 × L × (L − 1) + xp` (from `needed = level × 100`, cap 25), using `hero.petXpMap/petLevelMap`, falling back to the household-level maps only for pets with no hero copy. Write `ledger_config/curves` with the same hero curve.
  4. Pet Sparks per pet from `petSparkMap[petId]`; if the map lacks the active pet, use `hero.sparks`.
  5. Create each `wallets/{heroId}` and one `OPENING_BALANCE` transaction (txn id `backfill_v1_{heroId}`, so re-running is a no-op).
  6. Inventory: one document per id in `hero.inventory` and per entry in `hero.consumables`.
  7. Pending approvals: convert each `pendingApprovals` entry not in `resolvedApprovals` into `approval_requests`. For reward requests, create a hold; if funds are short, mark the request `needs_parent_review` and list it in the report.
  8. Seed `catalog` from `DIGITAL_REWARDS_CATALOG`, `THREE_D_ASSETS`, `state.digitalGear` prices and parent custom items, and `reward_rules` from today's hard-coded amounts (habit and task `coins/points/xp`, battle, expedition, map +25/+20, dance +5/+25/+30). Default `dailyCap` 20 per activity type and `maxBuffPercent` 50.
  9. Write `walletSummary`, then set `ledgerMode: 'shadow'` (or `'authoritative'` with `--cutover`).
  10. Write `scripts/ledger/reports/{CODE}-{timestamp}.json` with before values, after wallets and every anomaly. `--dry-run` writes nothing and prints the report.
  11. Migrate the PIN: hash `parentSettings.pin` into `private/parentAuth`, then delete `parentSettings.pin` from the household doc.
* Rollback: `scripts/ledger/rollback.mjs --household CODE` sets `ledgerMode: 'legacy'` and copies wallet balances back into `heroesMap` with fresh stamps. Ledger collections are kept for audit.

### 3.12 Cost and billing (Dj's question 3)

**Where it would be billed.** Cloud Functions (2nd gen) run on Cloud Run. Their charges go to the Google Cloud billing account linked to the Firebase project `little-heroes-quest-8842` (the Blaze plan). They appear under "Cloud Run" in Google Cloud console, Billing, Reports, and in the Firebase console under Usage and billing. Firestore charges go to the same account.

**What an always-warm function would cost** (the option this plan no longer needs). Cloud Run request-based pricing, Tier 1 region (`us-central1`), idle minimum instance: $0.0000025 per vCPU-second and $0.0000025 per GiB-second (https://cloud.google.com/run/pricing, read 2026-11-25). A 30-day month is 2,592,000 seconds:

| Size of the warm instance | Monthly idle cost |
|---|---|
| 1 vCPU, 256 MiB | 2,592,000 × (1 × 0.0000025 + 0.25 × 0.0000025) ≈ **$8.10** |
| 0.167 vCPU (Firebase "gen 1" sizing), 256 MiB | 2,592,000 × (0.167 × 0.0000025 + 0.25 × 0.0000025) ≈ **$2.70** |

Cloud Run's monthly free allowance (180,000 vCPU-seconds, 360,000 GiB-seconds, 2 million requests) is far smaller than a month of a warm instance (2.6 million seconds), and I could not confirm from Google's pages whether idle minimum-instance time counts against it, so plan on paying roughly **$3 to $8 a month** for that option.

**Free options found, and the choice:**

| Option | Cost | Cross-device speed | Verdict |
|---|---|---|---|
| **Client transactions checked by rules (Native B)** | $0 at this volume | About 150 to 400 ms, no cold starts | **Chosen** |
| Functions with no warm instance (Native A, `minInstances: 0`) | $0 (inside free allowance) | About 300 ms when warm, 1 to 3 s+ after idle, which is most of the time for one family | Kept only for rare, non-urgent work (PIN, join, nightly jobs) |
| Keep-warm ping from Cloud Scheduler every few minutes | About $0 (Scheduler includes a few free jobs per billing account) | Usually warm, but Cloud Run may still start a fresh instance; not guaranteed | Not recommended |
| Run the ledger on the family Pi (`server.js` with the Admin SDK) | $0 | Fast on the home network | Not recommended: the only copy of the balances would depend on home power, network and Tailscale Funnel |

**Firestore usage at this volume (Native B).** Firestore's free daily allowance is 50,000 document reads, 20,000 writes and 20,000 deletes. One ledger operation is about 3 to 4 writes, about 5 rule reads (each `get` in rules is billed as a read), plus 1 listener read per open device. At 300 operations a day with 6 devices that is roughly 1,200 writes and 3,300 reads a day, well inside the free allowance. Moving balances out of the single household document also cuts today's large full-document writes (R7).

---

## 4. Real-time sync and reconnect design

### 4.1 Subscriptions

* New `src/services/walletService.js`:
  * `start(code)`: `onSnapshot(collection(db, 'households', code, 'wallets'), {includeMetadataChanges: true}, …)` plus `onSnapshot(query(approval_requests, where('status','==','pending')))`.
  * Keeps `walletsById` in memory. A snapshot replaces a wallet only if `incoming.version >= current.version`.
  * Exposes `getWallet(heroId)`, `subscribe(fn)`, and `status: 'connecting'|'live'|'reconnecting'|'stale'`. `snapshot.metadata.fromCache === true` means `stale`.
* `store.js` getters (`getPetXp`, `getPetLevel`, `getPetSparks`, the hero header, Shop affordability) read from `walletService`, **never** from `hero.points/coins/xp` once `ledgerMode === 'authoritative'`.
* Firestore cache: keep the default memory cache for these listeners (no `persistentLocalCache`) so an old offline balance is never shown as live. Show "…" until the first `fromCache === false` snapshot.

### 4.2 Latency budget (target p95 under 500 ms)

| Step | Typical |
|---|---|
| Client transaction: read wallet and tables, commit (rules evaluated server-side) | 100 to 300 ms |
| Commit to `onSnapshot` delivery on other devices | 50 to 200 ms |
| **Total** | about 150 to 450 ms, with no cold start in the path |

Transaction contention (two devices writing the same kid's wallet at the same moment) makes Firestore retry one of them automatically, adding one round trip. Phase 7 measures real p95 with `scripts/ledger/latency_probe.mjs` (two Playwright browsers against a test household).

### 4.3 Optimistic UI

* `walletService.applyOptimistic(heroId, deltas, txnId)` adds a pending overlay. Displayed balance = server wallet plus pending overlays.
* When the transaction commits, the listener delivers the new wallet and the overlay is dropped. On error, drop the overlay and show the reason ("Not enough Habit Tokens").
* Overlays never write to `localStorage` or to `hero.*` fields.

### 4.4 Reconnect and returning devices

* Firestore listeners resume automatically and deliver the latest server state; the wallet version check makes that the truth.
* An outbox in `sessionStorage` (`ledger_outbox_v1`) holds `{op, args, txnId, firstAttemptAt}` for every operation not yet committed. On `online`, on `visibilitychange` to visible, and whenever `walletService` turns `live`, it retries in order. The deterministic `txnId` makes retries exactly-once. Entries older than 24 h are dropped and shown as "That action didn't reach the server."
* While offline, or not `live` for more than 2 s, disable earn and spend buttons and show a small "Reconnecting…" pill (offline mode is out of scope).
* On reconnect, call `getDocsFromServer(wallets)` once to force a fresh read.
* In authoritative mode `_serializeStateForLocalStorage` strips currency fields so nothing stale can resurface.

### 4.5 What stays on the legacy household-doc sync

Non-currency state (settings, task definitions, story library, meal plan, Studio item definitions, pets' cosmetic state) keeps the current `firestoreSyncService` path for now. In authoritative mode:
* `_doPush` and `buildCloudStateSnapshot` exclude `points, coins, tokens, xp, level, xpNext, sparks, evolutionSparks, petSparkMap, petXpMap, petLevelMap, inventory, consumables, pendingApprovals, resolvedApprovals`, and add `clientSchemaVersion: 2`.
* `hydrateFromCloud` ignores those fields.
* Phase 9 (optional) splits the remaining household doc into per-domain subcollections to remove the 1 MiB and write-size risk (R7).

---

## 5. Decisions and remaining open questions

**Decided by Dj (2026-11-25):**

| Topic | Decision | Where it shows up |
|---|---|---|
| Parent authentication | A PIN checked by the server is enough. No Google sign-in required for parents | `ledgerVerifyParentPin`, `parent_sessions` (sections 3.7, 3.8) |
| Warm server cost | Prefer free. The chosen design needs no warm instance | Section 3.12 |
| AI Crafting | Parents only, no currency cost | Section 1.3; no AI ledger types |
| Clawback after spending | Take the full amount; balance may go negative | Section 3.5 |

**Still open (defaults apply if unanswered):**

| # | Question | Default |
|---|---|---|
| Q1 | Are there households besides yours (friends or family on the same deployment) that the backfill must cover? | Only your household, plus a generic script for others |
| Q2 | Should the Screen-Time bank and pet bond XP move to the ledger in v1? | No, v2 |
| Q3 | To confirm which root cause fires most, may Phase 0 log push failures to the Pi's Umami or ntfy (error codes only, no kid names)? | Yes, error codes only |
| Q4 | Default daily cap per activity type (limits a tampered client) | 20 per kid per activity type per day, editable by parents |

---

## 6. Phased execution checklist

General rules for every phase:
* Follow `CLAUDE.md`: run `npm run build` and `node scratch/run_all_tests.js` before pushing; register every new `scratch/verify_*.mjs` in `scratch/run_all_tests.js`; one PR per phase into `main`; confirm both deploy workflows after merge.
* `functions/` changes must pass `npm --prefix functions run lint` and `npm --prefix functions run build`.
* No floats: a test fails on `parseFloat`, `toFixed` or division inside `shared/ledger/` except in the documented curve helper (which uses `Math.round`).
* Nothing defaults `ledgerMode` to anything other than `legacy` until Phase 8.

### Phase 0: Instrument and reproduce (no behaviour change)
**Files:** `src/services/firestoreSyncService.js`, `scratch/verify_ledger_bug_repro.mjs` (new), `scratch/run_all_tests.js`
1. In `_doPush`, move `await ensureAuthReady()` inside `try`. On any failure, record `{code, at}` in a ring buffer `this.pushFailures` (last 20) and **schedule a retry** with backoff (2 s, 4 s, 8 s, up to 60 s) while `lastPushError` is set. When a quota cooldown ends, schedule one push.
2. Show the last error code in the Parent Portal sync card (`getSyncHealth()` already exists).
3. Repro test: two store instances (separate mock `localStorage`) sharing an in-memory "cloud doc" with `merge:true` semantics, asserting today's failures: (a) R4 lost update on concurrent `coins +=`; (b) R5 pet XP overwrite; (c) R3 skewed clock beats a later approval; (d) R1 a failed push leaves P alone with the approval. Mark them `EXPECTED_LEGACY_FAILURE` so the suite stays green; Phase 8 turns them into must-pass tests on the new path.
**Acceptance:** build passes; the repro test documents all four behaviours; a push failure now retries (fake `setDoc` that fails twice then succeeds).

### Phase 1: Shared ledger core
**Files (new):** `shared/ledger/currencies.js`, `shared/ledger/curves.js`, `shared/ledger/core.js`, `shared/ledger/ids.js`, `scratch/verify_ledger_core.mjs`.
* `core.js` exports `plan(op, inputs)` for every operation in section 3.8, operating on plain objects (no Firebase imports).
* `curves.js`: `heroCumXpTable(maxLevel)`, `heroLevelFromCum(cum, table)`, `petLevelFromCum(cum)`, `heroCumFrom(level, xpIntoLevel)`, `petCumFrom(level, xp)`; must match `addXP` and `addPetTrainingXp` exactly.
* `ids.js`: deterministic transaction ids (`act_…`, `approve_…`, `reject_…`, `buy_…`, `backfill_v1_…`), safe for Firestore document ids.
**Tests (must pass):** every plan balances (kid deltas mirrored on the counter account); integers only; non-negative except `REJECT_TASK_CLAWBACK`; clawback takes the full amount and can produce a negative balance; spends are refused while available < price (including when negative); earnings after a clawback pay the deficit; holds (authorize, capture, void, expire; captured cannot be voided); level-up crossing 3 levels gives exactly 150 tokens; curve round-trip for hero levels 1 to 60 and pet levels 1 to 25; 1,000 random operation sequences keep "kid totals + system totals = 0" per currency.

### Phase 2: Security rules for the ledger
**Files:** `firestore.rules`, `firestore.indexes.json` (new), `firebase.json` (indexes and an `emulators` block for firestore, auth and functions), `scratch/verify_ledger_rules.mjs` (new, uses `@firebase/rules-unit-testing` against the Firestore emulator), `package.json` devDependency `@firebase/rules-unit-testing`, `.github/workflows/ci.yml` (new job: `actions/setup-java@v4`, then `npx firebase-tools emulators:exec --only firestore "node scratch/verify_ledger_rules.mjs"`).
**Tests (must pass), using transactions built by `shared/ledger/core.js`:**
* For every operation: a correct transaction is allowed; changing any single number (delta, price, level, bonus, version) is denied.
* A second create with the same transaction id is denied (idempotency); a wallet update without a new transaction is denied.
* Approve and reject without a live parent session are denied; with an expired session, denied.
* Earn above `dailyCap` is denied; a token amount above base plus `maxBuffPercent` is denied.
* Reward request beyond `balance - held` is denied; clawback to a negative balance is allowed; any other negative balance is denied.
* Clients cannot write `ledgerMode`, `syncSchemaVersion`, `walletSummary`, `members`, `parent_sessions`, `private`, `ledger_config`.
* Worst-case document-access count per operation stays within 10 per write and 20 per transaction (assert by running each operation's largest form).
* Existing legacy flows still pass (`scratch/verify_firestore_rules_and_sync.mjs`).

### Phase 3: Membership and parent PIN (Cloud Functions)
**Files:** `functions/src/ledger/auth.ts` (new: `ledgerJoinHousehold`, `ledgerVerifyParentPin`, `ledgerSetParentPin`), `functions/src/index.ts`, `src/services/ledgerClient.js` (callable wrappers), `src/services/firestoreSyncService.js` (call `ledgerJoinHousehold` in `joinHousehold` and on startup if not yet a member), `src/components/ParentLockModal.js` and `store.unlockParentSession` (verify the PIN through the Function; the old client check remains only in `legacy` mode).
* All Functions use `minInstances: 0`. A parent waits for one cold start (about 1 to 3 s) when unlocking, at most once per 20-minute session. Approvals themselves are client transactions and fast.
**Tests:** emulator: a non-member cannot read wallets; a member can; 5 wrong PINs lock for 15 minutes; a session expires after 20 minutes; `scratch/verify_parent_pin_server_session.mjs` checks the client wrapper with a mocked callable.

### Phase 4: Client ledger writer
**Files (new):** `src/services/ledgerClient.js` (`run(op, args)` per section 3.9, outbox per section 4.4), `scratch/verify_ledger_client_emulator.mjs`.
**Tests (emulator):** 20 parallel `recordActivity` calls with the same activity id produce exactly one transaction; 20 parallel purchases with funds for 3 produce exactly 3; reward request, then approve, captures and lowers `held`; reward request, then reject, voids; reject after the kid spent the tokens leaves a negative balance equal to the shortfall; a dropped network during commit is retried from the outbox exactly once.

### Phase 5: Backfill, shadow mode and nightly checks
**Files (new):** `scripts/ledger/backfill.mjs`, `scripts/ledger/rollback.mjs`, `scripts/ledger/README.md`, `functions/src/ledger/reconcileNightly.ts`, `functions/src/ledger/expireHolds.ts`, `functions/src/ledger/mirrorWalletSummary.ts`, fixtures in `scratch/fixtures/ledger/`.
* Shadow mode: wire the 6 highest-volume paths (`completeHabit`, `completeTask`, `approveParentRequest`, `rejectParentRequest`, `redeemRealLifeReward`, `buyDigitalGear`) to also call `ledgerClient.run` with the same ids they will use after cutover.
**Tests:** backfill on fixture households (one kid; three kids; `coins` and `tokens` disagreeing; a pet at level cap; a reward request exceeding the balance) gives exact expected wallets; re-running is a no-op; rollback restores `heroesMap` values; XP conversion round-trips; the nightly report flags an injected drift.
**Real household order:** `--dry-run`, Dj reviews the report, `--freeze`, then shadow for 3 or more days with no unexplained drift.

### Phase 6: Client wallet read path
**Files:** `src/services/walletService.js` (new), `src/state/store.js` (getters: `getPetXp`, `getPetLevel`, `getPetSparks`, `getActivePetSparks`, header and Shop balances), `src/components/TopHeader.js`, `src/views/ShopView.js`, `src/views/DashboardView.js`, `src/views/PetDetailView.js`, `src/views/ParentPortalView.js` (approval queue from `approval_requests`), `shared/fridgeSnapshot.js` (prefer `walletSummary`).
* Every read goes through `balanceOf(heroId, currency, petId?)`: the wallet value in `authoritative` mode, the legacy hero field otherwise. Negative balances render in red.
**Tests:** `scratch/verify_wallet_service.mjs`: older snapshots ignored; optimistic overlay add and clear; `fromCache` marks the status stale; "…" before the first server snapshot; fridge snapshot prefers `walletSummary`; negative balance renders.

### Phase 7: Client write path (all mutation sites)
**Files:** `src/state/store.js` (`completeHabit`, `completeTask`, `claimCompanionHabit`, `submitChoreWithPhoto`, `completeToothbrushBattle`, `claimExpeditionRewards`, `completeAiQuest`, `addXP`, `addCoins`, `addPetTrainingXp`, `addPetCareXp`, `deductPetTrainingXp`, `addPetSparks`, `deductPetSparks`, `addEvolutionSparks`, `recordWorkoutCompletion`, `syncHabitPetCare`, `completeAdventureGame`, `completeMovementRoutine`, `completePetBathReward`, `awardTaskCareSynergy`, `unlockParentWorldChest`, `completeWaypointChore`, `completeBedtimeStory` if it awards, `buyPet`, `buyProfileTheme`, `buyHabitatSlot`, `buyAndEquipGear`, `buyDigitalGear`, `buyTreatPack`, `feedPetConsumableSnack`, `feedPetTreat`, `unlockHQFurniture`, `grantStudioItemToHero`, `checkAndAwardHabitBounties`, `redeemRealLifeReward`, `approveParentRequest`, `rejectParentRequest`, `approveAllPendingRequests`, `clearAllPendingApprovals`); `src/views/DancePartyView.js`, `src/views/WorldAdventureMapView.js`, `src/components/PetSanctuaryCanvas.js` (replace direct `+=` with `store.recordActivity(...)`); `src/views/ParentPortalView.js` (price and rate editors write `catalog` / `reward_rules`).
* Pattern: methods compute **no amounts**. They call `ledgerClient.run(...)` with a deterministic activity id (for example `morning_brush:2026-11-25:am`), apply an optimistic overlay, and keep the celebration and sound effects.
* Static guard `scratch/verify_no_direct_balance_mutation.mjs` fails on `\.(coins|points|tokens|xp|sparks|evolutionSparks)\s*(\+=|-=)` or `petXpMap\[.*\]\s*=` in `src/` outside `walletService.js` and legacy-mode branches.
* Latency probe `scripts/ledger/latency_probe.mjs`: two Playwright browsers against a test household; approve in one, measure until the other's wallet updates. Target p95 under 500 ms.
**Tests:** existing scratch tests that assert balances still pass in `legacy` mode; `scratch/verify_ledger_write_paths.mjs` runs each store method in `authoritative` mode with a mocked `ledgerClient` and asserts the exact op, args and id.

### Phase 8: Cutover
**Files:** `src/services/firestoreSyncService.js` (strip currency, approval and inventory fields from `_doPush` and `buildCloudStateSnapshot`; send `clientSchemaVersion: 2`), `src/state/store.js` (`hydrateFromCloud` ignores those fields in authoritative mode; `_serializeStateForLocalStorage` strips them; remove currency names from `HERO_STAMPED_FIELDS`), `firestore.rules` (in authoritative mode, deny client pushes that change currency fields inside `heroesMap` / `heroes`; since rules cannot loop over heroes, the simplest enforceable rule is that schema-2 clients no longer send those fields and the backfill deletes them, see Phase 9), `scripts/ledger/backfill.mjs --cutover`.
* Steps: deploy the client to all hosts and wait for the PWA auto-update; run backfill `--cutover` (final balances come from the shadow wallets, not re-read from `heroesMap`); set `syncSchemaVersion: 2` so stale builds are rejected.
**Tests:** Phase 0's repro cases now pass on the new path: concurrent earns on two simulated devices add up; an approval on P appears on K through the wallet listener; skewed clocks have no effect; a failed write retries from the outbox exactly once.
**Live check:** with two real devices, approve on the phone and see the tablet update in under 1 s; put the tablet in airplane mode, approve on the phone, reconnect, and see the tablet converge within 2 s.

### Phase 9: Hardening and cleanup (optional follow-ups)
* Remove legacy currency fields from household docs (`scripts/ledger/strip_legacy_fields.mjs`).
* Split the remaining household doc into subcollections (settings, tasks, stories, studio items) to remove the 1 MiB ceiling (R7).
* Tighten `households/{code}` reads to members only once the Pi reader uses `walletSummary` through an authenticated path.
* Require a parent session for the Studio's AI generation endpoints (`/api/ai/image`, Firebase AI Logic calls from the Studio), since AI Crafting is parent-only.
* Screen-time bank and pet bond XP as ledger currencies (Q2).
* Alert through ntfy when the nightly reconciliation finds drift.

---

## 7. Definition of done (whole migration)

1. No client code changes a balance, XP, inventory item or approval status except through `ledgerClient`; a static test enforces this.
2. Security rules accept a ledger write only when every number matches the tables and the before and after state; the emulator suite proves each rejection case.
3. Every earn, spend, approval, rejection, purchase and hold is a balanced, idempotent ledger transaction with integer amounts.
4. Approving on one device updates every other online device's wallet in under 500 ms p95, and a device returning from offline shows the server balance within 2 s of reconnecting.
5. Retrying any operation (network retry, double tap, two devices) never double-awards or double-charges; concurrency tests prove it.
6. Backfilled balances match pre-migration balances exactly, with anomalies listed in the report and signed off by Dj.
7. No new always-on server and no warm instance; monthly Firebase usage stays inside the free allowance at the family's volume.
8. `npm run build`, `node scratch/run_all_tests.js`, the rules tests and the Functions build pass in CI, and both deploy workflows succeed on the merge commit.
