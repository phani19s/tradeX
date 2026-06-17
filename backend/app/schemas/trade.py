from pydantic import BaseModel


class TradeCreate(BaseModel):
    stock_id: int
    quantity: int


class TradeResponse(BaseModel):
    id: int
    user_id: int
    stock_id: int
    trade_type: str
    quantity: int
    price: float

    class Config:
        from_attributes = True