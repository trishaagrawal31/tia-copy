import enum
from datetime import datetime

from sqlalchemy import String, Boolean, Enum, DateTime, func
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    student = "student"
    faculty = "faculty"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(primary_key=True)
    rit_id: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    department: Mapped[str | None] = mapped_column(String(150))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    @hybrid_property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    # relationships
    tia_profiles = relationship("TiaProfile", back_populates="user")
    owned_projects = relationship("ResearchProject", back_populates="owner", foreign_keys="ResearchProject.owner_user_id")
    supervised_projects = relationship("ResearchProject", back_populates="supervisor", foreign_keys="ResearchProject.faculty_supervisor_id")
    conversations = relationship("Conversation", back_populates="user")
    tasks = relationship("Task", back_populates="creator")
    streak_snapshots = relationship("StreakSnapshot", back_populates="user")
    streak_status = relationship("UserStreakStatus", back_populates="user", uselist=False)
    streak_events = relationship("StreakEvent", back_populates="user")
    badges = relationship("UserBadge", back_populates="user")
