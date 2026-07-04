from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import Float
from sqlalchemy import String
from sqlalchemy import ForeignKey
from sqlalchemy import DateTime
from datetime import datetime

from app.core.database import Base 
from sqlalchemy.orm import relationship


class Trade(Base):
    __tablename__ = "trades"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        index=True
    )

    stock_id = Column(
        Integer,
        ForeignKey("stocks.id"),
        index=True
    )

    trade_type = Column(
        String
    )

    quantity = Column(
        Integer
    )

    price = Column(
        Float
    )
    note = Column(
        String,
        nullable=True
    )
    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )
    user = relationship(
    "User",
    back_populates="trades"
    )
    
    stock = relationship(
        "Stock",
        back_populates="trades"
    )