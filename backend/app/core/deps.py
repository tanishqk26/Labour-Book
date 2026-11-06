"""
Auth dependency — protects routes behind a valid session cookie OR Bearer token.

Cookie is used by the web frontend.
Authorization: Bearer <token> is used by the mobile app (React Native).

The user row is cached in-process for a short TTL so authenticated requests
don't pay a database round-trip just to re-load the user. Call
`invalidate_user_cache` whenever a user's profile / password / active flag
changes.
"""

import time
import uuid

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import SESSION_COOKIE_NAME, decode_access_token
from app.database import get_db
from app.models.user import User

UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
)

_USER_CACHE_TTL_SECONDS = 60
_USER_CACHE_MAX = 1024
_user_cache: dict[uuid.UUID, tuple[float, User]] = {}


def invalidate_user_cache(user_id: uuid.UUID) -> None:
    _user_cache.pop(user_id, None)


def _cache_user(user: User) -> None:
    if len(_user_cache) >= _USER_CACHE_MAX:
        _user_cache.clear()
    _user_cache[user.id] = (time.monotonic() + _USER_CACHE_TTL_SECONDS, user)


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    # 1. Try session cookie (web)
    token = request.cookies.get(SESSION_COOKIE_NAME)

    # 2. Fall back to Authorization: Bearer <token> (mobile)
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[len("Bearer "):]

    if not token:
        raise UNAUTHORIZED

    user_id = decode_access_token(token)
    if user_id is None:
        raise UNAUTHORIZED

    cached = _user_cache.get(user_id)
    if cached is not None and cached[0] > time.monotonic():
        return cached[1]

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        _user_cache.pop(user_id, None)
        raise UNAUTHORIZED

    _cache_user(user)
    return user
