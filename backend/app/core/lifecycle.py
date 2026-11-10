"""
Resolve (and lazily create) the farm year / plot enrollment / stage for an
operation date, so users never have to pick season or stage by hand.
"""

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.seasons import farm_year_for, stage_for
from app.models.farm_year import FarmYear
from app.models.plot import Plot
from app.models.plot_farm_year import PlotFarmYear, PlotLifecycle

_STAGE_NAMES = {
    "vegetative": "Vegetative growth",
    "fruit_production": "Fruit production",
}


async def _get_or_create_farm_year(db: AsyncSession, owner_id: uuid.UUID, year: int) -> FarmYear:
    q = select(FarmYear).where(FarmYear.owner_id == owner_id, FarmYear.year == year)
    fy = (await db.execute(q)).scalar_one_or_none()
    if fy is not None:
        return fy
    try:
        async with db.begin_nested():
            fy = FarmYear(
                owner_id=owner_id,
                year=year,
                start_date=date(year, 4, 1),
                end_date=date(year + 1, 3, 31),
                transition_date=None,
            )
            db.add(fy)
            await db.flush()
        return fy
    except IntegrityError:  # concurrent request created it first
        return (await db.execute(q)).scalar_one()


async def _get_or_create_enrollment(
    db: AsyncSession, owner_id: uuid.UUID, plot: Plot, fy: FarmYear
) -> PlotFarmYear:
    q = select(PlotFarmYear).where(
        PlotFarmYear.plot_id == plot.id, PlotFarmYear.farm_year_id == fy.id
    )
    pfy = (await db.execute(q)).scalar_one_or_none()
    if pfy is None:
        try:
            async with db.begin_nested():
                pfy = PlotFarmYear(
                    owner_id=owner_id,
                    plot_id=plot.id,
                    farm_year_id=fy.id,
                    crop_name=plot.crop_name,
                    acreage=plot.size_acres,
                )
                db.add(pfy)
                await db.flush()
                for stage, name in _STAGE_NAMES.items():
                    db.add(
                        PlotLifecycle(
                            owner_id=owner_id,
                            plot_farm_year_id=pfy.id,
                            lifecycle_type=stage,
                            name=name,
                        )
                    )
                await db.flush()
        except IntegrityError:
            pfy = (await db.execute(q)).scalar_one()
    return pfy


async def resolve_lifecycle_id(
    db: AsyncSession,
    owner_id: uuid.UUID,
    plot_id: uuid.UUID,
    op_date: date,
) -> uuid.UUID:
    """
    Return the PlotLifecycle id for `plot_id` on `op_date`, creating the farm
    year / enrollment / stages when they do not exist yet.
    The plot must already have been verified as owned by `owner_id`.
    """
    plot = (
        await db.execute(select(Plot).where(Plot.id == plot_id, Plot.owner_id == owner_id))
    ).scalar_one()

    year = farm_year_for(op_date)
    fy = await _get_or_create_farm_year(db, owner_id, year)
    pfy = await _get_or_create_enrollment(db, owner_id, plot, fy)

    wanted = stage_for(op_date, fy.year, fy.transition_date)
    lc = (
        await db.execute(
            select(PlotLifecycle).where(
                PlotLifecycle.plot_farm_year_id == pfy.id,
                PlotLifecycle.lifecycle_type == wanted,
            )
        )
    ).scalars().first()
    if lc is None:  # enrollment predates stage rows (defensive)
        lc = PlotLifecycle(
            owner_id=owner_id,
            plot_farm_year_id=pfy.id,
            lifecycle_type=wanted,
            name=_STAGE_NAMES[wanted],
        )
        db.add(lc)
        await db.flush()
    return lc.id
