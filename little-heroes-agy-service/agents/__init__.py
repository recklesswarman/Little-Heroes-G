"""agents/__init__.py"""
from .rex_companion import chat_with_rex, FALLBACK_REPLY
from .battle_coach import get_battle_coach_advice, BattleCoachResponse, subagent_battle_coach
from .quest_guide import get_quest_guidance, QuestGuideResponse, subagent_quest_guide
from .bedtime_narrator import generate_bedtime_chapter, BedtimeChapterResponse, subagent_bedtime_narrator
from .parent_intelligence import generate_developmental_report, DevelopmentalReportResponse

__all__ = [
    "chat_with_rex",
    "FALLBACK_REPLY",
    "get_battle_coach_advice",
    "BattleCoachResponse",
    "subagent_battle_coach",
    "get_quest_guidance",
    "QuestGuideResponse",
    "subagent_quest_guide",
    "generate_bedtime_chapter",
    "BedtimeChapterResponse",
    "subagent_bedtime_narrator",
    "generate_developmental_report",
    "DevelopmentalReportResponse",
]
