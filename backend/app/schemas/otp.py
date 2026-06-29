from pydantic import BaseModel
from pydantic import EmailStr


class SendOTPRequest(BaseModel):
    email: EmailStr
    role: str = "Trader"


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str
    is_admin_otp: bool = False