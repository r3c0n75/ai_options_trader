import { useState, useEffect } from 'react';
import { MarketHealth } from './components/MarketHealth';
import { Recommendations } from './components/Recommendations';
import { ETFScanner } from './components/ETFScanner';
import { NewsFeed } from './components/NewsFeed';
import { Briefcase, Activity, LayoutDashboard, Newspaper } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'news' | 'portfolio'>('dashboard');
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    if (activeTab === 'portfolio') {
      fetch('http://localhost:8000/trades')
        .then(res => res.json())
        .then(data => setTrades(data))
        .catch(err => console.error(err));
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-black text-gray-200 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/10 blur-[120px] rounded-full" />
      </div>

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
              <ETFScanner />
            </div>

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
          <main>
            <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-8 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                <Briefcase className="text-blue-400 w-6 h-6" /> Open Positions
              </h2>
              
              {trades.length === 0 ? (
                <div className="text-center py-20 bg-black/20 border border-dashed border-gray-700/50 rounded-2xl">
                  <Briefcase className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-gray-300 mb-2">No Active Trades</h3>
                  <p className="text-gray-500 max-w-sm mx-auto">
                    Your paper portfolio is currently empty. Execute a recommendation from the Dashboard to start tracking simulated performance.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 bg-black/20">
                        <th className="py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider rounded-tl-xl">Symbol</th>
                        <th className="py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Strategy</th>
                        <th className="py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Position Size</th>
                        <th className="py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Entry Date</th>
                        <th className="py-4 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider rounded-tr-xl">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map((t: any) => (
                        <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors group">
                          <td className="py-5 px-6 font-bold text-white group-hover:text-blue-400 transition-colors">{t.symbol}</td>
                          <td className="py-5 px-6 text-gray-300 font-medium">{t.strategy}</td>
                          <td className="py-5 px-6 font-mono text-gray-400">{t.quantity} <span className="text-gray-600 text-xs ml-1">CONT</span></td>
                          <td className="py-5 px-6 text-gray-500 text-sm font-mono">{new Date(t.opened_at).toLocaleDateString()}</td>
                          <td className="py-5 px-6">
                            <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}

export default App;
