import React, { useState } from 'react';
import { X, Copy, Share2, Gift, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ShareModalProps {
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ onClose }) => {
  const [copied, setCopied] = useState(false);
  const { currentUser } = useAuth();
  
  // Use UID for reliable database lookups. 
  // We use window.location.href to ensure correct base URL even in sub-directories
  const referralCode = currentUser?.uid;
  const baseUrl = window.location.href.split('#')[0];
  // Ensure no trailing slash duplication before hash
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  
  const referralLink = `${cleanBase}/#/register?ref=${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Join Zii',
      text: 'Play & Win on Zii! Use my link to get started.',
      url: referralLink,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Error sharing', err);
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      {/* Click backdrop to close */}
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <div className="w-full max-w-sm bg-zii-card border border-white/10 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 relative z-10 text-center">
        
        <button onClick={onClose} className="absolute right-4 top-4 p-2 text-white/40 hover:text-white rounded-full transition-colors">
          <X size={20} />
        </button>

        <div className="w-16 h-16 bg-gradient-to-tr from-zii-accent to-zii-highlight rounded-full mx-auto flex items-center justify-center mb-6 shadow-lg shadow-zii-accent/20 ring-1 ring-white/10">
           <Gift size={32} className="text-black ml-0.5" strokeWidth={2.5} />
        </div>

        <h3 className="text-xl font-bold text-white mb-2">Invite Friends</h3>
        <p className="text-white/60 text-sm mb-6 leading-relaxed px-2">
          Share your unique link. You'll earn <span className="text-zii-accent font-bold">10 Zii Coins</span> for every friend who signs up!
        </p>

        <div className="bg-black/30 border border-white/10 rounded-xl p-3 flex items-center justify-between mb-6 group cursor-pointer" onClick={handleCopy}>
           <code className="text-xs text-white/70 truncate mr-2 font-mono ml-2">{referralLink}</code>
           <button className="p-2 bg-white/5 group-hover:bg-white/10 rounded-lg text-white transition-colors">
              {copied ? <Check size={16} className="text-zii-accent" /> : <Copy size={16} />}
           </button>
        </div>

        <button 
          onClick={handleShare}
          className="w-full bg-white text-black font-bold py-3.5 rounded-xl hover:bg-white/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/5"
        >
          <Share2 size={18} /> Share Link
        </button>
      </div>
    </div>
  );
};