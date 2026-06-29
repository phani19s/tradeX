from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Float
from sqlalchemy import Boolean
from sqlalchemy import DateTime
from datetime import datetime

from app.core.database import Base 
from sqlalchemy.orm import relationship


class Stock(Base):
    __tablename__ = "stocks"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    symbol = Column(
        String,
        unique=True,
        nullable=False
    )

    company_name = Column(
        String,
        nullable=False
    )

    current_price = Column(
        Float,
        nullable=False
    )

    previous_close = Column(
        Float,
        nullable=False,
        default=0
    )

    market = Column(
        String,
        nullable=True,
        default="NSE"
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    trades = relationship(
        "Trade",
        back_populates="stock"
    )
