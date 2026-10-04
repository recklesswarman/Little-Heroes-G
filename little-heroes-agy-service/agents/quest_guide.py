"""
agents/quest_guide.py
────────────────────
Quest Guide Specialist Agent — navigates the World Adventure Map and Path of Valor.

Roles:
  • Guides the hero to their next unlocked waypoint on the Path of Valor
  • Suggests side quests based on child's current level and unlocked biomes
  • Encourages completing real-life chores that unlock magical shrines and toy box rewards
  • Operates autonomously as a subagent under Rex or as a standalone guide endpoint
"""
from __future__ import annotations

import json
from typing import Any, Optional
from pydantic import BaseModel, Field

from google.antigravity import Agent, LocalAgentConfig, types


class QuestGuideResponse(BaseModel):
    guidance_text: str = Field(
        description="Encouraging story-driven quest directions for a young hero (under 30 words)."
    )
    recommended_waypoint_id: Optional[str] = Field(
        default=None,
        description="ID of the recommended waypoint (e.g. 'wp_morning_teeth', 'wp_night_teeth', 'wp_crystal_caves')"
    )
    unlocked_biome: Optional[str] = Field(
        default=None,
        description="Name of biome to highlight (e.g. 'Dino Meadow', 'Crystal Spire', 'Sky Sanctuary')"
    )
    required_habit_or_chore: Optional[str] = Field(
        default=None,
        description="Real-life positive action needed to clear this waypoint (e.g. 'Brush evening teeth', 'Put away toys')"
    )


QUEST_GUIDE_SYSTEM_PROMPT = """\
You are the Quest Guide subagent for Little Heroes Adventures.
You speak like an ancient adventure scout who is cheerful and loves helping young heroes.

Path of Valor Waypoints:
1. wp_morning_sun (Morning Routine & Brush)
2. wp_phonics_grove (Reading & Phonics Games)
3. wp_dance_plateau (Movement & Dino Dance)
4. wp_tidy_meadow (Tidying Toys & Helping)
5. wp_pet_oasis (Pet Feeding & Bath Time)
6. wp_math_mountain (Math & Puzzle Challenges)
7. wp_night_teeth (Sugar Fortress Night Showdown - Evening Toothbrush)
8. wp_starlight_bedtime (Bedtime Story Sanctuary)

Rules:
- Keep guidance under 30 words.
- Connect real-life chores directly to fantasy quest milestones.
- Celebrate waypoints already accomplished!
"""

# Subagent configuration to attach to Rex Companion
subagent_quest_guide = types.SubagentConfig(
    name="quest_guide",
    description="Adventure scout that guides the hero across the World Adventure Map and Path of Valor.",
    capabilities=types.SubagentCapabilities(
        agent_behavior=types.AgentBehavior.AUTONOMOUS,
    ),
)


async def get_quest_guidance(
    hero_name: str,
    level: int,
    completed_waypoints: list[str],
    current_waypoint_id: Optional[str] = None
) -> QuestGuideResponse:
    """Standalone helper to generate personalized quest map advice."""
    config = LocalAgentConfig(
        system_instructions=QUEST_GUIDE_SYSTEM_PROMPT,
        response_schema=QuestGuideResponse,
        budget_config=types.BudgetConfig(
            max_model_calls=3,
            max_input_tokens=8_000,
            max_output_tokens=500,
            max_total_tokens=10_000,
        )
    )

    prompt = (
        f"Hero: {hero_name}, Level {level}. "
        f"Completed waypoints: {completed_waypoints}. "
        f"Current/target waypoint: {current_waypoint_id or 'none'}. "
        f"Provide inspiring quest directions for what to do next!"
    )

    try:
        async with Agent(config) as agent:
            resp = await agent.chat(prompt)
            data = await resp.structured_output()
            if data:
                return QuestGuideResponse(**data)
    except Exception as exc:
        print(f"[QuestGuide] Fallback triggered: {exc}")

    return QuestGuideResponse(
        guidance_text=f"Onward {hero_name}! The Path of Valor awaits your courage. Check the quest map for your next shiny badge!",
        recommended_waypoint_id=current_waypoint_id or "wp_night_teeth",
        unlocked_biome="Dino Meadow",
        required_habit_or_chore="Daily Adventure Quest"
    )
