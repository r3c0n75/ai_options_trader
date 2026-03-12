# AI Options Trader - Memory Bank

## Project Objective
Provide an intelligent, top-down macroeconomic options trading dashboard. It features a **Gemini-powered AI Omnisearch** for deep-dive ticker analysis, a conversational **Research Sidecar**, and a core ETF macro basket scanner.

## System Architecture
*   **Frontend:** React + Vite, TypeScript, TailwindCSS.
*   **Backend:** FastAPI, Python, `yfinance`, and Alpaca Markets API. (SQLAlchemy/SQLite removed in favor of live Alpaca sync).
*   **Infrastructure:** Docker Compose (separated `frontend` and `backend` containers).

## Current State
* **Visual Branding & UX**:
    - **Custom Favicon**: Implemented a bespoke "AI Pulse" browser tab icon with high-fidelity gradients (#3b82f6 to #34d399) and a semantic heartbeat motif, enhancing the premium feel.
    - **Asset Architecture**: Created `frontend/public` for static assets and updated `index.html` for proper SVG favicon resolution.
* **Gemini-Powered Research Assistant**:
    * **2026 Model Optimization**: Fully tuned for the latest Gemini model chain (`flash-latest`, `2.5-flash`).
    * **Comparative Context Engine**: Automatically detects multiple mentioned symbols in chat and fetches their real-time price/trend data for instant comparative reasoning.
    * **Advanced Retry Logic**: Backend features localized "daily quota" detection and exponential backoff for `429` errors.
    * **Multi-model Selection**: User-facing dropdown for pivoting between Flash and Pro generations.
* **Trade Recommendations (Top Macro Opportunities)**:
    - **Dynamic Symbol Evaluation**: Backend seamlessly handles custom symbol lists, enabling real-time analysis for both default core assets and user-added tickers.
    - **Enhanced Sorting & Viewing**: Implemented alphabetical (Symbol) and strategy-based sorting, alongside a new "Show All" toggle to expand the focused Top 5 opportunities list.
    - **API Limit Support**: Backend `generate_recommendations` now supports an optional `limit` parameter for more flexible frontend layouts.
* **Filtering/Sorting System**: Custom logic for numeric sorting of ratios and percentages in recommendations, now extended to include Symbol and Strategy fields.
* **Macro Scanner (ETFScanner)**:
    - **Asset Sorting**: Integrated Symbol and Change % sorting to allow for quick scanning of top-performing or specific assets.
* **News Panel / Catalysts**: Real-time feed of financial news pulled via Alpaca or yfinance.
* **Data Storage / Paper Portfolio**: Fully integrated with the **Alpaca Paper Trading API**:
    * **Equity Performance Chart**: Visualizes historical valuation data via SVG. Supports interactive hover inspection with synchronized "Blue Dot" tracking and detailed P/L tooltips.
    * **Live Balances**: Real-time tracking of Buying Power, Cash, and Daily P/L.
    * **Portfolio Risk Management**:
        * **Expiry & DTE Engine**: Automated parsing of OCC symbols for real-world expiration tracking.
        * **Visual Urgency Alerts**: Dynamic pulsing alerts (⚠️ Warning, 🚨 Critical) based on P/L and DTE thresholds.
        * **"Trade Guardian" Advisor**: Interactive popovers providing context-aware rolling and hedging recommendations.
    * **Order Management**: Submits real market orders (equity proxies for options), polls `OPEN` and `PENDING` states, and maintains a **Recent Orders** history for audit trails.
    * **Real-time Sync**: Natively syncs all actions (orders, liquidations) with the Alpaca web portal.
    * **Real Options Integration**: Natively executes and groups multi-leg Option Orders (`mleg`) via Alpaca Options Beta, visualizing active trade Payoff charts directly in the portfolio.
    * **Robust Liquidation**: Features a premium red elliptical "Close" button for all positions. Backend uses UUID regex to safely differentiate between orders (cancel) and positions (liquidate).
    * **Covered Call Buy-Write Fallback**: Automatically detects missing underlying equity for Covered Call strategies and injects a stock "buy" leg into the multi-leg order, effectively executing a Buy-Write to satisfy Alpaca tier requirements.
    * **Instructional Guardrails**: Modal provides contextual warnings (e.g., explaining Buy-Write logic for Covered Calls).
* **Trade Confirmation & Execution**:
    - **Multi-Stage Lifecycle**: Added `idle`, `processing`, `success`, and `error` states to the trade modal.
    - **Manual Redirect Robustness**: Implemented a 10s polling window in the frontend to wait for Alpaca trade synchronization. This ensures new positions are visible before highlighting.
    - **High-Frequency Monitoring**: Reduced portfolio auto-refresh interval from 30s to 5s for near real-time tracking of positions and P/L.
    - **Stable Row State**: Replaced `Math.random()` keys with deterministic ID strings to prevent UI flickering and "ghost" highlights in the Portfolio table.
    - **Back-end Settlement Polling**: Covered Call execution now includes an internal polling loop (up to 15s) and a 5s "Emergency Retry" mechanism to wait for equity settlement before submitting the option leg.
    - **Option-Only Payloads**: Automatically filters out stock legs from multi-leg option orders to comply with Alpaca API requirements for OCC symbols.
* **Portfolio & Positions Management**:
    - **Logical Strategy Grouping**: Stock and Short Call legs are automatically bundled into a single **Covered Call** strategy entry in the Portfolio table.
    - **Precision Strategy Detection**: Enhanced the grouping logic to specifically identify and label common 2-leg strategies including **Put Credit Spreads**, **Bull Call Debit Spreads**, **Bear Put Debit Spreads**, and **Call Credit Spreads**.
    - **Strategy-Specific Payoff Scaling**: Refined the `StrategyPayoff` logic to ignore high stock cost bases in the zoom range, focusing exclusively on option strikes and premium breakevens for a consistent analytical view across both recommendations and portfolio positions.
    - **Short Leg Detection**: Grouping logic explicitly checks the `side` property to account for absolute-value quantity normalization in the Alpaca API, ensuring correct Payoff Diagram orientation.
* **Symbol Analysis & AI Integration**:
    - **Context-Aware AI Buttons**: Trade suggestions now feature individualized "AI Insight" buttons that link directly to symbol-specific analysis modals.
    - **Visual Continuity**: The "AI Insight" badge is mirrored inside the Symbol Analysis modal for a cohesive premium experience.
    - **Sentiment-Driven UI**: The "AI Pulse" card dynamically changes its color scheme and animating pulse (Bullish: Green, Bearish: Red, Neutral: Purple) based on AI verdict strings.
    * **Scroll Lock Utility**: Automatically prevents background page scrolling when the Modal is open to maintain focus and UI cleanliness.
* **Strategy Payoff Diagrams**: 
    * **High-Precision Mapping**: Resolved mouse-cursor drift by mapping screen coordinates to the SVG's internal coordinate space.
    * **Smart Auto-Scaling**: Frames strikes and premium breakevens dynamically.
    * **Theoretical P/L Overlays**: Implemented **Black-Scholes** theoretical pricing to render a "Now" curve (Orange Dashed) alongside the "Exp" curve (Blue Solid), providing a realistic view of current strategy value vs expiration potential.
    * **Dual-Valued Tooltips**: Hover inspection now displays synchronous data for both current and expiration P/L, color-coded for instant cognitive matching.
    * **Portfolio Accuracy Sync**: Charts now include a 100x contract multiplier and anchor the 'NOW' dot to real-time market P/L, ensuring total synchronization with the account dashboard.
* **Proactive "AI Action" Co-pilot**:
    - **Strategy-Aware Health Dashboard**: Implemented a core intelligent layer that evaluates position health against current macro catalysts (Risk Score, Mood).
    - **Contextual Confirmation**: Every AI action (Hold, Close, Roll) is backed by a dedicated confirmation flow explaining the rationale and risk-assessment points.
    - **Duration-Calibrated Heuristics**: Recommendations automatically adjust their risk tolerance based on DTE extracted from OCC symbols, prioritizing Gamma-risk management for short-dated options.

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
* **Environment Precedence (Windows)**: System-level environment variables take priority over local `.env` files. If an AI key appears "stuck" on Free Tier limits despite configuration, check Windows User/System variables for conflicting `GOOGLE_API_KEY` entries.
* **SVG Coordinate Mapping**: Mouse interactions in scaled SVGs must be mapped to the `viewBox` coordinate space using `(clientX - rect.left) * (viewBoxWidth / rect.width)` to avoid alignment drift.
* **UI Focus Resilience**: Modal-based overlays should always manage `document.body.style.overflow` to prevent confusing "double scrollbar" behavior on the far right of the screen.
* **2026 Model Fallbacks**: Not all Gemini "preview" models are available in all regions or tiers. The most resilient fallback chain for 2026 remains `gemini-flash-latest` -> `gemini-2.5-flash` -> `gemini-2.0-flash`.
* **Alpaca ID Ambiguity**: Alpaca Order IDs (UUIDs) can be confused with long OCC Option Symbols (21 chars) by simple length-based checks. Robust implementations should use UUID regex (`^[0-9a-f]{8}-...`) to ensure that closing a position doesn't accidentally trigger an order cancellation handler.
* **After-Hours Liquidation**: Alpaca's `DELETE /positions` endpoint uses market orders for liquidation. For options, these orders cannot be queued when the market is closed. Systems must capture the "market is closed" 403/400 error and provide clear UI feedback to prevent user confusion.
* **Sequential Multi-leg Liquidation**: When closing a spread, sending multiple async `DELETE` requests in parallel can lead to race conditions or incomplete refreshes. Sequential `await` loops in the frontend ensure that the platform state is fully consistent before the UI refreshes.
* **Width-Based Premium Simulation**: To ensure realistic payoff diagrams (with visible breakevens and loss zones) in simulated recommendations, spread premiums should be calculated as a percentage of the strike width (e.g., ~30-50%) rather than a small percentage of the underlying price.
* **Underlying Price Synchronization**: Alpaca often omits the `last_underlying_price` for option positions. The system must derive this by extracting the symbol from the OCC string (e.g., SBUX from SBUX260417P00095000) and syncing with the current market price of the corresponding stock position to ensure diagrams are centered correctly.
* **Leg Side Normalization**: Because some APIs (like Alpaca) normalize short quantities to absolute values for display, the portfolio logic must rely strictly on the `side` (short/long) property for labeling and payoff calculation, rather than relying on the sign of the quantity.
* **Granular vs. Strategy P/L Discrepancy**: Standard health models evaluate individual legs. A "CLOSE" signal on a short call leg (-50% P/L) might be a false alarm for a Covered Call that is overall profitable. AI logic must be "Strategy Aware" and evaluate the aggregate P/L of grouped positions.
* **Gemini Resilience & Critical Fallbacks**: Heavy-weight AI calls (Macro Health) should never block core data flow. Implement robust try-except blocks with "Neutral" fallbacks to ensure the UI stays responsive even during API timeouts or rate limits.
* **FastAPI Scoping & Circular Imports**: When importing logic across `main.py` and `engine.py`, functional-level imports (inside the endpoint) are often required to avoid circular dependency crashes at startup.

## Next Steps
* Implement real-time websocket updates for the macro scanner.
* Add technical analysis indicators (RSI, MACD, Volume) as overlays to the Symbol Charts.
