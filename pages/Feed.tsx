import React, { useState, useEffect, useRef } from 'react';
import { Prediction, PredictionStatus, UserEntry } from '../types';
import { PredictionCard } from '../components/PredictionCard';
import { EntryModal } from '../components/BetModal';
import { BetDetailsModal } from '../components/BetDetailsModal';
import { SuccessOverlay } from '../components/SuccessOverlay';
import { CelebrationModal } from '../components/CelebrationModal';
import { CashoutModal } from '../components/CashoutModal';
import { AuthPromptModal } from '../components/AuthPromptModal';
import { LevelUpOverlay } from '../components/LevelUpOverlay';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, runTransaction, doc, serverTimestamp, deleteDoc, writeBatch, getDocs, increment } from 'firebase/firestore';
import { SplashLoader, Loader } from '../components/Loader';
import { Trash2, ChevronLeft, ChevronRight, Trophy } from 'lucide-react';
import { calculateAMMOdds, FIXED_PAYOUT_AMOUNT } from '../utils/amm';
import { GAME_CONFIG, getLevelFromXP, isMilestoneLevel } from '../utils/gamification';

interface FeedProps {
  adminMode?: boolean;
  onPredictionClick?: (prediction: Prediction) => void;
  adminStatusFilter?: 'open' | 'closed' | 'resolved';
}

