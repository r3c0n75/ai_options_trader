import React, { useState, useEffect } from 'react';
import { Target, Zap, AlertTriangle, CheckCircle2, Search, ArrowRight } from 'lucide-react';

interface Recommendation {
  symbol: string;
  strategy: string;
  thesis: string;
  expiration: string;
  target_entry: string;
  pop: string;
  risk_reward: string;
  confidence: string;
}

export const Recommendations: React.FC = () => {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [tradeStatus, setTradeStatus] = useState<string | null>(null);

  const fetchRecs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/recommendations`);
      const data = await res.json();
      setRecs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecs();
  }, []);

  const executePaperTrade = async (rec: Recommendation) => {
    try {
      const res = await fetch('http://localhost:8000/trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symbol: rec.symbol,
          strategy: rec.strategy,
          entry_price: 0, // Mock entry price for now
          quantity: 1
        })
      });
      if (res.ok) {
        setTradeStatus(`Successfully executed paper trade for 1x ${rec.symbol} ${rec.strategy}`);
        setTimeout(() => setTradeStatus(null), 5000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
            <Zap className="text-yellow-400 w-6 h-6" />
            Top Macro Opportunities
          </h2>
          <p className="text-gray-400 text-sm mt-1">Autonomous evaluation across SPY, QQQ, TMF, etc.</p>
        </div>
      </div>

      {tradeStatus && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5" />
          {tradeStatus}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4">
          {[1,2].map(i => <div key={i} className="h-48 bg-gray-900 border border-gray-800 rounded-2xl animate-pulse" />)}
        </div>
      ) : recs.length === 0 ? (
        <div className="text-gray-500 text-center py-10 bg-gray-900/30 rounded-2xl border border-gray-800">
          No actionable setups found across the macro basket at this time.
        </div>
      ) : (
        <div className="grid gap-4">
          {recs.map((rec, idx) => (
            <div key={idx} className="group bg-gray-900/40 hover:bg-gray-800/60 border border-gray-800 hover:border-gray-700 transition-all duration-300 rounded-2xl p-6 relative overflow-hidden">
               {/* Hover gradient effect */}
               <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
               
               <div className="flex flex-col md:flex-row justify-between gap-6">
                 <div className="flex-1">
                   <div className="flex items-center gap-3 mb-2">
                     <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-bold tracking-wider">
                       {rec.symbol}
                     </span>
                     <h3 className="text-xl font-bold text-gray-100">{rec.strategy}</h3>
                   </div>
                   
                   <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                     {rec.thesis}
                   </p>

                   <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                     <div>
                       <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Target Entry</div>
                       <div className="font-mono text-sm text-gray-200">{rec.target_entry}</div>
                     </div>
                     <div>
                       <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Win Prob (POP)</div>
                       <div className="font-mono text-sm text-emerald-400 flex items-center gap-1">
                         <Target className="w-3 h-3" /> {rec.pop}
                       </div>
                     </div>
                     <div>
                       <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Risk / Reward</div>
                       <div className="font-mono text-sm text-orange-400">{rec.risk_reward}</div>
                     </div>
                     <div>
                       <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Confidence</div>
                       <div className="font-mono text-sm text-gray-300 flex items-center gap-1">
                         <AlertTriangle className="w-3 h-3 text-yellow-500" /> {rec.confidence}
                       </div>
                     </div>
                   </div>
                 </div>

                 <div className="flex items-center justify-end md:justify-center md:pl-6 md:border-l border-gray-800">
                   <button 
                     onClick={() => executePaperTrade(rec)}
                     className="bg-white/5 hover:bg-blue-600 border border-white/10 hover:border-blue-500 text-white rounded-xl px-6 py-3 font-semibold transition-all duration-300 flex items-center gap-2 w-full md:w-auto justify-center group/btn"
                   >
                     Paper Trade
                     <ArrowRight className="w-4 h-4 opacity-50 group-hover/btn:opacity-100 group-hover/btn:translate-x-1 transition-all" />
                   </button>
                 </div>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
