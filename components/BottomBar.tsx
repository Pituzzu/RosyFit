
import React from 'react';
import { View } from '../types';

interface BottomBarProps {
  activeTab: View;
  setActiveTab: (tab: View) => void;
}

const BottomBar: React.FC<BottomBarProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: View.HOME, label: 'Home', icon: '🏠' },
    { id: View.DIET, label: 'Dieta', icon: '🥗' },
    { id: View.SHOPPING, label: 'Spesa', icon: '🛒' },
    { id: View.GOALS, label: 'Target', icon: '🎯' },
    { id: View.MEALS, label: 'Diario', icon: '📸' },
    { id: View.PROFILE, label: 'Profilo', icon: '👤' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 pb-safe flex justify-around items-center h-16 shadow-2xl z-40">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex flex-col items-center justify-center w-full h-full transition-colors relative ${
            activeTab === tab.id ? 'text-rose-500' : 'text-gray-400'
          }`}
        >
          <span className="text-xl">{tab.icon}</span>
          <span className="text-[9px] mt-1 font-bold uppercase tracking-tighter">{tab.label}</span>
          {activeTab === tab.id && (
            <div className="absolute bottom-1 w-1 h-1 bg-rose-500 rounded-full" />
          )}
        </button>
      ))}
    </nav>
  );
};

export default BottomBar;
