
import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, WeeklyTarget } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { auth, db } from '../services/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp, doc, updateDoc } from 'firebase/firestore';

interface GoalsViewProps {
  profile: UserProfile;
}

const GoalsView: React.FC<GoalsViewProps> = ({ profile }) => {
  const targetWeight = 60.0;
  const [weightHistory, setWeightHistory] = useState<any[]>([]);
  const [newWeight, setNewWeight] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [targets, setTargets] = useState<WeeklyTarget[]>([]);
  const [isAddingTarget, setIsAddingTarget] = useState(false);
  const [newTargetName, setNewTargetName] = useState('');
  const [newTargetMin, setNewTargetMin] = useState('');
  const [newTargetMax, setNewTargetMax] = useState('');

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
    <div className="p-4 space-y-8 pb-24">
      <h1 className="text-3xl font-black tracking-tighter">Obiettivi</h1>

      {/* Weekly Frequency Section */}
      <div className="space-y-6">
        <div className="flex justify-between items-end">
           <h2 className="text-xl font-bold">Frequenza Settimanale</h2>
           <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
             Settimana {getCurrentWeekId().split('-W')[1]}
           </span>
        </div>

        {/* Pie Chart */}
        {pieData.length > 0 ? (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700 h-64 relative">
             <h3 className="absolute top-6 left-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Distribuzione Consumi</h3>
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={pieData}
                   cx="50%"
                   cy="50%"
                   innerRadius={60}
                   outerRadius={80}
                   paddingAngle={5}
                   dataKey="value"
                 >
                   {pieData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                   ))}
                 </Pie>
                 <Tooltip 
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                   itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                 />
                 <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    formatter={(value) => <span className="text-[10px] font-bold text-gray-500 uppercase ml-1">{value}</span>}
                 />
               </PieChart>
             </ResponsiveContainer>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-dashed border-gray-200 dark:border-slate-700 text-center">
            <p className="text-gray-400 text-sm italic">Inizia a tracciare i tuoi pasti per vedere il grafico!</p>
          </div>
        )}

        {/* Targets List */}
        <div className="grid grid-cols-1 gap-4">
          {targets.map((target) => {
            const isOverMax = target.current > target.max;
            const isUnderMin = target.current < target.min;
            const isOptimal = !isOverMax && !isUnderMin;
            
            return (
              <div key={target.id} className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-50 dark:border-slate-700 shadow-sm flex flex-col gap-3">
                 <div className="flex justify-between items-center">
                   <div className="flex-1">
                     <div className="flex justify-between mb-2">
                       <h3 className="font-bold text-sm text-slate-800 dark:text-white">{target.name}</h3>
                       <span className={`text-[10px] font-black uppercase tracking-widest ${
                         isOverMax ? 'text-rose-500' : isOptimal ? 'text-emerald-500' : 'text-amber-500'
                       }`}>
                         {target.current} / {target.max}
                       </span>
                     </div>
                     <div className="h-2 w-full bg-gray-100 dark:bg-slate-900 rounded-full overflow-hidden">
                       <div 
                         className={`h-full rounded-full transition-all duration-500 ${
                           isOverMax ? 'bg-rose-500' : isOptimal ? 'bg-emerald-500' : 'bg-amber-400'
                         }`}
                         style={{ width: `${Math.min(100, (target.current / target.max) * 100)}%` }}
                       />
                     </div>
                   </div>
                   
                   <div className="flex items-center gap-2 ml-4">
                     <button 
                       onClick={() => updateTargetCount(target.id, -1)}
                       className="w-8 h-8 rounded-xl bg-gray-50 dark:bg-slate-700 text-gray-400 hover:text-rose-500 font-black flex items-center justify-center transition-colors"
                       title="Correggi (Riduci)"
                     >
                       -
                     </button>
                     {/* Removed + button as requested, updates come from diet check-in */}
                   </div>
                 </div>

                 <div className="flex items-center gap-2 pt-2 border-t border-gray-50 dark:border-slate-700/50">
                    <span className="text-[9px] text-gray-400 font-medium uppercase tracking-widest">Target:</span>
                    <input 
                      type="number" 
                      value={target.min}
                      onChange={(e) => {
                         const val = parseInt(e.target.value) || 0;
                         const newTargets = targets.map(t => t.id === target.id ? { ...t, min: val } : t);
                         setTargets(newTargets);
                         if (auth.currentUser) {
                           updateDoc(doc(db, 'users', auth.currentUser.uid), { weeklyTargets: newTargets });
                         }
                      }}
                      className="w-10 bg-gray-50 dark:bg-slate-900 border border-transparent hover:border-gray-200 rounded-lg text-center text-[10px] font-bold outline-none"
                    />
                    <span className="text-[9px] text-gray-400">-</span>
                    <input 
                      type="number" 
                      value={target.max}
                      onChange={(e) => {
                         const val = parseInt(e.target.value) || 0;
                         const newTargets = targets.map(t => t.id === target.id ? { ...t, max: val } : t);
                         setTargets(newTargets);
                         if (auth.currentUser) {
                           updateDoc(doc(db, 'users', auth.currentUser.uid), { weeklyTargets: newTargets });
                         }
                      }}
                      className="w-10 bg-gray-50 dark:bg-slate-900 border border-transparent hover:border-gray-200 rounded-lg text-center text-[10px] font-bold outline-none"
                    />
                    <span className="text-[9px] text-gray-400 uppercase">volte/sett</span>
                 </div>
              </div>
            );
          })}
          
          {/* Add Custom Target Button */}
          {!isAddingTarget ? (
            <button 
              onClick={() => setIsAddingTarget(true)}
              className="w-full py-4 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-3xl text-gray-400 font-bold text-xs uppercase tracking-widest hover:border-rose-300 hover:text-rose-500 transition-colors"
            >
              + Aggiungi Alimento Personalizzato
            </button>
          ) : (
            <div className="bg-gray-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-gray-200 dark:border-slate-700 space-y-4 animate-in fade-in slide-in-from-top-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Nuovo Obiettivo</h3>
              <input 
                type="text" 
                placeholder="Nome alimento (es. Yogurt)"
                value={newTargetName}
                onChange={(e) => setNewTargetName(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 p-3 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-rose-500"
              />
              <div className="flex gap-3">
                <input 
                  type="number" 
                  placeholder="Min"
                  value={newTargetMin}
                  onChange={(e) => setNewTargetMin(e.target.value)}
                  className="flex-1 bg-white dark:bg-slate-800 p-3 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-rose-500"
                />
                <input 
                  type="number" 
                  placeholder="Max"
                  value={newTargetMax}
                  onChange={(e) => setNewTargetMax(e.target.value)}
                  className="flex-1 bg-white dark:bg-slate-800 p-3 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-rose-500"
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsAddingTarget(false)}
                  className="flex-1 py-3 bg-gray-200 dark:bg-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500"
                >
                  Annulla
                </button>
                <button 
                  onClick={addNewTarget}
                  className="flex-1 py-3 bg-rose-500 rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-rose-200 dark:shadow-none"
                >
                  Salva
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

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
