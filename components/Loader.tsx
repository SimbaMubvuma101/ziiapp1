import React from 'react';

interface LoaderProps {
  size?: number;
  className?: string;
}

export const Loader: React.FC<LoaderProps> = ({ size = 24, className = "" }) => {
  return (
    <svg 
      viewBox="0 0 24 24" 
      width={size}
      height={size}
      className={`animate-spin ${className}`}
      style={{ animationDuration: '2s' }}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        d="M4 4L20 4L4 20L20 20" 
        stroke="currentColor" 
        strokeWidth="4" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </svg>
  );
};

export const SplashLoader: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`fixed inset-0 z-[9999] bg-[#0F172A] flex flex-col items-center justify-center ${className}`}>
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-zii-accent/10 rounded-full blur-[100px]" />
    <Loader size={60} className="text-zii-accent relative z-10" />
    <p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.3em] mt-8 animate-pulse relative z-10 font-mono">
      Loading Zii...
    </p>
  </div>
);