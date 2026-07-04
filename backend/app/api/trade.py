from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session, joinedload

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
        db.query(Trade.trade_type, Trade.quantity)
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


def check_market_holiday_status(db: Session):
    import datetime
    from app.models.holiday import MarketHoliday
    now = datetime.datetime.now()
    today_start = datetime.datetime(now.year, now.month, now.day)
    today_end = today_start + datetime.timedelta(days=1)
    
    holiday = (
        db.query(MarketHoliday)
        .filter(MarketHoliday.is_active == True)
        .filter(MarketHoliday.date >= today_start)
        .filter(MarketHoliday.date < today_end)
        .first()
    )
    
    if holiday:
        if holiday.market_status == "Closed":
            return False, "Trading is unavailable today due to a market holiday."
        elif holiday.market_status == "Muhurat Trading":
            current_time_str = now.strftime("%H:%M")
            start = holiday.start_time or "00:00"
            end = holiday.end_time or "00:00"
            if start <= current_time_str <= end:
                return True, ""
            else:
                return False, f"Muhurat Trading is only available from {start} to {end} today."
    return True, ""


@router.post("/buy")
def buy_stock(
    trade: TradeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    allowed, msg = check_market_holiday_status(db)
    if not allowed:
        raise HTTPException(status_code=400, detail=msg)

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

    if not stock.is_active:
        raise HTTPException(
            status_code=400,
            detail="This stock is currently disabled for trading"
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
    allowed, msg = check_market_holiday_status(db)
    if not allowed:
        raise HTTPException(status_code=400, detail=msg)

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

    if not stock.is_active:
        raise HTTPException(
            status_code=400,
            detail="This stock is currently disabled for trading"
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
        .options(joinedload(Trade.stock))
        .filter(
            Trade.user_id == user_id
        )
        .order_by(Trade.id.desc())
        .all()
    )

    history = []

    for idx, trade in enumerate(trades):
        stock = trade.stock

        # Resolve latest_buy at or before this trade in-memory
        latest_buy = None
        for t in trades[idx:]:
            if t.stock_id == trade.stock_id and t.trade_type == "BUY":
                latest_buy = t
                break

        buy_price = latest_buy.price if latest_buy else trade.price
        current_price = stock.current_price if stock else trade.price
        profit_loss = (
            (current_price - buy_price) * trade.quantity
            if buy_price is not None and current_price is not None
            else 0
        )

        history.append(
            {
                "id": trade.id,
                "stock_id": trade.stock_id,
                "stock_symbol": stock.symbol if stock else "Unknown",
                "company_name": stock.company_name if stock else "Unknown",
                "trade_type": trade.trade_type,
                "quantity": trade.quantity,
                "price": trade.price,
                "buy_price": buy_price,
                "current_price": current_price,
                "profit_loss": profit_loss,
                "trade_value": trade.price * trade.quantity,
                "current_value": current_price * trade.quantity,
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
        .options(joinedload(Trade.stock))
        .filter(
            Trade.user_id == user_id
        )
        .all()
    )

    holdings_data = {}
    buy_prices = {}
    stocks_dict = {}

    for trade in trades:
        stock = trade.stock
        if not stock:
            continue

        stocks_dict[stock.symbol] = stock

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
            stock = stocks_dict.get(symbol)
            if stock:
                result.append(
                    {
                        "symbol": stock.symbol,
                        "company_name": stock.company_name,
                        "quantity": quantity,
                        "buy_price": buy_prices[symbol],
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
    allowed, msg = check_market_holiday_status(db)
    if not allowed:
        raise HTTPException(status_code=400, detail=msg)
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
    allowed, msg = check_market_holiday_status(db)
    if not allowed:
        raise HTTPException(status_code=400, detail=msg)
    # Check if stock exists
    stock = db.query(Stock).filter(Stock.id == payload.stock_id).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    # Check if user has enough shares
    owned = get_owned_quantity(db, current_user.id, payload.stock_id)
    if owned < payload.quantity:
        raise HTTPException(status_code=400, detail=f"You only own {owned} shares")

    assigned_quantity = (
        db.query(SLTPOrder)
        .filter(
            SLTPOrder.user_id == current_user.id,
            SLTPOrder.stock_id == payload.stock_id,
            SLTPOrder.is_active == True,
            SLTPOrder.buy_price == None
        )
        .all()
    )
    available_quantity = owned - sum(order.quantity for order in assigned_quantity)

    if available_quantity < payload.quantity:
        raise HTTPException(
            status_code=400,
            detail="Not available stocks"
        )

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
    orders = db.query(SLTPOrder).options(joinedload(SLTPOrder.stock)).filter(
        SLTPOrder.user_id == current_user.id,
        SLTPOrder.is_active == True
    ).all()
    
    result = []
    for order in orders:
        stock = order.stock
        result.append({
            "id": order.id,
            "stock_id": order.stock_id,
            "symbol": stock.symbol if stock else "Unknown",
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
    sl_price: float = None,
    tp_price: float = None,
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

    if sl_price is not None:
        order.sl_price = sl_price

    if tp_price is not None:
        order.tp_price = tp_price
            
    if new_quantity is not None:
        order.quantity = new_quantity
        
    db.commit()
    return {"message": "Order updated successfully"}
