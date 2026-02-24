
import React, { useState, useEffect } from 'react';
import { View, UserProfile, GymSettings } from './types';
import { auth, db } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { sanitizeForFirestore } from './services/utils';
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
  const [selectedFriendProfile, setSelectedFriendProfile] = useState<UserProfile | null>(null);
  
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

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthenticated(true);
        
        // Sincronizzazione Profilo da Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);
        
        if (docSnap.exists()) {
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
          await setDoc(userDocRef, initialProfile);
          setProfile(initialProfile);
        }

        // Sincronizzazione Impostazioni
        const settingsRef = doc(db, 'settings', user.uid);
        onSnapshot(settingsRef, (snap) => {
          if (snap.exists()) {
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
        {activeTab === View.DIET && (
          <DietView 
            gymSettings={gymSettings} 
            profile={profile}
            setProfile={async (p) => {
              setProfile(p);
              if (auth.currentUser) {
                await setDoc(doc(db, 'users', auth.currentUser.uid), sanitizeForFirestore(p));
              }
            }}
          />
        )}
        {activeTab === View.SHOPPING && <ShoppingListView />}
        {activeTab === View.GOALS && <GoalsView profile={profile} />}
        {activeTab === View.MEALS && <MealsView gymSettings={gymSettings} profile={profile} />}
        {activeTab === View.SETTINGS && (
          <SettingsView 
            darkMode={darkMode} 
            setDarkMode={setDarkMode} 
            gymSettings={gymSettings}
            setGymSettings={async (val) => {
              setGymSettings(val);
              if (auth.currentUser) {
                await setDoc(doc(db, 'settings', auth.currentUser.uid), sanitizeForFirestore(val));
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
                await setDoc(doc(db, 'users', auth.currentUser.uid), sanitizeForFirestore(p));
              }
            }}
            onViewFriend={async (friendId) => {
              const friendDoc = await getDoc(doc(db, 'users', friendId));
              if (friendDoc.exists()) {
                setSelectedFriendProfile(friendDoc.data() as UserProfile);
                setActiveTab(View.FRIEND_PROFILE);
              }
            }}
          />
        )}
        {activeTab === View.FRIEND_PROFILE && selectedFriendProfile && (
          <DietView 
            gymSettings={gymSettings}
            profile={selectedFriendProfile}
            readOnly={true}
            onBack={() => setActiveTab(View.PROFILE)}
          />
        )}
      </main>

      <BottomBar activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};

export default App;
