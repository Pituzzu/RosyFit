
import React, { useState, useEffect } from 'react';
import { UserProfile, View } from '../types';
import { db, auth } from '../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import DietView from './Diet';

interface FriendProfileViewProps {
  friendId: string;
  myProfile: UserProfile;
  onBack: () => void;
}

const FriendProfileView: React.FC<FriendProfileViewProps> = ({ friendId, myProfile, onBack }) => {
  const [friendProfile, setFriendProfile] = useState<UserProfile | null>(null);
  const [showDiet, setShowDiet] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', friendId), (snap) => {
      if (snap.exists()) {
        setFriendProfile(snap.data() as UserProfile);
      }
    });
    return () => unsub();
  }, [friendId]);

  if (!friendProfile) return <div className="p-8 text-center">Caricamento profilo...</div>;

  const isFriend = myProfile.friends.some(f => f.id === friendId);
  const canSeeDiet = isFriend && friendProfile.isDietPublic;

  if (showDiet && canSeeDiet) {
    return (
      <DietView 
        gymSettings={{ isActive: false, days: [], timeOfDay: 'morning' }} // Not needed for read-only
        profile={friendProfile}
        readOnly={true}
        onBack={() => setShowDiet(false)}
      />
    );
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      <button onClick={onBack} className="text-rose-500 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
        ← Torna Indietro
      </button>

      <div className="flex flex-col items-center mt-6">
        <div className="w-32 h-32 rounded-full bg-rose-500 flex items-center justify-center text-white text-5xl font-black shadow-xl border-4 border-white dark:border-slate-800 overflow-hidden">
          {friendProfile.avatar ? (
            <img src={friendProfile.avatar} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            friendProfile.name[0]
          )}
        </div>
        <h2 className="text-2xl font-black mt-4">{friendProfile.name} {friendProfile.surname}</h2>
        <p className="text-gray-500 text-sm">Livello: Fit Lover 🥑</p>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700">
        <h3 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-6">Dati Pubblici</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-slate-700/50">
            <span className="text-xs font-bold text-gray-400">BMI</span>
            <span className="font-black text-rose-500">{friendProfile.bmi || '--'}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-slate-700/50">
            <span className="text-xs font-bold text-gray-400">Streak</span>
            <span className="font-black text-emerald-500">{friendProfile.streak || 0} 🔥</span>
          </div>
        </div>
      </div>

      {canSeeDiet ? (
        <button 
          onClick={() => setShowDiet(true)}
          className="w-full bg-rose-500 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs active:scale-95 transition-all shadow-xl"
        >
          Vedi Dieta Settimanale
        </button>
      ) : (
        <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-[2.5rem] border border-amber-100 dark:border-amber-900/30 text-center">
          <p className="text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-widest">
            {!isFriend ? "Devi essere amico per vedere la dieta" : "L'utente ha reso la dieta privata"}
          </p>
        </div>
      )}
    </div>
  );
};

export default FriendProfileView;
