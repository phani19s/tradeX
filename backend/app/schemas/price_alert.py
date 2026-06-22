from datetime import datetime
from typing import Literal

from pydantic import BaseModel


ConditionType = Literal[
    "GREATER_THAN",
    "LESS_THAN",
    "GREATER_EQUAL",
    "LESS_EQUAL",
]


class PriceAlertCreate(BaseModel):
    symbol: str
    condition_type: ConditionType
    target_price: float


class PriceAlertUpdate(BaseModel):
    symbol: str | None = None
    condition_type: ConditionType | None = None
    target_price: float | None = None
    is_active: bool | None = None


class PriceAlertResponse(BaseModel):
    id: int
    symbol: str
    condition_type: str
    target_price: float
    is_active: bool
    triggered: bool
    created_at: datetime
    triggered_at: datetime | None

    class Config:
        from_attributes = True
