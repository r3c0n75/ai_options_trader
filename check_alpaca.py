import os
import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

ALPACA_API_KEY = os.environ.get("ALPACA_API_KEY", "")
ALPACA_SECRET_KEY = os.environ.get("ALPACA_SECRET_KEY", "")
PAPER_API_URL = "https://paper-api.alpaca.markets/v2"

def get_headers():
    return {
        "APCA-API-KEY-ID": ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
        "Accept": "application/json"
    }

def check_account():
    url = f"{PAPER_API_URL}/account"
    print(f"Checking account at {url}...")
    try:
        response = httpx.get(url, headers=get_headers())
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Account Status: {data.get('status')}")
            print(f"Buying Power: {data.get('buying_power')}")
            print(f"Cash: {data.get('cash')}")
            print(f"Equity: {data.get('equity')}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    check_account()
