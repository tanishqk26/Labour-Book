from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.config import settings


# --- Async Engine ---
# Driver: psycopg (psycopg3) — pre-built binaries, no compiler needed
# Connection string format: postgresql+psycopg://user:pass@host:port/db
engine = create_async_engine(
    settings.database_url,
    echo=settings.is_dev,        # Log SQL queries in development
    pool_pre_ping=True,           # Verify connections before use (handles dropped connections)
    pool_size=10,
    max_overflow=20,
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
