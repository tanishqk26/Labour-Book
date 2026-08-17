from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.health import router as health_router


# ---------------------------------------------------------------------------
# Lifespan — runs on startup / shutdown
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # -- Startup --
    print(f"🌿 LabourBook API starting up [{settings.app_env}]")
    yield
    # -- Shutdown --
    print("🌿 LabourBook API shutting down")


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

# Add feature routers below as you build them, e.g.:
# from app.routers.labours import router as labours_router
# app.include_router(labours_router, prefix="/api/v1")


# ---------------------------------------------------------------------------
# Root
# ---------------------------------------------------------------------------
@app.get("/", include_in_schema=False)
async def root():
    return {"message": "LabourBook API", "docs": "/docs"}
