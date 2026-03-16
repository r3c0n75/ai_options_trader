import React from 'react';
import { SymbolChart } from './SymbolChart';
import { X, TrendingUp, TrendingDown, Activity, Zap, BrainCircuit } from 'lucide-react';

interface VixMarketPulseInlineProps {
  onClose: () => void;
  vixLevel: number;
  marketMood: string;
  riskScore: number;
  description: string;
  globalThesis: string;
  model?: string;
}

export const VixMarketPulseInline: React.FC<VixMarketPulseInlineProps> = ({
  onClose,
  vixLevel,
  marketMood,
  riskScore,
  description,
  globalThesis,
  model
}) => {
  return (
    <div className="w-full h-[600px] bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in fade-in slide-in-from-top-4 duration-500">
        
        {/* Left Side: Chart Section (Main) */}
        <div className="flex-1 flex flex-col h-full min-h-[400px]">
          <div className="p-4 md:p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950/40 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <Activity className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black text-white tracking-tight">Market Pulse: VIX</h2>
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-gray-800/50 border border-gray-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Live</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex-1 relative">
            <SymbolChart symbol="^VIX" hideHeader />
          </div>
        </div>

        {/* Right Side: Insights Sidebar */}
        <div className="w-full md:w-80 bg-gray-950/50 border-l border-white/5 flex flex-col">
          <div className="p-6 flex-1 overflow-y-auto space-y-6">
            
            {/* VIX Stats Dashboard */}
            <div className="space-y-4">
              <div className="bg-white/5 border border-white/10 p-5 rounded-2xl">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Current Level</div>
                <div className="flex items-end gap-2">
                  <div className="text-5xl font-black font-mono text-white">{vixLevel}</div>
                  <div className={`mb-1 flex items-center gap-1 text-sm font-bold ${vixLevel > 20 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {vixLevel > 20 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {vixLevel > 25 ? 'High' : vixLevel < 15 ? 'Low' : 'Stable'}
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 p-5 rounded-2xl">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Risk Score</div>
                <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden mb-2">
                  <div 
                    className={`h-full transition-all duration-1000 ${riskScore > 70 ? 'bg-red-500' : riskScore < 30 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                    style={{ width: `${riskScore}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase text-gray-500">
                  <span>Safe</span>
                  <span className="text-white">{riskScore}/100</span>
                  <span>Extreme</span>
                </div>
              </div>
            </div>

            {/* AI Thesis Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-black text-sm uppercase tracking-wider">
                  <BrainCircuit className="w-4 h-4 text-purple-400" />
                  AI Macro Thesis
                </div>
                {model && (
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 bg-black/40 px-2 py-1 rounded border border-white/5">
                    {model}
                  </span>
                )}
              </div>
              <div className="bg-purple-500/5 border border-purple-500/10 p-4 rounded-xl">
                <p className="text-xs text-purple-200/80 leading-relaxed italic">
                  "{globalThesis}"
                </p>
              </div>
            </div>

            {/* Market Health Status */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white font-black text-sm uppercase tracking-wider">
                <Zap className="w-4 h-4 text-yellow-400" />
                Market Mood
              </div>
              <div className="bg-gray-800/50 p-4 rounded-xl border border-white/5">
                <h4 className="text-sm font-bold text-blue-400 mb-1">{marketMood}</h4>
                <p className="text-[11px] text-gray-400 leading-normal">
                  {description}
                </p>
              </div>
            </div>

          </div>

          <div className="p-6 bg-gray-900 border-t border-gray-800">
            <button 
              className="w-full py-4 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 border border-white/5"
              onClick={onClose}
            >
              Close Analysis
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
    </div>
  );
};
