# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Alpaca Live Paper Trading:** Switched from the local SQLite `options_trader.db` to syncing perfectly with Alpaca's Paper Trade API.
  - Buying an equity via the app submits a real Market order.
  - Open Positions table queries the real broker account directly making sync seamless across your dashboard and the Alpaca web portal.
  - Closing or Deleting a trade immediately liquidates the position from the broker or cancels the order.
  - Added a "Liquidate All" mechanism.
  - Order state tracking: Distinguishes between `OPEN` positions and `PENDING` open orders (which blink orange and allow pre-market cancellations).
- **Comprehensive Recommendation Engine:** Expanded the AI strategy generator to include six diverse options plays, including Bull Call Spreads, Covered Calls, Long Straddles, and Iron Condors.
- **Advanced Filtering & Sorting:** Integrated dynamic UI controls to filter trade ideas by side (BUY/SELL) and sort by Win Prob (POP), Risk/Reward Ratio, and AI Confidence.
- **Memory Bank & Changelog Documentation:** Added standard documentation for project tracking.

### Changed
- **Macro Scanner API (`/scanner`) & News API (`/news`):** Refactored JSON responses. The endpoints now return a dictionary wrapped payload (`{"feed": "...", "data": [...]}`) instead of raw arrays.
- **Frontend TS Types:** Cleared React and Lucide unused imports. Resolved VSCode TypeScript server linting errors by rebuilding `node_modules` with correct WSL user permissions.

### Fixed
- **Alpaca Response Parsing:** Fixed empty array bugs in `data_fetcher.py` by safely checking for `latestTrade` and `prevDailyBar` objects. Implemented robust `yfinance` fallbacks for scanner and news components.
- **Recommendation Filter Bug:** Fixed a critical issue where the `side` field was stripped from API responses by explicitly adding it to the `TradeRecommendation` Pydantic model in `backend/main.py`.
- **Alpaca API Key Typo:** Removed rogue `y` prefix from `ALPACA_API_KEY` in the `.env` file, resolving 401 Unauthorized errors and restoring the real-time Alpaca data feed.
