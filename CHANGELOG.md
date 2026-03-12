# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Portfolio Risk Management**:
    - **Expiry & DTE Tracking**: Automated extraction of expiration dates from OCC symbols with real-time "Days to Expiration" (DTE) calculation for all positions and spreads.
    - **Intelligent Risk Alerts**: Dynamic color-coded urgency alerts (⚠️ Warning, 🚨 Critical) based on time-to-expiry and profitability.
    - **"Trade Guardian" Advisor Popover**: Interactive advisor providing tailored advice (Roll Out, Roll Up/Down, Hedge) directly within the portfolio table.
    - **Consolidated "Close" Button**: Replaced redundant icons with a single, high-fidelity elliptical red button for streamlined position liquidation.
    - **Portfolio Chart Inspection**: Implemented synchronized hover hair-lines and "Blue Dot" data tracking on the Equity chart, with detailed Tooltips showing timestamp-precise Profit/Loss data.
- **Backend Liquidation Reliability**:
    - **ID Detection Engine**: Implemented robust UUID regex matching to correctly distinguish between Alpaca Order IDs (for cancellation) and Option Symbols (for closure), resolving failures with 21-character OCC symbols.
    - **Sequential Spread Closure**: Frontend now processes multi-leg liquidation requests sequentially to ensure reliability and prevent race conditions during spread exits.
    - **Market-Close Awareness**: The system now detects and explains Alpaca rejections when the market is closed, gracefully resetting the UI state with descriptive notifications.

### Changed
- Refactored `App.tsx` state management for position closure to include "Closing..." loading states and automatic state restoration on failure.
- Harmonized the Portfolio table layout by inserting an "Exp / DTE" column and removing redundant "Actions" icons.

### Added
- **AI Engine 2026 Tuning**:
    - Aligned with the latest (2026) Gemini model chain, prioritizing `gemini-flash-latest` and `gemini-2.5-flash` for high-frequency trading research.
    - Optimized retry logic for `429` (Quota Exceeded) errors with intelligent exponential backoff and localized "Daily Limit" detection to prevent hang times.
    - Improved backend robustness by shortening the fallback chain to the three most stable 2026-era models.
- **Comparative AI Research**:
    - The Deep Research chat now automatically detects multiple ticker symbols in a single query (e.g., "Compare SPY and QQQ").
    - Injects price and 3-month performance data for all mentioned symbols into the AI's context for instant comparative analysis.
- **High-Fidelity UI/UX Enhancements**:
    - **Animating AI Borders**: Added a rotating rainbow conic-gradient border to AI chat bubbles to emphasize "Intelligence" responses.
    - **AI Pulse Glow**: The "AI Pulse Verdict" card now features a dynamic animating pulse that changes color based on sentiment:
        - **Bullish**: Emerald Green pulse.
        - **Bearish**: Rose Red pulse.
        - **Neutral**: Electric Purple pulse.
    - **"AI Insight" Chart Button**: Added a dedicated glassmorphic AI button to the Symbol Chart header for quick access to the Pulse Verdict.
    - **Omnisearch Evolution**: Synchronized the search bar's "Popular Assets" with the user's Macro Scanner settings. New custom symbols added to the scanner are now automatically prioritized in search results.
- **Visual Polish**:
    - Added basic Markdown support to chat responses (rendering `**bold**` and `*italic*` correctly).
    - Implemented background scroll-locking when the Symbol Analysis modal is open to eliminate redundant scrollbars and improve focus.

### Fixed
- **API Key Precedence**: Resolved a critical environment conflict where old system-level `GOOGLE_API_KEY` variables in Windows were overriding local project `.env` settings.
- **Chart Interaction Alignment**: Fixed a mouse-coordinate mapping bug in the `StrategyPayoff` chart where the inspection dot drifted away from the cursor on high-DPI or scaled displays.
- **Search Result Visibility**: Increased the maximum visible "Popular Assets" in search to 12 and added a scrollable results area to prevent newly added custom symbols from being clipped.

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
