"""
LabourBook Routers Package

Register all feature routers here and import them into main.py.
"""

from app.routers.health import router as health_router  # noqa: F401
from app.routers.labours import router as labours_router  # noqa: F401
from app.routers.attendance import router as attendance_router  # noqa: F401
from app.routers.teams import router as teams_router  # noqa: F401

__all__ = ["health_router", "labours_router", "attendance_router", "teams_router"]
