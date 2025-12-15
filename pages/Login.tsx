import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, ArrowRight, AlertCircle, Lock, Mail, UserPlus, KeyRound, Check, ShieldAlert } from 'lucide-react';
import { Loader } from '../components/Loader';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [notFoundEmail, setNotFoundEmail] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  
  // Admin Init State
  const [isAdminSetup, setIsAdminSetup] = useState(false);

  // Forgot Password States
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetEmailSentTo, setResetEmailSentTo] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  const { refreshUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotFoundEmail('');
    setLoading(true);

    try {
      const response = await api.login(email, password);
      
      // Refresh auth context and wait for it to complete
      await refreshUser();
      
      // Small delay to ensure context has updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check for pending event redirect
      const pendingEvent = localStorage.getItem('zii_pending_event');
      const pendingTab = localStorage.getItem('zii_pending_tab');
      
      if (pendingEvent) {
        // Clear the stored redirect
        localStorage.removeItem('zii_pending_event');
        localStorage.removeItem('zii_pending_tab');
        
        // Redirect to the specific event
        navigate(`/earn?event=${pendingEvent}&tab=${pendingTab || 'creator'}`);
      } else if (email === 'admin@zii.app') {
        // ADMIN REDIRECT LOGIC
        navigate('/admin');
      } else {
        navigate('/earn');
      }

    } catch (err: any) {
      const message = err.message || 'Login failed';
      
      if (message.includes('not found') || message.includes('Invalid credentials')) {
        setNotFoundEmail(email);
      } else if (message.includes('disabled')) {
        setError('This account has been disabled.');
      } else {
        setError('Password or Email Incorrect');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('Password reset not yet implemented. Please contact support.');
    setResetLoading(false);
  };

  // ------------------------------------------------------------------
  // ADMIN SETUP REQUIRED STATE
  // ------------------------------------------------------------------
  if (isAdminSetup) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 relative overflow-hidden animate-in fade-in duration-300 font-mono">
         <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-[80px]" />
         
         <div className="w-full max-w-sm flex flex-col items-center text-center relative z-10 border border-red-500/20 bg-black/50 p-8 rounded-2xl backdrop-blur-xl">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/30 text-red-500 animate-pulse">
               <ShieldAlert size={32} />
            </div>
            
            <h2 className="text-xl font-bold text-red-500 tracking-wider mb-2 uppercase">System Uninitialized</h2>
            <p className="text-white/60 text-xs mb-8">The Zii Engine root account has not been established on this network yet.</p>

            <div className="w-full bg-white/5 p-4 rounded mb-8 text-left border-l-2 border-red-500">
               <p className="text-[10px] text-white/30 uppercase mb-1">Target Identity</p>
               <p className="text-white font-bold tracking-wider">admin@zii.app</p>
            </div>

            <button 
               onClick={() => navigate('/register')}
               className="w-full bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/20 active:scale-[0.98] uppercase text-xs tracking-widest"
            >
               Initialize Root Account
            </button>
         </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Full Screen "Reset Link Sent" State
  // ------------------------------------------------------------------
  if (resetEmailSentTo) {
    return (
      <div className="min-h-screen bg-zii-bg flex items-center justify-center p-6 relative overflow-hidden animate-in fade-in duration-300">
        <div className="absolute top-0 right-0 w-64 h-64 bg-zii-accent/5 rounded-full blur-[80px]" />
        
        <div className="w-full max-w-sm flex flex-col items-center text-center relative z-10">
          <div className="w-24 h-24 bg-zii-card rounded-3xl flex items-center justify-center mb-6 border border-white/10 shadow-2xl shadow-zii-accent/5 ring-1 ring-white/5 rotate-3">
             <Check size={40} className="text-zii-accent" />
          </div>
          
          <h2 className="text-3xl font-black text-white tracking-tighter mb-3">Check Your Inbox</h2>
          
          <div className="bg-white/5 rounded-2xl p-5 border border-white/5 mb-8 w-full backdrop-blur-sm">
             <p className="text-white/60 text-sm mb-2">We sent you a password change link to:</p>
             <p className="text-white font-bold text-lg break-all">{resetEmailSentTo}</p>
          </div>

          <button 
             onClick={() => setResetEmailSentTo('')}
             className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-zii-accent transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/5 active:scale-[0.98] group"
          >
             Sign In <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Full Screen "Forgot Password" Form
  // ------------------------------------------------------------------
  if (isResetMode) {
    return (
      <div className="min-h-screen bg-zii-bg flex items-center justify-center p-6 relative overflow-hidden animate-in fade-in duration-300">
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-zii-highlight/5 rounded-full blur-[80px]" />

        <div className="w-full max-w-sm relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-white/5 rounded-2xl border border-white/10 mb-4 flex items-center justify-center shadow-lg backdrop-blur-sm">
              <KeyRound size={28} className="text-zii-highlight" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tighter">Reset Password</h1>
            <p className="text-white/40 text-sm mt-2">We'll help you get back in.</p>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-4">
            {resetError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span className="leading-tight">{resetError}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Email Address</label>
              <div className="relative">
                <div className="absolute left-4 top-3.5 text-white/30">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-base text-white placeholder:text-white/20 focus:outline-none focus:border-zii-highlight/50 focus:bg-black/40 transition-all"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={resetLoading}
              className="w-full bg-white text-black font-bold py-4 rounded-xl mt-6 hover:bg-zii-highlight transition-all duration-300 shadow-lg shadow-white/5 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:grayscale"
            >
              {resetLoading ? <Loader className="text-black" /> : <>Get Reset Link <ArrowRight size={18} /></>}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button 
              onClick={() => setIsResetMode(false)}
              className="text-white/40 text-sm font-bold hover:text-white transition-colors uppercase tracking-wider"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Full Screen "Email Not Verified" State
  // ------------------------------------------------------------------
  if (unverifiedEmail) {
    return (
      <div className="min-h-screen bg-zii-bg flex items-center justify-center p-6 relative overflow-hidden animate-in fade-in duration-300">
        <div className="absolute top-0 right-0 w-64 h-64 bg-zii-highlight/5 rounded-full blur-[80px]" />
        
        <div className="w-full max-w-sm flex flex-col items-center text-center relative z-10">
          <div className="w-24 h-24 bg-zii-card rounded-3xl flex items-center justify-center mb-6 border border-white/10 shadow-2xl shadow-zii-accent/5 ring-1 ring-white/5 rotate-3">
             <Mail size={40} className="text-zii-accent" />
          </div>
          
          <h2 className="text-3xl font-black text-white tracking-tighter mb-3">Verify Your Email</h2>
          
          <div className="bg-white/5 rounded-2xl p-5 border border-white/5 mb-8 w-full backdrop-blur-sm">
             <p className="text-white/60 text-sm mb-2">We have sent a verification email to:</p>
             <p className="text-white font-bold text-lg break-all">{unverifiedEmail}</p>
             <p className="text-white/40 text-xs mt-3">Please verify it and log in.</p>
          </div>

          <button 
             onClick={() => setUnverifiedEmail('')}
             className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-zii-accent transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/5 active:scale-[0.98] group"
          >
             Log In <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Full Screen "Account Not Found" State
  // ------------------------------------------------------------------
  if (notFoundEmail) {
    return (
      <div className="min-h-screen bg-zii-bg flex items-center justify-center p-6 relative overflow-hidden animate-in fade-in duration-300">
        <div className="absolute top-0 right-0 w-64 h-64 bg-zii-highlight/5 rounded-full blur-[80px]" />
        
        <div className="w-full max-w-sm flex flex-col items-center text-center relative z-10">
          <div className="w-24 h-24 bg-zii-card rounded-3xl flex items-center justify-center mb-6 border border-white/10 shadow-2xl shadow-zii-accent/5 ring-1 ring-white/5 -rotate-3">
             <UserPlus size={40} className="text-zii-accent" />
          </div>
          
          <h2 className="text-3xl font-black text-white tracking-tighter mb-3">No Account Found</h2>
          
          <div className="bg-white/5 rounded-2xl p-5 border border-white/5 mb-8 w-full backdrop-blur-sm">
             <p className="text-white/60 text-sm mb-2">We couldn't find an account for:</p>
             <p className="text-white font-bold text-lg break-all">{notFoundEmail}</p>
          </div>

          <Link 
             to="/register" 
             className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-zii-accent transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/5 active:scale-[0.98] group"
          >
             Create Account <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>

          <button 
             onClick={() => setNotFoundEmail('')}
             className="mt-6 text-white/30 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors py-2"
          >
             Try Again
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Standard Login Form
  // ------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-zii-bg flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-zii-highlight/5 rounded-full blur-[80px]" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-zii-accent/5 rounded-full blur-[80px]" />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-white/5 rounded-2xl border border-white/10 mb-4 flex items-center justify-center shadow-lg backdrop-blur-sm">
            <Zap size={32} className="text-zii-accent fill-zii-accent" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter">Welcome Back</h1>
          <p className="text-white/40 text-sm mt-2">Sign in to continue earning</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div className="flex flex-col items-start text-left">
                 <span className="leading-tight break-all">{error}</span>
                 {(error.includes('Password') || error.includes('account')) && (
                    <Link to="/register" className="text-white underline font-bold text-xs mt-1">Need an account? Sign up</Link>
                 )}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Email</label>
            <div className="relative">
              <div className="absolute left-4 top-3.5 text-white/30">
                <Mail size={18} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-base text-white placeholder:text-white/20 focus:outline-none focus:border-zii-accent/50 focus:bg-black/40 transition-all"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center pr-1">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Password</label>
              <button 
                type="button"
                onClick={() => setIsResetMode(true)}
                className="text-[10px] font-bold text-zii-highlight hover:text-white transition-colors uppercase tracking-widest"
              >
                Forgot?
              </button>
            </div>
            <div className="relative">
               <div className="absolute left-4 top-3.5 text-white/30">
                <Lock size={18} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-base text-white placeholder:text-white/20 focus:outline-none focus:border-zii-accent/50 focus:bg-black/40 transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-bold py-4 rounded-xl mt-6 hover:bg-zii-accent transition-all duration-300 shadow-lg shadow-white/5 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:grayscale"
          >
            {loading ? <Loader className="text-black" /> : <>Sign In <ArrowRight size={18} /></>}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-white/40 text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="text-zii-accent font-bold hover:underline decoration-2 underline-offset-4">
              Join Zii
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};