"""
Soniox async speech-to-text client (REST, via httpx).

Flow:  upload file -> create transcription -> poll -> fetch transcript
       -> delete transcription + file (always, in `finally`: we do not keep audio).

Docs: https://docs.soniox.com/stt/async/async-transcription
"""

import asyncio
import time
from typing import Optional

import httpx

from app.config import settings


class VoiceError(Exception):
    """Raised for any speech/LLM vendor failure; `user_message` is safe to show."""

    def __init__(self, user_message: str, *, detail: str = "", status_code: int = 502):
        super().__init__(detail or user_message)
        self.user_message = user_message
        self.status_code = status_code


def _headers() -> dict:
    return {"Authorization": f"Bearer {settings.soniox_api_key}"}


async def _safe_delete(client: httpx.AsyncClient, path: str) -> None:
    try:
        await client.delete(path, headers=_headers())
    except Exception:  # best-effort cleanup; Soniox also auto-deletes after 30 days
        pass


async def transcribe(
    audio: bytes,
    *,
    filename: str = "voice.m4a",
    content_type: str = "audio/mp4",
    language_hints: Optional[list[str]] = None,
    context: Optional[dict] = None,
) -> str:
    """Return the transcript text for `audio`. Raises VoiceError on failure."""
    if not settings.soniox_api_key:
        raise VoiceError("Voice entry is not configured.", status_code=503)

    hints = language_hints or ["mr", "hi", "en"]
    file_id: Optional[str] = None
    transcription_id: Optional[str] = None

    async with httpx.AsyncClient(base_url=settings.soniox_base_url, timeout=30.0) as client:
        try:
            up = await client.post(
                "/v1/files",
                headers=_headers(),
                files={"file": (filename, audio, content_type)},
            )
            if up.status_code >= 400:
                raise VoiceError("Could not process the recording.", detail=f"soniox upload {up.status_code}: {up.text[:200]}")
            file_id = up.json()["id"]

            body: dict = {
                "model": settings.soniox_model,
                "file_id": file_id,
                "language_hints": hints,
            }
            if context:
                body["context"] = context
            cr = await client.post("/v1/transcriptions", headers=_headers(), json=body)
            if cr.status_code >= 400:
                raise VoiceError("Could not process the recording.", detail=f"soniox create {cr.status_code}: {cr.text[:200]}")
            transcription_id = cr.json()["id"]

            deadline = time.monotonic() + settings.voice_stt_timeout_seconds
            delay = 0.5
            while True:
                st = await client.get(f"/v1/transcriptions/{transcription_id}", headers=_headers())
                if st.status_code >= 400:
                    raise VoiceError("Could not process the recording.", detail=f"soniox status {st.status_code}")
                data = st.json()
                status = data.get("status")
                if status == "completed":
                    break
                if status == "error":
                    raise VoiceError(
                        "Could not understand the recording. Please try again.",
                        detail=f"soniox error: {data.get('error_type')} {data.get('error_message')}",
                    )
                if time.monotonic() > deadline:
                    raise VoiceError("Processing took too long. Please try again.", detail="soniox poll timeout", status_code=504)
                await asyncio.sleep(delay)
                delay = min(delay * 1.4, 2.0)

            tr = await client.get(f"/v1/transcriptions/{transcription_id}/transcript", headers=_headers())
            if tr.status_code >= 400:
                raise VoiceError("Could not process the recording.", detail=f"soniox transcript {tr.status_code}")
            return (tr.json().get("text") or "").strip()
        except httpx.HTTPError as exc:
            raise VoiceError("Network problem while processing the recording.", detail=str(exc)) from exc
        finally:
            # Transcription must be removed before/independently of the file (file delete
            # is only safe once the job finished — it has, or we are bailing out).
            if transcription_id:
                await _safe_delete(client, f"/v1/transcriptions/{transcription_id}")
            if file_id:
                await _safe_delete(client, f"/v1/files/{file_id}")
