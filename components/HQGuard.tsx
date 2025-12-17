
import React, { useState, useEffect } from 'react';
import { Lock, ShieldAlert, ArrowRight } from 'lucide-react';
import { Loader } from './Loader';

const SECRET_CODE = 'ZII2025';

interface HQGuardProps {
  children: React.ReactNode;
}

export const HQGuard: React.FC<HQGuardProps> = ({ children }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if already authorized in this session
    const authorized = sessionStorage.getItem('hq_authorized');
    if (authorized === 'true') {
      setIsAuthorized(true);
    }
    setLoading(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (code.toUpperCase() === SECRET_CODE) {
      sessionStorage.setItem('hq_authorized', 'true');
      setIsAuthorized(true);
    } else {
      setError('Invalid access code');
      setCode('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zii-bg flex items-center justify-center">
        <Loader size={50} className="text-zii-accent" />
      </div>
    );
  }

  if (isAuthorized) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 relative overflow-hidden animate-in fade-in duration-300">
      <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-[80px]" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-zii-accent/5 rounded-full blur-[80px]" />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/30 text-red-500 animate-pulse">
            <ShieldAlert size={32} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter mb-2">HQ ACCESS</h1>
          <p className="text-white/40 text-sm text-center">Restricted Area - Authorization Required</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
              <Lock size={16} />
              <span className="leading-tight font-bold">{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Access Code</label>
            <div className="relative">
              <div className="absolute left-4 top-3.5 text-white/30">
                <Lock size={18} />
              </div>
              <input
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoFocus
                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-base text-white placeholder:text-white/20 focus:outline-none focus:border-red-500/50 focus:bg-black/40 transition-all font-mono tracking-widest uppercase"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-red-500 text-white font-bold py-4 rounded-xl mt-6 hover:bg-red-600 transition-all duration-300 shadow-lg shadow-red-500/20 active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-wider"
          >
            Authenticate <ArrowRight size={18} />
          </button>
        </form>

        <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/5 text-center">
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-1">Security Notice</p>
          <p className="text-xs text-white/40">Access code required for HQ operations</p>
        </div>
      </div>
    </div>
  );
};
