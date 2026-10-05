"""
agents/battle_coach.py
──────────────────────
Battle Coach Specialist Agent — tactical toothbrushing advice during AR boss battles.

Roles:
  • Real-time brushing technique & cadence encouragement
  • Villain defense strategies (Sugar Bandit King, Plaque Kraken, Cavity Knight, Tartar Titan)
  • Tactical voice prompt guidance ("Blast with foam cannon!", "Raise bubble shield!", "Aim for quadrant 2!")
  • Operates autonomously as a subagent under Rex or as a standalone battle coaching endpoint
"""
from __future__ import annotations

import json
import os
from typing import Any, Optional
from pydantic import BaseModel, Field

from google.antigravity import Agent, LocalAgentConfig, types
from tools import get_dental_streaks, get_battle_history


class BattleCoachResponse(BaseModel):
    coach_text: str = Field(
        description="Short, high-energy coaching line spoken or displayed during combat (under 15 words)."
    )
    suggested_move: str = Field(
        default="scrub",
        description="Tactical recommendation: 'scrub' | 'foam_blast' | 'bubble_shield' | 'switch_quadrant'"
    )
    target_quadrant: Optional[int] = Field(
        default=None,
        description="Target dental quadrant (1=Upper Right, 2=Upper Left, 3=Lower Right, 4=Lower Left)"
    )
    urgency: str = Field(
        default="normal",
        description="'low' | 'normal' | 'critical' (when hazards fall rapidly)"
    )


BATTLE_COACH_SYSTEM_PROMPT = """\
You are the Toothbrush Battle Coach subagent for Little Heroes Adventures.
You provide real-time, toddler-friendly combat tactics during 2-minute AR tooth battles.

Bosses:
- Sugar Bandit King: uses caramel bombs & soda sprays. Advice: quick upward circular sweeps!
- Plaque Kraken: sticky tentacles. Advice: foam blast to dissolve grime!
- Cavity Knight: armored chocolate shield. Advice: focus quadrant brushing to charge enamel counter-surge!
- Tartar Titan: rock candy armor. Advice: steady even cadence!

Rules:
- Keep coaching advice under 15 words. High energy, motivational, and toddler-clear!
- Never use negative phrasing.
- If health or shield is low, suggest 'bubble_shield'.
- If high combo or charged supernova, suggest 'foam_blast'.
"""

# Subagent configuration to attach to Rex Companion
subagent_battle_coach = types.SubagentConfig(
    name="battle_coach",
    description="Tactical toothbrushing coach that gives real-time cadence and technique advice during boss battles.",
    system_instructions=BATTLE_COACH_SYSTEM_PROMPT,
    tools=[get_dental_streaks, get_battle_history],
    capabilities=types.SubagentCapabilities(
        agent_behavior=types.AgentBehavior.AUTONOMOUS,
    ),
)


async def get_battle_coach_advice(
    boss_id: str,
    boss_hp_percent: float,
    current_quadrant: int,
    cadence_score: float,
    equipped_weapon: str = "laser_toothbrush"
) -> BattleCoachResponse:
    """Standalone helper to generate dynamic battle coaching."""
    use_vertex = os.environ.get("USE_VERTEX", "false").lower() in ("true", "1") or not os.environ.get("GEMINI_API_KEY")
    model_name = os.environ.get(
        "GEMINI_MODEL",
        "gemini-2.5-flash" if use_vertex else "gemini-3.8-flash",
    )
    auth_kwargs = (
        {
            "vertex": True,
            "project": os.environ.get("GOOGLE_CLOUD_PROJECT", os.environ.get("PROJECT_ID", "little-heroes-quest-8842")),
            "location": os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
        }
        if use_vertex
        else {"api_key": os.environ.get("GEMINI_API_KEY")}
    )

    config = LocalAgentConfig(
        model=model_name,
        system_instructions=BATTLE_COACH_SYSTEM_PROMPT,
        response_schema=BattleCoachResponse,
        budget_config=types.BudgetConfig(
            max_model_calls=3,
            max_input_tokens=8_000,
            max_output_tokens=500,
            max_total_tokens=10_000,
        ),
        **auth_kwargs,
    )

    prompt = (
        f"Boss: {boss_id} at {boss_hp_percent}% HP. "
        f"Hero currently brushing quadrant {current_quadrant} with {equipped_weapon}. "
        f"Cadence score: {cadence_score}. Give quick tactical advice!"
    )

    try:
        async with Agent(config) as agent:
            resp = await agent.chat(prompt)
            data = await resp.structured_output()
            if data:
                return BattleCoachResponse(**data)
    except Exception as exc:
        print(f"[BattleCoach] Fallback triggered: {exc}")

    return BattleCoachResponse(
        coach_text="ENAMEL POWER SURGE! Keep those circles moving, Little Hero!",
        suggested_move="scrub",
        target_quadrant=current_quadrant,
        urgency="normal"
    )
