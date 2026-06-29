from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class FeedbackCreate(BaseModel):
    subject: str
    message: str

class FeedbackUserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None

    class Config:
        from_attributes = True

class FeedbackResponse(BaseModel):
    id: int
    user_id: int
    subject: str
    message: str
    status: str
    created_at: datetime
    user: Optional[FeedbackUserResponse] = None

    class Config:
        from_attributes = True
