import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader } from '../components/Loader';
import { Zap, Activity, LogOut, CheckCircle, AlertTriangle, Layers, Home, Coins, ArrowLeft, Trophy, DollarSign, Users, Ticket, Copy, RefreshCw, Gauge, BarChart3, TrendingUp, TrendingDown, Calendar, Globe, Handshake, Link as LinkIcon, Info, Wallet, FileText, PieChart, ArrowUpRight, ArrowDownLeft, UserPlus, CreditCard, LayoutTemplate, Lightbulb, Dna, Settings, Save, Megaphone, Lock, Star } from 'lucide-react';
import { PredictionType, PredictionStatus, Prediction, UserEntry, Affiliate, PlatformSettings, CreatorInvite } from '../types';
import { useNavigate } from 'react-router-dom';
import { Feed } from './Feed';
import { calculateAMMOdds } from '../utils/amm';
import { SUPPORTED_COUNTRIES } from '../constants';
import { api } from '../utils/api';

export const AdminEngine: React.FC = () => {
  const { isAdmin, logout, currentUser, userProfile, platformSettings, loading: authLoading } = useAuth();
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
      totalRevenue: number; entryFees: number; cashoutFees: number; revenueToday: number; revenueWeek: number; revenueMonth: number; avgMonthlyRevenue: number;
      totalVolume: number; entryVolume: number; cashoutVolume: number; volumeToday: number; volumeWeek: number; volumeMonth: number; txCount: number;
  } | null>(null);

  // --- PARTNERS / AFFILIATE STATE ---
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerCode, setNewPartnerCode] = useState('');

  // --- CREATOR INVITES STATE ---
  const [creatorInvites, setCreatorInvites] = useState<any[]>([]);
  const [newCreatorName, setNewCreatorName] = useState('');
  const [newCreatorCountry, setNewCreatorCountry] = useState('ZW');

  // Helper to format date for datetime-local input
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
      min: '', max: '', teamA: '', teamB: '', payout: 15
  });
  const [stats, setStats] = useState({ users: 0, predictions: 0 });

  // 1. Redirect if not authorized locally
  useEffect(() => {
    if (authLoading) return;
    if (currentUser && !isAdmin) {
        navigate('/earn');
        return;
    }
    if (isAdmin) {
        fetchStats();
    }
  }, [isAdmin, navigate, authLoading, currentUser]);

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

  const fetchStats = async () => {
     try {
         const statsData = await api.getAdminStats() as { users: number; predictions: number };
         setStats(statsData);
     } catch (e) { console.warn(e); }
  };

  const fetchAffiliates = async () => {
      try {
          const data = await api.getAffiliates();
          setAffiliates(data);
      } catch (err) {
          console.error('Failed to fetch affiliates:', err);
      }
  };

  const fetchCreatorInvites = async () => {
      try {
          const data = await api.getCreatorInvites();
          setCreatorInvites(data);
      } catch (err) {
          console.error('Failed to fetch creator invites:', err);
      }
  };

  const fetchAnalytics = async () => {
      setLoading(true);
      try {
          const data = await api.getAnalytics() as any;
          if (data) {
              setAnalyticsData({
                  totalRevenue: data.totalRevenue || 0,
                  entryFees: data.entryFees || 0,
                  cashoutFees: data.cashoutFees || 0,
                  revenueToday: data.revenueToday || 0,
                  revenueWeek: data.revenueWeek || 0,
                  revenueMonth: data.revenueMonth || 0,
                  avgMonthlyRevenue: data.avgMonthlyRevenue || 0,
                  totalVolume: data.totalVolume || 0,
                  entryVolume: data.entryVolume || 0,
                  cashoutVolume: data.cashoutVolume || 0,
                  volumeToday: data.volumeToday || 0,
                  volumeWeek: data.volumeWeek || 0,
                  volumeMonth: data.volumeMonth || 0,
                  txCount: data.txCount || 1,
              });
          }
      } catch (err) {
          console.error("Analytics Error", err);
          setAnalyticsData({
              totalRevenue: 0, entryFees: 0, cashoutFees: 0, revenueToday: 0,
              revenueWeek: 0, revenueMonth: 0, avgMonthlyRevenue: 0,
              totalVolume: 0, entryVolume: 0, cashoutVolume: 0,
              volumeToday: 0, volumeWeek: 0, volumeMonth: 0, txCount: 1,
          });
      } finally {
          setLoading(false);
      }
  };

  const totalAffiliateVolume = affiliates.reduce((sum, a) => sum + (a.total_volume || 0), 0);
  const totalAffiliateUsers = affiliates.reduce((sum, a) => sum + (a.active_users_count || 0), 0);

  if (authLoading) return <Loader className="text-zii-accent" />;
  if (!isAdmin) return null;

  return (
      <div className="w-full min-h-screen bg-black text-white">
        <style>{`
          .zii-tab-active { @apply bg-zii-card text-white shadow-lg border border-zii-accent/20; }
          .zii-tab { @apply text-white/40 hover:text-white/60 transition-colors; }
        `}</style>

        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {(['deploy', 'mint', 'feed', 'analytics', 'partners', 'creators', 'settings'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg font-bold uppercase text-xs tracking-widest ${activeTab === tab ? 'bg-zii-accent text-black' : 'bg-white/5 text-white/50 hover:text-white/70'}`}>
                {tab}
              </button>
            ))}
            <button onClick={() => { logout(); navigate('/'); }} className="ml-auto px-4 py-2 rounded-lg font-bold text-xs tracking-widest bg-red-500/20 text-red-300 hover:bg-red-500/30">
              <LogOut size={14} className="inline mr-2" /> Logout
            </button>
          </div>

          {/* Content Area */}
          {activeTab === 'analytics' && (
              <div className="space-y-6">
                  <div className="flex gap-2">
                      {(['financials', 'activity', 'growth'] as const).map(sub => (
                          <button key={sub} onClick={() => setAnalyticsSubTab(sub)} className={`px-3 py-2 text-xs rounded-lg font-bold ${analyticsSubTab === sub ? 'bg-zii-accent text-black' : 'bg-white/5 text-white/40'}`}>
                              {sub}
                          </button>
                      ))}
                  </div>

                  {analyticsData ? (
                      <div className="space-y-4">
                          {analyticsSubTab === 'financials' && (
                              <div className="space-y-3">
                                  <div className="bg-zii-card p-6 rounded-xl border border-white/10">
                                      <p className="text-white/60 text-sm mb-2">Total Revenue</p>
                                      <p className="text-4xl font-black text-white">${(analyticsData?.totalRevenue ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                                  </div>
                              </div>
                          )}
                          {analyticsSubTab === 'activity' && <div className="text-white/50">Activity data loading...</div>}
                          {analyticsSubTab === 'growth' && <div className="text-white/50">Growth data loading...</div>}
                      </div>
                  ) : (
                      <div className="py-20 flex justify-center">
                          <Loader className="text-zii-accent" />
                      </div>
                  )}
              </div>
          )}

          {activeTab === 'feed' && <Feed />}
          {activeTab === 'deploy' && <div className="text-white/50 py-10 text-center">Deploy panel coming soon</div>}
          {activeTab === 'mint' && <div className="text-white/50 py-10 text-center">Mint panel coming soon</div>}
          {activeTab === 'partners' && <div className="text-white/50 py-10 text-center">Partners panel coming soon</div>}
          {activeTab === 'creators' && <div className="text-white/50 py-10 text-center">Creators panel coming soon</div>}
          {activeTab === 'settings' && <div className="text-white/50 py-10 text-center">Settings panel coming soon</div>}

          {statusMsg && (
              <div className="fixed bottom-4 right-4 bg-zii-accent text-black px-4 py-2 rounded-lg font-bold text-sm">
                  {statusMsg}
              </div>
          )}
        </div>
      </div>
  );
};
