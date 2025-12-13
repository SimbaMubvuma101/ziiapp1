import React, { useEffect } from 'react';
import { UserEntry } from '../types';
import { Trophy, ArrowUpRight, X, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../contexts/AuthContext';

interface CelebrationModalProps {
  entries: UserEntry[];
  onClose: () => void;
  onCashout: () => void;
}

export const CelebrationModal: React.FC<CelebrationModalProps> = ({ entries, onClose, onCashout }) => {
  const { currencySymbol, exchangeRate } = useAuth();
  
  // Calculate total in USD then scale
  const totalWonUsd = entries.reduce((acc, curr) => acc + (curr.potential_payout || 0), 0);
  const totalWonScaled = totalWonUsd * exchangeRate;

  useEffect(() => {
    // Trigger Confetti on Mount
    const duration = 3000;
    const end = Date.now() + duration;

    confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#27F1C7', '#33B6FF', '#FFD700'],
        zIndex: 200
    });

    const interval = setInterval(() => {
        if (Date.now() > end) {
            return clearInterval(interval);
        }
        confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#27F1C7', '#33B6FF'],
            zIndex: 200
        });
        confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#27F1C7', '#33B6FF'],
            zIndex: 200
        });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300 p-4">
      <div className="w-full max-w-sm bg-[#1E293B] border border-yellow-500/30 rounded-3xl p-6 shadow-[0_0_50px_rgba(234,179,8,0.2)] animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 relative overflow-hidden">
        
        {/* Background Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-[60px] pointer-events-none"></div>

        <div className="relative z-10 flex flex-col items-center text-center">
            
            <div className="w-20 h-20 bg-gradient-to-tr from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-yellow-500/20 ring-4 ring-black">
                <Trophy size={40} className="text-black fill-black/20" strokeWidth={2.5} />
            </div>

            <h2 className="text-3xl font-black text-white tracking-tighter mb-1">YOU WON!</h2>
            <p className="text-white/60 text-sm font-medium mb-6">Welcome back, Champion.</p>

            <div className="w-full bg-black/40 rounded-2xl border border-white/5 p-4 mb-6">
                <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Total Winnings</p>
                <p className="text-4xl font-black text-yellow-500 tracking-tight flex justify-center items-start gap-1">
                    <span className="text-2xl mt-1">{currencySymbol}</span>{totalWonScaled.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </p>
            </div>

            <div className="w-full space-y-2 mb-8 max-h-[120px] overflow-y-auto no-scrollbar">
                {entries.map(entry => {
                    const payoutScaled = (entry.potential_payout || 0) * exchangeRate;
                    return (
                        <div key={entry.id} className="flex justify-between items-center text-xs p-2 rounded-lg bg-white/5 border border-white/5">
                            <span className="text-white/70 truncate max-w-[180px] font-medium">{entry.prediction_question}</span>
                            <span className="text-green-400 font-bold font-mono">+{currencySymbol}{payoutScaled.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                    );
                })}
            </div>

            <div className="w-full space-y-3">
                <button 
                    onClick={onCashout}
                    className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold py-4 rounded-xl hover:from-yellow-400 hover:to-yellow-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20 active:scale-[0.98]"
                >
                    <ArrowUpRight size={20} strokeWidth={2.5} /> Cash Out Now
                </button>
                <button 
                    onClick={onClose}
                    className="w-full bg-white/5 text-white/50 font-bold py-4 rounded-xl hover:bg-white/10 hover:text-white transition-all active:scale-[0.98]"
                >
                    Keep Playing
                </button>
            </div>

        </div>
      </div>
    </div>
  );
};