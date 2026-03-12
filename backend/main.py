from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

import models
from database import engine, get_db
from engine import evaluate_market_health, generate_recommendations
from pydantic import BaseModel
import datetime
import re
from alpaca_trading import (
    submit_order, get_positions, close_position, 
    close_all_positions, get_orders, cancel_order,
    get_account, get_portfolio_history
)
from ai_engine import get_symbol_vibe, get_research_response

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Options Trader API")

# Configure CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MarketHealthResponse(BaseModel):
    status: str
    vix_level: float
    description: str

class StrategyLeg(BaseModel):
    strike: float
    side: str  # 'BUY' or 'SELL'
    type: str  # 'CALL' or 'PUT'
    premium: float
    symbol: str = "" # OCC Option Symbol

class StrategyDiagramData(BaseModel):
    underlying_price: float
    strategy_type: str
    legs: List[StrategyLeg]

class TradeRecommendation(BaseModel):
    symbol: str
    strategy: str
    side: str
    thesis: str
    expiration: str
    target_entry: str
    pop: str
    risk_reward: str
    confidence: str
    diagram_data: StrategyDiagramData

class AccountResponse(BaseModel):
    buying_power: float
    cash: float
    equity: float
    long_market_value: float
    day_change: float
    day_change_percent: float

class PortfolioHistoryResponse(BaseModel):
    timestamp: List[int]
    equity: List[float]
    profit_loss: List[float]
    profit_loss_pct: List[float]
    base_value: float

class TradeCreate(BaseModel):
    symbol: str
    strategy: str
    side: str = "buy"
    entry_price: float
    quantity: int
    legs: List[StrategyLeg] = None

class TradeResponse(BaseModel):
    id: str
    symbol: str
    strategy: str
    entry_price: float
    current_price: float = 0.0
    quantity: int
    market_value: float = 0.0
    unrealized_pl: float = 0.0
    unrealized_plpc: float = 0.0
    underlying_price: float = 0.0
    status: str
    side: str = "buy"
    opened_at: datetime.datetime

    class Config:
        from_attributes = True

class ChatRequest(BaseModel):
    question: str
    context: str = ""
    model: str = "gemini-flash-latest"

