import yfinance as yf
import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import traceback
import os
import httpx
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from dotenv import load_dotenv
from debug_utils import log_api_call, log_error

# Load environment variables from the root .env file
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

ALPACA_API_KEY = os.environ.get("ALPACA_API_KEY", "")
ALPACA_SECRET_KEY = os.environ.get("ALPACA_SECRET_KEY", "")

# Alpaca Options Data API (Beta)
ALPACA_OPTIONS_URL = "https://data.alpaca.markets/v1beta1/options"
# Alpaca Stock Data API
ALPACA_STOCKS_URL = "https://data.alpaca.markets/v2/stocks"
# Alpaca News API
ALPACA_NEWS_URL = "https://data.alpaca.markets/v1beta1/news"

MACRO_BASKET = ["SPY", "QQQ", "IWM", "GLD", "TMF", "BND"]

# Reuse a single httpx client for performance and to avoid socket churn
_HTTP_CLIENT = httpx.Client(timeout=10.0)

# Faster yfinance session
_YF_SESSION = requests.Session()
retries = Retry(total=2, backoff_factor=0.1)
_YF_SESSION.mount('https://', HTTPAdapter(max_retries=retries))
_YF_SESSION.mount('http://', HTTPAdapter(max_retries=retries))

def get_headers():
    return {
        "APCA-API-KEY-ID": ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
        "Accept": "application/json"
    }

_PRICE_CACHE = {}
_PRICE_CACHE_TTL = 30 # 30 seconds

def get_vix_level() -> float:
    """Fetches the current or last closing price of the VIX indicator."""
    try:
        # VIX always needs the caret for yfinance
        symbol = "^VIX"
        log_api_call("Yahoo Finance (Download)")
        # Use download for better reliability in some environments
        data = yf.download(symbol, period="5d", interval="1d", progress=False, timeout=10)
        
        if not data.empty:
            # yfinance returns multi-index columns sometimes with download
            if isinstance(data.columns, pd.MultiIndex):
                close_series = data['Close'][symbol]
            else:
                close_series = data['Close']
            return float(close_series.iloc[-1])
        
        return 18.0
    except Exception as e:
        print(f"Error fetching VIX level: {e}")
        return 18.0

def get_stock_price(symbol: str) -> float:
    """Fetches the latest trade price of a stock symbol using Alpaca with caching."""
    now = datetime.now()
    if symbol in _PRICE_CACHE:
        price, ts = _PRICE_CACHE[symbol]
        if (now - ts).total_seconds() < _PRICE_CACHE_TTL:
            return price

    if not ALPACA_API_KEY:
        # Fallback to yfinance
        try:
            log_api_call("Yahoo Finance")
            ticker = yf.Ticker(symbol)
            data = ticker.history(period="1d", timeout=5)
            if not data.empty:
                val = float(data['Close'].iloc[-1])
                _PRICE_CACHE[symbol] = (val, now)
                return val
            return 0.0
        except Exception:
            return 0.0

    try:
        log_api_call("Alpaca")
        url = f"{ALPACA_STOCKS_URL}/{symbol}/trades/latest"
        response = _HTTP_CLIENT.get(url, headers=get_headers())
        if response.status_code == 200:
            data = response.json()
            val = float(data['trade']['p'])
            _PRICE_CACHE[symbol] = (val, now)
            return val
        return 0.0
    except Exception as e:
        log_error(f"DATA_FETCHER:get_stock_price:{symbol}", "GET", 500, str(e))
        print(f"Error fetching stock price for {symbol} from Alpaca: {e}")
        return 0.0

