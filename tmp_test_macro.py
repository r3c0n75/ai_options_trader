import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
import data_fetcher
import json

def test_macro_data():
    print("Testing get_macro_regime_data()...")
    data = data_fetcher.get_macro_regime_data()
    print(json.dumps(data, indent=2))
    
    print("\nTesting VRP...")
    print(f"VIX: {data['vix_term_structure']['vix']}")
    print(f"RV (SPY): {data['realized_vol_30d']}")
    print(f"VRP: {data['vrp']}")

if __name__ == "__main__":
    test_macro_data()
