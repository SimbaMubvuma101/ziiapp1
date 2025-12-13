import React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { TopBar } from './components/TopBar';

export const Layout: React.FC = () => {
  return (
    <div className="min-h-screen w-full flex justify-center bg-[#020617]">
      {/* Mobile container constraint */}
      <div className="w-full max-w-md bg-zii-bg min-h-screen relative shadow-2xl overflow-hidden flex flex-col">
        <TopBar />
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <Outlet />
        </div>
        <BottomNav />
      </div>
    </div>
  );
};