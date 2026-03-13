from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlalchemy.orm import Session
from typing import List, Optional

import models
from database import engine, get_db
from engine import evaluate_market_health, generate_recommendations
from pydantic import BaseModel
import datetime
import re
import time
import os
import json
import traceback
from alpaca_trading import (
    submit_order, get_positions, close_position, 
    close_all_positions, get_orders, cancel_order,
    get_account, get_portfolio_history
)
from data_fetcher import get_stock_price
from ai_engine import get_symbol_vibe, get_research_response

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Options Trader API")

# Global executor for price fetches and other I/O - expanded for high concurrency
_GLOBAL_EXECUTOR = ThreadPoolExecutor(max_workers=100)

# Simple locks to prevent redundant parallel scans
_SCAN_LOCKS = {}
_LAST_RESULT_CACHE = {}

# Configure CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def parse_dte(symbol: str) -> int | None:
    """Calculates days to expiration from an OCC symbol."""
    match = re.search(r'(\d{6})[CP]\d{8}$', symbol)
    if not match:
        return None
    
    date_str = match.group(1)
    try:
        exp_date = datetime.datetime.strptime(date_str, "%y%m%d").date()
        today = datetime.date.today()
        delta = (exp_date - today).days
        return max(0, delta)
    except:
        return None

class AIRecommendation(BaseModel):
    action: str  # HOLD, CLOSE, ROLL
    rationale: str
    confidence: int  # 0-100
    details: List[str]

class MarketHealthResponse(BaseModel):
    status: str
    vix_level: float
    description: str
    risk_score: int = 50
    market_mood: str = "Neutral"
    global_thesis: str = ""

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

class NewsAnalysisRequest(BaseModel):
    headline: str
    summary: str
    positions: List[str]

class TradeCreate(BaseModel):
    symbol: str
    strategy: str
    side: str = "buy"
    entry_price: float
    quantity: int
    legs: Optional[List[StrategyLeg]] = None

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
    ai_rec: Optional[AIRecommendation] = None
    legs: Optional[List[StrategyLeg]] = None

    class Config:
        from_attributes = True

class TradeUpdate(BaseModel):
    limit_price: float = None
    quantity: int = None

class ChatRequest(BaseModel):
    question: str
    context: str = ""
    model: str = "gemini-flash-latest"

class RepriceRequest(BaseModel):
    symbol: str
    strategy: str
    expiration: str

# Global cache for symbol vibes/analysis
_VIBE_CACHE_FILE = os.path.join("data", "symbol_vibe_cache.json")
_SYMBOL_VIBE_CACHE = {} 
_VIBE_TTL_SECONDS = 900 # 15 minutes

def _save_vibe_cache():
    try:
        serializable = {s: {"data": d, "ts": ts.isoformat()} for s, (d, ts) in _SYMBOL_VIBE_CACHE.items() if d != "FETCHING"}
        with open(_VIBE_CACHE_FILE, "w") as f:
            json.dump(serializable, f)
    except Exception as e:
        print(f"Error saving vibe cache: {e}")

def _load_vibe_cache():
    global _SYMBOL_VIBE_CACHE
    if os.path.exists(_VIBE_CACHE_FILE):
        try:
            with open(_VIBE_CACHE_FILE, "r") as f:
                data = json.load(f)
                _SYMBOL_VIBE_CACHE = {s: (d["data"], datetime.datetime.fromisoformat(d["ts"])) for s, d in data.items()}
                print(f"DEBUG: Loaded {len(_SYMBOL_VIBE_CACHE)} symbol vibes from file cache.")
        except Exception as e:
            print(f"Error loading vibe cache: {e}")

_load_vibe_cache()

@app.get("/analysis/{symbol}")
async def analyze_symbol(symbol: str, model: str = "gemini-flash-latest"):
    now = datetime.datetime.now()
    if symbol in _SYMBOL_VIBE_CACHE:
        cache_data, timestamp = _SYMBOL_VIBE_CACHE[symbol]
        age = (now - timestamp).total_seconds()
        if age < _VIBE_TTL_SECONDS:
            if cache_data == "FETCHING":
                if age < 30:
                    return {"vibe": {"sentiment": "Neutral", "global_thesis": "Analysis in progress...", "description": "Market pulse is being synthesized. Refresh in a few seconds."}, "status": "processing"}
            else:
                return cache_data

    _SYMBOL_VIBE_CACHE[symbol] = ("FETCHING", now)
    try:
        from data_fetcher import get_stock_bars, get_financial_news
        bars = get_stock_bars(symbol, period="1D")
        latest_price = bars[-1]["close"] if bars else 0
        prev_price = bars[-2]["close"] if len(bars) > 1 else latest_price
        change_pct = ((latest_price - prev_price) / prev_price * 100) if prev_price != 0 else 0
        news = get_financial_news(limit=5)
        headlines = " | ".join([n['headline'] for n in news])
        bars_3m = get_stock_bars(symbol, period="3M")
        perf_3m = ((latest_price - bars_3m[0]["close"]) / bars_3m[0]["close"] * 100) if bars_3m else 0
        bars_12m = get_stock_bars(symbol, period="12M")
        perf_12m = ((latest_price - bars_12m[0]["close"]) / bars_12m[0]["close"] * 100) if bars_12m else 0
        from ai_engine import get_symbol_vibe
        vibe_context = {"price": latest_price, "change_percent": round(change_pct, 2), "trend_3m": round(perf_3m, 2), "trend_12m": round(perf_12m, 2)}
        vibe = get_symbol_vibe(symbol, vibe_context, headlines, model_name=model)
        vibe.update({"trend_3m": vibe_context["trend_3m"], "trend_12m": vibe_context["trend_12m"]})
        from data_fetcher import get_vix_level
        vix = get_vix_level()
        import random
        base_iv = vix / 100.0
        if symbol in ["TSLA", "NVDA", "BTC"]: base_iv *= 1.8
        greeks = {
            "iv": round(base_iv * 100, 1),
            "iv_percentile": random.randint(65, 95) if vix > 20 else random.randint(20, 50),
            "delta_skew": "Bullish" if change_pct > 0 else "Bearish" if change_pct < -1 else "Neutral",
            "theta": round(-0.01 * (latest_price / 100) * (base_iv * 10), 3),
            "gamma": round(0.002 * (100 / latest_price), 4),
            "vega": round(0.05 * (latest_price / 100), 3),
            "delta": 0.52 if change_pct > 0 else 0.48
        }
        result_data = {"symbol": symbol, "price": latest_price, "change_pct": round(change_pct, 2), "vibe": vibe, "news": news, "greeks": greeks}
        _SYMBOL_VIBE_CACHE[symbol] = (result_data, now)
        _save_vibe_cache()
        return result_data
    except Exception as e:
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

import asyncio

# Global locks for thread-safe/async-safe request management
_REQUEST_LOCKS = {}

def get_lock(key: str) -> asyncio.Lock:
    if key not in _REQUEST_LOCKS:
        _REQUEST_LOCKS[key] = asyncio.Lock()
    return _REQUEST_LOCKS[key]

@app.get("/market-health", response_model=MarketHealthResponse)
async def get_market_health():
    # evaluate_market_health already has its own internal lock/cache logic
    return evaluate_market_health()

@app.get("/scanner")
async def get_etf_scanner_data(symbols: str = None):
    now = time.time()
    lock_key = f"scanner_{symbols}"
    
    # 1. Quick check cache before lock (opportunistic)
    if lock_key in _LAST_RESULT_CACHE and (now - _SCAN_LOCKS.get(lock_key, 0)) < 15.0:
        return _LAST_RESULT_CACHE[lock_key]

    async with get_lock(lock_key):
        # 2. Check cache again after acquiring lock (handle overlapping requests)
        now = time.time()
        if lock_key in _LAST_RESULT_CACHE and (now - _SCAN_LOCKS.get(lock_key, 0)) < 15.0:
            return _LAST_RESULT_CACHE[lock_key]
            
        try:
            from data_fetcher import get_macro_etfs
            symbol_list = symbols.split(",") if symbols else None
            # Move heavy blocking I/O to thread pool
            result = await asyncio.get_event_loop().run_in_executor(
                _GLOBAL_EXECUTOR, get_macro_etfs, symbol_list
            )
            _LAST_RESULT_CACHE[lock_key] = result
            _SCAN_LOCKS[lock_key] = now
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@app.get("/recommendations", response_model=List[TradeRecommendation])
async def get_top_recommendations(symbols: str = None, limit: int = None):
    now = time.time()
    lock_key = f"recommendations_{symbols}_{limit}"
    
    if lock_key in _LAST_RESULT_CACHE and (now - _SCAN_LOCKS.get(lock_key, 0)) < 30.0:
        return _LAST_RESULT_CACHE[lock_key]

    async with get_lock(lock_key):
        now = time.time()
        if lock_key in _LAST_RESULT_CACHE and (now - _SCAN_LOCKS.get(lock_key, 0)) < 30.0:
            return _LAST_RESULT_CACHE[lock_key]

        try:
            symbol_list = symbols.split(",") if symbols else None
            # recommendations are very slow, use long timeout
            recs = await asyncio.get_event_loop().run_in_executor(
                _GLOBAL_EXECUTOR, generate_recommendations, symbol_list, limit
            )
            _LAST_RESULT_CACHE[lock_key] = recs
            _SCAN_LOCKS[lock_key] = now
            return recs
        except Exception as e:
            traceback.print_exc()
            raise HTTPException(status_code=500, detail="Recommendation engine timeout or failure")

@app.get("/trades", response_model=List[TradeResponse])
async def get_all_trades(status: str = "open"):
    now = time.time()
    lock_key = f"trades_{status}"
    
    # Check cache first
    if lock_key in _LAST_RESULT_CACHE and (now - _SCAN_LOCKS.get(lock_key, 0)) < 2.0:
        return _LAST_RESULT_CACHE[lock_key]

    async with get_lock(lock_key):
        # Double-check cache after lock
        now = time.time()
        if lock_key in _LAST_RESULT_CACHE and (now - _SCAN_LOCKS.get(lock_key, 0)) < 2.0:
            return _LAST_RESULT_CACHE[lock_key]

        try:
            from engine import evaluate_position_health, evaluate_market_health
            health = await asyncio.get_event_loop().run_in_executor(_GLOBAL_EXECUTOR, evaluate_market_health)
            
            # Fetch data from Alpaca
            if status == "all":
                positions = await asyncio.get_event_loop().run_in_executor(_GLOBAL_EXECUTOR, get_positions)
                closed_orders = await asyncio.get_event_loop().run_in_executor(_GLOBAL_EXECUTOR, get_orders, "closed", 10)
                open_orders = await asyncio.get_event_loop().run_in_executor(_GLOBAL_EXECUTOR, get_orders, "open")
            else:
                positions = await asyncio.get_event_loop().run_in_executor(_GLOBAL_EXECUTOR, get_positions)
                open_orders = await asyncio.get_event_loop().run_in_executor(_GLOBAL_EXECUTOR, get_orders, "open")
                closed_orders = []

            # Map for underlying prices
            symbol_price_map = {p["symbol"]: float(p.get("current_price") or 0.0) for p in positions}
            symbols_to_fetch = set()
            for p in positions:
                sym = p["symbol"]
                is_option = any(c.isdigit() for c in sym) and len(sym) > 10
                if is_option:
                    match = re.search(r'^([A-Z]+)\d', sym)
                    if match:
                        u_sym = match.group(1)
                        if u_sym not in symbol_price_map: symbols_to_fetch.add(u_sym)
                else: symbols_to_fetch.add(sym)

            # Parallel price fetch for underlyings not in positions
            fetched_prices = {}
            if symbols_to_fetch:
                tasks = []
                for s in symbols_to_fetch:
                    tasks.append(asyncio.get_event_loop().run_in_executor(_GLOBAL_EXECUTOR, get_stock_price, s))
                
                # Use gather with return_exceptions=True
                prices = await asyncio.gather(*tasks, return_exceptions=True)
                for s, p in zip(symbols_to_fetch, prices):
                    fetched_prices[s] = p if isinstance(p, (int, float)) else 0.0

            trades = []
            # Process positions
            for p in positions:
                sym = p["symbol"]
                u_price = float(p.get("last_underlying_price") or 0.0)
                is_option = any(c.isdigit() for c in sym) and len(sym) > 10
                if not u_price and is_option:
                    match = re.search(r'^([A-Z]+)\d', sym)
                    if match:
                        u_sym = match.group(1)
                        u_price = symbol_price_map.get(u_sym, 0.0) or fetched_prices.get(u_sym, 0.0)
                if not u_price: u_price = fetched_prices.get(sym, float(p.get("current_price") or 0.0))
                
                trades.append(TradeResponse(
                    id=p["symbol"], symbol=p["symbol"], strategy="Position",
                    entry_price=float(p.get("avg_entry_price", 0.0)),
                    current_price=float(p.get("current_price", 0.0)),
                    quantity=abs(int(float(p.get("qty", 0)))),
                    market_value=float(p.get("market_value", 0.0)),
                    unrealized_pl=float(p.get("unrealized_pl", 0.0)),
                    unrealized_plpc=float(p.get("unrealized_plpc", 0.0)) * 100,
                    underlying_price=u_price, status="OPEN", side=p.get("side", "long"),
                    opened_at=datetime.datetime.utcnow(),
                    ai_rec=evaluate_position_health(p["symbol"], "Position", float(p.get("unrealized_plpc", 0.0)) * 100, parse_dte(p["symbol"]), health)
                ))

            # Process orders
            for o in open_orders: trades.append(_map_alpaca_order_to_trade_response(o))
            for o in closed_orders: trades.append(_map_alpaca_order_to_trade_response(o))
            
            _LAST_RESULT_CACHE[lock_key] = trades
            _SCAN_LOCKS[lock_key] = now
            return trades
        except Exception as e:
            traceback.print_exc()
            return []

@app.get("/news")
async def get_news_feed():
    try:
        from data_fetcher import get_financial_news
        news = await asyncio.get_event_loop().run_in_executor(_GLOBAL_EXECUTOR, get_financial_news, 10)
        return news
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/news/analyze")
async def analyze_news_api(req: NewsAnalysisRequest):
    try:
        from ai_engine import analyze_news_impact
        # Pass portfolio_context as a list if present
        impact = await asyncio.get_event_loop().run_in_executor(
            _GLOBAL_EXECUTOR, analyze_news_impact, req.headline, req.summary, req.positions
        )
        return impact
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stocks/{symbol}/bars")
async def get_stock_historical_bars_api(symbol: str, period: str = "3M"):
    try:
        from data_fetcher import get_stock_bars
        bars = await asyncio.get_event_loop().run_in_executor(_GLOBAL_EXECUTOR, get_stock_bars, symbol, period)
        return bars
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/options/expirations/{symbol}")
async def get_symbol_expirations_api(symbol: str):
    try:
        from data_fetcher import get_all_expirations
        exps = await asyncio.get_event_loop().run_in_executor(_GLOBAL_EXECUTOR, get_all_expirations, symbol)
        return exps
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/options/reprice", response_model=Optional[dict])
async def reprice_trade_strategy_api(req: RepriceRequest):
    try:
        from engine import reprice_strategy
        res = await asyncio.get_event_loop().run_in_executor(
            _GLOBAL_EXECUTOR, reprice_strategy, req.symbol, req.strategy, req.expiration
        )
        if not res:
            raise HTTPException(status_code=404, detail="Could not reprice strategy for this expiration.")
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/account", response_model=AccountResponse)
async def get_alpaca_account_data():
    try:
        acc = await asyncio.get_event_loop().run_in_executor(_GLOBAL_EXECUTOR, get_account)
        equity = float(acc["equity"])
        last_equity = float(acc.get("last_equity", equity))
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
async def get_alpaca_portfolio_history_data(period: str = "1D"):
    try:
        history = await asyncio.get_event_loop().run_in_executor(_GLOBAL_EXECUTOR, get_portfolio_history, period)
        return PortfolioHistoryResponse(
            timestamp=history.get("timestamp", []),
            equity=history.get("equity", []),
            profit_loss=history.get("profit_loss", []),
            profit_loss_pct=history.get("profit_loss_pct", []),
            base_value=float(history.get("base_value", 0))
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

def execute_paper_trade(trade: TradeCreate):
    try:
        from alpaca_trading import submit_options_order, submit_order
        if trade.legs and len(trade.legs) > 0:
            legs_data = [{"symbol": leg.symbol, "side": leg.side, "ratio_qty": 1} for leg in trade.legs if leg.type.upper() in ["CALL", "PUT"]]
            if trade.strategy.lower() == "covered call":
                positions = get_positions()
                current_qty = 0
                for p in positions:
                    if p["symbol"] == trade.symbol:
                        current_qty = int(float(p.get("qty", 0)))
                        break
                required_qty = trade.quantity * 100
                if current_qty < required_qty:
                    submit_order(trade.symbol, required_qty - current_qty, "buy")
                    time.sleep(2)
                    for _ in range(15):
                        positions = get_positions()
                        new_qty = 0
                        for p in positions:
                            if p["symbol"] == trade.symbol:
                                new_qty = int(float(p.get("qty", 0)))
                                break
                        if new_qty >= required_qty:
                            time.sleep(2)
                            break
                        time.sleep(1)
            limit_price = 0
            has_options = False
            if trade.entry_price is not None and trade.entry_price != 0:
                limit_price = trade.entry_price
                has_options = True
                if "credit" in trade.strategy.lower() and limit_price > 0: limit_price = -limit_price
            else:
                for leg in trade.legs:
                    if leg.type.upper() in ["CALL", "PUT"]:
                        has_options = True
                        if leg.side.upper() in ["BUY", "LONG"]: limit_price += leg.premium
                        else: limit_price -= leg.premium
            try:
                order_data = submit_options_order(trade.strategy, legs_data, trade.quantity, limit_price if has_options else None)
            except Exception as e:
                if "uncovered option" in str(e).lower():
                    time.sleep(5)
                    order_data = submit_options_order(trade.strategy, legs_data, trade.quantity, limit_price if has_options else None)
                else: raise e
            from alpaca_trading import get_order
            order_id = order_data.get("id")
            final_status = order_data.get("status", "OPEN")
            if order_id:
                for _ in range(5):
                    time.sleep(1)
                    poll_data = get_order(order_id)
                    if poll_data:
                        final_status = poll_data.get("status", final_status)
                        if final_status == "filled": break
            return TradeResponse(id=trade.symbol, symbol=trade.symbol, strategy=trade.strategy, entry_price=trade.entry_price, quantity=trade.quantity, status=final_status.upper(), opened_at=datetime.datetime.utcnow(), side=trade.side.lower())
        strategy_lower = trade.strategy.lower()
        bullish_strategies = ["put credit spread", "covered call", "iron condor", "long call", "atm leap", "bull call debit spread", "long straddle", "long strangle"]
        order_side = "buy"
        if any(s in strategy_lower for s in bullish_strategies): order_side = "buy"
        elif "put" in strategy_lower and "long" in strategy_lower: order_side = "sell"
        else: order_side = trade.side.lower()
        qty_to_buy = max(1, trade.quantity * 10)
        submit_order(trade.symbol, qty_to_buy, order_side)
        return TradeResponse(id=trade.symbol, symbol=trade.symbol, strategy=trade.strategy, entry_price=trade.entry_price, quantity=qty_to_buy, status="OPEN", opened_at=datetime.datetime.utcnow(), side=order_side)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

def _map_alpaca_order_to_trade_response(o: dict) -> TradeResponse:
    sym = o.get("symbol")
    side = o.get("side") or "buy"
    if not sym and o.get("legs"):
        leg_symbol = o["legs"][0].get("symbol", "")
        match = re.search(r'^([A-Z]+)\d', leg_symbol)
        if match: sym = match.group(1)
        if not o.get("side"):
            leg_side = o["legs"][0].get("side", "")
            side = "buy" if "buy" in leg_side.lower() else "sell"
    order_type = o.get("type", "limit").capitalize()
    strategy_name = f"{order_type} {side.capitalize()}"
    if o.get("order_class") == "mleg": strategy_name = f"Spread {side.capitalize()}"
    status = o.get("status", "OPEN").upper()
    if status in ["NEW", "ACCEPTED"]: status = "PENDING"
    legs = []
    if o.get("legs"):
        for l in o["legs"]:
            leg_sym = l.get("symbol", "")
            strike = 0.0
            l_type = "CALL"
            match = re.search(r'([CP])(\d{8})$', leg_sym)
            if match:
                l_type = "CALL" if match.group(1) == "C" else "PUT"
                strike = float(match.group(2)) / 1000.0
            legs.append(StrategyLeg(symbol=leg_sym, strike=strike, side=l.get("side", "buy").upper(), type=l_type, premium=float(o.get("limit_price") or 0.0)))
    price = float(o.get("filled_avg_price") or o.get("limit_price") or 0.0)
    return TradeResponse(id=o["id"], symbol=sym or "Unknown", strategy=strategy_name, entry_price=price, current_price=price, quantity=abs(int(float(o.get("qty") or o.get("filled_qty") or 1))), status=status, side=side, opened_at=datetime.datetime.fromisoformat(o["created_at"].replace('Z', '+00:00')), legs=legs if legs else None)

def delete_paper_trade(symbol_or_id: str):
    try:
        uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
        if uuid_pattern.match(symbol_or_id):  
            cancel_order(symbol_or_id)
            return {"message": "Pending order cancelled successfully"}
        else:
            close_position(symbol_or_id)
            return {"message": "Position liquidated successfully"}
    except Exception as e:
        print(f"Delete trade error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

def patch_trade(order_id: str, limit_price: float = None, qty: int = None):
    from alpaca_trading import replace_order
    try:
        order_data = replace_order(order_id, limit_price=limit_price, qty=qty)
        return _map_alpaca_order_to_trade_response(order_data)
    except Exception as e:
        print(f"Update trade error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

def close_paper_trade(symbol_or_id: str):
    try:
        uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
        if uuid_pattern.match(symbol_or_id):
            cancel_order(symbol_or_id)
            return {"message": "Pending order cancelled successfully"}
        else:
            close_position(symbol_or_id)
            return {"message": "Position closed successfully"}
    except Exception as e:
        print(f"Close trade error: {str(e)}")
        traceback.print_exc()
        error_msg = str(e)
        if "market is closed" in error_msg.lower():
            error_msg = "Market is currently closed. Alpaca does not allow liquidating options after hours."
        raise HTTPException(status_code=400, detail=error_msg)

@app.post("/trades", response_model=TradeResponse)
async def execute_paper_trade_api(trade: TradeCreate):
    try:
        # Complex trade logic still better in thread pool but call asyncly
        res = await asyncio.get_event_loop().run_in_executor(_GLOBAL_EXECUTOR, execute_paper_trade, trade)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/trades/{symbol_or_id}", response_model=dict)
async def delete_paper_trade_api(symbol_or_id: str):
    try:
        res = await asyncio.get_event_loop().run_in_executor(_GLOBAL_EXECUTOR, delete_paper_trade, symbol_or_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.patch("/trades/{order_id}", response_model=TradeResponse)
async def patch_trade_api(order_id: str, update: TradeUpdate):
    try:
        res = await asyncio.get_event_loop().run_in_executor(_GLOBAL_EXECUTOR, patch_trade, order_id, update)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/trades/{symbol_or_id}/close", response_model=dict)
async def close_paper_trade_api(symbol_or_id: str):
    try:
        res = await asyncio.get_event_loop().run_in_executor(_GLOBAL_EXECUTOR, close_paper_trade, symbol_or_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/trades", response_model=dict)
async def reset_all_trades_api():
    try:
        await asyncio.get_event_loop().run_in_executor(_GLOBAL_EXECUTOR, close_all_positions)
        return {"message": "All portfolio positions liquidated"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
