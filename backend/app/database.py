from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.config import settings


# --- Async Engine ---
# Driver: psycopg (psycopg3) — works with Supabase pooler username format
# Connection string format: postgresql+psycopg://user:pass@host:port/db
#
# Latency note: the database is remote, so every network round-trip costs
# 100-300 ms. The settings below are chosen to minimise round-trips:
#   * pool_pre_ping is OFF — it issued a "SELECT 1" on every checkout (one
#     extra round-trip per request). Stale connections are avoided instead via
#     pool_recycle, TCP keepalives and the periodic keep-warm ping in main.py.
#   * pool_use_lifo reuses the most recently used (hot) connection, so the
#     keep-warm ping protects the connection that real requests actually use.
engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=False,
    pool_size=5,         # Free tier has 60 max connections; keep pool small
    max_overflow=10,
    pool_recycle=240,    # Recycle before the pooler drops idle connections
    pool_timeout=30,
    pool_use_lifo=True,
    connect_args={
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 3,
    },
)

# Read-only requests run in AUTOCOMMIT: no BEGIN / COMMIT round-trips.
read_engine = engine.execution_options(isolation_level="AUTOCOMMIT")

# --- Session Factories ---
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

ReadSessionLocal = async_sessionmaker(
    bind=read_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

_READ_METHODS = {"GET", "HEAD", "OPTIONS"}


# --- Base Model ---
class Base(DeclarativeBase):
    """
    All SQLAlchemy ORM models should inherit from this Base.
    Import this in alembic/env.py so migrations auto-detect models.
    """
    pass


# --- FastAPI Dependency ---
async def get_db(request: Request) -> AsyncSession:
    """
    Yields an async database session per request.
    Use as: db: AsyncSession = Depends(get_db)

    GET/HEAD/OPTIONS requests use an AUTOCOMMIT session (no transaction
    round-trips). Everything else runs in a transaction that is committed
    once at the end of the request.
    """
    if request.method in _READ_METHODS:
        async with ReadSessionLocal() as session:
            yield session
        return

    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
