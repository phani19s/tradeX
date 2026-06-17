from pydantic import BaseModel


class StockCreate(BaseModel):
    symbol: str
    company_name: str
    current_price: float


class StockResponse(StockCreate):
    id: int

    class Config:
        from_attributes = True