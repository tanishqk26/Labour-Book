import asyncio
import sys
from contextlib import asynccontextmanager

# psycopg's async driver requires a selector-based event loop; Windows
# defaults to ProactorEventLoop, which it cannot run under.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.deps import get_current_user
from app.routers.health import router as health_router
from app.routers.auth import router as auth_router
from app.routers.labours import router as labours_router
from app.routers.attendance import router as attendance_router
from app.routers.teams import router as teams_router
from app.routers.contracts import router as contracts_router
from app.routers.plots import router as plots_router
from app.routers.payments import router as payments_router
from app.routers.statements import router as statements_router
from app.routers.settings import router as settings_router
from app.routers.farm_years import router as farm_years_router
from app.routers.plot_operations import router as plot_operations_router
from app.routers.operation_photos import router as operation_photos_router
from app.routers.operation_workers import router as operation_workers_router


# ---------------------------------------------------------------------------
# Lifespan — runs on startup / shutdown
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # -- Startup --
    print(f"[LabourBook] API starting up [{settings.app_env}]")
    yield
    # -- Shutdown --
    print("[LabourBook] API shutting down")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="LabourBook API",
    description="Farm Labour Management System — backend API",
    version="0.1.0",
    docs_url="/docs" if settings.is_dev else None,
    redoc_url="/redoc" if settings.is_dev else None,
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(health_router)
app.include_router(auth_router)

_auth_guard = [Depends(get_current_user)]
app.include_router(labours_router, dependencies=_auth_guard)
app.include_router(attendance_router, dependencies=_auth_guard)
app.include_router(teams_router, dependencies=_auth_guard)
app.include_router(contracts_router, dependencies=_auth_guard)
app.include_router(plots_router, dependencies=_auth_guard)
app.include_router(payments_router, dependencies=_auth_guard)
app.include_router(statements_router, dependencies=_auth_guard)
app.include_router(settings_router, dependencies=_auth_guard)
app.include_router(farm_years_router, dependencies=_auth_guard)
app.include_router(plot_operations_router, dependencies=_auth_guard)
app.include_router(operation_photos_router, dependencies=_auth_guard)
app.include_router(operation_workers_router, dependencies=_auth_guard)


# ---------------------------------------------------------------------------
# Root
# ---------------------------------------------------------------------------
@app.get("/", include_in_schema=False)
async def root():
    return {"message": "LabourBook API", "docs": "/docs"}
