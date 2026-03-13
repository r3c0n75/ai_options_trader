import os
import json
import datetime
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from data_fetcher import get_vix_level, get_options_chain

# Global executor for background scans
_EXECUTOR = ThreadPoolExecutor(max_workers=20)

# Global cache for market health to prevent AI quota exhaustion
_CACHE_FILE = os.path.join("data", "market_health_cache.json")
_MARKET_HEALTH_CACHE = None
_LAST_HEALTH_FETCH = None
_HEALTH_TTL_SECONDS = 300 # 5 minutes

def _save_cache(data, timestamp):
    try:
        with open(_CACHE_FILE, "w") as f:
            json.dump({"data": data, "timestamp": timestamp.isoformat()}, f)
    except Exception as e:
        print(f"Error saving health cache: {e}")

# Global cache for recommendations
_RECS_CACHE_FILE = os.path.join("data", "recs_cache.json")
_RECS_CACHE = {}
_LAST_RECS_FETCH = {}
_RECS_TTL_SECONDS = 600 # 10 minutes

def _save_recs_cache():
    try:
        serializable_data = {}
        serializable_timestamps = {}
        for k, v in _RECS_CACHE.items():
            if v == "FETCHING": continue
            serializable_data[k] = v
            if k in _LAST_RECS_FETCH:
                serializable_timestamps[k] = _LAST_RECS_FETCH[k].isoformat()
        
        with open(_RECS_CACHE_FILE, "w") as f:
            json.dump({"data": serializable_data, "timestamps": serializable_timestamps}, f)
    except Exception as e:
        print(f"Error saving recs cache: {e}")

def _load_recs_cache():
    global _RECS_CACHE, _LAST_RECS_FETCH
    if os.path.exists(_RECS_CACHE_FILE):
        try:
            with open(_RECS_CACHE_FILE, "r") as f:
                cache = json.load(f)
                _RECS_CACHE.update(cache.get("data", {}))
                for k, v in cache.get("timestamps", {}).items():
                    _LAST_RECS_FETCH[k] = datetime.fromisoformat(v)
                print(f"DEBUG: Loaded Recommendations cache from file ({len(_RECS_CACHE)} entries)")
        except Exception as e:
            print(f"Error loading recs cache: {e}")

def _load_cache():
    global _MARKET_HEALTH_CACHE, _LAST_HEALTH_FETCH
    if os.path.exists(_CACHE_FILE):
        try:
            with open(_CACHE_FILE, "r") as f:
                cache = json.load(f)
                _MARKET_HEALTH_CACHE = cache["data"]
                _LAST_HEALTH_FETCH = datetime.fromisoformat(cache["timestamp"])
                print(f"DEBUG: Loaded Market Health cache from file (Age: {int((datetime.now() - _LAST_HEALTH_FETCH).total_seconds())}s)")
        except Exception as e:
            print(f"Error loading health cache: {e}")

# Initial load
_load_cache()
_load_recs_cache()

