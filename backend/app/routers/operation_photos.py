"""
Plot Operation Photos Router

Endpoints for uploading, listing, updating, and deleting photos
attached to a plot operation.  Binary data is stored in Supabase Storage;
PostgreSQL stores metadata only.

URL layout (nested under plot-operations):
  POST   /api/v1/plot-operations/{operation_id}/photos           upload a photo
  GET    /api/v1/plot-operations/{operation_id}/photos           list photos
  PATCH  /api/v1/plot-operations/{operation_id}/photos/{id}      update caption/order
  DELETE /api/v1/plot-operations/{operation_id}/photos/{id}      delete (storage + DB)

Limits
------
  · Max 5 photos per operation (MAX_PHOTOS_PER_OPERATION).
  · Accepted MIME types: image/jpeg, image/png, image/webp, image/heic, image/heif.
  · Max upload size: 10 MB per file (checked after reading the file into memory).

Security
--------
  · Every query filters on owner_id = current_user.id.
  · The operation itself must belong to current_user before photos can be touched.
"""

import uuid
import mimetypes
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_current_user
from app.core.storage import build_storage_path, delete_file, upload_file
from app.database import get_db
from app.models.plot_operation import PlotOperation
from app.models.plot_operation_photo import MAX_PHOTOS_PER_OPERATION, PlotOperationPhoto
from app.models.user import User
from app.schemas.photo import PhotoRead, PhotoUpdate

router = APIRouter(tags=["Operation Photos"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_operation_or_404(
    db: AsyncSession,
    operation_id: uuid.UUID,
    owner_id: uuid.UUID,
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


async def _get_photo_or_404(
    db: AsyncSession,
    photo_id: uuid.UUID,
    operation_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> PlotOperationPhoto:
    result = await db.execute(
        select(PlotOperationPhoto).where(
            PlotOperationPhoto.id == photo_id,
            PlotOperationPhoto.operation_id == operation_id,
            PlotOperationPhoto.owner_id == owner_id,
        )
    )
    photo = result.scalar_one_or_none()
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    return photo


async def _count_photos(
    db: AsyncSession,
    operation_id: uuid.UUID,
) -> int:
    result = await db.execute(
        select(func.count()).where(
            PlotOperationPhoto.operation_id == operation_id
        )
    )
    return result.scalar_one()


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

@router.post(
    "/api/v1/plot-operations/{operation_id}/photos",
    response_model=PhotoRead,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a photo for an operation",
)
async def upload_photo(
    operation_id: uuid.UUID,
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    sort_order: int = Form(0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PhotoRead:
    """
    Upload an image (JPEG, PNG, WebP, HEIC) as a farm operation photo.

    The client should compress/resize large images before sending.
    Max file size: 10 MB.  Max 5 photos per operation.

    File is stored in Supabase Storage under:
      {bucket}/{owner_id}/{plot_id}/{operation_id}/{uuid}.{ext}
    """
    if not settings.supabase_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Photo storage is not configured on this server.",
        )

    op = await _get_operation_or_404(db, operation_id, current_user.id)

    # Enforce 5-photo limit
    current_count = await _count_photos(db, operation_id)
    if current_count >= MAX_PHOTOS_PER_OPERATION:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Maximum {MAX_PHOTOS_PER_OPERATION} photos per operation.",
        )

    # Validate MIME type
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported file type '{content_type}'. Accepted: JPEG, PNG, WebP, HEIC.",
        )

    # Read and size-check
    data = await file.read()
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 10 MB limit.",
        )

    # Build storage path
    ext = _ext_for_mime(content_type)
    filename = f"{uuid.uuid4()}{ext}"
    storage_path = build_storage_path(current_user.id, op.plot_id, operation_id, filename)

    # Upload to Supabase Storage
    await upload_file(storage_path, data, content_type)

    # Persist metadata
    photo = PlotOperationPhoto(
        owner_id=current_user.id,
        operation_id=operation_id,
        storage_path=storage_path,
        caption=caption,
        sort_order=sort_order,
    )
    db.add(photo)
    await db.flush()
    await db.refresh(photo)
    return PhotoRead.from_orm_obj(photo)


def _ext_for_mime(mime: str) -> str:
    MAP = {
        "image/jpeg": ".jpg",
        "image/png":  ".png",
        "image/webp": ".webp",
        "image/heic": ".heic",
        "image/heif": ".heif",
    }
    return MAP.get(mime, ".jpg")


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

@router.get(
    "/api/v1/plot-operations/{operation_id}/photos",
    response_model=list[PhotoRead],
    summary="List photos for an operation",
)
async def list_photos(
    operation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PhotoRead]:
    await _get_operation_or_404(db, operation_id, current_user.id)

    result = await db.execute(
        select(PlotOperationPhoto)
        .where(
            PlotOperationPhoto.operation_id == operation_id,
            PlotOperationPhoto.owner_id == current_user.id,
        )
        .order_by(PlotOperationPhoto.sort_order, PlotOperationPhoto.created_at)
    )
    photos = result.scalars().all()
    return [PhotoRead.from_orm_obj(p) for p in photos]


# ---------------------------------------------------------------------------
# Update (caption / sort_order)
# ---------------------------------------------------------------------------

@router.patch(
    "/api/v1/plot-operations/{operation_id}/photos/{photo_id}",
    response_model=PhotoRead,
    summary="Update photo caption or sort order",
)
async def update_photo(
    operation_id: uuid.UUID,
    photo_id: uuid.UUID,
    payload: PhotoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PhotoRead:
    photo = await _get_photo_or_404(db, photo_id, operation_id, current_user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(photo, field, value)
    await db.flush()
    await db.refresh(photo)
    return PhotoRead.from_orm_obj(photo)


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

@router.delete(
    "/api/v1/plot-operations/{operation_id}/photos/{photo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an operation photo",
)
async def delete_photo(
    operation_id: uuid.UUID,
    photo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Deletes both the Supabase Storage file and the DB metadata row.
    Storage deletion failure is logged but does not block the DB delete.
    """
    photo = await _get_photo_or_404(db, photo_id, operation_id, current_user.id)
    storage_path = photo.storage_path

    # Delete from DB first (idempotent if storage delete later fails)
    await db.delete(photo)
    await db.flush()

    # Best-effort storage delete
    try:
        await delete_file(storage_path)
    except Exception:
        pass  # File may already be gone; metadata row is already deleted
