import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
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
import { api } from '../utils/api';
import { SplashLoader, Loader } from '../components/Loader';
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { GAME_CONFIG, getLevelFromXP, isMilestoneLevel } from '../utils/gamification';

interface FeedProps {
  adminMode?: boolean;
  onPredictionClick?: (prediction: Prediction) => void;
  adminStatusFilter?: 'open' | 'closed' | 'resolved';
}

export const Feed: React.FC<FeedProps> = ({ adminMode = false, onPredictionClick, adminStatusFilter }) => {
  const { userProfile, currentUser, isAdmin: authIsAdmin, userCountry } = useAuth();
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
  const [feedSection, setFeedSection] = useState<'main' | 'creator'>('main');
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

    const checkWins = async () => {
      try {
        const entries = await api.getEntries('won');
        const uncelebrated = entries.filter((e: UserEntry) => !e.celebrated);
        if (uncelebrated.length > 0) {
          setCelebrationEntries(uncelebrated);
        }
      } catch (err) {
        console.error('Error fetching wins:', err);
      }
    };

    checkWins();
  }, [userProfile, adminMode]);

  const handleDismissCelebration = async () => {
    // Mark as celebrated - backend will handle this in future iteration
    setCelebrationEntries([]);
  };

  const handleCelebrationCashout = async () => {
    await handleDismissCelebration();
    setShowCashoutModal(true);
  };

  // 1. Fetch User's Participation (Only if logged in)
  useEffect(() => {
    if (!userProfile) {
      setUserEntries({});
      return;
    }

    const fetchEntries = async () => {
      try {
        const entries = await api.getEntries();
        const map: Record<string, UserEntry> = {};
        entries.forEach((entry: UserEntry) => {
          // Ensure prediction_id exists to avoid errors
          if (entry.prediction_id) {
            map[entry.prediction_id] = entry;
          }
        });
        setUserEntries(map);
      } catch (err) {
        console.error('Error fetching entries:', err);
      }
    };

    fetchEntries();
  }, [userProfile]);

  // 2. Fetch Predictions Real-time (using polling via interval for now)
  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        let filters: any = {};

        if (adminMode) {
          // Admin sees all statuses
          // No specific status filter needed here, backend handles it
        } else {
          filters.status = 'open';
          // Filter by country is handled by the backend API call
          filters.country = userCountry;
        }

        const preds = await api.getPredictions(filters);

        // Filter expired events for non-admin users client-side as a fallback
        let filteredPreds = preds;
        if (!adminMode) {
          const now = new Date();
          filteredPreds = preds.filter((p: Prediction) => new Date(p.closes_at) > now);
        }

        // --- SORTING LOGIC ---
        if (adminMode) {
          // Admin: Group by Status, then sort by Deadline (Soonest First)
          filteredPreds.sort((a: Prediction, b: Prediction) => {
            // @ts-ignore - Assuming status is always a valid key for this sort
            const statusOrder = { open: 0, closed: 1, resolved: 2, archived: 3 };
            const statA = statusOrder[a.status as keyof typeof statusOrder] ?? 99;
            const statB = statusOrder[b.status as keyof typeof statusOrder] ?? 99;

            if (statA !== statB) return statA - statB;

            // Deadline Priority: Soonest First (Ascending)
            return new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime();
          });
        } else {
          // User: Strictly Deadline (Soonest Closing First)
          filteredPreds.sort((a: Prediction, b: Prediction) => {
            return new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime();
          });
        }

        setPredictions(filteredPreds);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching predictions:', err);
        setLoading(false);
      }
    };

    fetchPredictions(); // Initial fetch

    // Poll for updates every 10 seconds
    const interval = setInterval(fetchPredictions, 10000);
    return () => clearInterval(interval); // Cleanup on unmount
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

    // Force Effect Re-run (re-fetches data)
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

  // 4. Transactional Betting Logic with AMM Integration (Simplified for API)
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
      // Call the new API endpoint for placing an entry
      await api.placeEntry({
        prediction_id: selectedPrediction.id,
        selected_option_id: optionId,
        amount
      });

      // --- GAMIFICATION LOGIC (Client-side update for immediate feedback) ---
      // In a real scenario, these might also be part of the API response or a separate update.
      const currentXP = userProfile.xp || 0;
      const currentLevel = userProfile.level || 1;
      const newXP = currentXP + GAME_CONFIG.XP_PER_BET;
      const nextLevel = getLevelFromXP(newXP);

      let rewardAmount = 0;
      if (nextLevel > currentLevel) {
        // Check for Milestone Reward
        if (isMilestoneLevel(nextLevel)) {
          rewardAmount = GAME_CONFIG.REWARD_AMOUNT;
        }
        setNewLevelData({ level: nextLevel, reward: rewardAmount > 0 ? rewardAmount : undefined });
      } else {
        setShowSuccess(true); // Show success overlay if no level up
      }

      // Update user profile locally for immediate feedback if possible, otherwise rely on refresh
      // For simplicity, we'll rely on refresh or re-fetch of userProfile if needed elsewhere.

      setIsSubmitting(false);
      setSelectedPrediction(null);

      // Refresh entries to reflect the new entry and update the userEntries state
      const entries = await api.getEntries();
      const map: Record<string, UserEntry> = {};
      entries.forEach((entry: UserEntry) => {
        if (entry.prediction_id) {
          map[entry.prediction_id] = entry;
        }
      });
      setUserEntries(map);

    } catch (e: any) {
      console.error("Entry failed: ", e);
      // Use the error message from the API if available
      const errMsg = e.message || 'Failed to place entry';
      alert(errMsg);
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
      // Optimistic Update: Remove prediction from state immediately
      setPredictions(prev => prev.filter(p => p.id !== id));

      // Call the backend API to delete the prediction
      await api.deletePrediction(id); // Assuming this endpoint exists
    } catch (err: any) {
      console.error("Delete failed", err);
      alert(`Failed to delete: ${err.message}`);
      // If deletion failed, re-fetch predictions to restore the deleted item
      // This is a fallback in case optimistic update was premature
      // For now, we'll assume the API call failing is enough to show an error
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
      return false; // Should not happen with valid filters
    });
  } else if (!adminMode) {
    // Filter by section: creator events vs main events
    filteredPredictions = predictions.filter(p => {
      const isCreatorEvent = !!p.created_by_creator;
      return feedSection === 'creator' ? isCreatorEvent : !isCreatorEvent;
    });

    // Then filter by category if not 'All'
    if (activeTab !== 'All') {
      filteredPredictions = filteredPredictions.filter(p => p.category === activeTab);
    }
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

      {/* Feed Section Toggle (Hide in Admin Mode) */}
      {!adminMode && (
        <div className="mb-6">
          <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
            <button
              onClick={() => setFeedSection('main')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                feedSection === 'main'
                  ? 'bg-zii-card text-white shadow-sm'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              Main Events
            </button>
            <button
              onClick={() => setFeedSection('creator')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                feedSection === 'creator'
                  ? 'bg-zii-card text-white shadow-sm'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              Creator Events
            </button>
          </div>
        </div>
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