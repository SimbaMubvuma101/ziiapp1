import React, { createContext, useContext, useEffect, useState } from 'react';
import { SplashLoader } from '../components/Loader';
import { FirestoreUser, PlatformSettings } from '../types';
import { getCurrencySymbol, getExchangeRate } from '../constants';
import { api } from '../utils/api';

interface AuthContextType {
  currentUser: any | null;
  userProfile: FirestoreUser | null;
  platformSettings: PlatformSettings;
  loading: boolean;
  logout: () => Promise<void>;
  isAdmin: boolean;
  userCountry: string;
  currencySymbol: string;
  exchangeRate: number;
  updateCountry: (countryCode: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const DEFAULT_SETTINGS: PlatformSettings = {
    maintenance_mode: false,
    welcome_bonus: 100,
    referral_bonus: 10,
    min_cashout: 5,
    banner_message: "Welcome to Zii!",
    banner_active: false
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<FirestoreUser | null>(null);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const [userCountry, setUserCountry] = useState<string>(() => {
      return localStorage.getItem('zii_user_country') || 'ZW';
  });

  const currencySymbol = getCurrencySymbol(userCountry);
  const exchangeRate = getExchangeRate(userCountry);

  const isAdmin = currentUser?.email === 'admin@zii.app' || !!userProfile?.isAdmin;

  const updateCountry = async (code: string) => {
      setUserCountry(code);
      localStorage.setItem('zii_user_country', code);

      if (currentUser) {
          try {
              await api.updateProfile({ country: code });
              await refreshUser();
          } catch (e) {
              console.error("Failed to update country", e);
          }
      }
  };

  const refreshUser = async () => {
    try {
      const user = await api.getCurrentUser();
      setCurrentUser(user);
      setUserProfile(user as FirestoreUser);
      if (user.country) {
        setUserCountry(user.country);
        localStorage.setItem('zii_user_country', user.country);
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if we have a token
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setLoading(false);
          return;
        }

        // Fetch current user
        const user = await api.getCurrentUser();
        setCurrentUser(user);
        setUserProfile(user as FirestoreUser);

        if (user.country) {
          setUserCountry(user.country);
          localStorage.setItem('zii_user_country', user.country);
        }

        // Fetch platform settings
        const settings = await api.getSettings() as PlatformSettings;
        setPlatformSettings(settings);
      } catch (err) {
        console.error('Auth initialization error:', err);
        api.clearToken();
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Poll for user updates every 30 seconds
    const interval = setInterval(() => {
      if (currentUser) {
        refreshUser();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const logout = async () => {
    api.clearToken();
    setCurrentUser(null);
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      userProfile, 
      platformSettings, 
      loading, 
      logout, 
      isAdmin, 
      userCountry, 
      currencySymbol, 
      exchangeRate, 
      updateCountry,
      refreshUser
    }}>
      {!loading ? children : <SplashLoader />}
    </AuthContext.Provider>
  );
};