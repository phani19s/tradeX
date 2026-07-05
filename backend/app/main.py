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
from app.models.audit_log import AdminAuditLog
from app.models.deposit import Deposit
from app.models.sltp import SLTPOrder
from app.models.support import SupportTicket, SupportMessage
from app.models.notification import Notification
from app.models.user_session import UserSession
from app.models.login_history import LoginHistory
from app.models.chat_history import ChatHistory
from app.models.price_alert import PriceAlert
from app.models.report_history import ReportHistory
from app.models.system_setting import SystemSetting, SettingHistory
from app.models.feedback import Feedback
from app.models.banner import Banner
from app.models.holiday import MarketHoliday
from app.seed_stocks import seed_stocks
from app.core.email import send_auto_trade_email
from app.core.notifications import create_notification
from app.services.alert_service import check_price_alerts

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
from app.api.login_history import router as login_history_router
from app.api.ai import router as ai_router
from app.api.alerts import router as alerts_router
from app.api.risk import router as risk_router
from app.api.websocket import router as websocket_router
from app.api.feedback import router as feedback_router

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
        if "two_factor_enabled" not in user_columns:
            connection.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE"
            )
        if "two_factor_method" not in user_columns:
            connection.exec_driver_sql("ALTER TABLE users ADD COLUMN two_factor_method VARCHAR")
        if "two_factor_secret" not in user_columns:
            connection.exec_driver_sql("ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR")


def ensure_admin_column():
    inspector = inspect(engine)
    user_columns = [column["name"] for column in inspector.get_columns("users")]

    if "is_admin" not in user_columns:
        with engine.begin() as connection:
            connection.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE"
            )


def ensure_is_active_column():
    inspector = inspect(engine)
    user_columns = [column["name"] for column in inspector.get_columns("users")]

    if "is_active" not in user_columns:
        with engine.begin() as connection:
            connection.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE"
            )


def ensure_permissions_column():
    inspector = inspect(engine)
    user_columns = [column["name"] for column in inspector.get_columns("users")]

    if "permissions" not in user_columns:
        with engine.begin() as connection:
            connection.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN permissions VARCHAR"
            )


def ensure_role_column():
    inspector = inspect(engine)
    user_columns = [column["name"] for column in inspector.get_columns("users")]

    if "role" not in user_columns:
        with engine.begin() as connection:
            connection.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN role VARCHAR NOT NULL DEFAULT 'Trader'"
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
        if "market" not in stock_columns:
            connection.exec_driver_sql("ALTER TABLE stocks ADD COLUMN market VARCHAR DEFAULT 'NSE'")
        if "is_active" not in stock_columns:
            connection.exec_driver_sql("ALTER TABLE stocks ADD COLUMN is_active BOOLEAN DEFAULT TRUE")
        if "updated_at" not in stock_columns:
            connection.exec_driver_sql("ALTER TABLE stocks ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")

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
            if "created_at" not in trade_columns:
                connection.exec_driver_sql("ALTER TABLE trades ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")

    if "sltp_orders" in inspector.get_table_names():
        sltp_columns = [column["name"] for column in inspector.get_columns("sltp_orders")]
        with engine.begin() as connection:
            if "buy_price" not in sltp_columns:
                connection.exec_driver_sql("ALTER TABLE sltp_orders ADD COLUMN buy_price FLOAT")


def seed_admin_user():
    admin_email = "admin@tradex.com"
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
                is_admin=True,
                role="Super Administrator",
                permissions="Dashboard Access,User Management,Trading Management,Support Management,Reports,System Settings"
            )

            db.add(admin)
            db.commit()
            db.refresh(admin)
        else:
            updated = False
            if not admin.is_admin:
                admin.is_admin = True
                updated = True
            if admin.role != "Super Administrator":
                admin.role = "Super Administrator"
                updated = True
            if admin.permissions != "Dashboard Access,User Management,Trading Management,Support Management,Reports,System Settings":
                admin.permissions = "Dashboard Access,User Management,Trading Management,Support Management,Reports,System Settings"
                updated = True
            if updated:
                db.commit()

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
            all_active_orders = db.query(SLTPOrder).filter(
                SLTPOrder.is_active == True
            ).all()

            from collections import defaultdict
            orders_by_stock = defaultdict(list)
            for order in all_active_orders:
                orders_by_stock[order.stock_id].append(order)

            for stock in stocks:
                base_price = float(stock.previous_close or stock.current_price or 1)
                current_price = float(stock.current_price or base_price)
                drift = random.uniform(-0.03, 0.03)
                next_price = max(1.0, round(current_price * (1 + drift), 2))

                stock.current_price = next_price
                if not stock.previous_close:
                    stock.previous_close = base_price
                
                # Check SL/TP/Limit orders for this stock
                active_orders = orders_by_stock.get(stock.id, [])

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
            check_price_alerts(db)
        finally:
            db.close()

        time.sleep(45)


