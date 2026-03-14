import os
import time
import google.generativeai as genai
from dotenv import load_dotenv
from debug_utils import log_api_call, log_ai_model, log_error

load_dotenv()

# Global cache to avoid redundant discovery calls
_MODEL_CACHE = {}
DEFAULT_MODEL = "gemini-1.5-flash" 

def _get_model(model_name: str = None):
    """Helper to get a GenerativeModel instance with caching."""
    name = model_name or DEFAULT_MODEL
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None
    
    # Normalize to Tier 1 Previews available in this project
    model_id = name
    if "3.1-pro" in model_id: model_id = "gemini-3.1-pro-preview"
    elif "3.1-flash" in model_id: model_id = "gemini-3.1-flash-lite-preview"
    elif "3-pro" in model_id: model_id = "gemini-3-pro-preview"
    elif "3-flash" in model_id: model_id = "gemini-3-flash-preview"
    elif "2.5-pro" in model_id: model_id = "gemini-2.5-pro"
    elif "2.5-flash-lite" in model_id: model_id = "gemini-2.5-flash-lite"
    elif "2.5-flash" in model_id: model_id = "gemini-2.5-flash"
    elif "2.0-flash-lite" in model_id: model_id = "gemini-2.0-flash-lite"
    elif "2.0-flash" in model_id: model_id = "gemini-2.0-flash"
    elif "flash-lite" in model_id: model_id = "gemini-2.0-flash-lite"
    elif "1.5-pro" in model_id: model_id = "gemini-1.5-pro"
    elif "flash-latest" in model_id: model_id = "gemini-flash-latest"
    elif "1.5-flash" in model_id: model_id = "gemini-flash-latest"
    elif "m37" in model_id.lower() or "placeholder_m37" in model_id.lower(): model_id = "gemini-2.5-flash"
    elif "m18" in model_id.lower() or "placeholder_m18" in model_id.lower(): model_id = "gemini-3.1-pro" # Link M18 to the Pro model
    
    if not model_id.startswith("models/"):
        model_id = f"models/{model_id}"

    if model_id in _MODEL_CACHE:
        return _MODEL_CACHE[model_id]

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_id)
        _MODEL_CACHE[model_id] = model
        return model
    except Exception as e:
        print(f"Error initializing model {model_id}: {e}")
        return None

def _generate_with_retry(model, prompt, max_retries=2):
    """Generates content with backoff and prioritized model hierarchy."""
    import random
    
    # Priority order: Newest Flash models first as they have separate/higher quotas
    fallback_chain = [
        "gemini-3.1-flash-lite-preview",
        "gemini-3-flash-preview",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-flash-8b",
        "gemini-flash-latest"
    ]
    
    # Start with the requested model
    current_model_name = model.model_name.replace("models/", "")
    if current_model_name in fallback_chain:
        fallback_chain.remove(current_model_name)
    fallback_chain.insert(0, current_model_name)

    last_error = ""
    start_time = time.time()
    max_total_time = 15.0 # Increased to 15s to allow for fallbacks
    
    for m_name in fallback_chain:
        if time.time() - start_time > max_total_time:
            print(f"DEBUG: AI execution exceeded max total time of {max_total_time}s.")
            break
            
        try:
            m = _get_model(m_name)
            if not m: continue
            
            for attempt in range(max_retries):
                # Check for total time expiration before each attempt
                time_remaining = max_total_time - (time.time() - start_time)
                if time_remaining <= 0: break
                
                try:
                    # Individual request timeout is now strictly bounded by remaining time or 8s
                    request_timeout = min(8.0, time_remaining)
                    log_api_call("Gemini")
                    log_ai_model(m_name)
                    response = m.generate_content(prompt, request_options={"timeout": request_timeout})
                    return response, m_name # Return both response and the model name used
                except Exception as e:
                    last_error = str(e)
                    print(f"DEBUG: Model {m_name} failed (attempt {attempt+1}): {last_error}")
                    
                    if "429" in last_error or "Quota" in last_error:
                        # Implement Jittered Exponential Backoff
                        wait_base = 2 ** (attempt + 1)
                        wait_time = wait_base + random.uniform(0.1, 0.5)
                        wait_time = min(wait_time, 5.0) # Cap wait at 5s
                        
                        print(f"DEBUG: Quota hit on {m_name}. Backing off {wait_time:.2f}s before fallback.")
                        time.sleep(wait_time)
                        break # Try next model immediately after backoff
                        
                    if "504" in last_error or "deadline" in last_error.lower():
                        break
                    
                    time.sleep(0.5)
        except Exception as e:
            last_error = str(e)
            continue 

    raise Exception(f"AI exhaustion. Last error: {last_error}")

def get_symbol_vibe(symbol: str, price_data: dict, news_headlines: str, model_name: str = None) -> dict:
    """Uses Gemini to synthesize market data into a concise 'Pulse'."""
    model = _get_model(model_name)
    if not model:
        return {"verdict": "Neutral", "thesis": "API key missing.", "suggested_play": "Hold"}

    prompt = f"""Macro Analysis for {symbol}:
Price Info: {price_data}
Recent News: {news_headlines}

Task: Synthesize the current price trend (Short vs long term) and news into a professional trading 'vibe'.
Return ONLY valid JSON with keys: verdict, thesis (2 sentences explaining the trend/news blend), suggested_play."""

    try:
        response, actual_model = _generate_with_retry(model, prompt)
        text = response.text
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        import json
        res = json.loads(text)
        res["model"] = actual_model
        return res
    except Exception as e:
        error_msg = str(e)
        log_error("AI_ENGINE:get_symbol_vibe", "GET", 500, error_msg)
        print(f"CRITICAL: get_symbol_vibe failed: {error_msg}")
        return {
            "verdict": "Error",
            "thesis": f"AI Engine Exception: {error_msg[:100]}... Check logs for details.",
            "suggested_play": "N/A"
        }

