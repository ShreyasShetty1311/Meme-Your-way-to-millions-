import React from 'react';
import { signInWithGoogle } from '../firebase';
import { TrendingUp } from 'lucide-react';

export default function Login() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 radial-burst">
      <div className="w-full max-w-md bg-surface-container-high border border-outline-variant rounded-3xl p-8 text-center neon-glow-box transition-all duration-300">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/30">
          <TrendingUp size={40} className="text-primary drop-shadow-[0_0_10px_rgba(242,253,104,0.8)]" />
        </div>
        
        <h1 className="text-4xl font-headline font-bold text-on-surface mb-2 tracking-tight">
          Meme <span className="text-primary neon-glow">Market</span>
        </h1>
        <p className="text-on-surface-variant mb-8 font-body">
          Trade memes, submit scenarios, and vote your way to millions.
        </p>

        <button
          onClick={signInWithGoogle}
          className="w-full bg-primary hover:bg-primary-dim text-on-primary font-bold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(242,253,104,0.2)] hover:shadow-[0_0_30px_rgba(242,253,104,0.4)] flex items-center justify-center gap-3"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
