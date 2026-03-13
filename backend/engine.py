from data_fetcher import get_vix_level, get_options_chain

def evaluate_market_health() -> dict:
    """
    Evaluates market health based on the VIX and AI macro sentiment.
    - Seller's Market (High Volatility/Fear): VIX > 25 or Risk Score > 70
    - Buyer's Market (Low Volatility/Fear): VIX < 15 and Risk Score < 30
    - Cash Market (Uncertain): 15 <= VIX <= 25 or Risk Score 30-70
    """
    from data_fetcher import get_vix_level, get_financial_news
    from ai_engine import get_macro_sentiment
    
    try:
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

    # Logic blending VIX and AI Sentiment
    if vix > 25 or risk_score > 70:
        status = "Seller's Market"
        description = f"High risk environment ({mood}). {global_thesis} VIX is {vix:.2f}. Expensive premiums; favor defensive selling or volatility hedges."
    elif vix < 15 and risk_score < 40:
        status = "Buyer's Market"
        description = f"Stable environment ({mood}). {global_thesis} VIX is {vix:.2f}. Cheap premiums; favor directional leverage or long spreads."
    else:
        status = "Neutral / Cash Market"
        description = f"Moderate uncertainty ({mood}). {global_thesis} VIX is {vix:.2f}. Focus on rangebound capture or high-conviction catalysts."
        
    return {
        "status": status,
        "vix_level": round(vix, 2),
        "description": description,
        "risk_score": risk_score,
        "market_mood": mood,
        "global_thesis": global_thesis
    }

