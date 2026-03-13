import React, { useState, useEffect } from 'react';
import { Network, TrendingUp, TrendingDown, Settings2, Plus, X, RotateCcw, Filter, ChevronDown, ArrowUpDown } from 'lucide-react';

interface ETFData {
  symbol: string;
  price: number;
  change_pct: number;
}

interface ETFScannerProps {
  onSelect?: (symbol: string) => void;
}

const DEFAULT_ASSETS = ["SPY", "QQQ", "IWM", "GLD", "TMF", "BND"];

export const ETFScanner: React.FC<ETFScannerProps> = ({ onSelect }) => {
  const [data, setData] = useState<ETFData[]>([]);
  const [feed, setFeed] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'symbol' | 'change'>('default');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Load symbols from localStorage or use defaults
  const [symbols, setSymbols] = useState<string[]>(() => {
    const saved = localStorage.getItem('macro_scanner_symbols');
    return saved ? JSON.parse(saved) : DEFAULT_ASSETS;
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/scanner?symbols=${symbols.join(',')}`);
      const json = await response.json();
      if (json.data && Array.isArray(json.data)) {
          setData(json.data);
          setFeed(json.feed || 'Unknown');
      } else {
          setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch scanner data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Save to localStorage whenever symbols change
    localStorage.setItem('macro_scanner_symbols', JSON.stringify(symbols));

    const interval = setInterval(() => {
      // Fetch without global loading state to prevent flickering
      const silentFetch = async () => {
        try {
          const response = await fetch(`http://localhost:8000/scanner?symbols=${symbols.join(',')}`);
          const json = await response.json();
          if (json.data && Array.isArray(json.data)) {
            setData(json.data);
            setFeed(json.feed || 'Unknown');
          } else {
            setData(json);
          }
        } catch (err) {
          console.error("Failed to auto-refresh scanner data:", err);
        }
      };
      silentFetch();
    }, 30000); // Throttled to 30s

    return () => clearInterval(interval);
  }, [symbols]);

  const handleAddSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = newSymbol.trim().toUpperCase();
    if (sym && !symbols.includes(sym)) {
      setSymbols([...symbols, sym]);
      setNewSymbol('');
    }
  };

  const handleRemoveSymbol = (sym: string) => {
    setSymbols(symbols.filter(s => s !== sym));
  };

  const handleReset = () => {
    setSymbols(DEFAULT_ASSETS);
    setIsEditing(false);
  };

  const handleClick = (symbol: string) => {
    if (onSelect) {
      onSelect(symbol);
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (sortBy === 'default') return 0;
    
    let comparison = 0;
    if (sortBy === 'symbol') {
      comparison = a.symbol.localeCompare(b.symbol);
    } else if (sortBy === 'change') {
      comparison = a.change_pct - b.change_pct;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  if (loading && data.length === 0) return <div className="p-6 rounded-2xl bg-gray-900 border border-gray-800 animate-pulse h-64"></div>;

  return (
    <div className="p-6 rounded-2xl bg-gray-900/50 backdrop-blur-md border border-gray-800 shadow-xl relative overflow-hidden h-full flex flex-col">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <Network className="w-5 h-5 text-indigo-400" />
            Macro Scanner
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-gray-400">Live core asset overview</p>
            {feed && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] uppercase font-bold tracking-wider">
                Feed: {feed}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Sort Controls */}
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-800/50 border border-gray-700 rounded-lg p-0.5">
              <button 
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                title={sortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="relative group/sort">
              <div className="flex items-center gap-1.5 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-1.5 text-[10px] font-bold text-gray-400 group-hover/sort:border-indigo-500/50 transition-all cursor-pointer">
                <Filter className="w-3 h-3" />
                <span>Sort: <span className="text-white capitalize">{sortBy}</span></span>
                <ChevronDown className="w-3 h-3" />
              </div>
              
              <div className="absolute right-0 top-full mt-2 w-32 bg-gray-950 border border-gray-800 rounded-xl shadow-2xl opacity-0 invisible group-hover/sort:opacity-100 group-hover/sort:visible transition-all z-30 overflow-hidden">
                <button onClick={() => setSortBy('default')} className="w-full text-left px-3 py-2 text-[10px] font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors uppercase tracking-wider">Default</button>
                <button onClick={() => setSortBy('symbol')} className="w-full text-left px-3 py-2 text-[10px] font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors uppercase tracking-wider">Symbol</button>
                <button onClick={() => setSortBy('change')} className="w-full text-left px-3 py-2 text-[10px] font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors uppercase tracking-wider">Change %</button>
              </div>
            </div>
          </div>

          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={`p-1.5 rounded-lg transition-colors ${isEditing ? 'bg-indigo-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}
            title="Edit Assets"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Scanning</span>
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="mb-6 p-4 rounded-xl bg-gray-800/50 border border-indigo-500/20 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Manage Assets</span>
            <button 
              onClick={handleReset}
              className="text-[10px] flex items-center gap-1 text-gray-500 hover:text-indigo-400 transition-colors uppercase font-bold"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Defaults
            </button>
          </div>
          <form onSubmit={handleAddSymbol} className="flex gap-2">
            <input 
              type="text" 
              value={newSymbol}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSymbol(e.target.value)}
              placeholder="Add Ticker (e.g. BTC)"
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button 
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white p-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {sortedData.map((etf: ETFData) => {
          const isPositive = etf.change_pct >= 0;
          return (
            <div 
              key={etf.symbol} 
              className={`p-4 rounded-xl border transition-all duration-300 relative group overflow-hidden cursor-pointer
                ${isPositive ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10' : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'}
              `}
              onClick={() => {
                if (!isEditing) {
                  handleClick(etf.symbol);
                }
              }}
            >
              {isEditing && (
                <button 
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    handleRemoveSymbol(etf.symbol);
                  }}
                  className="absolute top-2 right-2 z-20 p-1 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white rounded-md transition-all opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              
              {/* Subtle gradient flash on hover */}
              {!isEditing && (
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500
                  ${isPositive ? 'bg-gradient-to-br from-emerald-400 to-transparent' : 'bg-gradient-to-br from-red-400 to-transparent'}
                `} />
              )}
              
              <div className="flex justify-between items-center mb-2 relative z-10">
                <span className="font-bold text-gray-200">{etf.symbol}</span>
                {isPositive ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
              </div>
              <div className="text-xl font-mono text-white relative z-10">${etf.price.toFixed(2)}</div>
              <div className={`text-xs font-bold mt-1 relative z-10 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPositive ? '+' : ''}{etf.change_pct.toFixed(2)}%
              </div>
            </div>
          );
        })}
        {loading && data.length > 0 && <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-[1px] flex items-center justify-center rounded-2xl z-50">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>}
      </div>
    </div>
  );
};
