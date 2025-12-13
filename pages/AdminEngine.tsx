import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, increment, serverTimestamp, query, where, onSnapshot, writeBatch, setDoc, orderBy } from 'firebase/firestore';
import { Loader } from '../components/Loader';
import { Zap, Activity, LogOut, CheckCircle, AlertTriangle, Layers, Home, Coins, ArrowLeft, Trophy, DollarSign, Users, Ticket, Copy, RefreshCw, Gauge, BarChart3, TrendingUp, TrendingDown, Calendar, Globe, Handshake, Link as LinkIcon, Info } from 'lucide-react';
import { PredictionType, PredictionStatus, Prediction, UserEntry, Affiliate } from '../types';
import { useNavigate } from 'react-router-dom';
import { Feed } from './Feed';
import { calculateAMMOdds } from '../utils/amm';
import { SUPPORTED_COUNTRIES } from '../constants';

export const AdminEngine: React.FC = () => {
  const { isAdmin, logout, currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  
  // Tabs: 'deploy' | 'mint' | 'feed' | 'analytics' | 'partners'
  const [activeTab, setActiveTab] = useState<'deploy' | 'mint' | 'feed' | 'analytics' | 'partners'>('deploy');
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // --- DETAIL VIEW STATE ---
  const [selectedPred, setSelectedPred] = useState<Prediction | null>(null);
  const [predEntries, setPredEntries] = useState<UserEntry[]>([]);
  const [winningOption, setWinningOption] = useState<string>('');
  const [confirmStep, setConfirmStep] = useState(0); // 0 = Idle, 1 = Confirming

  // --- VOUCHER GENERATION STATE ---
  const [mintAmount, setMintAmount] = useState('');
  const [generatedVoucher, setGeneratedVoucher] = useState<{code: string, amount: string} | null>(null);

  // --- ANALYTICS STATE ---
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  // --- PARTNERS / AFFILIATE STATE ---
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerCode, setNewPartnerCode] = useState('');

  // --- DEPLOYMENT STATE ---
  const [deployType, setDeployType] = useState<PredictionType>(PredictionType.YES_NO);
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState('Trends & Viral');
  const [targetCountry, setTargetCountry] = useState('ZW');
  const [hoursToClose, setHoursToClose] = useState('24');
  
  // High Roller Config
  const [deployMode, setDeployMode] = useState<'normal' | 'high_roller'>('normal');
  const [multiplier, setMultiplier] = useState<string>('5');

  const [options, setOptions] = useState<{label: string, payout: number}[]>([
      { label: 'Yes', payout: 15 },
      { label: 'No', payout: 15 }
  ]);
  const [inputConfig, setInputConfig] = useState({
      min: '',
      max: '',
      teamA: '',
      teamB: '',
      payout: 15
  });
  const [stats, setStats] = useState({ users: 0, predictions: 0 });

  // 1. Redirect if not authorized locally
  useEffect(() => {
    if (!isAdmin) {
        navigate('/earn');
        return;
    }
    fetchStats();
  }, [isAdmin, navigate]);

  // Reset local state when prediction is selected/deselected
  useEffect(() => {
     if (selectedPred) {
         setConfirmStep(0);
         setWinningOption('');
     }
  }, [selectedPred]);

  // Fetch Analytics when tab is active
  useEffect(() => {
      if (activeTab === 'analytics') {
          fetchAnalytics();
      }
      if (activeTab === 'partners') {
          fetchAffiliates();
      }
  }, [activeTab]);

  // --- DETAIL VIEW DATA FETCHING ---
  useEffect(() => {
      // 1. Basic Guards
      if (!selectedPred) return;

      // 2. SECURITY GUARD: Strictly wait for DB confirmation of admin status.
      if (!userProfile?.isAdmin) {
          setDetailsLoading(true);
          if (currentUser?.email === 'admin@zii.app') {
              setStatusMsg("Syncing Admin Permissions...");
          }
          return;
      }

      setDetailsLoading(true);
      setStatusMsg('');

      // 3. Query: Get all entries for this prediction
      const q = query(collection(db, "entries"), where("prediction_id", "==", selectedPred.id));
      
      const unsub = onSnapshot(q, 
        (snapshot) => {
          const entries = snapshot.docs.map(d => {
              const data = d.data();
              let createdAtStr = new Date().toISOString();
              if (data.created_at) {
                  if (data.created_at.toDate) {
                      createdAtStr = data.created_at.toDate().toISOString();
                  } else if (typeof data.created_at === 'string') {
                      createdAtStr = data.created_at;
                  }
              }
              return { id: d.id, ...data, created_at: createdAtStr } as UserEntry;
          });
          setPredEntries(entries);
          setDetailsLoading(false);
          setStatusMsg(''); 
        }, 
        (error) => {
          console.error("Admin Entries Query Error:", error);
          if (error.code === 'permission-denied') {
             setStatusMsg("Permission Denied: Database Rules Blocked Access.");
          } else {
             setStatusMsg(`Data Error: ${error.message}`);
          }
          setDetailsLoading(false);
        }
      );

      return () => unsub();
  }, [selectedPred, userProfile]);

  // Reset form when type changes
  useEffect(() => {
      if (deployType === PredictionType.YES_NO) {
          setOptions([{ label: 'Yes', payout: 15 }, { label: 'No', payout: 15 }]);
      } else if (isOptionType(deployType)) {
          setOptions([{ label: '', payout: 15 }, { label: '', payout: 15 }]);
      }
  }, [deployType]);

  const fetchStats = async () => {
     try {
         const predSnap = await getDocs(collection(db, "predictions"));
         setStats(prev => ({ ...prev, predictions: predSnap.size }));
         const usersSnap = await getDocs(collection(db, "users"));
         setStats(prev => ({ ...prev, users: usersSnap.size }));
     } catch (e) { console.warn(e); }
  };

  const fetchAffiliates = () => {
      const q = query(collection(db, "affiliates"), orderBy("created_at", "desc"));
      const unsub = onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Affiliate[];
          setAffiliates(data);
      });
      return unsub; // Clean up handled by effect if we stored the unsub
  };

  const fetchAnalytics = async () => {
      setLoading(true);
      try {
          // Fetch relevant transactions (entry = revenue, winnings = expense)
          // We assume 'entry' amounts are negative (user paid) and 'winnings' are positive (user received)
          const q = query(collection(db, "transactions"), where("type", "in", ["entry", "winnings"]));
          const snapshot = await getDocs(q);
          
          const now = new Date();
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0,0,0,0);
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const startOfYear = new Date(now.getFullYear(), 0, 1);

          let totalProfit = 0;
          let todayProfit = 0;
          let weekProfit = 0;
          let monthProfit = 0;
          let yearProfit = 0;
          
          let firstTxDate = now.getTime();

          snapshot.docs.forEach(doc => {
              const data = doc.data();
              const amount = data.amount || 0;
              // House Profit = -(User Balance Change)
              // If user spends 10 (amount -10), House gets +10
              // If user wins 50 (amount +50), House gets -50
              const housePnL = -1 * amount; 
              
              const txDate = data.created_at?.toDate ? data.created_at.toDate() : new Date(data.created_at);
              if (txDate.getTime() < firstTxDate) firstTxDate = txDate.getTime();

              totalProfit += housePnL;

              if (txDate >= startOfDay) todayProfit += housePnL;
              if (txDate >= startOfWeek) weekProfit += housePnL;
              if (txDate >= startOfMonth) monthProfit += housePnL;
              if (txDate >= startOfYear) yearProfit += housePnL;
          });

          // Calculate Monthly Average
          const monthsRunning = Math.max(1, (now.getTime() - firstTxDate) / (1000 * 60 * 60 * 24 * 30.44));
          const avgMonthly = totalProfit / monthsRunning;

          setAnalyticsData({
              total: totalProfit,
              today: todayProfit,
              week: weekProfit,
              month: monthProfit,
              year: yearProfit,
              avgMonthly: avgMonthly
          });

      } catch (err) {
          console.error("Analytics Error", err);
      } finally {
          setLoading(false);
      }
  };

  const isOptionType = (t: PredictionType) => {
      return [PredictionType.YES_NO, PredictionType.MULTIPLE_CHOICE, PredictionType.NUMBER_RANGE, PredictionType.RANKING_PICK, PredictionType.TREND_OUTCOME].includes(t);
  };

  const handlePredictionClick = (pred: Prediction) => {
      setPredEntries([]);
      setWinningOption('');
      setSelectedPred(pred);
  };

  const handleCreatePartner = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
          // Check if code exists
          const q = query(collection(db, "affiliates"), where("code", "==", newPartnerCode.trim().toUpperCase()));
          const snap = await getDocs(q);
          if (!snap.empty) throw new Error("Partner Code already exists.");

          await addDoc(collection(db, "affiliates"), {
              name: newPartnerName,
              code: newPartnerCode.trim().toUpperCase(),
              total_volume: 0,
              commission_owed: 0,
              active_users_count: 0,
              created_at: serverTimestamp()
          });

          setNewPartnerName('');
          setNewPartnerCode('');
          setStatusMsg("Partner Created Successfully");
      } catch (e: any) {
          setStatusMsg(e.message);
      } finally {
          setLoading(false);
      }
  };

  const copyPartnerLink = (code: string) => {
      // Use window.location.href to ensure we capture any subpaths (e.g. zii.app/app/#/...)
      // We strip the hash to get the base URL, then append the hash route
      const baseUrl = window.location.href.split('#')[0];
      // Ensure no trailing slash duplication
      const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      
      const link = `${cleanBase}/#/?ref=${code}`;
      navigator.clipboard.writeText(link);
      setStatusMsg(`Copied: ${link}`);
  };

  // --- DEPLOY HANDLER ---
  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg('');
    try {
        const closesAt = new Date(Date.now() + parseFloat(hoursToClose) * 60 * 60 * 1000);
        const appliedMultiplier = deployMode === 'high_roller' ? parseFloat(multiplier) : 1;
        
        let payload: any = {
            question, 
            category, 
            country: targetCountry,
            type: deployType, 
            status: PredictionStatus.OPEN, 
            pool_size: 0, 
            closes_at: closesAt, 
            created_at: serverTimestamp(),
            liquidity_pool: {},
            mode: deployMode,
            multiplier: appliedMultiplier
        };

        if (isOptionType(deployType)) {
            const rawOptions = options.map((o, i) => ({ 
                id: `opt_${Date.now()}_${i}`, 
                label: o.label, 
                price: 0
            }));
            const SEED_AMOUNT = 500;
            const liquidityMap: Record<string, number> = {};
            rawOptions.forEach(opt => { liquidityMap[opt.id] = SEED_AMOUNT; });

            const { updatedOptions } = calculateAMMOdds(rawOptions, liquidityMap, undefined, undefined, appliedMultiplier);
            payload.options = updatedOptions;
            payload.liquidity_pool = liquidityMap;
        } else {
            payload.payout = Number(inputConfig.payout); 
            payload.options = []; 
        }

        await addDoc(collection(db, "predictions"), payload);
        setStatusMsg('Prediction Deployed Successfully');
        setQuestion('');
        fetchStats();
    } catch (err: any) { 
        setStatusMsg(`Deployment Failed: ${err.message}`); 
    } finally { 
        setLoading(false); 
    }
  };

  // --- VOUCHER GENERATOR ---
  const handleGenerateVoucher = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setStatusMsg('');
      
      try {
          const amount = parseInt(mintAmount);
          if (!amount || isNaN(amount) || amount <= 0) throw new Error("Invalid Amount");

          const p1 = Math.floor(10000 + Math.random() * 90000);
          const p2 = Math.floor(10000 + Math.random() * 90000);
          const p3 = Math.floor(10000 + Math.random() * 90000);
          const code = `${p1}-${p2}-${p3}`;

          await addDoc(collection(db, "vouchers"), {
             code: code, amount: amount, status: 'active',
             created_by: currentUser?.uid, created_at: serverTimestamp()
          });

          setGeneratedVoucher({ code, amount: mintAmount });
          setStatusMsg(`SUCCESS: Voucher Created.`);
          setMintAmount('');
      } catch (err: any) { 
          setStatusMsg(`Generation Failed: ${err.message}`); 
      } finally { 
          setLoading(false); 
      }
  };

  const copyToClipboard = () => {
      if (generatedVoucher) {
          navigator.clipboard.writeText(generatedVoucher.code);
          setStatusMsg("Code Copied!");
      }
  };

  const handleOptionChange = (idx: number, field: 'label' | 'payout', value: any) => {
      const newOpts = [...options];
      // @ts-ignore
      newOpts[idx][field] = value;
      setOptions(newOpts);
  };

  // --- RESOLUTION LOGIC (BUSINESS MODEL UPDATE) ---
  const handleResolve = async () => {
      console.log("Starting Resolution Process...");
      
      // Safety Checks
      if (!selectedPred) { console.error("No prediction selected"); return; }
      if (!winningOption) { console.error("No option selected"); return; }
      
      setLoading(true);
      try {
          // --- NEW BUSINESS MODEL LOGIC ---
          // 1. Calculate Total Pool (Sum of all bets)
          const totalPool = predEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
          
          // 2. Calculate Commission (5%)
          const commission = totalPool * 0.05;
          const distributablePool = totalPool - commission;

          // 3. Filter Winners
          const winners = predEntries.filter(e => e.selected_option_id === winningOption);
          const losers = predEntries.filter(e => e.selected_option_id !== winningOption);

          // 4. Calculate Winning Volume (Total amount bet on winning option)
          const winningVolume = winners.reduce((sum, entry) => sum + (entry.amount || 0), 0);

          // 5. Calculate Payout Ratio
          // If nobody won (winningVolume = 0), the house takes all (or refunds, but typically takes all in this model).
          const payoutRatio = winningVolume > 0 ? (distributablePool / winningVolume) : 0;

          console.log(`Resolution Stats: TotalPool: ${totalPool}, Comm: ${commission}, Distributable: ${distributablePool}, WinnersVol: ${winningVolume}, Ratio: ${payoutRatio}`);

          // --- BATCH PROCESSING ---
          const BATCH_SIZE_LIMIT = 450; 
          let opsCount = 0;
          let batches = [];
          let currentBatch = writeBatch(db);

          const predRef = doc(db, "predictions", selectedPred.id);
          
          // 1. Update Prediction Status
          currentBatch.update(predRef, { status: PredictionStatus.RESOLVED, winning_option_id: winningOption });
          opsCount++;

          // 2. Process Winners (Paid from the pool)
          for (const entry of winners) {
              if (opsCount >= BATCH_SIZE_LIMIT) {
                  batches.push(currentBatch);
                  currentBatch = writeBatch(db);
                  opsCount = 0;
              }

              const entryRef = doc(db, "entries", entry.id);
              const userRef = doc(db, "users", entry.userId);
              const txRef = doc(collection(db, "transactions")); 
              
              // Calculate Actual Final Payout based on Parimutuel Math
              const actualPayout = (entry.amount || 0) * payoutRatio;

              // Op 1: Mark Entry Won and Update Final Payout Record
              currentBatch.update(entryRef, { 
                  status: 'won',
                  potential_payout: actualPayout 
              });
              
              // Op 2: Credit User Wallet (Real Cash Balance)
              currentBatch.update(userRef, { winnings_balance: increment(actualPayout) });
              
              // Op 3: Create Transaction Record
              currentBatch.set(txRef, {
                  userId: entry.userId, 
                  type: 'winnings', 
                  amount: actualPayout,
                  description: `Won: ${selectedPred.question.substring(0, 15)}...`,
                  created_at: serverTimestamp()
              });

              opsCount += 3;
          }

          // 3. Process Losers
          for (const entry of losers) {
              if (opsCount >= BATCH_SIZE_LIMIT) {
                  batches.push(currentBatch);
                  currentBatch = writeBatch(db);
                  opsCount = 0;
              }

              const entryRef = doc(db, "entries", entry.id);
              // Op 1: Mark Entry Lost AND Zero Out Payout
              currentBatch.update(entryRef, { 
                  status: 'lost',
                  potential_payout: 0
              });
              opsCount++;
          }

          // Push final batch if it has items
          if (opsCount > 0) {
              batches.push(currentBatch);
          }

          // Commit all batches sequentially
          console.log(`Committing ${batches.length} batches to Firestore...`);
          for (const batch of batches) {
              await batch.commit();
          }

          setStatusMsg(`Resolved! Paid out ${winners.length} winners from a pool of $${totalPool.toFixed(2)}.`);
          setSelectedPred(null);
      } catch (err: any) {
          console.error("Resolution CRITICAL FAILURE:", err);
          setStatusMsg(`Resolution Failed: ${err.message}`);
          alert(`Resolution Error: ${err.message}`);
      } finally {
          setLoading(false);
          setConfirmStep(0);
      }
  };

  // Wrapper to handle confirm logic
  const onResolveClick = () => {
      if (confirmStep === 0) {
          setConfirmStep(1);
          // Auto reset safety
          setTimeout(() => setConfirmStep(0), 4000);
      } else {
          handleResolve();
      }
  };

  // --- RENDER DETAIL VIEW ---
  const renderDetailView = () => {
      if (!selectedPred) return null;

      // Full-screen loader while waiting for permissions
      if (detailsLoading) {
          return (
              <div className="fixed inset-0 z-[100] bg-zii-bg/95 backdrop-blur flex flex-col items-center justify-center animate-in fade-in">
                  <div className="relative">
                      <div className="absolute inset-0 bg-zii-accent/20 blur-xl rounded-full"></div>
                      <Loader size={50} className="text-zii-accent relative z-10" />
                  </div>
                  <p className="text-white/50 text-xs font-bold uppercase tracking-[0.2em] mt-6 animate-pulse">
                      {statusMsg && statusMsg.includes("Syncing") ? "Syncing Admin Rights..." : "Syncing Engine Data..."}
                  </p>
                  {statusMsg && statusMsg.includes("Permission") && (
                      <button onClick={() => setSelectedPred(null)} className="mt-8 px-6 py-2 bg-white/10 rounded-full text-sm font-bold hover:bg-white/20 transition-colors">
                          Close
                      </button>
                  )}
              </div>
          );
      }

      // Live Stats for Admin Review
      const totalVolume = predEntries.reduce((acc, curr) => acc + (curr.amount || 0), 0);
      const commission = totalVolume * 0.05;
      const distributable = totalVolume - commission;

      // Calculate hypothetical payout based on current selection
      const winnersHypothetical = winningOption ? predEntries.filter(e => e.selected_option_id === winningOption) : [];
      const winningVol = winnersHypothetical.reduce((acc, curr) => acc + (curr.amount || 0), 0);
      const hypotheticalRatio = winningVol > 0 ? (distributable / winningVol) : 0;

      // CALCULATE COUNTS FOR UI FEEDBACK
      const winnersCount = winnersHypothetical.length;
      const losersCount = winningOption ? predEntries.filter(e => e.selected_option_id !== winningOption).length : 0;

      return (
          // Main Overlay Container - Fixed and High Z-Index
          <div className="fixed inset-0 z-[100] bg-zii-bg flex flex-col animate-in slide-in-from-right duration-300">
              
              {/* 1. Header (Fixed at top) */}
              <div className="bg-zii-bg/95 backdrop-blur border-b border-white/5 p-4 flex items-center justify-between shrink-0 shadow-md">
                  <button onClick={() => setSelectedPred(null)} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors bg-white/5 rounded-full px-3 py-1.5">
                      <ArrowLeft size={16} /> <span className="text-xs font-bold">Back</span>
                  </button>
                  <div className="text-right">
                      <p className={`text-[10px] uppercase font-bold tracking-widest ${selectedPred.status === 'open' ? 'text-zii-accent' : 'text-white/30'}`}>{selectedPred.status}</p>
                      <p className="text-[10px] font-mono text-white/30">{selectedPred.id.substring(0, 8)}...</p>
                  </div>
              </div>

              {/* 2. Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
                  
                  {/* Status Banner */}
                  {statusMsg && (
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex gap-3 text-red-400 items-start animate-in slide-in-from-top-2">
                        <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                        <div>
                            <span className="font-bold text-sm block mb-1">System Notice</span>
                            <span className="text-xs opacity-80">{statusMsg}</span>
                        </div>
                    </div>
                  )}

                  {/* Title Section */}
                  <div>
                      <h1 className="text-2xl font-black text-white mb-2 leading-tight tracking-tight">{selectedPred.question}</h1>
                      <div className="flex gap-4 text-sm text-white/50 font-medium">
                          <span className="flex items-center gap-1.5"><Users size={14} className="text-white/30" /> {predEntries.length} Entries</span>
                          <span className="flex items-center gap-1.5"><DollarSign size={14} className="text-white/30" /> ${totalVolume.toFixed(2)} Pool</span>
                      </div>
                  </div>

                  {/* Resolution Card */}
                  {selectedPred.status !== PredictionStatus.RESOLVED && (
                      <div className="bg-zii-card border border-zii-accent/20 rounded-3xl p-6 shadow-xl shadow-zii-accent/5">
                          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4"><Trophy size={16} className="text-zii-accent" /> Resolve Outcome</h3>
                          <div className="space-y-3">
                              <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Select Winner</label>
                              <div className="grid grid-cols-1 gap-2">
                                  {selectedPred.options.map(opt => {
                                      const optEntries = predEntries.filter(e => e.selected_option_id === opt.id);
                                      const optVol = optEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
                                      return (
                                        <button key={opt.id} onClick={() => setWinningOption(opt.id)} className={`flex justify-between items-center p-4 rounded-xl border text-left transition-all ${winningOption === opt.id ? 'bg-zii-accent text-black border-zii-accent' : 'bg-black/20 border-white/5 text-white/70 hover:bg-black/40'}`}>
                                            <span className="font-bold text-sm">{opt.label}</span>
                                            <div className="text-right text-xs"><p className={`font-mono ${winningOption === opt.id ? 'text-black/60 font-bold' : 'text-white/30'}`}>Vol: ${optVol.toFixed(2)}</p></div>
                                        </button>
                                      );
                                  })}
                              </div>
                          </div>
                          
                          {/* Action Button */}
                          {winningOption && (
                              <div className="mt-6 pt-4 border-t border-white/10 animate-in fade-in slide-in-from-top-2">
                                  <div className="flex justify-between items-center mb-2">
                                      <span className="text-xs text-white/50 font-medium">Pool Commission (5%)</span>
                                      <span className="text-sm font-bold font-mono text-green-400">+${commission.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between items-center mb-4">
                                      <span className="text-xs text-white/50 font-medium">Winner Payout Ratio</span>
                                      <span className="text-xl font-bold font-mono text-white">x{hypotheticalRatio.toFixed(2)}</span>
                                  </div>
                                  
                                  {/* Transparency Stats */}
                                  <div className="grid grid-cols-2 gap-2 mb-4">
                                     <div className="bg-green-500/10 border border-green-500/20 p-2 rounded-lg text-center">
                                         <p className="text-[10px] text-green-400 uppercase font-bold">Paying</p>
                                         <p className="text-lg font-black text-white">{winnersCount} Users</p>
                                     </div>
                                     <div className="bg-red-500/10 border border-red-500/20 p-2 rounded-lg text-center">
                                         <p className="text-[10px] text-red-400 uppercase font-bold">Collecting</p>
                                         <p className="text-lg font-black text-white">{losersCount} Users</p>
                                     </div>
                                  </div>
                                  
                                  {/* ROBUST BUTTON IMPLEMENTATION */}
                                  <button 
                                      onClick={onResolveClick} 
                                      disabled={loading} 
                                      className={`w-full py-4 font-bold rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 ${
                                          confirmStep === 1 
                                            ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/20' 
                                            : 'bg-white text-black hover:bg-white/90 shadow-white/5'
                                      }`}
                                  >
                                      {loading ? (
                                          <Loader className={confirmStep === 1 ? "text-white" : "text-black"} />
                                      ) : confirmStep === 1 ? (
                                          <span className="animate-pulse">CONFIRM PAYOUT?</span>
                                      ) : (
                                          "CONFIRM RESOLUTION"
                                      )}
                                  </button>
                              </div>
                          )}
                      </div>
                  )}

                  {/* Bet Table */}
                  <div>
                      <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Activity size={16} className="text-zii-highlight" /> Live Entries</h3>
                      <div className="bg-zii-card rounded-2xl border border-white/5 overflow-hidden shadow-sm">
                          <table className="w-full text-left text-xs">
                              <thead className="bg-white/5 text-white/30 uppercase font-bold tracking-wider">
                                  <tr><th className="p-4">User</th><th className="p-4">Pick</th><th className="p-4 text-right">Cost</th><th className="p-4 text-right">Est.</th></tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                  {predEntries.sort((a,b) => (b.created_at || '').localeCompare(a.created_at || '')).map(entry => (
                                      <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                                          <td className="p-4 font-medium text-white/80">{entry.username || entry.userId.substring(0, 6)}</td>
                                          <td className="p-4 text-zii-accent font-bold truncate max-w-[100px]">{selectedPred.options.find(o => o.id === entry.selected_option_id)?.label || entry.selected_option_id}</td>
                                          <td className="p-4 text-right font-mono text-white/60">${(entry.amount || 0).toFixed(2)}</td>
                                          <td className="p-4 text-right font-mono font-bold text-white">${(entry.potential_payout || 0).toFixed(2)}</td>
                                      </tr>
                                  ))}
                                  {predEntries.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-white/20 italic">No entries placed yet</td></tr>}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  const MetricCard = ({ label, amount, icon: Icon, timeFrame }: any) => (
      <div className="bg-zii-card p-5 rounded-3xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Icon size={40} />
          </div>
          <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-2 flex items-center gap-2">
              <Icon size={14} className="text-zii-accent" /> {label}
          </p>
          <div className="flex items-baseline gap-1">
             <span className={`text-2xl font-black font-mono tracking-tight ${amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                 {amount >= 0 ? '+' : ''}${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
             </span>
          </div>
          {timeFrame && <p className="text-[10px] text-white/20 mt-1 font-medium">{timeFrame}</p>}
      </div>
  );

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-zii-bg text-white pb-24">
      {selectedPred && renderDetailView()}

      {(activeTab === 'deploy' || activeTab === 'mint' || activeTab === 'analytics' || activeTab === 'partners') && (
        <div className="p-4 animate-in fade-in max-w-md mx-auto">
            <div className="flex justify-between items-center mb-8 pt-2">
                <div>
                    <h1 className="text-xl font-black flex items-center gap-2 text-white tracking-tighter"><span className="text-red-500">ENGINE</span> PANEL</h1>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Admin Control Terminal</p>
                </div>
                <button onClick={() => logout().then(() => navigate('/login'))} className="bg-white/5 hover:bg-white/10 p-2.5 rounded-full text-white/50 border border-white/5 transition-colors"><LogOut size={18} /></button>
            </div>
            
            {activeTab === 'analytics' ? (
                <div className="space-y-6 animate-in slide-in-from-right duration-300">
                     <div className="bg-gradient-to-br from-zii-card to-white/5 p-6 rounded-[2rem] border border-white/10 relative overflow-hidden shadow-2xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-zii-accent/10 blur-[50px] rounded-full pointer-events-none"></div>
                        <h2 className="text-sm font-bold text-white/60 mb-1 flex items-center gap-2"><Activity size={16} className="text-zii-accent" /> Net Profit (All Time)</h2>
                        <div className="text-5xl font-black text-white tracking-tighter mb-2">
                            {analyticsData ? `$${analyticsData.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : <div className="h-12 w-32 bg-white/10 animate-pulse rounded-xl"></div>}
                        </div>
                        <p className="text-xs text-white/30 font-medium">Total House P&L (Entries - Payouts)</p>
                     </div>

                     {analyticsData ? (
                         <>
                            <div className="grid grid-cols-2 gap-3">
                                <MetricCard label="Today" amount={analyticsData.today} icon={TrendingUp} timeFrame="Since 00:00" />
                                <MetricCard label="This Week" amount={analyticsData.week} icon={Calendar} timeFrame="Current Week" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <MetricCard label="This Month" amount={analyticsData.month} icon={BarChart3} timeFrame="Current Month" />
                                <MetricCard label="Avg Monthly" amount={analyticsData.avgMonthly} icon={Gauge} timeFrame="Lifetime Average" />
                            </div>
                            <div className="bg-zii-card p-5 rounded-3xl border border-white/5 flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Year to Date</p>
                                    <p className={`text-xl font-black font-mono ${analyticsData.year >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {analyticsData.year >= 0 ? '+' : ''}${analyticsData.year.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-white/30">
                                    <Trophy size={20} />
                                </div>
                            </div>
                         </>
                     ) : (
                         <div className="py-20 flex justify-center">
                             <Loader className="text-zii-accent" />
                         </div>
                     )}
                </div>
            ) : activeTab === 'partners' ? (
                <div className="space-y-6 animate-in slide-in-from-right duration-300">
                    <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Handshake size={20} className="text-zii-accent" /> Add Affiliate Partner</h2>
                        
                        {/* Info about Link Attribution */}
                        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl mb-6 flex gap-3">
                           <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />
                           <p className="text-xs text-blue-200/80 leading-relaxed">
                               <strong>Universal Link Attribution:</strong> Copy the link below and send it to the partner. When a user (new or old) clicks it, all their bets for the <strong>next 7 days</strong> are attributed to this partner.
                           </p>
                        </div>

                        <form onSubmit={handleCreatePartner} className="space-y-3">
                            <div>
                                <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest pl-1">Partner Name</label>
                                <input required value={newPartnerName} onChange={e => setNewPartnerName(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-zii-accent/50" placeholder="e.g. Influencer Mark" />
                            </div>
                            <div>
                                <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest pl-1">Referral Code</label>
                                <input required value={newPartnerCode} onChange={e => setNewPartnerCode(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-zii-accent/50" placeholder="e.g. MARK25" />
                            </div>
                            <button disabled={loading} className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-zii-accent transition-colors disabled:opacity-50">
                                {loading ? <Loader className="text-black" /> : "Create Partner"}
                            </button>
                        </form>
                    </div>

                    <div className="space-y-3">
                        {affiliates.length === 0 ? (
                            <div className="text-center py-10 text-white/30 text-sm">No partners found.</div>
                        ) : (
                            affiliates.map(aff => {
                                const houseRevenue = (aff.total_volume || 0) * 0.05;
                                const affiliateCut = (aff.commission_owed || 0);
                                
                                return (
                                    <div key={aff.id} className="bg-zii-card border border-white/5 rounded-2xl p-4">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h3 className="font-bold text-white">{aff.name}</h3>
                                                <p className="text-xs text-white/50 font-mono tracking-wider">{aff.code}</p>
                                            </div>
                                            <button onClick={() => copyPartnerLink(aff.code)} className="p-2 bg-white/5 rounded-lg text-white/40 hover:text-white flex items-center gap-2 text-xs font-bold px-3 transition-colors active:scale-95">
                                                <LinkIcon size={14} /> Copy Link
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 bg-black/20 p-3 rounded-xl border border-white/5">
                                            <div>
                                                <p className="text-[9px] text-white/30 uppercase font-bold">Volume</p>
                                                <p className="text-sm font-bold text-white">${(aff.total_volume || 0).toFixed(0)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] text-white/30 uppercase font-bold">House 5%</p>
                                                <p className="text-sm font-bold text-green-400">+${houseRevenue.toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] text-white/30 uppercase font-bold">Owed (10%)</p>
                                                <p className="text-sm font-bold text-zii-accent">${affiliateCut.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            ) : (
                <>
                <div className="grid grid-cols-2 gap-3 mb-8">
                    <div className="bg-zii-card p-5 rounded-3xl border border-white/5 shadow-sm">
                        <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mb-1">Total Users</p>
                        <p className="text-3xl font-black text-white tracking-tighter">{stats.users.toLocaleString()}</p>
                    </div>
                    <div className="bg-zii-card p-5 rounded-3xl border border-white/5 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-zii-accent/10 rounded-full blur-xl"></div>
                        <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mb-1">Active Events</p>
                        <p className="text-3xl font-black text-zii-accent tracking-tighter">{stats.predictions.toLocaleString()}</p>
                    </div>
                </div>

                <div className="bg-zii-card border border-white/5 rounded-3xl p-6 shadow-xl">
                    {statusMsg && (
                        <div className={`mb-6 p-4 rounded-2xl flex items-start gap-3 text-xs font-bold animate-pulse border ${statusMsg.includes('Failed') || statusMsg.includes('Denied') ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-zii-accent/10 border-zii-accent/20 text-zii-accent'}`}>
                            {statusMsg.includes('Failed') || statusMsg.includes('Denied') ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle size={16} className="mt-0.5 shrink-0" />} 
                            <span className="leading-relaxed">{statusMsg}</span>
                        </div>
                    )}

                    {activeTab === 'deploy' && (
                        <form onSubmit={handleDeploy} className="space-y-5">
                            <div className="space-y-1">
                                <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest pl-1">Question Text</label>
                                <textarea required rows={2} value={question} onChange={e => setQuestion(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-zii-accent/50 transition-all resize-none text-sm font-medium" placeholder="e.g. Will it rain tomorrow?" />
                            </div>
                            
                            {/* Country Selector for Deploy */}
                            <div className="space-y-1">
                                <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest pl-1">Target Country</label>
                                <div className="relative">
                                    <select value={targetCountry} onChange={e => setTargetCountry(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-zii-accent/50 appearance-none font-medium">
                                        {SUPPORTED_COUNTRIES.map(c => (
                                            <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-3.5 pointer-events-none text-white/40"><Globe size={14} /></div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest pl-1">Category</label>
                                    <div className="relative">
                                        <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-zii-accent/50 appearance-none font-medium">
                                            <option>Trends & Viral</option>
                                            <option>Music & Culture</option>
                                            <option>Celebrities & Drama</option>
                                            <option>Relationships</option>
                                            <option>Nightlife</option>
                                        </select>
                                        <div className="absolute right-3 top-3.5 pointer-events-none text-white/40"><Layers size={14} /></div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest pl-1">Duration (Hrs)</label>
                                    <input type="number" value={hoursToClose} onChange={e => setHoursToClose(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-zii-accent/50 font-medium" />
                                </div>
                            </div>

                            <div className="space-y-1 pt-2 border-t border-white/5">
                                <div className="flex justify-between items-center pr-1">
                                    <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest pl-1">Event Mode</label>
                                    {deployMode === 'high_roller' && <span className="text-[10px] text-zii-accent font-bold uppercase tracking-wide">High Roller Active</span>}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button type="button" onClick={() => setDeployMode('normal')} className={`py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all border ${deployMode === 'normal' ? 'bg-white text-black border-white' : 'bg-black/40 text-white/50 border-white/5 hover:bg-black/60'}`}>Normal</button>
                                    <button type="button" onClick={() => setDeployMode('high_roller')} className={`py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all border flex items-center justify-center gap-2 ${deployMode === 'high_roller' ? 'bg-zii-accent text-black border-zii-accent' : 'bg-black/40 text-white/50 border-white/5 hover:bg-black/60'}`}><Gauge size={14} /> High Roller</button>
                                </div>
                            </div>
                            
                            {deployMode === 'high_roller' && (
                                <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                                    <label className="text-[10px] text-zii-accent/80 uppercase font-bold tracking-widest pl-1">Multiplier (x)</label>
                                    <input type="number" value={multiplier} onChange={e => setMultiplier(e.target.value)} className="w-full bg-zii-accent/10 border border-zii-accent/30 rounded-xl px-4 py-3 text-zii-accent text-sm focus:outline-none focus:border-zii-accent transition-all font-mono font-bold" placeholder="5" />
                                    <p className="text-[10px] text-white/30 pl-1">Multiplies both Entry Cost and Payout.</p>
                                </div>
                            )}

                            <div className="space-y-2 pt-2 border-t border-white/5">
                                <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest pl-1">Question Type</label>
                                <select value={deployType} onChange={(e) => setDeployType(e.target.value as PredictionType)} className="w-full bg-black/20 border border-white/10 text-white p-3 rounded-xl text-sm font-bold focus:outline-none focus:border-zii-accent/50">
                                    <option value={PredictionType.YES_NO}>1. Yes / No (Binary)</option>
                                    <option value={PredictionType.MULTIPLE_CHOICE}>2. Multiple Choice</option>
                                </select>
                            </div>
                            <div className="space-y-3 bg-black/20 p-4 rounded-2xl border border-white/5">
                                <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Options Configuration</label>
                                {options.map((opt, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <input value={opt.label} onChange={(e) => handleOptionChange(idx, 'label', e.target.value)} className="flex-1 bg-zii-card border border-white/10 p-3 rounded-xl text-sm text-white focus:outline-none focus:border-white/30 transition-all" placeholder={`Option ${idx + 1}`} readOnly={deployType === PredictionType.YES_NO} />
                                        <div className="w-20 bg-white/5 border border-white/5 p-3 rounded-xl text-sm text-center text-white/30 font-mono select-none">Auto</div>
                                    </div>
                                ))}
                                <p className="text-[10px] text-white/20 text-center pt-1 italic">*Pricing Engine auto-seeds liquidity.</p>
                            </div>
                            <button disabled={loading} className="w-full bg-zii-accent text-black font-bold text-lg py-4 rounded-2xl flex justify-center gap-2 hover:bg-white transition-colors disabled:opacity-50 mt-4 shadow-lg shadow-zii-accent/20">
                                {loading ? <Loader className="text-black" /> : <><Zap size={20} fill="currentColor" /> DEPLOY EVENT</>}
                            </button>
                        </form>
                    )}

                    {activeTab === 'mint' && (
                        <div className="space-y-6">
                            {!generatedVoucher ? (
                                <form onSubmit={handleGenerateVoucher} className="space-y-5">
                                    <div className="p-4 bg-zii-accent/5 border border-zii-accent/10 rounded-2xl text-xs text-zii-accent/80 flex items-start gap-3 leading-relaxed">
                                        <Ticket size={18} className="shrink-0 mt-0.5" />
                                        <span>This tool generates a 15-digit secure code. Send this code to a user via WhatsApp/SMS, and they can redeem it in their Wallet tab for immediate coins.</span>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-end mb-1 px-1">
                                            <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Voucher Value</label>
                                            <span className="text-[10px] text-white/60 font-bold tracking-widest">{mintAmount ? `$${parseInt(mintAmount).toFixed(2)}` : '$0.00'}</span>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute left-4 top-3.5 text-white/30"><Coins size={18} /></div>
                                            <input required type="number" value={mintAmount} onChange={e => setMintAmount(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-zii-accent/50 transition-all font-mono" placeholder="100" />
                                        </div>
                                    </div>
                                    <button disabled={loading} className="w-full bg-white text-black font-bold text-lg py-4 rounded-2xl flex justify-center gap-2 hover:bg-zii-accent transition-colors shadow-lg shadow-white/5">
                                        {loading ? <Loader className="text-black" /> : <><Zap size={20} fill="currentColor" /> GENERATE CODE</>}
                                    </button>
                                </form>
                            ) : (
                                <div className="animate-in zoom-in-95 duration-200">
                                    <div className="bg-white text-black p-8 rounded-3xl text-center mb-6 shadow-2xl relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-zii-accent to-zii-highlight"></div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 mb-3">Voucher Code</p>
                                        <h2 className="text-3xl font-black font-mono tracking-wider mb-4 border-b-2 border-dashed border-black/10 pb-4">{generatedVoucher.code}</h2>
                                        <div className="flex justify-center items-center gap-2">
                                            <p className="text-xl font-bold">{generatedVoucher.amount} Coins</p>
                                            <span className="text-sm opacity-50 font-mono">(${parseInt(generatedVoucher.amount).toFixed(2)})</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={copyToClipboard} className="bg-white/10 hover:bg-white/20 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors border border-white/5"><Copy size={18} /> Copy</button>
                                        <button onClick={() => { setGeneratedVoucher(null); setMintAmount(''); }} className="bg-zii-accent text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-white transition-colors shadow-lg shadow-zii-accent/20"><RefreshCw size={18} /> New</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                </>
            )}
        </div>
      )}

      {activeTab === 'feed' && (
        <div className="min-h-screen bg-zii-bg relative">
            <div className="p-4 pb-0 pt-6">
                <h2 className="text-xl font-black text-white mb-1 tracking-tight">Manage Events</h2>
                <p className="text-xs text-white/50 mb-4 font-medium">Click any active event to view stats & resolve outcomes.</p>
            </div>
            <Feed adminMode={true} onPredictionClick={handlePredictionClick} />
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-zii-bg/95 backdrop-blur-xl border-t border-white/5 pb-safe">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
          <button onClick={() => setActiveTab('deploy')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === 'deploy' ? 'text-red-500' : 'text-white/40 hover:text-white/60'}`}><Zap size={20} strokeWidth={2.5} /><span className="text-[10px] font-medium tracking-wide uppercase">Deploy</span></button>
          <button onClick={() => setActiveTab('feed')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === 'feed' ? 'text-zii-accent' : 'text-white/40 hover:text-white/60'}`}><Home size={20} strokeWidth={2.5} /><span className="text-[10px] font-medium tracking-wide uppercase">Manage</span></button>
          <button onClick={() => setActiveTab('analytics')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === 'analytics' ? 'text-zii-accent' : 'text-white/40 hover:text-white/60'}`}><BarChart3 size={20} strokeWidth={2.5} /><span className="text-[10px] font-medium tracking-wide uppercase">Analytics</span></button>
          <button onClick={() => setActiveTab('partners')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === 'partners' ? 'text-zii-accent' : 'text-white/40 hover:text-white/60'}`}><Handshake size={20} strokeWidth={2.5} /><span className="text-[10px] font-medium tracking-wide uppercase">Partners</span></button>
        </div>
      </div>
    </div>
  );
};