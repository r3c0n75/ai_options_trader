import * as React from 'react';
import { useState } from 'react';
import { X, ArrowRight, Zap, HelpCircle, CheckCircle2, AlertCircle, Info } from 'lucide-react';

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
  quantity?: number;
  entry_price?: number;
}

interface TradeConfirmationModalProps {
  isOpen: boolean;
  trade: Recommendation | null;
  mode?: 'create' | 'update';
  onClose: () => void;
  onConfirm: (trade: Recommendation, quantity: number, limitPrice?: number) => Promise<any>;
}

export const TradeConfirmationModal: React.FC<TradeConfirmationModalProps> = ({ 
  isOpen, 
  trade, 
  mode = 'create',
  onClose, 
  onConfirm 
}) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [limitPrice, setLimitPrice] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [orderStatus, setOrderStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [availableExpirations, setAvailableExpirations] = useState<string[]>([]);
  const [selectedHorizon, setSelectedHorizon] = useState<'Weekly' | 'Monthly' | 'LEAPS'>('Monthly');
  const [isRepricing, setIsRepricing] = useState(false);
  const [internalTrade, setInternalTrade] = useState<Recommendation | null>(null);

  const initialTradeRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (trade && isOpen) {
      const tradeId = `${trade.symbol}-${trade.strategy}-${trade.expiration}`;
      if (initialTradeRef.current !== tradeId) {
        setQuantity(typeof trade.quantity === 'number' && trade.quantity > 0 ? trade.quantity : 1);
        
        let price = 0;
        if (typeof trade.entry_price === 'number') {
           price = trade.entry_price;
        } else if (trade.target_entry) {
          const cleanEntry = trade.target_entry.replace(/Strike\s+\d+(\.\d+)?/gi, '');
          const match = cleanEntry.match(/[-+]?[0-9]*\.?[0-9]+/);
          if (match) {
            price = parseFloat(match[0]);
          }
        }
        
        const isCreditStrat = trade.strategy?.toLowerCase().includes('credit') || 
                             trade.strategy?.toLowerCase().includes('condor') ||
                             trade.strategy?.toLowerCase().includes('sell');
        
        if (isCreditStrat && price < 0) {
          setLimitPrice(Math.abs(price));
        } else {
          setLimitPrice(price || (price === 0 ? 0 : null));
        }
        
        initialTradeRef.current = tradeId;
      }
    } else if (!isOpen) {
      initialTradeRef.current = null;
    }
  }, [trade, isOpen]);

  React.useEffect(() => {
    if (isOpen && trade?.symbol) {
      const fetchExpirations = async () => {
        try {
          // Fix: Backend routes don't have /api prefix
          const response = await fetch(`http://localhost:8000/options/expirations/${trade.symbol}`);
          const dates = await response.json();
          // Ensure we got an array to prevent .filter crash
          setAvailableExpirations(Array.isArray(dates) ? dates : []);
          
          if (trade.expiration) {
            const expDate = parseLocalDate(trade.expiration);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const daysTo = (expDate.getTime() - today.getTime()) / (1000 * 3600 * 24);
            
            if (daysTo < 12) setSelectedHorizon('Weekly');
            else if (daysTo < 270) setSelectedHorizon('Monthly');
            else setSelectedHorizon('LEAPS');
          }
          
          setInternalTrade(trade);
        } catch (err) {
          console.error("Failed to fetch expirations", err);
          setAvailableExpirations([]);
        }
      };
      fetchExpirations();
    }
  }, [isOpen, trade?.symbol, trade?.strategy]);

  const handleReprice = async (date: string) => {
    if (!trade || isRepricing) return;
    setIsRepricing(true);
    try {
      // Fix: Backend route is /options/reprice
      const response = await fetch('http://localhost:8000/options/reprice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: trade.symbol,
          strategy: trade.strategy,
          expiration: date
        })
      });
      if (response.ok) {
        const newTrade = await response.json();
        if (newTrade) {
          setInternalTrade({
            ...trade,
            ...newTrade,
            quantity: quantity
          });
          if (typeof newTrade.entry_price === 'number') {
            setLimitPrice(Math.abs(newTrade.entry_price));
          }
        }
      }
    } catch (err) {
      console.error("Repricing failed", err);
    } finally {
      setIsRepricing(false);
    }
  };

  /**
   * Helper to normalize dates from YYMMDD (OCC) or YYYY-MM-DD to standard YYYY-MM-DD
   */
  const normalizeDate = (dateStr: string): string => {
    if (!dateStr) return '';
    if (dateStr.includes('-')) return dateStr;
    if (dateStr.length === 6) {
      return `20${dateStr.substring(0, 2)}-${dateStr.substring(2, 4)}-${dateStr.substring(4, 6)}`;
    }
    return dateStr;
  };

  /**
   * Helper to parse anything into a local Date without timezone shifts
   */
  const parseLocalDate = (dateStr: string) => {
    const normalized = normalizeDate(dateStr);
    if (!normalized) return new Date();
    const [year, month, day] = normalized.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const currentTrade = internalTrade || trade;

  if (!isOpen || !currentTrade) return null;

  const getFilteredExpirations = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today to midnight local
    
    if (!Array.isArray(availableExpirations)) return [];
    
    return availableExpirations.filter(date => {
      const d = parseLocalDate(date);
      const diff = (d.getTime() - today.getTime()) / (1000 * 3600 * 24);
      
      // Increased weekly range to 21 days for better visibility
      if (selectedHorizon === 'Weekly') return diff < 21 && diff >= 0;
      if (selectedHorizon === 'Monthly') return diff >= 21 && diff < 270;
      return diff >= 270;
    });
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val > 0) {
      setQuantity(val);
    } else if (e.target.value === '') {
      setQuantity(0);
    }
  };

  const handleConfirm = async () => {
    if (quantity > 0 && currentTrade) {
      setStatus('processing');
      try {
        const strategyName = currentTrade.strategy?.toLowerCase() || '';
        const isCreditStrat = strategyName.includes('credit') || 
                             strategyName.includes('condor') ||
                             strategyName.includes('sell');
        
        let finalPrice = limitPrice || 0;
        if (isCreditStrat && finalPrice > 0) {
          finalPrice = -finalPrice;
        }

        const result = await onConfirm(currentTrade, quantity, finalPrice || undefined);
        setOrderStatus(result?.status || 'ACCEPTED');
        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err.message || 'Trade execution failed');
      }
    }
  };

  const handleClose = () => {
    setStatus('idle');
    setOrderStatus('');
    setErrorMessage('');
    onClose();
  };

  const currentStrategy = currentTrade.strategy?.toLowerCase() || '';
  const isCreditStrat = currentStrategy.includes('credit') || 
                       currentStrategy.includes('condor') ||
                       currentStrategy.includes('sell');
  const isCredit = (isCreditStrat && Math.abs(limitPrice || 0) >= 0) || (limitPrice || 0) < 0;

  // Use optional chaining for safety
  const legs = currentTrade.diagram_data?.legs || [];
  const spreadWidth = legs.length === 2 
    ? Math.abs(legs[0].strike - legs[1].strike)
    : 0;
  const isSuspiciousPrice = (limitPrice || 0) > 10 || (spreadWidth > 0 && (limitPrice || 0) > spreadWidth);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in">
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-3xl shadow-2xl w-full max-w-lg mx-4 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full" />
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full" />
        
        <div className="relative z-10 flex justify-between items-start mb-6 border-b border-gray-800/50 pb-4">
          <div className="flex gap-4 items-center">
            <div className="p-3 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-2xl shadow-inner">
              <Zap className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">
                {status === 'success' 
                  ? (orderStatus === 'FILLED' ? 'Order Executed' : 'Order Working') 
                  : status === 'error' ? 'Order Failed' : (mode === 'update' ? 'Update Order' : 'Optimize Strategy')}
              </h2>
              <p className="text-xs text-gray-400 font-black uppercase tracking-[0.2em] mt-0.5">
                {currentTrade.strategy}
              </p>
            </div>
          </div>
          {status !== 'processing' && (
            <button onClick={handleClose} className="p-2 text-gray-500 hover:text-white hover:bg-gray-800/50 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="relative z-10 space-y-6">
          {status === 'idle' && (
            <>
              <div className="flex items-center justify-between bg-black/40 border border-gray-800/50 rounded-2xl p-5">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Asset</div>
                  <div className="text-2xl font-black text-gray-200">{currentTrade.symbol}</div>
                </div>
                
                <div className="text-right">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Expiration</div>
                  <div className="text-sm font-bold text-blue-400">{currentTrade.expiration}</div>
                </div>
                
                <div className="text-right">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Side</div>
                  <div className={`text-sm font-bold px-3 py-1 rounded-lg ${currentTrade.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-orange-500/20 text-orange-400 border border-orange-500/20'}`}>
                    {currentTrade.side}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
                  {(['Weekly', 'Monthly', 'LEAPS'] as const).map((horizon) => (
                    <button
                      key={horizon}
                      onClick={() => setSelectedHorizon(horizon)}
                      className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                        selectedHorizon === horizon 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                        : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {horizon}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-1">
                    {getFilteredExpirations().map((date) => (
                    <button
                      key={date}
                      onClick={() => handleReprice(date)}
                      disabled={isRepricing}
                      className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                        normalizeDate(currentTrade.expiration) === normalizeDate(date) 
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' 
                        : 'bg-gray-800/40 border-white/5 text-gray-500 hover:border-white/10'
                      } ${isRepricing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {parseLocalDate(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                    </button>
                  ))}
                  {getFilteredExpirations().length === 0 && (
                    <div className="text-[10px] text-gray-600 italic py-2 px-2">No expirations in this range</div>
                  )}
                </div>
                
                {selectedHorizon === 'LEAPS' && (
                  <div className="flex gap-2 items-center px-1">
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-[9px] font-black text-rose-500/80 uppercase tracking-tighter">LEAPS liquidity is low • Expect slow fill</span>
                  </div>
                )}
              </div>

              <div className="bg-gray-800/20 border border-white/5 rounded-3xl p-6 space-y-4">
                 <div className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5">
                   <div className="space-y-1">
                     <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                       Contracts / Qty
                     </label>
                     <div className="text-xs text-gray-400 font-medium">Size of the package</div>
                   </div>
                   <input 
                     type="number"
                     min="1"
                     value={quantity || ''}
                     onChange={handleQuantityChange}
                     className="bg-gray-900 border border-white/10 rounded-xl px-4 py-3 w-28 text-right font-mono text-xl text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-black shadow-inner"
                   />
                 </div>

                 <div className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5">
                   <div className="space-y-1">
                     <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                       Limit Price (Premium)
                     </label>
                     <div className={`text-[10px] font-black uppercase tracking-widest ${isCredit ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isCredit ? 'Strategy Net Credit' : 'Strategy Net Debit'}
                     </div>
                   </div>
                   <div className="relative group">
                     <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono font-bold">$</span>
                     <input 
                       type="number"
                       step="0.01"
                       value={limitPrice === null ? '' : limitPrice}
                       onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
                       className={`bg-gray-900 border ${isSuspiciousPrice ? 'border-orange-500/50' : 'border-white/10'} rounded-xl pl-8 pr-4 py-3 w-36 text-right font-mono text-xl text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-black shadow-inner`}
                     />
                   </div>
                 </div>

                 {isSuspiciousPrice && (
                    <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-xl flex gap-3 animate-in slide-in-from-top-2">
                      <AlertCircle className="w-5 h-5 text-orange-400 shrink-0" />
                      <div className="text-[10px] text-orange-200/80 leading-relaxed">
                        <b className="text-orange-400 block mb-0.5 uppercase">Price Warning:</b>
                        Your limit price (${limitPrice}) seems unusually high for this strategy. 
                        Limit price is the <b>premium per share</b>, not the strike price. 
                        For a ${spreadWidth || 1} wide spread, a typical fill is under $1.00.
                      </div>
                    </div>
                  )}

                 <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-xl transition-all duration-500 ${
                   isCredit 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                 }`}>
                   <div className="flex items-center gap-3">
                     <div className={`p-2 rounded-lg ${isCredit ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
                       <Zap className="w-4 h-4" />
                     </div>
                     <span className="text-xs font-black uppercase tracking-wider">
                       {isCredit ? 'Total Credit to Receive' : 'Total Debit to Pay'}
                     </span>
                   </div>
                   <span className="text-xl font-black font-mono">
                     ${Math.abs((limitPrice || 0) * quantity * 100).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                   </span>
                 </div>
                 
                 {legs.length > 0 && (
                    <div className="pt-1">
                        <div className="grid grid-cols-1 gap-2">
                          {legs.map((leg: StrategyLeg, i: number) => (
                            <div key={i} className="bg-black/20 p-2.5 rounded-2xl border border-white/5 flex align-middle justify-between group hover:bg-black/40 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className={`w-1 h-8 rounded-full ${leg.side === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{leg.side} {leg.type}</span>
                                  <span className="text-xs font-bold text-gray-300 italic">Strike {leg.strike}</span>
                                </div>
                              </div>
                              <div className="text-right flex flex-col justify-center">
                                <span className="text-[9px] font-mono text-gray-500">{currentTrade.symbol}</span>
                                <span className="text-[10px] font-black text-gray-400">{quantity} Contract(s)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                    </div>
                  )}
              </div>
              
              <div className="pt-2 flex gap-3">
                 <button 
                   onClick={handleClose}
                   className="flex-1 px-4 py-3.5 rounded-2xl border border-white/10 text-gray-400 font-black uppercase tracking-widest text-[11px] hover:bg-white/5 hover:text-white transition-all duration-200"
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={handleConfirm}
                   disabled={quantity <= 0 || limitPrice === null || isRepricing}
                   className="flex-[2] px-4 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black uppercase tracking-widest text-[11px] shadow-lg shadow-blue-500/25 transition-all duration-200 flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {isRepricing ? 'Repricing...' : (mode === 'update' ? 'Update Order' : 'Submit Order')}
                   <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
                 </button>
              </div>
              
              <div className="flex gap-3 p-3 bg-gray-800/40 border border-gray-700/50 rounded-xl text-gray-400 text-[10px] leading-relaxed italic">
                 <Info className="w-4 h-4 shrink-0 text-blue-400" />
                 <p>Note: Limit prices for options are per share. $1.00 premium = $100 per contract. If your order is not filling, try lowering your credit or raising your debit.</p>
              </div>
            </>
          )}

          {status === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                <Zap className="w-6 h-6 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-white">Execution in Progress</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-[280px]">
                  Verifying equity settlement and submitting option contracts. Please do not close this window.
                </p>
              </div>
            </div>
          )}

          {status === 'success' && orderStatus === 'FILLED' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 animate-in zoom-in duration-500">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-white">Order Filled</h3>
                <p className="text-sm text-gray-400 mt-2">
                  Successfully executed {quantity}x {currentTrade.symbol} {currentTrade.strategy}.
                </p>
                <p className="text-xs text-emerald-400/70 mt-1 font-bold">Click "Done" below to view your position.</p>
              </div>
              <button 
                onClick={handleClose}
                className="w-full px-4 py-3.5 rounded-xl bg-gray-800 text-white font-bold hover:bg-gray-700 transition-all border border-gray-700"
              >
                Done
              </button>
            </div>
          )}

          {status === 'success' && orderStatus !== 'FILLED' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
               <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20 animate-in zoom-in duration-500">
                <div className="relative">
                  <div className="w-10 h-10 border-2 border-blue-400/20 border-t-blue-400 rounded-full animate-spin" />
                  <HelpCircle className="w-5 h-5 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-white">Order Working</h3>
                <p className="text-sm text-gray-400 mt-2">
                  Your limit order for {quantity}x {currentTrade.symbol} has been submitted.
                </p>
                <p className="text-xs text-blue-400/70 mt-3 font-bold px-6 leading-relaxed">
                  The order is currently <b>Pending</b> in the market. It will fill once the limit price is reached.
                </p>
              </div>
              <button 
                onClick={handleClose}
                className="w-full px-4 py-3.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/25"
              >
                Done
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center border border-rose-500/20">
                <AlertCircle className="w-10 h-10 text-rose-400" />
              </div>
              <div className="text-center px-4">
                <h3 className="text-xl font-bold text-white">Order Failed</h3>
                <p className="text-sm text-gray-400 mt-2 line-clamp-3">
                  {errorMessage}
                </p>
              </div>
              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setStatus('idle')}
                  className="flex-1 px-4 py-3.5 rounded-xl bg-gray-800 text-white font-bold hover:bg-gray-700 transition-all border border-gray-700"
                >
                  Try Again
                </button>
                <button 
                  onClick={handleClose}
                  className="flex-1 px-4 py-3.5 rounded-xl border border-gray-700 text-gray-400 font-bold hover:bg-gray-800 transition-all"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
