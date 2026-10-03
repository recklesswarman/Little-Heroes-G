// Shared id generator for locally-created records (completion logs, pending
// approvals, battle history entries, ...) that need a unique-enough id before
// they're ever synced anywhere -- timestamp plus a short random suffix is
// sufficient since these only need to be unique within one household's data.
export function generateId(prefix, randLen = 6) {
  return prefix + Date.now() + '_' + Math.random().toString(36).substring(2, 2 + randLen);
}
