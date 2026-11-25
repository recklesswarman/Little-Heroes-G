# Authoritative Ledger Backfill & Cutover Runbook

This directory contains the Phase 4 migration scripts for switching a household from `ledgerMode: 'legacy'` to `ledgerMode: 'authoritative'`.

## Prerequisites

1. Deploy `functions-ledger`, `firestore.rules`, and `firestore.indexes.json` to production (`firebase-functions-deploy.yml` runs automatically on merge to `main`).
2. Confirm all 4 composite indexes are **Enabled** in Firebase Console → Firestore → Indexes:
   - `approval_requests`: `(status ASC, createdAt DESC)`
   - `holds`: `(heroId ASC, status ASC)`
   - `ledger_transactions`: `(heroId ASC, createdAt DESC)`
   - `ledger_transactions`: `(heroId ASC, walletVersionAfter ASC)`
3. Authenticate with Google Application Default Credentials (`gcloud auth application-default login` or `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`).

## Step 1: Dry Run & Joined-Device Check

```bash
node scripts/ledger/backfill.mjs --code <HOUSEHOLD_CODE> --dry-run
```

Inspect `joinedMembers` in the JSON output. Wait until every family tablet/phone has opened the updated app at least once (so `joinHouseholdOnStart` has registered its member doc).

## Step 2: Freeze Legacy Writes & Capture Snapshot

```bash
node scripts/ledger/backfill.mjs --code <HOUSEHOLD_CODE> --freeze
```

This copies the current household doc to `households/<CODE>/private/preCutoverSnapshot` and sets `ledgerMode: 'migrating'` so no legacy device can overwrite balances during backfill.

## Step 3: Execute Idempotent Cutover

```bash
node scripts/ledger/backfill.mjs --code <HOUSEHOLD_CODE> --cutover
```

This creates:
- `wallets/{heroId}` + `ledger_transactions/backfill_v1_{heroId}`
- `heroes/{heroId}` (non-currency profiles + per-kid HQ filtered by `furnitureOwners`)
- `inventory/{heroId}__{itemId}`
- `approval_requests/{id}` (preserving `metadata.legacyAward` and `holds/{id}`)
- `private/parentAuth` (scrypt-hashed PIN) and deletes plain-text `pin` from `parentSettings` & `stateSnapshot.parentSettings`
- `public/walletSummary` (for Pi fridge display / weekly reports)
- Flips `ledgerMode: 'authoritative'`

## Rollback (Zero Data Loss)

If anything needs to revert to `legacy` mode after cutover:

```bash
node scripts/ledger/rollback.mjs --code <HOUSEHOLD_CODE>
```

Projects all post-cutover wallet balances, purchases, avatar changes, and pending approvals back onto `households/<CODE>` and sets `ledgerMode: 'legacy'`.

## Post-Cutover Cleanup

Once production has run smoothly on `authoritative` mode:

```bash
node scripts/ledger/cleanup_snapshot.mjs --code <HOUSEHOLD_CODE>
```
