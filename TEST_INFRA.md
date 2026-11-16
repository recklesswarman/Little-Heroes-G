# Little Hero Adventures — Test Infrastructure Documentation: Parent & Developmental Analytics Dashboard

## 1. Overview & Architecture

This document details the test infrastructure, verification architecture, and testing methodology for the **Parent & Developmental Analytics Dashboard with Apache ECharts and Embedded AI Assistant** in Little Hero Adventures (`c:\APP\stitch_little_hero_adventures`).

The test suite provides opaque-box, requirement-driven verification covering the 10 core features defined in `PROJECT.md § Feature Inventory` and user requirements R1–R4 from `ORIGINAL_REQUEST.md`:
1. **Multi-Kid Analytics Selector**: Toggling between individual children (`data-analytics-kid="${hero.id}"`) and household aggregate (`data-analytics-kid="all"`).
2. **Apache ECharts Integration**: Modular tree-shaken imports or library bundling via `package.json` (`"echarts": "^6.1.0"`).
3. **Chart 1: Routine Consistency Heatmap & Trends**: Dual-axis visualizations (daily completion % bar series + running streak line series with milestone markers at 3d, 7d, 14d, 30d; 7d vs 30d timeframes).
4. **Chart 2: Screen Time vs. Responsibility Balance**: Grouped bar series (earned responsibility minutes vs. redeemed screen time) with net surplus balance line curve and daily cap `markLine`.
5. **Chart Lifecycle & Responsive Resizing**: Complete `ResizeObserver` and window resize lifecycle with safe `disposeAnalyticsCharts()` on tab unmount/view switch to prevent memory leaks and orphaned canvases.
6. **Grounded Household Data Context**: Deterministic extraction from `store.getState()` (`heroes`, `taskCompletionLogs`, `taskLedgerLogs`, `pendingApprovals`) filtered by selected child or household aggregate.
7. **Embedded AI Chat Assistant Panel**: Stacked/grid panel below charts with suggestion query chips, message thread, and query dispatch.
8. **Streaming Response UI**: Progressive DOM chunk streaming (`#chat-streaming-bubble` or `#chat-streaming-content`) without triggering full-app re-renders (`store.notify()`).
9. **Clickable Habit Deep-Links**: Parser transforming `[Title](habit:<id>)`, `[Title](log:<id>)`, and `[Title](approval:<id>)` into interactive buttons with DOM event delegation that scroll to and pulse-highlight target records.
10. **Multi-Deployment & PWA Cache Sync**: Zero-error `npm run build` production bundling and synchronized `CACHE_NAME` in `public/sw.js` and `APP_BUILD_VERSION` in `index.html`.

---

## 2. 4-Tier Test Architecture

```
+-------------------------------------------------------------------------------------------------------+
|                                        4-TIER TEST ARCHITECTURE                                       |
+-------------------------------------------------------------------------------------------------------+
|                                                                                                       |
|  [TIER 1: Feature Coverage] (Features 1 - 10 from PROJECT.md)                                         |
|  - Multi-Kid Selector (F1)                    - ECharts Modular Integration (F2)                      |
|  - Routine Consistency Chart & Milestones (F3) - Screen Time vs Responsibility & Cap (F4)              |
|  - Lifecycle & ResizeObserver (F5)            - Grounded Data Context Extraction (F6)                 |
|  - Embedded AI Chat Panel (F7)                - Streaming Response UI (F8)                            |
|  - Clickable Habit Deep-Links (F9)            - Build Readiness & PWA Cache Sync (F10)                |
|                                                                                                       |
|  [TIER 2: Boundary & Corner Cases]                                                                    |
|  - Empty / Fresh household logs (zero-division & sparse history safeguards)                           |
|  - Unknown / Deleted child ID fallback to 'all' or default hero                                       |
|  - Timeframe date boundary arithmetic (7d vs 30d calendar math across month transitions)              |
|  - Extreme currency / Screen time values (zero usage, massive surplus, cap saturation)                |
|  - Malformed AI link syntax handling (corrupted markdown links do not crash tokenizer)                |
|  - Offline / AI Error resilience (graceful degradation to local grounded synthesizer)                 |
|  - Rapid switching debouncing & observer cleanup                                                      |
|                                                                                                       |
|  [TIER 3: Cross-Feature Interactions (Pairwise Matrix)]                                               |
|  - Kid Filter ('all' vs 'hero_1') x Timeframe ('7d' vs '30d') x Metric Aggregation                    |
|  - Selected Kid Filter x Grounded AI Context Isolation                                                |
|  - AI Assistant Link Generation x Parent Portal Deep-Link Event Delegation & Highlighting            |
|  - Tab Switching x ECharts Instance Disposal & Re-initialization                                      |
|                                                                                                       |
|  [TIER 4: Realistic Real-World Scenarios]                                                             |
|  - Scenario 1: Parent reviews household overview (7d consistency + screen time bank)                  |
|  - Scenario 2: Parent toggles to child "Leo", inspects 30d streak milestones and daily cap            |
|  - Scenario 3: Parent asks AI Assistant grounded query and receives streaming tokens                  |
|  - Scenario 4: Parent clicks AI deep-link button; view scrolls to & pulses targeted log row           |
|  - Scenario 5: Full production build & PWA cache version parity validation                            |
+-------------------------------------------------------------------------------------------------------+
```

