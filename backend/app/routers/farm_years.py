"""
Farm Years Router

API endpoints for managing farm years and plot enrollments.

URL layout:
  POST   /api/v1/farm-years                              create a farm year
  GET    /api/v1/farm-years                              list farm years (paginated)
  GET    /api/v1/farm-years/{farm_year_id}               get single farm year + enrolled plots
  PATCH  /api/v1/farm-years/{farm_year_id}               update transition_date
  DELETE /api/v1/farm-years/{farm_year_id}               delete (blocked if plots enrolled)

  POST   /api/v1/farm-years/{farm_year_id}/plots         enroll a plot (auto-creates 2 lifecycles)
  GET    /api/v1/farm-years/{farm_year_id}/plots         list enrolled plots
  GET    /api/v1/farm-years/{farm_year_id}/plots/{id}    get single plot enrollment
  PATCH  /api/v1/farm-years/{farm_year_id}/plots/{id}    update enrollment metadata
  DELETE /api/v1/farm-years/{farm_year_id}/plots/{id}    remove plot (cascades lifecycles)
"""

import uuid
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.database import get_db
from app.models.farm_year import FarmYear
from app.models.plot import Plot
from app.models.plot_farm_year import PlotFarmYear, PlotLifecycle
from app.models.user import User
from app.schemas.farm_year import (
    FarmYearCreate,
    FarmYearDetailRead,
    FarmYearRead,
    FarmYearUpdate,
    PaginatedFarmYears,
)
from app.schemas.plot_farm_year import (
    PlotFarmYearCreate,
    PlotFarmYearRead,
    PlotFarmYearUpdate,
    PaginatedPlotFarmYears,
)

router = APIRouter(prefix="/api/v1/farm-years", tags=["Farm Years"])


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _effective_transition(farm_year: FarmYear) -> date:
    """Return the real transition date (default: Oct 1 of year)."""
    return farm_year.transition_date or date(farm_year.year, 10, 1)


async def _get_farm_year_or_404(
    db: AsyncSession,
    farm_year_id: uuid.UUID,
    owner_id: uuid.UUID,
    *,
    load_plots: bool = False,
) -> FarmYear:
    q = select(FarmYear).where(
        FarmYear.id == farm_year_id,
        FarmYear.owner_id == owner_id,
    )
    if load_plots:
        q = q.options(
            selectinload(FarmYear.plot_farm_years).selectinload(PlotFarmYear.lifecycles)
        )
    result = await db.execute(q)
    fy = result.scalar_one_or_none()
    if fy is None:
        raise HTTPException(status_code=404, detail="Farm year not found")
    return fy


async def _get_plot_farm_year_or_404(
    db: AsyncSession,
    farm_year_id: uuid.UUID,
    pfy_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> PlotFarmYear:
    result = await db.execute(
        select(PlotFarmYear)
        .options(selectinload(PlotFarmYear.lifecycles))
        .where(
            PlotFarmYear.id == pfy_id,
            PlotFarmYear.farm_year_id == farm_year_id,
            PlotFarmYear.owner_id == owner_id,
        )
    )
    pfy = result.scalar_one_or_none()
    if pfy is None:
        raise HTTPException(status_code=404, detail="Plot enrollment not found")
    return pfy


def _build_lifecycles(
    pfy: PlotFarmYear,
    farm_year: FarmYear,
    owner_id: uuid.UUID,
) -> list[PlotLifecycle]:
    """
    Derive the two canonical lifecycle rows from a farm year's dates.

    Vegetative  : farm_year.start_date  → transition_date - 1 day
    Production  : transition_date       → farm_year.end_date
    """
    transition = _effective_transition(farm_year)
    veg_end = transition - timedelta(days=1)

    vegetative = PlotLifecycle(
        owner_id=owner_id,
        plot_farm_year_id=pfy.id,
        lifecycle_type="vegetative",
        name="Vegetative / Shoot Development",
        start_date=farm_year.start_date,
        end_date=veg_end,
    )
    production = PlotLifecycle(
        owner_id=owner_id,
        plot_farm_year_id=pfy.id,
        lifecycle_type="fruit_production",
        name="Fruit Production",
        start_date=transition,
        end_date=farm_year.end_date,
    )
    return [vegetative, production]


# ---------------------------------------------------------------------------
# Farm Year — CRUD
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=FarmYearRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a farm year",
)
async def create_farm_year(
    payload: FarmYearCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FarmYearRead:
    """
    Create a new farm year (Apr 1 → Mar 31).

    `year` is the April-start calendar year:  year=2026 → 2026-04-01 … 2027-03-31.
    `transition_date` is optional; defaults to October 1 of `year` when absent.
    start_date / end_date are always computed from `year` and validated server-side.
    """
    # Duplicate check
    exists = await db.execute(
        select(FarmYear).where(
            FarmYear.owner_id == current_user.id,
            FarmYear.year == payload.year,
        )
    )
    if exists.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Farm year {payload.year} already exists",
        )

    fy = FarmYear(
        owner_id=current_user.id,
        year=payload.year,
        start_date=payload.start_date,
        end_date=payload.end_date,
        transition_date=payload.transition_date,
    )
    db.add(fy)
    await db.flush()
    await db.refresh(fy)
    return FarmYearRead.from_orm_obj(fy, plot_count=0)


