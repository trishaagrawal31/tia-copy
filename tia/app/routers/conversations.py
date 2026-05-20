from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_active_user
from app.database import get_db
from app.models.conversation import Conversation
from app.models.message import Message, MessageRole, SenderType
from app.models.research_project import ProjectFaculty, ResearchProject
from app.models.user import User, UserRole
from app.schemas.conversation import ConversationCreate, ConversationRead, ConversationUpdate, ConversationWithProjectRead
from app.schemas.message import MessageCreate, MessageRead

router = APIRouter(prefix="/conversations", tags=["Conversations"])


async def get_conversation_by_id(conversation_id: int, db: AsyncSession, load_project: bool = False) -> Conversation | None:
    query = select(Conversation).where(Conversation.conversation_id == conversation_id)
    if load_project:
        query = query.options(selectinload(Conversation.project).selectinload(ResearchProject.supervisor))
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def user_can_access_conversation(conversation: Conversation, current_user: User, db: AsyncSession) -> bool:
    if conversation.user_id == current_user.user_id:
        return True
    if current_user.role == UserRole.admin:
        return True
    if current_user.role != UserRole.faculty or conversation.project_id is None:
        return False

    result = await db.execute(
        select(ResearchProject).where(
            ResearchProject.project_id == conversation.project_id,
            ResearchProject.faculty_supervisor_id == current_user.user_id,
        )
    )
    if result.scalar_one_or_none():
        return True

    result = await db.execute(
        select(ProjectFaculty).where(
            ProjectFaculty.project_id == conversation.project_id,
            ProjectFaculty.faculty_user_id == current_user.user_id,
        )
    )
    return result.scalar_one_or_none() is not None


# ── Conversations ───────────────────────────────────────

@router.post("", response_model=ConversationRead, status_code=201)
async def create_conversation(
    payload: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    conversation = Conversation(
        user_id=current_user.user_id,
        project_id=payload.project_id,
        tia_profile_id=payload.tia_profile_id,
        title=payload.title,
    )
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    return conversation


@router.get("", response_model=list[ConversationWithProjectRead])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Build base query with eager loading of project and supervisor
    base_query = select(Conversation).options(
        selectinload(Conversation.project).selectinload(ResearchProject.supervisor)
    )
    
    if current_user.role == UserRole.admin:
        # Admins can see all conversations
        result = await db.execute(base_query)
    elif current_user.role == UserRole.faculty:
        # Faculty can see conversations for projects they supervise or are assigned to
        faculty_project_ids = await db.execute(
            select(ProjectFaculty.project_id).where(ProjectFaculty.faculty_user_id == current_user.user_id)
        )
        supervisor_project_ids = await db.execute(
            select(ResearchProject.project_id).where(ResearchProject.faculty_supervisor_id == current_user.user_id)
        )
        project_ids = set(faculty_project_ids.scalars().all()) | set(supervisor_project_ids.scalars().all())
        if project_ids:
            result = await db.execute(base_query.where(Conversation.project_id.in_(project_ids)))
        else:
            result = await db.execute(base_query.where(False))
    else:
        # Students can only see their own conversations
        result = await db.execute(base_query.where(Conversation.user_id == current_user.user_id))
    return result.scalars().all()


@router.get("/{conversation_id}", response_model=ConversationWithProjectRead)
async def get_conversation(conversation_id: int,db: AsyncSession = Depends(get_db),current_user: User = Depends(get_current_active_user),
):
    conversation = await get_conversation_by_id(conversation_id, db, load_project=True)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if not await user_can_access_conversation(conversation, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized to access this conversation")
    return conversation


@router.patch("/{conversation_id}", response_model=ConversationRead)
async def update_conversation(
    conversation_id: int,
    payload: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    conversation = await get_conversation_by_id(conversation_id, db)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conversation.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this conversation")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(conversation, field, value)

    await db.commit()
    await db.refresh(conversation)
    return conversation


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    conversation = await get_conversation_by_id(conversation_id, db)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conversation.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this conversation")

    await db.delete(conversation)
    await db.commit()


# ── Messages ────────────────────────────────────────────

@router.post("/{conversation_id}/messages", response_model=MessageRead, status_code=201)
async def create_message( conversation_id: int, payload: MessageCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user),
):
    conversation = await get_conversation_by_id(conversation_id, db)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if not await user_can_access_conversation(conversation, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized to add messages to this conversation")

    if payload.sender_type == SenderType.user:
        if current_user.user_id != conversation.user_id:
            raise HTTPException(status_code=403, detail="Only the conversation owner can send user messages")
        if payload.message_role != MessageRole.user_query:
            raise HTTPException(status_code=400, detail="User messages must use the user_query role")
        sender_user_id = current_user.user_id
    elif payload.sender_type == SenderType.professor:
        if current_user.role not in (UserRole.faculty, UserRole.admin):
            raise HTTPException(status_code=403, detail="Only faculty or admin users can send professor messages")
        if payload.message_role != MessageRole.professor_reply:
            raise HTTPException(status_code=400, detail="Professor messages must use the professor_reply role")
        sender_user_id = current_user.user_id
    elif payload.sender_type == SenderType.tia:
        if current_user.role != UserRole.admin:
            raise HTTPException(status_code=403, detail="Only admin users can create TIA system messages directly")
        if payload.message_role not in (MessageRole.tia_reply, MessageRole.system_note):
            raise HTTPException(status_code=400, detail="TIA messages must use tia_reply or system_note role")
        sender_user_id = None
    else:
        raise HTTPException(status_code=400, detail="Invalid sender type")

    message = Message(
        conversation_id=conversation_id,
        sender_type=payload.sender_type,
        sender_user_id=sender_user_id,
        content=payload.content,
        message_role=payload.message_role,
        parent_message_id=payload.parent_message_id,
        is_visible_to_user=payload.is_visible_to_user,
        metadata_json=payload.metadata_json,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)

    if payload.sender_type == SenderType.user:
        forwarded_note = Message(
            conversation_id=conversation_id,
            sender_type=SenderType.tia,
            sender_user_id=None,
            content="TIA has forwarded this question to faculty.",
            message_role=MessageRole.system_note,
            parent_message_id=message.message_id,
            is_visible_to_user=False,
        )
        db.add(forwarded_note)
        await db.commit()
    elif payload.sender_type == SenderType.professor:
        tia_response = Message(
            conversation_id=conversation_id,
            sender_type=SenderType.tia,
            sender_user_id=None,
            content=payload.content,
            message_role=MessageRole.tia_reply,
            parent_message_id=message.message_id,
            is_visible_to_user=True,
            metadata_json={"relayed_from_professor": current_user.user_id},
        )
        db.add(tia_response)
        await db.commit()

    return message


@router.get("/{conversation_id}/messages", response_model=list[MessageRead])
async def list_messages(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    conversation = await get_conversation_by_id(conversation_id, db)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if not await user_can_access_conversation(conversation, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized to access messages for this conversation")

    query = select(Message).where(Message.conversation_id == conversation_id)
    if current_user.role == UserRole.student and current_user.user_id == conversation.user_id:
        query = query.where(Message.is_visible_to_user == True)

    result = await db.execute(query)
    return result.scalars().all()
