import React, { useState, useEffect } from 'react';
import { X, Sparkles, ArrowUpRight, Shield, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface NewsAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  headline: string;
  summary: string;
  portfolioPositions: string[];
}

interface AnalysisData {
  impact_score: number;
  analysis: string;
  portfolio_relevance: string;
  recommended_action: string;
  sentiment: string;
  model?: string;
}

export const NewsAnalysisModal: React.FC<NewsAnalysisModalProps> = ({ 
  isOpen, 
  onClose, 
  headline, 
  summary, 
  portfolioPositions 
}) => {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) {
      setAnalysis(null);
      setLoading(true);
      return;
    }

    // Only fetch if we don't have analysis yet or headline changed
    const fetchAnalysis = async () => {
      try {
        const res = await fetch('http://localhost:8000/news/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            headline, 
            summary, 
            positions: portfolioPositions 
          })
        });
        const data = await res.json();
        setAnalysis(data);
        setLoading(false);
      } catch (err) {
        console.error("Analysis failed:", err);
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [isOpen, headline]); // Only trigger on open or headline change

  if (!isOpen) return null;

  const getSentimentGlow = () => {
    if (!analysis) return 'from-blue-500/20';
    if (analysis.sentiment === 'Bullish') return 'from-emerald-500/20';
    if (analysis.sentiment === 'Bearish') return 'from-rose-500/20';
    return 'from-amber-500/20';
  };

  const getSentimentColor = () => {
    if (!analysis) return 'text-blue-400';
    if (analysis.sentiment === 'Bullish') return 'text-emerald-400';
    if (analysis.sentiment === 'Bearish') return 'text-rose-400';
    return 'text-amber-400';
  };

  const SentimentIcon = () => {
    if (!analysis) return <Zap className="w-5 h-5 text-blue-400" />;
    if (analysis.sentiment === 'Bullish') return <TrendingUp className="w-5 h-5 text-emerald-400" />;
    if (analysis.sentiment === 'Bearish') return <TrendingDown className="w-5 h-5 text-rose-400" />;
    return <Minus className="w-5 h-5 text-amber-400" />;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in" 
        onClick={onClose} 
      />
      
      <div className="relative w-full max-w-2xl bg-gray-950 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Glow Effect */}
        <div className={`absolute top-0 inset-x-0 h-32 bg-gradient-to-b ${getSentimentGlow()} to-transparent opacity-50`} />
        
        {/* Header */}
        <div className="relative px-8 pt-8 pb-4 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl bg-gray-900 border border-gray-800 shadow-xl ${getSentimentColor()}`}>
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">AI Insight</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded bg-gray-900 border border-gray-800 ${getSentimentColor()}`}>
                  {analysis?.sentiment || 'Analyzing...'}
                </span>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Macro Impact Analysis</span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full text-gray-500 hover:text-white transition-all shadow-lg"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="relative px-8 pt-2 pb-8 max-h-[70vh] overflow-y-auto space-y-8 scrollbar-thin scrollbar-thumb-gray-800">
          
          {/* Headline & Loading */}
          <section>
            <h3 className="text-xl font-bold text-gray-100 leading-snug mb-4">{headline}</h3>
            {loading ? (
              <div className="flex flex-col items-center gap-4 py-12">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-gray-500 font-bold text-sm animate-pulse">Running Gemini Impact Analysis...</p>
              </div>
            ) : analysis && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Summary Section */}
                <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800 shadow-inner">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <SentimentIcon />
                      <h4 className="font-bold text-gray-300 text-sm">AI Reasoning</h4>
                    </div>
                    {analysis.model && (
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600 bg-gray-950 px-2 py-1 rounded border border-gray-800">
                        {analysis.model}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-300 leading-relaxed text-[15px]">
                    {analysis.analysis}
                  </p>
                </div>

                {/* Grid stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-gray-900/40 border border-gray-800">
                    <div className="text-[10px] uppercase font-black text-gray-500 tracking-widest mb-2">Impact Severity</div>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-black text-white">{analysis.impact_score}</span>
                      <span className="text-xl font-bold text-gray-600 mb-1">/10</span>
                    </div>
                  </div>
                  <div className="p-5 rounded-2xl bg-gray-900/40 border border-gray-800">
                    <div className="text-[10px] uppercase font-black text-gray-500 tracking-widest mb-2">Rec. Action</div>
                    <div className={`text-xl font-black tracking-tight ${
                      analysis.recommended_action === 'CLOSE' ? 'text-rose-400' : 
                      analysis.recommended_action === 'ROLL' ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {analysis.recommended_action}
                    </div>
                  </div>
                </div>

                {/* Portfolio Relevance */}
                <div className="p-6 rounded-2xl bg-blue-500/5 border border-blue-500/10 shadow-xl overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Shield className="w-24 h-24 text-blue-400" />
                  </div>
                  <div className="relative">
                    <h4 className="text-blue-400 font-bold text-sm mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Portfolio Impact Notice
                    </h4>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      {analysis.portfolio_relevance}
                    </p>
                  </div>
                </div>

              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        {!loading && (
          <div className="px-8 py-6 bg-gray-900/40 border-t border-gray-800 flex justify-end gap-4">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-all text-sm"
            >
              Dismiss
            </button>
            <button 
              disabled
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all opacity-50 cursor-not-allowed"
            >
              Adjust Strategy <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