@router.get(
    "",
    response_model=PaginatedFarmYears,
    summary="List farm years",
)
async def list_farm_years(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedFarmYears:
    """Paginated list of farm years for the current owner, newest first."""
    base_q = select(FarmYear).where(FarmYear.owner_id == current_user.id)

    total = (await db.execute(select(func.count()).select_from(base_q.subquery()))).scalar_one()

    offset = (page - 1) * page_size
    result = await db.execute(
        base_q.order_by(FarmYear.year.desc()).offset(offset).limit(page_size)
    )
    farm_years = result.scalars().all()

    # Fetch plot counts in one query
    if farm_years:
        fy_ids = [fy.id for fy in farm_years]
        count_rows = await db.execute(
            select(PlotFarmYear.farm_year_id, func.count().label("cnt"))
            .where(PlotFarmYear.farm_year_id.in_(fy_ids))
            .group_by(PlotFarmYear.farm_year_id)
        )
        plot_counts: dict = {row[0]: row[1] for row in count_rows.all()}
    else:
        plot_counts = {}

    items = [FarmYearRead.from_orm_obj(fy, plot_counts.get(fy.id, 0)) for fy in farm_years]
    return PaginatedFarmYears(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_more=(offset + len(farm_years)) < total,
    )


@router.get(
    "/{farm_year_id}",
    response_model=FarmYearDetailRead,
    summary="Get a farm year with enrolled plots",
)
async def get_farm_year(
    farm_year_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FarmYearDetailRead:
    fy = await _get_farm_year_or_404(db, farm_year_id, current_user.id, load_plots=True)
    return FarmYearDetailRead.from_orm_obj(fy)


@router.patch(
    "/{farm_year_id}",
    response_model=FarmYearDetailRead,
    summary="Update a farm year (transition date only)",
)
async def update_farm_year(
    farm_year_id: uuid.UUID,
    payload: FarmYearUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FarmYearDetailRead:
    """
    Only `transition_date` is mutable.  When it changes, all existing lifecycle
    rows for every enrolled plot are recalculated automatically.
    """
    fy = await _get_farm_year_or_404(db, farm_year_id, current_user.id, load_plots=True)

    old_transition = _effective_transition(fy)
    fy.transition_date = payload.transition_date
    new_transition = _effective_transition(fy)

    # Recalculate lifecycles for all enrolled plots if transition changed
    if old_transition != new_transition:
        for pfy in fy.plot_farm_years:
            for lc in pfy.lifecycles:
                if lc.lifecycle_type == "vegetative":
                    lc.end_date = new_transition - timedelta(days=1)
                elif lc.lifecycle_type == "fruit_production":
                    lc.start_date = new_transition

    await db.flush()

    # Reload with fresh data
    fy = await _get_farm_year_or_404(db, farm_year_id, current_user.id, load_plots=True)
    return FarmYearDetailRead.from_orm_obj(fy)


@router.delete(
    "/{farm_year_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a farm year",
)
async def delete_farm_year(
    farm_year_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Delete a farm year.  Blocked (409) if any plots are enrolled — remove
    all plot enrollments first, or they will be cascade-deleted on the DB side
    regardless; this guard keeps the action explicit.
    """
    fy = await _get_farm_year_or_404(db, farm_year_id, current_user.id)

    plot_count_row = await db.execute(
        select(func.count()).where(
            PlotFarmYear.farm_year_id == farm_year_id,
            PlotFarmYear.owner_id == current_user.id,
        )
    )
    plot_count = plot_count_row.scalar_one()
    if plot_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot delete farm year — {plot_count} plot(s) are enrolled. "
                "Remove all plot enrollments first."
            ),
        )

    await db.delete(fy)
    await db.flush()


# ---------------------------------------------------------------------------
# Plot Enrollments — nested under a farm year
# ---------------------------------------------------------------------------

@router.post(
    "/{farm_year_id}/plots",
    response_model=PlotFarmYearRead,
    status_code=status.HTTP_201_CREATED,
    summary="Enroll a plot in a farm year",
)
async def enroll_plot(
    farm_year_id: uuid.UUID,
    payload: PlotFarmYearCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlotFarmYearRead:
    """
    Attach a plot to a farm year.  Automatically creates two lifecycle rows:
      · vegetative      (farm_year.start_date → transition_date - 1 day)
      · fruit_production (transition_date     → farm_year.end_date)
    """
    fy = await _get_farm_year_or_404(db, farm_year_id, current_user.id)

    # Validate plot ownership
    plot_res = await db.execute(
        select(Plot).where(Plot.id == payload.plot_id, Plot.owner_id == current_user.id)
    )
    if plot_res.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Plot not found")

    # Check for duplicate enrollment
    dup = await db.execute(
        select(PlotFarmYear).where(
            PlotFarmYear.plot_id == payload.plot_id,
            PlotFarmYear.farm_year_id == farm_year_id,
        )
    )
    if dup.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Plot is already enrolled in this farm year",
        )

    pfy = PlotFarmYear(
        owner_id=current_user.id,
        plot_id=payload.plot_id,
        farm_year_id=farm_year_id,
        crop_name=payload.crop_name,
        variety=payload.variety,
        acreage=payload.acreage,
        notes=payload.notes,
    )
    db.add(pfy)
    await db.flush()
    await db.refresh(pfy)

    # Build and persist the two lifecycle rows
    lifecycles = _build_lifecycles(pfy, fy, current_user.id)
    for lc in lifecycles:
        db.add(lc)
    await db.flush()

    # Reload with lifecycles
    pfy = await _get_plot_farm_year_or_404(db, farm_year_id, pfy.id, current_user.id)
    return PlotFarmYearRead.from_orm_obj(pfy)


@router.get(
    "/{farm_year_id}/plots",
    response_model=PaginatedPlotFarmYears,
    summary="List plots enrolled in a farm year",
)
async def list_enrolled_plots(
    farm_year_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedPlotFarmYears:
    # Confirm the farm year belongs to this owner
    await _get_farm_year_or_404(db, farm_year_id, current_user.id)

    base_q = (
        select(PlotFarmYear)
        .options(selectinload(PlotFarmYear.lifecycles))
        .where(
            PlotFarmYear.farm_year_id == farm_year_id,
            PlotFarmYear.owner_id == current_user.id,
        )
    )
    total = (await db.execute(select(func.count()).select_from(base_q.subquery()))).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(base_q.offset(offset).limit(page_size))
    pfys = result.scalars().all()

    return PaginatedPlotFarmYears(
        items=[PlotFarmYearRead.from_orm_obj(p) for p in pfys],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(offset + len(pfys)) < total,
    )


@router.get(
    "/{farm_year_id}/plots/{pfy_id}",
    response_model=PlotFarmYearRead,
    summary="Get a single plot enrollment",
)
async def get_enrolled_plot(
    farm_year_id: uuid.UUID,
    pfy_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlotFarmYearRead:
    pfy = await _get_plot_farm_year_or_404(db, farm_year_id, pfy_id, current_user.id)
    return PlotFarmYearRead.from_orm_obj(pfy)


@router.patch(
    "/{farm_year_id}/plots/{pfy_id}",
    response_model=PlotFarmYearRead,
    summary="Update plot enrollment metadata",
)
async def update_enrolled_plot(
    farm_year_id: uuid.UUID,
    pfy_id: uuid.UUID,
    payload: PlotFarmYearUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlotFarmYearRead:
    """Update crop_name, variety, acreage, or notes on an enrollment."""
    pfy = await _get_plot_farm_year_or_404(db, farm_year_id, pfy_id, current_user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(pfy, field, value)
    await db.flush()
    pfy = await _get_plot_farm_year_or_404(db, farm_year_id, pfy_id, current_user.id)
    return PlotFarmYearRead.from_orm_obj(pfy)


@router.delete(
    "/{farm_year_id}/plots/{pfy_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a plot enrollment (cascades to lifecycles)",
)
async def remove_enrolled_plot(
    farm_year_id: uuid.UUID,
    pfy_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    pfy = await _get_plot_farm_year_or_404(db, farm_year_id, pfy_id, current_user.id)
    await db.delete(pfy)
    await db.flush()
