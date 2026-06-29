from pydantic import BaseModel
from datetime import datetime

class StockCreate(BaseModel):
    symbol: str
    company_name: str
    current_price: float
    market: str = "NSE"
    is_active: bool = True

class StockUpdate(BaseModel):
    company_name: str
    current_price: float
    market: str = "NSE"
    is_active: bool = True

class StockResponse(StockCreate):
    id: int
    previous_close: float
    updated_at: datetime

    class Config:
        from_attributes = True