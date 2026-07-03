from datetime import datetime

from sqlalchemy.orm import Session

from app.core.email import send_price_alert_email
from app.core.notifications import create_notification
from app.models.price_alert import PriceAlert
from app.models.stock import Stock
from app.models.user import User
from app.services.websocket_manager import notification_manager


def alert_matches(alert: PriceAlert, price: float):
    if alert.condition_type == "GREATER_THAN":
        return price > alert.target_price
    if alert.condition_type == "LESS_THAN":
        return price < alert.target_price
    if alert.condition_type == "GREATER_EQUAL":
        return price >= alert.target_price
    if alert.condition_type == "LESS_EQUAL":
        return price <= alert.target_price
    return False


def condition_text(alert: PriceAlert):
    operators = {
        "GREATER_THAN": ">",
        "LESS_THAN": "<",
        "GREATER_EQUAL": ">=",
        "LESS_EQUAL": "<=",
    }
    return f"{alert.symbol} {operators.get(alert.condition_type, '')} Rs. {alert.target_price}"


def trigger_alert(db: Session, alert: PriceAlert, stock: Stock):
    alert.triggered = True
    alert.is_active = False
    alert.triggered_at = datetime.utcnow()

    message = f"{stock.symbol} crossed Rs. {alert.target_price}. Current price: Rs. {stock.current_price}."
    notification = create_notification(
        db,
        alert.user_id,
        "TradeX Price Alert",
        message,
        "PRICE_ALERT",
    )

    payload = {
        "type": "price_alert",
        "symbol": stock.symbol,
        "price": stock.current_price,
        "target_price": alert.target_price,
        "message": message,
        "notification_id": notification.id,
    }
    notification_manager.send_to_user(alert.user_id, payload)

    user = db.query(User).filter(User.id == alert.user_id).first()
    if user:
        try:
            send_price_alert_email(user.email, user.username, stock.symbol, stock.current_price, condition_text(alert))
        except Exception:
            pass


def check_price_alerts(db: Session):
    alerts = (
        db.query(PriceAlert)
        .filter(
            PriceAlert.is_active == True,
            PriceAlert.triggered == False,
        )
        .all()
    )

    if not alerts:
        return

    # Prefetch all active stocks to avoid N+1 database queries inside the loop
    stocks = db.query(Stock).filter(Stock.is_active == True).all()
    stocks_by_symbol = {s.symbol.upper(): s for s in stocks}

    for alert in alerts:
        stock = stocks_by_symbol.get(alert.symbol.upper())
        if stock and alert_matches(alert, float(stock.current_price or 0)):
            trigger_alert(db, alert, stock)

    db.commit()
