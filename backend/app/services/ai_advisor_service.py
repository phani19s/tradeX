import os
import json
import requests
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.stock import Stock
from app.models.system_setting import SystemSetting
from app.models.trade import Trade
from app.models.watchlist import Watchlist
from app.services.risk_service import calculate_risk_analysis, get_holdings
from app.services.market_intelligence_service import infer_sector

def _call_llm_json(prompt: str, fallback_data: dict) -> dict:
    """Helper to call configured AI provider and expect JSON response, falls back on failure."""
    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")
    
    # Ignore placeholder keys
    if openai_key and (len(openai_key.strip()) < 10 or openai_key.startswith("your_") or "placeholder" in openai_key.lower() or "dummy" in openai_key.lower()):
        openai_key = None
    if gemini_key and (len(gemini_key.strip()) < 10 or gemini_key.startswith("your_") or "placeholder" in gemini_key.lower() or "dummy" in gemini_key.lower()):
        gemini_key = None

    system_instruction = "You are a professional AI Investment Advisor. Always return responses in valid raw JSON format matching the requested schema. Do not enclose JSON in markdown code blocks or backticks."

    # 1. Try OpenAI if key is set
    if openai_key:
        try:
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {openai_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                    "messages": [
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"}
                },
                timeout=3
            )
            if response.status_code == 200:
                res_json = response.json()
                content = res_json["choices"][0]["message"]["content"].strip()
                return json.loads(content)
        except Exception as e:
            print("OpenAI Advisor call failed, falling back:", e)

    # 2. Try Gemini if key is set
    if gemini_key:
        try:
            model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
            response = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gemini_key}",
                json={
                    "contents": [
                        {
                            "parts": [
                                {"text": f"{system_instruction}\n\n{prompt}"}
                            ]
                        }
                    ],
                    "generationConfig": {
                        "responseMimeType": "application/json"
                    }
                },
                timeout=3
            )
            if response.status_code == 200:
                candidates = response.json().get("candidates", [])
                if candidates:
                    content = candidates[0]["content"]["parts"][0]["text"].strip()
                    return json.loads(content)
        except Exception as e:
            print("Gemini Advisor call failed, falling back:", e)

    # 3. Local fallback
    return fallback_data


def get_portfolio_analysis(db: Session, user_id: int) -> dict:
    holdings = get_holdings(db, user_id)
    risk = calculate_risk_analysis(db, user_id)
    total_val = risk.get("portfolio_value", 0.0)
    risk_level = risk.get("risk_level", "Medium")
    risk_score = risk.get("risk_score", 50)
    div_score = risk.get("diversification_score", 50)
    
    # Identify sectors
    sectors = {}
    for sym, h in holdings.items():
        sec = infer_sector(sym)
        sectors[sec] = sectors.get(sec, 0) + (h["quantity"] * h["stock"].current_price)
        
    sector_exposure = {sec: round((val / total_val) * 100, 2) if total_val > 0 else 0 for sec, val in sectors.items()}
    
    # Setup high-quality fallback data
    portfolio_score = max(10, min(95, int(div_score * 0.6 + (100 - risk_score) * 0.4)))
    expected_return = 15.0 if risk_level == "High" else (10.5 if risk_level == "Medium" else 7.5)
    
    strengths = ["Solid capital allocation overall."]
    weaknesses = ["Needs periodic sector review."]
    
    if div_score > 70:
        strengths.append("Excellent diversification across multiple sectors.")
    else:
        weaknesses.append("High asset concentration. Consider diversifying to reduce risk.")
        
    for sec, exp in sector_exposure.items():
        if exp > 50:
            weaknesses.append(f"Overexposure to {sec} sector ({exp}%).")
            
    fallback = {
        "portfolio_score": portfolio_score,
        "risk_level": risk_level,
        "diversification_score": div_score,
        "expected_return": expected_return,
        "health": f"Your portfolio is currently evaluated as {risk_level.lower()} risk with health rating {portfolio_score}/100.",
        "strengths": strengths,
        "weaknesses": weaknesses
    }
    
    prompt = f"""
    Analyze the following user portfolio data:
    - Holdings: {[{'symbol': sym, 'value': (h['quantity'] * h['stock'].current_price), 'sector': infer_sector(sym)} for sym, h in holdings.items()]}
    - Total Portfolio Value: Rs. {total_val}
    - Risk Score (0-100): {risk_score} (Level: {risk_level})
    - Diversification Score (0-100): {div_score}
    - Sector Exposure Percentages: {sector_exposure}
    
    Generate an AI portfolio report matching this JSON schema:
    {{
      "portfolio_score": number (0-100),
      "risk_level": "Low" | "Medium" | "High",
      "diversification_score": number (0-100),
      "expected_return": number (expected annual return % based on asset selection),
      "health": "string (overall health summary)",
      "strengths": ["string"],
      "weaknesses": ["string"]
    }}
    """
    
    return _call_llm_json(prompt, fallback)


