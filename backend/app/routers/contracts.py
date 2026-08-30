"""
Contracts Router

CRUD endpoints for fixed-price contracts assigned to labourers or teams.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.contract import Contract
from app.models.labour import Labour
from app.models.team import Team
from app.schemas.contract import (
    ContractCreate,
    ContractRead,
    ContractUpdate,
    PaginatedContracts,
)

router = APIRouter(prefix="/api/v1/contracts", tags=["Contracts"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _resolve_entity_name(
    db: AsyncSession, contract: Contract
) -> Optional[str]:
    """Fetch the name of the associated labour or team."""
    if contract.entity_type == "individual" and contract.labour_id:
        result = await db.execute(
            select(Labour.name).where(Labour.id == contract.labour_id)
        )
        return result.scalar_one_or_none()
    elif contract.entity_type == "team" and contract.team_id:
        result = await db.execute(
            select(Team.name).where(Team.id == contract.team_id)
        )
        return result.scalar_one_or_none()
    return None


def contract_to_read(contract: Contract, entity_name: Optional[str] = None) -> ContractRead:
    return ContractRead(
        id=contract.id,
        title=contract.title,
        description=contract.description,
        entity_type=contract.entity_type,
        labour_id=contract.labour_id,
        team_id=contract.team_id,
        entity_name=entity_name,
        amount=float(contract.amount),
        assigned_date=contract.assigned_date,
        completed_date=contract.completed_date,
        status=contract.status,
        created_at=contract.created_at,
        updated_at=contract.updated_at,
    )


async def _get_contract_or_404(db: AsyncSession, contract_id: uuid.UUID) -> Contract:
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if contract is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contract '{contract_id}' not found",
        )
    return contract


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=ContractRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a contract",
)
async def create_contract(
    payload: ContractCreate,
    db: AsyncSession = Depends(get_db),
) -> ContractRead:
    """Create a new fixed-price contract."""
    # Validate entity exists
    if payload.entity_type == "individual" and payload.labour_id:
        result = await db.execute(select(Labour).where(Labour.id == payload.labour_id))
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Labour not found")
    elif payload.entity_type == "team" and payload.team_id:
        result = await db.execute(select(Team).where(Team.id == payload.team_id))
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Team not found")

    contract = Contract(
        title=payload.title,
        description=payload.description,
        entity_type=payload.entity_type,
        labour_id=payload.labour_id,
        team_id=payload.team_id,
        amount=payload.amount,
        assigned_date=payload.assigned_date,
        status=payload.status,
    )
    db.add(contract)
    await db.flush()
    await db.refresh(contract)
    entity_name = await _resolve_entity_name(db, contract)
    return contract_to_read(contract, entity_name)


@router.get(
    "",
    response_model=PaginatedContracts,
    summary="List contracts",
)
async def list_contracts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    entity_type: Optional[str] = Query(None, description="individual | team"),
    status_filter: Optional[str] = Query(None, alias="status", description="active | completed | cancelled"),
    labour_id: Optional[uuid.UUID] = Query(None),
    team_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> PaginatedContracts:
    """Paginated list of contracts with optional filters."""
    query = select(Contract)

    if entity_type:
        query = query.where(Contract.entity_type == entity_type)
    if status_filter:
        query = query.where(Contract.status == status_filter)
    if labour_id:
        query = query.where(Contract.labour_id == labour_id)
    if team_id:
        query = query.where(Contract.team_id == team_id)

    count_q = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar_one()

    offset = (page - 1) * page_size
    query = query.order_by(Contract.assigned_date.desc(), Contract.created_at.desc())
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    contracts = result.scalars().all()

    # Resolve entity names in batch
    labour_ids = [c.labour_id for c in contracts if c.labour_id]
    team_ids = [c.team_id for c in contracts if c.team_id]

    labour_names: dict = {}
    team_names: dict = {}

    if labour_ids:
        r = await db.execute(select(Labour.id, Labour.name).where(Labour.id.in_(labour_ids)))
        labour_names = {row[0]: row[1] for row in r.all()}

    if team_ids:
        r = await db.execute(select(Team.id, Team.name).where(Team.id.in_(team_ids)))
        team_names = {row[0]: row[1] for row in r.all()}

    items = []
    for c in contracts:
        if c.entity_type == "individual":
            name = labour_names.get(c.labour_id)
        else:
            name = team_names.get(c.team_id)
        items.append(contract_to_read(c, name))

    return PaginatedContracts(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_more=(offset + len(contracts)) < total,
    )


@router.get(
    "/{contract_id}",
    response_model=ContractRead,
    summary="Get a contract",
)
async def get_contract(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> ContractRead:
    contract = await _get_contract_or_404(db, contract_id)
    entity_name = await _resolve_entity_name(db, contract)
    return contract_to_read(contract, entity_name)


@router.patch(
    "/{contract_id}",
    response_model=ContractRead,
    summary="Update a contract",
)
async def update_contract(
    contract_id: uuid.UUID,
    payload: ContractUpdate,
    db: AsyncSession = Depends(get_db),
) -> ContractRead:
    """Partially update a contract. Amount and entity cannot be changed after creation."""
    contract = await _get_contract_or_404(db, contract_id)
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(contract, field, value)
    await db.flush()
    await db.refresh(contract)
    entity_name = await _resolve_entity_name(db, contract)
    return contract_to_read(contract, entity_name)


@router.delete(
    "/{contract_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a contract",
)
async def delete_contract(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Permanently delete a contract record."""
    contract = await _get_contract_or_404(db, contract_id)
    await db.delete(contract)
    await db.flush()
