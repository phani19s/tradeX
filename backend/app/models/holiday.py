from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.core.database import Base

class MarketHoliday(Base):
    __tablename__ = "market_holidays"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    date = Column(DateTime, nullable=False, unique=True)
    holiday_type = Column(String, nullable=False)  # National Holiday / Festival / Special Trading Day
    market_status = Column(String, nullable=False)  # Closed / Open / Muhurat Trading
    start_time = Column(String, nullable=True)  # e.g., "17:30"
    end_time = Column(String, nullable=True)    # e.g., "18:30"
    description = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