def get_options_chain(symbol: str = "SPY", target_expiration: str = None):
    """Fetches the near-the-money options chain for a specific expiration or the closest to 30 days."""
    current_price = get_stock_price(symbol)
    if current_price == 0.0:
        return None

    if not ALPACA_API_KEY:
        # Fallback to yfinance if no keys
        return _yfinance_options_fallback(symbol, current_price)

    try:
        # Fetch active contracts from Alpaca
        today = datetime.utcnow().strftime('%Y-%m-%d')
        if target_expiration:
            url = f"https://paper-api.alpaca.markets/v2/options/contracts?underlying_symbols={symbol}&status=active&expiration_date_eq={target_expiration}&limit=1000"
        else:
            url = f"https://paper-api.alpaca.markets/v2/options/contracts?underlying_symbols={symbol}&status=active&expiration_date_gte={today}&limit=10000"
            
        log_api_call("Alpaca")
        response = _HTTP_CLIENT.get(url, headers=get_headers())
        
        if response.status_code != 200:
            print(f"Alpaca contracts API error: {response.status_code} {response.text}")
            return _yfinance_options_fallback(symbol, current_price, target_expiration)
            
        contracts = response.json().get('option_contracts', [])
        if not contracts:
            return _yfinance_options_fallback(symbol, current_price)
            
        # Group by expiration date
        expirations = sorted(list(set([c['expiration_date'] for c in contracts])))
        if not expirations:
            return _yfinance_options_fallback(symbol, current_price)
            
        if target_expiration and target_expiration in expirations:
            selected_expiry = target_expiration
        else:
            target_date = (datetime.utcnow() + timedelta(days=30)).strftime('%Y-%m-%d')
            suitable_expiries = [e for e in expirations if e >= target_date]
            
            if suitable_expiries:
                selected_expiry = suitable_expiries[0]
            else:
                # Fallback to furthest available if none are >= 30 days
                selected_expiry = expirations[-1]
            
        # Filter contracts for selected expiry
        target_contracts = [c for c in contracts if c['expiration_date'] == selected_expiry]
        
        calls = [c for c in target_contracts if c['type'] == 'call']
        puts = [c for c in target_contracts if c['type'] == 'put']
        
        # Sort by strike
        calls.sort(key=lambda x: float(x['strike_price']))
        puts.sort(key=lambda x: float(x['strike_price']))
        
        # Sort by proximity to current price and take the closest ones
        calls.sort(key=lambda x: abs(float(x['strike_price']) - current_price))
        puts.sort(key=lambda x: abs(float(x['strike_price']) - current_price))
        
        # Take the closest 15 for each (ensures we have ATM/NTM strikes)
        calls_ntm = sorted(calls[:15], key=lambda x: float(x['strike_price']))
        puts_ntm = sorted(puts[:15], key=lambda x: float(x['strike_price']))
        
        # 4. Fetch snapshots for these contracts to get real-time pricing
        contract_symbols = [c['symbol'] for c in calls_ntm] + [c['symbol'] for c in puts_ntm]
        snapshots = {}
        if contract_symbols:
            try:
                # Use data.alpaca.markets for snapshots (quotes/trades)
                snap_url = f"{ALPACA_OPTIONS_URL}/snapshots?symbols={','.join(contract_symbols)}"
                log_api_call("Alpaca")
                snap_res = _HTTP_CLIENT.get(snap_url, headers=get_headers())
                if snap_res.status_code == 200:
                    snapshots = snap_res.json().get('snapshots', {})
            except Exception as e:
                print(f"Warning: Could not fetch option snapshots: {e}")

        # Format for frontend / engine compatibility
        formatted_calls = []
        for c in calls_ntm:
            snap = snapshots.get(c['symbol'], {})
            quote = snap.get('latestQuote', {})
            trade = snap.get('latestTrade', {})
            formatted_calls.append({
                'contractSymbol': c['symbol'],
                'strike': float(c['strike_price']),
                'expiration': c['expiration_date'],
                'type': 'call',
                'bid': float(quote.get('bp', 0)),
                'ask': float(quote.get('ap', 0)),
                'last': float(trade.get('p', 0))
            })
            
        formatted_puts = []
        for c in puts_ntm:
            snap = snapshots.get(c['symbol'], {})
            quote = snap.get('latestQuote', {})
            trade = snap.get('latestTrade', {})
            formatted_puts.append({
                'contractSymbol': c['symbol'],
                'strike': float(c['strike_price']),
                'expiration': c['expiration_date'],
                'type': 'put',
                'bid': float(quote.get('bp', 0)),
                'ask': float(quote.get('ap', 0)),
                'last': float(trade.get('p', 0))
            })
        return {
            "expiration": selected_expiry, 
            "current_price": current_price,
            "calls": formatted_calls,
            "puts": formatted_puts,
            "data_source": "Alpaca API (Contracts)"
        }
    except Exception as e:
        log_error(f"DATA_FETCHER:get_options_chain:{symbol}", "GET", 500, str(e))
        print(f"Error fetching Alpaca options contracts: {traceback.format_exc()}")
        return _yfinance_options_fallback(symbol, current_price, target_expiration)

