import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
          const response = await fetch(`/api/affiliates/validate?code=${refCode.toUpperCase()}`);
          
          if (response.ok) {
            const data = await response.json();
            const partnerName = data.name;
            
            const expiry = Date.now() + (7 * 24 * 60 * 60 * 1000);
            localStorage.setItem('zii_ref_code', refCode.toUpperCase());
            localStorage.setItem('zii_ref_expiry', expiry.toString());
            localStorage.setItem('zii_partner_code', refCode.toUpperCase()); // Store for registration
            
            setActivePartner(partnerName);

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
