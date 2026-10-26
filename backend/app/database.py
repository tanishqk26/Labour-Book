from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.config import settings


# --- Async Engine ---
# Driver: psycopg (psycopg3) — works with Supabase pooler username format
# Connection string format: postgresql+psycopg://user:pass@host:port/db
engine = create_async_engine(
    settings.database_url,
    echo=False,          # Disable SQL logging — reduces noise and overhead
    pool_pre_ping=True,
    pool_size=5,         # Free tier has 60 max connections; keep pool small
    max_overflow=10,
    pool_recycle=300,    # Recycle connections every 5 min to avoid stale idle connections
    pool_timeout=30,
)

# --- Session Factory ---
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# --- Base Model ---
class Base(DeclarativeBase):
    """
    All SQLAlchemy ORM models should inherit from this Base.
    Import this in alembic/env.py so migrations auto-detect models.
    """
    pass


# --- FastAPI Dependency ---
async def get_db() -> AsyncSession:
    """
    Yields an async database session per request.
    Use as: db: AsyncSession = Depends(get_db)
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
