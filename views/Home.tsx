
import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile } from '../types';
import { auth, db } from '../services/firebase';

interface HomeViewProps {
  profile: UserProfile;
}

const HomeView: React.FC<HomeViewProps> = ({ profile }) => {
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [feedPosts, setFeedPosts] = useState<any[]>([]);
  const totalWaterGoal = 10;
  const todayStr = new Date().toISOString().split('T')[0];

  const taskMap: Record<string, { label: string, icon: string }> = {
    breakfast: { label: 'Colazione', icon: '☕' },
    snack_morning: { label: 'Spuntino', icon: '🍎' },
    lunch: { label: 'Pranzo', icon: '🥗' },
    snack_afternoon: { label: 'Merenda', icon: '🍌' },
    dinner: { label: 'Cena', icon: '🍲' },
    gym: { label: 'Palestra', icon: '💪' },
    post_workout: { label: 'Post-Workout', icon: '🥤' },
    water: { label: 'Acqua', icon: '💧' },
  };

  // Sincronizzazione Acqua con Firestore
  useEffect(() => {
    if (!auth.currentUser) return;
    const waterRef = db.collection('dailyStats').doc(`${auth.currentUser.uid}_${todayStr}`);
    const unsub = waterRef.onSnapshot((snap) => {
      if (snap.exists) {
        setWaterGlasses(snap.data()?.water || 0);
      }
    });
    return () => unsub();
  }, [todayStr]);

  // Caricamento Post Reali
  useEffect(() => {
    const q = db.collection('meals').orderBy('timestamp', 'desc').limit(5);
    const unsub = q.onSnapshot((snap) => {
      const posts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFeedPosts(posts);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const checkSkippedTasks = () => {
      const stored = localStorage.getItem('rosyfit_answers_v2');
      if (stored) {
        try {
          const { date, skipped } = JSON.parse(stored);
          if (date === todayStr) {
            setSkippedIds(skipped || []);
          }
        } catch (e) {
          setSkippedIds([]);
        }
      }
    };
    checkSkippedTasks();
    const interval = setInterval(checkSkippedTasks, 5000);
    return () => clearInterval(interval);
  }, [todayStr]);

  const missingTasks = useMemo(() => {
    return skippedIds
      .map(id => ({ id, ...taskMap[id] }))
      .filter(t => t.label);
  }, [skippedIds]);
  
  const targetWeight = 60.0;
  const startWeight = profile.weight > 0 ? profile.weight : 70.0;
  const weightProgress = profile.weight > 0 ? Math.min(100, Math.max(0, ((startWeight - profile.weight) / (startWeight - targetWeight)) * 100)) : 0;

  const addGlass = async () => {
    if (waterGlasses < totalWaterGoal && auth.currentUser) {
      const nextCount = waterGlasses + 1;
      setWaterGlasses(nextCount);
      const waterRef = db.collection('dailyStats').doc(`${auth.currentUser.uid}_${todayStr}`);
      await waterRef.set({ water: nextCount, date: todayStr }, { merge: true });
    }
  };

  const getBMICategory = (bmi: number) => {
    if (bmi === 0) return { label: 'N/A', color: 'text-gray-400' };
    if (bmi < 18.5) return { label: 'Sottopeso', color: 'text-amber-500' };
    if (bmi < 25) return { label: 'Normopeso', color: 'text-green-500' };
    if (bmi < 30) return { label: 'Sovrappeso', color: 'text-orange-500' };
    return { label: 'Obeso', color: 'text-red-500' };
  };

  const bmiStatus = getBMICategory(profile.bmi);

  return (
    <div className="p-4 space-y-6">
      <header className="mb-2">
        <h1 className="text-2xl font-bold">Ciao, {profile.name} 👋</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Il tuo diario è pronto per oggi.</p>
      </header>

      {missingTasks.length > 0 && (
        <div className="animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-500 dark:text-orange-400 flex items-center gap-2">
              <span className="animate-pulse text-lg">⚠️</span> Attività in attesa
            </h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {missingTasks.map((task) => (
              <div key={task.id} className="flex-shrink-0 bg-white dark:bg-slate-800 border border-orange-100 dark:border-orange-900/30 p-4 rounded-[2rem] min-w-[110px] shadow-sm flex flex-col items-center text-center gap-2">
                <span className="text-2xl">{task.icon}</span>
                <span className="text-[10px] font-black uppercase tracking-tighter text-slate-800 dark:text-gray-200 leading-none">{task.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-blue-400 to-blue-600 p-6 rounded-3xl shadow-lg text-white">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-bold">Idratazione</h3>
            <p className="text-blue-100 text-xs">Target: {totalWaterGoal * 250}ml</p>
          </div>
          <span className="text-3xl">💧</span>
        </div>
        <div className="flex justify-between items-end gap-2">
          <div className="flex-1">
            <div className="flex gap-1.5 mb-2">
              {[...Array(totalWaterGoal)].map((_, i) => (
                <div key={i} className={`h-2 flex-1 rounded-full ${i < waterGlasses ? 'bg-white' : 'bg-blue-300/40'}`} />
              ))}
            </div>
            <p className="text-sm font-medium">{waterGlasses * 250}ml registrati</p>
          </div>
          <button onClick={addGlass} className="bg-white text-blue-600 p-2 px-4 rounded-xl font-bold shadow-md active:scale-90 transition-transform">+250ml</button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Parametri Fisici</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Peso</span>
              <span className="text-lg font-black text-slate-800 dark:text-white">{profile.weight || '--'} kg</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${weightProgress}%` }} />
            </div>
          </div>
          <div className="space-y-2 border-l border-gray-50 dark:border-slate-700 pl-4">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-gray-400 uppercase">BMI</span>
              <span className="text-lg font-black text-slate-800 dark:text-white">{profile.bmi || '--'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-black uppercase tracking-tighter ${bmiStatus.color}`}>{bmiStatus.label}</span>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold">Foto Recenti</h2>
      <div className="space-y-6">
        {feedPosts.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-3xl">
            <p className="text-gray-400 text-sm italic">Ancora nessun post. Inizia a fotografare i tuoi pasti!</p>
          </div>
        ) : (
          feedPosts.map((post) => (
            <div key={post.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-slate-700 group">
              <div className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center font-bold text-rose-500">{post.userName?.[0]}</div>
                <div className="flex-1">
                  <span className="font-bold block text-sm">{post.userName}</span>
                  <span className="text-[10px] text-gray-400 uppercase font-bold">{post.time}</span>
                </div>
              </div>
              <img src={post.image} className="w-full h-64 object-cover" alt="Meal" />
              <div className="p-4">
                <p className="text-sm text-gray-800 dark:text-gray-200">{post.description}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HomeView;
