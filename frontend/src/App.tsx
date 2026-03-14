import { useState, useEffect, useMemo, Fragment } from 'react';
import { MarketHealth } from './components/MarketHealth';
import { Recommendations } from './components/Recommendations';
import { ETFScanner } from './components/ETFScanner';
import { NewsFeed } from './components/NewsFeed';
import { NewsAnalysisModal } from './components/NewsAnalysisModal';
import { SymbolChart } from './components/SymbolChart';
import { StrategyPayoff } from './components/StrategyPayoff';
import { 
  Briefcase, 
  Activity, 
  LayoutDashboard, 
  Newspaper, 
  X,
  TrendingUp, 
  TrendingDown, 
  PieChart, 
  Wallet, 
  Zap, 
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Info,
  Clock,
  ChevronUp,
  ChevronDown,
  Edit3,
  XCircle
} from 'lucide-react';
import { Omnisearch } from './components/Omnisearch';
import { SymbolAnalysis } from './components/SymbolAnalysis';
import { TradeConfirmationModal } from './components/TradeConfirmationModal';
import { DebugHUD } from './components/DebugHUD';
import { Bug } from 'lucide-react';

interface AIRecommendation {
  action: 'HOLD' | 'CLOSE' | 'ROLL';
  rationale: string;
  confidence: number;
  details: string[];
  model?: string;
}

interface TradeResponse {
  id: string;
  symbol: string;
  strategy: string;
  entry_price: number;
  current_price: number;
  quantity: number;
  market_value: number;
  unrealized_pl: number;
  unrealized_plpc: number;
  underlying_price: number;
  status: string;
  side: string;
  opened_at: string;
  ai_rec?: AIRecommendation;
  legs?: any[];
}

interface AccountStats {
  buying_power: number;
  cash: number;
  equity: number;
  long_market_value: number;
  day_change: number;
  day_change_percent: number;
}

interface PortfolioHistory {
  timestamp: number[];
  equity: number[];
  profit_loss: number[];
  profit_loss_pct: number[];
  base_value: number;
}

