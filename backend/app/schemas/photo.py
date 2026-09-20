"""
PlotOperationPhoto Pydantic Schemas
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PhotoRead(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    operation_id: uuid.UUID
    storage_path: str
    public_url: str          # derived from storage_path + supabase URL
    caption: Optional[str] = None
    sort_order: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_obj(cls, obj) -> "PhotoRead":
        from app.core.storage import public_url
        return cls(
            id=obj.id,
            owner_id=obj.owner_id,
            operation_id=obj.operation_id,
            storage_path=obj.storage_path,
            public_url=public_url(obj.storage_path),
            caption=obj.caption,
            sort_order=obj.sort_order,
            created_at=obj.created_at,
        )


class PhotoUpdate(BaseModel):
    caption: Optional[str] = None
    sort_order: Optional[int] = Field(None, ge=0)
