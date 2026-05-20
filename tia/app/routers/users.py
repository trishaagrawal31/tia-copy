from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import bcrypt

from app.auth import get_current_active_user
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("", response_model=UserRead, status_code=201)
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    password_hash = bcrypt.hashpw(payload.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user = User(
        email=payload.email,
        password_hash=password_hash,
        first_name=payload.first_name,
        last_name=payload.last_name,
        role=payload.role,
        department=payload.department,
        rit_id=payload.rit_id,
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("", response_model=list[UserRead])
async def list_users(
    role: Optional[str] = Query(None, description="Filter by role (student, faculty, admin)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Allow authenticated users to list faculty (for project supervisor selection)
    if role == "faculty":
        query = select(User).where(User.role == UserRole.faculty, User.is_active == True)
        result = await db.execute(query)
        return result.scalars().all()
    
    # Only admins can list all users or filter by other roles
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized to view users")

    query = select(User)
    if role:
        try:
            role_enum = UserRole(role)
            query = query.where(User.role == role_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid role: {role}")
    
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{user_id}", response_model=UserRead)
async def get_user( user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user.role != UserRole.admin and current_user.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this user")
    return user


@router.patch("/{user_id}", response_model=UserRead)
async def update_user( user_id: int, payload: UserUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user.role != UserRole.admin and current_user.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this user")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user.role != UserRole.admin and current_user.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this user")

    await db.delete(user)
    await db.commit()
