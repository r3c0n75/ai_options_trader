import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
import engine
import json

def test_recommendations():
    print("Testing generate_recommendations() with institutional matrix...")
    # Mock some symbols
    symbols = ["SPY", "TSLA", "NVDA"]
    recs = engine.generate_recommendations(symbols)
    print(json.dumps(recs, indent=2))

if __name__ == "__main__":
    test_recommendations()
