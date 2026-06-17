from pydantic import BaseModel
from datetime import datetime

class WithdrawalCreate(BaseModel):
    amount: float
    otp: str

class WithdrawalApproveRequest(BaseModel):
    utr_number: str

class WithdrawalResponse(BaseModel):
    id: int
    amount: float
    status: str
    utr_number: str | None = None
    created_at: datetime
    account_number: str | None = None
    bank_name: str | None = None
    ifsc_code: str | None = None
    account_holder_name: str | None = None
    upi_id: str | None = None
    user_email: str | None = None

    class Config:
        from_attributes = True