def evaluate_market_health() -> dict:
    """
    Evaluates market health based on the VIX and AI macro sentiment.
    - Seller's Market (High Volatility/Fear): VIX > 25 or Risk Score > 70
    - Buyer's Market (Low Volatility/Fear): VIX < 15 and Risk Score < 30
    - Cash Market (Uncertain): 15 <= VIX <= 25 or Risk Score 30-70
    """
    global _MARKET_HEALTH_CACHE, _LAST_HEALTH_FETCH
    
    # Check cache first
    now = datetime.now()
    if _MARKET_HEALTH_CACHE and _LAST_HEALTH_FETCH:
        age = (now - _LAST_HEALTH_FETCH).total_seconds()
        if age < _HEALTH_TTL_SECONDS:
            if _MARKET_HEALTH_CACHE == "FETCHING":
                if age < 30: # Allow 30s for the first request to finish
                    print(f"DEBUG: Market Health fetch in progress... (started {int(age)}s ago)")
                    # Return last known good if available, else something generic
                    return {"status": "Generating Analysis...", "description": "AI is synthesizing market sentiment. Refreshing in a moment.", "vix_level": 20.0}
            else:
                print(f"DEBUG: Returning cached Market Health (Age: {int(age)}s)")
                return _MARKET_HEALTH_CACHE

    # Prevent thundering herd - if we got here but another fetch started < 30s ago
    if _LAST_HEALTH_FETCH and (now - _LAST_HEALTH_FETCH).total_seconds() < 30 and _MARKET_HEALTH_CACHE == "FETCHING":
        print("DEBUG: Thundering herd prevented, waiting for existing fetch.")
        return {"status": "Generating Analysis...", "description": "AI is synthesizing market sentiment. Refreshing in a moment.", "vix_level": 20.0}

    # Mark as fetching
    _LAST_HEALTH_FETCH = now
    _MARKET_HEALTH_CACHE = "FETCHING"

    from data_fetcher import get_vix_level, get_financial_news
    from ai_engine import get_macro_sentiment
    
    try:
        print("DEBUG: Fetching FRESH Market Health from AI...")
        vix = get_vix_level()
        news = get_financial_news(limit=5)
        news_headlines = " | ".join([n['headline'] for n in news]) if news else "No major catalysts detected."
        
        sentiment = get_macro_sentiment(news_headlines, vix)
        risk_score = sentiment.get("risk_score", 50)
        mood = sentiment.get("market_mood", "Neutral")
        global_thesis = sentiment.get("global_thesis", "Evaluating macro catalysts.")
    except Exception as e:
        print(f"ALARM: Macro sentiment failed: {e}. Using fallback.")
        vix = 20.0 # Default VIX if fetch fails
        risk_score = 50
        mood = "Neutral"
        global_thesis = "Macro analysis temporarily unavailable. Assessing positions based on price action and Greeks."
        description = "System is running in degraded mode. AI macro analysis is temporarily offline."

    # Logic blending VIX and AI Sentiment - only execute if AI succeeded
    is_fallback = False
    if 'description' not in locals():
        if vix > 25 or risk_score > 70:
            status = "Seller's Market"
            description = f"High risk environment ({mood}). {global_thesis} VIX is {vix:.2f}. Expensive premiums; favor defensive selling or volatility hedges."
        elif vix < 15 and risk_score < 40:
            status = "Buyer's Market"
            description = f"Stable environment ({mood}). {global_thesis} VIX is {vix:.2f}. Cheap premiums; favor directional leverage or long spreads."
        else:
            status = "Neutral / Cash Market"
            description = f"Moderate uncertainty ({mood}). {global_thesis} VIX is {vix:.2f}. Focus on rangebound capture or high-conviction catalysts."
    else:
        status = "Neutral / Cash Market" # Fallback status
        is_fallback = True
        
    result = {
        "status": status,
        "vix_level": round(vix, 2),
        "description": description,
        "risk_score": risk_score,
        "market_mood": mood,
        "global_thesis": global_thesis
    }
    
    # Update cache
    _MARKET_HEALTH_CACHE = result
    _LAST_HEALTH_FETCH = now
    
    # Crucial: Only cache fallbacks for a short time to allow quick recovery
    if is_fallback:
        _LAST_HEALTH_FETCH = now - datetime.timedelta(seconds=(_HEALTH_TTL_SECONDS - 30))
        print("DEBUG: Synthesis failed/fell back. Caching for only 30s.")
    
    _save_cache(result, _LAST_HEALTH_FETCH) # Use the adjusted timestamp for file too
    
    return result

# Recommendation Analysis Helpers
def _get_contract(opts, target):
    if not opts: return None
    return min(opts, key=lambda x: abs(x['strike'] - target))

def _get_lower_contract(opts, than_strike):
    lower = [p for p in opts if p['strike'] < than_strike]
    if lower:
        # Pick the second closest strike to ensure wider wings
        sorted_lower = sorted(lower, key=lambda x: x['strike'], reverse=True)
        return sorted_lower[min(len(sorted_lower)-1, 1)] 
    return None

def _get_higher_contract(opts, than_strike):
    higher = [c for c in opts if c['strike'] > than_strike]
    if higher:
        # Pick the second closest strike to ensure wider wings
        sorted_higher = sorted(higher, key=lambda x: x['strike'])
        return sorted_higher[min(len(sorted_higher)-1, 1)]
    return None

