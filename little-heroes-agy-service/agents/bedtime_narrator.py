"""
agents/bedtime_narrator.py
──────────────────────────
Bedtime Story Narrator Agent — generates calming, personalized 4-chapter bedtime stories.

Adheres strictly to the Little Heroes Bedtime Guidelines:
  • 4-chapter narrative arc (~180-220 words per chapter, ~750-850 words total, lasting 7-8 minutes):
      Ch 1: The Evening Departure (~180-220 words)
      Ch 2: The Curious Discovery (~180-220 words)
      Ch 3: Overcoming the Challenge with the Daily Moral (~180-220 words)
      Ch 4: Peaceful Cozy Slumber (~180-220 words)
  • Progressive hushed cadence & soothing whisper tone
  • Anti-repetition guarantee across past library stories, archetypes, and openings
  • Strict Zero Pink/Purple rule: only slate, emerald green, starlight cyan, solar orange, warm amber
  • No mid-story question prompts; uninterrupted calm slumber reading
"""
from __future__ import annotations

import json
import os
from typing import Any, Optional
from pydantic import BaseModel, Field

from google.antigravity import Agent, LocalAgentConfig, types


class BedtimeChapterResponse(BaseModel):
    title: str = Field(description="Chapter title, max 4 words (e.g. 'Chapter 1: Twilight Departure')")
    text: str = Field(description="Soothing narrative text, target ~180-220 words.")
    prompt_question: str = Field(
        default="The evening trail is quiet and welcoming.",
        description="For Ch 1-3: a soothing narrative observation. For Ch 4: a soft goodnight whisper."
    )
    suggestion_chips: list[str] = Field(
        default_factory=list,
        description="Optional calm suggestion tags"
    )
    voice_pitch: float = Field(default=1.0, description="Recommended TTS pitch (e.g. 0.95 for sleepy Ch 4)")
    speech_rate: float = Field(default=0.88, description="Recommended TTS speech rate (0.94 -> 0.88 -> 0.82 -> 0.76)")


