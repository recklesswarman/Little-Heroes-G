// Shared "does this device already have an active, configured household"
// heuristic. Previously store.js (loadState) and main.js (renderApp) each
// kept their own independently-maintained copy of this check, and they had
// drifted -- main.js's copy was missing the hasCustomProgress/hasCustomName
// signals store.js's copy had, which could disagree on whether a device
// should see the dashboard or the Landing Auth Wall.
export function isExistingActiveHousehold(state) {
  const currentCode = (state.household?.syncCode || '').trim().toUpperCase();
  const hasActiveSyncCode = Boolean(currentCode && currentCode.length >= 4);

  const hasParent = Boolean(
    state.household?.parentUser?.uid ||
    state.household?.parentUser?.email ||
    (state.household?.parents && state.household.parents.length > 0) ||
    (state.household?.parentEmails && state.household.parentEmails.length > 0)
  );

  const wasExplicitlyConfigured = state.isHouseholdConfigured === true;

  // Note: unlockedPetIds/hasChosenStarterPet/activePetId are deliberately NOT
  // checked here -- store.js's pet-progression migration now unconditionally
  // unlocks all 24 pets and sets a default activePetId for every hero on
  // every load, so those fields are always populated even for a brand-new
  // stranger device and can no longer signal real customization.
  const hasCustomHeroes = Array.isArray(state.heroes) && (
    state.heroes.length > 1 ||
    state.heroes.some(h => (
      (h.name && h.name !== 'Little Hero') ||
      (h.points && Number(h.points) > 0) ||
      (h.coins && Number(h.coins) > 0) ||
      (h.tokens && Number(h.tokens) > 0) ||
      (h.xp && Number(h.xp) > 0) ||
      (h.level && Number(h.level) > 1) ||
      (h.streak && Number(h.streak) > 1)
    ))
  );

  const hasCustomProgress = Boolean(
    (state.taskCompletionLogs && state.taskCompletionLogs.length > 0) ||
    (state.taskLedgerLogs && state.taskLedgerLogs.length > 0) ||
    (state.movementSessionHistory && state.movementSessionHistory.length > 0) ||
    (state.dentalBattleHistory && state.dentalBattleHistory.length > 0) ||
    (state.selectedHero && (
      (state.selectedHero.name && state.selectedHero.name !== 'Little Hero') ||
      (state.selectedHero.points && Number(state.selectedHero.points) > 0) ||
      (state.selectedHero.coins && Number(state.selectedHero.coins) > 0) ||
      (state.selectedHero.xp && Number(state.selectedHero.xp) > 0) ||
      (state.selectedHero.level && Number(state.selectedHero.level) > 1)
    ))
  );

  const hasCustomName = Boolean(
    state.household?.name &&
    state.household.name.trim() !== '' &&
    state.household.name.trim() !== 'The Hero Family'
  );

  return Boolean(
    wasExplicitlyConfigured ||
    hasActiveSyncCode ||
    hasParent ||
    hasCustomHeroes ||
    hasCustomProgress ||
    hasCustomName
  );
}

// A new household's sync code is its only access control -- Firestore's
// rules intentionally allow any device that knows a household's code to
// read/write it (so a kid's device, which never gets its own Firebase Auth
// identity, can join just by typing the code a parent shares). That design
// means the code's entropy IS the security boundary. The old 4-digit code
// (1000-9999, ~9000 possibilities) was practical to guess by brute force;
// this generates a much larger space so guessing becomes infeasible, while
// staying plain alphanumeric so it's still easy to read aloud/type on a
// second device. Existing households keep their current (shorter) code --
// this only affects newly created ones going forward.
const HOUSEHOLD_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid misreads
export function generateHouseholdCodeSuffix(length = 8) {
  const bytes = new Uint32Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 0xffffffff);
  }
  let code = '';
  for (let i = 0; i < length; i++) {
    code += HOUSEHOLD_CODE_CHARS[bytes[i] % HOUSEHOLD_CODE_CHARS.length];
  }
  return code;
}
