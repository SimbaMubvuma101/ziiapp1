import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Clock, History, AlertCircle, TrendingUp, Activity, LogIn } from 'lucide-react';
import { UserEntry } from '../types';
import { Loader } from '../components/Loader';
import { useNavigate } from 'react-router-dom';

export const Active: React.FC = () => {
  const { userProfile, currentUser, currencySymbol, exchangeRate } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'live' | 'history'>('live');

  // Guest State
  if (!currentUser) {
    return (
        <div className="flex flex-col items-center justify-center h-[70vh] p-8 text-center animate-in fade-in zoom-in-95">
           <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
              <Activity size={32} className="text-white/30" />
           </div>
           <h2 className="text-2xl font-bold text-white mb-2">Your Activity</h2>
           <p className="text-white/50 text-sm mb-8 leading-relaxed">
               Log in to see your active predictions and past results.
           </p>
           <button 
              onClick={() => navigate('/register')}
              className="w-full bg-zii-accent text-black font-bold py-4 rounded-xl mb-3 hover:bg-white transition-colors"
          >
              Create Account
          </button>
          <button 
              onClick={() => navigate('/login')}
              className="w-full bg-white/5 text-white font-bold py-4 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
          >
              <LogIn size={18} /> Sign In
          </button>
        </div>
    );
  }

  useEffect(() => {
    if (!userProfile) return;

    // We removed orderBy("created_at", "desc") to prevent "Missing Index" errors on MVP.
    // Client-side sorting is used instead.
    const q = query(
      collection(db, "entries"),
      where("userId", "==", userProfile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          // Convert Firestore Timestamp to ISO string if present
          created_at: d.created_at?.toDate ? d.created_at.toDate().toISOString() : undefined
        };
      }) as UserEntry[];
      
      // Sort by newest first
      data.sort((a, b) => {
          const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return tB - tA;
      });
      
      setEntries(data);
      setLoading(false);
    }, (error) => {
        console.error("Active Entries Snapshot Error:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile]);

  const liveEntries = entries.filter(e => e.status === 'active');
  const historyEntries = entries.filter(e => e.status !== 'active');

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center h-[50vh] text-white/30 animate-in fade-in zoom-in-95">
        <Clock size={40} className="mb-4 opacity-50" />
        <p className="text-sm font-medium">{message}</p>
    </div>
  );

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader className="text-zii-accent" /></div>;

  return (
    <div className="pb-24 pt-4 px-4 space-y-4 animate-in fade-in duration-500">
      
      {/* Tabs */}
      <div className="flex p-1 bg-white/5 rounded-xl mb-6 border border-white/5">
        <button
          onClick={() => setActiveTab('live')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
            activeTab === 'live' 
              ? 'bg-zii-card text-white shadow-sm' 
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          Live Predictions
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
            activeTab === 'history' 
              ? 'bg-zii-card text-white shadow-sm' 
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          History
        </button>
      </div>
      
      {activeTab === 'live' ? (
        <div className="space-y-4">
            {liveEntries.length === 0 ? (
                <EmptyState message="No active predictions" />
            ) : (
                liveEntries.map((entry) => {
                    const amountScaled = (entry.amount || 0) * exchangeRate;
                    const payoutScaled = (entry.potential_payout || 0) * exchangeRate;
                    const profitScaled = payoutScaled - amountScaled;

                    return (
                        <div key={entry.id} className="bg-zii-card p-5 rounded-2xl border border-white/5 shadow-sm relative overflow-hidden">
                          <div className="relative z-10">
                              <div className="flex justify-between items-start mb-4">
                                <h3 className="font-semibold text-white/90 leading-tight w-3/4 text-sm">
                                  {entry.prediction_question}
                                </h3>
                                <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-[9px] font-bold uppercase rounded-md tracking-wider border border-blue-500/20">
                                  Live
                                </span>
                              </div>
    
                              <div className="flex justify-between items-end bg-black/20 p-3 rounded-xl border border-white/5 mb-3">
                                <div>
                                  <p className="text-[10px] text-white/40 mb-1 uppercase tracking-wider">Your Pick</p>
                                  <p className="text-zii-accent font-bold uppercase text-sm tracking-wide truncate max-w-[120px]">
                                    {(entry.selected_option_label || entry.selected_option_id).replace(/_/g, ' ')}
                                  </p>
                                  <p className="text-[10px] text-white/30 mt-1">Paid: {currencySymbol}{amountScaled.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                                </div>
                                
                                <div className="text-right">
                                  <p className="text-[10px] text-white/40 mb-1 uppercase tracking-wider">Payout</p>
                                  <p className="text-white font-mono font-bold text-lg">
                                    {currencySymbol}{payoutScaled.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                  </p>
                                </div>
                              </div>

                              <div className="flex justify-between items-center px-2">
                                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Net Profit</span>
                                  <span className="text-sm font-mono font-bold text-green-400">+{currencySymbol}{profitScaled.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                              </div>
                          </div>
                          
                          <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5">
                             <div className="h-full bg-zii-highlight w-[60%] opacity-50 animate-pulse"></div>
                          </div>
                        </div>
                    );
                  })
            )}
        </div>
      ) : (
        <div className="space-y-4">
            {historyEntries.length === 0 ? (
                <EmptyState message="No past predictions" />
            ) : (
                historyEntries.map((entry) => {
                    const amountScaled = (entry.amount || 0) * exchangeRate;
                    const payoutScaled = (entry.potential_payout || 0) * exchangeRate;
                    
                    return (
                        <div key={entry.id} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center justify-between opacity-80 hover:opacity-100 transition-opacity">
                            <div className="flex items-start gap-3">
                                <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center border ${
                                    entry.status === 'won' 
                                        ? 'bg-green-500/10 border-green-500/30 text-green-500' 
                                        : 'bg-red-500/10 border-red-500/30 text-red-500'
                                }`}>
                                    {entry.status === 'won' ? <TrendingUp size={14} /> : <AlertCircle size={14} />}
                                </div>
                                <div>
                                    <h3 className="text-xs font-medium text-white/80 line-clamp-1 max-w-[180px]">
                                        {entry.prediction_question}
                                    </h3>
                                    <p className="text-[10px] text-white/40 mt-1">
                                        Picked: <span className="font-bold text-white/60 uppercase">
                                        {(entry.selected_option_label || entry.selected_option_id).replace(/_/g, ' ')}
                                        </span>
                                    </p>
                                </div>
                            </div>
                            
                            <div className="text-right">
                                {entry.status === 'won' ? (
                                    <span className="text-green-400 font-bold font-mono text-sm">+{currencySymbol}{payoutScaled.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                ) : (
                                    <span className="text-white/30 font-bold font-mono text-sm line-through decoration-white/30">-{currencySymbol}{amountScaled.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                )}
                                <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5 opacity-50">
                                    {entry.status}
                                </p>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
      )}
    </div>
  );
};