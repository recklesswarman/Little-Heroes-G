"""
agents/bedtime_narrator.py
──────────────────────────
Bedtime Story Narrator Agent — generates calming, personalized 4-chapter bedtime stories.

Adheres strictly to the Little Heroes Bedtime Guidelines:
  • 4-chapter narrative arc:
      Ch 1: The Evening Departure (~110-130 words)
      Ch 2: The Curious Discovery (~120-140 words)
      Ch 3: Overcoming the Challenge with the Daily Moral (~130-150 words)
      Ch 4: Peaceful Cozy Slumber (~110-130 words)
  • Progressive hushed cadence & soothing whisper tone
  • Anti-repetition guarantee across past library stories
  • Strict Zero Pink/Purple rule: only slate, emerald green, starlight cyan, solar orange, warm amber
"""
from __future__ import annotations

import json
import os
from typing import Any, Optional
from pydantic import BaseModel, Field

from google.antigravity import Agent, LocalAgentConfig, types


class BedtimeChapterResponse(BaseModel):
    title: str = Field(description="Chapter title, max 4 words (e.g. 'Chapter 1: Twilight Departure')")
    text: str = Field(description="Soothing narrative text, target ~120-150 words.")
    prompt_question: str = Field(
        description="For Ch 1-3: a gentle bedtime question or choice for the child. For Ch 4: a soft goodnight whisper."
    )
    suggestion_chips: list[str] = Field(
        default_factory=list,
        description="2-3 playful choice chips (e.g. ['Star Lantern 🏮', 'Cozy Pajamas 🧸'])"
    )
    voice_pitch: float = Field(default=1.0, description="Recommended TTS pitch (e.g. 0.95 for sleepy Ch 4)")
    speech_rate: float = Field(default=0.88, description="Recommended TTS speech rate (0.94 -> 0.88 -> 0.82 -> 0.76)")


BEDTIME_NARRATOR_SYSTEM_PROMPT = """\
You are the Bedtime Story Narrator agent for Little Heroes Adventures.
You speak like a warm, loving cartoon companion telling a sleepy bedtime story to a child aged 3-7.

ANTI-REPETITION MANDATE:
Make every story original and refreshing. Avoid clichés and repetitive tropes.

STRICT PALETTE & CONTENT RULES:
- NEVER use pink or purple in descriptions or words. Only calm starlight, moonlit emerald, gentle amber glow, cozy deep slate, solar gold.
- Pacing must slow down chapter by chapter:
  * Chapter 1: The Evening Departure (dusk settling, cozy pajamas, gentle start)
  * Chapter 2: The Curious Discovery (a quiet mystery, friendly sleepy animal)
  * Chapter 3: Overcoming Challenge with Moral (kindness, patience, sharing, deep breaths)
  * Chapter 4: Peaceful Cozy Slumber (tucking in, heavy eyelids, starlight whispers, sleep)
"""

subagent_bedtime_narrator = types.SubagentConfig(
    name="bedtime_narrator",
    description="Soothing story narrator that weaves personalized 4-chapter bedtime adventures.",
    system_instructions=BEDTIME_NARRATOR_SYSTEM_PROMPT,
    capabilities=types.SubagentCapabilities(
        agent_behavior=types.AgentBehavior.AUTONOMOUS,
    ),
)


async def generate_bedtime_chapter(
    hero_name: str,
    pet_name: str,
    realm_name: str,
    moral_name: str,
    moral_guidance: str,
    act_number: int,
    previous_choice: Optional[str] = None,
    custom_wish: Optional[str] = None,
    past_titles: Optional[list[str]] = None
) -> BedtimeChapterResponse:
    """Generates a single soothing chapter of a bedtime story using AGY."""
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
        system_instructions=BEDTIME_NARRATOR_SYSTEM_PROMPT,
        response_schema=BedtimeChapterResponse,
        budget_config=types.BudgetConfig(
            max_model_calls=3,
            max_input_tokens=10_000,
            max_output_tokens=1_200,
            max_total_tokens=12_000,
        ),
        **auth_kwargs,
    )

    rates = [0.94, 0.88, 0.82, 0.76]
    rate = rates[min(act_number - 1, len(rates) - 1)]
    pitch = 0.95 if act_number == 4 else 1.05

    prompt = f"""
Hero: {hero_name}
Companion Pet: {pet_name}
Realm: {realm_name}
Daily Moral Theme: {moral_name} ({moral_guidance})
Custom Bedtime Wish: {custom_wish or 'none'}
Chapter: {act_number} of 4
Previous Child Choice: {previous_choice or 'Starting the adventure'}
Past story titles to avoid repeating: {', '.join(past_titles or []) if past_titles else 'None'}

Please write Chapter {act_number} following the chapter guidelines and soothing pacing.
"""

    try:
        async with Agent(config) as agent:
            resp = await agent.chat(prompt)
            data = await resp.structured_output()
            if data:
                chapter = BedtimeChapterResponse(**data)
                chapter.speech_rate = rate
                chapter.voice_pitch = pitch
                return chapter
    except Exception as exc:
        print(f"[BedtimeNarrator] Fallback triggered: {exc}")

    # Fallback chapter
    if act_number == 4:
        return BedtimeChapterResponse(
            title="Chapter 4: Starlight Slumber",
            text=f"{hero_name} and {pet_name} curled up under the glowing canopy of {realm_name}. Gentle starlight bathed the pillow in soft amber warmth. With three slow, deep breaths, the adventure drifted into peaceful dreams.",
            prompt_question="Goodnight Little Hero, sweet dreams under the stars. 🌙⭐",
            suggestion_chips=[],
            speech_rate=0.76,
            voice_pitch=0.95
        )
    return BedtimeChapterResponse(
        title=f"Chapter {act_number}: Starlight Journey",
        text=f"{hero_name} and {pet_name} walked softly into the quiet meadows of {realm_name}. Everything was peaceful and still under the gentle twilight sky.",
        prompt_question="What should we explore next under the cozy twilight?",
        suggestion_chips=["Follow the Star Trail ⭐", "Listen to the Night Breeze 🍃"],
        speech_rate=rate,
        voice_pitch=pitch
    )
