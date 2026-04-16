import React, { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore, AppUser } from '../store/useStore';
import { LogIn } from 'lucide-react';

export default function Landing() {
  const { setAppUser } = useStore();
  const [loginType, setLoginType] = useState<'admin' | 'team' | 'audience' | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      // Only filter by username in Firestore to avoid needing a composite index.
      // Password and role are checked client-side — safe for this demo auth model.
      const q = query(
        collection(db, 'users'),
        where('username', '==', username)
      );
      const snap = await getDocs(q);

      // Find matching doc by password AND role in JS
      const matchingDoc = snap.docs.find(d => {
        const data = d.data();
        return data.password === password && data.role === loginType;
      });

      if (matchingDoc) {
        localStorage.setItem('userId', matchingDoc.id);
        setAppUser({ id: matchingDoc.id, ...matchingDoc.data() } as AppUser);
      } else {
        setError('Invalid credentials');
      }
    } catch (err) {
      setError('Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 radial-burst relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="text-center z-10 mb-12">
        <div className="inline-block px-4 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-bold tracking-widest uppercase mb-6">
          ⚡ The Market is Heating Up
        </div>
        <h1 className="text-5xl md:text-7xl font-headline font-bold text-primary neon-glow mb-6 leading-tight">
          Meme Your Way <br /> to Millions
        </h1>
        <p className="text-on-surface-variant text-lg md:text-xl max-w-2xl mx-auto font-body">
          The ultimate high-stakes playground where your cultural capital translates into real terminal gains. Turn memes into money.
        </p>
      </div>

      {!loginType ? (
        <div className="flex flex-col sm:flex-row gap-4 z-10">
          <button 
            onClick={() => setLoginType('audience')}
            className="bg-secondary hover:bg-secondary-dim text-on-secondary font-bold py-4 px-8 rounded-xl transition-all shadow-[0_0_20px_rgba(253,211,77,0.3)] hover:shadow-[0_0_30px_rgba(253,211,77,0.5)] transform hover:-translate-y-1"
          >
            Enter Voting Booth 🗳️
          </button>
          <button 
            onClick={() => setLoginType('admin')}
            className="bg-surface-container border border-outline hover:border-primary text-on-surface font-bold py-4 px-8 rounded-xl transition-all hover:bg-surface-variant"
          >
            Admin Login
          </button>
          <button 
            onClick={() => setLoginType('team')}
            className="bg-surface-container border border-outline hover:border-primary text-on-surface font-bold py-4 px-8 rounded-xl transition-all hover:bg-surface-variant"
          >
            Team Login
          </button>
        </div>
      ) : (
        <div className="bg-surface-container-high border border-outline-variant rounded-3xl p-8 w-full max-w-md z-10 neon-glow-box">
          <h2 className="text-2xl font-bold text-on-surface mb-6 capitalize">{loginType} Login</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-on-surface-variant mb-1">Username</label>
              <input 
                type="text" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-3 text-on-surface focus:border-primary focus:outline-none"
                placeholder={`Enter ${loginType} username`}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-on-surface-variant mb-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-3 text-on-surface focus:border-primary focus:outline-none"
                placeholder="Enter password"
                required
              />
            </div>
            {error && <p className="text-error text-sm">{error}</p>}
            <div className="flex gap-3 pt-4">
              <button 
                type="button" 
                onClick={() => setLoginType(null)}
                className="flex-1 py-3 text-on-surface-variant hover:text-on-surface bg-surface-variant rounded-xl font-bold"
              >
                Back
              </button>
              <button 
                type="submit" 
                className="flex-1 bg-primary hover:bg-primary-dim text-on-primary rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <LogIn size={20} /> Login
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
