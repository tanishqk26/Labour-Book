"""
Gemini client — structured JSON generation via the generateContent REST API.

The model id comes from settings (GEMINI_MODEL) so it can be swapped without
a code change (3.1 Flash-Lite is scheduled for replacement by 3.5 Flash-Lite
no earlier than May 2027).
"""

import json
from typing import Any

import httpx

from app.config import settings
from app.core.voice.soniox import VoiceError


async def generate_json(system_prompt: str, user_text: str, schema: dict[str, Any]) -> dict:
    """Call Gemini and return the parsed JSON object. Raises VoiceError on failure."""
    if not settings.gemini_api_key:
        raise VoiceError("Voice entry is not configured.", status_code=503)

    url = f"{settings.gemini_base_url}/models/{settings.gemini_model}:generateContent"
    body = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": user_text}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": schema,
        },
    }
    try:
        async with httpx.AsyncClient(timeout=40.0) as client:
            r = await client.post(
                url,
                headers={"x-goog-api-key": settings.gemini_api_key, "Content-Type": "application/json"},
                json=body,
            )
    except httpx.HTTPError as exc:
        raise VoiceError("Network problem while reading the recording.", detail=str(exc)) from exc

    if r.status_code >= 400:
        raise VoiceError("Could not read the recording. Please try again.", detail=f"gemini {r.status_code}: {r.text[:300]}")

    try:
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text)
    except (KeyError, IndexError, ValueError, TypeError) as exc:
        raise VoiceError("Could not read the recording. Please try again.", detail=f"gemini bad payload: {exc}") from exc
