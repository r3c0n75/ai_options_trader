import sys
import os
sys.path.append(os.getcwd())
from backend.alpaca_trading import get_orders, get_positions

def check_orders():
    print("Fetching open orders...")
    open_orders = get_orders(status="open")
    for o in open_orders:
        print(f"Order ID: {o['id']}, Status: {o['status']}, Class: {o.get('order_class')}")
        if 'legs' in o:
            print(f"  Legs: {len(o['legs'])}")
            for l in o['legs']:
                print(f"    - {l['symbol']} {l['side']} qty {l.get('qty')}")
    
    print("\nFetching positions...")
    positions = get_positions()
    for p in positions:
        print(f"Position: {p['symbol']}, Qty: {p['qty']}")

if __name__ == "__main__":
    check_orders()
