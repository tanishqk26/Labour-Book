"""
Labour Router

CRUD endpoints for individual labourers.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status 
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.labour import Labour
from app.schemas.labour import LabourCreate, LabourRead, LabourUpdate, PaginatedLabours

router = APIRouter(prefix="/api/v1/labours", tags=["Labours"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def labour_to_read(labour: Labour) -> LabourRead:
    """Convert a Labour ORM object to a LabourRead schema."""
    return LabourRead(
        id=labour.id,
        name=labour.name,
        hometown=labour.hometown,
        phone=labour.phone,
        aadhaar=labour.aadhaar,
        daily_wage=float(labour.daily_wage),
        work_start_time=labour.work_start_time,
        work_end_time=labour.work_end_time,
        is_active=labour.is_active,
        status="active" if labour.is_active else "inactive",
        created_at=labour.created_at,
        updated_at=labour.updated_at,
    )


async def _get_labour_or_404(db: AsyncSession, labour_id: uuid.UUID) -> Labour:
    result = await db.execute(select(Labour).where(Labour.id == labour_id))
    labour = result.scalar_one_or_none()
    if labour is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Labour with id '{labour_id}' not found",
        )
    return labour


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=LabourRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a labour",
)
async def create_labour(
    payload: LabourCreate,
    db: AsyncSession = Depends(get_db),
) -> LabourRead:
    """Create a new individual labourer."""
    labour = Labour(**payload.model_dump())
    db.add(labour)
    await db.flush()
    await db.refresh(labour)
    return labour_to_read(labour)


@router.get(
    "",
    response_model=PaginatedLabours,
    summary="List labours",
)
async def list_labours(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Records per page"),
    search: Optional[str] = Query(None, description="Search by name or hometown"),
    status_filter: Optional[str] = Query(None, alias="status", description="active | inactive"),
    db: AsyncSession = Depends(get_db),
) -> PaginatedLabours:
    """
    Returns a paginated list of labours.
    - Filter by status (active/inactive)
    - Search by name or hometown
    """
    query = select(Labour)

    # Status filter
    if status_filter == "active":
        query = query.where(Labour.is_active.is_(True))
    elif status_filter == "inactive":
        query = query.where(Labour.is_active.is_(False))

    # Search filter
    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Labour.name.ilike(term),
                Labour.hometown.ilike(term),
            )
        )

    # Total count
    count_q = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar_one()

    # Paginated data
    offset = (page - 1) * page_size
    query = query.order_by(Labour.name).offset(offset).limit(page_size)
    result = await db.execute(query)
    labours = result.scalars().all()

    return PaginatedLabours(
        items=[labour_to_read(l) for l in labours],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(offset + len(labours)) < total,
    )


@router.get(
    "/{labour_id}",
    response_model=LabourRead,
    summary="Get a labour by ID",
)
async def get_labour(
    labour_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> LabourRead:
    """Retrieve a single labourer by their UUID."""
    labour = await _get_labour_or_404(db, labour_id)
    return labour_to_read(labour)


@router.patch(
    "/{labour_id}",
    response_model=LabourRead,
    summary="Update a labour",
)
async def update_labour(
    labour_id: uuid.UUID,
    payload: LabourUpdate,
    db: AsyncSession = Depends(get_db),
) -> LabourRead:
    """Partially update a labourer's profile."""
    labour = await _get_labour_or_404(db, labour_id)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(labour, field, value)

    await db.flush()
    await db.refresh(labour)
    return labour_to_read(labour)


@router.delete(
    "/{labour_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Deactivate a labour",
)
async def deactivate_labour(
    labour_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Soft-delete a labour by setting is_active=False.
    Preserves all attendance/payment history.
    """
    labour = await _get_labour_or_404(db, labour_id)
    labour.is_active = False
    await db.flush()


@router.delete(
    "/{labour_id}/hard",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Permanently delete a labour and all their records",
)
async def hard_delete_labour(
    labour_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Permanently delete a labour. Attendance records are deleted via CASCADE.
    """
    labour = await _get_labour_or_404(db, labour_id)
    await db.delete(labour)
    await db.flush()