def _get_mid(contract):
    if not contract: return 0.0
    bid = contract.get('bid', 0)
    ask = contract.get('ask', 0)
    if ask > 0:
        return round((bid + ask) / 2, 2)
    return contract.get('last', 0)

def _analyze_symbol_worker(symbol, risk_score, mood, global_thesis, health):
    """Worker function for parallel recommendation scanning."""
    try:
        chain = get_options_chain(symbol)
        if not chain:
            return []
            
        current_price = chain["current_price"]
        expiration = chain["expiration"]
        calls = chain.get("calls", [])
        puts = chain.get("puts", [])
        
        if not calls or not puts:
            return []
            
        symbol_recs = []
        is_high_risk = risk_score > 70
        is_risk_off = mood == "Risk-Off"

        # High Volatility (Seller's Market)
        if health["vix_level"] > 25:
            # Idea 1: Premium collection (Sell)
            s_put_contract = _get_contract(puts, current_price * 0.95)
            l_put_contract = _get_lower_contract(puts, s_put_contract['strike'])
            if l_put_contract:
                s_put_strike = s_put_contract['strike']
                l_put_strike = l_put_contract['strike']
                s_put_prem = _get_mid(s_put_contract)
                l_put_prem = _get_mid(l_put_contract)
                
                if s_put_prem > 0 and l_put_prem > 0:
                    entry_price = round(s_put_prem - l_put_prem, 2)
                    conf = "Moderate" if is_high_risk else "High"
                    symbol_recs.append({
                        "symbol": symbol,
                        "strategy": "Put Credit Spread",
                        "side": "SELL",
                        "thesis": f"{global_thesis} Selling downside protection on {symbol} despite macro headwinds." if is_high_risk else f"High Implied Volatility crush expected. Selling downside insurance on {symbol}.",
                        "expiration": expiration,
                        "target_entry": f"${entry_price:.2f} Credit",
                        "entry_price": entry_price,
                        "pop": "78%", 
                        "risk_reward": "1:3.5",
                        "confidence": conf,
                        "diagram_data": {
                            "underlying_price": current_price,
                            "strategy_type": "credit_spread",
                            "legs": [
                                {"strike": s_put_strike, "side": "SELL", "type": "PUT", "premium": s_put_prem, "symbol": s_put_contract['contractSymbol']},
                                {"strike": l_put_strike, "side": "BUY", "type": "PUT", "premium": l_put_prem, "symbol": l_put_contract['contractSymbol']}
                            ]
                        }
                    })
                
            # Idea 2: Strategic Covered Call (Sell)
            s_call_contract = _get_contract(calls, current_price * 1.05)
            s_call_prem = _get_mid(s_call_contract)
            if s_call_prem > 0:
                conf = "Moderate" if is_high_risk else "High"
                symbol_recs.append({
                    "symbol": symbol,
                    "strategy": "Covered Call",
                    "side": "SELL",
                    "thesis": f"Defensive yield generation. {global_thesis} Yielding from expensive calls on {symbol}." if is_high_risk else f"Capitalizing on expensive call premiums while holding {symbol}.",
                    "expiration": expiration,
                    "target_entry": f"${s_call_prem:.2f} Credit",
                    "entry_price": s_call_prem,
                    "pop": "82%",
                    "risk_reward": "1:1",
                    "confidence": conf,
                    "diagram_data": {
                        "underlying_price": current_price,
                        "strategy_type": "covered_call",
                        "legs": [
                            {"strike": current_price, "side": "BUY", "type": "STOCK", "premium": current_price, "symbol": symbol},
                            {"strike": s_call_contract['strike'], "side": "SELL", "type": "CALL", "premium": s_call_prem, "symbol": s_call_contract['contractSymbol']}
                        ]
                    }
                })
            
        # Low Volatility (Buyer's Market)
        elif health["vix_level"] < 17:
            # Idea 1: Directional Leverage (Buy)
            l_call_contract = _get_contract(calls, current_price)
            l_call_prem = _get_mid(l_call_contract)
            if l_call_prem > 0:
                symbol_recs.append({
                    "symbol": symbol,
                    "strategy": "Long Call / ATM Leap",
                    "side": "BUY",
                    "thesis": f"Low cost of leverage. Technical breakout potential for {symbol}.",
                    "expiration": expiration,
                    "target_entry": f"${l_call_prem:.2f} Debit",
                    "entry_price": l_call_prem,
                    "pop": "45%", 
                    "risk_reward": "5:1",
                    "confidence": "Moderate",
                    "diagram_data": {
                        "underlying_price": current_price,
                        "strategy_type": "long_call",
                        "legs": [
                            {"strike": l_call_contract['strike'], "side": "BUY", "type": "CALL", "premium": l_call_prem, "symbol": l_call_contract['contractSymbol']}
                        ]
                    }
                })
            # Idea 2: Bullish Trend (Buy)
            l_call_atm_contract = _get_contract(calls, current_price)
            s_call_otm_contract = _get_higher_contract(calls, l_call_atm_contract['strike'])
            if s_call_otm_contract:
                l_call_prem = _get_mid(l_call_atm_contract)
                s_call_prem = _get_mid(s_call_otm_contract)
                if l_call_prem > 0 and s_call_prem > 0:
                    entry_price = round(l_call_prem - s_call_prem, 2)
                    conf = "Low" if is_high_risk else "Moderate"
                    symbol_recs.append({
                        "symbol": symbol,
                        "strategy": "Bull Call Debit Spread",
                        "side": "BUY",
                        "thesis": f"Speculative play. {global_thesis} Capped risk on {symbol} recovery." if is_high_risk else f"Cheap premium. Capped risk play on continued macro strength.",
                        "expiration": expiration,
                        "target_entry": f"${entry_price:.2f} Debit",
                        "entry_price": entry_price,
                        "pop": "55%",
                        "risk_reward": "2.5:1",
                        "confidence": conf,
                        "diagram_data": {
                            "underlying_price": current_price,
                            "strategy_type": "debit_spread",
                            "legs": [
                                {"strike": l_call_atm_contract['strike'], "side": "BUY", "type": "CALL", "premium": l_call_prem, "symbol": l_call_atm_contract['contractSymbol']},
                                {"strike": s_call_otm_contract['strike'], "side": "SELL", "type": "CALL", "premium": s_call_prem, "symbol": s_call_otm_contract['contractSymbol']}
                            ]
                        }
                    })
            
        # Neutral / Sideways (Cash/Moderate Market)
        else:
            # Idea 1: Rangebound Capture (Sell)
            s_p_contract = _get_contract(puts, current_price * 0.95)
            l_p_contract = _get_lower_contract(puts, s_p_contract['strike'])
            s_c_contract = _get_contract(calls, current_price * 1.05)
            l_c_contract = _get_higher_contract(calls, s_c_contract['strike'])
            
            if l_p_contract and l_c_contract:
                s_p_strike = s_p_contract['strike']
                l_p_strike = l_p_contract['strike']
                s_c_strike = s_c_contract['strike']
                l_c_strike = l_c_contract['strike']
                s_p_prem = _get_mid(s_p_contract)
                l_p_prem = _get_mid(l_p_contract)
                s_c_prem = _get_mid(s_c_contract)
                l_c_prem = _get_mid(l_c_contract)
                
                if s_p_prem > 0 and l_p_prem > 0 and s_c_prem > 0 and l_c_prem > 0:
                    entry_price = round(s_p_prem + s_c_prem - l_p_prem - l_c_prem, 2)
                    conf = "High" if (is_high_risk or is_risk_off) else "Moderate"
                    symbol_recs.append({
                        "symbol": symbol,
                        "strategy": "Iron Condor",
                        "side": "SELL",
                        "thesis": f"Volatility hedge. {global_thesis} Harvesting theta on {symbol} as markets consolidate." if is_high_risk else f"Macro consolidation. Harvesting theta decay as {symbol} stays rangebound.",
                        "expiration": expiration,
                        "target_entry": f"${entry_price:.2f} Credit",
                        "entry_price": entry_price,
                        "pop": "65%",
                        "risk_reward": "1:2.2",
                        "confidence": conf,
                        "diagram_data": {
                            "underlying_price": current_price,
                            "strategy_type": "iron_condor",
                            "legs": [
                                {"strike": s_p_strike, "side": "SELL", "type": "PUT", "premium": s_p_prem, "symbol": s_p_contract['contractSymbol']},
                                {"strike": l_p_strike, "side": "BUY", "type": "PUT", "premium": l_p_prem, "symbol": l_p_contract['contractSymbol']},
                                {"strike": s_c_strike, "side": "SELL", "type": "CALL", "premium": s_c_prem, "symbol": s_c_contract['contractSymbol']},
                                {"strike": l_c_strike, "side": "BUY", "type": "CALL", "premium": l_c_prem, "symbol": l_c_contract['contractSymbol']}
                            ]
                        }
                    })
                
            # Idea 2: Earnings / Vol Play (Buy)
            atm_call_contract = _get_contract(calls, current_price)
            atm_put_contract = _get_contract(puts, current_price)
            if atm_call_contract and atm_put_contract:
                c_prem = _get_mid(atm_call_contract)
                p_prem = _get_mid(atm_put_contract)
                if c_prem > 0 and p_prem > 0:
                    entry_price = round(c_prem + p_prem, 2)
                    conf = "High" if (is_high_risk or is_risk_off) else "Low"
                    symbol_recs.append({
                        "symbol": symbol,
                        "strategy": "Long Straddle/Strangle",
                        "side": "BUY",
                        "thesis": f"Volatility play. {global_thesis} Positioning for explosive expansion in {symbol}." if is_high_risk else f"Buying cheap volatility ahead of potential macro catalyst expansion.",
                        "expiration": expiration,
                        "target_entry": f"${entry_price:.2f} Debit",
                        "entry_price": entry_price,
                        "pop": "35%",
                        "risk_reward": "Uncapped",
                        "confidence": conf,
                        "diagram_data": {
                            "underlying_price": current_price,
                            "strategy_type": "straddle",
                            "legs": [
                                {"strike": atm_call_contract['strike'], "side": "BUY", "type": "CALL", "premium": c_prem, "symbol": atm_call_contract['contractSymbol']},
                                {"strike": atm_put_contract['strike'], "side": "BUY", "type": "PUT", "premium": p_prem, "symbol": atm_put_contract['contractSymbol']}
                            ]
                        }
                    })
        return symbol_recs
    except Exception as e:
        print(f"Error analyzing {symbol}: {e}")
        return []

