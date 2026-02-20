
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { auth, db } from '../services/firebase';
import firebase from 'firebase/compat/app';

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
    const q = db.collection('users').doc(auth.currentUser.uid).collection('weights').orderBy('date', 'asc');

    const unsubscribe = q.onSnapshot((snapshot) => {
      const history = snapshot.docs.map(doc => ({
        name: new Date(doc.data().date.seconds * 1000).toLocaleDateString('it-IT', { weekday: 'short' }),
        weight: doc.data().value
      }));
      setWeightHistory(history);
    });

    return () => unsubscribe();
  }, []);

  const addWeight = async () => {
    if (!newWeight || isNaN(parseFloat(newWeight)) || !auth.currentUser) return;
    setIsAdding(true);
    try {
      await db.collection('users').doc(auth.currentUser.uid).collection('weights').add({
        value: parseFloat(newWeight),
        date: firebase.firestore.Timestamp.now()
      });
      setNewWeight('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsAdding(false);
    }
  };

  const currentWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : profile.weight;
  const startWeight = 70.0;
  const progress = Math.min(100, Math.max(0, ((startWeight - currentWeight) / (startWeight - targetWeight)) * 100));

  return (
    <div className="p-4 space-y-6 pb-20">
      <h1 className="text-3xl font-black tracking-tighter">Obiettivi</h1>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h3 className="font-black text-[10px] uppercase tracking-widest text-gray-400">Target Weight</h3>
            <p className="text-sm font-bold">{targetWeight} kg</p>
          </div>
          <p className="text-3xl font-black text-rose-500">{Math.round(progress)}%</p>
        </div>
        <div className="h-4 w-full bg-gray-50 dark:bg-slate-900 rounded-full overflow-hidden">
          <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] h-80 border border-gray-100 dark:border-slate-700">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6">Trend Settimanale</h3>
        <ResponsiveContainer width="100%" height="80%">
          <LineChart data={weightHistory.length > 0 ? weightHistory : [{name: 'Nessun dato', weight: 0}]}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
            <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
            <Line type="monotone" dataKey="weight" stroke="#f43f5e" strokeWidth={4} dot={{ r: 4, fill: '#f43f5e' }} activeDot={{ r: 8 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <input 
            type="number" 
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            placeholder="Peso (kg)"
            className="flex-1 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 p-4 rounded-2xl font-bold"
          />
          <button 
            onClick={addWeight}
            disabled={isAdding}
            className="bg-rose-500 text-white px-8 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-rose-200"
          >
            {isAdding ? '...' : 'Aggiungi'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoalsView;
