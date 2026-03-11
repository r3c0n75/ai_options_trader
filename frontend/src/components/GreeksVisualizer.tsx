import * as React from 'react';
import { Activity, Zap, TrendingUp, Clock, Wind } from 'lucide-react';

interface GreeksData {
  iv: number;
  iv_percentile: number;
  delta_skew: string;
  theta: number;
  gamma: number;
  vega: number;
  delta: number;
}

interface GreeksVisualizerProps {
  greeks: GreeksData | undefined;
  loading: boolean;
}

export const GreeksVisualizer: React.FC<GreeksVisualizerProps> = ({ greeks, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-900/30 border border-gray-800 rounded-xl p-4 h-24" />
        ))}
      </div>
    );
  }

  if (!greeks) return null;

  return (
    <div className="space-y-6">
      {/* Primary Row: IV & Skew */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 rounded-2xl p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-purple-400 mb-1">
              <Activity className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-tighter">Implied Volatility</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{greeks.iv}%</span>
              <span className="text-sm font-semibold text-gray-500">IV Rank: {greeks.iv_percentile}%</span>
            </div>
          </div>
          <div className="w-16 h-16 relative">
            <svg className="w-full h-full" viewBox="0 0 36 36">
              <path
                className="stroke-gray-800 fill-none"
                strokeWidth="3"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="stroke-purple-500 fill-none"
                strokeWidth="3"
                strokeDasharray={`${greeks.iv_percentile}, 100`}
                strokeLinecap="round"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </div>

        <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-blue-400 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-tighter">Delta Skew</span>
            </div>
            <div className="text-3xl font-black text-white">
              {greeks.delta_skew}
            </div>
          </div>
          <div className={`px-4 py-2 rounded-xl text-sm font-black uppercase ${
            greeks.delta_skew === 'Bullish' ? 'bg-emerald-500/10 text-emerald-400' : 
            greeks.delta_skew === 'Bearish' ? 'bg-rose-500/10 text-rose-400' : 
            'bg-gray-500/10 text-gray-400'
          }`}>
            Optimized
          </div>
        </div>
      </div>

      {/* Secondary Row: The 4 Greeks */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GreekCard 
          label="Delta" 
          value={greeks.delta} 
          icon={<Zap className="w-4 h-4" />} 
          color="text-emerald-400" 
          description="Price Sensitivity"
        />
        <GreekCard 
          label="Gamma" 
          value={greeks.gamma} 
          icon={<TrendingUp className="w-4 h-4" />} 
          color="text-blue-400" 
          description="Delta Acceleration"
        />
        <GreekCard 
          label="Theta" 
          value={greeks.theta} 
          icon={<Clock className="w-4 h-4" />} 
          color="text-rose-400" 
          description="Time Decay / Day"
        />
        <GreekCard 
          label="Vega" 
          value={greeks.vega} 
          icon={<Wind className="w-4 h-4" />} 
          color="text-amber-400" 
          description="Vol Sensitivity"
        />
      </div>
    </div>
  );
};

const GreekCard: React.FC<{ label: string, value: number, icon: React.ReactNode, color: string, description: string }> = ({ label, value, icon, color, description }) => (
  <div className="bg-gray-900/40 border border-gray-800/50 rounded-xl p-4 hover:border-gray-700 transition-colors group">
    <div className="flex items-center gap-2 mb-2 opacity-60 group-hover:opacity-100 transition-opacity">
      <div className={color}>{icon}</div>
      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</span>
    </div>
    <div className="text-xl font-bold text-white mb-1">
      {value > 0 && label !== 'Delta' ? `+${value}` : value}
    </div>
    <div className="text-[10px] text-gray-600 font-medium">
      {description}
    </div>
  </div>
);
