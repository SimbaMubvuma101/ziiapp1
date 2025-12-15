import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, runTransaction, collection, serverTimestamp, getDoc, query, where, getDocs, increment } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { ArrowRight, AlertCircle, UserCheck, Mail, Phone, Link as LinkIcon, CheckCircle2, Gift } from 'lucide-react';
import { Loader } from '../components/Loader';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  
  const [error, setError] = useState('');
  const [existingEmail, setExistingEmail] = useState(''); 
  const [verificationSentTo, setVerificationSentTo] = useState(''); 
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
    setVerificationSentTo('');

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
      // 1. Attempt to create the auth user first
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // 2. Update display name
      await updateProfile(user, {
        displayName: name,
      });

      // 3. Handle Referral / Affiliate Logic (Link Based)
      let validReferrerId: string | null = null;
      let validAffiliateId: string | null = null;

      try {
          if (referralCode.trim()) {
             const code = referralCode.trim();

             // A. Check if it's an Affiliate Code (Partner Link)
             const affQuery = query(collection(db, "affiliates"), where("code", "==", code.toUpperCase()));
             const affSnap = await getDocs(affQuery);

             if (!affSnap.empty) {
                 // It IS an affiliate
                 const affDoc = affSnap.docs[0];
                 validAffiliateId = affDoc.id;
                 
                 // Update Affiliate Stats (New User Count)
                 await runTransaction(db, async (t) => {
                     t.update(affDoc.ref, { active_users_count: increment(1) });
                 });
             } else {
                 // B. Check if referrer exists as a User (Legacy User Link)
                 await runTransaction(db, async (transaction) => {
                     const referrerRef = doc(db, "users", code);
                     const referrerDoc = await transaction.get(referrerRef);

                     if (referrerDoc.exists()) {
                         validReferrerId = referrerDoc.id;
                         const currentBalance = referrerDoc.data().balance || 0;
                         
                         // Reward Referrer (10 Coins)
                         transaction.update(referrerRef, {
                             balance: currentBalance + 10
                         });

                         // Create Transaction Record for Referrer
                         const txRef = doc(collection(db, "transactions"));
                         transaction.set(txRef, {
                             userId: referrerDoc.id,
                             type: 'winnings', // Classified as winnings/income
                             amount: 10,
                             description: `Referral Bonus: ${name}`,
                             created_at: serverTimestamp()
                         });
                     }
                 });
             }
          }
      } catch (refError) {
          console.error("Referral processing error (ignoring to allow registration):", refError);
          // We don't block registration if referral fails
      }

      // 4. Create New User Document
      try {
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          name: name,
          email: email,
          phoneNumber: phone,
          balance: 100, // Welcome Bonus
          photo_file_name: null,
          referred_by: validReferrerId, // Legacy
          affiliate_id: validAffiliateId, // Affiliate System
          created_at: new Date().toISOString(),
          isAdmin: email === 'admin@zii.app'
        });
      } catch (firestoreError) {
        console.error("Error creating user document:", firestoreError);
      }

      // 5. Special handling for Admin: Skip verification logout
      if (email === 'admin@zii.app') {
          return;
      }

      // 6. Standard User: Send verification email and sign out
      await sendEmailVerification(user);
      await signOut(auth);

      setVerificationSentTo(email);
    } catch (err: any) {
      console.error(err);
      
      // RECOVERY: If it's admin and account exists, try to sign in directly
      if (err.code === 'auth/email-already-in-use' && email === 'admin@zii.app') {
          try {
              const cred = await signInWithEmailAndPassword(auth, email, password);
              await setDoc(doc(db, "users", cred.user.uid), {
                  uid: cred.user.uid,
                  name: name || "Admin",
                  email: email,
                  created_at: new Date().toISOString(),
                  isAdmin: true,
                  balance: 100,
                  photo_file_name: null
              }, { merge: true });
              
              navigate('/admin');
              return;
          } catch (loginErr) {
              setExistingEmail(email);
          }
      } else if (err.code === 'auth/email-already-in-use') {
        setExistingEmail(email);
      } else {
        setError('Failed to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Full Screen "Verification Sent" State
  // ------------------------------------------------------------------
  if (verificationSentTo) {
    return (
      <div className="min-h-screen bg-zii-bg flex items-center justify-center p-6 relative overflow-hidden animate-in fade-in duration-300">
        <div className="absolute top-0 left-0 w-64 h-64 bg-zii-accent/5 rounded-full blur-[80px]" />
        
        <div className="w-full max-w-sm flex flex-col items-center text-center relative z-10">
          <div className="w-24 h-24 bg-zii-card rounded-3xl flex items-center justify-center mb-6 border border-white/10 shadow-2xl shadow-zii-accent/5 ring-1 ring-white/5 rotate-3">
             <Mail size={40} className="text-zii-accent" />
          </div>
          
          <h2 className="text-3xl font-black text-white tracking-tighter mb-3">Verify Your Email</h2>
          
          <div className="bg-white/5 rounded-2xl p-5 border border-white/5 mb-8 w-full backdrop-blur-sm">
             <p className="text-white/60 text-sm mb-2">We have sent a verification email to:</p>
             <p className="text-white font-bold text-lg break-all">{verificationSentTo}</p>
             <p className="text-white/40 text-xs mt-3">Please verify it and log in.</p>
          </div>

          <Link 
             to="/login" 
             className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-zii-accent transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/5 active:scale-[0.98] group"
          >
             Sign In <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Full Screen "User Exists" State
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // Standard Register Form
  // ------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-zii-bg flex items-center justify-center p-6 relative overflow-hidden">
       {/* Decoration */}
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
            <div className="relative">
                <div className="absolute left-4 top-3.5 text-white/30">
                  <Phone size={18} />
                </div>
                <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-base text-white placeholder:text-white/20 focus:outline-none focus:border-zii-accent/50 focus:bg-black/40 transition-all"
                placeholder="077 123 4567"
                />
            </div>
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

          {/* Referral Code Field - Visual indicator if populated */}
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

          {/* Hidden Link Detection Logic - Only shows if we found a valid code */}
          {referralCode && (
            <div className="bg-zii-accent/10 border border-zii-accent/20 rounded-xl p-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-1 mt-2">
                <div className="w-8 h-8 rounded-full bg-zii-accent/20 flex items-center justify-center text-zii-accent shrink-0">
                    <LinkIcon size={14} />
                </div>
                <div>
                    <p className="text-xs font-bold text-white">Partner Link Active</p>
                    <p className="text-[10px] text-white/50">Referral ID: <span className="font-mono text-zii-accent">{referralCode.substring(0,8)}...</span></p>
                </div>
                <div className="ml-auto">
                    <CheckCircle2 size={16} className="text-zii-accent" />
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