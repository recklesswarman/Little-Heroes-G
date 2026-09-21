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

  const hasCustomHeroes = Array.isArray(state.heroes) && (
    state.heroes.length > 1 ||
    state.heroes.some(h => (
      (h.name && h.name !== 'Little Hero') ||
      (h.points && Number(h.points) > 0) ||
      (h.coins && Number(h.coins) > 0) ||
      (h.tokens && Number(h.tokens) > 0) ||
      (h.xp && Number(h.xp) > 0) ||
      (h.level && Number(h.level) > 1) ||
      (h.streak && Number(h.streak) > 1) ||
      (Array.isArray(h.unlockedPetIds) && h.unlockedPetIds.length > 0) ||
      h.hasChosenStarterPet === true ||
      (h.activePetId !== null && h.activePetId !== undefined)
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
      (state.selectedHero.level && Number(state.selectedHero.level) > 1) ||
      (Array.isArray(state.selectedHero.unlockedPetIds) && state.selectedHero.unlockedPetIds.length > 0) ||
      state.selectedHero.hasChosenStarterPet === true
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
