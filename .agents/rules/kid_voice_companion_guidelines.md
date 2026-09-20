---
name: kid-voice-companion-guidelines
description: Architecture and UX guardrails for conversational voice companions, mascots, and toddler audio interactions
trigger: model_decision
---

# Kid Voice Companion & Interactive Mascot Guidelines

## 1. Non-Blocking Habit & Reward Minting
- Never invoke full-screen modal overlays (`store.showReward`, blocking dialogs) from within floating companions or voice widgets.
- Use `store.claimCompanionHabit(habitKey)` to award coins and XP, write completion logs to `taskCompletionLogs` and `pendingApprovals` for the Parent Portal, and trigger celebratory SFX without interrupting the companion experience.
- Always support task and habit aliases (e.g., `teeth` -> `morning_brush`/`bedtime_brush`, `snack` -> `healthy_snack`, `toys` -> `clean_toys`).

## 2. Mascot Touch Interaction Separation
- Mascot avatar discs must trigger tactile responses (forehead pats, cheek pokes, giggles, 3D expressions) and NOT toggle the microphone or disconnect the live audio session.
- Keep audio control (mute, pause, walkie-talkie toggle) on dedicated, high-contrast, oversized pill buttons.

## 3. Audio Barge-in & Interruption Safeguards
- When the companion is speaking aloud, do not let ambient household noise, TV audio, or toddler laughs cut the companion off mid-sentence.
- Use tap-to-interrupt (tapping the mascot avatar or pause button) to stop audio playback cleanly before opening the microphone.

## 4. Window Event Listener Deduplication
- Component re-renders must clear previous custom event handlers (e.g., `window._liveRexStateUpdateHandler`) before attaching new ones to avoid listener leaks and stacked executions.
