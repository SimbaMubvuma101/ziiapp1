
import React from 'react';
import { X, AlertTriangle, AlertCircle, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ErrorModalProps {
  title?: string;
  message: string;
  onClose: () => void;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({ 
  title = "Oops!", 
  message, 
  onClose 
}) => {
  const navigate = useNavigate();
  const isInsufficientBalance = message.toLowerCase().includes('insufficient balance');

  const handleAddTokens = () => {
    onClose();
    navigate('/wallet');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <div className="w-full max-w-sm bg-zii-card border border-red-500/20 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 relative z-10 text-center">
        
        <button onClick={onClose} className="absolute right-4 top-4 text-white/30 hover:text-white transition-colors">
          <X size={20} />
        </button>

        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
          <AlertCircle size={32} className="text-red-500" strokeWidth={2.5} />
        </div>

        <h2 className="text-2xl font-black text-white mb-2 tracking-tight">{title}</h2>
        <p className="text-white/60 mb-8 leading-relaxed text-sm">
          {message}
        </p>

        <div className="space-y-3">
          {isInsufficientBalance && (
            <button 
              onClick={handleAddTokens}
              className="w-full bg-zii-accent text-black font-bold py-4 rounded-xl hover:bg-white active:scale-[0.98] transition-all shadow-lg shadow-zii-accent/20 flex items-center justify-center gap-2"
            >
              <Plus size={20} strokeWidth={3} /> Add Tokens
            </button>
          )}
          
          <button 
            onClick={onClose}
            className={`w-full ${isInsufficientBalance ? 'bg-white/5 text-white/70 hover:bg-white/10' : 'bg-white text-black hover:bg-white/90'} font-bold py-4 rounded-xl active:scale-[0.98] transition-all shadow-lg shadow-white/5`}
          >
            {isInsufficientBalance ? 'Maybe Later' : 'Got It'}
          </button>
        </div>
      </div>
    </div>
  );
};
