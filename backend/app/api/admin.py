from typing import List
from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Request
# from fastapi.responses import RedirectResponse
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr

from datetime import datetime
from app.schemas.stock import StockCreate, StockUpdate, StockResponse

import os

from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.core.security import get_current_user
from app.models.portfolio import Portfolio
from app.models.deposit import Deposit
from app.models.user import User
from app.models.withdrawal import Withdrawal
from app.schemas.withdrawal import WithdrawalResponse, WithdrawalApproveRequest
from app.core.email import (
    decode_deposit_action_token, 
    send_deposit_approved_email, 
    send_deposit_rejected_email,
    decode_withdrawal_action_token,
    send_withdrawal_completed_email,
    send_withdrawal_rejected_email,
    send_withdrawal_processed_admin_notification
)
from app.core.notifications import create_notification

router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)

FRONTEND_URL = os.getenv("TRADEX_FRONTEND_URL", "http://localhost:5173")


def log_audit(db: Session, admin_id: int, action: str, details: str, ip_address: str = None):
    try:
        from app.models.audit_log import AdminAuditLog
        db.add(AdminAuditLog(admin_id=admin_id, action=action, details=details, ip_address=ip_address))
        db.commit()
    except Exception:
        pass


def _apply_deposit_approval(
    db: Session,
    deposit: Deposit,
    verifier_id: int | None
):
    if deposit.status == "Approved":
        portfolio = (
            db.query(Portfolio)
            .filter(Portfolio.user_id == deposit.user_id)
            .first()
        )

        return portfolio

    portfolio = (
        db.query(Portfolio)
        .filter(Portfolio.user_id == deposit.user_id)
        .first()
    )

    if not portfolio:
        portfolio = Portfolio(user_id=deposit.user_id, balance=0)
        db.add(portfolio)
        db.flush()

    portfolio.balance += deposit.amount
    deposit.status = "Approved"
    deposit.verified_by_id = verifier_id
    deposit.verified_at = datetime.utcnow()
    db.commit()
    db.refresh(portfolio)

    return portfolio


@router.get("/users")
def list_users(
    page: int = 1,
    limit: int = 10,
    search: str = None,
    role: str = None,
    status: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin or current_user.role not in ["Administrator", "Super Administrator"]:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    from app.models.login_history import LoginHistory

    # Fetch only Traders, removing Admins from User Management
    query = db.query(User).filter(User.role == "Trader")

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (User.username.like(search_filter)) |
            (User.email.like(search_filter))
        )

    if role:
        query = query.filter(User.role == role)

    if status:
        is_active_val = (status.lower() == "active")
        query = query.filter(User.is_active == is_active_val)

    total = query.count()
    offset = (page - 1) * limit
    users = query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()

    result = []
    for user in users:
        portfolio = db.query(Portfolio).filter(Portfolio.user_id == user.id).first()
        balance = portfolio.balance if portfolio else 0.0

        last_login_record = (
            db.query(LoginHistory)
            .filter(LoginHistory.user_id == user.id, LoginHistory.status == "Success")
            .order_by(LoginHistory.login_time.desc())
            .first()
        )
        last_login = last_login_record.login_time.isoformat() if last_login_record else None

        result.append({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "phone_number": user.phone_number,
            "role": user.role,
            "is_active": user.is_active,
            "is_admin": user.is_admin,
            "created_at": user.created_at.isoformat(),
            "last_login": last_login,
            "balance": balance,
            "bank_name": user.bank_name,
            "account_holder_name": user.account_holder_name,
            "account_number": user.account_number,
            "ifsc_code": user.ifsc_code,
            "upi_id": user.upi_id
        })

    import math
    pages = math.ceil(total / limit) if limit > 0 else 1

    return {
        "users": result,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages
    }


