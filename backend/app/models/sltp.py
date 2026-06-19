from sqlalchemy import Column, Integer, Float, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class SLTPOrder(Base):
    __tablename__ = "sltp_orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    stock_id = Column(Integer, ForeignKey("stocks.id"))
    sl_price = Column(Float, nullable=True)
    tp_price = Column(Float, nullable=True)
    buy_price = Column(Float, nullable=True)
    quantity = Column(Integer)
    is_active = Column(Boolean, default=True)

    user = relationship("User")
    stock = relationship("Stock")
