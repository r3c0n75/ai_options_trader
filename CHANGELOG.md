# Changelog

All notable changes to this project will be documented in this file.


## [2026-03-15] - VIX Market Pulse Integration & Charting Fixes

### Added
- **Inline VIX Market Pulse** (`VixMarketPulseInline.tsx`):
    - Refactored the VIX analysis from a modal to a seamless inline component on the main dashboard.
    - **Mutual Exclusivity**: Dashboard now intelligently manages state to ensure only one expanded analysis (VIX or asset symbol) is active at a time.
    - **Premium UI**: Integrated glassmorphism, interactive charts, and AI-driven macro thesis with model attribution (e.g., Gemini-Flash-Latest).
    - **Interactive VIX Level**: Hover-enhanced clickable VIX metric in the "Market Health" card triggers the inline expansion.

### Fixed
- **Chart Interval Bug**: Resolved a critical backend/frontend parameter mismatch where timeframe selection (1D, 1M, 12M) was ignored by the data engine.
- **Robust VIX Data Fetching**:
    - Upgraded `data_fetcher.py` to use `yf.download` for better reliability in Docker/WSL environments.
    - Implemented automatic symbol normalization (carets) for index data (`^VIX`).
    - Added error-resilient fallbacks for Alpaca data gaps in free-tier accounts.
- **AI Model Attribution Consistency**: Standardized the display of AI model names in the VIX Pulse view to match the "AI Deep Research" branding.

## [2026-03-15] - AI Insight Crash Fix

### Fixed
- **Blank Screen Crash**: Resolved a critical React crash when accessing "AI Insight" for a symbol for the first time.
- **Backend Consistency**: Updated `/analysis/{symbol}` to return a full data structure (with placeholders) during the "processing" state, matching the frontend's interface expectations.
- **Frontend Robustness**: Added defensive null-checks and optional chaining in `SymbolAnalysis.tsx` for price, change percentage, and AI verdict strings.

## [2026-03-13] - Debug HUD & AI Model Attribution

### Added
- **Real-Time Debug HUD** (`DebugHUD.tsx`):
    - Implemented a "System HUD" accessed via a floating bug icon for real-time backend monitoring.
    - **Worker Thread Pool Matrix**: Visualizes `_GLOBAL_EXECUTOR` load with a 100-dot grid (dynamic 25-column layout in fullscreen).
    - **Telemetry Analytics**: Tracks API latency, cache efficiency, and AI model usage distribution.
    - **Soft/Hard Error Logs**: Dedicated log view with multi-line wrapping and "Soft Error" (retriable/caught AI exceptions) tracking.
    - **Fullscreen Transition**: Added Maximize/Minimize toggles for high-density dashboard viewing.
- **AI Model Attribution**:
    - **Backend Integration** (`ai_engine.py`, `engine.py`): Modified AI generation to return the specific Gemini model used, propagating it through market health and recommendations.
    - **Frontend Visibility**: 
        - Added model badges to **AI Pulse Verdict**, **News Analysis**, and **Trade Action** modals.
        - Standardized model "walking" fallback IDs across the backend for consistent attribution.

### Fixed
- **Thread Pool Visualization**: Fixed matrix scrolling issues in fullscreen mode by implementing a compact 4x25 layout.
- **AI Service Limits Awareness**: Increased visibility for `429` quota errors by treating them as "Soft Errors" in the Debug HUD telemetry.

### Added
- **Two-Step Cancel Confirmation** (`App.tsx`):
    - Clicking the cancel (✕) button now shows an inline **"Cancel? [Yes] [No]"** prompt directly in the order row, preventing accidental cancellations.
    - Clicking **No** dismisses the prompt with no action taken.

### Fixed
- **Cancel Order Status Feedback**:
    - When **Yes** is clicked, the status column immediately changes to a pulsing **"● CANCELLING"** badge (rose-colored) and all action buttons are hidden, giving clear in-progress feedback.
    - Fixed a race condition where the status would briefly revert to **PENDING** after the cancel succeeded. Root cause: Alpaca's GET /orders endpoint can lag behind a DELETE, causing a refresh to return stale PENDING data. Fixed by implementing an **optimistic update** — local state is immediately set to CANCELED upon a successful DELETE, with a background sync to reconcile with the server.
    - Failure path is safe: if the DELETE fails, the optimistic update is never applied, the row reverts to PENDING with action buttons restored, and an error toast is displayed.

