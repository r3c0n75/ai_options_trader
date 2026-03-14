import React, { useState, useEffect } from 'react';
import { 
  Bug, 
  Activity, 
  Cpu, 
  Globe, 
  Zap, 
  Clock, 
  Database,
  Terminal,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';

interface DebugStats {
  workers: {
    max_workers: number;
    current_threads: number;
    queue_size: number;
    is_shutdown: boolean;
  };
  api_calls: Record<string, number>;
  ai_models: Record<string, number>;
  cache: {
    hits: number;
    misses: number;
    total: number;
    efficiency: number;
  };
  errors: Array<{
    path: string;
    status: number;
    method: string;
    error?: string;
    ts: number;
  }>;
  latency: Array<{
    path: string;
    duration: number;
    status: number;
    ts: number;
  }>;
  uptime: number;
}

export const DebugHUD: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [stats, setStats] = useState<DebugStats | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchStats = async () => {
      try {
        const res = await fetch('http://localhost:8000/debug/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
          
          // Track avg latency history for the sparkline
          if (data.latency.length > 0) {
            const avg = data.latency.reduce((sum: number, l: any) => sum + l.duration, 0) / data.latency.length;
            setHistory(prev => [...prev.slice(-20), avg]);
          }
        }
      } catch (err) {
        console.error("Failed to fetch debug stats", err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-y-0 right-0 ${isExpanded ? 'left-0 w-full' : 'w-[450px]'} bg-black/90 backdrop-blur-3xl border-l border-white/10 z-[200] shadow-2xl flex flex-col transition-all duration-500 ease-in-out`}>
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
            <Bug className="text-blue-400 w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">SYSTEM HUD</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Backend Live • {stats?.uptime ? Math.floor(stats.uptime / 60) : 0}m uptime</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsExpanded(!isExpanded)} 
            className="p-2 hover:bg-white/10 rounded-lg transition-colors group"
            title={isExpanded ? "Collapse View" : "Fullscreen Log View"}
          >
            {isExpanded ? <Minimize2 className="w-5 h-5 text-gray-400 group-hover:text-white" /> : <Maximize2 className="w-5 h-5 text-gray-400 group-hover:text-white" />}
          </button>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors group">
            <X className="w-5 h-5 text-gray-400 group-hover:text-white" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
        {/* Worker Matrix */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              Thread Pool Matrix (100)
            </h3>
            <span className="text-xs font-mono text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">
              {stats?.workers.current_threads ?? 0} active
            </span>
          </div>
          <div className={`grid ${isExpanded ? 'grid-cols-[repeat(25,minmax(0,1fr))] gap-1 p-2' : 'grid-cols-10 gap-1.5 p-4'} bg-white/[0.03] rounded-2xl border border-white/5 shadow-inner`}>
            {Array.from({ length: 100 }).map((_, i) => {
              const isActive = stats ? i < stats.workers.current_threads : false;
              return (
                <div 
                  key={i} 
                  className={`aspect-square rounded-sm transition-all duration-500 ${
                    isActive 
                      ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse' 
                      : 'bg-white/5'
                  }`}
                />
              );
            })}
          </div>
          <div className="mt-3 flex gap-4 text-[10px] font-mono text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" /> Active Worker
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-white/10" /> Idle Thread
            </div>
            {stats?.workers.queue_size! > 0 && (
               <div className="flex items-center gap-1.5 text-amber-400">
                 <Clock className="w-2 h-2" /> Queue: {stats?.workers.queue_size}
               </div>
            )}
          </div>
        </section>

        {/* Latency Sparkline */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Network Latency (ms)
            </h3>
            <span className="text-xs font-mono text-emerald-400">
              Avg: {history.length > 0 ? (history[history.length - 1]).toFixed(1) : '0'}ms
            </span>
          </div>
          <div className="h-16 bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden flex items-end px-1 py-2">
            {history.map((val, i) => (
              <div 
                key={i} 
                className="flex-1 bg-emerald-500/40 border-t border-emerald-500 mx-px transition-all duration-500"
                style={{ height: `${Math.min(100, (val / 500) * 100)}%` }}
              />
            ))}
          </div>
        </section>

        {/* API Analytics */}
        <div className="grid grid-cols-2 gap-4">
          <section className="p-4 bg-white/[0.03] rounded-2xl border border-white/5">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Globe className="w-3 h-3 text-purple-400" /> API Calls
            </h3>
            <div className="space-y-2">
              {stats?.api_calls && Object.entries(stats.api_calls).map(([name, count]) => (
                <div key={name} className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400">{name}</span>
                  <span className="text-xs font-mono text-gray-200">{count}</span>
                </div>
              ))}
              {!stats?.api_calls || Object.keys(stats.api_calls).length === 0 && (
                <div className="text-[10px] text-gray-600 italic">No activity yet</div>
              )}
            </div>
          </section>

          <section className="p-4 bg-white/[0.03] rounded-2xl border border-white/5">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Zap className="w-3 h-3 text-yellow-400" /> AI Models
            </h3>
            <div className="space-y-2">
              {stats?.ai_models && Object.entries(stats.ai_models).map(([name, count]) => (
                <div key={name} className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-gray-400 truncate w-24" title={name}>{name.replace('models/', '')}</span>
                  <span className="text-xs font-mono text-gray-200">{count}</span>
                </div>
              ))}
               {!stats?.ai_models || Object.keys(stats.ai_models).length === 0 && (
                <div className="text-[10px] text-gray-600 italic">No models hit</div>
              )}
            </div>
          </section>
        </div>

        {/* Cache Efficiency */}
        <section className="p-4 bg-gradient-to-br from-blue-500/5 to-transparent rounded-2xl border border-white/5">
           <div className="flex items-center justify-between mb-4">
             <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
               <Database className="w-3 h-3 text-blue-400" /> Cache Efficiency
             </h3>
             <span className="text-xs font-black text-blue-400">{stats?.cache.efficiency ?? 0}%</span>
           </div>
           <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
             <div 
               className="h-full bg-blue-500 transition-all duration-1000"
               style={{ width: `${stats?.cache.efficiency ?? 0}%` }}
             />
           </div>
           <div className="mt-3 grid grid-cols-2 text-[10px] font-mono">
             <div className="text-gray-500">Hits: <span className="text-emerald-400">{stats?.cache.hits ?? 0}</span></div>
             <div className="text-right text-gray-500">Misses: <span className="text-rose-400">{stats?.cache.misses ?? 0}</span></div>
           </div>
        </section>

        {/* Error Log */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-rose-400" /> Last 50 Events / Errors
          </h3>
          <div className="bg-black/40 rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5 font-mono text-[10px]">
            {stats?.errors && stats.errors.length > 0 ? (
              stats.errors.slice().reverse().map((err, i) => (
                <div key={i} className="p-3 flex items-start gap-3 hover:bg-white/[0.02]">
                  <span className={`px-1.5 py-0.5 rounded font-black ${
                    err.status >= 500 ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {err.status}
                  </span>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between font-bold">
                      <span className="text-gray-300">{err.method} {err.path}</span>
                      <span className="text-gray-600 shrink-0">{new Date(err.ts * 1000).toLocaleTimeString()}</span>
                    </div>
                    {err.error && <div className="text-rose-300/80 leading-relaxed italic bg-rose-500/5 p-2 rounded border border-rose-500/10 break-all">{err.error}</div>}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-gray-600 italic uppercase tracking-widest">
                No system errors detected
              </div>
            )}
          </div>
        </section>
      </div>
      
      {/* Footer / Meta */}
      <div className="p-4 bg-white/[0.02] border-t border-white/10 flex items-center justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest">
         <div className="flex items-center gap-2">
           <Zap className="w-3 h-3 fill-yellow-400 text-yellow-400" />
           High Precision Dev Tools
         </div>
         <div>v1.0.4-DEBUG</div>
      </div>
    </div>
  );
};
