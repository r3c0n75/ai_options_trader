# AI Macro Strategy Upgrades & Visualization Plan

This plan outlines the integration of Gemini 3.1 Pro's institutional-grade recommendations into our Macro Strategy and the creation of a visual process flow diagram.

## User Review Required

> [!IMPORTANT]
> The critique suggests a major shift in trade management: moving from 30 DTE to 45-60 DTE and closing at 21 DTE. This significantly changes the "personality" of the bot from high-frequency/short-term to a more stable, institutional swing profile.

## Proposed Changes

### Documentation & Visualization

#### [NEW] [AI_MACRO_STRATEGY_V2.md](file:///i:/git_projects/ai_options_trader/AI_MACRO_STRATEGY_V2.md)
Create a new version of the strategy document that:
1.  Integrates the **VIX Term Structure** and **VRP** (Volatility Risk Premium) logic.
2.  Updates the **Trade Mechanics** (DTE, Strike Width, 21-day management).
3.  Adds a **Mermaid Process Flow Diagram** in the "Summary of the Upgraded Architecture" section.

### Logic Refinement (Conceptual for now)
- Update [backend/engine.py](file:///i:/git_projects/ai_options_trader/backend/engine.py) (future task) to support wider spreads and ATR-based selection.
- Update `backend/risk_manager.py` (future task) to handle Delta-based stops instead of P/L % stops.

### Institutional Polish

### [Component] Macro Recommendation Engine (`backend/engine.py`)
Summary: Comprehensive refactor to remove hardcoding and improve institutional logic.

#### [MODIFY] [engine.py](file:///i:/git_projects/ai_options_trader/backend/engine.py)
- **Fix Logic**: Remove duplicate `evaluate_market_health` calls and fix the dangling docstring breaking the risk circuit breaker.
- **Asset-Class Awareness**: Implement `SAFE_HAVENS` logic to ensure TMF/GLD/BND get bullish strategies during risk-off regimes.
- **Dynamic Metrics**: Replace hardcoded `pop` and `risk_reward` strings with computed values based on strike distance and premium.
- **Symbol Intelligence**: Inject IV data and ATR context into the generated `thesis` to differentiate recommendations.
- **Scoring System**: Implement a weighted `score` for each recommendation and sort results by score instead of random shuffling.

---

### [Component] Dashboard UI (`frontend/src/components/Recommendations.tsx`)
Summary: UI refinements to surface the new intelligence.

#### [MODIFY] [Recommendations.tsx](file:///i:/git_projects/ai_options_trader/frontend/src/components/Recommendations.tsx)
- **Model Attribution**: Add the `model` field to the card display to show which AI generated the macro thesis.
- **Ranking Visuals**: (Optional) Add a subtle "Top Opportunity" badge to the highest-scoring items.
- **Deduplication**: Ensure the frontend handles cases where the same symbol might have multiple strategies surfaced.

## Verification Plan

### Automated Tests
- Run `tmp_test_recs.py` and verify that safe havens (GLD) show "BUY" actions during backwardation.
- Verify that `pop` values are no longer identical (e.g., SPY vs NVDA).
- Confirm that results are sorted by score, not randomly.

### Manual Verification
1.  **Mermaid Rendering**: Verify that the Mermaid diagram in `AI_MACRO_STRATEGY_V2.md` renders correctly in a Markdown preview.
2.  **Content Accuracy**: Review the upgraded logic to ensure it accurately reflects the "World-Class Enhancements" suggested in the critique.
- Check the dashboard to confirm model names (e.g., "gemini-flash-latest") appear on cards.
- Verify that "Show All" display doesn't just show a wall of identical text.