## [2026-03-13] - Iron Condor Fixes & Order Management

### Fixed
- **Iron Condor Strategy Detection**:
    - **Backend (`main.py`)**: Enhanced `_map_alpaca_order_to_trade_response` to correctly identify 4-leg orders as "Iron Condor" and 2-leg orders as named spreads (e.g. "Put Spread Sell") instead of the generic "Spread Sell".
    - **Frontend (`App.tsx`)**: Fixed a bracket nesting error in `groupOpenTrades` that caused the Iron Condor detection block (`opts.length === 4`) to be unreachable. Now correctly groups 4-leg positions (2 puts + 2 calls, mixed sides) as "Iron Condor".
    - **Status Mapping**: Ensured Alpaca's `NEW` and `ACCEPTED` internal order statuses are correctly mapped to `PENDING` in the UI.

- **Trade Modal Expiration Selection**:
    - **Date Normalization**: Added a `normalizeDate` utility in `TradeConfirmationModal.tsx` that converts OCC-format expiration dates (`YYMMDD`, e.g. `260417`) to standard `YYYY-MM-DD` before horizon comparison.
    - **Tab Defaulting Fix**: The modal now correctly selects the "Monthly" or "Weekly" tab for existing orders instead of defaulting to "LEAPS" (which occurred because `new Date("260417")` evaluated to the far future).
    - **Selection Highlighting**: Fixed a comparison that prevented the active expiration date button from appearing highlighted when editing a pending order.
    - **UI Label Clarity**: Relabeled the limit price field from "Net Credit per share" to "Strategy Net Credit" for clearer intent with multi-leg strategies.

- **Pending Multi-Leg Order Updates (Cancel & Re-submit)**:
    - **Root Cause**: Alpaca's REST API does not support the `PATCH /orders/{id}` (replace) operation for multi-leg (`mleg`) orders in `accepted` status.
    - **Fix (`main.py`)**: Rewrote `patch_trade` to detect `order_class == "mleg"` orders. For these, the function now: (1) fetches the full existing order to extract its legs, (2) **cancels** the original order, and (3) **re-submits** a new identical order at the updated limit price. Single-leg orders continue to use the Alpaca replace API as before.
    - **Backend Argument Bug**: Fixed a bug where `patch_trade_api` was passing the entire `TradeUpdate` Pydantic model object to the underlying function instead of unpacking its `limit_price` and `quantity` fields, causing a `TradeUpdate doesn't define __round__ method` error.

## [2026-03-13] - Performance Optimization & Dashboard Stability

### Added
- **Backend Concurrency Hardening**:
    - **Async Endpoint Refactor**: Converted all critical endpoints in `main.py` to `async def` to prevent thread pool saturation during high-traffic bursts.
    - **Request Deduplication**: Implemented a centralized `asyncio.Lock` mechanism in `main.py`. This ensures that multiple concurrent requests for expensive AI synthesis (e.g., from multiple tabs) are queued, with only one executing while others wait for the cached result.
    - **Global ThreadPoolExecutor**: Centralized all background I/O tasks into a dedicated `_GLOBAL_EXECUTOR` to prevent uncontrolled thread spawning.
- **AI Synthesis Resilience**:
    - **Dynamic Fallback TTL**: Reduced the cache duration for "delayed" or failed AI synthesis from 5 minutes to 30 seconds, allowing for near-instant system recovery after temporary API hiccups.
    - **Extended AI Timeouts**: Increased the maximum Gemini execution time to 15s and enhanced the "model walking" fallback chain to ensure high-priority insights are delivered even during peak usage.

### Fixed
- **Dashboard Response Storms**:
    - **Polling Consolidation**: Throttled frontend data refresh intervals from 5s to 30s and consolidated redundant `useEffect` hooks in `App.tsx`.
    - **Endpoint Restoration**: Restored several critical endpoints (`/news`, `/stocks/{symbol}/bars`, `/options/expirations`, `/options/reprice`) that were inadvertently removed during the performance refactor.
