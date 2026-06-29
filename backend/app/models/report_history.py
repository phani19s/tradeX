from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.core.database import Base

class ReportHistory(Base):
    __tablename__ = "report_history"

    id = Column(Integer, primary_key=True, index=True)
    report_type = Column(String, nullable=False) # Daily, Weekly, Monthly, Custom
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    generated_by = Column(String, nullable=False) # email
    generated_at = Column(DateTime, default=datetime.utcnow)
    metrics_data = Column(String, nullable=False) # JSON string of metrics
