from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

import models
from database import engine, get_db
from engine import evaluate_market_health, generate_recommendations
from pydantic import BaseModel
import datetime

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
    id: int
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
def execute_paper_trade(trade: TradeCreate, db: Session = Depends(get_db)):
    db_trade = models.TradeHistory(
        symbol=trade.symbol,
        strategy=trade.strategy,
        entry_price=trade.entry_price,
        quantity=trade.quantity,
        status="OPEN"
    )
    db.add(db_trade)
    db.commit()
    db.refresh(db_trade)
    return db_trade

@app.get("/trades", response_model=List[TradeResponse])
def get_open_trades(db: Session = Depends(get_db)):
    trades = db.query(models.TradeHistory).filter(models.TradeHistory.status == "OPEN").all()
    return trades
