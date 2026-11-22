# Parent Panel Fixes: Audit and Implementation Plan

Audited against `main` @ `7f7725c` (2026-11-22). Read-only audit: no source files were changed.
Line numbers refer to that commit. If a line has moved, search for the quoted code instead.

Executor notes (for the implementing session):
- Work on branch `claude/project-thread-fh9ten`. Follow `CLAUDE.md` (build, `npm test`, deploy checks).
- Do the work items in the order of Section 3. Each item lists files, exact changes and its tests.
- Items marked **[NEEDS DECISION]** depend on an open question in Section 5. Use the default stated there unless Dj answered differently.
- Never hand-edit `public/sw.js` or bump caches (see `CLAUDE.md`).

---

## 1. System map

| Layer | File | What it does for the Parent Panel |
|---|---|---|
| View (render) | `src/views/ParentPortalView.js` `renderParentPortalView()` (L147-4305) | 11 tabs: approvals, screentime, reports, kids, tasks, rewards, pricing, studio, analytics, story, settings (`tabs` array L157-166). Full `innerHTML` render, no diffing. |
| View (listeners) | same file, `attachParentPortalListeners()` (L4307-6993) | Re-attached after every render. Module-level `let` vars hold UI-only state (L100-145). |
| Lock gate | `src/components/ParentLockModal.js` | Biometric / PIN / math gate. Reads `parentSettings.pin` (L33, L369). |
| App shell | `src/main.js` | `store.subscribe(handleStateUpdate)` (L521) → `renderApp()`; focused-input preservation (L70-104). |
| State | `src/state/store.js` (11.8k lines) | `defaultState.parentSettings` (L507-525), `liveRex` (L548-561), `loadState()` (L1180-1190), `saveState()` (L1595-1611), `updateParentSettings()` (L7928-7931), screen-time methods (L6834-6921), `setLiveRexVoice()` (L7889-7895), `hydrateFromCloud()` (L8389-9407). |
| Local persistence | `localStorage[STORAGE_KEY]` via `_serializeStateForLocalStorage()` (store L1587) | Whole state JSON, written on every `saveState()` and `navigate()`. |
| Cloud persistence | `src/services/firestoreSyncService.js` | One Firestore doc `households/{code}`. `pushStateToCloud()` (L450) → `_doPush()` (L475) does `setDoc(..., {merge:true})` with top-level `parentSettings` (L655), `liveRex` (L651) **and** a full `stateSnapshot` (L613). `onSnapshot` listener (L283) → `store.hydrateFromCloud()`. |
| Rules | `firestore.rules` | `parentSettings` map ≤ 60 keys (L239), `stateSnapshot` ≤ 150 keys (L275). |
| Cloud Functions | `functions/src/parentPortal.ts` `updateCompanionSettings` (L21-46); `functions/src/petCompanion.ts` `chatWithPet` guardrails (L108-180) | Stores companion rules in `heroes/{heroId}/settings/aiCompanion`; only `chatWithPet` reads them. |
| Rex chat paths (client) | `src/services/heroAgentService.js` `talkToRexAGY()` (L106-200), `src/services/rexAgentClient.js` `askRexAgent()` (L32), `src/services/rexCompanionEngine.js` (~L480-530), `src/services/geminiLiveService.js` | Order: `/api/rex/agent` (server.js) → AGY Cloud Run `/api/rex/chat` → `chatWithPet` Cloud Function fallback. |
| Voice | `src/services/voiceService.js` `speakCompanion()` (L1649), `getCompanionVoiceParams()` (L816), `speakWithSpeechSynthesis` (profile at L864); `server/geminiService.js` Live WS bridge (L449-453, `PET_VOICE_MAP` L35-56) | Web Speech API on all hosts; Piper on the Pi for `rex`; Gemini Live audio only where server.js runs (App Hosting, Pi). |
| Screen-time enforcement | `src/arcade/ArcadeModal.js` `open()` (L91-96); `store.recordArcadeResult()` (L6928-6936) | The only consumers of `isScreenTimeLocked()`. |

---

## 2. Root-cause breakdown

### BUG-1 Save PIN reverts to the old/default PIN (High)

The click handler and the local write are correct: `ParentPortalView.js` L4362-4376 calls
`store.updateParentSettings({ pin })` → store L7929 merges → `saveState(true)` writes localStorage and pushes.
The value is lost afterwards, through cloud sync:

1. **Last-writer-wins on the whole `parentSettings` object, twice.**
   - `hydrateFromCloud()` first copies every `stateSnapshot` key that is not in `localOnlyKeys` (store L8434-8493). `parentSettings` and `liveRex` are not in that set, so `this.state.parentSettings = cloud.stateSnapshot.parentSettings` wholesale (L8490-8492).
   - Then L9230-9236 merges `{ ...local, ...cloudData.parentSettings }`, so every cloud key wins again.
   - There are no per-field timestamps and no "pending local change" guard for `parentSettings` (compare the hero fields, which have `fieldStamps` + `resolve()` at L8564-8590).
   - Every device pushes its **entire** `parentSettings` on every save (sync L655 and inside `stateSnapshot`). A kid's tablet whose push lands after the parent's (debounced 800 ms push already queued, a Firestore offline-queued write replayed after the tablet wakes, or a push in flight) writes the old PIN back to the doc. The parent device then receives that snapshot (different `lastWriterSessionId`, sync L304) and its PIN reverts.
2. **Silent push failure, then revert on reload.** `pushStateToCloud()` returns early with no signal when the quota-exhausted flag is set (sync L451), and `_doPush()` only `console.warn`s other failures (L674): rules rejection, or the doc exceeding Firestore's 1 MiB limit (the doc stores state twice: top-level fields + `stateSnapshot`; a fresh default state alone is ~174 KB of JSON). The new PIN stays in localStorage, but on the next load the first `onSnapshot` hydrates the stale cloud copy over it (point 1), so the PIN "reverts after reload". The UI always shows "✓ PIN updated!" (L4367-4371) even when the cloud write failed.
3. **Contributing defects in the same feature**
   - Validation only checks `length >= 4` (L4365); letters/spaces are accepted. Input is `type="text"` (L3640), so the PIN is shown in clear text; the lock modal uses `type="password"`.
   - `ParentLockModal.js` L163 tells a child who types a wrong PIN: "Incorrect PIN. **Try 1234** …". That reveals the default PIN.
   - The PIN is stored and synced in plain text to every kid device (localStorage + Firestore).
   - `ParentPortalView.js` L6984-6987 sends the **whole** `parentSettings` (including `pin`) to the `updateCompanionSettings` Cloud Function, which writes it to `heroes/{name}/settings/aiCompanion` (parentPortal.ts L44).
   - Several Parent Panel handlers mutate `store.getState().parentSettings.*` directly instead of `updateParentSettings()` (L4803, L4820, L5370, L6915, L6927, L6939, L6950-6958, L6976). They work locally but bypass any future stamping.

