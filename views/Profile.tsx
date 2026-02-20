
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { auth } from '../services/firebase';

interface ProfileViewProps {
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ profile, setProfile }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(profile);

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    const bmi = editForm.height > 0 ? parseFloat((editForm.weight / (editForm.height * editForm.height)).toFixed(1)) : 0;
    const updated = { ...editForm, bmi };
    setProfile(updated);
    setIsEditing(false);
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex flex-col items-center mt-6">
        <div className="w-32 h-32 rounded-full bg-rose-500 flex items-center justify-center text-white text-5xl font-black shadow-xl border-4 border-white dark:border-slate-800">
          {profile.name[0]}
        </div>
        <h2 className="text-2xl font-black mt-4">{profile.name} {profile.surname}</h2>
        <p className="text-gray-500 text-sm">Livello: Fit Lover</p>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-black text-xs uppercase tracking-widest text-gray-400">I Tuoi Dati</h3>
          <button onClick={() => isEditing ? handleSave() : setIsEditing(true)} className="text-rose-500 font-bold text-xs uppercase">
            {isEditing ? 'Salva' : 'Modifica'}
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-slate-700/50">
            <span className="text-xs font-bold text-gray-400">Nome</span>
            {isEditing ? <input className="text-right bg-transparent outline-none font-bold text-sm" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /> : <span className="font-bold">{profile.name}</span>}
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-slate-700/50">
            <span className="text-xs font-bold text-gray-400">Peso (kg)</span>
            {isEditing ? <input type="number" className="text-right bg-transparent outline-none font-bold text-sm" value={editForm.weight} onChange={e => setEditForm({...editForm, weight: parseFloat(e.target.value) || 0})} /> : <span className="font-bold">{profile.weight || '--'} kg</span>}
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-slate-700/50">
            <span className="text-xs font-bold text-gray-400">Altezza (m)</span>
            {isEditing ? <input type="number" step="0.01" className="text-right bg-transparent outline-none font-bold text-sm" value={editForm.height} onChange={e => setEditForm({...editForm, height: parseFloat(e.target.value) || 0})} /> : <span className="font-bold">{profile.height || '--'} m</span>}
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-xs font-bold text-gray-400">BMI</span>
            <span className="font-black text-rose-500">{profile.bmi || '--'}</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700">
        <h3 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-4">Amici</h3>
        <p className="text-sm text-gray-400 italic">Ancora nessun amico collegato. Funzionalità in arrivo!</p>
      </div>

      <button onClick={handleLogout} className="w-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 py-5 rounded-2xl font-black uppercase tracking-widest text-xs active:scale-95 transition-all shadow-xl">Disconnetti Sessione</button>
    </div>
  );
};

export default ProfileView;
