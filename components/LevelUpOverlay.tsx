import React, { useEffect } from 'react';
import { Zap, Trophy, X } from 'lucide-react';
import confetti from 'canvas-confetti';

interface LevelUpOverlayProps {
  newLevel: number;
  reward?: number;
  onClose: () => void;
}

export const LevelUpOverlay: React.FC<LevelUpOverlayProps> = ({ newLevel, reward, onClose }) => {
  useEffect(() => {
    const duration = 2500;
    const end = Date.now() + duration;

    confetti({
        particleCount: 150,
        spread: 120,
        origin: { y: 0.6 },
        colors: ['#27F1C7', '#ffffff'],
        zIndex: 200
    });
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-300 p-4" onClick={onClose}>
      <div className="w-full max-w-xs text-center relative">
        
        {/* Animated Badge */}
        <div className="w-32 h-32 mx-auto bg-gradient-to-tr from-zii-accent to-zii-highlight rounded-full flex items-center justify-center mb-8 shadow-[0_0_60px_rgba(39,241,199,0.4)] ring-4 ring-black animate-[bounce_2s_infinite]">
             <div className="w-28 h-28 bg-black rounded-full flex flex-col items-center justify-center border-4 border-zii-accent/50">
                <span className="text-4xl font-black text-white italic">{newLevel}</span>
                <span className="text-[8px] font-bold uppercase tracking-widest text-zii-accent">LEVEL</span>
             </div>
        </div>

        <h2 className="text-4xl font-black text-white tracking-tighter mb-2 italic transform -skew-x-6">LEVEL UP!</h2>
        <p className="text-white/60 font-medium mb-8">You are crushing it.</p>

        {reward && (
            <div className="bg-zii-accent/10 border border-zii-accent/30 rounded-2xl p-4 mb-8 animate-in slide-in-from-bottom-4 delay-150">
                <div className="flex items-center justify-center gap-2 mb-1">
                    <Trophy size={18} className="text-zii-accent" />
                    <span className="text-xs font-bold text-zii-accent uppercase tracking-widest">Milestone Reward</span>
                </div>
                <p className="text-2xl font-black text-white">+{reward} COINS</p>
            </div>
        )}

        <button className="bg-white text-black font-black text-lg py-4 px-12 rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/20">
            CONTINUE
        </button>
      </div>
    </div>
  );
};