export const Feed: React.FC<FeedProps> = ({ adminMode = false, onPredictionClick, adminStatusFilter }) => {
  const { userProfile, currentUser, isAdmin: authIsAdmin, userCountry } = useAuth();
  // Force admin flag if we are in admin mode (implies parent checked permissions)
  const effectiveIsAdmin = adminMode || authIsAdmin;

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Track which events the user has already bet on
  // Map predictionId -> UserEntry
  const [userEntries, setUserEntries] = useState<Record<string, UserEntry>>({});
  
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<UserEntry | null>(null); // For showing details
  const [selectedEntryPrediction, setSelectedEntryPrediction] = useState<Prediction | null>(null); // For detail context (countdown)
  
  const [activeTab, setActiveTab] = useState('All');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Celebration & Cashout State
  const [celebrationEntries, setCelebrationEntries] = useState<UserEntry[]>([]);
  const [showCashoutModal, setShowCashoutModal] = useState(false);
  
  // Level Up State
  const [newLevelData, setNewLevelData] = useState<{level: number, reward?: number} | null>(null);
  
  // Auth Prompt State
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  // Pull to Refresh State
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const touchStartY = useRef(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  const tabs = [
    'All',
    'Celebrities & Drama',
    'Music & Culture',
    'Trends & Viral',
    'Relationships',
    'Nightlife'
  ];

  // 0. CHECK FOR UN-CELEBRATED WINS (Only if logged in)
  useEffect(() => {
    if (adminMode || !userProfile) return;

    // Query for 'won' entries. We will filter client-side for 'celebrated'
    const q = query(
        collection(db, "entries"), 
        where("userId", "==", userProfile.uid),
        where("status", "==", "won")
    );

    // One-time fetch to check for celebrations needed
    getDocs(q).then((snapshot) => {
        const uncelebratedEntries = snapshot.docs
            .map(d => ({ ...d.data(), id: d.id } as UserEntry))
            .filter(data => data.celebrated !== true);

        if (uncelebratedEntries.length > 0) {
            setCelebrationEntries(uncelebratedEntries);
        }
    });

  }, [userProfile, adminMode]);

  const handleDismissCelebration = async () => {
      // Mark as celebrated in DB
      try {
          const batch = writeBatch(db);
          celebrationEntries.forEach(entry => {
              const ref = doc(db, "entries", entry.id);
              batch.update(ref, { celebrated: true });
          });
          await batch.commit();
      } catch (e) {
          console.error("Error marking wins celebrated:", e);
      }
      setCelebrationEntries([]);
  };

  const handleCelebrationCashout = async () => {
      // 1. Mark as celebrated
      await handleDismissCelebration();
      // 2. Open Cashout Modal
      setShowCashoutModal(true);
  };

  // 1. Fetch User's Participation (Only if logged in)
  useEffect(() => {
      if (!userProfile) {
          setUserEntries({});
          return;
      }
      
      const q = query(collection(db, "entries"), where("userId", "==", userProfile.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const map: Record<string, UserEntry> = {};
          snapshot.docs.forEach(doc => {
              const data = doc.data() as UserEntry;
              // Ensure ID is present
              map[data.prediction_id] = { ...data, id: doc.id };
          });
          setUserEntries(map);
      });
      return () => unsubscribe();
  }, [userProfile]);

  // 2. Fetch Predictions Real-time
  useEffect(() => {
    let q;
    
    if (adminMode) {
        // Safe Admin Query: Fetch all relevant statuses. 
        q = query(collection(db, "predictions"), where("status", "in", ["open", "closed", "resolved"]));
    } else {
        // Users only see OPEN, and filter by country in memory or query
        // NOTE: Firebase "IN" queries or multiple where clauses can be tricky with indexes.
        // For Filter by Country, we can do it client side for small datasets or add .where('country', '==', userCountry)
        // Given we already have index issues, let's filter client-side for safety/speed in MVP
        q = query(collection(db, "predictions"), where("status", "==", "open"));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let preds = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // Robust Date Handling
        let closesAtStr = new Date(Date.now() + 31536000000).toISOString(); // Default 1 year if missing
        if (data.closes_at) {
             if (data.closes_at.toDate) {
                 closesAtStr = data.closes_at.toDate().toISOString();
             } else if (typeof data.closes_at === 'string') {
                 closesAtStr = data.closes_at;
             }
        }

        return {
          id: doc.id,
          ...data,
          closes_at: closesAtStr
        };
      }) as Prediction[];

      // --- FILTERING LOGIC ---
      
      // 1. Country Filter (Crucial)
      // If admin, show all. If user, only show their country.
      // FIX: Default missing country to 'ZW' (Legacy compatibility)
      if (!adminMode) {
         preds = preds.filter(p => {
             const pCountry = p.country || 'ZW';
             return pCountry === userCountry;
         }); 
      }

      // 2. Hide expired events from Users immediately
      if (!adminMode) {
          const now = new Date();
          preds = preds.filter(p => new Date(p.closes_at) > now);
      }
      
      // --- SORTING LOGIC ---
      if (adminMode) {
           // Admin: Group by Status, then sort by Deadline (Soonest First)
           preds.sort((a, b) => {
               // 1. Status Priority: Open > Closed > Resolved
               const statusOrder = { open: 0, closed: 1, resolved: 2, archived: 3 };
               // @ts-ignore
               const statA = statusOrder[a.status] ?? 99;
               // @ts-ignore
               const statB = statusOrder[b.status] ?? 99;
               
               if (statA !== statB) return statA - statB;

               // 2. Deadline Priority: Soonest First (Ascending)
               return new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime();
           });
      } else {
          // User: Strictly Deadline (Soonest Closing First)
          preds.sort((a, b) => new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime());
      }

      setPredictions(preds);
      setLoading(false);
    }, (error) => {
        console.log("Feed Snapshot Error:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [adminMode, userCountry, refreshTrigger]);

  // Pull-to-Refresh Logic
  const handleTouchStart = (e: React.TouchEvent) => {
    // Find scroll container
    if (!scrollContainerRef.current) {
        scrollContainerRef.current = (e.target as HTMLElement).closest('.overflow-y-auto');
    }
    const scrollTop = scrollContainerRef.current?.scrollTop || 0;
    
    // Only enable if at top
    if (scrollTop <= 0) {
        touchStartY.current = e.touches[0].clientY;
    } else {
        touchStartY.current = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const scrollTop = scrollContainerRef.current?.scrollTop || 0;
    if (touchStartY.current === 0 || scrollTop > 0) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;

    // Only allow pulling down
    if (diff > 0) {
        // Logarithmic/damped resistance
        const dampened = Math.min(diff * 0.4, 120); 
        setPullY(dampened);
    }
  };

  const handleTouchEnd = () => {
    if (touchStartY.current === 0) return;
    
    if (pullY > 60) {
        handleRefresh();
    }
    setPullY(0);
    touchStartY.current = 0;
  };

  const handleRefresh = () => {
      if (isRefreshing) return;
      setIsRefreshing(true);
      
      // Force Effect Re-run (re-subscribes to listeners)
      setRefreshTrigger(prev => prev + 1);
      
      // Aesthetic delay for UX
      setTimeout(() => {
          setIsRefreshing(false);
      }, 1500);
  };

  // 3. Handle Card Click
  const handleCardClick = (pred: Prediction) => {
      // GUEST CHECK: Prompt to join if not logged in
      if (!currentUser && !adminMode) {
          setShowAuthPrompt(true);
          return;
      }

      // Admin Override: Always open for management
      if (adminMode && onPredictionClick) {
          onPredictionClick(pred);
          return;
      }

      // User Check: If voted, show details modal
      const existingEntry = userEntries[pred.id];
      if (existingEntry) {
          setSelectedEntry(existingEntry);
          setSelectedEntryPrediction(pred); // Pass prediction to modal for countdown
          return;
      }

      // Otherwise open betting modal
      setSelectedPrediction(pred);
  };

  // 4. Transactional Betting Logic with AMM Integration
  const handlePlaceEntry = async (optionId: string, amount: number) => {
    // Redundant guard for safety
    if (!userProfile) {
        setShowAuthPrompt(true);
        return;
    }
    
    if (!selectedPrediction) return;
    
    // Client-side deadline check
    if (new Date(selectedPrediction.closes_at) < new Date()) {
        alert("This prediction has closed.");
        return;
    }

    // Client-side Duplicate Check (Optimization & Prevention)
    if (userEntries[selectedPrediction.id]) {
        alert("You have already predicted on this event! Only one entry allowed per event.");
        return;
    }

    setIsSubmitting(true);

    try {
      // --- PARTNER ATTRIBUTION LOGIC (Outside Transaction for Read) ---
      let affiliateIdToCredit: string | null = null;
      
      // 1. Check LocalStorage for Active 7-Day Cookie
      const localRefCode = localStorage.getItem('zii_ref_code');
      const localRefExp = localStorage.getItem('zii_ref_expiry');
      const isLocalValid = localRefCode && localRefExp && Date.now() < parseInt(localRefExp);

      if (isLocalValid) {
          // Attempt to resolve code to ID
          const q = query(collection(db, "affiliates"), where("code", "==", localRefCode));
          const snap = await getDocs(q);
          if (!snap.empty) {
              affiliateIdToCredit = snap.docs[0].id;
              console.log("Attributing entry to active partner cookie:", localRefCode);
          }
      }

      // 2. If no cookie, check Permanent Profile Attribution
      if (!affiliateIdToCredit && userProfile.affiliate_id) {
          affiliateIdToCredit = userProfile.affiliate_id;
      }

      // --- EXECUTE TRANSACTION ---
      let leveledUp = false;
      let rewardAmount = 0;
      let nextLevel = 1;

      await runTransaction(db, async (transaction) => {
        // A. Get fresh User Data (Balance Check)
        const userRef = doc(db, "users", userProfile.uid);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) throw new Error("User does not exist");
        
        const userData = userDoc.data();
        const currentBalance = userData.balance || 0;
        if (currentBalance < amount) {
          throw new Error("Insufficient Balance");
        }

        // --- GAMIFICATION LOGIC ---
        const currentXP = userData.xp || 0;
        const currentLevel = userData.level || 1;
        const newXP = currentXP + GAME_CONFIG.XP_PER_BET;
        nextLevel = getLevelFromXP(newXP);

        // Check if level increased
        if (nextLevel > currentLevel) {
            leveledUp = true;
            // Check for Milestone Reward
            if (isMilestoneLevel(nextLevel)) {
                rewardAmount = GAME_CONFIG.REWARD_AMOUNT;
            }
        }

        // B. Get Fresh Prediction Data
        const predRef = doc(db, "predictions", selectedPrediction.id);
        const predDoc = await transaction.get(predRef);
        if (!predDoc.exists()) throw new Error("Prediction not found");
        
        const freshPred = predDoc.data() as Prediction;
        const option = freshPred.options.find(o => o.id === optionId);
        if (!option) throw new Error("Invalid Option");

        // C. Prepare Entry Data
        const entryId = `${userProfile.uid}_${selectedPrediction.id}`;
        const entryRef = doc(db, "entries", entryId);
        
        // --- PAYOUT CALCULATION ---
        const effectiveMultiplier = freshPred.multiplier || 1;
        const lockedInPayout = FIXED_PAYOUT_AMOUNT * effectiveMultiplier;

        // D. Perform Writes
        
        // 1. Deduct Balance + Add Reward if Applicable
        let newBalance = currentBalance - amount;
        if (rewardAmount > 0) newBalance += rewardAmount;
        
        transaction.update(userRef, { 
            balance: newBalance,
            xp: newXP,
            level: nextLevel
        });
        
        // 2. Create Entry
        transaction.set(entryRef, {
           id: entryId,
           userId: userProfile.uid,
           username: userProfile.name, 
           prediction_id: selectedPrediction.id,
           prediction_question: selectedPrediction.question,
           selected_option_id: optionId,
           selected_option_label: option.label,
           amount: amount,
           potential_payout: lockedInPayout,
           status: 'active',
           created_at: serverTimestamp()
        });

        // 3. Create Transaction Record (Entry)
        const newTxRef = doc(collection(db, "transactions"));
        transaction.set(newTxRef, {
            userId: userProfile.uid,
            type: 'entry',
            amount: -amount,
            description: `Entry: ${selectedPrediction.question.substring(0, 20)}...`,
            created_at: serverTimestamp()
        });
        
        // 4. Create Transaction Record (Reward if applicable)
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
        
        // 5. Update Prediction Liquidity
        const currentPool = freshPred.liquidity_pool || {};
        const currentOptionLiq = currentPool[optionId] || 0;
        const newLiquidityPool = { ...currentPool, [optionId]: currentOptionLiq + amount };
        
        transaction.update(predRef, {
            pool_size: (freshPred.pool_size || 0) + 1,
            liquidity_pool: newLiquidityPool
        });

        // 6. AFFILIATE LOGIC (Using resolved ID)
        if (affiliateIdToCredit) {
             const affRef = doc(db, "affiliates", affiliateIdToCredit);
             
             // Logic: 
             // House Comm = 5% of amount
             // Aff Comm = 10% of House Comm (0.5% of amount)
             const houseComm = amount * 0.05;
             const affiliateComm = houseComm * 0.10;
             
             transaction.update(affRef, {
                 total_volume: increment(amount),
                 commission_owed: increment(affiliateComm)
             });
        }
      });

      // OPTIMISTIC UI UPDATE
      setPredictions(prevPreds => prevPreds.map(p => {
          if (p.id === selectedPrediction.id) {
              const currentPool = p.liquidity_pool || {};
              const currentOptionLiq = currentPool[optionId] || 0;
              
              return {
                  ...p,
                  pool_size: (p.pool_size || 0) + 1,
                  liquidity_pool: {
                      ...currentPool,
                      [optionId]: currentOptionLiq + amount
                  }
              };
          }
          return p;
      }));

      // Success
      setIsSubmitting(false);
      setSelectedPrediction(null);
      
      if (leveledUp) {
          setNewLevelData({ level: nextLevel, reward: rewardAmount > 0 ? rewardAmount : undefined });
      } else {
          setShowSuccess(true);
      }

    } catch (e: any) {
      console.error("Entry failed: ", e);
      const errMsg = e.message || e;
      if (errMsg === "Insufficient Balance") {
        alert("Insufficient funds! Please top up your wallet.");
      } else if (errMsg === "Already Predicted") {
        alert("You have already predicted on this event! Only one entry allowed per event.");
      } else if (typeof errMsg === 'string' && errMsg.includes("permission")) {
        alert("System busy (Permission). Please try again in a moment.");
      } else {
        alert(`Failed to place entry: ${errMsg}`);
      }
      setIsSubmitting(false);
    }
  };

  // 3. Delete Logic (Admin Only)
  const handleDelete = async (e: React.MouseEvent, id: string) => {
      // PREVENT NAVIGATION
      e.preventDefault();
      e.stopPropagation();

      // Browser Confirm Dialog
      const confirmed = window.confirm("⚠️ PERMANENTLY DELETE?\n\nThis cannot be undone.");
      if (!confirmed) return;
      
      try {
          // Optimistic Update
          setPredictions(prev => prev.filter(p => p.id !== id));
          // HARD DELETE
          await deleteDoc(doc(db, "predictions", id));
      } catch (err: any) {
          console.error("Delete failed", err);
          alert(`Failed to delete: ${err.message}`);
      }
  };

  let filteredPredictions = predictions;
  if (adminMode && adminStatusFilter) {
      // Enhanced Admin Filtering:
      // 'open' -> Strictly open status AND strictly future deadline
      // 'closed' -> 'closed' status OR ('open' status but past deadline)
      // 'resolved' -> 'resolved' status
      const now = new Date();
      filteredPredictions = predictions.filter(p => {
         const isExpired = new Date(p.closes_at) < now;
         
         if (adminStatusFilter === 'open') {
             return p.status === 'open' && !isExpired;
         }
         if (adminStatusFilter === 'closed') {
             return p.status === 'closed' || (p.status === 'open' && isExpired);
         }
         if (adminStatusFilter === 'resolved') {
             return p.status === 'resolved';
         }
         return false;
      });
  } else if (!adminMode && activeTab !== 'All') {
      filteredPredictions = predictions.filter(p => p.category === activeTab);
  }

  // Replaced simple loader with SplashLoader
  if (loading) {
     return <SplashLoader />;
  }

  return (
    <div 
        className="pb-24 pt-4 px-4 space-y-4 animate-in fade-in duration-500 relative min-h-[80vh]"
        onTouchStart={handleTouchStart} 
        onTouchMove={handleTouchMove} 
        onTouchEnd={handleTouchEnd}
    >
      
      {/* Pull to Refresh Indicator */}
      <div 
          className="fixed left-0 right-0 z-50 flex justify-center pointer-events-none transition-all duration-300"
          style={{ 
              // Account for TopBar height (3.5rem) + Safe Area + Padding
              top: 'calc(3.5rem + env(safe-area-inset-top) + 20px)',
              transform: `translateY(${isRefreshing ? 20 : Math.max(0, pullY - 40)}px)`,
              opacity: pullY > 10 || isRefreshing ? 1 : 0
          }}
      >
          <div className={`bg-white p-2 rounded-full shadow-xl border border-white/10 ${isRefreshing ? 'animate-spin' : ''} ${pullY > 60 && !isRefreshing ? 'scale-125' : ''} transition-transform`}>
               <Loader size={20} className="text-black" />
          </div>
      </div>

      {/* Celebration Modal */}
      {celebrationEntries.length > 0 && (
          <CelebrationModal 
              entries={celebrationEntries}
              onClose={handleDismissCelebration}
              onCashout={handleCelebrationCashout}
          />
      )}

      {/* Auth Prompt Modal */}
      {showAuthPrompt && (
          <AuthPromptModal onClose={() => setShowAuthPrompt(false)} />
      )}
      
      {/* Level Up Overlay */}
      {newLevelData && (
          <LevelUpOverlay 
            newLevel={newLevelData.level} 
            reward={newLevelData.reward} 
            onClose={() => setNewLevelData(null)} 
          />
      )}

      {/* Category Tabs (Hide in Admin Mode) */}
      {!adminMode && (
        <div className="mb-8">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 snap-x">
                {tabs.map((cat) => (
                <button 
                    key={cat}
                    onClick={() => setActiveTab(cat)}
                    className={`snap-start whitespace-nowrap px-4 py-2 rounded-full text-[11px] font-bold transition-all duration-300 border border-transparent flex-shrink-0 ${
                    activeTab === cat 
                        ? 'bg-white text-black shadow-md shadow-white/5' 
                        : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10 hover:text-white'
                    }`}
                >
                    {cat}
                </button>
                ))}
            </div>
            
            {/* Visual Cue - Swipe Indicator */}
            <div className="flex items-center justify-center gap-3 text-[9px] text-white/20 uppercase tracking-widest font-bold mt-1">
                <ChevronLeft size={10} className="animate-pulse" />
                <span>Swipe for more categories</span>
                <ChevronRight size={10} className="animate-pulse" />
            </div>
        </div>
      )}

      <div className="space-y-4">
        {filteredPredictions.length > 0 ? (
          filteredPredictions.map((pred) => (
            <div key={pred.id} className="relative group isolate">
                
                {/* 1. The Clickable Card (Rendered FIRST) */}
                <PredictionCard 
                    prediction={pred} 
                    onSelect={handleCardClick} 
                    isAdmin={effectiveIsAdmin}
                />

                {/* 2. Admin Status Badge Overlay (Rendered AFTER) */}
                {adminMode && (
                    <div className={`pointer-events-none absolute top-0 left-0 z-20 px-3 py-1 rounded-br-xl rounded-tl-2xl text-[10px] font-bold uppercase tracking-wider shadow-lg ${
                        pred.status === 'open' 
                            ? (new Date(pred.closes_at) < new Date() ? 'bg-orange-500 text-white' : 'bg-zii-accent text-black')
                            : pred.status === 'closed' ? 'bg-red-500 text-white' 
                            : pred.status === 'resolved' ? 'bg-green-500 text-black'
                            : 'bg-white text-black'
                    }`}>
                        {pred.status === 'open' && new Date(pred.closes_at) < new Date() ? 'EXPIRED' : pred.status}
                    </div>
                )}

                {/* 3. Admin Delete Button (Rendered LAST = On Top) */}
                {effectiveIsAdmin && (
                   <div className="absolute top-2 right-2 z-50">
                       <button
                          type="button"
                          onClick={(e) => handleDelete(e, pred.id)}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="bg-red-500 text-white border border-red-400 p-2.5 rounded-lg shadow-xl transition-transform active:scale-95 flex items-center justify-center hover:bg-red-600 cursor-pointer pointer-events-auto"
                          title="Delete Event"
                       >
                          <Trash2 size={16} strokeWidth={3} />
                       </button>
                   </div>
                )}
            </div>
          ))
        ) : (
          <div className="text-center py-10 text-white/30 flex flex-col items-center">
            <p className="mb-4">No predictions found for your location.</p>
            {!adminMode && (
                <p className="text-xs text-white/40">Try changing your country in Profile.</p>
            )}
          </div>
        )}
      </div>

      {/* Entry Modal for Betting */}
      {!onPredictionClick && (
        <EntryModal 
            prediction={selectedPrediction}
            isLoading={isSubmitting}
            onClose={() => !isSubmitting && setSelectedPrediction(null)}
            onPlaceEntry={handlePlaceEntry}
        />
      )}

      {/* Details Modal for View Only */}
      {selectedEntry && (
          <BetDetailsModal 
             entry={selectedEntry} 
             prediction={selectedEntryPrediction}
             onClose={() => { setSelectedEntry(null); setSelectedEntryPrediction(null); }} 
          />
      )}

      {showSuccess && (
        <SuccessOverlay 
          message="Prediction Locked In!" 
          onDismiss={() => setShowSuccess(false)} 
        />
      )}

      {/* Cashout Modal (Triggered from Celebration) */}
      {showCashoutModal && userProfile && (
          <CashoutModal 
              balance={userProfile.winnings_balance || 0}
              onClose={() => setShowCashoutModal(false)}
          />
      )}
    </div>
  );
};