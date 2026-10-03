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
  • Lifecycle hooks (session start/end, pre/post turn, tool logging, stop control)
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

from google.antigravity import Agent, LocalAgentConfig, ToolContext, types
from google.antigravity.hooks import hooks

from schemas import RexAgentResponse
from tools import ALL_REX_TOOLS
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

Before answering, ALWAYS check the relevant tools first so your response is personal and specific.
NEVER make up facts about the child — only use what the tools return.

Response rules:
- Keep 'reply' to 1-2 short sentences. Toddlers have short attention spans!
- Always set an appropriate 'emotion' and 'voice_tone' for the situation.
- If the child should do something next (brush teeth, go on a quest, etc.), set 'suggested_action'.
- Use 'parent_note' for notable achievements or gentle flags for parents.
- Only set 'habit_awarded' if you're certain a habit was just completed this session.
"""

# ── Canned fallback reply (returned when budget is hit) ────────────────────────
FALLBACK_REPLY = RexAgentResponse(
    reply="Rawr! Rex is taking a quick dino nap 🦖💤 Try again in a moment, Little Hero!",
    emotion="sleepy",
    voice_tone="gentle",
)


# ── Hooks ─────────────────────────────────────────────────────────────────────

@hooks.on_session_start
async def _on_start():
    print("🟢 [Rex] Session started")


@hooks.on_session_end
async def _on_end():
    print("🔴 [Rex] Session ended — conversation saved")


@hooks.pre_turn
async def _pre_turn(data: str) -> types.HookResult:
    print(f"📨 [Rex] Incoming: {data[:80]}...")
    return types.HookResult(allow=True)


@hooks.post_turn
async def _post_turn(data: str):
    print(f"✅ [Rex] Response ready ({len(data)} chars)")


@hooks.pre_tool_call_decide
async def _pre_tool(data: types.ToolCall) -> types.HookResult:
    print(f"  🔧 [Rex] Tool: {data.name}")
    return types.HookResult(allow=True)


@hooks.on_tool_error
async def _on_tool_error(data: Exception):
    print(f"  ⚠️  [Rex] Tool error: {data}")
    return None  # Let model handle it


@hooks.on_compaction
async def _on_compact(data):
    print("🗜️  [Rex] Context compacted — older turns summarised")


@hooks.stop
async def _on_stop(data: types.StopArgs) -> types.StopHookResult:
    """Ensure Rex always provides a structured reply before stopping."""
    if data.continuation_count == 0 and not data.response_text.strip():
        return types.StopHookResult(
            decision=types.StopDecision.CONTINUE,
            reason="Please provide a friendly Rex reply to the child before finishing.",
        )
    return types.StopHookResult(decision=types.StopDecision.ALLOW_STOP)


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

    return LocalAgentConfig(
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
        ),

        # ── Lifecycle hooks ─────────────────────────────────────
        hooks=[
            _on_start, _on_end,
            _pre_turn, _post_turn,
            _pre_tool, _on_tool_error,
            _on_compact, _on_stop,
        ],

        # ── Context compaction (long sessions) ──────────────────
        compaction_config=types.CompactionConfig(token_threshold=40_000),

        # ── Budget guardrails ────────────────────────────────────
        budget_config=types.BudgetConfig(
            max_model_calls=8,
            max_tool_calls=15,
            max_input_tokens=20_000,
            max_output_tokens=2_000,   # Keep Rex replies short for toddlers
            max_total_tokens=40_000,
        ),
    )


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
    # Load persisted conversation_id and long-term memory
    conversation_id = load_conversation_id(hero_id, household_id, AGY_SAVE_DIR_BASE)
    rex_memory = load_rex_memory(hero_id, household_id)

    config = _make_rex_config(hero_id, conversation_id)

    async with Agent(config) as agent:
        # Inject app state and memory into ToolContext before the agent starts
        # so all tools can read them without extra Firestore calls during the turn
        agent.conversation.set_state("app_state", app_state)
        agent.conversation.set_state("rex_memory", rex_memory)
        agent.conversation.set_state("hero_id", hero_id)
        agent.conversation.set_state("household_id", household_id)

        response = await agent.chat(message)

        # Persist the (possibly new) conversation_id back to Firestore
        save_conversation_id(
            hero_id=hero_id,
            household_id=household_id,
            conversation_id=agent.conversation_id,
            save_dir_base=AGY_SAVE_DIR_BASE,
        )

        # Check for budget violations → return canned fallback
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

        # Graceful fallback if structured output parsing failed
        raw_text = await response.text()
        return RexAgentResponse(
            reply=raw_text[:200] if raw_text else FALLBACK_REPLY.reply,
            emotion="excited",
            voice_tone="energetic",
        )
