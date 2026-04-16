import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { useStore, setupListeners, AppUser } from './store/useStore';
import { Layout } from './components/Layout';

// Pages
import Landing from './pages/Landing';
import Market from './pages/Market';
import Scenario from './pages/Scenario';
import Voting from './pages/Voting';
import Progress from './pages/Progress';
import Trade from './pages/Trade';
import AdminUsers from './pages/admin/Users';
import AdminRound1 from './pages/admin/Round1';
import AdminRound2 from './pages/admin/Round2';
import AdminTransfer from './pages/admin/Transfer';
import AdminTeams from './pages/admin/Teams';
import AdminTrade from './pages/admin/Trade';

function App() {
  const { setAppUser, setAuthReady, isAuthReady, appUser } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      // ── Session version guard ──────────────────────────────────────────────
      // Bump SESSION_VERSION whenever you migrate Firebase projects or rename
      // the app, so stale localStorage user IDs from the old project are
      // automatically cleared and users are redirected to the login page.
      const SESSION_VERSION = 'v3'; // bumped: role-pin security added
      if (localStorage.getItem('sessionVersion') !== SESSION_VERSION) {
        localStorage.removeItem('userId');
        localStorage.removeItem('loginRole');
        localStorage.setItem('sessionVersion', SESSION_VERSION);
      }

      try {
        // 1. Bootstrap default users if they don't exist
        try {
          const q = query(collection(db, 'users'), where('role', '==', 'admin'));
          const snap = await getDocs(q);
          if (snap.empty) {
            await setDoc(doc(collection(db, 'users')), { username: 'admin', password: 'admin@123', role: 'admin', name: 'Admin' });
            await setDoc(doc(collection(db, 'users')), { username: 'voter', password: 'voter@bmsce', role: 'audience', name: 'Voter' });
            await setDoc(doc(collection(db, 'users')), { username: 'user', password: 'user@1', role: 'team', name: 'Team 1', budget: 42069 });
          }
        } catch (bootstrapErr) {
          // Non-fatal: bootstrap only fails on first load with bad connection
          console.warn("Bootstrap skipped:", bootstrapErr);
        }

        // 2. Check local storage for existing session
        const userId = localStorage.getItem('userId');
        const loginRole = localStorage.getItem('loginRole'); // role the user actually logged in with
        if (userId) {
          try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              const firestoreRole = userDoc.data().role;

              // ── Role-pin security check ──────────────────────────────────────
              // If the Firestore role is 'admin' but the stored loginRole is NOT
              // 'admin', someone swapped their userId to an admin's in localStorage.
              // Also guard the reverse: if Firestore says team/audience but stored
              // loginRole says admin, that means the admin doc was re-used.
              // In either mismatch case, kill the session immediately.
              const roleMismatch = loginRole && firestoreRole !== loginRole;
              if (roleMismatch) {
                console.warn(`Role mismatch: localStorage loginRole='${loginRole}' vs Firestore role='${firestoreRole}'. Clearing session.`);
                localStorage.removeItem('userId');
                localStorage.removeItem('loginRole');
              } else {
                setAppUser({ id: userDoc.id, ...userDoc.data() } as AppUser);
              }
            } else {
              // Stale session: user doc no longer exists (e.g. after project migration)
              console.warn(`Session user '${userId}' not found in Firestore — clearing session.`);
              localStorage.removeItem('userId');
              localStorage.removeItem('loginRole');
            }
          } catch (sessionErr) {
            // Network or permission error restoring session — clear and re-login
            console.warn('Could not restore session:', sessionErr);
            localStorage.removeItem('userId');
            localStorage.removeItem('loginRole');
          }
        }
      } finally {
        setAuthReady(true);
        setLoading(false);
      }
    };

    initAuth();
  }, [setAppUser, setAuthReady]);

  // Extract STABLE PRIMITIVES — avoids re-subscribing every time a field
  // like budget changes (which would briefly wipe memes/scenarios/gameState)
  const appUserId = appUser?.id ?? null;
  const appUserRole = appUser?.role ?? null;

  useEffect(() => {
    if (isAuthReady && appUserId && appUserRole) {
      const cleanup = setupListeners(appUserId, appUserRole);
      return () => cleanup();
    }
  }, [isAuthReady, appUserId, appUserRole]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!appUser ? <Landing /> : <Navigate to="/" replace />} />
        
        <Route element={appUser ? <Layout /> : <Navigate to="/login" replace />}>
          <Route path="/" element={
            appUser?.role === 'admin' ? <Navigate to="/admin/users" replace /> :
            appUser?.role === 'team' ? <Navigate to="/market" replace /> :
            <Navigate to="/voting" replace />
          } />
          
          {/* Admin Routes */}
          <Route path="/admin/users" element={appUser?.role === 'admin' ? <AdminUsers /> : <Navigate to="/" replace />} />
          <Route path="/admin/round1" element={appUser?.role === 'admin' ? <AdminRound1 /> : <Navigate to="/" replace />} />
          <Route path="/admin/round2" element={appUser?.role === 'admin' ? <AdminRound2 /> : <Navigate to="/" replace />} />
          <Route path="/admin/transfer" element={appUser?.role === 'admin' ? <AdminTransfer /> : <Navigate to="/" replace />} />
          <Route path="/admin/teams" element={appUser?.role === 'admin' ? <AdminTeams /> : <Navigate to="/" replace />} />
          <Route path="/admin/trade" element={appUser?.role === 'admin' ? <AdminTrade /> : <Navigate to="/" replace />} />
          
          {/* Team Routes */}
          <Route path="/market" element={appUser?.role === 'team' ? <Market /> : <Navigate to="/" replace />} />
          <Route path="/scenario" element={appUser?.role === 'team' ? <Scenario /> : <Navigate to="/" replace />} />
          <Route path="/trade" element={appUser?.role === 'team' ? <Trade /> : <Navigate to="/" replace />} />
          <Route path="/progress" element={appUser?.role === 'team' ? <Progress /> : <Navigate to="/" replace />} />
          
          {/* Audience Routes */}
          <Route path="/voting" element={appUser?.role === 'audience' ? <Voting /> : <Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
