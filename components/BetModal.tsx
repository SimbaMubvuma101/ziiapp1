import React, { useState, useMemo } from 'react';
import { Prediction } from '../types';
import { X, ArrowRight, TrendingUp, DollarSign, HelpCircle } from 'lucide-react';
import { Loader } from './Loader';
import { FIXED_PAYOUT_AMOUNT, calculateAMMOdds } from '../utils/amm';
import { useAuth } from '../contexts/AuthContext';

interface EntryModalProps {
  prediction: Prediction | null;
  isLoading?: boolean;
  onClose: () => void;
  onPlaceEntry: (optionId: string, amount: number) => void;
}

export const EntryModal: React.FC<EntryModalProps> = ({ prediction, isLoading = false, onClose, onPlaceEntry }) => {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const { currencySymbol, exchangeRate } = useAuth();

  const effectiveMultiplier = prediction?.multiplier || 1;
  const currentPayoutUsd = FIXED_PAYOUT_AMOUNT * effectiveMultiplier;
  const currentPayoutScaled = currentPayoutUsd * exchangeRate;

  // Client-Side Price Fallback for Modal
  const displayOptions = useMemo(() => {
    if (!prediction) return [];
    // Always recalculate if liquidity pool is available
    if (prediction.liquidity_pool && Object.keys(prediction.liquidity_pool).length > 0) {
        const { updatedOptions } = calculateAMMOdds(
            prediction.options, 
            prediction.liquidity_pool,
            prediction.created_at,
            prediction.closes_at,
            effectiveMultiplier
        );
        return updatedOptions;
    }
    return prediction.options;
  }, [prediction, effectiveMultiplier]);

  if (!prediction) return null;

  const currentOption = displayOptions.find(o => o.id === selectedOptionId);
  const entryCostUsd = currentOption?.price || 0;
  const entryCostScaled = entryCostUsd * exchangeRate;
  
  const potentialProfitScaled = currentPayoutScaled - entryCostScaled;

  const handleConfirm = () => {
    if (selectedOptionId && !isLoading) {
      // NOTE: We always pass the USD amount to the betting logic
      onPlaceEntry(selectedOptionId, entryCostUsd);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-zii-card border-t sm:border border-white/10 sm:rounded-2xl rounded-t-3xl p-6 pb-safe shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto no-scrollbar"
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Pick a Winner</h3>
          </div>
          <button onClick={onClose} disabled={isLoading} className="p-2 bg-white/5 rounded-full text-white/40 hover:text-white disabled:opacity-50 transition-colors">
            <X size={20} />
          </button>
        </div>

        <p className="text-white font-medium mb-6 text-xl leading-tight">
          {prediction.question}
        </p>

        <div className={`space-y-3 mb-6 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
          {displayOptions.map((opt) => {
              const priceScaled = (opt.price || 0) * exchangeRate;
              return (
                <button
                key={opt.id}
                onClick={() => setSelectedOptionId(opt.id)}
                className={`w-full flex justify-between items-center p-4 rounded-xl border transition-all ${
                    selectedOptionId === opt.id
                    ? 'bg-white text-black border-white font-bold shadow-lg shadow-white/10 scale-[1.02]'
                    : 'bg-black/40 border-white/5 text-white/70 hover:bg-black/60 hover:border-white/10'
                }`}
                >
                <span className="text-sm font-medium">{opt.label}</span>
                <div className="text-right">
                    <span className={`block text-[10px] uppercase tracking-wide opacity-60 ${selectedOptionId === opt.id ? 'text-black' : 'text-white/40'}`}>
                        Buy Now
                    </span>
                    <span className={`text-lg font-mono font-bold ${selectedOptionId === opt.id ? 'text-black' : 'text-zii-accent'}`}>
                    {currencySymbol}{priceScaled.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </span>
                </div>
                </button>
              );
          })}
        </div>

        {/* How it works explanation */}
        {!selectedOptionId && (
            <div className="bg-white/5 p-4 rounded-xl border border-white/5 mb-4">
                <div className="flex items-center gap-2 mb-2 text-white/80 font-bold text-sm">
                    <HelpCircle size={14} className="text-zii-accent" />
                    How does this work?
                </div>
                <p className="text-xs text-white/50 leading-relaxed">
                    1. You pick an outcome (e.g. "Yes").<br/>
                    2. You pay the price shown.<br/>
                    3. If you are correct, your ticket is redeemed for <strong className="text-white">{currencySymbol}{currentPayoutScaled.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong>.<br/>
                    4. If incorrect, the ticket expires at 0.
                </p>
            </div>
        )}

        {selectedOptionId && currentOption && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            
            {/* Simple Payout Explanation Card */}
            <div className="bg-black/30 p-5 rounded-2xl border border-white/10 mb-6 relative overflow-hidden">
               {/* Background Glow */}
               <div className="absolute top-0 right-0 w-32 h-32 bg-zii-accent/10 blur-[40px] rounded-full pointer-events-none"></div>

               <div className="relative z-10 space-y-4">
                   {/* Row 1: Cost */}
                   <div className="flex justify-between items-center">
                       <span className="text-sm text-white/60 font-medium">You Pay Now</span>
                       <span className="text-lg font-mono font-bold text-white">{currencySymbol}{entryCostScaled.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                   </div>

                   {/* Divider */}
                   <div className="h-px w-full bg-white/10"></div>

                   {/* Row 2: Payout */}
                   <div className="flex justify-between items-center">
                       <span className="text-sm text-white/60 font-medium flex items-center gap-1">
                          <TrendingUp size={14} className="text-zii-accent" /> If You Win, You Get
                       </span>
                       <span className="text-2xl font-mono font-black text-zii-accent">{currencySymbol}{currentPayoutScaled.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                   </div>

                   {/* Row 3: Profit */}
                   <div className="flex justify-end">
                       <div className="bg-green-500/10 px-2 py-1 rounded text-[11px] font-bold text-green-400 flex items-center gap-1 border border-green-500/20">
                           <span>Profit: {currencySymbol}{potentialProfitScaled.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                       </div>
                   </div>
               </div>
            </div>

            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="w-full bg-zii-accent text-black font-bold text-lg py-4 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-zii-accent/20 disabled:opacity-70 disabled:grayscale"
            >
              {isLoading ? (
                <>
                  <Loader className="text-black" size={20} /> 
                  <span>Confirming...</span>
                </>
              ) : (
                <>
                  <span>Buy "{currentOption.label}"</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};