@router.get("/deposits")
def list_deposits(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    deposits = (
        db.query(Deposit)
        .order_by(Deposit.created_at.desc())
        .all()
    )

    items = []
    for deposit in deposits:
        target_user = db.query(User).filter(User.id == deposit.user_id).first()
        created_by = db.query(User).filter(User.id == deposit.created_by_id).first()
        verified_by = db.query(User).filter(User.id == deposit.verified_by_id).first()

        items.append(
            {
                "id": deposit.id,
                "amount": deposit.amount,
                "utr_number": deposit.utr_number,
                "status": deposit.status,
                "created_at": deposit.created_at.isoformat(),
                "verified_at": deposit.verified_at.isoformat() if deposit.verified_at else None,
                "target_email": target_user.email if target_user else None,
                "created_by_email": created_by.email if created_by else None,
                "verified_by_email": verified_by.email if verified_by else None,
            }
        )

    return items


@router.get("/withdrawals", response_model=List[WithdrawalResponse])
def list_withdrawals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    withdrawals = db.query(Withdrawal).order_by(Withdrawal.created_at.desc()).all()
    return withdrawals


@router.post("/deposits/{deposit_id}/approve")
def approve_deposit(
    deposit_id: int,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    deposit = (
        db.query(Deposit)
        .filter(Deposit.id == deposit_id)
        .first()
    )

    if not deposit:
        raise HTTPException(
            status_code=404,
            detail="Deposit request not found"
        )

    portfolio = _apply_deposit_approval(
        db,
        deposit,
        current_user.id
    )

    send_deposit_approved_email(
        deposit.user.email,
        deposit.user.username,
        deposit.amount
    )

    create_notification(
        db, 
        deposit.user_id, 
        "Deposit Approved", 
        f"Your deposit of ₹{deposit.amount} has been approved.", 
        "DEPOSIT"
    )

    log_audit(db, current_user.id, "Approve Deposit", f"Approved deposit ID {deposit_id} of ₹{deposit.amount} for user {deposit.user.email}", request.client.host if (request and request.client) else None)

    return {
        "message": "Deposit approved successfully",
        "balance": portfolio.balance
    }


@router.post("/deposits/{deposit_id}/reject")
def reject_deposit(
    deposit_id: int,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    deposit = (
        db.query(Deposit)
        .filter(Deposit.id == deposit_id)
        .first()
    )

    if not deposit:
        raise HTTPException(
            status_code=404,
            detail="Deposit request not found"
        )

    deposit.status = "Rejected"
    deposit.verified_by_id = current_user.id
    deposit.verified_at = datetime.utcnow()
    db.commit()

    send_deposit_rejected_email(
        deposit.user.email,
        deposit.user.username,
        deposit.amount
    )

    create_notification(
        db, 
        deposit.user_id, 
        "Deposit Rejected", 
        f"Your deposit of ₹{deposit.amount} was rejected.", 
        "DEPOSIT"
    )

    log_audit(db, current_user.id, "Reject Deposit", f"Rejected deposit ID {deposit_id} of ₹{deposit.amount} for user {deposit.user.email}", request.client.host if (request and request.client) else None)

    return {
        "message": "Deposit rejected successfully"
    }


@router.post("/withdrawals/{withdrawal_id}/approve")
def approve_withdrawal(
    withdrawal_id: int,
    request: WithdrawalApproveRequest,
    http_request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    withdrawal = db.query(Withdrawal).filter(Withdrawal.id == withdrawal_id).first()

    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal request not found")

    if withdrawal.status != "Pending":
        raise HTTPException(status_code=400, detail="Request already processed")

    withdrawal.status = "Approved"
    withdrawal.utr_number = request.utr_number
    withdrawal.processed_at = datetime.utcnow()
    db.commit()

    send_withdrawal_completed_email(
        withdrawal.user.email,
        withdrawal.user.username,
        withdrawal.amount,
        withdrawal.utr_number
    )

    create_notification(
        db, 
        withdrawal.user_id, 
        "Withdrawal Approved", 
        f"Your withdrawal of ₹{withdrawal.amount} has been approved. UTR: {withdrawal.utr_number}", 
        "WITHDRAWAL"
    )
    
    try:
        send_withdrawal_processed_admin_notification(
            os.getenv("TRADEX_APPROVAL_EMAIL", "tradex.adminn@gmail.com"),
            withdrawal.id,
            withdrawal.user.email,
            withdrawal.amount
        )
    except Exception:
        pass

    log_audit(db, current_user.id, "Approve Withdrawal", f"Approved withdrawal ID {withdrawal_id} of ₹{withdrawal.amount} for user {withdrawal.user.email}", http_request.client.host if (http_request and http_request.client) else None)

    return {"message": "Withdrawal approved successfully"}


@router.post("/withdrawals/{withdrawal_id}/reject")
def reject_withdrawal(
    withdrawal_id: int,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    withdrawal = db.query(Withdrawal).filter(Withdrawal.id == withdrawal_id).first()

    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal request not found")

    if withdrawal.status != "Pending":
        raise HTTPException(status_code=400, detail="Request already processed")

    withdrawal.status = "Rejected"
    withdrawal.processed_at = datetime.utcnow()
    
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == withdrawal.user_id).first()
    if portfolio:
        portfolio.balance += withdrawal.amount
        
    db.commit()

    send_withdrawal_rejected_email(
        withdrawal.user.email,
        withdrawal.user.username,
        withdrawal.amount
    )

    create_notification(
        db, 
        withdrawal.user_id, 
        "Withdrawal Rejected", 
        f"Your withdrawal request for ₹{withdrawal.amount} was rejected.", 
        "WITHDRAWAL"
    )
    
    try:
        send_withdrawal_rejected_email(
            os.getenv("TRADEX_APPROVAL_EMAIL", "tradex.adminn@gmail.com"),
            f"Admin (Withdrawal ID: {withdrawal.id})",
            withdrawal.amount
        )
    except Exception:
        pass

    log_audit(db, current_user.id, "Reject Withdrawal", f"Rejected withdrawal ID {withdrawal_id} of ₹{withdrawal.amount} for user {withdrawal.user.email}", request.client.host if (request and request.client) else None)

    return {"message": "Withdrawal rejected successfully"}


@router.get("/deposits/email/approve")
def approve_deposit_from_email(
    token: str,
    db: Session = Depends(get_db)
):
    try:
        payload = decode_deposit_action_token(token)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired approval link"
        )

    if payload.get("action") != "approve":
        raise HTTPException(
            status_code=400,
            detail="Invalid approval action"
        )

    deposit_id = payload.get("sub", "").replace("deposit:", "")
    deposit = (
        db.query(Deposit)
        .filter(Deposit.id == int(deposit_id))
        .first()
    )

    if not deposit:
        raise HTTPException(
            status_code=404,
            detail="Deposit request not found"
        )

    if deposit.status != "Pending":
        return HTMLResponse(
            f"""
            <html>
            <body style="font-family:Arial;text-align:center;padding-top:100px;background:#0f172a;color:white;">
                <h1>ℹ️ Request Already Processed</h1>
                <p>This deposit has already been <strong>{deposit.status}</strong>.</p>
                <p>You can close this window.</p>
            </body>
            </html>
            """
        )

    portfolio = _apply_deposit_approval(
        db,
        deposit,
        None
    )

    send_deposit_approved_email(
        deposit.user.email,
        deposit.user.username,
        deposit.amount
    )

    create_notification(
        db, 
        deposit.user_id, 
        "Deposit Approved", 
        f"Your deposit of ₹{deposit.amount} has been approved via email verification.", 
        "DEPOSIT"
    )

    # Also notify admin
    try:
        send_deposit_approved_email(
            os.getenv("TRADEX_APPROVAL_EMAIL", "tradex.adminn@gmail.com"),
            f"Admin (Deposit ID: {deposit.id})",
            deposit.amount
        )
    except Exception:
        pass

    return HTMLResponse(
        f"""
        <html>
        <body style="font-family:Arial;text-align:center;padding-top:100px;background:#0f172a;color:white;">
            <h1>✅ Deposit Approved Successfully</h1>
            <h2>Deposit ID: {deposit.id}</h2>
            <h2>Updated Balance for {deposit.user.username}: ₹{portfolio.balance}</h2>
            <p>You can close this window.</p>
        </body>
        </html>
        """
    )


@router.get("/deposits/email/reject")
def reject_deposit_from_email(
    token: str,
    db: Session = Depends(get_db)
):
    try:
        payload = decode_deposit_action_token(token)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired rejection link"
        )

    if payload.get("action") != "reject":
        raise HTTPException(
            status_code=400,
            detail="Invalid rejection action"
        )

    deposit_id = payload.get("sub", "").replace("deposit:", "")
    deposit = (
        db.query(Deposit)
        .filter(Deposit.id == int(deposit_id))
        .first()
    )

    if not deposit:
        raise HTTPException(
            status_code=404,
            detail="Deposit request not found"
        )

    if deposit.status != "Pending":
        return HTMLResponse(
            f"""
            <html>
            <body style="font-family:Arial;text-align:center;padding-top:100px;background:#0f172a;color:white;">
                <h1>ℹ️ Request Already Processed</h1>
                <p>This deposit has already been <strong>{deposit.status}</strong>.</p>
                <p>You can close this window.</p>
            </body>
            </html>
            """
        )

    deposit.status = "Rejected"
    deposit.verified_by_id = None
    deposit.verified_at = datetime.utcnow()
    db.commit()

    send_deposit_rejected_email(
        deposit.user.email,
        deposit.user.username,
        deposit.amount
    )

    create_notification(
        db, 
        deposit.user_id, 
        "Deposit Rejected", 
        f"Your deposit of ₹{deposit.amount} was rejected via email verification.", 
        "DEPOSIT"
    )

    # Also notify admin
    try:
        send_deposit_rejected_email(
            os.getenv("TRADEX_APPROVAL_EMAIL", "tradex.adminn@gmail.com"),
            f"Admin (Deposit ID: {deposit.id})",
            deposit.amount
        )
    except Exception:
        pass

    return HTMLResponse(
        f"""
        <html>
        <body style="font-family:Arial;text-align:center;padding-top:100px;background:#0f172a;color:white;">
            <h1>❌ Deposit Rejected</h1>
            <h2>Deposit ID: {deposit.id}</h2>
            <p>You can close this window.</p>
        </body>
        </html>
        """
    )


from fastapi import Form

@router.get("/withdrawals/email/approve")
def approve_withdrawal_from_email(
    token: str,
    db: Session = Depends(get_db)
):
    try:
        payload = decode_withdrawal_action_token(token)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired link")

    withdrawal_id = int(payload.get("sub", "").replace("withdrawal:", ""))
    withdrawal = db.query(Withdrawal).filter(Withdrawal.id == withdrawal_id).first()

    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")

    if withdrawal.status != "Pending":
        return HTMLResponse(f"""
        <html>
        <body style="font-family:Arial;text-align:center;padding-top:100px;background:#0f172a;color:white;">
            <h1>ℹ️ Request already {withdrawal.status}</h1>
            <p>Withdrawal ID: {withdrawal.id}</p>
        </body>
        </html>
        """)

    return HTMLResponse(
        f"""
        <html>
        <body style="font-family:Arial;text-align:center;padding-top:50px;background:#0f172a;color:white;">
            <h1>Verify & Complete Withdrawal</h1>
            <div style="background:#1e293b;padding:30px;border-radius:12px;display:inline-block;text-align:left;min-width:320px;border:1px solid #334155;">
                <p><strong>User:</strong> {withdrawal.user.email}</p>
                <p><strong>Amount:</strong> ₹{withdrawal.amount}</p>
                <p><strong>Bank:</strong> {withdrawal.bank_name or "N/A"}</p>
                <p><strong>Account:</strong> {withdrawal.account_number or "N/A"}</p>
                <p><strong>UPI:</strong> {withdrawal.user.upi_id or "N/A"}</p>
                <hr style="border:0;border-top:1px solid #334155;margin:20px 0;">
                <form action="/admin/withdrawals/email/complete" method="POST">
                    <input type="hidden" name="token" value="{token}">
                    <label style="display:block;margin-bottom:8px;font-size:14px;opacity:0.8;">Enter Transaction UTR Number:</label>
                    <input type="text" name="utr" required style="width:100%;padding:12px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:white;margin-bottom:20px;" placeholder="Transaction ID">
                    <button type="submit" style="width:100%;background:#2563eb;color:white;border:0;padding:12px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:16px;">Approve & Mark as Completed</button>
                </form>
            </div>
        </body>
        </html>
        """
    )


@router.post("/withdrawals/email/complete")
def complete_withdrawal_from_email(
    token: str = Form(...),
    utr: str = Form(...),
    db: Session = Depends(get_db)
):
    try:
        payload = decode_withdrawal_action_token(token)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid token")

    withdrawal_id = int(payload.get("sub", "").replace("withdrawal:", ""))
    withdrawal = db.query(Withdrawal).filter(Withdrawal.id == withdrawal_id).first()

    if not withdrawal or withdrawal.status != "Pending":
        return HTMLResponse("<h1>Error: Withdrawal already processed or not found</h1>")

    withdrawal.status = "Approved"
    withdrawal.utr_number = utr
    withdrawal.processed_at = datetime.utcnow()
    db.commit()

    send_withdrawal_completed_email(
        withdrawal.user.email,
        withdrawal.user.username,
        withdrawal.amount,
        withdrawal.utr_number
    )
    
    create_notification(
        db, 
        withdrawal.user_id, 
        "Withdrawal Approved", 
        f"Your withdrawal of ₹{withdrawal.amount} has been approved via email. UTR: {withdrawal.utr_number}", 
        "WITHDRAWAL"
    )
    
    # Notify admin as well
    try:
        send_withdrawal_processed_admin_notification(
            os.getenv("TRADEX_APPROVAL_EMAIL", "tradex.adminn@gmail.com"),
            withdrawal.id,
            withdrawal.user.email,
            withdrawal.amount
        )
    except Exception:
        pass

    return HTMLResponse(
        f"""
        <html>
        <body style="font-family:Arial;text-align:center;padding-top:100px;background:#0f172a;color:white;">
            <h1>✅ Withdrawal Completed Successfully!</h1>
            <p>UTR: {utr}</p>
            <p>The user has been notified via email.</p>
            <p>You can close this window.</p>
        </body>
        </html>
        """
    )


@router.get("/withdrawals/email/reject")
def reject_withdrawal_from_email(
    token: str,
    db: Session = Depends(get_db)
):
    try:
        payload = decode_withdrawal_action_token(token)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired rejection link")

    if payload.get("action") != "reject":
        raise HTTPException(status_code=400, detail="Invalid action")

    withdrawal_id = int(payload.get("sub", "").replace("withdrawal:", ""))
    withdrawal = db.query(Withdrawal).filter(Withdrawal.id == withdrawal_id).first()

    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal request not found")

    if withdrawal.status != "Pending":
        return HTMLResponse(
            f"""
            <html>
            <body style="font-family:Arial;text-align:center;padding-top:100px;background:#0f172a;color:white;">
                <h1>ℹ️ Request Already Processed</h1>
                <p>This withdrawal has already been <strong>{withdrawal.status}</strong>.</p>
                <p>You can close this window.</p>
            </body>
            </html>
            """
        )

    withdrawal.status = "Rejected"
    withdrawal.processed_at = datetime.utcnow()

    # Credit back the amount to user's portfolio
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == withdrawal.user_id).first()
    if portfolio:
        portfolio.balance += withdrawal.amount

    db.commit()

    send_withdrawal_rejected_email(
        withdrawal.user.email,
        withdrawal.user.username,
        withdrawal.amount
    )

    create_notification(
        db, 
        withdrawal.user_id, 
        "Withdrawal Rejected", 
        f"Your withdrawal request for ₹{withdrawal.amount} was rejected via email.", 
        "WITHDRAWAL"
    )

    # Also notify admin
    try:
        send_withdrawal_rejected_email(
            os.getenv("TRADEX_APPROVAL_EMAIL", "tradex.adminn@gmail.com"),
            f"Admin (Withdrawal ID: {withdrawal.id})",
            withdrawal.amount
        )
    except Exception:
        pass

    return HTMLResponse(
        f"""
        <html>
        <body style="font-family:Arial;text-align:center;padding-top:100px;background:#0f172a;color:white;">
            <h1>❌ Withdrawal Rejected</h1>
            <h2>Withdrawal ID: {withdrawal.id}</h2>
            <p>The amount of ₹{withdrawal.amount} has been credited back to {withdrawal.user.username}.</p>
            <p>You can close this window.</p>
        </body>
        </html>
        """
    )


@router.get("/dashboard")
def admin_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin or current_user.role not in ["Administrator", "Super Administrator"]:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    from sqlalchemy import func
    from app.models.user_session import UserSession
    from app.models.trade import Trade
    from app.models.watchlist import Watchlist
    from app.models.support import SupportTicket
    from app.models.price_alert import PriceAlert
    from datetime import datetime

    # 1. Total Users
    total_users = db.query(User).count()

    # 2. Total Traders
    total_traders = db.query(User).filter(User.role == "Trader").count()

    # 3. Total Administrators
    total_admins = db.query(User).filter(User.role.in_(["Administrator", "Super Administrator"])).count()

    # 4. Total Deposits
    total_deposits_count = db.query(Deposit).count()
    total_deposits_amount = db.query(func.sum(Deposit.amount)).filter(Deposit.status == "Approved").scalar() or 0.0

    # 5. Total Withdrawals
    total_withdrawals_count = db.query(Withdrawal).count()
    total_withdrawals_amount = db.query(func.sum(Withdrawal.amount)).filter(Withdrawal.status == "Approved").scalar() or 0.0

    # 6. Total Trades
    total_trades = db.query(Trade).count()

    # 7. Total Watchlists
    total_watchlists = db.query(Watchlist).count()

    # 8. Open Support Tickets
    open_support_tickets = db.query(SupportTicket).filter(SupportTicket.status == "OPEN").count()

    # 9. Active Price Alerts
    active_price_alerts = db.query(PriceAlert).filter(PriceAlert.is_active == True).count()

    # 10. New Users Today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    new_users_today = db.query(User).filter(User.created_at >= today_start).count()

    # 11. Today's Trading Volume
    todays_volume = db.query(func.sum(Trade.quantity * Trade.price)).filter(Trade.created_at >= today_start).scalar() or 0.0

    # 12. Active Users Online
    active_users_online = db.query(func.count(func.distinct(UserSession.user_id))).filter(UserSession.is_active == True).scalar() or 0

    return {
        "total_users": total_users,
        "total_traders": total_traders,
        "total_administrators": total_admins,
        "total_deposits_count": total_deposits_count,
        "total_deposits_amount": total_deposits_amount,
        "total_withdrawals_count": total_withdrawals_count,
        "total_withdrawals_amount": total_withdrawals_amount,
        "total_trades": total_trades,
        "total_watchlists": total_watchlists,
        "open_support_tickets": open_support_tickets,
        "active_price_alerts": active_price_alerts,
        "new_users_today": new_users_today,
        "todays_trading_volume": todays_volume,
        "active_users_online": active_users_online,
    }


class AdminUserUpdate(BaseModel):
    username: str
    email: EmailStr
    role: str
    is_active: bool
    phone_number: str | None = None
    bank_name: str | None = None
    account_holder_name: str | None = None
    account_number: str | None = None
    ifsc_code: str | None = None
    upi_id: str | None = None


class ToggleStatusRequest(BaseModel):
    is_active: bool


class ResetPasswordRequest(BaseModel):
    otp: str
    new_password: str


@router.get("/users/{user_id}")
def view_user_details(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin or current_user.role not in ["Administrator", "Super Administrator"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from app.models.login_history import LoginHistory

    portfolio = db.query(Portfolio).filter(Portfolio.user_id == user.id).first()
    balance = portfolio.balance if portfolio else 0.0

    last_login_record = (
        db.query(LoginHistory)
        .filter(LoginHistory.user_id == user.id, LoginHistory.status == "Success")
        .order_by(LoginHistory.login_time.desc())
        .first()
    )
    last_login = last_login_record.login_time.isoformat() if last_login_record else None

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "phone_number": user.phone_number,
        "role": user.role,
        "is_active": user.is_active,
        "is_admin": user.is_admin,
        "created_at": user.created_at.isoformat(),
        "last_login": last_login,
        "balance": balance,
        "bank_name": user.bank_name,
        "account_holder_name": user.account_holder_name,
        "account_number": user.account_number,
        "ifsc_code": user.ifsc_code,
        "upi_id": user.upi_id
    }


@router.put("/users/{user_id}")
def update_user_profile(
    user_id: int,
    data: AdminUserUpdate,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin or current_user.role not in ["Administrator", "Super Administrator"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify email uniqueness if it's changing
    if data.email != user.email:
        existing = db.query(User).filter(User.email == data.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email is already in use by another account")

    if data.role not in ["Trader", "Administrator"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'Trader' or 'Administrator'")

    # Prevent admin from deactivating themselves or demoting themselves to Trader
    if user.id == current_user.id:
        if not data.is_active:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own admin account")
        if data.role not in ["Administrator", "Super Administrator"]:
            raise HTTPException(status_code=400, detail="You cannot demote yourself from Administrator role")

    user.username = data.username
    user.email = data.email
    user.role = data.role
    user.is_admin = (data.role == "Administrator")
    user.is_active = data.is_active
    user.phone_number = data.phone_number
    user.bank_name = data.bank_name
    user.account_holder_name = data.account_holder_name
    user.account_number = data.account_number
    user.ifsc_code = data.ifsc_code
    user.upi_id = data.upi_id

    db.commit()
    db.refresh(user)

    log_audit(db, current_user.id, "Update User Profile", f"Updated profile details for trader {user.email} (ID: {user_id})", request.client.host if (request and request.client) else None)

    return {"message": "User profile updated successfully"}


@router.post("/users/{user_id}/status")
def toggle_user_status(
    user_id: int,
    data: ToggleStatusRequest,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin or current_user.role not in ["Administrator", "Super Administrator"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id and not data.is_active:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

    user.is_active = data.is_active
    db.commit()

    status_str = "activated" if data.is_active else "deactivated"
    log_audit(db, current_user.id, "Toggle User Status", f"Set status to {status_str} for trader {user.email} (ID: {user_id})", request.client.host if (request and request.client) else None)
    
    return {"message": f"User account has been {status_str} successfully"}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin or current_user.role not in ["Administrator", "Super Administrator"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    try:
        from app.models.trade import Trade
        from app.models.watchlist import Watchlist
        from app.models.support import SupportTicket, SupportMessage
        from app.models.price_alert import PriceAlert
        from app.models.sltp import SLTPOrder
        from app.models.chat_history import ChatHistory
        from app.models.notification import Notification
        from app.models.user_session import UserSession
        from app.models.login_history import LoginHistory
        from app.models.deposit import Deposit
        from app.models.withdrawal import Withdrawal

        db.query(Portfolio).filter(Portfolio.user_id == user_id).delete(synchronize_session=False)
        db.query(Trade).filter(Trade.user_id == user_id).delete(synchronize_session=False)
        db.query(Watchlist).filter(Watchlist.user_id == user_id).delete(synchronize_session=False)
        db.query(SupportMessage).filter(SupportMessage.user_id == user_id).delete(synchronize_session=False)
        db.query(SupportTicket).filter(SupportTicket.user_id == user_id).delete(synchronize_session=False)
        db.query(PriceAlert).filter(PriceAlert.user_id == user_id).delete(synchronize_session=False)
        db.query(SLTPOrder).filter(SLTPOrder.user_id == user_id).delete(synchronize_session=False)
        db.query(ChatHistory).filter(ChatHistory.user_id == user_id).delete(synchronize_session=False)
        db.query(Notification).filter(Notification.user_id == user_id).delete(synchronize_session=False)
        db.query(UserSession).filter(UserSession.user_id == user_id).delete(synchronize_session=False)
        db.query(LoginHistory).filter(LoginHistory.user_id == user_id).delete(synchronize_session=False)
        db.query(Deposit).filter(Deposit.user_id == user_id).delete(synchronize_session=False)
        db.query(Withdrawal).filter(Withdrawal.user_id == user_id).delete(synchronize_session=False)

        db.delete(target_user)
        db.commit()

        log_audit(db, current_user.id, "Delete User", f"Permanently deleted trader account {target_user.email} (ID: {user_id}) and cascaded related rows", request.client.host if (request and request.client) else None)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")

    return {"message": "User and all related data deleted successfully"}


@router.post("/users/{user_id}/reset-password/send-otp")
def send_reset_password_otp(
    user_id: int,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin or current_user.role not in ["Administrator", "Super Administrator"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    from app.core.otp import generate_otp
    from app.models.otp import OTPVerification
    from app.core.email import _send_html_email
    from datetime import datetime, timedelta

    otp = generate_otp()
    email_key = f"reset_{target_user.email}"

    db.query(OTPVerification).filter(OTPVerification.email == email_key).delete(synchronize_session=False)

    otp_record = OTPVerification(
        email=email_key,
        otp=otp,
        verified=False,
        expires_at=datetime.utcnow() + timedelta(minutes=5)
    )
    db.add(otp_record)
    db.commit()

    body = f"""
    <html>
    <body style="font-family:Arial,sans-serif;background:#f5f7fa;padding:20px;">
      <div style="max-width:600px;margin:auto;background:white;border-radius:12px;padding:30px;box-shadow:0 4px 12px rgba(0,0,0,.1);">
        <h1 style="color:#2563eb;text-align:center;">TradeX</h1>
        <h2 style="text-align:center;">Admin Password Reset Request</h2>
        <p>An administrator has initiated a password reset for your TradeX account.</p>
        <p>Your verification code is:</p>
        <div style="font-size:32px;font-weight:bold;text-align:center;letter-spacing:6px;padding:20px;background:#eff6ff;border-radius:8px;color:#2563eb;">
          {otp}
        </div>
        <p style="margin-top:20px;">This OTP will expire in 5 minutes.</p>
        <p>Please share this OTP with the administrator to complete your password reset.</p>
        <hr>
        <p style="text-align:center;color:#666;">TradeX Team</p>
      </div>
    </body>
    </html>
    """
    try:
        _send_html_email(target_user.email, "TradeX Password Reset Verification", body)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send OTP email: {str(e)}")

    log_audit(db, current_user.id, "Send Reset Password OTP", f"Sent password reset OTP to trader {target_user.email} (ID: {user_id})", request.client.host if (request and request.client) else None)

    return {"message": "OTP sent successfully to user's registered email"}


@router.post("/users/{user_id}/reset-password/verify-and-reset")
def verify_otp_and_reset_password(
    user_id: int,
    data: ResetPasswordRequest,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin or current_user.role not in ["Administrator", "Super Administrator"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    from app.models.otp import OTPVerification
    from app.core.security import hash_password
    from datetime import datetime

    email_key = f"reset_{target_user.email}"

    otp_record = (
        db.query(OTPVerification)
        .filter(OTPVerification.email == email_key, OTPVerification.otp == data.otp)
        .order_by(OTPVerification.id.desc())
        .first()
    )

    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    if otp_record.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP has expired")

    target_user.password = hash_password(data.new_password)
    db.delete(otp_record)
    db.commit()

    log_audit(db, current_user.id, "Reset Password", f"Verified OTP and reset password for trader {target_user.email} (ID: {user_id})", request.client.host if (request and request.client) else None)

    return {"message": "User password reset successfully"}


@router.post("/users/{user_id}/force-logout")
def force_logout_user(
    user_id: int,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin or current_user.role not in ["Administrator", "Super Administrator"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    from app.models.user_session import UserSession
    from app.models.login_history import LoginHistory
    from app.api.auth import seconds_between

    active_sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == user_id, UserSession.is_active == True)
        .all()
    )

    now = datetime.utcnow()
    count = len(active_sessions)

    for session in active_sessions:
        session.is_active = False
        session.status = "Force Logged Out"
        session.revoked_at = now
        session.logout_time = now

        duration = seconds_between(session.created_at, now)
        session.session_duration = duration

        history = LoginHistory(
            user_id=session.user_id,
            session_id=session.session_token_id,
            ip_address=session.ip_address,
            device=session.device,
            browser=session.browser,
            location=session.location,
            login_time=session.created_at or now,
            logout_time=now,
            session_duration=duration,
            status="Force Logged Out",
        )
        db.add(history)

    db.commit()

    log_audit(db, current_user.id, "Force Logout User", f"Terminated {count} active sessions for trader {target_user.email} (ID: {user_id})", request.client.host if (request and request.client) else None)

    return {"message": f"Successfully logged out user from {count} active sessions"}


@router.get("/users/{user_id}/login-history")
def get_user_login_history(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin or current_user.role not in ["Administrator", "Super Administrator"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    from app.models.login_history import LoginHistory
    from app.models.user_session import UserSession
    from app.api.auth import seconds_between

    history = (
        db.query(LoginHistory)
        .filter(LoginHistory.user_id == user_id)
        .order_by(LoginHistory.login_time.desc())
        .all()
    )

    session_ids = [item.session_id for item in history if item.session_id]
    sessions = {}
    if session_ids:
        sessions = {
            session.session_token_id: session
            for session in (
                db.query(UserSession)
                .filter(UserSession.user_id == user_id, UserSession.session_token_id.in_(session_ids))
                .all()
            )
        }

    now = datetime.utcnow()
    result = []

    for item in history:
        session = sessions.get(item.session_id)
        logout_time = item.logout_time
        session_duration = item.session_duration

        if session:
            logout_time = logout_time or session.logout_time
            session_duration = (
                session_duration
                if session_duration is not None
                else session.session_duration
            )
            if session_duration is None and session.is_active:
                session_duration = seconds_between(session.created_at, now)
            elif session_duration is None and logout_time:
                session_duration = seconds_between(item.login_time, logout_time)

        result.append({
            "id": item.id,
            "session_id": item.session_id,
            "ip_address": item.ip_address,
            "device": item.device,
            "browser": item.browser,
            "location": item.location,
            "login_time": item.login_time.isoformat() if item.login_time else None,
            "logout_time": logout_time.isoformat() if logout_time else None,
            "session_duration": session_duration,
            "status": item.status,
        })

    return result


class AdminPermissionsUpdate(BaseModel):
    permissions: str


class AdminStatusUpdate(BaseModel):
    is_active: bool


@router.get("/administrators")
def list_administrators(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    admins = (
        db.query(User)
        .filter(User.role.in_(["Administrator", "Super Administrator"]))
        .order_by(User.created_at.desc())
        .all()
    )

    from app.models.login_history import LoginHistory

    result = []
    for admin in admins:
        last_login_record = (
            db.query(LoginHistory)
            .filter(LoginHistory.user_id == admin.id, LoginHistory.status == "Success")
            .order_by(LoginHistory.login_time.desc())
            .first()
        )
        last_login = last_login_record.login_time.isoformat() if last_login_record else None

        result.append({
            "id": admin.id,
            "username": admin.username,
            "email": admin.email,
            "role": admin.role,
            "is_active": admin.is_active,
            "created_at": admin.created_at.isoformat(),
            "last_login": last_login,
            "permissions": "Dashboard Access,User Management,Trading Management,Support Management,Reports,System Settings" if admin.role == "Super Administrator" else (admin.permissions or "Dashboard Access,User Management,Trading Management,Support Management,Reports,System Settings")
        })

    return result


@router.put("/administrators/{admin_id}/permissions")
def update_admin_permissions(
    admin_id: int,
    data: AdminPermissionsUpdate,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    target_admin = db.query(User).filter(User.id == admin_id).first()
    if not target_admin:
        raise HTTPException(status_code=404, detail="Administrator not found")

    if target_admin.role not in ["Administrator", "Super Administrator"]:
        raise HTTPException(status_code=400, detail="User is not an administrator")

    if target_admin.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot modify your own permissions")

    if target_admin.role == "Super Administrator" and current_user.role != "Super Administrator":
        raise HTTPException(status_code=400, detail="Only Super Administrators can modify Super Administrator accounts")

    target_admin.permissions = data.permissions
    db.commit()

    log_audit(db, current_user.id, "Change Permissions", f"Updated permissions for administrator {target_admin.email} (ID: {target_admin.id}) to: {data.permissions}", request.client.host if (request and request.client) else None)

    return {"message": "Administrator permissions updated successfully"}


@router.post("/administrators/{admin_id}/status")
def toggle_admin_status(
    admin_id: int,
    data: AdminStatusUpdate,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    target_admin = db.query(User).filter(User.id == admin_id).first()
    if not target_admin:
        raise HTTPException(status_code=404, detail="Administrator not found")

    if target_admin.role not in ["Administrator", "Super Administrator"]:
        raise HTTPException(status_code=400, detail="User is not an administrator")

    if target_admin.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

    if target_admin.role == "Super Administrator" and current_user.role != "Super Administrator":
        raise HTTPException(status_code=400, detail="Only Super Administrators can modify Super Administrator accounts")

    target_admin.is_active = data.is_active
    db.commit()

    if not data.is_active:
        from app.models.user_session import UserSession
        active_sessions = db.query(UserSession).filter(UserSession.user_id == admin_id, UserSession.is_active == True).all()
        for session in active_sessions:
            session.is_active = False
            session.status = "Deactivated"
        db.commit()

    status_str = "Enabled" if data.is_active else "Disabled"
    log_audit(db, current_user.id, "Toggle Admin Status", f"{status_str} administrator account {target_admin.email} (ID: {target_admin.id})", request.client.host if (request and request.client) else None)

    return {"message": f"Administrator account has been {status_str.lower()} successfully"}


@router.delete("/administrators/{admin_id}")
def delete_admin(
    admin_id: int,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    target_admin = db.query(User).filter(User.id == admin_id).first()
    if not target_admin:
        raise HTTPException(status_code=404, detail="Administrator not found")

    if target_admin.role not in ["Administrator", "Super Administrator"]:
        raise HTTPException(status_code=400, detail="User is not an administrator")

    if target_admin.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    if target_admin.role == "Super Administrator" and current_user.role != "Super Administrator":
        raise HTTPException(status_code=400, detail="Only Super Administrators can delete Super Administrator accounts")

    email = target_admin.email

    try:
        from app.models.trade import Trade
        from app.models.watchlist import Watchlist
        from app.models.support import SupportTicket, SupportMessage
        from app.models.price_alert import PriceAlert
        from app.models.sltp import SLTPOrder
        from app.models.chat_history import ChatHistory
        from app.models.notification import Notification
        from app.models.user_session import UserSession
        from app.models.login_history import LoginHistory
        from app.models.deposit import Deposit
        from app.models.withdrawal import Withdrawal
        from app.models.audit_log import AdminAuditLog

        db.query(Portfolio).filter(Portfolio.user_id == admin_id).delete(synchronize_session=False)
        db.query(Trade).filter(Trade.user_id == admin_id).delete(synchronize_session=False)
        db.query(Watchlist).filter(Watchlist.user_id == admin_id).delete(synchronize_session=False)
        db.query(SupportMessage).filter(SupportMessage.user_id == admin_id).delete(synchronize_session=False)
        db.query(SupportTicket).filter(SupportTicket.user_id == admin_id).delete(synchronize_session=False)
        db.query(PriceAlert).filter(PriceAlert.user_id == admin_id).delete(synchronize_session=False)
        db.query(SLTPOrder).filter(SLTPOrder.user_id == admin_id).delete(synchronize_session=False)
        db.query(ChatHistory).filter(ChatHistory.user_id == admin_id).delete(synchronize_session=False)
        db.query(Notification).filter(Notification.user_id == admin_id).delete(synchronize_session=False)
        db.query(UserSession).filter(UserSession.user_id == admin_id).delete(synchronize_session=False)
        db.query(LoginHistory).filter(LoginHistory.user_id == admin_id).delete(synchronize_session=False)
        db.query(Deposit).filter(Deposit.user_id == admin_id).delete(synchronize_session=False)
        db.query(Withdrawal).filter(Withdrawal.user_id == admin_id).delete(synchronize_session=False)
        db.query(AdminAuditLog).filter(AdminAuditLog.admin_id == admin_id).delete(synchronize_session=False)

        db.delete(target_admin)
        db.commit()

        log_audit(db, current_user.id, "Delete Admin", f"Deleted administrator account {email} (ID: {admin_id})", request.client.host if (request and request.client) else None)

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete administrator: {str(e)}")

    return {"message": "Administrator account and all related data deleted successfully"}


@router.get("/audit-logs")
def list_audit_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    from app.models.audit_log import AdminAuditLog

    logs = (
        db.query(AdminAuditLog, User)
        .join(User, User.id == AdminAuditLog.admin_id)
        .order_by(AdminAuditLog.timestamp.desc())
        .all()
    )

    return [
        {
            "id": log.id,
            "admin_id": log.admin_id,
            "admin_email": user.email,
            "admin_username": user.username,
            "action": log.action,
            "details": log.details,
            "ip_address": log.ip_address,
            "timestamp": log.timestamp.isoformat()
        }
        for log, user in logs
    ]


@router.get("/trades")
def list_trades(
    page: int = 1,
    limit: int = 10,
    search: str = None,
    date_filter: str = None,
    sort_by: str = "newest",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    from sqlalchemy import or_, func
    from datetime import datetime, timedelta
    import math
    from app.models.trade import Trade
    from app.models.stock import Stock

    # Base Query
    query = (
        db.query(Trade, User, Stock)
        .join(User, User.id == Trade.user_id)
        .join(Stock, Stock.id == Trade.stock_id)
    )

    # Search filter
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                User.username.ilike(search_pattern),
                Stock.symbol.ilike(search_pattern),
                Stock.company_name.ilike(search_pattern)
            )
        )

    # Date filter
    start_date = None
    if date_filter == "today":
        start_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    elif date_filter == "week":
        now = datetime.utcnow()
        start_date = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    elif date_filter == "month":
        start_date = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    if start_date:
        query = query.filter(Trade.created_at >= start_date)

    # Stats query (count & volume before pagination)
    stats_query = db.query(
        func.count(Trade.id),
        func.sum(Trade.price * Trade.quantity)
    ).join(User, User.id == Trade.user_id).join(Stock, Stock.id == Trade.stock_id)

    if search:
        stats_query = stats_query.filter(
            or_(
                User.username.ilike(search_pattern),
                Stock.symbol.ilike(search_pattern),
                Stock.company_name.ilike(search_pattern)
            )
        )
    if start_date:
        stats_query = stats_query.filter(Trade.created_at >= start_date)

    stats_res = stats_query.first()
    total_count = stats_res[0] if stats_res else 0
    total_volume = float(stats_res[1]) if stats_res and stats_res[1] is not None else 0.0

    # Sorting
    if sort_by == "newest":
        query = query.order_by(Trade.created_at.desc())
    elif sort_by == "oldest":
        query = query.order_by(Trade.created_at.asc())
    elif sort_by == "price":
        query = query.order_by(Trade.price.desc())
    elif sort_by == "quantity":
        query = query.order_by(Trade.quantity.desc())
    elif sort_by == "value":
        query = query.order_by((Trade.price * Trade.quantity).desc())
    else:
        query = query.order_by(Trade.created_at.desc())

    # Pagination
    offset = (page - 1) * limit
    trades_list = query.offset(offset).limit(limit).all()
    pages_count = math.ceil(total_count / limit) if limit > 0 else 1

    trades_data = []
    for trade, user, stock in trades_list:
        trades_data.append({
            "id": trade.id,
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "stock_id": stock.id,
            "stock_symbol": stock.symbol,
            "stock_name": stock.company_name,
            "trade_type": trade.trade_type,
            "quantity": trade.quantity,
            "price": trade.price,
            "total_value": trade.price * trade.quantity,
            "created_at": trade.created_at.isoformat(),
            "note": trade.note,
            "status": "COMPLETED"
        })

    return {
        "trades": trades_data,
        "total_count": total_count,
        "total_volume": total_volume,
        "pages": pages_count,
        "current_page": page
    }


@router.get("/stocks")
def list_stocks(
    page: int = 1,
    limit: int = 10,
    search: str = None,
    status: str = None,
    sort_by: str = "symbol", # symbol, company_name, price
    sort_order: str = "asc", # asc, desc
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    from app.models.stock import Stock
    query = db.query(Stock)

    # Search
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Stock.symbol.like(search_filter)) |
            (Stock.company_name.like(search_filter))
        )

    # Filter by status
    if status:
        is_active_val = (status.lower() == "enabled" or status.lower() == "active" or status.lower() == "true")
        query = query.filter(Stock.is_active == is_active_val)

    # Sort
    sort_attr = Stock.symbol
    if sort_by == "company_name":
        sort_attr = Stock.company_name
    elif sort_by == "price":
        sort_attr = Stock.current_price

    if sort_order == "desc":
        query = query.order_by(sort_attr.desc())
    else:
        query = query.order_by(sort_attr.asc())

    # Pagination
    total = query.count()
    offset = (page - 1) * limit
    stocks = query.offset(offset).limit(limit).all()

    import math
    pages = math.ceil(total / limit) if limit > 0 else 1

    return {
        "stocks": [
            {
                "id": s.id,
                "symbol": s.symbol,
                "company_name": s.company_name,
                "current_price": s.current_price,
                "previous_close": s.previous_close,
                "market": s.market or "NSE",
                "is_active": s.is_active,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None
            }
            for s in stocks
        ],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages
    }


@router.post("/stocks")
def create_stock(
    data: StockCreate,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    from app.models.stock import Stock

    # Validate duplicate stock symbols
    symbol_upper = data.symbol.strip().upper()
    if not symbol_upper:
        raise HTTPException(status_code=400, detail="Stock symbol cannot be empty")

    existing = db.query(Stock).filter(Stock.symbol == symbol_upper).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Stock symbol '{symbol_upper}' already exists")

    # Validate input values
    if not data.company_name.strip():
        raise HTTPException(status_code=400, detail="Company name cannot be empty")
    if data.current_price <= 0:
        raise HTTPException(status_code=400, detail="Current price must be greater than zero")

    new_stock = Stock(
        symbol=symbol_upper,
        company_name=data.company_name.strip(),
        current_price=data.current_price,
        previous_close=data.current_price,
        market=data.market or "NSE",
        is_active=data.is_active
    )

    db.add(new_stock)
    db.commit()
    db.refresh(new_stock)

    log_audit(db, current_user.id, "Add Stock", f"Added new stock symbol: {new_stock.symbol}, company: {new_stock.company_name}", request.client.host if (request and request.client) else None)

    return {
        "message": "Stock created successfully",
        "stock": {
            "id": new_stock.id,
            "symbol": new_stock.symbol,
            "company_name": new_stock.company_name,
            "current_price": new_stock.current_price,
            "market": new_stock.market,
            "is_active": new_stock.is_active
        }
    }


@router.put("/stocks/{stock_id}")
def update_stock(
    stock_id: int,
    data: StockUpdate,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    from app.models.stock import Stock
    stock = db.query(Stock).filter(Stock.id == stock_id).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    # Validate inputs
    if not data.company_name.strip():
        raise HTTPException(status_code=400, detail="Company name cannot be empty")
    if data.current_price <= 0:
        raise HTTPException(status_code=400, detail="Current price must be greater than zero")

    # If the current price is changing, we save it as current_price and save previous as previous_close
    old_price = stock.current_price
    if old_price != data.current_price:
        stock.previous_close = old_price
        stock.current_price = data.current_price

    stock.company_name = data.company_name.strip()
    stock.market = data.market or "NSE"
    stock.is_active = data.is_active
    stock.updated_at = datetime.utcnow()

    db.commit()

    log_audit(db, current_user.id, "Update Stock", f"Updated stock details for symbol {stock.symbol}: price={stock.current_price}, active={stock.is_active}", request.client.host if (request and request.client) else None)

    return {
        "message": "Stock updated successfully",
        "stock": {
            "id": stock.id,
            "symbol": stock.symbol,
            "company_name": stock.company_name,
            "current_price": stock.current_price,
            "market": stock.market,
            "is_active": stock.is_active
        }
    }


@router.delete("/stocks/{stock_id}")
def delete_stock(
    stock_id: int,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    from app.models.stock import Stock
    from app.models.trade import Trade
    stock = db.query(Stock).filter(Stock.id == stock_id).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    # Prevent deleting stocks with trading history to avoid database integrity issues
    has_trades = db.query(Trade).filter(Trade.stock_id == stock_id).first()
    if has_trades:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete this stock because it has associated trading history. You can disable it instead to prevent further trading."
        )

    symbol = stock.symbol
    db.delete(stock)
    db.commit()

    log_audit(db, current_user.id, "Delete Stock", f"Deleted stock symbol: {symbol}", request.client.host if (request and request.client) else None)

    return {"message": f"Stock {symbol} deleted successfully"}


