from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from app.core.dependencies import get_db

from app.models.trade import Trade
from app.models.stock import Stock
from app.models.portfolio import Portfolio

from app.schemas.trade import TradeCreate 
from app.core.security import get_current_user 
from app.models.user import User

router = APIRouter(
    prefix="/trade",
    tags=["Trading"]
)

def get_owned_quantity(
    db,
    user_id,
    stock_id
):
    trades = (
        db.query(Trade)
        .filter(
            Trade.user_id == user_id,
            Trade.stock_id == stock_id
        )
        .all()
    )

    quantity = 0

    for trade in trades:

        if trade.trade_type == "BUY":
            quantity += trade.quantity

        elif trade.trade_type == "SELL":
            quantity -= trade.quantity

    return quantity


@router.post("/buy")
def buy_stock(
    trade: TradeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    user_id = current_user.id

    stock = (
        db.query(Stock)
        .filter(Stock.id == trade.stock_id)
        .first()
    )

    if not stock:
        raise HTTPException(
            status_code=404,
            detail="Stock not found"
        )

    portfolio = (
        db.query(Portfolio)
        .filter(
            Portfolio.user_id == user_id
        )
        .first()
    )

    total_cost = (
        stock.current_price
        * trade.quantity
    )

    if portfolio.balance < total_cost:
        raise HTTPException(
            status_code=400,
            detail="Insufficient Balance"
        )

    portfolio.balance -= total_cost

    new_trade = Trade(
        user_id=user_id,
        stock_id=stock.id,
        trade_type="BUY",
        quantity=trade.quantity,
        price=stock.current_price
    )

    db.add(new_trade)

    db.commit()

    return {
        "message": "Stock Purchased",
        "stock": stock.symbol,
        "quantity": trade.quantity,
        "total_cost": total_cost,
        "remaining_balance": portfolio.balance
    }


@router.post("/sell")
def sell_stock(
    trade: TradeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    user_id = current_user.id

    stock = (
        db.query(Stock)
        .filter(
            Stock.id == trade.stock_id
        )
        .first()
    )

    if not stock:
        raise HTTPException(
            status_code=404,
            detail="Stock not found"
        )

    owned_quantity = get_owned_quantity(
        db,
        user_id,
        stock.id
    )

    if owned_quantity < trade.quantity:
        raise HTTPException(
            status_code=400,
            detail="Not enough shares"
        )

    portfolio = (
        db.query(Portfolio)
        .filter(
            Portfolio.user_id == user_id
        )
        .first()
    )

    total_value = (
        stock.current_price
        * trade.quantity
    )

    portfolio.balance += total_value

    sell_trade = Trade(
        user_id=user_id,
        stock_id=stock.id,
        trade_type="SELL",
        quantity=trade.quantity,
        price=stock.current_price
    )

    db.add(sell_trade)

    db.commit()

    return {
        "message": "Stock Sold",
        "stock": stock.symbol,
        "quantity": trade.quantity,
        "sale_value": total_value,
        "remaining_balance": portfolio.balance
    }

@router.get("/history")
def trade_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    user_id = current_user.id

    trades = (
        db.query(Trade)
        .filter(
            Trade.user_id == user_id
        )
        .all()
    )

    history = []

    for trade in trades:

        stock = (
            db.query(Stock)
            .filter(
                Stock.id == trade.stock_id
            )
            .first()
        )

        history.append(
            {
                "stock_symbol": stock.symbol,
                "company_name": stock.company_name,
                "trade_type": trade.trade_type,
                "quantity": trade.quantity,
                "price": trade.price
            }
        )

    return history


@router.get("/holdings")
def holdings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.id

    trades = (
        db.query(Trade)
        .filter(
            Trade.user_id == user_id
        )
        .all()
    )

    holdings_data = {}
    buy_prices = {}

    for trade in trades:

        stock = (
            db.query(Stock)
            .filter(
                Stock.id == trade.stock_id
            )
            .first()
        )

        if stock.symbol not in holdings_data:
            holdings_data[stock.symbol] = 0
            buy_prices[stock.symbol] = trade.price

        if trade.trade_type == "BUY":
            holdings_data[stock.symbol] += trade.quantity
            buy_prices[stock.symbol] = trade.price

        elif trade.trade_type == "SELL":
            holdings_data[stock.symbol] -= trade.quantity

    result = []

    for symbol, quantity in holdings_data.items():

        if quantity > 0:

            stock = (
                db.query(Stock)
                .filter(
                    Stock.symbol == symbol
                )
                .first()
            )

            result.append(
                {
                    "symbol": stock.symbol,
                    "company_name": stock.company_name,
                    "quantity": quantity,
                    "buy_price":buy_prices[symbol],
                    "current_price": stock.current_price,
                    "market_value": (
                        quantity * stock.current_price
                    ),
                    "profit_loss":
                        (
                            stock.current_price -
                            buy_prices[symbol]
                        ) * quantity
                }
            )

    return result