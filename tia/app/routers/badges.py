from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_active_user
from app.database import get_db
from app.models.badge import Badge, UserBadge
from app.models.user import User, UserRole
from app.schemas.badge import BadgeCreate, BadgeRead, UserBadgeRead

router = APIRouter(prefix="/badges", tags=["Badges"])


@router.post("/", response_model=BadgeRead, status_code=201)
async def create_badge( payload: BadgeCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user),
):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized to create badges")

    result = await db.execute(select(Badge).where(Badge.code == payload.code))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Badge code already exists")

    badge = Badge(
        code=payload.code,
        name=payload.name,
        description=payload.description,
        icon_url=payload.icon_url,
        criteria_type=payload.criteria_type,
        criteria_value=payload.criteria_value,
    )
    db.add(badge)
    await db.commit()
    await db.refresh(badge)
    return badge


@router.get("/", response_model=list[BadgeRead])
async def list_badges(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Badge))
    return result.scalars().all()


@router.get("/{badge_id}", response_model=BadgeRead)
async def get_badge(badge_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Badge).where(Badge.badge_id == badge_id))
    badge = result.scalar_one_or_none()
    if badge is None:
        raise HTTPException(status_code=404, detail="Badge not found")
    return badge


# ── User badges ─────────────────────────────────────────

@router.get("/users/{user_id}", response_model=list[UserBadgeRead])
async def list_user_badges( user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user),
):
    if current_user.role != UserRole.admin and current_user.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this user's badges")

    result = await db.execute(select(UserBadge).where(UserBadge.user_id == user_id))
    return result.scalars().all()


@router.post("/users/{user_id}/{badge_id}", response_model=UserBadgeRead, status_code=201)
async def award_badge( user_id: int, badge_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user),
):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized to award badges")

    badge_result = await db.execute(select(Badge).where(Badge.badge_id == badge_id))
    badge = badge_result.scalar_one_or_none()
    if badge is None:
        raise HTTPException(status_code=404, detail="Badge not found")

    user_result = await db.execute(select(User).where(User.user_id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.execute(select(UserBadge).where(UserBadge.user_id == user_id, UserBadge.badge_id == badge_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User already has this badge")

    user_badge = UserBadge(
        user_id=user_id,
        badge_id=badge_id,
    )
    db.add(user_badge)
    await db.commit()
    await db.refresh(user_badge)
    return user_badge
