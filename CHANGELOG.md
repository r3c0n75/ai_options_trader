# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

- **Portfolio "Top Positions" Sorting**:
    - **Interactive Column headers**: Added full sorting capabilities for the Portfolio table, allowing users to organize positions by Asset, Days to Expiry (DTE), Current Price, Quantity, Market Value, Total P/L, Status, and AI Action.
    - **Visual Sort Indicators**: Integrated animated `ChevronUp` and `ChevronDown` icons to clearly denote active sorting states and hover potential.
    - **Real-time Persistence**: Ensured the user's selected sort order is maintained during the 5-second automatic data refresh cycle, preventing disruptive UI jumps.

- **Portfolio Payoff Chart Fixes**:
    - **Black-Scholes Guards**: Handled non-positive stock prices (`S <= 0`) to prevent `$NaN` in distributions by returning intrinsic values.
    - **Robust Underlying Price Logic**: Added proactive stock price fetching in the backend (`main.py`) for option positions and removed incorrect fallbacks to option premiums.
    - **Theoretical Curve Anchoring**: Calibrated the theoretical payoff curve to anchor exactly to the actual realized portfolio P/L, ensuring visual consistency.
    - **UI Refinements**: Renamed tooltip P/L label to "Current P/L" and widened tooltip for better legibility on multi-leg strategies.

### Changed
- **UI Branding**: Renamed "Deep Research" to **"AI Chat"** for a more conversational and intuitive user experience.
- **Market Health Refresh Interval**: Optimized the market analysis refresh rate to **10 minutes** to reduce API overhead and noise.

### Fixed
- **Frontend Stability**:
    - Resolved a critical **Temporal Dead Zone (TDZ)** error in `App.tsx` that caused a crash when navigating to the news section.
    - Fixed a flickering loading state in the AI Analysis modal via memoization and dependency refinement.
    - Implemented defensive guards in the news matching engine to prevent universal highlighting caused by malformed/empty ticker data.
- **Backend Reliability**:
    - Resolved a **422 Unprocessable Entity** error on the news analysis endpoint by correcting the Pydantic schema alignment.

### Fixed
- **Backend Stability & Resilience**:
    - Resolved a critical `NameError` in `engine.py` caused by invalid `null` syntax in type hints.
    - Fixed a silent loop crash in the `/trades` endpoint by restoring missing `engine` imports and resolving local scope issues.
    - Implemented **Gemini API Fallbacks**: The system now gracefully handles AI timeouts or quota limits by using a default "Neutral" macro pulse, preventing portfolio load failures.

## [2026-03-12] - Trade UX & Portfolio Refinement

### Added
- **Top Macro Opportunities Toggle**:
    - Implemented a "Show All" / "Show Top 5" toggle in the Recommendations component, allowing users to switch between a focused view and the complete list of analyzed assets.
    - Updated the backend API to support an optional `limit` parameter for recommendations.

### Fixed
- **Covered Call Order Execution**:
    - Resolved `invalid legs: missing symbol` error by filtering out non-option legs from the multi-leg options payload sent to Alpaca.
    - Fixed `uncovered option contracts` eligibility error by implementing robust synchronization (polling and buffer delays) between underlying stock purchase and short call submission.
    - Added an automatic "Emergency Retry" mechanism that waits for settlement if a covered call is initially rejected.


### Fixed
- **Payoff Diagram Accuracy**:
    - **Covered Call Synchronization**: Fixed the "flipped" appearance in Macro Opportunities by correctly including the underlying stock leg in the diagram data.
    - **Width-Based Premium Simulation**: Implemented realistic premium calculation for Credit and Debit spreads based on strike width, ensuring payoff diagrams correctly display risk/reward profiles and loss zones.
    - **Portfolio Diagram Centering**: Resolved issues where spread diagrams were centered on the option price (e.g., $0.44) by implementing robust `underlying_price` synchronization in the backend.
