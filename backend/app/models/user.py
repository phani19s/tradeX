from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Boolean
from sqlalchemy import DateTime
from datetime import datetime

from app.core.database import Base 
from sqlalchemy.orm import relationship


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False)
    email = Column(String, unique=True)
    phone_number = Column(String, nullable=True)

    account_holder_name = Column(String, nullable=True)
    
    account_number = Column(String, nullable=True)
    
    ifsc_code = Column(String, nullable=True)
    
    bank_name = Column(String, nullable=True)
    upi_id = Column(String, nullable=True)
    password = Column(String)
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_method = Column(String, nullable=True)
    two_factor_secret = Column(String, nullable=True)
    is_admin = Column(
        Boolean,
        default=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )
    portfolio = relationship(
    "Portfolio",
    back_populates="user",
    uselist=False
    )
    
    trades = relationship(
        "Trade",
        back_populates="user"
    )

    support_tickets = relationship(
        "SupportTicket",
        back_populates="user"
    )

    support_messages = relationship(
        "SupportMessage",
        back_populates="user"
    )

    notifications = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan"
    )
