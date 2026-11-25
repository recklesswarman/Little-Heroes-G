// Exact hero and pet XP progression curves matching src/state/store.js (addXP & addPetTrainingXp).
// This is the ONLY file in shared/ledger/ permitted to use Math.round for the 1.35x hero curve
// and integer percentage rounding for pet-gear buffs.

import { assertNonNegInt } from "./currencies.js";

export const HERO_BASE_XP_NEXT = 100;
export const HERO_XP_GROWTH = 1.35;
export const HERO_LEVEL_UP_BONUS_TOKENS = 50;
export const HERO_DEFAULT_MAX_LEVEL = 100;
export const PET_MAX_LEVEL = 25;

/**
 * Returns cumulative XP thresholds for hero levels 1..maxLevel.
 * table[0] = 0 (level 1), table[1] = 100 (level 2), table[2] = 235 (level 3), etc.
 * Matches addXP: starts at xpNext = 100, then xpNext = Math.round(xpNext * 1.35) each level.
 */
export function heroCumXpTable(maxLevel = HERO_DEFAULT_MAX_LEVEL) {
  const max = Math.max(2, Math.floor(maxLevel));
  const table = [0];
  let xpNext = HERO_BASE_XP_NEXT;
  let cumulative = 0;
  for (let lvl = 1; lvl < max; lvl++) {
    cumulative += xpNext;
    table.push(cumulative);
    xpNext = Math.round(xpNext * HERO_XP_GROWTH);
  }
  return table;
}

export const DEFAULT_HERO_CUM_XP_TABLE = Object.freeze(heroCumXpTable(HERO_DEFAULT_MAX_LEVEL));

/**
 * XP required to advance from `level` to `level + 1`.
 */
export function heroXpNeededForLevel(level, table = DEFAULT_HERO_CUM_XP_TABLE) {
  assertNonNegInt(level, "level");
  if (level < 1) throw new Error(`Hero level must be >= 1, got ${level}`);
  const activeTable = level < table.length ? table : heroCumXpTable(level + 2);
  return activeTable[level] - activeTable[level - 1];
}

/**
 * Convert cumulative Hero XP into { level, xpIntoLevel, xpNext }.
 */
export function heroLevelFromCum(cumXp, table = DEFAULT_HERO_CUM_XP_TABLE) {
  assertNonNegInt(cumXp, "cumXp");
  let activeTable = table;
  while (cumXp >= activeTable[activeTable.length - 1]) {
    activeTable = heroCumXpTable(activeTable.length + 50);
  }
  let level = 1;
  while (level < activeTable.length && cumXp >= activeTable[level]) {
    level += 1;
  }
  const levelStart = activeTable[level - 1];
  const xpNext = activeTable[level] - levelStart;
  return {
    level,
    xpIntoLevel: cumXp - levelStart,
    xpNext
  };
}

/**
 * Convert legacy (level, xpIntoLevel) into cumulative Hero XP.
 */
export function heroCumFrom(level, xpIntoLevel = 0, table = DEFAULT_HERO_CUM_XP_TABLE) {
  assertNonNegInt(level, "level");
  assertNonNegInt(xpIntoLevel, "xpIntoLevel");
  if (level < 1) throw new Error(`Hero level must be >= 1, got ${level}`);
  const activeTable = level <= table.length ? table : heroCumXpTable(level + 2);
  return activeTable[level - 1] + xpIntoLevel;
}

/**
 * Cumulative Pet XP threshold to reach `level` (level 1 = 0, level L = 50 * L * (L - 1)).
 * Matches addPetTrainingXp: needed = currentLvl * 100, cap 25.
 */
export function petCumForLevel(level) {
  assertNonNegInt(level, "petLevel");
  const clamped = Math.min(PET_MAX_LEVEL, Math.max(1, level));
  return 50 * clamped * (clamped - 1);
}

/**
 * Convert cumulative Pet XP into { level, xpIntoLevel, xpNext }.
 */
export function petLevelFromCum(cumXp) {
  assertNonNegInt(cumXp, "petCumXp");
  let level = 1;
  let remaining = cumXp;
  while (level < PET_MAX_LEVEL) {
    const needed = level * 100;
    if (remaining >= needed) {
      remaining -= needed;
      level += 1;
    } else {
      break;
    }
  }
  return {
    level,
    xpIntoLevel: remaining,
    xpNext: level * 100
  };
}

/**
 * Convert legacy (petLevel, xpIntoLevel) into cumulative Pet XP.
 */
export function petCumFrom(level, xpIntoLevel = 0) {
  assertNonNegInt(level, "petLevel");
  assertNonNegInt(xpIntoLevel, "petXpIntoLevel");
  if (level < 1) throw new Error(`Pet level must be >= 1, got ${level}`);
  const clamped = Math.min(PET_MAX_LEVEL, level);
  return petCumForLevel(clamped) + xpIntoLevel;
}

/**
 * Apply an integer buff percentage (0..maxBuffPercent) to a non-negative integer base award.
 * Uses Math.round to match legacy client buff rounding while keeping division isolated here.
 */
export function applyBuffPercent(base, buffPercent, maxBuffPercent = 50) {
  assertNonNegInt(base, "base");
  assertNonNegInt(buffPercent, "buffPercent");
  assertNonNegInt(maxBuffPercent, "maxBuffPercent");
  if (buffPercent > maxBuffPercent) {
    throw new Error(`buffPercent ${buffPercent} exceeds maxBuffPercent ${maxBuffPercent}`);
  }
  if (base === 0 || buffPercent === 0) return base;
  return base + Math.round((base * buffPercent) / 100);
}
