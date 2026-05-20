from datetime import datetime
from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class UserCreate(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    role: UserRole
    department: str | None = None
    rit_id: str | None = None


class UserRead(BaseModel):
    user_id: int
    email: str
    first_name: str
    last_name: str
    full_name: str | None = None
    role: UserRole
    department: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    department: str | None = None
    is_active: bool | None = None
