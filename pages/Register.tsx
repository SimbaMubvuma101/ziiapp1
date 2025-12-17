import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { ArrowRight, AlertCircle, UserCheck, Mail, Gift, CheckCircle2 } from 'lucide-react';
import { Loader } from '../components/Loader';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');

  const [error, setError] = useState('');
  const [existingEmail, setExistingEmail] = useState(''); 
  const [loading, setLoading] = useState(false);

  // Auto-fill referral code from URL Link or LocalStorage Cookie
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const refParam = params.get('ref');

    if (refParam) {
      setReferralCode(refParam);
    } else {
      // Fallback: Check for active 7-day partner cookie
      const localCode = localStorage.getItem('zii_ref_code');
      const localExpiry = localStorage.getItem('zii_ref_expiry');
      if (localCode && localExpiry && Date.now() < parseInt(localExpiry)) {
        setReferralCode(localCode);
      }
    }
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setExistingEmail('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      console.log('Attempting registration...');
      await api.register({
        name,
        email,
        password,
        phone,
        referralCode: referralCode.trim() || undefined,
        affiliateId: referralCode.trim() || undefined,
        country: localStorage.getItem('zii_user_country') || 'ZW'
      });

      console.log('Registration successful');
      
      // Small delay to ensure token is stored
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Refresh auth context to load the new user
      await refreshUser();
      
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
        // Registration successful - redirect to login or home
        navigate('/admin');
      } else {
        navigate('/earn');
      }
    } catch (err: any) {
      console.error('Registration error:', err);

      if (err.message?.includes('already registered') || err.message?.includes('Email already')) {
        setExistingEmail(email);
      } else {
        setError(err.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Full Screen "User Exists" State
  if (existingEmail) {
    return (
      <div className="min-h-screen bg-zii-bg flex items-center justify-center p-6 relative overflow-hidden animate-in fade-in duration-300">
        <div className="absolute top-0 right-0 w-64 h-64 bg-zii-highlight/5 rounded-full blur-[80px]" />

        <div className="w-full max-w-sm flex flex-col items-center text-center relative z-10">
          <div className="w-24 h-24 bg-zii-card rounded-3xl flex items-center justify-center mb-6 border border-white/10 shadow-2xl shadow-zii-accent/5 ring-1 ring-white/5 rotate-3">
             <UserCheck size={40} className="text-zii-accent" />
          </div>

          <h2 className="text-3xl font-black text-white tracking-tighter mb-3">Account Exists</h2>

          <div className="bg-white/5 rounded-2xl p-5 border border-white/5 mb-8 w-full backdrop-blur-sm">
             <p className="text-white/60 text-sm mb-2">The email is already registered:</p>
             <p className="text-white font-bold text-lg break-all">{existingEmail}</p>
          </div>

          <Link 
             to="/login" 
             className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-zii-accent transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/5 active:scale-[0.98] group"
          >
             Sign In Instead <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>

          <button 
             onClick={() => setExistingEmail('')}
             className="mt-6 text-white/30 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors py-2"
          >
             Try a different email
          </button>
        </div>
      </div>
    );
  }

  // Standard Register Form
  return (
    <div className="min-h-screen bg-zii-bg flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-64 h-64 bg-zii-highlight/5 rounded-full blur-[80px]" />

      <div className="w-full max-w-sm relative z-10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black text-white tracking-tighter">Create Account</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div className="flex flex-col w-full">
                <span className="leading-tight break-all">{error}</span>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder:text-white/20 focus:outline-none focus:border-zii-accent/50 focus:bg-black/40 transition-all"
              placeholder="e.g. Tinotenda_99"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder:text-white/20 focus:outline-none focus:border-zii-accent/50 focus:bg-black/40 transition-all"
              placeholder="name@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder:text-white/20 focus:outline-none focus:border-zii-accent/50 focus:bg-black/40 transition-all"
              placeholder="077 123 4567"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder:text-white/20 focus:outline-none focus:border-zii-accent/50 focus:bg-black/40 transition-all"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Repeat Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder:text-white/20 focus:outline-none focus:border-zii-accent/50 focus:bg-black/40 transition-all"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-1 pt-2">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1 flex items-center gap-1">
               <Gift size={12} className="text-zii-accent" /> Referral / Promo Code (Optional)
            </label>
            <input
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder:text-white/20 focus:outline-none focus:border-zii-accent/50 focus:bg-black/40 transition-all font-mono"
              placeholder="Paste code here"
            />
          </div>

          {referralCode && (
            <div className="bg-zii-accent/10 border border-zii-accent/20 rounded-xl p-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-1 mt-2">
              <div className="w-8 h-8 rounded-full bg-zii-accent/20 flex items-center justify-center text-zii-accent shrink-0">
                <CheckCircle2 size={14} />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Partner Link Active</p>
                <p className="text-[10px] text-white/50">Referral ID: <span className="font-mono text-zii-accent">{referralCode.substring(0,8)}...</span></p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-bold py-4 rounded-xl mt-6 hover:bg-zii-accent transition-all duration-300 shadow-lg shadow-white/5 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:grayscale"
          >
            {loading ? <Loader className="text-black" /> : <>Create Account <ArrowRight size={18} /></>}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-white/40 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-zii-accent font-bold hover:underline decoration-2 underline-offset-4">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};