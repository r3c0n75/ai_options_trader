import yfinance as yf
import pandas as pd
import numpy as np
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import traceback
import os
import httpx
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from dotenv import load_dotenv
from debug_utils import log_api_call, log_error
try:
    from fredapi import Fred
    # vix_utils might have different import structure depending on version
    import vix_utils
except ImportError:
    Fred = None
    vix_utils = None

# Load environment variables from the root .env file
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

ALPACA_API_KEY = os.environ.get("ALPACA_API_KEY", "")
ALPACA_SECRET_KEY = os.environ.get("ALPACA_SECRET_KEY", "")
FRED_API_KEY = os.environ.get("FRED_API_KEY", "")
FINNHUB_API_KEY = os.environ.get("FINNHUB_API_KEY", "")

# Alpaca Options Data API (Beta)
ALPACA_OPTIONS_URL = "https://data.alpaca.markets/v1beta1/options"
# Alpaca Stock Data API
ALPACA_STOCKS_URL = "https://data.alpaca.markets/v2/stocks"
# Alpaca News API
ALPACA_NEWS_URL = "https://data.alpaca.markets/v1beta1/news"

MACRO_BASKET = ["SPY", "QQQ", "IWM", "GLD", "TMF", "BND"]
MACRO_CACHE_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'macro_cache.json')

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

# --- Phase 1: Institutional Macro Data & Caching ---

