from fastapi import APIRouter
from sqlalchemy import text
from app.database import AsyncSessionLocal

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("", summary="Health check")
async def health_check():
    """
    Returns API status and database connectivity.
    Use this to verify the backend is running and can reach the database.
    """
    db_status = "unreachable"
    db_error = None

    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_error = str(e)

    return {
        "status": "ok",
        "database": db_status,
        **({"db_error": db_error} if db_error else {}),
    }