### BUG-2 Screen time rules are non-functional (High)

Two separate UIs carry this name. Both are broken.

**A. "Screen Time Bank" tab (`activeAdminTab === 'screentime'`, L380-600)**
1. **Form never reflects saved values.** The governance form is hard-coded: `<option value="2" selected>` (L548), `<option value="60" selected>` (L563), curfew `value="20:00"` (L575), message `value="Rex says…"` (L585). After "Save Screen Time Policy" (L4677-4691) the re-render shows defaults again, so it looks like nothing saved, and the next save silently writes the defaults back over real values.
2. **Usage is never tracked.** Nothing in the codebase increments `screenTimeUsedToday` or decrements `screenTimeMinutes` while a child plays (only the parent ±15 buttons change the bank, store L6834-6856). There is no daily reset. `screenTimeUsedToday` is seeded with a fake `15` (store L239, L301, L809, L844; sync L536; hydrate L8655).
3. **Daily cap is never enforced.** `isScreenTimeLocked()` (store L6896-6916) checks pause, banked balance ≤ 0 and curfew, but never `screenTimeUsedToday >= dailyMaxScreenTime`.
4. **Conversion rate is display-only.** `screenTimeRate` ("1 point = 2 minutes", L401) is never applied when points are earned. Only analytics/AI-summary text reads it.
5. **Curfew math is wrong for curfews before 06:00.** L6912: `curTotalMin >= curfewTotalMin || curTotalMin < 360` locks all day when curfew is e.g. `00:30`.
6. **Zero handled as "unset".** `h.dailyMaxScreenTime || 60` (ParentPortalView L439; ParentAnalyticsCharts L150-151) turns a 0-minute cap into 60. `h.screenTimeRate || 2` (L440) likewise.
7. **Only the Arcade is gated.** `ArcadeModal.open()` (L91-96) and `recordArcadeResult()` are the only callers of `isScreenTimeLocked()`. Quest map games, Dance Party, Dino Workout, Battle, etc. ignore it. **[NEEDS DECISION Q3]**
8. **Sync clobbers parent edits.** Per-kid screen-time settings are merged cloud-wins (store L8655-8661: `cloudH.x !== undefined ? cloudH.x : local`). Only `screenTimeMinutes` is in `HERO_STAMPED_FIELDS` (L69). Same failure as BUG-1 for `dailyMaxScreenTime`, `bedtimeCurfew`, `screenTimeRate`, `isScreenTimePaused`, `screenTimeLockMessage`. An empty curfew `''` is turned back into `'20:00'` by `||` (L8657).
9. `parentSettings.dailyScreenTimeLimitMins` (store L518) is dead: nothing reads or writes it.

**B. "Parental Rules & Screen-Time Guardrails" card (Safety & Sliders tab, L3790-3914; listeners L6910-6992)**
1. **Not enforced on the paths Rex actually uses.** The card claims "Enforced by Rex before every chat prompt", but `bedtimeHour`, `tone`, `maxDailyTurns`, `focusAreas` and `restrictedTopics` are only read by the `chatWithPet` Cloud Function (petCompanion.ts L128-180). That function is the **third** fallback; the primary `/api/rex/agent` and AGY `/api/rex/chat` calls never receive these rules (heroAgentService L124-150, rexAgentClient L43-52).
2. **Key mismatch.** Rules are saved under `heroId = activeHero?.name || activeHero?.id` (L6982-6983); `heroAgentService` L184 reads with `heroName || id`; `rexCompanionEngine` L515 and `geminiLiveService` L744 send **no** `heroId`, so the function uses defaults. Renaming a kid orphans the rules. Rules are saved only for the currently selected kid.
3. `restrictedTopics` never reaches the client-side guard: `householdAvoidTopics()` (companionSafety.js L10-12) reads only `storyControls.avoidTopics`.
4. `updateCompanionSettings` may throw `permission-denied` when a different Firebase account first claimed the hero doc (parentPortal.ts L38-39); the client swallows it (cloudFunctionsService L143-146) and shows no feedback (the Save button gives no confirmation at all).
5. The card also leaks the PIN (BUG-1 point 3).
6. The "Rex Bedtime Hour" (19-22) and the Screen Time Bank "Bedtime Curfew" are two unrelated bedtime settings.

### BUG-3 Rex voice persona selection and playback do nothing (High)

1. **No consumer.** `setLiveRexVoice()` stores `liveRex.voiceName` (store L7893), but nothing reads it: a repo-wide search finds `voiceName` only in the portal, the store default, and the hydrate merge.
   - Web Speech (all hosts, and the only engine on GitHub Pages / `web.app`) picks voice, pitch and rate from `COMPANION_VOICE_PROFILES[petId]` (voiceService L204-244, L816-823, L864-866).
   - The Pi's Piper path always speaks `rex` with its single model (voiceService L1727-1730).
   - The bundled PCM cache is keyed by text + petId, so a cached Rex clip ignores any persona (L1720-1725).
   - The Gemini Live WS URL only sends `?pet=` (geminiLiveService L301); the server picks `PET_VOICE_MAP[pet]` (server/geminiService.js L453).
   - Gemini Live is unavailable on static hosts (`lacksLiveWebSocketBridge`, src/utils/hostUtils.js), so "Puck / Charon / Aoede…" can never sound different there.
2. **No preview.** "Test Live Rex Voice" (L3920, listener L4539-4545) only opens the Live Rex modal. No button plays the selected persona.
3. **Two duplicate pickers with different lists.** "Rex AI Companion Voice Persona" (L3354-3388: Puck, Aoede, Charon, Fenrir, **Kore**; case-insensitive match) and "Rex the Dino Voice Character" (L3743-3776: 4 voices; case-sensitive match). Both share class `rex-voice-select-btn`.
4. **Sync clobber.** `liveRex` is overwritten by `stateSnapshot` (not in `localOnlyKeys`) and cloud-wins merged (store L9218-9229). Transient fields (`isOpen`, `status`, transcripts) are synced across devices too.
5. `setLiveRexVoice()` uses a debounced `saveState()` while the auto-listen toggle (L4524-4532) calls `setLiveRexState` + `saveState()`. Both are fine locally but go through the same clobber.

### BUG-4 Other Parent Panel defects found in the sweep

