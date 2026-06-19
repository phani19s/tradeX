from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from app.core.dependencies import get_db

from app.models.trade import Trade
from app.models.stock import Stock
from app.models.portfolio import Portfolio

from app.schemas.trade import TradeCreate 
from app.schemas.sltp import SLTPCreate, SLTPResponse
from app.models.sltp import SLTPOrder
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
        .order_by(Trade.id.desc())
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
                "price": trade.price,
                "note": trade.note
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

@router.post("/limit-buy")
def set_limit_buy(
    payload: SLTPCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if stock exists
    stock = db.query(Stock).filter(Stock.id == payload.stock_id).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    # Check if user has enough balance
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
    if not portfolio:
        raise HTTPException(status_code=400, detail="Portfolio not found")

    # Create new Limit Buy order
    order = SLTPOrder(
        user_id=current_user.id,
        stock_id=payload.stock_id,
        buy_price=payload.buy_price,
        quantity=payload.quantity
    )
    db.add(order)

    db.commit()
    return {"message": "Limit Buy Order Set Successfully"}

@router.post("/sl-tp")
def set_sl_tp(
    payload: SLTPCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if stock exists
    stock = db.query(Stock).filter(Stock.id == payload.stock_id).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    # Check if user has enough shares
    owned = get_owned_quantity(db, current_user.id, payload.stock_id)
    if owned < payload.quantity:
        raise HTTPException(status_code=400, detail=f"You only own {owned} shares")

    # Create new SLTP order
    order = SLTPOrder(
        user_id=current_user.id,
        stock_id=payload.stock_id,
        sl_price=payload.sl_price,
        tp_price=payload.tp_price,
        quantity=payload.quantity
    )
    db.add(order)

    db.commit()
    return {"message": "SL/TP Target Set Successfully"}

@router.get("/sl-tp")
def get_sl_tp(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    orders = db.query(SLTPOrder).filter(
        SLTPOrder.user_id == current_user.id,
        SLTPOrder.is_active == True
    ).all()
    
    result = []
    for order in orders:
        stock = db.query(Stock).filter(Stock.id == order.stock_id).first()
        result.append({
            "id": order.id,
            "stock_id": order.stock_id,
            "symbol": stock.symbol,
            "sl_price": order.sl_price,
            "tp_price": order.tp_price,
            "buy_price": order.buy_price,
            "quantity": order.quantity
        })
    return result

@router.delete("/sl-tp/{order_id}")
def delete_sl_tp(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(SLTPOrder).filter(
        SLTPOrder.id == order_id,
        SLTPOrder.user_id == current_user.id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    db.delete(order)
    db.commit()
    return {"message": "Order cancelled successfully"}

@router.patch("/sl-tp/{order_id}")
def update_sl_tp_order(
    order_id: int,
    new_price: float = None,
    new_quantity: int = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(SLTPOrder).filter(
        SLTPOrder.id == order_id,
        SLTPOrder.user_id == current_user.id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if new_price is not None:
        if order.buy_price is not None:
            order.buy_price = new_price
        elif order.tp_price is not None:
            order.tp_price = new_price
        elif order.sl_price is not None:
            order.sl_price = new_price
            
    if new_quantity is not None:
        order.quantity = new_quantity
        
    db.commit()
    return {"message": "Order updated successfully"}