def generate_recommendations(symbols: list = None, limit: int = None):
    """
    Generates Top Trade ideas scanning across the provided symbols or MACRO_BASKET in parallel.
    """
    global _RECS_CACHE, _LAST_RECS_FETCH
    
    cache_key = ",".join(sorted(symbols)) if symbols else "default"
    now = datetime.now()
    
    # Check cache
    if cache_key in _RECS_CACHE and cache_key in _LAST_RECS_FETCH:
        age = (now - _LAST_RECS_FETCH[cache_key]).total_seconds()
        if age < _RECS_TTL_SECONDS:
            if _RECS_CACHE[cache_key] == "FETCHING":
                if age < 120: # Allow 120s for parallel scan
                    stale_key = f"{cache_key}_STALE"
                    if stale_key in _RECS_CACHE:
                        print(f"DEBUG: Returning STALE recommendations for {cache_key} while fetching...")
                        stale_data = _RECS_CACHE[stale_key]
                        return stale_data if not limit else stale_data[:limit]
                    return []
            else:
                print(f"DEBUG: Returning cached recommendations for {cache_key} (Age: {int(age)}s)")
                return _RECS_CACHE[cache_key] if not limit else _RECS_CACHE[cache_key][:limit]

    # Mark as fetching
    _LAST_RECS_FETCH[cache_key] = now
    _RECS_CACHE[cache_key] = "FETCHING"

    from data_fetcher import MACRO_BASKET
    health = evaluate_market_health()
    risk_score = health.get("risk_score", 50)
    mood = health.get("market_mood", "Neutral")
    global_thesis = health.get("global_thesis", "Evaluating macro catalysts.")
    
    symbols_to_evaluate = symbols if symbols else MACRO_BASKET
    
    combined_recs = []
    print(f"DEBUG: Starting parallel scan for {len(symbols_to_evaluate)} symbols...")
    
    # Use global executor
    futures = [_EXECUTOR.submit(_analyze_symbol_worker, s, risk_score, mood, global_thesis, health) for s in symbols_to_evaluate]
    for future in futures:
            try:
                results = future.result()
                if results:
                    combined_recs.extend(results)
            except Exception as e:
                print(f"Worker thread error: {e}")

    # Mix up the recommendations
    import random
    random.shuffle(combined_recs)
    
    # Update cache
    _RECS_CACHE[cache_key] = combined_recs
    _RECS_CACHE[f"{cache_key}_STALE"] = combined_recs
    _LAST_RECS_FETCH[cache_key] = datetime.now()
    _save_recs_cache()
    
    if limit:
        return combined_recs[:limit]
    return combined_recs

