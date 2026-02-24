
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { auth, db } from '../services/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';

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
    const waterRef = doc(db, 'dailyStats', `${auth.currentUser.uid}_${todayStr}`);
    const unsub = onSnapshot(waterRef, (snap) => {
      if (snap.exists()) {
        setWaterGlasses(snap.data().water || 0);
      }
    });
    return () => unsub();
  }, [todayStr]);

  // Caricamento Post Reali
  useEffect(() => {
    const q = query(collection(db, 'meals'), orderBy('timestamp', 'desc'), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      const posts = snap.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          timestamp: data.timestamp?.toDate() || new Date()
        };
      });
      setFeedPosts(posts);
    });
    return () => unsub();
  }, []);

  const groupedPosts = useMemo(() => {
    const groups: Record<string, Record<string, any[]>> = {};

    feedPosts.forEach(post => {
      const dateKey = post.timestamp.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const mealType = post.type || 'Altro';

      if (!groups[dateKey]) groups[dateKey] = {};
      if (!groups[dateKey][mealType]) groups[dateKey][mealType] = [];
      
      groups[dateKey][mealType].push(post);
    });

    return groups;
  }, [feedPosts]);

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
      const waterRef = doc(db, 'dailyStats', `${auth.currentUser.uid}_${todayStr}`);
      await setDoc(waterRef, { water: nextCount, date: todayStr }, { merge: true });
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
                <motion.div 
                  key={i} 
                  initial={false}
                  animate={{ 
                    backgroundColor: i < waterGlasses ? '#ffffff' : 'rgba(147, 197, 253, 0.4)',
                    scale: i === waterGlasses - 1 ? [1, 1.2, 1] : 1
                  }}
                  transition={{ duration: 0.3 }}
                  className="h-2 flex-1 rounded-full" 
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <AnimatePresence mode="wait">
                <motion.p 
                  key={waterGlasses}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm font-medium"
                >
                  {waterGlasses * 250}ml registrati
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={addGlass} 
            className="bg-white text-blue-600 p-2 px-4 rounded-xl font-bold shadow-md transition-transform"
          >
            +250ml
          </motion.button>
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

      <h2 className="text-xl font-bold">Diario Alimentare</h2>
      <div className="space-y-10">
        {Object.keys(groupedPosts).length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-3xl">
            <p className="text-gray-400 text-sm italic">Ancora nessun post. Inizia a fotografare i tuoi pasti!</p>
          </div>
        ) : (
          Object.entries(groupedPosts).map(([date, mealGroups]) => (
            <div key={date} className="space-y-6">
              <div className="sticky top-0 z-20 bg-gray-50/80 dark:bg-slate-900/80 backdrop-blur-sm py-2">
                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-rose-500 border-b border-rose-100 dark:border-rose-900/30 pb-1">
                  {date}
                </h3>
              </div>
              
              {Object.entries(mealGroups).map(([mealType, posts]) => (
                <div key={mealType} className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-2">
                    {mealType}
                  </h4>
                  <div className="grid grid-cols-1 gap-4">
                    {posts.map((post) => (
                      <div key={post.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-slate-700 group">
                        <div className="p-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center font-bold text-rose-500 text-xs">{post.userName?.[0]}</div>
                          <div className="flex-1">
                            <span className="font-bold block text-xs">{post.userName}</span>
                            <span className="text-[9px] text-gray-400 uppercase font-bold">
                              {post.timestamp.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <img src={post.image} className="w-full h-48 object-cover" alt="Meal" />
                        <div className="p-4">
                          <p className="text-sm text-gray-800 dark:text-gray-200">{post.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HomeView;
