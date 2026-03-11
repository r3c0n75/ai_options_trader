import yfinance as yf
import traceback
import os
import httpx
from datetime import datetime, timedelta

ALPACA_API_KEY = os.environ.get("ALPACA_API_KEY", "")
ALPACA_SECRET_KEY = os.environ.get("ALPACA_SECRET_KEY", "")

# Alpaca Options Data API (Beta)
ALPACA_OPTIONS_URL = "https://data.alpaca.markets/v1beta1/options"
# Alpaca Stock Data API
ALPACA_STOCKS_URL = "https://data.alpaca.markets/v2/stocks"
# Alpaca News API
ALPACA_NEWS_URL = "https://data.alpaca.markets/v1beta1/news"

MACRO_BASKET = ["SPY", "QQQ", "TMF", "BND", "GLD", "IWM"]

def get_headers():
    return {
        "APCA-API-KEY-ID": ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
        "Accept": "application/json"
    }

def get_vix_level() -> float:
    """Fetches the current or last closing price of the VIX indicator."""
    # VIX is an index, Alpaca basic data doesn't always cover indices for free, so we keep yfinance for VIX
    try:
        vix = yf.Ticker("^VIX")
        data = vix.history(period="1d")
        if data.empty:
            data = vix.history(period="5d")
        
        if not data.empty:
            return float(data['Close'].iloc[-1])
        return 18.0  # Safe default if API completely fails
    except Exception as e:
        print(f"Error fetching VIX: {traceback.format_exc()}")
        return 18.0

def get_stock_price(symbol: str) -> float:
    """Fetches the latest trade price of a stock symbol using Alpaca."""
    if not ALPACA_API_KEY:
        # Fallback to yfinance if no keys are provided yet
        try:
            ticker = yf.Ticker(symbol)
            data = ticker.history(period="1d")
            if not data.empty:
                return float(data['Close'].iloc[-1])
            return 0.0
        except Exception:
            return 0.0

    try:
        url = f"{ALPACA_STOCKS_URL}/{symbol}/trades/latest"
        response = httpx.get(url, headers=get_headers())
        if response.status_code == 200:
            data = response.json()
            return float(data['trade']['p'])
        return 0.0
    except Exception as e:
        print(f"Error fetching stock price from Alpaca: {e}")
        return 0.0

def get_options_chain(symbol: str = "SPY"):
    """Fetches the near-the-money options chain using Alpaca."""
    current_price = get_stock_price(symbol)
    if current_price == 0.0:
        return None

    if not ALPACA_API_KEY:
        # Fallback to yfinance if no keys
        return _yfinance_options_fallback(symbol, current_price)

    try:
        # We need to find the option contracts for the symbol first
        # For simplicity in this demo, we'll try to fetch snapshots for near money standard monthly strikes
        # A robust implementation would use the /options/contracts endpoint to find the exact nearest expiration,
        # but as a simplified simulation, we will use the yfinance fallback to find the expiration date, 
        # because the Alpaca options contracts endpoint requires complex date filtering.
        
        # In a full production Alpaca options app:
        # 1. Fetch from /v1beta1/options/contracts?underlying_symbols={symbol}
        # 2. Sort by expiration date and filter by strikes near `current_price`
        # 3. Fetch snapshots for those exact contract symbols
        
        # Here we blend them: Find the active contracts for the nearest expiration via yfinance, 
        # then if we have Alpaca keys, use them to get the real-time bid/ask snapshot for those contracts.
        
        ticker = yf.Ticker(symbol)
        expirations = ticker.options
        if not expirations:
            return None
            
        nearest_expiry = expirations[0]
        opt_chain = ticker.option_chain(nearest_expiry)
        
        calls = opt_chain.calls
        puts = opt_chain.puts
        
        calls = calls[(calls['strike'] >= current_price * 0.95)]
        puts = puts[(puts['strike'] <= current_price * 1.05)]
        
        top_calls = calls.to_dict('records')[:10]
        top_puts = puts.to_dict('records')[-10:]
        
        # Example of how we WOULD fetch real-time Alpaca snapshots if we had the precise OCC OSI symbols:
        # occ_symbols = [contract['contractSymbol'] for contract in top_calls + top_puts]
        # snapshot_url = f"{ALPACA_OPTIONS_URL}/snapshots?symbols={','.join(occ_symbols)}"
        # However, OCC symbols differ slightly (yfinance uses short year, Alpaca might use full).
        # We'll use the yfinance data structure but note the Alpaca real-time capability.

        return {
            "expiration": nearest_expiry, 
            "current_price": current_price,
            "calls": top_calls,
            "puts": top_puts,
            "data_source": "Alpaca API (Price) + Yahoo (Chain)"
        }
    except Exception as e:
        print(f"Error fetching options chain: {traceback.format_exc()}")
        return None

