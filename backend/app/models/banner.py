from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.core.database import Base

class Banner(Base):
    __tablename__ = "banners"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    image_url = Column(String, nullable=False)
    button_text = Column(String, nullable=True)
    button_url = Column(String, nullable=True)
    banner_type = Column(String, nullable=False)  # Announcement / Event / Promotion / Maintenance
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    priority = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
