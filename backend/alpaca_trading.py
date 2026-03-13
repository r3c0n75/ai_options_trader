import httpx
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

ALPACA_API_KEY = os.environ.get("ALPACA_API_KEY", "")
ALPACA_SECRET_KEY = os.environ.get("ALPACA_SECRET_KEY", "")

PAPER_API_URL = "https://paper-api.alpaca.markets/v2"

def get_headers():
    return {
        "APCA-API-KEY-ID": ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
        "Accept": "application/json"
    }

_HTTP_CLIENT = httpx.Client(timeout=10.0)

def get_account():
    url = f"{PAPER_API_URL}/account"
    response = _HTTP_CLIENT.get(url, headers=get_headers())
    if response.status_code == 200:
        return response.json()
    raise Exception(f"Failed to fetch account: {response.text}")

def get_portfolio_history(period: str = "1D", timeframe: str = None):
    url = f"{PAPER_API_URL}/account/portfolio/history?period={period}"
    if timeframe:
        url += f"&timeframe={timeframe}"
    response = _HTTP_CLIENT.get(url, headers=get_headers())
    if response.status_code == 200:
        return response.json()
    return {}

def submit_order(symbol: str, qty: int, side: str = "buy"):
    url = f"{PAPER_API_URL}/orders"
    payload = {
        "symbol": symbol,
        "qty": str(qty),
        "side": side,
        "type": "market",
        "time_in_force": "day"
    }
    response = _HTTP_CLIENT.post(url, headers=get_headers(), json=payload)
    if response.status_code not in (200, 201):
        raise Exception(f"Failed to submit order: {response.text}")
    return response.json()

def submit_options_order(strategy: str, legs: list, quantity: int = 1, limit_price: float = None):
    url = f"{PAPER_API_URL}/orders"
    
    if len(legs) == 1:
        # Single leg option
        leg = legs[0]
        payload = {
            "symbol": leg['symbol'],
            "qty": str(quantity),
            "side": leg['side'].lower(),
            "type": "market",
            "time_in_force": "day"
        }
    else:
        # Multi-leg option
        order_legs = []
        for leg in legs:
            order_legs.append({
                "symbol": leg['symbol'],
                "ratio_qty": leg.get('ratio_qty', 1),
                "side": leg['side'].lower()
            })
            
        payload = {
            "order_class": "mleg",
            "legs": order_legs,
            "qty": str(quantity),
            "type": "market" if limit_price is None else "limit",
            "time_in_force": "day"
        }
        
        if limit_price is not None:
            payload["limit_price"] = str(round(limit_price, 2))
        
    response = _HTTP_CLIENT.post(url, headers=get_headers(), json=payload)
    if response.status_code not in (200, 201):
        raise Exception(f"Failed to submit options order: {response.text}")
    return response.json()


def get_positions():
    url = f"{PAPER_API_URL}/positions"
    response = _HTTP_CLIENT.get(url, headers=get_headers())
    if response.status_code == 200:
        return response.json()
    print(f"FAILED TO FETCH POSITIONS: {response.status_code} - {response.text}")
    return []

def get_orders(status: str = "open", limit: int = 50):
    url = f"{PAPER_API_URL}/orders?status={status}&limit={limit}"
    response = _HTTP_CLIENT.get(url, headers=get_headers())
    if response.status_code == 200:
        return response.json()
    return []

def get_order(order_id: str):
    url = f"{PAPER_API_URL}/orders/{order_id}"
    response = _HTTP_CLIENT.get(url, headers=get_headers())
    if response.status_code == 200:
        return response.json()
    return {}

def close_position(symbol: str):
    url = f"{PAPER_API_URL}/positions/{symbol}"
    # This will liquidate the position completely
    response = _HTTP_CLIENT.delete(url, headers=get_headers())
    if response.status_code not in (200, 201, 204, 207):
        raise Exception(f"Failed to close position: {response.text}")
    return {}

def cancel_order(order_id: str):
    url = f"{PAPER_API_URL}/orders/{order_id}"
    response = _HTTP_CLIENT.delete(url, headers=get_headers())
    if response.status_code not in (200, 201, 204, 207):
        raise Exception(f"Failed to cancel order: {response.text}")
    return {}

def replace_order(order_id: str, limit_price: float = None, qty: int = None):
    url = f"{PAPER_API_URL}/orders/{order_id}"
    payload = {}
    if limit_price is not None:
        payload["limit_price"] = str(round(limit_price, 2))
    if qty is not None:
        payload["qty"] = str(qty)
        
    response = _HTTP_CLIENT.patch(url, headers=get_headers(), json=payload)
    if response.status_code not in (200, 201):
        raise Exception(f"Failed to update order: {response.text}")
    return response.json()

def close_all_positions():
    url = f"{PAPER_API_URL}/positions?cancel_orders=true"
    response = _HTTP_CLIENT.delete(url, headers=get_headers())
    if response.status_code not in (200, 201, 204, 207):
        raise Exception(f"Failed to close all positions: {response.text}")
    return {}
