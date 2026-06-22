from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.core.security import get_current_user
from app.models.price_alert import PriceAlert
from app.models.stock import Stock
from app.models.user import User
from app.schemas.price_alert import PriceAlertCreate, PriceAlertResponse, PriceAlertUpdate


router = APIRouter(prefix="/alerts", tags=["Price Alerts"])


def normalize_symbol(symbol: str):
    return symbol.strip().upper()


def get_user_alert(db: Session, alert_id: int, user_id: int):
    alert = (
        db.query(PriceAlert)
        .filter(
            PriceAlert.id == alert_id,
            PriceAlert.user_id == user_id,
        )
        .first()
    )

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    return alert


def ensure_stock_exists(db: Session, symbol: str):
    stock = db.query(Stock).filter(Stock.symbol == symbol).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")


@router.post("/", response_model=PriceAlertResponse)
def create_alert(
    payload: PriceAlertCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    symbol = normalize_symbol(payload.symbol)
    ensure_stock_exists(db, symbol)

    alert = PriceAlert(
        user_id=current_user.id,
        symbol=symbol,
        condition_type=payload.condition_type,
        target_price=payload.target_price,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.get("/", response_model=List[PriceAlertResponse])
def get_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(PriceAlert)
        .filter(PriceAlert.user_id == current_user.id)
        .order_by(PriceAlert.created_at.desc())
        .all()
    )


@router.get("/history", response_model=List[PriceAlertResponse])
def get_alert_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(PriceAlert)
        .filter(
            PriceAlert.user_id == current_user.id,
            PriceAlert.triggered == True,
        )
        .order_by(PriceAlert.triggered_at.desc())
        .all()
    )


@router.put("/{alert_id}", response_model=PriceAlertResponse)
def update_alert(
    alert_id: int,
    payload: PriceAlertUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = get_user_alert(db, alert_id, current_user.id)

    if payload.symbol is not None:
        symbol = normalize_symbol(payload.symbol)
        ensure_stock_exists(db, symbol)
        alert.symbol = symbol
    if payload.condition_type is not None:
        alert.condition_type = payload.condition_type
    if payload.target_price is not None:
        alert.target_price = payload.target_price
    if payload.is_active is not None:
        alert.is_active = payload.is_active
        if payload.is_active:
            alert.triggered = False
            alert.triggered_at = None

    db.commit()
    db.refresh(alert)
    return alert


@router.delete("/{alert_id}")
def delete_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = get_user_alert(db, alert_id, current_user.id)
    db.delete(alert)
    db.commit()
    return {"message": "Alert deleted"}
