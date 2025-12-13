import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Loader } from '../components/Loader';
import { FirestoreUser } from '../types';
import { getCurrencySymbol, getExchangeRate } from '../constants';

interface AuthContextType {
  currentUser: User | null;
  userProfile: FirestoreUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  isAdmin: boolean;
  userCountry: string;
  currencySymbol: string;
  exchangeRate: number;
  updateCountry: (countryCode: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<FirestoreUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Country Management
  const [userCountry, setUserCountry] = useState<string>(() => {
      // Default to stored country or ZW
      return localStorage.getItem('zii_user_country') || 'ZW';
  });
  
  // Ref to hold the latest userCountry value for listeners
  const userCountryRef = useRef(userCountry);

  // Sync ref with state
  useEffect(() => {
      userCountryRef.current = userCountry;
  }, [userCountry]);

  const currencySymbol = getCurrencySymbol(userCountry);
  const exchangeRate = getExchangeRate(userCountry);

  // Client-side admin check (for UI hiding/showing)
  const isAdmin = currentUser?.email === 'admin@zii.app' || !!userProfile?.isAdmin;

  // Function to update country (persists to DB if logged in, LS if guest)
  const updateCountry = async (code: string) => {
      setUserCountry(code);
      localStorage.setItem('zii_user_country', code);
      
      if (currentUser) {
          try {
              const userRef = doc(db, 'users', currentUser.uid);
              await updateDoc(userRef, { country: code });
          } catch (e) {
              console.error("Failed to update country in DB", e);
          }
      }
  };

  useEffect(() => {
    let unsubscribeFirestore: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        const userRef = doc(db, 'users', user.uid);
        
        // 1. SECURITY CRITICAL: Force Admin Flags for Root User
        if (user.email === 'admin@zii.app') {
             try {
                 await setDoc(userRef, { 
                     uid: user.uid,
                     email: user.email,
                     isAdmin: true,
                     role: 'admin',
                     last_login: serverTimestamp()
                 }, { merge: true });
             } catch (e) {
                 console.error("Failed to enforce admin permissions:", e);
             }
        }

        // 2. Ensure basic profile exists for everyone else
        try {
            const docSnap = await getDoc(userRef);
            if (!docSnap.exists()) {
                await setDoc(userRef, {
                    uid: user.uid,
                    name: user.displayName || 'User',
                    email: user.email,
                    balance: 100, // Welcome Bonus
                    winnings_balance: 0,
                    level: 1, // Gamification Start
                    xp: 0,
                    photo_file_name: null,
                    created_at: new Date().toISOString(),
                    isAdmin: user.email === 'admin@zii.app',
                    country: userCountry // Save the initially detected/selected country
                });
            } else {
                // If user exists, sync local state to DB state
                const data = docSnap.data();
                if (data.country) {
                    setUserCountry(data.country);
                    localStorage.setItem('zii_user_country', data.country);
                }
            }
        } catch (e) {
            console.error("Profile creation error:", e);
        }

        // 3. Real-time Profile Listener
        unsubscribeFirestore = onSnapshot(userRef, 
          (doc) => {
            if (doc.exists()) {
              const data = doc.data() as FirestoreUser;
              setUserProfile(data);
              
              // Ensure consistent country state if updated elsewhere
              // Use Ref to check against current state to prevent stale closure loop
              const currentRefValue = userCountryRef.current;
              
              if (data.country && data.country !== currentRefValue) {
                  setUserCountry(data.country);
                  localStorage.setItem('zii_user_country', data.country);
              }
            }
          },
          (error) => console.log("Auth Snapshot Error:", error)
        );

        setLoading(false);
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
        unsubscribeAuth();
        if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []); // Run once on mount

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, logout, isAdmin, userCountry, currencySymbol, exchangeRate, updateCountry }}>
      {!loading ? children : (
        <div className="min-h-screen bg-zii-bg flex items-center justify-center">
          <Loader size={40} className="text-zii-accent" />
        </div>
      )}
    </AuthContext.Provider>
  );
};