"""Regression tests for the single-attendance upsert (POST /api/v1/attendance)."""

import uuid

import pytest

from app.models.labour import Labour
from app.models.team import Team

URL = "/api/v1/attendance"


async def _labour(db_session, owner, wage=500):
    labour = Labour(owner_id=owner.id, name="Ramesh", daily_wage=wage)
    db_session.add(labour)
    await db_session.flush()
    return labour


@pytest.mark.asyncio
async def test_upsert_creates_then_updates(client, db_session, test_user):
    labour = await _labour(db_session, test_user)
    body = {"labour_id": str(labour.id), "date": "2026-01-10", "status": "present"}

    first = await client.post(URL, json=body)
    assert first.status_code == 201, first.text
    data = first.json()
    assert data["wage_earned"] == 500
    assert data["labour"]["name"] == "Ramesh"
    assert data["created_at"] and data["updated_at"]

    second = await client.post(URL, json={**body, "status": "half_day"})
    assert second.status_code == 201, second.text
    assert second.json()["id"] == data["id"]  # same row, not a duplicate
    assert second.json()["wage_earned"] == 250


@pytest.mark.asyncio
async def test_upsert_team_wage(client, db_session, test_user):
    team = Team(owner_id=test_user.id, name="Team A", daily_wage=400, car_rent=300, manager_fee=200)
    db_session.add(team)
    await db_session.flush()

    res = await client.post(
        URL,
        json={"team_id": str(team.id), "date": "2026-01-10", "status": "present", "num_labourers": 5},
    )
    assert res.status_code == 201, res.text
    assert res.json()["wage_earned"] == 5 * 400 + 300 + 200
    assert res.json()["team"]["name"] == "Team A"


@pytest.mark.asyncio
async def test_upsert_other_owners_labour_is_404(other_client, db_session, test_user):
    labour = await _labour(db_session, test_user)
    res = await other_client.post(
        URL, json={"labour_id": str(labour.id), "date": "2026-01-10", "status": "present"}
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_upsert_requires_entity(client):
    res = await client.post(URL, json={"date": "2026-01-10", "status": "present"})
    assert res.status_code == 400
