# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Interactive Asset Charts:**
    - High-performance **TradingView Lightweight Charts™** integration for all core ETFs.
    - Dynamic timeframe switching: **1 Day (intraday)**, **1 Month**, and **3 Month** historical views.
    - **Fullscreen Analysis Mode:** Enhanced immersive view with dynamic scaling and true edge-to-edge layout.
- **Trade Payoff Diagrams (Analysis Curve © EXP):**
    - Interactive P&L diagrams for all trade recommendations, mirroring **TastyTrade's** analysis platform.
    - Visualizes profit/loss zones, breakeven points, and strike markers.
- **Historical Bar Data API:** New backend endpoint `/stocks/{symbol}/bars` with robust **Alpaca v2** data fetching and **Yahoo Finance** fallback strategy.
- **Investigative Deep-Dive:** Confirmed Alpaca Web Portal "reading 't'" error is a non-destructive external i18n frontend bug on Alpaca's side, unrelated to local API calls.

### Changed
- **Macro Scanner API (`/scanner`) & News API (`/news`):** Refactored JSON responses. The endpoints now return a dictionary wrapped payload (`{"feed": "...", "data": [...]}`) instead of raw arrays.
- **Frontend TS Types:** Cleared React and Lucide unused imports. Resolved VSCode TypeScript server linting errors by rebuilding `node_modules` with correct WSL user permissions.

### Fixed
- **Dependency Management:** Resolved `lightweight-charts` "module not found" errors by explicitly listing the dependency in `package.json`.
- **Alpaca Response Parsing:** Fixed empty array bugs in `data_fetcher.py` by safely checking for `latestTrade` and `prevDailyBar` objects. Implemented robust `yfinance` fallbacks for scanner and news components.
- **Stale Chart Data:** Fixed a critical issue where SPY, QQQ, and other ETFs showed stale data (up to 14 days old) due to Alpaca IEX feed latency. Implemented a "latest-first" sorting strategy and a 3-day staleness detector that automatically falls back to **Yahoo Finance** for guaranteed current data.
- **Recommendation Filter Bug:** Fixed a critical issue where the `side` field was stripped from API responses by explicitly adding it to the `TradeRecommendation` Pydantic model in `backend/main.py`.
- **Alpaca API Key Typo:** Removed rogue `y` prefix from `ALPACA_API_KEY` in the `.env` file, resolving 401 Unauthorized errors and restoring the real-time Alpaca data feed.