---

## 3. Test Artifacts Layout

| Artifact Path | Purpose | Execution Mode |
|---|---|---|
| `scratch/verify_parent_analytics_e2e.mjs` | Primary E2E test verification script covering Tiers 1–4 | Node.js (ESM) |
| `TEST_INFRA.md` | Architecture, specifications, and test contracts (this file) | Documentation |
| `TEST_READY.md` | Milestone completion certification and test execution instructions | Milestone Publication |
| `scratch/run_all_tests.js` | Master regression test runner executing all project suites | Node.js |

---

## 4. Interface Contracts Under Test

### 4.1 `src/components/ParentAnalyticsCharts.js`
- `renderAnalyticsChartsSection(selectedKidId: string, timeframe: string): string`
  - Generates HTML markup for multi-kid pills, 7d/30d switcher, Chart 1 container (`#chart-routine-consistency`), and Chart 2 container (`#chart-screentime-balance`).
- `initAnalyticsCharts({ selectedKidId, timeframe }): void`
  - Initializes ECharts instances on DOM elements, attaches `ResizeObserver`, and applies styled option objects.
- `disposeAnalyticsCharts(): void`
  - Cleans up active ECharts instances (`instance.dispose()`), disconnects `ResizeObserver` instances, and detaches window resize listeners.
- `aggregateMetrics(selectedKidId: string, timeframe: string): { routine: Object, screenTime: Object }`
  - Aggregates daily completion percentages, streaks, earned responsibility minutes, redeemed screen time, net balance, and daily cap.

### 4.2 `src/services/aiDataAssistantService.js`
- `buildGroundedHouseholdContext(selectedKidId: string): Object`
  - Returns grounded snapshot `{ scope, kids, metrics, recentCompletions, pendingApprovals, screenTimeBank }`.
- `streamChatWithData({ userQuery, selectedKidId, onChunk, onComplete, onError }): Promise<void>`
  - Progressive token streaming with 3-tier cascade (Firebase AI Logic -> Server /api/gemini/chat -> Local Grounded Synthesizer).
- `parseHabitDeepLinks(text: string): string`
  - Replaces `[Label](habit:<id>)`, `[Label](log:<id>)`, and `[Label](approval:<id>)` with `<button class="habit-deep-link-btn" data-deep-link="...">Label</button>`.

### 4.3 `src/views/ParentPortalView.js`
- Analytics tab renders charts and embedded chat panel (`#parent-data-chat-panel`).
- Event delegation in `attachParentPortalListeners()` handles pill clicks, timeframe toggles, chat form submissions, and habit deep-link scrolling.

### 4.4 Deployment & Cache Versioning
- `public/sw.js` `CACHE_NAME` must exactly match `index.html` `APP_BUILD_VERSION`.

---

## 5. Verification Commands

### Run the Parent Analytics E2E Test Suite Directly
```bash
node scratch/verify_parent_analytics_e2e.mjs
```

### Run Full Project Regression Suite
```bash
node scratch/run_all_tests.js
```

### Verify Production Build
```bash
npm run build
```
