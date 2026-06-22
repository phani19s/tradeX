from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TwoFactorLoginRequest(LoginRequest):
    otp: str


class TwoFactorVerifyRequest(BaseModel):
    otp: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordVerifyRequest(BaseModel):
    email: EmailStr
    otp: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str
    confirm_password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
