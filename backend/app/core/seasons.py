"""
Season / stage helpers for grape farm years.

A farm year ("season") runs Apr 1 -> Mar 31 and is named after the calendar
year it starts in.  Within a season there are two stages:

  · vegetative       Apr 1  -> day before the transition date
  · fruit_production transition date -> Mar 31   (default transition: Sep 1)

Everything here is pure (no I/O) so it is trivially testable.
"""

from datetime import date
from typing import Optional

# Default stage boundary: vegetative = Apr..Aug, fruit production = Sep..Mar
DEFAULT_TRANSITION_MONTH = 9
DEFAULT_TRANSITION_DAY = 1

STAGE_VEGETATIVE = "vegetative"
STAGE_FRUIT = "fruit_production"


def farm_year_for(d: date) -> int:
    """April-start year the date belongs to (Jan-Mar -> previous calendar year)."""
    return d.year if d.month >= 4 else d.year - 1


def default_transition(year: int) -> date:
    return date(year, DEFAULT_TRANSITION_MONTH, DEFAULT_TRANSITION_DAY)


def effective_transition(year: int, transition_date: Optional[date]) -> date:
    return transition_date if transition_date is not None else default_transition(year)


def stage_for(d: date, year: int, transition_date: Optional[date]) -> str:
    """Stage type for date `d` inside farm year `year`."""
    return STAGE_VEGETATIVE if d < effective_transition(year, transition_date) else STAGE_FRUIT
