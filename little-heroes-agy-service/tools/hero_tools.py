"""
tools/hero_tools.py
────────────────────
AGY custom tools that give Rex full awareness of each child's in-app state.
These tools read live data sent by the JS frontend (passed in app_state dict)
rather than making direct Firestore reads during a Rex turn — keeping latency low.

The JS app sends a snapshot of the relevant hero state with every /api/rex/chat
request, which is injected into ToolContext before the agent starts.

Tools also fall back to Firestore for historical data not in the live snapshot.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from google.antigravity import ToolContext

from . import request_state


# ── Internal helper ──────────────────────────────────────────────────────────

def _get_state(ctx: ToolContext) -> dict:
    """Retrieve the app_state snapshot injected before the agent turn."""
    return request_state.get(ctx, "app_state", {})


def _today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


# ── Hero Profile ─────────────────────────────────────────────────────────────

def get_hero_profile(ctx: ToolContext) -> str:
    """Returns the hero's name, age tier, level, XP, coins, points, and active pet.

    Args:
        ctx: Injected tool context containing the app state snapshot.
    """
    state = _get_state(ctx)
    hero = state.get("hero", {})
    pet = state.get("activePet", {})

    profile = {
        "name": hero.get("name", "Little Hero"),
        "level": hero.get("level", 1),
        "xp": hero.get("xp", 0),
        "xpNext": hero.get("xpNext", 100),
        "points": hero.get("points", 0),
        "coins": hero.get("coins", 0),
        "streak": hero.get("streak", 0),
        "gameDifficulty": hero.get("gameDifficulty", "medium"),
        "activePet": {
            "id": pet.get("id", "rex"),
            "name": pet.get("name", "Rex"),
            "species": pet.get("species", "Dino"),
            "level": pet.get("level", 1),
        },
    }
    return json.dumps(profile)


# ── Quest Progress ────────────────────────────────────────────────────────────

def get_quest_progress(ctx: ToolContext) -> str:
    """Returns the hero's current waypoint on the Path of Valor, completed quests,
    and the next available quest title and description.

    Args:
        ctx: Injected tool context.
    """
    state = _get_state(ctx)
    quests = state.get("questProgress", {})

    result = {
        "currentWaypointId": quests.get("currentWaypointId"),
        "currentWaypointTitle": quests.get("currentWaypointTitle"),
        "completedWaypointCount": quests.get("completedWaypointCount", 0),
        "totalWaypoints": quests.get("totalWaypoints", 10),
        "nextQuestTitle": quests.get("nextQuestTitle"),
        "nextQuestDescription": quests.get("nextQuestDescription"),
        "completedQuestIds": quests.get("completedQuestIds", []),
    }
    return json.dumps(result)


# ── Dental Streaks ───────────────────────────────────────────────────────────

def get_dental_streaks(ctx: ToolContext) -> str:
    """Returns morning and evening brush dates, floss history, mouthwash history,
    and current consecutive streak count.

    Args:
        ctx: Injected tool context.
    """
    state = _get_state(ctx)
    dental = state.get("dentalHabits", {})
    today = _today_str()

    result = {
        "lastBrushedMorning": dental.get("lastBrushedMorning"),
        "lastBrushedEvening": dental.get("lastBrushedEvening"),
        "brushedMorningToday": dental.get("lastBrushedMorning") == today,
        "brushedEveningToday": dental.get("lastBrushedEvening") == today,
        "consecutiveStreak": dental.get("consecutiveStreak", 0),
        "dentalBadges": dental.get("dentalBadges", []),
        "lastFlossDate": dental.get("lastFlossDate"),
        "lastMouthwashDate": dental.get("lastMouthwashDate"),
    }
    return json.dumps(result)


# ── Battle History ───────────────────────────────────────────────────────────

def get_battle_history(ctx: ToolContext) -> str:
    """Returns the hero's last 5 toothbrush boss battles including boss name,
    average cadence score, outcome, and date.

    Args:
        ctx: Injected tool context.
    """
    state = _get_state(ctx)
    battles = state.get("dentalBattleHistory", [])

    # Return last 5 battles most recent first
    recent = sorted(battles, key=lambda b: b.get("timestamp", 0), reverse=True)[:5]
    result = []
    for b in recent:
        result.append({
            "bossId": b.get("bossId", "sugar_bandit"),
            "bossName": b.get("bossName", "Sugar Bandit"),
            "outcome": b.get("outcome", "victory"),
            "avgCadence": b.get("avgCadence", 0),
            "totalScrubHits": b.get("totalScrubHits", 0),
            "durationSec": b.get("durationSec", 120),
            "date": b.get("date"),
        })
    return json.dumps(result)


# ── Pet Vitals ───────────────────────────────────────────────────────────────

def get_pet_vitals(ctx: ToolContext) -> str:
    """Returns the active pet's current vitals: hunger, hygiene, energy, joy,
    evolution stage, and last care action timestamps.

    Args:
        ctx: Injected tool context.
    """
    state = _get_state(ctx)
    pet = state.get("activePet", {})
    vitals = state.get("petVitals", {})

    result = {
        "petId": pet.get("id", "rex"),
        "petName": pet.get("name", "Rex"),
        "hunger": vitals.get("hunger", 75),
        "hygiene": vitals.get("hygiene", 90),
        "energy": vitals.get("energy", 65),
        "joy": vitals.get("joy", 85),
        "evolutionStage": pet.get("evolutionStage", 1),
        "level": pet.get("level", 1),
        "lastBathDate": vitals.get("lastBathDate"),
        "onExpedition": vitals.get("onExpedition", False),
    }
    return json.dumps(result)


# ── Dance & Workout History ───────────────────────────────────────────────────

def get_dance_history(ctx: ToolContext) -> str:
    """Returns recent dance party and dino workout participation for the hero.

    Args:
        ctx: Injected tool context.
    """
    state = _get_state(ctx)
    movement = state.get("movementHistory", [])

    recent = sorted(movement, key=lambda m: m.get("timestamp", 0), reverse=True)[:5]
    result = []
    for m in recent:
        result.append({
            "type": m.get("type", "dance_party"),   # 'dance_party' | 'dino_workout'
            "routineId": m.get("routineId"),
            "routineTitle": m.get("routineTitle"),
            "durationMin": m.get("durationMin", 5),
            "date": m.get("date"),
        })
    return json.dumps({"recentSessions": result, "totalSessions": len(movement)})
