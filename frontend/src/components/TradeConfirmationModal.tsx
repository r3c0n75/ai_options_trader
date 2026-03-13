import * as React from 'react';
import { useState } from 'react';
import { X, ArrowRight, Zap, Shield, HelpCircle, CheckCircle2, AlertCircle, Info } from 'lucide-react';

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

  // Use a ref to prevent re-initializing when the trade prop updates due to background polling
  const initialTradeRef = React.useRef<string | null>(null);

  // Sync state when trade changes or modal opens
  React.useEffect(() => {
    if (trade && isOpen) {
      // Create a unique key for the trade strategy/symbol
      const tradeId = `${trade.symbol}-${trade.strategy}-${trade.expiration}`;
      
      // Only initialize state if the modal just opened or if we've switched to a different trade asset
      if (initialTradeRef.current !== tradeId) {
        setQuantity(typeof trade.quantity === 'number' && trade.quantity > 0 ? trade.quantity : 1);
        
        // Extract numeric limit price from target_entry string (e.g "$1.20 Credit") or use entry_price
        let price = 0;
        if (trade.target_entry) {
          // Strip non-numbers but keep decimals and minus sign
          const match = trade.target_entry.match(/[-+]?[0-9]*\.?[0-9]+/);
          if (match) {
            price = parseFloat(match[0]);
          }
        } else if ((trade as any).entry_price) {
          price = (trade as any).entry_price;
        }
        
        // Alpaca uses negative for credit, but UI shows positive for user convenience
        // We'll keep it positive in state if it's a known credit strategy
        const isCreditStrat = trade.strategy.toLowerCase().includes('credit') || 
                             trade.strategy.toLowerCase().includes('condor') ||
                             trade.strategy.toLowerCase().includes('sell'); // Include "Spread Sell"
        
        if (isCreditStrat && price < 0) {
          setLimitPrice(Math.abs(price));
        } else {
          setLimitPrice(price || (price === 0 ? 0 : null));
        }
        
        initialTradeRef.current = tradeId;
      }
    } else if (!isOpen) {
      // Reset ref when modal closes so it can re-initialize on next open
      initialTradeRef.current = null;
    }
  }, [trade, isOpen]);
  
  if (!isOpen || !trade) return null;

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val > 0) {
      setQuantity(val);
    } else if (e.target.value === '') {
      setQuantity(0);
    }
  };

  const handleConfirm = async () => {
    if (quantity > 0) {
      setStatus('processing');
      try {
        // If it's a credit strategy and we have a positive number, negate it for the backend/Alpaca
        const isCreditStrat = trade.strategy.toLowerCase().includes('credit') || 
                             trade.strategy.toLowerCase().includes('condor') ||
                             trade.strategy.toLowerCase().includes('sell');
        
        let finalPrice = limitPrice || 0;
        if (isCreditStrat && finalPrice > 0) {
          finalPrice = -finalPrice;
        }

        const result = await onConfirm(trade, quantity, finalPrice || undefined);
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

  const isCreditStrat = trade.strategy.toLowerCase().includes('credit') || 
                       trade.strategy.toLowerCase().includes('condor') ||
                       trade.strategy.toLowerCase().includes('sell');
  
  // Logic: It's a credit if it's a credit strategy and price is positive, OR if price is negative
  const isCredit = (isCreditStrat && (limitPrice || 0) >= 0) || (limitPrice || 0) < 0;

  // Safety check for unrealistic limit prices
  const spreadWidth = trade.diagram_data.legs && trade.diagram_data.legs.length === 2 
    ? Math.abs(trade.diagram_data.legs[0].strike - trade.diagram_data.legs[1].strike)
    : 0;
  
  const isSuspiciousPrice = (limitPrice || 0) > 10 || (spreadWidth > 0 && (limitPrice || 0) > spreadWidth);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in">
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-3xl shadow-2xl w-full max-w-lg mx-4 relative overflow-hidden">
        {/* Animated Background Gradients */}
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
                  : status === 'error' ? 'Order Failed' : (mode === 'update' ? 'Update Order' : 'Confirm Trade')}
              </h2>
              <p className="text-xs text-gray-400 font-black uppercase tracking-[0.2em] mt-0.5">{trade.strategy}</p>
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
                  <div className="text-2xl font-black text-gray-200">{trade.symbol}</div>
                </div>
                
                <div className="text-right">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Expiration</div>
                  <div className="text-sm font-bold text-blue-400">{trade.expiration}</div>
                </div>
                
                <div className="text-right">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Side</div>
                  <div className={`text-sm font-bold px-3 py-1 rounded-lg ${trade.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-orange-500/20 text-orange-400 border border-orange-500/20'}`}>
                    {trade.side}
                  </div>
                </div>
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
                     <div className={`text-[10px] font-bold uppercase tracking-widest ${isCredit ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isCredit ? 'Net Credit per share' : 'Net Debit per share'}
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
                 
                 {trade.diagram_data.legs && trade.diagram_data.legs.length > 0 && (
                   <div className="pt-1">
                       <div className="grid grid-cols-1 gap-2">
                         {trade.diagram_data.legs.map((leg: StrategyLeg, i: number) => (
                           <div key={i} className="bg-black/20 p-2.5 rounded-2xl border border-white/5 flex align-middle justify-between group hover:bg-black/40 transition-colors">
                             <div className="flex items-center gap-3">
                               <div className={`w-1 h-8 rounded-full ${leg.side === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                               <div className="flex flex-col">
                                 <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{leg.side} {leg.type}</span>
                                 <span className="text-xs font-bold text-gray-300 italic">Strike {leg.strike}</span>
                               </div>
                             </div>
                             <div className="text-right flex flex-col justify-center">
                               <span className="text-[9px] font-mono text-gray-500">{trade.symbol}</span>
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
                   disabled={quantity <= 0 || limitPrice === null}
                   className="flex-[2] px-4 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black uppercase tracking-widest text-[11px] shadow-lg shadow-blue-500/25 transition-all duration-200 flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {mode === 'update' ? 'Update Order' : 'Submit Order'}
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
                  Successfully executed {quantity}x {trade.symbol} {trade.strategy}.
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
                  Your limit order for {quantity}x {trade.symbol} has been submitted.
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