def evaluate_position_health(symbol: str, strategy: str, plpc: float, dte: int | None, health: dict) -> dict:
    """
    Heuristic-based AI assessment of a position.
    In a production app, this would use a dedicated LLM prompt per position, 
    but we'll use a high-performance heuristic blended with the global macro 'mood'.
    """
    risk_score = health.get("risk_score", 50)
    mood = health.get("market_mood", "Neutral")
    
    # Base Logic
    action = "HOLD"
    rationale = "Position is within acceptable risk parameters."
    details = ["P/L and Greeks are stable.", "Aligned with macro trend."]
    confidence = 85
    
    # Threshold Tuning
    is_short_dte = dte is not None and dte <= 7
    is_long_dte = dte is not None and dte > 14
    is_critical_dte = dte is not None and dte <= 3

    # 1. Critical Danger (Close)
    should_close = False
    if is_critical_dte and plpc < -10:
        should_close = True
        rationale = "Critical Gamma risk: Expiration is imminent and position is underwater."
    elif is_short_dte and plpc < -25:
        should_close = True
        rationale = "High risk of assignment or total loss as expiration approaches."
    elif is_long_dte and plpc < -75:
        should_close = True
        rationale = "Maximum loss threshold reached. Capital preservation prioritized."
    elif not is_long_dte and plpc < -35:
        should_close = True
        rationale = "Significant drawdown detected. Risk-off stance recommended."

    if should_close:
        action = "CLOSE"
        details = [
            f"Unrealized P/L: {plpc:.1f}%",
            f"DTE: {dte if dte is not None else 'N/A'}",
            "Position sustainability is low given current trend and time remaining."
        ]
        confidence = 90
    
    # 2. Strategic Roll (Roll)
    elif (is_short_dte and not should_close) or (plpc > 40):
        action = "ROLL"
        rationale = "Capture profits or extend duration to manage risk."
        details = [
            "Time value is depleted or target profit reached.",
            "Rolling allows locking in gains while maintaining tactical exposure."
        ]
        confidence = 80
        
    # 3. Macro Headwinds (Defensive Hold)
    elif risk_score > 75 and "Bullish" in strategy and plpc < 0:
        action = "HOLD"
        rationale = f"Macro environment is {mood}. Holding defensively."
        details = [
            "Geopolitical tensions are elevated.",
            "Maintaining position but monitored for further weakness."
        ]
        confidence = 70
        
    return {
        "action": action,
        "rationale": rationale,
        "confidence": confidence,
        "details": details
    }

