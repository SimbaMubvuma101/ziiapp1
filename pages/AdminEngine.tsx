import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, increment, serverTimestamp, query, where, onSnapshot, writeBatch, setDoc, orderBy, runTransaction } from 'firebase/firestore';
import { Loader } from '../components/Loader';
import { Zap, Activity, LogOut, CheckCircle, AlertTriangle, Layers, Home, Coins, ArrowLeft, Trophy, DollarSign, Users, Ticket, Copy, RefreshCw, Gauge, BarChart3, TrendingUp, TrendingDown, Calendar, Globe, Handshake, Link as LinkIcon, Info, Wallet, FileText, PieChart, ArrowUpRight, ArrowDownLeft, UserPlus, CreditCard, LayoutTemplate, Lightbulb, Dna, Settings, Save, Megaphone, Lock, Star } from 'lucide-react';
import { PredictionType, PredictionStatus, Prediction, UserEntry, Affiliate, PlatformSettings, CreatorInvite } from '../types';
import { useNavigate } from 'react-router-dom';
import { Feed } from './Feed';
import { calculateAMMOdds } from '../utils/amm';
import { SUPPORTED_COUNTRIES } from '../constants';

export const AdminEngine: React.FC = () => {
  const { isAdmin, logout, currentUser, userProfile, platformSettings } = useAuth();
  const navigate = useNavigate();
  
  // Tabs: 'deploy' | 'mint' | 'feed' | 'analytics' | 'partners' | 'creators' | 'settings'
  const [activeTab, setActiveTab] = useState<'deploy' | 'mint' | 'feed' | 'analytics' | 'partners' | 'creators' | 'settings'>('deploy');
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Manage Feed Sub-Tabs
  const [manageSubTab, setManageSubTab] = useState<'open' | 'closed' | 'resolved'>('open');
  
  // Analytics Sub-Tabs
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'financials' | 'activity' | 'growth'>('financials');

  // Partners Sub-Tabs
  const [partnerSubTab, setPartnerSubTab] = useState<'overview' | 'onboard' | 'payouts'>('overview');

  // Deploy Sub-Tabs
  const [deploySubTab, setDeploySubTab] = useState<'event' | 'vouchers' | 'templates'>('event');

  // Settings State (Local to allow editing before saving)
  const [settingsForm, setSettingsForm] = useState<PlatformSettings>({
      maintenance_mode: false,
      welcome_bonus: 100,
      referral_bonus: 10,
      min_cashout: 5,
      banner_message: "",
      banner_active: false
  });

  // --- DETAIL VIEW STATE ---
  const [selectedPred, setSelectedPred] = useState<Prediction | null>(null);
  const [predEntries, setPredEntries] = useState<UserEntry[]>([]);
  const [winningOption, setWinningOption] = useState<string>('');
  const [confirmStep, setConfirmStep] = useState(0); // 0 = Idle, 1 = Confirming

  // --- VOUCHER GENERATION STATE ---
  const [mintAmount, setMintAmount] = useState('');
  const [generatedVoucher, setGeneratedVoucher] = useState<{code: string, amount: string} | null>(null);

  // --- ANALYTICS STATE ---
  const [analyticsData, setAnalyticsData] = useState<{
      // Financials
      totalRevenue: number;
      entryFees: number;
      cashoutFees: number;
      revenueToday: number;
      revenueWeek: number;
      revenueMonth: number;
      avgMonthlyRevenue: number;
      
      // Volume / Activity
      totalVolume: number;
      entryVolume: number;
      cashoutVolume: number;
      volumeToday: number;
      volumeWeek: number;
      volumeMonth: number;
      txCount: number;
  } | null>(null);

  // --- PARTNERS / AFFILIATE STATE ---
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerCode, setNewPartnerCode] = useState('');

  // --- CREATOR INVITES STATE ---
  const [creatorInvites, setCreatorInvites] = useState<any[]>([]);
  const [newCreatorName, setNewCreatorName] = useState('');
  const [newCreatorCountry, setNewCreatorCountry] = useState('ZW');

  // --- DEPLOYMENT STATE ---
  
  // Helper to format date for datetime-local input (YYYY-MM-DDThh:mm)
  const getFutureDate = (hours: number) => {
    const d = new Date();
    d.setTime(d.getTime() + hours * 60 * 60 * 1000);
    const pad = (n: number) => n < 10 ? '0' + n : n;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [deployType, setDeployType] = useState<PredictionType>(PredictionType.YES_NO);
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState('Trends & Viral');
  const [targetCountry, setTargetCountry] = useState('ZW');
  const [closingTime, setClosingTime] = useState(getFutureDate(24));
  const [resolutionSource, setResolutionSource] = useState('');
  
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

  // Sync Local Settings Form with Context
  useEffect(() => {
      if (platformSettings) {
          setSettingsForm(platformSettings);
      }
  }, [platformSettings]);

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
      if (activeTab === 'creators') {
          fetchCreatorInvites();
      }
  }, [activeTab]);

  const fetchCreatorInvites = () => {
      const q = query(collection(db, "creator_invites"), orderBy("created_at", "desc"));
      const unsub = onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as CreatorInvite[];
          setCreatorInvites(data);
      });
      return unsub;
  };

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
                      createdAtStr = data.created_at.toDate().toISOString();
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
      // Only reset if we are NOT applying a template (heuristic: if question is empty)
      if (question === '') {
          if (deployType === PredictionType.YES_NO) {
              setOptions([{ label: 'Yes', payout: 15 }, { label: 'No', payout: 15 }]);
          } else if (isOptionType(deployType)) {
              setOptions([{ label: '', payout: 15 }, { label: '', payout: 15 }]);
          }
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
          // Fetch relevant transactions for revenue calculation
          // Revenue Sources:
          // 1. 'entry' -> 5% Commission
          // 2. 'cashout' -> 10% Fee
          const q = query(collection(db, "transactions"), where("type", "in", ["entry", "cashout"]));
          const snapshot = await getDocs(q);
          
          const now = new Date();
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0,0,0,0);
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          
          // Revenue Metrics
          let totalRevenue = 0;
          let entryRevenue = 0;
          let cashoutRevenue = 0;
          let revenueToday = 0;
          let revenueWeek = 0;
          let revenueMonth = 0;
          
          // Volume Metrics
          let totalVolume = 0;
          let entryVolume = 0;
          let cashoutVolume = 0;
          let volumeToday = 0;
          let volumeWeek = 0;
          let volumeMonth = 0;

          let firstTxDate = now.getTime();

          snapshot.docs.forEach(doc => {
              const data = doc.data();
              const type = data.type;
              const amount = Math.abs(data.amount || 0);
              
              const txDate = data.created_at?.toDate ? data.created_at.toDate() : new Date(data.created_at);
              if (txDate.getTime() < firstTxDate) firstTxDate = txDate.getTime();

              let fee = 0;
              
              if (type === 'entry') {
                  fee = amount * 0.05; // 5% Commission on Entry Volume
                  entryRevenue += fee;
                  entryVolume += amount;
              } else if (type === 'cashout') {
                  fee = amount * 0.10; // 10% Fee on Withdrawals
                  cashoutRevenue += fee;
                  cashoutVolume += amount;
              }

              totalRevenue += fee;
              totalVolume += amount;

              if (txDate >= startOfDay) {
                  revenueToday += fee;
                  volumeToday += amount;
              }
              if (txDate >= startOfWeek) {
                  revenueWeek += fee;
                  volumeWeek += amount;
              }
              if (txDate >= startOfMonth) {
                  revenueMonth += fee;
                  volumeMonth += amount;
              }
          });

          // Calculate Monthly Average
          const monthsRunning = Math.max(1, (now.getTime() - firstTxDate) / (1000 * 60 * 60 * 24 * 30.44));
          const avgMonthlyRevenue = totalRevenue / monthsRunning;

          setAnalyticsData({
              totalRevenue,
              entryFees: entryRevenue,
              cashoutFees: cashoutRevenue,
              revenueToday,
              revenueWeek,
              revenueMonth,
              avgMonthlyRevenue,
              
              totalVolume,
              entryVolume,
              cashoutVolume,
              volumeToday,
              volumeWeek,
              volumeMonth,
              txCount: snapshot.size
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

  const handleCreateCreatorInvite = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
          const code = `CREATOR-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
          
          await addDoc(collection(db, "creator_invites"), {
              code,
              name: newCreatorName,
              country: newCreatorCountry,
              status: 'active',
              created_at: serverTimestamp(),
              created_by: currentUser?.uid
          });

          setNewCreatorName('');
          setStatusMsg("Creator Invite Generated!");
          
          // Copy link immediately
          const baseUrl = window.location.href.split('#')[0];
          const link = `${baseUrl}#/creator/invite?code=${code}`;
          navigator.clipboard.writeText(link);
      } catch (e: any) {
          setStatusMsg(e.message);
      } finally {
          setLoading(false);
      }
  };

  const revokeCreatorInvite = async (inviteId: string) => {
      try {
          const inviteRef = doc(db, "creator_invites", inviteId);
          await runTransaction(db, async (transaction) => {
              transaction.update(inviteRef, { status: 'revoked' });
          });
          setStatusMsg("Invite Revoked");
      } catch (e: any) {
          setStatusMsg(e.message);
      }
  };

  const copyCreatorInviteLink = (code: string) => {
      const baseUrl = window.location.href.split('#')[0];
      const link = `${baseUrl}#/creator/invite?code=${code}`;
      navigator.clipboard.writeText(link);
      setStatusMsg(`Invite link copied!`);
  };

  const copyPartnerLink = (code: string) => {
      const baseUrl = window.location.href.split('#')[0];
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
        const closesAt = new Date(closingTime);
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
            multiplier: appliedMultiplier,
            resolution_source: resolutionSource
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
        setResolutionSource('');
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

  // --- SETTINGS HANDLER ---
  const handleSaveSettings = async () => {
      setLoading(true);
      setStatusMsg('');
      try {
          const settingsRef = doc(db, 'system', 'platform');
          await setDoc(settingsRef, settingsForm, { merge: true });
          setStatusMsg("Platform settings updated successfully.");
      } catch (e: any) {
          setStatusMsg(`Failed to save settings: ${e.message}`);
      } finally {
          setLoading(false);
      }
  };

  // --- TEMPLATE LOGIC ---
  const applyTemplate = (type: string) => {
      if (type === 'zesa') {
          setQuestion('Will there be Load Shedding in Harare CBD tonight?');
          setCategory('Trends & Viral');
          setDeployType(PredictionType.YES_NO);
          setClosingTime(getFutureDate(6));
          setOptions([{ label: 'Yes (Darkness)', payout: 15 }, { label: 'No (Lights On)', payout: 15 }]);
      } else if (type === 'soccer') {
          setQuestion('EPL: Man City vs Arsenal - Who wins?');
          setCategory('Music & Culture');
          setDeployType(PredictionType.MULTIPLE_CHOICE);
          setClosingTime(getFutureDate(48));
          setOptions([{ label: 'Man City', payout: 15 }, { label: 'Arsenal', payout: 15 }, { label: 'Draw', payout: 15 }]);
      } else if (type === 'rate') {
          setQuestion('Will the ZiG/USD street rate exceed 25.00 this week?');
          setCategory('Trends & Viral');
          setDeployType(PredictionType.YES_NO);
          setClosingTime(getFutureDate(120));
          setOptions([{ label: 'Yes', payout: 15 }, { label: 'No', payout: 15 }]);
      }
      setDeploySubTab('event');
      setStatusMsg('Template Applied! Review and Deploy.');
  };

  // --- RESOLUTION LOGIC ---
  const handleResolve = async () => {
      if (!selectedPred || !winningOption) return;
      setLoading(true);
      try {
          const totalPool = predEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
          const commission = totalPool * 0.05;
          const distributablePool = totalPool - commission;
          const winners = predEntries.filter(e => e.selected_option_id === winningOption);
          const losers = predEntries.filter(e => e.selected_option_id !== winningOption);
          const winningVolume = winners.reduce((sum, entry) => sum + (entry.amount || 0), 0);
          const payoutRatio = winningVolume > 0 ? (distributablePool / winningVolume) : 0;

          const BATCH_SIZE_LIMIT = 450; 
          let opsCount = 0;
          let batches = [];
          let currentBatch = writeBatch(db);

          const predRef = doc(db, "predictions", selectedPred.id);
          currentBatch.update(predRef, { status: PredictionStatus.RESOLVED, winning_option_id: winningOption });
          opsCount++;

          for (const entry of winners) {
              if (opsCount >= BATCH_SIZE_LIMIT) { batches.push(currentBatch); currentBatch = writeBatch(db); opsCount = 0; }
              const entryRef = doc(db, "entries", entry.id);
              const userRef = doc(db, "users", entry.userId);
              const txRef = doc(collection(db, "transactions")); 
              const actualPayout = (entry.amount || 0) * payoutRatio;

              currentBatch.update(entryRef, { status: 'won', potential_payout: actualPayout });
              currentBatch.update(userRef, { winnings_balance: increment(actualPayout) });
              currentBatch.set(txRef, { userId: entry.userId, type: 'winnings', amount: actualPayout, description: `Won: ${selectedPred.question.substring(0, 15)}...`, created_at: serverTimestamp() });
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

          setStatusMsg(`Resolved! Paid out ${winners.length} winners from a pool of $${totalPool.toFixed(2)}.`);
          setSelectedPred(null);
      } catch (err: any) {
          setStatusMsg(`Resolution Failed: ${err.message}`);
      } finally {
          setLoading(false);
          setConfirmStep(0);
      }
  };

  const onResolveClick = () => {
      if (confirmStep === 0) {
          setConfirmStep(1);
          setTimeout(() => setConfirmStep(0), 4000);
      } else {
          handleResolve();
      }
  };

  // --- RENDER DETAIL VIEW ---
  const renderDetailView = () => {
      if (!selectedPred) return null;

      if (detailsLoading) {
          return (
              <div className="fixed inset-0 z-[100] bg-zii-bg/95 backdrop-blur flex flex-col items-center justify-center animate-in fade-in">
                  <Loader size={50} className="text-zii-accent" />
                  <p className="text-white/50 text-xs font-bold uppercase mt-6 animate-pulse">Syncing Engine Data...</p>
              </div>
          );
      }

      const totalVolume = predEntries.reduce((acc, curr) => acc + (curr.amount || 0), 0);
      const commission = totalVolume * 0.05;
      const distributable = totalVolume - commission;
      const winnersHypothetical = winningOption ? predEntries.filter(e => e.selected_option_id === winningOption) : [];
      const winningVol = winnersHypothetical.reduce((acc, curr) => acc + (curr.amount || 0), 0);
      const hypotheticalRatio = winningVol > 0 ? (distributable / winningVol) : 0;

      return (
          <div className="fixed inset-0 z-[100] bg-zii-bg flex flex-col animate-in slide-in-from-right duration-300">
              <div className="bg-zii-bg/95 backdrop-blur border-b border-white/5 p-4 flex items-center justify-between shrink-0 shadow-md">
                  <button onClick={() => setSelectedPred(null)} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors bg-white/5 rounded-full px-3 py-1.5">
                      <ArrowLeft size={16} /> <span className="text-xs font-bold">Back</span>
                  </button>
                  <div className="text-right">
                      <p className={`text-[10px] uppercase font-bold tracking-widest ${selectedPred.status === 'open' ? 'text-zii-accent' : 'text-white/30'}`}>{selectedPred.status}</p>
                      <p className="text-[10px] font-mono text-white/30">{selectedPred.id.substring(0, 8)}...</p>
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
                  <div>
                      <h1 className="text-2xl font-black text-white mb-2 leading-tight tracking-tight">{selectedPred.question}</h1>
                      <div className="flex gap-4 text-sm text-white/50 font-medium">
                          <span className="flex items-center gap-1.5"><Users size={14} className="text-white/30" /> {predEntries.length} Entries</span>
                          {selectedPred.resolution_source && (
                             <span className="flex items-center gap-1.5"><FileText size={14} className="text-white/30" /> {selectedPred.resolution_source}</span>
                          )}
                      </div>
                  </div>

                  <div className="bg-zii-card border border-white/5 p-4 rounded-2xl">
                      <h3 className="text-xs font-bold text-white/60 mb-3 flex items-center gap-2">
                          <Coins size={14} className="text-zii-accent" /> Pool Economics
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                          <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                              <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest mb-1">Total Bets</p>
                              <p className="text-sm font-mono font-bold text-white">${totalVolume.toFixed(2)}</p>
                          </div>
                          <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                              <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest mb-1">House (5%)</p>
                              <p className="text-sm font-mono font-bold text-green-400">+${commission.toFixed(2)}</p>
                          </div>
                          <div className="bg-black/20 p-3 rounded-xl border border-white/5 relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-8 h-8 bg-zii-accent/10 rounded-bl-xl"></div>
                              <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest mb-1">Prize Pool</p>
                              <p className="text-sm font-mono font-bold text-zii-accent">${distributable.toFixed(2)}</p>
                          </div>
                      </div>
                  </div>

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
                                  <button onClick={onResolveClick} disabled={loading} className={`w-full py-4 font-bold rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 ${confirmStep === 1 ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/20' : 'bg-white text-black hover:bg-white/90 shadow-white/5'}`}>
                                      {loading ? <Loader className={confirmStep === 1 ? "text-white" : "text-black"} /> : confirmStep === 1 ? <span className="animate-pulse">CONFIRM PAYOUT?</span> : "CONFIRM RESOLUTION"}
                                  </button>
                              </div>
                          )}
                      </div>
                  )}
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
             <span className="text-2xl font-black font-mono tracking-tight text-white">
                 ${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
             </span>
          </div>
          {timeFrame && <p className="text-[10px] text-white/20 mt-1 font-medium">{timeFrame}</p>}
      </div>
  );

  if (!isAdmin) return null;

  // Aggregate Partner Stats
  const totalAffiliateVolume = affiliates.reduce((sum, a) => sum + (a.total_volume || 0), 0);
  const totalAffiliateUsers = affiliates.reduce((sum, a) => sum + (a.active_users_count || 0), 0);
  const totalCommissionPending = affiliates.reduce((sum, a) => sum + (a.commission_owed || 0), 0);

  return (
    <div className="min-h-screen bg-zii-bg text-white pb-24">
      {selectedPred && renderDetailView()}

      {(activeTab === 'deploy' || activeTab === 'mint' || activeTab === 'analytics' || activeTab === 'partners' || activeTab === 'settings') && (
        <div className="p-4 animate-in fade-in max-w-md mx-auto">
            <div className="flex justify-between items-center mb-8 pt-2">
                <div>
                    <h1 className="text-xl font-black flex items-center gap-2 text-white tracking-tighter"><span className="text-red-500">ENGINE</span> PANEL</h1>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Admin Control Terminal</p>
                </div>
                <button onClick={() => logout().then(() => navigate('/login'))} className="bg-white/5 hover:bg-white/10 p-2.5 rounded-full text-white/50 border border-white/5 transition-colors"><LogOut size={18} /></button>
            </div>
            
            {activeTab === 'settings' ? (
                <div className="space-y-6 animate-in slide-in-from-right duration-300">
                    <div className="bg-gradient-to-r from-zii-card to-white/5 p-6 rounded-[2rem] border border-white/10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-zii-accent/5 blur-[50px] rounded-full pointer-events-none"></div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2"><Settings size={20} className="text-zii-accent" /> Platform Settings</h2>
                        <p className="text-xs text-white/40 mt-1">Global configuration for the Zii platform.</p>
                    </div>

                    {/* Status Message */}
                    {statusMsg && (
                        <div className={`p-4 rounded-2xl flex items-start gap-3 text-xs font-bold animate-pulse border ${statusMsg.includes('Failed') ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-zii-accent/10 border-zii-accent/20 text-zii-accent'}`}>
                            {statusMsg.includes('Failed') ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle size={16} className="mt-0.5 shrink-0" />} 
                            <span className="leading-relaxed">{statusMsg}</span>
                        </div>
                    )}

                    {/* General */}
                    <div className="bg-zii-card border border-white/5 rounded-3xl p-5 space-y-4">
                        <h3 className="text-[10px] text-white/30 uppercase font-bold tracking-widest pl-1">General Status</h3>
                        
                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${settingsForm.maintenance_mode ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                                    <Lock size={16} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">Maintenance Mode</p>
                                    <p className="text-[10px] text-white/40">{settingsForm.maintenance_mode ? 'App is Locked' : 'App is Active'}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSettingsForm({...settingsForm, maintenance_mode: !settingsForm.maintenance_mode})}
                                className={`w-12 h-6 rounded-full p-1 transition-colors ${settingsForm.maintenance_mode ? 'bg-red-500' : 'bg-white/10'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${settingsForm.maintenance_mode ? 'translate-x-6' : 'translate-x-0'}`}></div>
                            </button>
                        </div>
                    </div>

                    {/* Economy */}
                    <div className="bg-zii-card border border-white/5 rounded-3xl p-5 space-y-4">
                        <h3 className="text-[10px] text-white/30 uppercase font-bold tracking-widest pl-1">Economy Config</h3>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-white/40 font-bold uppercase pl-1">Welcome Bonus</label>
                                <div className="relative">
                                    <Coins size={14} className="absolute left-3 top-3 text-white/30" />
                                    <input 
                                        type="number" 
                                        value={settingsForm.welcome_bonus} 
                                        onChange={(e) => setSettingsForm({...settingsForm, welcome_bonus: Number(e.target.value)})}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-2 pl-9 pr-2 text-sm text-white font-mono focus:outline-none focus:border-zii-accent/50" 
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-white/40 font-bold uppercase pl-1">Referral Bonus</label>
                                <div className="relative">
                                    <Coins size={14} className="absolute left-3 top-3 text-white/30" />
                                    <input 
                                        type="number" 
                                        value={settingsForm.referral_bonus} 
                                        onChange={(e) => setSettingsForm({...settingsForm, referral_bonus: Number(e.target.value)})}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-2 pl-9 pr-2 text-sm text-white font-mono focus:outline-none focus:border-zii-accent/50" 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] text-white/40 font-bold uppercase pl-1">Min Cashout ($)</label>
                            <input 
                                type="number" 
                                value={settingsForm.min_cashout} 
                                onChange={(e) => setSettingsForm({...settingsForm, min_cashout: Number(e.target.value)})}
                                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white font-mono focus:outline-none focus:border-zii-accent/50" 
                            />
                        </div>
                    </div>

                    {/* Announcements */}
                    <div className="bg-zii-card border border-white/5 rounded-3xl p-5 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-[10px] text-white/30 uppercase font-bold tracking-widest pl-1">Global Banner</h3>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-white/40 uppercase">{settingsForm.banner_active ? 'ON' : 'OFF'}</span>
                                <button 
                                    onClick={() => setSettingsForm({...settingsForm, banner_active: !settingsForm.banner_active})}
                                    className={`w-8 h-4 rounded-full p-0.5 transition-colors ${settingsForm.banner_active ? 'bg-zii-accent' : 'bg-white/10'}`}
                                >
                                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${settingsForm.banner_active ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                </button>
                            </div>
                        </div>
                        
                        <div className="relative">
                            <Megaphone size={16} className="absolute left-3 top-3 text-white/30" />
                            <textarea 
                                rows={2}
                                value={settingsForm.banner_message} 
                                onChange={(e) => setSettingsForm({...settingsForm, banner_message: e.target.value})}
                                placeholder="Enter announcement text..."
                                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-3 text-sm text-white focus:outline-none focus:border-zii-accent/50 resize-none" 
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handleSaveSettings} 
                        disabled={loading}
                        className="w-full bg-zii-accent text-black font-bold py-4 rounded-xl shadow-lg shadow-zii-accent/20 hover:bg-white transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader className="text-black" /> : <><Save size={20} /> Save Changes</>}
                    </button>
                </div>
            ) : activeTab === 'analytics' ? (
                <div className="space-y-6 animate-in slide-in-from-right duration-300">
                     
                     {/* Analytics Sub-Tabs */}
                     <div className="flex p-1 bg-white/5 rounded-xl mb-6 border border-white/5">
                        <button
                          onClick={() => setAnalyticsSubTab('financials')}
                          className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                            analyticsSubTab === 'financials'
                              ? 'bg-zii-card text-white shadow-sm border border-white/5'
                              : 'text-white/40 hover:text-white/60'
                          }`}
                        >
                          Financials
                        </button>
                        <button
                          onClick={() => setAnalyticsSubTab('activity')}
                          className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                            analyticsSubTab === 'activity'
                              ? 'bg-zii-card text-white shadow-sm border border-white/5'
                              : 'text-white/40 hover:text-white/60'
                          }`}
                        >
                          Activity
                        </button>
                        <button
                          onClick={() => setAnalyticsSubTab('growth')}
                          className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                            analyticsSubTab === 'growth'
                              ? 'bg-zii-card text-white shadow-sm border border-white/5'
                              : 'text-white/40 hover:text-white/60'
                          }`}
                        >
                          Growth
                        </button>
                    </div>

                     {analyticsData ? (
                         <>
                            {analyticsSubTab === 'financials' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="bg-gradient-to-br from-zii-card to-white/5 p-6 rounded-[2rem] border border-white/10 relative overflow-hidden shadow-2xl">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-zii-accent/10 blur-[50px] rounded-full pointer-events-none"></div>
                                        <h2 className="text-sm font-bold text-white/60 mb-1 flex items-center gap-2"><DollarSign size={16} className="text-zii-accent" /> Total Revenue</h2>
                                        <div className="text-5xl font-black text-white tracking-tighter mb-2">
                                            ${analyticsData.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                        <p className="text-xs text-white/30 font-medium">Net Commission Earned</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-black/20 p-4 rounded-3xl border border-white/5">
                                            <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest mb-1 flex items-center gap-1"><Ticket size={12} className="text-green-400" /> Entry Fees (5%)</p>
                                            <p className="text-lg font-bold font-mono text-white">${analyticsData.entryFees.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div className="bg-black/20 p-4 rounded-3xl border border-white/5">
                                            <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest mb-1 flex items-center gap-1"><Wallet size={12} className="text-yellow-400" /> Cashout Fees (10%)</p>
                                            <p className="text-lg font-bold font-mono text-white">${analyticsData.cashoutFees.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <MetricCard label="Today" amount={analyticsData.revenueToday} icon={TrendingUp} timeFrame="Since 00:00" />
                                        <MetricCard label="This Week" amount={analyticsData.revenueWeek} icon={Calendar} timeFrame="Current Week" />
                                    </div>
                                </div>
                            )}

                            {analyticsSubTab === 'activity' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                     <div className="bg-zii-card p-6 rounded-[2rem] border border-white/10 relative overflow-hidden">
                                        <h2 className="text-sm font-bold text-white/60 mb-1 flex items-center gap-2"><Activity size={16} className="text-zii-accent" /> Total Volume Processed</h2>
                                        <div className="text-4xl font-black text-white tracking-tighter mb-2">
                                            ${analyticsData.totalVolume.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </div>
                                        <p className="text-xs text-white/30 font-medium">{analyticsData.txCount} Total Transactions</p>
                                     </div>

                                     <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-black/20 p-4 rounded-3xl border border-white/5">
                                            <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest mb-1 flex items-center gap-1"><ArrowUpRight size={12} className="text-zii-accent" /> Bets Placed</p>
                                            <p className="text-lg font-bold font-mono text-white">${analyticsData.entryVolume.toLocaleString(undefined, { minimumFractionDigits: 0 })}</p>
                                        </div>
                                        <div className="bg-black/20 p-4 rounded-3xl border border-white/5">
                                            <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest mb-1 flex items-center gap-1"><ArrowDownLeft size={12} className="text-red-400" /> Cashouts</p>
                                            <p className="text-lg font-bold font-mono text-white">${analyticsData.cashoutVolume.toLocaleString(undefined, { minimumFractionDigits: 0 })}</p>
                                        </div>
                                    </div>

                                    <h3 className="text-[10px] text-white/30 uppercase font-bold tracking-widest mt-4 mb-2 pl-2">Volume Trends</h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                                            <p className="text-[9px] text-white/40 uppercase font-bold mb-1">Today</p>
                                            <p className="text-sm font-bold text-white">${analyticsData.volumeToday.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                                            <p className="text-[9px] text-white/40 uppercase font-bold mb-1">Week</p>
                                            <p className="text-sm font-bold text-white">${analyticsData.volumeWeek.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                                            <p className="text-[9px] text-white/40 uppercase font-bold mb-1">Month</p>
                                            <p className="text-sm font-bold text-white">${analyticsData.volumeMonth.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {analyticsSubTab === 'growth' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-zii-card p-5 rounded-3xl border border-white/5 shadow-sm">
                                            <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mb-1 flex items-center gap-1"><Users size={12} className="text-zii-accent" /> Total Users</p>
                                            <p className="text-3xl font-black text-white tracking-tighter">{stats.users.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-zii-card p-5 rounded-3xl border border-white/5 shadow-sm relative overflow-hidden">
                                            <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mb-1 flex items-center gap-1"><Zap size={12} className="text-zii-accent" /> Total Events</p>
                                            <p className="text-3xl font-black text-white tracking-tighter">{stats.predictions.toLocaleString()}</p>
                                        </div>
                                    </div>

                                    <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 mt-4">
                                        <h3 className="text-sm font-bold text-white/60 mb-4 flex items-center gap-2"><Gauge size={16} className="text-zii-accent" /> System Health</h3>
                                        
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-white/50">Avg Monthly Revenue</span>
                                                <span className="text-sm font-mono font-bold text-green-400">+${analyticsData.avgMonthlyRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                            <div className="w-full h-px bg-white/5"></div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-white/50">Avg Transaction Size</span>
                                                <span className="text-sm font-mono font-bold text-white">${(analyticsData.totalVolume / analyticsData.txCount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                            <div className="w-full h-px bg-white/5"></div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-white/50">Platform Version</span>
                                                <span className="text-xs font-mono text-white/30">v1.1.0-alpha</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                         </>
                     ) : (
                         <div className="py-20 flex justify-center">
                             <Loader className="text-zii-accent" />
                         </div>
                     )}
                </div>
            ) : activeTab === 'creators' ? (
                <div className="space-y-6 animate-in slide-in-from-right duration-300">
                    <div className="bg-gradient-to-r from-zii-card to-white/5 p-6 rounded-[2rem] border border-white/10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-zii-accent/5 blur-[50px] rounded-full pointer-events-none"></div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2"><Star size={20} className="text-zii-accent" /> Creator Invites</h2>
                        <p className="text-xs text-white/40 mt-1">Generate invite links for content creators.</p>
                    </div>

                    {statusMsg && (
                        <div className={`p-4 rounded-2xl flex items-start gap-3 text-xs font-bold animate-pulse border ${statusMsg.includes('Failed') ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-zii-accent/10 border-zii-accent/20 text-zii-accent'}`}>
                            {statusMsg.includes('Failed') ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle size={16} className="mt-0.5 shrink-0" />} 
                            <span className="leading-relaxed">{statusMsg}</span>
                        </div>
                    )}

                    <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><UserPlus size={20} className="text-zii-accent" /> Create Invite Link</h2>
                        
                        <form onSubmit={handleCreateCreatorInvite} className="space-y-3">
                            <div>
                                <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest pl-1">Creator Name</label>
                                <input required value={newCreatorName} onChange={e => setNewCreatorName(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-zii-accent/50" placeholder="e.g. DJ Maphorisa" />
                            </div>
                            <div>
                                <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest pl-1">Target Country</label>
                                <select value={newCreatorCountry} onChange={e => setNewCreatorCountry(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-zii-accent/50 appearance-none">
                                    {SUPPORTED_COUNTRIES.map(c => (
                                        <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                                    ))}
                                </select>
                            </div>
                            <button disabled={loading} className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-zii-accent transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                {loading ? <Loader className="text-black" /> : <><LinkIcon size={16} /> Generate Invite</>}
                            </button>
                        </form>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-[10px] text-white/30 uppercase font-bold tracking-widest pl-2">Active Invites</h3>
                        {creatorInvites.filter(i => i.status === 'active').length === 0 ? (
                            <div className="text-center py-10 text-white/30 text-sm bg-white/5 rounded-2xl border border-white/5 border-dashed">No active invites</div>
                        ) : (
                            creatorInvites.filter(i => i.status === 'active').map(invite => (
                                <div key={invite.id} className="bg-zii-card border border-white/5 rounded-2xl p-4 flex justify-between items-center">
                                    <div>
                                        <h3 className="font-bold text-white text-sm">{invite.name}</h3>
                                        <p className="text-xs text-white/50">{invite.country}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => copyCreatorInviteLink(invite.code)} className="text-xs bg-zii-accent/10 hover:bg-zii-accent/20 text-zii-accent px-3 py-1.5 rounded-lg border border-zii-accent/20 transition-colors flex items-center gap-2">
                                            <Copy size={12} /> Copy
                                        </button>
                                        <button onClick={() => revokeCreatorInvite(invite.id)} className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20 transition-colors">
                                            Revoke
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : activeTab === 'partners' ? (
                <div className="space-y-6 animate-in slide-in-from-right duration-300">
                    
                    {/* Partner Sub-Tabs */}
                    <div className="flex p-1 bg-white/5 rounded-xl mb-6 border border-white/5">
                        <button
                          onClick={() => setPartnerSubTab('overview')}
                          className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1 ${
                            partnerSubTab === 'overview'
                              ? 'bg-zii-card text-white shadow-sm border border-white/5'
                              : 'text-white/40 hover:text-white/60'
                          }`}
                        >
                          <Activity size={12} /> Overview
                        </button>
                        <button
                          onClick={() => setPartnerSubTab('onboard')}
                          className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1 ${
                            partnerSubTab === 'onboard'
                              ? 'bg-zii-card text-white shadow-sm border border-white/5'
                              : 'text-white/40 hover:text-white/60'
                          }`}
                        >
                          <UserPlus size={12} /> Onboard
                        </button>
                        <button
                          onClick={() => setPartnerSubTab('payouts')}
                          className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1 ${
                            partnerSubTab === 'payouts'
                              ? 'bg-zii-card text-white shadow-sm border border-white/5'
                              : 'text-white/40 hover:text-white/60'
                          }`}
                        >
                          <CreditCard size={12} /> Payouts
                        </button>
                    </div>

                    {partnerSubTab === 'overview' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
                            {/* Aggregates */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-zii-card p-5 rounded-3xl border border-white/5 shadow-sm">
                                    <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mb-1 flex items-center gap-1"><Users size={12} className="text-zii-accent" /> Total Referred</p>
                                    <p className="text-3xl font-black text-white tracking-tighter">{totalAffiliateUsers.toLocaleString()}</p>
                                </div>
                                <div className="bg-zii-card p-5 rounded-3xl border border-white/5 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-zii-accent/10 rounded-full blur-xl"></div>
                                    <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mb-1 flex items-center gap-1"><Activity size={12} className="text-zii-accent" /> Partner Volume</p>
                                    <p className="text-3xl font-black text-zii-accent tracking-tighter">${totalAffiliateVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                </div>
                            </div>

                            {/* Simplified List */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] text-white/30 uppercase font-bold tracking-widest pl-2">Active Partners</h3>
                                {affiliates.length === 0 ? (
                                    <div className="text-center py-10 text-white/30 text-sm bg-white/5 rounded-2xl border border-white/5 border-dashed">No partners found.</div>
                                ) : (
                                    affiliates.map(aff => (
                                        <div key={aff.id} className="bg-zii-card border border-white/5 rounded-2xl p-4 flex justify-between items-center">
                                            <div>
                                                <h3 className="font-bold text-white text-sm">{aff.name}</h3>
                                                <p className="text-xs text-white/50 font-mono tracking-wider">{aff.code}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-white">${(aff.total_volume || 0).toLocaleString()}</p>
                                                <p className="text-[10px] text-white/30 uppercase font-bold">Vol</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {partnerSubTab === 'onboard' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
                            <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Handshake size={20} className="text-zii-accent" /> Add Affiliate Partner</h2>
                                
                                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl mb-6 flex gap-3">
                                   <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />
                                   <p className="text-xs text-blue-200/80 leading-relaxed">
                                       <strong>Universal Link Attribution:</strong> Generate a partner below. Copy their link and send it to them. When a user clicks it, all bets for the <strong>next 7 days</strong> are attributed to them.
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

                            {/* Quick Link Access */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] text-white/30 uppercase font-bold tracking-widest pl-2">Attribution Links</h3>
                                {affiliates.map(aff => (
                                    <div key={aff.id} className="bg-white/5 border border-white/5 rounded-xl p-3 flex justify-between items-center">
                                        <span className="text-sm font-bold text-white/70">{aff.name}</span>
                                        <button onClick={() => copyPartnerLink(aff.code)} className="text-xs bg-black/30 hover:bg-black/50 text-white px-3 py-1.5 rounded-lg border border-white/10 transition-colors flex items-center gap-2">
                                            <LinkIcon size={12} /> Copy Link
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {partnerSubTab === 'payouts' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
                             <div className="bg-gradient-to-br from-[#1E293B] to-white/5 p-6 rounded-[2rem] border border-white/10 relative overflow-hidden shadow-2xl">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-[50px] rounded-full pointer-events-none"></div>
                                <h2 className="text-sm font-bold text-white/60 mb-1 flex items-center gap-2"><CreditCard size={16} className="text-red-400" /> Total Outstanding Liability</h2>
                                <div className="text-5xl font-black text-white tracking-tighter mb-2">
                                    ${totalCommissionPending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <p className="text-xs text-white/30 font-medium">Accumulated Commission Owed (10% of House Fee)</p>
                             </div>

                             <div className="space-y-3">
                                <h3 className="text-[10px] text-white/30 uppercase font-bold tracking-widest pl-2">Liability Breakdown</h3>
                                {affiliates.length === 0 ? (
                                    <div className="text-center py-10 text-white/30 text-sm">No active liabilities.</div>
                                ) : (
                                    // Sort by owed amount descending
                                    [...affiliates].sort((a,b) => (b.commission_owed || 0) - (a.commission_owed || 0)).map(aff => {
                                        const houseRevenue = (aff.total_volume || 0) * 0.05;
                                        return (
                                            <div key={aff.id} className="bg-zii-card border border-white/5 rounded-2xl p-4">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <h3 className="font-bold text-white">{aff.name}</h3>
                                                        <p className="text-xs text-white/50 font-mono tracking-wider">House Rev: <span className="text-green-400">+${houseRevenue.toFixed(2)}</span></p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs text-white/40 uppercase font-bold mb-0.5">Owed</p>
                                                        <p className="text-xl font-bold font-mono text-red-400">${(aff.commission_owed || 0).toFixed(2)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <>
                {/* Standard Deploy/Mint Header Stats */}
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
                        <>
                        {/* Deploy Sub-Tabs */}
                        <div className="flex p-1 bg-white/5 rounded-xl mb-6 border border-white/5">
                            <button
                              onClick={() => setDeploySubTab('event')}
                              className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1 ${
                                deploySubTab === 'event'
                                  ? 'bg-zii-card text-white shadow-sm border border-white/5'
                                  : 'text-white/40 hover:text-white/60'
                              }`}
                            >
                              <Zap size={12} /> New Event
                            </button>
                            <button
                              onClick={() => setDeploySubTab('vouchers')}
                              className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1 ${
                                deploySubTab === 'vouchers'
                                  ? 'bg-zii-card text-white shadow-sm border border-white/5'
                                  : 'text-white/40 hover:text-white/60'
                              }`}
                            >
                              <Ticket size={12} /> Vouchers
                            </button>
                            <button
                              onClick={() => setDeploySubTab('templates')}
                              className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1 ${
                                deploySubTab === 'templates'
                                  ? 'bg-zii-card text-white shadow-sm border border-white/5'
                                  : 'text-white/40 hover:text-white/60'
                              }`}
                            >
                              <LayoutTemplate size={12} /> Templates
                            </button>
                        </div>

                        {deploySubTab === 'event' && (
                            <form onSubmit={handleDeploy} className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
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
                                        <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest pl-1">Closing Time</label>
                                        <input 
                                            type="datetime-local" 
                                            value={closingTime} 
                                            onChange={e => setClosingTime(e.target.value)} 
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-zii-accent/50 font-medium [color-scheme:dark]" 
                                        />
                                    </div>
                                </div>
                                
                                <div className="space-y-1">
                                    <label className="text-[10px] text-white/40 uppercase font-bold tracking-widest pl-1">Resolution Source (Optional)</label>
                                    <input type="text" value={resolutionSource} onChange={e => setResolutionSource(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-zii-accent/50 transition-all text-sm font-medium" placeholder="e.g. Official Twitter Account" />
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

                        {deploySubTab === 'vouchers' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
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

                        {deploySubTab === 'templates' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex gap-3 mb-2">
                                   <Lightbulb size={18} className="text-blue-400 shrink-0 mt-0.5" />
                                   <p className="text-xs text-blue-200/80 leading-relaxed">
                                       <strong>Quick Deploy:</strong> Tap a template below to auto-fill the Event form with standard configuration.
                                   </p>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    <button 
                                        onClick={() => applyTemplate('zesa')}
                                        className="bg-zii-card hover:bg-white/5 border border-white/5 rounded-2xl p-4 text-left transition-all active:scale-[0.98] group"
                                    >
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="font-bold text-white group-hover:text-zii-accent transition-colors">ZESA Load Shedding</h3>
                                            <div className="bg-white/10 p-1.5 rounded-lg"><Zap size={14} className="text-white/60" /></div>
                                        </div>
                                        <p className="text-xs text-white/40 leading-snug">Standard Yes/No. 6 hour duration.</p>
                                    </button>

                                    <button 
                                        onClick={() => applyTemplate('soccer')}
                                        className="bg-zii-card hover:bg-white/5 border border-white/5 rounded-2xl p-4 text-left transition-all active:scale-[0.98] group"
                                    >
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="font-bold text-white group-hover:text-zii-accent transition-colors">Soccer Match (EPL)</h3>
                                            <div className="bg-white/10 p-1.5 rounded-lg"><Trophy size={14} className="text-white/60" /></div>
                                        </div>
                                        <p className="text-xs text-white/40 leading-snug">Multiple Choice (Home/Away/Draw). 48hr duration.</p>
                                    </button>

                                    <button 
                                        onClick={() => applyTemplate('rate')}
                                        className="bg-zii-card hover:bg-white/5 border border-white/5 rounded-2xl p-4 text-left transition-all active:scale-[0.98] group"
                                    >
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="font-bold text-white group-hover:text-zii-accent transition-colors">Exchange Rate Breach</h3>
                                            <div className="bg-white/10 p-1.5 rounded-lg"><TrendingUp size={14} className="text-white/60" /></div>
                                        </div>
                                        <p className="text-xs text-white/40 leading-snug">Currency movement prediction. 5 Day duration.</p>
                                    </button>
                                </div>
                            </div>
                        )}
                        </>
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
                
                 {/* Sub Tabs */}
                 <div className="flex p-1 bg-white/5 rounded-xl mb-4 border border-white/5">
                    <button
                      onClick={() => setManageSubTab('open')}
                      className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                        manageSubTab === 'open'
                          ? 'bg-zii-card text-white shadow-sm'
                          : 'text-white/40 hover:text-white/60'
                      }`}
                    >
                      Live
                    </button>
                    <button
                      onClick={() => setManageSubTab('closed')}
                      className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                        manageSubTab === 'closed'
                          ? 'bg-zii-card text-white shadow-sm'
                          : 'text-white/40 hover:text-white/60'
                      }`}
                    >
                      Closed
                    </button>
                    <button
                      onClick={() => setManageSubTab('resolved')}
                      className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                        manageSubTab === 'resolved'
                          ? 'bg-zii-card text-white shadow-sm'
                          : 'text-white/40 hover:text-white/60'
                      }`}
                    >
                      Resolved
                    </button>
                </div>

            </div>
            <Feed adminMode={true} onPredictionClick={handlePredictionClick} adminStatusFilter={manageSubTab} />
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-zii-bg/95 backdrop-blur-xl border-t border-white/5 pb-safe">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
          <button onClick={() => setActiveTab('deploy')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === 'deploy' ? 'text-red-500' : 'text-white/40 hover:text-white/60'}`}><Zap size={20} strokeWidth={2.5} /><span className="text-[10px] font-medium tracking-wide uppercase">Deploy</span></button>
          <button onClick={() => setActiveTab('feed')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === 'feed' ? 'text-zii-accent' : 'text-white/40 hover:text-white/60'}`}><Home size={20} strokeWidth={2.5} /><span className="text-[10px] font-medium tracking-wide uppercase">Manage</span></button>
          <button onClick={() => setActiveTab('analytics')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === 'analytics' ? 'text-zii-accent' : 'text-white/40 hover:text-white/60'}`}><BarChart3 size={20} strokeWidth={2.5} /><span className="text-[10px] font-medium tracking-wide uppercase">Analytics</span></button>
          <button onClick={() => setActiveTab('partners')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === 'partners' ? 'text-zii-accent' : 'text-white/40 hover:text-white/60'}`}><Handshake size={20} strokeWidth={2.5} /><span className="text-[10px] font-medium tracking-wide uppercase">Partners</span></button>
          <button onClick={() => setActiveTab('creators')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === 'creators' ? 'text-zii-accent' : 'text-white/40 hover:text-white/60'}`}><Star size={20} strokeWidth={2.5} /><span className="text-[10px] font-medium tracking-wide uppercase">Creators</span></button>
          <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === 'settings' ? 'text-zii-accent' : 'text-white/40 hover:text-white/60'}`}><Settings size={20} strokeWidth={2.5} /><span className="text-[10px] font-medium tracking-wide uppercase">Settings</span></button>
        </div>
      </div>
    </div>
  );
};