def _yfinance_options_fallback(symbol: str, current_price: float):
    # Original yfinance logic
    try:
        ticker = yf.Ticker(symbol)
        expirations = ticker.options
        
        if not expirations:
            return None

        nearest_expiry = expirations[0]
        opt_chain = ticker.option_chain(nearest_expiry)
        
        calls = opt_chain.calls
        puts = opt_chain.puts
        
        calls = calls[(calls['strike'] >= current_price * 0.95)]
        puts = puts[(puts['strike'] <= current_price * 1.05)]

        return {
            "expiration": nearest_expiry, 
            "current_price": current_price,
            "calls": calls.to_dict('records')[:10],
            "puts": puts.to_dict('records')[-10:],
            "data_source": "yfinance (Delayed)"
        }
    except Exception:
        return None
def get_macro_etfs() -> list:
    """Fetches a snapshot of the core macro basket (prices and daily change)."""
    if not ALPACA_API_KEY:
        return _yfinance_macro_fallback()

    try:
        # Alpaca Multi-Stock Snapshot
        url = f"{ALPACA_STOCKS_URL}/snapshots?symbols={','.join(MACRO_BASKET)}"
        response = httpx.get(url, headers=get_headers())
        if response.status_code == 200:
            data = response.json()
            results = []
            for symbol, details in data.items():
                current = 0.0
                prev = 0.0
                
                if 'latestTrade' in details and details['latestTrade']:
                    current = float(details['latestTrade']['p'])
                if 'prevDailyBar' in details and details['prevDailyBar']:
                     prev = float(details['prevDailyBar']['c'])
                     
                if current == 0.0 and 'dailyBar' in details and details['dailyBar']:
                     current = float(details['dailyBar']['c'])

                change_pct = ((current - prev) / prev) * 100 if prev > 0 else 0.0
                results.append({
                    "symbol": symbol,
                    "price": round(current, 2),
                    "change_pct": round(change_pct, 2)
                })
            
            if not results:
               return _yfinance_macro_fallback() 

            order = {sym: index for index, sym in enumerate(MACRO_BASKET)}
            results.sort(key=lambda x: order.get(x['symbol'], 999))
            return results
        return _yfinance_macro_fallback()
    except Exception as e:
        print(f"Error fetching ETF snapshots from Alpaca: {e}")
        return _yfinance_macro_fallback()

def _yfinance_macro_fallback() -> list:
    results = []
    for symbol in MACRO_BASKET:
        try:
            ticker = yf.Ticker(symbol)
            data = ticker.history(period="2d") # Need 2 days to get previous close
            if len(data) >= 2:
                current = float(data['Close'].iloc[-1])
                prev = float(data['Close'].iloc[-2])
                change_pct = ((current - prev) / prev) * 100
                results.append({
                    "symbol": symbol,
                    "price": round(current, 2),
                    "change_pct": round(change_pct, 2)
                })
            elif len(data) == 1:
                results.append({
                    "symbol": symbol,
                    "price": round(float(data['Close'].iloc[-1]), 2),
                    "change_pct": 0.0
                })
        except Exception as e:
            print(f"Error fetching ETF {symbol} from yfinance: {e}")
    return results

def get_financial_news(limit: int = 15) -> list:
    """Fetches the latest breaking financial news for the macro basket."""
    if not ALPACA_API_KEY:
        # Free Yahoo Finance News Fallback
        return _yfinance_news_fallback(limit)

    try:
        url = f"{ALPACA_NEWS_URL}?symbols={','.join(MACRO_BASKET)}&limit={limit}&sort=desc"
        response = httpx.get(url, headers=get_headers())
        if response.status_code == 200:
            data = response.json().get('news', [])
            results = []
            for item in data:
                # Truncate summary if it's too long
                summary = item.get('summary', '')
                if len(summary) > 200:
                    summary = summary[:197] + "..."
                
                results.append({
                    "headline": item.get('headline', ""),
                    "summary": summary,
                    "url": item.get('url', ""),
                    "created_at": item.get('created_at', ""),
                    "source": item.get('source', "Alpaca"),
                    "symbols": item.get('symbols', [])
                })
            
            if not results:
                return _yfinance_news_fallback(limit)
            return results
        return _yfinance_news_fallback(limit)
    except Exception as e:
        print(f"Error fetching Alpaca news: {e}")
        return _yfinance_news_fallback(limit)

def _yfinance_news_fallback(limit: int = 15) -> list:
    try:
        # Just grab SPY news to simulate macro news
        ticker = yf.Ticker("SPY")
        news = ticker.news
        results = []
        for item in news[:limit]:
            results.append({
                "headline": item.get('title', "News Item"),
                "summary": item.get('summary', ""),
                "url": item.get('link', ""),
                "created_at": datetime.fromtimestamp(item.get('providerPublishTime', 0)).strftime("%Y-%m-%d %H:%M:%S") if item.get('providerPublishTime') else "",
                "source": item.get('publisher', "Yahoo Finance"),
                "symbols": []
            })
        return results
    except Exception as e:
        print(f"Error fetching yfinance news fallback: {e}")
        return []
