import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './Layout';
import { Landing } from './pages/Landing';
import { Feed } from './pages/Feed';
import { Active } from './pages/Active';
import { Wallet } from './pages/Wallet';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { AdminEngine } from './pages/AdminEngine';
import { CreatorInvitePage } from './pages/CreatorInvite';
import { CreatorStudio } from './pages/CreatorStudio';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ReferralHandler } from './components/ReferralHandler';

const App: React.FC = () => {
  return (
    <HashRouter>
      <AuthProvider>
        <ReferralHandler />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminEngine />
            </ProtectedRoute>
          } />
          <Route path="/hq" element={
            <ProtectedRoute>
              <AdminEngine />
            </ProtectedRoute>
          } />

          {/* Creator Routes */}
          <Route path="/creator/invite" element={<CreatorInvitePage />} />
          <Route path="/creator/studio" element={
            <ProtectedRoute>
              <CreatorStudio />
            </ProtectedRoute>
          } />
          <Route path="/:creatorname" element={<CreatorInvitePage />} />

          {/* Public App Routes (Components handle guest state internally) */}
          <Route element={<Layout />}>
            <Route path="/earn" element={<Feed />} />
            <Route path="/active" element={<Active />} />
            <Route path="/wallet" element={<Wallet />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
};

export default App;