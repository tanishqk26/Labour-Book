"""Schemas for the farm expense / income ledger."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

KINDS = ("expense", "income")
EXPENSE_CATEGORIES = (
    "medicine", "fertiliser", "labour", "fuel", "machinery", "electricity", "transport", "other",
)
INCOME_CATEGORIES = ("sale", "other")


def _check_category(kind: str, category: str) -> str:
    allowed = EXPENSE_CATEGORIES if kind == "expense" else INCOME_CATEGORIES
    if category not in allowed:
        raise ValueError(f"category for {kind} must be one of: {', '.join(allowed)}")
    return category


def status_of(amount: Optional[Decimal], paid: Decimal) -> str:
    if amount is None:
        return "price_pending"
    if paid >= amount:
        return "paid"
    return "partial" if paid > 0 else "credit"


class _Fields(BaseModel):
    @field_validator("party", "description", check_fields=False)
    @classmethod
    def _strip(cls, v: Optional[str]) -> Optional[str]:
        v = (v or "").strip()
        return v or None


class TransactionCreate(_Fields):
    kind: str
    txn_date: date
    category: str
    plot_id: Optional[uuid.UUID] = None
    operation_id: Optional[uuid.UUID] = None
    party: Optional[str] = Field(None, max_length=120)
    amount: Optional[Decimal] = Field(None, ge=0, max_digits=12, decimal_places=2)
    amount_paid: Decimal = Field(Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    description: Optional[str] = Field(None, max_length=300)

    @field_validator("kind")
    @classmethod
    def _kind(cls, v: str) -> str:
        if v not in KINDS:
            raise ValueError("kind must be 'expense' or 'income'")
        return v

    @model_validator(mode="after")
    def _consistent(self):
        _check_category(self.kind, self.category)
        if self.kind == "income" and self.amount is None:
            raise ValueError("income needs an amount")
        if self.amount is not None and self.amount_paid > self.amount:
            raise ValueError("amount_paid cannot be more than amount")
        return self


class TransactionUpdate(_Fields):
    txn_date: Optional[date] = None
    category: Optional[str] = None
    plot_id: Optional[uuid.UUID] = None
    operation_id: Optional[uuid.UUID] = None
    party: Optional[str] = Field(None, max_length=120)
    amount: Optional[Decimal] = Field(None, ge=0, max_digits=12, decimal_places=2)
    amount_paid: Optional[Decimal] = Field(None, ge=0, max_digits=12, decimal_places=2)
    description: Optional[str] = Field(None, max_length=300)


class TransactionRead(BaseModel):
    id: uuid.UUID
    kind: str
    txn_date: date
    category: str
    plot_id: Optional[uuid.UUID] = None
    plot_name: Optional[str] = None
    operation_id: Optional[uuid.UUID] = None
    party: Optional[str] = None
    amount: Optional[float] = None
    amount_paid: float = 0
    balance: Optional[float] = None          # still to pay / receive; None while price is pending
    status: str                              # paid | partial | credit | price_pending
    description: Optional[str] = None
    created_at: datetime


class SettleRequest(BaseModel):
    kind: str
    party: str = Field(..., min_length=1, max_length=120)
    amount: Decimal = Field(..., gt=0, max_digits=12, decimal_places=2)

    @field_validator("kind")
    @classmethod
    def _kind(cls, v: str) -> str:
        if v not in KINDS:
            raise ValueError("kind must be 'expense' or 'income'")
        return v


class PlotPnL(BaseModel):
    plot_id: uuid.UUID
    plot_name: str
    size_acres: float
    income: float
    expense: float
    profit: float
    profit_per_acre: Optional[float] = None
    expense_per_acre: Optional[float] = None
    unpriced_count: int = 0


class SharedTotals(BaseModel):
    income: float
    expense: float
    unpriced_count: int = 0


class ExpenseSummary(BaseModel):
    year: int                                # farm year, named by the year it starts (Apr 1)
    date_from: date
    date_to: date
    income: float
    expense: float
    profit: float
    unpriced_count: int                      # expenses in range with no price yet (profit is overstated)
    allocated: bool                          # True: farm-wide amounts were split across plots by acreage
    plots: list[PlotPnL]
    shared: SharedTotals                     # farm-wide (no plot) amounts


class PartyDue(BaseModel):
    kind: str
    party: Optional[str] = None
    total: float                             # priced entries still open
    paid: float
    balance: float
    unpriced_count: int
    entries: int


class SettleResult(BaseModel):
    applied: float
    remaining_balance: float
    entries_updated: int
