import React, { useState, useMemo } from 'react';
import { Prediction } from '../types';
import { Clock, Users, Share2, DollarSign, Info } from 'lucide-react';
import { FIXED_PAYOUT_AMOUNT, calculateAMMOdds } from '../utils/amm';
import { useAuth } from '../contexts/AuthContext';
import { SUPPORTED_COUNTRIES } from '../constants';

interface PredictionCardProps {
  prediction: Prediction;
  onSelect: (prediction: Prediction) => void;
  isAdmin?: boolean;
}

export const PredictionCard: React.FC<PredictionCardProps> = ({ prediction, onSelect, isAdmin }) => {
  const [justShared, setJustShared] = useState(false);
  const { currencySymbol, exchangeRate } = useAuth();

  // Determine current payout based on mode/multiplier
  const effectiveMultiplier = prediction.multiplier || 1;
  const currentPayoutUsd = FIXED_PAYOUT_AMOUNT * effectiveMultiplier;
  const currentPayoutScaled = currentPayoutUsd * exchangeRate;

  // Client-Side Price Calculation with Zii Pricing Engine
  const displayOptions = useMemo(() => {
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

  const deadlineDate = new Date(prediction.closes_at);
  const isThisYear = deadlineDate.getFullYear() === new Date().getFullYear();
  
  const deadline = deadlineDate.toLocaleString(undefined, {
    month: 'short', 
    day: 'numeric',
    year: isThisYear ? undefined : '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  });

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareText = `🔥 Predict on this Zii event:\n\n"${prediction.question}"\n\nPlay & Win here: ${window.location.href}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, '_blank');
    setJustShared(true);
    setTimeout(() => setJustShared(false), 2000);
  };

  // Flag Helper: Retrieves flag from constants based on country code
  const flag = SUPPORTED_COUNTRIES.find(c => c.code === (prediction.country || 'ZW'))?.flag;

  return (
    <div 
      onClick={() => onSelect(prediction)}
      className="bg-zii-card rounded-2xl p-5 border border-white/5 active:border-zii-accent/30 transition-all cursor-pointer shadow-sm hover:shadow-md relative overflow-hidden group"
    >
      {/* Header Row */}
      <div className="flex flex-row items-center justify-between mb-3 gap-2 relative z-20">
        <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded bg-white/5 text-[9px] uppercase font-extrabold tracking-wide text-zii-highlight whitespace-nowrap border border-white/5 flex-shrink-0">
            {prediction.category}
            </span>
            {/* Country Badge */}
            {flag && <span className="text-xs opacity-50 grayscale group-hover:grayscale-0 transition-all" title={prediction.country}>{flag}</span>}
        </div>
        
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-[10px] text-white/40 whitespace-nowrap flex-shrink-0 mr-1 font-medium">
                <span className="flex items-center gap-1">
                    <Users size={12} /> {prediction.pool_size.toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                    <Clock size={12} /> Ends {deadline}
                </span>
            </div>
            
            <button 
                type="button"
                onClick={handleShare}
                className={`p-1.5 rounded-full transition-all border ${justShared ? 'bg-zii-accent text-black border-zii-accent' : 'bg-white/5 text-white/40 border-white/5 hover:text-white'}`}
            >
                <Share2 size={14} />
            </button>
        </div>
      </div>

      {/* Question */}
      <h3 className="text-lg font-bold text-white mb-4 leading-tight relative z-20 pr-8">
        {prediction.question}
      </h3>

      {/* Options List (Price Display) */}
      <div className="space-y-2 relative z-20">
        {displayOptions.slice(0, 3).map((opt) => {
            // SAFE ACCESS: fallback to 0 if undefined
            const priceUsd = opt.price || 0;
            const priceScaled = priceUsd * exchangeRate;
            
            // Probability calc needs to use the USD payout for ratio, or Scaled/Scaled (same ratio)
            const probability = (priceUsd / currentPayoutUsd) * 100;
            
            return (
                <div key={opt.id} className="relative w-full h-11 bg-black/40 rounded-lg border border-white/5 overflow-hidden flex items-center px-3 justify-between group-hover:border-white/10 transition-colors">
                    {/* Progress Bar Background */}
                    <div 
                        className="absolute left-0 top-0 bottom-0 bg-white/5 transition-all duration-500" 
                        style={{ width: `${probability}%` }}
                    />
                    
                    <span className="relative z-10 text-xs font-bold text-white/90 truncate mr-2">
                        {opt.label}
                    </span>

                    <div className="relative z-10 flex items-center gap-2">
                         <div className="flex flex-col items-end leading-none">
                            <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Buy Now</span>
                            <span className="text-sm font-mono font-bold text-zii-accent">{currencySymbol}{priceScaled.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                         </div>
                    </div>
                </div>
            );
        })}
        {displayOptions.length > 3 && (
            <p className="text-[10px] text-center text-white/30 pt-1">
                + {displayOptions.length - 3} more options
            </p>
        )}
      </div>

      {/* Footer Info - Simplified explanation */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between relative z-20">
         <div className="flex items-center gap-1.5 text-[10px] text-white/60 font-medium bg-white/5 px-3 py-1.5 rounded-lg w-full">
             <Info size={14} className="text-zii-accent shrink-0" />
             <span className="leading-tight">
               If you win, you get <span className="text-white font-bold text-xs">{currencySymbol}{currentPayoutScaled.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>.
             </span>
         </div>
      </div>
      
      {/* Admin Indicator */}
      {isAdmin && (
         <div className="absolute inset-0 border-2 border-red-500/20 rounded-2xl pointer-events-none z-0"></div>
      )}
    </div>
  );
};