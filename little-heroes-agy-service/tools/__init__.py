"""tools/__init__.py"""
from .hero_tools import (
    get_hero_profile,
    get_quest_progress,
    get_dental_streaks,
    get_battle_history,
    get_pet_vitals,
    get_dance_history,
)
from .memory_tools import (
    remember_rex_fact,
    recall_rex_fact,
    list_rex_memories,
)

ALL_REX_TOOLS = [
    get_hero_profile,
    get_quest_progress,
    get_dental_streaks,
    get_battle_history,
    get_pet_vitals,
    get_dance_history,
    remember_rex_fact,
    recall_rex_fact,
    list_rex_memories,
]

__all__ = [
    "get_hero_profile",
    "get_quest_progress",
    "get_dental_streaks",
    "get_battle_history",
    "get_pet_vitals",
    "get_dance_history",
    "remember_rex_fact",
    "recall_rex_fact",
    "list_rex_memories",
    "ALL_REX_TOOLS",
]
