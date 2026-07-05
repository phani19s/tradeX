from typing import List
from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Request
# from fastapi.responses import RedirectResponse
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr

from datetime import datetime, timedelta
from app.schemas.stock import StockCreate, StockUpdate, StockResponse

import os

from sqlalchemy.orm import Session, joinedload

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


def log_audit(
    db: Session,
    admin_id: int,
    action: str,
    details: str,
    ip_address: str = None,
    module: str = None,
    status: str = "Success",
    request: Request = None
):
    try:
        from app.models.audit_log import AdminAuditLog
        
        if not module:
            action_lower = action.lower()
            if "deposit" in action_lower:
                module = "Deposits"
            elif "withdrawal" in action_lower:
                module = "Withdrawals"
            elif "user" in action_lower or "password" in action_lower or "logout" in action_lower or "login" in action_lower:
                module = "User Management"
            elif "admin" in action_lower or "permission" in action_lower:
                module = "Admin Management"
            elif "stock" in action_lower:
                module = "Stock Management"
            elif "setting" in action_lower:
                module = "System Settings"
            elif "ticket" in action_lower or "chat" in action_lower or "reply" in action_lower:
                module = "Support"
            elif "report" in action_lower:
                module = "Reports"
            elif "maintenance" in action_lower:
                module = "Maintenance"
            else:
                module = "Other"
                
        device_browser = "Unknown"
        if request:
            user_agent = request.headers.get("user-agent", "")
            if user_agent:
                browser = "Other"
                if "Chrome" in user_agent: browser = "Chrome"
                elif "Firefox" in user_agent: browser = "Firefox"
                elif "Safari" in user_agent: browser = "Safari"
                elif "Edge" in user_agent: browser = "Edge"
                elif "MSIE" in user_agent or "Trident" in user_agent: browser = "IE"
                
                os_name = "Other"
                if "Windows" in user_agent: os_name = "Windows"
                elif "Macintosh" in user_agent: os_name = "macOS"
                elif "Linux" in user_agent: os_name = "Linux"
                elif "Android" in user_agent: os_name = "Android"
                elif "iPhone" in user_agent: os_name = "iOS"
                
                device_browser = f"{browser} / {os_name}"

        db.add(AdminAuditLog(
            admin_id=admin_id,
            action=action,
            module=module,
            details=details,
            ip_address=ip_address,
            device_browser=device_browser,
            status=status
        ))
        db.commit()
    except Exception as e:
        print("Failed to log audit action:", e)



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
    users = query.options(joinedload(User.portfolio)).order_by(User.created_at.desc()).offset(offset).limit(limit).all()

    user_ids = [u.id for u in users]
    login_map = {}
    if user_ids:
        from sqlalchemy import func
        from app.models.login_history import LoginHistory
        last_logins = (
            db.query(LoginHistory.user_id, func.max(LoginHistory.login_time).label("max_login"))
            .filter(LoginHistory.user_id.in_(user_ids), LoginHistory.status == "Success")
            .group_by(LoginHistory.user_id)
            .all()
        )
        login_map = {uid: max_login.isoformat() for uid, max_login in last_logins}

    result = []
    for user in users:
        balance = user.portfolio.balance if user.portfolio else 0.0
        last_login = login_map.get(user.id)

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
        .options(
            joinedload(Deposit.user),
            joinedload(Deposit.created_by),
            joinedload(Deposit.verified_by)
        )
        .order_by(Deposit.created_at.desc())
        .all()
    )

    items = []
    for deposit in deposits:
        items.append(
            {
                "id": deposit.id,
                "amount": deposit.amount,
                "utr_number": deposit.utr_number,
                "status": deposit.status,
                "created_at": deposit.created_at.isoformat(),
                "verified_at": deposit.verified_at.isoformat() if deposit.verified_at else None,
                "target_email": deposit.user.email if deposit.user else None,
                "created_by_email": deposit.created_by.email if deposit.created_by else None,
                "verified_by_email": deposit.verified_by.email if deposit.verified_by else None,
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


@router.get("/maintenance/email/deactivate")
def deactivate_maintenance_from_email(
    token: str,
    db: Session = Depends(get_db)
):
    try:
        from app.core.email import decode_maintenance_action_token
        payload = decode_maintenance_action_token(token)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired deactivation link"
        )

    if payload.get("action") != "deactivate":
        raise HTTPException(
            status_code=400,
            detail="Invalid action"
        )

    from app.models.system_setting import SystemSetting, SettingHistory
    
    # Find setting
    setting = db.query(SystemSetting).filter(SystemSetting.key == "maintenance_mode").first()
    
    if not setting:
        raise HTTPException(
            status_code=404,
            detail="Maintenance mode setting not found"
        )
        
    old_val = setting.value
    if old_val == "false":
        return HTMLResponse(
            f"""
            <html>
            <body style="font-family:Arial;text-align:center;padding-top:100px;background:#0f172a;color:white;">
                <h1>ℹ️ System Already Online</h1>
                <p>Maintenance mode is already <strong>OFF</strong>.</p>
                <p>You can close this window.</p>
            </body>
            </html>
            """
        )

    setting.value = "false"
    
    # Save setting history
    history = SettingHistory(
        setting_key="maintenance_mode",
        old_value=old_val,
        new_value="false",
        changed_by="tradex.adminn@gmail.com"
    )
    db.add(history)
    
    from app.models.user import User
    admin_user = db.query(User).filter(User.email == "tradex.adminn@gmail.com").first()
    if not admin_user:
        admin_user = db.query(User).filter(User.is_admin == True).first()
        
    admin_id = admin_user.id if admin_user else 1
    
    log_audit(
        db,
        admin_id=admin_id,
        action="Deactivate Maintenance Mode",
        details="Deactivated by tradex.adminn@gmail.com via email verification link",
        ip_address=None
    )
    
    db.commit()
    
    # Send email notification that it has been deactivated
    try:
        from app.core.email import send_maintenance_mode_email
        send_maintenance_mode_email(False)
    except Exception:
        pass

    return HTMLResponse(
        f"""
        <html>
        <body style="font-family:Arial;text-align:center;padding-top:100px;background:#0f172a;color:white;">
            <h1>✅ Maintenance Mode Deactivated</h1>
            <p>TradeX is now back online. The audit log has been updated under <strong>tradex.adminn@gmail.com</strong>.</p>
            <p>You can close this window.</p>
        </body>
        </html>
        """
    )


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
    total_admins = db.query(User).filter(User.is_admin == True).count()

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


@router.get("/users/{user_id}/activity")
def get_user_activity(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin or current_user.role not in ["Administrator", "Super Administrator"]:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Get all trades
    from app.models.trade import Trade
    trades = db.query(Trade).options(joinedload(Trade.stock)).filter(Trade.user_id == user_id).order_by(Trade.created_at.desc()).all()
    trades_list = [{
        "id": t.id,
        "stock_symbol": t.stock.symbol if t.stock else "Unknown",
        "stock_name": t.stock.company_name if t.stock else "Unknown",
        "trade_type": t.trade_type,
        "quantity": t.quantity,
        "price": t.price,
        "created_at": t.created_at.isoformat()
    } for t in trades]
    
    # Get all deposits
    from app.models.deposit import Deposit
    deposits = db.query(Deposit).filter(Deposit.user_id == user_id).order_by(Deposit.created_at.desc()).all()
    deposits_list = [{
        "id": d.id,
        "amount": d.amount,
        "payment_type": d.payment_type,
        "utr_number": d.utr_number,
        "status": d.status,
        "created_at": d.created_at.isoformat()
    } for d in deposits]
    
    # Get all withdrawals
    from app.models.withdrawal import Withdrawal
    withdrawals = db.query(Withdrawal).filter(Withdrawal.user_id == user_id).order_by(Withdrawal.created_at.desc()).all()
    withdrawals_list = [{
        "id": w.id,
        "amount": w.amount,
        "status": w.status,
        "created_at": w.created_at.isoformat()
    } for w in withdrawals]
    
    # Get watchlist
    from app.models.watchlist import Watchlist
    from app.models.stock import Stock
    watchlist = db.query(Watchlist, Stock).join(Stock, Watchlist.stock_id == Stock.id).filter(Watchlist.user_id == user_id).all()
    watchlist_list = [{
        "stock_symbol": s.symbol,
        "stock_name": s.company_name,
        "current_price": s.current_price
    } for _, s in watchlist]
    
    # Get support tickets
    from app.models.support import SupportTicket
    tickets = db.query(SupportTicket).filter(SupportTicket.user_id == user_id).order_by(SupportTicket.created_at.desc()).all()
    tickets_list = [{
        "id": tk.id,
        "ticket_number": tk.ticket_number,
        "issue_type": tk.issue_type,
        "status": tk.status,
        "created_at": tk.created_at.isoformat()
    } for tk in tickets]

    return {
        "trades": trades_list,
        "deposits": deposits_list,
        "withdrawals": withdrawals_list,
        "watchlist": watchlist_list,
        "tickets": tickets_list
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
        .filter(User.is_admin == True)
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


def generate_pdf(title: str, rows: list) -> bytes:
    # Wrap lines to prevent horizontal cropping
    wrapped_lines = []
    for row in rows:
        parts = row.split("\n")
        for part in parts:
            if not part.strip():
                wrapped_lines.append("")
                continue
            
            # Wrap lines at 80 characters
            words = part.split(" ")
            current_line = []
            for word in words:
                if sum(len(w) + 1 for w in current_line) + len(word) <= 80:
                    current_line.append(word)
                else:
                    wrapped_lines.append(" ".join(current_line))
                    current_line = [word]
            if current_line:
                wrapped_lines.append(" ".join(current_line))

    # Pagination: 32 lines max per page
    lines_per_page = 32
    pages_data = []
    if not wrapped_lines:
        pages_data = [[]]
    else:
        pages_data = [wrapped_lines[i:i + lines_per_page] for i in range(0, len(wrapped_lines), lines_per_page)]

    objects = []
    # 1. Catalog Object
    objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    
    # 2. Pages Object
    num_pages = len(pages_data)
    kids_str = " ".join([f"{4 + 2*i} 0 R" for i in range(num_pages)])
    objects.append(f"2 0 obj\n<< /Type /Pages /Kids [{kids_str}] /Count {num_pages} >>\nendobj\n".encode("utf-8"))
    
    # 3. Font Object
    objects.append(b"3 0 obj\n<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>\nendobj\n")

    # Write each page
    for i, page_lines in enumerate(pages_data):
        stream_lines = []
        stream_lines.append("BT")
        stream_lines.append("/F1 14 Tf")
        stream_lines.append("50 800 Td")
        page_title = f"{title} (Page {i+1} of {num_pages})"
        escaped_title = page_title.replace("(", "\\(").replace(")", "\\)")
        stream_lines.append(f"({escaped_title}) Tj")
        stream_lines.append("0 -30 Td")
        stream_lines.append("/F1 10 Tf")
        
        for line in page_lines:
            escaped_line = line.replace("(", "\\(").replace(")", "\\)")
            stream_lines.append(f"({escaped_line}) Tj")
            stream_lines.append("0 -22 Td")
        stream_lines.append("ET")
        
        stream_content = "\n".join(stream_lines).encode("utf-8")
        stream_len = len(stream_content)
        
        # Page object at index 4 + 2*i
        page_obj = f"{4 + 2*i} 0 obj\n<< /Type /Page /Parent 2 0 R /Resources 3 0 R /MediaBox [0 0 595 842] /Contents {5 + 2*i} 0 R >>\nendobj\n".encode("utf-8")
        # Content stream object at index 5 + 2*i
        content_obj = f"{5 + 2*i} 0 obj\n<< /Length {stream_len} >>\nstream\n".encode("utf-8") + stream_content + b"\nendstream\nendobj\n"
        
        objects.append(page_obj)
        objects.append(content_obj)

    # Compile PDF
    offsets = [0]
    pdf_data = b"%PDF-1.4\n"
    for obj in objects:
        offsets.append(len(pdf_data))
        pdf_data += obj
        
    xref_start = len(pdf_data)
    pdf_data += b"xref\n"
    pdf_data += f"0 {len(objects) + 1}\n".encode("utf-8")
    pdf_data += b"0000000000 65535 f \n"
    for offset in offsets[1:]:
        pdf_data += f"{offset:010d} 00000 n \n".encode("utf-8")
        
    pdf_data += b"trailer\n"
    pdf_data += f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n".encode("utf-8")
    pdf_data += b"startxref\n"
    pdf_data += f"{xref_start}\n".encode("utf-8")
    pdf_data += b"%%EOF\n"
    
    return pdf_data


@router.get("/reports/generate")
def generate_report(
    period: str, # daily, weekly, monthly, custom
    request: Request,
    start_date: str = None,
    end_date: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    # Load required models
    from app.models.trade import Trade
    from app.models.stock import Stock
    from app.models.deposit import Deposit
    from app.models.withdrawal import Withdrawal
    from app.models.support import SupportTicket
    from app.models.price_alert import PriceAlert
    from app.models.watchlist import Watchlist
    from sqlalchemy import func
    import json

    now = datetime.utcnow()
    
    if period == "daily":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
        report_label = "Daily Report"
    elif period == "weekly":
        start = now - timedelta(days=7)
        end = now
        report_label = "Weekly Report"
    elif period == "monthly":
        start = now - timedelta(days=30)
        end = now
        report_label = "Monthly Report"
    elif period == "custom":
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="Start date and end date are required for custom period")
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d")
            end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        report_label = f"Custom Report ({start_date} to {end_date})"
    else:
        raise HTTPException(status_code=400, detail="Invalid period. Must be daily, weekly, monthly, or custom")

    # Global totals
    total_users = db.query(User).count()
    total_traders = db.query(User).filter(User.role == "Trader").count()
    total_admins = db.query(User).filter(User.is_admin == True).count()
    total_watchlists = db.query(Watchlist).count()
    active_price_alerts = db.query(PriceAlert).filter(PriceAlert.is_active == True).count()
    open_support_tickets = db.query(SupportTicket).filter(SupportTicket.status == "OPEN").count()

    # Period specific metrics
    new_user_registrations = db.query(User).filter(User.created_at >= start, User.created_at <= end).count()
    trades_in_period = db.query(Trade).filter(Trade.created_at >= start, Trade.created_at <= end).all()
    total_trades = len(trades_in_period)
    total_trading_volume = sum(t.quantity * t.price for t in trades_in_period)
    profit_loss_summary = sum(t.quantity * t.price if t.trade_type == "SELL" else -t.quantity * t.price for t in trades_in_period)

    total_deposits_count = db.query(Deposit).filter(Deposit.status == "Approved", Deposit.created_at >= start, Deposit.created_at <= end).count()
    total_deposits_amount = db.query(func.sum(Deposit.amount)).filter(Deposit.status == "Approved", Deposit.created_at >= start, Deposit.created_at <= end).scalar() or 0.0
    
    total_withdrawals_count = db.query(Withdrawal).filter(Withdrawal.status == "Approved", Withdrawal.created_at >= start, Withdrawal.created_at <= end).count()
    total_withdrawals_amount = db.query(func.sum(Withdrawal.amount)).filter(Withdrawal.status == "Approved", Withdrawal.created_at >= start, Withdrawal.created_at <= end).scalar() or 0.0

    metrics = {
        "total_users": total_users,
        "total_traders": total_traders,
        "total_administrators": total_admins,
        "total_trades": total_trades,
        "total_deposits_count": total_deposits_count,
        "total_deposits_amount": float(total_deposits_amount),
        "total_withdrawals_count": total_withdrawals_count,
        "total_withdrawals_amount": float(total_withdrawals_amount),
        "total_trading_volume": float(total_trading_volume),
        "total_watchlists": total_watchlists,
        "active_price_alerts": active_price_alerts,
        "open_support_tickets": open_support_tickets,
        "new_user_registrations": new_user_registrations,
        "profit_loss_summary": float(profit_loss_summary)
    }

    # Save generated report to history database log
    from app.models.report_history import ReportHistory
    history_rec = ReportHistory(
        report_type=period.capitalize(),
        start_date=start,
        end_date=end,
        generated_by=current_user.email,
        metrics_data=json.dumps(metrics)
    )
    db.add(history_rec)
    db.commit()

    log_audit(db, current_user.id, "Generate Report", f"Generated {period.capitalize()} report", request.client.host if request.client else None, "Reports", "Success", request)

    return {
        "generated_at": now.isoformat(),
        "generated_by": current_user.email,
        "period": period,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "metrics": metrics
    }


@router.post("/reports/export")
def export_report(
    payload: dict,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    # Load required models
    from app.models.trade import Trade
    from app.models.deposit import Deposit
    from app.models.withdrawal import Withdrawal
    from app.models.support import SupportTicket
    from app.models.price_alert import PriceAlert
    from app.models.watchlist import Watchlist
    from sqlalchemy import func
    from fastapi.responses import StreamingResponse
    import io
    import csv

    export_format = payload.get("format", "csv").lower()
    period = payload.get("period", "daily").lower()
    start_date = payload.get("start_date")
    end_date = payload.get("end_date")

    now = datetime.utcnow()
    
    if period == "daily":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
        report_label = "Daily Report"
    elif period == "weekly":
        start = now - timedelta(days=7)
        end = now
        report_label = "Weekly Report"
    elif period == "monthly":
        start = now - timedelta(days=30)
        end = now
        report_label = "Monthly Report"
    elif period == "custom":
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="Start and end dates required")
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999)
        report_label = f"Custom Report ({start_date} to {end_date})"
    else:
        raise HTTPException(status_code=400, detail="Invalid period")

    # Re-calculate report metrics securely
    total_users = db.query(User).count()
    total_traders = db.query(User).filter(User.role == "Trader").count()
    total_admins = db.query(User).filter(User.is_admin == True).count()
    total_watchlists = db.query(Watchlist).count()
    active_price_alerts = db.query(PriceAlert).filter(PriceAlert.is_active == True).count()
    open_support_tickets = db.query(SupportTicket).filter(SupportTicket.status == "OPEN").count()

    new_user_registrations = db.query(User).filter(User.created_at >= start, User.created_at <= end).count()
    trades_in_period = db.query(Trade).filter(Trade.created_at >= start, Trade.created_at <= end).all()
    total_trades = len(trades_in_period)
    total_trading_volume = sum(t.quantity * t.price for t in trades_in_period)
    profit_loss_summary = sum(t.quantity * t.price if t.trade_type == "SELL" else -t.quantity * t.price for t in trades_in_period)

    total_deposits_count = db.query(Deposit).filter(Deposit.status == "Approved", Deposit.created_at >= start, Deposit.created_at <= end).count()
    total_deposits_amount = db.query(func.sum(Deposit.amount)).filter(Deposit.status == "Approved", Deposit.created_at >= start, Deposit.created_at <= end).scalar() or 0.0
    
    total_withdrawals_count = db.query(Withdrawal).filter(Withdrawal.status == "Approved", Withdrawal.created_at >= start, Withdrawal.created_at <= end).count()
    total_withdrawals_amount = db.query(func.sum(Withdrawal.amount)).filter(Withdrawal.status == "Approved", Withdrawal.created_at >= start, Withdrawal.created_at <= end).scalar() or 0.0

    # Build report structured rows
    report_data = [
        ("TradeX System Audit Report", ""),
        ("Report Name", report_label),
        ("Generated By", current_user.email),
        ("Generation Date (UTC)", now.strftime("%Y-%m-%d %H:%M:%S")),
        ("Period Range Start", start.strftime("%Y-%m-%d %H:%M:%S")),
        ("Period Range End", end.strftime("%Y-%m-%d %H:%M:%S")),
        ("", ""),
        ("System Metric Key", "Calculated Value"),
        ("Total Users Count", str(total_users)),
        ("Total Traders Count", str(total_traders)),
        ("Total Administrators Count", str(total_admins)),
        ("Total Trades Logged", str(total_trades)),
        ("Total Deposits Count", str(total_deposits_count)),
        ("Total Deposits Amount", f"Rs. {total_deposits_amount:,.2f}"),
        ("Total Withdrawals Count", str(total_withdrawals_count)),
        ("Total Withdrawals Amount", f"Rs. {total_withdrawals_amount:,.2f}"),
        ("Total Trading Volume", f"Rs. {total_trading_volume:,.2f}"),
        ("Total Watchlists", str(total_watchlists)),
        ("Active Price Alerts", str(active_price_alerts)),
        ("Open Support Tickets", str(open_support_tickets)),
        ("New User Registrations", str(new_user_registrations)),
        ("Profit/Loss Summary", f"Rs. {profit_loss_summary:,.2f}")
    ]

    filename = f"report_{period}_{now.strftime('%Y%m%d_%H%M%S')}"

    if export_format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        for row in report_data:
            writer.writerow(row)
        output.seek(0)
        log_audit(db, current_user.id, "Export Report", f"Exported {period.capitalize()} report as CSV", request.client.host if request.client else None, "Reports", "Success", request)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}.csv"}
        )

    elif export_format == "excel":
        output = io.StringIO()
        writer = csv.writer(output)
        for row in report_data:
            writer.writerow(row)
        output.seek(0)
        log_audit(db, current_user.id, "Export Report", f"Exported {period.capitalize()} report as Excel", request.client.host if request.client else None, "Reports", "Success", request)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="application/vnd.ms-excel",
            headers={"Content-Disposition": f"attachment; filename={filename}.xls"}
        )

    elif export_format == "pdf":
        rows = [f"{label}: {val}" if label else "" for label, val in report_data]
        pdf_bytes = generate_pdf(f"TradeX {report_label}", rows)
        log_audit(db, current_user.id, "Export Report", f"Exported {period.capitalize()} report as PDF", request.client.host if request.client else None, "Reports", "Success", request)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}.pdf"}
        )
    else:
        log_audit(db, current_user.id, "Export Report", f"Attempted to export {period.capitalize()} report as {export_format} (Invalid format)", request.client.host if request.client else None, "Reports", "Failed", request)
        raise HTTPException(status_code=400, detail="Invalid format")


