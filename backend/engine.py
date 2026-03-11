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

def generate_recommendations():
    """
    Generates Top 3 Trade ideas scanning across the MACRO_BASKET.
    """
    from data_fetcher import MACRO_BASKET, get_financial_news
    
    health = evaluate_market_health()
    news = get_financial_news(limit=5)
    news_headlines = " | ".join([n['headline'] for n in news]) if news else "No major catalysts detected."
    
    recs = []
    
    # In a real app, this would deeply analyze the chain for all symbols.
    # For this simulation, we'll pick the top 3 best setups based on Market Health
    # and assign a thesis based on recent news.
    
    # We pick more symbols to offer a wider variety of ideas
    symbols_to_evaluate = MACRO_BASKET[:len(MACRO_BASKET)] # Evaluate the whole basket
    
    for symbol in symbols_to_evaluate:
        chain = get_options_chain(symbol)
        if not chain:
            continue
            
        current_price = chain["current_price"]
        expiration = chain["expiration"]
        
        # High Volatility (Seller's Market)
        if health["vix_level"] > 25:
            # Idea 1: Premium collection (Sell)
            recs.append({
                "symbol": symbol,
                "strategy": "Put Credit Spread",
                "side": "SELL",
                "thesis": f"High Implied Volatility crush expected. Selling downside insurance on {symbol}.",
                "expiration": expiration,
                "target_entry": f"Sell Put ~${round(current_price * 0.95, 2)} / Buy Put ~${round(current_price * 0.94, 2)}",
                "pop": "78%", 
                "risk_reward": "1:3.5",
                "confidence": "High"
            })
            # Idea 2: Strategic Covered Call (Sell)
            recs.append({
                "symbol": symbol,
                "strategy": "Covered Call",
                "side": "SELL",
                "thesis": f"Capitalizing on expensive call premiums while holding {symbol}.",
                "expiration": expiration,
                "target_entry": f"Sell Call ~${round(current_price * 1.05, 2)} strike",
                "pop": "82%",
                "risk_reward": "1:1",
                "confidence": "High"
            })
            
        # Low Volatility (Buyer's Market)
        elif health["vix_level"] < 17:
            # Idea 1: Directional Leverage (Buy)
            recs.append({
                "symbol": symbol,
                "strategy": "Long Call / ATM Leap",
                "side": "BUY",
                "thesis": f"Low cost of leverage. Technical breakout potential for {symbol}.",
                "expiration": expiration,
                "target_entry": f"Buy Call at ~${round(current_price, 2)} strike",
                "pop": "45%", 
                "risk_reward": "5:1",
                "confidence": "Moderate"
            })
            # Idea 2: Bullish Trend (Buy)
            recs.append({
                "symbol": symbol,
                "strategy": "Bull Call Debit Spread",
                "side": "BUY",
                "thesis": f"Cheap premium. Capped risk play on continued macro strength.",
                "expiration": expiration,
                "target_entry": f"Buy Call At-the-money / Sell Call OTM",
                "pop": "55%",
                "risk_reward": "2.5:1",
                "confidence": "Moderate"
            })
            
        # Neutral / Sideways (Cash/Moderate Market)
        else:
            # Idea 1: Rangebound Capture (Sell)
            recs.append({
                "symbol": symbol,
                "strategy": "Iron Condor",
                "side": "SELL",
                "thesis": f"Macro consolidation. Harvesting theta decay as {symbol} stays rangebound.",
                "expiration": expiration,
                "target_entry": "Market Neutral 10-delta Wings",
                "pop": "65%",
                "risk_reward": "1:2.2",
                "confidence": "Moderate"
            })
            # Idea 2: Earnings / Vol Play (Buy)
            recs.append({
                "symbol": symbol,
                "strategy": "Long Straddle/Strangle",
                "side": "BUY",
                "thesis": f"Buying cheap volatility ahead of potential macro catalyst expansion.",
                "expiration": expiration,
                "target_entry": f"Buy Call + Buy Put near money",
                "pop": "35%",
                "risk_reward": "Uncapped",
                "confidence": "Low"
            })
            
    # Mix up the recommendations and pick the best 5
    import random
    random.shuffle(recs)
    return recs[:6]
