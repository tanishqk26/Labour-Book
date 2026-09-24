"""
User / Auth Pydantic Schemas
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserRead(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    picture_url: Optional[str] = None
    created_at: datetime
    # Populated only on login/signup — lets mobile clients store the token
    # without relying on HTTP-only cookies. Web clients can ignore this field.
    access_token: Optional[str] = None

    model_config = {"from_attributes": True}


class GoogleLoginRequest(BaseModel):
    credential: str


class SignupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)