@router.get("/reports/history")
def list_report_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    from app.models.report_history import ReportHistory
    import json
    
    history = db.query(ReportHistory).order_by(ReportHistory.generated_at.desc()).all()
    
    result = []
    for h in history:
        result.append({
            "id": h.id,
            "report_type": h.report_type,
            "start_date": h.start_date.isoformat(),
            "end_date": h.end_date.isoformat(),
            "generated_by": h.generated_by,
            "generated_at": h.generated_at.isoformat(),
            "metrics": json.loads(h.metrics_data)
        })
        
    return result


@router.get("/market-overview")
def get_market_overview(
    period: str = "today", # today, week, month, custom
    start_date: str = None,
    end_date: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    from app.models.trade import Trade
    from app.models.stock import Stock
    from collections import defaultdict

    now = datetime.utcnow()
    
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
    elif period == "week":
        start = now - timedelta(days=7)
        end = now
    elif period == "month":
        start = now - timedelta(days=30)
        end = now
    elif period == "custom":
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="Start date and end date are required for custom period")
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d")
            end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        raise HTTPException(status_code=400, detail="Invalid period. Must be today, week, month, or custom")

    # Fetch trades and stocks
    trades = db.query(Trade).filter(Trade.created_at >= start, Trade.created_at <= end).all()
    stocks = db.query(Stock).all()
    stock_map = {s.id: s for s in stocks}

    # Summary Metrics
    total_trades = len(trades)
    total_volume = sum(t.price * t.quantity for t in trades)
    total_profit = sum(t.price * t.quantity for t in trades if t.trade_type == "SELL")
    total_loss = sum(t.price * t.quantity for t in trades if t.trade_type == "BUY")

    # 1. Most Traded Stocks
    stock_groups = defaultdict(lambda: {"count": 0, "volume": 0.0, "symbol": "", "company_name": ""})
    for t in trades:
        stock = stock_map.get(t.stock_id)
        if stock:
            stock_groups[t.stock_id]["count"] += 1
            stock_groups[t.stock_id]["volume"] += t.price * t.quantity
            stock_groups[t.stock_id]["symbol"] = stock.symbol
            stock_groups[t.stock_id]["company_name"] = stock.company_name

    most_traded = sorted(stock_groups.values(), key=lambda x: x["volume"], reverse=True)[:5]

    # 2. Top Gainers & Losers (percentage change current vs previous close)
    gainers_losers = []
    for s in stocks:
        pct = 0.0
        if s.previous_close and s.previous_close > 0:
            pct = ((s.current_price - s.previous_close) / s.previous_close) * 100
        gainers_losers.append({
            "id": s.id,
            "symbol": s.symbol,
            "company_name": s.company_name,
            "current_price": s.current_price,
            "previous_close": s.previous_close,
            "change_percent": round(pct, 2)
        })

    top_gainers = sorted([x for x in gainers_losers if x["change_percent"] > 0], key=lambda x: x["change_percent"], reverse=True)[:5]
    top_losers = sorted([x for x in gainers_losers if x["change_percent"] < 0], key=lambda x: x["change_percent"])[:5]

    # 3. Trading Volume Over Time (daily buckets)
    volume_by_day = defaultdict(float)
    current_day = start.date()
    end_day = end.date()
    while current_day <= end_day:
        volume_by_day[current_day.strftime("%Y-%m-%d")] = 0.0
        current_day += timedelta(days=1)

    for t in trades:
        day_str = t.created_at.strftime("%Y-%m-%d")
        if day_str in volume_by_day:
            volume_by_day[day_str] += t.price * t.quantity

    trading_volume_chart = [{"date": k, "volume": v} for k, v in sorted(volume_by_day.items())]

    # 4. Daily Profit/Loss (SELLs vs BUYs)
    pl_by_day = defaultdict(float)
    current_day = start.date()
    while current_day <= end_day:
        pl_by_day[current_day.strftime("%Y-%m-%d")] = 0.0
        current_day += timedelta(days=1)

    for t in trades:
        day_str = t.created_at.strftime("%Y-%m-%d")
        if day_str in pl_by_day:
            val = t.price * t.quantity if t.trade_type == "SELL" else -t.price * t.quantity
            pl_by_day[day_str] += val

    daily_pl_chart = [{"date": k, "pl": v} for k, v in sorted(pl_by_day.items())]

    return {
        "summary": {
            "total_trades": total_trades,
            "total_volume": float(total_volume),
            "total_profit": float(total_profit),
            "total_loss": float(total_loss)
        },
        "most_traded": most_traded,
        "top_gainers": top_gainers,
        "top_losers": top_losers,
        "trading_volume_chart": trading_volume_chart,
        "daily_pl_chart": daily_pl_chart
    }


