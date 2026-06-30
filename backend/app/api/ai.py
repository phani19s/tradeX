from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.core.security import get_current_user
from app.models.chat_history import ChatHistory
from app.models.user import User
from app.schemas.ai_chat import ChatHistoryResponse, ChatRequest, ChatResponse
from app.services.ai_chat_service import answer_question


router = APIRouter(prefix="/ai", tags=["AI Assistant"])


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    answer = answer_question(db, current_user.id, payload.message)
    return {"answer": answer}


@router.get("/chat/history", response_model=List[ChatHistoryResponse])
def chat_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == current_user.id)
        .order_by(ChatHistory.created_at.desc())
        .limit(50)
        .all()
    )


@router.delete("/chat/history")
def clear_chat_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(ChatHistory).filter(
        ChatHistory.user_id == current_user.id
    ).delete(synchronize_session=False)
    db.commit()
    return {"message": "Chat history cleared"}


@router.delete("/chat/history/{history_id}")
def delete_chat_history_item(
    history_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = (
        db.query(ChatHistory)
        .filter(
            ChatHistory.id == history_id,
            ChatHistory.user_id == current_user.id
        )
        .first()
    )

    if item:
        db.delete(item)
        db.commit()

    return {"message": "Chat history item deleted"}


@router.get("/portfolio-analysis")
def get_portfolio_advisor_analysis(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.services.ai_advisor_service import get_portfolio_analysis
    return get_portfolio_analysis(db, current_user.id)


@router.get("/portfolio-suggestions")
def get_portfolio_advisor_suggestions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.services.ai_advisor_service import get_portfolio_suggestions
    return get_portfolio_suggestions(db, current_user.id)


@router.get("/portfolio-alerts")
def get_portfolio_advisor_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.services.ai_advisor_service import get_portfolio_alerts_list
    return get_portfolio_alerts_list(db, current_user.id)


@router.post("/trading-simulation")
def get_trading_advisor_simulation(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.services.ai_advisor_service import get_trading_simulation
    initial_amount = float(payload.get("initial_amount", 10000))
    monthly_amount = float(payload.get("monthly_amount", 1000))
    years = int(payload.get("years", 5))
    symbol = str(payload.get("symbol", "RELIANCE"))
    return get_trading_simulation(db, current_user.id, initial_amount, monthly_amount, years, symbol)


@router.get("/stock-recommendations")
def get_stock_advisor_recommendations(
    rec_type: str = "long_term",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.services.ai_advisor_service import get_stock_recommendations
    return get_stock_recommendations(db, current_user.id, rec_type)


@router.get("/market-insights")
def get_market_advisor_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.services.ai_advisor_service import get_market_insights_summary
    return get_market_insights_summary(db)


@router.get("/daily-summary")
def get_daily_market_summary_endpoint(
    refresh: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "Trader":
        raise HTTPException(
            status_code=403,
            detail="Only Trader accounts can access the daily market summary"
        )
    from app.services.ai_advisor_service import get_daily_market_summary
    return get_daily_market_summary(db, force_refresh=refresh)


@router.get("/market-insights/daily")
def get_detailed_market_insights_endpoint(
    refresh: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.is_admin or current_user.role != "Trader":
        raise HTTPException(
            status_code=403,
            detail="Only Trader accounts can access the detailed market insights"
        )
    from app.services.ai_advisor_service import get_detailed_market_insights
    return get_detailed_market_insights(db, force_refresh=refresh)

