from sqlalchemy import Column, Integer, String, Float, DateTime
from database import Base
import datetime

class TradeHistory(Base):
    __tablename__ = "trade_history"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True)
    strategy = Column(String)  # e.g., 'Credit Spread', 'Long Call'
    entry_price = Column(Float)
    exit_price = Column(Float, nullable=True)
    quantity = Column(Integer)
    status = Column(String) # 'OPEN', 'CLOSED'
    opened_at = Column(DateTime, default=datetime.datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)
    pnl = Column(Float, nullable=True)
