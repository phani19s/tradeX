from pydantic import BaseModel
from pydantic import EmailStr


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "Trader"


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    phone_number: str | None = None
    account_holder_name: str | None = None
    account_number: str | None = None
    ifsc_code: str | None = None
    bank_name: str | None = None
    upi_id: str | None = None
    two_factor_enabled: bool = False
    two_factor_method: str | None = None
    is_admin: bool = False
    role: str = "Trader"

    class Config:
        from_attributes = True

class UserProfileUpdate(BaseModel):
    username: str
    phone_number: str | None = None
    account_holder_name: str | None = None
    account_number: str | None = None
    ifsc_code: str | None = None
    bank_name: str | None = None
    upi_id: str | None = None

class UserPasswordChange(BaseModel):
    old_password: str
    new_password: str
