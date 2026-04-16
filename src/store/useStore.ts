import { create } from 'zustand';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export type Role = 'admin' | 'team' | 'audience' | null;

export interface AppUser {
  id: string;
  username?: string;
  password?: string;
  email?: string;
  role: Role;
  name: string;
  budget?: number;
  score?: number;
}

export interface Meme {
  id: string;
  name: string;
  imageUrl: string;
  initialPrice: number;
  currentPrice: number;
  totalShares: number;
  availableShares: number;
  volatility?: string;
  burnRate?: string;
}

export interface PortfolioItem {
  id: string;
  userId: string;
  memeId: string;
  shares: number;
  averagePrice: number;
}

export interface GameState {
  currentRound: number;
  status: 'setup' | 'active' | 'completed';
  activeScenarioId?: string;
  tradeRoundActive?: boolean;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'completed';
}

export interface Submission {
  id: string;
  scenarioId: string;
  teamId: string;
  memeId: string;
  timestamp: number;
}

export interface Vote {
  id: string;
  scenarioId: string;
  audienceId: string;
  submissionId: string;
  timestamp: number;
}

export interface TradeListing {
  id: string;
  sellerId: string;
  memeId: string;
  shares: number;
  pricePerShare: number;
  createdAt: number;
  status: 'active' | 'sold';
  buyerId?: string;
}

interface AppState {
  appUser: AppUser | null;
  memes: Meme[];
  portfolio: PortfolioItem[];
  gameState: GameState | null;
  scenarios: Scenario[];
  submissions: Submission[];
  votes: Vote[];
  tradeListings: TradeListing[];
  isAuthReady: boolean;
  setAppUser: (appUser: AppUser | null) => void;
  setAuthReady: (ready: boolean) => void;
  logout: () => void;
}

export const useStore = create<AppState>((set) => ({
  appUser: null,
  memes: [],
  portfolio: [],
  gameState: null,
  scenarios: [],
  submissions: [],
  votes: [],
  tradeListings: [],
  isAuthReady: false,
  setAppUser: (appUser) => set({ appUser }),
  setAuthReady: (ready) => set({ isAuthReady: ready }),
  logout: () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('loginRole');
    set({ appUser: null, portfolio: [] });
  },
}));

export const setupListeners = (userId: string, role: Role) => {
  const unsubscribes: (() => void)[] = [];

  // ── Always for every role ──

  // Live user doc — keeps budget and all user fields up-to-date
  unsubscribes.push(onSnapshot(
    doc(db, 'users', userId),
    (snap) => { if (snap.exists()) useStore.setState({ appUser: { id: snap.id, ...snap.data() } as AppUser }); },
    (err) => console.error('User listener:', err)
  ));

  // Game state
  unsubscribes.push(onSnapshot(
    doc(db, 'gameState', 'current'),
    (snap) => { if (snap.exists()) useStore.setState({ gameState: snap.data() as GameState }); },
    (err) => handleFirestoreError(err, OperationType.GET, 'gameState/current')
  ));

  // Memes (all roles need this)
  unsubscribes.push(onSnapshot(
    collection(db, 'memes'),
    (snap) => useStore.setState({ memes: snap.docs.map(d => ({ id: d.id, ...d.data() } as Meme)) }),
    (err) => handleFirestoreError(err, OperationType.LIST, 'memes')
  ));

  // Scenarios (all roles need this)
  unsubscribes.push(onSnapshot(
    collection(db, 'scenarios'),
    (snap) => useStore.setState({ scenarios: snap.docs.map(d => ({ id: d.id, ...d.data() } as Scenario)) }),
    (err) => handleFirestoreError(err, OperationType.LIST, 'scenarios')
  ));

  // ── Submissions: scoped by role ──
  // Admin + audience: ALL submissions (admin dashboard; audience sees all reactions to vote on)
  // Team: only THEIR own submissions (just 1 doc per scenario = max 15 docs vs 300 global)
  // Saves: ~285 docs × 20 teams = 5,700 reads on startup
  if (role === 'admin' || role === 'audience') {
    unsubscribes.push(onSnapshot(
      collection(db, 'submissions'),
      (snap) => useStore.setState({ submissions: snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)) }),
      (err) => handleFirestoreError(err, OperationType.LIST, 'submissions')
    ));
  } else if (role === 'team') {
    // Team only needs to know if THEY submitted each scenario
    unsubscribes.push(onSnapshot(
      query(collection(db, 'submissions'), where('teamId', '==', userId)),
      (snap) => useStore.setState({ submissions: snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)) }),
      (err) => console.error('Submissions listener:', err)
    ));
  }

  // ── Votes: scoped by role ──
  // Admin: ALL votes (needs full counts for Teams scoring panel)
  // Audience: ALL votes (needs counts to display on voting cards + know if they voted)
  // Team: NONE — teams never display or act on vote data
  // Saves: ~300 docs × 20 teams = 6,000 reads on startup
  if (role === 'admin' || role === 'audience') {
    unsubscribes.push(onSnapshot(
      collection(db, 'votes'),
      (snap) => useStore.setState({ votes: snap.docs.map(d => ({ id: d.id, ...d.data() } as Vote)) }),
      (err) => console.error('Votes listener:', err)
    ));
  }

  // ── Trade Listings: admin + team only ──
  // Audience never trades — skip entirely for voters
  if (role === 'admin' || role === 'team') {
    unsubscribes.push(onSnapshot(
      collection(db, 'tradeListings'),
      (snap) => useStore.setState({ tradeListings: snap.docs.map(d => ({ id: d.id, ...d.data() } as TradeListing)) }),
      (err) => console.error('TradeListings listener:', err)
    ));
  }

  // ── Portfolio: team and admin only ──
  if (role === 'team' || role === 'admin') {
    unsubscribes.push(onSnapshot(
      query(collection(db, 'portfolios'), where('userId', '==', userId)),
      (snap) => useStore.setState({ portfolio: snap.docs.map(d => ({ id: d.id, ...d.data() } as PortfolioItem)) }),
      (err) => handleFirestoreError(err, OperationType.LIST, 'portfolios')
    ));
  }

  return () => unsubscribes.forEach(unsub => unsub());
};