@router.get("/settings")
def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.system_setting import SystemSetting

    defaults = {
        "trading_start_time": "09:00",
        "trading_end_time": "17:00",
        "otp_expiry_seconds": "300",
        "min_deposit_amount": "100.0",
        "min_withdrawal_amount": "500.0",
        "maintenance_mode": "false",
        "maintenance_title": "System Under Maintenance",
        "maintenance_message": "We are currently performing scheduled maintenance. Please check back later.",
        "maintenance_eta": "2 hours",
        "email_sender": "adminn.tradex@gmail.com",
        "smtp_server": "smtp.gmail.com",
        "smtp_port": "587",
        "smtp_username": "adminn.tradex@gmail.com",
        "smtp_password": "your-smtp-password",
        "gemini_api_key": "your-gemini-key",
        "openai_api_key": "your-openai-key"
    }

    # Ensure all default settings exist in the database
    for k, v in defaults.items():
        existing = db.query(SystemSetting).filter(SystemSetting.key == k).first()
        if not existing:
            setting = SystemSetting(key=k, value=v)
            db.add(setting)
    db.commit()

    # Query all settings
    all_settings = db.query(SystemSetting).all()
    
    settings_dict = {}
    for s in all_settings:
        val = s.value
        # Mask sensitive keys
        if s.key in ["smtp_password", "gemini_api_key", "openai_api_key"] and val:
            val = "********"
        settings_dict[s.key] = val

    return settings_dict


