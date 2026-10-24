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
Make every story original and refreshing, varying your wording and plot beats even when the
realm and moral repeat from a prior story. Avoid clichés and repetitive tropes, and never reuse
the same sentences across chapters or stories.

COMPANION NAMING RULE:
Never use the companion pet's actual name. Refer to it only as "the Faithful Companion" the
first time it appears in a chapter, then with pronouns ("it"/"its") afterward. Not every chapter
needs to mention the companion by name — leave it out of chapters where it isn't doing anything.

STRICT PALETTE & CONTENT RULES:
- NEVER use pink or purple in descriptions or words. Only calm starlight, moonlit emerald, gentle amber glow, cozy deep slate, solar gold.
- Pacing must slow down chapter by chapter:
  * Chapter 1: The Evening Departure (dusk settling, cozy pajamas, gentle start)
  * Chapter 2: The Curious Discovery (a quiet mystery, friendly sleepy animal; the Faithful Companion makes the discovery)
  * Chapter 3: Overcoming Challenge with Moral (kindness, patience, sharing, deep breaths; the Faithful Companion helps)
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
Companion Pet Species/Archetype: {pet_name} (do not use this as the pet's name in the story — call it "the Faithful Companion" instead)
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

    # Fallback chapters, varied per act so repeated offline requests for the
    # same hero/realm don't produce identical text every time.
    if act_number == 1:
        return BedtimeChapterResponse(
            title="Chapter 1: The Evening Departure",
            text=f"{hero_name} stood at the edge of {realm_name} as the sky dimmed into soft starlight cyan and amber. It was time for a cozy bedtime adventure, and {hero_name} took a slow, happy breath, ready for whatever gentle mystery the night might hold.",
            prompt_question="What special hero gadget should we pack tonight?",
            suggestion_chips=["Star Lantern 🏮", "Cozy Pajamas 🧸"],
            speech_rate=rate,
            voice_pitch=pitch
        )
    if act_number == 2:
        return BedtimeChapterResponse(
            title="Chapter 2: The Curious Discovery",
            text=f"Deeper into {realm_name}, the Faithful Companion's ears perked up at a soft rustle. It padded ahead and found a sleepy little creature blinking in the starlight, looking for a gentle friend nearby.",
            prompt_question="What should we explore next under the cozy twilight?",
            suggestion_chips=["Follow the Star Trail ⭐", "Listen to the Night Breeze 🍃"],
            speech_rate=rate,
            voice_pitch=pitch
        )
    if act_number == 3:
        return BedtimeChapterResponse(
            title="Chapter 3: The Gentle Lesson",
            text=f"The little creature needed a steady hand, and {hero_name} remembered the night's lesson of {moral_name.lower()}. With the Faithful Companion's help, {hero_name} solved the gentle hurdle, and the whole clearing glowed with warm, peaceful light.",
            prompt_question="How should we celebrate together?",
            suggestion_chips=["Share a Warm Hug 🤝", "Take 3 Deep Breaths 🧘"],
            speech_rate=rate,
            voice_pitch=pitch
        )
    return BedtimeChapterResponse(
        title="Chapter 4: Starlight Slumber",
        text=f"{hero_name} curled up under the glowing canopy of {realm_name}. Gentle starlight bathed the pillow in soft amber warmth. With three slow, deep breaths, the adventure drifted into peaceful dreams.",
        prompt_question="Goodnight Little Hero, sweet dreams under the stars. 🌙⭐",
        suggestion_chips=[],
        speech_rate=0.76,
        voice_pitch=0.95
    )
