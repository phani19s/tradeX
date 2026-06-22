from app.core.database import SessionLocal
from app.models.stock import Stock


STOCKS = [
    {"symbol": "AAPL", "company_name": "Apple", "current_price": 195.0},
    {"symbol": "TSLA", "company_name": "Tesla", "current_price": 250.0},
    {"symbol": "NVDA", "company_name": "NVIDIA", "current_price": 130.0},
    {"symbol": "MSFT", "company_name": "Microsoft", "current_price": 460.0},
    {"symbol": "AMZN", "company_name": "Amazon", "current_price": 205.0},
    {"symbol": "GOOGL", "company_name": "Alphabet", "current_price": 175.0},
    {"symbol": "META", "company_name": "Meta Platforms", "current_price": 510.0},
    {"symbol": "NFLX", "company_name": "Netflix", "current_price": 680.0},
    {"symbol": "AMD", "company_name": "AMD", "current_price": 165.0},
    {"symbol": "INTC", "company_name": "Intel", "current_price": 35.0},
    {"symbol": "BABA", "company_name": "Alibaba", "current_price": 82.0},
    {"symbol": "ORCL", "company_name": "Oracle", "current_price": 142.0},
    {"symbol": "JPM", "company_name": "JPMorgan Chase", "current_price": 208.0},
    {"symbol": "INFY", "company_name": "Infosys", "current_price": 1800.0},
    {"symbol": "TCS", "company_name": "Tata Consultancy Services", "current_price": 4120.0},
    {"symbol": "RELIANCE", "company_name": "Reliance Industries", "current_price": 2985.0},
    {"symbol": "HDFCBANK", "company_name": "HDFC Bank", "current_price": 1500.0},
    {"symbol": "WIPRO", "company_name": "Wipro", "current_price": 540.0},
    {"symbol": "SBIN", "company_name": "State Bank of India", "current_price": 820.0},
    {"symbol": "SUNPHARMA", "company_name": "Sun Pharmaceutical", "current_price": 1520.0},
]


def seed_stocks():
    db = SessionLocal()

    try:
        for stock in STOCKS:
            existing = (
                db.query(Stock)
                .filter(Stock.symbol == stock["symbol"])
                .first()
            )

            if not existing:
                db.add(
                    Stock(
                        symbol=stock["symbol"],
                        company_name=stock["company_name"],
                        current_price=stock["current_price"],
                        previous_close=stock["current_price"],
                    )
                )
            elif not getattr(existing, "previous_close", None):
                existing.previous_close = existing.current_price

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_stocks()
    print("Stocks Seeded Successfully")