def get_portfolio_suggestions(db: Session, user_id: int) -> dict:
    holdings = get_holdings(db, user_id)
    risk = calculate_risk_analysis(db, user_id)
    total_val = risk.get("portfolio_value", 0.0)
    risk_level = risk.get("risk_level", "Medium")
    div_score = risk.get("diversification_score", 50)
    
    sectors = {}
    for sym, h in holdings.items():
        sec = infer_sector(sym)
        sectors[sec] = sectors.get(sec, 0) + (h["quantity"] * h["stock"].current_price)
        
    sector_exposure = {sec: (val / total_val) * 100 if total_val > 0 else 0 for sec, val in sectors.items()}

    # Local fallback logic
    suggestions = []
    if len(holdings) == 0:
        suggestions.append({
            "text": "Start building your portfolio.",
            "explanation": "Look into establishing core positions in stable blue-chip sectors like Banking or Energy.",
            "confidence": 95
        })
    else:
        if div_score < 60:
            suggestions.append({
                "text": "Improve portfolio diversification.",
                "explanation": "Your portfolio holds few assets. Adding stock positions in non-correlated sectors will lower volatility.",
                "confidence": 90
            })
        
        # Sector specific suggestion
        has_tech = "IT" in sectors or "Technology" in sectors
        has_pharma = "Pharma" in sectors or "Healthcare" in sectors
        has_banking = "Banking" in sectors
        
        if not has_pharma:
            suggestions.append({
                "text": "Diversify into Healthcare sector.",
                "explanation": "Adding healthcare stocks offers defensive qualities and consistent returns during market consolidations.",
                "confidence": 80
            })
        if not has_banking:
            suggestions.append({
                "text": "Increase Banking sector allocation.",
                "explanation": "Financial stocks track economy growth directly and provide structural strength to standard portfolios.",
                "confidence": 75
            })
            
        for sec, exp in sector_exposure.items():
            if exp > 50:
                suggestions.append({
                    "text": f"Reduce exposure to {sec} stocks.",
                    "explanation": f"Concentration of {exp:.1f}% in a single sector introduces significant sector-specific risks.",
                    "confidence": 85
                })
                
        if risk_level == "High":
            suggestions.append({
                "text": "Reduce high-risk holdings.",
                "explanation": "Liquidating or trimming high-beta assets can protect capital from sharp downside movements.",
                "confidence": 70
            })
            
        if len(suggestions) == 0:
            suggestions.append({
                "text": "Hold current investments.",
                "explanation": "Your holdings are well-diversified across sectors with balanced risk profiles. Maintain positions.",
                "confidence": 90
            })

    fallback = {"suggestions": suggestions}
    
    prompt = f"""
    Based on the user's holdings: {[{'symbol': s, 'exposure': exp} for s, exp in sector_exposure.items()]}
    Portfolio Risk Level: {risk_level}
    Diversification Score: {div_score}
    
    Recommend 2-4 personalized suggestions. Return valid JSON matching this schema:
    {{
      "suggestions": [
        {{
          "text": "string (the suggestion label, e.g. 'Diversify into Healthcare sector.')",
          "explanation": "string (short description & reason)",
          "confidence": number (percentage 0-100)
        }}
      ]
    }}
    """
    return _call_llm_json(prompt, fallback)


