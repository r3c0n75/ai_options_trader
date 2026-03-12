import React, { useMemo, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { calculateTheoreticalPnL } from '../utils/options_math';

interface StrategyLeg {
  strike: number;
  side: 'BUY' | 'SELL';
  type: 'CALL' | 'PUT' | 'STOCK';
  premium: number;
  dte?: number;
  iv?: number;
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
  const { underlying_price, legs = [] } = data;
  const [zoomLevel, setZoomLevel] = useState<number>(1.0); 
  const [hoverData, setHoverData] = useState<{ price: number; pnl: number; currentPnl: number; x: number } | null>(null);

  // Calculate P&L for a single price point
  const calculatePnL = (price: number) => {
    return (legs || []).reduce((total: number, leg: StrategyLeg) => {
      // Robust normalization of side and type
      const sideRaw = (leg.side || '').toString().toUpperCase().trim();
      const typeRaw = (leg.type || '').toString().toUpperCase().trim();
      
      const isLong = sideRaw === 'BUY' || sideRaw === 'LONG' || sideRaw === 'B';
      const isStock = typeRaw === 'STOCK' || typeRaw === 'EQUITY';
      const isCall = typeRaw === 'CALL' || typeRaw === 'C';
      const isPut = typeRaw === 'PUT' || typeRaw === 'P';

      if (isStock) {
        if (isLong) {
          return total + (price - leg.premium);
        } else {
          return total + (leg.premium - price);
        }
      }

      let intrinsic = 0;
      if (isCall) {
        intrinsic = Math.max(0, price - leg.strike);
      } else if (isPut) {
        intrinsic = Math.max(0, leg.strike - price);
      }

      if (isLong) {
        // Long P&L = Intrinsic Value - Premium Paid
        return total + (intrinsic - leg.premium);
      } else {
        // Short P&L = Premium Received - Intrinsic Value
        return total + (leg.premium - intrinsic);
      }
    }, 0);
  };

  // Generate data points for the SVG path
  const allPoints = useMemo(() => {
    // Smart range: 
    // 1. Find furthest strike distance
    const maxStrikeDist = legs.length > 0 
      ? Math.max(...legs.map(l => Math.abs(l.strike - underlying_price)))
      : 0;
    
    // 2. Consider total premium as a range factor (exclude stock price as it distorts zoom)
    const totalPremium = legs.reduce((sum, l) => {
      const typeRaw = (l.type || '').toString().toUpperCase().trim();
      const isStock = typeRaw === 'STOCK' || typeRaw === 'EQUITY';
      return sum + (isStock ? 0 : (l.premium || 0));
    }, 0);
    
    // 3. Set a minimum floor (5% of underlying) so it doesn't look 'thin'
    const priceFloor = underlying_price * 0.05;

    // Use the max of these factors with 20% padding
    const baseRange = Math.max(maxStrikeDist, totalPremium, priceFloor) * 1.2;
    const range = Math.max(baseRange * zoomLevel, 0.5); 
    
    const minPrice = underlying_price - range;
    const maxPrice = underlying_price + range;
    const step = (maxPrice - minPrice) / 100;

    const result = [];
    const currentResult = [];

    for (let i = 0; i <= 100; i++) {
      const p = minPrice + i * step;
      result.push({ price: p, pnl: calculatePnL(p) });
      currentResult.push({ price: p, pnl: calculateTheoreticalPnL(p, legs as any) });
    }
    return { points: result, currentPoints: currentResult };
  }, [underlying_price, legs, zoomLevel]);

  const { points, currentPoints } = allPoints;

  const minPnL = useMemo(() => {
    if (!points.length) return 0;
    const p1 = Math.min(...points.map((p: any) => p.pnl));
    const p2 = Math.min(...currentPoints.map((p: any) => p.pnl));
    return Math.min(p1, p2);
  }, [points, currentPoints]);

  const maxPnLValue = useMemo(() => {
    if (!points.length) return 0;
    const p1 = Math.max(...points.map((p: any) => p.pnl));
    const p2 = Math.max(...currentPoints.map((p: any) => p.pnl));
    return Math.max(p1, p2);
  }, [points, currentPoints]);

  const maxPnLScale = useMemo(() => {
    const peak = Math.max(Math.abs(minPnL), Math.abs(maxPnLValue));
    // Fit the curve vertically: use the peak profit/loss with a 20% buffer
    // Minimum floor of $1.00 to avoid extreme magnification on flat lines
    return Math.max(peak * 1.2, 1.0);
  }, [minPnL, maxPnLValue]);
  
  const margin = 40;
  const width = 640;
  const height = 270;

  const xScale = (price: number) => {
    const minPrice = points[0]?.price || underlying_price - 10;
    const maxPrice = points[points.length - 1]?.price || underlying_price + 10;
    const diff = maxPrice - minPrice;
    return margin + ((price - minPrice) / (diff || 1)) * (width - 2 * margin);
  };

  const yScale = (pnl: number) => {
    // Center Y at 0
    return height / 2 - (pnl / maxPnLScale) * (height / 2 - margin);
  };

  const linePath = useMemo(() => {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.price)} ${yScale(p.pnl)}`).join(' ');
  }, [points]);

  const currentLinePath = useMemo(() => {
    return currentPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.price)} ${yScale(p.pnl)}`).join(' ');
  }, [currentPoints]);

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
        // Crossing zero - guard against division by zero
        const abs1 = Math.abs(p1.pnl);
        const abs2 = Math.abs(p2.pnl);
        const totalAbs = abs1 + abs2;
        const midX = totalAbs === 0 ? x1 : x1 + (x2 - x1) * (abs1 / totalAbs);
        
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
  }, [points, zoomLevel]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    
    // Map screen-pixel x to viewBox coordinate space (640 units wide)
    const xInViewBox = (e.clientX - rect.left) * (width / rect.width);
    
    // Use the viewBox coordinate for scaling
    const minPrice = points[0].price;
    const maxPrice = points[points.length - 1].price;
    const price = minPrice + ((xInViewBox - margin) / (width - 2 * margin)) * (maxPrice - minPrice);
    
    if (price >= minPrice && price <= maxPrice) {
      setHoverData({ 
        price, 
        pnl: calculatePnL(price), 
        currentPnl: calculateTheoreticalPnL(price, legs as any),
        x: xInViewBox 
      });
    }
  };

  return (
    <div className="bg-gray-950/60 p-4 rounded-xl border border-gray-800/50 mt-4 overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black tracking-widest text-gray-500 uppercase">Analysis Curve © EXP & NOW</span>
          <div className="flex items-center gap-1.5 bg-gray-950 rounded-xl p-1.5 border border-white/5 shadow-2xl">
            <button 
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setZoomLevel((prev: number) => Math.min(prev * 1.5, 5.0));
              }}
              className="p-2.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-white active:scale-90 border border-transparent hover:border-white/10"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="w-[1px] h-5 bg-white/10 mx-0.5" />
            <button 
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setZoomLevel((prev: number) => Math.max(prev / 1.5, 0.005));
              }}
              className="p-2.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-white active:scale-90 border border-transparent hover:border-white/10"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-[1px] h-5 bg-white/10 mx-0.5" />
            <button 
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setZoomLevel(1.0);
              }}
              className="p-2.5 bg-white/5 hover:bg-emerald-500/20 rounded-lg transition-all text-gray-400 hover:text-emerald-400 active:scale-90 border border-transparent hover:border-emerald-500/20"
              title="Reset View"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
            <span className="text-[10px] font-bold text-gray-400">Profit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-rose-500/50" />
            <span className="text-[10px] font-bold text-gray-400">Loss</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-1 rounded-full bg-orange-500" />
            <span className="text-[10px] font-bold text-gray-400">Current P/L</span>
          </div>
        </div>
      </div>

      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full h-auto overflow-visible cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverData(null)}
      >
        {/* Grids */}
        <line x1={margin} y1={yScale(0)} x2={width - margin} y2={yScale(0)} stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />
        
        {/* Shaded Areas */}
        <path d={areas.profit} fill="#10b981" fillOpacity="0.15" />
        <path d={areas.loss} fill="#f43f5e" fillOpacity="0.15" />

        {/* Payoff Line (Expiration) */}
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" />

        {/* Payoff Line (Current Theoretical) */}
        <path d={currentLinePath} fill="none" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" strokeDasharray="4 2" />

        {/* Strike Markers */}
        {(legs || []).map((leg, i) => (
          <g key={`strike-${i}`}>
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

        {/* Inspection Marker */}
        {hoverData && (
          <g>
            <line 
              x1={hoverData.x} 
              y1={margin} 
              x2={hoverData.x} 
              y2={height - margin} 
              stroke="#3b82f6" 
              strokeWidth="1" 
              strokeDasharray="4 4"
              className="pointer-events-none"
            />
            <circle cx={hoverData.x} cy={yScale(hoverData.pnl)} r="4" fill="#3b82f6" stroke="#fff" strokeWidth="1" />
            <circle cx={hoverData.x} cy={yScale(hoverData.currentPnl)} r="4" fill="#f97316" stroke="#fff" strokeWidth="1" />
            
            {/* Tooltip background */}
            <rect 
              x={hoverData.x > width / 2 ? hoverData.x - 80 : hoverData.x + 10} 
              y={Math.min(yScale(hoverData.pnl), yScale(hoverData.currentPnl)) - 50} 
              width="70" 
              height="40" 
              rx="6" 
              fill="#1e293b" 
              className="shadow-2xl"
              fillOpacity="0.9"
            />
            <text 
              x={hoverData.x > width / 2 ? hoverData.x - 45 : hoverData.x + 45} 
              y={Math.min(yScale(hoverData.pnl), yScale(hoverData.currentPnl)) - 35} 
              textAnchor="middle" 
              className="text-[9px] font-bold fill-gray-400"
            >
              EXP: <tspan className="fill-blue-400">
                {hoverData.pnl >= 0 ? '+' : '-'}${Math.abs(hoverData.pnl).toFixed(2)}
              </tspan>
            </text>
            <text 
              x={hoverData.x > width / 2 ? hoverData.x - 45 : hoverData.x + 45} 
              y={Math.min(yScale(hoverData.pnl), yScale(hoverData.currentPnl)) - 22} 
              textAnchor="middle" 
              className="text-[9px] font-bold fill-gray-400"
            >
              NOW: <tspan className="fill-orange-400">
                {hoverData.currentPnl >= 0 ? '+' : '-'}${Math.abs(hoverData.currentPnl).toFixed(2)}
              </tspan>
            </text>
            <text 
              x={hoverData.x} 
              y={height - margin - 5} 
              textAnchor="middle" 
              className="text-[9px] font-mono fill-blue-400 bg-black"
            >
              ${hoverData.price.toFixed(2)}
            </text>
          </g>
        )}

        {/* X-Axis */}
        <line x1={margin} y1={height - margin + 20} x2={width - margin} y2={height - margin + 20} stroke="#1e293b" strokeWidth="1" />
        {[0, 0.25, 0.5, 0.75, 1].map((pct: number, i: number) => {
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
        {[1, 0.5, 0, -0.5, -1].map((pct: number, i: number) => {
          const pnl = maxPnLScale * pct;
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
               {maxPnLValue > 1000 ? 'Uncapped' : `$${maxPnLValue.toFixed(2)}`}
             </span>
           </div>
           <div>
             <span className="text-[9px] text-gray-600 block uppercase font-bold">Max Loss</span>
             <span className="text-xs font-mono text-rose-400 font-bold">
               {minPnL >= 0 ? '$0.00' : minPnL < -1000 ? 'Uncapped' : `$${Math.abs(minPnL).toFixed(2)}`}
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
