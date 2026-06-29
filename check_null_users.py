import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Import all models to register them with Base
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

load_dotenv(dotenv_path="backend/.env")

db_url = os.getenv("DATABASE_URL")
engine = create_engine(db_url)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

try:
    print("Checking for feedbacks with missing user relationship...")
    feedbacks_without_user = db.query(Feedback).filter(Feedback.user_id.notin_(db.query(User.id))).all()
    print(f"Found {len(feedbacks_without_user)} feedbacks with invalid/missing user_id:")
    for f in feedbacks_without_user:
        print(f"Feedback ID: {f.id}, user_id: {f.user_id}, Subject: {f.subject}")
        
    print("Checking all feedbacks in database...")
    all_feedbacks = db.query(Feedback).all()
    print(f"Total feedbacks in database: {len(all_feedbacks)}")
    for f in all_feedbacks:
        print(f"Feedback ID: {f.id}, user_id: {f.user_id}, Subject: {f.subject}, User relationship exists: {f.user is not None}")
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
