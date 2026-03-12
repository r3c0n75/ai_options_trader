import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData } from 'lightweight-charts';
import { Maximize2, Minimize2, Clock, Calendar } from 'lucide-react';

export const SymbolChart = ({ symbol, onClose, hideHeader }: { symbol: string, onClose?: () => void, hideHeader?: boolean }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [period, setPeriod] = useState<'1D' | '1M' | '3M' | '12M'>('3M');
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 400,
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`http://localhost:8000/stocks/${symbol}/bars?period=${period}`);
        const data = await response.json();
        
        if (seriesRef.current && Array.isArray(data)) {
          const formattedData = data.map(item => ({
            time: (new Date(item.time).getTime() / 1000),
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
          })).sort((a, b) => a.time - b.time);
          
          seriesRef.current.setData(formattedData as CandlestickData[]);
          chartRef.current?.timeScale().fitContent();
        }
      } catch (error) {
        console.error('Error fetching bar data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [symbol, period]);


  useEffect(() => {
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };

    // Trigger resize when isFullscreen changes
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFullscreen]);

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden backdrop-blur-md transition-all duration-300 flex flex-col ${
      isFullscreen ? 'fixed inset-0 z-[100] !rounded-none' : 'relative h-full min-h-[500px]'
    }`}>
      {!hideHeader && (
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950/40 shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <span className="text-blue-400">{symbol}</span> Historical Data
              </h2>
              <div className="flex items-center gap-4 mt-1">
                <div className="flex bg-black/40 p-1 rounded-lg border border-gray-800">
                  {(['1D', '1M', '3M', '12M'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`px-3 py-1 rounded text-[10px] font-black tracking-widest uppercase transition-all ${period === p ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                    >
                      {p === '1D' ? <Clock className="w-3 h-3 inline mr-1" /> : <Calendar className="w-3 h-3 inline mr-1" />}
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-gray-400 hover:text-white transition-colors bg-white/5 rounded-lg"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            {onClose && (
              <button 
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-rose-400 transition-colors bg-white/5 rounded-lg"
              >
                <Minimize2 className="w-5 h-5 rotate-45" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="relative flex-1 bg-gray-950/20">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/40 backdrop-blur-[2px]">
            <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}
        
        {/* Floating Controls for when header is hidden */}
        {hideHeader && (
          <div className="absolute top-4 left-4 z-10 flex bg-black/60 backdrop-blur-md p-1 rounded-xl border border-white/10 shadow-xl overflow-hidden">
            {(['1D', '1M', '3M', '12M'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-1.5
                  ${period === p 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                {p === '1D' ? <Clock className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Floating Fullscreen toggle for when header is hidden */}
        {hideHeader && (
          <div className="absolute top-4 right-4 z-10">
             <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2.5 text-gray-400 hover:text-white transition-all bg-black/60 backdrop-blur-md border border-white/10 rounded-xl shadow-xl hover:scale-105 active:scale-95"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        )}

        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
      
      <div className="p-3 bg-gray-950 border-t border-gray-800 text-[10px] text-gray-600 font-mono flex justify-between shrink-0">
        <span>TradingView™ Lightweight Charts</span>
        <span>Interactive View • {period} Interval • {isFullscreen ? 'Fullscreen' : 'Desktop'} Mode</span>
      </div>
    </div>
  );
};
