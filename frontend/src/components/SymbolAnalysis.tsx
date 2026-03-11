import * as React from 'react';
import { useState, useEffect } from 'react';
import { X, Zap, Info, BarChart3, Sparkles } from 'lucide-react';
import { SymbolChart } from './SymbolChart';
import { ResearchSidecar } from './ResearchSidecar';

interface SymbolAnalysisProps {
  symbol: string;
  onClose: () => void;
}

interface AnalysisData {
  symbol: string;
  price: number;
  change_pct: number;
  vibe: {
    verdict: string;
    thesis: string;
    suggested_play: string;
  };
  news: any[];
}

export const SymbolAnalysis: React.FC<SymbolAnalysisProps> = ({ symbol, onClose }) => {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalysis = async () => {
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:8000/analysis/${symbol}`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalysis();
  }, [symbol]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-8 backdrop-blur-md bg-black/80 animate-in fade-in duration-300">
      <div className="w-full max-w-7xl h-full bg-gray-950 border border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-800 flex items-center justify-between bg-gray-950">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400 font-black border border-blue-500/30 text-xl">
              {symbol}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                {symbol} Analysis
                {data && (
                  <span className={`text-sm font-mono px-2 py-1 rounded-lg ${data.change_pct >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    ${data.price.toFixed(2)} ({data.change_pct >= 0 ? '+' : ''}{data.change_pct}%)
                  </span>
                )}
              </h2>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest">Real-time Gemini Intelligence</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-xl text-gray-400 hover:text-white transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Grid */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Main Content Area */}
          <div className="lg:col-span-8 overflow-y-auto p-8 space-y-8 scrollbar-thin scrollbar-thumb-gray-800">
            {/* AI Pulse Card */}
            <div className="bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/20 rounded-2xl p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Sparkles className="w-24 h-24 text-blue-400" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <span className="text-xs font-black uppercase tracking-widest text-blue-400">AI Pulse Verdict</span>
                </div>
                
                {loading ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-8 bg-gray-800 rounded-lg w-1/4" />
                    <div className="h-4 bg-gray-800 rounded-lg w-3/4" />
                    <div className="h-4 bg-gray-800 rounded-lg w-1/2" />
                  </div>
                ) : data ? (
                  <>
                    <div className="flex items-baseline gap-4 mb-3">
                      <h3 className="text-4xl font-black text-white">{data.vibe.verdict}</h3>
                      <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-bold text-gray-300">
                        Suggests: <span className="text-blue-400">{data.vibe.suggested_play}</span>
                      </div>
                    </div>
                    <p className="text-gray-300 text-lg leading-relaxed max-w-2xl">
                      {data.vibe.thesis}
                    </p>
                  </>
                ) : (
                  <div className="text-rose-400 font-bold">Failed to load pulse data.</div>
                )}
              </div>
            </div>

            {/* Chart Area */}
            <div className="bg-gray-900/30 border border-gray-800 rounded-2xl overflow-hidden h-[400px]">
              <SymbolChart symbol={symbol} hideHeader />
            </div>

            {/* News Hook */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-900/20 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4 text-gray-400">
                  <Info className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Key Catalysts</span>
                </div>
                <div className="space-y-4 text-sm">
                  {data?.news.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex gap-3 items-start border-l-2 border-blue-500/30 pl-3">
                      <span className="text-gray-300 line-clamp-2">{item.headline}</span>
                    </div>
                  ))}
                  {loading && [1,2].map(i => <div key={i} className="h-4 bg-gray-800 rounded-lg w-full animate-pulse" />)}
                </div>
              </div>
              <div className="bg-gray-900/20 border border-gray-800 rounded-2xl p-6 flex flex-col justify-center items-center text-center">
                <BarChart3 className="w-10 h-10 text-gray-700 mb-3" />
                <h4 className="font-bold text-white mb-1">Advanced Greeks Analysis</h4>
                <p className="text-xs text-gray-500">IV Percentile: 82% | Delta Skew: Bullish</p>
              </div>
            </div>
          </div>

          {/* Research Sidebar */}
          <div className="lg:col-span-4 border-l border-gray-800 bg-gray-950 flex flex-col">
            <ResearchSidecar 
              symbol={symbol} 
              context={data ? JSON.stringify(data) : 'Loading context...'} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};
