from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class AdminAuditLog(Base):
  __tablename__ = "admin_audit_logs"

  id = Column(Integer, primary_key=True, index=True)

  admin_id = Column(
      Integer,
      ForeignKey("users.id", ondelete="CASCADE"),
      nullable=False
  )

  action = Column(String, nullable=False) # e.g., "Deactivate User", "Change Permissions", "Approve Deposit", etc.
  details = Column(String, nullable=True) # JSON or text details of the action
  ip_address = Column(String, nullable=True)
  timestamp = Column(DateTime(timezone=True), server_default=func.now())
