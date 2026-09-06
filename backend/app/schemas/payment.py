"""
Payment Pydantic Schemas
"""

import uuid
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


PaymentMethod = Literal["cash", "upi", "bank_transfer", "other"]


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

class PaymentCreate(BaseModel):
    labour_id: Optional[uuid.UUID] = None
    team_id: Optional[uuid.UUID] = None
    date: date
    amount: float = Field(..., gt=0, description="Amount paid in INR")
    method: PaymentMethod = "cash"
    notes: Optional[str] = None

    @model_validator(mode="after")
    def check_entity(self) -> "PaymentCreate":
        if self.labour_id is None and self.team_id is None:
            raise ValueError("Either labour_id or team_id is required")
        if self.labour_id is not None and self.team_id is not None:
            raise ValueError("Only one of labour_id or team_id can be set")
        return self


# ---------------------------------------------------------------------------
# Update (PATCH — all fields optional)
# ---------------------------------------------------------------------------

class PaymentUpdate(BaseModel):
    date: Optional[date] = None
    amount: Optional[float] = Field(None, gt=0)
    method: Optional[PaymentMethod] = None
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Read (response)
# ---------------------------------------------------------------------------

class PaymentRead(BaseModel):
    id: uuid.UUID
    labour_id: Optional[uuid.UUID] = None
    team_id: Optional[uuid.UUID] = None
    entity_name: Optional[str] = None
    entity_type: str  # "individual" | "team"
    date: date
    amount: float
    method: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Entity financial summary (earnings + payments = pending)
# ---------------------------------------------------------------------------

class EntityPaymentSummary(BaseModel):
    entity_id: uuid.UUID
    entity_type: str          # "individual" | "team"
    entity_name: str
    total_earned: float       # from attendance + contracts
    total_paid: float         # from payments table
    pending: float            # total_earned - total_paid
    payment_status: str       # "paid" | "partially_paid" | "pending"


# ---------------------------------------------------------------------------
# Overall payments summary (for the page header)
# ---------------------------------------------------------------------------

class PaymentsSummary(BaseModel):
    total_earned: float
    total_paid: float
    total_pending: float
    paid_this_month: float


# ---------------------------------------------------------------------------
# Paginated payments list
# ---------------------------------------------------------------------------

class PaginatedPayments(BaseModel):
    items: list[PaymentRead]
    total: int
    page: int
    page_size: int
    has_more: bool
