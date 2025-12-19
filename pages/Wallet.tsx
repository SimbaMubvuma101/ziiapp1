import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, Plus, ArrowUpRight, Gift, ArrowDownLeft, Trophy, Info, Coins, Wallet as WalletIcon, LogIn, CheckCircle, ArrowRight } from 'lucide-react';
import { Loader } from '../components/Loader';
import { SuccessOverlay } from '../components/SuccessOverlay';
import { BuyModal } from '../components/BuyModal';
import { CashoutModal } from '../components/CashoutModal';
import { LevelUpOverlay } from '../components/LevelUpOverlay';
import { Transaction } from '../types';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import { ErrorModal } from '../components/ErrorModal';

export const Wallet: React.FC = () => {
  const { userProfile, currentUser, currencySymbol, exchangeRate, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showCashoutModal, setShowCashoutModal] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  // Check for payment status in URL
  useEffect(() => {
    const status = searchParams.get('payment');
    if (status) {
      setPaymentStatus(status);
      setSearchParams({});

      if (status === 'success') {
        refreshUser(); // Refresh balance
        setTimeout(() => setPaymentStatus(null), 5000);
      } else if (status === 'cancelled') {
        setTimeout(() => setPaymentStatus(null), 3000);
      }
    }
  }, [searchParams, setSearchParams]);

  const [newLevelData, setNewLevelData] = useState<{level: number, reward?: number} | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const coinBalanceUsd = userProfile?.balance || 0;
  const winningsBalanceUsd = userProfile?.winnings_balance || 0;

  const coinBalanceScaled = coinBalanceUsd * exchangeRate;
  const winningsBalanceScaled = winningsBalanceUsd * exchangeRate;

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] p-8 text-center animate-in fade-in zoom-in-95">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
          <WalletIcon size={32} className="text-white/30" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">My Wallet</h2>
        <p className="text-white/50 text-sm mb-8 leading-relaxed">
          Join Zii to manage your coins, redeem vouchers, and cash out your winnings.
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
    const fetchTransactions = async () => {
      try {
        const data = await api.getTransactions();
        setTransactions(data);
      } catch (err) {
        console.error('Failed to fetch transactions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();

    // Poll every 30 seconds
    const interval = setInterval(fetchTransactions, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="pb-24 pt-8 px-4 animate-in fade-in duration-500">

      {paymentStatus === 'success' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg animate-in slide-in-from-top-4 fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle size={20} />
            <span className="font-bold">Payment successful! Coins added.</span>
          </div>
        </div>
      )}
      {paymentStatus === 'cancelled' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg animate-in slide-in-from-top-4 fade-in">
          <span className="font-bold">Payment cancelled</span>
        </div>
      )}

      {newLevelData && (
        <LevelUpOverlay 
          newLevel={newLevelData.level} 
          reward={newLevelData.reward} 
          onClose={() => setNewLevelData(null)} 
        />
      )}

      

      <div className="flex items-center gap-2 mb-6 opacity-60">
        <WalletIcon size={20} className="text-zii-accent" />
        <h1 className="text-2xl font-bold text-white">My Wallet</h1>
      </div>

      <div className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] p-6 rounded-3xl border border-yellow-500/30 mb-6 relative overflow-hidden shadow-[0_0_25px_rgba(234,179,8,0.1)]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 blur-[50px] rounded-full pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-yellow-500/90 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                <Trophy size={12} /> Withdrawable Winnings
              </p>
              <h2 className="text-4xl font-black tracking-tighter text-white">
                <span className="text-yellow-500 mr-1 text-2xl">{currencySymbol}</span>{winningsBalanceScaled.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </h2>
            </div>
          </div>

          <p className="text-[10px] text-white/40 mb-6 leading-relaxed max-w-[80%]">
            Real cash won from predictions. Cash out via WhatsApp instantly.
          </p>

          <button 
            onClick={() => setShowCashoutModal(true)}
            className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-yellow-500/20"
          >
            <ArrowUpRight size={18} strokeWidth={2.5} /> Cash Out Winnings
          </button>
        </div>
      </div>

      <div className="bg-white/5 p-6 rounded-3xl border border-white/5 mb-8 relative">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-zii-accent text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
              <Coins size={12} /> Game Tokens
            </p>
            <h2 className="text-3xl font-black tracking-tighter text-white">
              {coinBalanceScaled.toLocaleString(undefined, {maximumFractionDigits: 0})} <span className="text-lg text-white/30 font-medium">Coins</span>
            </h2>
          </div>
          <button 
            onClick={() => setShowBuyModal(true)}
            className="bg-zii-accent text-black font-bold px-4 py-2 rounded-xl text-sm active:scale-95 transition-transform shadow-lg shadow-zii-accent/10 flex items-center gap-1.5"
          >
            <Plus size={16} strokeWidth={3} /> Top Up
          </button>
        </div>

        <div className="flex gap-2 items-start text-[10px] text-white/40 bg-black/20 p-3 rounded-xl border border-white/5 leading-relaxed">
          <Info size={14} className="shrink-0 mt-0.5 text-zii-accent" />
          <span>
            <strong>Zii Coins</strong> are the official in-app currency used to place predictions. 
            Use them to play, and if you win, you earn real withdrawable cash.
            <br/><span className="opacity-50 mt-1 block">1 Coin ≈ {currencySymbol}1.00 Value.</span>
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={16} className="text-white/60" />
          <h3 className="font-bold text-lg text-white">History</h3>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader className="text-white/30" /></div>
        ) : transactions.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-4 bg-white/5 rounded-xl border border-white/5 border-dashed">No transactions yet.</p>
        ) : (
          transactions.map((tx) => {
            const scaledAmount = tx.amount * exchangeRate;
            return (
              <div key={tx.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    tx.type === 'winnings' 
                      ? 'bg-yellow-500/10 text-yellow-500' 
                      : tx.type === 'reward'
                        ? 'bg-purple-500/10 text-purple-500'
                        : tx.type === 'deposit' 
                          ? 'bg-zii-accent/10 text-zii-accent' 
                          : 'bg-white/10 text-white/50'
                  }`}>
                    {tx.type === 'winnings' ? <Trophy size={18} /> : 
                      tx.type === 'reward' ? <Trophy size={18} /> :
                      tx.type === 'deposit' ? <Plus size={18} /> : <ArrowDownLeft size={18} />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/90 truncate max-w-[160px]">
                      {tx.description}
                    </p>
                    <p className="text-[10px] text-white/40 uppercase tracking-wide">
                      {new Date(tx.created_at).toLocaleDateString()} • {tx.type}
                    </p>
                  </div>
                </div>
                <span className={`font-mono font-bold ${
                  tx.type === 'winnings' ? 'text-yellow-500' : 
                  tx.type === 'reward' ? 'text-purple-400' :
                  tx.type === 'deposit' ? 'text-zii-accent' : 
                  'text-white/40'
                }`}>
                  {scaledAmount > 0 ? '+' : ''}{scaledAmount.toLocaleString(undefined, {maximumFractionDigits: 2})}
                </span>
              </div>
            );
          })
        )}
      </div>

      {showBuyModal && (
        <BuyModal onClose={() => setShowBuyModal(false)} />
      )}

      {showCashoutModal && userProfile && (
        <CashoutModal 
          balance={winningsBalanceScaled}
          onClose={() => setShowCashoutModal(false)} 
        />
      )}

      {errorMessage && <ErrorModal message={errorMessage} onClose={() => setErrorMessage(null)} />}
    </div>
  );
};