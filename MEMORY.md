# AI Options Trader - Memory Bank

## Project Objective
Provide an intelligent, top-down macroeconomic options trading dashboard. It scans a core ETF basket in real-time to generate trade ideas based on market volatility (VIX) and context from financial news.

## System Architecture
* **Frontend:** React + Vite, TypeScript, TailwindCSS.
* **Backend:** FastAPI, Python, SQLAlchemy (SQLite data storage), `yfinance`, and Alpaca Markets API.
* **Infrastructure:** Docker Compose (separated `frontend` and `backend` containers).

## Current State
* **Macro ETF Scanner**: Real-time heatmap tracking [SPY, QQQ, TMF, BND, GLD, IWM]. Shows current price, daily change, and live data feed indicator (Alpaca vs Yahoo Finance).
* **AI Recommendations**: Analyzes VIX to determine if it is a Buyer's, Seller's, or Cash Market. Combines with current financial news headlines to suggest specific options strategies (Credit Spreads, Long Calls, Iron Condors).
* **News Panel / Catalysts**: Real-time feed of financial news pulled via Alpaca or yfinance.
* **Paper Portfolio**: Mock local portfolio storing simulated trades via a SQLite database (`options_trader.db`).

## Known Nuances / Lessons Learned
* **Alpaca API Parsing**: Alpaca's v2 Stock Snapshot API optional fields like `latestTrade.p`, `prevDailyBar.c`, and `dailyBar.c` are sometimes empty or missing. Fallbacks traversing these keys avoid `NaN` or strict parsing errors.
* **Data Feed Resilience**: Always implement `yfinance`-based fallback endpoints if Alpaca rate limits are hit or the `.env` API keys are invalid.
* **Frontend File Permissions**: When installing Node dependencies via root in WSL, remember to chown `node_modules` so VS Code's TS Server can read them to prevent linting errors.

## Next Steps
* Connect real options chains execution or advanced Greeks calculation.
* Enhance AI suggestions with an LLM (currently hardcoded conditional logic based on VIX).
