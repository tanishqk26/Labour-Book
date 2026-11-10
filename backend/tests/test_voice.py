"""
Voice entry tests.

Soniox and Gemini are faked: these tests cover OUR logic (plot mapping,
date maths, category safety, owner isolation, limits), not the vendors.
Real-audio accuracy is measured with scripts/voice_eval.py.
"""

import uuid
from datetime import date

import pytest
from httpx import AsyncClient

from app.core.voice.operations import PlotRef, build_drafts, match_plots_by_text

pytestmark = pytest.mark.anyio

TODAY = date(2026, 11, 9)


def _plots():
    return [
        PlotRef(id=uuid.uuid4(), name="35"),
        PlotRef(id=uuid.uuid4(), name="36"),
        PlotRef(id=uuid.uuid4(), name="Crimson", crop_name="Grapes"),
    ]


# ---------------------------------------------------------------------------
# Pure logic
# ---------------------------------------------------------------------------

def test_three_example_sentences_become_three_drafts():
    plots = _plots()
    llm = {
        "operations": [
            {"category": "Spraying", "plot_codes": ["P1"], "plot_text": "35", "days_ago": 0,
             "description": "Movento 2 ml, Vitaflora 1 L",
             "products": [{"name": "Movento", "dose": "2 ml"}, {"name": "Vitaflora", "dose": "1 litre"}],
             "confidence": 0.9},
            {"category": "Labour Work", "plot_codes": ["P2"], "plot_text": "36", "days_ago": 0,
             "description": "फेल फूट काढली", "products": [], "confidence": 0.85},
            {"category": "Fertigation", "plot_codes": ["P3"], "plot_text": "Crimson", "days_ago": 0,
             "description": "Calcium nitrate, Magnesium nitrate 1 bag",
             "products": [{"name": "Calcium nitrate", "dose": None}, {"name": "Magnesium nitrate", "dose": "1 bag"}],
             "confidence": 0.9},
        ]
    }
    drafts = build_drafts(llm, plots, TODAY)
    assert [d.category for d in drafts] == ["Spraying", "Labour Work", "Fertigation"]
    assert [d.plot_name for d in drafts] == ["35", "36", "Crimson"]
    assert [d.plot_id for d in drafts] == [p.id for p in plots]
    assert all(d.operation_date == TODAY for d in drafts)
    assert all(d.needs_review == [] for d in drafts)
    assert drafts[0].products[0].name == "Movento"


def test_one_operation_on_two_plots_expands_to_two_drafts():
    plots = _plots()
    llm = {"operations": [{"category": "Spraying", "plot_codes": ["P1", "P2"], "days_ago": 0,
                           "description": "x", "products": [], "confidence": 0.9}]}
    drafts = build_drafts(llm, plots, TODAY)
    assert [d.plot_name for d in drafts] == ["35", "36"]


def test_invalid_plot_number_is_never_trusted():
    llm = {"operations": [{"category": "Spraying", "plot_codes": ["P99", "P0", "x"], "plot_text": None,
                           "days_ago": 0, "description": "x", "products": [], "confidence": 0.9}]}
    (d,) = build_drafts(llm, _plots(), TODAY)
    assert d.plot_id is None and "plot" in d.needs_review


def test_plot_fallback_by_text_handles_devanagari_digits():
    plots = _plots()
    assert [p.name for p in match_plots_by_text("३५ चा प्लॉट", plots)] == ["35"]
    assert [p.name for p in match_plots_by_text("crimson cha plot", plots)] == ["Crimson"]
    assert match_plots_by_text("99", plots) == []
    assert match_plots_by_text(None, plots) == []


def test_days_ago_is_computed_server_side_and_clamped():
    llm = {"operations": [
        {"category": "Other", "plot_codes": ["P1"], "days_ago": 1, "description": "", "products": [], "confidence": 0.9},
        {"category": "Other", "plot_codes": ["P1"], "days_ago": 5000, "description": "", "products": [], "confidence": 0.9},
        {"category": "Other", "plot_codes": ["P1"], "days_ago": -3, "description": "", "products": [], "confidence": 0.9},
    ]}
    d = build_drafts(llm, _plots(), TODAY)
    assert d[0].operation_date == date(2026, 11, 8)
    assert (TODAY - d[1].operation_date).days == 60
    assert d[2].operation_date == TODAY


def test_unknown_category_falls_back_to_other_and_is_flagged():
    llm = {"operations": [{"category": "Dancing", "plot_codes": ["P1"], "days_ago": 0,
                           "description": "x", "products": [], "confidence": 0.9}]}
    (d,) = build_drafts(llm, _plots(), TODAY)
    assert d.category == "Other" and "category" in d.needs_review


