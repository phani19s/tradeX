from fastapi import APIRouter
from fastapi import Depends

from sqlalchemy.orm import Session

from app.core.dependencies import get_db

from app.models.portfolio import Portfolio
from app.models.trade import Trade
from app.models.stock import Stock
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)

@router.get("/")
def dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
   
    user_id = current_user.id

    portfolio = (
        db.query(Portfolio)
        .filter(
            Portfolio.user_id == user_id
        )
        .first()
    )

    trades = (
        db.query(Trade)
        .filter(
            Trade.user_id == user_id
        )
        .all()
    )

    # Calculate invested amount based on current holdings
    holdings = {}
    last_buy_price = {}

    for trade in trades:
        if trade.stock_id not in holdings:
            holdings[trade.stock_id] = 0

        if trade.trade_type == "BUY":
            holdings[trade.stock_id] += trade.quantity
            last_buy_price[trade.stock_id] = trade.price
        else:
            holdings[trade.stock_id] -= trade.quantity

    invested_amount = 0
    for stock_id, quantity in holdings.items():
        if quantity > 0:
            invested_amount += quantity * last_buy_price.get(stock_id, 0)

    return {
        "cash_balance": portfolio.balance,
        "invested_amount": invested_amount,
        "total_trades": len(trades)
    }