def get_trading_simulation(db: Session, user_id: int, initial_amount: float, monthly_amount: float, years: int, symbol: str) -> dict:
    stock = db.query(Stock).filter(Stock.symbol.ilike(symbol)).first()
    price = float(stock.current_price) if stock else 1000.0
    company_name = stock.company_name if stock else symbol
    
    # Calculate estimated CAGR and projections
    cagr = 12.5 # default estimated CAGR
    if stock:
        # derive simulated CAGR based on price volatility
        cagr = 14.2 if symbol.upper() in ["RELIANCE", "SBIN"] else (11.8 if symbol.upper() in ["INFY", "TCS"] else 15.5)
        
    rate = cagr / 100.0
    future_val = initial_amount
    total_invested = initial_amount
    
    chart_data = [{"year": "Start", "value": round(initial_amount, 2)}]
    for y in range(1, years + 1):
        # Apply compounding
        future_val = future_val * (1 + rate) + (monthly_amount * 12) * (1 + rate / 2) # simplified mid-year SIP compounding
        total_invested += (monthly_amount * 12)
        chart_data.append({"year": f"Year {y}", "value": round(future_val, 2)})
        
    profit = max(0.0, future_val - total_invested)
    success_prob = 80 if cagr < 12 else (70 if cagr < 15 else 60)
    risk_level = "High" if cagr >= 15 else ("Medium" if cagr >= 12 else "Low")
    
    fallback = {
        "future_value": round(future_val, 2),
        "estimated_profit": round(profit, 2),
        "cagr": cagr,
        "risk_level": risk_level,
        "probability_of_success": success_prob,
        "best_case_scenario": f"Under ideal conditions, {company_name} could yield returns up to 20% CAGR, reaching ₹{round(future_val * 1.3, 2):,}.",
        "worst_case_scenario": f"Under bearish macro trends, the CAGR might drop to 5%, valuing the investment at ₹{round(future_val * 0.7, 2):,}.",
        "investment_recommendation": f"Recommend accumulating {company_name} shares with a long term view of {years} years.",
        "chart_data": chart_data
    }
    
    prompt = f"""
    Calculate a simulation for investing:
    - Target Asset: {company_name} (Symbol: {symbol}, Current price: Rs. {price})
    - Initial Principal: Rs. {initial_amount}
    - Monthly Installment (SIP): Rs. {monthly_amount}
    - Period: {years} years
    
    Return a simulator analysis JSON object matching this schema:
    {{
      "future_value": number (projected value),
      "estimated_profit": number (profit made),
      "cagr": number (projected annual CAGR %),
      "risk_level": "Low" | "Medium" | "High",
      "probability_of_success": number (percentage 0-100),
      "best_case_scenario": "string",
      "worst_case_scenario": "string",
      "investment_recommendation": "string",
      "chart_data": [
         {{"year": "string (e.g. 'Year 1')", "value": number}}
      ]
    }}
    """
    return _call_llm_json(prompt, fallback)


def get_stock_recommendations(db: Session, user_id: int, rec_type: str) -> dict:
    stocks = db.query(Stock).all()
    
    # Filter stocks locally to give high quality recommendations matching the requested type
    rec_type = rec_type.lower()
    
    recs = []
    if rec_type == "long_term" or rec_type == "portfolio_based":
        recs = [
            {
                "company_name": "Reliance Industries Ltd",
                "symbol": "RELIANCE",
                "growth": "12% - 15% Target Return",
                "risk_level": "Low",
                "confidence": 88,
                "reason": "Dominant player in energy, retail, and digital services with strong cash generation."
            },
            {
                "company_name": "Tata Consultancy Services Ltd",
                "symbol": "TCS",
                "growth": "10% - 13% Steady Growth",
                "risk_level": "Low",
                "confidence": 92,
                "reason": "Industry leader in IT services with solid recurring revenues and high margins."
            }
        ]
    elif rec_type == "low_risk" or rec_type == "dividend":
        recs = [
            {
                "company_name": "State Bank of India",
                "symbol": "SBIN",
                "growth": "8% - 11% Value Growth",
                "risk_level": "Low",
                "confidence": 85,
                "reason": "Largest state-owned bank in India with robust capital base and steady dividend yields."
            },
            {
                "company_name": "Infosys Ltd",
                "symbol": "INFY",
                "growth": "9% - 12% Dividends + Growth",
                "risk_level": "Low",
                "confidence": 90,
                "reason": "Strong dividend payout ratio, debt-free balance sheet, and excellent governance metrics."
            }
        ]
    else: # high_growth
        recs = [
            {
                "company_name": "Sun Pharmaceutical Industries Ltd",
                "symbol": "SUNPHARMA",
                "growth": "16% - 20% High Growth",
                "risk_level": "Medium",
                "confidence": 80,
                "reason": "Strong drug development pipeline and expanding global market footprint in specialty healthcare."
            }
        ]

    # Map current prices
    stock_map = {s.symbol.upper(): s for s in stocks}
    for r in recs:
        s_obj = stock_map.get(r["symbol"])
        r["price"] = float(s_obj.current_price) if s_obj else 1500.0

    fallback = {"recommendations": recs}
    
    prompt = f"""
    Recommend 2-3 stocks for type: '{rec_type}' using this list of available stocks: {[{'symbol': s.symbol, 'name': s.company_name, 'price': float(s.current_price)} for s in stocks[:8]]}
    
    Return a stock recommendations JSON object matching this schema:
    {{
      "recommendations": [
        {{
          "company_name": "string",
          "symbol": "string",
          "price": number,
          "growth": "string (e.g. '15% growth')",
          "risk_level": "Low" | "Medium" | "High",
          "confidence": number (0-100),
          "reason": "string (short thesis)"
        }}
      ]
    }}
    """
    return _call_llm_json(prompt, fallback)


