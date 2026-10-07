"""
main.py
───────
Little Heroes AGY Microservice — FastAPI entry point.

Endpoints:
  POST /api/rex/chat          — child speaks to Rex (persistent memory, app-aware, structured response)
  POST /api/rex/battle-coach  — tactical brushing tips & villain counter-moves during boss battles
  POST /api/rex/quest-guide   — navigates Path of Valor & World Adventure Map waypoints
  POST /api/rex/bedtime-story — generates soothing 4-chapter bedtime stories
  POST /api/rex/parent-report — synthesizes weekly 4-Pillar Developmental Growth Reports
  POST /api/rex/proactive     — evaluates time-based/event-based proactive nudges
  GET  /health                — Cloud Run health check
"""
from __future__ import annotations

import json
import os
import traceback
from typing import Any, Optional

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agents import (
    chat_with_rex,
    chat_with_rex_audio,
    FALLBACK_REPLY,
    get_battle_coach_advice,
    BattleCoachResponse,
    get_quest_guidance,
    QuestGuideResponse,
    generate_bedtime_chapter,
    BedtimeChapterResponse,
    generate_developmental_report,
    DevelopmentalReportResponse,
)
from triggers import evaluate_proactive_trigger, ProactiveTriggerResult

load_dotenv()

app = FastAPI(
    title="Little Heroes AGY Rex Multi-Agent Service",
    description="Persistent AI Companions and Multi-Agent Orchestration powered by Google Antigravity SDK",
    version="2.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "https://little-heroes-quest-8842.web.app",
        "https://little-heroes-quest-8842.firebaseapp.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response Models ────────────────────────────────────────────────

class RexChatRequest(BaseModel):
    message: str = Field(..., description="The child's spoken or typed message.")
    heroId: Optional[str] = Field(None, description="Unique hero profile ID.")
    childId: Optional[str] = Field(None, description="Alias for heroId.")
    hero_id: Optional[str] = Field(None, description="Snake-case alias for heroId.")
    child_id: Optional[str] = Field(None, description="Snake-case alias for childId.")
    heroName: Optional[str] = Field(None, description="The child's real name (e.g. Leo).")
    childName: Optional[str] = Field(None, description="Alias for heroName.")
    householdId: Optional[str] = Field(None, description="Firestore household doc ID.")
    petId: Optional[str] = Field("rex", description="Active pet ID for voice selection.")
    appState: dict[str, Any] = Field(
        default_factory=dict,
        description="Live snapshot of the hero's app state from the JS frontend.",
    )


class RexChatResponse(BaseModel):
    reply: str
    emotion: str
    voiceTone: str
    suggestedAction: Optional[str] = None
    storyChapter: Optional[str] = None
    parentNote: Optional[str] = None
    habitAwarded: Optional[str] = None
    userTranscript: Optional[str] = None


class BattleCoachRequest(BaseModel):
    bossId: str
    bossHpPercent: float = 100.0
    currentQuadrant: int = 1
    cadenceScore: float = 85.0
    equippedWeapon: str = "laser_toothbrush"
    heroName: Optional[str] = "Little Hero"
    childName: Optional[str] = None


class QuestGuideRequest(BaseModel):
    heroName: str = "Little Hero"
    level: int = 1
    completedWaypoints: list[str] = Field(default_factory=list)
    currentWaypointId: Optional[str] = None


class BedtimeStoryRequest(BaseModel):
    heroName: str = "Little Hero"
    petName: str = "Rex"
    realmName: str = "Dino Star Meadow"
    moralName: str = "Patience & Deep Breaths"
    moralGuidance: str = "Taking slow breaths helps our minds feel peaceful"
    actNumber: int = 1
    previousChoice: Optional[str] = None
    customWish: Optional[str] = None
    pastTitles: list[str] = Field(default_factory=list)


class ParentReportRequest(BaseModel):
    childName: str = "The Little Heroes Household"
    weekLabel: str = "This Week"
    metricsSummary: dict[str, Any] = Field(default_factory=dict)


class ProactiveCheckinRequest(BaseModel):
    triggerType: str = Field("bedtime_checkin", description="'bedtime_checkin' | 'morning_streak' | 'weekly_recap'")
    heroName: str = "Little Hero"
    streak: int = 1
    brushedEveningToday: bool = False
    brushedMorningToday: bool = False
    completedQuestsCount: int = 0
    bossesDefeatedCount: int = 0


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
@app.get("/api/rex/health")
async def health():
    return {"status": "ok", "service": "little-heroes-rex-agy", "version": "2.0.0"}


@app.post("/api/rex/chat", response_model=RexChatResponse)
async def rex_chat(req: RexChatRequest):
    """Primary child-companion conversation with persistent memory per hero."""
    hero_id = req.heroId or req.childId or req.hero_id or req.child_id or "hero_guest"
    kid_name = req.heroName or req.childName
    app_state = req.appState or {}
    if kid_name:
        if "hero" not in app_state:
            app_state["hero"] = {}
        app_state["hero"]["name"] = kid_name
    elif "hero" not in app_state or not app_state["hero"].get("name"):
        if "hero" not in app_state:
            app_state["hero"] = {}
        app_state["hero"]["name"] = "Little Hero"

    try:
        result = await chat_with_rex(
            message=req.message,
            hero_id=hero_id,
            household_id=req.householdId,
            app_state=app_state,
        )
        if result.parent_note and ("error" in result.parent_note.lower() or "402" in result.parent_note):
            raise HTTPException(
                status_code=503,
                detail=f"Rex companion service unavailable: {result.parent_note[:200]}",
            )
        return RexChatResponse(
            reply=result.reply,
            emotion=result.emotion,
            voiceTone=result.voice_tone,
            suggestedAction=result.suggested_action,
            storyChapter=result.story_chapter,
            parentNote=result.parent_note,
            habitAwarded=result.habit_awarded,
        )
    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        print(f"❌ [Rex] Unhandled error: {exc}")
        raise HTTPException(
            status_code=503,
            detail=f"Rex companion service unavailable: {str(exc)[:200]}",
        )


@app.post("/api/rex/audio", response_model=RexChatResponse)
async def rex_audio(
    audio: UploadFile = File(...),
    heroId: Optional[str] = Form(None),
    childId: Optional[str] = Form(None),
    heroName: Optional[str] = Form(None),
    childName: Optional[str] = Form(None),
    householdId: Optional[str] = Form(None),
    petId: Optional[str] = Form("rex"),
    appState: Optional[str] = Form(None),
):
    """Multimodal audio endpoint: streams child's voice directly to Google Antigravity Rex agent."""
    hero_id = heroId or childId or "hero_guest"
    kid_name = heroName or childName
    parsed_app_state = {}
    if appState:
        try:
            parsed_app_state = json.loads(appState)
        except Exception:
            parsed_app_state = {}

    if kid_name:
        if "hero" not in parsed_app_state:
            parsed_app_state["hero"] = {}
        parsed_app_state["hero"]["name"] = kid_name
    elif "hero" not in parsed_app_state or not parsed_app_state["hero"].get("name"):
        if "hero" not in parsed_app_state:
            parsed_app_state["hero"] = {}
        parsed_app_state["hero"]["name"] = "Little Hero"

    audio_bytes = await audio.read()
    mime_type = audio.content_type or "audio/webm"

    try:
        result = await chat_with_rex_audio(
            audio_bytes=audio_bytes,
            mime_type=mime_type,
            hero_id=hero_id,
            household_id=householdId,
            app_state=parsed_app_state,
        )
        return RexChatResponse(
            reply=result.reply,
            emotion=result.emotion,
            voiceTone=result.voice_tone,
            suggestedAction=result.suggested_action,
            storyChapter=result.story_chapter,
            parentNote=result.parent_note,
            habitAwarded=result.habit_awarded,
            userTranscript=result.user_transcript,
        )
    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        print(f"❌ [Rex Audio] Unhandled error: {exc}")
        effective_name = kid_name or "Little Hero"
        return RexChatResponse(
            reply=f"Rawr! Rex heard your super voice, {effective_name}! Let's have fun adventures together! 🦖✨",
            emotion="excited",
            voiceTone="energetic",
            userTranscript="[Spoken voice]",
        )


@app.post("/api/rex/battle-coach", response_model=BattleCoachResponse)
async def battle_coach(req: BattleCoachRequest):
    """Tactical toothbrushing advice and villain counter-moves during boss combat."""
    hero_name = req.heroName or req.childName or "Little Hero"
    return await get_battle_coach_advice(
        boss_id=req.bossId,
        boss_hp_percent=req.bossHpPercent,
        current_quadrant=req.currentQuadrant,
        cadence_score=req.cadenceScore,
        equipped_weapon=req.equippedWeapon,
        hero_name=hero_name,
    )


@app.post("/api/rex/quest-guide", response_model=QuestGuideResponse)
async def quest_guide(req: QuestGuideRequest):
    """Navigates the child across the World Adventure Map and Path of Valor waypoints."""
    return await get_quest_guidance(
        hero_name=req.heroName,
        level=req.level,
        completed_waypoints=req.completedWaypoints,
        current_waypoint_id=req.currentWaypointId,
    )


@app.post("/api/rex/bedtime-story", response_model=BedtimeChapterResponse)
async def bedtime_story(req: BedtimeStoryRequest):
    """Generates a calming, personalized 4-chapter bedtime story chapter."""
    return await generate_bedtime_chapter(
        hero_name=req.heroName,
        pet_name=req.petName,
        realm_name=req.realmName,
        moral_name=req.moralName,
        moral_guidance=req.moralGuidance,
        act_number=req.actNumber,
        previous_choice=req.previousChoice,
        custom_wish=req.customWish,
        past_titles=req.pastTitles,
    )


@app.post("/api/rex/parent-report", response_model=DevelopmentalReportResponse)
async def parent_report(req: ParentReportRequest):
    """Synthesizes a 4-Pillar Developmental Growth Report for the family."""
    return await generate_developmental_report(
        child_name=req.childName,
        week_label=req.weekLabel,
        metrics_summary=req.metricsSummary,
    )


@app.post("/api/rex/proactive", response_model=ProactiveTriggerResult)
async def proactive_checkin(req: ProactiveCheckinRequest):
    """Evaluates bedtime, morning streak, or weekly recap triggers."""
    return await evaluate_proactive_trigger(
        trigger_type=req.triggerType,
        hero_name=req.heroName,
        streak=req.streak,
        brushed_evening_today=req.brushedEveningToday,
        brushed_morning_today=req.brushedMorningToday,
        completed_quests_count=req.completedQuestsCount,
        bosses_defeated_count=req.bossesDefeatedCount,
    )


# ── Dev server ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    is_dev = os.environ.get("ENVIRONMENT", "production") == "development"
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=is_dev)
