
import React, { useState, useEffect, useMemo } from 'react';
import { getRecipeAdvice } from '../services/geminiService';
import { GymSettings } from '../types';
import { auth, db } from '../services/firebase';

interface DietViewProps {
  gymSettings: GymSettings;
}

interface Ingredient {
  qty: string;
  item: string;
}

interface MealInfo {
  name: string;
  desc: string;
  ingredientsList?: Ingredient[];
  kcal: number;
  carbs: number;
  protein: number;
  fats: number;
}

interface MealEntry extends MealInfo {
  alternatives: MealInfo[];
  selectedAlternativeIndex?: number;
}

interface DayPlan {
  colazione: MealEntry;
  spuntino: MealEntry;
  pranzo: MealEntry;
  cena: MealEntry;
}

type WeeklyPlan = Record<string, DayPlan>;

const formatIngredientsDescription = (ingredients: Ingredient[] | undefined): string => {
  if (!ingredients || ingredients.length === 0) return "";
  return ingredients
    .filter(i => i.item.trim() !== "")
    .map(i => `${i.qty ? i.qty + ' ' : ''}${i.item}`)
    .join(' + ');
};

const DEFAULT_PLAN: WeeklyPlan = {
  'Lunedì': {
    colazione: { name: "Pancake Fit", desc: "60g Albume + 30g Avena + Yogurt", ingredientsList: [{qty: "60g", item: "Albume"}, {qty: "30g", item: "Avena"}, {qty: "", item: "Yogurt"}], kcal: 345, carbs: 32, protein: 24, fats: 12, alternatives: [] },
    spuntino: { name: "Parmigiano & Noci", desc: "40g Parmigiano + 2 Noci", ingredientsList: [{qty: "40g", item: "Parmigiano"}, {qty: "2", item: "Noci"}], kcal: 280, carbs: 8, protein: 15, fats: 20, alternatives: [] },
    pranzo: { name: "Riso e Tacchino", desc: "70g Riso + 150g Tacchino", ingredientsList: [{qty: "70g", item: "Riso"}, {qty: "150g", item: "Tacchino"}], kcal: 420, carbs: 55, protein: 28, fats: 10, alternatives: [] },
    cena: { name: "Carne Rossa", desc: "170g Tagliata + Verdure", ingredientsList: [{qty: "170g", item: "Tagliata"}, {qty: "", item: "Verdure"}], kcal: 480, carbs: 40, protein: 42, fats: 18, alternatives: [] }
  },
  'Martedì': {
    colazione: { name: "Toast Salato", desc: "Pane + Uova + Avocado", ingredientsList: [{qty: "", item: "Pane"}, {qty: "", item: "Uova"}, {qty: "", item: "Avocado"}], kcal: 320, carbs: 25, protein: 12, fats: 18, alternatives: [] },
    spuntino: { name: "Frutta e Mandorle", desc: "1 Mela + 10g Mandorle", ingredientsList: [{qty: "1", item: "Mela"}, {qty: "10g", item: "Mandorle"}], kcal: 180, carbs: 25, protein: 3, fats: 8, alternatives: [] },
    pranzo: { name: "Pasta e Legumi", desc: "70g Pasta + Ceci", ingredientsList: [{qty: "70g", item: "Pasta"}, {qty: "", item: "Ceci"}], kcal: 510, carbs: 70, protein: 22, fats: 14, alternatives: [] },
    cena: { name: "Pesce al forno", desc: "Orata + Patate", ingredientsList: [{qty: "", item: "Orata"}, {qty: "", item: "Patate"}], kcal: 430, carbs: 38, protein: 45, fats: 10, alternatives: [] },
  },
  'Mercoledì': {
    colazione: { name: "Porridge", desc: "Avena + Latte + Cacao", ingredientsList: [{qty: "", item: "Avena"}, {qty: "", item: "Latte"}, {qty: "", item: "Cacao"}], kcal: 345, carbs: 32, protein: 24, fats: 12, alternatives: [] },
    spuntino: { name: "Yogurt", desc: "Yogurt Greco + Miele", ingredientsList: [{qty: "", item: "Yogurt Greco"}, {qty: "", item: "Miele"}], kcal: 280, carbs: 8, protein: 15, fats: 20, alternatives: [] },
    pranzo: { name: "Pollo al Curry", desc: "Riso Basmati + Pollo", ingredientsList: [{qty: "", item: "Riso Basmati"}, {qty: "", item: "Pollo"}], kcal: 460, carbs: 55, protein: 42, fats: 8, alternatives: [] },
    cena: { name: "Omelette", desc: "2 Uova + Spinaci", ingredientsList: [{qty: "2", item: "Uova"}, {qty: "", item: "Spinaci"}], kcal: 410, carbs: 38, protein: 26, fats: 18, alternatives: [] }
  },
  'Giovedì': {
    colazione: { name: "Yogurt Bowl", desc: "Yogurt + Frutti Rossi", ingredientsList: [{qty: "", item: "Yogurt"}, {qty: "", item: "Frutti Rossi"}], kcal: 330, carbs: 40, protein: 18, fats: 10, alternatives: [] },
    spuntino: { name: "Barretta Proteica", desc: "Low sugar", ingredientsList: [{qty: "", item: "Low sugar"}], kcal: 180, carbs: 25, protein: 20, fats: 8, alternatives: [] },
    pranzo: { name: "Bistecca", desc: "Manzo ai ferri + Insalata", ingredientsList: [{qty: "", item: "Manzo ai ferri"}, {qty: "", item: "Insalata"}], kcal: 490, carbs: 38, protein: 45, fats: 22, alternatives: [] },
    cena: { name: "Tonno e Fagioli", desc: "Insalatona mista", ingredientsList: [{qty: "", item: "Insalatona mista"}], kcal: 520, carbs: 50, protein: 35, fats: 20, alternatives: [] }
  },
  'Venerdì': {
    colazione: { name: "Pancake", desc: "Albumi + Farina integrale", ingredientsList: [{qty: "", item: "Albumi"}, {qty: "", item: "Farina integrale"}], kcal: 345, carbs: 32, protein: 24, fats: 12, alternatives: [] },
    spuntino: { name: "Cracker e Fesa", desc: "Pacchetto cracker + Tacchino", ingredientsList: [{qty: "1", item: "Pacchetto cracker"}, {qty: "", item: "Tacchino"}], kcal: 280, carbs: 30, protein: 15, fats: 5, alternatives: [] },
    pranzo: { name: "Pasta al Tonno", desc: "80g Pasta + Tonno naturale", ingredientsList: [{qty: "80g", item: "Pasta"}, {qty: "", item: "Tonno naturale"}], kcal: 470, carbs: 52, protein: 40, fats: 12, alternatives: [] },
    cena: { name: "Salmone", desc: "Trancio salmone + Verdure", ingredientsList: [{qty: "1", item: "Trancio salmone"}, {qty: "", item: "Verdure"}], kcal: 450, carbs: 38, protein: 35, fats: 18, alternatives: [] }
  },
  'Sabato': {
    colazione: { name: "Fette Biscottate", desc: "Marmellata zero + Fette", ingredientsList: [{qty: "", item: "Marmellata zero"}, {qty: "", item: "Fette"}], kcal: 320, carbs: 45, protein: 5, fats: 5, alternatives: [] },
    spuntino: { name: "Frutto", desc: "Banana", ingredientsList: [{qty: "", item: "Banana"}], kcal: 100, carbs: 25, protein: 1, fats: 0, alternatives: [] },
    pranzo: { name: "Riso Freddo", desc: "Condiriso light", ingredientsList: [{qty: "", item: "Condiriso light"}], kcal: 440, carbs: 60, protein: 10, fats: 10, alternatives: [] },
    cena: { name: "PIZZA LIBERA", desc: "Goditi la serata!", ingredientsList: [{qty: "", item: "Goditi la serata!"}], kcal: 800, carbs: 100, protein: 30, fats: 30, alternatives: [] }
  },
  'Domenica': {
    colazione: { name: "Cappuccio e Brioche", desc: "Bar o casa", ingredientsList: [{qty: "", item: "Bar o casa"}], kcal: 400, carbs: 50, protein: 8, fats: 15, alternatives: [] },
    spuntino: { name: "Frutto", desc: "Mela", ingredientsList: [{qty: "1", item: "Mela"}], kcal: 80, carbs: 20, protein: 0, fats: 0, alternatives: [] },
    pranzo: { name: "Pranzo Domenicale", desc: "Pasta al forno light", ingredientsList: [{qty: "", item: "Pasta al forno light"}], kcal: 600, carbs: 70, protein: 30, fats: 20, alternatives: [] },
    cena: { name: "Minestrone", desc: "Verdure miste + Crostini", ingredientsList: [{qty: "", item: "Verdure miste"}, {qty: "", item: "Crostini"}], kcal: 300, carbs: 40, protein: 10, fats: 5, alternatives: [] }
  }
};

