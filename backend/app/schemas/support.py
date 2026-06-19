from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class TicketCreate(BaseModel):
    transaction_id: Optional[int] = None
    transaction_type: Optional[str] = None
    issue_type: str
    description: str

class TicketResponse(BaseModel):
    id: int
    ticket_number: str
    user_id: int
    transaction_id: Optional[int]
    transaction_type: Optional[str]
    issue_type: str
    description: str
    status: str
    resolution: Optional[str]
    created_at: datetime
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True

class TicketStatusUpdate(BaseModel):
    status: str
    resolution: Optional[str] = None

class MessageCreate(BaseModel):
    message: str

class MessageResponse(BaseModel):
    id: int
    user_id: int
    sender_type: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class UserChatSummary(BaseModel):
    user_id: int
    username: str
    email: str
    last_message: str
    last_message_at: datetime
    unread_count: int
