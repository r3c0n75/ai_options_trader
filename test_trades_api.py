import httpx
import json

def test_trade_side(side):
    url = "http://localhost:8000/trades"
    payload = {
        "symbol": "SPY",
        "strategy": "Bull Call Spread",
        "side": side,
        "entry_price": 0,
        "quantity": 1
    }
    print(f"Testing trade with side: {side}...")
    try:
        response = httpx.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_trade_side("buy")
    print("-" * 20)
    test_trade_side("sell")
