from datetime import datetime
from pydantic import BaseModel


class ConversationCreate(BaseModel):
    project_id: int | None = None
    tia_profile_id: int | None = None
    title: str | None = None


class FacultySummary(BaseModel):
    user_id: int
    full_name: str
    email: str

    model_config = {"from_attributes": True}


class ProjectSummary(BaseModel):
    project_id: int
    title: str
    faculty_supervisor_id: int | None = None
    faculty_supervisor: FacultySummary | None = None

    model_config = {"from_attributes": True}


class ConversationRead(BaseModel):
    conversation_id: int
    user_id: int
    project_id: int | None
    tia_profile_id: int | None
    title: str | None
    is_archived: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationWithProjectRead(ConversationRead):
    """Extended conversation read that includes project and faculty info"""
    project: ProjectSummary | None = None


class ConversationUpdate(BaseModel):
    title: str | None = None
    is_archived: bool | None = None
