"""
Plots Router

CRUD endpoints for farm plots.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.plot import Plot
from app.schemas.plot import PlotCreate, PlotRead, PlotUpdate, PaginatedPlots

router = APIRouter(prefix="/api/v1/plots", tags=["Plots"])


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

async def _get_or_404(db: AsyncSession, plot_id: uuid.UUID) -> Plot:
    result = await db.execute(select(Plot).where(Plot.id == plot_id))
    plot = result.scalar_one_or_none()
    if not plot:
        raise HTTPException(status_code=404, detail="Plot not found")
    return plot


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

@router.get("", response_model=PaginatedPlots, summary="List all plots")
async def list_plots(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None, description="active | inactive"),
    db: AsyncSession = Depends(get_db),
) -> PaginatedPlots:
    query = select(Plot).order_by(Plot.name)

    if status == "active":
        query = query.where(Plot.is_active.is_(True))
    elif status == "inactive":
        query = query.where(Plot.is_active.is_(False))

    total_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(total_q)).scalar_one()

    offset = (page - 1) * page_size
    result = await db.execute(query.offset(offset).limit(page_size))
    plots = result.scalars().all()

    return PaginatedPlots(
        items=[PlotRead.from_orm_obj(p) for p in plots],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(offset + len(plots)) < total,
    )


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

@router.post("", response_model=PlotRead, status_code=status.HTTP_201_CREATED, summary="Create a plot")
async def create_plot(
    payload: PlotCreate,
    db: AsyncSession = Depends(get_db),
) -> PlotRead:
    plot = Plot(
        name=payload.name,
        size_acres=payload.size_acres,
        crop_name=payload.crop_name,
        notes=payload.notes,
    )
    db.add(plot)
    await db.flush()
    await db.refresh(plot)
    return PlotRead.from_orm_obj(plot)


# ---------------------------------------------------------------------------
# Get single
# ---------------------------------------------------------------------------

@router.get("/{plot_id}", response_model=PlotRead, summary="Get a single plot")
async def get_plot(
    plot_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> PlotRead:
    plot = await _get_or_404(db, plot_id)
    return PlotRead.from_orm_obj(plot)


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

@router.patch("/{plot_id}", response_model=PlotRead, summary="Update a plot")
async def update_plot(
    plot_id: uuid.UUID,
    payload: PlotUpdate,
    db: AsyncSession = Depends(get_db),
) -> PlotRead:
    plot = await _get_or_404(db, plot_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(plot, field, value)
    await db.flush()
    await db.refresh(plot)
    return PlotRead.from_orm_obj(plot)


# ---------------------------------------------------------------------------
# Delete (soft)
# ---------------------------------------------------------------------------

@router.delete("/{plot_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Deactivate a plot")
async def delete_plot(
    plot_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    plot = await _get_or_404(db, plot_id)
    plot.is_active = False
    await db.flush()


# ---------------------------------------------------------------------------
# Hard delete
# ---------------------------------------------------------------------------

@router.delete("/{plot_id}/hard", status_code=status.HTTP_204_NO_CONTENT, summary="Permanently delete a plot")
async def hard_delete_plot(
    plot_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    plot = await _get_or_404(db, plot_id)
    await db.delete(plot)
    await db.flush()
