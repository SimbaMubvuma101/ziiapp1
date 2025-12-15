import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader } from '../components/Loader';
import { Zap, Star, Copy, CheckCircle, AlertTriangle, Trophy, ArrowLeft, Share2 } from 'lucide-react';
import { PredictionType, PredictionStatus, Prediction, UserEntry } from '../types';
import { calculateAMMOdds } from '../utils/amm';
import { api } from '../utils/api';

export const CreatorStudio: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'create' | 'manage' | 'earnings'>('create');
  const [myEvents, setMyEvents] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [totalEarnings, setTotalEarnings] = useState(0);

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
    const getFutureDate = (hours: number) => {
      const d = new Date();
      d.setTime(d.getTime() + hours * 60 * 60 * 1000);
      const pad = (n: number) => n < 10 ? '0' + n : n;
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setClosingTime(getFutureDate(24));

    // Subscribe to creator's events using API
    const fetchMyEvents = async () => {
      if (!currentUser?.uid) return;
      try {
        const events = await api.getPredictions({ creatorId: currentUser.uid });
        events.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        setMyEvents(events);
        
        // Calculate total earnings from resolved events
        const earnings = events
          .filter(e => e.status === 'resolved')
          .reduce((sum, e) => sum + (e.creator_share || 0), 0);
        setTotalEarnings(earnings);
      } catch (err) {
        console.error('Failed to fetch creator events:', err);
      }
    };

    fetchMyEvents();
    // Poll for updates
    const interval = setInterval(fetchMyEvents, 10000);
    return () => clearInterval(interval);
  }, [currentUser, userProfile]);

  useEffect(() => {
    if (!selectedPred) return;

    // Load entries using API
    const loadEntries = async () => {
      try {
        const entries = await api.getEntries();
        const predEntries = entries.filter(e => e.prediction_id === selectedPred.id);
        setPredEntries(predEntries);
      } catch (err) {
        console.error('Failed to load entries:', err);
      }
    };

    loadEntries();
    // Poll for updates
    const interval = setInterval(loadEntries, 5000);
    return () => clearInterval(interval);
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

      await api.createPrediction(payload);
      
      setStatusMsg('Event Created Successfully!');
      setQuestion('');
      setResolutionSource('');
      setActiveTab('manage');

      // Refresh events after creation
      const events = await api.getPredictions({ creatorId: currentUser!.uid });
      events.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setMyEvents(events);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setStatusMsg(`Failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedPred || !winningOption) return;
    setLoading(true);

    try {
      await api.resolvePrediction(selectedPred.id, winningOption);
      setStatusMsg(`Event resolved! You earned your creator commission.`);
      setSelectedPred(null);

      // Refresh events after resolution
      const events = await api.getPredictions({ creatorId: currentUser!.uid });
      events.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setMyEvents(events);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setStatusMsg(`Failed: ${errorMessage}`);
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

  // CRITICAL: Show loader while profile is loading OR if user is logged in but profile hasn't loaded yet
  // This prevents the redirect logic from running before we know if user is a creator
  if (!userProfile && currentUser) {
    console.log('CreatorStudio: Waiting for profile to load...');
    return (
      <div className="min-h-screen bg-zii-bg flex items-center justify-center">
        <Loader size={50} className="text-zii-accent" />
      </div>
    );
  }
  
  // Only redirect if we have confirmed the user is NOT a creator
  if (userProfile && userProfile.isCreator === false) {
    console.log('CreatorStudio: User is not a creator, redirecting to /earn');
    navigate('/earn');
    return null;
  }

  // If we got here, user should be a creator - log for debugging
  if (userProfile?.isCreator) {
    console.log('CreatorStudio: Creator verified, rendering studio');
  }

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
              {userProfile?.creator_name}
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
          <button
            onClick={() => setActiveTab('earnings')}
            className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
              activeTab === 'earnings' ? 'bg-zii-card text-white' : 'text-white/40'
            }`}
          >
            Earnings
          </button>
        </div>

        {activeTab === 'earnings' ? (
          <div className="space-y-4">
            {/* Total Earnings Card */}
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-3xl p-6">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="text-green-400" size={20} />
                <p className="text-xs text-white/60 uppercase font-bold tracking-widest">Total Earnings</p>
              </div>
              <p className="text-4xl font-black text-green-400 mb-1">${totalEarnings.toFixed(2)}</p>
              <p className="text-xs text-white/40">Lifetime commission from all events</p>
            </div>

            {/* Earnings Breakdown */}
            <div className="bg-zii-card border border-white/5 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Star size={16} className="text-zii-accent" /> How You Earn
              </h3>
              <div className="space-y-3">
                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="flex items-start gap-3">
                    <div className="bg-zii-accent/10 p-2 rounded-lg">
                      <Zap size={16} className="text-zii-accent" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white mb-1">Platform Commission</p>
                      <p className="text-xs text-white/60 leading-relaxed">
                        You earn <span className="text-zii-accent font-bold">2.5%</span> of the total pool (50% of 5% platform fee) when your event is resolved.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Event History */}
            <div className="bg-zii-card border border-white/5 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-4">Earnings History</h3>
              <div className="space-y-2">
                {myEvents.filter(e => e.status === 'resolved').length === 0 ? (
                  <p className="text-center text-white/40 py-8 text-sm">No resolved events yet</p>
                ) : (
                  myEvents
                    .filter(e => e.status === 'resolved')
                    .map(event => (
                      <div key={event.id} className="bg-black/20 p-4 rounded-xl border border-white/5">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-sm font-bold text-white flex-1 pr-2">{event.question}</p>
                          <span className="text-sm font-mono font-bold text-green-400 whitespace-nowrap">
                            +${(event.creator_share || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/40">
                          <CheckCircle size={12} className="text-green-400" />
                          <span>Resolved</span>
                          <span>•</span>
                          <span>Pool: ${(event.pool_size || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'create' ? (
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