@router.post("/settings")
def update_settings(
    payload: dict,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.system_setting import SystemSetting, SettingHistory

    # Validate inputs
    trading_start = payload.get("trading_start_time", "").strip()
    trading_end = payload.get("trading_end_time", "").strip()
    
    if trading_start:
        try:
            datetime.strptime(trading_start, "%H:%M")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid trading start time format. Use HH:MM")

    if trading_end:
        try:
            datetime.strptime(trading_end, "%H:%M")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid trading end time format. Use HH:MM")

    otp_expiry = payload.get("otp_expiry_seconds")
    if otp_expiry is not None:
        try:
            val = int(otp_expiry)
            if val <= 0:
                raise ValueError()
        except ValueError:
            raise HTTPException(status_code=400, detail="OTP Expiry must be a positive integer in seconds")

    min_dep = payload.get("min_deposit_amount")
    if min_dep is not None:
        try:
            val = float(min_dep)
            if val < 0:
                raise ValueError()
        except ValueError:
            raise HTTPException(status_code=400, detail="Minimum Deposit must be a positive number")

    min_with = payload.get("min_withdrawal_amount")
    if min_with is not None:
        try:
            val = float(min_with)
            if val < 0:
                raise ValueError()
        except ValueError:
            raise HTTPException(status_code=400, detail="Minimum Withdrawal must be a positive number")

    smtp_port = payload.get("smtp_port")
    if smtp_port is not None:
        try:
            val = int(smtp_port)
            if val <= 0:
                raise ValueError()
        except ValueError:
            raise HTTPException(status_code=400, detail="SMTP Port must be a positive integer")

    maintenance_changed = False
    maintenance_is_on = False

    # Update settings
    for k, v in payload.items():
        if v is None:
            continue
            
        str_val = str(v).strip()
        
        # Skip updating if it is a masked value
        if k in ["smtp_password", "gemini_api_key", "openai_api_key"] and str_val == "********":
            continue

        setting = db.query(SystemSetting).filter(SystemSetting.key == k).first()
        if setting:
            old_val = setting.value
            if old_val != str_val:
                setting.value = str_val
                if k == "maintenance_mode":
                    maintenance_changed = True
                    maintenance_is_on = str_val.lower() == "true"
                
                # Log change in history
                history = SettingHistory(
                    setting_key=k,
                    old_value=old_val,
                    new_value=str_val,
                    changed_by=current_user.email
                )
                db.add(history)
        else:
            # Create new setting
            new_setting = SystemSetting(key=k, value=str_val)
            db.add(new_setting)
            if k == "maintenance_mode":
                maintenance_changed = True
                maintenance_is_on = str_val.lower() == "true"
            
            history = SettingHistory(
                setting_key=k,
                old_value=None,
                new_value=str_val,
                changed_by=current_user.email
            )
            db.add(history)

    db.commit()

    if maintenance_changed:
        try:
            from app.core.email import send_maintenance_mode_email
            send_maintenance_mode_email(maintenance_is_on)
        except Exception as e:
            print(f"Failed to send maintenance mode email: {e}")
    
    log_audit(db, current_user.id, "Update System Settings", "Updated application-wide configurations", request.client.host if (request and request.client) else None)

    return {"message": "System settings updated successfully"}


@router.get("/settings/history")
def get_settings_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.system_setting import SettingHistory

    history = db.query(SettingHistory).order_by(SettingHistory.changed_at.desc()).all()
    
    result = []
    for h in history:
        # Hide sensitive values in history
        old_val = h.old_value
        new_val = h.new_value
        if h.setting_key in ["smtp_password", "gemini_api_key", "openai_api_key"]:
            if old_val:
                old_val = "********"
            if new_val:
                new_val = "********"
                
        result.append({
            "id": h.id,
            "setting_key": h.setting_key,
            "old_value": old_val,
            "new_value": new_val,
            "changed_by": h.changed_by,
            "changed_at": h.changed_at.isoformat()
        })
        
    return result


@router.get("/analytics")
def get_analytics(
    time_filter: str = "this_month",
    start_date: str = None,
    end_date: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin or current_user.role not in ["Administrator", "Super Administrator"]:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    from app.models.user import User
    from app.models.deposit import Deposit
    from app.models.withdrawal import Withdrawal
    from app.models.trade import Trade
    from app.models.chat_history import ChatHistory
    from app.models.support import SupportTicket
    from sqlalchemy import func
    
    now = datetime.utcnow()
    
    if time_filter == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        group_by_hour = True
    elif time_filter == "this_week":
        start = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
        end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        group_by_hour = False
    elif time_filter == "this_month":
        start = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)
        end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        group_by_hour = False
    elif time_filter == "custom":
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="Start date and end date are required for custom filter")
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d").replace(hour=0, minute=0, second=0, microsecond=0)
            end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        if (end - start).days > 90:
            raise HTTPException(status_code=400, detail="Custom date range cannot exceed 90 days")
        group_by_hour = False
    else:
        raise HTTPException(status_code=400, detail="Invalid time filter")

    # Base user count before start date for User Growth
    base_user_count = db.query(User).filter(User.created_at < start).count()

    # Generate buckets
    buckets = []
    current = start
    if group_by_hour:
        while current <= end:
            buckets.append(current)
            current += timedelta(hours=1)
    else:
        while current.date() <= end.date():
            buckets.append(current.date())
            current += timedelta(days=1)

    bucket_map = {}
    for b in buckets:
        if group_by_hour:
            key = b.strftime("%H:00")
            label = b.strftime("%I %p")
        else:
            key = b.strftime("%Y-%m-%d")
            label = b.strftime("%b %d")
            
        bucket_map[key] = {
            "key": key,
            "label": label,
            "new_users": 0,
            "user_growth": 0,
            "deposits_amount": 0.0,
            "deposits_count": 0,
            "withdrawals_amount": 0.0,
            "withdrawals_count": 0,
            "trades_amount": 0.0,
            "trades_count": 0,
            "revenue": 0.0,
            "ai_requests": 0,
            "support_tickets": 0,
            "details": {
                "users": [],
                "deposits": [],
                "withdrawals": [],
                "trades": [],
                "ai_requests": [],
                "support_tickets": []
            }
        }

    # Fetch data filtered by date range
    users_data = db.query(User).filter(User.created_at >= start, User.created_at <= end).all()
    deposits_data = db.query(Deposit).options(joinedload(Deposit.user)).filter(Deposit.created_at >= start, Deposit.created_at <= end).all()
    withdrawals_data = db.query(Withdrawal).options(joinedload(Withdrawal.user)).filter(Withdrawal.created_at >= start, Withdrawal.created_at <= end).all()
    trades_data = db.query(Trade).options(joinedload(Trade.user), joinedload(Trade.stock)).filter(Trade.created_at >= start, Trade.created_at <= end).all()
    ai_data = db.query(ChatHistory).options(joinedload(ChatHistory.user)).filter(ChatHistory.created_at >= start, ChatHistory.created_at <= end).all()
    tickets_data = db.query(SupportTicket).options(joinedload(SupportTicket.user)).filter(SupportTicket.created_at >= start, SupportTicket.created_at <= end).all()

    def get_bucket_key(dt):
        if group_by_hour:
            return dt.replace(minute=0, second=0, microsecond=0).strftime("%H:00")
        else:
            return dt.strftime("%Y-%m-%d")

    for u in users_data:
        k = get_bucket_key(u.created_at)
        if k in bucket_map:
            bucket_map[k]["new_users"] += 1
            bucket_map[k]["details"]["users"].append({
                "username": u.username,
                "email": u.email,
                "role": u.role,
                "created_at": u.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })

    for d in deposits_data:
        k = get_bucket_key(d.created_at)
        if k in bucket_map:
            if d.status == "Approved":
                bucket_map[k]["deposits_amount"] += d.amount
            bucket_map[k]["deposits_count"] += 1
            bucket_map[k]["details"]["deposits"].append({
                "amount": d.amount,
                "status": d.status,
                "payment_type": d.payment_type,
                "user_email": d.user.email if d.user else "Unknown",
                "created_at": d.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })

    for w in withdrawals_data:
        k = get_bucket_key(w.created_at)
        if k in bucket_map:
            if w.status == "Approved":
                bucket_map[k]["withdrawals_amount"] += w.amount
            bucket_map[k]["withdrawals_count"] += 1
            bucket_map[k]["details"]["withdrawals"].append({
                "amount": w.amount,
                "status": w.status,
                "user_email": w.user.email if w.user else "Unknown",
                "created_at": w.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })

    for t in trades_data:
        k = get_bucket_key(t.created_at)
        if k in bucket_map:
            val = t.price * t.quantity
            bucket_map[k]["trades_amount"] += val
            bucket_map[k]["trades_count"] += 1
            bucket_map[k]["details"]["trades"].append({
                "trade_type": t.trade_type,
                "quantity": t.quantity,
                "price": t.price,
                "stock_symbol": t.stock.symbol if t.stock else "Unknown",
                "user_email": t.user.email if t.user else "Unknown",
                "created_at": t.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })

    for c in ai_data:
        k = get_bucket_key(c.created_at)
        if k in bucket_map:
            bucket_map[k]["ai_requests"] += 1
            bucket_map[k]["details"]["ai_requests"].append({
                "user_email": c.user.email if c.user else "Unknown",
                "question": c.question[:100] + "..." if len(c.question) > 100 else c.question,
                "created_at": c.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })

    for s in tickets_data:
        k = get_bucket_key(s.created_at)
        if k in bucket_map:
            bucket_map[k]["support_tickets"] += 1
            bucket_map[k]["details"]["support_tickets"].append({
                "ticket_number": s.ticket_number,
                "issue_type": s.issue_type,
                "status": s.status,
                "user_email": s.user.email if s.user else "Unknown",
                "created_at": s.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })

    sorted_keys = sorted(bucket_map.keys())
    chart_list = []
    current_growth = base_user_count

    for key in sorted_keys:
        bucket = bucket_map[key]
        current_growth += bucket["new_users"]
        bucket["user_growth"] = current_growth
        bucket["revenue"] = (bucket["trades_amount"] * 0.001) + (bucket["deposits_amount"] * 0.005)
        chart_list.append(bucket)

    # General totals
    total_users_all = db.query(User).count()
    total_trades_all = db.query(Trade).count()
    total_ai_requests_all = db.query(ChatHistory).count()
    total_support_tickets_all = db.query(SupportTicket).count()
    total_deposits_amount_all = db.query(func.sum(Deposit.amount)).filter(Deposit.status == "Approved").scalar() or 0.0
    total_withdrawals_amount_all = db.query(func.sum(Withdrawal.amount)).filter(Withdrawal.status == "Approved").scalar() or 0.0
    total_trades_volume_all = db.query(func.sum(Trade.price * Trade.quantity)).scalar() or 0.0
    total_revenue_all = (total_trades_volume_all * 0.001) + (total_deposits_amount_all * 0.005)

    return {
        "summary": {
            "total_users": total_users_all,
            "total_revenue": total_revenue_all,
            "total_trades": total_trades_all,
            "total_deposits": total_deposits_amount_all,
            "total_withdrawals": total_withdrawals_amount_all,
            "total_ai_requests": total_ai_requests_all,
            "total_support_tickets": total_support_tickets_all
        },
        "charts": chart_list
    }


