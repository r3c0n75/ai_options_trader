import os
import time
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Global cache to avoid redundant discovery calls
_MODEL_CACHE = {}
DEFAULT_MODEL = "gemini-3-flash-preview"

def _get_model(model_name: str = None):
    """Helper to get a GenerativeModel instance with caching."""
    name = model_name or DEFAULT_MODEL
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None
    
    # Normalize to Tier 1 Previews available in this project
    model_id = name
    if "3.1-pro" in model_id: model_id = "gemini-3.1-pro-preview"
    elif "3-pro" in model_id: model_id = "gemini-3-pro-preview"
    elif "3-flash" in model_id or "flash-latest" in model_id: model_id = "gemini-3-flash-preview"
    elif "2.5-flash" in model_id: model_id = "gemini-2.5-flash"
    elif "2.5-pro" in model_id: model_id = "gemini-2.5-pro"
    elif "flash-8b" in model_id: model_id = "gemini-1.5-flash-8b" # Keep if exists
    
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
    """Generates content with backoff and model walking."""
    # List of models to try in order of likely quota availability for this project
    fallback_chain = ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-3.1-pro-preview"]
    
    # Start with the requested model
    current_model_name = model.model_name.replace("models/", "")
    if current_model_name in fallback_chain:
        fallback_chain.remove(current_model_name)
    fallback_chain.insert(0, current_model_name)

    last_error = ""
    for m_name in fallback_chain:
        try:
            m = _get_model(m_name)
            if not m: continue
            
            for attempt in range(max_retries):
                try:
                    return m.generate_content(prompt)
                except Exception as e:
                    last_error = str(e)
                    if "429" in last_error or "Quota" in last_error:
                        # Exponential backoff
                        wait = (attempt + 1) * 2
                        print(f"DEBUG: 429 for {m_name}. Retrying in {wait}s...")
                        time.sleep(wait)
                    else:
                        raise e # If not a quota error, stop retrying this model
        except Exception as e:
            last_error = str(e)
            print(f"DEBUG: Model {m_name} failed: {last_error[:50]}")
            continue # Try next model in chain

    raise Exception(f"Quota exceeded across all models. {last_error}")

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
        response = _generate_with_retry(model, prompt)
        text = response.text
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        import json
        return json.loads(text)
    except Exception as e:
        return {
            "verdict": "Indeterminate",
            "thesis": "Quota exhausted. Switch to 'Gemini Flash 8B' or check AI Studio billing tier.",
            "suggested_play": "Iron Condor"
        }

def get_research_response(symbol: str, question: str, context: str, model_name: str = None) -> str:
    """Returns a research response for a specific question."""
    model = _get_model(model_name)
    if not model:
        return "Gemini API key not configured."

    prompt = (
        f"You are a professional options trading research assistant. "
        f"Provide a concise, data-driven answer based on the context.\n\n"
        f"Topic: {symbol}\n"
        f"Context (JSON): {context}\n"
        f"User Question: {question}\n\n"
        f"Instructions:\n"
        f"1. Be extremely concise. Avoid filler.\n"
        f"2. Focus on Price, News, Greeks, or Trend data.\n"
        f"3. Max 3-4 short paragraphs.\n"
        f"4. Use bolding for key levels."
    )

    try:
        response = _generate_with_retry(model, prompt)
        return response.text
    except Exception as e:
        return f"Research Error: Quota Limit Reached. (Current key tier is likely FREE). Error: {str(e)[:50]}"
