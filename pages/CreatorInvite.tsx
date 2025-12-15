
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, runTransaction, doc, serverTimestamp } from 'firebase/firestore';
import { Loader } from '../components/Loader';
import { CheckCircle, AlertCircle, Star, LogIn, Zap } from 'lucide-react';
import { CreatorInvite } from '../types';

export const CreatorInvitePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userProfile } = useAuth();
  
  const [inviteCode, setInviteCode] = useState('');
  const [invite, setInvite] = useState<CreatorInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    
    // Check for old-style ?code= format
    if (code) {
      setInviteCode(code);
      validateInvite(code);
      return;
    }
    
    // Check for new-style /:creatorname format
    const pathParts = location.pathname.split('/');
    const creatorName = pathParts[pathParts.length - 1];
    
    if (creatorName && creatorName !== 'creator') {
      validateInviteByName(creatorName);
    } else {
      setError('Invalid invite link');
      setLoading(false);
    }
  }, [location]);

  const validateInviteByName = async (creatorSlug: string) => {
    try {
      // Convert slug back to name format for query
      const snapshot = await getDocs(collection(db, "creator_invites"));
      const matchingInvite = snapshot.docs.find(doc => {
        const data = doc.data();
        const slug = data.name.toLowerCase().replace(/\s+/g, '');
        return slug === creatorSlug.toLowerCase() && data.status === 'active';
      });
      
      if (!matchingInvite) {
        setError('Invite not found');
        setLoading(false);
        return;
      }

      const inviteData = { id: matchingInvite.id, ...matchingInvite.data() } as CreatorInvite;
      setInviteCode(inviteData.code);
      setInvite(inviteData);
      setLoading(false);

      // Auto-claim if user is signed in
      if (currentUser && userProfile && !userProfile.isCreator) {
        handleClaim();
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to validate invite');
      setLoading(false);
    }
  };

  const validateInvite = async (code: string) => {
    try {
      const q = query(collection(db, "creator_invites"), where("code", "==", code));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setError('Invite not found');
        setLoading(false);
        return;
      }

      const inviteDoc = snapshot.docs[0];
      const inviteData = { id: inviteDoc.id, ...inviteDoc.data() } as CreatorInvite;
      
      if (inviteData.status !== 'active') {
        setError('This invite is no longer valid');
        setLoading(false);
        return;
      }

      setInvite(inviteData);
      setLoading(false);

      // Auto-claim if user is signed in
      if (currentUser && userProfile && !userProfile.isCreator) {
        handleClaim();
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to validate invite');
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!currentUser || !userProfile || !invite) return;
    
    if (userProfile.isCreator) {
      setError('You are already a creator');
      return;
    }

    setClaiming(true);
    setError('');

    try {
      await runTransaction(db, async (transaction) => {
        const inviteRef = doc(db, "creator_invites", invite.id!);
        const userRef = doc(db, "users", currentUser.uid);

        // Update invite status
        transaction.update(inviteRef, {
          status: 'claimed',
          claimed_by: currentUser.uid,
          claimed_at: serverTimestamp()
        });

        // Upgrade user to creator
        transaction.update(userRef, {
          isCreator: true,
          creator_name: invite.name,
          creator_country: invite.country,
          total_events_created: 0,
          total_commission_earned: 0
        });
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/creator/studio');
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setError('Failed to claim invite. Please try again.');
    } finally {
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
      <div className="min-h-screen bg-zii-bg flex items-center justify-center p-6 animate-in fade-in">
        <div className="w-full max-w-sm text-center">
          <div className="w-24 h-24 bg-zii-accent/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <CheckCircle size={50} className="text-zii-accent" />
          </div>
          <h1 className="text-3xl font-black text-white mb-3">Welcome, Creator!</h1>
          <p className="text-white/60 mb-6">Redirecting to your studio...</p>
        </div>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen bg-zii-bg flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={50} className="text-red-500" />
          </div>
          <h1 className="text-2xl font-black text-white mb-3">Invalid Invite</h1>
          <p className="text-white/60 mb-6">{error}</p>
          <button 
            onClick={() => navigate('/earn')}
            className="bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-zii-accent transition-all"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zii-bg flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-zii-accent/10 rounded-full blur-[100px]" />
      
      <div className="w-full max-w-sm relative z-10">
        <div className="bg-zii-card border border-white/10 rounded-3xl p-8 text-center">
          <div className="w-20 h-20 bg-zii-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Star size={40} className="text-zii-accent" />
          </div>
          
          <h1 className="text-2xl font-black text-white mb-2">Creator Invite</h1>
          <p className="text-white/60 text-sm mb-6">You've been invited to become a creator on Zii</p>
          
          <div className="bg-black/20 border border-white/5 rounded-2xl p-5 mb-6">
            <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-2">Creator Name</p>
            <p className="text-lg font-bold text-white mb-4">{invite.name}</p>
            
            <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-2">Target Country</p>
            <p className="text-sm text-white/70">{invite.country}</p>
          </div>

          <div className="bg-zii-accent/10 border border-zii-accent/20 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs text-zii-accent/80 flex items-center gap-2">
              <Zap size={14} /> <strong>Creator Benefits:</strong>
            </p>
            <ul className="text-xs text-white/60 mt-2 space-y-1 ml-5 list-disc">
              <li>Create custom events for your audience</li>
              <li>Earn 50% commission on entry fees</li>
              <li>Earn 50% commission on winnings</li>
              <li>Manage and resolve your events</li>
            </ul>
          </div>

          {!currentUser ? (
            <button
              onClick={() => navigate('/login', { state: { returnTo: `/creator/invite?code=${inviteCode}` } })}
              className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-zii-accent transition-all flex items-center justify-center gap-2"
            >
              <LogIn size={20} /> Sign In to Accept
            </button>
          ) : userProfile?.isCreator ? (
            <div className="text-white/60 text-sm">You are already a creator</div>
          ) : (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full bg-zii-accent text-black font-bold py-4 rounded-xl hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {claiming ? <Loader className="text-black" /> : <>Accept Invite</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