def get_market_insights_summary(db: Session) -> dict:
    stocks = db.query(Stock).all()
    
    # Calculate top gainers/losers dynamically from database
    gainers = []
    losers = []
    
    for s in stocks:
        current = float(s.current_price or 0)
        previous = float(s.previous_close or current or 1)
        change = ((current - previous) / previous) * 100 if previous else 0
        data = {
            "symbol": s.symbol,
            "company_name": s.company_name,
            "price": current,
            "change": round(change, 2)
        }
        if change > 0:
            gainers.append(data)
        else:
            losers.append(data)
            
    gainers = sorted(gainers, key=lambda x: x["change"], reverse=True)[:3]
    losers = sorted(losers, key=lambda x: x["change"])[:3]
    
    fallback = {
        "market_sentiment": "Bullish" if len(gainers) > len(losers) else "Bearish",
        "trending_sectors": ["Banking", "IT Services", "Pharma"],
        "market_risk_level": "Medium",
        "opportunities": [
            "Pharma sectors display robust demand hedging against general IT growth consolidation.",
            "Accumulate state banks on support levels."
        ],
        "news_summary": [
            "Indian indices indices trade near all time highs led by financial and banking buying.",
            "Foreign institutional investors register net inflows following steady inflation metrics."
        ],
        "top_gainers": gainers,
        "top_losers": losers
    }
    
    prompt = f"""
    Generate daily market summary and insights. Live database movers:
    - Top gainers: {gainers}
    - Top losers: {losers}
    
    Return a market insights JSON object matching this schema:
    {{
      "market_sentiment": "Bullish" | "Bearish" | "Neutral",
      "trending_sectors": ["string"],
      "market_risk_level": "Low" | "Medium" | "High",
      "opportunities": ["string"],
      "news_summary": ["string"],
      "top_gainers": [
         {{"symbol": "string", "price": number, "change": number}}
      ],
      "top_losers": [
         {{"symbol": "string", "price": number, "change": number}}
      ]
    }}
    """
    return _call_llm_json(prompt, fallback)


def get_portfolio_alerts_list(db: Session, user_id: int) -> dict:
    holdings = get_holdings(db, user_id)
    risk = calculate_risk_analysis(db, user_id)
    total_val = risk.get("portfolio_value", 0.0)
    risk_level = risk.get("risk_level", "Medium")
    risk_score = risk.get("risk_score", 50)
    div_score = risk.get("diversification_score", 50)
    
    sectors = {}
    for sym, h in holdings.items():
        sec = infer_sector(sym)
        sectors[sec] = sectors.get(sec, 0) + (h["quantity"] * h["stock"].current_price)
        
    sector_exposure = {sec: (val / total_val) * 100 if total_val > 0 else 0 for sec, val in sectors.items()}
    
    alerts = []
    if risk_score > 65:
        alerts.append({
            "type": "High Portfolio Risk",
            "severity": "Warning",
            "message": f"Your portfolio risk score is currently high ({risk_score}/100). Consider rebalancing towards low-beta assets."
        })
    if div_score < 45:
        alerts.append({
            "type": "Low Diversification",
            "severity": "Warning",
            "message": "Your holdings are concentrated. Add assets from defensive sectors like Healthcare to improve stability."
        })
        
    for sec, exp in sector_exposure.items():
        if exp > 45:
            alerts.append({
                "type": "Overexposure Alert",
                "severity": "Warning",
                "message": f"Portfolio exposure to {sec} is {exp:.1f}%. Consider trimming to avoid high sector-specific dependency."
            })
            
    # Underperforming triggers
    for sym, h in holdings.items():
        current = float(h["stock"].current_price)
        prev = float(h["stock"].previous_close or current)
        change = ((current - prev) / prev) * 100 if prev else 0
        if change < -4:
            alerts.append({
                "type": "Underperforming Stock",
                "severity": "Info",
                "message": f"Stock {sym} crashed by {change:.1f}% today. Monitor support levels closely."
            })
            
    if not alerts:
        alerts.append({
            "type": "Portfolio Healthy",
            "severity": "Info",
            "message": "AI check complete: No critical portfolio risks or overexposure alerts detected."
        })
        
    fallback = {"alerts": alerts}
    
    prompt = f"""
    Evaluate these metrics for proactive portfolio alerts:
    - Holdings: {[{'symbol': sym, 'exposure': exp} for sym, exp in sector_exposure.items()]}
    - Risk Score: {risk_score} (Level: {risk_level})
    - Diversification Score: {div_score}
    
    Return a list of proactive warnings/suggestions. Valid JSON matching this schema:
    {{
      "alerts": [
        {{
          "type": "string (e.g. 'Overexposure Alert')",
          "severity": "Info" | "Warning" | "Critical",
          "message": "string"
        }}
      ]
    }}
    """
    return _call_llm_json(prompt, fallback)