@router.get("/audit-logs")
def get_audit_logs(
    search: str = None,
    start_date: str = None,
    end_date: str = None,
    admin_id: int = None,
    module: str = None,
    action: str = None,
    status: str = None,
    sort: str = "newest",
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.audit_log import AdminAuditLog
    from app.models.user import User as DBUser
    from sqlalchemy.orm import joinedload
    
    query = db.query(AdminAuditLog).join(DBUser, AdminAuditLog.admin_id == DBUser.id)

    if not start_date and not end_date:
        limit = 5

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (DBUser.username.ilike(search_filter)) |
            (DBUser.email.ilike(search_filter)) |
            (AdminAuditLog.action.ilike(search_filter)) |
            (AdminAuditLog.details.ilike(search_filter))
        )

    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
            query = query.filter(AdminAuditLog.timestamp >= start_dt)
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
            query = query.filter(AdminAuditLog.timestamp <= end_dt)
        except ValueError:
            pass

    if admin_id:
        query = query.filter(AdminAuditLog.admin_id == admin_id)
    if module:
        query = query.filter(AdminAuditLog.module == module)
    if action:
        query = query.filter(AdminAuditLog.action == action)
    if status:
        query = query.filter(AdminAuditLog.status == status)

    if sort == "oldest":
        query = query.order_by(AdminAuditLog.timestamp.asc())
    else:
        query = query.order_by(AdminAuditLog.timestamp.desc())

    total_count = query.count()
    if not start_date and not end_date:
        total_count = min(total_count, 5)
    offset = (page - 1) * limit
    logs = query.options(joinedload(AdminAuditLog.admin)).offset(offset).limit(limit).all()

    admins_with_logs = db.query(DBUser.id, DBUser.username, DBUser.email).filter(DBUser.is_admin == True).all()
    
    distinct_modules = [
        "Deposits", "Withdrawals", "User Management", "Admin Management",
        "Stock Management", "System Settings", "Support", "Reports",
        "Maintenance", "Authentication", "Other"
    ]

    distinct_actions = [
        "Administrator Login", "Administrator Logout", "Approve Deposit",
        "Reject Deposit", "Approve Withdrawal", "Reject Withdrawal",
        "Update User Profile", "Toggle User Status", "Delete User",
        "Send Reset Password OTP", "Reset Password", "Force Logout User",
        "Change Permissions", "Toggle Admin Status", "Delete Admin",
        "Add Stock", "Update Stock", "Delete Stock", "Update System Settings",
        "Deactivate Maintenance Mode", "Generate Report", "Export Report"
    ]

    distinct_statuses = ["Success", "Failed"]


    return {
        "logs": [
            {
                "id": log.id,
                "admin_id": log.admin_id,
                "admin_name": log.admin.username if log.admin else "Unknown",
                "admin_email": log.admin.email if log.admin else "Unknown",
                "action": log.action,
                "module": log.module or "Other",
                "details": log.details,
                "ip_address": log.ip_address,
                "device_browser": log.device_browser or "Unknown",
                "status": log.status or "Success",
                "timestamp": log.timestamp.isoformat() if log.timestamp else None
            }
            for log in logs
        ],
        "total_count": total_count,
        "page": page,
        "limit": limit,
        "filters": {
            "admins": [{"id": a[0], "username": a[1], "email": a[2]} for a in admins_with_logs],
            "modules": distinct_modules,
            "actions": distinct_actions,
            "statuses": distinct_statuses
        }
    }


