---
name: task-and-currency-lifecycle-rules
description: Invariants for task/habit completion, parent approval/denial, reversible currency rewards, and instant household sync
trigger: model_decision
---

# Task, Habit & Currency Lifecycle Invariants

1. **One Completion at a Time**:
   - A task or habit may only have one active completion payout pending at any given time.
   - Once a parent approves or denies the submission, the task or habit resets and is unlocked for subsequent completion cycles.

2. **Currency Separation & Points Usage**:
   - **Tokens (Habit Coins)**: Auto-issued upon kid submission; spent on digital gear and outfits.
   - **Hero XP**: Auto-issued upon kid submission; unlocks level milestones and badges.
   - **Pet Sparks (Pet XP)**: Auto-issued upon kid submission; levels up active companion pet.
   - **Gold Points**: NEVER auto-issued. Only awarded upon explicit parent approval. Gold Points are NOT auto-converted to screen time minutes. Kids use their accumulated Gold Points in the shop to purchase screen time minutes or real-life rewards.

3. **Reversible Denial Flow**:
   - When a parent denies a task/habit submission, the auto-issued Tokens, Hero XP, and Pet Sparks are immediately deducted from the kid's balance (clamped at 0).
   - The task/habit resets to uncompleted on the kid's screen with a gentle "Needs Redo" prompt.

4. **Zero-Drop Pending Approvals**:
   - Pending approval items must NEVER disappear from the Parent Portal due to time limits, stale cutoffs, or cloud hydration race conditions. They remain visible until explicitly approved or denied.

5. **Instant Household Synchronization**:
   - Every balance mutation, task submission, habit submission, and parent approval/denial must synchronize immediately across all household devices via Firestore realtime listeners.
   - Multi-child data must remain strictly isolated by `heroId`.
