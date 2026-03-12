from data_fetcher import get_vix_level, get_options_chain

def evaluate_market_health() -> dict:
    """
    Evaluates market health based on the VIX.
    - Seller's Market (High Volatility): VIX > 25
    - Buyer's Market (Low Volatility): VIX < 15
    - Cash Market (Uncertain): 15 <= VIX <= 25
    """
    vix = get_vix_level()
    
    if vix > 25:
        status = "Seller's Market"
        description = "High volatility detected. Options premiums are expensive. Favor selling strategies like Credit Spreads or Iron Condors."
    elif vix < 15:
        status = "Buyer's Market"
        description = "Low volatility detected. Options premiums are cheap. Favor buying strategies like Long Calls/Puts or Debit Spreads."
    else:
        status = "Cash Market"
        description = "Moderate volatility. Directional conviction is lower. Favor staying in cash or taking smaller, highly selective positions."
        
    return {
        "status": status,
        "vix_level": round(vix, 2),
        "description": description
    }

def generate_recommendations(symbols: list = None):
    """
    Generates Top Trade ideas scanning across the provided symbols or MACRO_BASKET.
    """
    from data_fetcher import MACRO_BASKET, get_financial_news
    
    health = evaluate_market_health()
    news = get_financial_news(limit=5)
    news_headlines = " | ".join([n['headline'] for n in news]) if news else "No major catalysts detected."
    
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
            
        def get_contract(opts, target):
            c = min(opts, key=lambda x: abs(x['strike'] - target))
            return c['strike'], c['contractSymbol']

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

        # High Volatility (Seller's Market)
        if health["vix_level"] > 25:
            # Idea 1: Premium collection (Sell)
            s_put_strike, s_put_occ = get_contract(puts, current_price * 0.95)
            l_put_contract = get_lower_contract(puts, s_put_strike)
            if l_put_contract:
                l_put_strike = l_put_contract['strike']
                l_put_occ = l_put_contract['contractSymbol']
                recs.append({
                    "symbol": symbol,
                    "strategy": "Put Credit Spread",
                    "side": "SELL",
                    "thesis": f"High Implied Volatility crush expected. Selling downside insurance on {symbol}.",
                    "expiration": expiration,
                    "target_entry": f"Sell Put ~${s_put_strike} / Buy Put ~${l_put_strike}",
                    "pop": "78%", 
                    "risk_reward": "1:3.5",
                    "confidence": "High",
                    "diagram_data": {
                        "underlying_price": current_price,
                        "strategy_type": "credit_spread",
                        "legs": [
                            {"strike": s_put_strike, "side": "SELL", "type": "PUT", "premium": round(current_price * 0.015, 2), "symbol": s_put_occ},
                            {"strike": l_put_strike, "side": "BUY", "type": "PUT", "premium": round(current_price * 0.005, 2), "symbol": l_put_occ}
                        ]
                    }
                })
                
            # Idea 2: Strategic Covered Call (Sell)
            s_call_strike, s_call_occ = get_contract(calls, current_price * 1.05)
            recs.append({
                "symbol": symbol,
                "strategy": "Covered Call",
                "side": "SELL",
                "thesis": f"Capitalizing on expensive call premiums while holding {symbol}.",
                "expiration": expiration,
                "target_entry": f"Sell Call ~${s_call_strike} strike",
                "pop": "82%",
                "risk_reward": "1:1",
                "confidence": "High",
                "diagram_data": {
                    "underlying_price": current_price,
                    "strategy_type": "covered_call",
                    "legs": [
                        {"strike": s_call_strike, "side": "SELL", "type": "CALL", "premium": 3.20, "symbol": s_call_occ}
                    ]
                }
            })
            
        # Low Volatility (Buyer's Market)
        elif health["vix_level"] < 17:
            # Idea 1: Directional Leverage (Buy)
            l_call_strike, l_call_occ = get_contract(calls, current_price)
            recs.append({
                "symbol": symbol,
                "strategy": "Long Call / ATM Leap",
                "side": "BUY",
                "thesis": f"Low cost of leverage. Technical breakout potential for {symbol}.",
                "expiration": expiration,
                "target_entry": f"Buy Call at ~${l_call_strike} strike",
                "pop": "45%", 
                "risk_reward": "5:1",
                "confidence": "Moderate",
                "diagram_data": {
                    "underlying_price": current_price,
                    "strategy_type": "long_call",
                    "legs": [
                        {"strike": l_call_strike, "side": "BUY", "type": "CALL", "premium": 5.00, "symbol": l_call_occ}
                    ]
                }
            })
            # Idea 2: Bullish Trend (Buy)
            l_call_atm_strike, l_call_atm_occ = get_contract(calls, current_price)
            s_call_otm_contract = get_higher_contract(calls, l_call_atm_strike)
            if s_call_otm_contract:
                s_call_otm_strike = s_call_otm_contract['strike']
                s_call_otm_occ = s_call_otm_contract['contractSymbol']
                recs.append({
                    "symbol": symbol,
                    "strategy": "Bull Call Debit Spread",
                    "side": "BUY",
                    "thesis": f"Cheap premium. Capped risk play on continued macro strength.",
                    "expiration": expiration,
                    "target_entry": f"Buy Call At-the-money / Sell Call OTM",
                    "pop": "55%",
                    "risk_reward": "2.5:1",
                    "confidence": "Moderate",
                    "diagram_data": {
                        "underlying_price": current_price,
                        "strategy_type": "debit_spread",
                        "legs": [
                            {"strike": l_call_atm_strike, "side": "BUY", "type": "CALL", "premium": 4.00, "symbol": l_call_atm_occ},
                            {"strike": s_call_otm_strike, "side": "SELL", "type": "CALL", "premium": 1.50, "symbol": s_call_otm_occ}
                        ]
                    }
                })
            
        # Neutral / Sideways (Cash/Moderate Market)
        else:
            # Idea 1: Rangebound Capture (Sell)
            s_p_strike, s_p_occ = get_contract(puts, current_price * 0.95)
            l_p_contract = get_lower_contract(puts, s_p_strike)
            
            s_c_strike, s_c_occ = get_contract(calls, current_price * 1.05)
            l_c_contract = get_higher_contract(calls, s_c_strike)
            
            if l_p_contract and l_c_contract:
                l_p_strike = l_p_contract['strike']
                l_p_occ = l_p_contract['contractSymbol']
                l_c_strike = l_c_contract['strike']
                l_c_occ = l_c_contract['contractSymbol']
                
                # Conservatively scaled premiums (collecting ~1/4 of total wing width)
                # Short legs at ~0.8% of price, Long legs at ~0.2%
                s_p_prem = round(current_price * 0.008, 2)
                l_p_prem = round(current_price * 0.002, 2)
                s_c_prem = round(current_price * 0.008, 2)
                l_c_prem = round(current_price * 0.002, 2)

                recs.append({
                    "symbol": symbol,
                    "strategy": "Iron Condor",
                    "side": "SELL",
                    "thesis": f"Macro consolidation. Harvesting theta decay as {symbol} stays rangebound.",
                    "expiration": expiration,
                    "target_entry": "Market Neutral 10-delta Wings",
                    "pop": "65%",
                    "risk_reward": "1:2.2",
                    "confidence": "Moderate",
                    "diagram_data": {
                        "underlying_price": current_price,
                        "strategy_type": "iron_condor",
                        "legs": [
                            {"strike": s_p_strike, "side": "SELL", "type": "PUT", "premium": s_p_prem, "symbol": s_p_occ},
                            {"strike": l_p_strike, "side": "BUY", "type": "PUT", "premium": l_p_prem, "symbol": l_p_occ},
                            {"strike": s_c_strike, "side": "SELL", "type": "CALL", "premium": s_c_prem, "symbol": s_c_occ},
                            {"strike": l_c_strike, "side": "BUY", "type": "CALL", "premium": l_c_prem, "symbol": l_c_occ}
                        ]
                    }
                })
                
            # Idea 2: Earnings / Vol Play (Buy)
            atm_call_strike, atm_call_occ = get_contract(calls, current_price)
            atm_put_strike, atm_put_occ = get_contract(puts, current_price)
            if atm_call_strike and atm_put_strike:
                # Higher price assets need more realistic premiums to avoid ITM-skewed diagrams
                straddle_prem = round(current_price * 0.015, 2)
                recs.append({
                    "symbol": symbol,
                    "strategy": "Long Straddle/Strangle",
                    "side": "BUY",
                    "thesis": f"Buying cheap volatility ahead of potential macro catalyst expansion.",
                    "expiration": expiration,
                    "target_entry": f"Buy Call + Buy Put near money",
                    "pop": "35%",
                    "risk_reward": "Uncapped",
                    "confidence": "Low",
                    "diagram_data": {
                        "underlying_price": current_price,
                        "strategy_type": "straddle",
                        "legs": [
                            {"strike": atm_call_strike, "side": "BUY", "type": "CALL", "premium": straddle_prem, "symbol": atm_call_occ},
                            {"strike": atm_put_strike, "side": "BUY", "type": "PUT", "premium": straddle_prem, "symbol": atm_put_occ}
                        ]
                    }
                })
            
    # Mix up the recommendations and pick the best 5
    import random
    random.shuffle(recs)
    return recs[:6]

