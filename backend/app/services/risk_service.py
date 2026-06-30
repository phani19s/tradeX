import math
from collections import defaultdict

from sqlalchemy.orm import Session

from app.models.portfolio import Portfolio
from app.models.stock import Stock
from app.models.trade import Trade
from app.services.market_intelligence_service import infer_sector


def _round(value, digits=2):
    return round(float(value or 0), digits)


def get_holdings(db: Session, user_id: int):
    trades = (
        db.query(Trade)
        .filter(Trade.user_id == user_id)
        .order_by(Trade.id.asc())
        .all()
    )

    if not trades:
        return {}

    # Fetch all stocks in a single query
    stocks_map = {s.id: s for s in db.query(Stock).all()}

    holdings = {}
    buy_prices = {}

    for trade in trades:
        stock = stocks_map.get(trade.stock_id)
        if not stock:
            continue

        if stock.symbol not in holdings:
            holdings[stock.symbol] = {
                "stock": stock,
                "quantity": 0,
                "invested": 0,
            }

        if trade.trade_type == "BUY":
            holdings[stock.symbol]["quantity"] += trade.quantity
            holdings[stock.symbol]["invested"] += trade.quantity * trade.price
            buy_prices[stock.symbol] = trade.price
        elif trade.trade_type == "SELL":
            holdings[stock.symbol]["quantity"] -= trade.quantity
            holdings[stock.symbol]["invested"] -= trade.quantity * buy_prices.get(stock.symbol, trade.price)

    return {
        symbol: holding
        for symbol, holding in holdings.items()
        if holding["quantity"] > 0
    }


def get_portfolio_growth(db: Session, user_id: int):
    trades = (
        db.query(Trade)
        .filter(Trade.user_id == user_id)
        .order_by(Trade.id.asc())
        .all()
    )
    if not trades:
        return []

    # Fetch all stocks in a single query
    stocks_map = {s.id: s for s in db.query(Stock).all()}
    
    holdings = defaultdict(int)
    points = []

    for index, trade in enumerate(trades, start=1):
        if trade.trade_type == "BUY":
            holdings[trade.stock_id] += trade.quantity
        elif trade.trade_type == "SELL":
            holdings[trade.stock_id] -= trade.quantity

        value = 0
        for stock_id, quantity in holdings.items():
            stock = stocks_map.get(stock_id)
            if stock and quantity > 0:
                value += quantity * stock.current_price

        points.append({"label": f"T{index}", "value": _round(value)})

    return points[-20:]


def calculate_risk_analysis(db: Session, user_id: int):
    holdings = get_holdings(db, user_id)
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == user_id).first()

    invested = sum(max(holding["invested"], 0) for holding in holdings.values())
    market_value = sum(
        holding["quantity"] * holding["stock"].current_price
        for holding in holdings.values()
    )
    cash = float(portfolio.balance if portfolio else 0)
    portfolio_value = market_value + cash
    profit_loss = market_value - invested
    return_percent = (profit_loss / invested) * 100 if invested else 0

    stock_allocation = []
    sector_totals = defaultdict(float)
    position_values = []
    daily_moves = []

    for symbol, holding in holdings.items():
        stock = holding["stock"]
        value = holding["quantity"] * stock.current_price
        position_values.append(value)
        stock_allocation.append({"label": symbol, "value": _round(value)})
        sector_totals[infer_sector(symbol)] += value

        previous = float(stock.previous_close or stock.current_price or 1)
        daily_moves.append(((stock.current_price - previous) / previous) * 100)

    sector_allocation = [
        {"label": sector, "value": _round((value / market_value) * 100 if market_value else 0)}
        for sector, value in sector_totals.items()
    ]

    holding_count = len(holdings)
    largest_position_percent = (max(position_values) / market_value) * 100 if position_values and market_value else 0
    sector_penalty = max((item["value"] for item in sector_allocation), default=100)
    diversification_score = max(
        0,
        min(
            100,
            int((min(holding_count, 8) / 8) * 45 + (100 - largest_position_percent) * 0.35 + (100 - sector_penalty) * 0.2),
        ),
    )

    volatility = math.sqrt(sum(move * move for move in daily_moves) / len(daily_moves)) if daily_moves else 0
    sharpe_ratio = ((return_percent - 6) / volatility) if volatility else 0

    growth = get_portfolio_growth(db, user_id)
    peak = 0
    max_drawdown = 0
    for point in growth:
        peak = max(peak, point["value"])
        if peak:
            drawdown = ((point["value"] - peak) / peak) * 100
            max_drawdown = min(max_drawdown, drawdown)

    risk_score = int(
        max(
            0,
            min(
                100,
                volatility * 6 + max(0, -max_drawdown) * 2 + (100 - diversification_score) * 0.45,
            ),
        )
    )

    if risk_score <= 30:
        risk_level = "Low"
    elif risk_score <= 70:
        risk_level = "Medium"
    else:
        risk_level = "High"

    return {
        "portfolio_value": _round(portfolio_value),
        "profit_loss": _round(profit_loss),
        "return_percent": _round(return_percent),
        "sharpe_ratio": _round(sharpe_ratio),
        "max_drawdown": _round(max_drawdown),
        "risk_score": risk_score,
        "risk_level": risk_level,
        "diversification_score": diversification_score,
        "sector_allocation": sector_allocation,
        "stock_allocation": stock_allocation,
        "portfolio_growth": growth,
    }
