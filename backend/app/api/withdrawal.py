from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.dependencies import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.withdrawal import Withdrawal
from app.models.portfolio import Portfolio
from app.schemas.withdrawal import WithdrawalCreate, WithdrawalResponse
from app.core.email import send_withdrawal_approval_email, send_withdrawal_otp_email
from app.models.otp import OTPVerification
from app.core.otp import generate_otp
from datetime import datetime

router = APIRouter(
    prefix="/withdrawal",
    tags=["Withdrawal"]
)

@router.post("/send-otp")
def send_withdrawal_otp(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    otp = generate_otp()
    otp_record = OTPVerification(
        email=current_user.email,
        otp=otp
    )
    db.add(otp_record)
    db.commit()
    
    send_withdrawal_otp_email(current_user.email, otp)
    return {"message": "OTP sent to your email"}

@router.post("/", response_model=WithdrawalResponse)
def request_withdrawal(
    request: WithdrawalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify OTP
    otp_record = (
        db.query(OTPVerification)
        .filter(
            OTPVerification.email == current_user.email,
            OTPVerification.otp == request.otp
        )
        .order_by(OTPVerification.id.desc())
        .first()
    )

    if not otp_record or (otp_record.expires_at < datetime.utcnow()):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    has_bank = bool(current_user.account_number and current_user.ifsc_code)
    has_upi = bool(current_user.upi_id)

    if not has_bank and not has_upi:
        raise HTTPException(status_code=400, detail="Please complete your Bank details or UPI ID in profile first")
    
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
    if not portfolio or portfolio.balance < request.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    portfolio.balance -= request.amount
    
    withdrawal = Withdrawal(
        user_id=current_user.id,
        amount=request.amount,
        account_holder_name=current_user.account_holder_name or current_user.username,
        account_number=current_user.account_number,
        ifsc_code=current_user.ifsc_code,
        bank_name=current_user.bank_name,
        upi_id=current_user.upi_id,
        status="Pending"
    )
    
    db.add(withdrawal)
    db.commit()
    db.refresh(withdrawal)

    # Delete OTP record after successful use
    db.delete(otp_record)
    db.commit()

    # Send notification email to admin
    try:
        bank_details = {
            "bank_name": withdrawal.bank_name,
            "account_holder_name": withdrawal.account_holder_name,
            "account_number": withdrawal.account_number,
            "ifsc_code": withdrawal.ifsc_code,
            "upi_id": current_user.upi_id
        }
        send_withdrawal_approval_email(
            current_user.email,
            withdrawal.amount,
            withdrawal.id,
            bank_details
        )
    except Exception as e:
        print(f"Failed to send withdrawal notification email: {e}")

    return withdrawal

@router.get("/history", response_model=List[WithdrawalResponse])
def get_withdrawal_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    withdrawals = db.query(Withdrawal).filter(Withdrawal.user_id == current_user.id).order_by(Withdrawal.created_at.desc()).all()
    return withdrawals
