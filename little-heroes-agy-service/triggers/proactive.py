"""
triggers/proactive.py
─────────────────────
Proactive Trigger Agent for Little Heroes Adventures.

Executes autonomous time-based and event-based checks:
  1. Bedtime Check-In: Reminds the child to brush if evening brushing hasn't occurred by curfew.
  2. Morning Streak Reminder: Greets the child with their active streak and encourages a morning win.
  3. Weekly Adventure Recap: Generates a story summary of the week's accomplishments every Sunday.

Called by:
  • Periodic Cloud Scheduler jobs hitting /api/rex/proactive
  • App foreground check on client launch
"""
from __future__ import annotations

import json
from typing import Any, Optional
from pydantic import BaseModel, Field

from google.antigravity import Agent, LocalAgentConfig, types
from schemas import RexAgentResponse


class ProactiveTriggerResult(BaseModel):
    should_notify: bool = Field(description="Whether a notification/dialog should be presented.")
    trigger_type: str = Field(description="'bedtime_checkin' | 'morning_streak' | 'weekly_recap'")
    rex_message: RexAgentResponse = Field(description="Structured Rex message to deliver.")


PROACTIVE_SYSTEM_PROMPT = """\
You are Rex the Dino in Proactive Companion Mode for Little Heroes Adventures.
You generate gentle, uplifting, and toddler-friendly check-in messages.
Never sound scolding or guilt-inducing. Always sound excited and loving! 🦖✨

- For Bedtime Check-In: Remind them that bedtime brushing protects their teeth against the Sugar Bandit King, keeping their warrior teeth shiny for tomorrow's quests.
- For Morning Streak: Celebrate their active streak and encourage them to power up with their morning routine!
- For Weekly Recap: Celebrate all the quests, pet care, and dance sessions they achieved this week.
"""


async def evaluate_proactive_trigger(
    trigger_type: str,
    hero_name: str,
    streak: int,
    brushed_evening_today: bool,
    brushed_morning_today: bool,
    completed_quests_count: int = 0,
    bosses_defeated_count: int = 0
) -> ProactiveTriggerResult:
    """Evaluates whether to trigger a proactive nudge and generates the Rex response."""
    
    # ── Bedtime Check-in ─────────────────────────────────────────────
    if trigger_type == "bedtime_checkin":
        if brushed_evening_today:
            # Already brushed — no nudge needed!
            return ProactiveTriggerResult(
                should_notify=False,
                trigger_type=trigger_type,
                rex_message=RexAgentResponse(
                    reply=f"Sleep tight, {hero_name}! Your teeth are gleaming bright! 🌙⭐",
                    emotion="sleepy",
                    voice_tone="whisper"
                )
            )

        # Evening brush pending
        config = LocalAgentConfig(
            system_instructions=PROACTIVE_SYSTEM_PROMPT,
            response_schema=RexAgentResponse,
            budget_config=types.BudgetConfig(max_model_calls=2, max_output_tokens=300)
        )
        prompt = f"Bedtime check-in for {hero_name}. Evening teeth not brushed yet. Give a loving 1-sentence prompt to do the Sugar Fortress night battle before cozy bedtime!"
        try:
            async with Agent(config) as agent:
                resp = await agent.chat(prompt)
                data = await resp.structured_output()
                if data:
                    res = RexAgentResponse(**data)
                    res.suggested_action = "launch:battle"
                    return ProactiveTriggerResult(should_notify=True, trigger_type=trigger_type, rex_message=res)
        except Exception:
            pass

        return ProactiveTriggerResult(
            should_notify=True,
            trigger_type=trigger_type,
            rex_message=RexAgentResponse(
                reply=f"Rawr! Time for our evening brush battle, {hero_name}! Let's protect our pearly whites before bedtime! 🪥🌙",
                emotion="curious",
                voice_tone="energetic",
                suggested_action="launch:battle"
            )
        )

    # ── Morning Streak ───────────────────────────────────────────────
    elif trigger_type == "morning_streak":
        config = LocalAgentConfig(
            system_instructions=PROACTIVE_SYSTEM_PROMPT,
            response_schema=RexAgentResponse,
            budget_config=types.BudgetConfig(max_model_calls=2, max_output_tokens=300)
        )
        prompt = f"Morning greeting for {hero_name}. Current streak is {streak} days! Encourage them to start the day strong with their morning routine!"
        try:
            async with Agent(config) as agent:
                resp = await agent.chat(prompt)
                data = await resp.structured_output()
                if data:
                    res = RexAgentResponse(**data)
                    res.suggested_action = "navigate:quest_map"
                    return ProactiveTriggerResult(should_notify=True, trigger_type=trigger_type, rex_message=res)
        except Exception:
            pass

        return ProactiveTriggerResult(
            should_notify=True,
            trigger_type=trigger_type,
            rex_message=RexAgentResponse(
                reply=f"Good morning Little Hero! You're on an awesome {streak}-day streak! Let's conquer today's adventure! 🦖☀️",
                emotion="excited",
                voice_tone="energetic",
                suggested_action="navigate:quest_map"
            )
        )

    # ── Weekly Recap ─────────────────────────────────────────────────
    else:
        return ProactiveTriggerResult(
            should_notify=True,
            trigger_type="weekly_recap",
            rex_message=RexAgentResponse(
                reply=f"What an epic week, {hero_name}! You completed {completed_quests_count} quests and protected the kingdom! Rex is so proud of you! 🏆✨",
                emotion="proud",
                voice_tone="energetic",
                suggested_action="navigate:hero_hq"
            )
        )