@router.post("/audit-logs/export")
def export_audit_logs(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.models.audit_log import AdminAuditLog
    from app.models.user import User as DBUser
    from fastapi.responses import StreamingResponse
    import io
    import csv

    export_format = payload.get("format", "csv").lower()
    search = payload.get("search")
    start_date = payload.get("start_date")
    end_date = payload.get("end_date")
    admin_id = payload.get("admin_id")
    module = payload.get("module")
    action = payload.get("action")
    status = payload.get("status")
    sort = payload.get("sort", "newest")

    query = db.query(AdminAuditLog).join(DBUser, AdminAuditLog.admin_id == DBUser.id)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (DBUser.username.ilike(search_filter)) |
            (DBUser.email.ilike(search_filter)) |
            (AdminAuditLog.action.ilike(search_filter)) |
            (AdminAuditLog.details.ilike(search_filter))
        )

    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
            query = query.filter(AdminAuditLog.timestamp >= start_dt)
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
            query = query.filter(AdminAuditLog.timestamp <= end_dt)
        except ValueError:
            pass
    if admin_id:
        query = query.filter(AdminAuditLog.admin_id == admin_id)
    if module:
        query = query.filter(AdminAuditLog.module == module)
    if action:
        query = query.filter(AdminAuditLog.action == action)
    if status:
        query = query.filter(AdminAuditLog.status == status)

    if sort == "oldest":
        query = query.order_by(AdminAuditLog.timestamp.asc())
    else:
        query = query.order_by(AdminAuditLog.timestamp.desc())

    if not start_date and not end_date:
        query = query.limit(5)

    logs = query.all()

    filename = f"audit_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

    header = ["ID", "Timestamp", "Admin Name", "Admin Email", "Action", "Module", "Description", "IP Address", "Device/Browser", "Status"]
    rows = []
    for log in logs:
        rows.append([
            str(log.id),
            log.timestamp.strftime("%Y-%m-%d %H:%M:%S") if log.timestamp else "",
            log.admin.username if log.admin else "Unknown",
            log.admin.email if log.admin else "Unknown",
            log.action,
            log.module or "Other",
            log.details or "",
            log.ip_address or "",
            log.device_browser or "Unknown",
            log.status or "Success"
        ])

    if export_format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(header)
        writer.writerows(rows)
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}.csv"}
        )

    elif export_format == "excel":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(header)
        writer.writerows(rows)
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="application/vnd.ms-excel",
            headers={"Content-Disposition": f"attachment; filename={filename}.xls"}
        )

    elif export_format == "pdf":
        formatted_rows = []
        for r in rows:
            formatted_rows.append(f"[{r[1]}] {r[2]} ({r[3]}) - {r[4]} | Module: {r[5]} | IP: {r[7]} | Status: {r[9]}\nDetails: {r[6]}\n")
        pdf_bytes = generate_pdf("TradeX Admin Audit Logs", formatted_rows)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}.pdf"}
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid format")


import threading
from fastapi import UploadFile, File
backup_lock = threading.Lock()


@router.get("/backups")
def get_backups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    import os
    import json
    
    backup_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "backups")
    os.makedirs(backup_dir, exist_ok=True)
    metadata_path = os.path.join(backup_dir, "metadata.json")
    
    if os.path.exists(metadata_path):
        try:
            with open(metadata_path, "r") as f:
                history = json.load(f)
        except Exception:
            history = []
    else:
        history = []
        
    valid_history = []
    for item in history:
        file_path = os.path.join(backup_dir, item["filename"])
        if os.path.exists(file_path):
            valid_history.append(item)
            
    last_backup = None
    if valid_history:
        sorted_history = sorted(valid_history, key=lambda x: x["created_at"], reverse=True)
        last_backup = sorted_history[0]["created_at"]
        
    return {
        "history": valid_history,
        "last_backup": last_backup
    }


