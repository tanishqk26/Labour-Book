"""
Plot Operation Workers Router

Associates individual labourers or teams with a plot operation.

URL layout (nested under plot-operations):
  POST   /api/v1/plot-operations/{operation_id}/workers           add a worker
  GET    /api/v1/plot-operations/{operation_id}/workers           list workers
  PATCH  /api/v1/plot-operations/{operation_id}/workers/{id}      update hours_worked
  DELETE /api/v1/plot-operations/{operation_id}/workers/{id}      remove worker

Invariant: labour_id XOR team_id — enforced at schema + DB level.

Security: every query filters on owner_id = current_user.id.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.database import get_db
from app.models.labour import Labour
from app.models.plot_operation import PlotOperation
from app.models.plot_operation_worker import PlotOperationWorker
from app.models.team import Team
from app.models.user import User
from app.schemas.worker import WorkerCreate, WorkerRead, WorkerUpdate

router = APIRouter(tags=["Operation Workers"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_operation_or_404(
    db: AsyncSession, operation_id: uuid.UUID, owner_id: uuid.UUID
) -> PlotOperation:
    result = await db.execute(
        select(PlotOperation).where(
            PlotOperation.id == operation_id,
            PlotOperation.owner_id == owner_id,
        )
    )
    op = result.scalar_one_or_none()
    if op is None:
        raise HTTPException(status_code=404, detail="Operation not found")
    return op


async def _get_worker_or_404(
    db: AsyncSession,
    worker_id: uuid.UUID,
    operation_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> PlotOperationWorker:
    result = await db.execute(
        select(PlotOperationWorker)
        .options(
            selectinload(PlotOperationWorker.labour),
            selectinload(PlotOperationWorker.team),
        )
        .where(
            PlotOperationWorker.id == worker_id,
            PlotOperationWorker.operation_id == operation_id,
            PlotOperationWorker.owner_id == owner_id,
        )
    )
    w = result.scalar_one_or_none()
    if w is None:
        raise HTTPException(status_code=404, detail="Worker association not found")
    return w


async def _load_workers(
    db: AsyncSession, operation_id: uuid.UUID, owner_id: uuid.UUID
) -> list[PlotOperationWorker]:
    result = await db.execute(
        select(PlotOperationWorker)
        .options(
            selectinload(PlotOperationWorker.labour),
            selectinload(PlotOperationWorker.team),
        )
        .where(
            PlotOperationWorker.operation_id == operation_id,
            PlotOperationWorker.owner_id == owner_id,
        )
        .order_by(PlotOperationWorker.created_at)
    )
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Add worker
# ---------------------------------------------------------------------------

@router.post(
    "/api/v1/plot-operations/{operation_id}/workers",
    response_model=WorkerRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add a worker to an operation",
)
async def add_worker(
    operation_id: uuid.UUID,
    payload: WorkerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkerRead:
    """
    Associate an individual labour XOR a team with the operation.
    Returns 409 if the same labour/team is already associated.
    """
    await _get_operation_or_404(db, operation_id, current_user.id)

    # Validate that the referenced labour/team belongs to this owner
    if payload.labour_id:
        check = await db.execute(
            select(Labour.id).where(
                Labour.id == payload.labour_id,
                Labour.owner_id == current_user.id,
            )
        )
        if check.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Labour not found")

        # Duplicate check
        dup = await db.execute(
            select(PlotOperationWorker.id).where(
                PlotOperationWorker.operation_id == operation_id,
                PlotOperationWorker.labour_id == payload.labour_id,
            )
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="This labour is already associated with the operation")

    elif payload.team_id:
        check = await db.execute(
            select(Team.id).where(
                Team.id == payload.team_id,
                Team.owner_id == current_user.id,
            )
        )
        if check.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Team not found")

        dup = await db.execute(
            select(PlotOperationWorker.id).where(
                PlotOperationWorker.operation_id == operation_id,
                PlotOperationWorker.team_id == payload.team_id,
            )
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="This team is already associated with the operation")

    worker = PlotOperationWorker(
        owner_id=current_user.id,
        operation_id=operation_id,
        labour_id=payload.labour_id,
        team_id=payload.team_id,
        hours_worked=payload.hours_worked,
    )
    db.add(worker)
    await db.flush()

    worker = await _get_worker_or_404(db, worker.id, operation_id, current_user.id)
    return WorkerRead.from_orm_obj(worker)


# ---------------------------------------------------------------------------
# List workers
# ---------------------------------------------------------------------------

@router.get(
    "/api/v1/plot-operations/{operation_id}/workers",
    response_model=list[WorkerRead],
    summary="List workers on an operation",
)
async def list_workers(
    operation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[WorkerRead]:
    await _get_operation_or_404(db, operation_id, current_user.id)
    workers = await _load_workers(db, operation_id, current_user.id)
    return [WorkerRead.from_orm_obj(w) for w in workers]


# ---------------------------------------------------------------------------
# Update hours_worked
# ---------------------------------------------------------------------------

@router.patch(
    "/api/v1/plot-operations/{operation_id}/workers/{worker_id}",
    response_model=WorkerRead,
    summary="Update hours worked",
)
async def update_worker(
    operation_id: uuid.UUID,
    worker_id: uuid.UUID,
    payload: WorkerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkerRead:
    w = await _get_worker_or_404(db, worker_id, operation_id, current_user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(w, field, value)
    await db.flush()
    w = await _get_worker_or_404(db, worker_id, operation_id, current_user.id)
    return WorkerRead.from_orm_obj(w)


# ---------------------------------------------------------------------------
# Remove worker
# ---------------------------------------------------------------------------

@router.delete(
    "/api/v1/plot-operations/{operation_id}/workers/{worker_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a worker from an operation",
)
async def remove_worker(
    operation_id: uuid.UUID,
    worker_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    w = await _get_worker_or_404(db, worker_id, operation_id, current_user.id)
    await db.delete(w)
    await db.flush()
