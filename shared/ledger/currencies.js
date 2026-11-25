// Shared ledger currency constants, counter accounts, transaction types, and integer guards.
// Pure ES module with zero Firebase imports.

export const CURRENCIES = Object.freeze({
  GOLD_POINTS: "GOLD_POINTS",
  HABIT_TOKENS: "HABIT_TOKENS",
  HERO_XP: "HERO_XP",
  PET_XP: "PET_XP",
  PET_SPARKS: "PET_SPARKS"
});

export const WALLET_CURRENCIES = Object.freeze([
  CURRENCIES.GOLD_POINTS,
  CURRENCIES.HABIT_TOKENS,
  CURRENCIES.HERO_XP
]);

export const PET_CURRENCIES = Object.freeze([
  CURRENCIES.PET_XP,
  CURRENCIES.PET_SPARKS
]);

export const ALL_CURRENCIES = Object.freeze([
  ...WALLET_CURRENCIES,
  ...PET_CURRENCIES
]);

export const COUNTER_ACCOUNTS = Object.freeze({
  TREASURY_MINT: "treasury_mint",
  OPENING_BALANCE: "opening_balance",
  SHOP_SINK: "shop_sink",
  REWARD_REDEMPTION_SINK: "reward_redemption_sink",
  PET_TRAINING_SINK: "pet_training_sink",
  SPARK_SINK: "spark_sink",
  CLAWBACK: "clawback",
  ADJUSTMENT: "adjustment"
});

export const TRANSACTION_TYPES = Object.freeze({
  EARN_ACTIVITY: "EARN_ACTIVITY",
  APPROVE_TASK_POINTS: "APPROVE_TASK_POINTS",
  REJECT_TASK_CLAWBACK: "REJECT_TASK_CLAWBACK",
  REWARD_REQUEST_HOLD: "REWARD_REQUEST_HOLD",
  REWARD_APPROVE_CAPTURE: "REWARD_APPROVE_CAPTURE",
  REWARD_REJECT_VOID: "REWARD_REJECT_VOID",
  SHOP_PURCHASE: "SHOP_PURCHASE",
  PET_XP_SPEND: "PET_XP_SPEND",
  SPARK_SPEND: "SPARK_SPEND",
  CONSUME: "CONSUME",
  GIFT_GRANT: "GIFT_GRANT",
  ITEM_REVOKE: "ITEM_REVOKE",
  PARENT_ADJUSTMENT: "PARENT_ADJUSTMENT",
  OPENING_BALANCE: "OPENING_BALANCE"
});

export const ONE_TIME_INVENTORY_KINDS = new Set([
  "digital_gear",
  "pet_gear",
  "studio_item",
  "theme",
  "pet",
  "hq_furniture",
  "badge"
]);

export const PARENT_GRANT_REASONS = new Set([
  "parent_gift",
  "studio_crate",
  "parent_pet",
  "parent_edit"
]);

export const MEMBER_GRANT_REASONS = new Set([
  "hq_milestone",
  "boss_trophy",
  "battle_badge",
  "expedition_drop",
  "starter_pet",
  "adopt",
  "egg_hatch"
]);

export const SPEND_REASONS = new Set([
  "pet_training_reset",
  "pet_evolution_spark_spend",
  "shop_spark_spend",
  "pet_ability_upgrade"
]);

export function isSafeInt(val) {
  return typeof val === "number" && Number.isSafeInteger(val);
}

export function assertSafeInt(val, label = "amount") {
  if (!isSafeInt(val)) {
    throw new Error(`Invalid integer for ${label}: ${String(val)}`);
  }
  return val;
}

export function assertNonNegInt(val, label = "amount") {
  assertSafeInt(val, label);
  if (val < 0) {
    throw new Error(`Negative integer not allowed for ${label}: ${val}`);
  }
  return val;
}

export function emptyDelta() {
  return {
    GOLD_POINTS: 0,
    HABIT_TOKENS: 0,
    HERO_XP: 0,
    PET_XP: 0,
    PET_SPARKS: 0
  };
}
