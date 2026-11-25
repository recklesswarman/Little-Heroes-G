// Deterministic Firestore-safe IDs and canonical task alias groups.
// TASK_ALIAS_GROUPS must match getTaskAliasGroup() in src/state/store.js exactly;
// scratch/verify_ledger_core.mjs asserts parity.

export const TASK_ALIAS_GROUPS = Object.freeze([
  Object.freeze(["bedtime_brush", "brush_teeth_pm", "wp_night_teeth", "sugar_fortress_night_showdown", "toothbrush_adventure_battle", "teeth_pm"]),
  Object.freeze(["morning_brush", "brush_teeth_am", "wp_morning_teeth", "brush_teeth", "teeth_am"]),
  Object.freeze(["make_bed", "wp_wake_up", "bed"]),
  Object.freeze(["drink_water", "wp_hydration", "water"]),
  Object.freeze(["clean_room", "clean_toys", "wp_tidy_room", "pajamas_tidy", "toys"]),
  Object.freeze(["homework", "homework_reading", "wp_homework", "reading"]),
  Object.freeze(["exercise", "wp_workout", "workout"]),
  Object.freeze(["sleep_on_time", "night_bedtime", "wp_bedtime", "bedtime_story", "sleep"])
]);

const ALIAS_LOOKUP = new Map();
for (const group of TASK_ALIAS_GROUPS) {
  for (const id of group) {
    ALIAS_LOOKUP.set(id, group);
  }
}

export function getTaskAliasGroup(id) {
  if (!id) return [];
  const group = ALIAS_LOOKUP.get(id);
  return group ? [...group] : [id];
}

export function canonicalTaskId(taskId) {
  if (!taskId) return "";
  const group = ALIAS_LOOKUP.get(taskId);
  return group ? group[0] : String(taskId);
}

/**
 * Sanitize a string segment so it is safe inside a Firestore document ID:
 * no '/', never '.' or '..', never '__.*__', trimmed to <= 120 chars.
 */
export function sanitizeIdSegment(raw, label = "id") {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    throw new Error(`Missing required ID segment: ${label}`);
  }
  const cleaned = String(raw)
    .trim()
    .replace(/[^A-Za-z0-9:_-]/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "")
    .slice(0, 120);
  if (!cleaned || cleaned === "." || cleaned === ".." || /^__.*__$/.test(cleaned)) {
    throw new Error(`Unsafe Firestore ID segment for ${label}: ${String(raw)}`);
  }
  return cleaned;
}

export function activityTxnId(heroId, activityType, activityId, cycleId) {
  return `act_${sanitizeIdSegment(heroId, "heroId")}_${sanitizeIdSegment(activityType, "activityType")}_${sanitizeIdSegment(activityId, "activityId")}_${sanitizeIdSegment(cycleId, "cycleId")}`;
}

export function approveTxnId(requestId) {
  return `approve_${sanitizeIdSegment(requestId, "requestId")}`;
}

export function rejectTxnId(requestId) {
  return `reject_${sanitizeIdSegment(requestId, "requestId")}`;
}

export function rewardHoldTxnId(requestId) {
  return `hold_${sanitizeIdSegment(requestId, "requestId")}`;
}

export function rewardCaptureTxnId(requestId) {
  return `capture_${sanitizeIdSegment(requestId, "requestId")}`;
}

export function rewardVoidTxnId(requestId) {
  return `void_${sanitizeIdSegment(requestId, "requestId")}`;
}

export function purchaseTxnId(heroId, itemId, clientUuid) {
  return `buy_${sanitizeIdSegment(heroId, "heroId")}_${sanitizeIdSegment(itemId, "itemId")}_${sanitizeIdSegment(clientUuid, "clientUuid")}`;
}

export function grantTxnId(heroId, itemId, uniqueSuffix = "") {
  const base = `grant_${sanitizeIdSegment(heroId, "heroId")}_${sanitizeIdSegment(itemId, "itemId")}`;
  return uniqueSuffix ? `${base}_${sanitizeIdSegment(uniqueSuffix, "uniqueSuffix")}` : base;
}

export function revokeTxnId(heroId, itemId, clientUuid) {
  return `revoke_${sanitizeIdSegment(heroId, "heroId")}_${sanitizeIdSegment(itemId, "itemId")}_${sanitizeIdSegment(clientUuid, "clientUuid")}`;
}

export function consumeTxnId(heroId, itemId, clientUuid) {
  return `consume_${sanitizeIdSegment(heroId, "heroId")}_${sanitizeIdSegment(itemId, "itemId")}_${sanitizeIdSegment(clientUuid, "clientUuid")}`;
}

export function spendTxnId(heroId, reason, clientUuid) {
  return `spend_${sanitizeIdSegment(heroId, "heroId")}_${sanitizeIdSegment(reason, "reason")}_${sanitizeIdSegment(clientUuid, "clientUuid")}`;
}

export function adjustTxnId(heroId, clientUuid) {
  return `adjust_${sanitizeIdSegment(heroId, "heroId")}_${sanitizeIdSegment(clientUuid, "clientUuid")}`;
}

export function openWalletTxnId(heroId) {
  return `open_${sanitizeIdSegment(heroId, "heroId")}`;
}

export function closeWalletTxnId(heroId, clientUuid) {
  return `close_${sanitizeIdSegment(heroId, "heroId")}_${sanitizeIdSegment(clientUuid, "clientUuid")}`;
}

export function backfillTxnId(heroId) {
  return `backfill_v1_${sanitizeIdSegment(heroId, "heroId")}`;
}

export function inventoryDocId(ownerId, itemId) {
  return `${sanitizeIdSegment(ownerId, "ownerId")}__${sanitizeIdSegment(itemId, "itemId")}`;
}

export function activityLockDocId(heroId, lockKey) {
  return `${sanitizeIdSegment(heroId, "heroId")}__${sanitizeIdSegment(lockKey, "lockKey")}`;
}

export function catalogDocId(kind, itemId) {
  return `${sanitizeIdSegment(kind, "kind")}:${sanitizeIdSegment(itemId, "itemId")}`;
}

export function rewardRuleDocId(activityType, activityId = "") {
  const type = sanitizeIdSegment(activityType, "activityType");
  if ((type === "habit" || type === "task") && activityId) {
    return `${type}:${sanitizeIdSegment(canonicalTaskId(activityId), "activityId")}`;
  }
  return type;
}
