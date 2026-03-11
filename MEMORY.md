# AI Options Trader - Memory Bank

## Project Objective
Provide an intelligent, top-down macroeconomic options trading dashboard. It features a **Gemini-powered AI Omnisearch** for deep-dive ticker analysis, a conversational **Research Sidecar**, and a core ETF macro basket scanner.

## System Architecture
*   **Frontend:** React + Vite, TypeScript, TailwindCSS.
*   **Backend:** FastAPI, Python, `yfinance`, and Alpaca Markets API. (SQLAlchemy/SQLite removed in favor of live Alpaca sync).
*   **Infrastructure:** Docker Compose (separated `frontend` and `backend` containers).

## Current State
* **Gemini-Powered Research Assistant**: Integrated a conversational sidecar in the analysis view. Supported by multi-model selection (Flash, Pro, Thinking) with automated fallback logic in the backend to handle quota limits.
* **Dynamic Macro Scanner**: Added editability to the core ETF basket. Users can add/remove assets, with persistence in `localStorage` and a "Reset to Defaults" feature.
* **Interactive Symbol Charts**: Integrated **Lightweight Charts™** with support for 1D, 1M, and 3M intervals. Features a high-performance **Fullscreen Analysis Mode** with dynamic resizing.
* **Trade Payoff Diagrams**: Interactive SVG-based P&L analysis for all trade suggestions and active portfolio positions (Long Stock, Options Spreads), complete with X and Y axes for price and profit mapping.
* **Filtering/Sorting System**: Custom logic for numeric sorting of ratios and percentages in recommendations.
* **News Panel / Catalysts**: Real-time feed of financial news pulled via Alpaca or yfinance.
* **Data Storage / Paper Portfolio**: Fully integrated with the **Alpaca Paper Trading API**:
    * **Equity Performance Chart**: Visualizes historical valuation data via SVG.
    * **Live Balances**: Real-time tracking of Buying Power, Cash, and Daily P/L.
    * **Order Management**: Submits real market orders (equity proxies for options), polls `OPEN` and `PENDING` states, and maintains a **Recent Orders** history for audit trails.
    * **Real-time Sync**: Natively syncs all actions (orders, liquidations) with the Alpaca web portal.
    * **Real Options Integration**: Natively executes and groups multi-leg Option Orders (`mleg`) via Alpaca Options Beta, visualizing active trade Payoff charts directly in the portfolio.
    * **Covered Call Buy-Write Fallback**: Automatically detects missing underlying equity for Covered Call strategies and injects a stock "buy" leg into the multi-leg order, effectively executing a Buy-Write to satisfy Alpaca tier requirements.
    * **Instructional Guardrails**: Modal provides contextual warnings (e.g., explaining Buy-Write logic for Covered Calls).
* **Advanced Greeks Analysis**:
    * **Visual Dashboard**: High-fidelity UI for Delta, Gamma, Theta, and Vega.
    * **Calculated Metrics**: Real-time simulation of Greeks in `main.py` using live volatility data and underlying price action.
    * **IV Visualization**: Circular progress gauges for IV Rank and Implied Volatility.
* **Smart Strategy Visualization (Payoff Diagrams)**:
    * **Adaptive Auto-Scaling**: Implemented intelligent X and Y axis framing. X-axis now centers on strikes and premium breakevens with a minimum 5% price floor. Y-axis fits the specific trade's P/L peak to fill the chart vertically without "stretching thin".
    * **Ultra-Zoom Stability**: Optimized SVG path logic and added division-by-zero guards to maintain chart rendering at 200x magnification levels.
    * **Control Event Isolation**: Stopped event propagation in chart UI buttons, resolving a bug where zoom actions would inadvertently close the parent modal.

## Known Nuances / Lessons Learned
* **Alpaca API Parsing**: Alpaca's v2 Stock Snapshot API optional fields like `latestTrade.p`, `prevDailyBar.c`, and `dailyBar.c` are sometimes empty or missing. Fallbacks traversing these keys avoid `NaN` or strict parsing errors.
* **Pydantic Model Strictness**: In FastAPI, if a field is not explicitly defined in the Pydantic `response_model`, it will be stripped from the JSON response even if the underlying logic generates it. This caused the BUY/SELL filter bug.
* **Data Feed Resilience**: Always implement `yfinance`-based fallback endpoints if Alpaca rate limits are hit or the `.env` API keys are invalid.
* **Chart Performance**: **TradingView's Lightweight Charts** provides superior performance for real-time React apps compared to standard SVG/Canvas libraries.
* **Data Feed Resilience & Staleness**: Free Alpaca IEX feeds can lag significantly (weeks/days). We now implement a **3-day staleness check** on all bar requests; if Alpaca data is delayed, the system seamlessly swaps to `yfinance` to maintain chart accuracy.
* **Alpaca Portal "Internal" Errors**: Confirmed that errors like `Cannot read properties of undefined (reading 't')` appearing on the official Alpaca markets web portal are external frontend bugs (i18n related) and unrelated to our custom API integrations. 
* **Order Button & Trade Logic**: Mitigated silent failures by implementing explicit error propagation from backend to frontend. Introduced strategy-based mapping (v1) to correctly map option strategy directional intent to stock order side (e.g., Put Credit Spreads proxy as 'buy' orders).
* **Alpaca Option Tiers (Covered Calls)**: Confirmed that Paper Accounts are restricted from selling naked calls (Tier 4). To sell a Covered Call without owning the stock, it must be submitted as a single multi-leg "Buy-Write" order (100 shares + 1 Short Call). Our implementation now handles this detection and injection automatically in the backend.
* **ATM Strike Proximity**: High-priced assets with high liquidity (QQQ) require strike selection based on absolute price proximity rather than index-based slicing of a range. This prevents "ITM bias" in payoff diagrams where the selection window fails to reach the current price.
* **Payoff Diagram Logic & Normalization**: Long strategies (Straddles/Strangles) previously rendered inverted due to case-sensitivity or side mismatch. Implemented a robust normalization layer that strictly categorizes `BUY`/`LONG` vs `SELL`/`SHORT`. This ensures P/L zones are mapped accurately across the entire stack regardless of minor semantic variations in string data.
* **Low-Impact Strategy Scaling**: Strategies on low-priced assets (TMF) collecting small premiums ($0.50) initially appeared as flat lines due to a fixed +/- $10 P/L axis. Switching to a percentage-based adaptive Y-axis (Peak * 1.25) ensures clear visual feedback regardless of absolute dollar amounts.
* **Gemini Engine Robustness (v2.1)**:
    - Updated default models to **Gemini 2.0 Flash** and **Gemini Flash (Universal)** based on verified API key availability.
    - Improved **`google-generativeai`** dependency to `v0.8.3` for modern model compatibility.
    - Enhanced normalization layer in `ai_engine.py` to handle `models/` prefix requirements and multiple version aliases (1.5, 2.0, 2.5).
    - Integrated verbose `DEBUG` logging in backend containers for real-time model resolution tracking.

## Next Steps
* Implement real-time websocket updates for the macro scanner.
* Add technical analysis indicators (RSI, MACD, Volume) as overlays to the Symbol Charts.
