from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.risk import RiskAnalysisResponse
from app.services.risk_service import calculate_risk_analysis


router = APIRouter(prefix="/portfolio", tags=["Portfolio Risk"])


@router.get("/risk-analysis", response_model=RiskAnalysisResponse)
def risk_analysis(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return calculate_risk_analysis(db, current_user.id)