def reprice_strategy(symbol: str, strategy: str, expiration: str):
    """
    Given an existing symbol and strategy, finds the best legs for a NEW expiration.
    Returns a single recommendation object.
    """
    from data_fetcher import get_options_chain
    chain = get_options_chain(symbol, target_expiration=expiration)
    if not chain:
        return None
        
    current_price = chain["current_price"]
    calls = chain.get("calls", [])
    puts = chain.get("puts", [])
    
    if not calls or not puts:
        return None

    # Simplified strategy builders based on the strategy name
    res = {
        "symbol": symbol,
        "strategy": strategy,
        "expiration": expiration,
        "diagram_data": {"underlying_price": current_price}
    }

    try:
        if "Put Credit Spread" in strategy:
            s_put = _get_contract(puts, current_price * 0.95)
            l_put = _get_lower_contract(puts, s_put['strike'])
            if l_put:
                s_p_prem, l_p_prem = _get_mid(s_put), _get_mid(l_put)
                if s_p_prem == 0 or l_p_prem == 0: return None
                res["entry_price"] = round(s_p_prem - l_p_prem, 2)
                res["diagram_data"].update({
                    "strategy_type": "credit_spread",
                    "legs": [
                        {"strike": s_put['strike'], "side": "SELL", "type": "PUT", "premium": s_p_prem, "symbol": s_put['contractSymbol']},
                        {"strike": l_put['strike'], "side": "BUY", "type": "PUT", "premium": l_p_prem, "symbol": l_put['contractSymbol']}
                    ]
                })

        elif "Covered Call" in strategy:
            s_call = _get_contract(calls, current_price * 1.05)
            s_c_prem = _get_mid(s_call)
            if s_c_prem == 0: return None
            res["entry_price"] = s_c_prem
            res["diagram_data"].update({
                "strategy_type": "covered_call",
                "legs": [
                    {"strike": current_price, "side": "BUY", "type": "STOCK", "premium": current_price, "symbol": symbol},
                    {"strike": s_call['strike'], "side": "SELL", "type": "CALL", "premium": s_c_prem, "symbol": s_call['contractSymbol']}
                ]
            })

        elif "Bull Call Debit Spread" in strategy:
            l_call = _get_contract(calls, current_price)
            s_call = _get_higher_contract(calls, l_call['strike'])
            if s_call:
                l_c_prem, s_c_prem = _get_mid(l_call), _get_mid(s_call)
                if l_c_prem == 0 or s_c_prem == 0: return None
                res["entry_price"] = round(l_c_prem - s_c_prem, 2)
                res["diagram_data"].update({
                    "strategy_type": "debit_spread",
                    "legs": [
                        {"strike": l_call['strike'], "side": "BUY", "type": "CALL", "premium": l_c_prem, "symbol": l_call['contractSymbol']},
                        {"strike": s_call['strike'], "side": "SELL", "type": "CALL", "premium": s_c_prem, "symbol": s_call['contractSymbol']}
                    ]
                })

        elif "Iron Condor" in strategy:
            s_p = _get_contract(puts, current_price * 0.95)
            l_p = _get_lower_contract(puts, s_p['strike'])
            s_c = _get_contract(calls, current_price * 1.05)
            l_c = _get_higher_contract(calls, s_c['strike'])
            if all([s_p, l_p, s_c, l_c]):
                s_p_p, l_p_p, s_c_p, l_c_p = _get_mid(s_p), _get_mid(l_p), _get_mid(s_c), _get_mid(l_c)
                if any(p == 0 for p in [s_p_p, l_p_p, s_c_p, l_c_p]): return None
                res["entry_price"] = round(s_p_p + s_c_p - l_p_p - l_c_p, 2)
                res["diagram_data"].update({
                    "strategy_type": "iron_condor",
                    "legs": [
                        {"strike": s_p['strike'], "side": "SELL", "type": "PUT", "premium": s_p_p, "symbol": s_p['contractSymbol']},
                        {"strike": l_p['strike'], "side": "BUY", "type": "PUT", "premium": l_p_p, "symbol": l_p['contractSymbol']},
                        {"strike": s_c['strike'], "side": "SELL", "type": "CALL", "premium": s_c_p, "symbol": s_c['contractSymbol']},
                        {"strike": l_c['strike'], "side": "BUY", "type": "CALL", "premium": l_c_p, "symbol": l_c['contractSymbol']}
                    ]
                })

        elif "Long Straddle/Strangle" in strategy:
            c = _get_contract(calls, current_price)
            p = _get_contract(puts, current_price)
            c_p, p_p = _get_mid(c), _get_mid(p)
            if c_p == 0 or p_p == 0: return None
            res["entry_price"] = round(c_p + p_p, 2)
            res["diagram_data"].update({
                "strategy_type": "straddle",
                "legs": [
                    {"strike": c['strike'], "side": "BUY", "type": "CALL", "premium": c_p, "symbol": c['contractSymbol']},
                    {"strike": p['strike'], "side": "BUY", "type": "PUT", "premium": p_p, "symbol": p['contractSymbol']}
                ]
            })

    except Exception:
        return None

    if "entry_price" not in res:
        return None

    # Sync target_entry string
    side_label = "Credit" if ("SELL" in strategy or "Condor" in strategy or "Spread" in strategy and "SELL" in strategy) else "Debit"
    res["target_entry"] = f"${res['entry_price']:.2f} {side_label}"
    
    return res

