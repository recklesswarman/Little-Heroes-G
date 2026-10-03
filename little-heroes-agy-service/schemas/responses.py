"""
schemas/responses.py
────────────────────
Pydantic response schema for Rex Agent structured output.
Every Rex reply is a typed RexAgentResponse — the JS frontend
renders animations, triggers navigation, and speaks the reply.
"""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


class RexAgentResponse(BaseModel):
    """Structured response Rex always returns.

    The JS app reads each field to drive UI, voice, and navigation.
    """

    reply: str = Field(
        description=(
            "What Rex says aloud. Keep it short and playful for toddlers "
            "(1-2 sentences max). Use the child's name if known."
        )
    )

    emotion: str = Field(
        default="excited",
        description=(
            "Rex's current emotion, used to drive facial animation. "
            "One of: 'excited' | 'proud' | 'calm' | 'curious' | 'sleepy' | 'silly'"
        )
    )

    voice_tone: str = Field(
        default="energetic",
        description=(
            "How Rex should sound in TTS. "
            "One of: 'energetic' | 'gentle' | 'whisper' | 'dramatic' | 'warm'"
        )
    )

    suggested_action: Optional[str] = Field(
        default=None,
        description=(
            "Optional deep-link action the app should trigger after Rex speaks. "
            "Format: 'navigate:<viewName>' | 'launch:<feature>' | 'open:<section>'. "
            "Examples: 'navigate:quest_map', 'launch:battle', 'open:bedtime'"
        )
    )

    story_chapter: Optional[str] = Field(
        default=None,
        description=(
            "For Bedtime Narrator agent only: the next story segment text. "
            "Null for all other agents."
        )
    )

    parent_note: Optional[str] = Field(
        default=None,
        description=(
            "A brief note surfaced in the Parent Portal. "
            "Use for praise ('Alex brushed for 3 days straight!') or gentle flags. "
            "Null if nothing notable to report."
        )
    )

    habit_awarded: Optional[str] = Field(
        default=None,
        description=(
            "habitId to auto-award if Rex wants to recognise a habit completion. "
            "Requires parent auto-approve setting. Null if no award this turn."
        )
    )
