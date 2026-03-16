import os
import json
from datetime import datetime
from data_fetcher import get_stock_price

def get_portfolio_risk_report(positions: list, account: dict) -> dict:
    """
    Computes portfolio-level Greeks and risk metrics.
    Positions list contains Alpaca position objects/dicts.
    Account contains Alpaca account info (buying power, equity).
    """
    spy_price = get_stock_price("SPY")
    total_beta_weighted_delta = 0.0
    
    # 1. Beta-Weighted Delta (BWD) Calculation
    # Simplification: Use Beta of 1.0 for majority of tech symbols, or fetch if needed
    # For a zero-cost MVP, we assume SPY = 1.0 and tech assets ~1.2-1.5
    for pos in positions:
        try:
            symbol = pos.get('symbol')
            qty = float(pos.get('qty', 0))
            current_price = float(pos.get('current_price', 0))
            
            # Estimate Beta (Ideally fetched from a data provider)
            # Placeholder values for standard institutional-grade logic
            betas = {"AAPL": 1.2, "TSLA": 1.6, "NVDA": 1.7, "QQQ": 1.1, "IWM": 1.1}
            beta = betas.get(symbol, 1.0)
            
            # Asset Delta (For options, we'd need the Greek snapshot from Alpaca)
            # If it's a stock position: delta = 1.0 per share
            # If it's an option: delta is from the Alpaca 'delta' field if available
            asset_delta = float(pos.get('delta', 1.0))
            
            # Position BWD = (Qty * Delta * Asset_Price * Beta) / SPY_Price
            pos_delta_dollars = (qty * asset_delta * current_price)
            pos_bwd = (pos_delta_dollars * beta) / spy_price if spy_price > 0 else 0
            
            total_beta_weighted_delta += pos_bwd
        except Exception as e:
            print(f"Error calculating risk for {pos.get('symbol')}: {e}")

    # 2. Margin Utilization
    equity = float(account.get('equity', 1.0))
    buying_power = float(account.get('buying_power', 0.0))
    # Margin Used = Initial Margin or effectively (Equity - BuyingPower/Multiple)
    # Simple proxy: Utilization = 1 - (Buying Power / (Equity * 2)) for a RegT account
    utilization = 0.0
    if equity > 0:
        # Alpaca buying_power for options is usually 1x equity, for stocks 2x-4x
        # We'll use the 'initial_margin' field if Alpaca provides it, else this proxy:
        margin_used = float(account.get('initial_margin', equity - (buying_power / 2)))
        utilization = (margin_used / equity) * 100

    # 3. Circuit Breakers
    # Institutional Rule: Margin Utilization < 30%
    # Institutional Rule: Beta-Weighted Delta within range
    pause_new_trades = False
    reasons = []
    
    if utilization > 30:
        pause_new_trades = True
        reasons.append(f"Margin utilization ({utilization:.1f}%) exceeds 30% ceiling.")
    
    if abs(total_beta_weighted_delta) > (equity * 0.02 / spy_price): # 2% SPY equivalent move
        reasons.append(f"Portfolio Beta-Weighted Delta ({total_beta_weighted_delta:.2f}) exceeds neutral bounds.")

    return {
        "beta_weighted_delta": round(total_beta_weighted_delta, 2),
        "margin_utilization": round(utilization, 2),
        "total_equity": round(equity, 2),
        "pause_new_trades": pause_new_trades,
        "risk_reasons": reasons,
        "timestamp": datetime.now().isoformat()
    }

def should_block_trade(symbol: str, strategy: str, risk_report: dict) -> bool:
    """Decides if a specific trade should be blocked based on portfolio risk."""
    if risk_report.get("pause_new_trades", False):
        return True
    return False