- **Backend Stability**:
    - Resolved a `NameError` in `main.py` where internal mapping functions were missing after optimization.
    - Fixed a "thundering herd" issue where multiple dashboard tabs would trigger redundant AI scans, causing backend lockups.

## [2026-03-13] - Guided Expirations & Stability

### Added
- **Guided Expiration Selection**:
    - **Interactive Horizon Toggles**: Added "Weekly", "Monthly", and "LEAPS" tabs to the `TradeConfirmationModal` for faster strategy optimization.
    - **Real-Time Repricing**: Integrated a new API endpoint that dynamically re-calculates option legs and premiums when a user selects a different expiration date.
    - **Liquidity Awareness**: Implemented pulsing visual warnings for LEAPS expirations to manage user expectations for order fill times.
- **Backend Options Engine**:
    - **Dynamic Repricing Endpoint**: Created `/options/reprice` to handle real-time strategy recalculations across different timeframes.
    - **Expiration Scraper**: Added `/options/expirations/{symbol}` to fetch all active contract dates from Alpaca/YFinance.

### Fixed
- **Critical Modal Stability**:
    - **Black Screen Resolution**: Resolved a crash that occurred when opening the trade modal for certain spreads. The root cause was an API URL prefix mismatch (`/api/options` vs `/options`) paired with a lack of null-safety on error responses.
    - **Robust Data Handling**: Added defensive array-checks and optional chaining across `TradeConfirmationModal.tsx` to ensure the UI remains stable during network errors or malformed data snapshots.

## [Unreleased]

- **Portfolio "Top Positions" Sorting**:
    - **Interactive Column headers**: Added full sorting capabilities for the Portfolio table, allowing users to organize positions by Asset, Days to Expiry (DTE), Current Price, Quantity, Market Value, Total P/L, Status, and AI Action.
    - **Visual Sort Indicators**: Integrated animated `ChevronUp` and `ChevronDown` icons to clearly denote active sorting states and hover potential.
    - **Real-time Persistence**: Ensured the user's selected sort order is maintained during the 5-second automatic data refresh cycle, preventing disruptive UI jumps.

- **Portfolio Payoff Chart Fixes**:
    - **Sign Correction**: Resolved a critical bug where credit spreads (money received) were incorrectly treated as costs (money paid) in P/L calculations.
    - **Black-Scholes Guards**: Handled non-positive stock prices (`S <= 0`) to prevent `$NaN` in distributions by returning intrinsic values.
    - **Robust Underlying Price Logic**: Added proactive stock price fetching in the backend (`main.py`) for option positions and removed incorrect fallbacks to option premiums.
    - **Theoretical Curve Anchoring**: Calibrated the theoretical payoff curve to anchor exactly to the actual realized portfolio P/L, ensuring visual consistency.
    - **Zero-Line Visibility**: Brightened the break-even zero line in `StrategyPayoff.tsx` for better accessibility in dark mode.
    - **UI Refinements**: Renamed tooltip P/L label to "Current P/L" and widened tooltip for better legibility on multi-leg strategies.

- **Trade Execution & Safety**:
    - **Limit Order Protection**: Implemented mandatory **Limit Orders** for all multi-leg spreads, using recommended premiums to prevent "bad fills" and guaranteed losses from leg-in errors.
    - **Active Fill Detection**: Backend polls Alpaca for 5s after submission to detect and report immediate fills, enabling distinct "Executed" vs "Working" (Pending) UI states.
    - **Order Lifecycle Controls**: 
        - **Instant Updates**: Users can modify the limit price of pending orders via a dedicated row-level modal.
        - **Cancellation**: One-click cancellation for orders in the `PENDING` state.
        - **Resubmission**: "Smart Retry" allows instant resubmission of failed or cancelled trades by leveraging preserved leg and strike data in the `recentOrders` set.
    - **Option-Only Payloads**: Automatically filters out stock legs from multi-leg option orders to comply with Alpaca API requirements for OCC symbols.

- **Order Management & Lifecycle**:
    - **Cancel Functionality**: Added row-level "Cancel" action for pending orders.
    - **Limit Price Modification**: Implemented an "Update Price" flow that uses Alpaca's Replace API to adjust limit prices on active orders.
    - **Smart Retry**: Developed a one-click resubmission flow for cancelled or rejected orders, pre-populating the trade flow with historical leg data and strategy configurations.

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
