import { useState, useEffect } from 'react';
import { MarketHealth } from './components/MarketHealth';
import { Recommendations } from './components/Recommendations';
import { ETFScanner } from './components/ETFScanner';
import { NewsFeed } from './components/NewsFeed';
import { SymbolChart } from './components/SymbolChart';
import { 
  Briefcase, 
  Activity, 
  LayoutDashboard, 
  Newspaper, 
  X,
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  PieChart, 
  Wallet, 
  Zap, 
  Clock,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tradesRes, accountRes, historyRes, allTradesRes] = await Promise.all([
        fetch('http://localhost:8000/trades'),
        fetch('http://localhost:8000/account'),
        fetch('http://localhost:8000/portfolio/history'),
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

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleClosePosition = async (id: string) => {
    try {
      await fetch(`http://localhost:8000/trades/${id}/close`, { method: 'POST' });
      fetchData();
    } catch (error) {
      console.error('Error closing position:', error);
    }
  };

  const handleDeletePosition = async (id: string) => {
    try {
      await fetch(`http://localhost:8000/trades/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Error deleting position:', error);
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
              <ETFScanner onSelect={(s) => setSelectedSymbol(s)} />
            </div>

            {selectedSymbol && (
              <div className="lg:col-span-3 animate-in fade-in slide-in-from-top-4 duration-500">
                <SymbolChart 
                  symbol={selectedSymbol} 
                  onClose={() => setSelectedSymbol(null)} 
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
                    <button key={p} className={`px-3 py-1 rounded-lg text-xs font-bold ${p === '1D' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>{p}</button>
                  ))}
                </div>
              </div>
              
              {/* Portfolio Chart */}
              <div className="h-64 p-6 relative bg-gradient-to-b from-transparent to-blue-500/5">
                {history && history.equity.length > 0 ? (
                  <svg className="w-full h-full" viewBox="0 0 1000 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path 
                      d={`M ${history.equity.map((e, i) => `${(i / (history.equity.length - 1)) * 1000},${100 - ((e - Math.min(...history.equity)) / (Math.max(...history.equity) - Math.min(...history.equity) || 1)) * 80 - 10}`).join(' L ')}`}
                      fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
                    />
                    <path 
                      d={`M 0,100 L ${history.equity.map((e, i) => `${(i / (history.equity.length - 1)) * 1000},${100 - ((e - Math.min(...history.equity)) / (Math.max(...history.equity) - Math.min(...history.equity) || 1)) * 80 - 10}`).join(' L ')} L 1000,100 Z`}
                      fill="url(#chartGradient)"
                    />
                  </svg>
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-gray-700 italic border border-dashed border-gray-800 rounded-xl">
                    Gathering historical benchmarks...
                  </div>
                )}
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
                      <th className="py-4 px-6 font-semibold">Price</th>
                      <th className="py-4 px-6 font-semibold">Qty</th>
                      <th className="py-4 px-6 font-semibold">Market Value</th>
                      <th className="py-4 px-6 font-semibold">Total P/L ($)</th>
                      <th className="py-4 px-6 font-semibold">Status</th>
                      <th className="py-4 px-6 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {trades.filter(t => t.status === 'OPEN').length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-20 text-center text-gray-600 font-medium italic">
                           No open positions. Place some trades to see this table populate.
                        </td>
                      </tr>
                    ) : (
                      trades.filter(t => t.status === 'OPEN').map((t) => (
                        <tr key={t.id} className="hover:bg-gray-800/30 transition-colors group">
                          <td className="py-5 px-6">
                            <span className="font-bold text-gray-200 group-hover:text-blue-400 transition-colors">{t.symbol}</span>
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{t.strategy} {t.side}</div>
                          </td>
                          <td className="py-5 px-6 font-mono text-gray-400">$ {(t.current_price || 0).toFixed(2)}</td>
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
                              <button onClick={() => handleClosePosition(t.id)} className="p-2 hover:bg-rose-500/20 text-rose-500 rounded-lg transition-colors border border-transparent hover:border-rose-500/50" title="Close Portfolio Position"><X className="w-4 h-4" /></button>
                              <button onClick={() => handleDeletePosition(t.id)} className="p-2 hover:bg-rose-500/20 text-rose-500 rounded-lg transition-colors border border-transparent hover:border-rose-500/50" title="Liquidate"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
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
    </div>
  );
}

export default App;
