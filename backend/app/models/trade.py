from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import Float
from sqlalchemy import String
from sqlalchemy import ForeignKey

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
        ForeignKey("users.id")
    )

    stock_id = Column(
        Integer,
        ForeignKey("stocks.id")
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
    user = relationship(
    "User",
    back_populates="trades"
    )
    
    stock = relationship(
        "Stock",
        back_populates="trades"
    )