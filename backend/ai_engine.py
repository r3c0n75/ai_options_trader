import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Default model if none specified
DEFAULT_MODEL = "gemini-flash-latest"

def _get_model(model_name: str = None):
    """Helper to get a GenerativeModel instance."""
    name = model_name or DEFAULT_MODEL
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None
    
    try:
        genai.configure(api_key=api_key)
        # Handle cases where model_name might not have 'models/' prefix
        if not name.startswith("models/"):
            # Some common aliases
            if name == "gemini-1.5-flash": name = "gemini-1.5-flash-latest"
            if name == "gemini-1.5-pro": name = "gemini-1.5-pro"  # pro-latest can be finicky in some tiers
            if name == "gemini-2.0-flash": name = "gemini-2.0-flash"
        
        return genai.GenerativeModel(name)
    except Exception as e:
        print(f"Error initializing model {name}: {e}")
        return None

def get_symbol_vibe(symbol: str, price_data: dict, news_headlines: str, model_name: str = None) -> dict:
    """
    Uses Gemini to synthesize market data and news into a concise 'Pulse'.
    """
    model = _get_model(model_name)
    if not model:
        return {
            "verdict": "Neutral",
            "thesis": "Gemini API key not configured. Please add GOOGLE_API_KEY to .env.",
            "suggested_play": "Hold"
        }

    prompt = f"""
    You are a world-class macroeconomic analyst and options strategist. 
    Analyze the following data for {symbol}:
    - Current Price: ${price_data.get('price', 'N/A')}
    - Change: {price_data.get('change_percent', '0')}%
    - Recent News: {news_headlines}

    Provide a JSON response with:
    1. "verdict": One or two words (e.g. "Bullish", "Bearish", "Cautious", "Volatile").
    2. "thesis": A concise 2-sentence summary of why.
    3. "suggested_play": One of the following: "Long Call", "Long Put", "Covered Call", "Put Credit Spread", "Iron Condor", "Straddle".

    Format: JSON only.
    """

    try:
        response = model.generate_content(prompt)
        # Basic JSON extraction (Gemini often wraps in ```json)
        text = response.text
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        import json
        return json.loads(text)
    except Exception as e:
        print(f"Gemini Error: {e}")
        return {
            "verdict": "Indeterminate",
            "thesis": "Failed to generate AI pulse. Technical error in Gemini synthesis.",
            "suggested_play": "Iron Condor"
        }

def get_research_response(symbol: str, question: str, context: str, model_name: str = None) -> str:
    """
    Streams or returns a research response for a specific question given symbol context.
    """
    model = _get_model(model_name)
    if not model:
        return "Gemini API key not configured."

    prompt = f"""
    You are an AI research assistant for an options trading platform. 
    Topic: {symbol}
    Current Context: {context}

    Question: {question}

    Provide a detailed but concise research answer based on the context. If the context doesn't have the answer, use your general financial knowledge but specify that it's general market context.
    """

    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Research Error: {e}"
