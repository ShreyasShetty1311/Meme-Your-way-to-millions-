import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import { ensureAnonymousAuth } from './firebase.ts';
import './index.css';

// Fix #1 + #10: Ensure Firebase anonymous auth session before mounting the app,
// and wrap everything in an ErrorBoundary so a single Firestore error never
// produces a blank white screen.
ensureAnonymousAuth().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
});