def check_alerts_forever():
    while True:
        db = SessionLocal()

        try:
            check_price_alerts(db)
        finally:
            db.close()

        time.sleep(30)

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


def ensure_security_tracking_columns():
    inspector = inspect(engine)
    dialect_name = engine.dialect.name

    with engine.begin() as connection:
        if "user_sessions" in inspector.get_table_names():
            session_columns = [column["name"] for column in inspector.get_columns("user_sessions")]

            if "session_token_id" not in session_columns:
                connection.exec_driver_sql("ALTER TABLE user_sessions ADD COLUMN session_token_id VARCHAR")
                id_expression = "CAST(id AS VARCHAR)" if dialect_name == "postgresql" else "id"
                connection.exec_driver_sql(
                    f"UPDATE user_sessions SET session_token_id = 'legacy:' || {id_expression} WHERE session_token_id IS NULL"
                )
            if "ip_address" not in session_columns:
                connection.exec_driver_sql("ALTER TABLE user_sessions ADD COLUMN ip_address VARCHAR")
            if "device" not in session_columns:
                connection.exec_driver_sql("ALTER TABLE user_sessions ADD COLUMN device VARCHAR")
            if "browser" not in session_columns:
                connection.exec_driver_sql("ALTER TABLE user_sessions ADD COLUMN browser VARCHAR")
            if "location" not in session_columns:
                connection.exec_driver_sql("ALTER TABLE user_sessions ADD COLUMN location VARCHAR")
            if "is_active" not in session_columns:
                connection.exec_driver_sql("ALTER TABLE user_sessions ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE")
            if "created_at" not in session_columns:
                connection.exec_driver_sql("ALTER TABLE user_sessions ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
            if "last_activity" not in session_columns:
                connection.exec_driver_sql("ALTER TABLE user_sessions ADD COLUMN last_activity TIMESTAMP")
            if "revoked_at" not in session_columns:
                connection.exec_driver_sql("ALTER TABLE user_sessions ADD COLUMN revoked_at TIMESTAMP")
            if "logout_time" not in session_columns:
                connection.exec_driver_sql("ALTER TABLE user_sessions ADD COLUMN logout_time TIMESTAMP")
            if "status" not in session_columns:
                connection.exec_driver_sql("ALTER TABLE user_sessions ADD COLUMN status VARCHAR")
            if "session_duration" not in session_columns:
                connection.exec_driver_sql("ALTER TABLE user_sessions ADD COLUMN session_duration INTEGER")

            connection.exec_driver_sql(
                "UPDATE user_sessions SET status = 'Active' WHERE status IS NULL"
            )
            connection.exec_driver_sql(
                "UPDATE user_sessions SET last_activity = created_at WHERE last_activity IS NULL"
            )

        if "login_history" in inspector.get_table_names():
            history_columns = [column["name"] for column in inspector.get_columns("login_history")]

            if "ip_address" not in history_columns:
                connection.exec_driver_sql("ALTER TABLE login_history ADD COLUMN ip_address VARCHAR")
            if "session_id" not in history_columns:
                connection.exec_driver_sql("ALTER TABLE login_history ADD COLUMN session_id VARCHAR")
            if "device" not in history_columns:
                connection.exec_driver_sql("ALTER TABLE login_history ADD COLUMN device VARCHAR")
            if "browser" not in history_columns:
                connection.exec_driver_sql("ALTER TABLE login_history ADD COLUMN browser VARCHAR")
            if "location" not in history_columns:
                connection.exec_driver_sql("ALTER TABLE login_history ADD COLUMN location VARCHAR")
            if "login_time" not in history_columns:
                connection.exec_driver_sql("ALTER TABLE login_history ADD COLUMN login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
            if "logout_time" not in history_columns:
                connection.exec_driver_sql("ALTER TABLE login_history ADD COLUMN logout_time TIMESTAMP")
            if "session_duration" not in history_columns:
                connection.exec_driver_sql("ALTER TABLE login_history ADD COLUMN session_duration INTEGER")
            if "status" not in history_columns:
                connection.exec_driver_sql("ALTER TABLE login_history ADD COLUMN status VARCHAR")

            connection.exec_driver_sql(
                "UPDATE login_history SET status = 'Success' WHERE status IS NULL"
            )


def ensure_audit_log_columns():
    inspector = inspect(engine)
    if "admin_audit_logs" in inspector.get_table_names():
        columns = [column["name"] for column in inspector.get_columns("admin_audit_logs")]
        with engine.begin() as connection:
            if "module" not in columns:
                connection.exec_driver_sql("ALTER TABLE admin_audit_logs ADD COLUMN module VARCHAR")
            if "device_browser" not in columns:
                connection.exec_driver_sql("ALTER TABLE admin_audit_logs ADD COLUMN device_browser VARCHAR")
            if "status" not in columns:
                connection.exec_driver_sql("ALTER TABLE admin_audit_logs ADD COLUMN status VARCHAR NOT NULL DEFAULT 'Success'")

            # Backfill existing logs with correct modules
            connection.exec_driver_sql("UPDATE admin_audit_logs SET module = 'Authentication' WHERE (LOWER(action) LIKE '%%login%%' OR LOWER(action) LIKE '%%logout%%') AND (module IS NULL OR module = 'Other')")
            connection.exec_driver_sql("UPDATE admin_audit_logs SET module = 'Deposits' WHERE LOWER(action) LIKE '%%deposit%%' AND (module IS NULL OR module = 'Other')")
            connection.exec_driver_sql("UPDATE admin_audit_logs SET module = 'Withdrawals' WHERE LOWER(action) LIKE '%%withdrawal%%' AND (module IS NULL OR module = 'Other')")
            connection.exec_driver_sql("UPDATE admin_audit_logs SET module = 'User Management' WHERE (LOWER(action) LIKE '%%user%%' OR LOWER(action) LIKE '%%password%%') AND (module IS NULL OR module = 'Other')")
            connection.exec_driver_sql("UPDATE admin_audit_logs SET module = 'Admin Management' WHERE (LOWER(action) LIKE '%%admin%%' OR LOWER(action) LIKE '%%permission%%') AND (module IS NULL OR module = 'Other')")
            connection.exec_driver_sql("UPDATE admin_audit_logs SET module = 'Stock Management' WHERE LOWER(action) LIKE '%%stock%%' AND (module IS NULL OR module = 'Other')")
            connection.exec_driver_sql("UPDATE admin_audit_logs SET module = 'System Settings' WHERE LOWER(action) LIKE '%%setting%%' AND (module IS NULL OR module = 'Other')")
            connection.exec_driver_sql("UPDATE admin_audit_logs SET module = 'Support' WHERE (LOWER(action) LIKE '%%ticket%%' OR LOWER(action) LIKE '%%chat%%' OR LOWER(action) LIKE '%%reply%%') AND (module IS NULL OR module = 'Other')")
            connection.exec_driver_sql("UPDATE admin_audit_logs SET module = 'Reports' WHERE LOWER(action) LIKE '%%report%%' AND (module IS NULL OR module = 'Other')")
            connection.exec_driver_sql("UPDATE admin_audit_logs SET module = 'Maintenance' WHERE LOWER(action) LIKE '%%maintenance%%' AND (module IS NULL OR module = 'Other')")
            connection.exec_driver_sql("UPDATE admin_audit_logs SET module = 'Other' WHERE module IS NULL")




def ensure_holiday_columns():
    inspector = inspect(engine)
    if "market_holidays" in inspector.get_table_names():
        holiday_columns = [column["name"] for column in inspector.get_columns("market_holidays")]
        if "image_url" not in holiday_columns:
            with engine.begin() as connection:
                connection.exec_driver_sql("ALTER TABLE market_holidays ADD COLUMN image_url VARCHAR")


from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.exc import DBAPIError, OperationalError
import logging

class DatabaseRetryMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        try:
            return await call_next(request)
        except (OperationalError, DBAPIError) as e:
            logging.warning(f"Database connection error encountered: {str(e)}. Retrying request...")
            try:
                return await call_next(request)
            except Exception as retry_exc:
                logging.error(f"Database retry failed: {str(retry_exc)}")
                raise retry_exc


app = FastAPI(
    title="TradeX API"
)
app.add_middleware(DatabaseRetryMiddleware)

ensure_user_profile_columns()
ensure_admin_column()
ensure_is_active_column()
ensure_permissions_column()
ensure_role_column()
ensure_deposit_columns()
ensure_stock_columns()
ensure_withdrawal_columns()
ensure_trade_columns()
ensure_security_tracking_columns()
ensure_audit_log_columns()
ensure_holiday_columns()
seed_admin_user()
seed_stocks()

price_worker_started = False
alert_worker_started = False


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


def start_alert_worker_once():
    global alert_worker_started

    if alert_worker_started:
        return

    alert_worker_started = True

    worker = threading.Thread(
        target=check_alerts_forever,
        daemon=True
    )
    worker.start()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://localhost:5176",
    "http://127.0.0.1:5176",
    "https://tradex-frontend-mfxa.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
from fastapi.staticfiles import StaticFiles
import os

os.makedirs("static/uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

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
app.include_router(login_history_router)
app.include_router(ai_router)
app.include_router(alerts_router)
app.include_router(risk_router)
app.include_router(websocket_router)
app.include_router(feedback_router)

start_price_worker_once()
start_alert_worker_once()

@app.get("/")
def home():
    return {
        "message": "TradeX Running"
    }
