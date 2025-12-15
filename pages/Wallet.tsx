import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, Plus, ArrowUpRight, Gift, ArrowDownLeft, Trophy, Info, Coins, Wallet as WalletIcon, LogIn, CheckCircle, ArrowRight } from 'lucide-react';
import { Loader } from '../components/Loader';
import { SuccessOverlay } from '../components/SuccessOverlay';
import { BuyModal } from '../components/BuyModal';
import { CashoutModal } from '../components/CashoutModal';
import { LevelUpOverlay } from '../components/LevelUpOverlay';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, getDocs, runTransaction, doc, serverTimestamp } from 'firebase/firestore';
import { Transaction } from '../types';
import { useNavigate } from 'react-router-dom';
import { GAME_CONFIG, getLevelFromXP, isMilestoneLevel } from '../utils/gamification';

export const Wallet: React.FC = () => {
  const { userProfile, currentUser, currencySymbol, exchangeRate } = useAuth();
  const navigate = useNavigate();
  
  const [voucherCode, setVoucherCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState<{ amount: number } | null>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showCashoutModal, setShowCashoutModal] = useState(false);
  
  // Level Up State
  const [newLevelData, setNewLevelData] = useState<{level: number, reward?: number} | null>(null);
  
  // Real Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Separate Balances (Scaled)
  const coinBalanceUsd = userProfile?.balance || 0;
  const winningsBalanceUsd = userProfile?.winnings_balance || 0;
  
  const coinBalanceScaled = coinBalanceUsd * exchangeRate;
  const winningsBalanceScaled = winningsBalanceUsd * exchangeRate;

  // Guest State
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

  // Fetch Transaction History Real-time
  useEffect(() => {
    if (!userProfile) return;

    const q = query(
      collection(db, "transactions"),
      where("userId", "==", userProfile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          created_at: d.created_at?.toDate ? d.created_at.toDate().toISOString() : new Date().toISOString()
        };
      }) as Transaction[];
      
      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setTransactions(data);
      setLoading(false);
    }, (error) => {
        console.error("Wallet Snapshot Error:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile]);

  const handleRedeem = async () => {
    if (!voucherCode.trim() || !userProfile) return;
    setIsRedeeming(true);

    try {
        const q = query(collection(db, "vouchers"), where("code", "==", voucherCode.trim()));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            alert("Invalid Voucher Code.");
            setIsRedeeming(false);
            return;
        }

        const voucherDoc = snapshot.docs[0];
        const voucherData = voucherDoc.data();

        if (voucherData.status === 'redeemed') {
             alert("This voucher has already been redeemed.");
             setIsRedeeming(false);
             return;
        }
        
        let leveledUp = false;
        let rewardAmount = 0;
        let nextLevel = 1;

        await runTransaction(db, async (transaction) => {
            const freshVoucherSnap = await transaction.get(voucherDoc.ref);
            if (!freshVoucherSnap.exists()) throw "Voucher vanished";
            
            const freshData = freshVoucherSnap.data();
            if (freshData.status === 'redeemed') throw "Already redeemed";
            
            // Get User Data for XP
            const userRef = doc(db, "users", userProfile.uid);
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw "User Missing";
            const userData = userDoc.data();

            // --- GAMIFICATION LOGIC ---
            const currentXP = userData.xp || 0;
            const currentLevel = userData.level || 1;
            const newXP = currentXP + GAME_CONFIG.XP_PER_VOUCHER;
            nextLevel = getLevelFromXP(newXP);

            if (nextLevel > currentLevel) {
                leveledUp = true;
                if (isMilestoneLevel(nextLevel)) {
                    rewardAmount = GAME_CONFIG.REWARD_AMOUNT;
                }
            }

            // Update Voucher
            transaction.update(voucherDoc.ref, {
                status: 'redeemed',
                redeemed_by: userProfile.uid,
                redeemed_at: serverTimestamp()
            });

            // Update User (Balance + XP + Level)
            let newBalance = (userData.balance || 0) + freshData.amount;
            if (rewardAmount > 0) newBalance += rewardAmount;
            
            transaction.update(userRef, {
                balance: newBalance,
                xp: newXP,
                level: nextLevel
            });

            // TX: Voucher Deposit
            const txRef = doc(collection(db, "transactions"));
            transaction.set(txRef, {
                userId: userProfile.uid,
                type: 'deposit',
                amount: freshData.amount,
                description: 'Voucher Redemption (Coins)',
                created_at: serverTimestamp()
            });
            
            // TX: Reward (if any)
            if (rewardAmount > 0) {
                 const rewardTxRef = doc(collection(db, "transactions"));
                 transaction.set(rewardTxRef, {
                     userId: userProfile.uid,
                     type: 'reward',
                     amount: rewardAmount,
                     description: `Level ${nextLevel} Milestone Reward`,
                     created_at: serverTimestamp()
                 });
            }
        });

        const redeemedAmount = voucherDoc.data().amount;
        setVoucherCode('');
        
        if (leveledUp) {
            setNewLevelData({ 
              level: nextLevel, 
              reward: rewardAmount > 0 ? (rewardAmount * exchangeRate) : undefined 
            });
        } else {
            setRedeemSuccess({ amount: redeemedAmount * exchangeRate });
        }

    } catch (e: any) {
        console.error("Redemption failed", e);
        alert(e === "Already redeemed" ? "This voucher was just redeemed by someone else." : "Redemption failed. Please try again.");
    } finally {
        setIsRedeeming(false);
    }
  };

  return (
    <div className="pb-24 pt-8 px-4 animate-in fade-in duration-500">
      
      {/* Level Up Overlay */}
      {newLevelData && (
          <LevelUpOverlay 
            newLevel={newLevelData.level} 
            reward={newLevelData.reward} 
            onClose={() => setNewLevelData(null)} 
          />
      )}

      {/* Redemption Success Modal */}
      {redeemSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200 p-4">
            <div className="w-full max-w-sm bg-[#1E293B] border border-zii-accent/20 rounded-3xl p-8 shadow-[0_0_50px_rgba(39,241,199,0.1)] text-center relative animate-in zoom-in-95 slide-in-from-bottom-4">
                
                <div className="w-20 h-20 bg-zii-accent/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-zii-accent/20 shadow-[0_0_15px_rgba(39,241,199,0.2)]">
                    <CheckCircle size={40} className="text-zii-accent" strokeWidth={2.5} />
                </div>

                <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Voucher Redeemed!</h2>
                <p className="text-white/60 mb-8 leading-relaxed">
                    You have successfully added <span className="text-zii-accent font-bold text-lg">{redeemSuccess.amount.toLocaleString(undefined, {maximumFractionDigits: 0})} Coins</span> to your wallet.
                </p>

                <div className="space-y-3">
                    <button 
                        onClick={() => navigate('/earn')}
                        className="w-full bg-zii-accent text-black font-bold py-4 rounded-xl hover:bg-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-zii-accent/20 active:scale-[0.98]"
                    >
                         Start Earning <ArrowRight size={20} />
                    </button>
                    <button 
                        onClick={() => setRedeemSuccess(null)}
                        className="w-full bg-white/5 text-white/50 font-bold py-4 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-6 opacity-60">
        <WalletIcon size={20} className="text-zii-accent" />
        <h1 className="text-2xl font-bold text-white">My Wallet</h1>
      </div>

      {/* 1. Winnings Card (Real Cash) */}
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

      {/* 2. Zii Coins Card (Play Balance) */}
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

      {/* 3. Redeem Voucher Section */}
      <div className="bg-white/5 p-4 rounded-2xl border border-white/5 mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Gift size={16} className="text-white/60" />
          <h3 className="font-bold text-sm text-white/90">Redeem Coin Voucher</h3>
        </div>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={voucherCode}
            onChange={(e) => setVoucherCode(e.target.value)}
            disabled={isRedeeming}
            placeholder="Enter 15-digit code"
            className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder:text-white/20 focus:outline-none focus:border-zii-accent/50 transition-colors disabled:opacity-50 font-mono"
          />
          <button 
            onClick={handleRedeem}
            disabled={!voucherCode.trim() || isRedeeming}
            className="bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold px-4 rounded-xl transition-colors text-sm min-w-[70px] flex justify-center items-center"
          >
            {isRedeeming ? <Loader size={16} /> : 'Add'}
          </button>
        </div>
      </div>

      {/* 4. Transaction History */}
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

      {showCashoutModal && (
        <CashoutModal 
            balance={winningsBalanceScaled}
            onClose={() => setShowCashoutModal(false)} 
        />
      )}
    </div>
  );
};