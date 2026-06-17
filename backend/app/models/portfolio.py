from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import Float
from sqlalchemy import ForeignKey

from app.core.database import Base 
from sqlalchemy.orm import relationship


class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id")
    )

    balance = Column(
        Float,
        default=0.0
    )
    user = relationship(
    "User",
    back_populates="portfolio"
  )
