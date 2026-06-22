from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.core.database import Base


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    session_token_id = Column(
        String,
        nullable=False,
        unique=True,
        index=True,
    )

    ip_address = Column(String, nullable=True)
    device = Column(String, nullable=True)
    browser = Column(String, nullable=True)
    location = Column(String, nullable=True)
    status = Column(String, nullable=False, default="Active")

    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    last_activity = Column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=True,
    )

    revoked_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    logout_time = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    session_duration = Column(Integer, nullable=True)
