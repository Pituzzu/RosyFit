
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getRecipeAdvice, parseDietPDF } from '../services/geminiService';
import { GymSettings, UserProfile, WeeklyDiet } from '../types';
import { auth, db } from '../services/firebase';
import { doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { sanitizeForFirestore } from '../services/utils';

interface DietViewProps {
  gymSettings: GymSettings;
  profile: UserProfile;
  setProfile?: (p: UserProfile) => Promise<void>;
  readOnly?: boolean;
  customDiet?: WeeklyDiet;
  onBack?: () => void;
}

const DietView: React.FC<DietViewProps> = ({ gymSettings, profile, setProfile, readOnly = false, customDiet, onBack }) => {
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    return days[new Date().getDay()];
  });
  
  const [activeRecipeIdx, setActiveRecipeIdx] = useState<string | null>(null);
  const [mealRecipes, setMealRecipes] = useState<Record<string, string>>({});
  const [generatingMealId, setGeneratingMealId] = useState<string | null>(null);
  const [editingMeal, setEditingMeal] = useState<{ day: string, key: string, data: any, items: { amount: string, name: string }[] } | null>(null);
  const [consumedHistory, setConsumedHistory] = useState<Record<string, Record<string, boolean>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const daysOfWeek = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
  const [activeWeek, setActiveWeek] = useState<string>(profile.selectedWeekId || 'week6'); // Default to week6 (Saturday cheat)

  const defaultDietTemplate: WeeklyDiet = useMemo(() => ({
    'Lunedì': {
      colazione: { fullTitle: "COLAZIONE (Pancake)", desc: "60g Albume + 30g Farina d'avena + 50g Yogurt Greco + 10g Ciocc. Fond. 80%", kcal: 345, carbs: 32, protein: 24, fats: 12 },
      spuntino: { fullTitle: "SPUNTINO", desc: "40g Parmigiano + 5g Miele + 2-3 Noci", kcal: 280, carbs: 8, protein: 15, fats: 20 },
      pranzo: { fullTitle: "PRANZO", desc: "70g Cous Cous + Verdure + 60g Fesa di Tacchino + 5g Olio", kcal: 420, carbs: 55, protein: 28, fats: 10 },
      spuntino2: { fullTitle: "SPUNTINO 2", desc: "1 Yogurt Greco 0%", kcal: 90, carbs: 4, protein: 17, fats: 0 },
      cena: { fullTitle: "CENA", desc: "170g Carne Rossa + 70g Pane + Verdure + 5g Olio", kcal: 480, carbs: 40, protein: 42, fats: 18 }
    },
    'Martedì': {
      colazione: { fullTitle: "COLAZIONE", desc: "50g Pane tostato + 1 Uovo + 45g Avocado", kcal: 320, carbs: 25, protein: 12, fats: 18 },
      spuntino: { fullTitle: "SPUNTINO", desc: "Frutta a piacere + 10g Frutta secca", kcal: 180, carbs: 25, protein: 3, fats: 8 },
      pranzo: { fullTitle: "PRANZO", desc: "70g Pasta + 150g Legumi + Verdure + 10g Olio + 100g Frutta", kcal: 510, carbs: 70, protein: 22, fats: 14 },
      spuntino2: { fullTitle: "SPUNTINO 2", desc: "30g Fesa di Tacchino", kcal: 35, carbs: 0, protein: 7, fats: 1 },
      cena: { fullTitle: "CENA", desc: "250g Pesce + 70g Pane + Verdure + 5g Olio", kcal: 430, carbs: 38, protein: 45, fats: 10 }
    },
    'Mercoledì': {
      colazione: { fullTitle: "COLAZIONE (Pancake)", desc: "60g Albume + 30g Farina d'avena + 50g Yogurt Greco + 10g Ciocc. Fond. 80%", kcal: 345, carbs: 32, protein: 24, fats: 12 },
      spuntino: { fullTitle: "SPUNTINO", desc: "40g Parmigiano + 5g Miele + 2-3 Noci", kcal: 280, carbs: 8, protein: 15, fats: 20 },
      pranzo: { fullTitle: "PRANZO", desc: "70g Riso + Salsa Pomodoro + 180g Carne Bianca + 5g Olio + Verdure", kcal: 460, carbs: 55, protein: 42, fats: 8 },
      spuntino2: { fullTitle: "SPUNTINO 2", desc: "1 Mela", kcal: 70, carbs: 18, protein: 0, fats: 0 },
      cena: { fullTitle: "CENA", desc: "2 Uova + 1 Albume + 70g Pane + Verdure + 5g Olio", kcal: 410, carbs: 38, protein: 26, fats: 18 }
    },
    'Giovedì': {
      colazione: { fullTitle: "COLAZIONE", desc: "30g Farina d'avena + 150g Yogurt Greco + 15g Ciocc. Fond. 80% + Frutta", kcal: 330, carbs: 40, protein: 18, fats: 10 },
      spuntino: { fullTitle: "SPUNTINO", desc: "Frutta a piacere + 10g Frutta secca", kcal: 180, carbs: 25, protein: 3, fats: 8 },
      pranzo: { fullTitle: "PRANZO", desc: "180g Carne Rossa + 70g Pane + Verdure + 10g Olio", kcal: 490, carbs: 38, protein: 45, fats: 22 },
      spuntino2: { fullTitle: "SPUNTINO 2", desc: "30g Parmigiano", kcal: 120, carbs: 0, protein: 10, fats: 9 },
      cena: { fullTitle: "CENA", desc: "1 Piadina all'EVO + 100g Tonno sgocciolato + Verdure + 5g Olio", kcal: 520, carbs: 50, protein: 35, fats: 20 }
    },
    'Venerdì': {
      colazione: { fullTitle: "COLAZIONE (Pancake)", desc: "60g Albume + 30g Farina d'avena + 50g Yogurt Greco + 10g Ciocc. Fond. 80%", kcal: 345, carbs: 32, protein: 24, fats: 12 },
      spuntino: { fullTitle: "SPUNTINO", desc: "40g Parmigiano + 5g Miele + 2-3 Noci", kcal: 280, carbs: 8, protein: 15, fats: 20 },
      pranzo: { fullTitle: "PRANZO", desc: "70g Pasta (Aglio, olio e peperoncino) + 180g Carne Bianca + 5g Olio + Verdure", kcal: 470, carbs: 52, protein: 40, fats: 12 },
      spuntino2: { fullTitle: "SPUNTINO 2", desc: "10 Mandorle", kcal: 70, carbs: 2, protein: 2, fats: 6 },
      cena: { fullTitle: "CENA", desc: "200g Sgombro + 70g Pane + Verdure + 5g Olio", kcal: 450, carbs: 38, protein: 35, fats: 18 }
    },
    'Sabato': {
      colazione: { fullTitle: "COLAZIONE", desc: "50g Pane tostato + 1 Uovo + 45g Avocado", kcal: 320, carbs: 25, protein: 12, fats: 18 },
      spuntino: { fullTitle: "SPUNTINO", desc: "Frutta a piacere + 10g Frutta secca", kcal: 180, carbs: 25, protein: 3, fats: 8 },
      pranzo: { fullTitle: "PRANZO", desc: "150g Legumi + 70g Pane + Verdure + 10g Olio", kcal: 440, carbs: 60, protein: 18, fats: 14 },
      spuntino2: { fullTitle: "SPUNTINO 2", desc: "1 Barretta proteica", kcal: 200, carbs: 15, protein: 20, fats: 7 },
      cena: { fullTitle: "CENA", desc: "170g Carne Rossa + 70g Pane + Verdure + 5g Olio", kcal: 480, carbs: 40, protein: 42, fats: 18 }
    },
    'Domenica': {
      colazione: { fullTitle: "COLAZIONE", desc: "50g Pane tostato + 30g Fesa di Tacchino/Pollo + 1 cucchiaio Olio EVO", kcal: 290, carbs: 30, protein: 12, fats: 14 },
      spuntino: { fullTitle: "SPUNTINO", desc: "Frutta a piacere + 10g Frutta secca", kcal: 180, carbs: 25, protein: 3, fats: 8 },
      pranzo: { fullTitle: "PRANZO", desc: "70g Pasta + 180g Ragù + Verdure + 10g Olio", kcal: 540, carbs: 55, protein: 38, fats: 18 },
      spuntino2: { fullTitle: "SPUNTINO 2", desc: "1 Yogurt Greco", kcal: 100, carbs: 5, protein: 15, fats: 2 },
      cena: { fullTitle: "CENA", desc: "120g Mozzarella + 70g Pane + Verdure + 5g Olio", kcal: 560, carbs: 40, protein: 32, fats: 30 }
    }
  }), []);

  // Initialize weeklyDiets if not present
  useEffect(() => {
    if (!profile || readOnly || profile.weeklyDiets) return;

    const cheatMeal = { fullTitle: "PASTO LIBERO", desc: "Goditi la serata! Scegli quello che preferisci con moderazione.", kcal: 800, carbs: 80, protein: 30, fats: 40, isFree: true };
    
    const newWeeklyDiets: Record<string, WeeklyDiet> = {};
    
    // Generate 7 weeks
    daysOfWeek.forEach((cheatDay, index) => {
      const weekKey = `week${index + 1}`;
      const weekDiet = JSON.parse(JSON.stringify(defaultDietTemplate));
      
      // Set cheat meal for the specific day
      if (weekDiet[cheatDay]) {
        weekDiet[cheatDay].cena = { ...cheatMeal };
      }
      
      newWeeklyDiets[weekKey] = weekDiet;
    });

    // Use existing diet for the matching week if possible, or just overwrite
    // If profile.diet exists (legacy), try to preserve it in the corresponding week
    // But for simplicity and to ensure the new structure is correct, we'll just initialize the new structure.
    // If the user had a custom diet, it might be lost if we don't map it.
    // Let's map the current profile.diet to 'week6' (Saturday cheat) if it exists, or just keep it as is.
    
    if (profile.diet) {
       // If legacy diet exists, put it in week6 (default) or try to detect cheat day?
       // Let's just put it in week6 as that was the default
       newWeeklyDiets['week6'] = profile.diet;
    }

    if (setProfile) {
      setProfile({ 
        ...profile, 
        weeklyDiets: newWeeklyDiets,
        selectedWeekId: 'week6'
      });
    }
  }, [profile, defaultDietTemplate, readOnly, setProfile]);

  const weeklyDiet = useMemo(() => {
    if (customDiet) return customDiet;
    
    // Use the selected week from weeklyDiets
    if (profile.weeklyDiets && profile.weeklyDiets[activeWeek]) {
      return profile.weeklyDiets[activeWeek];
    }
    
    // Fallback to legacy diet or default
    return profile.diet || defaultDietTemplate;
  }, [customDiet, profile.diet, profile.weeklyDiets, activeWeek, defaultDietTemplate]);

  const allPreviousMeals = useMemo(() => {
    const meals: any[] = [];
    Object.values(weeklyDiet).forEach(day => {
      Object.entries(day).forEach(([key, meal]) => {
        if (meal && meal.fullTitle) {
          meals.push({ ...meal, key });
        }
      });
    });
    // Unique by fullTitle and desc
    return Array.from(new Map(meals.map(m => [`${m.fullTitle}-${m.desc}`, m])).values());
  }, [weeklyDiet]);

  // Sync with Firestore
  useEffect(() => {
    if (!auth.currentUser || readOnly) {
      setIsLoading(false);
      return;
    }
    const dietRef = doc(db, 'dietProgress', auth.currentUser.uid);
    
    const unsubscribe = onSnapshot(dietRef, (docSnap) => {
      if (docSnap.exists()) {
        setConsumedHistory(docSnap.data().history || {});
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [readOnly]);

  const totals = useMemo(() => {
    const dayData = consumedHistory[selectedDay] || {};
    let totalKcal = 0;
    let totalCarbs = 0;
    let totalProtein = 0;
    let totalFats = 0;

    const currentPlan = weeklyDiet[selectedDay];
    if (!currentPlan) return { kcal: 0, carbs: 0, protein: 0, fats: 0 };

    if (dayData.colazione) { totalKcal += currentPlan.colazione.kcal; totalCarbs += currentPlan.colazione.carbs; totalProtein += currentPlan.colazione.protein; totalFats += currentPlan.colazione.fats; }
    if (dayData.spuntino) { totalKcal += currentPlan.spuntino.kcal; totalCarbs += currentPlan.spuntino.carbs; totalProtein += currentPlan.spuntino.protein; totalFats += currentPlan.spuntino.fats; }
    if (dayData.pranzo) { totalKcal += currentPlan.pranzo.kcal; totalCarbs += currentPlan.pranzo.carbs; totalProtein += currentPlan.pranzo.protein; totalFats += currentPlan.pranzo.fats; }
    if (dayData.spuntino2 && currentPlan.spuntino2) { totalKcal += currentPlan.spuntino2.kcal; totalCarbs += currentPlan.spuntino2.carbs; totalProtein += currentPlan.spuntino2.protein; totalFats += currentPlan.spuntino2.fats; }
    if (dayData.cena) { totalKcal += currentPlan.cena.kcal; totalCarbs += currentPlan.cena.carbs; totalProtein += currentPlan.cena.protein; totalFats += currentPlan.cena.fats; }

    return { kcal: totalKcal, carbs: totalCarbs, protein: totalProtein, fats: totalFats };
  }, [consumedHistory, selectedDay, weeklyDiet]);

  const toggleMeal = async (mealKey: string) => {
    if (!auth.currentUser || readOnly) return;
    const newHistory = { ...consumedHistory };
    const dayData = { ...(newHistory[selectedDay] || {}) };
    const isCompleted = !dayData[mealKey];
    dayData[mealKey] = isCompleted;
    newHistory[selectedDay] = dayData;

    setConsumedHistory(newHistory);
    const dietRef = doc(db, 'dietProgress', auth.currentUser.uid);
    await setDoc(dietRef, sanitizeForFirestore({ history: newHistory }), { merge: true });

    if (profile.weeklyTargets && setProfile) {
      const meal = weeklyDiet[selectedDay]?.[mealKey];
      if (meal) {
        const textToAnalyze = (meal.fullTitle + ' ' + meal.desc).toLowerCase();
        const targetIdsToUpdate: string[] = [];

        // White meat
        if (textToAnalyze.includes('pollo') || textToAnalyze.includes('tacchino') || textToAnalyze.includes('carne bianca')) {
          targetIdsToUpdate.push('white_meat');
        }
        
        // Red meat
        if (textToAnalyze.includes('manzo') || textToAnalyze.includes('vitello') || textToAnalyze.includes('carne rossa')) {
          targetIdsToUpdate.push('red_meat');
        }
        
        // Fish
        if (textToAnalyze.includes('pesce') || textToAnalyze.includes('tonno') || textToAnalyze.includes('sgombro') || textToAnalyze.includes('salmone') || textToAnalyze.includes('merluzzo') || textToAnalyze.includes('nasello') || textToAnalyze.includes('orata') || textToAnalyze.includes('spigola')) {
          targetIdsToUpdate.push('fish');
        }
        
        // Eggs
        if (textToAnalyze.includes('uova') || textToAnalyze.includes('albume')) {
          targetIdsToUpdate.push('eggs');
        }
        
        // Cheese
        if (textToAnalyze.includes('formaggio') || textToAnalyze.includes('parmigiano') || textToAnalyze.includes('mozzarella') || textToAnalyze.includes('fiocchi di latte') || textToAnalyze.includes('yogurt') || textToAnalyze.includes('latte')) {
          targetIdsToUpdate.push('cheese');
        }
        
        // Legumes
        if (textToAnalyze.includes('legumi') || textToAnalyze.includes('fagioli') || textToAnalyze.includes('ceci') || textToAnalyze.includes('lenticchie') || textToAnalyze.includes('piselli')) {
          targetIdsToUpdate.push('legumes');
        }
        
        // Processed (including Tonno as requested)
        if (textToAnalyze.includes('affettato') || textToAnalyze.includes('fesa') || textToAnalyze.includes('prosciutto') || textToAnalyze.includes('bresaola') || textToAnalyze.includes('salame') || textToAnalyze.includes('wurstel') || textToAnalyze.includes('tonno') || textToAnalyze.includes('in scatola') || textToAnalyze.includes('affumicato')) {
          targetIdsToUpdate.push('processed');
        }

        if (targetIdsToUpdate.length > 0) {
          const newTargets = profile.weeklyTargets.map(t => {
            if (targetIdsToUpdate.includes(t.id)) {
              const change = isCompleted ? 1 : -1;
              return { ...t, current: Math.max(0, t.current + change) };
            }
            return t;
          });
          
          // Update local profile state immediately for UI responsiveness
          setProfile({ ...profile, weeklyTargets: newTargets });
          
          // Update Firestore
          const userRef = doc(db, 'users', auth.currentUser.uid);
          await updateDoc(userRef, { weeklyTargets: newTargets });
        }
      }
    }
  };

  const generateRecipe = async (mealKey: string, desc: string) => {
    setGeneratingMealId(`${selectedDay}-${mealKey}`);
    const context = `Pasto: ${mealKey} del giorno ${selectedDay}. Descrizione: ${desc}`;
    const advice = await getRecipeAdvice(context, "Dami istruzioni rapide per cucinare questo pasto.");
    setMealRecipes(prev => ({ ...prev, [`${selectedDay}-${mealKey}`]: advice }));
    setActiveRecipeIdx(`${selectedDay}-${mealKey}`);
    setGeneratingMealId(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !setProfile) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        const parsedDiet = await parseDietPDF(base64);
        if (parsedDiet) {
          await setProfile({ ...profile, diet: parsedDiet });
          alert("Dieta aggiornata con successo dal PDF! 🎉");
        } else {
          alert("Errore durante l'analisi del PDF. Riprova con un file più chiaro.");
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Errore durante il caricamento.");
      setIsUploading(false);
    }
  };

  if (isLoading) return <div className="p-10 text-center animate-pulse text-rose-500 font-black uppercase text-xs tracking-widest">Caricamento piano nutrizionale...</div>;

  const handleSaveMeal = async () => {
    if (!editingMeal || !setProfile) return;
    
    const desc = editingMeal.items
      .filter(item => item.name.trim() !== '')
      .map(item => `${item.amount} ${item.name}`)
      .join(' + ');

    // Create a copy of the current week's diet
    const currentWeekDiet = JSON.parse(JSON.stringify(weeklyDiet));
    
    // Update the specific meal
    if (!currentWeekDiet[editingMeal.day]) {
      currentWeekDiet[editingMeal.day] = {};
    }
    
    currentWeekDiet[editingMeal.day][editingMeal.key] = { ...editingMeal.data, desc };

    // Update the full weeklyDiets structure
    const newWeeklyDiets = { 
      ...(profile.weeklyDiets || {}),
      [activeWeek]: currentWeekDiet 
    };

    try {
      await setProfile({ 
        ...profile, 
        weeklyDiets: newWeeklyDiets,
        // Also update legacy diet field for backward compatibility if needed, or just rely on weeklyDiets
        diet: currentWeekDiet 
      });
      setEditingMeal(null);
    } catch (error) {
      console.error("Error saving meal:", error);
      alert("Errore durante il salvataggio del pasto.");
    }
  };

  const parseMealItems = (desc: string) => {
    if (!desc) return [{ amount: '', name: '' }];
    return desc.split(' + ').map(part => {
      const match = part.match(/^([\d\w\s.,]+)\s+(.+)$/);
      if (match) {
        return { amount: match[1].trim(), name: match[2].trim() };
      }
      return { amount: '', name: part.trim() };
    });
  };

  const renderMealCard = (mealKey: 'colazione' | 'spuntino' | 'pranzo' | 'spuntino2' | 'cena', icon: string) => {
    const dayPlan = weeklyDiet[selectedDay];
    if (!dayPlan) return null;
    const meal = dayPlan[mealKey];
    if (!meal) return null;
    const isDone = consumedHistory[selectedDay]?.[mealKey];
    const mealId = `${selectedDay}-${mealKey}`;

    return (
      <div key={mealId} className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden transition-all">
        {meal.isFree && (
          <div className="absolute top-0 right-0 bg-amber-500 text-white text-[8px] font-black px-4 py-1 uppercase rounded-bl-xl tracking-widest z-10 shadow-sm">
            Enjoy! 🍕
          </div>
        )}
        
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-gray-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-xl shadow-inner">
               {icon}
             </div>
             <div>
               <div className="flex items-center gap-2 mb-1">
                 <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-gray-400 leading-none">
                   {mealKey.toUpperCase()}
                 </h3>
                 {!readOnly && (
                   <button 
                     onClick={() => setEditingMeal({ 
                       day: selectedDay, 
                       key: mealKey, 
                       data: { ...meal },
                       items: parseMealItems(meal.desc)
                     })}
                     className="text-[10px] hover:scale-110 transition-transform"
                   >
                     ✏️
                   </button>
                 )}
               </div>
               <h4 className="font-black text-sm text-slate-800 dark:text-white leading-tight">
                 {meal.fullTitle}
               </h4>
             </div>
          </div>

          <button 
            onClick={() => toggleMeal(mealKey)}
            disabled={readOnly}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              isDone 
              ? 'bg-rose-500 text-white scale-110 shadow-lg shadow-rose-200 dark:shadow-none' 
              : 'bg-gray-50 dark:bg-slate-900 text-gray-300 border border-gray-100 dark:border-slate-700'
            } ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isDone ? '✓' : <div className="w-2.5 h-2.5 bg-current rounded-full"></div>}
          </button>
        </div>

        <div className="text-[11px] font-medium text-slate-500 dark:text-gray-400 leading-relaxed mb-4 pl-1 flex flex-wrap gap-x-1 gap-y-1 items-center">
          {(meal.desc || '').split('+').map((part, idx, arr) => {
            const trimmedPart = part.trim();
            const isLast = idx === arr.length - 1;
            
            if (trimmedPart.includes('/')) {
              const rawOptions = trimmedPart.split('/').map(o => o.trim());
              // Cerca un prefisso di quantità (es. "30g ", "100ml ", "1 ", "1.5 ")
              const quantityMatch = rawOptions[0].match(/^(\d+(?:[.,]\d+)?\s*[a-zA-Z%]*\s*)/);
              const prefix = quantityMatch ? quantityMatch[0] : '';

              const options = rawOptions.map((opt, i) => {
                if (i === 0) return opt;
                // Se l'opzione successiva inizia con un numero, assumiamo abbia la sua quantità
                if (/^\d/.test(opt)) return opt;
                // Altrimenti preponiamo il prefisso della prima opzione
                return prefix + opt;
              });

              return (
                <React.Fragment key={idx}>
                  <select 
                    className="bg-rose-50 dark:bg-slate-900 border border-rose-100 dark:border-rose-900 text-rose-600 dark:text-rose-400 font-bold rounded-lg py-0.5 px-2 text-[10px] outline-none cursor-pointer hover:bg-rose-100 transition-colors"
                    defaultValue={options[0]}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {options.map((opt, i) => (
                      <option key={i} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {!isLast && <span>+</span>}
                </React.Fragment>
              );
            }
            
            return (
              <React.Fragment key={idx}>
                <span>{trimmedPart}</span>
                {!isLast && <span>+</span>}
              </React.Fragment>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-slate-700">
           <div className="flex gap-4">
             <div className="flex items-center gap-1.5">
               <span className="text-rose-500 font-black text-xs">{meal.kcal}</span>
               <span className="text-[8px] font-bold text-gray-400 uppercase">kcal</span>
             </div>
             <div className="flex gap-2">
               <span className="text-[9px] font-black text-amber-500/70">C:{meal.carbs}g</span>
               <span className="text-[9px] font-black text-rose-500/70">P:{meal.protein}g</span>
               <span className="text-[9px] font-black text-indigo-500/70">G:{meal.fats}g</span>
             </div>
           </div>

           <div className="flex gap-3">
             <button 
               onClick={() => generateRecipe(mealKey, meal.desc)}
               disabled={generatingMealId === mealId}
               className="text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-rose-500 transition-colors"
             >
               {generatingMealId === mealId ? 'Analisi...' : 'Ricetta AI 💡'}
             </button>
           </div>
        </div>

        {activeRecipeIdx === mealId && (
          <div className="absolute inset-0 bg-white/98 dark:bg-slate-800/98 backdrop-blur-md p-6 rounded-[2.5rem] z-20 animate-in fade-in zoom-in-95 duration-300 overflow-y-auto no-scrollbar">
             <div className="flex justify-between items-center mb-4">
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">Istruzioni Fit</span>
               <button onClick={() => setActiveRecipeIdx(null)} className="text-gray-400 text-lg">✕</button>
             </div>
             <p className="text-[11px] font-medium leading-relaxed text-slate-700 dark:text-gray-300 whitespace-pre-line">
               {mealRecipes[mealId]}
             </p>
          </div>
        )}
      </div>
    );
  };

  const kcalGoal = 1500;
  const progress = Math.min(100, (totals.kcal / kcalGoal) * 100);

  return (
    <div className="p-4 space-y-8 pb-24 max-w-lg mx-auto">
      <header className="flex flex-col gap-6">
        {readOnly && onBack && (
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-rose-500 transition-colors"
          >
            <span className="text-lg">←</span>
            <span className="text-[10px] font-black uppercase tracking-widest">Torna al Profilo</span>
          </button>
        )}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter">
              {readOnly ? `Dieta di ${profile.name}` : 'Dieta'}
            </h1>
            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">
              {readOnly ? 'Piano nutrizionale condiviso 🥑' : 'Il tuo piano settimanale 🥑'}
            </p>
          </div>
          
          {!readOnly && (
            <div className="flex items-center gap-2">
              <select
                value={activeWeek}
                onChange={(e) => {
                  const newWeek = e.target.value;
                  setActiveWeek(newWeek);
                  if (setProfile) {
                    setProfile({ ...profile, selectedWeekId: newWeek });
                  }
                }}
                className="bg-white dark:bg-slate-800 border border-rose-100 dark:border-slate-700 text-rose-500 font-black text-[10px] uppercase tracking-widest py-2 px-3 rounded-xl outline-none shadow-sm flex-1 max-w-[150px]"
              >
                {daysOfWeek.map((day, index) => (
                  <option key={`week${index + 1}`} value={`week${index + 1}`}>
                    Settimana {index + 1} (Sgarro {day})
                  </option>
                ))}
              </select>

              <input 
                type="file" 
                accept="application/pdf" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="bg-rose-500 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-200 dark:shadow-none hover:bg-rose-600 transition-all flex items-center gap-1 whitespace-nowrap"
              >
                {isUploading ? (
                  <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>📄 PDF</>
                )}
              </button>
              
              {profile.diet && setProfile && (
                <button 
                  onClick={() => setProfile({ ...profile, diet: undefined })}
                  className="text-[8px] font-black text-gray-400 uppercase tracking-widest hover:text-rose-500 transition-colors whitespace-nowrap"
                >
                  Reset
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
           {daysOfWeek.map(day => (
             <button
               key={day}
               onClick={() => setSelectedDay(day)}
               className={`flex-shrink-0 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                 selectedDay === day 
                 ? 'bg-rose-500 text-white shadow-lg shadow-rose-200 dark:shadow-none' 
                 : 'bg-white dark:bg-slate-800 text-gray-400 border border-gray-100 dark:border-slate-700'
               }`}
             >
               {day.substring(0, 3)}
             </button>
           ))}
        </div>
      </header>

      {!readOnly && (
        <div className="bg-white dark:bg-slate-800 p-7 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-slate-700 relative overflow-hidden">
          <div className="flex justify-between items-end mb-8">
             <div>
               <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Oggi ({selectedDay})</h3>
               <div className="flex items-baseline gap-2">
                 <span className="text-5xl font-black text-slate-800 dark:text-white">{totals.kcal}</span>
                 <span className="text-xs font-bold text-gray-400 uppercase tracking-tighter">/ {kcalGoal} kcal</span>
               </div>
             </div>
             <div className="text-right">
               <p className="text-xs font-black text-rose-500">{Math.round(progress)}%</p>
               <p className="text-[8px] font-bold text-gray-300 uppercase">Obiettivo</p>
             </div>
          </div>

          <div className="h-3 w-full bg-gray-50 dark:bg-slate-900 rounded-full overflow-hidden mb-6">
            <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-50 dark:border-slate-700/50">
             <div className="text-center">
               <p className="text-[8px] font-black text-amber-500 uppercase mb-0.5 tracking-widest">Carbs</p>
               <p className="text-sm font-black text-slate-700 dark:text-gray-200">{totals.carbs}g</p>
             </div>
             <div className="text-center border-x border-gray-50 dark:border-slate-700/50">
               <p className="text-[8px] font-black text-rose-500 uppercase mb-0.5 tracking-widest">Proteins</p>
               <p className="text-sm font-black text-slate-700 dark:text-gray-200">{totals.protein}g</p>
             </div>
             <div className="text-center">
               <p className="text-[8px] font-black text-indigo-500 uppercase mb-0.5 tracking-widest">Fats</p>
               <p className="text-sm font-black text-slate-700 dark:text-gray-200">{totals.fats}g</p>
             </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {renderMealCard('colazione', '☕')}
        {renderMealCard('spuntino', '🍎')}
        {renderMealCard('pranzo', '🥗')}
        {renderMealCard('spuntino2', '🥨')}
        {renderMealCard('cena', '🍲')}
      </div>

      {editingMeal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl space-y-6 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black tracking-tighter uppercase">Modifica {editingMeal.key}</h2>
              <button onClick={() => setEditingMeal(null)} className="text-gray-400 hover:text-rose-500 transition-colors">✕</button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Suggerimenti (Pasti Precedenti)</label>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                  {allPreviousMeals.filter(m => m.key === editingMeal.key).map((m, i) => (
                    <button
                      key={i}
                      onClick={() => setEditingMeal({ 
                        ...editingMeal, 
                        data: { ...editingMeal.data, fullTitle: m.fullTitle, kcal: m.kcal, carbs: m.carbs, protein: m.protein, fats: m.fats },
                        items: parseMealItems(m.desc)
                      })}
                      className="flex-shrink-0 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-3 py-2 rounded-xl text-[9px] font-bold text-slate-600 dark:text-gray-300 hover:border-rose-200 transition-colors"
                    >
                      {m.fullTitle}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Titolo Pasto</label>
                <input 
                  type="text"
                  value={editingMeal.data.fullTitle}
                  onChange={(e) => setEditingMeal({ ...editingMeal, data: { ...editingMeal.data, fullTitle: e.target.value } })}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 p-4 rounded-2xl font-bold text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Alimenti</label>
                {editingMeal.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="es. 20g"
                      value={item.amount}
                      onChange={(e) => {
                        const newItems = [...editingMeal.items];
                        newItems[idx].amount = e.target.value;
                        setEditingMeal({ ...editingMeal, items: newItems });
                      }}
                      className="w-24 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 p-3 rounded-xl font-bold text-xs"
                    />
                    <input 
                      type="text"
                      placeholder="es. Pane"
                      value={item.name}
                      onChange={(e) => {
                        const newItems = [...editingMeal.items];
                        newItems[idx].name = e.target.value;
                        setEditingMeal({ ...editingMeal, items: newItems });
                      }}
                      className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 p-3 rounded-xl font-bold text-xs"
                    />
                    {editingMeal.items.length > 1 && (
                      <button 
                        onClick={() => {
                          const newItems = editingMeal.items.filter((_, i) => i !== idx);
                          setEditingMeal({ ...editingMeal, items: newItems });
                        }}
                        className="text-gray-300 hover:text-rose-500"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button 
                  onClick={() => setEditingMeal({ ...editingMeal, items: [...editingMeal.items, { amount: '', name: '' }] })}
                  className="text-[9px] font-black uppercase tracking-widest text-rose-500 pl-1"
                >
                  + Aggiungi Alimento
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Calorie (kcal)</label>
                  <input 
                    type="number"
                    value={editingMeal.data.kcal}
                    onChange={(e) => setEditingMeal({ ...editingMeal, data: { ...editingMeal.data, kcal: parseInt(e.target.value) || 0 } })}
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 p-4 rounded-2xl font-bold text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Carboidrati (g)</label>
                  <input 
                    type="number"
                    value={editingMeal.data.carbs}
                    onChange={(e) => setEditingMeal({ ...editingMeal, data: { ...editingMeal.data, carbs: parseInt(e.target.value) || 0 } })}
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 p-4 rounded-2xl font-bold text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Proteine (g)</label>
                  <input 
                    type="number"
                    value={editingMeal.data.protein}
                    onChange={(e) => setEditingMeal({ ...editingMeal, data: { ...editingMeal.data, protein: parseInt(e.target.value) || 0 } })}
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 p-4 rounded-2xl font-bold text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Grassi (g)</label>
                  <input 
                    type="number"
                    value={editingMeal.data.fats}
                    onChange={(e) => setEditingMeal({ ...editingMeal, data: { ...editingMeal.data, fats: parseInt(e.target.value) || 0 } })}
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 p-4 rounded-2xl font-bold text-sm"
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={handleSaveMeal}
              className="w-full bg-rose-500 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-rose-200 dark:shadow-none hover:bg-rose-600 transition-all"
            >
              Salva Modifiche
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DietView;
