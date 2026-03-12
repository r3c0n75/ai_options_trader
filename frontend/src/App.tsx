import { useState, useEffect, Fragment } from 'react';
import { MarketHealth } from './components/MarketHealth';
import { Recommendations } from './components/Recommendations';
import { ETFScanner } from './components/ETFScanner';
import { NewsFeed } from './components/NewsFeed';
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
  Clock
} from 'lucide-react';
import { Omnisearch } from './components/Omnisearch';
import { SymbolAnalysis } from './components/SymbolAnalysis';

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
  status: string;
  side: string;
  opened_at: string;
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
  const [searchedSymbol, setSearchedSymbol] = useState<string | null>(null);
  const [portfolioPeriod, setPortfolioPeriod] = useState<string>('1D');
  const [portfolioHoverData, setPortfolioHoverData] = useState<{ index: number; x: number } | null>(null);

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
  const groupOpenTrades = () => {
    const openTrades = trades.filter(t => t.status === 'OPEN');
    const groups: any[] = [];
    const optionsByUnderlying = new Map<string, any[]>();

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

    openTrades.forEach(t => {
      const occ = parseOCC(t.symbol);
      const dte = calculateDTE(t.symbol);
      
      if (occ) {
        if (!optionsByUnderlying.has(occ.underlying)) optionsByUnderlying.set(occ.underlying, []);
        optionsByUnderlying.get(occ.underlying)!.push({ ...t, dte });
      } else {
        groups.push({...t, 
          isSpread: false,
          dte: null,
          riskLevel: 'none',
          legDetails: [t],
          diagram_data: {
            underlying_price: t.current_price || t.entry_price,
            strategy_type: "long_stock",
            legs: [{
              strike: t.entry_price || t.current_price,
              side: (t.side?.toLowerCase() === 'short' || t.side?.toLowerCase() === 'sell') ? 'SELL' : 'BUY',
              type: 'STOCK',
              premium: t.entry_price || t.current_price
            }]
          }
        });
      }
    });
    
    optionsByUnderlying.forEach((options, underlying) => {
      const totalMarketValue = options.reduce((sum, opt) => sum + opt.market_value, 0);
      const totalPl = options.reduce((sum, opt) => sum + opt.unrealized_pl, 0);
      const avgPlpc = options.reduce((sum, opt) => sum + opt.unrealized_plpc, 0) / options.length;
      
      // Calculate min DTE for the strategy
      const minDte = Math.min(...options.map(o => (o as any).dte ?? 999));
      const riskLevel = getRiskLevel(minDte === 999 ? null : minDte, avgPlpc);

      let strategyName = `${options.length}-Leg Strategy`;
      let strategyType = "custom";
      if (options.length === 1) strategyName = `Long ${parseOCC(options[0].symbol)?.type}`;
      if (options.length === 2) {
         strategyName = "Vertical Option Spread";
         strategyType = "debit_spread";
      }
      if (options.length === 4) {
          strategyName = "Iron Condor";
          strategyType = "iron_condor";
      }
      
      const strikes = options.map(o => parseOCC(o.symbol)?.strike || 0);
      const approxUnderlying = strikes.reduce((a,b)=>a+b,0) / strikes.length;

      const legs = options.map(opt => {
         const occ = parseOCC(opt.symbol)!;
         return {
           strike: occ.strike,
           side: opt.quantity > 0 ? ('BUY' as const) : ('SELL' as const),
           type: occ.type as ('CALL' | 'PUT'),
           premium: opt.entry_price || Math.abs(opt.current_price) 
         };
      });

      groups.push({
        id: `mleg-${underlying}`,
        symbol: underlying,
        strategy: strategyName,
        isSpread: true,
        current_price: 0,
        market_value: totalMarketValue,
        unrealized_pl: totalPl,
        unrealized_plpc: avgPlpc,
        status: "OPEN",
        side: "MULTI",
        quantity: "1 Spread",
        dte: minDte === 999 ? null : minDte,
        riskLevel: riskLevel,
        diagram_data: {
          underlying_price: approxUnderlying,
          strategy_type: strategyType,
          legs: legs
        },
        legDetails: options
      });
    });
    
    return groups.sort((a,b) => b.market_value - a.market_value);
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
    fetchData();
  }, [portfolioPeriod]);

  useEffect(() => {
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
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
              <Recommendations />
            </div>
          </main>
        )}

        {activeTab === 'news' && (
          <main className="animate-in fade-in slide-in-from-bottom-4">
            <NewsFeed />
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
                      await fetch('http://localhost:8000/trades', { method: 'DELETE' });
                      fetchData();
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
                      <th className="py-4 px-6 font-semibold">Asset</th>
                      <th className="py-4 px-6 font-semibold">Exp / DTE</th>
                      <th className="py-4 px-6 font-semibold">Price</th>
                      <th className="py-4 px-6 font-semibold">Qty</th>
                      <th className="py-4 px-6 font-semibold">Market Value</th>
                      <th className="py-4 px-6 font-semibold">Total P/L ($)</th>
                      <th className="py-4 px-6 font-semibold">Status</th>
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
                            className={`hover:bg-gray-800/30 transition-colors group ${t.diagram_data ? 'cursor-pointer' : ''}`}
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
                            <td className="py-5 px-6 text-right">
                              <div className="flex gap-2 justify-end">
                                <button 
                                  onClick={async (e) => { 
                                    e.stopPropagation();
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
                                            <span className={l.quantity > 0 ? "text-emerald-400" : "text-orange-400"}>
                                              {l.quantity > 0 ? "LONG" : "SHORT"} {Math.abs(l.quantity)}
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
                      <th className="py-4 px-6 font-semibold text-right">Submitted At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {recentOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-600 italic">No recent order history</td>
                      </tr>
                    ) : (
                      recentOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-gray-800/20 transition-colors">
                          <td className="py-4 px-6 text-gray-200 font-bold">{o.symbol}</td>
                          <td className="py-4 px-6 text-xs text-gray-400 font-bold uppercase">{o.strategy}</td>
                          <td className={`py-4 px-6 text-xs font-bold uppercase ${o.side === 'buy' ? 'text-emerald-400' : 'text-orange-400'}`}>{o.side}</td>
                          <td className="py-4 px-6 font-mono text-gray-400 text-sm">{o.quantity}</td>
                          <td className="py-4 px-6 font-mono text-gray-400 text-sm">$ {o.entry_price.toFixed(2)}</td>
                          <td className="py-4 px-6">
                            <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold tracking-widest ${
                              o.status === 'FILLED' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                              o.status === 'CANCELED' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' : 
                              'bg-gray-800 text-gray-400'
                            }`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-[10px] text-gray-500 font-mono text-right">{new Date(o.opened_at).toLocaleString()}</td>
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
    </div>
  );
}

export default App;
