# AI Options Trader

An intelligent macroeconomic options trading dashboard. It provides a real-time heatmap of a global ETF basket, breaking financial news catalysts, and AI-driven trade recommendations based on VIX volatility profiles.

## Core Features
1. **Macro Scanner**: Live dashboard tracking SPY, QQQ, TMF, BND, GLD, and IWM. Dynamic UI indicates whether data is streaming via Alpaca Markets or falling back to Yahoo Finance.
2. **AI Actionable Setups**: Uses real-time VIX levels to diagnose market regimes (Buyer's, Seller's, or Cash Market) and fuses this with breaking news headlines to generate specific options plays (e.g., Credit Spreads, Debit Spreads, Iron Condors).
3. **News & Catalysts Feed**: A scrolling timeline of recent financial headlines connected back to the recommended trades.
4. **Paper Trading Portfolio**: Simulate options execution with a built-in SQLite portfolio manager.

## Getting Started

### Prerequisites
- Docker & Docker Compose
- API Keys for Alpaca Markets (optional, falls back to Yahoo Finance if not provided)

### Setup
1. Copy `.env.example` to `.env` and configure your Alpaca API Keys.
   ```bash
   cp .env.example .env
   ```
2. Build and run the application stack:
   ```bash
   docker-compose up --build
   ```

### Application URLs
- **Frontend Dashboard:** [http://localhost:5173/](http://localhost:5173/)
- **Backend API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
