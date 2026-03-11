# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Multi-Timeframe Performance Context**:
    - Enhanced the `analysis/{symbol}` endpoint to calculate and inject **3-month** and **12-month** percentage trends into the AI context.
    - Updated the Gemini Research Assistant's prompt to synthesize qualitative news with quantitative trend data for high-fidelity "Pulse" verdicts.
- **12 Month (1Y) Charting**:
    - Added `12M` period support to both the primary and analysis chart views.
    - Integrated with Alpaca/yfinance backends to fetch full-year daily bars as a new historical benchmark.
- **Gemini Tier 1 Model Architecture**:
    - Updated default models to `gemini-3-flash-preview` and `gemini-3.1-pro-preview` to leverage Tier 1 provisioned throughput and credits.
    - Implemented model normalization and persistent model caching in `ai_engine.py` to prevent redundant resolution calls.
    - Enhanced the fallback chain to prioritize Tier 1 preview models, significantly reducing 429 and 404 errors.

### Fixed
- **Chart Layout & Date Axis**: Resolved a height conflict in the Symbol Analysis view where the date axis was being truncated. Refactored the chart container to use `min-h-[500px]` with dynamic flex-scaling.
- **AI Pulse Truncation**: Fixed a prompt typo in `ai_engine.py` where a "2-char" constraint was erroneously requested for the thesis, restoring full 2-sentence analytical output.
- **Analysis State Resilience**: Provided default fallback values for trend metrics to ensure the UI remains stable during initial symbol loads.

## [2026-03-11]

### Added
- **Interactive Asset Charts (Final Polish):**
    - High-performance **TradingView Lightweight Charts™** integration for all core ETFs.
    - Dynamic timeframe switching: **1 Day (intraday)**, **1 Month**, and **3 Month** historical views.
    - **Fullscreen Analysis Mode:** Enhanced immersive view with dynamic scaling and true edge-to-edge layout.
- **Trade Payoff Diagrams (Analysis Curve © EXP):**
    - Interactive P&L diagrams for all trade recommendations, mirroring **TastyTrade's** analysis platform.
    - Visualizes profit/loss zones, breakeven points, and strike markers.
    - **Smart Auto-Scaling**: Implemented intelligent X and Y axis framing. X-axis now centers on strikes and premium breakevens with a minimum 5% price floor. Y-axis fits the specific trade's P/L peak to fill the chart vertically without "stretching thin".
    - **Ultra-Zoom Stability**: Optimized SVG path logic and added division-by-zero guards to maintain chart rendering at 200x magnification levels.
- **Real Options API Integration (Alpaca v1beta1):**
    - Dynamic fetching of exact Options Clearing Corporation (OCC) symbols for actionable strikes based on AI targets.
    - Multi-leg (`mleg`) Alpaca POST payloads allowing exact API execution of Spreads, Iron Condors, and Straddles.
    - **Portfolio Spread Recognition:** Option legs returned from the Alpaca Positions API are automatically grouped into coherent strategies (e.g., Iron Condor) inside the Portfolio table.
    - Re-used the interactive `StrategyPayoff` visualization chart directly into the Portfolio for active options positions, as well as **Long Stock** positions. Added a Y-axis to clarify profit magnitude.
- **Historical Bar Data API:** New backend endpoint `/stocks/{symbol}/bars` with robust **Alpaca v2** data fetching and **Yahoo Finance** fallback strategy.
- **Investigative Deep-Dive:** Confirmed Alpaca Web Portal "reading 't'" error is a non-destructive external i18n frontend bug on Alpaca's side, unrelated to local API calls.

### Changed
- **Macro Scanner API (`/scanner`) & News API (`/news`):** Refactored JSON responses. The endpoints now return a dictionary wrapped payload (`{"feed": "...", "data": [...]}`) instead of raw arrays.
- **Frontend TS Types:** Cleared React and Lucide unused imports. Resolved VSCode TypeScript server linting errors by rebuilding `node_modules` with correct WSL user permissions.

### Fixed
- **Dependency Management:** Resolved `lightweight-charts` "module not found" errors by explicitly listing the dependency in `package.json`.
- **Alpaca API Parsing**: Alpaca's v2 Stock Snapshot API optional fields like `latestTrade.p`, `prevDailyBar.c`, and `dailyBar.c` are sometimes empty or missing. Fallbacks traversing these keys avoid `NaN` or strict parsing errors.
- **Payoff Diagram Logic**: Long strategies (like Straddles/Strangles) previously rendered inverted (profitable at strikes). This was due to case-sensitivity in the frontend `StrategyPayoff` component failing to recognize "buy" vs "BUY", defaulting to sell logic. Now standardized to uppercase across the stack with case-normalized comparisons.
- **Stale Chart Data:** Fixed a critical issue where SPY, QQQ, and other ETFs showed stale data (up to 14 days old) due to Alpaca IEX feed latency. Implemented a "latest-first" sorting strategy and a 3-day staleness detector that automatically falls back to **Yahoo Finance** for guaranteed current data.
- **Recommendation Filter Bug:** Fixed a critical issue where the `side` field was stripped from API responses by explicitly adding it to the `TradeRecommendation` Pydantic model in `backend/main.py`.
- **Alpaca API Key Typo:** Removed rogue `y` prefix from `ALPACA_API_KEY` in the `.env` file, resolving 401 Unauthorized errors and restoring the real-time Alpaca data feed.
- **Order Button & Trade Logic:** Fixed an issue where the "Order" button failed silently. The frontend now displays descriptive error messages from the backend (e.g., "insufficient buying power"). Corrected backend logic to respect the recommendation's `side` (BUY/SELL) and introduced strategy-based mapping (v1) to ensure bullish strategies (like Put Credit Spreads) are executed as "buy" orders to avoid shorting errors.
- **Strategy Chart Zoom Instability**: Fixed a critical division-by-zero bug in the SVG shader that caused charts to disappear at deep zoom levels. Resolved a UI conflict where clicking zoom buttons inadvertently closed parent modals by implementing event propagation stopping (`e.stopPropagation()`).
- **Payoff Chart Typings**: Resolved over 50 TypeScript linting errors in `StrategyPayoff.tsx` by adding explicit event and data types for all React hooks and SVG elements.
