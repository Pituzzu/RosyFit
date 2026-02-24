
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GymSettings } from '../types';
import { analyzeMealNutrition } from '../services/geminiService';
import { auth, db } from '../services/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { compressImage } from '../services/utils';

interface Meal {
  id: string;
  userId: string;
  userName: string;
  type: string;
  image: string;
  time: string;
  description: string;
  timestamp: Date;
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
}

const MealsView: React.FC<MealsViewProps> = ({ gymSettings }) => {
  const [viewMode, setViewMode] = useState<'personal' | 'friends'>('personal');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('Tutti');
  const [dateFilter, setDateFilter] = useState<string>('Sempre');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = ['Tutti', 'Colazione', 'Spuntino', 'Pranzo', 'Cena', 'Pasto Fit', 'Cheat Meal', 'Altro'];
  const dateOptions = ['Sempre', 'Oggi', 'Ultimi 7 giorni'];

  useEffect(() => {
    const q = query(collection(db, 'meals'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMeals = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          userName: data.userName,
          type: data.type,
          image: data.image,
          time: data.time,
          description: data.description,
          nutrition: data.nutrition,
          timestamp: data.timestamp?.toDate() || new Date()
        };
      }) as Meal[];
      setMeals(fetchedMeals);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    const desc = prompt("Cosa stai mangiando? (opzionale)");
    const category = prompt("Categoria? (Pasto Fit, Cheat Meal, Spuntino, Colazione, Altro)", "Pasto Fit") || "Altro";
    setIsUploading(true);

    try {
      const compressedBase64 = await compressImage(file, 800, 0.6);

      await addDoc(collection(db, 'meals'), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Atleta',
        type: category,
        image: compressedBase64,
        time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        description: desc || 'Pasto senza descrizione',
        timestamp: Timestamp.now()
      });
    } catch (error) {
      console.error("Errore durante il caricamento:", error);
      alert("Errore durante il caricamento dell'immagine.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  const analyzeMeal = async (mealId: string) => {
    const meal = meals.find(m => m.id === mealId);
    if (!meal) return;

    try {
      // Passiamo il base64 rimosso del prefisso data:image/jpeg;base64,
      const base64Data = meal.image.split(',')[1];
      const resultString = await analyzeMealNutrition(base64Data, meal.description);
      const regex = /CAL:\s*(\d+)\s*\|\s*CARBI:\s*(\d+)\s*\|\s*PRO:\s*(\d+)\s*\|\s*FATS:\s*(\d+)/i;
      const match = resultString.match(regex);

      if (match) {
        alert(`Analisi AI: ${match[1]} kcal, ${match[2]}g carbi, ${match[3]}g pro, ${match[4]}g grassi`);
      } else {
        alert("L'AI non è riuscita a estrarre i dati. Riprova con una descrizione più chiara.");
      }
    } catch (error) {
      console.error(error);
      alert("Errore nell'analisi del pasto.");
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
             <div className="absolute top-4 left-4 z-10 bg-black/40 backdrop-blur-md text-white text-[8px] font-black px-4 py-2 rounded-full uppercase tracking-widest">
               {meal.userName} • {meal.time} • {meal.type}
             </div>
             <img src={meal.image} className="w-full h-96 object-cover" alt="Meal" />
             <div className="p-6">
                <p className="font-bold text-lg mb-4">{meal.description}</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => analyzeMeal(meal.id)}
                    className="flex-1 bg-rose-50 dark:bg-rose-900/20 text-rose-500 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest"
                  >
                    Analizza AI 🪄
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
    </div>
  );
};

export default MealsView;
