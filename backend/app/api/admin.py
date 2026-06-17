from typing import List
from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
# from fastapi.responses import RedirectResponse
from fastapi.responses import HTMLResponse

from datetime import datetime

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

router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)

FRONTEND_URL = os.getenv("TRADEX_FRONTEND_URL", "http://localhost:5173")


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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    users = (
        db.query(User, Portfolio)
        .outerjoin(Portfolio, Portfolio.user_id == User.id)
        .order_by(User.created_at.desc())
        .all()
    )

    return [
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "is_admin": user.is_admin,
            "balance": portfolio.balance if portfolio else 0,
            "created_at": user.created_at.isoformat()
        }
        for user, portfolio in users
    ]


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

    return {
        "message": "Deposit approved successfully",
        "balance": portfolio.balance
    }


@router.post("/deposits/{deposit_id}/reject")
def reject_deposit(
    deposit_id: int,
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

    return {
        "message": "Deposit rejected successfully"
    }


@router.post("/withdrawals/{withdrawal_id}/approve")
def approve_withdrawal(
    withdrawal_id: int,
    request: WithdrawalApproveRequest,
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
    
    try:
        send_withdrawal_processed_admin_notification(
            os.getenv("TRADEX_APPROVAL_EMAIL", "tradex.adminn@gmail.com"),
            withdrawal.id,
            withdrawal.user.email,
            withdrawal.amount
        )
    except Exception:
        pass

    return {"message": "Withdrawal approved successfully"}


@router.post("/withdrawals/{withdrawal_id}/reject")
def reject_withdrawal(
    withdrawal_id: int,
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
    
    try:
        send_withdrawal_rejected_email(
            os.getenv("TRADEX_APPROVAL_EMAIL", "tradex.adminn@gmail.com"),
            f"Admin (Withdrawal ID: {withdrawal.id})",
            withdrawal.amount
        )
    except Exception:
        pass

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

