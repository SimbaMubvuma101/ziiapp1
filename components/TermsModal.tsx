import React from 'react';
import { X, Shield, FileText, Info } from 'lucide-react';

interface TermsModalProps {
  onClose: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      {/* Click backdrop to close */}
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <div className="w-full max-w-md bg-zii-card border border-white/10 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 relative z-10 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/5 bg-zii-card rounded-t-3xl sticky top-0 z-20">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-zii-accent">
                <FileText size={20} />
             </div>
             <div>
                <h3 className="text-lg font-bold text-white">How Zii Works</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">Platform Rules & Model</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-white/40 hover:text-white rounded-full hover:bg-white/5 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 space-y-6 text-white/80 text-sm leading-relaxed no-scrollbar">
          
          <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-xl flex gap-3">
             <Info size={20} className="text-blue-400 shrink-0 mt-0.5" />
             <p className="text-xs text-blue-100/70">
                <strong className="text-blue-200">Zii is a Social Prediction Exchange.</strong> We do not take positions against you. We simply facilitate a fair market between users.
             </p>
          </div>

          <section>
            <h4 className="font-bold text-white mb-2 text-base">1. Peer-to-Peer Model (Parimutuel)</h4>
            <p className="text-white/60 mb-2">When you place a prediction on Zii, you are not trading against "The House". You are trading with other users who have an opposing view.</p>
            <p className="text-white/60">
                All entry fees for a specific event go into a locked <strong>Event Pool</strong>. Zii does not own this money; it belongs to the participants.
            </p>
          </section>

          <section>
            <h4 className="font-bold text-white mb-2 text-base">2. How We Make Money</h4>
            <p className="text-white/60 mb-2">Since we don't profit when you lose, our business model is strictly commission-based:</p>
            <ul className="list-disc pl-4 space-y-1 text-white/60">
                <li><strong>5% Pool Commission:</strong> Taken from the total Event Pool to cover operational costs (servers, data feeds, moderation). The remaining 95% is distributed entirely to winners.</li>
                <li><strong>10% Cashout Fee:</strong> Applied when withdrawing winnings to cover mobile money transaction charges and banking gateway fees.</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-white mb-2 text-base">3. Payouts & Odds</h4>
            <p className="text-white/60 mb-2">
                Because users set the market, odds are dynamic.
            </p>
            <p className="text-white/60">
                <span className="text-zii-accent">Example:</span> If 80% of money is on "Yes" and 20% is on "No":
                <br/>- "Yes" winners get a small return (safe outcome).
                <br/>- "No" winners get a huge return (risky outcome).
                <br/>
                Winners are essentially paid by the users who predicted incorrectly.
            </p>
          </section>

          <section>
            <h4 className="font-bold text-white mb-2 text-base">4. Platform Role</h4>
            <p className="text-white/60">
                Zii acts solely as a technology provider and arbitrator. We resolve events based on verifiable public data (news, official reports). Our decision on outcomes is final to ensure the integrity of the pool.
            </p>
          </section>

          <section>
            <h4 className="font-bold text-white mb-2 text-base">5. Risk Disclaimer</h4>
            <p className="text-white/60">
                Prediction markets involve risk. You can lose your entry fee if your prediction is incorrect. Past performance is not indicative of future results. Only participate with what you can afford to lose.
            </p>
          </section>

          <div className="p-4 bg-white/5 rounded-xl border border-white/5 mt-4">
             <div className="flex items-start gap-3">
                <Shield size={16} className="text-zii-accent mt-1 shrink-0" />
                <p className="text-xs text-white/50">By using Zii, you acknowledge that you are participating in a skill-based social exchange and agree to these terms.</p>
             </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-zii-bg/50 rounded-b-3xl">
           <button 
             onClick={onClose}
             className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-white/90 active:scale-[0.98] transition-all"
           >
             I Understand the Risks
           </button>
        </div>
      </div>
    </div>
  );
};