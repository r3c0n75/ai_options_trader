import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from data_fetcher import get_stock_bars

def test_vix_bars():
    print("Testing ^VIX bars retrieval...")
    bars = get_stock_bars("^VIX", period="1M")
    if bars:
        print(f"Successfully retrieved {len(bars)} bars for ^VIX.")
        print(f"First bar: {bars[0]}")
        print(f"Last bar: {bars[-1]}")
    else:
        print("Failed to retrieve bars for ^VIX.")

    print("\nTesting VIX (no caret) bars retrieval...")
    bars = get_stock_bars("VIX", period="1M")
    if bars:
        print(f"Successfully retrieved {len(bars)} bars for VIX.")
    else:
        print("Failed to retrieve bars for VIX.")

if __name__ == "__main__":
    test_vix_bars()
