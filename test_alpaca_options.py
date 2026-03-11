import os
import httpx
from dotenv import load_dotenv

load_dotenv()

ALPACA_API_KEY = os.environ.get("ALPACA_API_KEY", "")
ALPACA_SECRET_KEY = os.environ.get("ALPACA_SECRET_KEY", "")

headers = {
    "APCA-API-KEY-ID": ALPACA_API_KEY,
    "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
    "Accept": "application/json"
}

url = "https://data.alpaca.markets/v1beta1/options/contracts?underlying_symbols=SPY&limit=5"
response = httpx.get(url, headers=headers)
print(response.status_code)
if response.status_code == 200:
    data = response.json()
    print([c['symbol'] for c in data.get('option_contracts', [])])
else:
    print(response.text)
