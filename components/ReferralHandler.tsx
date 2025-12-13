import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Handshake } from 'lucide-react';

export const ReferralHandler: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activePartner, setActivePartner] = useState<string | null>(null);

  useEffect(() => {
    const checkReferral = async () => {
      const params = new URLSearchParams(location.search);
      const refCode = params.get('ref');

      if (refCode) {
        try {
          // 1. Validate Code in DB
          const q = query(collection(db, "affiliates"), where("code", "==", refCode.toUpperCase()));
          const snapshot = await getDocs(q);

          if (!snapshot.empty) {
            const partnerName = snapshot.docs[0].data().name;
            
            // 2. Set 7-Day Attribution Cookie (LocalStorage)
            const expiry = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 Days
            localStorage.setItem('zii_ref_code', refCode.toUpperCase());
            localStorage.setItem('zii_ref_expiry', expiry.toString());
            
            setActivePartner(partnerName);

            // 3. Clean URL (remove ?ref=... to look clean)
            // We use history replacement to keep the current route but drop params
            const newSearch = new URLSearchParams(location.search);
            newSearch.delete('ref');
            navigate({
                pathname: location.pathname,
                search: newSearch.toString()
            }, { replace: true });
          }
        } catch (e) {
          console.error("Referral check failed", e);
        }
      }
    };

    checkReferral();
  }, [location, navigate]);

  if (!activePartner) return null;

  // Temporary Toast Notification
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-top-4 fade-in duration-500 pointer-events-none">
       <div className="bg-zii-accent text-black px-4 py-3 rounded-full shadow-xl flex items-center gap-2 border-2 border-white/20">
          <Handshake size={18} strokeWidth={2.5} />
          <div>
              <p className="text-xs font-bold leading-none">Supporting {activePartner}</p>
              <p className="text-[9px] font-medium opacity-80 leading-none mt-0.5">Bets attribute to them for 7 days.</p>
          </div>
       </div>
    </div>
  );
};