def generate_recommendations(symbols: list = None, limit: int = None):
    """
    Generates Top Trade ideas scanning across the provided symbols or MACRO_BASKET.
    """
    from data_fetcher import MACRO_BASKET
    
    health = evaluate_market_health()
    risk_score = health.get("risk_score", 50)
    mood = health.get("market_mood", "Neutral")
    global_thesis = health.get("global_thesis", "Evaluating macro catalysts.")
    
    recs = []
    
    # In a real app, this would deeply analyze the chain for all symbols.
    # For this simulation, we'll pick the top setups based on Market Health
    # and assign a thesis based on recent news.
    
    # Evaluate the provided symbols or the default basket
    symbols_to_evaluate = symbols if symbols else MACRO_BASKET
    
    for symbol in symbols_to_evaluate:
        chain = get_options_chain(symbol)
        if not chain:
            continue
            
        current_price = chain["current_price"]
        expiration = chain["expiration"]
        calls = chain.get("calls", [])
        puts = chain.get("puts", [])
        
        if not calls or not puts:
            continue
            
        # Determine base confidence based on Risk Score
        # Risk > 70 implies significant headwinds for bullish plays
        is_high_risk = risk_score > 70
        is_risk_off = mood == "Risk-Off"
        
        def get_contract(opts, target):
            c = min(opts, key=lambda x: abs(x['strike'] - target))
            return c

        def get_lower_contract(opts, than_strike):
            lower = [p for p in opts if p['strike'] < than_strike]
            if lower:
                # Pick the second closest strike to ensure wider wings
                sorted_lower = sorted(lower, key=lambda x: x['strike'], reverse=True)
                return sorted_lower[min(len(sorted_lower)-1, 1)] 
            return None
            
        def get_higher_contract(opts, than_strike):
            higher = [c for c in opts if c['strike'] > than_strike]
            if higher:
                # Pick the second closest strike to ensure wider wings
                sorted_higher = sorted(higher, key=lambda x: x['strike'])
                return sorted_higher[min(len(sorted_higher)-1, 1)]
            return None

        def get_mid(contract):
            if not contract: return 0.0
            bid = contract.get('bid', 0)
            ask = contract.get('ask', 0)
            if ask > 0:
                return round((bid + ask) / 2, 2)
            return contract.get('last', 0)

        # High Volatility (Seller's Market)
        if health["vix_level"] > 25:
            # Idea 1: Premium collection (Sell)
            s_put_contract = get_contract(puts, current_price * 0.95)
            l_put_contract = get_lower_contract(puts, s_put_contract['strike'])
            if l_put_contract:
                s_put_strike = s_put_contract['strike']
                l_put_strike = l_put_contract['strike']
                
                s_put_prem = get_mid(s_put_contract)
                l_put_prem = get_mid(l_put_contract)
                
                # Skip if market data is zero (ensures no hallucinated prices)
                if s_put_prem == 0 or l_put_prem == 0:
                    continue
                
                entry_price = round(s_put_prem - l_put_prem, 2)
                
                conf = "Moderate" if is_high_risk else "High"
                recs.append({
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
            s_call_contract = get_contract(calls, current_price * 1.05)
            s_call_prem = get_mid(s_call_contract)
            if s_call_prem == 0:
                continue
            
            conf = "Moderate" if is_high_risk else "High"
            recs.append({
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
            l_call_contract = get_contract(calls, current_price)
            l_call_prem = get_mid(l_call_contract)
            if l_call_prem == 0:
                continue
            
            recs.append({
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
            l_call_atm_contract = get_contract(calls, current_price)
            s_call_otm_contract = get_higher_contract(calls, l_call_atm_contract['strike'])
            if s_call_otm_contract:
                l_call_prem = get_mid(l_call_atm_contract)
                s_call_prem = get_mid(s_call_otm_contract)
                
                # Skip if no market data
                if l_call_prem == 0 or s_call_prem == 0:
                    continue

                entry_price = round(l_call_prem - s_call_prem, 2)
                
                conf = "Low" if is_high_risk else "Moderate"
                recs.append({
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
            s_p_contract = get_contract(puts, current_price * 0.95)
            l_p_contract = get_lower_contract(puts, s_p_contract['strike'])
            
            s_c_contract = get_contract(calls, current_price * 1.05)
            l_c_contract = get_higher_contract(calls, s_c_contract['strike'])
            
            if l_p_contract and l_c_contract:
                s_p_strike = s_p_contract['strike']
                l_p_strike = l_p_contract['strike']
                s_c_strike = s_c_contract['strike']
                l_c_strike = l_c_contract['strike']
                
                s_p_prem = get_mid(s_p_contract)
                l_p_prem = get_mid(l_p_contract)
                s_c_prem = get_mid(s_c_contract)
                l_c_prem = get_mid(l_c_contract)
                
                # Skip if any leg lacks market data (no hallucinated prices)
                if s_p_prem == 0 or l_p_prem == 0 or s_c_prem == 0 or l_c_prem == 0:
                    continue
                
                entry_price = round(s_p_prem + s_c_prem - l_p_prem - l_c_prem, 2)

                conf = "High" if (is_high_risk or is_risk_off) else "Moderate"
                recs.append({
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
            atm_call_contract = get_contract(calls, current_price)
            atm_put_contract = get_contract(puts, current_price)
            if atm_call_contract and atm_put_contract:
                # Use real midpoints for straddle pricing
                c_prem = get_mid(atm_call_contract)
                p_prem = get_mid(atm_put_contract)
                
                # Skip if no market data (ensures no hallucinated prices)
                if c_prem == 0 or p_prem == 0:
                    continue
                
                entry_price = round(c_prem + p_prem, 2)

                # Straddles/Strangles benefit from realized volatility expansion
                conf = "High" if (is_high_risk or is_risk_off) else "Low"
                recs.append({
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
            
    # Mix up the recommendations
    import random
    random.shuffle(recs)
    
    if limit:
        return recs[:limit]
    return recs

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
    # If DTE is long (>14 days), we are much more tolerant of P/L swings
    # If DTE is short (<7 days), we are very sensitive to any loss (Gamma risk)
    
    is_short_dte = dte is not None and dte <= 7
    is_long_dte = dte is not None and dte > 14
    is_critical_dte = dte is not None and dte <= 3

    # 1. Critical Danger (Close)
    # Aggressive close only if:
    # - Short DTE and losing money
    # - Long DTE and losing > 75% (likely a total bust)
    # - Any DTE and losing > 50% on a short-term trade
    
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
        action = "HOLD" # downgraded from CLOSE/ROLL to HOLD to avoid panic
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

    def get_contract(opts, target):
        return min(opts, key=lambda x: abs(x['strike'] - target))

    def get_lower_contract(opts, than_strike):
        lower = [p for p in opts if p['strike'] < than_strike]
        if lower:
            sorted_lower = sorted(lower, key=lambda x: x['strike'], reverse=True)
            return sorted_lower[min(len(sorted_lower)-1, 1)] 
        return None
        
    def get_higher_contract(opts, than_strike):
        higher = [c for c in opts if c['strike'] > than_strike]
        if higher:
            sorted_higher = sorted(higher, key=lambda x: x['strike'])
            return sorted_higher[min(len(sorted_higher)-1, 1)]
        return None

    def get_mid(contract):
        if not contract: return 0.0
        bid = contract.get('bid', 0)
        ask = contract.get('ask', 0)
        return round((bid + ask) / 2, 2) if ask > 0 else contract.get('last', 0)

    # Simplified strategy builders based on the strategy name
    res = {
        "symbol": symbol,
        "strategy": strategy,
        "expiration": expiration,
        "diagram_data": {"underlying_price": current_price}
    }

    try:
        if "Put Credit Spread" in strategy:
            s_put = get_contract(puts, current_price * 0.95)
            l_put = get_lower_contract(puts, s_put['strike'])
            if l_put:
                s_p_prem, l_p_prem = get_mid(s_put), get_mid(l_put)
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
            s_call = get_contract(calls, current_price * 1.05)
            s_c_prem = get_mid(s_call)
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
            l_call = get_contract(calls, current_price)
            s_call = get_higher_contract(calls, l_call['strike'])
            if s_call:
                l_c_prem, s_c_prem = get_mid(l_call), get_mid(s_call)
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
            s_p = get_contract(puts, current_price * 0.95)
            l_p = get_lower_contract(puts, s_p['strike'])
            s_c = get_contract(calls, current_price * 1.05)
            l_c = get_higher_contract(calls, s_c['strike'])
            if all([s_p, l_p, s_c, l_c]):
                s_p_p, l_p_p, s_c_p, l_c_p = get_mid(s_p), get_mid(l_p), get_mid(s_c), get_mid(l_c)
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
            c = get_contract(calls, current_price)
            p = get_contract(puts, current_price)
            c_p, p_p = get_mid(c), get_mid(p)
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