def _load_macro_cache():
    """Loads the daily macro cache from disk."""
    if os.path.exists(MACRO_CACHE_FILE):
        try:
            with open(MACRO_CACHE_FILE, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading macro cache: {e}")
    return {}

def _save_macro_cache(data):
    """Saves the macro data to a daily cache file."""
    try:
        os.makedirs(os.path.dirname(MACRO_CACHE_FILE), exist_ok=True)
        with open(MACRO_CACHE_FILE, 'w') as f:
            json.dump(data, f)
    except Exception as e:
        print(f"Error saving macro cache: {e}")

def get_macro_regime_data() -> dict:
    """
    Orchestrates the macro data collection with daily caching.
    Returns a unified view of the market regime metrics.
    """
    now = datetime.now()
    cache = _load_macro_cache()
    
    # Check if cache is fresh (same day)
    today_str = now.strftime('%Y-%m-%d')
    if cache.get('date') == today_str:
        # If it's 3:45 PM or later and we haven't done an EOD update, force one refreshes
        is_eod_time = now.hour >= 15 and now.minute >= 45
        if not (is_eod_time and not cache.get('eod_update')):
            print("DEBUG: Returning cached Macro Regime data.")
            return cache.get('data', {})

    print(f"DEBUG: Fetching FRESH Macro Regime data (Today: {today_str})")
    
    vix_struct = get_vix_term_structure()
    indicators = get_macro_indicators()
    spy_rv = get_realized_volatility("SPY")
    calendar = get_economic_calendar()
    
    # Compute Volatility Risk Premium (VRP)
    # VRP = IV (VIX) - RV (30d)
    vix = vix_struct.get('vix', 20.0)
    vrp = round(vix - spy_rv, 2)
    
    macro_data = {
        "vix_term_structure": vix_struct,
        "indicators": indicators,
        "realized_vol_30d": spy_rv,
        "vrp": vrp,
        "economic_calendar": calendar,
        "timestamp": now.isoformat()
    }
    
    _save_macro_cache({
        "date": today_str,
        "eod_update": now.hour >= 16, # Mark as EOD if after close
        "data": macro_data
    })
    
    return macro_data

def get_vix_term_structure() -> dict:
    """Fetches VIX, VIX3M, and VIX9D to determine the term structure curve."""
    try:
        # Tickers for term structure
        tickers = ["^VIX", "^VIX3M", "^VIX9D"]
        log_api_call("Yahoo Finance (Term Structure)")
        data = yf.download(tickers, period="5d", interval="1d", progress=False, timeout=10)
        
        if data.empty:
            return {"vix": 20.0, "vix3m": 20.0, "vix9d": 20.0, "curve": "contango"}
            
        def get_last_val(symbol):
            try:
                if isinstance(data.columns, pd.MultiIndex):
                    return float(data['Close'][symbol].dropna().iloc[-1])
                return float(data['Close'].dropna().iloc[-1])
            except: return 20.0
            
        vix = get_last_val("^VIX")
        vix3m = get_last_val("^VIX3M")
        vix9d = get_last_val("^VIX9D")
        
        # Heuristic for curve
        if vix9d > vix:
            curve = "backwardation"
        elif vix < vix3m:
            curve = "contango"
        else:
            curve = "neutral"
            
        return {
            "vix": round(vix, 2),
            "vix3m": round(vix3m, 2),
            "vix9d": round(vix9d, 2),
            "curve": curve
        }
    except Exception as e:
        print(f"Error fetching VIX term structure: {e}")
        return {"vix": 20.0, "vix3m": 20.0, "vix9d": 20.0, "curve": "contango"}

def get_macro_indicators() -> dict:
    """Fetches Bond Volatility (MOVE Index) and High Yield Spreads from FRED."""
    if not FRED_API_KEY or Fred is None:
        # Fallback to defaults or technical proxies if key missing
        return {
            "move_index": 100.0, 
            "hy_spread": 4.0, 
            "dxy": 103.0,
            "as_of_date": "N/A (Keys Missing)",
            "source": "Defaults"
        }
        
    try:
        fred = Fred(api_key=FRED_API_KEY)
        log_api_call("FRED API")
        
        # BAMLMOVE: ICE BofA US Bond Market Option Volatility Estimate Index
        # BAMLH0A0HYM2: ICE BofA US High Yield Index Option-Adjusted Spread
        # DTWEXBGS: Trade Weighted U.S. Dollar Index (Alternative for DXY)
        
        move = fred.get_series('BAMLMOVE')
        hy_spread = fred.get_series('BAMLH0A0HYM2')
        dxy = fred.get_series('DTWEXAFEGS') # Trade Weighted Dollar
        
        last_move = float(move.dropna().iloc[-1])
        last_hy = float(hy_spread.dropna().iloc[-1])
        last_dxy = float(dxy.dropna().iloc[-1])
        as_of = move.dropna().index[-1].strftime('%Y-%m-%d')
        
        return {
            "move_index": round(last_move, 2),
            "hy_spread": round(last_hy, 2),
            "dxy": round(last_dxy, 2),
            "as_of_date": as_of,
            "source": "FRED"
        }
    except Exception as e:
        print(f"Error fetching macro indicators from FRED: {e}")
        return {"move_index": 100.0, "hy_spread": 4.0, "dxy": 103.0, "as_of_date": "N/A", "source": "Error"}

def get_realized_volatility(symbol: str = "SPY", window: int = 30) -> float:
    """Computes the annualized realized volatility for a symbol over a sliding window."""
    try:
        log_api_call(f"Yahoo Finance (RV - {symbol})")
        data = yf.download(symbol, period="60d", interval="1d", progress=False, timeout=10)
        
        if data.empty: return 15.0
        
        if isinstance(data.columns, pd.MultiIndex):
            close = data['Close'][symbol]
        else:
            close = data['Close']
            
        # Calculate daily returns
        returns = np.log(close / close.shift(1))
        # Standard deviation of returns over window
        vol = returns.rolling(window=window).std() * np.sqrt(252) * 100
        
        return round(float(vol.dropna().iloc[-1]), 2)
    except Exception as e:
        print(f"Error computing realized volatility: {e}")
        return 15.0

def get_atr(symbol: str, window: int = 14) -> float:
    """Computes the 14-day Average True Range."""
    try:
        log_api_call(f"Yahoo Finance (ATR - {symbol})")
        data = yf.download(symbol, period="30d", interval="1d", progress=False, timeout=10)
        
        if data.empty: return 1.0
        
        if isinstance(data.columns, pd.MultiIndex):
            # yfinance returns (Field, Ticker) for multi-index
            high = data['High'][symbol] if symbol in data['High'] else data['High'].iloc[:, 0]
            low = data['Low'][symbol] if symbol in data['Low'] else data['Low'].iloc[:, 0]
            close = data['Close'][symbol] if symbol in data['Close'] else data['Close'].iloc[:, 0]
        else:
            high = data['High']
            low = data['Low']
            close = data['Close']
            
        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr = tr.rolling(window=window).mean()
        
        return round(float(atr.dropna().iloc[-1]), 2)
    except Exception as e:
        print(f"Error computing ATR: {e}")
        return 1.0

def get_economic_calendar() -> list:
    """Fetches high-impact US economic events from Finnhub or free sources."""
    if not FINNHUB_API_KEY:
        # Fallback to a hardcoded high-impact check or empty
        return []

    try:
        # Finnhub economic calendar endpoint
        # For free tier, we can also use their general news or specific calendar if available
        # Note: True institutional grade RAG would use a more robust direct feed
        log_api_call("Finnhub Calendar")
        url = f"https://finnhub.io/api/v1/calendar/economic?token={FINNHUB_API_KEY}"
        response = _HTTP_CLIENT.get(url)
        if response.status_code == 200:
            data = response.json().get('economicCalendar', [])
            # Filter for high impact US events
            today = datetime.now().strftime('%Y-%m-%d')
            us_events = [
                {
                    "event": e.get('event'),
                    "impact": e.get('impact'),
                    "actual": e.get('actual'),
                    "estimate": e.get('estimate'),
                    "prev": e.get('prev'),
                    "time": e.get('time')
                } for e in data if e.get('country') == 'US' and e.get('impact') in ['High', '3']
                # and e.get('time', '').startswith(today) # Optionally filter for today
            ]
            return us_events[:10]
        return []
    except Exception as e:
        print(f"Error fetching economic calendar: {e}")
        return []

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
            # Target expiration: institutional sweet spot (45-60 days)
            target_date = (datetime.utcnow() + timedelta(days=45)).strftime('%Y-%m-%d')
            suitable_expiries = [e for e in expirations if e >= target_date]
            
            if suitable_expiries:
                selected_expiry = suitable_expiries[0]
            else:
                # Fallback to furthest available if none are >= 45 days
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

def get_alpaca_account() -> dict:
    """Fetches Alpaca account info (equity, buying power, margin)."""
    if not ALPACA_API_KEY: return {"equity": 100000, "buying_power": 100000}
    try:
        url = "https://paper-api.alpaca.markets/v2/account"
        log_api_call("Alpaca Account")
        response = _HTTP_CLIENT.get(url, headers=get_headers())
        if response.status_code == 200:
            return response.json()
        return {"equity": 0, "buying_power": 0}
    except Exception as e:
        print(f"Error fetching Alpaca account: {e}")
        return {"equity": 0, "buying_power": 0}

def get_alpaca_positions() -> list:
    """Fetches current open positions (stock and options)."""
    if not ALPACA_API_KEY: return []
    try:
        url = "https://paper-api.alpaca.markets/v2/positions"
        log_api_call("Alpaca Positions")
        response = _HTTP_CLIENT.get(url, headers=get_headers())
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        print(f"Error fetching Alpaca positions: {e}")
        return []
