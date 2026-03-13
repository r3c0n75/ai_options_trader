import { useEffect, useState } from 'react';
import { Activity, ShieldAlert, TrendingDown, TrendingUp } from 'lucide-react';

interface MarketHealthData {
  status: string;
  vix_level: number;
  description: string;
}

export const MarketHealth: React.FC = () => {
  const [data, setData] = useState<MarketHealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarketHealth = () => {
      fetch('http://localhost:8000/market-health')
        .then(res => res.json())
        .then(json => {
          setData(json);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch market health:", err);
          setLoading(false);
        });
    };

    fetchMarketHealth();
    const interval = setInterval(fetchMarketHealth, 600000); // Refresh every 10mins (600,000ms)
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="p-6 rounded-2xl bg-gray-900 border border-gray-800 animate-pulse h-40"></div>;
  if (!data) return <div className="text-red-500">Error loading market health</div>;

  const isSeller = data.status.includes("Seller");
  const isBuyer = data.status.includes("Buyer");

  return (
    <div className="p-6 rounded-2xl bg-gray-900/50 backdrop-blur-md border border-gray-800 shadow-xl relative overflow-hidden">
      {/* Decorative background glow */}
      <div className={`absolute top-0 right-0 w-32 h-32 blur-[64px] rounded-full opacity-30 pointer-events-none
        ${isSeller ? 'bg-red-500' : isBuyer ? 'bg-emerald-500' : 'bg-blue-500'}
      `} />

      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Market Health
          </h2>
          <p className="text-sm text-gray-400 mt-1">VIX Implied Volatility Analysis</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black font-mono">
            {data.vix_level}
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">VIX Level</div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <div className={`p-4 rounded-xl flex items-center justify-center shrink-0
          ${isSeller ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
            isBuyer ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
            'bg-blue-500/10 text-blue-400 border border-blue-500/20'}
        `}>
          {isSeller ? <TrendingDown className="w-8 h-8" /> : 
           isBuyer ? <TrendingUp className="w-8 h-8" /> : 
           <ShieldAlert className="w-8 h-8" />}
        </div>
        
        <div>
          <h3 className={`text-xl font-bold
            ${isSeller ? 'text-red-400' : isBuyer ? 'text-emerald-400' : 'text-blue-400'}
          `}>
            {data.status}
          </h3>
          <p className="text-sm text-gray-300 mt-1 leading-relaxed">
            {data.description}
          </p>
        </div>
      </div>
    </div>
  );
};
