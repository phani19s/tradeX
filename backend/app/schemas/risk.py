from pydantic import BaseModel


class AllocationItem(BaseModel):
    label: str
    value: float


class GrowthPoint(BaseModel):
    label: str
    value: float


class RiskAnalysisResponse(BaseModel):
    portfolio_value: float
    profit_loss: float
    return_percent: float
    sharpe_ratio: float
    max_drawdown: float
    risk_score: int
    risk_level: str
    diversification_score: int
    sector_allocation: list[AllocationItem]
    stock_allocation: list[AllocationItem]
    portfolio_growth: list[GrowthPoint]
