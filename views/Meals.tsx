
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GymSettings, UserProfile } from '../types';
import { auth, db } from '../services/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { compressImage } from '../services/utils';

interface Meal {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  type: string;
  image: string;
  time: string;
  description: string;
  timestamp: Date;
  likes?: string[];
  nutrition?: {
    calories: number;
    carbs: number;
    protein: number;
    fats: number;
  };
  isAnalyzing?: boolean;
}

interface MealsViewProps {
  gymSettings: GymSettings;
  profile: UserProfile;
}

const MealsView: React.FC<MealsViewProps> = ({ gymSettings, profile }) => {
  const [viewMode, setViewMode] = useState<'personal' | 'friends'>('personal');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('Tutti');
  const [dateFilter, setDateFilter] = useState<string>('Sempre');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState('Pasto Fit');
  const [uploadDescription, setUploadDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = ['Tutti', 'Colazione', 'Spuntino', 'Pranzo', 'Cena', 'Pasto Fit', 'Cheat Meal', 'Altro'];
  const uploadCategories = ['Colazione', 'Spuntino', 'Pranzo', 'Cena', 'Pasto Fit', 'Cheat Meal', 'Altro'];
  const dateOptions = ['Sempre', 'Oggi', 'Ultimi 7 giorni'];

  // ... (useEffect remains same)

  const filteredMeals = useMemo(() => {
    let result = meals;

    // Filter by view mode
    if (viewMode === 'personal') {
      result = result.filter(m => m.userId === auth.currentUser?.uid);
    } else {
      result = result.filter(m => m.userId !== auth.currentUser?.uid);
    }

    // Filter by category
    if (categoryFilter !== 'Tutti') {
      result = result.filter(m => m.type === categoryFilter);
    }

    // Filter by date
    const now = new Date();
    if (dateFilter === 'Oggi') {
      result = result.filter(m => {
        const mDate = new Date(m.timestamp);
        return mDate.toDateString() === now.toDateString();
      });
    } else if (dateFilter === 'Ultimi 7 giorni') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      result = result.filter(m => new Date(m.timestamp) >= sevenDaysAgo);
    }

    return result;
  }, [meals, viewMode, categoryFilter, dateFilter]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setShowUploadModal(true);
    // Reset input so same file can be selected again if cancelled
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmUpload = async () => {
    if (!uploadFile || !auth.currentUser) return;
    setIsUploading(true);
    setShowUploadModal(false);

    try {
      const compressedBase64 = await compressImage(uploadFile, 800, 0.6);

      await addDoc(collection(db, 'meals'), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Atleta',
        userAvatar: profile.avatar || '',
        type: uploadCategory,
        image: compressedBase64,
        time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        description: uploadDescription || 'Pasto senza descrizione',
        timestamp: Timestamp.now()
      });
      
      setUploadFile(null);
      setUploadDescription('');
      setUploadCategory('Pasto Fit');
    } catch (error) {
      console.error("Errore durante il caricamento:", error);
      alert("Errore durante il caricamento dell'immagine.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLike = async (meal: Meal) => {
    if (!auth.currentUser || meal.userId === auth.currentUser.uid) return;

    const { updateDoc, doc: firestoreDoc, arrayUnion, arrayRemove, addDoc, collection, Timestamp } = await import('firebase/firestore');
    const postRef = firestoreDoc(db, 'meals', meal.id);
    const isLiked = meal.likes?.includes(auth.currentUser.uid);

    try {
      if (isLiked) {
        await updateDoc(postRef, {
          likes: arrayRemove(auth.currentUser.uid)
        });
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(auth.currentUser.uid)
        });

        // Crea notifica
        await addDoc(collection(db, 'notifications'), {
          userId: meal.userId,
          fromUserId: auth.currentUser.uid,
          fromUserName: profile.name,
          type: 'like',
          message: `${profile.name} ha messo mi piace al tuo pasto!`,
          read: false,
          timestamp: Timestamp.now(),
          link: meal.id
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteMeal = async (mealId: string) => {
    if (!window.confirm("Sei sicuro di voler eliminare questo pasto?")) return;
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'meals', mealId));
    } catch (error) {
      console.error("Errore durante l'eliminazione:", error);
      alert("Errore durante l'eliminazione del pasto.");
    }
  };

  return (
    <div className="p-4 space-y-6 pb-20">
      <h1 className="text-3xl font-black tracking-tighter">Diario Foto</h1>

      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-2xl">
        <button 
          onClick={() => setViewMode('personal')}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'personal' ? 'bg-white dark:bg-slate-700 text-rose-500 shadow-sm' : 'text-gray-400'}`}
        >
          I Miei Pasti
        </button>
        <button 
          onClick={() => setViewMode('friends')}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'friends' ? 'bg-white dark:bg-slate-700 text-rose-500 shadow-sm' : 'text-gray-400'}`}
        >
          Amici
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <span className="text-[8px] font-black uppercase text-gray-400 flex-shrink-0">Categoria:</span>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[9px] font-bold transition-all ${categoryFilter === cat ? 'bg-rose-500 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500'}`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <span className="text-[8px] font-black uppercase text-gray-400 flex-shrink-0">Periodo:</span>
          {dateOptions.map(opt => (
            <button
              key={opt}
              onClick={() => setDateFilter(opt)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[9px] font-bold transition-all ${dateFilter === opt ? 'bg-indigo-500 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500'}`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <input 
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      <button 
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="w-full py-8 border-2 border-dashed border-rose-200 dark:border-slate-700 rounded-[2.5rem] flex flex-col items-center text-rose-400 active:bg-rose-50 dark:active:bg-slate-800 transition-colors disabled:opacity-50"
      >
        {isUploading ? (
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-2"></div>
            <span className="text-[10px] font-black uppercase tracking-widest">Compressione in corso...</span>
          </div>
        ) : (
          <>
            <span className="text-3xl mb-2">📸</span>
            <span className="text-[10px] font-black uppercase tracking-widest">Carica Foto Pasto</span>
          </>
        )}
      </button>

      <div className="space-y-8">
        {filteredMeals.map((meal) => (
          <div key={meal.id} className="relative bg-white dark:bg-slate-800 rounded-[3rem] overflow-hidden shadow-sm border border-gray-100 dark:border-slate-700">
             <div className="absolute top-4 left-4 z-10 bg-black/40 backdrop-blur-md text-white text-[8px] font-black px-4 py-2 rounded-full uppercase tracking-widest flex items-center gap-2">
               <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center overflow-hidden border border-white/20">
                 {meal.userAvatar ? (
                   <img src={meal.userAvatar} alt={meal.userName} className="w-full h-full object-cover" />
                 ) : (
                   <span className="text-[6px]">{meal.userName?.[0]}</span>
                 )}
               </div>
               {meal.userName} • {meal.time} • {meal.type}
             </div>
             <img src={meal.image} className="w-full h-96 object-cover" alt="Meal" />
             <div className="p-6">
                <p className="font-bold text-lg mb-4">{meal.description}</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleLike(meal)}
                    disabled={meal.userId === auth.currentUser?.uid}
                    className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${
                      meal.likes?.includes(auth.currentUser?.uid) 
                        ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' 
                        : 'bg-gray-50 dark:bg-slate-700 text-gray-400'
                    } ${meal.userId === auth.currentUser?.uid ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                  >
                    <span>{meal.likes?.includes(auth.currentUser?.uid) ? '❤️' : '🤍'}</span>
                    <span>{meal.likes?.length || 0}</span>
                  </button>
                  {meal.userId === auth.currentUser?.uid && (
                    <button 
                      onClick={() => deleteMeal(meal.id)}
                      className="px-4 bg-gray-50 dark:bg-slate-700 text-gray-400 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:text-rose-500 transition-colors"
                    >
                      🗑️
                    </button>
                  )}
                </div>
             </div>
          </div>
        ))}
        {isLoading && !isUploading && <div className="text-center p-10 font-bold text-gray-400">Caricamento pasti...</div>}
        {!isLoading && filteredMeals.length === 0 && (
           <div className="text-center py-10 opacity-30 italic text-sm">Nessun pasto trovato con questi filtri.</div>
        )}
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl space-y-6">
            <h2 className="text-2xl font-black tracking-tighter uppercase text-center">Nuovo Post</h2>
            
            {uploadFile && (
              <div className="w-full h-48 rounded-2xl overflow-hidden shadow-inner bg-gray-100 dark:bg-slate-800">
                <img src={URL.createObjectURL(uploadFile)} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Categoria</label>
              <div className="flex flex-wrap gap-2">
                {uploadCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setUploadCategory(cat)}
                    className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                      uploadCategory === cat 
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-200 dark:shadow-none' 
                      : 'bg-gray-50 dark:bg-slate-800 text-gray-400 border border-gray-100 dark:border-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Descrizione</label>
              <textarea
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Cosa stai mangiando di buono?"
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 p-4 rounded-2xl font-medium text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                  setUploadDescription('');
                }}
                className="flex-1 py-4 rounded-2xl font-black uppercase text-xs tracking-widest bg-gray-100 dark:bg-slate-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
              >
                Annulla
              </button>
              <button 
                onClick={confirmUpload}
                className="flex-1 py-4 rounded-2xl font-black uppercase text-xs tracking-widest bg-rose-500 text-white shadow-xl shadow-rose-200 dark:shadow-none hover:bg-rose-600 transition-all active:scale-95"
              >
                Pubblica
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MealsView;
