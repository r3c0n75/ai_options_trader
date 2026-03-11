# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Trade Confirmation Modal:**
    - High-fidelity **Lucide-React** modal UI intercepting all order submissions.
    - Allows real-time **Quantity Modification** before executing a paper trade.
    - Displays order "implications" (leg-by-leg summary) and strategy-specific warnings (e.g., Buy-Write notifications).
- **Covered Call Buy-Write Logic:**
    - New backend detector in `main.py` that checks for underlying equity holdings before selling a Covered Call.
    - **Automatic Leg Injection:** If shares are missing, the backend automatically adds a stock "buy" leg with a 100x multiplier to the multi-leg Alpaca order.
    - Updated `alpaca_trading.py` to support dynamic `ratio_qty` in option order payloads.

### Fixed
- **Strategy Payoff Inversion (Final)**: Implemented an exhaustive normalization layer in `StrategyPayoff.tsx` that handles multiple side/type identifiers (BUY, LONG, B, etc.) case-insensitively. This ensures that P/L calculations no longer default to 'SELL' logic when encountering slightly varied data formats, correctly rendering profit/loss zones for all strategies.
- **Frontend Typings:** Resolved several TypeScript compilation errors in the new modal component (TS1259 default-import mismatch and TS6133 unused imports).
- **Implicit Any Errors:** Added explicit TypeScript interfaces to `map` functions within React components to satisfy strict `tsc` requirements.

## [2026-03-11]

### Added
- **Interactive Asset Charts:**
    - High-performance **TradingView Lightweight Charts™** integration for all core ETFs.
    - Dynamic timeframe switching: **1 Day (intraday)**, **1 Month**, and **3 Month** historical views.
    - **Fullscreen Analysis Mode:** Enhanced immersive view with dynamic scaling and true edge-to-edge layout.
- **Trade Payoff Diagrams (Analysis Curve © EXP):**
    - Interactive P&L diagrams for all trade recommendations, mirroring **TastyTrade's** analysis platform.
    - Visualizes profit/loss zones, breakeven points, and strike markers.
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
