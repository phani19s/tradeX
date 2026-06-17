from fastapi import APIRouter
from fastapi import Depends 
from fastapi import Query

from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.models.stock import Stock
from random import uniform

router = APIRouter(
    prefix="/stocks",
    tags=["Stocks"]
)


@router.get("/")
def get_stocks(
    db: Session = Depends(get_db)
):

    stocks = db.query(Stock).all()

    return stocks 

@router.get("/search")
def search_stock(
    symbol: str = Query(...),
    db: Session = Depends(get_db)
):

    stocks = (
        db.query(Stock)
        .filter(
            Stock.symbol.ilike(
                f"%{symbol}%"
            )
        )
        .all()
    )

    return stocks 

@router.get("/market-overview")
def market_overview(
    db: Session = Depends(get_db)
):

    stocks = db.query(Stock).all()

    result = []

    for stock in stocks:

        result.append(
            {
                "symbol": stock.symbol,
                "company_name": stock.company_name,
                "price": stock.current_price
            }
        )

    return result



@router.post("/update-prices")
def update_prices(
    db: Session = Depends(get_db)
):

    stocks = db.query(Stock).all()

    for stock in stocks:

        percent =uniform(-0.012, 0.012)

        stock.previous_close = stock.current_price

        stock.current_price = round(
            stock.current_price *
            (1 + percent),
            2
        )

    db.commit()

    return {
        "message":
        "Prices Updated"
    }