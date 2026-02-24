
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, Notification, News } from '../types';
import { auth, db } from '../services/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, addDoc, Timestamp, where } from 'firebase/firestore';

interface HomeViewProps {
  profile: UserProfile;
}

const HomeView: React.FC<HomeViewProps> = ({ profile }) => {
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [feedPosts, setFeedPosts] = useState<any[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [dailyQuote, setDailyQuote] = useState('');
  const totalWaterGoal = 10;
  const todayStr = new Date().toISOString().split('T')[0];

  const motivationalQuotes = [
    "Il successo è la somma di piccoli sforzi ripetuti giorno dopo giorno. 🥑",
    "Non fermarti quando sei stanco, fermati quando hai finito. 💪",
    "La tua salute è un investimento, non una spesa. 🥗",
    "Ogni pasto sano è una vittoria per il tuo corpo. ✨",
    "Sii la versione migliore di te stesso, un giorno alla volta. 🌟",
    "La disciplina è scegliere tra ciò che vuoi ora e ciò che vuoi di più. 🎯",
    "Il tuo corpo può sopportare quasi tutto. È la tua mente che devi convincere. 🧠",
    "Non è una dieta, è uno stile di vita. 🌿",
    "Piccoli cambiamenti portano a grandi risultati. 📈",
    "Oggi è il giorno perfetto per iniziare a stare bene. ☀️"
  ];

  useEffect(() => {
    // Scegli una frase basata sul giorno dell'anno
    const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    setDailyQuote(motivationalQuotes[dayOfYear % motivationalQuotes.length]);
  }, []);

  const daysSinceStart = useMemo(() => {
    if (!profile.dietStartDate) return null;
    const start = new Date(profile.dietStartDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [profile.dietStartDate]);

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

  // Caricamento News
  useEffect(() => {
    const q = query(collection(db, 'news'));
    const unsub = onSnapshot(q, (snap) => {
      const newsData = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as News))
        .filter(item => item.active)
        .sort((a, b) => {
          const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : (a.timestamp as any)?.seconds * 1000 || 0;
          const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : (b.timestamp as any)?.seconds * 1000 || 0;
          return timeB - timeA;
        });
      setNews(newsData);
    });
    return () => unsub();
  }, []);

  // Caricamento Notifiche
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', auth.currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      const notifs = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Notification))
        .sort((a, b) => {
          const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : (a.timestamp as any)?.seconds * 1000 || 0;
          const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : (b.timestamp as any)?.seconds * 1000 || 0;
          return timeB - timeA;
        })
        .slice(0, 20);
      setNotifications(notifs);
    });
    return () => unsub();
  }, []);

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

  const handleLike = async (post: any) => {
    if (!auth.currentUser || post.userId === auth.currentUser.uid) return;

    const postRef = doc(db, 'meals', post.id);
    const isLiked = post.likes?.includes(auth.currentUser.uid);

    try {
      if (isLiked) {
        await updateDoc(postRef, {
          likes: arrayRemove(auth.currentUser.uid)
        });
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(auth.currentUser.uid)
        });

        // Crea notifica
        await addDoc(collection(db, 'notifications'), {
          userId: post.userId,
          fromUserId: auth.currentUser.uid,
          fromUserName: profile.name,
          type: 'like',
          message: `${profile.name} ha messo mi piace al tuo pasto!`,
          read: false,
          timestamp: Timestamp.now(),
          link: post.id
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const markNotificationsAsRead = async () => {
    if (!auth.currentUser) return;
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) {
      await updateDoc(doc(db, 'notifications', n.id), { read: true });
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // Logica Streak
  useEffect(() => {
    if (!auth.currentUser || !profile.name) return;

    const checkStreak = async () => {
      const userRef = doc(db, 'users', auth.currentUser!.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      const lastStreakDate = userData?.lastStreakDate;
      const currentStreak = userData?.streak || 0;

      // Reset streak se è passato più di un giorno dall'ultimo aggiornamento
      if (lastStreakDate && lastStreakDate !== todayStr) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (lastStreakDate !== yesterdayStr) {
          await updateDoc(userRef, { streak: 0 });
        }
      }

      const todayPosts = feedPosts.filter(p => 
        p.userId === auth.currentUser?.uid && 
        p.timestamp.toDateString() === new Date().toDateString()
      );

      const isDayComplete = missingTasks.length === 0 && todayPosts.length > 0;

      if (isDayComplete) {
        if (lastStreakDate !== todayStr) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          let newStreak = 1;
          if (lastStreakDate === yesterdayStr) {
            newStreak = currentStreak + 1;
          }

          await updateDoc(userRef, {
            streak: newStreak,
            lastStreakDate: todayStr
          });
        }
      }
    };

    if (feedPosts.length > 0) {
      checkStreak();
    }
  }, [feedPosts, missingTasks, todayStr]);

  return (
    <div className="p-4 space-y-6">
      {news.length > 0 && (
        <div className="space-y-2">
          {news.map(item => (
            <div key={item.id} className={`p-4 rounded-2xl border flex items-start gap-3 shadow-sm ${
              item.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-900' :
              item.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' :
              'bg-blue-50 border-blue-100 text-blue-900'
            }`}>
              <span className="text-xl">
                {item.type === 'warning' ? '⚠️' : item.type === 'success' ? '✅' : 'ℹ️'}
              </span>
              <div className="flex-1">
                <h4 className="text-xs font-black uppercase tracking-widest mb-1">{item.title}</h4>
                <p className="text-sm font-medium opacity-80">{item.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <header className="mb-2 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Ciao, {profile.name}
          </h1>
          <div className="flex flex-col gap-1">
            <p className="text-gray-500 dark:text-gray-400 text-sm">Il tuo diario è pronto per oggi.</p>
            {daysSinceStart !== null && (
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                Giorno {daysSinceStart} della tua dieta ✨
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setShowNotifications(true);
              markNotificationsAsRead();
            }}
            className="relative w-12 h-12 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-md border border-gray-100 dark:border-slate-700"
          >
            <span className="text-xl">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                {unreadCount}
              </span>
            )}
          </button>
          {profile.avatar && (
            <div className="w-12 h-12 rounded-full border-2 border-emerald-500 overflow-hidden shadow-md">
              <img src={profile.avatar} alt="Profile" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </header>

      <AnimatePresence>
        {showNotifications && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowNotifications(false)}
          >
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-lg font-black tracking-tight">Notifiche</h3>
                <button onClick={() => setShowNotifications(false)} className="text-gray-400 font-bold text-xs uppercase">Chiudi</button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
                {notifications.length === 0 ? (
                  <div className="text-center py-10 opacity-30 italic text-sm">Nessuna notifica.</div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className={`p-4 rounded-2xl border flex items-center gap-4 ${n.read ? 'bg-gray-50 dark:bg-slate-800/50 border-transparent' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30'}`}>
                      <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center text-rose-500 text-xl">
                        {n.type === 'like' ? '❤️' : '🔔'}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-800 dark:text-gray-200">{n.message}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">
                          {new Date(n.timestamp as any).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 p-4 rounded-3xl">
        <p className="text-sm font-medium text-rose-800 dark:text-rose-200 italic text-center">
          "{dailyQuote}"
        </p>
      </div>

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

      <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-6 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden">
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
        <div className="flex justify-between items-center mb-6 relative z-10">
          <div>
            <h3 className="text-lg font-black tracking-tight">Idratazione</h3>
            <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest opacity-80">Target: {totalWaterGoal * 250}ml</p>
          </div>
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl">
            💧
          </div>
        </div>
        <div className="space-y-4 relative z-10">
          <div className="flex gap-1">
            {[...Array(totalWaterGoal)].map((_, i) => (
              <motion.div 
                key={i} 
                initial={false}
                animate={{ 
                  backgroundColor: i < waterGlasses ? '#ffffff' : 'rgba(255, 255, 255, 0.2)',
                  scale: i === waterGlasses - 1 ? [1, 1.2, 1] : 1
                }}
                transition={{ duration: 0.3 }}
                className="h-2.5 flex-1 rounded-full shadow-inner" 
              />
            ))}
          </div>
          <div className="flex justify-between items-center">
            <AnimatePresence mode="wait">
              <motion.div 
                key={waterGlasses}
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 10, opacity: 0 }}
                className="flex items-baseline gap-1"
              >
                <span className="text-2xl font-black">{waterGlasses * 250}</span>
                <span className="text-xs font-bold opacity-70">ml</span>
              </motion.div>
            </AnimatePresence>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={addGlass} 
              className="bg-white text-blue-600 px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:shadow-none transition-all"
            >
              +250ml
            </motion.button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6">Parametri Fisici</h3>
        <div className="grid grid-cols-1 xs:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Peso Attuale</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-800 dark:text-white">{profile.weight || '--'}</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">kg</span>
              </div>
            </div>
            <div className="h-2 w-full bg-gray-50 dark:bg-slate-900 rounded-full overflow-hidden border border-gray-50 dark:border-slate-800">
              <div className="h-full bg-rose-500 rounded-full transition-all duration-1000" style={{ width: `${weightProgress}%` }} />
            </div>
          </div>
          <div className="space-y-3 pt-4 xs:pt-0 xs:border-l xs:border-gray-50 xs:dark:border-slate-700 xs:pl-6">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Indice BMI</span>
              <span className="text-2xl font-black text-slate-800 dark:text-white">{profile.bmi || '--'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${bmiStatus.color.replace('text-', 'bg-')}`} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${bmiStatus.color}`}>{bmiStatus.label}</span>
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
                          <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center font-bold text-rose-500 text-xs overflow-hidden">
                            {post.userAvatar ? (
                              <img src={post.userAvatar} alt={post.userName} className="w-full h-full object-cover" />
                            ) : (
                              post.userName?.[0]
                            )}
                          </div>
                          <div className="flex-1">
                            <span className="font-bold block text-xs">{post.userName}</span>
                            <span className="text-[9px] text-gray-400 uppercase font-bold">
                              {post.timestamp.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <img src={post.image} className="w-full h-48 object-cover" alt="Meal" />
                        <div className="p-4">
                          <p className="text-sm text-gray-800 dark:text-gray-200 mb-4">{post.description}</p>
                          <div className="flex items-center justify-between">
                            <button 
                              onClick={() => handleLike(post)}
                              disabled={post.userId === auth.currentUser?.uid}
                              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                post.likes?.includes(auth.currentUser?.uid) 
                                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' 
                                  : 'bg-gray-50 dark:bg-slate-700 text-gray-400'
                              } ${post.userId === auth.currentUser?.uid ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                            >
                              <span>{post.likes?.includes(auth.currentUser?.uid) ? '❤️' : '🤍'}</span>
                              <span>{post.likes?.length || 0}</span>
                            </button>
                            <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{post.mealType}</span>
                          </div>
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
