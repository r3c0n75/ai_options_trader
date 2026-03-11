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
    
    symbols_to_evaluate = MACRO_BASKET[:3] # Pick top 3 for speed (SPY, QQQ, TMF)
    
    for symbol in symbols_to_evaluate:
        chain = get_options_chain(symbol)
        if not chain:
            continue
            
        current_price = chain["current_price"]
        expiration = chain["expiration"]
        
        if health["status"] == "Seller's Market":
            recs.append({
                "symbol": symbol,
                "strategy": "Put Credit Spread",
                "thesis": f"High Volatility. Catalyst Context: {news_headlines[:100]}... Selling a put to capture premium crush.",
                "expiration": expiration,
                "target_entry": f"Sell Put ~${round(current_price * 0.95, 2)} strk",
                "pop": "75%", 
                "risk_reward": "1:3",
                "confidence": "High"
            })
        elif health["status"] == "Buyer's Market":
            recs.append({
                "symbol": symbol,
                "strategy": "Long Call / Debit Spread",
                "thesis": f"Low Volatility breakout setup. Catalyst Context: {news_headlines[:100]}... Cheap premium favors buying.",
                "expiration": expiration,
                "target_entry": f"Buy Call ~${round(current_price * 1.02, 2)} strk",
                "pop": "40%", 
                "risk_reward": "4:1",
                "confidence": "Moderate"
            })
        else:
            recs.append({
                "symbol": symbol,
                "strategy": "Iron Condor",
                "thesis": f"Neutral market. Catalyst Context: {news_headlines[:100]}... Expecting {symbol} to remain rangebound.",
                "expiration": expiration,
                "target_entry": "Market Neutral Spread",
                "pop": "60%",
                "risk_reward": "1:2",
                "confidence": "Low"
            })
            
    return recs[:3] # Return top 3 ideas
