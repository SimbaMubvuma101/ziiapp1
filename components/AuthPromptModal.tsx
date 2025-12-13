import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, LogIn } from 'lucide-react';

interface AuthPromptModalProps {
  onClose: () => void;
}

export const AuthPromptModal: React.FC<AuthPromptModalProps> = ({ onClose }) => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="w-full max-w-sm bg-[#0F172A] border border-white/10 rounded-3xl p-6 shadow-2xl relative z-10 text-center animate-in zoom-in-95 slide-in-from-bottom-4">
        <button onClick={onClose} className="absolute right-4 top-4 text-white/30 hover:text-white transition-colors">
          <X size={20} />
        </button>
        
        <div className="w-16 h-16 bg-zii-accent/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-zii-accent/20 shadow-[0_0_15px_rgba(39,241,199,0.1)]">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-zii-accent" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 4L20 4L4 20L20 20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>

        <h2 className="text-2xl font-black text-white mb-2">Join Zii</h2>
        <p className="text-white/50 text-sm mb-8 px-4 leading-relaxed">
            Create an account to place predictions, win real cash, and track your history.
        </p>

        <button 
            onClick={() => navigate('/register')}
            className="w-full bg-zii-accent text-black font-bold py-4 rounded-xl mb-3 hover:bg-white transition-colors active:scale-[0.98]"
        >
            Create Account
        </button>

        <button 
            onClick={() => navigate('/login')}
            className="w-full bg-white/5 text-white font-bold py-4 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
        >
            <LogIn size={18} /> Sign In
        </button>
      </div>
    </div>
  );
};