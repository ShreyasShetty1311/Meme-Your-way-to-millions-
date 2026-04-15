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

interface AppState {
  appUser: AppUser | null;
  memes: Meme[];
  portfolio: PortfolioItem[];
  gameState: GameState | null;
  scenarios: Scenario[];
  submissions: Submission[];
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
  isAuthReady: false,
  setAppUser: (appUser) => set({ appUser }),
  setAuthReady: (ready) => set({ isAuthReady: ready }),
  logout: () => {
    localStorage.removeItem('userId');
    set({ appUser: null, portfolio: [] });
  }
}));

export const setupListeners = (userId: string, role: Role) => {
  const unsubscribes: (() => void)[] = [];

  // Listen to Game State
  const unsubGameState = onSnapshot(doc(db, 'gameState', 'current'), (doc) => {
    if (doc.exists()) {
      useStore.setState({ gameState: doc.data() as GameState });
    }
  }, (error) => handleFirestoreError(error, OperationType.GET, 'gameState/current'));
  unsubscribes.push(unsubGameState);

  // Listen to Memes
  const unsubMemes = onSnapshot(collection(db, 'memes'), (snapshot) => {
    const memes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meme));
    useStore.setState({ memes });
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'memes'));
  unsubscribes.push(unsubMemes);

  // Listen to Scenarios
  const unsubScenarios = onSnapshot(collection(db, 'scenarios'), (snapshot) => {
    const scenarios = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Scenario));
    useStore.setState({ scenarios });
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'scenarios'));
  unsubscribes.push(unsubScenarios);

  // Listen to Submissions
  const unsubSubmissions = onSnapshot(collection(db, 'submissions'), (snapshot) => {
    const submissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
    useStore.setState({ submissions });
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'submissions'));
  unsubscribes.push(unsubSubmissions);

  // Listen to Portfolio (if Team)
  if (role === 'team') {
    const q = query(collection(db, 'portfolios'), where('userId', '==', userId));
    const unsubPortfolio = onSnapshot(q, (snapshot) => {
      const portfolio = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PortfolioItem));
      useStore.setState({ portfolio });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'portfolios'));
    unsubscribes.push(unsubPortfolio);
  }

  return () => unsubscribes.forEach(unsub => unsub());
};
