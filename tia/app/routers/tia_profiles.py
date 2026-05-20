from sqlalchemy import select

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_active_user
from app.database import get_db
from app.models.tia_profile import TiaProfile
from app.models.user import User, UserRole
from app.schemas.tia_profile import TiaProfileCreate, TiaProfileRead, TiaProfileUpdate

router = APIRouter(prefix="/users/{user_id}/tia-profiles", tags=["TIA Profiles"])


def _authorize_user_access(user_id: int, current_user: User) -> None:
    if current_user.role != UserRole.admin and current_user.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to manage this user's TIA profiles")


@router.post("", response_model=TiaProfileRead, status_code=201)
async def create_tia_profile(user_id: int, payload: TiaProfileCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user),
):
    _authorize_user_access(user_id, current_user)

    result = await db.execute(select(TiaProfile).where(TiaProfile.user_id == user_id, TiaProfile.name == payload.name))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Profile name already registered")

    tia_profile = TiaProfile(
        user_id=user_id,
        name=payload.name,
        description=payload.description,
        system_prompt=payload.system_prompt,
        tone=payload.tone,
        expertise_area=payload.expertise_area,
        is_default=payload.is_default,
    )
    db.add(tia_profile)
    await db.commit()
    await db.refresh(tia_profile)
    return tia_profile


@router.get("", response_model=list[TiaProfileRead])
async def list_tia_profiles(user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user),
):
    _authorize_user_access(user_id, current_user)
    result = await db.execute(select(TiaProfile).where(TiaProfile.user_id == user_id))
    return result.scalars().all()


@router.get("/{profile_id}", response_model=TiaProfileRead)
async def get_tia_profile( user_id: int, profile_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user),
):
    _authorize_user_access(user_id, current_user)
    result = await db.execute(select(TiaProfile).where(TiaProfile.user_id == user_id, TiaProfile.tia_profile_id == profile_id))
    tia_profile = result.scalar_one_or_none()
    if tia_profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return tia_profile


@router.patch("/{profile_id}", response_model=TiaProfileRead)
async def update_tia_profile( user_id: int, profile_id: int, payload: TiaProfileUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user),
):
    _authorize_user_access(user_id, current_user)
    result = await db.execute(select(TiaProfile).where(TiaProfile.user_id == user_id, TiaProfile.tia_profile_id == profile_id))
    tia_profile = result.scalar_one_or_none()
    if tia_profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tia_profile, field, value)

    await db.commit()
    await db.refresh(tia_profile)
    return tia_profile


@router.delete("/{profile_id}", status_code=204)
async def delete_tia_profile(user_id: int, profile_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user),
):
    _authorize_user_access(user_id, current_user)
    result = await db.execute(select(TiaProfile).where(TiaProfile.user_id == user_id, TiaProfile.tia_profile_id == profile_id))
    tia_profile = result.scalar_one_or_none()
    if tia_profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    await db.delete(tia_profile)
    await db.commit()
