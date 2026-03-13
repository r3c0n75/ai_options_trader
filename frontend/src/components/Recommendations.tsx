import * as React from 'react';
import { useState, useEffect } from 'react';
import { Target, Zap, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, ArrowRight, Filter, ChevronDown, BarChart3 } from 'lucide-react';
import { StrategyPayoff } from './StrategyPayoff';
import { TradeConfirmationModal } from './TradeConfirmationModal';

interface StrategyLeg {
  strike: number;
  side: 'BUY' | 'SELL';
  type: 'CALL' | 'PUT';
  premium: number;
  symbol: string;
}

interface Recommendation {
  symbol: string;
  strategy: string;
  side: string;
  thesis: string;
  expiration: string;
  target_entry: string;
  pop: string;
  risk_reward: string;
  confidence: string;
  diagram_data: {
    underlying_price: number;
    strategy_type: string;
    legs: StrategyLeg[];
  };
}

interface RecommendationsProps {
  onAnalyze: (symbol: string) => void;
  onTradeSuccess?: (symbol: string) => void;
}

export const Recommendations: React.FC<RecommendationsProps> = ({ onAnalyze, onTradeSuccess }) => {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [tradeStatus, setTradeStatus] = useState<{message: string, isError: boolean} | null>(null);
  const [filterSide, setFilterSide] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [sortBy, setSortBy] = useState<'none' | 'pop' | 'risk' | 'confidence' | 'symbol' | 'strategy'>('none');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<Recommendation | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasSuccess, setHasSuccess] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const parsePop = (pop: string) => parseInt(pop.replace('%', '')) || 0;
  
  const parseRiskReward = (rr: string) => {
    if (rr === 'Uncapped') return 100;
    const parts = rr.split(':').map(Number);
    if (parts.length === 2 && parts[1] !== 0) return parts[0] / parts[1];
    return 0;
  };

  const confidenceValue = (c: string) => {
    const map: Record<string, number> = { 'High': 3, 'Moderate': 2, 'Low': 1 };
    return map[c] || 0;
  };

  const processedRecs = [...recs]
    .filter(r => filterSide === 'ALL' || r.side === filterSide)
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'pop') comparison = parsePop(b.pop) - parsePop(a.pop);
      else if (sortBy === 'risk') comparison = parseRiskReward(b.risk_reward) - parseRiskReward(a.risk_reward);
      else if (sortBy === 'confidence') comparison = confidenceValue(b.confidence) - confidenceValue(a.confidence);
      else if (sortBy === 'symbol') comparison = a.symbol.localeCompare(b.symbol);
      else if (sortBy === 'strategy') comparison = a.strategy.localeCompare(b.strategy);
      
      return sortOrder === 'desc' ? comparison : -comparison;
    });

  const visibleRecs = showAll ? processedRecs : processedRecs.slice(0, 5);

  const fetchRecs = async () => {
    setLoading(true);
    try {
      // Get custom symbols from Macro Scanner's localStorage
      const savedSymbols = localStorage.getItem('macro_scanner_symbols');
      const symbolsParam = savedSymbols ? `?symbols=${JSON.parse(savedSymbols).join(',')}` : '';
      
      const res = await fetch(`http://localhost:8000/recommendations${symbolsParam}`);
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

  const openOrderModal = (rec: Recommendation) => {
    setSelectedTrade(rec);
    setHasSuccess(false);
    setIsModalOpen(true);
  };

  const executePaperTrade = async (rec: Recommendation, quantity: number) => {
    try {
      const res = await fetch('http://localhost:8000/trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symbol: rec.symbol,
          strategy: rec.strategy,
          side: rec.side.toLowerCase(),
          entry_price: 0,
          quantity: quantity,
          legs: rec.diagram_data.legs
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Unknown error from server');
      }
      
      setHasSuccess(true);
      return data; // Return data for status inspection
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };

  const handleModalClose = () => {
    if (hasSuccess && onTradeSuccess && selectedTrade) {
      onTradeSuccess(selectedTrade.symbol);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
            <Zap className="text-yellow-400 w-6 h-6" />
            Top Macro Opportunities
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-gray-400 text-sm">Autonomous evaluation across SPY, QQQ, TMF, etc.</p>
            <div className="h-4 w-px bg-gray-800" />
            <button 
              onClick={() => setShowAll(!showAll)}
              className={`text-xs font-bold transition-colors ${showAll ? 'text-blue-400 hover:text-blue-300' : 'text-gray-500 hover:text-gray-400'}`}
            >
              {showAll ? 'Show Top 5' : 'Show All'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
          <div className="flex bg-gray-900/80 border border-gray-800 rounded-xl p-1">
            {(['ALL', 'BUY', 'SELL'] as const).map(side => (
              <button
                key={side}
                onClick={() => setFilterSide(side)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterSide === side 
                    ? 'bg-gray-800 text-white shadow-sm' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {side}
              </button>
            ))}
          </div>

          <div className="flex bg-gray-900/80 border border-gray-800 rounded-xl p-1">
            <button 
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
              title={sortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
            >
              {sortOrder === 'asc' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </button>
          </div>

          <div className="relative group">
            <div className="flex items-center gap-2 bg-gray-900/80 border border-gray-800 rounded-xl px-4 py-1.5 text-xs font-bold text-gray-400 group-hover:border-gray-700 transition-all cursor-pointer">
              <Filter className="w-3.5 h-3.5" />
              <span>Sort By: <span className="text-white capitalize">{sortBy === 'none' ? 'Default' : sortBy === 'risk' ? 'Risk/Reward' : sortBy}</span></span>
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
            
            <div className="absolute right-0 top-full mt-2 w-48 bg-gray-950 border border-gray-800 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 overflow-hidden">
              <button onClick={() => setSortBy('none')} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors">Default</button>
              <button onClick={() => setSortBy('symbol')} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors">Symbol</button>
              <button onClick={() => setSortBy('strategy')} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors">Strategy</button>
              <button onClick={() => setSortBy('pop')} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors">Win Prob (POP)</button>
              <button onClick={() => setSortBy('risk')} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors">Risk/Reward Ratio</button>
              <button onClick={() => setSortBy('confidence')} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors">AI Confidence</button>
            </div>
          </div>
        </div>
      </div>

      {tradeStatus && (
        <div className={`${
          tradeStatus.isError 
            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          } border px-4 py-3 rounded-xl flex justify-between items-center gap-3 animate-in fade-in slide-in-from-top-2`}
        >
          <div className="flex items-center gap-3">
            {tradeStatus.isError ? <AlertTriangle className="w-5 h-5 text-rose-400" /> : <CheckCircle2 className="w-5 h-5" />}
            {tradeStatus.message}
          </div>
          {tradeStatus.isError && (
            <button 
              onClick={() => setTradeStatus(null)}
              className="text-xs font-bold uppercase tracking-wider hover:text-white transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4">
          {[1,2].map(i => <div key={i} className="h-48 bg-gray-900 border border-gray-800 rounded-2xl animate-pulse" />)}
        </div>
      ) : processedRecs.length === 0 ? (
        <div className="text-gray-500 text-center py-10 bg-gray-900/30 rounded-2xl border border-gray-800">
          No actionable setups found matching your filters.
        </div>
      ) : (
        <div className="grid gap-4">
          {visibleRecs.map((rec, idx) => (
            <div 
              key={idx} 
              onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
              className={`group bg-gray-900/40 hover:bg-gray-800/60 border transition-all duration-300 rounded-2xl p-6 relative overflow-hidden cursor-pointer
                ${expandedIdx === idx ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-gray-800 hover:border-gray-700'}
              `}
            >
               <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
               
               <div className="flex flex-col md:flex-row justify-between gap-6">
                 <div className="flex-1">
                   <div className="flex items-center gap-3 mb-2">
                     <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-bold tracking-wider">
                       {rec.symbol}
                     </span>
                     <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider flex items-center gap-1.5 ${
                       rec.side === 'BUY' 
                         ? 'bg-emerald-500/20 text-emerald-400' 
                         : 'bg-orange-500/20 text-orange-400'
                     }`}>
                       {rec.side === 'BUY' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                       {rec.side}
                     </span>
                     <h3 className="text-xl font-bold text-gray-100">{rec.strategy}</h3>
                   </div>
                   
                   <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                     {rec.thesis}
                   </p>

                   <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                     <div>
                       <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Target Entry</div>
                       <div className="font-mono text-sm text-gray-200">{rec.target_entry}</div>
                     </div>
                     <div>
                       <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Expiration</div>
                       <div className="font-mono text-sm text-blue-400">{rec.expiration}</div>
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

                  <div className="flex items-center justify-end md:justify-center md:pl-6 md:border-l border-gray-800 gap-4">
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        onAnalyze(rec.symbol);
                      }}
                      className="animate-border-rainbow px-4 py-2 rounded-xl flex items-center gap-2 shadow-xl transition-transform hover:scale-105"
                    >
                      <Zap className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                      <span className="text-[10px] font-black text-white tracking-[0.1em] uppercase">AI Insight</span>
                    </button>

                    <button 
                      onClick={(e) => { e.stopPropagation(); openOrderModal(rec); }}
                      className="bg-white/5 hover:bg-blue-600 border border-white/10 hover:border-blue-500 text-white rounded-xl px-6 py-3 font-semibold transition-all duration-300 flex items-center gap-2 w-full md:w-auto justify-center group/btn"
                    >
                      Order
                      <ArrowRight className="w-4 h-4 opacity-50 group-hover/btn:opacity-100 group-hover/btn:translate-x-1 transition-all" />
                    </button>
                   <div className={`p-2 rounded-lg transition-colors ${expandedIdx === idx ? 'text-blue-400 bg-blue-400/10' : 'text-gray-500 group-hover:text-gray-300'}`}>
                     <BarChart3 className="w-5 h-5" />
                   </div>
                 </div>
               </div>

               {expandedIdx === idx && (
                 <div className="animate-in fade-in slide-in-from-top-4 duration-500 origin-top">
                   <StrategyPayoff data={rec.diagram_data} />
                 </div>
               )}
            </div>
          ))}
        </div>
      )}

      <TradeConfirmationModal 
        isOpen={isModalOpen} 
        trade={selectedTrade} 
        onClose={handleModalClose}
        onConfirm={executePaperTrade}
      />
    </div>
  );
};
