# AI Options Trader - Memory Bank

## Project Objective
Provide an intelligent, top-down macroeconomic options trading dashboard. It scans a core ETF basket in real-time to generate trade ideas based on market volatility (VIX) and context from financial news.

## System Architecture
* **Frontend:** React + Vite, TypeScript, TailwindCSS.
* **Backend:** FastAPI, Python, `yfinance`, and Alpaca Markets API. (SQLAlchemy/SQLite removed in favor of live Alpaca sync).
* **Infrastructure:** Docker Compose (separated `frontend` and `backend` containers).

## Current State
* **Interactive Symbol Charts**: Integrated **Lightweight Charts™** into the dashboard. Clicking an asset in the Macro Scanner triggers a high-performance candlestick chart update with support for 1D, 1M, and 3M intervals.
* **Filtering/Sorting System**: Implemented custom string parsers in the frontend to handle numeric sorting of ratios ("5:1") and percentages ("75%") in trade suggestions.
* **News Panel / Catalysts**: Real-time feed of financial news pulled via Alpaca or yfinance.
* **Data Storage / Paper Portfolio**: Fully integrated with the **Alpaca Paper Trading API**:
    * **Equity Performance Chart**: Visualizes historical valuation data via SVG.
    * **Live Balances**: Real-time tracking of Buying Power, Cash, and Daily P/L.
    * **Order Management**: Submits real market orders (equity proxies for options), polls `OPEN` and `PENDING` states, and maintains a **Recent Orders** history for audit trails.
    * **Real-time Sync**: Natively syncs all actions (orders, liquidations) with the Alpaca web portal.

## Known Nuances / Lessons Learned
* **Alpaca API Parsing**: Alpaca's v2 Stock Snapshot API optional fields like `latestTrade.p`, `prevDailyBar.c`, and `dailyBar.c` are sometimes empty or missing. Fallbacks traversing these keys avoid `NaN` or strict parsing errors.
* **Pydantic Model Strictness**: In FastAPI, if a field is not explicitly defined in the Pydantic `response_model`, it will be stripped from the JSON response even if the underlying logic generates it. This caused the BUY/SELL filter bug.
* **Data Feed Resilience**: Always implement `yfinance`-based fallback endpoints if Alpaca rate limits are hit or the `.env` API keys are invalid.
* **Chart Performance**: **TradingView's Lightweight Charts** provides superior performance for real-time React apps compared to standard SVG/Canvas libraries.
* **Data Feed Resilience & Staleness**: Free Alpaca IEX feeds can lag significantly (weeks/days). We now implement a **3-day staleness check** on all bar requests; if Alpaca data is delayed, the system seamlessly swaps to `yfinance` to maintain chart accuracy.
* **Alpaca Portal "Internal" Errors**: Confirmed that errors like `Cannot read properties of undefined (reading 't')` appearing on the official Alpaca markets web portal are external frontend bugs (i18n related) and unrelated to our custom API integrations. 

## Next Steps
* Connect real options chains execution or advanced Greeks calculation via the Alpaca Options Beta.
* Enhance AI suggestions with an LLM (currently hardcoded conditional logic based on VIX).
* Add technical analysis indicators (RSI, MACD, Volume) as overlays to the Symbol Charts.
