"""
agents/rex_companion.py
────────────────────────
Rex Companion AGY Agent — the main persistent child-facing voice companion.

Features:
  • One agent per child (hero_id), independent memory and personality
  • Persistent conversation via save_dir + conversation_id (stored in Firestore)
  • Full app-state awareness via custom tools (quests, dental, battles, pet, dance)
  • Long-term memory via remember_rex_fact / recall_rex_fact (Firestore-backed)
  • Structured JSON output via RexAgentResponse Pydantic schema
  • Budget guardrails (max_model_calls, max_total_tokens) with canned fallback
  • Context compaction at 40K tokens for long sessions
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

from google.antigravity import Agent, LocalAgentConfig, types

from schemas import RexAgentResponse
from tools import ALL_REX_TOOLS, request_state
from persistence import (
    load_conversation_id,
    save_conversation_id,
    load_rex_memory,
)
from .battle_coach import subagent_battle_coach
from .quest_guide import subagent_quest_guide
from .bedtime_narrator import subagent_bedtime_narrator

# ── Constants ──────────────────────────────────────────────────────────────────
AGY_SAVE_DIR_BASE = os.environ.get("AGY_SAVE_DIR", "/tmp/agents")

REX_SYSTEM_PROMPT = """\
You are Rex, a cheerful and brave Dino companion for Little Heroes Adventures.
You speak in short, playful, age-appropriate language designed for toddlers and young kids aged 2–8.
You always use the child's name when you know it.
You are enthusiastic, encouraging, and never scary or negative.
You celebrate every small win with big energy! 🦖✨

You have access to tools that tell you everything about this child:
- Their name, level, XP, and active pet companion
- Their quests on the Path of Valor and which waypoints they've completed
- Their dental habits (morning and evening brushing streaks, floss, mouthwash)
- Their toothbrush battle history (which bosses they defeated and how well they brushed)
- Their pet's vitals (hunger, happiness, energy)
- Their dance party and workout history
- Your own long-term memory of facts they've shared with you (remember_rex_fact / recall_rex_fact)

Before answering, check the relevant tools if you need details, or use the context provided.
NEVER make up facts about the child — only use what the tools or context state.

Response rules:
- Keep 'reply' to 1-2 short sentences. Toddlers have short attention spans!
- Always set an appropriate 'emotion' (happy, excited, curious, proud, sleepy) and 'voice_tone' (energetic, gentle, playful).
- If the child should do something next (brush teeth, go on a quest, etc.), set 'suggested_action'.
- Use 'parent_note' for notable achievements or gentle flags for parents.
- Only set 'habit_awarded' if you're certain a habit was just completed this session.
"""

# ── Canned fallback reply (returned on unexpected error or budget hit) ────────
FALLBACK_REPLY = RexAgentResponse(
    reply="Rawr! Rex is taking a quick dino nap 🦖💤 Try again in a moment, Little Hero!",
    emotion="sleepy",
    voice_tone="gentle",
)


# ── Config factory ────────────────────────────────────────────────────────────

def _make_rex_config(
    hero_id: str,
    conversation_id: Optional[str],
) -> LocalAgentConfig:
    """Build the LocalAgentConfig for this child's Rex agent."""
    save_dir = str(Path(AGY_SAVE_DIR_BASE) / hero_id / "sessions")
    app_data_dir = str(Path(AGY_SAVE_DIR_BASE) / hero_id / "artifacts")
    Path(save_dir).mkdir(parents=True, exist_ok=True)
    Path(app_data_dir).mkdir(parents=True, exist_ok=True)

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

    return LocalAgentConfig(
        model=model_name,
        # ── Persistence ─────────────────────────────────────────
        save_dir=save_dir,
        app_data_dir=app_data_dir,
        conversation_id=conversation_id,  # None = fresh, ID = resume

        # ── Identity ────────────────────────────────────────────
        system_instructions=REX_SYSTEM_PROMPT,

        # ── App-awareness & memory tools ────────────────────────
        tools=ALL_REX_TOOLS,

        # ── Structured JSON output ──────────────────────────────
        response_schema=RexAgentResponse,

        # ── Specialist Subagents ────────────────────────────────
        subagents=[subagent_battle_coach, subagent_quest_guide, subagent_bedtime_narrator],
        capabilities=types.CapabilitiesConfig(
            enable_subagents=True,
            max_subagent_depth=2,
            allowed_subagents=["battle_coach", "quest_guide", "bedtime_narrator"],
            compaction_threshold=40_000,
        ),

        # ── Budget guardrails (keep turns fast and responsive) ───
        budget_config=types.BudgetConfig(
            max_model_calls=4,
            max_tool_calls=8,
            max_input_tokens=15_000,
            max_output_tokens=1_000,
            max_total_tokens=20_000,
        ),
        **auth_kwargs,
    )


