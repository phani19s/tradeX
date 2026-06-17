from pydantic import BaseModel
from pydantic import EmailStr


class SendOTPRequest(BaseModel):

    email: EmailStr


class VerifyOTPRequest(BaseModel):

    email: EmailStr
    otp: str