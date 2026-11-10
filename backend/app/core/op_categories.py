"""
Canonical operation categories.

The same four categories are used by web, mobile and the voice parser.
They are stored in plot_operations.operation_type exactly as written below.
Legacy / free-text values are left untouched (clients render them as "Other").
"""

from typing import Optional

SPRAYING = "Spraying"
FERTIGATION = "Fertigation"
LABOUR_WORK = "Labour Work"
OTHER = "Other"

CATEGORIES = (SPRAYING, FERTIGATION, LABOUR_WORK, OTHER)

# Accepted spellings -> canonical value (web used lowercase snake_case keys).
_ALIASES = {
    "spraying": SPRAYING,
    "spray": SPRAYING,
    "fertigation": FERTIGATION,
    "labour_work": LABOUR_WORK,
    "labour work": LABOUR_WORK,
    "labor_work": LABOUR_WORK,
    "labor work": LABOUR_WORK,
    "other": OTHER,
}


def normalize_category(value: Optional[str]) -> Optional[str]:
    """Map known aliases to the canonical category; leave anything else as-is."""
    if value is None:
        return None
    stripped = value.strip()
    return _ALIASES.get(stripped.lower(), stripped)
