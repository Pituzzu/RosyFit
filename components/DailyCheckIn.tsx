import React, { useState, useEffect, useMemo } from 'react';
import { GymSettings } from '../types';

interface DailyCheckInProps {
  onClose: () => void;
  gymSettings: GymSettings;
}

interface Question {
  id: string;
  text: string;
  icon: string;
}

const DailyCheckIn: React.FC<DailyCheckInProps> = ({ onClose, gymSettings }) => {
  const [isAnswering, setIsAnswering] = useState<'yes' | 'no' | null>(null);
  const [answeredIds, setAnsweredIds] = useState<string[]>([]);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const hour = new Date().getHours();

  const allPossibleQuestions: Question[] = useMemo(() => {
    const q: Question[] = [];
    if (hour >= 6 && hour < 11) q.push({ id: 'breakfast', text: "Hai fatto colazione?", icon: '☕' });
    if (hour >= 11 && hour < 13) q.push({ id: 'snack_morning', text: "Hai fatto lo spuntino?", icon: '🍎' });
    if (hour >= 13 && hour < 16) q.push({ id: 'lunch', text: "Hai pranzato?", icon: '🥗' });
    if (hour >= 16 && hour < 19) q.push({ id: 'snack_afternoon', text: "Hai fatto merenda?", icon: '🍌' });
    if (hour >= 19 && hour < 23) q.push({ id: 'dinner', text: "Hai cenato?", icon: '🍲' });
    
    const dayName = new Intl.DateTimeFormat('it-IT', { weekday: 'long' }).format(new Date());
    const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    
    if (gymSettings.isActive && gymSettings.days.includes(capitalizedDay)) {
       q.push({ id: 'gym', text: "Sei andata in palestra?", icon: '💪' });
       q.push({ id: 'post_workout', text: "Hai fatto il post-workout?", icon: '🥤' });
    }

    q.push({ id: 'water', text: "Hai bevuto abbastanza acqua oggi?", icon: '💧' });
    return q;
  }, [hour, gymSettings]);

  useEffect(() => {
    const stored = localStorage.getItem('rosyfit_answers_v2');
    if (stored) {
      try {
        const { date, done, skipped } = JSON.parse(stored);
        if (date === todayStr) {
          setAnsweredIds(done || []);
          setSkippedIds(skipped || []);
        } else {
          localStorage.removeItem('rosyfit_answers_v2');
        }
      } catch (e) {
        localStorage.removeItem('rosyfit_answers_v2');
      }
    }
    setIsInitialized(true);
  }, [todayStr]);

  const remainingQuestions = useMemo(() => {
    return allPossibleQuestions.filter(q => !answeredIds.includes(q.id) && !skippedIds.includes(q.id));
  }, [allPossibleQuestions, answeredIds, skippedIds]);

  useEffect(() => {
    if (isInitialized && remainingQuestions.length === 0) {
      onClose();
    }
  }, [isInitialized, remainingQuestions.length, onClose]);

  const handleAnswer = (questionId: string, type: 'yes' | 'no') => {
    if (isAnswering) return;
    setIsAnswering(type);

    setTimeout(() => {
      let nextDone = [...answeredIds];
      let nextSkipped = [...skippedIds];

      if (type === 'yes') {
        nextDone.push(questionId);
      } else {
        nextSkipped.push(questionId);
      }

      setAnsweredIds(nextDone);
      setSkippedIds(nextSkipped);
      
      localStorage.setItem('rosyfit_answers_v2', JSON.stringify({
        date: todayStr,
        done: nextDone,
        skipped: nextSkipped
      }));

      setIsAnswering(null);
    }, 600);
  };

  if (!isInitialized || remainingQuestions.length === 0) return null;

  const currentQuestion = remainingQuestions[0];

  return (
    <div className="fixed inset-0 z-50 bg-rose-500 flex flex-col items-center justify-center p-6 text-white text-center animate-in fade-in duration-500">
      <div className="w-full max-w-md">
        <div className={`transition-all duration-300 ${isAnswering ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
           <div className="text-6xl mb-6">{currentQuestion.icon}</div>
           <h2 className="text-3xl font-black mb-12 leading-tight">
            {currentQuestion.text}
          </h2>
        </div>
        
        <div className="flex flex-col gap-4">
          <button 
            disabled={!!isAnswering}
            onClick={() => handleAnswer(currentQuestion.id, 'yes')}
            className={`w-full font-black py-5 rounded-3xl text-xl shadow-xl transition-all ${
              isAnswering === 'yes' ? 'bg-green-400 text-white scale-105' : 'bg-white text-rose-500 active:scale-95'
            }`}
          >
            {isAnswering === 'yes' ? '✅ Grandiosa!' : 'Sì, fatto!'}
          </button>

          <button 
            disabled={!!isAnswering}
            onClick={() => handleAnswer(currentQuestion.id, 'no')}
            className={`w-full font-bold py-4 rounded-2xl text-lg transition-all ${
              isAnswering === 'no' ? 'bg-rose-700 text-white' : 'bg-rose-400/50 text-white active:scale-95'
            }`}
          >
            {isAnswering === 'no' ? '⏳ Lo farò dopo' : 'Non ancora'}
          </button>
        </div>

        <p className="mt-12 text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
          Progresso: {answeredIds.length + skippedIds.length + 1} / {allPossibleQuestions.length}
        </p>
      </div>
      
      <button 
        onClick={onClose}
        className="absolute top-10 right-6 text-white/50 font-bold text-xs uppercase tracking-widest"
      >
        Chiudi
      </button>
    </div>
  );
};

export default DailyCheckIn;