def test_low_confidence_is_flagged_and_garbage_is_ignored():
    llm = {"operations": [
        {"category": "Spraying", "plot_codes": ["P1"], "days_ago": 0, "description": "x", "products": [], "confidence": 0.3},
        "not a dict",
    ]}
    drafts = build_drafts(llm, _plots(), TODAY)
    assert len(drafts) == 1 and drafts[0].needs_review == ["category"]
    assert build_drafts({}, _plots(), TODAY) == []


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@pytest.fixture
def fake_vendors(monkeypatch):
    from app.config import settings
    from app.routers import voice as voice_router

    monkeypatch.setattr(settings, "soniox_api_key", "test")
    monkeypatch.setattr(settings, "gemini_api_key", "test")
    seen = {}

    async def fake_transcribe(data, **kw):
        seen["terms"] = kw["context"]["terms"]
        return "ajj ara 35 cha plot la movento 2ml ne ghetla"

    async def fake_generate(system, user, schema):
        seen["system"] = system
        return {"operations": [{
            "category": "Spraying", "plot_codes": ["P1"], "plot_text": "35", "days_ago": 0,
            "description": "Movento 2 ml", "products": [{"name": "Movento", "dose": "2 ml"}],
            "confidence": 0.95,
        }]}

    monkeypatch.setattr(voice_router, "transcribe", fake_transcribe)
    monkeypatch.setattr("app.core.voice.operations.generate_json", fake_generate)
    voice_router._hits.clear()
    return seen


async def _make_plot(client: AsyncClient, name: str) -> dict:
    r = await client.post("/api/v1/plots", json={"name": name, "size_acres": 1.5, "crop_name": "Grapes"})
    assert r.status_code == 201, r.text
    return r.json()


