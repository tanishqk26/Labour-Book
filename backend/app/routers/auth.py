"""
Auth Router

Google Sign-In: the frontend obtains an ID token from Google Identity
Services and posts it here. We verify it against Google's public keys,
upsert a local User record, and issue our own session cookie — no
password is ever collected or stored.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_current_user
from app.core.security import (
    SESSION_COOKIE_NAME,
    create_access_token,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.models.user import User
from app.schemas.user import GoogleLoginRequest, LoginRequest, SignupRequest, UserRead

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=not settings.is_dev,
        samesite="lax",
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )


@router.post("/google", response_model=UserRead)
async def login_with_google(
    body: GoogleLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google sign-in is not configured on the server",
        )

    try:
        claims = google_id_token.verify_oauth2_token(
            body.credential,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google credential",
        )

    google_sub = claims["sub"]
    email = claims.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account has no email",
        )
    name = claims.get("name") or email.split("@")[0]
    picture = claims.get("picture")

    result = await db.execute(select(User).where(User.google_sub == google_sub))
    user = result.scalar_one_or_none()

    if user is None:
        # Link to an existing account with the same email, if any.
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

    if user is None:
        user = User(
            google_sub=google_sub,
            email=email,
            name=name,
            picture_url=picture,
            is_active=True,
        )
        db.add(user)
    else:
        user.google_sub = google_sub
        user.name = name
        user.picture_url = picture

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been disabled",
        )

    user.last_login_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(user)

    token = create_access_token(user.id)
    _set_session_cookie(response, token)

    return UserRead.model_validate(user)


@router.post("/signup", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def signup(
    body: SignupRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email))
    existing = result.scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        email=body.email,
        name=body.name,
        password_hash=hash_password(body.password),
        is_active=True,
    )
    db.add(user)
    user.last_login_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(user)

    token = create_access_token(user.id)
    _set_session_cookie(response, token)

    return UserRead.model_validate(user)


@router.post("/login", response_model=UserRead)
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password",
    )

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is None or not user.password_hash:
        raise invalid_credentials
    if not verify_password(body.password, user.password_hash):
        raise invalid_credentials
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been disabled",
        )

    user.last_login_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(user)

    token = create_access_token(user.id)
    _set_session_cookie(response, token)

    return UserRead.model_validate(user)


@router.get("/me", response_model=UserRead)
async def read_current_user(user: User = Depends(get_current_user)):
    return UserRead.model_validate(user)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return {"message": "Logged out"}
