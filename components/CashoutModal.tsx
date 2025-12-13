import React, { useState } from 'react';
import { X, ArrowUpRight, DollarSign, Wallet } from 'lucide-react';
import { WHATSAPP_PHONE } from '../constants';
import { useAuth } from '../contexts/AuthContext';

interface CashoutModalProps {
  balance: number; // This is the SCALED balance passed from Wallet
  onClose: () => void;
}

export const CashoutModal: React.FC<CashoutModalProps> = ({ balance, onClose }) => {
  const { currentUser, currencySymbol } = useAuth();
  const [amount, setAmount] = useState<string>('');
  const [error, setError] = useState('');

  const withdrawAmount = parseFloat(amount) || 0;
  
  // Commission Logic (10%)
  const fee = withdrawAmount * 0.10;
  const netAmount = withdrawAmount - fee;

  const handleContinue = () => {
    setError('');
    
    if (withdrawAmount <= 0) {
        setError("Please enter a valid amount.");
        return;
    }
    
    if (withdrawAmount > balance) {
        setError("Insufficient balance.");
        return;
    }

    // Construct dynamic message
    const userId = currentUser?.uid || 'Unknown';
    const message = `Hello Zii Team! 💸\n\nI would like to request a cashout.\n\nGross Amount: ${currencySymbol}${withdrawAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}\nService Fee (10%): -${currencySymbol}${fee.toLocaleString(undefined, {minimumFractionDigits: 2})}\n\nNET TO RECEIVE: ${currencySymbol}${netAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}\n\nMy User ID: ${userId}\n\nPlease let me know the next steps for EcoCash/InnBucks transfer.`;
    const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
    
    window.open(url, '_blank');
    onClose();
  };

  const setMax = () => {
      // Set to floor to avoid float precision issues in text input
      setAmount(Math.floor(balance).toString());
      setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <div className="w-full max-w-xs sm:max-w-sm bg-zii-card border border-white/10 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 relative z-10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ArrowUpRight size={20} className="text-zii-accent" />
            Request Cashout
          </h3>
          <button onClick={onClose} className="p-2 -mr-2 text-white/40 hover:text-white rounded-full hover:bg-white/5 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          
          {/* Balance Display */}
          <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
             <span className="text-xs font-bold text-white/50 uppercase tracking-wide">Available Winnings</span>
             <span className="text-lg font-mono font-bold text-white">{currencySymbol}{balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
          </div>

          <div>
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3 block">
              Withdrawal Amount ({currencySymbol})
            </label>
            <div className="relative">
              <div className="absolute left-4 top-4 text-white/30 font-mono font-bold text-xl">
                  {currencySymbol}
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(''); }}
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-10 pr-20 text-3xl font-bold text-white focus:outline-none focus:border-zii-accent/50 transition-colors placeholder:text-white/10"
                placeholder="0.00"
                autoFocus
              />
              <button 
                onClick={setMax}
                className="absolute right-3 top-3.5 bg-white/10 hover:bg-white/20 text-xs font-bold text-zii-accent px-3 py-1.5 rounded-lg transition-colors"
              >
                MAX
              </button>
            </div>
            {error && <p className="text-red-400 text-xs mt-2 pl-1 font-medium">{error}</p>}
          </div>

          {/* Breakdown Card */}
          {withdrawAmount > 0 && (
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-2 animate-in fade-in slide-in-from-top-1">
                  <div className="flex justify-between items-center text-xs text-white/50">
                      <span>Service Fee (10%)</span>
                      <span>-{currencySymbol}{fee.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div className="h-px bg-white/5 w-full"></div>
                  <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white uppercase tracking-wide">Net To Receive</span>
                      <span className="text-lg font-black font-mono text-zii-accent">{currencySymbol}{netAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
              </div>
          )}

          <div className="bg-blue-500/5 p-3 rounded-xl border border-blue-500/10">
             <p className="text-[10px] text-blue-200/60 leading-relaxed flex gap-2">
                <Wallet size={14} className="shrink-0 mt-0.5" />
                Requests are processed between 8AM and 8PM SAST and typically sent via mobile money within 2 hours.
             </p>
          </div>

          <button
            onClick={handleContinue}
            disabled={!withdrawAmount || withdrawAmount <= 0}
            className="w-full bg-zii-accent text-black font-bold text-lg py-4 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-white disabled:opacity-50 disabled:grayscale shadow-lg shadow-zii-accent/20"
          >
            Request on WhatsApp <ArrowUpRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};