"""Schemas for voice-entry endpoints."""

import uuid
from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class VoiceProduct(BaseModel):
    name: str
    dose: Optional[str] = None          # as spoken, e.g. "2 ml per 100 L", "1 bag"


class VoiceOperationDraft(BaseModel):
    """A proposed operation. Nothing is saved until the client confirms."""

    plot_id: Optional[uuid.UUID] = None        # None -> user must pick a plot
    plot_name: Optional[str] = None
    plot_text: Optional[str] = None            # what the farmer actually said about the plot
    category: str                               # Spraying | Fertigation | Labour Work | Other
    operation_date: date
    notes: str = ""
    products: list[VoiceProduct] = Field(default_factory=list)
    confidence: float = 0.0
    needs_review: list[str] = Field(default_factory=list)   # e.g. ["plot", "category"]


class VoiceParseResponse(BaseModel):
    transcript: str
    operations: list[VoiceOperationDraft]
    warnings: list[str] = Field(default_factory=list)


class VoiceAttendanceDraft(BaseModel):
    """A proposed attendance mark for one labourer or team on one day."""

    entity_type: Optional[str] = None           # "labour" | "team"; None -> user must pick
    entity_id: Optional[uuid.UUID] = None
    entity_name: Optional[str] = None
    entity_text: Optional[str] = None           # what the farmer actually said
    status: str = "present"                     # present | half_day | absent
    attendance_date: date
    num_labourers: Optional[int] = None         # teams only: members who came
    task: Optional[str] = None
    work_start_time: Optional[str] = None       # HH:MM
    work_end_time: Optional[str] = None         # HH:MM
    confidence: float = 0.0
    needs_review: list[str] = Field(default_factory=list)   # e.g. ["entity", "count"]


class VoiceAttendanceParseResponse(BaseModel):
    transcript: str
    entries: list[VoiceAttendanceDraft]
    warnings: list[str] = Field(default_factory=list)
