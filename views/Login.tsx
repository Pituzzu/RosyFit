import React, { useState } from 'react';
import { auth } from '../services/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';

const LoginView: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      let message = "Si è verificato un errore.";
      if (err.code === 'auth/invalid-credential') message = "Email o password errati.";
      if (err.code === 'auth/email-already-in-use') message = "Questa email è già registrata.";
      if (err.code === 'auth/weak-password') message = "La password deve avere almeno 6 caratteri.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-rose-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10 border border-rose-100">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-rose-500 rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-rose-200 mb-6 rotate-3">
             <span className="text-white text-4xl font-black">R</span>
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tighter mb-2">ROSYFIT</h1>
          <p className="text-gray-400 text-sm font-medium uppercase tracking-widest">
            {isRegistering ? 'Crea il tuo profilo Fit' : 'Bentornata Atleta'}
          </p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded-r-xl animate-in fade-in slide-in-from-top-2">
            ⚠️ {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {isRegistering && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-2">Nome</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Il tuo nome"
                className="w-full px-6 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-rose-500 outline-none transition-all text-sm font-bold text-slate-900"
                required
              />
            </div>
          )}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-2">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rosy@example.com"
              className="w-full px-6 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-rose-500 outline-none transition-all text-sm font-bold text-slate-900"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-2">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-6 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-rose-500 outline-none transition-all text-sm font-bold text-slate-900"
              required
            />
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-rose-500 hover:bg-rose-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-rose-200 transition-all active:scale-95 disabled:opacity-50 mt-4 uppercase tracking-widest text-xs"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                Elaborazione...
              </div>
            ) : (
              isRegistering ? 'Registrati Ora' : 'Entra nel Diario'
            )}
          </button>
        </form>
        
        <div className="mt-10 text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
            {isRegistering ? 'Hai già un account?' : 'Nuova su Rosyfit?'}
          </p>
          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-rose-500 font-black text-sm hover:underline transition-all"
          >
            {isRegistering ? 'Accedi qui' : 'Crea il tuo account gratuito'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginView;