from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

import models
from database import engine, get_db
from engine import evaluate_market_health, generate_recommendations
from pydantic import BaseModel
import datetime
from alpaca_trading import submit_order, get_positions, close_position, close_all_positions, get_orders, cancel_order

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

class TradeCreate(BaseModel):
    symbol: str
    strategy: str
    entry_price: float
    quantity: int

class TradeResponse(BaseModel):
    id: str
    symbol: str
    strategy: str
    entry_price: float
    quantity: int
    status: str
    opened_at: datetime.datetime

    class Config:
        from_attributes = True

@app.get("/")
def read_root():
    return {"message": "Welcome to AI Options Trader API"}

@app.get("/market-health", response_model=MarketHealthResponse)
def get_market_health():
    return evaluate_market_health()

@app.get("/scanner")
def get_etf_scanner_data():
    from data_fetcher import get_macro_etfs
    return get_macro_etfs()

@app.get("/news")
def get_news_feed():
    from data_fetcher import get_financial_news
    return get_financial_news(limit=10)

@app.get("/recommendations", response_model=List[TradeRecommendation])
def get_top_recommendations():
    recs = generate_recommendations()
    return recs

@app.post("/trades", response_model=TradeResponse)
def execute_paper_trade(trade: TradeCreate):
    try:
        # For simplicity in v1, we simulate 1 options contract = buying 10 stock shares in paper account
        qty_to_buy = max(1, trade.quantity * 10)
        submit_order(trade.symbol, qty_to_buy, "buy")
        return TradeResponse(
            id=trade.symbol,
            symbol=trade.symbol,
            strategy="Equity Buy",
            entry_price=trade.entry_price,
            quantity=qty_to_buy,
            status="OPEN",
            opened_at=datetime.datetime.utcnow()
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/trades", response_model=List[TradeResponse])
def get_open_trades():
    try:
        positions = get_positions()
        orders = get_orders()
        trades = []
        for p in positions:
            trades.append(TradeResponse(
                id=p["symbol"],
                symbol=p["symbol"],
                strategy="Equity Long",
                entry_price=float(p.get("avg_entry_price", 0.0)),
                quantity=abs(int(float(p.get("qty", 0)))),
                status="OPEN",
                opened_at=datetime.datetime.utcnow()
            ))
        for o in orders:
            trades.append(TradeResponse(
                id=o["id"],
                symbol=o["symbol"],
                strategy="Equity Order",
                entry_price=0.0,
                quantity=abs(int(float(o.get("qty", 0)))),
                status="PENDING",
                opened_at=datetime.datetime.utcnow()
            ))
        return trades
    except Exception as e:
        print(f"Error fetching positions/orders: {e}")
        return []

@app.delete("/trades/{symbol_or_id}", response_model=dict)
def delete_paper_trade(symbol_or_id: str):
    try:
        # Try to cancel it if it's an order ID (UUID format usually)
        if len(symbol_or_id) > 15:  
            cancel_order(symbol_or_id)
            return {"message": "Pending order cancelled successfully"}
        else:
            close_position(symbol_or_id)
            return {"message": "Position liquidated successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/trades/{symbol_or_id}/close", response_model=dict)
def close_paper_trade(symbol_or_id: str):
    try:
        if len(symbol_or_id) > 15:
            cancel_order(symbol_or_id)
            return {"message": "Pending order cancelled successfully"}
        else:
            close_position(symbol_or_id)
            return {"message": "Position closed successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/trades", response_model=dict)
def reset_all_trades():
    try:
        close_all_positions()
        return {"message": "All portfolio positions liquidated"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
