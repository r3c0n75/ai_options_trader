# AI Options Trader - Memory Bank

## Project Objective
Provide an intelligent, top-down macroeconomic options trading dashboard. It scans a core ETF basket in real-time to generate trade ideas based on market volatility (VIX) and context from financial news.

## System Architecture
* **Frontend:** React + Vite, TypeScript, TailwindCSS.
* **Backend:** FastAPI, Python, `yfinance`, and Alpaca Markets API. (SQLAlchemy/SQLite removed in favor of live Alpaca sync).
* **Infrastructure:** Docker Compose (separated `frontend` and `backend` containers).

## Current State
* **Macro ETF Scanner**: Real-time heatmap tracking [SPY, QQQ, TMF, BND, GLD, IWM]. Shows current price, daily change, and live data feed indicator (Alpaca vs Yahoo Finance).
* **AI Recommendations**: Analyzes VIX to determine if it is a Buyer's, Seller's, or Cash Market. Generates six diverse setups (Buying calls, Selling puts, Iron Condors, Straddles) with directional labels and AI confidence levels.
* **Filtering/Sorting System**: Implemented custom string parsers in the frontend to handle numeric sorting of ratios ("5:1") and percentages ("75%") in trade suggestions.
* **News Panel / Catalysts**: Real-time feed of financial news pulled via Alpaca or yfinance.
* **Data Storage / Paper Portfolio**: Fully integrated with the **Alpaca Paper Trading API**. SQLite `options_trader.db` was dropped. The dashboard submits real test-market orders (currently mocking Options chains by submitting 10x underlying Equities Market Orders) and reads real-time account balances, `OPEN` positions, and `PENDING` orders directly from Alpaca. This natively syncs action on the app with actions on Alpaca's website.

## Known Nuances / Lessons Learned
* **Alpaca API Parsing**: Alpaca's v2 Stock Snapshot API optional fields like `latestTrade.p`, `prevDailyBar.c`, and `dailyBar.c` are sometimes empty or missing. Fallbacks traversing these keys avoid `NaN` or strict parsing errors.
* **Pydantic Model Strictness**: In FastAPI, if a field is not explicitly defined in the Pydantic `response_model`, it will be stripped from the JSON response even if the underlying logic generates it. This caused the BUY/SELL filter bug.
* **Data Feed Resilience**: Always implement `yfinance`-based fallback endpoints if Alpaca rate limits are hit or the `.env` API keys are invalid.
* **Frontend File Permissions**: When installing Node dependencies via root in WSL, remember to chown `node_modules` so VS Code's TS Server can read them to prevent linting errors.
* **Alpaca Extended/Closed Hours queueing**: Market Orders to Alpaca outside of hours return successfully, but go into a `pending / new` order state. Our dashboard must actively poll `GET /orders` to display `PENDING` actions, otherwise Trades might successfully execute in the broker without appearing in the user's dashboard temporarily.

## Next Steps
* Connect real options chains execution or advanced Greeks calculation via the Alpaca Options Beta, sending real OCC OSI strings rather than equity proxies.
* Enhance AI suggestions with an LLM (currently hardcoded conditional logic based on VIX).
