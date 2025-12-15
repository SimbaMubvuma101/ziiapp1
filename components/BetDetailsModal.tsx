import React, { useState, useEffect } from 'react';
import { UserEntry, Prediction } from '../types';
import { X, TrendingUp, DollarSign, Wallet, Clock, Info, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface BetDetailsModalProps {
  entry: UserEntry;
  prediction?: Prediction | null;
  onClose: () => void;
}

export const BetDetailsModal: React.FC<BetDetailsModalProps> = ({ entry, prediction, onClose }) => {
  const { currencySymbol, exchangeRate } = useAuth();
  
  const amountScaled = (entry.amount || 0) * exchangeRate;
  const payoutScaled = (entry.potential_payout || 0) * exchangeRate;
  const profitScaled = payoutScaled - amountScaled;
  
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!prediction) return;
    
    const calculateTime = () => {
        const now = new Date().getTime();
        const closeTime = new Date(prediction.closes_at).getTime();
        const diff = closeTime - now;
        
        if (diff <= 0) {
            setTimeLeft('Closed');
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (days > 0) {
             setTimeLeft(`${days}d ${hours}h ${minutes}m`);
        } else {
             setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [prediction]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      {/* Click backdrop to close */}
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <div className="w-full max-w-sm bg-zii-card border border-white/10 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 relative z-10">
        {/* Header with Countdown */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                 <Wallet size={18} className="text-zii-accent" /> Ticket Details
            </h3>
            {prediction && prediction.status === 'open' && (
                <div className="flex items-center gap-1.5 mt-1 text-zii-highlight">
                    <Clock size={12} />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider">Closes in {timeLeft}</span>
                </div>
            )}
            {(!prediction || prediction.status !== 'open') && (
                <div className="flex items-center gap-1.5 mt-1 text-white/40">
                    <Clock size={12} />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider">Event Closed</span>
                </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-white/40 hover:text-white rounded-full hover:bg-white/5 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Question & Pick */}
          <div>
             <h4 className="text-white font-medium text-lg leading-tight mb-2">{entry.prediction_question}</h4>
             <div className="inline-flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Your Pick</span>
                <span className="text-sm font-bold text-white uppercase">{(entry.selected_option_label || entry.selected_option_id).replace(/_/g, ' ')}</span>
             </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
             <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-1">Price Paid</p>
                <p className="text-xl font-mono font-bold text-white">{currencySymbol}{amountScaled.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
             </div>
             <div className="bg-black/20 p-4 rounded-xl border border-white/5 relative overflow-hidden">
                <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                   Payout <span className="text-[9px] bg-white/10 px-1 rounded text-white/50">If Win</span>
                </p>
                <p className="text-xl font-mono font-bold text-zii-accent">{currencySymbol}{payoutScaled.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
             </div>
          </div>

          {/* Profit Highlight */}
          <div className="bg-gradient-to-r from-green-500/10 to-transparent p-4 rounded-xl border border-green-500/20">
             <div className="flex items-center justify-between mb-1">
                 <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                        <TrendingUp size={16} />
                    </div>
                    <div>
                        <span className="text-sm font-bold text-green-100 block leading-none">Potential Profit</span>
                        <span className="text-[10px] text-green-400/60 font-medium">If outcome is correct</span>
                    </div>
                 </div>
                 <span className="text-2xl font-mono font-black text-green-400 tracking-tight">
                    +{currencySymbol}{profitScaled.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                 </span>
             </div>
          </div>

          {/* Source of Truth (Optional) */}
          {prediction && prediction.resolution_source && (
             <div className="flex gap-2 items-start bg-white/5 p-3 rounded-lg border border-white/5">
                <ShieldCheck size={14} className="text-white/40 shrink-0 mt-0.5" />
                <div>
                    <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-0.5">Resolution Source</p>
                    <p className="text-[11px] text-white/80 leading-relaxed font-medium">
                        {prediction.resolution_source}
                    </p>
                </div>
             </div>
          )}

          {/* Info Note */}
           <div className="flex gap-2 items-start bg-blue-500/5 p-3 rounded-lg border border-blue-500/10">
              <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-200/70 leading-relaxed">
                  This payout is only credited to your wallet if your prediction matches the final official outcome.
              </p>
           </div>
          
          <button 
            onClick={onClose}
            className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};