- **Portfolio Strategy Intelligence**:
    - **Advanced Strategy Detection**: Enhanced the grouping engine to specifically identify and label **Put Credit Spreads**, **Bull Call Debit Spreads**, **Bear Put Debit Spreads**, and **Call Credit Spreads**, replacing generic "Vertical Option Spread" labels.
    - **Precision Leg Labeling**: Fixed a logic error in position side detection. All legs now accurately display **LONG** or **SHORT** labels based strictly on the API's side property, correctly reflecting the position's directional risk.

## [2026-03-12] - Trade UX & Portfolio Refinement

### Fixed
- **Chart Layout & Date Axis**: Resolved a height conflict in the Symbol Analysis view where the date axis was being truncated. Refactored the chart container to use `min-h-[500px]` with dynamic flex-scaling.
- **AI Pulse Truncation**: Fixed a prompt typo in `ai_engine.py` where a "2-char" constraint was erroneously requested for the thesis, restoring full 2-sentence analytical output.
- **Analysis State Resilience**: Provided default fallback values for trend metrics to ensure the UI remains stable during initial symbol loads.

## [2026-03-12] - Trade UX & Portfolio Refinement

### Added
- **Multi-Stage Trade Confirmation**:
    - Enhanced the `TradeConfirmationModal` with four distinct states: **Idle**, **Processing** (with animated spinner), **Success** (fill confirmation), and **Error** (clear descriptive messaging).
    - **Manual Portfolio Redirect**: Redirect to the Portfolio screen is now user-controlled. The modal remains in the **Success** state until the "Done" button is clicked, preventing abrupt navigation.
- **Robust Covered Call Execution**:
    - Implemented a backend polling verification loop that ensures underlying equity is fully settled and recognized by Alpaca's risk engine before submitting the option leg, eliminating "uncovered option" 403 errors.
- **Logical Portfolio Grouping**:
    - Implemented `groupOpenTrades` logic to automatically pair underlying stock (100 shares) with corresponding short calls on the same symbol.
    - Grouped positions are presented as a single **"Covered Call"** line item with consolidated P/L, market value, and strategy-specific payoff diagrams.

### Fixed
- **High-Frequency Data Refresh**: Increased the auto-refresh rate for Portfolio (5s), Macro Scanner (5s), and Market Health (10s), providing a highly responsive real-time monitoring experience.
- **Manual Redirect Robustness**: Resolved a race condition where the Portfolio redirect could fail if state transitions were interrupted. Reversed state update order and added explicit "Order Confirmed" instructions to the success screen for better UX clarity.
- **Robust Position Highlighting**: Implemented a polling mechanism in `App.tsx` that waits for up to 10 seconds for new positions to be recognized by the Alpaca API before triggering navigation highlights.
- **Stable UI Keys**: Replaced unstable random IDs with deterministic keys for multi-leg strategies, ensuring consistent row rendering and accurate visual feedback.
- **Covered Call Grouping Bug**: Resolved an issue where short legs were missed during grouping because the Alpaca API normalizes short quantities to absolute values. The system now cross-references the `side` property to correctly detect short legs.
- **Portfolio Chart Scaling**: Refined the zoom factor in `StrategyPayoff.tsx` to exclude the stock leg's cost basis from the range calculation. This ensures Covered Call charts are zoomed in tightly on the option strikes, matching the high-detail view of the Recommendations screen.

## [2026-03-12]

### Added
- **Dynamic Symbol Evaluation**:
    - Backend now accepts custom symbol lists for trade recommendations, allowing the "Top Macro Opportunities" to analyze any asset added by the user.
    - Frontend automatically synchronizes `localStorage` assets with the recommendation engine.
- **Comprehensive Asset Sorting**:
    - **Recommendations**: Added sorting by **Symbol** and **Strategy** with a persistent sort order toggle (Ascending/Descending).
    - **Macro Scanner**: Implemented sorting by **Symbol** and **Change %** for the core asset grid, including dedicated UI controls in the header.
- **Trade-Specific AI Insights**:
    - Replaced the static header button with individualized, animated **"AI Insight"** buttons on every trade card.
    - Each button is context-aware and triggers a deep-dive analysis modal for that specific trade's symbol.
- **Analysis Modal Refinement**:
    - Added a premium, animated "AI Insight" badge to the top of the Symbol Analysis view for visual consistency.

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