const DietView: React.FC<DietViewProps> = ({ gymSettings }) => {
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    return days[new Date().getDay()];
  });
  
  const [activeRecipeIdx, setActiveRecipeIdx] = useState<string | null>(null);
  const [mealRecipes, setMealRecipes] = useState<Record<string, string>>({});
  const [generatingMealId, setGeneratingMealId] = useState<string | null>(null);
  const [consumedHistory, setConsumedHistory] = useState<Record<string, Record<string, boolean>>>({});
  
  const [editingMeal, setEditingMeal] = useState<{day: string, type: string, data: MealEntry} | null>(null);

  const daysOfWeek = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

  useEffect(() => {
    if (!auth.currentUser) return;
    const planRef = db.collection('users').doc(auth.currentUser.uid).collection('diet').doc('weeklyPlan');
    const historyRef = db.collection('dietProgress').doc(auth.currentUser.uid);

    planRef.get().then((snap) => {
      if (snap.exists) {
        const data = snap.data() as WeeklyPlan;
        setWeeklyPlan(data);
      } else {
        setWeeklyPlan(DEFAULT_PLAN);
        planRef.set(DEFAULT_PLAN);
      }
    });

    const unsubscribeHistory = historyRef.onSnapshot((docSnap) => {
      if (docSnap.exists) {
        setConsumedHistory(docSnap.data()?.history || {});
      }
    });

    return () => unsubscribeHistory();
  }, []);

  const saveDietPlan = async (newPlan: WeeklyPlan) => {
    if (!auth.currentUser) return;
    setWeeklyPlan(newPlan);
    await db.collection('users').doc(auth.currentUser.uid).collection('diet').doc('weeklyPlan').set(newPlan);
  };

  const totals = useMemo(() => {
    if (!weeklyPlan) return { kcal: 0, carbs: 0, protein: 0, fats: 0 };
    const dayData = consumedHistory[selectedDay] || {};
    let totalKcal = 0;
    let totalCarbs = 0;
    let totalProtein = 0;
    let totalFats = 0;

    const currentPlan = weeklyPlan[selectedDay];
    if (!currentPlan) return { kcal: 0, carbs: 0, protein: 0, fats: 0 };

    (['colazione', 'spuntino', 'pranzo', 'cena'] as const).forEach(key => {
      if (dayData[key]) {
        const entry = currentPlan[key];
        const activeMeal = (entry.selectedAlternativeIndex !== undefined && entry.selectedAlternativeIndex >= 0 && entry.alternatives[entry.selectedAlternativeIndex]) 
          ? entry.alternatives[entry.selectedAlternativeIndex] 
          : entry;
          
        totalKcal += activeMeal.kcal;
        totalCarbs += activeMeal.carbs;
        totalProtein += activeMeal.protein;
        totalFats += activeMeal.fats;
      }
    });

    return { kcal: totalKcal, carbs: totalCarbs, protein: totalProtein, fats: totalFats };
  }, [consumedHistory, selectedDay, weeklyPlan]);

  const toggleMeal = async (mealKey: string) => {
    if (!auth.currentUser) return;
    const newHistory = { ...consumedHistory };
    const dayData = { ...(newHistory[selectedDay] || {}) };
    dayData[mealKey] = !dayData[mealKey];
    newHistory[selectedDay] = dayData;

    setConsumedHistory(newHistory);
    const dietRef = db.collection('dietProgress').doc(auth.currentUser.uid);
    await dietRef.set({ history: newHistory }, { merge: true });
  };

  const swapAlternative = (day: string, mealKey: string) => {
    if (!weeklyPlan) return;
    const plan = { ...weeklyPlan };
    // @ts-ignore
    const entry = plan[day][mealKey] as MealEntry;
    
    if (entry.alternatives.length === 0) return;

    const currentIndex = entry.selectedAlternativeIndex ?? -1;
    let nextIndex = currentIndex + 1;
    if (nextIndex >= entry.alternatives.length) {
      nextIndex = -1; // Back to main
    }

    // @ts-ignore
    plan[day][mealKey] = { ...entry, selectedAlternativeIndex: nextIndex };
    saveDietPlan(plan);
  };

  const generateRecipe = async (mealKey: string, desc: string) => {
    setGeneratingMealId(`${selectedDay}-${mealKey}`);
    const context = `Pasto: ${mealKey} del giorno ${selectedDay}. Descrizione: ${desc}`;
    const advice = await getRecipeAdvice(context, "Dammi istruzioni rapide per cucinare questo pasto.");
    setMealRecipes(prev => ({ ...prev, [`${selectedDay}-${mealKey}`]: advice }));
    setActiveRecipeIdx(`${selectedDay}-${mealKey}`);
    setGeneratingMealId(null);
  };

  const handleEditSave = () => {
    if (!editingMeal || !weeklyPlan) return;
    
    const updatedData = { ...editingMeal.data };
    if (updatedData.ingredientsList && updatedData.ingredientsList.length > 0) {
      updatedData.desc = formatIngredientsDescription(updatedData.ingredientsList);
    }

    updatedData.alternatives = updatedData.alternatives.map(alt => {
      if (alt.ingredientsList && alt.ingredientsList.length > 0) {
        return { ...alt, desc: formatIngredientsDescription(alt.ingredientsList) };
      }
      return alt;
    });

    const newPlan = { ...weeklyPlan };
    // @ts-ignore
    newPlan[editingMeal.day][editingMeal.type] = updatedData;
    saveDietPlan(newPlan);
    setEditingMeal(null);
  };

  const addIngredientToMain = () => {
    if (!editingMeal) return;
    const currentList = editingMeal.data.ingredientsList || [];
    setEditingMeal({
      ...editingMeal,
      data: {
        ...editingMeal.data,
        ingredientsList: [...currentList, { qty: '', item: '' }]
      }
    });
  };

  const removeIngredientFromMain = (idx: number) => {
    if (!editingMeal) return;
    const currentList = editingMeal.data.ingredientsList ? [...editingMeal.data.ingredientsList] : [];
    currentList.splice(idx, 1);
    setEditingMeal({
      ...editingMeal,
      data: { ...editingMeal.data, ingredientsList: currentList }
    });
  };

  const updateIngredientInMain = (idx: number, field: keyof Ingredient, value: string) => {
    if (!editingMeal) return;
    const currentList = editingMeal.data.ingredientsList ? [...editingMeal.data.ingredientsList] : [];
    // @ts-ignore
    currentList[idx] = { ...currentList[idx], [field]: value };
    setEditingMeal({
      ...editingMeal,
      data: { ...editingMeal.data, ingredientsList: currentList }
    });
  };

  const addAlternativeToEdit = () => {
    if (!editingMeal) return;
    const newAlt: MealInfo = { name: '', desc: '', ingredientsList: [{ qty: '', item: '' }], kcal: 0, carbs: 0, protein: 0, fats: 0 };
    setEditingMeal({
      ...editingMeal,
      data: {
        ...editingMeal.data,
        alternatives: [...editingMeal.data.alternatives, newAlt]
      }
    });
  };

  const addIngredientToAlt = (altIdx: number) => {
    if (!editingMeal) return;
    const newAlts = [...editingMeal.data.alternatives];
    const currentList = newAlts[altIdx].ingredientsList || [];
    newAlts[altIdx] = { ...newAlts[altIdx], ingredientsList: [...currentList, { qty: '', item: '' }] };
    setEditingMeal({ ...editingMeal, data: { ...editingMeal.data, alternatives: newAlts } });
  };

  const removeIngredientFromAlt = (altIdx: number, ingIdx: number) => {
    if (!editingMeal) return;
    const newAlts = [...editingMeal.data.alternatives];
    const currentList = newAlts[altIdx].ingredientsList ? [...newAlts[altIdx].ingredientsList!] : [];
    currentList.splice(ingIdx, 1);
    newAlts[altIdx] = { ...newAlts[altIdx], ingredientsList: currentList };
    setEditingMeal({ ...editingMeal, data: { ...editingMeal.data, alternatives: newAlts } });
  };

  const updateIngredientInAlt = (altIdx: number, ingIdx: number, field: keyof Ingredient, value: string) => {
    if (!editingMeal) return;
    const newAlts = [...editingMeal.data.alternatives];
    const currentList = newAlts[altIdx].ingredientsList ? [...newAlts[altIdx].ingredientsList!] : [];
    // @ts-ignore
    currentList[ingIdx] = { ...currentList[ingIdx], [field]: value };
    newAlts[altIdx] = { ...newAlts[altIdx], ingredientsList: currentList };
    setEditingMeal({ ...editingMeal, data: { ...editingMeal.data, alternatives: newAlts } });
  };

  const removeAlternative = (idx: number) => {
    if (!editingMeal) return;
    const newAlts = [...editingMeal.data.alternatives];
    newAlts.splice(idx, 1);
    setEditingMeal({
      ...editingMeal,
      data: {
        ...editingMeal.data,
        alternatives: newAlts
      }
    });
  };

  const updateAlternative = (idx: number, field: keyof MealInfo, value: any) => {
    if (!editingMeal) return;
    const newAlts = [...editingMeal.data.alternatives];
    // @ts-ignore
    newAlts[idx] = { ...newAlts[idx], [field]: value };
    setEditingMeal({
      ...editingMeal,
      data: {
        ...editingMeal.data,
        alternatives: newAlts
      }
    });
  };

  if (!weeklyPlan) return <div className="p-10 text-center animate-pulse">Caricamento piano nutrizionale...</div>;

  const renderMealCard = (mealKey: 'colazione' | 'spuntino' | 'pranzo' | 'cena', icon: string) => {
    const entry = weeklyPlan[selectedDay][mealKey];
    const activeIndex = entry.selectedAlternativeIndex ?? -1;
    const isAlt = activeIndex >= 0;
    const meal = isAlt ? entry.alternatives[activeIndex] : entry;
    
    const isDone = consumedHistory[selectedDay]?.[mealKey];
    const mealId = `${selectedDay}-${mealKey}`;

    return (
      <div className={`bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 shadow-sm border ${isAlt ? 'border-rose-200 dark:border-rose-900/50' : 'border-gray-100 dark:border-slate-700'} relative overflow-hidden transition-all group`}>
        {isAlt && (
          <div className="absolute top-0 right-0 bg-rose-100 text-rose-600 dark:bg-rose-900 dark:text-rose-200 text-[8px] font-black px-3 py-1 uppercase rounded-bl-xl tracking-widest z-10">
            Alternativa {activeIndex + 1}
          </div>
        )}
        
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-gray-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-xl shadow-inner">
               {icon}
             </div>
             <div>
               <div className="flex items-center gap-2">
                 <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-gray-400 leading-none mb-1">
                   {mealKey.toUpperCase()}
                 </h3>
                 <button 
                  onClick={() => {
                    const dataToEdit = { ...entry };
                    if (!dataToEdit.ingredientsList) dataToEdit.ingredientsList = [];
                    dataToEdit.alternatives = dataToEdit.alternatives.map(a => ({
                      ...a,
                      ingredientsList: a.ingredientsList || []
                    }));
                    setEditingMeal({ day: selectedDay, type: mealKey, data: dataToEdit });
                  }}
                  className="text-gray-300 hover:text-rose-500 transition-colors"
                 >
                   ✏️
                 </button>
               </div>
               <h4 className="font-black text-sm text-slate-800 dark:text-white leading-tight">
                 {meal.name}
               </h4>
             </div>
          </div>

          <button 
            onClick={() => toggleMeal(mealKey)}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              isDone 
              ? 'bg-rose-500 text-white scale-110 shadow-lg shadow-rose-200 dark:shadow-none' 
              : 'bg-gray-50 dark:bg-slate-900 text-gray-300 border border-gray-100 dark:border-slate-700'
            }`}
          >
            {isDone ? '✓' : <div className="w-2.5 h-2.5 bg-current rounded-full"></div>}
          </button>
        </div>

        <p className="text-[11px] font-medium text-slate-500 dark:text-gray-400 leading-relaxed mb-4 pl-1">
          {meal.desc}
        </p>

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

           <div className="flex items-center gap-2">
             {entry.alternatives.length > 0 && (
                <button
                  onClick={() => swapAlternative(selectedDay, mealKey)}
                  className="bg-gray-50 dark:bg-slate-900 px-2 py-1 rounded-lg text-[8px] font-black uppercase text-gray-400 hover:text-rose-500 border border-gray-200 dark:border-slate-700"
                >
                  ↔ Cambia
                </button>
             )}
             <button 
               onClick={() => generateRecipe(mealKey, meal.desc)}
               disabled={generatingMealId === mealId}
               className="text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-rose-500 transition-colors"
             >
               {generatingMealId === mealId ? '...' : 'Ricetta AI 💡'}
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
    <div className="p-4 space-y-6 pb-24 max-w-lg mx-auto relative">
      {/* HEADER - Static */}
      <header className="pt-2">
        <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter">Dieta</h1>
        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Il tuo piano settimanale 🥑</p>
      </header>

      {/* DASHBOARD */}
      <div className="bg-white dark:bg-slate-800 p-7 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-slate-700 relative overflow-hidden z-10">
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

      {/* DAYS BAR - Sticky under dashboard */}
      <div className="sticky top-0 z-30 bg-gray-50/95 dark:bg-slate-900/95 backdrop-blur-md py-4 -mx-4 px-4 transition-colors">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
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
      </div>

      {/* MEALS LIST */}
      <div className="space-y-6">
        {renderMealCard('colazione', '☕')}
        {renderMealCard('spuntino', '🍎')}
        {renderMealCard('pranzo', '🥗')}
        {renderMealCard('cena', '🍲')}
      </div>

      {/* EDIT MODAL */}
      {editingMeal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-6 shadow-2xl overflow-y-auto max-h-[90vh] animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-lg uppercase text-slate-800 dark:text-white">Modifica {editingMeal.type}</h3>
              <button onClick={() => setEditingMeal(null)} className="text-gray-400 text-xl font-bold">✕</button>
            </div>

            <div className="space-y-6">
              {/* Main Meal Form */}
              <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-3xl border border-gray-100 dark:border-slate-700">
                <p className="text-[10px] font-black uppercase text-rose-500 mb-3 tracking-widest">Pasto Principale</p>
                <div className="space-y-3">
                  <input 
                    placeholder="Nome Pasto" 
                    className="w-full bg-white dark:bg-slate-700 p-3 rounded-xl font-bold text-sm outline-none border border-transparent focus:border-rose-500"
                    value={editingMeal.data.name} 
                    onChange={e => setEditingMeal({...editingMeal, data: {...editingMeal.data, name: e.target.value}})} 
                  />

                  {/* Ingredient Builder for Main Meal */}
                  <div className="space-y-2 mt-2">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Ingredienti</label>
                    {editingMeal.data.ingredientsList?.map((ing, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input 
                          placeholder="60g" 
                          className="w-20 bg-white dark:bg-slate-700 p-2 rounded-xl text-sm outline-none text-center font-bold"
                          value={ing.qty} 
                          onChange={e => updateIngredientInMain(idx, 'qty', e.target.value)} 
                        />
                        <input 
                          placeholder="Alimento (es. Albume)" 
                          className="flex-1 bg-white dark:bg-slate-700 p-2 rounded-xl text-sm outline-none font-medium"
                          value={ing.item} 
                          onChange={e => updateIngredientInMain(idx, 'item', e.target.value)} 
                        />
                        <button 
                          onClick={() => removeIngredientFromMain(idx)} 
                          className="text-red-400 hover:text-red-600 px-2"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={addIngredientToMain}
                      className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-gray-300 px-3 py-2 rounded-xl font-black uppercase hover:bg-rose-100 hover:text-rose-500 transition-colors w-full"
                    >
                      + Aggiungi Ingrediente
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    <input type="number" placeholder="Kcal" className="bg-white dark:bg-slate-700 p-2 rounded-xl text-xs text-center font-bold" value={editingMeal.data.kcal || ''} onChange={e => setEditingMeal({...editingMeal, data: {...editingMeal.data, kcal: Number(e.target.value)}})} />
                    <input type="number" placeholder="Carbs" className="bg-white dark:bg-slate-700 p-2 rounded-xl text-xs text-center font-bold" value={editingMeal.data.carbs || ''} onChange={e => setEditingMeal({...editingMeal, data: {...editingMeal.data, carbs: Number(e.target.value)}})} />
                    <input type="number" placeholder="Pro" className="bg-white dark:bg-slate-700 p-2 rounded-xl text-xs text-center font-bold" value={editingMeal.data.protein || ''} onChange={e => setEditingMeal({...editingMeal, data: {...editingMeal.data, protein: Number(e.target.value)}})} />
                    <input type="number" placeholder="Fat" className="bg-white dark:bg-slate-700 p-2 rounded-xl text-xs text-center font-bold" value={editingMeal.data.fats || ''} onChange={e => setEditingMeal({...editingMeal, data: {...editingMeal.data, fats: Number(e.target.value)}})} />
                  </div>
                </div>
              </div>

              {/* Alternatives List */}
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                   <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Alternative</p>
                   <button onClick={addAlternativeToEdit} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-gray-300 px-3 py-1.5 rounded-lg font-black uppercase hover:bg-rose-100 hover:text-rose-500 transition-colors">+ Aggiungi Alternativa</button>
                </div>

                {editingMeal.data.alternatives.map((alt, altIdx) => (
                  <div key={altIdx} className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-dashed border-gray-200 dark:border-slate-600 relative">
                     <button onClick={() => removeAlternative(altIdx)} className="absolute top-2 right-2 text-red-400 text-lg font-bold hover:scale-110 transition-transform">×</button>
                     <div className="space-y-3 mt-1">
                      <input 
                        placeholder="Nome Alternativa" 
                        className="w-full bg-gray-50 dark:bg-slate-700 p-2 rounded-xl font-bold text-sm outline-none"
                        value={alt.name} 
                        onChange={e => updateAlternative(altIdx, 'name', e.target.value)} 
                      />

                      {/* Ingredient Builder for Alternative */}
                      <div className="space-y-2">
                         {alt.ingredientsList?.map((ing, ingIdx) => (
                           <div key={ingIdx} className="flex gap-2">
                             <input 
                               placeholder="60g" 
                               className="w-16 bg-gray-50 dark:bg-slate-700 p-2 rounded-xl text-xs outline-none text-center font-bold"
                               value={ing.qty} 
                               onChange={e => updateIngredientInAlt(altIdx, ingIdx, 'qty', e.target.value)} 
                             />
                             <input 
                               placeholder="Alimento" 
                               className="flex-1 bg-gray-50 dark:bg-slate-700 p-2 rounded-xl text-xs outline-none"
                               value={ing.item} 
                               onChange={e => updateIngredientInAlt(altIdx, ingIdx, 'item', e.target.value)} 
                             />
                             <button 
                               onClick={() => removeIngredientFromAlt(altIdx, ingIdx)} 
                               className="text-red-400 hover:text-red-600 px-1 text-sm"
                             >
                               ×
                             </button>
                           </div>
                         ))}
                         <button 
                           onClick={() => addIngredientToAlt(altIdx)}
                           className="text-[9px] text-gray-400 bg-gray-50 dark:bg-slate-700 w-full py-2 rounded-lg font-bold hover:bg-rose-50 hover:text-rose-500"
                         >
                           + Aggiungi Ingrediente
                         </button>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        <input type="number" placeholder="Kcal" className="bg-gray-50 dark:bg-slate-700 p-2 rounded-xl text-[10px] text-center font-bold" value={alt.kcal || ''} onChange={e => updateAlternative(altIdx, 'kcal', Number(e.target.value))} />
                        <input type="number" placeholder="Carb" className="bg-gray-50 dark:bg-slate-700 p-2 rounded-xl text-[10px] text-center font-bold" value={alt.carbs || ''} onChange={e => updateAlternative(altIdx, 'carbs', Number(e.target.value))} />
                        <input type="number" placeholder="Pro" className="bg-gray-50 dark:bg-slate-700 p-2 rounded-xl text-[10px] text-center font-bold" value={alt.protein || ''} onChange={e => updateAlternative(altIdx, 'protein', Number(e.target.value))} />
                        <input type="number" placeholder="Fat" className="bg-gray-50 dark:bg-slate-700 p-2 rounded-xl text-[10px] text-center font-bold" value={alt.fats || ''} onChange={e => updateAlternative(altIdx, 'fats', Number(e.target.value))} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={handleEditSave}
                className="w-full bg-rose-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-rose-200 dark:shadow-none uppercase tracking-widest text-xs active:scale-95 transition-all"
              >
                Salva Modifiche
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DietView;
