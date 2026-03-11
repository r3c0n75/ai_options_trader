import React, { useEffect, useState } from 'react';
import { Network, TrendingUp, TrendingDown } from 'lucide-react';

interface ETFData {
  symbol: string;
  price: number;
  change_pct: number;
}

export const ETFScanner: React.FC = () => {
  const [data, setData] = useState<ETFData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8000/scanner')
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch scanner data:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-6 rounded-2xl bg-gray-900 border border-gray-800 animate-pulse h-64"></div>;
  if (!data || data.length === 0) return <div className="text-red-500">Error loading ETF scanner data</div>;

  return (
    <div className="p-6 rounded-2xl bg-gray-900/50 backdrop-blur-md border border-gray-800 shadow-xl relative overflow-hidden h-full flex flex-col">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <Network className="w-5 h-5 text-indigo-400" />
            Macro Scanner
          </h2>
          <p className="text-sm text-gray-400 mt-1">Live core asset overview</p>
        </div>
        <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Scanning</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
        {data.map((etf) => {
          const isPositive = etf.change_pct >= 0;
          return (
            <div 
              key={etf.symbol} 
              className={`p-4 rounded-xl border transition-all duration-300 relative group overflow-hidden
                ${isPositive ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10' : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'}
              `}
            >
              {/* Subtle gradient flash on hover */}
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500
                ${isPositive ? 'bg-gradient-to-br from-emerald-400 to-transparent' : 'bg-gradient-to-br from-red-400 to-transparent'}
              `} />
              
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
      </div>
    </div>
  );
};
