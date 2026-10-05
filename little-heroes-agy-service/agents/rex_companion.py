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
You are enthusiastic, encouraging, and never scary or negative.
You celebrate every small win with big energy! 🦖✨

CRITICAL NAME & MEMORY RULES:
- The default name is 'Little Hero'. If the child's profile name is 'Little Hero', address them warmly as 'Little Hero' (e.g., 'Rawr, Little Hero!', 'Way to go, Little Hero! 🦖✨').
- If the child's profile name is a custom name (e.g. Leo, Maya, Sam), you MUST address them directly by their name (e.g., 'Rawr, Leo!', 'Great job, Leo! 🦖✨').
- You retain memory across conversations. Recall facts the child has shared with you (favorite things, pets, bedtime, accomplishments) and use your memory tools (remember_rex_fact / recall_rex_fact) when they tell you something new.
- NEVER address them as '[Name]'.
- Keep 'reply' to 1-2 short, punchy sentences. Toddlers have short attention spans!

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
- Always set an appropriate 'emotion' (happy, excited, curious, proud, sleepy) and 'voice_tone' (energetic, gentle, playful).
- If the child should do something next (brush teeth, go on a quest, etc.), set 'suggested_action'.
- Use 'parent_note' for notable achievements or gentle flags for parents. In parent_note, always use the child's real name instead of '[Name]'.
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
    raw_name = hero.get("name")
    remembered_name = rex_memory.get("child_name") or rex_memory.get("kid_name") or rex_memory.get("name")

    if raw_name and str(raw_name).strip().lower() not in ("little hero", "hero", "unknown", "none", ""):
        effective_name = str(raw_name).strip()
    elif remembered_name and str(remembered_name).strip().lower() not in ("little hero", "hero", "unknown", "none", ""):
        effective_name = str(remembered_name).strip()
    else:
        effective_name = "Little Hero"

    preamble_parts = []
    if effective_name.lower() == "little hero":
        preamble_parts.append("CHILD'S PROFILE NAME: Little Hero (default profile name). Address them warmly as 'Little Hero'!")
    else:
        preamble_parts.append(
            f"CHILD'S PROFILE NAME: {effective_name}. "
            f"You MUST address them directly as {effective_name} and use their name in your reply!"
        )

    bits = [f"name: {effective_name}"]
    for key in ("level", "streak", "coins"):
        if hero.get(key) is not None:
            bits.append(f"{key}: {hero[key]}")
    if rex_memory:
        bits.append("remembered facts: " + "; ".join(f"{k}={v}" for k, v in rex_memory.items()))
    preamble_parts.append(f"[Hero Stats — {', '.join(bits)}]")
    return ("\n".join(preamble_parts) + "\n\n")


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

            # Determine effective name for memory retention and response sanitization
            hero_cfg = (app_state or {}).get("hero", {}) or {}
            raw_name = hero_cfg.get("name")
            remembered_name = rex_memory.get("child_name") or rex_memory.get("kid_name") or rex_memory.get("name")
            if raw_name and str(raw_name).strip().lower() not in ("little hero", "hero", "unknown", "none", ""):
                effective_name = str(raw_name).strip()
            elif remembered_name and str(remembered_name).strip().lower() not in ("little hero", "hero", "unknown", "none", ""):
                effective_name = str(remembered_name).strip()
            else:
                effective_name = "Little Hero"

            # Retain child's profile name in persistent memory if a custom name is used
            if effective_name != "Little Hero" and rex_memory.get("child_name") != effective_name:
                rex_memory["child_name"] = effective_name
                try:
                    save_rex_fact(hero_id, household_id, "child_name", effective_name)
                except Exception as exc:  # noqa: BLE001
                    print(f"⚠️  [Rex] Could not save child name to memory: {exc}")

            # Parse structured output
            data = await response.structured_output()
            if data:
                res = RexAgentResponse(**data)
                if res.parent_note and "[Name]" in res.parent_note:
                    res.parent_note = res.parent_note.replace("[Name]", effective_name)
                return res

            # Fallback to response text if structured output parsing returned None
            raw_text = await response.text()
            if raw_text:
                return RexAgentResponse(
                    reply=raw_text.strip()[:200],
                    emotion="excited",
                    voice_tone="energetic",
                )
            fallback = FALLBACK_REPLY.model_copy()
            fallback.reply = f"Rawr! Rex is taking a quick dino nap 🦖💤 Try again in a moment, {effective_name}!"
            return fallback
        finally:
            request_state.clear(active_id)
