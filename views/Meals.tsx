
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GymSettings } from '../types';
import { auth, db } from '../services/firebase';
import { compressImage } from '../services/utils';
import firebase from 'firebase/compat/app';

interface Meal {
  id: string;
  userId: string;
  userName: string;
  type: string;
  image: string;
  time: string;
  description: string;
}

interface MealsViewProps {
  gymSettings: GymSettings;
}

const MealsView: React.FC<MealsViewProps> = ({ gymSettings }) => {
  const [viewMode, setViewMode] = useState<'personal' | 'friends'>('personal');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [tempFile, setTempFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [newMealDesc, setNewMealDesc] = useState('');
  const [newMealType, setNewMealType] = useState('Colazione');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = db.collection('meals').orderBy('timestamp', 'desc');
    const unsubscribe = q.onSnapshot((snapshot) => {
      const fetchedMeals = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Meal[];
      setMeals(fetchedMeals);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Cleanup preview url
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const personalMeals = useMemo(() => meals.filter(m => m.userId === auth.currentUser?.uid), [meals]);
  const friendsMeals = useMemo(() => meals.filter(m => m.userId !== auth.currentUser?.uid), [meals]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTempFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setNewMealDesc('');
    
    // Auto-detect time of day for default type
    const hour = new Date().getHours();
    if (hour < 11) setNewMealType('Colazione');
    else if (hour < 13) setNewMealType('Spuntino');
    else if (hour < 16) setNewMealType('Pranzo');
    else if (hour < 19) setNewMealType('Spuntino');
    else setNewMealType('Cena');

    setShowUploadModal(true);
  };

  const confirmUpload = async () => {
    if (!tempFile || !auth.currentUser) return;

    setIsUploading(true);
    try {
      const compressedBase64 = await compressImage(tempFile, 800, 0.6);

      await db.collection('meals').add({
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Atleta',
        type: newMealType,
        image: compressedBase64,
        time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        description: newMealDesc || 'Nessuna descrizione',
        timestamp: firebase.firestore.Timestamp.now()
      });
      
      closeModal();
    } catch (error) {
      console.error("Errore durante il caricamento:", error);
      alert("Errore durante il caricamento dell'immagine.");
    } finally {
      setIsUploading(false);
    }
  };

  const closeModal = () => {
    setShowUploadModal(false);
    setTempFile(null);
    setPreviewUrl(null);
    setNewMealDesc('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteMeal = async (mealId: string) => {
    if (window.confirm("Sei sicuro di voler eliminare questo ricordo?")) {
      try {
        await db.collection('meals').doc(mealId).delete();
      } catch (e) {
        console.error("Errore eliminazione:", e);
        alert("Impossibile eliminare il post.");
      }
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
          <span className="text-3xl mb-2">📸</span>
          <span className="text-[10px] font-black uppercase tracking-widest">Carica Foto Pasto</span>
      </button>

      <div className="space-y-8">
        {(viewMode === 'personal' ? personalMeals : friendsMeals).map((meal) => (
          <div key={meal.id} className="relative bg-white dark:bg-slate-800 rounded-[3rem] overflow-hidden shadow-sm border border-gray-100 dark:border-slate-700 group">
             
             {/* Info Tag */}
             <div className="absolute top-4 left-4 z-10 bg-black/40 backdrop-blur-md text-white px-4 py-2 rounded-full flex flex-col items-start">
               <span className="text-[10px] font-black uppercase tracking-widest text-rose-300">{meal.type}</span>
               <span className="text-[8px] font-bold text-gray-200">{meal.time}</span>
             </div>

             {/* Delete Button (Only for owner) */}
             {meal.userId === auth.currentUser?.uid && (
               <button 
                 onClick={(e) => {
                   e.stopPropagation();
                   deleteMeal(meal.id);
                 }}
                 className="absolute top-4 right-4 z-10 bg-white/20 backdrop-blur-md text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-red-500/80 transition-colors"
               >
                 🗑️
               </button>
             )}

             <img src={meal.image} className="w-full h-96 object-cover" alt="Meal" />
             
             <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                   <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{meal.userName}</span>
                </div>
                <p className="font-bold text-lg text-slate-800 dark:text-gray-100">{meal.description}</p>
             </div>
          </div>
        ))}
        {!isLoading && (viewMode === 'personal' ? personalMeals : friendsMeals).length === 0 && (
           <div className="text-center py-10 opacity-30 italic text-sm">Nessun pasto presente in questa categoria.</div>
        )}
      </div>

      {/* UPLOAD MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl overflow-hidden relative">
            <h3 className="text-center font-black text-lg uppercase mb-4 text-slate-800 dark:text-white">Nuovo Post</h3>
            
            {previewUrl && (
              <div className="w-full h-48 rounded-2xl overflow-hidden mb-4 shadow-inner bg-gray-100 dark:bg-slate-800">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Tipo di Pasto</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Colazione', 'Spuntino', 'Pranzo', 'Cena'].map(type => (
                    <button
                      key={type}
                      onClick={() => setNewMealType(type)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${newMealType === type ? 'bg-rose-500 text-white' : 'bg-gray-50 dark:bg-slate-800 text-gray-400'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Descrizione</label>
                <textarea
                  value={newMealDesc}
                  onChange={(e) => setNewMealDesc(e.target.value)}
                  placeholder="Es. Riso e Pollo con verdure..."
                  className="w-full bg-gray-50 dark:bg-slate-800 p-3 rounded-xl text-sm outline-none resize-none h-20 border border-transparent focus:border-rose-500 transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-2">
                 <button 
                  onClick={closeModal}
                  className="flex-1 bg-gray-100 dark:bg-slate-800 text-gray-500 font-bold py-3 rounded-2xl uppercase text-[10px] tracking-widest"
                 >
                   Annulla
                 </button>
                 <button 
                  onClick={confirmUpload}
                  disabled={isUploading}
                  className="flex-[2] bg-rose-500 text-white font-black py-3 rounded-2xl shadow-lg shadow-rose-200 dark:shadow-none uppercase text-[10px] tracking-widest flex justify-center items-center"
                 >
                   {isUploading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : 'Pubblica'}
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MealsView;
