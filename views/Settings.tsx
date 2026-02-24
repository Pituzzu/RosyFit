
import React from 'react';
import { GymSettings } from '../types';

interface SettingsViewProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  gymSettings: GymSettings;
  setGymSettings: (val: GymSettings) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ darkMode, setDarkMode, gymSettings, setGymSettings }) => {
  const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

  const toggleDay = (day: string) => {
    const newDays = gymSettings.days.includes(day)
      ? gymSettings.days.filter(d => d !== day)
      : [...gymSettings.days, day];
    setGymSettings({ ...gymSettings, days: newDays });
  };

  return (
    <div className="p-4 space-y-8">
      <h1 className="text-2xl font-bold">Impostazioni</h1>

      <section className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold">Modalità Dark</h3>
            <p className="text-xs text-gray-500">Passa alla visione notturna</p>
          </div>
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className={`w-14 h-8 rounded-full transition-colors relative ${darkMode ? 'bg-rose-500' : 'bg-gray-300'}`}
          >
            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${darkMode ? 'right-1' : 'left-1'}`} />
          </button>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold">Attività Fisica</h3>
            <p className="text-xs text-gray-500">Ti alleni regolarmente?</p>
          </div>
          <button 
            onClick={() => setGymSettings({ ...gymSettings, isActive: !gymSettings.isActive })}
            className={`w-14 h-8 rounded-full transition-colors relative ${gymSettings.isActive ? 'bg-rose-500' : 'bg-gray-300'}`}
          >
            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${gymSettings.isActive ? 'right-1' : 'left-1'}`} />
          </button>
        </div>

        {gymSettings.isActive && (
          <div className="space-y-6 mt-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div>
              <label className="text-sm font-semibold mb-3 block">Giorni di Allenamento:</label>
              <div className="flex flex-wrap gap-2">
                {days.map(day => (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      gymSettings.days.includes(day)
                        ? 'bg-rose-500 border-rose-500 text-white'
                        : 'bg-transparent border-gray-200 dark:border-slate-600 text-gray-500'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold mb-3 block">Orario di Allenamento:</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setGymSettings({ ...gymSettings, timeOfDay: 'morning' })}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${gymSettings.timeOfDay === 'morning' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'border-gray-100 text-gray-400'}`}
                >
                  ☀️ Mattina
                </button>
                <button 
                  onClick={() => setGymSettings({ ...gymSettings, timeOfDay: 'afternoon' })}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${gymSettings.timeOfDay === 'afternoon' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'border-gray-100 text-gray-400'}`}
                >
                  🌙 Pomeriggio
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default SettingsView;
