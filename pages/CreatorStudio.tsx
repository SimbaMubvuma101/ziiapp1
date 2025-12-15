
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, doc, serverTimestamp, runTransaction, writeBatch, increment } from 'firebase/firestore';
import { Loader } from '../components/Loader';
import { Zap, Star, TrendingUp, Copy, CheckCircle, AlertTriangle, Trophy, Coins, ArrowLeft, Share2, Globe } from 'lucide-react';
import { PredictionType, PredictionStatus, Prediction, UserEntry } from '../types';
import { calculateAMMOdds } from '../utils/amm';
import { SUPPORTED_COUNTRIES } from '../constants';

export const CreatorStudio: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const [myEvents, setMyEvents] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  
  // Create Form
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState('Trends & Viral');
  const [deployType, setDeployType] = useState<PredictionType>(PredictionType.YES_NO);
  const [closingTime, setClosingTime] = useState('');
  const [resolutionSource, setResolutionSource] = useState('');
  const [options, setOptions] = useState([
    { label: 'Yes', payout: 15 },
    { label: 'No', payout: 15 }
  ]);

  // Reset options when type changes
  useEffect(() => {
    if (deployType === PredictionType.YES_NO) {
      setOptions([{ label: 'Yes', payout: 15 }, { label: 'No', payout: 15 }]);
    } else if (deployType === PredictionType.MULTIPLE_CHOICE) {
      setOptions([{ label: '', payout: 15 }, { label: '', payout: 15 }, { label: '', payout: 15 }]);
    }
  }, [deployType]);
  
  // Detail View
  const [selectedPred, setSelectedPred] = useState<Prediction | null>(null);
  const [predEntries, setPredEntries] = useState<UserEntry[]>([]);
  const [winningOption, setWinningOption] = useState('');
  const [confirmStep, setConfirmStep] = useState(0);

  useEffect(() => {
    if (!currentUser) {
      navigate('/earn');
      return;
    }
    
    // Wait for userProfile to load completely before checking creator status
    // Don't redirect while profile is still loading (userProfile === null)
    if (userProfile && !userProfile.isCreator) {
      navigate('/earn');
      return;
    }

    const getFutureDate = (hours: number) => {
      const d = new Date();
      d.setTime(d.getTime() + hours * 60 * 60 * 1000);
      const pad = (n: number) => n < 10 ? '0' + n : n;
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setClosingTime(getFutureDate(24));

    // Subscribe to creator's events
    const q = query(collection(db, "predictions"), where("created_by_creator", "==", currentUser.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const events = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Prediction[];
      events.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setMyEvents(events);
    });

    return () => unsub();
  }, [currentUser, userProfile, navigate]);

  useEffect(() => {
    if (!selectedPred) return;

    const q = query(collection(db, "entries"), where("prediction_id", "==", selectedPred.id));
    const unsub = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(d => {
        const data = d.data();
        let createdAtStr = new Date().toISOString();
        if (data.created_at?.toDate) {
          createdAtStr = data.created_at.toDate().toISOString();
        }
        return { id: d.id, ...data, created_at: createdAtStr } as UserEntry;
      });
      setPredEntries(entries);
    });

    return () => unsub();
  }, [selectedPred]);

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg('');

    try {
      const closesAt = new Date(closingTime);
      
      let payload: any = {
        question,
        category,
        country: userProfile?.creator_country || 'ZW',
        type: deployType,
        status: PredictionStatus.OPEN,
        pool_size: 0,
        closes_at: closesAt,
        created_at: serverTimestamp(),
        liquidity_pool: {},
        mode: 'normal',
        multiplier: 1,
        resolution_source: resolutionSource,
        created_by_creator: currentUser?.uid,
        creator_name: userProfile?.creator_name,
        creator_share: 0
      };

      const rawOptions = options.map((o, i) => ({
        id: `opt_${Date.now()}_${i}`,
        label: o.label,
        price: 0
      }));
      
      const SEED_AMOUNT = 500;
      const liquidityMap: Record<string, number> = {};
      rawOptions.forEach(opt => { liquidityMap[opt.id] = SEED_AMOUNT; });

      const { updatedOptions } = calculateAMMOdds(rawOptions, liquidityMap, undefined, undefined, 1);
      payload.options = updatedOptions;
      payload.liquidity_pool = liquidityMap;

      await addDoc(collection(db, "predictions"), payload);
      
      // Update creator stats
      const userRef = doc(db, "users", currentUser!.uid);
      await runTransaction(db, async (transaction) => {
        transaction.update(userRef, {
          total_events_created: increment(1)
        });
      });

      setStatusMsg('Event Created Successfully!');
      setQuestion('');
      setResolutionSource('');
      setActiveTab('manage');
    } catch (err: any) {
      setStatusMsg(`Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedPred || !winningOption) return;
    setLoading(true);

    try {
      const totalPool = predEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
      const platformCommission = totalPool * 0.05;
      const creatorCommission = platformCommission * 0.5; // 50% of platform commission
      const distributablePool = totalPool - platformCommission;
      
      const winners = predEntries.filter(e => e.selected_option_id === winningOption);
      const losers = predEntries.filter(e => e.selected_option_id !== winningOption);
      const winningVolume = winners.reduce((sum, entry) => sum + (entry.amount || 0), 0);
      const payoutRatio = winningVolume > 0 ? (distributablePool / winningVolume) : 0;

      const BATCH_SIZE_LIMIT = 450;
      let opsCount = 0;
      let batches = [];
      let currentBatch = writeBatch(db);

      const predRef = doc(db, "predictions", selectedPred.id);
      currentBatch.update(predRef, { 
        status: PredictionStatus.RESOLVED, 
        winning_option_id: winningOption,
        creator_share: creatorCommission 
      });
      opsCount++;

      // Credit creator
      const creatorRef = doc(db, "users", selectedPred.created_by_creator!);
      currentBatch.update(creatorRef, { 
        winnings_balance: increment(creatorCommission),
        total_commission_earned: increment(creatorCommission)
      });
      opsCount++;

      const creatorTxRef = doc(collection(db, "transactions"));
      currentBatch.set(creatorTxRef, {
        userId: selectedPred.created_by_creator,
        type: 'winnings',
        amount: creatorCommission,
        description: `Creator Commission: ${selectedPred.question.substring(0, 20)}...`,
        created_at: serverTimestamp()
      });
      opsCount++;

      for (const entry of winners) {
        if (opsCount >= BATCH_SIZE_LIMIT) { batches.push(currentBatch); currentBatch = writeBatch(db); opsCount = 0; }
        const entryRef = doc(db, "entries", entry.id);
        const userRef = doc(db, "users", entry.userId);
        const txRef = doc(collection(db, "transactions"));
        const actualPayout = (entry.amount || 0) * payoutRatio;

        currentBatch.update(entryRef, { status: 'won', potential_payout: actualPayout });
        currentBatch.update(userRef, { winnings_balance: increment(actualPayout) });
        currentBatch.set(txRef, { 
          userId: entry.userId, 
          type: 'winnings', 
          amount: actualPayout, 
          description: `Won: ${selectedPred.question.substring(0, 15)}...`, 
          created_at: serverTimestamp() 
        });
        opsCount += 3;
      }

      for (const entry of losers) {
        if (opsCount >= BATCH_SIZE_LIMIT) { batches.push(currentBatch); currentBatch = writeBatch(db); opsCount = 0; }
        const entryRef = doc(db, "entries", entry.id);
        currentBatch.update(entryRef, { status: 'lost', potential_payout: 0 });
        opsCount++;
      }

      if (opsCount > 0) batches.push(currentBatch);
      for (const batch of batches) await batch.commit();

      setStatusMsg(`Resolved! You earned $${creatorCommission.toFixed(2)} commission.`);
      setSelectedPred(null);
    } catch (err: any) {
      setStatusMsg(`Failed: ${err.message}`);
    } finally {
      setLoading(false);
      setConfirmStep(0);
    }
  };

  const copyEventLink = (eventId: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/#/creator/event/${eventId}`;
    navigator.clipboard.writeText(link);
    setStatusMsg(`Link copied!`);
  };

  // Show loader while profile is still loading
  if (!userProfile) {
    return (
      <div className="min-h-screen bg-zii-bg flex items-center justify-center">
        <Loader size={50} className="text-zii-accent" />
      </div>
    );
  }
  
  if (!userProfile.isCreator) return null;

  if (selectedPred) {
    const totalVolume = predEntries.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const platformCommission = totalVolume * 0.05;
    const creatorCommission = platformCommission * 0.5;
    const distributable = totalVolume - platformCommission;
    const winnersHypothetical = winningOption ? predEntries.filter(e => e.selected_option_id === winningOption) : [];
    const winningVol = winnersHypothetical.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const hypotheticalRatio = winningVol > 0 ? (distributable / winningVol) : 0;

    return (
      <div className="min-h-screen bg-zii-bg pb-24">
        <div className="p-4 max-w-md mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setSelectedPred(null)} className="flex items-center gap-2 text-white/60 hover:text-white">
              <ArrowLeft size={18} /> Back
            </button>
          </div>

          <h1 className="text-2xl font-black text-white mb-4">{selectedPred.question}</h1>

          <div className="bg-zii-card border border-white/5 p-4 rounded-2xl mb-6">
            <h3 className="text-xs font-bold text-white/60 mb-3">Pool Economics</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-black/20 p-3 rounded-xl">
                <p className="text-[9px] text-white/40 uppercase font-bold mb-1">Total Bets</p>
                <p className="text-sm font-mono font-bold text-white">${totalVolume.toFixed(2)}</p>
              </div>
              <div className="bg-black/20 p-3 rounded-xl">
                <p className="text-[9px] text-white/40 uppercase font-bold mb-1">Your Cut</p>
                <p className="text-sm font-mono font-bold text-green-400">+${creatorCommission.toFixed(2)}</p>
              </div>
              <div className="bg-black/20 p-3 rounded-xl">
                <p className="text-[9px] text-white/40 uppercase font-bold mb-1">Prize Pool</p>
                <p className="text-sm font-mono font-bold text-zii-accent">${distributable.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {selectedPred.status !== PredictionStatus.RESOLVED && (
            <div className="bg-zii-card border border-zii-accent/20 rounded-3xl p-6">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Trophy size={16} className="text-zii-accent" /> Resolve Outcome
              </h3>
              <div className="space-y-3">
                <label className="text-[10px] uppercase font-bold text-white/40">Select Winner</label>
                <div className="grid grid-cols-1 gap-2">
                  {selectedPred.options.map(opt => (
                    <button 
                      key={opt.id} 
                      onClick={() => setWinningOption(opt.id)}
                      className={`p-4 rounded-xl text-left transition-all ${
                        winningOption === opt.id 
                          ? 'bg-zii-accent text-black border border-zii-accent' 
                          : 'bg-black/20 border border-white/5 text-white/70 hover:bg-black/40'
                      }`}
                    >
                      <span className="font-bold text-sm">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {winningOption && (
                <div className="mt-6 pt-4 border-t border-white/10">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs text-white/50">Your Commission</span>
                    <span className="text-xl font-bold font-mono text-green-400">+${creatorCommission.toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={() => confirmStep === 1 ? handleResolve() : setConfirmStep(1)}
                    disabled={loading}
                    className={`w-full py-4 font-bold rounded-xl transition-all ${
                      confirmStep === 1 
                        ? 'bg-red-500 text-white hover:bg-red-600' 
                        : 'bg-white text-black hover:bg-zii-accent'
                    }`}
                  >
                    {loading ? <Loader className="text-black" /> : confirmStep === 1 ? 'CONFIRM?' : 'RESOLVE EVENT'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zii-bg pb-24">
      <div className="p-4 max-w-md mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <Star className="text-zii-accent" size={24} /> Creator Studio
            </h1>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
              {userProfile.creator_name}
            </p>
          </div>
          <button onClick={() => navigate('/earn')} className="text-white/60 hover:text-white">
            <ArrowLeft size={20} />
          </button>
        </div>

        {statusMsg && (
          <div className={`mb-6 p-4 rounded-2xl flex items-start gap-3 text-xs font-bold ${
            statusMsg.includes('Failed') 
              ? 'bg-red-500/10 border border-red-500/20 text-red-400' 
              : 'bg-zii-accent/10 border border-zii-accent/20 text-zii-accent'
          }`}>
            {statusMsg.includes('Failed') ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
            <span>{statusMsg}</span>
          </div>
        )}

        <div className="flex p-1 bg-white/5 rounded-xl mb-6">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
              activeTab === 'create' ? 'bg-zii-card text-white' : 'text-white/40'
            }`}
          >
            Create Event
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
              activeTab === 'manage' ? 'bg-zii-card text-white' : 'text-white/40'
            }`}
          >
            My Events ({myEvents.length})
          </button>
        </div>

        {activeTab === 'create' ? (
          <form onSubmit={handleDeploy} className="space-y-4">
            <div className="bg-zii-card border border-white/5 rounded-2xl p-5">
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-white/40 uppercase font-bold pl-1">Question</label>
                  <textarea 
                    required 
                    rows={2} 
                    value={question} 
                    onChange={e => setQuestion(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm resize-none focus:outline-none focus:border-zii-accent/50"
                    placeholder="e.g. Will it rain tomorrow?"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-white/40 uppercase font-bold pl-1">Category</label>
                    <select 
                      value={category} 
                      onChange={e => setCategory(e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-zii-accent/50"
                    >
                      <option>Trends & Viral</option>
                      <option>Music & Culture</option>
                      <option>Celebrities & Drama</option>
                      <option>Relationships</option>
                      <option>Nightlife</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-white/40 uppercase font-bold pl-1">Closes</label>
                    <input 
                      type="datetime-local" 
                      value={closingTime} 
                      onChange={e => setClosingTime(e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-zii-accent/50 [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-white/40 uppercase font-bold pl-1">Resolution Source</label>
                  <input 
                    type="text" 
                    value={resolutionSource} 
                    onChange={e => setResolutionSource(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-zii-accent/50"
                    placeholder="e.g. Official Twitter"
                  />
                </div>

                <div className="space-y-2 pt-2 border-t border-white/5">
                  <label className="text-[10px] text-white/40 uppercase font-bold pl-1">Question Type</label>
                  <select 
                    value={deployType} 
                    onChange={(e) => setDeployType(e.target.value as PredictionType)} 
                    className="w-full bg-black/20 border border-white/10 text-white p-3 rounded-xl text-sm font-bold focus:outline-none focus:border-zii-accent/50"
                  >
                    <option value={PredictionType.YES_NO}>Yes / No (Binary)</option>
                    <option value={PredictionType.MULTIPLE_CHOICE}>Multiple Choice</option>
                  </select>
                </div>

                <div className="space-y-3 bg-black/20 p-4 rounded-2xl border border-white/5">
                  <label className="text-[10px] text-white/40 uppercase font-bold">Options Configuration</label>
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input 
                        value={opt.label} 
                        onChange={e => {
                          const newOpts = [...options];
                          newOpts[idx].label = e.target.value;
                          setOptions(newOpts);
                        }}
                        className="flex-1 bg-zii-card border border-white/10 p-3 rounded-xl text-sm text-white focus:outline-none focus:border-white/30 transition-all"
                        placeholder={`Option ${idx + 1}`}
                        readOnly={deployType === PredictionType.YES_NO}
                      />
                      <div className="w-20 bg-white/5 border border-white/5 p-3 rounded-xl text-sm text-center text-white/30 font-mono select-none">Auto</div>
                    </div>
                  ))}
                  <p className="text-[10px] text-white/20 text-center pt-1 italic">*Pricing Engine auto-seeds liquidity.</p>
                </div>
              </div>
            </div>

            <button 
              disabled={loading}
              className="w-full bg-zii-accent text-black font-bold py-4 rounded-xl hover:bg-white transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader className="text-black" /> : <><Zap size={20} /> Deploy Event</>}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            {myEvents.length === 0 ? (
              <div className="text-center py-20 text-white/30">No events yet</div>
            ) : (
              myEvents.map(event => (
                <div key={event.id} className="bg-zii-card border border-white/5 rounded-2xl p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-white text-sm mb-1">{event.question}</h3>
                      <p className="text-xs text-white/40">{event.status}</p>
                    </div>
                    <button 
                      onClick={() => copyEventLink(event.id)}
                      className="bg-white/5 p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <Share2 size={16} className="text-zii-accent" />
                    </button>
                  </div>
                  
                  {event.status === PredictionStatus.CLOSED && (
                    <button 
                      onClick={() => setSelectedPred(event)}
                      className="w-full bg-zii-accent/10 text-zii-accent font-bold py-2 rounded-lg hover:bg-zii-accent/20 transition-all text-sm"
                    >
                      Resolve Event
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
