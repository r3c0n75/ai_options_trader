import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import execute_paper_trade, TradeCreate, StrategyLeg
from alpaca_trading import get_positions

print("Current positions:")
for p in get_positions():
    print(f"  {p['symbol']}: {p['qty']}")

# Cancel any existing open orders for IWN just in case
from alpaca_trading import get_orders, cancel_order
for o in get_orders():
    if o['symbol'] == 'IWN':
        cancel_order(o['id'])

# First, close out IWN if we own it
from alpaca_trading import close_position
try:
    close_position("IWN")
    print("Closed IWN position to test buy-write scenario.")
except Exception as e:
    pass

import time
time.sleep(2) # wait for position to cleanly close

print("\nExecuting Covered Call on IWN (1 contract)...")

trade = TradeCreate(
    symbol="IWN",
    strategy="Covered Call",
    side="sell",
    entry_price=1.0,
    quantity=1,
    legs=[StrategyLeg(
        strike=150.0,
        side="SELL",
        type="CALL",
        premium=1.0,
        symbol="IWN260417C00150000" # Must be a valid option format and hopefully valid date
    )]
)

try:
    # First, let's look for a valid option contract symbol on Alpaca
    # IWN options are standard. The year is 26, month 04, day 17.
    # We will just see if the backend submits it. 
    # Even if Alpaca rejects the specific option symbol, we should NOT get the "account not eligible to trade uncovered options" (40310000) anymore. We should get something else if the format or symbol is bad.
    res = execute_paper_trade(trade)
    print("Success!", res)
except Exception as e:
    print("Error:", e)
