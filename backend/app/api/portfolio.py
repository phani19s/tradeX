from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from datetime import datetime
import logging

from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_db
from app.models.portfolio import Portfolio 
from app.models.deposit import Deposit

from app.models.trade import Trade
from app.models.stock import Stock
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.portfolio import DepositRequest
from app.core.email import send_deposit_request_email

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/portfolio",
    tags=["Portfolio"]
)


@router.post("/deposit")
def deposit_money(
    payload: DepositRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if payload.amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Deposit amount must be greater than zero"
        )

    target_user = current_user

    if payload.target_email:
        if not current_user.is_admin:
            raise HTTPException(
                status_code=403,
                detail="Only admin can add money to another account"
            )

        target_user = (
            db.query(User)
            .filter(User.email == payload.target_email)
            .first()
        )

        if not target_user:
            raise HTTPException(
                status_code=404,
                detail="Target account not found"
            )

    if current_user.is_admin and payload.target_email and not payload.utr_number:
        portfolio = (
            db.query(Portfolio)
            .filter(Portfolio.user_id == target_user.id)
            .first()
        )

        if not portfolio:
            portfolio = Portfolio(user_id=target_user.id, balance=0)
            db.add(portfolio)
            db.commit()
            db.refresh(portfolio)

        portfolio.balance += payload.amount

        deposit = Deposit(
            user_id=target_user.id,
            created_by_id=current_user.id,
            amount=payload.amount,
            payment_type="UPI",
            status="Approved",
            verified_by_id=current_user.id,
            verified_at=datetime.utcnow()
        )

        db.add(deposit)
        db.commit()
        db.refresh(portfolio)

        return {
            "message": "Money added successfully",
            "balance": portfolio.balance,
            "status": "Approved"
        }

    if not payload.utr_number:
        raise HTTPException(
            status_code=400,
            detail="UTR number is required for deposit requests"
        )

    deposit = Deposit(
        user_id=target_user.id,
        created_by_id=current_user.id,
        amount=payload.amount,
        payment_type="UPI",
        utr_number=payload.utr_number,
        status="Pending"
    )

    db.add(deposit)
    db.commit()
    db.refresh(deposit)

    try:
        send_deposit_request_email(
            current_user.email,
            payload.amount,
            payload.utr_number,
            deposit.id
        )
        email_sent = True
        email_error = None
    except Exception as exc:
        email_sent = False
        email_error = str(exc)
        logger.exception(
            "Failed to send deposit verification email for deposit_id=%s",
            deposit.id
        )

    return {
        "message": "Deposit request submitted for verification",
        "status": "Pending",
        "deposit_id": deposit.id,
        "email_sent": email_sent,
        "email_error": email_error,
    }


@router.get("/deposits")
def deposit_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    query = db.query(Deposit).options(
        joinedload(Deposit.user),
        joinedload(Deposit.created_by),
        joinedload(Deposit.verified_by)
    )

    if not current_user.is_admin:
        query = query.filter(Deposit.user_id == current_user.id)

    deposits = query.order_by(Deposit.created_at.desc()).all()

    history = []

    for deposit in deposits:
        history.append(
            {
                "id": deposit.id,
                "amount": deposit.amount,
                "payment_type": deposit.payment_type,
                "utr_number": deposit.utr_number,
                "status": deposit.status,
                "created_at": deposit.created_at.isoformat(),
                "verified_at": deposit.verified_at.isoformat() if deposit.verified_at else None,
                "target_email": deposit.user.email if deposit.user else None,
                "created_by_email": deposit.created_by.email if deposit.created_by else None,
                "verified_by_email": deposit.verified_by.email if deposit.verified_by else None,
            }
        )

    return history


@router.get("/")
def get_portfolio(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):  

    user_id = current_user.id

    portfolio = (
        db.query(Portfolio)
        .filter(
            Portfolio.user_id == user_id
        )
        .first()
    )

    if not portfolio:
        portfolio = Portfolio(user_id=user_id, balance=0)
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)

    return {
        "user_id": user_id,
        "balance": portfolio.balance
    }
@router.get("/summary")
def portfolio_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    user_id = current_user.id

    portfolio = (
        db.query(Portfolio)
        .filter(
            Portfolio.user_id == user_id
        )
        .first()
    )

    trades = (
        db.query(Trade)
        .options(joinedload(Trade.stock))
        .filter(
            Trade.user_id == user_id
        )
        .all()
    )

    holdings = {}

    for trade in trades:
        stock = trade.stock
        if not stock:
            continue

        if stock.symbol not in holdings:
            holdings[stock.symbol] = {
                "quantity": 0,
                "price": stock.current_price
            }

        if trade.trade_type == "BUY":
            holdings[stock.symbol]["quantity"] += trade.quantity

        elif trade.trade_type == "SELL":
            holdings[stock.symbol]["quantity"] -= trade.quantity

    invested_amount = 0

    for symbol, data in holdings.items():

        # Ensure quantity is not negative
        safe_quantity = max(0, data["quantity"])
        
        invested_amount += (
            safe_quantity
            * data["price"]
        )
    approved_deposits = (
        db.query(Deposit)
        .filter(
            Deposit.user_id == user_id,
            Deposit.status == "Approved"
        )
        .all()
    )
    
    total_deposited = sum(
        deposit.amount
        for deposit in approved_deposits
    )

    from app.models.withdrawal import Withdrawal
    approved_withdrawals = (
        db.query(Withdrawal)
        .filter(
            Withdrawal.user_id == user_id,
            Withdrawal.status == "Approved"
        )
        .all()
    )

    total_withdrawn = sum(
        w.amount
        for w in approved_withdrawals
    )
    
    portfolio_value = (
        portfolio.balance
        + invested_amount
    )
    
    profit = (
        portfolio_value
        + total_withdrawn
        - total_deposited
    )

    return {
        "cash_balance": portfolio.balance,
        "invested_amount": invested_amount,
        "total_portfolio_value": portfolio_value,
        "total_deposited": total_deposited,
        "total_withdrawn": total_withdrawn,
        "profit": profit
    }


@router.put("/change-password")
def change_password(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Implementation for changing password
    pass