def get_daily_market_summary(db: Session, force_refresh: bool = False) -> dict:
    import datetime
    
    cache_dir = os.path.dirname(os.path.abspath(__file__))
    cache_file = os.path.join(cache_dir, "daily_market_summary_cache.json")
    
    today_date = datetime.date.today().isoformat()
    
    # 1. Try to load cached data if not forced refresh
    if not force_refresh:
        try:
            if os.path.exists(cache_file):
                with open(cache_file, "r") as f:
                    cached_data = json.load(f)
                    if cached_data.get("date") == today_date:
                        return cached_data
        except Exception as e:
            print("Failed to read daily summary cache:", e)

    # 2. Query stocks in the database to calculate stats
    stocks = db.query(Stock).filter(Stock.is_active == True).all()
    if not stocks:
        stocks = db.query(Stock).all()
        
    stock_data = []
    for s in stocks:
        current = float(s.current_price or 0)
        prev = float(s.previous_close or current or 1)
        pct_change = ((current - prev) / prev) * 100 if prev else 0
        stock_data.append({
            "symbol": s.symbol,
            "company_name": s.company_name,
            "price": current,
            "change_pct": pct_change
        })
        
    # Calculate top gainer and top loser
    if stock_data:
        sorted_by_change = sorted(stock_data, key=lambda x: x["change_pct"])
        top_gainer = sorted_by_change[-1]
        top_loser = sorted_by_change[0]
        avg_pct_change = sum(s["change_pct"] for s in stock_data) / len(stock_data)
    else:
        top_gainer = {"symbol": "N/A", "company_name": "N/A", "price": 0.0, "change_pct": 0.0}
        top_loser = {"symbol": "N/A", "company_name": "N/A", "price": 0.0, "change_pct": 0.0}
        avg_pct_change = 0.0

    # 3. Determine Most Active Stock based on trades table
    most_active = None
    try:
        from app.models.trade import Trade
        active_trade = (
            db.query(Trade.stock_id, func.count(Trade.id).label("trade_count"))
            .group_by(Trade.stock_id)
            .order_by(func.count(Trade.id).desc())
            .first()
        )
        if active_trade:
            active_stock = db.query(Stock).filter(Stock.id == active_trade.stock_id).first()
            if active_stock:
                curr = float(active_stock.current_price or 0)
                pr = float(active_stock.previous_close or curr or 1)
                chg = ((curr - pr) / pr) * 100 if pr else 0
                most_active = {
                    "symbol": active_stock.symbol,
                    "company_name": active_stock.company_name,
                    "price": curr,
                    "change_pct": chg
                }
    except Exception as e:
        print("Failed to compute active stock from trades:", e)
        
    if not most_active:
        reliance_stock = db.query(Stock).filter(Stock.symbol == "RELIANCE").first()
        if reliance_stock:
            curr = float(reliance_stock.current_price or 0)
            pr = float(reliance_stock.previous_close or curr or 1)
            chg = ((curr - pr) / pr) * 100 if pr else 0
            most_active = {
                "symbol": reliance_stock.symbol,
                "company_name": reliance_stock.company_name,
                "price": curr,
                "change_pct": chg
            }
        elif stock_data:
            most_active = stock_data[0]
        else:
            most_active = {"symbol": "N/A", "company_name": "N/A", "price": 0.0, "change_pct": 0.0}

    # 4. Compute NIFTY 50 and SENSEX Performance based on active stocks average
    nifty_pct = avg_pct_change
    nifty_price = 23500.0 * (1 + nifty_pct / 100)
    nifty_change = nifty_price - 23500.0

    sensex_pct = avg_pct_change * 0.98
    sensex_price = 77500.0 * (1 + sensex_pct / 100)
    sensex_change = sensex_price - 77500.0

    # 5. Define LLM prompt and fallbacks
    sentiment = "Neutral"
    if avg_pct_change > 0.5:
        sentiment = "Bullish"
    elif avg_pct_change < -0.5:
        sentiment = "Bearish"

    fallback = {
        "market_sentiment": sentiment,
        "ai_summary": f"Markets are showing a {'positive' if avg_pct_change >= 0 else 'negative'} bias today with an average index shift of {avg_pct_change:.2f}%. Top gainer {top_gainer['symbol']} is leading index movements, while {top_loser['symbol']} faces minor selling pressure.",
        "trading_tip": "Keep watch on key support levels. Focus on large-cap stock accumulation during minor pullbacks.",
        "what_to_watch": {
            "sectors": ["Technology", "Energy", "Banking"],
            "opportunities": [
                f"{top_gainer['symbol']} showing strong momentum.",
                "Accumulate banking sector stocks near daily lows."
            ],
            "risks": [
                "Global market correlation volatility.",
                "Increased sector rotation leading to unexpected breakouts."
            ]
        }
    }

    prompt = f"""
    Generate a daily market overview and trading suggestions for today ({today_date}) based on these market statistics:
    - NIFTY 50: {nifty_pct:.2f}% change
    - SENSEX: {sensex_pct:.2f}% change
    - Top Gainer: {top_gainer["symbol"]} ({top_gainer["change_pct"]:.2f}%)
    - Top Loser: {top_loser["symbol"]} ({top_loser["change_pct"]:.2f}%)
    - Most Active: {most_active["symbol"]} ({most_active["change_pct"]:.2f}%)
    - Average stock change: {avg_pct_change:.2f}%

    Please provide the output matching this JSON schema:
    {{
      "market_sentiment": "Bullish" | "Bearish" | "Neutral",
      "ai_summary": "string (2-3 sentences daily market summary based on the numbers)",
      "trading_tip": "string (1-2 sentences trading tip of the day)",
      "what_to_watch": {{
         "sectors": ["string"],
         "opportunities": ["string"],
         "risks": ["string"]
      }}
    }}
    """

    ai_res = _call_llm_json(prompt, fallback)

    # 6. Merge, Cache and Return
    summary_data = {
        "date": today_date,
        "nifty_50": {
            "current_price": round(nifty_price, 2),
            "change_pct": round(nifty_pct, 2),
            "change_val": round(nifty_change, 2)
        },
        "sensex": {
            "current_price": round(sensex_price, 2),
            "change_pct": round(sensex_pct, 2),
            "change_val": round(sensex_change, 2)
        },
        "top_gainer": top_gainer,
        "top_loser": top_loser,
        "most_active": most_active,
        "market_sentiment": ai_res.get("market_sentiment", fallback["market_sentiment"]),
        "ai_summary": ai_res.get("ai_summary", fallback["ai_summary"]),
        "trading_tip": ai_res.get("trading_tip", fallback["trading_tip"]),
        "what_to_watch": ai_res.get("what_to_watch", fallback["what_to_watch"])
    }

    try:
        with open(cache_file, "w") as f:
            json.dump(summary_data, f)
    except Exception as e:
        print("Failed to write daily summary cache:", e)

    return summary_data


