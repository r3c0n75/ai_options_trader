import httpx
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"

try:
    response = httpx.get(url, timeout=10.0)
    models = response.json().get("models", [])
    print("Available models:")
    for m in models:
        if "generateContent" in m.get("supportedGenerationMethods", []):
            print(m["name"])
except Exception as e:
    print(f"Error: {e}")
