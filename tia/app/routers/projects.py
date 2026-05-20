from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_active_user
from app.database import get_db
from app.models.research_project import ProjectFaculty, ResearchProject
from app.models.user import User, UserRole
from app.schemas.research_project import (
    ProjectCreate, ProjectRead, ProjectUpdate,
    ProjectFacultyCreate, ProjectFacultyRead,
)

router = APIRouter(prefix="/projects", tags=["Research Projects"])


async def user_can_access_project(project: ResearchProject, current_user: User, db: AsyncSession) -> bool:
    if project.owner_user_id == current_user.user_id or current_user.role == UserRole.admin:
        return True
    if current_user.role != UserRole.faculty:
        return False
    if project.faculty_supervisor_id == current_user.user_id:
        return True
    existing = await db.execute(
        select(ProjectFaculty).where(
            ProjectFaculty.project_id == project.project_id,
            ProjectFaculty.faculty_user_id == current_user.user_id,
        )
    )
    return existing.scalar_one_or_none() is not None


@router.post("", response_model=ProjectRead, status_code=201)
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if payload.faculty_supervisor_id is not None:
        supervisor_result = await db.execute(select(User).where(User.user_id == payload.faculty_supervisor_id))
        supervisor = supervisor_result.scalar_one_or_none()
        if supervisor is None or supervisor.role not in (UserRole.faculty, UserRole.admin):
            raise HTTPException(status_code=400, detail="Supervisor must be a faculty or admin user")

    result = await db.execute(
        select(ResearchProject).where(
            ResearchProject.owner_user_id == current_user.user_id,
            ResearchProject.title == payload.title,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Project with this title already exists")

    project = ResearchProject(
        owner_user_id=current_user.user_id,
        title=payload.title,
        description=payload.description,
        course_code=payload.course_code,
        faculty_supervisor_id=payload.faculty_supervisor_id,
        status=payload.status,
        main_deadline=payload.main_deadline,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role == UserRole.admin:
        result = await db.execute(select(ResearchProject))
    else:
        result = await db.execute(
            select(ResearchProject).where(ResearchProject.owner_user_id == current_user.user_id)
        )
    return result.scalars().all()


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(ResearchProject).where(ResearchProject.project_id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if not await user_can_access_project(project, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    return project


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(ResearchProject).where(ResearchProject.project_id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_user_id != current_user.user_id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized to modify this project")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(ResearchProject).where(ResearchProject.project_id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_user_id != current_user.user_id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this project")
    await db.delete(project)
    await db.commit()


# ── Project Faculty ─────────────────────────────────────

@router.post("/{project_id}/faculty", response_model=ProjectFacultyRead, status_code=201)
async def add_faculty_to_project(
    project_id: int,
    payload: ProjectFacultyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    project_result = await db.execute(select(ResearchProject).where(ResearchProject.project_id == project_id))
    project = project_result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_user_id != current_user.user_id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized to add faculty to this project")

    faculty_result = await db.execute(select(User).where(User.user_id == payload.faculty_user_id))
    faculty_user = faculty_result.scalar_one_or_none()
    if faculty_user is None or faculty_user.role not in (UserRole.faculty, UserRole.admin):
        raise HTTPException(status_code=400, detail="Assigned faculty must be a valid faculty or admin user")

    existing = await db.execute(
        select(ProjectFaculty).where(
            ProjectFaculty.project_id == project_id,
            ProjectFaculty.faculty_user_id == payload.faculty_user_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Faculty already assigned to this project")

    project_faculty = ProjectFaculty(
        project_id=project_id,
        faculty_user_id=payload.faculty_user_id,
        role=payload.role,
    )
    db.add(project_faculty)
    await db.commit()
    await db.refresh(project_faculty)
    return project_faculty


@router.delete("/{project_id}/faculty/{project_faculty_id}", status_code=204)
async def remove_faculty_from_project(
    project_id: int,
    project_faculty_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    project_result = await db.execute(select(ResearchProject).where(ResearchProject.project_id == project_id))
    project = project_result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_user_id != current_user.user_id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized to remove faculty from this project")

    result = await db.execute(
        select(ProjectFaculty).where(
            ProjectFaculty.project_id == project_id,
            ProjectFaculty.project_faculty_id == project_faculty_id,
        )
    )
    project_faculty = result.scalar_one_or_none()
    if project_faculty is None:
        raise HTTPException(status_code=404, detail="Project faculty association not found")
    await db.delete(project_faculty)
    await db.commit()