def get_all_expirations(symbol: str) -> list:
    """Returns a sorted list of all active expiration dates for a symbol."""
    if not ALPACA_API_KEY:
        try:
            log_api_call("Yahoo Finance")
            ticker = yf.Ticker(symbol, session=_YF_SESSION)
            return list(ticker.options)
        except Exception:
            return []

    try:
        today = datetime.utcnow().strftime('%Y-%m-%d')
        url = f"https://paper-api.alpaca.markets/v2/options/contracts?underlying_symbols={symbol}&status=active&expiration_date_gte={today}&limit=10000"
        log_api_call("Alpaca")
        response = _HTTP_CLIENT.get(url, headers=get_headers())
        if response.status_code == 200:
            contracts = response.json().get('option_contracts', [])
            expirations = sorted(list(set([c['expiration_date'] for c in contracts])))
            return expirations
        return []
    except Exception as e:
        log_error(f"DATA_FETCHER:get_all_expirations:{symbol}", "GET", 500, str(e))
        print(f"Error fetching all expirations: {e}")
        return []

def _yfinance_options_fallback(symbol: str, current_price: float, target_expiration: str = None):
    # Original yfinance logic
    try:
        log_api_call("Yahoo Finance")
        ticker = yf.Ticker(symbol, session=_YF_SESSION)
        expirations = ticker.options
        
        if not expirations:
            return None

        if target_expiration and target_expiration in expirations:
            selected_expiry = target_expiration
        else:
            target_date = (datetime.utcnow() + timedelta(days=30)).strftime('%Y-%m-%d')
            suitable_expiries = [e for e in expirations if e >= target_date]
            
            if suitable_expiries:
                selected_expiry = suitable_expiries[0]
            else:
                selected_expiry = expirations[-1]

        opt_chain = ticker.option_chain(selected_expiry)
        
        calls = opt_chain.calls
        puts = opt_chain.puts
        
        calls = calls[(calls['strike'] >= current_price * 0.95)]
        puts = puts[(puts['strike'] <= current_price * 1.05)]

        return {
            "expiration": selected_expiry, 
            "current_price": current_price,
            "calls": calls.to_dict('records')[:10],
            "puts": puts.to_dict('records')[-10:],
            "data_source": "yfinance (Delayed)"
        }
    except Exception:
        return None

def get_macro_etfs(symbols: list = None) -> dict:
    """Fetches a snapshot of the core macro basket (prices and daily change)."""
    basket = symbols if symbols else MACRO_BASKET
    
    if not ALPACA_API_KEY:
        return _yfinance_macro_fallback(basket)

    try:
        # Alpaca Multi-Stock Snapshot
        url = f"{ALPACA_STOCKS_URL}/snapshots?symbols={','.join(basket)}"
        log_api_call("Alpaca")
        response = _HTTP_CLIENT.get(url, headers=get_headers())
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
               return _yfinance_macro_fallback(basket) 

            order = {sym: index for index, sym in enumerate(basket)}
            results.sort(key=lambda x: order.get(x['symbol'], 999))
            return {"feed": "Alpaca Markets", "data": results}
        return _yfinance_macro_fallback(basket)
    except Exception as e:
        log_error("DATA_FETCHER:get_macro_etfs", "GET", 500, str(e))
        print(f"Error fetching ETF snapshots from Alpaca: {e}")
        return _yfinance_macro_fallback(basket)

