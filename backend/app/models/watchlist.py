from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import ForeignKey

from app.core.database import Base


class Watchlist(Base):

    __tablename__ = "watchlists"

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
    from sqlalchemy.orm import relationship
    stock = relationship("Stock")