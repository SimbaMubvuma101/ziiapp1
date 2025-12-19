import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader } from '../components/Loader';
import {
  Zap, Home, BarChart3, Handshake, Star, Settings, Users,
  Coins, CheckCircle, AlertTriangle
} from 'lucide-react';
import { PredictionType, PredictionStatus } from '../types';
import { useNavigate } from 'react-router-dom';
import { Feed } from './Feed';
import { calculateAMMOdds } from '../utils/amm';
import { SUPPORTED_COUNTRIES } from '../constants';
import { api } from '../utils/api';

interface AdminEngineProps {
  bypassAuth?: boolean;
}

export const AdminEngine: React.FC<AdminEngineProps> = ({ bypassAuth = false }) => {
  const { isAdmin, logout, currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  /* -------------------- NAV STATE -------------------- */
  const [activeTab, setActiveTab] = useState<
    'deploy' | 'feed' | 'analytics' | 'partners' | 'creators' | 'settings' | 'users'
  >('deploy');

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  /* -------------------- DEPLOY STATE -------------------- */
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState('Trends & Viral');
  const [targetCountry, setTargetCountry] = useState('ZW');
  const [deployType, setDeployType] = useState<PredictionType>(PredictionType.YES_NO);

  const [options, setOptions] = useState([
    { label: 'Yes', payout: 15 },
    { label: 'No', payout: 15 }
  ]);

  /* -------------------- TOKEN INJECTION STATE -------------------- */
  const [injectUser, setInjectUser] = useState('');
  const [injectAmount, setInjectAmount] = useState('');
  const [injectReason, setInjectReason] = useState('');
  const [injectNote, setInjectNote] = useState('');

  /* -------------------- GUARDS -------------------- */
  useEffect(() => {
    if (!bypassAuth && (authLoading || !currentUser)) return;
    if (!bypassAuth && currentUser && !isAdmin) navigate('/earn');
  }, [authLoading, currentUser, isAdmin, bypassAuth, navigate]);

  if (!bypassAuth && (authLoading || !currentUser)) {
    return (
      <div className="min-h-screen bg-zii-bg flex items-center justify-center">
        <Loader size={50} />
      </div>
    );
  }

  if (!bypassAuth && !isAdmin) return null;

  /* -------------------- HANDLERS -------------------- */
  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg('');

    try {
      const payload: any = {
        question,
        category,
        country: targetCountry,
        type: deployType,
        status: PredictionStatus.OPEN
      };

      const rawOptions = options.map((o, i) => ({
        id: `opt_${Date.now()}_${i}`,
        label: o.label,
        price: 0
      }));

      const liquidity: Record<string, number> = {};
      rawOptions.forEach(o => (liquidity[o.id] = 500));

      const { updatedOptions } = calculateAMMOdds(rawOptions, liquidity);
      payload.options = updatedOptions;
      payload.liquidity_pool = liquidity;

      await api.createPrediction(payload);

      setStatusMsg('Prediction deployed successfully');
      setQuestion('');
    } catch (e: any) {
      setStatusMsg(`Deployment failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInjectTokens = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg('');

    try {
      await api.injectTokens({
        user_identifier: injectUser,
        amount: Number(injectAmount),
        reason: injectReason,
        note: injectNote
      });

      setStatusMsg('Tokens injected successfully');
      setInjectUser('');
      setInjectAmount('');
      setInjectReason('');
      setInjectNote('');
    } catch (e: any) {
      setStatusMsg(`Injection failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="min-h-screen bg-zii-bg text-white pb-24 px-4">

      {/* STATUS */}
      {statusMsg && (
        <div className={`mb-4 p-4 rounded-xl flex gap-3 text-xs font-bold ${
          statusMsg.includes('failed')
            ? 'bg-red-500/10 text-red-400'
            : 'bg-green-500/10 text-green-400'
        }`}>
          {statusMsg.includes('failed') ? <AlertTriangle /> : <CheckCircle />}
          {statusMsg}
        </div>
      )}

      {/* DEPLOY */}
      {activeTab === 'deploy' && (
        <form onSubmit={handleDeploy} className="space-y-4">
          <h2 className="text-lg font-bold">Deploy Event</h2>

          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Event question"
            className="w-full p-3 rounded-xl bg-black/30"
            required
          />

          <select
            value={targetCountry}
            onChange={e => setTargetCountry(e.target.value)}
            className="w-full p-3 rounded-xl bg-black/30"
          >
            {SUPPORTED_COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            disabled={loading}
            className="w-full bg-zii-accent text-black font-bold py-4 rounded-xl"
          >
            {loading ? <Loader /> : 'DEPLOY'}
          </button>
        </form>
      )}

      {/* USERS — TOKEN INJECTION */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Coins className="text-zii-accent" /> Inject Tokens
          </h2>

          <form onSubmit={handleInjectTokens} className="space-y-3 bg-black/20 p-4 rounded-xl">
            <input
              required
              placeholder="User email or UID"
              value={injectUser}
              onChange={e => setInjectUser(e.target.value)}
              className="w-full p-3 rounded-lg bg-black/30"
            />

            <input
              required
              type="number"
              placeholder="Amount"
              value={injectAmount}
              onChange={e => setInjectAmount(e.target.value)}
              className="w-full p-3 rounded-lg bg-black/30"
            />

            <input
              required
              placeholder="Reason (required)"
              value={injectReason}
              onChange={e => setInjectReason(e.target.value)}
              className="w-full p-3 rounded-lg bg-black/30"
            />

            <textarea
              placeholder="Optional note"
              value={injectNote}
              onChange={e => setInjectNote(e.target.value)}
              className="w-full p-3 rounded-lg bg-black/30"
            />

            <button
              disabled={loading}
              className="w-full bg-zii-accent text-black font-bold py-3 rounded-xl"
            >
              {loading ? <Loader /> : 'INJECT TOKENS'}
            </button>
          </form>
        </div>
      )}

      {/* FEED */}
      {activeTab === 'feed' && <Feed adminMode adminStatusFilter="open" />}

      {/* BOTTOM NAV */}
      <div className="fixed bottom-0 left-0 right-0 bg-zii-bg border-t border-white/10">
        <div className="flex justify-around h-16 items-center">
          <button onClick={() => setActiveTab('deploy')}><Zap /></button>
          <button onClick={() => setActiveTab('feed')}><Home /></button>
          <button onClick={() => setActiveTab('analytics')}><BarChart3 /></button>
          <button onClick={() => setActiveTab('partners')}><Handshake /></button>
          <button onClick={() => setActiveTab('creators')}><Star /></button>
          <button onClick={() => setActiveTab('users')}><Users /></button>
          <button onClick={() => setActiveTab('settings')}><Settings /></button>
        </div>
      </div>
    </div>
  );
};
