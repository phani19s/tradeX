from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class Withdrawal(Base):
    __tablename__ = "withdrawals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    amount = Column(Float, nullable=False)
    
    # Bank details at the time of withdrawal (snapshot)
    account_holder_name = Column(String)
    account_number = Column(String)
    ifsc_code = Column(String)
    bank_name = Column(String)
    upi_id = Column(String, nullable=True)
    
    status = Column(String, default="Pending") # Pending, Approved, Rejected
    utr_number = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)
    
    user = relationship("User")

    @property
    def user_email(self):
        return self.user.email if self.user else None
