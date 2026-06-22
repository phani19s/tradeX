from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class LoginHistory(Base):
    __tablename__ = "login_history"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    ip_address = Column(String, nullable=True)

    session_id = Column(String, nullable=True)

    device = Column(String, nullable=True)

    browser = Column(String, nullable=True)

    location = Column(String, nullable=True)

    login_time = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    logout_time = Column(DateTime(timezone=True), nullable=True)

    session_duration = Column(Integer, nullable=True)

    status = Column(
        String,
        default="Success"
    )
