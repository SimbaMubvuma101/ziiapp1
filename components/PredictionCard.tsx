import React, { useState, useMemo, useEffect } from 'react';
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
  const [animateBars, setAnimateBars] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const { currencySymbol, exchangeRate } = useAuth();

  // Trigger animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setAnimateBars(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Countdown Timer Logic
  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const closeTime = new Date(prediction.closes_at).getTime();
      const diff = closeTime - now;

      if (diff <= 0) {
        setTimeLeft('Closed');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`Closes in ${hours}h ${minutes}m ${seconds}s`);
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [prediction.closes_at]);

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

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareText = `🔥 Predict & Win ${currencySymbol}${currentPayoutScaled.toLocaleString()}!\n\n"${prediction.question}"\n\nPlay on Zii: ${window.location.href}`;
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
      className="bg-zii-card rounded-2xl p-4 border border-white/5 active:border-zii-accent/30 transition-all cursor-pointer shadow-sm hover:shadow-md relative overflow-hidden group"
    >
      {/* Header Row */}
      <div className="flex flex-row items-center justify-between mb-2 gap-2 relative z-20">
        <div className="flex items-center gap-2 overflow-hidden">
            <span className="px-2 py-0.5 rounded bg-white/5 text-[9px] uppercase font-extrabold tracking-wide text-zii-highlight whitespace-nowrap border border-white/5 flex-shrink-0">
            {prediction.category}
            </span>
            {/* Country Badge */}
            {flag && <span className="text-xs opacity-50 grayscale group-hover:grayscale-0 transition-all" title={prediction.country}>{flag}</span>}
            {/* Creator Badge */}
            {prediction.created_by_creator && prediction.creator_name && (
              <span className="px-2 py-0.5 rounded bg-purple-500/10 text-[9px] uppercase font-bold tracking-wide text-purple-300 whitespace-nowrap border border-purple-500/20 flex-shrink-0">
                Sponsored by {prediction.creator_name}
              </span>
            )}
        </div>
        
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-[10px] text-white/40 whitespace-nowrap flex-shrink-0 mr-1 font-medium">
                <span className="flex items-center gap-1">
                    <Users size={11} /> {prediction.pool_size.toLocaleString()}
                </span>
                <span className={`flex items-center gap-1 ${timeLeft === 'Closed' ? 'text-red-400' : 'text-zii-accent'}`}>
                    <Clock size={11} /> {timeLeft}
                </span>
            </div>
            
            <button 
                type="button"
                onClick={handleShare}
                className={`p-1.5 rounded-full transition-all border ${justShared ? 'bg-zii-accent text-black border-zii-accent' : 'bg-white/5 text-white/40 border-white/5 hover:text-white'}`}
            >
                <Share2 size={13} />
            </button>
        </div>
      </div>

      {/* Question */}
      <h3 className="text-base font-bold text-white mb-3 leading-snug relative z-20 pr-4">
        {prediction.question}
      </h3>

      {/* Options List (Price Display) */}
      <div className="space-y-1.5 relative z-20">
        {displayOptions.slice(0, 3).map((opt) => {
            // SAFE ACCESS: fallback to 0 if undefined
            const priceUsd = opt.price || 0;
            const priceScaled = priceUsd * exchangeRate;
            
            // Probability calc needs to use the USD payout for ratio, or Scaled/Scaled (same ratio)
            // Use animateBars state to trigger transition from 0
            const probability = (priceUsd / currentPayoutUsd) * 100;
            const width = animateBars ? probability : 0;
            
            return (
                <div key={opt.id} className="relative w-full h-10 bg-black/40 rounded-lg border border-white/5 overflow-hidden flex items-center px-3 justify-between group-hover:border-white/10 transition-colors">
                    {/* Progress Bar Background */}
                    <div 
                        className="absolute left-0 top-0 bottom-0 bg-white/5 transition-all duration-1000 ease-out" 
                        style={{ width: `${width}%` }}
                    />
                    
                    <span className="relative z-10 text-xs font-bold text-white/90 truncate mr-2">
                        {opt.label}
                    </span>

                    <div className="relative z-10 flex items-center gap-2">
                         <div className="flex flex-col items-end leading-none">
                            <span className="text-[9px] text-white/40 uppercase font-bold tracking-wider mb-0.5">Buy</span>
                            <span className="text-xs font-mono font-bold text-zii-accent">{currencySymbol}{priceScaled.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                         </div>
                    </div>
                </div>
            );
        })}
        {displayOptions.length > 3 && (
            <p className="text-[10px] text-center text-white/30 pt-0.5">
                + {displayOptions.length - 3} more options
            </p>
        )}
      </div>

      {/* Footer Info - Simplified explanation */}
      <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between relative z-20">
         <div className="flex items-center gap-1.5 text-[10px] text-white/60 font-medium bg-white/5 px-2.5 py-1.5 rounded-lg w-full">
             <Info size={13} className="text-zii-accent shrink-0" />
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