def get_research_response(symbol: str, question: str, context: str, model_name: str = None) -> str:
    """Returns a research response, with automatic comparison support."""
    from data_fetcher import get_stock_bars, get_financial_news
    import re

    # 1. Detect other symbols in the question
    tickers = re.findall(r'\b[A-Z]{2,5}\b', question)
    comparison_data = {}
    
    for t in tickers:
        if t != symbol:
            try:
                bars = get_stock_bars(t, period="1D")
                price = bars[-1]["close"] if bars else 0
                bars_3m = get_stock_bars(t, period="3M")
                perf_3m = ((price - bars_3m[0]["close"]) / bars_3m[0]["close"] * 100) if bars_3m else 0
                
                comparison_data[t] = {
                    "price": price,
                    "trend_3m": round(perf_3m, 2),
                    "status": "Comparison Data Fetched"
                }
            except:
                continue

    # 2. Enrich context
    enriched_context = context
    if comparison_data:
        enriched_context += f"\n\nCOMPARISON DATA FOR OTHER SYMBOLS: {comparison_data}"

    model = _get_model(model_name)
    if not model:
        return "Gemini API key not configured."

    prompt = (
        f"You are a professional options trading research assistant. "
        f"Provide a concise, data-driven answer based on the context.\n\n"
        f"Primary Topic: {symbol}\n"
        f"Context (JSON): {enriched_context}\n"
        f"User Question: {question}\n\n"
        f"Instructions:\n"
        f"1. Be extremely concise. Avoid filler.\n"
        f"2. If multiple assets are mentioned, COMPARE them using the provided data.\n"
        f"3. Focus on Price, News, Greeks, or Trend data.\n"
        f"4. Max 3-4 short paragraphs.\n"
        f"5. Use bolding for key levels."
    )

    try:
        response, actual_model = _generate_with_retry(model, prompt)
        return f"{response.text}\n\n*Analysis powered by {actual_model}*"
    except Exception as e:
        log_error("AI_ENGINE:get_research_response", "GET", 500, str(e))
        return f"Research Error: Quota Limit Reached. (Current key tier is likely FREE). Error: {str(e)[:50]}"

def get_macro_sentiment(news_headlines: str, vix: float, model_name: str = None) -> dict:
    """Synthesizes news and VIX into a market risk score and mood."""
    model = _get_model(model_name)
    if not model:
        return {"risk_score": 50, "market_mood": "Neutral", "global_thesis": "AI sentiment unavailable."}

    prompt = f"""Macro Sentiment Analysis:
VIX Level: {vix}
Headlines: {news_headlines}

Task: Determine the global market 'mood' and a risk score (0-100, where 100 is extreme fear/war).
Consider geopolitical risk, inflation, and volatility.
Return ONLY valid JSON with keys: risk_score (int), market_mood (Risk-On, Risk-Off, Defensive), global_thesis (1 concise sentence)."""

    try:
        response, actual_model = _generate_with_retry(model, prompt)
        text = response.text
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        # Clean potential trailing characters or single quotes
        text = text.strip()
        if text.startswith("'") and text.endswith("'"):
            text = text[1:-1]
            
        import json
        res = json.loads(text)
        res["model"] = actual_model
        return res
    except Exception as e:
        log_error("AI_ENGINE:get_macro_sentiment", "GET", 500, str(e))
        print(f"DEBUG: get_macro_sentiment failed: {e}")
        return {
            "risk_score": 50, 
            "market_mood": "Defensive", 
            "global_thesis": "Macro metrics are stable, but AI synthesis is delayed. Monitoring VIX and news for updates."
        }

def analyze_news_impact(headline: str, summary: str, portfolio_context: list, model_name: str = None) -> dict:
    """Analyzes a news item against the user's current portfolio positions."""
    model = _get_model(model_name)
    if not model:
        return {
            "impact_score": 5, 
            "analysis": "AI key missing.", 
            "portfolio_relevance": "N/A", 
            "recommended_action": "HOLD",
            "sentiment": "Neutral"
        }

    prompt = f"""News Analysis & Portfolio Impact:
Headline: {headline}
Summary: {summary}
Current Portfolio Positions: {portfolio_context}

Task: Analyze how this news affects the current portfolio. 
Consider:
1. Macro correlation (sector impact).
2. Direct asset impact (is the ticker in the portfolio?).
3. Options risk (gamma, theta, or directional delta).

Return ONLY valid JSON with keys:
- impact_score (int 1-10, where 10 is critical/urgent)
- analysis (2-3 expert sentences)
- portfolio_relevance (Detailed mention of which tickers are most affected and why)
- recommended_action (HOLD, CLOSE, ROLL, or HEDGE)
- sentiment (Bullish, Bearish, or Neutral)
"""

    try:
        response, actual_model = _generate_with_retry(model, prompt)
        text = response.text
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        import json
        res = json.loads(text)
        res["model"] = actual_model
        return res
    except Exception as e:
        log_error("AI_ENGINE:analyze_news_impact", "POST", 500, str(e))
        print(f"DEBUG: analyze_news_impact failed: {e}")
        return {
            "impact_score": 5,
            "analysis": "Analysis temporarily unavailable due to AI service limits.",
            "portfolio_relevance": "Could not determine precise impact at this time.",
            "recommended_action": "HOLD",
            "sentiment": "Neutral"
        }
