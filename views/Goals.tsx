
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { auth, db } from '../services/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';

interface GoalsViewProps {
  profile: UserProfile;
}

const GoalsView: React.FC<GoalsViewProps> = ({ profile }) => {
  const targetWeight = 60.0;
  const [weightHistory, setWeightHistory] = useState<any[]>([]);
  const [newWeight, setNewWeight] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'users', auth.currentUser.uid, 'weights'),
      orderBy('date', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(doc => {
        const date = new Date(doc.data().date.seconds * 1000);
        return {
          id: doc.id,
          name: date.toLocaleDateString('it-IT', { weekday: 'short' }),
          fullDate: date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          weight: doc.data().value
        };
      });
      setWeightHistory(history);
    });

    return () => unsubscribe();
  }, []);

  const addWeight = async () => {
    if (!newWeight || isNaN(parseFloat(newWeight)) || !auth.currentUser) return;
    setIsAdding(true);
    try {
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'weights'), {
        value: parseFloat(newWeight),
        date: Timestamp.now()
      });
      setNewWeight('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsAdding(false);
    }
  };

  const deleteWeight = async (id: string) => {
    if (!auth.currentUser || !window.confirm("Vuoi eliminare questa misurazione?")) return;
    try {
      const { deleteDoc, doc: firestoreDoc } = await import('firebase/firestore');
      await deleteDoc(firestoreDoc(db, 'users', auth.currentUser.uid, 'weights', id));
    } catch (e) {
      console.error(e);
    }
  };

  const currentWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : profile.weight;
  const startWeight = 70.0;
  const progress = Math.min(100, Math.max(0, ((startWeight - currentWeight) / (startWeight - targetWeight)) * 100));

  return (
    <div className="p-4 space-y-6 pb-20">
      <h1 className="text-3xl font-black tracking-tighter">Obiettivi</h1>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <div className="space-y-1">
            <h3 className="font-black text-[10px] uppercase tracking-widest text-emerald-500">Consistenza</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-800 dark:text-white">{profile.streak || 0}</span>
              <span className="text-xs font-bold text-gray-400 uppercase">Giorni</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center text-2xl">
            🔥
          </div>
        </div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
          Completa tutti i pasti e carica una foto ogni giorno per aumentare la tua serie!
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700">
        <p className="text-sm font-medium text-slate-600 dark:text-gray-300 mb-6 italic leading-relaxed">
          "Il tuo peso è cambiato? Segnalo e tieni traccia del tuo stato di avanzamento"
        </p>
        <div className="flex justify-between items-center mb-4">
          <div className="space-y-1">
            <h3 className="font-black text-[10px] uppercase tracking-widest text-gray-400">Peso Obiettivo</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-800 dark:text-white">{targetWeight}</span>
              <span className="text-xs font-bold text-gray-400 uppercase">kg</span>
            </div>
          </div>
          <div className="text-right">
            <h3 className="font-black text-[10px] uppercase tracking-widest text-gray-400 mb-1">Progresso</h3>
            <p className="text-4xl font-black text-rose-500 tabular-nums">{Math.round(progress)}%</p>
          </div>
        </div>
        <div className="h-3 w-full bg-gray-50 dark:bg-slate-900 rounded-full overflow-hidden border border-gray-100 dark:border-slate-800">
          <div 
            className="h-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-1000 ease-out rounded-full shadow-[0_0_10px_rgba(244,63,94,0.3)]" 
            style={{ width: `${progress}%` }} 
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-slate-700">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6">Trend Settimanale</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weightHistory.length > 0 ? weightHistory : [{name: 'Nessun dato', weight: 0}]}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
              <XAxis 
                dataKey="name" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
                tick={{ fill: '#94a3b8' }}
                dy={10}
              />
              <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '20px', 
                  border: 'none', 
                  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  padding: '12px'
                }}
                itemStyle={{ color: '#f43f5e', fontWeight: '900', fontSize: '14px' }}
                labelStyle={{ color: '#64748b', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0] && payload[0].payload.fullDate) {
                    return payload[0].payload.fullDate;
                  }
                  return label;
                }}
              />
              <Line 
                type="monotone" 
                dataKey="weight" 
                stroke="#f43f5e" 
                strokeWidth={4} 
                dot={{ r: 4, fill: '#f43f5e', strokeWidth: 2, stroke: '#fff' }} 
                activeDot={{ r: 8, strokeWidth: 0 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Variazioni Recenti</h3>
          <span className="text-[10px] font-bold text-rose-500 uppercase">Ultimi 3</span>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          {weightHistory.slice(-3).reverse().map((entry, idx) => (
            <div key={entry.id || idx} className="bg-white dark:bg-slate-800 p-5 rounded-3xl flex justify-between items-center border border-gray-50 dark:border-slate-700 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-500">
                  <span className="text-xs">⚖️</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-500 dark:text-gray-400">{entry.fullDate}</span>
                  <button 
                    onClick={() => deleteWeight(entry.id)}
                    className="text-[8px] font-black uppercase text-rose-400 text-left hover:text-rose-600 transition-colors"
                  >
                    Elimina
                  </button>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black text-slate-800 dark:text-white">{entry.weight}</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">kg</span>
              </div>
            </div>
          ))}
        </div>
        
        <div className="pt-2">
          <div className="bg-white dark:bg-slate-800 p-2 rounded-[2rem] border border-gray-100 dark:border-slate-700 shadow-inner flex items-center gap-2">
            <input 
              type="number" 
              inputMode="decimal"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              placeholder="Inserisci peso..."
              className="flex-1 bg-transparent px-4 py-3 outline-none font-bold text-sm placeholder:text-gray-300 dark:placeholder:text-slate-600"
            />
            <button 
              onClick={addWeight}
              disabled={isAdding}
              className="bg-rose-500 hover:bg-rose-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-rose-200 dark:shadow-none transition-all active:scale-95 disabled:opacity-50"
            >
              {isAdding ? '...' : 'Salva'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoalsView;
