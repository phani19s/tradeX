from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import Float
from sqlalchemy import String
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from datetime import datetime

from app.core.database import Base
from sqlalchemy.orm import relationship


class Deposit(Base):
    __tablename__ = "deposits"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    amount = Column(Float, nullable=False)
    payment_type = Column(String, nullable=False, default="UPI")
    utr_number = Column(String, nullable=True)
    status = Column(String, nullable=False, default="Pending")
    verified_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    verified_by = relationship("User", foreign_keys=[verified_by_id])
