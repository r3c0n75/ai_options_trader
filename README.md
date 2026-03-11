# AI Options Trader

An intelligent macroeconomic options trading dashboard. It provides a real-time heatmap of a global ETF basket, breaking financial news catalysts, and AI-driven trade recommendations based on VIX volatility profiles.

## Core Features
1. **Macro Scanner**: Live dashboard tracking SPY, QQQ, IWM, USO, GLD, TMF, and BND. Dynamic UI indicates whether data is streaming via Alpaca Markets or falling back to Yahoo Finance.
2. **AI Actionable Setups**: Diagnoses market regimes (Buyer's, Seller's, or Cash Market) using VIX and news to generate 6+ diverse options plays (Long Calls, Covered Calls, Straddles, Iron Condors). 
3. **Trade Confirmation Modal**: A high-fidelity UI that intercepts order submissions, allowing for final quantity modification and strategy-specific feedback (like Buy-Write warnings).
4. **Advanced Filtering & Ranking**: Sort and filter recommendations by Win Probability (POP), Risk/Reward Ratio, and AI Confidence to find the best setup for your risk profile.
5. **News & Catalysts Feed**: A scrolling timeline of recent financial headlines connected back to the recommended trades.
6. **High-Fidelity Portfolio Dashboard**: A comprehensive trading hub mirroring the Alpaca web portal. Includes an **Equity History Chart**, live **Account Balances** (Buying Power, Cash, Daily P/L), and an audit trail of **Recent Orders**.
7. **Interactive Asset Charts**: Integrated **Lightweight Charts™** for high-performance historical data (1D, 1M, 3M) with an immersive **Fullscreen Analysis Mode**.
8. **Trade Payoff Diagrams**: Interactive SVG-based P&L curves for all recommendations, providing TastyTrade-style risk analysis. Supports Spreads, Iron Condors, and Straddles with mathematical accuracy across all asset classes.
9. **Live Paper Trading**: Execute orders directly through the Alpaca Paper Trading API with real-time position and order sync.

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
