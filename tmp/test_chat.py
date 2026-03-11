import httpx
import json

url = "http://localhost:8000/chat/AAPL"
payload = {
    "question": "Hello, how are you?",
    "context": "Working on a trading app.",
    "model": "gemini-1.5-flash"
}

try:
    response = httpx.post(url, json=payload, timeout=30.0)
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text}")
except Exception as e:
    print(f"Error: {e}")
