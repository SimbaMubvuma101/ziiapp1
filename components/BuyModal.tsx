import React, { useState } from 'react';
import { X, ChevronRight, DollarSign } from 'lucide-react';
import { WHATSAPP_PHONE } from '../constants';
import { useAuth } from '../contexts/AuthContext';

interface BuyModalProps {
  onClose: () => void;
}

export const BuyModal: React.FC<BuyModalProps> = ({ onClose }) => {
  const { currentUser, currencySymbol, exchangeRate } = useAuth();
  const [amountUsd, setAmountUsd] = useState<string>('10');

  const coins = parseInt(amountUsd) || 0;
  // Cost is 1:1 with Coins (in USD base)
  const costUsd = coins;
  const costScaled = costUsd * exchangeRate;

  // Base presets in USD
  const presetsUsd = [5, 10, 20, 50];

  const handleContinue = () => {
    if (coins <= 0) return;
    
    // Construct dynamic message with User ID for Admin Minting
    const userId = currentUser?.uid || 'Unknown';
    // We send the message showing the LOCAL currency cost for clarity for the user
    const message = `Hello! I want to buy ${coins} Zii Coins. (Cost: ${currencySymbol}${costScaled.toLocaleString()})\n\nMy ID: ${userId}`;
    const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
    
    window.open(url, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      {/* Click backdrop to close */}
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <div className="w-full max-w-xs sm:max-w-sm bg-zii-card border border-white/10 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 relative z-10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-white">Top Up Wallet</h3>
          <button onClick={onClose} className="p-2 -mr-2 text-white/40 hover:text-white rounded-full hover:bg-white/5 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3 block">
              How many coins?
            </label>
            <div className="relative">
              <input
                type="number"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-3xl font-bold text-white focus:outline-none focus:border-zii-accent/50 transition-colors placeholder:text-white/10 text-center"
                placeholder="0"
                autoFocus
              />
            </div>
            
            {/* Quick Select Presets (Showing Coins) */}
            <div className="flex justify-center gap-2 mt-3 flex-wrap">
              {presetsUsd.map(val => (
                <button
                  key={val}
                  onClick={() => setAmountUsd(val.toString())}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    coins === val 
                    ? 'bg-white text-black border-white' 
                    : 'bg-white/5 text-white/50 border-transparent hover:bg-white/10'
                  }`}
                >
                  {val} Coins
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-r from-zii-card to-white/5 p-5 rounded-2xl border border-white/5 flex flex-col items-center gap-1">
            <span className="text-xs font-medium text-white/50">You Pay</span>
            <div className="flex items-center gap-1 text-zii-accent">
                <span className="text-4xl font-bold tracking-tight">{currencySymbol}{costScaled.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
            </div>
            <span className="text-[10px] text-white/20 font-medium tracking-wide mt-1">Exchange Rate: 1 Coin = {currencySymbol}{exchangeRate.toFixed(0)}</span>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
             <p className="text-[10px] text-white/40 text-center">
                Your User ID will be automatically attached to the WhatsApp message so we can credit your account.
             </p>
          </div>

          <button
            onClick={handleContinue}
            disabled={coins <= 0}
            className="w-full bg-white text-black font-bold text-lg py-4 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-zii-accent disabled:opacity-50 disabled:grayscale shadow-lg shadow-white/5"
          >
            Buy Now <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};