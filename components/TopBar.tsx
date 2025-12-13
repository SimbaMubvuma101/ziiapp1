import React, { useState, useEffect } from 'react';
import { User, HelpCircle, LogOut, X, FileText, Share2, ChevronRight, Settings, Trash2, Camera, Save, Copy, Coins, LogIn, Globe, Zap, Trophy } from 'lucide-react';
import { TermsModal } from './TermsModal';
import { ShareModal } from './ShareModal';
import { AuthPromptModal } from './AuthPromptModal';
import { WHATSAPP_PHONE, SUPPORTED_COUNTRIES } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { updateProfile, deleteUser } from 'firebase/auth';
import { db } from '../firebase';
import { Loader } from './Loader';
import { getLevelProgress } from '../utils/gamification';

export const TopBar: React.FC = () => {
  const [showMenu, setShowMenu] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  
  // Profile State
  const { currentUser, logout, userProfile, userCountry, updateCountry } = useAuth();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);
  
  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Country Mode State
  const [isChangingCountry, setIsChangingCountry] = useState(false);

  // Delete Mode State
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // ID Copy State
  const [idCopied, setIdCopied] = useState(false);

  // 1. Sync Data from Firestore
  useEffect(() => {
    if (!currentUser) {
        setUserData(null);
        return;
    }
    
    // Subscribe to real-time updates
    const unsub = onSnapshot(doc(db, "users", currentUser.uid), (doc) => {
        if (doc.exists()) {
            setUserData(doc.data());
        }
    }, (error) => {
        console.error("TopBar Profile Snapshot Error:", error);
    });

    return () => unsub();
  }, [currentUser]);

  // Derived values
  const username = userData?.name || currentUser?.displayName || "Zii_User";
  const email = userData?.email || currentUser?.email;
  const initials = username.charAt(0).toUpperCase();
  // We use the auth metadata creation time as fallback
  const joinedDate = currentUser?.metadata.creationTime 
    ? new Date(currentUser.metadata.creationTime).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : "Nov 2024";

  const balance = userProfile?.balance || 0;
  const isLowBalance = balance < 10;
  const level = userProfile?.level || 1;
  const xp = userProfile?.xp || 0;
  const progress = getLevelProgress(xp);
  
  const currentCountryConfig = SUPPORTED_COUNTRIES.find(c => c.code === userCountry);

  const handleSupport = () => {
    const message = "Hello Zii Support! I need assistance with the app.";
    const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Failed to logout", error);
    }
  };

  const handleUpdateProfile = async () => {
    if (!currentUser || !editName.trim()) return;
    
    setIsSaving(true);
    try {
      // 1. Update Firestore
      await updateDoc(doc(db, "users", currentUser.uid), {
        name: editName,
        phoneNumber: editPhone
      });
      // 2. Update Auth
      await updateProfile(currentUser, {
        displayName: editName
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile", error);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleCountryChange = async (code: string) => {
      setIsSaving(true);
      await updateCountry(code);
      setIsSaving(false);
      setIsChangingCountry(false);
  };

  const handleDeleteAccount = async () => {
     if (!currentUser) return;
     setIsSaving(true);
     try {
        // 1. Delete Firestore Data
        await deleteDoc(doc(db, "users", currentUser.uid));
        // 2. Delete Auth User
        await deleteUser(currentUser);
        // Auth state change will handle redirect, but we force nav just in case
        navigate('/login');
     } catch (error: any) {
        console.error("Error deleting account", error);
        if (error.code === 'auth/requires-recent-login') {
            alert("For security, please log out and log in again before deleting your account.");
            handleLogout();
        }
     } finally {
        setIsSaving(false);
     }
  };

  const handleCopyId = () => {
      if (currentUser?.uid) {
          navigator.clipboard.writeText(currentUser.uid);
          setIdCopied(true);
          setTimeout(() => setIdCopied(false), 2000);
      }
  };

  const MenuItem = ({ icon: Icon, label, isDestructive = false, hasToggle = false, onClick, extraLabel }: any) => (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between p-4 bg-zii-card rounded-xl border border-white/5 active:scale-[0.98] transition-all hover:bg-white/5 ${isDestructive ? 'text-red-400 hover:bg-red-500/10 border-red-500/20' : 'text-white'}`}
    >
      <span className="flex items-center gap-3">
        <Icon size={18} className={isDestructive ? "text-red-400" : "text-white/60"} />
        <span className="font-medium text-sm">{label}</span>
      </span>
      <div className="flex items-center gap-2">
          {extraLabel && <span className="text-[10px] text-white/40 font-bold uppercase tracking-wide">{extraLabel}</span>}
          {hasToggle ? (
            <div className="w-9 h-5 bg-zii-accent rounded-full relative transition-colors">
              <div className="absolute right-0.5 top-0.5 bottom-0.5 w-4 bg-black rounded-full shadow-sm"></div>
            </div>
          ) : (
            !isDestructive && <ChevronRight size={16} className="text-white/20" />
          )}
      </div>
    </button>
  );

  return (
    <>
      <div className="sticky top-0 z-40 bg-zii-bg/80 backdrop-blur-md border-b border-white/5 px-4 h-14 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tighter text-white">
          Zii<span className="text-zii-accent">.</span>
        </h1>
        
        <div className="flex items-center gap-2">
            {/* Quick Balance Display (Hidden for Guest) */}
            {currentUser ? (
                <div 
                    onClick={() => navigate('/wallet')} 
                    className={`flex items-center gap-1.5 bg-white/5 pl-3 pr-2 py-1 rounded-full border ${isLowBalance ? 'border-red-500/30' : 'border-white/5'} active:scale-95 transition-transform cursor-pointer hover:bg-white/10 mr-1`}
                >
                    <span className={`font-bold font-mono text-xs ${isLowBalance ? 'text-red-500' : 'text-zii-accent'}`}>{balance.toLocaleString()}</span>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isLowBalance ? 'bg-red-500/20' : 'bg-zii-accent/20'}`}>
                        <Coins size={10} className={isLowBalance ? 'text-red-500' : 'text-zii-accent'} />
                    </div>
                </div>
            ) : null}

            {currentUser ? (
                <>
                    {/* Level Indicator (Separate) */}
                    <button 
                        onClick={() => setShowMenu(true)}
                        className="relative group flex items-center justify-center"
                    >
                        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden relative active:scale-95 transition-transform">
                            {/* Background Progress Circle */}
                            <div 
                                className="absolute bottom-0 left-0 right-0 bg-zii-accent/20 transition-all duration-500"
                                style={{ height: `${progress}%` }}
                            ></div>
                            
                            <div className="relative z-10 flex flex-col items-center justify-center -space-y-0.5">
                                <span className="text-[9px] font-black text-white leading-none">{level}</span>
                                <span className="text-[5px] text-white/50 font-bold uppercase tracking-wide leading-none">LVL</span>
                            </div>
                        </div>
                    </button>

                    {/* Profile Icon (Separate) */}
                    <button 
                        onClick={() => setShowMenu(true)}
                        className="w-9 h-9 rounded-full bg-gradient-to-tr from-white/10 to-white/5 border border-white/10 flex items-center justify-center active:scale-95 transition-transform shadow-sm"
                    >
                        <span className="text-xs font-bold text-white tracking-tight">{initials}</span>
                    </button>
                </>
            ) : (
                <button 
                    onClick={() => setShowAuthPrompt(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-zii-accent text-black font-bold text-xs rounded-full active:scale-95"
                >
                    <LogIn size={14} /> Join
                </button>
            )}
        </div>
      </div>

      {/* Full Screen Profile Overlay */}
      {showMenu && currentUser && (
        <div className="fixed inset-0 z-50 bg-zii-bg animate-in slide-in-from-right duration-200 flex flex-col">
          {/* Header */}
          <div className="p-4 flex justify-end">
            <button 
              onClick={() => {
                  setShowMenu(false);
                  setIsEditing(false);
                  setIsDeleting(false);
                  setIsChangingCountry(false);
                  setDeleteConfirm(false);
              }}
              className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors active:scale-90"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-12">
            
            {/* Country Selector UI */}
            {isChangingCountry ? (
                <div className="max-w-sm mx-auto w-full animate-in fade-in slide-in-from-bottom-4">
                     <h2 className="text-2xl font-bold text-white mb-6 text-center">Select Country</h2>
                     <p className="text-white/50 text-center text-sm mb-6">Changing country will update your currency and the events you see in the feed.</p>
                     
                     <div className="space-y-3">
                         {SUPPORTED_COUNTRIES.map((c) => (
                             <button
                                key={c.code}
                                onClick={() => handleCountryChange(c.code)}
                                disabled={isSaving}
                                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                                    userCountry === c.code 
                                    ? 'bg-zii-accent text-black border-zii-accent font-bold'
                                    : 'bg-white/5 text-white/70 border-white/5 hover:bg-white/10'
                                }`}
                             >
                                 <div className="flex items-center gap-3">
                                     <span className="text-xl">{c.flag}</span>
                                     <div className="text-left">
                                        <p className="text-sm">{c.name}</p>
                                        <p className="text-[10px] opacity-70">{c.currency}</p>
                                     </div>
                                 </div>
                                 {userCountry === c.code && <div className="w-2 h-2 rounded-full bg-black"></div>}
                             </button>
                         ))}
                     </div>
                </div>
            ) : isEditing ? (
                // Edit Profile UI
                <div className="max-w-sm mx-auto w-full animate-in fade-in slide-in-from-bottom-4">
                    <h2 className="text-2xl font-bold text-white mb-6 text-center">Edit Profile</h2>
                    
                    <div className="flex justify-center mb-8">
                        <div className="relative">
                            <div className="w-24 h-24 bg-gradient-to-tr from-zii-card to-white/5 rounded-full border border-white/10 flex items-center justify-center text-4xl font-bold text-white/50">
                                {initials}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                         <div className="space-y-1">
                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Display Name</label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-zii-accent/50 transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Phone Number</label>
                            <input
                              type="tel"
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              placeholder="077 123 4567"
                              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-zii-accent/50 transition-all"
                            />
                        </div>
                        <div className="space-y-1 opacity-50 pointer-events-none">
                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Email (Cannot change)</label>
                            <input
                              type="text"
                              value={email}
                              readOnly
                              className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-white/50"
                            />
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button 
                                onClick={() => setIsEditing(false)}
                                className="flex-1 py-4 rounded-xl font-bold text-white bg-white/5 hover:bg-white/10"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleUpdateProfile}
                                disabled={isSaving || !editName.trim()}
                                className="flex-1 py-4 rounded-xl font-bold text-black bg-zii-accent hover:bg-zii-accent/90 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader className="text-black" /> : <><Save size={18} /> Save</>}
                            </button>
                        </div>
                    </div>
                </div>
            ) : isDeleting ? (
                // Delete Account UI
                <div className="max-w-sm mx-auto w-full animate-in fade-in slide-in-from-bottom-4 text-center pt-10">
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500 border border-red-500/20">
                        <Trash2 size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Delete Account?</h2>
                    <p className="text-white/60 text-sm mb-8 px-4">
                        This action is permanent. All your coins, predictions, and history will be wiped instantly.
                    </p>

                    {!deleteConfirm ? (
                        <div className="space-y-3">
                             <button 
                                onClick={() => setDeleteConfirm(true)}
                                className="w-full py-4 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20"
                            >
                                Yes, Delete My Account
                            </button>
                            <button 
                                onClick={() => setIsDeleting(false)}
                                className="w-full py-4 rounded-xl font-bold text-white bg-white/5 hover:bg-white/10"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3 animate-in fade-in">
                            <p className="text-red-400 font-bold text-sm mb-2">Are you absolutely sure?</p>
                             <button 
                                onClick={handleDeleteAccount}
                                disabled={isSaving}
                                className="w-full py-4 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader className="text-white" /> : "CONFIRM DELETION"}
                            </button>
                            <button 
                                onClick={() => { setDeleteConfirm(false); setIsDeleting(false); }}
                                disabled={isSaving}
                                className="w-full py-4 rounded-xl font-bold text-white/50 hover:text-white"
                            >
                                Abort
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                // Normal Menu UI
                <>
                    <div className="flex flex-col items-center text-center mb-8">
                        {/* New Level Ring Profile Display */}
                        <div className="relative mb-4">
                             <svg className="w-28 h-28 transform -rotate-90">
                                <circle
                                    className="text-white/5"
                                    strokeWidth="4"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r="52"
                                    cx="56"
                                    cy="56"
                                />
                                <circle
                                    className="text-zii-accent transition-all duration-1000 ease-out"
                                    strokeWidth="4"
                                    strokeDasharray={327}
                                    strokeDashoffset={327 - (327 * progress) / 100}
                                    strokeLinecap="round"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r="52"
                                    cx="56"
                                    cy="56"
                                />
                             </svg>
                             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-gradient-to-tr from-zii-card to-white/5 rounded-full border border-white/10 flex flex-col items-center justify-center shadow-lg">
                                <span className="text-3xl font-bold text-white/90">{level}</span>
                                <span className="text-[8px] font-bold uppercase tracking-widest text-white/40">LEVEL</span>
                             </div>
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-1">@{username}</h2>
                        <div className="flex items-center gap-2 mb-2">
                             <span className="text-xs text-zii-accent font-bold uppercase tracking-wide">{xp} XP</span>
                             <span className="w-1 h-1 rounded-full bg-white/20"></span>
                             <span className="text-xs text-white/40 font-medium">Next Lvl: {(level * 10)} XP</span>
                        </div>
                    
                        {/* User ID Display with Copy */}
                        <button 
                            onClick={handleCopyId}
                            className="mt-1 flex items-center gap-1.5 text-[10px] bg-black/30 px-3 py-1.5 rounded-lg border border-white/5 hover:bg-white/5 transition-all active:scale-95 group"
                        >
                            <span className="text-white/30 font-mono">ID: {currentUser?.uid?.substring(0, 8)}...</span>
                            <span className={`text-zii-accent font-bold ${idCopied ? 'block' : 'hidden group-hover:block'}`}>
                                {idCopied ? 'Copied!' : 'Copy'}
                            </span>
                            {!idCopied && <Copy size={10} className="text-white/20 group-hover:hidden" />}
                        </button>
                    </div>

                    <div className="space-y-8 max-w-sm mx-auto w-full">
                        
                        {/* Section 1 */}
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-1 ml-1">Preferences</h3>
                            <MenuItem 
                                icon={Globe} 
                                label="Country" 
                                extraLabel={currentCountryConfig?.code}
                                onClick={() => setIsChangingCountry(true)} 
                            />
                            <MenuItem 
                                icon={Settings} 
                                label="Edit Profile" 
                                onClick={() => {
                                    setEditName(username);
                                    setEditPhone(userData?.phoneNumber || '');
                                    setIsEditing(true);
                                }} 
                            />
                        </div>

                        {/* Section 2 */}
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-1 ml-1">Community</h3>
                            <MenuItem 
                            icon={Share2} 
                            label="Share Zii App" 
                            onClick={() => setShowShare(true)}
                            />
                        </div>

                        {/* Section 3 */}
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-1 ml-1">Support</h3>
                            <MenuItem 
                            icon={HelpCircle} 
                            label="Help & Support" 
                            onClick={handleSupport}
                            />
                            <MenuItem 
                            icon={FileText} 
                            label="Terms of Service" 
                            onClick={() => setShowTerms(true)}
                            />
                            <MenuItem icon={LogOut} label="Logout" onClick={handleLogout} />
                            
                            <div className="pt-4 border-t border-white/5 mt-4">
                                <MenuItem 
                                    icon={Trash2} 
                                    label="Delete Account" 
                                    isDestructive={true} 
                                    onClick={() => setIsDeleting(true)} 
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 text-center space-y-2">
                        <p className="text-[10px] text-white/20">Zii Version 1.1.0 (Africa)</p>
                        <p className="text-[10px] text-white/10">Made with ⚡ in Zimbabwe</p>
                    </div>
                </>
            )}

          </div>
        </div>
      )}

      {/* Terms Modal */}
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      
      {/* Share Modal */}
      {showShare && <ShareModal onClose={() => setShowShare(false)} />}

      {/* Auth Prompt Modal */}
      {showAuthPrompt && <AuthPromptModal onClose={() => setShowAuthPrompt(false)} />}
    </>
  );
};