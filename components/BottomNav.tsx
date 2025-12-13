import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Activity, Wallet } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const navItems = [
    { to: '/earn', icon: Home, label: 'Earn' },
    { to: '/active', icon: Activity, label: 'Active' },
    { to: '/wallet', icon: Wallet, label: 'Wallet' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-zii-bg/95 backdrop-blur-xl border-t border-white/5 pb-safe">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? 'text-zii-accent' : 'text-white/40 hover:text-white/60'
              }`
            }
          >
            <Icon size={20} strokeWidth={2.5} />
            <span className="text-[10px] font-medium tracking-wide">{label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
};