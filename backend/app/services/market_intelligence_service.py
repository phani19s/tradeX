from sqlalchemy.orm import Session

from app.models.stock import Stock


SECTOR_MAP = {
    "TCS": "IT",
    "INFY": "IT",
    "INFOSYS": "IT",
    "MSFT": "IT",
    "AAPL": "Technology",
    "GOOGL": "Technology",
    "META": "Technology",
    "NVDA": "Technology",
    "AMD": "Technology",
    "INTC": "Technology",
    "HDFCBANK": "Banking",
    "HDFC BANK": "Banking",
    "JPM": "Banking",
    "SBIN": "Banking",
    "RELIANCE": "Energy",
    "WIPRO": "IT",
    "SUNPHARMA": "Pharma",
    "TSLA": "Auto",
    "AMZN": "Consumer",
    "NFLX": "Media",
    "BABA": "Consumer",
    "ORCL": "IT",
}


def normalize_symbol(value: str):
    return (value or "").strip().upper().replace(" ", "")


def infer_sector(symbol: str):
    return SECTOR_MAP.get(normalize_symbol(symbol), "Other")


def find_stock_from_message(db: Session, message: str):
    normalized_message = normalize_symbol(message)
    stocks = db.query(Stock).all()

    for stock in stocks:
        symbol = normalize_symbol(stock.symbol)
        name = normalize_symbol(stock.company_name)

        if symbol and symbol in normalized_message:
            return stock
        if name and name in normalized_message:
            return stock

    aliases = {
        "INFOSYS": "INFY",
        "HDFCBANK": "HDFCBANK",
        "HDFCBANKLIMITED": "HDFCBANK",
    }

    for alias, symbol in aliases.items():
        if alias in normalized_message:
            return (
                db.query(Stock)
                .filter(Stock.symbol.ilike(symbol))
                .first()
            )

    return None


def get_prediction(stock: Stock | None):
    if not stock:
        return {
            "label": "Neutral",
            "confidence": 50,
            "reason": "No stock-specific prediction data was found.",
        }

    current = float(stock.current_price or 0)
    previous = float(stock.previous_close or current or 1)
    change = ((current - previous) / previous) * 100 if previous else 0

    if change > 1:
        label = "Bullish"
        confidence = min(85, 60 + abs(change) * 4)
    elif change < -1:
        label = "Bearish"
        confidence = min(85, 60 + abs(change) * 4)
    else:
        label = "Neutral"
        confidence = 55

    return {
        "label": label,
        "confidence": round(confidence, 2),
        "reason": f"Live price movement versus previous close is {change:.2f}%.",
    }


def get_news_sentiment(stock: Stock | None):
    if not stock:
        return {
            "label": "Neutral",
            "score": 0,
            "reason": "No stock-specific sentiment source was found.",
        }

    current = float(stock.current_price or 0)
    previous = float(stock.previous_close or current or 1)
    score = ((current - previous) / previous) if previous else 0

    if score > 0.01:
        label = "Positive"
    elif score < -0.01:
        label = "Negative"
    else:
        label = "Neutral"

    return {
        "label": label,
        "score": round(max(min(score, 1), -1), 4),
        "reason": "Derived from currently available market momentum fallback.",
    }
