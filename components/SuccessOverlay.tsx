import React, { useEffect } from 'react';
import { Check } from 'lucide-react';

interface SuccessOverlayProps {
  message: string;
  onDismiss: () => void;
}

export const SuccessOverlay: React.FC<SuccessOverlayProps> = ({ message, onDismiss }) => {
  useEffect(() => {
    // Auto dismiss after 2.5 seconds for a slightly longer "Success" moment
    const timer = setTimeout(onDismiss, 2500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0A0A0F]/95 backdrop-blur-xl animate-in fade-in duration-300 cursor-pointer" 
      onClick={onDismiss}
    >
      <div className="flex flex-col items-center animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 text-center px-6 max-w-xs">
        
        {/* Animated Check Circle */}
        <div className="w-24 h-24 bg-zii-accent rounded-full flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(39,241,199,0.3)] ring-4 ring-black scale-100 animate-[bounce_1s_ease-in-out_1]">
          <Check size={48} className="text-black" strokeWidth={4} />
        </div>
        
        <h2 className="text-3xl font-black text-white tracking-tighter leading-none mb-2">
          {message}
        </h2>
        
        <p className="text-white/50 text-sm font-medium">
          Good luck! You can track this in Active Bets.
        </p>

        <div className="mt-12 h-1 w-24 bg-white/10 rounded-full overflow-hidden">
           <div className="h-full bg-zii-accent w-full animate-[shrink_2.5s_linear_forwards] origin-left"></div>
        </div>
      </div>
      
      {/* Inline style for the progress bar animation since it's specific */}
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};