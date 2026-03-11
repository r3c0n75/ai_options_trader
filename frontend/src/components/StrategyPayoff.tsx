import { useMemo } from 'react';

interface StrategyLeg {
  strike: number;
  side: 'BUY' | 'SELL';
  type: 'CALL' | 'PUT' | 'STOCK';
  premium: number;
}

interface StrategyDiagramData {
  underlying_price: number;
  strategy_type: string;
  legs: StrategyLeg[];
}

interface StrategyPayoffProps {
  data: StrategyDiagramData;
}

export const StrategyPayoff = ({ data }: StrategyPayoffProps) => {
  const { underlying_price, legs } = data;

  // Calculate P&L for a single price point
  const calculatePnL = (price: number) => {
    return legs.reduce((total: number, leg: StrategyLeg) => {
      if (leg.type === 'STOCK') {
        if (leg.side === 'BUY') {
          return total + (price - leg.premium);
        } else {
          return total + (leg.premium - price);
        }
      }

      let pnl = 0;
      if (leg.type === 'CALL') {
        pnl = Math.max(0, price - leg.strike);
      } else {
        pnl = Math.max(0, leg.strike - price);
      }

      if (leg.side === 'BUY') {
        return total + (pnl - leg.premium);
      } else {
        return total + (leg.premium - pnl);
      }
    }, 0);
  };

  // Generate data points for the SVG path
  const points = useMemo(() => {
    const range = underlying_price * 0.2; // 20% range
    const minPrice = underlying_price - range;
    const maxPrice = underlying_price + range;
    const step = (maxPrice - minPrice) / 100;

    const result = [];
    for (let p = minPrice; p <= maxPrice; p += step) {
      result.push({ price: p, pnl: calculatePnL(p) });
    }
    return result;
  }, [underlying_price, legs]);

  const maxPnL = Math.max(...points.map(p => Math.abs(p.pnl)), 10);
  const margin = 40;
  const width = 640;
  const height = 270;

  const xScale = (price: number) => {
    const minPrice = points[0].price;
    const maxPrice = points[points.length - 1].price;
    return margin + ((price - minPrice) / (maxPrice - minPrice)) * (width - 2 * margin);
  };

  const yScale = (pnl: number) => {
    // Center Y at 0
    return height / 2 - (pnl / maxPnL) * (height / 2 - margin);
  };

  const linePath = useMemo(() => {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.price)} ${yScale(p.pnl)}`).join(' ');
  }, [points]);

  // Create profit/loss areas
  const areas = useMemo(() => {
    const profitArea = [];
    const lossArea = [];
    const zeroY = yScale(0);

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const x1 = xScale(p1.price);
      const x2 = xScale(p2.price);
      const y1 = yScale(p1.pnl);
      const y2 = yScale(p2.pnl);

      if (p1.pnl >= 0 && p2.pnl >= 0) {
        profitArea.push(`M ${x1} ${zeroY} L ${x1} ${y1} L ${x2} ${y2} L ${x2} ${zeroY} Z`);
      } else if (p1.pnl <= 0 && p2.pnl <= 0) {
        lossArea.push(`M ${x1} ${zeroY} L ${x1} ${y1} L ${x2} ${y2} L ${x2} ${zeroY} Z`);
      } else {
        // Crossing zero - simplified: just split into two
        const midX = x1 + (x2 - x1) * (Math.abs(p1.pnl) / (Math.abs(p1.pnl) + Math.abs(p2.pnl)));
        if (p1.pnl > 0) {
          profitArea.push(`M ${x1} ${zeroY} L ${x1} ${y1} L ${midX} ${zeroY} Z`);
          lossArea.push(`M ${midX} ${zeroY} L ${x2} ${y2} L ${x2} ${zeroY} Z`);
        } else {
          lossArea.push(`M ${x1} ${zeroY} L ${x1} ${y1} L ${midX} ${zeroY} Z`);
          profitArea.push(`M ${midX} ${zeroY} L ${x2} ${y2} L ${x2} ${zeroY} Z`);
        }
      }
    }
    return { profit: profitArea.join(' '), loss: lossArea.join(' ') };
  }, [points]);

  return (
    <div className="bg-gray-950/60 p-4 rounded-xl border border-gray-800/50 mt-4 overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <span className="text-[10px] font-black tracking-widest text-gray-500 uppercase">Analysis Curve © EXP</span>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
            <span className="text-[10px] font-bold text-gray-400">Profit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-rose-500/50" />
            <span className="text-[10px] font-bold text-gray-400">Loss</span>
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {/* Grids */}
        <line x1={margin} y1={yScale(0)} x2={width - margin} y2={yScale(0)} stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />
        
        {/* Shaded Areas */}
        <path d={areas.profit} fill="#10b981" fillOpacity="0.15" />
        <path d={areas.loss} fill="#f43f5e" fillOpacity="0.15" />

        {/* Payoff Line */}
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" />

        {/* Strike Markers */}
        {legs.map((leg: StrategyLeg, i: number) => (
          <g key={i}>
            <line 
              x1={xScale(leg.strike)} 
              y1={margin} 
              x2={xScale(leg.strike)} 
              y2={height - margin} 
              stroke="#475569" 
              strokeWidth="1" 
              strokeDasharray="2 2" 
            />
            <rect 
              x={xScale(leg.strike) - 20} 
              y={height - margin + 5} 
              width="40" 
              height="16" 
              rx="4" 
              fill="#1e293b" 
            />
            <text 
              x={xScale(leg.strike)} 
              y={height - margin + 17} 
              textAnchor="middle" 
              className="text-[10px] font-mono fill-gray-400"
            >
              {leg.strike}
            </text>
          </g>
        ))}

        {/* Current Price Marker */}
        <g>
          <line 
            x1={xScale(underlying_price)} 
            y1={margin} 
            x2={xScale(underlying_price)} 
            y2={height - margin} 
            stroke="#fbbf24" 
            strokeWidth="1.5" 
          />
          <circle cx={xScale(underlying_price)} cy={yScale(calculatePnL(underlying_price))} r="4" fill="#fbbf24" stroke="#000" strokeWidth="1" />
          <text 
            x={xScale(underlying_price)} 
            y={margin - 10} 
            textAnchor="middle" 
            className="text-[10px] font-black fill-yellow-400 uppercase tracking-tighter"
          >
            Now: {underlying_price}
          </text>
        </g>

        {/* X-Axis */}
        <line x1={margin} y1={height - margin + 20} x2={width - margin} y2={height - margin + 20} stroke="#1e293b" strokeWidth="1" />
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const p = points[0].price + pct * (points[points.length - 1].price - points[0].price);
          const x = xScale(p);
          return (
            <g key={`axis-${i}`}>
              <line x1={x} y1={height - margin + 20} x2={x} y2={height - margin + 25} stroke="#1e293b" strokeWidth="1" />
              <text 
                x={x} 
                y={height - margin + 35} 
                textAnchor="middle" 
                className="text-[9px] font-mono fill-gray-500"
              >
                ${p.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Y-Axis */}
        <line x1={width - margin + 10} y1={margin} x2={width - margin + 10} y2={height - margin} stroke="#1e293b" strokeWidth="1" />
        {[1, 0.5, 0, -0.5, -1].map((pct, i) => {
          const pnl = maxPnL * pct;
          const y = yScale(pnl);
          return (
            <g key={`y-axis-${i}`}>
              <line x1={width - margin + 10} y1={y} x2={width - margin + 15} y2={y} stroke="#1e293b" strokeWidth="1" />
              <text 
                x={width - margin + 20} 
                y={y + 3} 
                textAnchor="start" 
                className={`text-[9px] font-mono ${pnl > 0 ? 'fill-emerald-500/70' : pnl < 0 ? 'fill-rose-500/70' : 'fill-gray-500'}`}
              >
                {pnl > 0 ? '+' : pnl < 0 ? '-' : ''}${Math.abs(pnl).toFixed(0)}
              </text>
            </g>
          );
        })}
      </svg>
      
      <div className="mt-2 flex justify-between">
        <div className="flex gap-4">
           <div>
             <span className="text-[9px] text-gray-600 block uppercase font-bold">Max Profit</span>
             <span className="text-xs font-mono text-emerald-400 font-bold">
               {maxPnL > 100 ? 'Uncapped' : `$${(Math.max(...points.map(p => p.pnl))).toFixed(2)}`}
             </span>
           </div>
           <div>
             <span className="text-[9px] text-gray-600 block uppercase font-bold">Max Loss</span>
             <span className="text-xs font-mono text-rose-400 font-bold">
               {Math.min(...points.map(p => p.pnl)) < -100 ? 'Uncapped' : `$${Math.abs(Math.min(...points.map(p => p.pnl))).toFixed(2)}`}
             </span>
           </div>
        </div>
        <div className="text-right">
           <span className="text-[9px] text-gray-600 block uppercase font-bold">Expected P/L</span>
           <span className={`text-xs font-mono font-bold ${calculatePnL(underlying_price) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
             {calculatePnL(underlying_price) >= 0 ? '+' : ''}${calculatePnL(underlying_price).toFixed(2)}
           </span>
        </div>
      </div>
    </div>
  );
};
