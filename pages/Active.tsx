import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { Loader } from '../components/Loader';
import { Trophy, Clock, Zap } from 'lucide-react';
import { UserEntry } from '../types';

export const Active: React.FC = () => {
  const { userProfile } = useAuth();
  const [activeEntries, setActiveEntries] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveEntries();

    // Poll for updates
    const interval = setInterval(fetchActiveEntries, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchActiveEntries = async () => {
    try {
      const entries = await api.getEntries('active');
      setActiveEntries(entries);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching entries:', err);
      setLoading(false);
    }
  };

  const getTimeRemaining = (closesAt: string) => {
    const now = new Date();
    const closes = new Date(closesAt);
    const diff = closes.getTime() - now.getTime();

    if (diff <= 0) return 'Closed';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }

    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zii-bg flex items-center justify-center">
        <Loader size={50} className="text-zii-accent" />
      </div>
    );
  }

  if (activeEntries.length === 0) {
    return (
      <div className="min-h-screen bg-zii-bg flex flex-col items-center justify-center p-6">
        <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6">
          <Trophy size={40} className="text-white/20" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">No Active Predictions</h2>
        <p className="text-white/40 text-sm text-center max-w-xs">
          Head to the Feed to make your first prediction and start winning!
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zii-bg pb-24 px-4 pt-6 animate-in fade-in">
      <h1 className="text-2xl font-black text-white mb-6 tracking-tight">
        Active Predictions ({activeEntries.length})
      </h1>

      <div className="space-y-4">
        {activeEntries.map((entry) => (
          <div 
            key={entry.id} 
            className="bg-zii-card rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-all"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white mb-1 leading-snug">
                  {entry.prediction_question}
                </h3>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Zap size={12} className="text-zii-accent" />
                  <span className="font-bold">{entry.selected_option_label}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-black/20 rounded-xl p-3 border border-white/5">
              <div className="text-center">
                <p className="text-[9px] text-white/40 uppercase font-bold mb-1">Staked</p>
                <p className="text-sm font-bold font-mono text-white">${entry.amount.toFixed(2)}</p>
              </div>
              <div className="text-center border-x border-white/5">
                <p className="text-[9px] text-white/40 uppercase font-bold mb-1">Potential Win</p>
                <p className="text-sm font-bold font-mono text-zii-accent">
                  ${(entry.potential_payout || 0).toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[9px] text-white/40 uppercase font-bold mb-1 flex items-center justify-center gap-1">
                  <Clock size={10} /> Closes
                </p>
                <p className="text-xs font-bold text-white/70">
                  {getTimeRemaining(entry.created_at)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};