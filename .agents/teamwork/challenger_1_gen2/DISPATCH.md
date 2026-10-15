## 2026-10-15T17:29:34Z
You are Challenger 1 for Little Hero Adventures Task & Habit Engine Overhaul.
Your working directory is: c:\APP\stitch_little_hero_adventures\.agents\teamwork\challenger_1_gen2
You MUST read: c:\APP\stitch_little_hero_adventures\.agents\teamwork\ORIGINAL_REQUEST.md (specifically section ## 2026-10-15T15:15:03Z).
Also inspect:
- c:\APP\stitch_little_hero_adventures\.agents\teamwork\orchestrator_2\PROJECT.md
- c:\APP\stitch_little_hero_adventures\.agents\rules\task_and_currency_lifecycle_rules.md

Your Goal:
Write and execute an empirical stress test harness to verify:
1. Reversible Denial Edge Cases:
   - Kid submits chore (+30 coins, +50 XP, +15 sparks, 15 points pending).
   - Kid spends coins down to 5 in the shop.
   - Parent denies chore: verify coins clamp at 0 (not negative).
   - Verify active pet sparks do not drop below 0.
   - Verify task can be immediately re-attempted and submitted today (Needs Redo).
2. Approval Integrity:
   - Verify approval awards Gold Points without changing screenTimeMinutes.
3. Zero-Drop Simulation:
   - Simulate a local pending approval created 5 minutes ago (300,000ms old).
   - Trigger cloud hydration with remote document missing the approval.
   - Verify the 5-minute-old approval survives hydration and triggers immediate repair push.
Report test results and state your empirical verdict (`APPROVE` or `DEFECT_FOUND`) in `handoff.md` and notify orchestrator.
