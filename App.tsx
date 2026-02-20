
import React, { useState, useEffect } from 'react';
import { View, UserProfile, GymSettings } from './types';
import { auth, db } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { checkAndSendNotifications } from './services/notifications';
import LoginView from './views/Login';
import HomeView from './views/Home';
import DietView from './views/Diet';
import GoalsView from './views/Goals';
import MealsView from './views/Meals';
import SettingsView from './views/Settings';
import ProfileView from './views/Profile';
import ShoppingListView from './views/ShoppingList';
import DailyCheckIn from './components/DailyCheckIn';
import BottomBar from './components/BottomBar';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<View>(View.HOME);
  const [darkMode, setDarkMode] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  
  const [profile, setProfile] = useState<UserProfile>({
    name: 'Atleta',
    surname: '',
    birthDate: '',
    friends: [],
    weight: 0,
    height: 0,
    bmi: 0,
  });

  const [gymSettings, setGymSettings] = useState<GymSettings>({
    isActive: false,
    days: [],
    timeOfDay: 'morning'
  });

  // Gestione Notifiche
  useEffect(() => {
    // Controlla subito all'avvio
    if (isAuthenticated) {
      checkAndSendNotifications();
    }

    // Imposta un intervallo per controllare ogni minuto
    const intervalId = setInterval(() => {
      if (isAuthenticated) {
        checkAndSendNotifications();
      }
    }, 60000); // 60000ms = 1 minuto

    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthenticated(true);
        
        // Sincronizzazione Profilo da Firestore
        const userDocRef = db.collection('users').doc(user.uid);
        const docSnap = await userDocRef.get();
        
        if (docSnap.exists) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          // Crea profilo iniziale se nuovo utente
          const initialProfile: UserProfile = {
            name: user.displayName || 'Atleta',
            surname: '',
            birthDate: '',
            friends: [],
            weight: 0,
            height: 0,
            bmi: 0,
          };
          await userDocRef.set(initialProfile);
          setProfile(initialProfile);
        }

        // Sincronizzazione Impostazioni
        const settingsRef = db.collection('settings').doc(user.uid);
        settingsRef.onSnapshot((snap) => {
          if (snap.exists) {
            setGymSettings(snap.data() as GymSettings);
          }
        });

      } else {
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      setShowCheckIn(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-rose-50 flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin"></div>
        <p className="mt-4 font-black text-rose-500 uppercase tracking-widest text-xs">Sincronizzazione Rosyfit...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 text-slate-900 dark:text-gray-100 flex flex-col transition-colors duration-300">
      {showCheckIn && (
        <DailyCheckIn 
          onClose={() => setShowCheckIn(false)} 
          gymSettings={gymSettings}
        />
      )}

      <main className="flex-1 pb-20 overflow-y-auto">
        {activeTab === View.HOME && <HomeView profile={profile} />}
        {activeTab === View.DIET && <DietView gymSettings={gymSettings} />}
        {activeTab === View.SHOPPING && <ShoppingListView />}
        {activeTab === View.GOALS && <GoalsView profile={profile} />}
        {activeTab === View.MEALS && <MealsView gymSettings={gymSettings} />}
        {activeTab === View.SETTINGS && (
          <SettingsView 
            darkMode={darkMode} 
            setDarkMode={setDarkMode} 
            gymSettings={gymSettings}
            setGymSettings={async (val) => {
              setGymSettings(val);
              if (auth.currentUser) {
                await db.collection('settings').doc(auth.currentUser.uid).set(val);
              }
            }}
          />
        )}
        {activeTab === View.PROFILE && (
          <ProfileView 
            profile={profile} 
            setProfile={async (p) => {
              setProfile(p);
              if (auth.currentUser) {
                await db.collection('users').doc(auth.currentUser.uid).set(p);
              }
            }}
          />
        )}
      </main>

      <BottomBar activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};

export default App;
