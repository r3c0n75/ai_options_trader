import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Default model if none specified
DEFAULT_MODEL = "gemini-2.0-flash"

def _get_model(model_name: str = None):
    """Helper to get a GenerativeModel instance."""
    name = model_name or DEFAULT_MODEL
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("DEBUG: GOOGLE_API_KEY missing.")
        return None
    
    try:
        genai.configure(api_key=api_key)
        
        # Normalize common names to specific stable IDs
        model_id = name
        if "gemini-3" in model_id: pass # Use as is
        elif "gemini-2.5" in model_id: pass # Use as is
        elif "gemini-2.0-flash-thinking" in model_id: model_id = "gemini-2.0-flash-thinking-exp"
        elif "gemini-2.0-flash" in model_id: model_id = "gemini-2.0-flash"
        elif "gemini-2.0-pro" in model_id: model_id = "gemini-2.0-pro-exp"
        elif "gemini-1.5-flash" in model_id: model_id = "gemini-1.5-flash"
        elif "gemini-1.5-pro" in model_id: model_id = "gemini-1.5-pro"
        elif "gemini-flash-latest" in model_id: model_id = "gemini-flash-latest"
        elif "gemini-pro-latest" in model_id: model_id = "gemini-pro-latest"
        elif "gemini-pro" in model_id: model_id = "gemini-pro-latest"
        elif "gemini-flash" in model_id: model_id = "gemini-flash-latest"
        
        # Ensure prefix
        if not model_id.startswith("models/"):
            model_id = f"models/{model_id}"
            
        print(f"DEBUG: Attempting to use Gemini model: {model_id}")
        
        try:
            # Test if model is available
            m = genai.get_model(model_id)
            print(f"DEBUG: Model metadata retrieved: {m.name}")
            return genai.GenerativeModel(model_id)
        except Exception as e:
            print(f"DEBUG: Error retrieving model {model_id}: {e}. Falling back to gemini-1.5-flash.")
            # Final attempts
            try:
                return genai.GenerativeModel("models/gemini-1.5-flash")
            except:
                return genai.GenerativeModel("models/gemini-pro")
    except Exception as e:
        print(f"Error in _get_model for {name}: {e}")
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
