from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.core.security import get_current_user

from app.models.user import User
from app.models.stock import Stock
from app.models.watchlist import Watchlist

from app.schemas.watchlist import (
    WatchlistCreate,
    WatchlistDelete
)


router = APIRouter(
    prefix="/watchlist",
    tags=["Watchlist"]
)

@router.post("/add")
def add_to_watchlist(
    watchlist: WatchlistCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    stock = (
        db.query(Stock)
        .filter(
            Stock.id == watchlist.stock_id
        )
        .first()
    )

    if not stock:
        raise HTTPException(
            status_code=404,
            detail="Stock not found"
        )

    existing = (
        db.query(Watchlist)
        .filter(
            Watchlist.user_id == current_user.id,
            Watchlist.stock_id == stock.id
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Already in watchlist"
        )

    item = Watchlist(
        user_id=current_user.id,
        stock_id=stock.id
    )

    db.add(item)
    db.commit()

    return {
        "message": f"{stock.symbol} added to watchlist"
    }
@router.get("/")
def get_watchlist(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    items = (
        db.query(Watchlist)
        .filter(
            Watchlist.user_id == current_user.id
        )
        .all()
    )

    result = []

    for item in items:

        stock = (
            db.query(Stock)
            .filter(
                Stock.id == item.stock_id
            )
            .first()
        )

        result.append(
            {
                "stock_id": stock.id,
                "symbol": stock.symbol,
                "company_name": stock.company_name,
                "current_price": stock.current_price
            }
        )

    return result 
 
@router.delete("/remove")
def remove_from_watchlist(
    watchlist: WatchlistDelete,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):


    item = (
        db.query(Watchlist)
        .filter(
            Watchlist.user_id == current_user.id,
            Watchlist.stock_id == watchlist.stock_id
        )
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Stock not found in watchlist"
        )

    db.delete(item)
    db.commit()

    return {
        "message": "Removed from watchlist"
    }