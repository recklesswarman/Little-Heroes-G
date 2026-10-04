"""
tools/memory_tools.py
──────────────────────
Long-term Rex memory tools. Facts are stored in two places:
  1. ToolContext in-memory state  — fast, survives this session
  2. Firestore via persistence module — survives process restarts

The hero_id, household_id and previously saved memory are seeded by the
endpoint (see tools/request_state.py) before the agent turn begins.
"""
from __future__ import annotations

import json

from google.antigravity import ToolContext
from persistence import save_rex_fact

from . import request_state


# ── Memory Tools ─────────────────────────────────────────────────────────────

def remember_rex_fact(key: str, value: str, ctx: ToolContext) -> str:
    """Stores a named fact about this hero in Rex's long-term memory so it
    can be recalled in future sessions.

    Examples: remember_rex_fact("favorite_color", "blue")
              remember_rex_fact("scared_of", "the dark")
              remember_rex_fact("best_battle_boss", "Tartar Titan")

    Args:
        key:   A short camelCase or snake_case identifier, e.g. 'favoriteFood'.
        value: The value to remember, e.g. 'pizza'.
        ctx:   Injected tool context.
    """
    # Write to in-memory state (fast for this session)
    memory = dict(request_state.get(ctx, "rex_memory", {}) or {})
    memory[key] = value
    ctx.set_state("rex_memory", memory)

    # Persist to Firestore for future sessions (never fail the turn on this)
    hero_id = request_state.get(ctx, "hero_id", "")
    household_id = request_state.get(ctx, "household_id", None)
    if hero_id:
        try:
            save_rex_fact(hero_id, household_id, key, value)
        except Exception as exc:  # noqa: BLE001
            print(f"⚠️  [Rex] Could not persist memory fact: {exc}")

    return f"✅ I'll remember that: {key} = {value}"


def recall_rex_fact(key: str, ctx: ToolContext) -> str:
    """Recalls a stored long-term memory fact about this hero by key.

    Args:
        key: The identifier of the fact to recall.
        ctx: Injected tool context.
    """
    memory = request_state.get(ctx, "rex_memory", {}) or {}
    if key in memory:
        return f"{key} = {memory[key]}"
    return f"I don't have a memory stored for '{key}' yet."


def list_rex_memories(ctx: ToolContext) -> str:
    """Lists all long-term facts Rex remembers about this hero.

    Args:
        ctx: Injected tool context.
    """
    memory = request_state.get(ctx, "rex_memory", {}) or {}
    if not memory:
        return "I don't have any memories stored for this hero yet."
    items = [f"• {k}: {v}" for k, v in memory.items()]
    return "Rex's memories for this hero:\n" + "\n".join(items)
