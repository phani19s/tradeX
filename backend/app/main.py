from fastapi import FastAPI 
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import inspect

import random
import threading
import time

from app.core.database import Base
from app.core.database import engine
from app.core.database import SessionLocal
from app.core.security import hash_password

# Import Models
from app.models.user import User
from app.models.portfolio import Portfolio
from app.models.stock import Stock
from app.models.trade import Trade 
from app.models.watchlist import Watchlist 
from app.models.otp import OTPVerification
from app.models.deposit import Deposit
from app.models.sltp import SLTPOrder
from app.models.support import SupportTicket, SupportMessage
from app.models.notification import Notification
from app.seed_stocks import seed_stocks
from app.core.email import send_auto_trade_email
from app.core.notifications import create_notification

# Import Routers
from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.stock import router as stock_router
from app.api.portfolio import router as portfolio_router
from app.api.trade import router as trade_router 
from app.api.watchlist import router as watchlist_router 
from app.api.dashboard import router as dashboard_router
from app.api.withdrawal import router as withdrawal_router
from app.api.support import router as support_router
from app.api.notifications import router as notifications_router

# Create Tables
Base.metadata.create_all(bind=engine)


def ensure_user_profile_columns():
    inspector = inspect(engine)
    user_columns = [column["name"] for column in inspector.get_columns("users")]

    with engine.begin() as connection:
        if "phone_number" not in user_columns:
            connection.exec_driver_sql("ALTER TABLE users ADD COLUMN phone_number VARCHAR")
        if "account_holder_name" not in user_columns:
            connection.exec_driver_sql("ALTER TABLE users ADD COLUMN account_holder_name VARCHAR")
        if "account_number" not in user_columns:
            connection.exec_driver_sql("ALTER TABLE users ADD COLUMN account_number VARCHAR")
        if "ifsc_code" not in user_columns:
            connection.exec_driver_sql("ALTER TABLE users ADD COLUMN ifsc_code VARCHAR")
        if "bank_name" not in user_columns:
            connection.exec_driver_sql("ALTER TABLE users ADD COLUMN bank_name VARCHAR")
        if "upi_id" not in user_columns:
            connection.exec_driver_sql("ALTER TABLE users ADD COLUMN upi_id VARCHAR")


def ensure_admin_column():
    inspector = inspect(engine)
    user_columns = [column["name"] for column in inspector.get_columns("users")]

    if "is_admin" not in user_columns:
        with engine.begin() as connection:
            connection.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE"
            )


def ensure_deposit_columns():
    inspector = inspect(engine)
    deposit_columns = [column["name"] for column in inspector.get_columns("deposits")]

    with engine.begin() as connection:
        if "utr_number" not in deposit_columns:
            connection.exec_driver_sql(
                "ALTER TABLE deposits ADD COLUMN utr_number VARCHAR"
            )

        if "status" not in deposit_columns:
            connection.exec_driver_sql(
                "ALTER TABLE deposits ADD COLUMN status VARCHAR"
            )

        if "verified_by_id" not in deposit_columns:
            connection.exec_driver_sql(
                "ALTER TABLE deposits ADD COLUMN verified_by_id INTEGER"
            )

        if "verified_at" not in deposit_columns:
            connection.exec_driver_sql(
                "ALTER TABLE deposits ADD COLUMN verified_at TIMESTAMP"
            )

        if "created_by_id" not in deposit_columns:
            connection.exec_driver_sql(
                "ALTER TABLE deposits ADD COLUMN created_by_id INTEGER"
            )

        connection.exec_driver_sql(
            "UPDATE deposits SET status = 'Approved' WHERE status IS NULL"
        )


def ensure_stock_columns():
    inspector = inspect(engine)
    stock_columns = [column["name"] for column in inspector.get_columns("stocks")]

    with engine.begin() as connection:
        if "previous_close" not in stock_columns:
            connection.exec_driver_sql("ALTER TABLE stocks ADD COLUMN previous_close FLOAT")

        connection.exec_driver_sql(
            "UPDATE stocks SET previous_close = current_price WHERE previous_close IS NULL"
        )


def ensure_trade_columns():
    inspector = inspect(engine)
    if "trades" in inspector.get_table_names():
        trade_columns = [column["name"] for column in inspector.get_columns("trades")]
        with engine.begin() as connection:
            if "note" not in trade_columns:
                connection.exec_driver_sql("ALTER TABLE trades ADD COLUMN note VARCHAR")

    if "sltp_orders" in inspector.get_table_names():
        sltp_columns = [column["name"] for column in inspector.get_columns("sltp_orders")]
        with engine.begin() as connection:
            if "buy_price" not in sltp_columns:
                connection.exec_driver_sql("ALTER TABLE sltp_orders ADD COLUMN buy_price FLOAT")


def seed_admin_user():
    admin_email = "tradex.adminn@gmail.com"
    admin_password = "Admin@123"

    db = SessionLocal()

    try:
        admin = (
            db.query(User)
            .filter(User.email == admin_email)
            .first()
        )

        if not admin:
            admin = User(
                username="Admin",
                email=admin_email,
                password=hash_password(admin_password),
                is_admin=True
            )

            db.add(admin)
            db.commit()
            db.refresh(admin)

        portfolio = (
            db.query(Portfolio)
            .filter(Portfolio.user_id == admin.id)
            .first()
        )

        if not portfolio:
            db.add(
                Portfolio(
                    user_id=admin.id,
                    balance=0
                )
            )
            db.commit()

    finally:
        db.close()


