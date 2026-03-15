import * as React from 'react';
import { useState, useEffect } from 'react';
import { X, Zap, BarChart3, Sparkles } from 'lucide-react';
import { SymbolChart } from './SymbolChart';
import { ResearchSidecar } from './ResearchSidecar';
import { GreeksVisualizer } from './GreeksVisualizer';

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
    trend_3m?: number;
    trend_12m?: number;
    model?: string;
  };
  news: any[];
  greeks?: {
    iv: number;
    iv_percentile: number;
    delta_skew: string;
    theta: number;
    gamma: number;
    vega: number;
    delta: number;
  };
}

export const SymbolAnalysis: React.FC<SymbolAnalysisProps> = ({ symbol, onClose }) => {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Prevent background scrolling when modal is open
    document.body.style.overflow = 'hidden';
    
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

    return () => {
      // Restore scrolling when modal is closed
      document.body.style.overflow = 'unset';
    };
  }, [symbol]);

  const getSentimentClasses = (verdict: string) => {
    if (!verdict) return { border: 'animate-border-neutral', text: 'text-purple-400', bg: 'from-purple-600/10' };
    const v = verdict.toLowerCase();
    if (v.includes('bullish') || v.includes('buy') || v.includes('positive')) {
      return {
        border: 'animate-border-bullish',
        text: 'text-emerald-400',
        bg: 'from-emerald-600/10'
      };
    }
    if (v.includes('bearish') || v.includes('sell') || v.includes('negative')) {
      return {
        border: 'animate-border-bearish',
        text: 'text-rose-400',
        bg: 'from-rose-600/10'
      };
    }
    // Default to Neutral/Purple
    return {
      border: 'animate-border-neutral',
      text: 'text-purple-400',
      bg: 'from-purple-600/10'
    };
  };

  const sentiment = (data && data.vibe && data.vibe.verdict) ? getSentimentClasses(data.vibe.verdict) : { border: 'animate-border-neutral', text: 'text-purple-400', bg: 'from-purple-600/10' };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-8 backdrop-blur-md bg-black/80 animate-in fade-in duration-300">
      <div className="w-full max-w-7xl h-full bg-gray-950 border border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 relative">
        {/* AI Insight Badge */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[120]">
          <div className="animate-border-rainbow px-6 py-2 rounded-full flex items-center gap-2 shadow-2xl">
            <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-xs font-black text-white tracking-[0.2em] uppercase">AI Insight</span>
          </div>
        </div>

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
                  <span className={`text-sm font-mono px-2 py-1 rounded-lg ${(data.change_pct || 0) >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    ${(data.price || 0).toFixed(2)} ({(data.change_pct || 0) >= 0 ? '+' : ''}{data.change_pct || 0}%)
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
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
          {/* Main Content Area */}
          <div className="lg:col-span-8 overflow-y-auto p-8 space-y-8 scrollbar-thin scrollbar-thumb-gray-800 min-h-0">
            {/* AI Pulse Card */}
            <div className={`bg-gradient-to-br ${sentiment.bg} to-transparent border border-white/5 rounded-2xl p-6 relative overflow-hidden group ${sentiment.border}`}>
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Sparkles className={`w-24 h-24 ${sentiment.text}`} />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    <span className={`text-xs font-black uppercase tracking-widest ${sentiment.text}`}>AI Pulse Verdict</span>
                  </div>
                  {data?.vibe?.model && (
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 bg-black/40 px-2 py-1 rounded border border-white/5">
                      {data.vibe.model}
                    </span>
                  )}
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
            <div className="bg-gray-900/30 border border-gray-800 rounded-2xl overflow-hidden min-h-[500px] relative">
              <SymbolChart symbol={symbol} hideHeader />
            </div>

            {/* Advanced Greeks Area */}
            <div className="bg-gray-900/10 border border-gray-800/50 rounded-3xl p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">Advanced Greeks Analysis</h4>
                    <p className="text-xs text-gray-500 font-medium">Real-time options risk & sensitivity metrics</p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                  Live Feed
                </div>
              </div>
              <GreeksVisualizer greeks={data?.greeks} loading={loading} />
            </div>
          </div>

          {/* Research Sidebar */}
          <div className="lg:col-span-4 border-l border-gray-800 bg-gray-950 flex flex-col min-h-0 h-full">
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
