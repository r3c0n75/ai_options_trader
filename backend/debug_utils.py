import time
from collections import Counter, deque

# Global Debug Statistics
DEBUG_STATS = {
    "api_calls": Counter(),
    "ai_models": Counter(),
    "errors": deque(maxlen=50),
    "latency": deque(maxlen=50),
    "cache_hits": 0,
    "cache_misses": 0,
    "start_time": time.time()
}

def log_api_call(provider: str):
    DEBUG_STATS["api_calls"][provider] += 1

def log_ai_model(model_name: str):
    DEBUG_STATS["ai_models"][model_name] += 1

def log_cache(hit: bool):
    global DEBUG_STATS
    if hit: DEBUG_STATS["cache_hits"] += 1
    else: DEBUG_STATS["cache_misses"] += 1

def get_debug_stats_dict():
    return {
        "api_calls": dict(DEBUG_STATS["api_calls"]),
        "ai_models": dict(DEBUG_STATS["ai_models"]),
        "cache": {
            "hits": DEBUG_STATS["cache_hits"],
            "misses": DEBUG_STATS["cache_misses"],
            "total": DEBUG_STATS["cache_hits"] + DEBUG_STATS["cache_misses"],
            "efficiency": round(DEBUG_STATS["cache_hits"] / (DEBUG_STATS["cache_hits"] + DEBUG_STATS["cache_misses"]) * 100, 2) if (DEBUG_STATS["cache_hits"] + DEBUG_STATS["cache_misses"]) > 0 else 0
        },
        "errors": list(DEBUG_STATS["errors"]),
        "latency": list(DEBUG_STATS["latency"]),
        "uptime": round(time.time() - DEBUG_STATS["start_time"], 2)
    }

def log_error(path: str, method: str, status: int, error_msg: str = None):
    DEBUG_STATS["errors"].append({
        "path": path,
        "status": status,
        "method": method,
        "error": error_msg,
        "ts": time.time()
    })

def log_latency(path: str, duration: float, status: int):
    DEBUG_STATS["latency"].append({
        "path": path,
        "duration": round(duration * 1000, 2),
        "status": status,
        "ts": time.time()
    })
