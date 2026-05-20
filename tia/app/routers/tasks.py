from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_active_user
from app.database import get_db
from app.models.research_project import ProjectFaculty, ResearchProject
from app.models.task import Task
from app.models.user import User, UserRole
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["Tasks"])


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


async def user_can_manage_project(project: ResearchProject, current_user: User, db: AsyncSession) -> bool:
    return await user_can_access_project(project, current_user, db)


@router.post("", response_model=TaskRead, status_code=201)
async def create_task(
    project_id: int,
    payload: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if project_id != payload.project_id:
        raise HTTPException(status_code=400, detail="Project ID in path and body must match")

    project_result = await db.execute(select(ResearchProject).where(ResearchProject.project_id == project_id))
    project = project_result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if not await user_can_manage_project(project, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized to create tasks for this project")

    result = await db.execute(select(Task).where(Task.project_id == project_id, Task.title == payload.title))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Task title already registered")

    task = Task(
        project_id=project_id,
        created_by_user_id=current_user.user_id,
        title=payload.title,
        description=payload.description,
        type=payload.type,
        due_date=payload.due_date,
        priority=payload.priority,
        order_index=payload.order_index,
        estimated_minutes=payload.estimated_minutes,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.get("", response_model=list[TaskRead])
async def list_tasks(project_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user),
):
    project_result = await db.execute(select(ResearchProject).where(ResearchProject.project_id == project_id))
    project = project_result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if not await user_can_access_project(project, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized to list tasks for this project")

    result = await db.execute(select(Task).where(Task.project_id == project_id))
    return result.scalars().all()


@router.get("/{task_id}", response_model=TaskRead)
async def get_task(project_id: int, task_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user),
):
    project_result = await db.execute(select(ResearchProject).where(ResearchProject.project_id == project_id))
    project = project_result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if not await user_can_access_project(project, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized to view this task")

    result = await db.execute(select(Task).where(Task.project_id == project_id, Task.task_id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}", response_model=TaskRead)
async def update_task(project_id: int, task_id: int, payload: TaskUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user),
):
    project_result = await db.execute(select(ResearchProject).where(ResearchProject.project_id == project_id))
    project = project_result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if not await user_can_manage_project(project, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized to update this task")

    result = await db.execute(select(Task).where(Task.project_id == project_id, Task.task_id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)

    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
async def delete_task(project_id: int, task_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user),
):
    project_result = await db.execute(select(ResearchProject).where(ResearchProject.project_id == project_id))
    project = project_result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if not await user_can_manage_project(project, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized to delete this task")

    result = await db.execute(select(Task).where(Task.project_id == project_id, Task.task_id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    await db.delete(task)
    await db.commit()
