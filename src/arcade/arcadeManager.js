/**
 * arcadeManager.js
 * 
 * Central manager to launch Starlight Arcade games and query game metadata.
 */

import { ArcadeModal, ARCADE_GAMES_METADATA } from './ArcadeModal.js';

let activeArcadeModal = null;

export function launchArcadeGame(gameId) {
  if (activeArcadeModal) {
    activeArcadeModal.close();
  }
  activeArcadeModal = new ArcadeModal(gameId);
  activeArcadeModal.open();
  return activeArcadeModal;
}

export function closeActiveArcadeGame() {
  if (activeArcadeModal) {
    activeArcadeModal.close();
    activeArcadeModal = null;
  }
}

export function getArcadeGameMeta(gameId) {
  return ARCADE_GAMES_METADATA[gameId] || null;
}

export { ARCADE_GAMES_METADATA };
