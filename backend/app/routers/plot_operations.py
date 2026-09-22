"""
Plot Operations Router

CRUD for farm operations recorded against a plot (and optionally a lifecycle stage).

URL layout:
  POST   /api/v1/plot-operations                  create an operation
  GET    /api/v1/plot-operations                  list with filters (plot, lifecycle, date, type)
  GET    /api/v1/plot-operations/{id}             get single operation
  PATCH  /api/v1/plot-operations/{id}             update an operation
  DELETE /api/v1/plot-operations/{id}             delete an operation

Security
--------
Every query filters by owner_id = current_user.id.
On create/update, we verify that the plot AND lifecycle both belong to the
current user, and that the lifecycle belongs to the specified plot.
"""

import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.core.deps import get_current_user
from app.core.storage import delete_file
from app.database import get_db
from app.models.plot import Plot
from app.models.plot_farm_year import PlotFarmYear, PlotLifecycle
from app.models.plot_operation import PlotOperation
from app.models.plot_operation_photo import PlotOperationPhoto
from app.models.user import User
from app.schemas.plot_operation import (
    PlotOperationCreate,
    PlotOperationRead,
    PlotOperationUpdate,
    PaginatedPlotOperations,
)

router = APIRouter(prefix="/api/v1/plot-operations", tags=["Plot Operations"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _assert_plot_owner(
    db: AsyncSession,
    plot_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> None:
    """Raise 404 if the plot doesn't exist or belongs to another user."""
    result = await db.execute(
        select(Plot.id).where(Plot.id == plot_id, Plot.owner_id == owner_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plot not found")


async def _assert_lifecycle_belongs_to_plot(
    db: AsyncSession,
    lifecycle_id: uuid.UUID,
    plot_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> None:
    """
    Raise 404 if lifecycle doesn't exist, belongs to another owner, or doesn't
    belong to the given plot (via plot_farm_years.plot_id).
    """
    result = await db.execute(
        select(PlotLifecycle.id)
        .join(PlotFarmYear, PlotLifecycle.plot_farm_year_id == PlotFarmYear.id)
        .where(
            PlotLifecycle.id == lifecycle_id,
            PlotLifecycle.owner_id == owner_id,
            PlotFarmYear.plot_id == plot_id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lifecycle not found or does not belong to the specified plot",
        )


async def _get_operation_or_404(
    db: AsyncSession,
    operation_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> PlotOperation:
    result = await db.execute(
        select(PlotOperation)
        .options(selectinload(PlotOperation.lifecycle))
        .where(
            PlotOperation.id == operation_id,
            PlotOperation.owner_id == owner_id,
        )
    )
    op = result.scalar_one_or_none()
    if op is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operation not found")
    return op


async def _sync_lifecycle_bounds(
    db: AsyncSession,
    lifecycle_id: Optional[uuid.UUID],
    owner_id: uuid.UUID,
) -> None:
    """Set stage start/end from the earliest and latest operations in that stage."""
    if lifecycle_id is None:
        return
    result = await db.execute(
        select(PlotLifecycle).where(
            PlotLifecycle.id == lifecycle_id,
            PlotLifecycle.owner_id == owner_id,
        )
    )
    lc = result.scalar_one_or_none()
    if lc is None:
        return
    bounds = (
        await db.execute(
            select(
                func.min(PlotOperation.operation_date),
                func.max(PlotOperation.operation_date),
            ).where(PlotOperation.plot_lifecycle_id == lifecycle_id)
        )
    ).one()
    earliest, latest = bounds
    lc.start_date = earliest
    lc.end_date = latest if latest is not None and earliest is not None and latest != earliest else None


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=PlotOperationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Record a plot operation",
)
async def create_operation(
    payload: PlotOperationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlotOperationRead:
    """
    Record a farm operation (irrigation, pesticide, etc.) against a plot.
    If `plot_lifecycle_id` is provided it must belong to the specified plot.
    """
    await _assert_plot_owner(db, payload.plot_id, current_user.id)

    if payload.plot_lifecycle_id is not None:
        await _assert_lifecycle_belongs_to_plot(
            db, payload.plot_lifecycle_id, payload.plot_id, current_user.id
        )

    op = PlotOperation(
        owner_id=current_user.id,
        plot_id=payload.plot_id,
        plot_lifecycle_id=payload.plot_lifecycle_id,
        operation_date=payload.operation_date,
        operation_type=payload.operation_type,
        notes=payload.notes,
    )
    db.add(op)
    await db.flush()
    await _sync_lifecycle_bounds(db, payload.plot_lifecycle_id, current_user.id)
    op = await _get_operation_or_404(db, op.id, current_user.id)
    return PlotOperationRead.from_orm_obj(op)


# ---------------------------------------------------------------------------
# List (with filters)
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=PaginatedPlotOperations,
    summary="List plot operations",
)
async def list_operations(
    plot_id: Optional[uuid.UUID] = Query(None, description="Filter by plot"),
    lifecycle_id: Optional[uuid.UUID] = Query(None, description="Filter by lifecycle stage"),
    operation_type: Optional[str] = Query(None, description="Filter by operation type"),
    date_from: Optional[date] = Query(None, description="Inclusive start of date range"),
    date_to: Optional[date] = Query(None, description="Inclusive end of date range"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedPlotOperations:
    """
    Paginated list of operations, newest first.
    All filters are optional and combinable.
    """
    base_q = (
        select(PlotOperation)
        .options(selectinload(PlotOperation.lifecycle))
        .where(PlotOperation.owner_id == current_user.id)
    )

    if plot_id is not None:
        base_q = base_q.where(PlotOperation.plot_id == plot_id)
    if lifecycle_id is not None:
        base_q = base_q.where(PlotOperation.plot_lifecycle_id == lifecycle_id)
    if operation_type is not None:
        base_q = base_q.where(PlotOperation.operation_type == operation_type)
    if date_from is not None:
        base_q = base_q.where(PlotOperation.operation_date >= date_from)
    if date_to is not None:
        base_q = base_q.where(PlotOperation.operation_date <= date_to)

    total = (
        await db.execute(select(func.count()).select_from(base_q.subquery()))
    ).scalar_one()

    offset = (page - 1) * page_size
    result = await db.execute(
        base_q
        .order_by(PlotOperation.operation_date.desc(), PlotOperation.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    ops = result.scalars().all()

    return PaginatedPlotOperations(
        items=[PlotOperationRead.from_orm_obj(o) for o in ops],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(offset + len(ops)) < total,
    )


# ---------------------------------------------------------------------------
# Get single
# ---------------------------------------------------------------------------

@router.get(
    "/{operation_id}",
    response_model=PlotOperationRead,
    summary="Get a single operation",
)
async def get_operation(
    operation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlotOperationRead:
    op = await _get_operation_or_404(db, operation_id, current_user.id)
    return PlotOperationRead.from_orm_obj(op)


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

@router.patch(
    "/{operation_id}",
    response_model=PlotOperationRead,
    summary="Update an operation",
)
async def update_operation(
    operation_id: uuid.UUID,
    payload: PlotOperationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlotOperationRead:
    """
    Partial update.  If `plot_lifecycle_id` is changed, the new lifecycle is
    re-validated against the operation's existing plot_id.
    """
    op = await _get_operation_or_404(db, operation_id, current_user.id)
    old_lifecycle_id = op.plot_lifecycle_id

    update_data = payload.model_dump(exclude_unset=True)

    # Re-validate lifecycle if it's being changed
    new_lifecycle_id = update_data.get("plot_lifecycle_id", ...)
    if new_lifecycle_id is not ...:
        if new_lifecycle_id is not None:
            await _assert_lifecycle_belongs_to_plot(
                db, new_lifecycle_id, op.plot_id, current_user.id
            )

    for field, value in update_data.items():
        setattr(op, field, value)

    await db.flush()
    await _sync_lifecycle_bounds(db, old_lifecycle_id, current_user.id)
    await _sync_lifecycle_bounds(db, op.plot_lifecycle_id, current_user.id)
    op = await _get_operation_or_404(db, op.id, current_user.id)
    return PlotOperationRead.from_orm_obj(op)


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

@router.delete(
    "/{operation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an operation",
)
async def delete_operation(
    operation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    op = await _get_operation_or_404(db, operation_id, current_user.id)
    lifecycle_id = op.plot_lifecycle_id

    # Collect storage paths before cascade removes the DB rows
    if settings.supabase_enabled:
        photo_paths_result = await db.execute(
            select(PlotOperationPhoto.storage_path).where(
                PlotOperationPhoto.operation_id == operation_id
            )
        )
        storage_paths = [row[0] for row in photo_paths_result.all()]
    else:
        storage_paths = []

    await db.delete(op)
    await db.flush()
    await _sync_lifecycle_bounds(db, lifecycle_id, current_user.id)

    # Best-effort cleanup of Supabase Storage files
    for path in storage_paths:
        try:
            await delete_file(path)
        except Exception:
            pass  # Already orphaned in storage — acceptable; DB is the source of truth