def update_stock_prices_forever():
    while True:
        db = SessionLocal()

        try:
            stocks = db.query(Stock).all()

            for stock in stocks:
                base_price = float(stock.previous_close or stock.current_price or 1)
                current_price = float(stock.current_price or base_price)
                drift = random.uniform(-0.03, 0.03)
                next_price = max(1.0, round(current_price * (1 + drift), 2))

                stock.current_price = next_price
                if not stock.previous_close:
                    stock.previous_close = base_price
                
                # Check SL/TP/Limit orders for this stock
                active_orders = db.query(SLTPOrder).filter(
                    SLTPOrder.stock_id == stock.id,
                    SLTPOrder.is_active == True
                ).all()

                for order in active_orders:
                    should_trade = False
                    trade_type = ""
                    reason = ""
                    
                    if order.sl_price and next_price <= order.sl_price:
                        should_trade = True
                        trade_type = "SELL"
                        reason = f"Stop Loss (Trigger: ₹{order.sl_price})"
                    elif order.tp_price and next_price >= order.tp_price:
                        should_trade = True
                        trade_type = "SELL"
                        reason = f"Take Profit (Trigger: ₹{order.tp_price})"
                    elif order.buy_price and next_price <= order.buy_price:
                        should_trade = True
                        trade_type = "BUY"
                        reason = f"Limit Buy (Trigger: ₹{order.buy_price})"
                    
                    if should_trade:
                        user = db.query(User).filter(User.id == order.user_id).first()
                        user_portfolio = db.query(Portfolio).filter(Portfolio.user_id == order.user_id).first()
                        
                        if user and user_portfolio:
                            if trade_type == "SELL":
                                # Verify user has enough shares
                                trades = db.query(Trade).filter(
                                    Trade.user_id == order.user_id,
                                    Trade.stock_id == order.stock_id
                                ).all()
                                owned = sum(t.quantity if t.trade_type == "BUY" else -t.quantity for t in trades)
                                
                                sell_qty = min(order.quantity, owned)
                                
                                if sell_qty > 0:
                                    total_val = sell_qty * next_price
                                    user_portfolio.balance += total_val
                                    
                                    new_trade = Trade(
                                        user_id=order.user_id,
                                        stock_id=stock.id,
                                        trade_type="SELL",
                                        quantity=sell_qty,
                                        price=next_price,
                                        note=reason
                                    )
                                    db.add(new_trade)
                                    
                                    try:
                                        send_auto_trade_email(user.email, user.username, stock.symbol, "SELL", sell_qty, next_price, reason)
                                        create_notification(db, user.id, "Trade Executed", f"Auto-sold {sell_qty} shares of {stock.symbol} at ₹{next_price}. Reason: {reason}", "TRADE")
                                    except: pass
                                    
                                order.is_active = False
                                
                            elif trade_type == "BUY":
                                total_cost = order.quantity * next_price
                                if user_portfolio.balance >= total_cost:
                                    user_portfolio.balance -= total_cost
                                    
                                    new_trade = Trade(
                                        user_id=order.user_id,
                                        stock_id=stock.id,
                                        trade_type="BUY",
                                        quantity=order.quantity,
                                        price=next_price,
                                        note=reason
                                    )
                                    db.add(new_trade)
                                    
                                    try:
                                        send_auto_trade_email(user.email, user.username, stock.symbol, "BUY", order.quantity, next_price, reason)
                                        create_notification(db, user.id, "Trade Executed", f"Auto-bought {order.quantity} shares of {stock.symbol} at ₹{next_price}. Reason: {reason}", "TRADE")
                                    except: pass
                                    
                                    order.is_active = False
            
            db.commit()
        finally:
            db.close()

        time.sleep(45)

def ensure_withdrawal_columns():
    inspector = inspect(engine)
    withdrawal_columns = [column["name"] for column in inspector.get_columns("withdrawals")]

    with engine.begin() as connection:
        if "utr_number" not in withdrawal_columns:
            connection.exec_driver_sql("ALTER TABLE withdrawals ADD COLUMN utr_number VARCHAR")
        if "account_holder_name" not in withdrawal_columns:
            connection.exec_driver_sql("ALTER TABLE withdrawals ADD COLUMN account_holder_name VARCHAR")
        if "account_number" not in withdrawal_columns:
            connection.exec_driver_sql("ALTER TABLE withdrawals ADD COLUMN account_number VARCHAR")
        if "ifsc_code" not in withdrawal_columns:
            connection.exec_driver_sql("ALTER TABLE withdrawals ADD COLUMN ifsc_code VARCHAR")
        if "bank_name" not in withdrawal_columns:
            connection.exec_driver_sql("ALTER TABLE withdrawals ADD COLUMN bank_name VARCHAR")
        if "upi_id" not in withdrawal_columns:
            connection.exec_driver_sql("ALTER TABLE withdrawals ADD COLUMN upi_id VARCHAR")
        if "processed_at" not in withdrawal_columns:
            connection.exec_driver_sql("ALTER TABLE withdrawals ADD COLUMN processed_at TIMESTAMP")


app = FastAPI(
    title="TradeX API"
)

ensure_user_profile_columns()
ensure_admin_column()
ensure_deposit_columns()
ensure_stock_columns()
ensure_withdrawal_columns()
ensure_trade_columns()
seed_admin_user()
seed_stocks()

price_worker_started = False


def start_price_worker_once():
    global price_worker_started

    if price_worker_started:
        return

    price_worker_started = True

    worker = threading.Thread(
        target=update_stock_prices_forever,
        daemon=True
    )
    worker.start()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(stock_router)
app.include_router(portfolio_router)
app.include_router(trade_router)
app.include_router(watchlist_router)
app.include_router(dashboard_router) 
app.include_router(withdrawal_router)
app.include_router(support_router)
app.include_router(notifications_router)

start_price_worker_once()

@app.get("/")
def home():
    return {
        "message": "TradeX Running"
    }
