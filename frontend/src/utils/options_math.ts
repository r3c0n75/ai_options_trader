/**
 * Black-Scholes Options Pricing Utilities
 */

/**
 * Cumulative Distribution Function for a standard normal distribution
 */
export function cdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}

/**
 * Calculate Black-Scholes price for a call or put option
 * 
 * @param S Current stock price
 * @param K Strike price
 * @param T Time to expiration (in years, e.g., 30 days = 30/365)
 * @param r Risk-free interest rate (e.g., 0.05 for 5%)
 * @param sigma Implied Volatility (e.g., 0.2 for 20%)
 * @param type 'CALL' or 'PUT'
 */
export function blackScholes(
  S: number, 
  K: number, 
  T: number, 
  sigma: number, 
  type: 'CALL' | 'PUT',
  r: number = 0.05
): number {
  if (T <= 0) {
    if (type === 'CALL') return Math.max(0, S - K);
    return Math.max(0, K - S);
  }

  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  if (type === 'CALL') {
    return S * cdf(d1) - K * Math.exp(-r * T) * cdf(d2);
  } else {
    return K * Math.exp(-r * T) * cdf(-d2) - S * cdf(-d1);
  }
}

/**
 * Calculate the theoretical P/L of a strategy at a given price point
 */
export interface StrategyLeg {
  strike: number;
  side: 'BUY' | 'SELL' | 'LONG' | 'SHORT';
  type: 'CALL' | 'PUT' | 'STOCK';
  premium: number;
  dte?: number;
  iv?: number;
}

export function calculateTheoreticalPnL(
  price: number,
  legs: StrategyLeg[],
  riskFreeRate: number = 0.05
): number {
  return legs.reduce((total, leg) => {
    const isLong = leg.side === 'BUY' || leg.side === 'LONG';
    const isCall = leg.type === 'CALL';
    const isStock = leg.type === 'STOCK';

    if (isStock) {
      const pnl = isLong ? (price - leg.premium) : (leg.premium - price);
      return total + pnl;
    }

    // Default values if missing
    const dte = leg.dte ?? 30;
    const iv = (leg.iv ?? 25) / 100; // Convert 25% to 0.25
    const T = dte / 365;

    const currentOptionPrice = blackScholes(price, leg.strike, T, iv, isCall ? 'CALL' : 'PUT', riskFreeRate);
    
    // P/L = Current Market Value - Value at Entry
    // For options, entry value is the premium paid (positive) or received (negative if we use signed premium elsewhere, but component assumes absolute premium usually)
    // Looking at StrategyPayoff.tsx, premium is absolute and side determines direction.
    
    if (isLong) {
      return total + (currentOptionPrice - leg.premium);
    } else {
      return total + (leg.premium - currentOptionPrice);
    }
  }, 0) * (legs.some(l => l.type !== 'STOCK') ? 100 : 1);
}
