# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Alpaca Live Paper Trading:** Swigged from the local SQLite `options_trader.db` to syncing perfectly with Alpaca's Paper Trade API.
  - Buying an equity via the app submits a real Market order.
  - Open Positions table queries the real broker account directly making sync seamless across your dashboard and the Alpaca web portal.
  - Closing or Deleting a trade immediately liquidates the position from the broker or cancels the order.
  - Added a "Liquidate All" mechanism.
  - Order state tracking: Distinguishes between `OPEN` positions and `PENDING` open orders (which blink orange and allow pre-market cancellations).
- **Data Feed Indicator:** Added real-time frontend badge in the Macro Scanner to display the active data source (`Alpaca Markets` or `Yahoo Finance`).
- **Comprehensive `.gitignore`:** Configured exclusions for `node_modules`, Python caches, `.env` files, and local SQLite databases.
- **Memory Bank & Changelog Documentation:** Added standard documentation for project tracking.

### Changed
- **Macro Scanner API (`/scanner`) & News API (`/news`):** Refactored JSON responses. The endpoints now return a dictionary wrapped payload (`{"feed": "...", "data": [...]}`) instead of raw arrays.
- **Frontend TS Types:** Cleared React and Lucide unused imports. Resolved VSCode typescript sever linting errors by rebuilding `node_modules` with correct WSL user permissions.

### Fixed
- **Alpaca API Key Typo:** Removed rogue `y` prefix from `ALPACA_API_KEY` in the `.env` file, resolving 401 Unauthorized errors and restoring the real-time Alpaca data feed.
- **Alpaca Response Parsing:** Fixed empty array bugs in `data_fetcher.py` by safely checking for `latestTrade` and `prevDailyBar` objects. Implemented robust `yfinance` fallbacks for scanner and news components.