def get_stock_bars(symbol: str, period: str = "3M", timeframe: str = "1Day") -> list:
    """Fetches historical OHLC bar data for a stock symbol."""
    if not ALPACA_API_KEY:
        return _yfinance_bars_fallback(symbol, period)

    try:
        # Determine start date based on period
        now = datetime.utcnow()
        if period == "1D":
            start = (now - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
            timeframe_adj = "1Min"
        elif period == "1M":
            start = (now - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
            timeframe_adj = "1Hour"
        elif period == "12M":
            start = (now - timedelta(days=365)).strftime("%Y-%m-%dT%H:%M:%SZ")
            timeframe_adj = "1Day"
        else: # 3M default
            start = (now - timedelta(days=90)).strftime("%Y-%m-%dT%H:%M:%SZ")
            timeframe_adj = "1Day"

        # Explicitly request IEX feed for free tier and sort DESC to get LATEST bars first
        url = f"{ALPACA_STOCKS_URL}/bars?symbols={symbol}&timeframe={timeframe_adj}&start={start}&limit=1000&adjustment=all&sort=desc&feed=iex"
        log_api_call("Alpaca")
        response = _HTTP_CLIENT.get(url, headers=get_headers())
        
        if response.status_code == 200:
            raw_bars = response.json().get('bars', {}).get(symbol, [])
            if not raw_bars:
                return _yfinance_bars_fallback(symbol, period)

            # Sort back to ASC for charting
            raw_bars.sort(key=lambda x: x['t'])
            
            # Check for staleness: if the latest bar is older than 3 days, it's likely the IEX feed is frozen
            latest_bar_time = datetime.fromisoformat(raw_bars[-1]['t'].replace('Z', '+00:00'))
            if (datetime.now(latest_bar_time.tzinfo) - latest_bar_time).days > 3:
                print(f"Alpaca data for {symbol} is stale (last: {latest_bar_time}), falling back to yfinance.")
                return _yfinance_bars_fallback(symbol, period)

            return [
                {
                    "time": item['t'],
                    "open": float(item['o']),
                    "high": float(item['h']),
                    "low": float(item['l']),
                    "close": float(item['c']),
                    "volume": int(item['v'])
                } for item in raw_bars
            ]
        return _yfinance_bars_fallback(symbol, period)
    except Exception as e:
        print(f"Error fetching bars from Alpaca: {e}")
        return _yfinance_bars_fallback(symbol, period)

def _yfinance_bars_fallback(symbol: str, period: str) -> list:
    try:
        # Force caret for VIX if missing
        if "VIX" in symbol.upper() and not symbol.startswith("^"):
            symbol = "^" + symbol
            
        log_api_call(f"Yahoo Finance Fallback ({symbol})")
        
        interval = "1m" if period == "1D" else "1h" if period == "1M" else "1d"
        yf_period = "1d" if period == "1D" else "1mo" if period == "1M" else "1y" if period == "12M" else "3mo"
        
        # Use download as it's often more robust than Ticker.history
        data = yf.download(symbol, period=yf_period, interval=interval, progress=False, timeout=10)
        
        if data.empty:
            print(f"No yfinance data found for {symbol}")
            return []
            
        results = []
        # Handle potential MultiIndex columns from yf.download
        if isinstance(data.columns, pd.MultiIndex):
            df = data.swaplevel(0, 1, axis=1)[symbol]
        else:
            df = data
            
        for timestamp, row in df.iterrows():
            # Skip rows with NaN
            if pd.isna(row['Close']):
                continue
            results.append({
                "time": timestamp.isoformat(),
                "open": float(row['Open']),
                "high": float(row['High']),
                "low": float(row['Low']),
                "close": float(row['Close']),
                "volume": int(row['Volume']) if 'Volume' in row else 0
            })
        return results
    except Exception as e:
        print(f"Error fetching bars from yfinance fallback for {symbol}: {e}")
        return []

def _fetch_yf_etf(symbol):
    try:
        log_api_call("Yahoo Finance")
        ticker = yf.Ticker(symbol, session=_YF_SESSION)
        data = ticker.history(period="2d", timeout=5)
        if len(data) >= 2:
            current = float(data['Close'].iloc[-1])
            prev = float(data['Close'].iloc[-2])
            change_pct = ((current - prev) / prev) * 100
            return {
                "symbol": symbol,
                "price": round(current, 2),
                "change_pct": round(change_pct, 2)
            }
        elif len(data) == 1:
            return {
                "symbol": symbol,
                "price": round(float(data['Close'].iloc[-1]), 2),
                "change_pct": 0.0
            }
    except Exception as e:
        print(f"Error fetching ETF {symbol} from yfinance: {e}")
    return None

def _yfinance_macro_fallback(symbols: list = None) -> dict:
    basket = symbols if symbols else MACRO_BASKET
    results = []
    
    with ThreadPoolExecutor(max_workers=len(basket)) as executor:
        futures = {executor.submit(_fetch_yf_etf, s): s for s in basket}
        for future in futures:
            res = future.result()
            if res:
                results.append(res)
                
    return {"feed": "Yahoo Finance (Parallel)", "data": results}

def get_financial_news(limit: int = 15) -> list:
    """Fetches the latest breaking financial news for the macro basket."""
    if not ALPACA_API_KEY:
        # Free Yahoo Finance News Fallback
        return _yfinance_news_fallback(limit)

    try:
        url = f"{ALPACA_NEWS_URL}?symbols={','.join(MACRO_BASKET)}&limit={limit}&sort=desc"
        log_api_call("Alpaca")
        response = _HTTP_CLIENT.get(url, headers=get_headers())
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
        log_api_call("Yahoo Finance")
        ticker = yf.Ticker("SPY", session=_YF_SESSION)
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
