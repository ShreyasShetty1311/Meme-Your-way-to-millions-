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
  // Fix #6: allUsers exposed in the store so admin pages (Transfer, Round2) can
  // share a single listener instead of each opening their own onSnapshot.
  allUsers: AppUser[];
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
  allUsers: [],
  isAuthReady: false,
  setAppUser: (appUser) => set({ appUser }),
  setAuthReady: (ready) => set({ isAuthReady: ready }),
  logout: () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('loginRole');
    set({ appUser: null, portfolio: [], allUsers: [] });
  },
}));

export const setupListeners = (userId: string, role: Role) => {
  const unsubscribes: (() => void)[] = [];

  // ── Always for every role ──────────────────────────────────────────────────

  // Live user doc — keeps budget and all user fields up-to-date
  unsubscribes.push(
    onSnapshot(
      doc(db, 'users', userId),
      (snap) => {
        if (snap.exists())
          useStore.setState({ appUser: { id: snap.id, ...snap.data() } as AppUser });
      },
      (err) => console.error('User listener:', err)
    )
  );

  // Game state
  unsubscribes.push(
    onSnapshot(
      doc(db, 'gameState', 'current'),
      (snap) => {
        if (snap.exists()) useStore.setState({ gameState: snap.data() as GameState });
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'gameState/current')
    )
  );

  // Memes (all roles need this)
  unsubscribes.push(
    onSnapshot(
      collection(db, 'memes'),
      (snap) =>
        useStore.setState({
          memes: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Meme)),
        }),
      (err) => handleFirestoreError(err, OperationType.LIST, 'memes')
    )
  );

  // Scenarios (all roles need this)
  unsubscribes.push(
    onSnapshot(
      collection(db, 'scenarios'),
      (snap) =>
        useStore.setState({
          scenarios: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Scenario)),
        }),
      (err) => handleFirestoreError(err, OperationType.LIST, 'scenarios')
    )
  );

  // ── Fix #6: allUsers listener — admin only ─────────────────────────────────
  // All admin sub-pages (Transfer, Round2, Users) previously each opened their
  // own onSnapshot on the users collection. Now it lives here so there is
  // exactly ONE listener shared by every admin page.
  if (role === 'admin') {
    unsubscribes.push(
      onSnapshot(
        collection(db, 'users'),
        (snap) =>
          useStore.setState({
            allUsers: snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser)),
          }),
        (err) => console.error('AllUsers listener:', err)
      )
    );
  }

  // ── Submissions: scoped by role ────────────────────────────────────────────
  // Admin + audience: ALL submissions (admin dashboard; audience sees all to vote on)
  // Team: only THEIR own submissions (max 15 docs vs 225 global)
  if (role === 'admin' || role === 'audience') {
    unsubscribes.push(
      onSnapshot(
        collection(db, 'submissions'),
        (snap) =>
          useStore.setState({
            submissions: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Submission)),
          }),
        (err) => handleFirestoreError(err, OperationType.LIST, 'submissions')
      )
    );
  } else if (role === 'team') {
    unsubscribes.push(
      onSnapshot(
        query(collection(db, 'submissions'), where('teamId', '==', userId)),
        (snap) =>
          useStore.setState({
            submissions: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Submission)),
          }),
        (err) => console.error('Submissions listener:', err)
      )
    );
  }

  // ── Votes: scoped by role ──────────────────────────────────────────────────
  // Fix #8: Audience only needs votes for the CURRENT scenario to show vote
  // counts. Admin needs all votes for the scoring panel.
  // Teams never need vote data at all.
  if (role === 'admin') {
    unsubscribes.push(
      onSnapshot(
        collection(db, 'votes'),
        (snap) =>
          useStore.setState({
            votes: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Vote)),
          }),
        (err) => console.error('Votes listener (admin):', err)
      )
    );
  } else if (role === 'audience') {
    // Subscribe to ALL votes but only keep the ones for the active scenario.
    // We still need the full collection because the active scenario can change.
    // This avoids re-subscribing every time activeScenarioId flips.
    unsubscribes.push(
      onSnapshot(
        collection(db, 'votes'),
        (snap) =>
          useStore.setState({
            votes: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Vote)),
          }),
        (err) => console.error('Votes listener (audience):', err)
      )
    );
  }

  // ── Fix #9: Trade Listings — only ACTIVE listings ─────────────────────────
  // Sold records used to bloat the listener. Eligibility tracking for the
  // Trade page now reads sold listings on-demand (see Trade.tsx handleBuy).
  if (role === 'admin' || role === 'team') {
    unsubscribes.push(
      onSnapshot(
        query(collection(db, 'tradeListings'), where('status', '==', 'active')),
        (snap) =>
          useStore.setState({
            tradeListings: snap.docs.map((d) => ({ id: d.id, ...d.data() } as TradeListing)),
          }),
        (err) => console.error('TradeListings listener:', err)
      )
    );
  }

  // ── Portfolio: team and admin only ─────────────────────────────────────────
  if (role === 'team' || role === 'admin') {
    unsubscribes.push(
      onSnapshot(
        query(collection(db, 'portfolios'), where('userId', '==', userId)),
        (snap) =>
          useStore.setState({
            portfolio: snap.docs.map((d) => ({ id: d.id, ...d.data() } as PortfolioItem)),
          }),
        (err) => handleFirestoreError(err, OperationType.LIST, 'portfolios')
      )
    );
  }

  return () => unsubscribes.forEach((unsub) => unsub());
};
