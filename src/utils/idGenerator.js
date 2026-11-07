import { secureRandomHex } from './secureRandom.js';

// Shared id generator for locally-created records (completion logs, pending
// approvals, battle history entries, ...) that need a unique-enough id before
// they're ever synced anywhere -- timestamp plus a short random suffix is
// sufficient since these only need to be unique within one household's data.
export function generateId(prefix, randLen = 6) {
  const safeLen = Math.max(1, Number(randLen) || 6);
  const suffix = secureRandomHex(Math.ceil(safeLen / 2)).slice(0, safeLen);
  return `${prefix}${Date.now()}_${suffix}`;
}