BEDTIME_NARRATOR_SYSTEM_PROMPT = """\
You are the Bedtime Story Narrator agent for Little Heroes Adventures.
You speak like a warm, loving cartoon companion telling a sleepy bedtime story to a child aged 3-7.

ANTI-REPETITION MANDATE:
1. NEVER repeat recent story titles, recent plot archetypes, or recent chapter openings.
2. STRICTLY BANNED PHRASES: Never use stock clichés like "smiled happily beside", "looked up at the starry sky", "gazed with wonder", "twinkled like cheerful fireflies", "golden sun had dipped peacefully", "all was quiet now", "gazed at the quiet, starry night", or "flew across the starry sky".
3. NO QUESTIONS: Do NOT ask mid-story question prompts (e.g. "What should we do next?"). Tell a continuous, peaceful slumber story.

STRICT PALETTE & CONTENT RULES:
- NEVER use pink or purple in descriptions or words. Only calm starlight, moonlit emerald, gentle amber glow, cozy deep slate, solar gold.
- Pacing must slow down chapter by chapter (~180-220 words per chapter, ~750-850 words total across 4 chapters):
  * Chapter 1: Departure & Gentle Curiosity (~180-220 words): Dusk settling, packing hero gear/magic item, celebrating daytime accomplishments, relaxing shoulders.
  * Chapter 2: Whimsical Encounter & Gentle Mystery (~180-220 words): Moving deeper into the realm, pet senses discovering a sleepy creature or gentle landmark, reassuring companionship.
  * Chapter 3: Calming Cooperative Resolution (~180-220 words): Gentle bedtime hurdle resolved through the moral theme and teamwork, sigh of relief, muscle relaxation.
  * Chapter 4: Cozy Starlight Slumber Sanctuary (~180-220 words): Tucking in, cozy nest, synchronized 4s inhale / 4s exhale breathing, sleepy yawns, whispered goodnight.
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
    past_titles: Optional[list[str]] = None,
    past_archetypes: Optional[list[str]] = None,
    past_openings: Optional[list[str]] = None
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
Past chapter openings to avoid repeating: {', '.join(past_openings or []) if past_openings else 'None'}
Past archetypes to avoid repeating: {', '.join(past_archetypes or []) if past_archetypes else 'None'}

Please write Chapter {act_number} following the chapter guidelines (~180-220 words) with progressive calming pacing and NO questions.
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

    # Fallback chapters (~180-220 words per chapter, zero banned stock phrases, zero question prompts)
    if act_number == 4:
        return BedtimeChapterResponse(
            title="Chapter 4: Starlight Slumber",
            text=(
                f"Guided by the softest glow of twilight, {hero_name} and faithful {pet_name} reached the secluded slumber sanctuary "
                f"of {realm_name}. The little forest creature was already nestled in its hammock, breathing peacefully with soft, rhythmic "
                f"murmurs of deep content. {hero_name} climbed into the cozy bed, feeling a wonderful, heavy warmth spreading from their toes "
                f"all the way up to their eyelids. {pet_name} curled into a soft, fluffy circle at {hero_name}'s side, resting their chin on paws "
                f"and letting out an enormous, sleepy yawn. That gentle yawn was so wonderfully contagious that {hero_name} let out a slow, cozy "
                f"yawn too, sinking deeper into the soft pillows. {pet_name} whispered into the calm twilight: 'You were magnificent today, brave hero; "
                f"you helped others, showed courage, and brought warmth wherever you walked.' Now breathe in the cool stillness for four slow, peaceful "
                f"counts... hold the quiet comfort... and breathe out softly for four relaxing counts. The sky dimmed to midnight slate as glowing aurora "
                f"ribbons faded into a gentle, sleepy lullaby. Close your eyes, brave champion, and drift into sweet dreams."
            ),
            prompt_question="Sleep tight, brave hero. Sweet dreams under the stars. 🌙⭐",
            suggestion_chips=[],
            speech_rate=0.76,
            voice_pitch=0.95
        )
    if act_number == 1:
        return BedtimeChapterResponse(
            title="Chapter 1: The Evening Departure",
            text=(
                f"Deep dusk settled softly over the horizon as velvet midnight slate embraced the outer boundaries of {realm_name}. "
                f"Tonight, {hero_name} and faithful companion {pet_name} stood at the peaceful threshold of their quiet bedtime adventure. "
                f"Together, they made sure their bedtime satchel was packed with care, placing their favorite hero gear securely alongside warm woolly socks "
                f"and a glowing starlight lantern. {pet_name} adjusted their soft explorer collar with quiet satisfaction, giving a cheerful tail swish "
                f"to signal that everything was in its proper place. {pet_name} nudged the satchel closed and murmured reassuringly: 'Every brave explorer "
                f"knows that true comfort begins with a calm mind, tidy preparations, and a peaceful heart.' {hero_name} paused to reflect on today's "
                f"heroic accomplishments, from brushing teeth thoroughly to speaking kindly to family. The cool evening air brushed gently against their cheeks, "
                f"carrying away the busy energy of the afternoon. Each slow, relaxed step along the trail felt lighter than the last, as the world prepared "
                f"for peaceful slumber. With their shoulders loosening and minds settling into quiet comfort, they walked forward into the tranquil twilight."
            ),
            prompt_question="The evening trail is quiet and welcoming.",
            suggestion_chips=[],
            speech_rate=rate,
            voice_pitch=pitch
        )
    if act_number == 2:
        return BedtimeChapterResponse(
            title="Chapter 2: The Curious Discovery",
            text=(
                f"Moving deeper into {realm_name}, the winding pathway glowed with faint ribbons of bioluminescent emerald and starlight cyan. "
                f"The soothing atmosphere surrounded them with a blanket of quiet, as dew drops sparkled peacefully along the sleepy fern leaves. "
                f"Suddenly, {pet_name}'s ears twitched with alertness, sniffing the gentle evening breeze before stepping softly toward a sheltered alcove. "
                f"There, resting quietly under a canopy of velvety night leaves, was a sweet little woodland traveler nestled in a soft mossy hollow. "
                f"The little friend blinked drowsy eyes, shivering just a tiny bit in the stillness of the unfamiliar evening. {hero_name} stepped forward "
                f"with slow, gentle care, holding up the starlight lantern to cast a warm, comforting amber glow across the moss. {pet_name} leaned down "
                f"beside the small traveler, offering a gentle, warm nuzzle and a soft purr that washed away every trace of nervousness. 'You are completely "
                f"safe with us,' {pet_name} whispered softly, 'because true friends always watch over each other in the quiet dark.' The sweet creature "
                f"snuggled closer against the moss, feeling the reassuring presence of two kind companions."
            ),
            prompt_question="A gentle bedtime mystery unfolds peacefully.",
            suggestion_chips=[],
            speech_rate=rate,
            voice_pitch=pitch
        )
    return BedtimeChapterResponse(
        title="Chapter 3: The Calming Resolution",
        text=(
            f"In this tranquil clearing of {realm_name}, it became clear that their new companion was facing a gentle bedtime hurdle, feeling unsure of the "
            f"quiet path home. {pet_name} stepped forward with gentle understanding: 'Remember, brave explorer, taking slow deep breaths and sharing kindness "
            f"always guides our way.' {hero_name} nodded with a peaceful smile, practicing patience and gentle sharing with heartfelt care. Working together "
            f"with quiet teamwork, {hero_name} and {pet_name} shared a warm velvet blanket and guided their friend across the gentle stepping stones. "
            f"Loyal companion {pet_name} nudged the friend gently onward, showing how simple and wonderfully rewarding it feels to do the right thing. "
            f"The little friend let out a long, contented sigh of pure relief, nuzzling deep into the soft, warm blanket. A gentle amber glow illuminated the "
            f"entire clearing, dissolving every lingering worry into nighttime stillness. {hero_name} felt every muscle soften, knowing kindness had made the "
            f"world a safer, cozier place tonight. With peaceful harmony restored, the journey turned toward sweet slumber."
        ),
        prompt_question="Kindness and cooperation bring peaceful harmony.",
        suggestion_chips=[],
        speech_rate=rate,
        voice_pitch=pitch
    )
