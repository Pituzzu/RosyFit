
import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, WeeklyTarget } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { auth, db } from '../services/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';

interface GoalsViewProps {
  profile: UserProfile;
}

const GoalsView: React.FC<GoalsViewProps> = ({ profile }) => {
  const targetWeight = profile.targetWeight || 60.0;
  const [weightHistory, setWeightHistory] = useState<any[]>([]);
  const [newWeight, setNewWeight] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [targets, setTargets] = useState<WeeklyTarget[]>([]);
  const [isAddingTarget, setIsAddingTarget] = useState(false);
  const [newTargetName, setNewTargetName] = useState('');
  const [newTargetMin, setNewTargetMin] = useState('');
  const [newTargetMax, setNewTargetMax] = useState('');
  const [weightToDelete, setWeightToDelete] = useState<string | null>(null);

  // Default targets configuration
  const defaultTargets: WeeklyTarget[] = [
    { id: 'white_meat', name: 'Carne bianca', min: 2, max: 3, current: 0 },
    { id: 'red_meat', name: 'Carne rossa', min: 1, max: 2, current: 0 },
    { id: 'fish', name: 'Pesce', min: 3, max: 4, current: 0 },
    { id: 'eggs', name: 'Uova', min: 3, max: 4, current: 0 },
    { id: 'cheese', name: 'Formaggi', min: 1, max: 1, current: 0 },
    { id: 'legumes', name: 'Legumi', min: 1, max: 2, current: 0 },
    { id: 'processed', name: 'Prodotti trasformati', min: 0, max: 2, current: 0 },
  ];

  // Helper to get current week ID (e.g., "2024-W20")
  const getCurrentWeekId = () => {
    const now = new Date();
    const onejan = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil((((now.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${week}`;
  };

  // Initialize or Sync Targets
  useEffect(() => {
    if (!profile || !auth.currentUser) return;

    const currentWeek = getCurrentWeekId();
    let currentTargets = profile.weeklyTargets || [];
    let needsUpdate = false;

    // Check for weekly reset
    if (profile.lastTargetUpdateWeek !== currentWeek) {
      // Reset counts for new week
      currentTargets = currentTargets.map(t => ({ ...t, current: 0 }));
      
      // If no targets exist yet, use defaults
      if (currentTargets.length === 0) {
        currentTargets = defaultTargets;
      }
      
      needsUpdate = true;
    } else if (currentTargets.length === 0) {
       // First time initialization if empty
       currentTargets = defaultTargets;
       needsUpdate = true;
    }

    if (needsUpdate) {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      updateDoc(userRef, {
        weeklyTargets: currentTargets,
        lastTargetUpdateWeek: currentWeek
      }).catch(console.error);
    }
    
    setTargets(currentTargets);
  }, [profile]);

  // Update local state when profile changes (e.g. from other devices)
  useEffect(() => {
    if (profile.weeklyTargets) {
      setTargets(profile.weeklyTargets);
    }
  }, [profile.weeklyTargets]);

  const updateTargetCount = async (targetId: string, increment: number) => {
    if (!auth.currentUser) return;
    
    const newTargets = targets.map(t => {
      if (t.id === targetId) {
        const newCount = Math.max(0, t.current + increment);
        return { ...t, current: newCount };
      }
      return t;
    });

    setTargets(newTargets); // Optimistic update

    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userRef, {
      weeklyTargets: newTargets
    });
  };

  const addNewTarget = async () => {
    if (!newTargetName || !newTargetMax || !auth.currentUser) return;
    
    const newTarget: WeeklyTarget = {
      id: `custom_${Date.now()}`,
      name: newTargetName,
      min: newTargetMin ? parseInt(newTargetMin) : 0,
      max: parseInt(newTargetMax),
      current: 0
    };

    const newTargets = [...targets, newTarget];
    setTargets(newTargets);
    
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userRef, {
      weeklyTargets: newTargets
    });

    setIsAddingTarget(false);
    setNewTargetName('');
    setNewTargetMin('');
    setNewTargetMax('');
  };

  // Pie Chart Data
  const pieData = useMemo(() => {
    return targets
      .filter(t => t.current > 0)
      .map(t => ({
        name: t.name,
        value: t.current
      }));
  }, [targets]);

  const COLORS = ['#f43f5e', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'];

  // ... (existing useEffect for weight history)
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
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'weights', id));
      setWeightToDelete(null);
    } catch (e) {
      console.error(e);
    }
  };

  const currentWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : (profile.weight || 0);
  const startWeight = 70.0;
  const progress = Math.min(100, Math.max(0, ((startWeight - currentWeight) / (startWeight - targetWeight)) * 100)) || 0;

  return (
    <div className="p-4 space-y-8 pb-24">
      <h1 className="text-3xl font-black tracking-tighter">Obiettivi</h1>

      {/* Existing Weight Section */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700 mt-8">
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
              <input 
                type="number" 
                value={targetWeight}
                onChange={async (e) => {
                  const val = parseFloat(e.target.value) || 0;
                  if (auth.currentUser) {
                    await updateDoc(doc(db, 'users', auth.currentUser.uid), { targetWeight: val });
                  }
                }}
                className="text-2xl font-black text-slate-800 dark:text-white bg-transparent w-20 outline-none border-b border-transparent focus:border-rose-500"
              />
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
                    onClick={() => setWeightToDelete(entry.id)}
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

      {weightToDelete && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl">
            <h3 className="text-lg font-black tracking-tight mb-2 text-center">Elimina Misurazione</h3>
            <p className="text-sm text-gray-500 text-center mb-6">Sei sicuro di voler eliminare questa misurazione del peso?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setWeightToDelete(null)}
                className="flex-1 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest bg-gray-100 dark:bg-slate-800 text-gray-500"
              >
                Annulla
              </button>
              <button 
                onClick={() => deleteWeight(weightToDelete!)}
                className="flex-1 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest bg-rose-500 text-white shadow-lg shadow-rose-200 dark:shadow-none"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalsView;
