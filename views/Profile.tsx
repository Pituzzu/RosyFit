
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../types';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, doc, getDoc } from 'firebase/firestore';

interface ProfileViewProps {
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
  onViewFriend: (friendId: string) => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ profile, setProfile, onViewFriend }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = auth.currentUser?.email === 'matteopituzzu@gmail.com';

  useEffect(() => {
    if (isAdmin) {
      const fetchAllUsers = async () => {
        try {
          const q = query(collection(db, 'users'));
          const snap = await getDocs(q);
          const usersList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // Sort by creation date if possible, or just by name
          setAllUsers(usersList);
        } catch (err) {
          console.error("Error fetching all users:", err);
        }
      };
      fetchAllUsers();
    }
  }, [isAdmin]);

  // Reset editForm when toggling editing
  useEffect(() => {
    if (!isEditing) {
      setEditForm({});
    }
  }, [isEditing]);

  useEffect(() => {
    const fetchRequests = async () => {
      if (profile.friendRequests && profile.friendRequests.length > 0) {
        const requests = [];
        for (const uid of profile.friendRequests) {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            requests.push({ id: uid, ...userDoc.data() });
          }
        }
        setPendingRequests(requests);
      } else {
        setPendingRequests([]);
      }
    };
    fetchRequests();
  }, [profile.friendRequests]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    const merged = { ...profile, ...editForm };
    const weight = merged.weight || 0;
    const height = merged.height || 0;
    const bmi = height > 0 ? parseFloat((weight / (height * height)).toFixed(1)) : 0;
    const updated = { ...merged, bmi };
    setProfile(updated);
    setIsEditing(false);
  };

  const handleSendRequest = async () => {
    if (!inviteCodeInput || !auth.currentUser) return;
    setIsSendingRequest(true);
    try {
      const q = query(collection(db, 'users'), where('inviteCode', '==', inviteCodeInput.toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        alert('Codice invito non trovato');
        return;
      }
      const targetUser = snap.docs[0];
      const targetUserId = targetUser.id;

      if (targetUserId === auth.currentUser.uid) {
        alert('Non puoi aggiungere te stesso');
        return;
      }

      if (profile.friends.some(f => f.id === targetUserId)) {
        alert('Siete già amici');
        return;
      }

      await updateDoc(doc(db, 'users', targetUserId), {
        friendRequests: arrayUnion(auth.currentUser.uid)
      });
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        sentRequests: arrayUnion(targetUserId)
      });

      // Create notification for the target user
      await addDoc(collection(db, 'notifications'), {
        userId: targetUserId,
        fromUserId: auth.currentUser.uid,
        fromUserName: profile.name,
        type: 'friend_request',
        message: `${profile.name} ti ha inviato una richiesta di amicizia.`,
        read: false,
        handled: false,
        timestamp: new Date()
      });

      alert('Richiesta inviata!');
      setInviteCodeInput('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const updatedProfile = { ...profile, avatar: base64String };
      setProfile(updatedProfile);
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex flex-col items-center mt-6">
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="relative group cursor-pointer"
        >
          <div className="w-32 h-32 rounded-full bg-emerald-500 flex items-center justify-center text-white text-5xl font-black shadow-xl border-4 border-white dark:border-slate-800 overflow-hidden">
            {profile.avatar ? (
              <img src={profile.avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              profile.name[0]
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          <div className="absolute bottom-0 right-0 bg-white dark:bg-slate-800 p-2 rounded-full shadow-lg border border-gray-100 dark:border-slate-700 group-hover:scale-110 transition-transform">
            📸
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            className="hidden" 
          />
        </div>
        <h2 className="text-2xl font-black mt-4">{profile.name} {profile.surname}</h2>
        <p className="text-gray-500 text-sm">Livello: Fit Lover 🥑</p>
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
            {isEditing ? (
              <input 
                className="text-right bg-transparent outline-none font-bold text-sm" 
                placeholder={profile.name}
                value={editForm.name ?? ''} 
                onChange={e => setEditForm({...editForm, name: e.target.value})} 
              />
            ) : (
              <span className="font-bold">{profile.name}</span>
            )}
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-slate-700/50">
            <span className="text-xs font-bold text-gray-400">Peso (kg)</span>
            {isEditing ? (
              <input 
                type="number" 
                className="text-right bg-transparent outline-none font-bold text-sm" 
                placeholder={String(profile.weight || '')}
                value={editForm.weight ?? ''} 
                onChange={e => setEditForm({...editForm, weight: e.target.value === '' ? undefined : parseFloat(e.target.value)})} 
              />
            ) : (
              <span className="font-bold">{profile.weight || '--'} kg</span>
            )}
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-slate-700/50">
            <span className="text-xs font-bold text-gray-400">Peso Obiettivo (kg)</span>
            {isEditing ? (
              <input 
                type="number" 
                className="text-right bg-transparent outline-none font-bold text-sm" 
                placeholder={String(profile.targetWeight || '')}
                value={editForm.targetWeight ?? ''} 
                onChange={e => setEditForm({...editForm, targetWeight: e.target.value === '' ? undefined : parseFloat(e.target.value)})} 
              />
            ) : (
              <span className="font-bold">{profile.targetWeight || '--'} kg</span>
            )}
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-slate-700/50">
            <span className="text-xs font-bold text-gray-400">Obiettivo Acqua (L)</span>
            {isEditing ? (
              <input 
                type="number" 
                step="0.25" 
                className="text-right bg-transparent outline-none font-bold text-sm" 
                placeholder={String(profile.waterGoal || 2.5)}
                value={editForm.waterGoal ?? ''} 
                onChange={e => setEditForm({...editForm, waterGoal: e.target.value === '' ? undefined : parseFloat(e.target.value)})} 
              />
            ) : (
              <span className="font-bold">{profile.waterGoal || 2.5} L</span>
            )}
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-slate-700/50">
            <span className="text-xs font-bold text-gray-400">Obiettivo Kcal</span>
            {isEditing ? (
              <input 
                type="number" 
                className="text-right bg-transparent outline-none font-bold text-sm" 
                placeholder={String(profile.dailyCalories || 2000)}
                value={editForm.dailyCalories ?? ''} 
                onChange={e => setEditForm({...editForm, dailyCalories: e.target.value === '' ? undefined : parseInt(e.target.value)})} 
              />
            ) : (
              <span className="font-bold">{profile.dailyCalories || 2000} kcal</span>
            )}
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-slate-700/50">
            <span className="text-xs font-bold text-gray-400">Dieta Pubblica</span>
            {isEditing ? (
              <button 
                onClick={() => setEditForm({...editForm, isDietPublic: !(editForm.isDietPublic ?? profile.isDietPublic)})}
                className={`w-10 h-5 rounded-full transition-colors relative ${(editForm.isDietPublic ?? profile.isDietPublic) ? 'bg-emerald-500' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${(editForm.isDietPublic ?? profile.isDietPublic) ? 'right-1' : 'left-1'}`} />
              </button>
            ) : (
              <span className={`text-[10px] font-black uppercase tracking-widest ${profile.isDietPublic ? 'text-emerald-500' : 'text-gray-400'}`}>
                {profile.isDietPublic ? 'Sì' : 'No'}
              </span>
            )}
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-slate-700/50">
            <span className="text-xs font-bold text-gray-400">Altezza (m)</span>
            {isEditing ? (
              <input 
                type="number" 
                step="0.01" 
                className="text-right bg-transparent outline-none font-bold text-sm" 
                placeholder={String(profile.height || '')}
                value={editForm.height ?? ''} 
                onChange={e => setEditForm({...editForm, height: e.target.value === '' ? undefined : parseFloat(e.target.value)})} 
              />
            ) : (
              <span className="font-bold">{profile.height || '--'} m</span>
            )}
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-slate-700/50">
            <span className="text-xs font-bold text-gray-400">Inizio Dieta</span>
            {isEditing ? (
              <input 
                type="date" 
                className="text-right bg-transparent outline-none font-bold text-sm" 
                value={editForm.dietStartDate ?? profile.dietStartDate ?? ''} 
                onChange={e => setEditForm({...editForm, dietStartDate: e.target.value})} 
              />
            ) : (
              <span className="font-bold">{profile.dietStartDate ? new Date(profile.dietStartDate).toLocaleDateString('it-IT') : '--'}</span>
            )}
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-xs font-bold text-gray-400">BMI</span>
            <span className="font-black text-rose-500">{profile.bmi || '--'}</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700">
        <h3 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-4">Il Tuo Codice Invito</h3>
        <div className="flex items-center justify-between bg-rose-50 dark:bg-rose-900/20 p-5 rounded-3xl border border-rose-100 dark:border-rose-900/30">
          <span className="font-black text-2xl tracking-[0.2em] text-rose-600 dark:text-rose-400">{profile.inviteCode}</span>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(profile.inviteCode || '');
              alert('Codice copiato!');
            }}
            className="bg-white dark:bg-slate-800 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-rose-500 shadow-sm hover:scale-105 transition-all"
          >
            Copia
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700">
        <h3 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-4">Aggiungi Amico</h3>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Codice Invito" 
            value={inviteCodeInput}
            onChange={e => setInviteCodeInput(e.target.value.toUpperCase())}
            className="flex-1 bg-gray-50 dark:bg-slate-900 p-4 rounded-2xl text-sm font-bold outline-none border border-transparent focus:border-rose-500"
          />
          <button 
            onClick={handleSendRequest}
            disabled={isSendingRequest || !inviteCodeInput}
            className="bg-rose-500 text-white px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50"
          >
            Invia
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700">
        <h3 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-4">Amici</h3>
        {profile.friends && profile.friends.length > 0 ? (
          <div className="space-y-4">
            {profile.friends.map(friend => (
              <div 
                key={friend.id} 
                onClick={() => onViewFriend(friend.id)}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900 rounded-2xl cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center text-rose-500 font-black overflow-hidden">
                    {friend.avatar ? (
                      <img src={friend.avatar} alt={friend.name} className="w-full h-full object-cover" />
                    ) : (
                      friend.name[0]
                    )}
                  </div>
                  <span className="font-bold text-sm">{friend.name}</span>
                </div>
                <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Vedi Dieta →</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Ancora nessun amico collegato.</p>
        )}
      </div>

      {isAdmin && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700">
          <h3 className="font-black text-xs uppercase tracking-widest text-emerald-500 mb-4">Tutti gli Utenti (Admin)</h3>
          <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
            {allUsers.map(user => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-500 overflow-hidden">
                    {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : (user.name ? user.name[0] : '?')}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">{user.name} {user.surname}</span>
                    <span className="text-[10px] text-gray-400">{user.email}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={handleLogout} className="w-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 py-5 rounded-2xl font-black uppercase tracking-widest text-xs active:scale-95 transition-all shadow-xl">Disconnetti Sessione</button>
    </div>
  );
};

export default ProfileView;
