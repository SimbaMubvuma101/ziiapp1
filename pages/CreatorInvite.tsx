
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader } from '../components/Loader';
import { Star, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '../utils/api';

export const CreatorInvitePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [invite, setInvite] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const code = searchParams.get('code');

  useEffect(() => {
    if (!code) {
      setError('Invalid invite link');
      setLoading(false);
      return;
    }

    // Validate invite
    const validateInvite = async () => {
      try {
        const inviteData = await api.validateCreatorInvite(code);
        setInvite(inviteData);
      } catch (err: any) {
        setError(err.message || 'Invalid or expired invite');
      } finally {
        setLoading(false);
      }
    };

    validateInvite();
  }, [code, navigate]);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !email || !password) return;
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    setClaiming(true);
    setError('');

    try {
      // Use the api utility function which properly handles JSON
      const data = await api.claimCreatorInvite(code, email, password);
      
      // Store the token
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        sessionStorage.setItem('auth_token', data.token);
      }
      
      setSuccess(true);
      
      // Redirect to creator studio with full page reload to reinitialize auth
      setTimeout(() => {
        window.location.href = '/#/creator/studio';
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to claim invite');
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zii-bg flex items-center justify-center">
        <Loader size={50} className="text-zii-accent" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-zii-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zii-card border border-zii-accent/20 rounded-3xl p-8 text-center">
          <div className="w-20 h-20 bg-zii-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-zii-accent" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Welcome, Creator! 🎉</h1>
          <p className="text-white/60 mb-4">Your creator account has been activated.</p>
          <p className="text-sm text-white/40">Redirecting to Creator Studio...</p>
        </div>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen bg-zii-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zii-card border border-red-500/20 rounded-3xl p-8 text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={40} className="text-red-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Invalid Invite</h1>
          <p className="text-white/60 mb-6">{error || 'This invite link is invalid or has expired.'}</p>
          <button
            onClick={() => navigate('/earn')}
            className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zii-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gradient-to-br from-zii-card to-white/5 border border-zii-accent/20 rounded-3xl p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-zii-accent/10 blur-[50px] rounded-full pointer-events-none"></div>
        
        <div className="w-20 h-20 bg-zii-accent/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
          <Star size={40} className="text-zii-accent" />
        </div>

        <h1 className="text-3xl font-black text-white mb-2">Creator Invite</h1>
        <p className="text-white/60 mb-8">You've been invited to become a Zii Creator!</p>

        <div className="bg-black/20 border border-white/10 rounded-2xl p-6 mb-6 text-left">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-white/40 uppercase font-bold tracking-wider">Creator Name</span>
            <span className="text-white font-bold">{invite.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-white/40 uppercase font-bold tracking-wider">Country</span>
            <span className="text-white font-bold">{invite.country}</span>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6 text-left">
          <p className="text-xs text-blue-200/80 leading-relaxed">
            <strong>What you'll get:</strong><br/>
            • Create custom prediction events<br/>
            • Earn 50% commission on platform fees<br/>
            • Build your community
          </p>
        </div>

        <form onSubmit={handleClaim} className="space-y-4 mb-6">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder:text-white/20 focus:outline-none focus:border-zii-accent/50 focus:bg-black/40 transition-all"
              placeholder="your@email.com"
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
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder:text-white/20 focus:outline-none focus:border-zii-accent/50 focus:bg-black/40 transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={claiming}
            className="w-full bg-zii-accent text-black font-bold py-4 rounded-xl hover:bg-white transition-all shadow-lg shadow-zii-accent/20 flex items-center justify-center gap-2"
          >
            {claiming ? <Loader className="text-black" /> : <><Star size={20} /> Claim Creator Status</>}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};
