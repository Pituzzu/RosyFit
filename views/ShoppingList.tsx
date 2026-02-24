
import React, { useState, useEffect, useMemo } from 'react';
import { auth, db } from '../services/firebase';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';

interface ShoppingItem {
  id: string;
  name: string;
  done: boolean;
  qty: number;
  price?: number;
}

const ShoppingListView: React.FC = () => {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItemName, setNewItemName] = useState('');

  // Sincronizzazione lista spesa con Firestore
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'users', auth.currentUser.uid, 'shoppingList'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ShoppingItem[];
      setItems(list);
    });
    return () => unsub();
  }, []);

  const totalCost = useMemo(() => {
    return items.reduce((acc, item) => acc + (item.price || 0) * (item.qty || 1), 0);
  }, [items]);

  const addItem = async () => {
    if (!newItemName || !auth.currentUser) return;
    await addDoc(collection(db, 'users', auth.currentUser.uid, 'shoppingList'), {
      name: newItemName,
      done: false,
      qty: 1,
      price: 0
    });
    setNewItemName('');
  };

  const updateItem = async (id: string, data: Partial<ShoppingItem>) => {
    if (!auth.currentUser) return;
    const ref = doc(db, 'users', auth.currentUser.uid, 'shoppingList', id);
    await updateDoc(ref, data);
  };

  const deleteItem = async (id: string) => {
    if (!auth.currentUser) return;
    await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'shoppingList', id));
  };

  return (
    <div className="p-4 space-y-8 pb-24">
      <header>
        <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter">Shopping</h1>
        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Lista della Spesa Personale 🛒</p>
      </header>

      <div className="flex gap-2">
        <input 
          value={newItemName}
          onChange={e => setNewItemName(e.target.value)}
          placeholder="Aggiungi prodotto..."
          className="flex-1 px-5 py-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 font-bold text-sm outline-none focus:ring-2 focus:ring-rose-500"
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
        />
        <button onClick={addItem} className="bg-rose-500 text-white px-6 rounded-2xl font-black text-xl shadow-lg shadow-rose-200 dark:shadow-none active:scale-95 transition-transform">+</button>
      </div>

      <div className="space-y-4 pb-32">
        {items.length === 0 ? (
          <div className="text-center py-10 opacity-40 italic text-sm">La tua lista è vuota. Aggiungi qualcosa!</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className={`flex flex-col gap-3 p-5 rounded-[2rem] bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 transition-all ${item.done ? 'opacity-60 grayscale' : 'shadow-sm'}`}>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => updateItem(item.id, { done: !item.done })} 
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${item.done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200 dark:border-slate-600'}`}
                >
                  {item.done && '✓'}
                </button>
                <span className={`flex-1 font-bold text-lg ${item.done ? 'line-through text-gray-400' : 'text-slate-800 dark:text-white'}`}>{item.name}</span>
                <button onClick={() => deleteItem(item.id)} className="w-8 h-8 flex items-center justify-center bg-gray-50 dark:bg-slate-700 rounded-full text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">✕</button>
              </div>
              
              <div className="flex items-center gap-4 pl-10">
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-900 px-3 py-1.5 rounded-xl">
                  <span className="text-[9px] font-black text-gray-400 uppercase">Qtà</span>
                  <input 
                    type="number" 
                    min="1"
                    value={item.qty || 1}
                    onChange={(e) => updateItem(item.id, { qty: parseInt(e.target.value) || 1 })}
                    className="w-12 bg-transparent font-bold text-sm text-center outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-900 px-3 py-1.5 rounded-xl flex-1">
                  <span className="text-[9px] font-black text-gray-400 uppercase">Prezzo €</span>
                  <input 
                    type="number" 
                    min="0"
                    step="0.01"
                    value={item.price || ''}
                    placeholder="0.00"
                    onChange={(e) => updateItem(item.id, { price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-transparent font-bold text-sm outline-none"
                  />
                </div>
                <div className="text-right min-w-[60px]">
                  <p className="text-[9px] font-black text-gray-400 uppercase">Totale</p>
                  <p className="font-bold text-rose-500">€ {((item.price || 0) * (item.qty || 1)).toFixed(2)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="fixed bottom-24 left-4 right-4 bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-slate-700 flex justify-between items-center z-50">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Totale Stimato</h3>
          <p className="text-3xl font-black text-slate-800 dark:text-white">€ {totalCost.toFixed(2)}</p>
        </div>
        <div className="w-12 h-12 bg-rose-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-2xl">
          💰
        </div>
      </div>
    </div>
  );
};

export default ShoppingListView;
