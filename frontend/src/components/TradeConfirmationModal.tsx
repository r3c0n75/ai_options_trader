import * as React from 'react';
import { useState } from 'react';
import { X, ArrowRight, Zap, Shield, HelpCircle, CheckCircle2, AlertCircle } from 'lucide-react';

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
}

interface TradeConfirmationModalProps {
  isOpen: boolean;
  trade: Recommendation | null;
  onClose: () => void;
  onConfirm: (trade: Recommendation, quantity: number) => Promise<void>;
}

export const TradeConfirmationModal: React.FC<TradeConfirmationModalProps> = ({ isOpen, trade, onClose, onConfirm }) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
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
        await onConfirm(trade, quantity);
        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err.message || 'Trade execution failed');
      }
    }
  };

  const handleClose = () => {
    if (status === 'success') {
      // Logic handled by caller or parent? 
      // Actually, let's pass a specialized callback or just close and let parent handle.
      // Better: trigger onClose, then parent decides.
    }
    setStatus('idle');
    setErrorMessage('');
    onClose();
  };

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
                {status === 'success' ? 'Order Successful' : status === 'error' ? 'Order Failed' : 'Confirm Trade'}
              </h2>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mt-0.5">{trade.strategy}</p>
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

              <div className="bg-gray-800/30 border border-gray-700/30 rounded-2xl p-5 space-y-4">
                 <div className="flex justify-between items-center">
                   <label className="text-sm font-bold text-gray-300 flex items-center gap-2">
                     Contracts / Shares Quantity 
                     <HelpCircle className="w-4 h-4 text-gray-500" />
                   </label>
                   <input 
                     type="number"
                     min="1"
                     value={quantity || ''}
                     onChange={handleQuantityChange}
                     className="bg-black/50 border border-gray-700 rounded-xl px-4 py-2 w-24 text-right font-mono text-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-bold"
                   />
                 </div>
                 
                 {trade.diagram_data.legs && trade.diagram_data.legs.length > 0 && (
                   <div className="pt-4 border-t border-gray-700/50">
                       <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">Order Implication</div>
                       <div className="grid grid-cols-2 gap-2">
                         {trade.diagram_data.legs.map((leg: StrategyLeg, i: number) => (
                           <div key={i} className="bg-black/30 p-2.5 rounded-xl border border-gray-800/50 flex align-middle justify-between">
                             <span className="text-xs font-mono text-gray-400 my-auto">{leg.type} {leg.strike}</span>
                             <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${leg.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                {leg.side} {quantity}
                             </span>
                           </div>
                         ))}
                       </div>
                   </div>
                 )}
              </div>
              
              <div className="pt-2 flex gap-3">
                 <button 
                   onClick={handleClose}
                   className="flex-1 px-4 py-3.5 rounded-xl border border-gray-700 text-gray-300 font-bold hover:bg-gray-800 hover:text-white transition-all duration-200"
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={handleConfirm}
                   disabled={quantity <= 0}
                   className="flex-1 px-4 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold shadow-lg shadow-blue-500/25 transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   Submit Order
                   <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
                 </button>
              </div>
              
              {trade.strategy.toLowerCase() === 'covered call' && (
                 <div className="flex gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-xs font-semibold">
                   <Shield className="w-5 h-5 shrink-0" />
                   <p>This Covered Call order will automatically simulate a Buy-Write (purchasing 100 shares of {trade.symbol} per contract) if you do not already own the required underlying equity.</p>
                 </div>
              )}
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

          {status === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 animate-in zoom-in duration-500">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-white">Order Confirmed</h3>
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
