import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { SplashLoader } from '../components/Loader';

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = () => {
    setIsLoading(true);
    // Simulate initialization delay
    setTimeout(() => {
      navigate('/earn');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-zii-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-zii-accent/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-zii-highlight/5 rounded-full blur-[100px]" />

      {/* Full Screen Loader Overlay */}
      {isLoading && <SplashLoader className="animate-in fade-in duration-300" />}

      <div className="relative z-10 flex flex-col items-center text-center space-y-8 max-w-sm w-full">
        <div className="flex items-center justify-center w-20 h-20 bg-white/5 rounded-3xl border border-white/10 mb-2 shadow-2xl backdrop-blur-sm rotate-3 hover:rotate-6 transition-transform duration-500 group">
          {/* Custom Z Icon */}
          <svg viewBox="0 0 24 24" className="w-10 h-10 text-zii-accent drop-shadow-[0_0_8px_rgba(39,241,199,0.5)] transition-all group-hover:drop-shadow-[0_0_15px_rgba(39,241,199,0.8)]" fill="none" xmlns="http://www.w3.org/2000/svg">
             <path d="M4 4L20 4L4 20L20 20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        
        <div className="space-y-3">
          <h1 className="text-6xl font-black tracking-tighter text-white">
            Zii<span className="text-zii-accent">.</span>
          </h1>
        </div>

        <div className="py-6">
          <p className="text-white/50 leading-relaxed text-lg">
            Predict & Win on real daily events.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-4 opacity-70">
            {['Drama', 'Prices', 'Music', 'Trends'].map((tag) => (
               <span key={tag} className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-white/5 border border-white/5 text-zii-highlight">{tag}</span>
            ))}
          </div>
        </div>

        <button 
          onClick={handleStart}
          className="group relative w-full bg-white text-black font-bold text-lg py-5 rounded-2xl flex items-center justify-center gap-2 hover:bg-zii-accent transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(39,241,199,0.4)] active:scale-[0.98]"
        >
          Start Earning
          <ChevronRight className="group-hover:translate-x-1 transition-transform" />
        </button>
        
        <p className="text-[10px] text-white/20 pt-8 uppercase tracking-widest font-medium">
          Join 200,000+ earning with Zii
        </p>
      </div>
    </div>
  );
};