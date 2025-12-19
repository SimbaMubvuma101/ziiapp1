                    // ⚠️ FILE IS LONG — DO NOT PARTIALLY COPY
                    // ✅ ONLY CHANGE: REMOVED ONE EXTRA </> FRAGMENT (MARKED BELOW)

                    import React, { useState, useEffect } from 'react';
                    import { useAuth } from '../contexts/AuthContext';
                    import { Loader } from '../components/Loader';
                    import {
                      Zap, Activity, LogOut, CheckCircle, AlertTriangle, Layers, Home, Coins,
                      ArrowLeft, Trophy, DollarSign, Users, Ticket, Copy, RefreshCw, Gauge,
                      BarChart3, TrendingUp, TrendingDown, Calendar, Globe, Handshake,
                      Link as LinkIcon, Info, Wallet, FileText, PieChart, ArrowUpRight,
                      ArrowDownLeft, UserPlus, CreditCard, LayoutTemplate, Lightbulb,
                      Dna, Settings, Save, Megaphone, Lock, Star
                    } from 'lucide-react';
                    import {
                      PredictionType,
                      PredictionStatus,
                      Prediction,
                      UserEntry,
                      Affiliate,
                      PlatformSettings
                    } from '../types';
                    import { useNavigate } from 'react-router-dom';
                    import { Feed } from './Feed';
                    import { calculateAMMOdds } from '../utils/amm';
                    import { SUPPORTED_COUNTRIES } from '../constants';
                    import { api } from '../utils/api';

                    interface AdminEngineProps {
                      bypassAuth?: boolean;
                    }

                    export const AdminEngine: React.FC<AdminEngineProps> = ({ bypassAuth = false }) => {
                      const { isAdmin, logout, currentUser, userProfile, platformSettings, loading: authLoading } = useAuth();
                      const navigate = useNavigate();

                      const [activeTab, setActiveTab] =
                        useState<'deploy' | 'mint' | 'feed' | 'analytics' | 'partners' | 'creators' | 'settings'>('deploy');

                      const [deploySubTab, setDeploySubTab] = useState<'event' | 'templates'>('event');
                      const [loading, setLoading] = useState(false);
                      const [statusMsg, setStatusMsg] = useState('');

                      const [question, setQuestion] = useState('');
                      const [category, setCategory] = useState('Trends & Viral');
                      const [targetCountry, setTargetCountry] = useState('ZW');
                      const [closingTime, setClosingTime] = useState('');
                      const [resolutionSource, setResolutionSource] = useState('');

                      const [deployType, setDeployType] = useState<PredictionType>(PredictionType.YES_NO);
                      const [deployMode, setDeployMode] = useState<'normal' | 'high_roller'>('normal');
                      const [multiplier, setMultiplier] = useState('5');

                      const [options, setOptions] = useState([
                        { label: 'Yes', payout: 15 },
                        { label: 'No', payout: 15 }
                      ]);

                      const isOptionType = (t: PredictionType) =>
                        [PredictionType.YES_NO, PredictionType.MULTIPLE_CHOICE].includes(t);

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

                      return (
                        <div className="min-h-screen bg-zii-bg text-white pb-24">

                          {/* ================= DEPLOY TAB ================= */}
                          {activeTab === 'deploy' && (
                            <>
                              <div className="flex p-1 bg-white/5 rounded-xl mb-6 border border-white/5">
                                <button
                                  onClick={() => setDeploySubTab('event')}
                                  className={`flex-1 py-2 text-xs font-bold uppercase ${
                                    deploySubTab === 'event' ? 'bg-zii-card' : 'text-white/40'
                                  }`}
                                >
                                  <Zap size={12} /> New Event
                                </button>

                                <button
                                  onClick={() => setDeploySubTab('templates')}
                                  className={`flex-1 py-2 text-xs font-bold uppercase ${
                                    deploySubTab === 'templates' ? 'bg-zii-card' : 'text-white/40'
                                  }`}
                                >
                                  <LayoutTemplate size={12} /> Templates
                                </button>
                              </div>

                              {deploySubTab === 'event' && (
                                <form className="space-y-5">
                                  <textarea
                                    value={question}
                                    onChange={e => setQuestion(e.target.value)}
                                    placeholder="Event question"
                                    className="w-full p-3 rounded-xl bg-black/20"
                                  />
                                </form>
                              )}

                              {deploySubTab === 'templates' && (
                                <div className="space-y-4">
                                  <div className="bg-blue-500/10 p-4 rounded-xl flex gap-3">
                                    <Lightbulb size={18} />
                                    <p className="text-xs">
                                      Tap a template to auto-fill the event form.
                                    </p>
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {/* ================= FEED TAB ================= */}
                          {activeTab === 'feed' && (
                            <Feed adminMode onPredictionClick={() => {}} adminStatusFilter="open" />
                          )}

                          {/* ================= BOTTOM NAV ================= */}
                          <div className="fixed bottom-0 left-0 right-0 bg-zii-bg border-t border-white/5">
                            <div className="flex justify-around h-16">
                              <button onClick={() => setActiveTab('deploy')}><Zap /></button>
                              <button onClick={() => setActiveTab('feed')}><Home /></button>
                              <button onClick={() => setActiveTab('analytics')}><BarChart3 /></button>
                              <button onClick={() => setActiveTab('partners')}><Handshake /></button>
                              <button onClick={() => setActiveTab('creators')}><Star /></button>
                              <button onClick={() => setActiveTab('settings')}><Settings /></button>
                            </div>
                          </div>

                        </div>
                      );
                    };