async def test_parse_endpoint_returns_drafts(client: AsyncClient, fake_vendors):
    plot = await _make_plot(client, "35")
    r = await client.post(
        "/api/v1/voice/operations/parse",
        files={"audio": ("v.m4a", b"fake-audio-bytes", "audio/mp4")},
        data={"lang": "mr"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["operations"][0]["plot_id"] == plot["id"]
    assert body["operations"][0]["category"] == "Spraying"
    assert "35" in fake_vendors["terms"]            # user's plot name sent as STT context
    assert 'P1 = plot named "35"' in fake_vendors["system"]


async def test_other_users_plots_are_never_sent_to_vendors(client: AsyncClient, other_client: AsyncClient, fake_vendors):
    await _make_plot(other_client, "SECRET-PLOT")
    await _make_plot(client, "35")
    r = await client.post(
        "/api/v1/voice/operations/parse",
        files={"audio": ("v.m4a", b"x", "audio/mp4")},
    )
    assert r.status_code == 200
    assert "SECRET-PLOT" not in fake_vendors["system"]
    assert "SECRET-PLOT" not in fake_vendors["terms"]


async def test_parse_rejects_empty_and_oversized(client: AsyncClient, fake_vendors, monkeypatch):
    from app.config import settings
    r = await client.post("/api/v1/voice/operations/parse", files={"audio": ("v.m4a", b"", "audio/mp4")})
    assert r.status_code == 400
    monkeypatch.setattr(settings, "voice_max_audio_bytes", 10)
    r = await client.post("/api/v1/voice/operations/parse", files={"audio": ("v.m4a", b"x" * 50, "audio/mp4")})
    assert r.status_code == 413


async def test_parse_503_when_not_configured(client: AsyncClient, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "soniox_api_key", "")
    r = await client.post("/api/v1/voice/operations/parse", files={"audio": ("v.m4a", b"x", "audio/mp4")})
    assert r.status_code == 503


async def test_saved_voice_operation_keeps_details(client: AsyncClient):
    plot = await _make_plot(client, "35")
    r = await client.post("/api/v1/plot-operations", json={
        "plot_id": plot["id"], "operation_date": "2026-11-09", "operation_type": "Spraying",
        "notes": "Movento 2 ml",
        "details": {"source": "voice", "products": [{"name": "Movento", "dose": "2 ml"}]},
    })
    assert r.status_code == 201, r.text
    assert r.json()["details"]["products"][0]["name"] == "Movento"


# ---------------------------------------------------------------------------
# Attendance
# ---------------------------------------------------------------------------

from app.core.voice.attendance import EntityRef, build_attendance_drafts  # noqa: E402


def _people():
    return [
        EntityRef("labour", uuid.uuid4(), "Ramesh"),
        EntityRef("labour", uuid.uuid4(), "Suresh"),
        EntityRef("team", uuid.uuid4(), "Shinde Group"),
    ]


def test_attendance_example_sentences():
    people = _people()
    llm = {"entries": [
        {"entity_codes": ["T1"], "status": "present", "num_labourers": 12, "days_ago": 0,
         "task": "फवारणी", "start_time": "8:00", "end_time": "17:00", "confidence": 0.9},
        {"entity_codes": ["L1", "L2"], "status": "absent", "days_ago": 1, "confidence": 0.9},
    ]}
    d = build_attendance_drafts(llm, people, TODAY)
    assert [(x.entity_name, x.status) for x in d] == [
        ("Shinde Group", "present"), ("Ramesh", "absent"), ("Suresh", "absent")]
    assert d[0].num_labourers == 12 and d[0].entity_type == "team"
    assert (d[0].work_start_time, d[0].work_end_time) == ("08:00", "17:00")
    assert d[1].attendance_date == date(2026, 11, 8)
    assert all(x.needs_review == [] for x in d)


def test_attendance_codes_are_typed_and_never_trusted():
    people = _people()
    # L3 does not exist (only 2 labours); T1 must not be read as the first labour
    llm = {"entries": [{"entity_codes": ["L3", "X9", "T1"], "status": "present",
                        "num_labourers": 5, "days_ago": 0, "confidence": 0.9}]}
    (d,) = build_attendance_drafts(llm, people, TODAY)
    assert d.entity_name == "Shinde Group"


def test_attendance_team_without_count_is_flagged_and_labour_count_dropped():
    people = _people()
    llm = {"entries": [
        {"entity_codes": ["T1"], "status": "present", "days_ago": 0, "confidence": 0.9},
        {"entity_codes": ["L1"], "status": "present", "num_labourers": 4, "days_ago": 0, "confidence": 0.9},
        {"entity_codes": ["T1"], "status": "absent", "num_labourers": 7, "days_ago": 1, "confidence": 0.9},
    ]}
    d = build_attendance_drafts(llm, people, TODAY)
    assert d[0].num_labourers is None and d[0].needs_review == ["count"]
    assert d[1].num_labourers is None and d[1].needs_review == []
    assert d[2].num_labourers is None and d[2].status == "absent"


def test_attendance_unknown_person_flagged_and_bad_values_cleaned():
    llm = {"entries": [{"entity_codes": [], "entity_text": "कोणीतरी", "status": "flying", "days_ago": 999,
                        "start_time": "25:99", "end_time": "5.30", "confidence": 0.9}]}
    (d,) = build_attendance_drafts(llm, _people(), TODAY)
    assert d.entity_id is None and "entity" in d.needs_review and "status" in d.needs_review
    assert d.status == "present" and (TODAY - d.attendance_date).days == 60
    assert d.work_start_time is None and d.work_end_time == "05:30"


def test_attendance_same_person_same_day_last_one_wins():
    people = _people()
    llm = {"entries": [
        {"entity_codes": ["L1"], "status": "absent", "days_ago": 0, "confidence": 0.9},
        {"entity_codes": ["L1"], "status": "present", "days_ago": 0, "confidence": 0.9},
    ]}
    d = build_attendance_drafts(llm, people, TODAY)
    assert len(d) == 1 and d[0].status == "present"


async def test_attendance_parse_endpoint(client: AsyncClient, other_client: AsyncClient, monkeypatch):
    from app.config import settings
    from app.routers import voice as voice_router

    monkeypatch.setattr(settings, "soniox_api_key", "test")
    monkeypatch.setattr(settings, "gemini_api_key", "test")
    voice_router._hits.clear()
    seen = {}

    async def fake_transcribe(data, **kw):
        seen["terms"] = kw["context"]["terms"]
        return "रमेश आज आला"

    async def fake_generate(system, user, schema):
        seen["system"] = system
        return {"entries": [{"entity_codes": ["L1"], "status": "present", "days_ago": 0, "confidence": 0.95}]}

    monkeypatch.setattr(voice_router, "transcribe", fake_transcribe)
    monkeypatch.setattr("app.core.voice.attendance.generate_json", fake_generate)

    other = (await other_client.post("/api/v1/labours", json={"name": "SECRET-WORKER", "daily_wage": 400})).json()
    mine = (await client.post("/api/v1/labours", json={"name": "Ramesh", "daily_wage": 400})).json()
    assert other["id"] != mine["id"]

    r = await client.post("/api/v1/voice/attendance/parse", files={"audio": ("v.m4a", b"x", "audio/mp4")})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["entries"][0]["entity_id"] == mine["id"]
    assert body["entries"][0]["entity_type"] == "labour"
    assert 'L1 = individual worker "Ramesh"' in seen["system"]
    assert "SECRET-WORKER" not in seen["system"] and "SECRET-WORKER" not in seen["terms"]