@app.get("/analysis/{symbol}")
async def analyze_symbol(symbol: str, model: str = "gemini-flash-latest"):
    try:
        from data_fetcher import get_stock_bars, get_financial_news
        # Get latest price info
        bars = get_stock_bars(symbol, period="1D")
        latest_price = bars[-1]["close"] if bars else 0
        prev_price = bars[-2]["close"] if len(bars) > 1 else latest_price
        change_pct = ((latest_price - prev_price) / prev_price * 100) if prev_price != 0 else 0
        
        # Get news
        news = get_financial_news(limit=5)
        headlines = " | ".join([n['headline'] for n in news])

        # Get performance trends for context
        bars_3m = get_stock_bars(symbol, period="3M")
        perf_3m = ((latest_price - bars_3m[0]["close"]) / bars_3m[0]["close"] * 100) if bars_3m else 0
        
        bars_12m = get_stock_bars(symbol, period="12M")
        perf_12m = ((latest_price - bars_12m[0]["close"]) / bars_12m[0]["close"] * 100) if bars_12m else 0

        # Synthesize vibe
        from ai_engine import get_symbol_vibe
        vibe_context = {
            "price": latest_price, 
            "change_percent": round(change_pct, 2),
            "trend_3m": round(perf_3m, 2),
            "trend_12m": round(perf_12m, 2)
        }
        vibe = get_symbol_vibe(symbol, vibe_context, headlines, model_name=model)
        
        # Ensure trends are included in the final vibe object for the frontend/sidecar context
        vibe.update({
            "trend_3m": vibe_context["trend_3m"],
            "trend_12m": vibe_context["trend_12m"]
        })
        
        # Calculate/Simulate Advanced Greeks
        from data_fetcher import get_vix_level
        vix = get_vix_level()
        
        # Determine Greeks based on symbol and volatility
        import random
        base_iv = vix / 100.0
        # If it's a volatile stock, IV is higher
        if symbol in ["TSLA", "NVDA", "BTC"]:
            base_iv *= 1.8
        
        greeks = {
            "iv": round(base_iv * 100, 1),
            "iv_percentile": random.randint(65, 95) if vix > 20 else random.randint(20, 50),
            "delta_skew": "Bullish" if change_pct > 0 else "Bearish" if change_pct < -1 else "Neutral",
            "theta": round(-0.01 * (latest_price / 100) * (base_iv * 10), 3),
            "gamma": round(0.002 * (100 / latest_price), 4),
            "vega": round(0.05 * (latest_price / 100), 3),
            "delta": 0.52 if change_pct > 0 else 0.48
        }

        return {
            "symbol": symbol,
            "price": latest_price,
            "change_pct": round(change_pct, 2),
            "vibe": vibe,
            "news": news,
            "greeks": greeks
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/chat/{symbol}")
async def chat_symbol(symbol: str, request: ChatRequest):
    try:
        from ai_engine import get_research_response
        response = get_research_response(symbol, request.question, request.context, model_name=request.model)
        return {"answer": response}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/")
def read_root():
    return {"message": "Welcome to AI Options Trader API"}

@app.get("/market-health", response_model=MarketHealthResponse)
def get_market_health():
    return evaluate_market_health()

@app.get("/scanner")
def get_etf_scanner_data(symbols: str = None):
    from data_fetcher import get_macro_etfs
    symbol_list = symbols.split(",") if symbols else None
    return get_macro_etfs(symbols=symbol_list)

@app.get("/news")
def get_news_feed():
    from data_fetcher import get_financial_news
    return get_financial_news(limit=10)

@app.get("/stocks/{symbol}/bars")
def get_stock_historical_bars(symbol: str, period: str = "3M"):
    try:
        from data_fetcher import get_stock_bars
        bars = get_stock_bars(symbol, period=period)
        return bars
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/recommendations", response_model=List[TradeRecommendation])
def get_top_recommendations(symbols: str = None):
    symbol_list = symbols.split(",") if symbols else None
    recs = generate_recommendations(symbols=symbol_list)
    return recs

@app.get("/account", response_model=AccountResponse)
def get_alpaca_account():
    try:
        acc = get_account()
        # Calculate daily change
        equity = float(acc["equity"])
        last_equity = float(acc["last_equity"])
        day_change = equity - last_equity
        day_change_pct = (day_change / last_equity) * 100 if last_equity != 0 else 0
        
        return AccountResponse(
            buying_power=float(acc["buying_power"]),
            cash=float(acc["cash"]),
            equity=equity,
            long_market_value=float(acc["long_market_value"]),
            day_change=day_change,
            day_change_percent=day_change_pct
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/portfolio/history", response_model=PortfolioHistoryResponse)
def get_alpaca_portfolio_history(period: str = "1D"):
    try:
        history = get_portfolio_history(period=period)
        return PortfolioHistoryResponse(
            timestamp=history.get("timestamp", []),
            equity=history.get("equity", []),
            profit_loss=history.get("profit_loss", []),
            profit_loss_pct=history.get("profit_loss_pct", []),
            base_value=float(history.get("base_value", 0))
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/trades", response_model=TradeResponse)
def execute_paper_trade(trade: TradeCreate):
    try:
        from alpaca_trading import submit_options_order, submit_order
        
        # Check if this is an options trade with legs
        if trade.legs and len(trade.legs) > 0:
            legs_data = [{"symbol": leg.symbol, "side": leg.side, "ratio_qty": 1} for leg in trade.legs]
            
            # Handle Covered Call buy-write scenario
            if trade.strategy.lower() == "covered call":
                positions = get_positions()
                current_qty = 0
                for p in positions:
                    if p["symbol"] == trade.symbol:
                        current_qty = int(float(p.get("qty", 0)))
                        break
                
                required_qty = trade.quantity * 100
                if current_qty < required_qty:
                    # Submit separate equity order instead of mixing legs (Alpaca constraint)
                    submit_order(trade.symbol, required_qty - current_qty, "buy")
                    
                    # Robust polling to ensure Alpaca recognizes the "covered" status
                    import time
                    max_retries = 12
                    for i in range(max_retries):
                        time.sleep(1)
                        positions = get_positions()
                        new_qty = 0
                        for p in positions:
                            if p["symbol"] == trade.symbol:
                                new_qty = int(float(p.get("qty", 0)))
                                break
                        if new_qty >= required_qty:
                            break
            
            submit_options_order(trade.strategy, legs_data, trade.quantity)
            
            return TradeResponse(
                id=trade.symbol,
                symbol=trade.symbol,
                strategy=trade.strategy,
                entry_price=trade.entry_price,
                quantity=trade.quantity,
                status="OPEN",
                opened_at=datetime.datetime.utcnow(),
                side=trade.side.lower()
            )
            
        # Fallback to stock proxy simulation (v1) if no legs are provided
        strategy_lower = trade.strategy.lower()
        bullish_strategies = [
            "put credit spread", "covered call", "iron condor", 
            "long call", "atm leap", "bull call debit spread",
            "long straddle", "long strangle"
        ]
        
        order_side = "buy"
        if any(s in strategy_lower for s in bullish_strategies):
            order_side = "buy"
        elif "put" in strategy_lower and "long" in strategy_lower:
            order_side = "sell"
        else:
            order_side = trade.side.lower()

        qty_to_buy = max(1, trade.quantity * 10)
        submit_order(trade.symbol, qty_to_buy, order_side)
        
        return TradeResponse(
            id=trade.symbol,
            symbol=trade.symbol,
            strategy=trade.strategy,
            entry_price=trade.entry_price,
            quantity=qty_to_buy,
            status="OPEN",
            opened_at=datetime.datetime.utcnow(),
            side=order_side
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/trades", response_model=List[TradeResponse])
def get_open_trades(status: str = "open"):
    try:
        if status == "all":
            # Fetch both positions and recent closed orders
            positions = get_positions()
            closed_orders = get_orders(status="closed", limit=20)
            open_orders = get_orders(status="open")
            
            trades = []
            # Build a lookup for underlying prices
            symbol_price_map = {p["symbol"]: float(p.get("current_price") or 0.0) for p in positions}
            
            for p in positions:
                sym = p["symbol"]
                u_price = float(p.get("last_underlying_price") or 0.0)
                
                # If it's an option and u_price is missing, try to derive it from the stock position
                if not u_price and any(c.isdigit() for c in sym) and len(sym) > 10:
                    # Extract underlying from OCC (e.g., SBUX260417P00095000 -> SBUX)
                    match = re.search(r'^([A-Z]+)\d', sym)
                    if match:
                        u_sym = match.group(1)
                        u_price = symbol_price_map.get(u_sym, 0.0)
                
                # Final fallback to current price if still 0 (for stocks)
                if not u_price:
                    u_price = float(p.get("current_price") or 0.0)

                trades.append(TradeResponse(
                    id=p["symbol"],
                    symbol=p["symbol"],
                    strategy="Position",
                    entry_price=float(p.get("avg_entry_price", 0.0)),
                    current_price=float(p.get("current_price", 0.0)),
                    quantity=abs(int(float(p.get("qty", 0)))),
                    market_value=float(p.get("market_value", 0.0)),
                    unrealized_pl=float(p.get("unrealized_pl", 0.0)),
                    unrealized_plpc=float(p.get("unrealized_plpc", 0.0)) * 100,
                    underlying_price=u_price,
                    status="OPEN",
                    side=p.get("side", "long"),
                    opened_at=datetime.datetime.utcnow()
                ))
            
            for o in open_orders:
                trades.append(TradeResponse(
                    id=o["id"],
                    symbol=o["symbol"],
                    strategy=f"{o['type'].capitalize()} {o['side'].capitalize()}",
                    entry_price=0.0,
                    current_price=0.0,
                    quantity=abs(int(float(o.get("qty", 0)))),
                    status="PENDING",
                    side=o["side"],
                    opened_at=datetime.datetime.fromisoformat(o["created_at"].replace('Z', '+00:00'))
                ))

            for o in closed_orders:
                trades.append(TradeResponse(
                    id=o["id"],
                    symbol=o["symbol"],
                    strategy=f"{o['type'].capitalize()} {o['side'].capitalize()}",
                    entry_price=float(o.get("filled_avg_price") or 0.0),
                    current_price=float(o.get("filled_avg_price") or 0.0),
                    quantity=abs(int(float(o.get("filled_qty", 0)))),
                    status=o["status"].upper(),
                    side=o["side"],
                    opened_at=datetime.datetime.fromisoformat(o["created_at"].replace('Z', '+00:00'))
                ))
            return trades
        
        # Default behavior: Just open positions and open orders
        positions = get_positions()
        orders = get_orders(status="open")
        # Build a lookup for underlying prices
        symbol_price_map = {p["symbol"]: float(p.get("current_price") or 0.0) for p in positions}
        
        trades = []
        for p in positions:
            sym = p["symbol"]
            u_price = float(p.get("last_underlying_price") or 0.0)
            
            if not u_price and any(c.isdigit() for c in sym) and len(sym) > 10:
                match = re.search(r'^([A-Z]+)\d', sym)
                if match:
                    u_sym = match.group(1)
                    u_price = symbol_price_map.get(u_sym, 0.0)
            
            if not u_price:
                u_price = float(p.get("current_price") or 0.0)

            trades.append(TradeResponse(
                id=p["symbol"],
                symbol=p["symbol"],
                strategy="Position",
                entry_price=float(p.get("avg_entry_price", 0.0)),
                current_price=float(p.get("current_price", 0.0)),
                quantity=abs(int(float(p.get("qty", 0)))),
                market_value=float(p.get("market_value", 0.0)),
                unrealized_pl=float(p.get("unrealized_pl", 0.0)),
                unrealized_plpc=float(p.get("unrealized_plpc", 0.0)) * 100,
                underlying_price=u_price,
                status="OPEN",
                side=p.get("side", "long"),
                opened_at=datetime.datetime.utcnow()
            ))
        for o in orders:
            trades.append(TradeResponse(
                id=o["id"],
                symbol=o["symbol"],
                strategy=f"{o['type'].capitalize()} {o['side'].capitalize()}",
                entry_price=0.0,
                current_price=0.0,
                quantity=abs(int(float(o.get("qty", 0)))),
                status="PENDING",
                side=o["side"],
                opened_at=datetime.datetime.fromisoformat(o["created_at"].replace('Z', '+00:00'))
            ))
        return trades
    except Exception as e:
        print(f"Error fetching positions/orders: {e}")
        return []

@app.delete("/trades/{symbol_or_id}", response_model=dict)
def delete_paper_trade(symbol_or_id: str):
    try:
        # Robust check: Alpaca Order IDs are UUIDs. OCC symbols are 21 chars.
        # UUID pattern: 8-4-4-4-12 hex chars
        uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
        
        if uuid_pattern.match(symbol_or_id):  
            cancel_order(symbol_or_id)
            return {"message": "Pending order cancelled successfully"}
        else:
            close_position(symbol_or_id)
            return {"message": "Position liquidated successfully"}
    except Exception as e:
        # Log the full error but send the detail back to the frontend
        print(f"Delete trade error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/trades/{symbol_or_id}/close", response_model=dict)
def close_paper_trade(symbol_or_id: str):
    try:
        uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
        
        if uuid_pattern.match(symbol_or_id):
            cancel_order(symbol_or_id)
            return {"message": "Pending order cancelled successfully"}
        else:
            print(f"Closing position for: {symbol_or_id}") # Debug log
            close_position(symbol_or_id)
            return {"message": "Position closed successfully"}
    except Exception as e:
        print(f"Close trade error: {str(e)}")
        import traceback
        traceback.print_exc()
        # Extract the core message if it's an Alpaca error string
        error_msg = str(e)
        if "market is closed" in error_msg.lower():
            error_msg = "Market is currently closed. Alpaca does not allow liquidating options after hours."
        raise HTTPException(status_code=400, detail=error_msg)

@app.delete("/trades", response_model=dict)
def reset_all_trades():
    try:
        close_all_positions()
        return {"message": "All portfolio positions liquidated"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
