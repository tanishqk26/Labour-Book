"""
Voice entry router.

  POST /api/v1/voice/operations/parse   multipart audio -> operation drafts
  POST /api/v1/voice/attendance/parse   multipart audio -> attendance drafts

The endpoints NEVER save anything: they return drafts that the client shows to
the farmer for confirmation, then saves through the normal APIs.
Audio is held in memory only for the duration of the request; Soniox's copy is
deleted straight after transcription.
"""

import time
from collections import defaultdict, deque
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_current_user
from app.core.voice import glossary
from app.core.voice.attendance import EntityRef, parse_attendance_text
from app.core.voice.operations import PlotRef, parse_operations_text
from app.core.voice.soniox import VoiceError, transcribe
from app.database import get_db
from app.models.labour import Labour
from app.models.plot import Plot
from app.models.plot_operation import PlotOperation
from app.models.team import Team
from app.models.user import User
from app.schemas.voice import VoiceAttendanceParseResponse, VoiceParseResponse

router = APIRouter(prefix="/api/v1/voice", tags=["Voice"])

_IST = timezone(timedelta(hours=5, minutes=30))
_MAX_TERMS = 400

# Simple per-process sliding-window rate limit (per user). Good enough for a
# single Render instance; swap for Redis if the API is ever scaled out.
_hits: dict[str, deque] = defaultdict(deque)


def _check_rate_limit(user_id: str) -> None:
    now = time.monotonic()
    q = _hits[user_id]
    while q and now - q[0] > 3600:
        q.popleft()
    if len(q) >= settings.voice_max_requests_per_hour:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many voice entries this hour. Please try again later.",
        )
    q.append(now)


def _today_ist() -> date:
    return datetime.now(_IST).date()


async def _read_audio(audio: UploadFile, user: User) -> bytes:
    """Availability, size and rate-limit checks shared by every voice endpoint."""
    if not settings.voice_enabled:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Voice entry is not available right now.")
    data = await audio.read(settings.voice_max_audio_bytes + 1)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The recording is empty.")
    if len(data) > settings.voice_max_audio_bytes:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "The recording is too long. Please keep it under 2 minutes.")
    _check_rate_limit(str(user.id))
    return data


async def _recent_product_names(db: AsyncSession, owner_id) -> list[str]:
    rows = (
        await db.execute(
            select(PlotOperation.details)
            .where(PlotOperation.owner_id == owner_id, PlotOperation.details.is_not(None))
            .order_by(PlotOperation.created_at.desc())
            .limit(100)
        )
    ).scalars().all()
    names: list[str] = []
    for d in rows:
        for pr in (d or {}).get("products") or []:
            n = str(pr.get("name") or "").strip() if isinstance(pr, dict) else ""
            if n and n not in names:
                names.append(n)
    return names


@router.get("/status", summary="Is voice entry available?")
async def voice_status(current_user: User = Depends(get_current_user)) -> dict:
    return {"enabled": settings.voice_enabled, "max_bytes": settings.voice_max_audio_bytes}


@router.post(
    "/operations/parse",
    response_model=VoiceParseResponse,
    summary="Turn a voice recording into farm-operation drafts",
)
async def parse_operations_voice(
    audio: UploadFile = File(..., description="Recording (m4a/aac/mp3/wav/webm/ogg)"),
    lang: str = Form("mr", description="UI language for the generated summary: mr | hi | en"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VoiceParseResponse:
    if lang not in ("mr", "hi", "en"):
        lang = "mr"
    data = await _read_audio(audio, current_user)

    # Only this user's active plots are ever shown to the LLM
    plot_rows = (
        await db.execute(
            select(Plot).where(Plot.owner_id == current_user.id, Plot.is_active.is_(True)).order_by(Plot.name)
        )
    ).scalars().all()
    plots = [PlotRef(id=p.id, name=p.name, crop_name=p.crop_name) for p in plot_rows]
    recent_products = await _recent_product_names(db, current_user.id)

    terms = list(dict.fromkeys([p.name for p in plots] + recent_products + glossary.PRODUCTS + glossary.FARM_TERMS))[:_MAX_TERMS]
    stt_context = {
        "general": [
            {"key": "domain", "value": "Grape farming (viticulture) in Maharashtra, India"},
            {"key": "speakers", "value": "Marathi-speaking farmer, mixes English product names"},
        ],
        "text": "Daily farm diary: spraying (फवारणी), fertigation through drip (ड्रिपमधून खत), and labour work on numbered grape plots.",
        "terms": terms,
    }

    try:
        transcript = await transcribe(
            data,
            filename=audio.filename or "voice.m4a",
            content_type=audio.content_type or "audio/mp4",
            language_hints=["mr", "hi", "en"],
            context=stt_context,
        )
        drafts = await parse_operations_text(
            transcript, plots, today=_today_ist(), lang=lang, extra_products=recent_products
        )
    except VoiceError as exc:
        # Detail goes to the server log only; the farmer sees a friendly message.
        print(f"[voice] {exc}")
        raise HTTPException(exc.status_code, exc.user_message)

    warnings: list[str] = []
    if not transcript.strip():
        warnings.append("no_speech")
    elif not drafts:
        warnings.append("no_operations_found")
    return VoiceParseResponse(transcript=transcript, operations=drafts, warnings=warnings)


@router.post(
    "/attendance/parse",
    response_model=VoiceAttendanceParseResponse,
    summary="Turn a voice recording into attendance drafts",
)
async def parse_attendance_voice(
    audio: UploadFile = File(..., description="Recording (m4a/aac/mp3/wav/webm/ogg)"),
    lang: str = Form("mr", description="UI language for the generated summary: mr | hi | en"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VoiceAttendanceParseResponse:
    if lang not in ("mr", "hi", "en"):
        lang = "mr"
    data = await _read_audio(audio, current_user)

    # Only this user's active labourers and teams are ever shown to the LLM
    labours = (
        await db.execute(
            select(Labour).where(Labour.owner_id == current_user.id, Labour.is_active.is_(True)).order_by(Labour.name).limit(300)
        )
    ).scalars().all()
    teams = (
        await db.execute(
            select(Team).where(Team.owner_id == current_user.id, Team.is_active.is_(True)).order_by(Team.name).limit(100)
        )
    ).scalars().all()
    entities = [EntityRef("labour", l.id, l.name) for l in labours] + [EntityRef("team", t.id, t.name) for t in teams]

    terms = list(dict.fromkeys([e.name for e in entities] + glossary.ATTENDANCE_TERMS))[:_MAX_TERMS]
    stt_context = {
        "general": [
            {"key": "domain", "value": "Daily labour attendance on a grape farm in Maharashtra, India"},
            {"key": "speakers", "value": "Marathi-speaking farmer naming workers and labour groups"},
        ],
        "text": "Attendance: who came to work today, who was absent, half day, how many people in a group.",
        "terms": terms,
    }

    try:
        transcript = await transcribe(
            data,
            filename=audio.filename or "voice.m4a",
            content_type=audio.content_type or "audio/mp4",
            language_hints=["mr", "hi", "en"],
            context=stt_context,
        )
        drafts = await parse_attendance_text(transcript, entities, today=_today_ist(), lang=lang)
    except VoiceError as exc:
        print(f"[voice] {exc}")
        raise HTTPException(exc.status_code, exc.user_message)

    warnings: list[str] = []
    if not transcript.strip():
        warnings.append("no_speech")
    elif not drafts:
        warnings.append("no_attendance_found")
    return VoiceAttendanceParseResponse(transcript=transcript, entries=drafts, warnings=warnings)
