
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../services/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { GameScore } from '../types';

const Leaderboard: React.FC = () => {
  const [scores, setScores] = useState<GameScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'gameScores'), orderBy('score', 'desc'), limit(10));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      } as GameScore));
      setScores(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 shadow-sm border border-gray-100 dark:border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Classifica Healthy Crush</h3>
        <span className="text-xl">🏆</span>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : scores.length === 0 ? (
          <p className="text-center py-4 text-xs text-gray-400 italic">Ancora nessun punteggio. Sii il primo!</p>
        ) : (
          scores.map((s, i) => (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              key={s.id} 
              className={`flex items-center gap-4 p-3 rounded-2xl ${i === 0 ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30' : 'bg-gray-50 dark:bg-slate-900/50'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                i === 0 ? 'bg-amber-400 text-white' : 
                i === 1 ? 'bg-slate-300 text-slate-600' : 
                i === 2 ? 'bg-orange-300 text-orange-700' : 
                'bg-gray-200 text-gray-500'
              }`}>
                {i + 1}
              </div>
              <div className="flex-1">
                <span className="font-bold text-sm block text-slate-800 dark:text-white truncate max-w-[120px]">{s.userName}</span>
                <span className="text-[9px] text-gray-400 uppercase font-bold">
                  {s.timestamp.toLocaleDateString('it-IT')}
                </span>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-rose-500">{s.score}</span>
                <span className="text-[9px] font-bold text-gray-400 uppercase block">Punti</span>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
