"""
Auth dependency — protects routes behind a valid session cookie OR Bearer token.

Cookie is used by the web frontend.
Authorization: Bearer <token> is used by the mobile app (React Native).
"""

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

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise UNAUTHORIZED

    return user
