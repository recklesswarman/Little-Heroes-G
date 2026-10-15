# E2E Test Infra: Little Hero Adventures Task Engine & Realtime Sync

## Test Philosophy
- Opaque-box, requirement-driven simulation of multi-device household behavior.
- Covers all 5 acceptance categories: Auto-reward & pending approvals, reversible denial clawback, zero screen time conversion on approval, zero-drop 45s cutoff elimination, and multi-device/sibling isolation.

## Feature Inventory
| # | Feature | Source | Tier 1 | Tier 2 | Tier 3 |
|---|---------|--------|:------:|:------:|:------:|
| 1 | Auto-reward Tokens, XP, Sparks & Queue Points | ORIGINAL_REQUEST §R2 | ✓ | ✓ | ✓ |
| 2 | Parent Approval Credits Points (No Screen Time) | ORIGINAL_REQUEST §R3 | ✓ | ✓ | ✓ |
| 3 | Reversible Denial Claws Back Tokens/XP/Sparks | ORIGINAL_REQUEST §R3 | ✓ | ✓ | ✓ |
| 4 | Denial Resets Task with Needs Redo | ORIGINAL_REQUEST §R3 | ✓ | ✓ | ✓ |
| 5 | Zero-Drop Approvals (Removal of 45s Cutoff) | ORIGINAL_REQUEST §R2 | ✓ | ✓ | ✓ |
| 6 | 1:1 Parity Map & Quests | ORIGINAL_REQUEST §R1 | ✓ | ✓ | ✓ |
| 7 | Multi-Child Sibling Isolation | ORIGINAL_REQUEST §R4 | ✓ | ✓ | ✓ |
| 8 | Multi-Device Realtime Sync & Merge | ORIGINAL_REQUEST §R4 | ✓ | ✓ | ✓ |

## Test Architecture
- Test Runner: `node scratch/verify_task_habit_engine_and_sync.mjs`
- Test Harness: In-memory multi-device simulation using simulated Firestore documents (`households/{syncCode}`), multiple client store instances (Child A, Child B, Parent), and simulated network delays.
- Acceptance Semantics: Exits with code 0 on 100% pass, logs structured test assertions.