@router.post("/backups")
def create_backup(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    if not backup_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Another backup or restore operation is already in progress.")
        
    try:
        import os
        import json
        import datetime
        from sqlalchemy import inspect, text
        from app.core.database import engine
        
        backup_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "backups")
        os.makedirs(backup_dir, exist_ok=True)
        
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"TradeX_Backup_{timestamp}.sql"
        file_path = os.path.join(backup_dir, filename)
        
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        sql_lines = []
        sql_lines.append("-- TradeX Database Backup")
        sql_lines.append(f"-- Created: {datetime.datetime.utcnow().isoformat()}")
        sql_lines.append(f"-- Created By: {current_user.username}")
        sql_lines.append("--\n")
        
        sql_lines.append("SET session_replication_role = 'replica';")
        
        for table in tables:
            if table in ("spatial_ref_sys", "alembic_version"):
                continue
            sql_lines.append(f"TRUNCATE TABLE \"{table}\" CASCADE;")
            
        sql_lines.append("\n")
        
        with engine.connect() as connection:
            for table in tables:
                if table in ("spatial_ref_sys", "alembic_version"):
                    continue
                    
                columns = [col["name"] for col in inspector.get_columns(table)]
                col_str = ", ".join([f'"{c}"' for c in columns])
                
                result = connection.execute(text(f'SELECT * FROM "{table}"'))
                rows = result.fetchall()
                
                if not rows:
                    continue
                    
                sql_lines.append(f"-- Data for table: {table}")
                for row in rows:
                    val_list = []
                    for val in row:
                        if val is None:
                            val_list.append("NULL")
                        elif isinstance(val, (int, float)):
                            val_list.append(str(val))
                        elif isinstance(val, bool):
                            val_list.append("TRUE" if val else "FALSE")
                        elif isinstance(val, (datetime.datetime, datetime.date)):
                            val_list.append(f"'{val.isoformat()}'")
                        else:
                            escaped = str(val).replace("'", "''")
                            val_list.append(f"'{escaped}'")
                    val_str = ", ".join(val_list)
                    sql_lines.append(f'INSERT INTO "{table}" ({col_str}) VALUES ({val_str});')
                sql_lines.append("\n")
                
        sql_lines.append("SET session_replication_role = 'origin';")
        sql_content = "\n".join(sql_lines)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(sql_content)
            
        size_bytes = os.path.getsize(file_path)
        
        metadata_path = os.path.join(backup_dir, "metadata.json")
        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, "r") as f:
                    history = json.load(f)
            except Exception:
                history = []
        else:
            history = []
            
        new_backup = {
            "filename": filename,
            "size_bytes": size_bytes,
            "created_by": current_user.username,
            "created_at": datetime.datetime.now().isoformat()
        }
        history.append(new_backup)
        
        with open(metadata_path, "w") as f:
            json.dump(history, f, indent=2)
            
        log_audit(db, current_user.id, "Create Backup", f"Generated backup file: {filename}", None)
        
        return new_backup
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")
    finally:
        backup_lock.release()


