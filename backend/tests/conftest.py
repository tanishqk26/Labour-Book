"""
Pytest configuration and shared fixtures for LabourBook backend tests.

Strategy
--------
Each test runs inside a database transaction that is rolled back at the end,
so no test data persists between runs.  A fresh User record is created per
test function and a session cookie is injected into the HTTP client so every
request passes authentication.

Dependencies
------------
  pip install pytest pytest-asyncio httpx
"""

import asyncio
import selectors
import sys
import uuid
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Ensure Windows uses SelectorEventLoop (required by psycopg async)
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.config import settings
from app.core.security import create_access_token, SESSION_COOKIE_NAME
from app.database import Base, get_db
from app.models.user import User
from main import app

# ---------------------------------------------------------------------------
# Event loop policy
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def event_loop_policy():
    if sys.platform == "win32":
        return asyncio.WindowsSelectorEventLoopPolicy()
    return asyncio.DefaultEventLoopPolicy()


# ---------------------------------------------------------------------------
# Async engine — reuses the app's database URL
# ---------------------------------------------------------------------------
_engine = create_async_engine(settings.database_url, echo=False)
_TestingSession = sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)


# ---------------------------------------------------------------------------
# Per-test DB session (auto-rollback)
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async session wrapped in a transaction that is rolled back."""
    async with _engine.connect() as conn:
        await conn.begin()
        # Use the raw connection for the session so everything shares the txn
        session = AsyncSession(bind=conn, expire_on_commit=False)
        try:
            yield session
        finally:
            await session.close()
            await conn.rollback()


# ---------------------------------------------------------------------------
# Test user — created inside the rolled-back transaction
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user in the rolled-back transaction."""
    from app.core.security import hash_password
    user = User(
        email=f"test_{uuid.uuid4().hex[:8]}@example.com",
        name="Test User",
        password_hash=hash_password("testpassword"),
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def other_user(db_session: AsyncSession) -> User:
    """A second user to test owner isolation."""
    from app.core.security import hash_password
    user = User(
        email=f"other_{uuid.uuid4().hex[:8]}@example.com",
        name="Other User",
        password_hash=hash_password("testpassword"),
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


# ---------------------------------------------------------------------------
# Authenticated HTTP client — injects a valid session cookie
# ---------------------------------------------------------------------------
def _make_client(user: User, db_session: AsyncSession) -> AsyncClient:
    """Return an AsyncClient pre-authenticated as `user`."""
    token = create_access_token(str(user.id))

    # Override the DB dependency so the client uses our rolled-back session
    async def _override_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_db

    transport = ASGITransport(app=app)
    client = AsyncClient(
        transport=transport,
        base_url="http://test",
        cookies={SESSION_COOKIE_NAME: token},
    )
    return client


@pytest_asyncio.fixture
async def client(test_user: User, db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Authenticated client as the primary test user."""
    c = _make_client(test_user, db_session)
    try:
        yield c
    finally:
        await c.aclose()
        app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def other_client(other_user: User, db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Authenticated client as a second user (for isolation tests)."""
    c = _make_client(other_user, db_session)
    try:
        yield c
    finally:
        await c.aclose()
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Plot helper — creates a bare plot owned by `test_user`
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def test_plot(test_user: User, db_session: AsyncSession):
    from app.models.plot import Plot
    plot = Plot(
        owner_id=test_user.id,
        name="Test Plot A",
        size_acres=2.5,
        crop_name="Grapes",
    )
    db_session.add(plot)
    await db_session.flush()
    return plot
