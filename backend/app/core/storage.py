"""
Supabase Storage Utility

Thin async-compatible wrapper around the Supabase Python client for
farm-media photo uploads and deletes.

All Storage I/O is synchronous under the hood (supabase-py uses httpx);
we run it in a thread pool via asyncio.to_thread so it doesn't block the
async event loop.

Bucket layout:
  farm-media/{owner_id}/{plot_id}/{operation_id}/{filename}

The bucket must already exist in your Supabase project with public read
access (or with signed URLs — configure per preference).
"""

import asyncio
import mimetypes
import uuid
from typing import Optional

from app.config import settings


# ---------------------------------------------------------------------------
# Lazy client — only instantiated when Supabase is configured
# ---------------------------------------------------------------------------

_client = None


def _get_client():
    global _client
    if _client is None:
        if not settings.supabase_enabled:
            raise RuntimeError(
                "Supabase is not configured. "
                "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file."
            )
        from supabase import create_client  # noqa: PLC0415
        _client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _client


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def build_storage_path(
    owner_id: uuid.UUID,
    plot_id: uuid.UUID,
    operation_id: uuid.UUID,
    filename: str,
) -> str:
    """Construct the canonical storage path for a photo."""
    return f"{owner_id}/{plot_id}/{operation_id}/{filename}"


def public_url(storage_path: str) -> str:
    """Return the public URL for a stored file."""
    bucket = settings.supabase_storage_bucket
    return f"{settings.supabase_url}/storage/v1/object/public/{bucket}/{storage_path}"


async def upload_file(
    storage_path: str,
    data: bytes,
    content_type: str = "image/webp",
) -> str:
    """
    Upload bytes to Supabase Storage and return the storage_path.
    Runs synchronous client in a thread pool to avoid blocking the event loop.
    """
    client = _get_client()
    bucket = settings.supabase_storage_bucket

    def _upload():
        return client.storage.from_(bucket).upload(
            path=storage_path,
            file=data,
            file_options={"content-type": content_type, "upsert": "false"},
        )

    await asyncio.to_thread(_upload)
    return storage_path


async def delete_file(storage_path: str) -> None:
    """
    Delete a file from Supabase Storage.
    Silently ignores 404 — file may have already been removed.
    """
    client = _get_client()
    bucket = settings.supabase_storage_bucket

    def _delete():
        client.storage.from_(bucket).remove([storage_path])

    await asyncio.to_thread(_delete)
