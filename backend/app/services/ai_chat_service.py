import os

import requests
from sqlalchemy.orm import Session

from app.models.chat_history import ChatHistory
from app.models.stock import Stock
from app.services.market_intelligence_service import (
    find_stock_from_message,
    get_news_sentiment,
    get_prediction,
)
from app.services.risk_service import calculate_risk_analysis, get_holdings


SYSTEM_PROMPT = """You are TradeX AI, a cautious stock-market assistant.
Use only the supplied TradeX context. Do not invent prices, holdings, or news.
Give concise educational guidance, not guaranteed financial advice.
Always mention risk when answering buy/sell questions."""


def _portfolio_exposure(holdings, symbol, total_value):
    holding = holdings.get(symbol)
    if not holding or not total_value:
        return 0

    value = holding["quantity"] * holding["stock"].current_price
    return round((value / total_value) * 100, 2)


def build_ai_context(db: Session, user_id: int, message: str):
    stock = find_stock_from_message(db, message)
    holdings = get_holdings(db, user_id)
    risk = calculate_risk_analysis(db, user_id)
    prediction = get_prediction(stock)
    sentiment = get_news_sentiment(stock)
    total_value = risk["portfolio_value"]

    if stock:
        stock_context = {
            "symbol": stock.symbol,
            "company_name": stock.company_name,
            "current_price": stock.current_price,
            "previous_close": stock.previous_close,
            "prediction": prediction,
            "sentiment": sentiment,
            "portfolio_exposure_percent": _portfolio_exposure(holdings, stock.symbol, total_value),
        }
    else:
        stock_context = None

    return {
        "question": message,
        "stock": stock_context,
        "portfolio": {
            "holdings": [
                {
                    "symbol": symbol,
                    "quantity": holding["quantity"],
                    "current_price": holding["stock"].current_price,
                    "market_value": round(holding["quantity"] * holding["stock"].current_price, 2),
                }
                for symbol, holding in holdings.items()
            ],
            "risk_metrics": risk,
        },
    }


def _format_context(context):
    lines = ["TradeX Context:"]

    if context["stock"]:
        stock = context["stock"]
        lines.extend(
            [
                f"Stock: {stock['company_name']} ({stock['symbol']})",
                f"Current Price: Rs. {stock['current_price']}",
                f"Previous Close: Rs. {stock['previous_close']}",
                f"Prediction: {stock['prediction']['label']} ({stock['prediction']['confidence']}% confidence)",
                f"Prediction Reason: {stock['prediction']['reason']}",
                f"Sentiment: {stock['sentiment']['label']} (score {stock['sentiment']['score']})",
                f"Portfolio Exposure: {stock['portfolio_exposure_percent']}%",
            ]
        )
    else:
        lines.append("Stock: Not identified from the user message.")

    risk = context["portfolio"]["risk_metrics"]
    lines.extend(
        [
            f"Portfolio Value: Rs. {risk['portfolio_value']}",
            f"Portfolio P/L: Rs. {risk['profit_loss']}",
            f"Return Percent: {risk['return_percent']}%",
            f"Sharpe Ratio: {risk['sharpe_ratio']}",
            f"Max Drawdown: {risk['max_drawdown']}%",
            f"Risk Score: {risk['risk_score']} ({risk['risk_level']})",
            f"Diversification Score: {risk['diversification_score']}",
            f"Holdings: {context['portfolio']['holdings']}",
        ]
    )

    return "\n".join(lines)


def _fallback_answer(context):
    stock = context["stock"]
    risk = context["portfolio"]["risk_metrics"]
    question = context["question"].lower()

    if "portfolio" in question or "risk" in question:
        return (
            f"Your portfolio risk level is {risk['risk_level']} with a risk score of {risk['risk_score']}. "
            f"Portfolio value is Rs. {risk['portfolio_value']} with P/L of Rs. {risk['profit_loss']}. "
            f"Diversification score is {risk['diversification_score']}, so review concentration before adding more exposure."
        )

    if not stock:
        return (
            "I could not identify a matching stock in TradeX data. "
            f"Your current portfolio risk level is {risk['risk_level']} with a risk score of {risk['risk_score']}."
        )

    prediction = stock["prediction"]["label"].lower()
    sentiment = stock["sentiment"]["label"].lower()
    exposure = stock["portfolio_exposure_percent"]

    return (
        f"{stock['company_name']} is trading at Rs. {stock['current_price']}. "
        f"The available prediction is {prediction} and sentiment is {sentiment}. "
        f"Your portfolio exposure is {exposure}%. "
        "Consider position size, diversification, and your risk profile before investing."
    )


def _call_openai(prompt):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or len(api_key.strip()) < 10 or api_key.startswith("your_") or "placeholder" in api_key.lower() or "dummy" in api_key.lower():
        return None

    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.3,
            "max_tokens": 250,
        },
        timeout=3,
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"].strip()


def _call_gemini(prompt):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or len(api_key.strip()) < 10 or api_key.startswith("your_") or "placeholder" in api_key.lower() or "dummy" in api_key.lower():
        return None

    model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
        json={
            "contents": [
                {
                    "parts": [
                        {"text": f"{SYSTEM_PROMPT}\n\n{prompt}"}
                    ]
                }
            ]
        },
        timeout=3,
    )
    response.raise_for_status()
    candidates = response.json().get("candidates", [])
    if not candidates:
        return None
    return candidates[0]["content"]["parts"][0]["text"].strip()


def answer_question(db: Session, user_id: int, message: str):
    context = build_ai_context(db, user_id, message)
    prompt = f"{_format_context(context)}\n\nUser question: {message}"

    try:
        answer = _call_openai(prompt) or _call_gemini(prompt) or _fallback_answer(context)
    except Exception:
        answer = _fallback_answer(context)

    history = ChatHistory(
        user_id=user_id,
        question=message,
        answer=answer,
    )
    db.add(history)
    db.commit()

    return answer