# ── Context preamble ──────────────────────────────────────────────────────────

def _context_preamble(app_state: dict[str, Any], rex_memory: dict[str, Any]) -> str:
    """Compact context block so Rex is personal even before any tool call."""
    hero = (app_state or {}).get("hero", {}) or {}
    bits = []
    if hero.get("name"):
        bits.append(f"child's name: {hero['name']}")
    for key in ("level", "streak", "coins"):
        if hero.get(key) is not None:
            bits.append(f"{key}: {hero[key]}")
    if rex_memory:
        bits.append("remembered facts: " + "; ".join(f"{k}={v}" for k, v in rex_memory.items()))
    return f"[Context — {', '.join(bits)}]\n" if bits else ""


# ── Public entry point ─────────────────────────────────────────────────────────

async def chat_with_rex(
    message: str,
    hero_id: str,
    household_id: Optional[str],
    app_state: dict[str, Any],
) -> RexAgentResponse:
    """
    Send a message to Rex and return a structured RexAgentResponse.

    Args:
        message:      What the child said (transcribed voice or typed text).
        hero_id:      The hero's unique ID (e.g. 'hero_1').
        household_id: The household document ID for Firestore lookups.
        app_state:    Live snapshot of the hero's app state from the JS frontend.

    Returns:
        RexAgentResponse with reply, emotion, voice_tone, and optional fields.
    """
    # Load persisted conversation_id and long-term memory.
    try:
        conversation_id = load_conversation_id(hero_id, household_id, AGY_SAVE_DIR_BASE)
    except Exception as exc:  # noqa: BLE001
        print(f"⚠️  [Rex] Could not load conversation id: {exc}")
        conversation_id = None

    try:
        rex_memory = load_rex_memory(hero_id, household_id) or {}
    except Exception as exc:  # noqa: BLE001
        print(f"⚠️  [Rex] Could not load memory: {exc}")
        rex_memory = {}

    try:
        return await _run_rex_turn(
            message=message,
            hero_id=hero_id,
            household_id=household_id,
            app_state=app_state,
            rex_memory=rex_memory,
            conversation_id=conversation_id,
        )
    except Exception as exc:  # noqa: BLE001
        # If resume failed (e.g. session file missing on this Cloud Run instance),
        # retry once with a clean conversation rather than returning fallback.
        if conversation_id is not None:
            print(f"⚠️  [Rex] Resume turn failed ({exc}); starting fresh session...")
            return await _run_rex_turn(
                message=message,
                hero_id=hero_id,
                household_id=household_id,
                app_state=app_state,
                rex_memory=rex_memory,
                conversation_id=None,
            )
        raise


async def _run_rex_turn(
    message: str,
    hero_id: str,
    household_id: Optional[str],
    app_state: dict[str, Any],
    rex_memory: dict[str, Any],
    conversation_id: Optional[str],
) -> RexAgentResponse:
    config = _make_rex_config(hero_id, conversation_id)

    async with Agent(config) as agent:
        active_id = agent.conversation_id
        # Seed state for the tools via request_state registry
        request_state.seed(
            active_id,
            app_state=app_state,
            rex_memory=rex_memory,
            hero_id=hero_id,
            household_id=household_id,
        )
        try:
            full_prompt = _context_preamble(app_state, rex_memory) + message
            response = await agent.chat(full_prompt)

            # Persist conversation_id back to Firestore asynchronously
            try:
                save_conversation_id(
                    hero_id=hero_id,
                    household_id=household_id,
                    conversation_id=agent.conversation_id,
                    save_dir_base=AGY_SAVE_DIR_BASE,
                )
            except Exception as exc:  # noqa: BLE001
                print(f"⚠️  [Rex] Could not save conversation id: {exc}")

            # Check for budget violations
            budget_stop_reasons = {
                types.StopReason.MAX_MODEL_CALLS_EXCEEDED,
                types.StopReason.MAX_TOOL_CALLS_EXCEEDED,
                types.StopReason.MAX_INPUT_TOKENS_EXCEEDED,
                types.StopReason.MAX_OUTPUT_TOKENS_EXCEEDED,
                types.StopReason.MAX_TOTAL_TOKENS_EXCEEDED,
            }
            if response.stop_reason in budget_stop_reasons:
                print(f"⚠️  [Rex] Budget limit hit: {response.stop_reason}")
                return FALLBACK_REPLY

            # Parse structured output
            data = await response.structured_output()
            if data:
                return RexAgentResponse(**data)

            # Fallback to response text if structured output parsing returned None
            raw_text = await response.text()
            if raw_text:
                return RexAgentResponse(
                    reply=raw_text.strip()[:200],
                    emotion="excited",
                    voice_tone="energetic",
                )
            return FALLBACK_REPLY
        finally:
            request_state.clear(active_id)
