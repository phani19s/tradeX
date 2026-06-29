from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.core.database import Base

class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)


class SettingHistory(Base):
    __tablename__ = "setting_history"

    id = Column(Integer, primary_key=True, index=True)
    setting_key = Column(String, nullable=False)
    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=False)
    changed_by = Column(String, nullable=False) # admin email
    changed_at = Column(DateTime, default=datetime.utcnow)
