# AI Macro Strategy: Theoretical Framework & Implementation

This document outlines the architectural logic and financial heuristics used by the **AI Options Trader** to synthesize "Top Macro Opportunities." The system operates as a sentient overlay on top of raw market data, transforming volatility metrics and news sentiment into actionable option strategies.

## 1. Core Philosophy: Top-Down Synthesis
Traditional trading bots often focus on bottom-up technical indicators (RSI, MACD) for individual symbols. This platform reverses that flow:
1.  **Macro Pulse**: Diagnose the global market "regime" first.
2.  **Sector Selection**: Apply the regime to a diversified basket of core ETFs (SPY, QQQ, GLD, TMF, etc.).
3.  **Strategy Mapping**: Select the mathematically optimal option structure for the detected regime.

---

## 2. Phase I: Market Regime Detection
The system evaluates market health every 10 minutes (cached) to prevent noise. It blends hard data with LLM-driven qualitative analysis.

### Inputs
*   **VIX (CBOE Volatility Index)**: The "Fear Gauge" providing absolute volatility levels.
*   **Global News Catalysts**: The top 15 breaking headlines (via Alpaca/Yahoo News).
*   **Risk Score (0-100)**: A Gemini-synthesized metric for geopolitical and macro tail-risks.

### The Three Regimes
| Regime | Thresholds | AI Stance | Strategic Focus |
| :--- | :--- | :--- | :--- |
| **Seller's Market** | VIX > 25 OR Risk > 70 | **Defensive/Income** | High IV Crush, Premium Collection |
| **Buyer's Market** | VIX < 17 AND Risk < 40 | **Aggressive/Growth** | Low Cost of Leverage, Trend Following |
| **Neutral Market** | 17 ≤ VIX ≤ 25 | **Tactical/Income** | Theta Harvesting, Rangebound Capture |

---

## 3. Phase II: Strategic Mapping
Once a regime is identified, the **Tactical Engine** (`backend/engine.py`) scans the macro basket to build specific multi-leg setups.

### A. Seller's Market (High Volatility)
*   **Put Credit Spread**: Selling downside insurance. Since IV is high, premiums are "fat." The AI picks strikes at ~5% discount to current price.
*   **Covered Call**: Strategic yield generation for long-term holdings (like SPY/QQQ) to offset potential price stagnation.

### B. Buyer's Market (Low Volatility)
*   **Long Call / ATM Leap**: Capitalizing on cheap time value. Ideal for SPY or QQQ during sustained "Risk-On" rallies.
*   **Bull Call Debit Spread**: Capped-risk directional leverage when macro strength is consistent but technicals suggest a breather.

### C. Neutral / Sideways Market
*   **Iron Condor**: The "Theta Master." Operates by selling both a call spread and a put spread. Profitable if the asset stays within a ~10% range.
*   **Long Straddle/Strangle**: A "Vol Play." Executed when the AI detects a high-impact catalyst (like Earnings or FOMC) that is likely to cause an explosive expansion in either direction.

---

## 4. Technical Logic & Leg Selection
The backend performs real-time Black-Scholes-adjacent heuristics to select the specific contracts for each recommendation:

*   **Strike Proximity**: Spreads are typically built with $2-$5 widths to ensure visible P/L zones on payoff charts.
*   **Horizon (DTE)**: Recommendations target the **Monthly** expiration closest to 30 days to maximize the balance between liquidity and theta decay.
*   **Pop (Probability of Profit)**: Heuristically calculated based on current IV and the distance of the short strikes from the money.

---

## 5. The "AI Action" Co-Pilot
Beyond initial order generation, the system provides real-time health checks for open positions:

*   **HOLD**: Position is on track; macro catalysts remain neutral/favorable.
*   **ROLL**: Profit target reached or DTE is depleting (typically < 7 days).
*   **CLOSE**: Hard stop reached (e.g., -25% on short-dated spreads) or a macro "Risk-Off" event nullifies the original thesis.

---

## 6. Technical Stack
*   **Model**: Gemini 1.5 Flash (Latest) for high-speed synthesis.
*   **Model Walking**: Fallback chain (Flash-Latest -> 2.5-Flash -> 2.0-Flash) ensuring zero downtime.
*   **Data Hooks**: `yfinance` for macro indexing, Alpaca for high-precision option chain snapshots.

---

> [!IMPORTANT]
> This AI strategy is designed for **Paper Trading** and educational purposes. Option trading involves high risk, especially in high-volatility regimes where multi-leg spreads can experience significant margin expansion.