const parseOCC = (symbol: string) => {
  const match = symbol.match(/^([a-zA-Z]{1,6})(\d{6})([CP])(\d{8})$/);
  if (!match) return null;
  return {
    underlying: match[1],
    expiration: match[2],
    type: match[3] === 'C' ? 'CALL' : 'PUT',
    strike: parseInt(match[4], 10) / 1000
  };
};

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'news' | 'portfolio'>('dashboard');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [trades, setTrades] = useState<TradeResponse[]>([]);
  const [recentOrders, setRecentOrders] = useState<TradeResponse[]>([]);
  const [account, setAccount] = useState<AccountStats | null>(null);
  const [history, setHistory] = useState<PortfolioHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [searchedSymbol, setSearchedSymbol] = useState<string | null>(null);
  const [portfolioPeriod, setPortfolioPeriod] = useState<string>('1D');
  const [portfolioHoverData, setPortfolioHoverData] = useState<{ index: number; x: number } | null>(null);
  const [highlightedSymbol, setHighlightedSymbol] = useState<string | null>(null);
  const [selectedActionRec, setSelectedActionRec] = useState<{ trade: any, rec: AIRecommendation } | null>(null);
  const [analyzingNews, setAnalyzingNews] = useState<any | null>(null);
  const [retryTrade, setRetryTrade] = useState<any | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'market_value', direction: 'desc' });
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  const handleRequestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const portfolioSymbols = useMemo(() => {
    const symbols = new Set<string>();
    
    // 1. Existing positions
    trades.forEach(t => {
      if (!t.symbol) return;
      const occ = parseOCC(t.symbol);
      const sym = (occ ? occ.underlying : t.symbol).trim();
      if (sym) symbols.add(sym);
    });

    // 2. Recent/Pending orders
    recentOrders.forEach(o => {
      if (!o.symbol) return;
      const occ = parseOCC(o.symbol);
      const sym = (occ ? occ.underlying : o.symbol).trim();
      if (sym) symbols.add(sym);
    });

    return Array.from(symbols);
  }, [trades, recentOrders]);
    const groupOpenTrades = () => {
    const openTrades = trades.filter(t => t.status === 'OPEN');
    const groups: any[] = [];

    const calculateDTE = (occSymbol: string) => {
      const occ = parseOCC(occSymbol);
      if (!occ) return null;
      // Format: YYMMDD
      const dateStr = `20${occ.expiration.substring(0, 2)}-${occ.expiration.substring(2, 4)}-${occ.expiration.substring(4, 6)}`;
      const expiry = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffTime = expiry.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const getRiskLevel = (dte: number | null, plpc: number) => {
      if (dte === null) return 'none';
      if (dte <= 3 && plpc < -5) return 'critical';
      if (dte <= 7) return 'warning';
      return 'none';
    };
    
    // 1. Separate Stocks and Options
    const stocks: TradeResponse[] = [];
    const options: (TradeResponse & { occ: any; dte: number | null })[] = [];

    openTrades.forEach(t => {
      const occ = parseOCC(t.symbol);
      if (occ) {
        options.push({ ...t, occ, dte: calculateDTE(t.symbol) });
      } else {
        stocks.push(t);
      }
    });

    // 2. Identify Covered Calls
    // Logic: If we have a stock position (e.g. SBUX, 100 shares) AND a short call (e.g. SBUX...C..., -1 contract).
    const pairedOptionIds = new Set<string>();
    const usedStockIndices = new Set<number>();

    stocks.forEach((stock, stockIdx) => {
      // Find a matching short call
      // Assumes 100 shares per contract
      const contractCount = Math.floor(stock.quantity / 100);
      if (contractCount > 0) {
        // Look for any short call on the same underlying
        const matchingShortCall = options.find(opt => 
          !pairedOptionIds.has(opt.id) && 
          opt.occ.underlying === stock.symbol && 
          opt.occ.type === 'CALL' && 
          (opt.side === 'short' || opt.quantity < 0) &&
          Math.abs(opt.quantity) === contractCount
        );

        if (matchingShortCall) {
          pairedOptionIds.add(matchingShortCall.id);
          usedStockIndices.add(stockIdx);

          // Create combined Covered Call entry
          groups.push({
            id: `cc-${stock.symbol}-${matchingShortCall.id}`,
            symbol: stock.symbol,
            strategy: "Covered Call",
            isSpread: true,
            market_value: stock.market_value + matchingShortCall.market_value,
            unrealized_pl: stock.unrealized_pl + matchingShortCall.unrealized_pl,
            unrealized_plpc: (stock.unrealized_pl + matchingShortCall.unrealized_pl) / (Math.abs(stock.entry_price * stock.quantity) + Math.abs(matchingShortCall.entry_price * matchingShortCall.quantity * 100) || 1) * 100,
            status: "OPEN",
            side: "MULTI",
            quantity: `${contractCount} Contract(s)`,
            dte: matchingShortCall.dte,
            riskLevel: getRiskLevel(matchingShortCall.dte, matchingShortCall.unrealized_plpc),
            diagram_data: {
              underlying_price: stock.underlying_price || stock.current_price || stock.entry_price,
              strategy_type: "covered_call",
              actual_pl: stock.unrealized_pl + matchingShortCall.unrealized_pl,
              total_quantity: contractCount,
              legs: [
                {
                  strike: stock.entry_price,
                  side: 'BUY',
                  type: 'STOCK',
                  premium: Math.abs(stock.entry_price || stock.current_price || 0),
                  dte: matchingShortCall.dte,
                  iv: 25 // Default IV for now
                },
                {
                  strike: matchingShortCall.occ.strike,
                  side: 'SELL',
                  type: 'CALL',
                  premium: Math.abs(matchingShortCall.entry_price || matchingShortCall.current_price || 0),
                  dte: matchingShortCall.dte,
                  iv: 25 // Default IV for now
                }
              ]
            },
            legDetails: [stock, matchingShortCall],
            ai_rec: (matchingShortCall.ai_rec?.action === 'CLOSE' && (stock.unrealized_pl + matchingShortCall.unrealized_pl) < -50) 
              ? matchingShortCall.ai_rec 
              : (matchingShortCall.ai_rec?.action === 'CLOSE' ? { ...matchingShortCall.ai_rec, action: 'HOLD', rationale: 'Individual leg drawdown offset by strategy components. Holding for theta.' } : matchingShortCall.ai_rec)
          });
        }
      }
    });

    // 3. Add remaining stocks
    stocks.forEach((stock, idx) => {
      if (!usedStockIndices.has(idx)) {
        groups.push({...stock, 
          isSpread: false,
          dte: null,
          riskLevel: 'none',
          legDetails: [stock],
          diagram_data: {
            underlying_price: stock.underlying_price || stock.current_price || stock.entry_price,
            strategy_type: "long_stock",
            actual_pl: stock.unrealized_pl,
            total_quantity: stock.quantity,
            legs: [{
              strike: stock.entry_price || stock.current_price,
              side: (stock.side?.toLowerCase() === 'short' || stock.side?.toLowerCase() === 'sell') ? 'SELL' : 'BUY',
              type: 'STOCK',
              premium: Math.abs(stock.entry_price || stock.current_price || 0)
            }]
          },
          ai_rec: stock.ai_rec
        });
      }
    });

    // 4. Group remaining options (Spreads or Naked)
    const remainingOptions = options.filter(opt => !pairedOptionIds.has(opt.id));
    const optionsByUnderlying = new Map<string, any[]>();

    remainingOptions.forEach(opt => {
      if (!optionsByUnderlying.has(opt.occ.underlying)) optionsByUnderlying.set(opt.occ.underlying, []);
      optionsByUnderlying.get(opt.occ.underlying)!.push(opt);
    });

    // Create a price map for underlyings from existing stock positions
    const stockPriceMap = new Map<string, number>();
    stocks.forEach(s => {
      const price = s.underlying_price || s.current_price || s.entry_price;
      if (price) stockPriceMap.set(s.symbol, price);
    });

    optionsByUnderlying.forEach((opts, underlying) => {
      const totalMarketValue = opts.reduce((sum, opt) => sum + opt.market_value, 0);
      const totalPl = opts.reduce((sum, opt) => sum + opt.unrealized_pl, 0);
      const avgPlpc = opts.reduce((sum, opt) => sum + opt.unrealized_plpc, 0) / opts.length;
      
      const minDte = Math.min(...opts.map(o => o.dte ?? 999));
      const riskLevel = getRiskLevel(minDte === 999 ? null : minDte, avgPlpc);

      let strategyName = `${opts.length}-Leg Strategy`;
      let strategyType = "custom";
      if (opts.length === 1) {
        const isShort = opts[0].side === 'short' || opts[0].quantity < 0;
        strategyName = `${isShort ? 'Short' : 'Long'} ${opts[0].occ.type}`;
        strategyType = opts[0].occ.type === 'CALL' 
          ? (isShort ? 'short_call' : 'long_call') 
          : (isShort ? 'short_put' : 'long_put');
      } else if (opts.length === 2) {
        const leg1 = opts[0];
        const leg2 = opts[1];
        const isSameType = leg1.occ.type === leg2.occ.type;
        const isOppositeSides = (leg1.side === 'short' || leg1.quantity < 0) !== (leg2.side === 'short' || leg2.quantity < 0);

        if (isSameType && isOppositeSides) {
          const longLeg = (leg1.side === 'long' || leg1.quantity > 0) ? leg1 : leg2;
          const shortLeg = (leg1.side === 'short' || leg1.quantity < 0) ? leg1 : leg2;

          if (longLeg.occ.type === 'PUT') {
            if (shortLeg.occ.strike > longLeg.occ.strike) {
              strategyName = "Put Credit Spread";
              strategyType = "credit_spread";
            } else {
              strategyName = "Bear Put Debit Spread";
              strategyType = "debit_spread";
            }
          } else { // CALL
            if (shortLeg.occ.strike < longLeg.occ.strike) {
              strategyName = "Call Credit Spread";
              strategyType = "credit_spread";
            } else {
              strategyName = "Bull Call Debit Spread";
              strategyType = "debit_spread";
            }
          }
        } else {
          strategyName = "Vertical Option Spread";
          strategyType = "debit_spread";
        }
      } else if (opts.length === 4) {
        // Iron Condor detection
        const puts = opts.filter(o => o.occ.type === 'PUT');
        const calls = opts.filter(o => o.occ.type === 'CALL');
        
        if (puts.length === 2 && calls.length === 2) {
          const putsShort = puts.some(o => o.side === 'short' || o.quantity < 0);
          const callsShort = calls.some(o => o.side === 'short' || o.quantity < 0);
          
          if (putsShort && callsShort) {
            strategyName = "Iron Condor";
            strategyType = "iron_condor";
          } else {
            strategyName = "4-Leg Spread";
            strategyType = "custom";
          }
        } else {
          strategyName = "4-Leg Strategy";
          strategyType = "custom";
        }
      } else {
        strategyName = `${opts.length}-Leg Strategy`;
        strategyType = "custom";
      }

      const legs = opts.map(opt => ({
        strike: opt.occ.strike,
        side: (opt.side?.toLowerCase() === 'short' || opt.quantity < 0) ? ('SELL' as const) : ('BUY' as const),
        type: opt.occ.type as ('CALL' | 'PUT'),
        premium: Math.abs(opt.entry_price || opt.current_price || 0),
        dte: opt.dte,
        iv: 25 // Default IV for now
      }));

      const rawUnderlyingPrice = stockPriceMap.get(underlying) || opts[0].underlying_price || 0;
      const isSuspiciousPrice = (rawUnderlyingPrice < 5 && underlying !== 'USO' && underlying !== 'UNG') || legs.some(l => Math.abs(l.premium - rawUnderlyingPrice) < 0.01);
      const finalUnderlyingPrice = isSuspiciousPrice ? 0 : rawUnderlyingPrice;

      groups.push({
        id: `mleg-${underlying}-${opts.map(o => o.id).sort().join('-')}`,
        symbol: underlying,
        strategy: strategyName,
        isSpread: true,
        market_value: totalMarketValue,
        unrealized_pl: totalPl,
        unrealized_plpc: avgPlpc,
        status: "OPEN",
        side: "MULTI",
        quantity: opts.length > 1 ? "1 Spread" : `${Math.abs(opts[0].quantity)} Contract(s)`,
        dte: minDte === 999 ? null : minDte,
        riskLevel: riskLevel,
        diagram_data: {
          underlying_price: finalUnderlyingPrice || (opts[0].symbol.length <= 6 ? opts[0].current_price : 0) || 0,
          strategy_type: strategyType,
          actual_pl: totalPl,
          total_quantity: Math.abs(opts[0].quantity),
          legs: legs
        },
        legDetails: opts,
        ai_rec: (opts.some(o => o.ai_rec?.action === 'CLOSE') && totalPl < -100)
          ? opts.find(o => o.ai_rec?.action === 'CLOSE')?.ai_rec 
          : opts[0].ai_rec
      });
    });
    
    
    let sortedGroups = [...groups];
    if (sortConfig !== null) {
      sortedGroups.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case 'symbol':
            aValue = a.symbol;
            bValue = b.symbol;
            break;
          case 'dte':
            aValue = a.dte ?? 9999;
            bValue = b.dte ?? 9999;
            break;
          case 'price':
            aValue = a.isSpread ? (a.legDetails[0].current_price || 0) : (a.current_price || 0);
            bValue = b.isSpread ? (b.legDetails[0].current_price || 0) : (b.current_price || 0);
            break;
          case 'quantity':
            aValue = typeof a.quantity === 'string' ? parseFloat(a.quantity) : a.quantity;
            bValue = typeof b.quantity === 'string' ? parseFloat(b.quantity) : b.quantity;
            break;
          case 'market_value':
            aValue = a.market_value || 0;
            bValue = b.market_value || 0;
            break;
          case 'unrealized_pl':
            aValue = a.unrealized_pl || 0;
            bValue = b.unrealized_pl || 0;
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          case 'ai_action':
            aValue = a.ai_rec?.action || '';
            bValue = b.ai_rec?.action || '';
            break;
          default:
            aValue = a[sortConfig.key];
            bValue = b[sortConfig.key];
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    } else {
      sortedGroups.sort((a,b) => (b.market_value || 0) - (a.market_value || 0));
    }
    
    return sortedGroups;
  };

  const getPortfolioLabels = () => {
    if (!history || !history.timestamp.length) return [];
    
    const labelCount = 5;
    const indices = [];
    for (let i = 0; i < labelCount; i++) {
      indices.push(Math.floor((i / (labelCount - 1)) * (history.timestamp.length - 1)));
    }
    
    return indices.map(idx => {
      const ts = history.timestamp[idx];
      const date = new Date(ts * 1000);
      
      if (portfolioPeriod === '1D') {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      } else if (portfolioPeriod === '1W' || portfolioPeriod === '1M') {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      } else {
        return date.toLocaleDateString([], { year: '2-digit', month: 'short' });
      }
    });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tradesRes, accountRes, historyRes, allTradesRes] = await Promise.all([
        fetch('http://localhost:8000/trades'),
        fetch('http://localhost:8000/account'),
        fetch(`http://localhost:8000/portfolio/history?period=${portfolioPeriod === 'All' ? 'all' : portfolioPeriod}`),
        fetch('http://localhost:8000/trades?status=all')
      ]);

      if (tradesRes.ok) setTrades(await tradesRes.json());
      if (accountRes.ok) setAccount(await accountRes.json());
      if (historyRes.ok) setHistory(await historyRes.json());
      if (allTradesRes.ok) {
        const all = await allTradesRes.json();
        setRecentOrders(all.filter((t: any) => t.status !== 'OPEN').slice(0, 10));
      }
    } catch (err) {
      setError('Failed to refresh data from Alpaca Paper Trading.');
    } finally {
      setLoading(false);
    }
  };

  const handlePortfolioMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!history || !history.equity.length) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const xInViewBox = (e.clientX - rect.left) * (1000 / rect.width);
    const index = Math.round((xInViewBox / 1000) * (history.equity.length - 1));
    const safeIndex = Math.max(0, Math.min(index, history.equity.length - 1));
    setPortfolioHoverData({ index: safeIndex, x: (safeIndex / (history.equity.length - 1)) * 1000 });
  };

  useEffect(() => {
    // Initial fetch
    fetchData();

    // Setup polling
    const interval = setInterval(() => {
      // Background fetch without full-page loading state
      const silentFetch = async () => {
        try {
          const [tradesRes, accountRes, historyRes, allTradesRes] = await Promise.all([
            fetch('http://localhost:8000/trades'),
            fetch('http://localhost:8000/account'),
            fetch(`http://localhost:8000/portfolio/history?period=${portfolioPeriod === 'All' ? 'all' : portfolioPeriod}`),
            fetch('http://localhost:8000/trades?status=all')
          ]);

          if (tradesRes.ok) setTrades(await tradesRes.json());
          if (accountRes.ok) setAccount(await accountRes.json());
          if (historyRes.ok) setHistory(await historyRes.json());
          if (allTradesRes.ok) {
            const all = await allTradesRes.json();
            setRecentOrders(all.filter((t: any) => t.status !== 'OPEN').slice(0, 10));
          }
          setError(null);
        } catch (err) {
          console.error("Silent background refresh failed", err);
        }
      };
      silentFetch();
    }, 30000); 

    return () => clearInterval(interval);
  }, [portfolioPeriod]);

  const handleClosePosition = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:8000/trades/${id}/close`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) return { success: false, message: data.detail || 'Closure failed' };
      return { success: true };
    } catch (error: any) {
      console.error('Error closing position:', error);
      return { success: false, message: error.message || 'Network error' };
    }
  };

  const handleTradeSuccess = async (symbol: string) => {
    setActiveTab('portfolio');
    setHighlightedSymbol(symbol);
    
    // Poll for up to 10 seconds for the new position to appear
    for (let i = 0; i < 10; i++) {
      await fetchData();
      // Check if it's in the current trades
      const currentTrades = await (await fetch('http://localhost:8000/trades')).json();
      if (currentTrades.some((t: any) => {
        if (t.symbol === symbol) return true;
        // Check if it's an OCC symbol for this underlying
        const occ = parseOCC(t.symbol);
        return occ && occ.underlying === symbol;
      })) {
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    
    // Clear highlight after 10 seconds
    setTimeout(() => setHighlightedSymbol(null), 10000);
  };

  const handleCancelOrder = async (orderId: string) => {
    setCancellingId(orderId);
    setCancelConfirmId(null);
    try {
      const response = await fetch(`http://localhost:8000/trades/${orderId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        // Optimistically update local state immediately so the row shows CANCELED
        // before Alpaca's GET /orders reflects the change (there's a brief race condition)
        setRecentOrders(prev => prev.map(o =>
          o.id === orderId ? { ...o, status: 'CANCELED' } : o
        ));
        // Background sync - don't await so CANCELED badge stays visible
        fetchData();
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to cancel order');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setCancellingId(null);
    }
  };

  const handleUpdateOrderPrice = async (orderId: string, quantity: number, limitPrice: number) => {
    try {
      const resp = await fetch(`http://localhost:8000/trades/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          limit_price: limitPrice,
          quantity: quantity
        })
      });
      
      if (!resp.ok) {
        const errorData = await resp.json();
        throw new Error(errorData.detail || 'Failed to update order');
      }
      
      setEditingOrder(null);
      fetchData();
      return await resp.json();
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };



  return (
    <div className="min-h-screen bg-black text-gray-200 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/10 blur-[120px] rounded-full" />
      </div>

      {error && (
        <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-right-8 fade-in">
          <div className="bg-rose-500/10 border border-rose-500/20 backdrop-blur-md text-rose-400 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-2xl shadow-rose-500/10">
            <AlertCircle className="w-5 h-5" />
            <span className="font-bold text-sm tracking-tight">{error}</span>
            <button onClick={() => setError(null)} className="ml-4 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {loading && activeTab === 'portfolio' && !account && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <div className="text-gray-400 font-bold text-sm animate-pulse">Syncing with Alpaca Markets...</div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-blue-500/20 border border-white/10">
              <Activity className="text-white w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white mb-1">
                AI Options <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Trader</span>
              </h1>
              <div className="text-xs font-semibold text-gray-500 tracking-widest uppercase">Intelligent Market Analysis</div>
            </div>
          </div>
          
          <div className="flex-1 max-w-md mx-8 hidden lg:block">
            <Omnisearch onSelect={(s) => setSearchedSymbol(s)} />
          </div>
          
          <nav className="flex items-center gap-2 bg-gray-900/50 p-1.5 rounded-2xl border border-gray-800 backdrop-blur-md w-full sm:w-auto">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <div className="flex items-center justify-center gap-2"><LayoutDashboard className="w-4 h-4" /> Dashboard</div>
            </button>
            <button 
              onClick={() => setActiveTab('news')}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'news' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <div className="flex items-center justify-center gap-2"><Newspaper className="w-4 h-4" /> Catalysts</div>
            </button>
            <button 
              onClick={() => setActiveTab('portfolio')}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'portfolio' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <div className="flex items-center justify-center gap-2"><Briefcase className="w-4 h-4" /> Portfolio</div>
            </button>
          </nav>
        </header>

        {activeTab === 'dashboard' && (
          <main className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            <div className="lg:col-span-1 flex flex-col gap-8">
              <MarketHealth />
            </div>
            
            <div className="lg:col-span-2">
              <ETFScanner onSelect={(s: string) => setSelectedSymbol(s)} />
            </div>

            {selectedSymbol && (
              <div className="lg:col-span-3 animate-in fade-in slide-in-from-top-4 duration-500">
                <SymbolChart 
                  symbol={selectedSymbol} 
                  onClose={() => setSelectedSymbol(null)} 
                  onAnalyze={() => setSearchedSymbol(selectedSymbol)}
                />
              </div>
            )}

            <div className="lg:col-span-3">
              <Recommendations onAnalyze={setSearchedSymbol} onTradeSuccess={handleTradeSuccess} />
            </div>
          </main>
        )}

        {activeTab === 'news' && (
          <main className="animate-in fade-in slide-in-from-bottom-4">
            <NewsFeed 
              portfolioSymbols={portfolioSymbols}
              onAnalyze={(item) => setAnalyzingNews(item)}
            />
          </main>
        )}

        {activeTab === 'portfolio' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {/* Account Overview Card */}
            <div className="bg-gray-900/40 border border-gray-800 rounded-2xl overflow-hidden backdrop-blur-sm">
              <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950/20">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-blue-400" />
                    Your Portfolio
                  </h2>
                  <div className="flex items-baseline gap-3 mt-2">
                    <span className="text-3xl font-mono font-bold">$ {account?.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</span>
                    <span className={`text-sm font-bold flex items-center gap-1 ${account?.day_change! >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {account?.day_change! >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {account?.day_change! >= 0 ? '+' : ''}{account?.day_change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({account?.day_change_percent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {['1D', '1W', '1M', 'All'].map(p => (
                    <button 
                      key={p} 
                      onClick={() => setPortfolioPeriod(p)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${portfolioPeriod === p ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Portfolio Chart */}
              <div className="p-6 bg-gradient-to-b from-transparent to-blue-500/5">
                <div className="h-64 relative">
                  {history && history.equity.length > 0 ? (
                    <div className="h-full w-full flex flex-col">
                      <div className="flex-1 relative">
                        <svg 
                          className="w-full h-full cursor-crosshair" 
                          viewBox="0 0 1000 100" 
                          preserveAspectRatio="none"
                          onMouseMove={handlePortfolioMouseMove}
                          onMouseLeave={() => setPortfolioHoverData(null)}
                        >
                          <defs>
                            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          
                          {/* Vertical Grid Lines */}
                          {[0, 0.25, 0.5, 0.75, 1].map(pct => (
                            <line 
                              key={pct} 
                              x1={pct * 1000} y1="0" x2={pct * 1000} y2="100" 
                              stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" 
                            />
                          ))}

                          <path 
                            d={`M ${history.equity.map((e, i) => `${(i / (history.equity.length - 1)) * 1000},${100 - ((e - Math.min(...history.equity)) / (Math.max(...history.equity) - Math.min(...history.equity) || 1)) * 80 - 10}`).join(' L ')}`}
                            fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
                          />
                          <path 
                            d={`M 0,100 L ${history.equity.map((e, i) => `${(i / (history.equity.length - 1)) * 1000},${100 - ((e - Math.min(...history.equity)) / (Math.max(...history.equity) - Math.min(...history.equity) || 1)) * 80 - 10}`).join(' L ')} L 1000,100 Z`}
                            fill="url(#chartGradient)"
                          />

                          {/* Hover Elements */}
                          {portfolioHoverData && (
                            <g>
                              <line 
                                x1={portfolioHoverData.x} y1="0" x2={portfolioHoverData.x} y2="100" 
                                stroke="#3b82f6" strokeWidth="2" strokeOpacity="0.3" 
                              />
                              <circle 
                                cx={portfolioHoverData.x} 
                                cy={100 - ((history.equity[portfolioHoverData.index] - Math.min(...history.equity)) / (Math.max(...history.equity) - Math.min(...history.equity) || 1)) * 80 - 10} 
                                r="4" fill="#3b82f6" stroke="#fff" strokeWidth="1.5" 
                              />
                            </g>
                          )}
                        </svg>

                        {/* Hover Tooltip */}
                        {portfolioHoverData && (
                          <div 
                            className="absolute z-20 pointer-events-none bg-gray-900 border border-gray-800 p-2 rounded-lg shadow-2xl flex flex-col gap-1 -translate-y-full mb-12"
                            style={{ 
                              left: `${(portfolioHoverData.x / 1000) * 100}%`,
                              bottom: `${((100 - ((history.equity[portfolioHoverData.index] - Math.min(...history.equity)) / (Math.max(...history.equity) - Math.min(...history.equity) || 1)) * 80 - 10) / 100) * 100}%`,
                              transform: `translate(${portfolioHoverData.x > 800 ? '-100%' : portfolioHoverData.x < 200 ? '0%' : '-50%'}, -20px)`
                            }}
                          >
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest whitespace-nowrap">
                              {new Date(history.timestamp[portfolioHoverData.index] * 1000).toLocaleString()}
                            </div>
                            <div className="text-sm font-mono font-bold text-white whitespace-nowrap">
                              $ {history.equity[portfolioHoverData.index].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className={`text-[10px] font-bold ${history.profit_loss[portfolioHoverData.index] >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {history.profit_loss[portfolioHoverData.index] >= 0 ? '+' : ''}
                              $ {history.profit_loss[portfolioHoverData.index].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
                              ({history.profit_loss_pct[portfolioHoverData.index].toFixed(2)}%)
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* X-Axis Labels */}
                      <div className="flex justify-between mt-4 px-1">
                        {getPortfolioLabels().map((label, i) => (
                          <div key={i} className="flex flex-col items-center">
                            <div className="w-[1px] h-1 bg-gray-800 mb-1" />
                            <span className="text-[10px] font-mono font-bold text-gray-600 tracking-tighter">{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-gray-700 italic border border-dashed border-gray-800 rounded-xl">
                      Gathering historical benchmarks...
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Balances Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Buying Power', value: account?.buying_power || 0, icon: <Zap className="w-4 h-4 text-yellow-500" /> },
                { label: 'Cash', value: account?.cash || 0, icon: <Wallet className="w-4 h-4 text-emerald-500" /> },
                { label: 'Market Value', value: account?.long_market_value || 0, icon: <Activity className="w-4 h-4 text-blue-500" /> }
              ].map((stat, i) => (
                <div key={i} className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">{stat.label}</span>
                    <div className="p-2 bg-gray-800/50 rounded-lg">{stat.icon}</div>
                  </div>
                  <div className="text-2xl font-mono font-bold text-white">
                    $ {stat.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
            </div>

            {/* Top Positions Section */}
            <div className="bg-gray-900/40 border border-gray-800 rounded-2xl overflow-hidden backdrop-blur-sm">
              <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950/20">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <LayoutDashboard className="w-5 h-5 text-emerald-400" />
                  Top Positions
                </h2>
                {trades.filter(t => t.status === 'OPEN').length > 0 && (
                  <button 
                    onClick={async () => {
                      const openCount = trades.filter(t => t.status === 'OPEN').length;
                      if (window.confirm(`⚠️ LIQUIDATE ALL POSITIONS?\n\nAre you sure you want to close ALL ${openCount} open positions? This will submit immediate market orders to exit your entire portfolio.`)) {
                        await fetch('http://localhost:8000/trades', { method: 'DELETE' });
                        fetchData();
                      }
                    }}
                    className="bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 text-rose-400 hover:text-white px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
                  >
                    Liquidate All
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-800 bg-black/20 text-gray-500 text-xs font-bold uppercase tracking-widest">
                      {[
                        { label: 'Asset', key: 'symbol' },
                        { label: 'Exp / DTE', key: 'dte' },
                        { label: 'Price', key: 'price' },
                        { label: 'Qty', key: 'quantity' },
                        { label: 'Market Value', key: 'market_value' },
                        { label: 'Total P/L ($)', key: 'unrealized_pl' },
                        { label: 'Status', key: 'status' },
                        { label: 'AI Action', key: 'ai_action' }
                      ].map((col) => (
                        <th 
                          key={col.key} 
                          className="py-4 px-6 font-semibold cursor-pointer hover:text-white transition-colors group"
                          onClick={() => handleRequestSort(col.key)}
                        >
                          <div className="flex items-center gap-1">
                            {col.label}
                            <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                              <ChevronUp className={`w-2.5 h-2.5 -mb-1 ${sortConfig?.key === col.key && sortConfig.direction === 'asc' ? 'text-blue-400 opacity-100' : 'opacity-40'}`} />
                              <ChevronDown className={`w-2.5 h-2.5 ${sortConfig?.key === col.key && sortConfig.direction === 'desc' ? 'text-blue-400 opacity-100' : 'opacity-40'}`} />
                            </div>
                          </div>
                        </th>
                      ))}
                      <th className="py-4 px-6 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {groupOpenTrades().length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-20 text-center text-gray-600 font-medium italic">
                           No open positions. Place some trades to see this table populate.
                        </td>
                      </tr>
                    ) : (
                      groupOpenTrades().map((t: any) => (
                        <Fragment key={t.id}>
                          <tr 
                            onClick={t.diagram_data ? () => setExpandedOptionId(expandedOptionId === t.id ? null : t.id) : undefined}
                            className={`hover:bg-gray-800/30 transition-all group ${t.diagram_data ? 'cursor-pointer' : ''} ${highlightedSymbol === t.symbol ? 'bg-blue-500/10 border-l-2 border-blue-500 animate-pulse' : ''}`}
                          >
                            <td className="py-5 px-6">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-200 group-hover:text-blue-400 transition-colors">{t.symbol}</span>
                                {t.riskLevel === 'critical' && (
                                  <div className="group/risk relative">
                                    <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse cursor-help" />
                                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover/risk:block z-50 w-64 bg-gray-900 border border-rose-500/50 p-3 rounded-xl shadow-2xl backdrop-blur-md">
                                       <div className="text-rose-400 text-xs font-bold mb-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> CRITICAL RISK</div>
                                       <div className="text-gray-300 text-[10px] leading-relaxed">Underwater position expiring in {t.dte} days. High Gamma/Assignment risk. <b>Recommendation:</b> Roll out to next month or liquidate to preserve capital.</div>
                                    </div>
                                  </div>
                                )}
                                {t.riskLevel === 'warning' && (
                                  <div className="group/risk relative">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 cursor-help" />
                                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover/risk:block z-50 w-64 bg-gray-900 border border-amber-500/50 p-3 rounded-xl shadow-2xl backdrop-blur-md">
                                       <div className="text-amber-400 text-xs font-bold mb-1 flex items-center gap-1"><Info className="w-3 h-3" /> EXPOSURE ALERT</div>
                                       <div className="text-gray-300 text-[10px] leading-relaxed">Expiration approaching ({t.dte} days). Check if you need to roll to avoid theta acceleration.</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{t.strategy} {t.side !== 'MULTI' ? t.side : ''}</div>
                            </td>
                            <td className="py-5 px-6">
                               {t.dte !== null ? (
                                 <div className="flex flex-col">
                                   <span className="text-xs font-mono text-gray-300">
                                     {parseOCC(t.isSpread ? t.legDetails[0].symbol : t.symbol)?.expiration}
                                   </span>
                                   <span className={`text-[10px] font-bold ${t.dte <= 3 ? 'text-rose-400' : t.dte <= 7 ? 'text-amber-400' : 'text-gray-500'}`}>
                                     {t.dte} Days Left
                                   </span>
                                 </div>
                               ) : (
                                 <span className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">—</span>
                               )}
                            </td>
                            <td className="py-5 px-6 font-mono text-gray-400">
                              {t.isSpread ? '—' : `$ ${(t.current_price || 0).toFixed(2)}`}
                            </td>
                            <td className="py-5 px-6 font-mono text-gray-400">{t.quantity}</td>
                            <td className="py-5 px-6 font-mono text-gray-200 font-bold">$ {(t.market_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className={`py-5 px-6 font-mono font-bold ${t.unrealized_pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {t.unrealized_pl >= 0 ? '+' : ''}{t.unrealized_pl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              <div className="text-[10px] font-medium opacity-80">({t.unrealized_plpc.toFixed(2)}%)</div>
                            </td>
                            <td className="py-5 px-6">
                              <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {t.status}
                              </span>
                            </td>
                            <td className="py-5 px-6">
                              {t.ai_rec ? (
                                <div 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedActionRec({ trade: t, rec: t.ai_rec });
                                  }}
                                  className={`group/ai relative cursor-pointer px-3 py-1.5 rounded-xl border flex items-center gap-2 transition-all hover:scale-105 active:scale-95 ${
                                    t.ai_rec.action === 'CLOSE' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-lg shadow-rose-500/10' :
                                    t.ai_rec.action === 'ROLL' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/10' :
                                    'bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-lg shadow-blue-500/10'
                                  }`}
                                >
                                  <Zap className={`w-3 h-3 ${t.ai_rec.action === 'CLOSE' ? 'animate-pulse' : ''}`} />
                                  <span className="text-[10px] font-black tracking-widest uppercase">{t.ai_rec.action}</span>
                                  
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/ai:block z-[60] w-48 bg-gray-950 border border-white/10 p-3 rounded-xl shadow-2xl backdrop-blur-xl">
                                     <div className="text-[10px] font-bold text-gray-400 mb-1">AI Rationale</div>
                                     <p className="text-[10px] leading-tight text-white/90">{t.ai_rec.rationale}</p>
                                     <div className="mt-2 text-[9px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1 text-center">
                                       Click for details <Clock className="w-2 h-2" />
                                     </div>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">Evaluating...</span>
                              )}
                            </td>
                            <td className="py-5 px-6 text-right">
                              <div className="flex gap-2 justify-end">
                                <button 
                                  onClick={async (e) => { 
                                    e.stopPropagation();
                                    if (!window.confirm(`⚠️ CLOSE POSITION?\n\nAre you sure you want to exit your ${t.symbol} ${t.strategy} position?`)) return;
                                    
                                    const btn = e.currentTarget;
                                    const originalText = btn.innerText;
                                    btn.disabled = true;
                                    btn.innerText = "Closing...";
                                    setError(null);
                                    
                                    try {
                                      if (t.isSpread) {
                                        for (const leg of t.legDetails) {
                                          const result = await handleClosePosition(leg.id);
                                          if (!result.success) {
                                            setError(result.message);
                                            break;
                                          }
                                        }
                                      } else {
                                        const result = await handleClosePosition(t.id);
                                        if (!result.success) setError(result.message);
                                      }
                                    } finally {
                                      btn.disabled = false;
                                      btn.innerText = originalText;
                                      fetchData();
                                    }
                                  }} 
                                  className="px-4 py-1.5 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 text-rose-400 hover:text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Close
                                </button>
                              </div>
                            </td>
                          </tr>
                          {t.diagram_data && expandedOptionId === t.id && (
                            <tr className="bg-gray-900/50 border-t border-b border-gray-800/50 shadow-inner">
                              <td colSpan={7} className="p-6">
                                <div className="animate-in fade-in slide-in-from-top-4 duration-500 origin-top">
                                  <div className="mb-4 flex flex-col gap-2">
                                    <h4 className="text-sm font-bold text-gray-300">Leg Details:</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                                      {t.legDetails.map((l:any) => (
                                        <div key={l.id} className="bg-gray-800/50 p-3 rounded-xl border border-gray-700/50 text-xs font-mono">
                                          <div className="text-gray-400 mb-1">{l.symbol}</div>
                                          <div className="flex justify-between items-center">
                                            <span className={(l.side?.toLowerCase() === 'long' || l.side?.toLowerCase() === 'buy') ? "text-emerald-400" : "text-orange-400"}>
                                              {(l.side?.toLowerCase() === 'long' || l.side?.toLowerCase() === 'buy') ? "LONG" : "SHORT"} {Math.abs(l.quantity)}
                                            </span>
                                            <div className="flex flex-col items-end">
                                              <span className="text-gray-300">${Math.abs(l.current_price).toFixed(2)}</span>
                                              <span className="text-[9px] text-gray-500">Exp: {parseOCC(l.symbol)?.expiration}</span>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <StrategyPayoff data={t.diagram_data} />
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Orders Section */}
            <div className="bg-gray-900/40 border border-gray-800 rounded-2xl overflow-hidden backdrop-blur-sm">
              <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950/20">
                <h2 className="text-xl font-bold flex items-center gap-2 text-gray-400">
                  <Clock className="w-5 h-5" />
                  Recent Orders
                </h2>
                <button onClick={fetchData} className="p-2 text-gray-500 hover:text-white transition-colors"><RefreshCw className="w-4 h-4" /></button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-800 bg-black/20 text-gray-500 text-xs font-bold uppercase tracking-widest">
                      <th className="py-4 px-6 font-semibold">Asset</th>
                      <th className="py-4 px-6 font-semibold">Type</th>
                      <th className="py-4 px-6 font-semibold">Side</th>
                      <th className="py-4 px-6 font-semibold">Qty</th>
                      <th className="py-4 px-6 font-semibold">Avg. Fill Price</th>
                      <th className="py-4 px-6 font-semibold">Status</th>
                      <th className="py-4 px-6 font-semibold">Submitted At</th>
                      <th className="py-4 px-6 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {recentOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-600 italic">No recent order history</td>
                      </tr>
                    ) : (
                      recentOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-gray-800/20 transition-colors">
                          <td className="py-4 px-6 text-gray-200 font-bold">{o.symbol}</td>
                          <td className="py-4 px-6 text-xs text-gray-400 font-bold uppercase">{o.strategy}</td>
                          <td className={`py-4 px-6 text-xs font-bold uppercase ${o.side === 'buy' || o.side === 'long' ? 'text-emerald-400' : 'text-orange-400'}`}>{o.side}</td>
                          <td className="py-4 px-6 font-mono text-gray-400 text-sm">{o.quantity}</td>
                          <td className={`py-4 px-6 font-mono text-sm font-bold ${o.entry_price < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            $ {Math.abs(o.entry_price || 0).toFixed(2)}
                            {o.entry_price < 0 && <span className="ml-1 text-[8px] opacity-70 uppercase">Credit</span>}
                          </td>
                          <td className="py-4 px-6">
                            {cancellingId === o.id ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold tracking-widest bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                                CANCELLING
                              </span>
                            ) : (
                              <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold tracking-widest ${
                                o.status === 'FILLED' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                                o.status === 'CANCELED' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' : 
                                'bg-gray-800 text-gray-400'
                              }`}>
                                {o.status}
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-[10px] text-gray-500 font-mono">{new Date(o.opened_at).toLocaleString()}</td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex gap-2 justify-end">
                  {o.status === 'PENDING' && cancellingId !== o.id && (
                <>
                  <button 
                    onClick={() => setEditingOrder(o)}
                    className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                    title="Update Price"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  {cancelConfirmId === o.id ? (
                    <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-2">
                      <span className="text-[9px] font-bold text-rose-400 uppercase tracking-widest">Cancel?</span>
                      <button
                        onClick={() => handleCancelOrder(o.id)}
                        disabled={cancellingId === o.id}
                        className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-rose-500 hover:bg-rose-400 text-white rounded-md transition-colors disabled:opacity-60"
                      >
                        {cancellingId === o.id ? '...' : 'Yes'}
                      </button>
                      <button
                        onClick={() => setCancelConfirmId(null)}
                        className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setCancelConfirmId(o.id)}
                      className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Cancel Order"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
                              {(o.status === 'CANCELED' || o.status === 'REJECTED') && o.legs && (
                                <button 
                                  onClick={() => {
                                    const rec: any = {
                                      symbol: o.symbol,
                                      strategy: o.strategy,
                                      side: o.side,
                                      thesis: "Retrying previous order",
                                      expiration: o.legs && o.legs[0] ? parseOCC(o.legs[0].symbol)?.expiration || "" : "",
                                      target_entry: `$${(o.entry_price || 0).toFixed(2)}`,
                                      pop: "N/A",
                                      risk_reward: "N/A",
                                      confidence: "100",
                                      diagram_data: {
                                        underlying_price: o.underlying_price || 0,
                                        strategy_type: o.strategy,
                                        legs: o.legs || []
                                      }
                                    };
                                    setRetryTrade(rec);
                                  }}
                                  className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                  title="Retry Order"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {searchedSymbol && (
        <SymbolAnalysis 
          symbol={searchedSymbol} 
          onClose={() => setSearchedSymbol(null)} 
        />
      )}

      {/* AI Action Confirmation Modal */}
      {selectedActionRec && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 lg:p-8 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setSelectedActionRec(null)} />
          <div className="relative w-full max-w-lg bg-gray-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            {/* Modal Header */}
            <div className={`p-6 border-b border-white/5 flex justify-between items-center ${
              selectedActionRec.rec.action === 'CLOSE' ? 'bg-rose-500/5' :
              selectedActionRec.rec.action === 'ROLL' ? 'bg-amber-500/5' :
              'bg-blue-500/5'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                  selectedActionRec.rec.action === 'CLOSE' ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' :
                  selectedActionRec.rec.action === 'ROLL' ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' :
                  'bg-blue-500/20 border-blue-500/30 text-blue-400'
                }`}>
                  <Zap className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">AI Recommendation: {selectedActionRec.rec.action}</h3>
                  <div className="flex items-center gap-3 mt-0.5">
                    <div className="text-xs text-gray-500 font-medium">Position: <span className="text-gray-300">{selectedActionRec.trade.symbol}</span> | Confidence: <span className="text-emerald-400">{selectedActionRec.rec.confidence}%</span></div>
                    {selectedActionRec.rec.model && (
                      <div className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[8px] font-black text-gray-500 uppercase tracking-widest leading-none">
                        {selectedActionRec.rec.model}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedActionRec(null)}
                className="p-2 hover:bg-white/5 rounded-full transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8 space-y-6">
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-gray-500">The Rationale</h4>
                <p className="text-white text-sm leading-relaxed font-medium">
                  {selectedActionRec.rec.rationale}
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-gray-500">Key Considerations</h4>
                <ul className="space-y-3">
                  {selectedActionRec.rec.details.map((detail, i) => (
                    <li key={i} className="flex items-start gap-3 group">
                      <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 group-hover:scale-125 transition-transform" />
                      <span className="text-xs text-gray-300 leading-normal">{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Preview */}
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Current P/L</div>
                  <div className={`text-lg font-mono font-bold ${selectedActionRec.trade.unrealized_pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {selectedActionRec.trade.unrealized_pl >= 0 ? '+' : ''}${selectedActionRec.trade.unrealized_pl.toLocaleString()}
                  </div>
                </div>
                <div className="text-center px-4">
                  <RefreshCw className="w-5 h-5 text-gray-700 mx-auto" />
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">AI {selectedActionRec.rec.action} Target</div>
                  <div className="text-xs font-bold text-white uppercase tracking-tight">
                    {selectedActionRec.rec.action === 'CLOSE' ? 'Exit at Net Mkt' : 
                     selectedActionRec.rec.action === 'ROLL' ? 'Extend Exp +30D' : 
                     'Maintain Stop/Limit'}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-white/5 border-t border-white/5 flex gap-3">
              <button 
                onClick={() => setSelectedActionRec(null)}
                className="flex-1 px-6 py-3 rounded-2xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all"
              >
                Re-evaluate Later
              </button>
              <button 
                onClick={async () => {
                  const t = selectedActionRec.trade;
                  // Handle execution logic...
                  if (selectedActionRec.rec.action === 'CLOSE') {
                    if (t.isSpread) {
                      for (const leg of t.legDetails) {
                        await handleClosePosition(leg.id);
                      }
                    } else {
                      await handleClosePosition(t.id);
                    }
                  } else {
                    // Logic for Roll or Hold updates
                    console.log("Executing", selectedActionRec.rec.action);
                  }
                  setSelectedActionRec(null);
                  fetchData();
                }}
                className={`flex-1 px-6 py-3 rounded-2xl text-sm font-bold text-white transition-all shadow-xl ${
                  selectedActionRec.rec.action === 'CLOSE' ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20' :
                  selectedActionRec.rec.action === 'ROLL' ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20' :
                  'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                }`}
              >
                Execute {selectedActionRec.rec.action}
              </button>
            </div>
          </div>
        </div>
      )}

      <NewsAnalysisModal
        isOpen={!!analyzingNews}
        onClose={() => setAnalyzingNews(null)}
        headline={analyzingNews?.headline || ''}
        summary={analyzingNews?.summary || ''}
        portfolioPositions={portfolioSymbols}
      />
      {retryTrade && (
        <TradeConfirmationModal
          isOpen={!!retryTrade}
          onClose={() => setRetryTrade(null)}
          onConfirm={async (tradeData, qty, limitPrice) => {
            const resp = await fetch('http://localhost:8000/trades', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                symbol: tradeData.symbol,
                strategy: tradeData.strategy,
                entry_price: limitPrice ?? (parseFloat(tradeData.target_entry.replace('$', '')) || 0),
                quantity: qty,
                legs: tradeData.diagram_data.legs
              })
            });
            if (!resp.ok) throw new Error((await resp.json()).detail || 'Failed to retry order');
            return await resp.json();
          }}
          trade={retryTrade}
        />
      )}

      {editingOrder && (
        <TradeConfirmationModal
          isOpen={!!editingOrder}
          mode="update"
          onClose={() => setEditingOrder(null)}
          onConfirm={async (_tradeData, qty, limitPrice) => {
            return await handleUpdateOrderPrice(editingOrder.id, qty, limitPrice || 0);
          }}
          trade={{
            symbol: editingOrder.symbol,
            strategy: editingOrder.strategy,
            side: editingOrder.side,
            thesis: "Updating existing order price/quantity",
            expiration: editingOrder.legs && editingOrder.legs[0] ? parseOCC(editingOrder.legs[0].symbol)?.expiration || "" : "",
            target_entry: `$${(editingOrder.entry_price || 0).toFixed(2)}`,
            entry_price: editingOrder.entry_price,
            pop: "N/A",
            risk_reward: "N/A",
            confidence: "100",
            quantity: editingOrder.quantity,
            diagram_data: {
              underlying_price: editingOrder.underlying_price || 0,
              strategy_type: editingOrder.strategy,
              legs: editingOrder.legs || []
            }
          } as any}
        />
      )}

      <DebugHUD isOpen={isDebugOpen} onClose={() => setIsDebugOpen(false)} />

      {/* Floating Debug Toggle */}
      <button 
        onClick={() => setIsDebugOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gray-900 border border-white/10 rounded-full flex items-center justify-center shadow-2xl hover:bg-gray-800 transition-all hover:scale-110 active:scale-95 group z-[150]"
        title="Open System HUD"
      >
        <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/20 transition-all" />
        <Bug className="w-6 h-6 text-blue-400 group-hover:text-blue-300 relative z-10" />
      </button>
    </div>
  );
}

export default App;
