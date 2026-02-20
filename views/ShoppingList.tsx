
import React, { useState, useEffect, useMemo } from 'react';
import { auth, db } from '../services/firebase';

interface ShoppingItem {
  id: string;
  name: string;
  done: boolean;
  qty: string;
  price: number;
}

interface DietIngredient {
  name: string;
  totalQty: number;
  unit: string;
  count: number; // quante volte appare
}

const ShoppingListView: React.FC = () => {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [suggestions, setSuggestions] = useState<DietIngredient[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dietIngredients, setDietIngredients] = useState<Record<string, DietIngredient>>({});

  // Sincronizzazione lista spesa con Firestore
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = db.collection('users').doc(auth.currentUser.uid).collection('shoppingList');
    const unsub = q.onSnapshot((snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ShoppingItem[];
      setItems(list);
    });
    return () => unsub();
  }, []);

  // Sincronizzazione con la Dieta per suggerimenti
  useEffect(() => {
    if (!auth.currentUser) return;
    const fetchDiet = async () => {
      const dietRef = db.collection('users').doc(auth.currentUser.uid).collection('diet').doc('weeklyPlan');
      const snap = await dietRef.get();
      if (snap.exists) {
        const plan = snap.data();
        const ingredientsMap: Record<string, DietIngredient> = {};

        const processIngredient = (qtyStr: string, name: string) => {
          const cleanName = name.trim().toLowerCase();
          if (!cleanName) return;

          if (!ingredientsMap[cleanName]) {
            ingredientsMap[cleanName] = { name: cleanName, totalQty: 0, unit: '', count: 0 };
          }
          ingredientsMap[cleanName].count += 1;
        };

        Object.values(plan).forEach((day: any) => {
          ['colazione', 'spuntino', 'pranzo', 'cena'].forEach(mealType => {
            const meal = day[mealType];
            if (meal.ingredientsList) {
              meal.ingredientsList.forEach((ing: any) => processIngredient(ing.qty, ing.item));
            } else if (meal.name) {
              processIngredient("", meal.name);
            }
            
            if (meal.alternatives) {
              meal.alternatives.forEach((alt: any) => {
                 if (alt.ingredientsList) {
                   alt.ingredientsList.forEach((ing: any) => processIngredient(ing.qty, ing.item));
                 }
              });
            }
          });
        });

        setDietIngredients(ingredientsMap);
      }
    };
    fetchDiet();
  }, []);

  const handleInputChange = (text: string) => {
    setNewItemName(text);
    if (text.length > 1) {
      const search = text.toLowerCase();
      const matches = Object.values(dietIngredients).filter(i => i.name.includes(search));
      setSuggestions(matches);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const addItem = async (name: string, suggestedQty: string = '') => {
    if (!name || !auth.currentUser) return;
    
    // Capitalize name
    const formattedName = name.charAt(0).toUpperCase() + name.slice(1);

    await db.collection('users').doc(auth.currentUser.uid).collection('shoppingList').add({
      name: formattedName,
      done: false,
      qty: suggestedQty || '1',
      price: 0
    });
    setNewItemName('');
    setShowSuggestions(false);
  };

  const updateItem = async (id: string, field: keyof ShoppingItem, value: any) => {
    if (!auth.currentUser) return;
    
    // Trova l'elemento corrente per i calcoli
    const currentItem = items.find(i => i.id === id);
    if (!currentItem) return;

    const ref = db.collection('users').doc(auth.currentUser.uid).collection('shoppingList').doc(id);
    const updates: any = { [field]: value };

    // Se cambio la QUANTITÀ, ricalcolo il prezzo totale
    // Logica: (Prezzo Totale Attuale / Vecchia Qtà) * Nuova Qtà
    if (field === 'qty') {
      const oldQtyVal = parseFloat(currentItem.qty);
      const newQtyVal = parseFloat(value);
      
      // Default a 1 se parsing fallisce o è 0, per evitare divisioni per zero o errori
      const oldQty = isNaN(oldQtyVal) || oldQtyVal === 0 ? 1 : oldQtyVal;
      const newQty = isNaN(newQtyVal) || newQtyVal === 0 ? 1 : newQtyVal;

      if (currentItem.price > 0) {
        const unitPrice = currentItem.price / oldQty;
        updates.price = parseFloat((unitPrice * newQty).toFixed(2));
      }
    }

    await ref.update(updates);
  };

  const deleteItem = async (id: string) => {
    if (!auth.currentUser) return;
    await db.collection('users').doc(auth.currentUser.uid).collection('shoppingList').doc(id).delete();
  };

  const totalPrice = useMemo(() => {
    return items.reduce((acc, item) => acc + (item.price || 0), 0);
  }, [items]);

  return (
    <div className="p-4 space-y-8 pb-24 h-full flex flex-col">
      <header>
        <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter">Shopping</h1>
        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Lista della Spesa 🛒</p>
      </header>

      {/* INPUT AREA */}
      <div className="relative z-20">
        <div className="flex gap-2">
          <input 
            value={newItemName}
            onChange={e => handleInputChange(e.target.value)}
            placeholder="Aggiungi prodotto (es. Riso)..."
            className="flex-1 px-5 py-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 font-bold text-sm outline-none focus:ring-2 focus:ring-rose-500"
          />
          <button onClick={() => addItem(newItemName)} className="bg-rose-500 text-white px-6 rounded-2xl font-black shadow-lg shadow-rose-200 dark:shadow-none">+</button>
        </div>

        {/* SUGGESTIONS DROPDOWN */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 max-h-60 overflow-y-auto no-scrollbar">
            <div className="p-3 bg-gray-50 dark:bg-slate-900 text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-100 dark:border-slate-700">
              Dalla tua dieta 🥑
            </div>
            {suggestions.map((ing, idx) => (
              <button
                key={idx}
                onClick={() => {
                  addItem(ing.name, '1');
                }}
                className="w-full text-left px-5 py-3 hover:bg-rose-50 dark:hover:bg-slate-700 transition-colors flex justify-between items-center group"
              >
                <span className="font-bold text-sm capitalize text-slate-700 dark:text-gray-200">{ing.name}</span>
                <span className="text-[10px] font-black bg-gray-100 dark:bg-slate-900 text-gray-400 px-2 py-1 rounded-lg">
                  Aggiungi
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* LIST */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-20 no-scrollbar">
        {items.length === 0 ? (
          <div className="text-center py-20 opacity-40 flex flex-col items-center">
             <span className="text-4xl mb-2">📝</span>
             <span>La lista è vuota.</span>
             <span className="text-xs mt-2">Inizia a scrivere per vedere i suggerimenti dalla dieta!</span>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className={`flex items-center gap-3 p-4 rounded-3xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 transition-all ${item.done ? 'opacity-50' : ''}`}>
              <button onClick={() => updateItem(item.id, 'done', !item.done)} className={`min-w-[24px] h-6 rounded-lg border-2 flex items-center justify-center transition-all ${item.done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200 dark:border-slate-600'}`}>
                {item.done && '✓'}
              </button>
              
              <div className="flex-1 min-w-0">
                <span className={`block font-bold text-sm truncate ${item.done ? 'line-through text-gray-400' : 'text-slate-800 dark:text-white'}`}>
                  {item.name}
                </span>
              </div>

              {/* Editable Fields */}
              <div className="flex items-center gap-2">
                 <input 
                   value={item.qty}
                   onChange={(e) => updateItem(item.id, 'qty', e.target.value)}
                   placeholder="Qtà"
                   className="w-16 bg-gray-50 dark:bg-slate-900 border border-transparent focus:border-rose-500 rounded-xl px-2 py-2 text-xs font-bold text-center outline-none transition-colors"
                 />
                 <div className="relative">
                   <input 
                     type="number"
                     value={item.price || ''}
                     onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value))}
                     placeholder="€"
                     className="w-16 bg-gray-50 dark:bg-slate-900 border border-transparent focus:border-rose-500 rounded-xl px-2 py-2 text-xs font-bold text-center outline-none transition-colors"
                   />
                   <span className="absolute right-2 top-2 text-[10px] text-gray-400 pointer-events-none">€</span>
                 </div>
              </div>

              <button onClick={() => deleteItem(item.id)} className="text-gray-300 hover:text-red-500 px-2 font-bold">✕</button>
            </div>
          ))
        )}
      </div>

      {/* FOOTER TOTAL */}
      <div className="fixed bottom-20 left-4 right-4 bg-slate-900 dark:bg-slate-800 text-white p-5 rounded-[2rem] shadow-2xl flex justify-between items-center z-10 border border-slate-700">
        <div>
           <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Totale Stimato</p>
           <p className="text-xs text-gray-500">{items.length} prodotti</p>
        </div>
        <div className="text-2xl font-black">
          {totalPrice.toFixed(2)} €
        </div>
      </div>
    </div>
  );
};

export default ShoppingListView;