@router.get("/backups/{filename}")
def download_backup(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    import os
    from fastapi.responses import FileResponse
    
    backup_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "backups")
    file_path = os.path.join(backup_dir, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Backup file not found")
        
    return FileResponse(
        file_path,
        media_type="application/octet-stream",
        filename=filename
    )


@router.delete("/backups/{filename}")
def delete_backup(
    filename: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    import os
    import json
    
    backup_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "backups")
    file_path = os.path.join(backup_dir, filename)
    
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")
            
    metadata_path = os.path.join(backup_dir, "metadata.json")
    if os.path.exists(metadata_path):
        try:
            with open(metadata_path, "r") as f:
                history = json.load(f)
            history = [item for item in history if item["filename"] != filename]
            with open(metadata_path, "w") as f:
                json.dump(history, f, indent=2)
        except Exception:
            pass
            
    log_audit(db, current_user.id, "Delete Backup", f"Deleted backup file: {filename}", None)
    return {"message": "Backup deleted successfully"}


@router.post("/backups/restore")
def restore_backup(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    if not backup_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Another backup or restore operation is already in progress.")
        
    try:
        from app.core.database import engine
        from sqlalchemy import text
        
        contents = file.file.read().decode("utf-8")
        
        if not contents.startswith("-- TradeX Database Backup"):
            raise HTTPException(status_code=400, detail="Invalid backup file format. Must be a valid TradeX SQL backup.")
            
        with engine.begin() as connection:
            connection.execute(text(contents))
            
        log_audit(db, current_user.id, "Restore Database", f"Restored database from uploaded backup: {file.filename}", None)
        return {"message": "Database restored successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")
    finally:
        backup_lock.release()


@router.post("/upload")
def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    import os
    import shutil
    import uuid
    
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
        
    os.makedirs("static/uploads", exist_ok=True)
    
    file_ext = os.path.splitext(file.filename)[1]
    new_filename = f"{uuid.uuid4()}{file_ext}"
    dest_path = os.path.join("static/uploads", new_filename)
    
    try:
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        image_url = f"/static/uploads/{new_filename}"
        return {"image_url": image_url}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")


# ==========================================
# Banners & Market Holidays Management
# ==========================================

from app.models.banner import Banner
from app.models.holiday import MarketHoliday
from pydantic import BaseModel
from datetime import datetime


class BannerCreate(BaseModel):
    title: str
    description: str
    image_url: str
    button_text: str = None
    button_url: str = None
    banner_type: str
    start_date: datetime
    end_date: datetime
    priority: int = 0
    is_active: bool = True


class HolidayCreate(BaseModel):
    name: str
    date: datetime
    holiday_type: str
    market_status: str
    start_time: str | None = None
    end_time: str | None = None
    description: str | None = None
    image_url: str | None = None
    is_active: bool = True


# --- Banners Management ---

@router.get("/banners")
def list_banners(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    banners = db.query(Banner).order_by(Banner.priority.desc(), Banner.created_at.desc()).all()
    return banners


@router.post("/banners")
def create_banner(
    payload: BannerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    banner = Banner(
        title=payload.title,
        description=payload.description,
        image_url=payload.image_url,
        button_text=payload.button_text,
        button_url=payload.button_url,
        banner_type=payload.banner_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        priority=payload.priority,
        is_active=payload.is_active
    )
    db.add(banner)
    db.commit()
    db.refresh(banner)
    
    log_audit(db, current_user.id, "Add Banner", f"Added banner: {banner.title} (Type: {banner.banner_type})", None)
    return banner


@router.put("/banners/{banner_id}")
def update_banner(
    banner_id: int,
    payload: BannerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    banner = db.query(Banner).filter(Banner.id == banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")
        
    banner.title = payload.title
    banner.description = payload.description
    banner.image_url = payload.image_url
    banner.button_text = payload.button_text
    banner.button_url = payload.button_url
    banner.banner_type = payload.banner_type
    banner.start_date = payload.start_date
    banner.end_date = payload.end_date
    banner.priority = payload.priority
    banner.is_active = payload.is_active
    
    db.commit()
    db.refresh(banner)
    
    log_audit(db, current_user.id, "Edit Banner", f"Updated banner: {banner.title}", None)
    return banner


@router.delete("/banners/{banner_id}")
def delete_banner(
    banner_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    banner = db.query(Banner).filter(Banner.id == banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")
        
    banner_title = banner.title
    db.delete(banner)
    db.commit()
    
    log_audit(db, current_user.id, "Delete Banner", f"Deleted banner: {banner_title}", None)
    return {"message": "Banner deleted successfully"}


@router.patch("/banners/{banner_id}/toggle")
def toggle_banner(
    banner_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    banner = db.query(Banner).filter(Banner.id == banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")
        
    banner.is_active = not banner.is_active
    db.commit()
    db.refresh(banner)
    
    action_str = "Enabled" if banner.is_active else "Disabled"
    log_audit(db, current_user.id, "Toggle Banner Status", f"{action_str} banner: {banner.title}", None)
    return banner


@router.get("/banners/active")
def get_active_banners(db: Session = Depends(get_db)):
    import datetime
    from app.models.holiday import MarketHoliday
    
    now = datetime.datetime.now()
    today_start = datetime.datetime(now.year, now.month, now.day)
    today_end = today_start + datetime.timedelta(days=1)
    
    active_banners = (
        db.query(Banner)
        .filter(Banner.is_active == True)
        .filter(Banner.start_date <= now)
        .filter(Banner.end_date >= now)
        .order_by(Banner.priority.desc())
        .all()
    )
    
    # Check if there is an active holiday today
    holiday = (
        db.query(MarketHoliday)
        .filter(MarketHoliday.is_active == True)
        .filter(MarketHoliday.date >= today_start)
        .filter(MarketHoliday.date < today_end)
        .first()
    )
    
    holiday_banner = None
    if holiday:
        holiday_img = holiday.image_url or "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&auto=format&fit=crop&q=60"
        
        if holiday.market_status == "Closed":
            holiday_banner = {
                "id": -holiday.id,
                "title": f"Market Closed: {holiday.name}",
                "description": f"Trading is disabled today due to the {holiday.name} market holiday. {holiday.description or ''}",
                "image_url": holiday_img,
                "banner_type": "Holiday",
                "button_text": None,
                "button_url": None,
                "priority": 9999,
                "is_active": True
            }
        elif holiday.market_status == "Muhurat Trading":
            current_time_str = now.strftime("%H:%M")
            start = holiday.start_time or "00:00"
            end = holiday.end_time or "00:00"
            if not (start <= current_time_str <= end):
                holiday_banner = {
                    "id": -holiday.id,
                    "title": f"Market Closed: {holiday.name}",
                    "description": f"Trading is disabled today. Muhurat Trading is only available from {start} to {end} today.",
                    "image_url": holiday_img,
                    "banner_type": "Holiday",
                    "button_text": None,
                    "button_url": None,
                    "priority": 9999,
                    "is_active": True
                }
            else:
                holiday_banner = {
                    "id": -holiday.id,
                    "title": f"Muhurat Trading Active: {holiday.name}",
                    "description": f"Special Muhurat Trading session is open today from {start} to {end}. {holiday.description or ''}",
                    "image_url": holiday_img,
                    "banner_type": "Holiday",
                    "button_text": None,
                    "button_url": None,
                    "priority": 9999,
                    "is_active": True
                }
                
    # Convert SQLAlchemy objects to dicts so they can be mixed with the holiday banner dict
    banners_list = []
    if holiday_banner:
        banners_list.append(holiday_banner)
        
    for b in active_banners:
        banners_list.append({
            "id": b.id,
            "title": b.title,
            "description": b.description,
            "image_url": b.image_url,
            "banner_type": b.banner_type,
            "button_text": b.button_text,
            "button_url": b.button_url,
            "priority": b.priority,
            "is_active": b.is_active
        })
        
    return banners_list


# --- Market Holidays Management ---

@router.get("/holidays")
def list_holidays(
    search: str = None,
    year: int = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    query = db.query(MarketHoliday)
    
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (MarketHoliday.name.ilike(search_filter)) |
            (MarketHoliday.description.ilike(search_filter))
        )
        
    if year:
        # Filter dates by year
        start_year = datetime(year, 1, 1)
        end_year = datetime(year, 12, 31, 23, 59, 59)
        query = query.filter(MarketHoliday.date >= start_year).filter(MarketHoliday.date <= end_year)
        
    holidays = query.order_by(MarketHoliday.date.asc()).all()
    return holidays


@router.post("/holidays")
def create_holiday(
    payload: HolidayCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    existing = db.query(MarketHoliday).filter(MarketHoliday.date == payload.date).first()
    if existing:
        raise HTTPException(status_code=400, detail="A holiday is already registered for this date.")
        
    holiday = MarketHoliday(
        name=payload.name,
        date=payload.date,
        holiday_type=payload.holiday_type,
        market_status=payload.market_status,
        start_time=payload.start_time,
        end_time=payload.end_time,
        description=payload.description,
        image_url=payload.image_url,
        is_active=payload.is_active
    )
    db.add(holiday)
    db.commit()
    db.refresh(holiday)
    
    log_audit(db, current_user.id, "Add Holiday", f"Added holiday: {holiday.name} (Date: {holiday.date.strftime('%Y-%m-%d')})", None)
    return holiday


@router.put("/holidays/{holiday_id}")
def update_holiday(
    holiday_id: int,
    payload: HolidayCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    holiday = db.query(MarketHoliday).filter(MarketHoliday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
        
    existing = db.query(MarketHoliday).filter(MarketHoliday.date == payload.date).filter(MarketHoliday.id != holiday_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="A holiday is already registered for this date.")
        
    holiday.name = payload.name
    holiday.date = payload.date
    holiday.holiday_type = payload.holiday_type
    holiday.market_status = payload.market_status
    holiday.start_time = payload.start_time
    holiday.end_time = payload.end_time
    holiday.description = payload.description
    holiday.image_url = payload.image_url
    holiday.is_active = payload.is_active
    
    db.commit()
    db.refresh(holiday)
    
    log_audit(db, current_user.id, "Edit Holiday", f"Updated holiday: {holiday.name}", None)
    return holiday


@router.delete("/holidays/{holiday_id}")
def delete_holiday(
    holiday_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    holiday = db.query(MarketHoliday).filter(MarketHoliday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
        
    holiday_name = holiday.name
    db.delete(holiday)
    db.commit()
    
    log_audit(db, current_user.id, "Delete Holiday", f"Deleted holiday: {holiday_name}", None)
    return {"message": "Holiday deleted successfully"}


@router.patch("/holidays/{holiday_id}/toggle")
def toggle_holiday(
    holiday_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    holiday = db.query(MarketHoliday).filter(MarketHoliday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
        
    holiday.is_active = not holiday.is_active
    db.commit()
    db.refresh(holiday)
    
    action_str = "Enabled" if holiday.is_active else "Disabled"
    log_audit(db, current_user.id, "Toggle Holiday Status", f"{action_str} holiday: {holiday.name}", None)
    return holiday


@router.get("/holidays/upcoming")
def get_upcoming_holidays(
    search: str = None,
    year: int = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    import datetime
    now = datetime.datetime.now()
    today_start = datetime.datetime(now.year, now.month, now.day)
    
    query = db.query(MarketHoliday).filter(MarketHoliday.is_active == True)
    
    # Apply search filter if present
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (MarketHoliday.name.ilike(search_filter)) |
            (MarketHoliday.description.ilike(search_filter))
        )
        
    if year:
        start_year = datetime.datetime(year, 1, 1)
        end_year = datetime.datetime(year, 12, 31, 23, 59, 59)
        # Fetch this year's holidays
        this_year_holidays = (
            query.filter(MarketHoliday.date >= start_year)
            .filter(MarketHoliday.date <= end_year)
            .order_by(MarketHoliday.date.asc())
            .all()
        )
        
        # If less than 5 holidays are found, fill from subsequent years
        if len(this_year_holidays) >= 5:
            upcoming = this_year_holidays
        else:
            needed = 5 - len(this_year_holidays)
            next_holidays = (
                query.filter(MarketHoliday.date > end_year)
                .order_by(MarketHoliday.date.asc())
                .limit(needed)
                .all()
            )
            upcoming = this_year_holidays + next_holidays
    else:
        # Default upcoming view: date >= today_start
        upcoming = (
            query.filter(MarketHoliday.date >= today_start)
            .order_by(MarketHoliday.date.asc())
            .limit(5)
            .all()
        )
        
        # If less than 5 upcoming holidays exist in total database, fill with past holidays
        if len(upcoming) < 5:
            needed = 5 - len(upcoming)
            past_holidays = (
                query.filter(MarketHoliday.date < today_start)
                .order_by(MarketHoliday.date.desc())
                .limit(needed)
                .all()
            )
            upcoming = list(reversed(past_holidays)) + upcoming
            
    return upcoming


@router.get("/settings/background")
def get_background(db: Session = Depends(get_db)):
    from app.models.system_setting import SystemSetting
    app_bg = db.query(SystemSetting).filter(SystemSetting.key == "app_background_image").first()
    login_bg = db.query(SystemSetting).filter(SystemSetting.key == "login_background_image").first()
    return {
        "app_background_image": app_bg.value if app_bg else None,
        "login_background_image": login_bg.value if login_bg else None
    }


@router.post("/settings/background")
def update_background(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.system_setting import SystemSetting
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    app_bg_val = payload.get("app_background_image")
    login_bg_val = payload.get("login_background_image")
    
    if "app_background_image" in payload:
        setting = db.query(SystemSetting).filter(SystemSetting.key == "app_background_image").first()
        if not setting:
            setting = SystemSetting(key="app_background_image", value=app_bg_val or "")
            db.add(setting)
        else:
            setting.value = app_bg_val or ""
            
    if "login_background_image" in payload:
        setting = db.query(SystemSetting).filter(SystemSetting.key == "login_background_image").first()
        if not setting:
            setting = SystemSetting(key="login_background_image", value=login_bg_val or "")
            db.add(setting)
        else:
            setting.value = login_bg_val or ""
        
    db.commit()
    return {"message": "Background images updated successfully"}
