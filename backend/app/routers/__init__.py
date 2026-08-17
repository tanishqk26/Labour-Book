"""
LabourBook Routers Package

Register all feature routers here and import them into main.py.

Example (add as you build features):
    from app.routers.labours import router as labours_router
    from app.routers.teams import router as teams_router
"""

from app.routers.health import router as health_router  # noqa: F401

__all__ = ["health_router"]
