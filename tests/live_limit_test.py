import sys
import os
import time
import datetime

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

import alpaca_trading
import data_fetcher

def run_live_test():
    symbol = "USO"
    print(f"--- Starting Live Limit Fill Test for {symbol} ---")
    
    # 1. Select High-Fill Probability Put Credit Spread (OTM)
    # Based on latest run: USO @ $121.06
    short_strike = 120
    long_strike = 119
    
    legs = [
        {"symbol": f"{symbol}260417P00120000", "side": "SELL", "ratio_qty": 1},
        {"symbol": f"{symbol}260417P00119000", "side": "BUY", "ratio_qty": 1}
    ]
    
    # Target an a very aggressive credit to ensure immediate fill
    # A $0.01 credit for a $1 wide spread is almost guaranteed to fill if market is open
    limit_price = -0.05 # Negative for Alpaca credit
    
    print(f"Submitting {symbol} {short_strike}/{long_strike} Put Credit Spread @ ${abs(limit_price)} Credit...")
    
    try:
        order = alpaca_trading.submit_options_order(
            "Put Credit Spread", 
            legs, 
            quantity=1, 
            limit_price=limit_price
        )
        order_id = order.get("id")
        print(f"Order Submitted! ID: {order_id}")
        
        # 2. Monitor for 60 seconds
        start_time = time.time()
        timeout = 60
        filled = False
        
        while time.time() - start_time < timeout:
            # Re-fetch order status
            orders = alpaca_trading.get_orders(status="all")
            current_order = next((o for o in orders if o["id"] == order_id), None)
            
            if not current_order:
                print("Error: Could not find order in history.")
                break
                
            status = current_order.get("status", "UNKNOWN").upper()
            elapsed = int(time.time() - start_time)
            print(f"[{elapsed}s] Status: {status}")
            
            if status == "FILLED":
                print(f"SUCCESS: Order filled at {current_order.get('filled_at') or 'Unknown time'}")
                filled = True
                break
            
            if status in ["CANCELED", "EXPIRED", "REJECTED"]:
                print(f"FAILURE: Order ended in status: {status}")
                break
                
            time.sleep(5)
            
        if not filled and status == "PENDING":
             print("--- TROUBLESHOOTING ---")
             print("Order did not fill within 60 seconds.")
             print("Checking current market prices...")
             # Here we would check bid/ask to see if the market moved
             # For now, we'll just report the price we were asking
             print(f"Asked for ${abs(limit_price)} Credit. Checking if current Mid is lower...")
             
    except Exception as e:
        print(f"Test Crashed: {e}")

if __name__ == "__main__":
    run_live_test()
