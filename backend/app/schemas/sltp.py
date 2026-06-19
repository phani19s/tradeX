from pydantic import BaseModel
from typing import Optional

class SLTPCreate(BaseModel):
    stock_id: int
    sl_price: Optional[float] = None
    tp_price: Optional[float] = None
    buy_price: Optional[float] = None
    quantity: int

class SLTPResponse(BaseModel):
    id: int
    stock_id: int
    sl_price: Optional[float]
    tp_price: Optional[float]
    buy_price: Optional[float]
    quantity: int
    is_active: bool

    class Config:
        from_attributes = True