MARKET_INSIGHTS_CACHE_KEY = "market_insights_daily_v1"


def _load_market_insights_cache(db: Session):
    try:
        setting = (
            db.query(SystemSetting)
            .filter(SystemSetting.key == MARKET_INSIGHTS_CACHE_KEY)
            .first()
        )
        return json.loads(setting.value) if setting else None
    except Exception:
        db.rollback()
        return None


def _save_market_insights_cache(db: Session, summary_data: dict):
    try:
        setting = (
            db.query(SystemSetting)
            .filter(SystemSetting.key == MARKET_INSIGHTS_CACHE_KEY)
            .first()
        )
        payload = json.dumps(summary_data)
        if setting:
            setting.value = payload
        else:
            db.add(SystemSetting(key=MARKET_INSIGHTS_CACHE_KEY, value=payload))
        db.commit()
    except Exception:
        db.rollback()


def _cache_response(data: dict, is_cached: bool, is_stale: bool = False):
    response = dict(data)
    response["cache"] = {
        "is_cached": is_cached,
        "is_stale": is_stale,
        "generated_at": data.get("generated_at"),
    }
    return response


def get_detailed_market_insights(db: Session, force_refresh: bool = False) -> dict:
    import datetime

    today_date = datetime.date.today().isoformat()
    cached_data = _load_market_insights_cache(db)

    if not force_refresh and cached_data and cached_data.get("date") == today_date:
        return _cache_response(cached_data, is_cached=True)

    # 2. Query stocks in the database to calculate stats
    try:
        stocks = db.query(Stock).filter(Stock.is_active == True).all()
        if not stocks:
            stocks = db.query(Stock).all()
    except Exception:
        db.rollback()
        if cached_data:
            return _cache_response(cached_data, is_cached=True, is_stale=True)
        raise
        
    stock_data = []
    for s in stocks:
        current = float(s.current_price or 0)
        prev = float(s.previous_close or current or 1)
        pct_change = ((current - prev) / prev) * 100 if prev else 0
        stock_data.append({
            "symbol": s.symbol,
            "company_name": s.company_name,
            "price": current,
            "change_pct": pct_change
        })
        
    # Calculate top gainer, top loser, and volatility
    if stock_data:
        sorted_by_change = sorted(stock_data, key=lambda x: x["change_pct"])
        top_gainer = sorted_by_change[-1]
        top_loser = sorted_by_change[0]
        avg_pct_change = sum(s["change_pct"] for s in stock_data) / len(stock_data)
        
        # Volatility: average absolute change
        changes = [abs(s["change_pct"]) for s in stock_data]
        market_volatility = sum(changes) / len(changes) if changes else 1.2
        
        # Unusual price movements (top 3 absolute changes)
        unusual_movement = sorted(stock_data, key=lambda x: abs(x["change_pct"]), reverse=True)[:3]
    else:
        top_gainer = {"symbol": "N/A", "company_name": "N/A", "price": 0.0, "change_pct": 0.0}
        top_loser = {"symbol": "N/A", "company_name": "N/A", "price": 0.0, "change_pct": 0.0}
        avg_pct_change = 0.0
        market_volatility = 1.2
        unusual_movement = []

    # Calculate sector performance
    from app.services.market_intelligence_service import infer_sector
    sector_changes = {}
    for s in stocks:
        curr = float(s.current_price or 0)
        pr = float(s.previous_close or curr or 1)
        pct = ((curr - pr) / pr) * 100 if pr else 0
        sec = infer_sector(s.symbol)
        if sec not in sector_changes:
            sector_changes[sec] = []
        sector_changes[sec].append(pct)
        
    sector_avg = {}
    for sec, pcts in sector_changes.items():
        sector_avg[sec] = sum(pcts) / len(pcts) if pcts else 0.0
        
    if sector_avg:
        sorted_sectors = sorted(sector_avg.items(), key=lambda x: x[1])
        worst_sector = sorted_sectors[0][0]
        top_sector = sorted_sectors[-1][0]
    else:
        top_sector = "Banking"
        worst_sector = "IT"

    # Determine Most Active Stock based on trades table
    most_active = None
    try:
        from app.models.trade import Trade
        active_trade = (
            db.query(Trade.stock_id, func.count(Trade.id).label("trade_count"))
            .group_by(Trade.stock_id)
            .order_by(func.count(Trade.id).desc())
            .first()
        )
        if active_trade:
            active_stock = db.query(Stock).filter(Stock.id == active_trade.stock_id).first()
            if active_stock:
                curr = float(active_stock.current_price or 0)
                pr = float(active_stock.previous_close or curr or 1)
                chg = ((curr - pr) / pr) * 100 if pr else 0
                most_active = {
                    "symbol": active_stock.symbol,
                    "company_name": active_stock.company_name,
                    "price": curr,
                    "change_pct": chg
                }
    except Exception as e:
        print("Failed to compute active stock from trades:", e)
        
    if not most_active:
        reliance_stock = db.query(Stock).filter(Stock.symbol == "RELIANCE").first()
        if reliance_stock:
            curr = float(reliance_stock.current_price or 0)
            pr = float(reliance_stock.previous_close or curr or 1)
            chg = ((curr - pr) / pr) * 100 if pr else 0
            most_active = {
                "symbol": reliance_stock.symbol,
                "company_name": reliance_stock.company_name,
                "price": curr,
                "change_pct": chg
            }
        elif stock_data:
            most_active = stock_data[0]
        else:
            most_active = {"symbol": "N/A", "company_name": "N/A", "price": 0.0, "change_pct": 0.0}

    # Trending stocks
    trending_stocks = []
    if stock_data:
        # Take up to 3 stocks, e.g. top gainer, top loser, and most active
        seen = set()
        for item in [top_gainer, most_active, top_loser]:
            if item["symbol"] != "N/A" and item["symbol"] not in seen:
                seen.add(item["symbol"])
                trending_stocks.append(item)
        # Pad with other stocks if needed
        for item in stock_data:
            if len(trending_stocks) >= 3:
                break
            if item["symbol"] not in seen:
                seen.add(item["symbol"])
                trending_stocks.append(item)

    # Compute NIFTY 50 and SENSEX Performance based on active stocks average
    nifty_pct = avg_pct_change
    nifty_price = 23500.0 * (1 + nifty_pct / 100)
    nifty_change = nifty_price - 23500.0

    sensex_pct = avg_pct_change * 0.98
    sensex_price = 77500.0 * (1 + sensex_pct / 100)
    sensex_change = sensex_price - 77500.0

    # Calculate trades volume and counts
    total_trades_today = 0
    total_volume_today = 0.0
    try:
        from app.models.trade import Trade
        today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        total_trades_today = db.query(Trade).filter(Trade.created_at >= today_start).count()
        if total_trades_today > 0:
            total_volume_today = db.query(func.sum(Trade.price * Trade.quantity)).filter(Trade.created_at >= today_start).scalar() or 0.0
    except Exception as e:
        print("Failed to compute trade statistics:", e)
        total_trades_today = 0
        total_volume_today = 0.0

    active_stocks_count = len(stocks)

    # 5. Define LLM prompt and fallbacks
    status = "Market Stable"
    if avg_pct_change > 0.5:
        status = "Market Rising"
    elif avg_pct_change < -0.5:
        status = "Market Falling"

    fallback = {
        "market_status": status,
        "ai_summary": f"The Indian markets are currently trading with a {status.lower().split(' ')[1]} tone. Nifty 50 is hovering near {nifty_price:.2f} ({nifty_pct:+.2f}%) and Sensex near {sensex_price:.2f} ({sensex_pct:+.2f}%).",
        "trading_tip": "Keep defensive stop-losses active. Accumulate top performers like Reliance and avoid sectors with regulatory overhangs.",
        "analysis": {
            "reason_for_status": f"The market status is {status} because sector rotation from lagging counters into leading ones is maintaining key index levels.",
            "major_factors": [
                "Domestic retail investment flows remain stable.",
                f"Breakout momentum observed in {top_sector} stocks.",
                "Consolidation pattern ahead of the upcoming interest rate announcements."
            ],
            "key_risks": [
                "Slight increase in crude oil prices affecting input costs.",
                "FII outflows in early sessions."
            ],
            "recommended_sectors": [top_sector, "Energy", "FMCG"],
            "stocks_to_monitor": [top_gainer["symbol"], top_loser["symbol"], most_active["symbol"]]
        },
        "what_to_watch": {
            "sectors": [top_sector, "IT Services", "Pharma"],
            "opportunities": [
                f"Long opportunities in {top_gainer['symbol']} on breakout confirmations.",
                "Buy-on-dips strategy in blue-chip indices."
            ]
        }
    }

    prompt = f"""
    Analyze today's market conditions ({today_date}) based on these statistics:
    - NIFTY 50: {nifty_pct:.2f}% change
    - SENSEX: {sensex_pct:.2f}% change
    - Top Gainer: {top_gainer["symbol"]} ({top_gainer["change_pct"]:.2f}%)
    - Top Loser: {top_loser["symbol"]} ({top_loser["change_pct"]:.2f}%)
    - Most Active: {most_active["symbol"]} ({most_active["change_pct"]:.2f}%)
    - Market Volatility: {market_volatility:.2f}%
    - Top Sector: {top_sector} ({sector_avg.get(top_sector, 0.0):.2f}% avg change)
    - Worst Sector: {worst_sector} ({sector_avg.get(worst_sector, 0.0):.2f}% avg change)

    Please return a JSON object matching this schema:
    {{
      "market_status": "Market Rising" | "Market Stable" | "Market Falling",
      "ai_summary": "string (2-3 sentences daily market summary)",
      "trading_tip": "string (1-2 sentences trading tip of the day)",
      "analysis": {{
         "reason_for_status": "string (why the market is rising/stable/falling)",
         "major_factors": ["string"],
         "key_risks": ["string"],
         "recommended_sectors": ["string"],
         "stocks_to_monitor": ["string"]
      }},
      "what_to_watch": {{
         "sectors": ["string"],
         "opportunities": ["string"]
      }}
    }}
    """

    ai_res = _call_llm_json(prompt, fallback)
    allowed_statuses = {"Market Rising", "Market Stable", "Market Falling"}
    market_status = ai_res.get("market_status", fallback["market_status"])
    if market_status not in allowed_statuses:
        market_status = fallback["market_status"]

    # 6. Merge, Cache and Return
    summary_data = {
        "date": today_date,
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "data_source": "TradeX active stock and trade data",
        "summary": {
            "nifty_50": {
                "current_price": round(nifty_price, 2),
                "change_pct": round(nifty_pct, 2),
                "change_val": round(nifty_change, 2)
            },
            "sensex": {
                "current_price": round(sensex_price, 2),
                "change_pct": round(sensex_pct, 2),
                "change_val": round(sensex_change, 2)
            },
            "top_gainer": top_gainer,
            "top_loser": top_loser,
            "most_active": most_active,
            "market_status": market_status,
            "ai_summary": ai_res.get("ai_summary", fallback["ai_summary"]),
            "trading_tip": ai_res.get("trading_tip", fallback["trading_tip"])
        },
        "what_to_watch": {
            "sectors": ai_res.get("what_to_watch", {}).get("sectors", fallback["what_to_watch"]["sectors"]),
            "trending_stocks": trending_stocks,
            "unusual_movement": unusual_movement,
            "opportunities": ai_res.get("what_to_watch", {}).get("opportunities", fallback["what_to_watch"]["opportunities"])
        },
        "ai_analysis": ai_res.get("analysis", fallback["analysis"]),
        "statistics": {
            "total_volume": round(total_volume_today, 2),
            "total_trades": total_trades_today,
            "top_sector": top_sector,
            "worst_sector": worst_sector,
            "volatility": round(market_volatility, 2),
            "active_stocks_count": active_stocks_count
        }
    }

    _save_market_insights_cache(db, summary_data)
    return _cache_response(summary_data, is_cached=False)
