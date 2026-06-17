from pydantic import BaseModel


class DepositRequest(BaseModel):
    amount: float
    utr_number: str | None = None
    target_email: str | None = None


class PortfolioResponse(BaseModel):
    id: int
    user_id: int
    balance: float

    class Config:
        from_attributes = True
