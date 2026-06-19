from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String, unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    transaction_id = Column(Integer, nullable=True) 
    transaction_type = Column(String, nullable=True) # "DEPOSIT" or "WITHDRAWAL"
    issue_type = Column(String) # Deposit Issue, Withdrawal Issue, Payment Delay, Incorrect Amount, Other
    description = Column(Text)
    status = Column(String, default="OPEN") # OPEN, IN_PROGRESS, RESOLVED, CLOSED
    resolution = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="support_tickets")

class SupportMessage(Base):
    __tablename__ = "support_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    sender_type = Column(String) # "USER" or "ADMIN"
    message = Column(Text)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="support_messages")
