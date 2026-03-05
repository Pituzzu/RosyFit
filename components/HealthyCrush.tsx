
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../services/firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot, Timestamp, getDocs, where } from 'firebase/firestore';
import { GameScore } from '../types';

import { sendNotification } from '../services/notifications';

interface HealthyCrushProps {
  userName: string;
  onClose: () => void;
}

const WIDTH = 6;
const HEIGHT = 6;
const HEALTHY = ['🍎', '🥦', '🍌', '🍓', '🥑', '🍗'];
const JUNK = ['🍟', '🍩', '🍕', '🍔'];
const ALL_FOODS = [...HEALTHY, ...JUNK];

const HealthyCrush: React.FC<HealthyCrushProps> = ({ userName, onClose }) => {
  const [score, setScore] = useState(0);
  const [fatLevel, setFatLevel] = useState(0);
  const [gameTargets, setGameTargets] = useState<{ emoji: string, goal: number, collected: number }[]>([]);
  const [hintsRemaining, setHintsRemaining] = useState(3);
  const [reductionsRemaining, setReductionsRemaining] = useState(2);
  const [shufflesRemaining, setShufflesRemaining] = useState(2);
  const [grid, setGrid] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [gameState, setGameState] = useState<'rules' | 'playing' | 'won' | 'lost'>('rules');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [hintIndices, setHintIndices] = useState<number[]>([]);
  const [isShuffling, setIsShuffling] = useState(false);

  const touchStart = useRef<{ x: number, y: number } | null>(null);

  const checkInitialMatch = (index: number, food: string, currentGrid: string[]) => {
    const x = index % WIDTH;
    const y = Math.floor(index / WIDTH);
    if (x >= 2 && currentGrid[index - 1] === food && currentGrid[index - 2] === food) return true;
    if (y >= 2 && currentGrid[index - WIDTH] === food && currentGrid[index - WIDTH * 2] === food) return true;
    return false;
  };

  const generateRandomTargets = () => {
    const pool = [...HEALTHY];
    const targets = [];
    for (let i = 0; i < 3; i++) {
      const randomIndex = Math.floor(Math.random() * pool.length);
      const emoji = pool.splice(randomIndex, 1)[0];
      targets.push({ emoji, goal: 10, collected: 0 });
    }
    setGameTargets(targets);
  };

  const findMatches = (currentGrid: string[]) => {
    const matches = new Set<number>();
    // Horizontal
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH - 2; x++) {
        const idx = y * WIDTH + x;
        const food = currentGrid[idx];
        if (food && currentGrid[idx + 1] === food && currentGrid[idx + 2] === food) {
          matches.add(idx); matches.add(idx + 1); matches.add(idx + 2);
        }
      }
    }
    // Vertical
    for (let x = 0; x < WIDTH; x++) {
      for (let y = 0; y < HEIGHT - 2; y++) {
        const idx = y * WIDTH + x;
        const food = currentGrid[idx];
        if (food && currentGrid[idx + WIDTH] === food && currentGrid[idx + WIDTH * 2] === food) {
          matches.add(idx); matches.add(idx + WIDTH); matches.add(idx + WIDTH * 2);
        }
      }
    }
    return Array.from(matches);
  };

  const checkPotentialMatch = (idx1: number, idx2: number, currentGrid: string[]) => {
    const tempGrid = [...currentGrid];
    const temp = tempGrid[idx1];
    tempGrid[idx1] = tempGrid[idx2];
    tempGrid[idx2] = temp;
    return findMatches(tempGrid).length > 0;
  };

  const hasPossibleMoves = (currentGrid: string[]) => {
    for (let i = 0; i < currentGrid.length; i++) {
      const x = i % WIDTH, y = Math.floor(i / WIDTH);
      if (x < WIDTH - 1 && checkPotentialMatch(i, i + 1, currentGrid)) return true;
      if (y < HEIGHT - 1 && checkPotentialMatch(i, i + WIDTH, currentGrid)) return true;
    }
    return false;
  };

  const initGame = () => {
    setScore(0);
    setFatLevel(0);
    setHintsRemaining(3);
    setReductionsRemaining(2);
    setShufflesRemaining(2);
    setGameState('playing');
    generateRandomTargets();

    const newGrid: string[] = [];
    for (let i = 0; i < WIDTH * HEIGHT; i++) {
      let randomFood;
      do {
        randomFood = ALL_FOODS[Math.floor(Math.random() * ALL_FOODS.length)];
      } while (checkInitialMatch(i, randomFood, newGrid));
      newGrid.push(randomFood);
    }
    setGrid(newGrid);
  };

  const saveScore = async (finalScore: number) => {
    if (!auth.currentUser) return;
    try {
      // Check if user has a better score using a simple query to avoid index requirements
      const q = query(
        collection(db, 'gameScores'), 
        where('userId', '==', auth.currentUser.uid)
      );
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const scores = snap.docs.map(d => d.data().score as number);
        const bestScore = Math.max(...scores);
        if (finalScore <= bestScore) {
          console.log('Score not saved: current score is not better than best.');
          return;
        }
      }

      await addDoc(collection(db, 'gameScores'), {
        userId: auth.currentUser.uid,
        userName: userName || 'Anonimo',
        score: finalScore,
        timestamp: Timestamp.now()
      });
      
      sendNotification('Nuovo Record! 🏆', `Hai battuto il tuo record a Healthy Crush con ${finalScore} punti!`);
    } catch (e) {
      console.error('Error saving score:', e);
    }
  };

  const processMatches = async (currentGrid: string[]) => {
    const matches = findMatches(currentGrid);
    if (matches.length === 0) {
      if (!hasPossibleMoves(currentGrid)) {
        setIsShuffling(true);
        await new Promise(r => setTimeout(r, 1000));
        let shuffledGrid = [...currentGrid];
        do {
          for (let i = shuffledGrid.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledGrid[i], shuffledGrid[j]] = [shuffledGrid[j], shuffledGrid[i]];
          }
          // Remove auto-matches after shuffle
          while (findMatches(shuffledGrid).length > 0) {
            const m = findMatches(shuffledGrid);
            m.forEach(idx => {
              shuffledGrid[idx] = ALL_FOODS[Math.floor(Math.random() * ALL_FOODS.length)];
            });
          }
        } while (!hasPossibleMoves(shuffledGrid));
        setGrid(shuffledGrid);
        setIsShuffling(false);
      }
      setIsProcessing(false);
      return;
    }

    let newScore = 0;
    let newFatLevel = 0;
    const updatedTargets = [...gameTargets];

    matches.forEach(idx => {
      const food = currentGrid[idx];
      updatedTargets.forEach(t => {
        if (t.emoji === food) t.collected++;
      });

      if (HEALTHY.includes(food)) {
        newScore += 25;
        newFatLevel -= 1.5;
      } else {
        newScore += 10;
        newFatLevel += 3.5;
      }
    });

    setScore(prev => prev + newScore);
    setFatLevel(prev => {
      const next = Math.max(0, prev + newFatLevel);
      if (next >= 100) {
        setGameState('lost');
        saveScore(score + newScore);
      }
      return next;
    });
    setGameTargets(updatedTargets);

    if (updatedTargets.every(t => t.collected >= t.goal)) {
      setGameState('won');
      saveScore(score + newScore);
      return;
    }

    // Remove matched cells
    const gridAfterMatch = [...currentGrid];
    matches.forEach(idx => gridAfterMatch[idx] = '');
    setGrid(gridAfterMatch);

    await new Promise(r => setTimeout(r, 300));

    // Drop cells
    const gridAfterDrop = [...gridAfterMatch];
    for (let x = 0; x < WIDTH; x++) {
      let empty = 0;
      for (let y = HEIGHT - 1; y >= 0; y--) {
        const idx = y * WIDTH + x;
        if (gridAfterDrop[idx] === '') empty++;
        else if (empty > 0) {
          gridAfterDrop[idx + empty * WIDTH] = gridAfterDrop[idx];
          gridAfterDrop[idx] = '';
        }
      }
      for (let y = 0; y < empty; y++) {
        gridAfterDrop[y * WIDTH + x] = ALL_FOODS[Math.floor(Math.random() * ALL_FOODS.length)];
      }
    }
    setGrid(gridAfterDrop);

    await new Promise(r => setTimeout(r, 200));
    await processMatches(gridAfterDrop);
  };

  const swapCells = async (idx1: number, idx2: number) => {
    setIsProcessing(true);
    setHintIndices([]);
    const newGrid = [...grid];
    const temp = newGrid[idx1];
    newGrid[idx1] = newGrid[idx2];
    newGrid[idx2] = temp;
    
    setGrid(newGrid);

    if (findMatches(newGrid).length > 0) {
      await processMatches(newGrid);
    } else {
      await new Promise(r => setTimeout(r, 250));
      setGrid(grid); // Revert
      setIsProcessing(false);
    }
  };

  const handlePointerDown = (e: React.PointerEvent, index: number) => {
    if (isProcessing || gameState !== 'playing') return;
    setHintIndices([]);
    setSelectedIdx(index);
    touchStart.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (selectedIdx === null || isProcessing || !touchStart.current) return;

    const deltaX = e.clientX - touchStart.current.x;
    const deltaY = e.clientY - touchStart.current.y;
    const threshold = 30;

    if (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold) {
      let targetIdx: number | null = null;
      const x = selectedIdx % WIDTH;
      const y = Math.floor(selectedIdx / WIDTH);

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0 && x < WIDTH - 1) targetIdx = selectedIdx + 1;
        else if (deltaX < 0 && x > 0) targetIdx = selectedIdx - 1;
      } else {
        if (deltaY > 0 && y < HEIGHT - 1) targetIdx = selectedIdx + WIDTH;
        else if (deltaY < 0 && y > 0) targetIdx = selectedIdx - WIDTH;
      }

      if (targetIdx !== null) {
        const source = selectedIdx;
        setSelectedIdx(null);
        touchStart.current = null;
        swapCells(source, targetIdx);
      }
    }
  };

  const handlePointerUp = () => {
    setSelectedIdx(null);
    touchStart.current = null;
  };

  const useReduction = () => {
    if (isProcessing || reductionsRemaining <= 0 || fatLevel <= 0) return;
    setFatLevel(prev => Math.max(0, prev - 40));
    setReductionsRemaining(prev => prev - 1);
  };

  const getManualHint = () => {
    if (isProcessing || gameState !== 'playing' || hintsRemaining <= 0) return;
    
    const healthyMoves: { a: number, b: number }[] = [];
    for (let i = 0; i < grid.length; i++) {
      const x = i % WIDTH, y = Math.floor(i / WIDTH);
      const targets = [];
      if (x < WIDTH - 1) targets.push(i + 1);
      if (y < HEIGHT - 1) targets.push(i + WIDTH);
      for (let tIdx of targets) {
        if (HEALTHY.includes(grid[i]) || HEALTHY.includes(grid[tIdx])) {
          if (checkPotentialMatch(i, tIdx, grid)) healthyMoves.push({ a: i, b: tIdx });
        }
      }
    }

    if (healthyMoves.length > 0) {
      const move = healthyMoves[Math.floor(Math.random() * healthyMoves.length)];
      setHintIndices([move.a, move.b]);
      setHintsRemaining(prev => prev - 1);
    }
  };

  const manualShuffle = async () => {
    if (isProcessing || shufflesRemaining <= 0 || gameState !== 'playing') return;
    
    setIsShuffling(true);
    setShufflesRemaining(prev => prev - 1);
    await new Promise(r => setTimeout(r, 800));
    
    let shuffledGrid = [...grid];
    do {
      for (let i = shuffledGrid.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledGrid[i], shuffledGrid[j]] = [shuffledGrid[j], shuffledGrid[i]];
      }
      // Remove auto-matches after shuffle
      while (findMatches(shuffledGrid).length > 0) {
        const m = findMatches(shuffledGrid);
        m.forEach(idx => {
          shuffledGrid[idx] = ALL_FOODS[Math.floor(Math.random() * ALL_FOODS.length)];
        });
      }
    } while (!hasPossibleMoves(shuffledGrid));
    
    setGrid(shuffledGrid);
    setIsShuffling(false);
  };

  const getCharacterEmoji = () => {
    if (fatLevel > 80) return '🥵';
    if (fatLevel > 50) return '😋';
    return '🚶‍♂️';
  };

  return (
    <div className="fixed inset-0 z-[200] bg-pink-50 flex flex-col items-center justify-center p-4 overflow-hidden touch-none font-sans">
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-gray-400 font-bold z-[210]"
      >
        ✕
      </button>

      <div className="mb-4 text-center w-full max-w-md">
        <h1 className="text-2xl font-black text-pink-600 mb-2">HEALTHY CRUSH 🥗</h1>
        
        <div className="bg-white p-4 rounded-3xl shadow-sm flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div className="text-left">
              <span className="text-[10px] font-bold text-gray-400 block uppercase">Punti</span>
              <span className="text-xl font-black text-gray-800">{score}</span>
            </div>
            <div className="flex gap-2">
              {gameTargets.map((t, i) => (
                <div key={i} className={`bg-white p-2 rounded-xl border flex items-center gap-1 shadow-sm min-w-[60px] justify-center ${t.collected >= t.goal ? 'bg-green-100 opacity-60' : ''}`}>
                  <span className="text-sm">{t.emoji}</span>
                  <span className="font-bold text-gray-700 text-[10px]">{Math.min(t.collected, t.goal)}/{t.goal}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-4 border-t pt-3 border-gray-100">
            <div className="flex-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase block text-left mb-1">Girovita</span>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden border border-white">
                <motion.div 
                  animate={{ width: `${fatLevel}%`, backgroundColor: fatLevel > 80 ? '#ef4444' : fatLevel > 50 ? '#f59e0b' : '#22c55e' }}
                  className="h-full transition-all duration-400"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={manualShuffle}
                disabled={shufflesRemaining <= 0 || isProcessing}
                className={`flex items-center gap-1 bg-purple-50 border-2 border-purple-100 p-2 rounded-xl transition-all ${shufflesRemaining <= 0 ? 'opacity-30 grayscale' : 'hover:scale-105 active:scale-95'}`}
              >
                <span className="text-lg">🔄</span>
                <span className="font-bold text-purple-700 text-sm">{shufflesRemaining}/2</span>
              </button>
              <button 
                onClick={useReduction}
                disabled={reductionsRemaining <= 0 || fatLevel <= 0 || isProcessing}
                className={`flex items-center gap-1 bg-blue-50 border-2 border-blue-100 p-2 rounded-xl transition-all ${reductionsRemaining <= 0 ? 'opacity-30 grayscale' : 'hover:scale-105 active:scale-95'}`}
              >
                <span className="text-lg">🏋️‍♂️</span>
                <span className="font-bold text-blue-700 text-sm">{reductionsRemaining}/2</span>
              </button>
              <button 
                onClick={getManualHint}
                disabled={hintsRemaining <= 0 || isProcessing}
                className={`flex items-center gap-1 bg-yellow-50 border-2 border-yellow-100 p-2 rounded-xl transition-all ${hintsRemaining <= 0 ? 'opacity-30 grayscale' : 'hover:scale-105 active:scale-95'}`}
              >
                <span className="text-lg">💡</span>
                <span className="font-bold text-yellow-700 text-sm">{hintsRemaining}/3</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2 bg-white/60 p-3 rounded-2xl shadow-lg relative">
        {grid.map((food, i) => (
          <motion.div
            key={i}
            onPointerDown={(e) => handlePointerDown(e, i)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            animate={{ 
              scale: selectedIdx === i ? 1.1 : hintIndices.includes(i) ? [1, 1.1, 1] : 1,
              backgroundColor: selectedIdx === i ? '#f0abfc' : hintIndices.includes(i) ? '#fef08a' : '#ffffff',
              opacity: food === '' ? 0 : 1
            }}
            transition={hintIndices.includes(i) ? { repeat: Infinity, duration: 0.8 } : {}}
            className={`w-12 h-12 xs:w-14 xs:h-14 flex items-center justify-center text-3xl xs:text-4xl rounded-xl cursor-pointer select-none shadow-sm border border-transparent ${selectedIdx === i ? 'z-10 shadow-xl border-pink-300' : ''}`}
          >
            {food}
          </motion.div>
        ))}
        
        <AnimatePresence>
          {isShuffling && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-pink-600/70 rounded-2xl flex flex-col items-center justify-center text-white z-20"
            >
              <span className="text-5xl mb-2">🔄</span>
              <h2 className="text-xl font-black">Rimescolamento...</h2>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex flex-col items-center">
        <motion.div 
          animate={{ scale: 1 + (fatLevel / 100) }}
          className="text-6xl mb-2"
        >
          {getCharacterEmoji()}
        </motion.div>
        <p className="text-xs text-pink-400 font-bold uppercase tracking-widest text-center">
          {gameState === 'playing' ? 'Trascina per abbinare!' : ''}
        </p>
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {gameState === 'rules' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/90 flex flex-col items-center justify-center p-8 text-white text-center"
          >
            <h2 className="text-4xl font-black text-pink-500 mb-6 uppercase tracking-tighter">Regolamento 📖</h2>
            <div className="text-left space-y-5 max-w-sm text-base">
              <p>🎯 <b>VINCI SE:</b> Raccogli i 3 cibi sani indicati in alto (10 unità ciascuno).</p>
              <p>🍎 <b>CIBI SANI:</b> Ti fanno dimagrire e servono per vincere. (Il pollo 🍗 è ora sano!)</p>
              <p>🍟 <b>CIBI FRITTI:</b> Fanno aumentare il girovita. Non scoppiare!</p>
              <p>👆 <b>COMANDI:</b> Trascina un cibo verso uno adiacente per scambiarlo.</p>
              <p>🏋️‍♂️ <b>POTERI:</b> Palestra (2 usi) per dimagrire, Lampadina (3 usi) per aiuti sani, Mischia (2 usi) per rimescolare la griglia.</p>
            </div>
            <button 
              onClick={initGame}
              className="mt-10 bg-pink-500 hover:bg-pink-600 text-white px-14 py-4 rounded-full font-bold text-2xl shadow-xl transition-all active:scale-95"
            >
              INIZIA!
            </button>
          </motion.div>
        )}

        {(gameState === 'won' || gameState === 'lost') && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[300] bg-black/90 flex flex-col items-center justify-center p-8 text-white text-center"
          >
            <span className="text-8xl mb-4">{gameState === 'won' ? '🏆' : '💥'}</span>
            <h2 className="text-5xl font-black mb-2 uppercase tracking-tighter">
              {gameState === 'won' ? 'Vittoria!' : 'Boom!'}
            </h2>
            <p className="text-xl mb-10 px-4 opacity-80">
              {gameState === 'won' 
                ? `Hai raggiunto tutti gli obiettivi sani e sei in forma! Punteggio: ${score}`
                : 'Hai mangiato troppo fritto e sei esploso prima di completare la dieta!'}
            </p>
            <div className="flex flex-col gap-4 w-full max-w-xs">
              <button 
                onClick={initGame}
                className="bg-pink-500 hover:bg-pink-600 text-white px-12 py-5 rounded-full font-bold text-2xl shadow-xl transition-all active:scale-95"
              >
                RIPROVA
              </button>
              <button 
                onClick={onClose}
                className="bg-white/10 hover:bg-white/20 text-white px-12 py-4 rounded-full font-bold text-lg transition-all"
              >
                ESCI
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HealthyCrush;