| ID | Tab | File:Line | Defect | Severity |
|---|---|---|---|---|
| P-1 | Studio | L2473-2485 `.studio-delivery-radio` | No listener. Delivery method is stuck on `instant_gift`; "Hero Shop" / "Habit Bounty" can't be chosen and the bounty sub-form (L2501) never shows. | Med |
| P-2 | Studio | L2493 `#studio-target-child-select` | No listener. `studioTargetChildProfile` is always `'all'` when publishing (L6361). | Med |
| P-3 | Studio | L2505 `#studio-bounty-habit-select`, L2518 `#studio-bounty-streak-slider` | No listeners (the existing L6244 listener targets a different slider, `#studio-stash-streak-slider`). | Low (hidden by P-1) |
| P-4 | Studio | L2126 `#studio-weapon-archetype` | No listener (the archetype listener at L6038 binds `#studio-gear-archetype` only). Weapon archetype choice is ignored. | Med |
| P-5 | Studio | L1709 `#studio-voice-mic-btn`, L1720 `#studio-photo-upload`, L1728 `#studio-vision-generate-btn`, L1785 `#studio-mode-modelviewer-btn`, L2527 `#studio-test-as-child-btn` | Dead buttons/inputs: rendered, never bound (state vars `isRecordingVoice`, `studioUploadedImageBase64`, `isChildEyePreviewOpen` L110-112 are never set). | Med |
| P-6 | Header | L4316 `#admin-back-dash-btn` | Listener for an element that is never rendered (harmless dead code). | Low |
| P-7 | Tasks | L4793-4824 | Token/points inputs mutate `habitIslands`/`taskForest` and `parentSettings` in place; the habit/chore arrays are cloud-wins merged, same clobber family as BUG-1. | Low |
| P-8 | Settings | L5367-5374 | AR battle duration mutates `parentSettings` directly (fixed by WI-1 stamping + WI-2 refactor). | Low |
| P-9 | Lock gate | ParentLockModal.js L163 | Reveals default PIN "1234" to children. | High |
| P-10 | Settings | store L512-518 | `motionSensitivity` has a reader (BattleView L1405) but no UI. `voicePromptsEnabled`, `autoApproveHabits`, `dailyScreenTimeLimitMins`, `biometricCredentialId` are never read or written (biometrics use their own localStorage key, `src/utils/biometrics.js` L27/L91). Dead settings. | Low |
| P-11 | Sync | firestoreSyncService L451, L674 | Write failures and quota pause are invisible to the parent; every "saved" toast is unconditional. | High (root of BUG-1 #2) |

Tabs checked with no dead bindings found: approvals, reports, kids (add/edit/delete modals), tasks, rewards, pricing, analytics (bound via `ParentAnalyticsCharts.js`), story (`bindStoryControlsTab`), and the remaining settings cards (difficulty, AR duration, floss/mouthwash reminders, companion phrases, bedtime narrator, task reset, clear pending, photo-proof). Method: every `getElementById`/`querySelectorAll` in the listener function was matched against rendered ids/classes and vice versa, and the settings tab was walked control by control.

---

## 3. Execution spec (work items, in order)

### WI-0 Sync health signal (prerequisite for honest "Saved" feedback)
File: `src/services/firestoreSyncService.js`
1. Add fields in the constructor (near L145-149): `this.lastPushError = null; this.lastPushOkAt = 0;`
2. In `pushStateToCloud()` L451, before `return`, when `this.isQuotaExhausted()` is true set `this.lastPushError = 'quota'`.
3. In `_doPush()`: after a successful `setDoc` (after L665) set `this.lastPushError = null; this.lastPushOkAt = Date.now();`. In the `catch` (L668-675) set `this.lastPushError = isQuotaError(error) ? 'quota' : (error?.code || error?.message || 'unknown')`.
4. Add a method:
   ```js
   getSyncHealth() {
     if (!isFirebaseAvailable || !db) return { mode: 'local' };
     if (this.isQuotaExhausted() || this.lastPushError === 'quota') return { mode: 'paused' };
     if (this.lastPushError) return { mode: 'error', error: this.lastPushError };
     return { mode: 'ok', lastPushOkAt: this.lastPushOkAt };
   }
   ```
5. In `store.js` add `getSyncHealth() { return this.syncService?.getSyncHealth?.() || { mode: 'local' }; }` next to `updateParentSettings` (L7928).
6. Parent Panel helper (ParentPortalView, near other helpers at the top of the file):
   `function savedLabel() { const h = store.getSyncHealth(); return h.mode === 'ok' || h.mode === 'local' ? 'Saved' : 'Saved on this device only. Cloud sync is ' + (h.mode === 'paused' ? 'paused' : 'failing') + '.'; }`
   Use it for the PIN, screen-time and rules confirmations below.
7. Log once: in the `_doPush` catch also `console.error('[sync] push failed', error?.code, error?.message)` so a 1 MiB / rules failure is visible.

### WI-1 Per-field stamps for `parentSettings` (fixes BUG-1 #1, BUG-3 #4)
File: `src/state/store.js`. Mirror the existing hero `fieldStamps` pattern (L69, L637-664, L8579-8590).
1. Add after L69:
   ```js
   // parentSettings keys whose most recent real change wins across devices.
   // storySafetyLog is excluded (it is unioned by mergeSafetyLogs).
   export const PARENT_SETTINGS_UNSTAMPED = new Set(['storySafetyLog', 'fieldStamps']);
   ```
2. Add `fieldStamps: {}` to `defaultState.parentSettings` (L507-525). Schema:
   `parentSettings.fieldStamps: { [settingKey: string]: number /* ms epoch of last local change */ }`. One extra key keeps the map well under the 60-key rule.
3. Add two methods next to `resetHeroFieldBaseline()` (L637):
   ```js
   resetParentSettingsBaseline() {
     const ps = this.state?.parentSettings || {};
     const snap = {};
     Object.keys(ps).forEach((k) => { if (!PARENT_SETTINGS_UNSTAMPED.has(k)) snap[k] = JSON.stringify(ps[k] ?? null); });
     this._parentSettingsBaseline = snap;
   }
   stampParentSettingsChanges() {
     const ps = this.state?.parentSettings;
     if (!ps || !this._parentSettingsBaseline) { this.resetParentSettingsBaseline(); return; }
     const now = Date.now();
     const base = this._parentSettingsBaseline;
     const keys = new Set([...Object.keys(ps), ...Object.keys(base)]);
     keys.forEach((k) => {
       if (PARENT_SETTINGS_UNSTAMPED.has(k)) return;
       if (JSON.stringify(ps[k] ?? null) !== (base[k] ?? 'null')) {
         ps.fieldStamps = { ...(ps.fieldStamps || {}), [k]: now };
       }
     });
     this.resetParentSettingsBaseline();
   }
   ```
   Because the diff is against a baseline, direct mutations elsewhere (P-7, P-8) are stamped too.
4. Call `this.stampParentSettingsChanges();` in `saveState()` right after `this.stampHeroFieldChanges();` (L1598), and in `firestoreSyncService._doPush()` right after the `stampHeroFieldChanges` call (L488-490), guarded with `typeof store.stampParentSettingsChanges === 'function'`.
5. Call `this.resetParentSettingsBaseline();` in `init()` after `resetHeroFieldBaseline()` (L1634).
6. In `hydrateFromCloud()`:
   - Add `'parentSettings'` and `'liveRex'` to `localOnlyKeys` (L8434-8488) with a comment that both have dedicated merges below.
   - Hoist `let repairPushNeeded = false;` (currently L8541) above the snapshot block if needed so the new merge can set it.
   - Replace L9230-9236 with:
     ```js
     const cloudPS = cloudData.parentSettings || cloudData.stateSnapshot?.parentSettings;
     if (cloudPS && typeof cloudPS === 'object') {
       const localPS = this.state.parentSettings || {};
       const ls = localPS.fieldStamps || {};
       const cs = cloudPS.fieldStamps || {};
       const merged = { ...localPS };
       const stamps = { ...ls };
       Object.keys(cloudPS).forEach((k) => {
         if (PARENT_SETTINGS_UNSTAMPED.has(k)) return;
         const l = Number(ls[k]) || 0;
         const c = Number(cs[k]) || 0;
         if (l > c) {
           if (JSON.stringify(localPS[k] ?? null) !== JSON.stringify(cloudPS[k] ?? null)) repairPushNeeded = true;
           return; // keep local
         }
         if (c > l || (!l && !c && !(k in localPS))) { merged[k] = cloudPS[k]; stamps[k] = c; }
         // legacy (no stamps on either side, key present locally): keep local
       });
       Object.keys(ls).forEach((k) => { if (!(k in cloudPS) && (Number(ls[k]) || 0) > 0) repairPushNeeded = true; });
       merged.fieldStamps = stamps;
       merged.storyControls = normalizeStoryControls(merged.storyControls);
       merged.storySafetyLog = mergeSafetyLogs(localPS.storySafetyLog, cloudPS.storySafetyLog);
       this.state.parentSettings = merged;
       this.resetParentSettingsBaseline();
     }
     ```
     Notes: unstamped legacy cloud values never overwrite a value the device already has. This intentionally favours the local copy until the first stamped write. The existing `repairPushNeeded` push at L9401 sends the local winner back to the cloud.
7. `liveRex` merge (L9218-9229): keep it, but since `liveRex` is now in `localOnlyKeys`, only sync `autoListenInQuests` from cloud. Remove `voiceName` from this merge (it moves to `parentSettings.rexVoice` in WI-5). Do not copy `isOpen`, `status`, `statusMessage` or the transcripts from the cloud. They are per-device.
8. `loadState()` (L1180-1190): after the existing normalisation add `if (!parsed.parentSettings.fieldStamps || typeof parsed.parentSettings.fieldStamps !== 'object') parsed.parentSettings.fieldStamps = {};`.

### WI-2 Save PIN handler, validation and lock-gate leak (BUG-1 #3, P-9)
Files: `src/views/ParentPortalView.js`, `src/components/ParentLockModal.js`, `src/state/store.js`
1. Store: add
   ```js
   static PIN_PATTERN = /^\d{4,8}$/;   // or a module const if static fields aren't used in this class
   setParentPin(rawPin) {
     const pin = String(rawPin ?? '').trim();
     if (!/^\d{4,8}$/.test(pin)) return { success: false, error: 'PIN must be 4 to 8 digits (numbers only).' };
     this.updateParentSettings({ pin, pinLockEnabled: true });
     return { success: true };
   }
   ```
   **[NEEDS DECISION Q2]** If Dj picks hashing: store `pinHash` (hex SHA-256 of `householdSyncCode + ':' + pin` via `crypto.subtle.digest`) and `pinSalt` instead of `pin`, make `setParentPin` async, add `async verifyParentPin(input)`, migrate on `loadState()` (if `pin` exists and `pinHash` doesn't, hash it, delete `pin`), and render the settings field empty with placeholder "Enter new PIN". Default if unanswered: keep plain `pin` (no hashing) in this pass.
2. View L3640: change the input to `type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="new-password" maxlength="8"`. Keep `id="parent-setting-pin-input"` (main.js focus preservation needs the id). Add `<span id="pin-save-error" class="text-[9px] font-bold text-error text-center hidden"></span>` after L3649.
3. Replace the handler L4362-4376:
   ```js
   if (savePinBtn && settingPinInput) {
     const submit = () => {
       const res = store.setParentPin(settingPinInput.value);
       const err = document.getElementById('pin-save-error');
       if (!res.success) {
         Sound.hit();
         if (err) { err.textContent = res.error; err.classList.remove('hidden'); }
         return;
       }
       Sound.fanfare();
       // setParentPin re-renders, so look the feedback element up again.
       const fb = document.getElementById('pin-save-feedback');
       if (fb) { fb.textContent = '✓ PIN ' + savedLabel(); fb.classList.remove('hidden'); setTimeout(() => fb.classList.add('hidden'), 3000); }
     };
     savePinBtn.addEventListener('click', submit);
     settingPinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
   }
   ```
   (The current code holds `pinFeedback` from before the re-render, so the "✓ PIN updated!" toast is written into a detached node. That is why it often never appears.)
4. `ParentLockModal.js` L163: replace the message with `Incorrect PIN. Try again or use another verification method.` Remove every mention of `1234` in user-visible text.
5. `ParentLockModal.js` L369: compare via `store.verifyParentPin(val)` if Q2 = hash. Otherwise leave as is.

### WI-3 Route Parent Panel mutations through the store (P-7, P-8, BUG-2B)
File: `src/views/ParentPortalView.js`
- L5370 → `store.updateParentSettings({ arBattleDuration: dur });` (drop the separate `saveState`).
- L4803 / L4820 → `store.updateParentSettings({ toothbrushBattleTokens: val })` / `({ toothbrushBattlePoints: val })` (keep the habit/chore assignments + `saveState(true)`).
- L6915 / L6927 / L6939 → `store.updateParentSettings({ bedtimeHour: hour })`, `({ tone })`, `({ maxDailyTurns: turns })`.
- L6947-6964 → build a new array, do not mutate in place:
  ```js
  const cur = store.getState().parentSettings.focusAreas || ['brushing_teeth', 'cleaning_toys'];
  const next = cur.includes(area) ? cur.filter((a) => a !== area) : [...cur, area];
  store.updateParentSettings({ focusAreas: next });
  ```
- L6976 → `store.updateParentSettings({ restrictedTopics: topics });`

### WI-4 Companion rules actually enforced (BUG-2B)
1. New store helpers (store.js, near `getStoryControls` ~L11480):
   ```js
   getCompanionRules() {
     const ps = this.state.parentSettings || {};
     return {
       companionEnabled: ps.companionEnabled !== false,
       bedtimeHour: Number.isInteger(ps.bedtimeHour) ? ps.bedtimeHour : 20,
       tone: ['energetic', 'gentle', 'focused'].includes(ps.tone) ? ps.tone : 'energetic',
       maxDailyTurns: Number.isInteger(ps.maxDailyTurns) ? ps.maxDailyTurns : 30,
       focusAreas: Array.isArray(ps.focusAreas) ? ps.focusAreas : ['brushing_teeth', 'cleaning_toys'],
       restrictedTopics: Array.isArray(ps.restrictedTopics) ? ps.restrictedTopics : []
     };
   }
   // per-device, per-kid, per-day chat turn counter
   countCompanionTurn(heroId) {
     const today = new Date().toDateString();
     const map = this.state.companionTurns || (this.state.companionTurns = {});
     const cur = map[heroId];
     map[heroId] = { date: today, count: (cur && cur.date === today ? cur.count : 0) + 1 };
     this.saveState(false, true);
     return map[heroId].count;
   }
   getCompanionTurnsToday(heroId) {
     const cur = (this.state.companionTurns || {})[heroId];
     return cur && cur.date === new Date().toDateString() ? cur.count : 0;
   }
   ```
   Add `companionTurns: {}` to `defaultState`. Schema: `companionTurns: { [heroId]: { date: string /* Date#toDateString */, count: number } }`. It syncs through `stateSnapshot` (fine: it counts a household's turns).
2. `src/services/companionSafety.js`:
   - `householdAvoidTopics()` L10-12 → `cleanTopics([...(store.getStoryControls().avoidTopics || []), ...(store.getCompanionRules().restrictedTopics || [])])`.
   - Add and export:
     ```js
     export function checkCompanionRules({ heroId, petName = 'Rex', childName = 'Little Hero', now = new Date() } = {}) {
       const r = store.getCompanionRules();
       if (!r.companionEnabled) return { ok: false, reply: `*Shhh...* ${petName} is resting! Ask a grown-up to wake them up!` };
       const h = now.getHours();
       if (h >= r.bedtimeHour || h < 6) return { ok: false, reply: `*Yawn...* ${petName} is fast asleep for the night! See you in the morning, ${childName}!` };
       if (r.maxDailyTurns < 999 && heroId && store.getCompanionTurnsToday(heroId) >= r.maxDailyTurns) {
         return { ok: false, reply: `We had so much fun chatting today! Let's rest our screens and play in the real world, ${childName}!` };
       }
       return { ok: true, rules: r };
     }
     ```
3. Call it first in every child chat entry point, and count the turn only when it passes:
   - `heroAgentService.talkToRexAGY()` after `guardOutgoingMessage` (L119): `const gate = checkCompanionRules({ heroId: effectiveHeroId, petName: safetyCtx.petName, childName: heroName }); if (!gate.ok) return { reply: gate.reply, emotion: 'calm', voiceTone: 'gentle' }; store.countCompanionTurn(effectiveHeroId);`
   - `rexCompanionEngine.js` chat entry (the function containing L480-530) and `geminiLiveService.js` text-send path (around L700-745): the same pattern with the active hero id. Locate the top of each "send child message" function and insert there.
4. Pass tone/focus to the server agent: `rexAgentClient.askRexAgent()` body (L46-52) add `parentRules: { tone: r.tone, focusAreas: r.focusAreas }` from `store.getCompanionRules()`. In `server/rexAgentService.js` near L228-239 read `const rules = body.parentRules || {}`, whitelist `tone` against `['energetic','gentle','focused']` and each `focusAreas` item against `/^[a-z_]{2,32}$/` (max 6), then append to `systemInstruction`: `\nTONE: ${tone}.` and `\nPRIORITY FOCUS HABITS: ${focus.join(', ')}.`. The AGY Cloud Run service is out of scope (manual deploy, see `CLAUDE.md`).
5. Stop leaking settings to the Cloud Function. Replace L6979-6988 with:
   ```js
   const rules = store.getCompanionRules();
   const heroes = store.getState().heroes || [];
   const results = await Promise.all(heroes.map((h) => cloudFunctionsService.updateCompanionSettings({ heroId: h.id, settings: rules })));
   const anyCloud = results.some((r) => r?.status === 'success');
   // show inline confirmation (add <span id="companion-rules-feedback"> next to the Save Rules button, L3801)
   ```
   Feedback text: `anyCloud ? '✓ Rules saved' : '✓ ' + savedLabel()`.
   Change the fallbacks to send the hero **id**: `heroAgentService.js` L184 `heroId: effectiveHeroId`; add `heroId: activeHero?.id` in `rexCompanionEngine.js` L515 and `geminiLiveService.js` L744 (via `cloudFunctionsService.chatWithPet`, add a `heroId` param at cloudFunctionsService L23/L34).

### WI-5 Rex voice persona that plays (BUG-3)
1. New file `src/data/rexVoicePersonas.js`:
   ```js
   // id = Gemini Live prebuilt voice name; webSpeech = Web Speech approximation for hosts without Live.
   export const REX_VOICE_PERSONAS = [
     { id: 'Puck',   label: 'Puck',   desc: 'Playful & high energy (Default)', icon: 'sentiment_very_satisfied', webSpeech: null },
     { id: 'Aoede',  label: 'Aoede',  desc: 'Nurturing & clear teacher tone',  icon: 'school',   webSpeech: { pitch: 1.10, rate: 0.95, preferred: ['samantha', 'serena', 'aria', 'jenny', 'google us english'] } },
     { id: 'Charon', label: 'Charon', desc: 'Deep & calm dino elder',          icon: 'elderly',  webSpeech: { pitch: 0.85, rate: 0.88, preferred: ['arthur', 'guy', 'christopher', 'google uk english male', 'daniel'] } },
     { id: 'Fenrir', label: 'Fenrir', desc: 'Fast, bold & adventurous',        icon: 'speed',    webSpeech: { pitch: 1.05, rate: 1.10, preferred: ['oliver', 'liam', 'ryan', 'daniel', 'google us english'] } },
     { id: 'Kore',   label: 'Kore',   desc: 'Gentle, soft & soothing',         icon: 'spa',      webSpeech: { pitch: 1.05, rate: 0.88, preferred: ['samantha', 'siri', 'karen', 'sonia', 'google uk english female'] } }
   ];
   export const REX_VOICE_IDS = REX_VOICE_PERSONAS.map((p) => p.id);
   export function getRexVoicePersona(id) { return REX_VOICE_PERSONAS.find((p) => p.id.toLowerCase() === String(id || '').toLowerCase()) || REX_VOICE_PERSONAS[0]; }
   ```
   `webSpeech: null` means "use the existing `rex` profile unchanged".
2. Store: add `rexVoice: 'Puck'` to `defaultState.parentSettings`. Replace `setLiveRexVoice(voice)` (L7889-7895) with:
   ```js
   setRexVoicePersona(voice) {
     const p = getRexVoicePersona(voice);
     this.updateParentSettings({ rexVoice: p.id });
   }
   getRexVoicePersona() { return getRexVoicePersona(this.state.parentSettings?.rexVoice); }
   ```
   Keep `setLiveRexVoice` as a one-line alias calling `setRexVoicePersona` (other callers may exist in tests). Migration in `loadState()`: `if (!parsed.parentSettings.rexVoice && parsed.liveRex?.voiceName) parsed.parentSettings.rexVoice = parsed.liveRex.voiceName;`.
3. `voiceService.js`:
   - `getCompanionVoiceParams(petId)` (L816): after resolving the profile, if `normalizePetKey(petId) === 'rex'`, read `store.getRexVoicePersona?.()`. If `persona.webSpeech`, return `{ ...profile, pitch: persona.webSpeech.pitch, rate: persona.webSpeech.rate, preferred: persona.webSpeech.preferred }`.
   - In `speakCompanion()`: compute `const rexPersonaActive = normalizePetKey(petId) === 'rex' && !!store.getRexVoicePersona?.()?.webSpeech;`. Skip the PCM fast path (L1720-1725) and the Piper path (L1727-1730) when `rexPersonaActive`, so the chosen persona is audible.
4. Gemini Live: `geminiLiveService.js` L301 append `&voice=${encodeURIComponent(store.getRexVoicePersona?.()?.id || 'Puck')}` when the active pet is `rex`. `server/geminiService.js` L453:
   ```js
   const requestedVoice = url.searchParams.get('voice');
   const ALLOWED_LIVE_VOICES = ['Puck', 'Aoede', 'Charon', 'Fenrir', 'Kore'];
   const voiceName = (normalizedPetId === 'rex' && ALLOWED_LIVE_VOICES.includes(requestedVoice)) ? requestedVoice : (PET_VOICE_MAP[normalizedPetId] || 'Puck');
   ```
5. UI: delete the second picker (L3743-3776, "Rex the Dino Voice Character") and keep the 5-voice picker (L3354-3388), rendered from `REX_VOICE_PERSONAS`. Selection reads `settings.rexVoice`. Add a "▶ Preview" button per card (`data-rex-voice-preview="${p.id}"`, class `rex-voice-preview-btn`; use `event.stopPropagation()`). Listener:
   ```js
   document.querySelectorAll('.rex-voice-preview-btn').forEach((btn) => btn.addEventListener('click', (e) => {
     e.stopPropagation();
     const id = btn.getAttribute('data-rex-voice-preview');
     store.setRexVoicePersona(id);
     speakCompanion(`Rawr! Hi, I'm Rex! This is my ${id} voice!`, 'rex', { engine: 'web-speech' });
   }));
   ```
   The select listener (L4405-4413) calls `store.setRexVoicePersona(voice)`. Under the picker add a one-line note: on GitHub Pages / web.app the persona is an approximation using the device's built-in voices; the exact Gemini voice is heard in Live Rex on App Hosting and the Pi.
6. "Test Live Rex Voice" (L4539-4545): keep opening the modal, and also call `speakCompanion('Rex voice check! Can you hear me?', 'rex')` first.

### WI-6 Screen Time Bank works end to end (BUG-2A)
**Schema** (per hero, all synced in `heroes`/`heroesMap`):
```
screenTimeMinutes: number      // banked minutes, >= 0 (already stamped)
screenTimeUsedToday: number    // minutes consumed today, >= 0, default 0
screenTimeUsageDate: string    // Date#toDateString() of screenTimeUsedToday; NEW
dailyMaxScreenTime: number     // 0..240; 0 = no screen time today
bedtimeCurfew: string          // 'HH:MM' or '' (no curfew)
screenTimeRate: number         // minutes per point: 1|2|3|5
isScreenTimePaused: boolean
screenTimeLockMessage: string  // 1..160 chars
```
1. **Stamps**: extend `HERO_STAMPED_FIELDS` (store L69) with `'screenTimeUsedToday', 'dailyMaxScreenTime', 'bedtimeCurfew', 'screenTimeRate', 'isScreenTimePaused', 'screenTimeLockMessage', 'screenTimeUsageDate'`. In the hero merge (L8654-8661) wrap each in `resolve(field, cloudValue, legacyValue)` exactly like `screenTimeMinutes`. Use `??`, not `||`, for `bedtimeCurfew` and `screenTimeLockMessage` so `''` survives. `_doPush` already writes all stamps (sync L593).
2. **Defaults**: change every `screenTimeUsedToday` default `15` → `0` (store L239, L301, L809, L844, L8655; sync L536; ParentPortalView L438). Add `screenTimeUsageDate: ''` beside them.
3. **Daily reset** (store, new):
   ```js
   rollScreenTimeDay(h) {
     const today = new Date().toDateString();
     if (h && h.screenTimeUsageDate !== today) { h.screenTimeUsedToday = 0; h.screenTimeUsageDate = today; return true; }
     return false;
   }
   ```
   Call it for every hero in `init()` after `loadState()`, and at the top of `isScreenTimeLocked()` and `consumeScreenTime()`.
4. **Enforcement**: rewrite `isScreenTimeLocked(hero)` (L6896-6916):
   ```js
   isScreenTimeLocked(hero = null) { return this.getScreenTimeLockReason(hero) !== null; }
   getScreenTimeLockReason(hero = null) {
     const h = hero || this.state.selectedHero;
     if (!h) return null;
     this.rollScreenTimeDay(h);
     if (h.isScreenTimePaused) return 'paused';
     const cap = Number.isFinite(Number(h.dailyMaxScreenTime)) ? Number(h.dailyMaxScreenTime) : 60;
     if ((Number(h.screenTimeUsedToday) || 0) >= cap) return 'daily_cap';
     if (typeof h.screenTimeMinutes === 'number' && h.screenTimeMinutes <= 0) return 'bank_empty';
     if (h.bedtimeCurfew && /^\d{1,2}:\d{2}$/.test(h.bedtimeCurfew)) {
       const [ch, cm] = h.bedtimeCurfew.split(':').map(Number);
       const curfew = ch * 60 + cm, now = new Date(), cur = now.getHours() * 60 + now.getMinutes(), WAKE = 360;
       const locked = curfew >= WAKE ? (cur >= curfew || cur < WAKE) : (cur >= curfew && cur < WAKE);
       if (locked) return 'curfew';
     }
     return null;
   }
   ```
   `getScreenTimeLockMessage` stays. Optionally prefix a reason line in `ArcadeModal.renderCurfewLockModal` ("Daily limit reached" / "Bedtime" / "Paused by a grown-up" / "Out of screen minutes").
5. **Tracking** (store, new):
   ```js
   consumeScreenTime(heroId, minutes = 1) {
     const h = (this.state.heroes || []).find((x) => x.id === heroId);
     if (!h) return { locked: false };
     this.rollScreenTimeDay(h);
     h.screenTimeUsedToday = (Number(h.screenTimeUsedToday) || 0) + minutes;
     h.screenTimeMinutes = Math.max(0, (Number(h.screenTimeMinutes) || 0) - minutes);
     if (this.state.selectedHero?.id === h.id) Object.assign(this.state.selectedHero, { screenTimeUsedToday: h.screenTimeUsedToday, screenTimeMinutes: h.screenTimeMinutes, screenTimeUsageDate: h.screenTimeUsageDate });
     this.saveState(false, true); // persist without re-rendering the running game
     return { locked: this.isScreenTimeLocked(h) };
   }
   ```
   `ArcadeModal.js`: in `open()` after the lock check start `this.screenTimer = setInterval(() => { const r = store.consumeScreenTime(this.hero.id, 1); if (r.locked) { this.close(); this.renderCurfewLockModal(); } }, 60000);`. In `close()` do `clearInterval(this.screenTimer); this.screenTimer = null;` first. Ensure the existing navigate cleanup in `main.js` closes the arcade modal (see `scratch/verify_background_timers_cleared_on_navigate.js`). **[NEEDS DECISION Q3]** for other activities. The default is the Arcade only.
6. **Earning** **[NEEDS DECISION Q4]**. Default: no auto-credit; change the banner text at L401 to "Rate used when converting points to minutes" and leave conversion manual. If Dj picks auto-credit: in the store method that grants approved points (`approveParentRequest` and the habit award path), add `h.screenTimeMinutes += points * (h.screenTimeRate ?? 2)`.
7. **Form reflects saved values** (L538-595): compute `const policyKid = selectedScreenTimeKidId === 'all' ? heroes[0] : heroes.find((h) => h.id === selectedScreenTimeKidId);` and render `selected` / `value` from `policyKid` (`screenTimeRate ?? 2`, `dailyMaxScreenTime ?? 60`, `bedtimeCurfew ?? '20:00'`, `screenTimeLockMessage`). When `'all'` and kids differ, show the note "Kids have different settings. Saving applies these values to all kids." Add cap options `0` ("No screen time"), `15` and `240`. Add a "No curfew" checkbox `#screentime-curfew-off` that sends `bedtimeCurfew: ''`. Escape the message with `escapeHtml`.
8. **Validation** in the save listener (L4677-4691): rate ∈ {1,2,3,5}; cap integer 0..240; curfew `''` or `/^([01]\d|2[0-3]):[0-5]\d$/`; message trimmed, 1..160 chars, else fall back to the default text. Replace `alert(...)` with an inline `<span id="screentime-save-feedback">` using `savedLabel()`.
9. **Zero handling**: ParentPortalView L439-440 → `??`; guard `usagePercent` for cap 0 (`cap === 0 ? 100 : …`). ParentAnalyticsCharts L150-153 → `Number.isFinite(Number(x)) ? Number(x) : 60`.
10. Remove dead `dailyScreenTimeLimitMins` from `defaultState.parentSettings` (L518). Harmless if left in old saved states.

### WI-7 3D Studio dead controls (P-1 to P-6) **[NEEDS DECISION Q5]**
Default: bind the cheap ones, leave the AI/vision/mic ones visibly disabled.
1. In the `activeAdminTab === 'studio'` listener block (starts L5389) add:
   ```js
   document.querySelectorAll('.studio-delivery-radio').forEach((r) => r.addEventListener('change', () => { studioDeliveryMethod = r.value; Sound.click(); store.notify(); }));
   document.getElementById('studio-target-child-select')?.addEventListener('change', (e) => { studioTargetChildProfile = e.target.value; });
   document.getElementById('studio-bounty-habit-select')?.addEventListener('change', (e) => { studioBountyHabitId = e.target.value; });
   document.getElementById('studio-bounty-streak-slider')?.addEventListener('input', (e) => { studioBountyStreakDays = parseInt(e.target.value, 10) || 3; });
   document.getElementById('studio-weapon-archetype')?.addEventListener('change', (e) => { studioItemArchetype = e.target.value; refreshStudioCanvas(); });
   ```
   Verify that the publish code (L6339-6420) passes `studioBountyHabitId` / `studioBountyStreakDays` for `habit_bounty`; add `bountyHabitId` and `bountyStreakDays` to each published object if missing.
2. `#studio-voice-mic-btn`, `#studio-photo-upload` + `#studio-vision-generate-btn`, `#studio-mode-modelviewer-btn`, `#studio-test-as-child-btn`: render with `disabled` + `opacity-50 cursor-not-allowed` + `title="Coming soon"` until they are built (unless Dj asks for them to be implemented).
3. Delete the `admin-back-dash-btn` listener (L4316-4322).

### WI-8 Dead settings cleanup (P-10)
Remove `voicePromptsEnabled`, `autoApproveHabits`, `biometricCredentialId` from `defaultState.parentSettings`. Keep `motionSensitivity` (BattleView reads it). Adding a UI for it is optional and out of scope unless asked.

---

## 4. Verification checklist

### Commands (run in this order)
1. `npm ci`
2. `npm run lint` (CI's `node --check src/main.js`) and `node --check` on every edited `.js` file.
3. `npm test` (`node scratch/run_all_tests.js`). If tests fail, re-run only the failing files while fixing.
4. `npm run build`: must finish with zero errors.
5. `cd functions && npm run build` if `functions/` has a build script (only if WI-4 touched `functions/`; the default plan does not).

### New regression tests (add under `scratch/`, register each in `scratch/run_all_tests.js`)
Base two-device tests on the harness in `scratch/verify_approval_sync_across_devices.js` (two real store + sync instances and a shared fake Firestore doc).
- `scratch/verify_parent_settings_sync.js`
  1. Parent device sets PIN `4821`; kid device pushes a stale copy with PIN `1234` afterwards → both devices end with `4821`.
  2. Both devices have no `fieldStamps` (legacy doc) → the local PIN is kept and nothing is reset to `1234`.
  3. Parent sets PIN while the push fails (fake `setDoc` throws) → `getSyncHealth().mode === 'error'`. After "reload" (new store instance from the same localStorage) and a stale first snapshot, the PIN is still `4821` and a repair push is sent.
  4. `rexVoice` and `bedtimeHour` follow the same rules.
- `scratch/verify_parent_pin_validation.js`: `setParentPin` rejects `''`, `'   '`, `'123'`, `'12a4'`, `'123456789'`, `'12 34'`; accepts `'0000'`, `'12345678'`; trims `' 4821 '` → `'4821'`; `ParentLockModal` HTML contains no `1234`.
- `scratch/verify_screen_time_rules.js`
  - cap `0` → locked with reason `daily_cap` immediately, and the portal card shows `0m` (not 60).
  - used 59 of 60 → unlocked; one `consumeScreenTime` → locked; banked never goes below 0.
  - day rollover: `screenTimeUsageDate` = yesterday → `isScreenTimeLocked` resets used to 0.
  - curfew `20:00` at 19:59 unlocked, 20:00 locked, 05:59 locked, 06:00 unlocked; curfew `00:30` at 12:00 unlocked, 00:31 locked; curfew `''` never locks.
  - save form with an invalid rate (`7`) / cap (`-5`) / curfew (`25:00`) / empty message → stored values stay valid.
  - parent changes `dailyMaxScreenTime` on device A; device B pushes stale hero → A's value survives (stamps).
- `scratch/verify_rex_voice_persona.js`: `setRexVoicePersona('charon')` stores `'Charon'`; `getCompanionVoiceParams('rex')` returns the Charon pitch/rate; `'Puck'` returns the original rex profile; an unknown id falls back to `Puck`; the Live WS URL includes `voice=Charon`; legacy `liveRex.voiceName` migrates.
- `scratch/verify_companion_rules_gate.js`: bedtime 20 at 20:05 → blocked reply with no network call; `maxDailyTurns` 2 → third message blocked; restrictedTopics reach `householdAvoidTopics()`; `updateCompanionSettings` is called with no `pin` key and with hero **ids**.
- Extend the existing view-render tests (using `scratch/setup_mock_env.js`) to render the Parent Panel `screentime` and `settings` tabs and assert: governance selects show the saved kid's values; only one Rex voice picker exists; every `.rex-voice-preview-btn` has a listener.

### Manual / browser checks (on `npm run dev`, then on each deploy target per `CLAUDE.md`)
- [ ] Save PIN `4821` → reload → unlock with `4821` works and `1234` fails. Repeat with a second device signed into the same household open at the same time.
- [ ] Empty PIN, `12`, `12ab` → inline error, nothing saved, no `alert()`.
- [ ] Turn on DevTools offline, save PIN → feedback says "Saved on this device only…"; go online → value reaches the other device.
- [ ] Screen Time: set cap 0 → the Arcade shows the lock screen; set cap 15, play 15 minutes (or temporarily set the tick to 1 s) → kicked out to the lock screen; Daily Used shows 15m.
- [ ] Change rate/cap/curfew/message for one kid → re-render and reload show the saved values; the "All Kids" note appears when kids differ.
- [ ] Rex voice: pick each persona and press Preview → the voice audibly changes on Chrome desktop, iOS Safari and the Pi; on App Hosting, open Live Rex and confirm the Gemini voice matches.
- [ ] Rules: set Rex bedtime to a past hour → Rex replies "fast asleep" without a network call (check the DevTools Network tab).
- [ ] Studio: choose "Habit Bounty" → the bounty fields appear; publish to a specific kid → only that kid receives it.
- [ ] `npm run build` clean; both GitHub Actions deploy workflows green on the merge commit; App Hosting rollout verified (`CLAUDE.md` "Deploy Everywhere").

---

## 5. Open questions for Dj (defaults are used if unanswered)

- **Q1 Where should Parent Panel settings live?** Default: keep them household-synced in the Firestore household doc and fix the merge with per-field timestamps (WI-1), so a PIN saved on one device works on every device. Alternative: device-only (localStorage), which needs no cloud fix but means each tablet has its own PIN and rules.
- **Q2 Hash the PIN?** Default: no in this pass (plain PIN, but no longer shown in clear text or sent to Cloud Functions). Recommended follow-up: yes, store a salted SHA-256 so kid devices never hold the real PIN. Side effect: the settings field can't show the current PIN.
- **Q3 What counts as screen time?** Default: the Arcade only (today's behaviour, now with real tracking). Alternative: also Quest Map mini-games, Dance Party, Dino Workout and Battle.
- **Q4 Should earning points add screen minutes automatically using the rate?** Default: no, the parent grants minutes manually.
- **Q5 3D Studio dead controls:** Default: wire the radios/selects/sliders and mark the mic, photo-vision, model-viewer and "test as child" buttons "Coming soon". Alternative: build them (bigger, separate PR).
- **Q6 Rex persona scope:** Default: the persona applies to Rex only. Other companion pets keep their own voices.

---

## 6. Implementation notes (2026-11-22)

Implemented on branch `claude/project-thread-fh9ten` with the default answers to Q1-Q6. Changes from the spec above:

- **Legacy ties (WI-1).** When neither side has a stamp for a key, the cloud value wins, not the local one. Keeping the local copy would let a brand-new device push its default PIN `1234` over the household's real PIN. Regression test 2 checks that a fresh device adopts the cloud PIN.
- **Every key carries a stamp.** `stampParentSettingsChanges()` writes `0` for keys that were never changed on this device. The cloud doc is deep-merged, so without this a stale device's push left another device's newer stamp next to the stale value, and the stale value won. Regression test 1 catches this.
- **Daily chat turns** are stored on the hero (`companionTurnsToday` / `companionTurnsDate`, both stamped) instead of a new top-level state key. The store schema must stay at 76 top-level keys (`verify_firestore_rules_and_sync.mjs`).
- **Auto-Wake Rex** (`liveRex.autoListenInQuests`) had no consumer. `QuestMapView` now respects it. This was not in the plan.
- New tests share `scratch/parent_panel_device_harness.mjs` and are `.mjs` files.
