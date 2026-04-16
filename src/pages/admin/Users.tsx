import React, { useState, useEffect } from 'react';
import {
  collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc,
  getDocs, writeBatch, setDoc, getDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { AppUser } from '../../store/useStore';
import { UserPlus, Trash2, Users, Eye, EyeOff, Info, Check, X, Pencil, RotateCcw, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-error/20 text-error border border-error/30',
  team: 'bg-primary/20 text-primary border border-primary/30',
  audience: 'bg-secondary/20 text-secondary border border-secondary/30',
};

const DEFAULT_CREDS = [
  { role: 'Admin', username: 'admin', password: 'admin@123' },
  { role: 'Voter', username: 'voter', password: 'voter@bmsce' },
  { role: 'Team', username: 'user', password: 'user@1' },
];

const STARTING_BUDGET = 42069;

interface EditState {
  username: string;
  password: string;
  budget: number;
  role: string;
  name: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [showPass, setShowPass] = useState<Record<string, boolean>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ username: '', password: '', budget: 0, role: 'team', name: '' });
  const [savingId, setSavingId] = useState<string | null>(null);

  // Reset game state
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState('');

  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    email: '',
    role: 'team',
    name: '',
    budget: STARTING_BUDGET,
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppUser));
      setUsers(usersData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    return () => unsub();
  }, []);

  /* ── Reset Game ── */
  const handleResetGame = async () => {
    setResetting(true);
    setResetStatus('Clearing portfolios...');
    try {
      // 1. Delete all portfolios
      const portfoliosSnap = await getDocs(collection(db, 'portfolios'));
      let batch = writeBatch(db);
      let count = 0;
      for (const d of portfoliosSnap.docs) {
        batch.delete(d.ref);
        count++;
        if (count === 499) { await batch.commit(); batch = writeBatch(db); count = 0; }
      }
      if (count > 0) await batch.commit();

      setResetStatus('Clearing trade listings...');
      // 2. Delete all tradeListings
      const tradeSnap = await getDocs(collection(db, 'tradeListings'));
      batch = writeBatch(db); count = 0;
      for (const d of tradeSnap.docs) {
        batch.delete(d.ref);
        count++;
        if (count === 499) { await batch.commit(); batch = writeBatch(db); count = 0; }
      }
      if (count > 0) await batch.commit();

      setResetStatus('Clearing submissions & votes...');
      // 3. Delete submissions
      const subsSnap = await getDocs(collection(db, 'submissions'));
      batch = writeBatch(db); count = 0;
      for (const d of subsSnap.docs) {
        batch.delete(d.ref);
        count++;
        if (count === 499) { await batch.commit(); batch = writeBatch(db); count = 0; }
      }
      if (count > 0) await batch.commit();

      // 4. Delete votes
      const votesSnap = await getDocs(collection(db, 'votes'));
      batch = writeBatch(db); count = 0;
      for (const d of votesSnap.docs) {
        batch.delete(d.ref);
        count++;
        if (count === 499) { await batch.commit(); batch = writeBatch(db); count = 0; }
      }
      if (count > 0) await batch.commit();

      setResetStatus('Resetting meme prices...');
      // 5. Reset meme prices & availableShares
      const memesSnap = await getDocs(collection(db, 'memes'));
      batch = writeBatch(db); count = 0;
      for (const d of memesSnap.docs) {
        const data = d.data();
        batch.update(d.ref, {
          currentPrice: data.initialPrice,
          availableShares: data.totalShares,
        });
        count++;
        if (count === 499) { await batch.commit(); batch = writeBatch(db); count = 0; }
      }
      if (count > 0) await batch.commit();

      setResetStatus('Resetting team budgets...');
      // 6. Reset team budgets
      batch = writeBatch(db); count = 0;
      const teamUsers = users.filter(u => u.role === 'team');
      for (const u of teamUsers) {
        batch.update(doc(db, 'users', u.id), { budget: STARTING_BUDGET });
        count++;
        if (count === 499) { await batch.commit(); batch = writeBatch(db); count = 0; }
      }
      if (count > 0) await batch.commit();

      setResetStatus('Resetting game state...');
      // 7. Reset gameState
      const gameRef = doc(db, 'gameState', 'current');
      const existing = await getDoc(gameRef);
      if (existing.exists()) {
        await setDoc(gameRef, {
          currentRound: 0,
          status: 'setup',
          activeScenarioId: null,
          tradeRoundActive: false,
        });
      }

      setResetStatus('✅ Reset complete! Game is back to Day 1.');
      setTimeout(() => {
        setShowResetConfirm(false);
        setResetStatus('');
      }, 2500);
    } catch (error) {
      console.error('Reset failed:', error);
      setResetStatus('❌ Reset failed. Check console.');
    } finally {
      setResetting(false);
    }
  };

  /* ── Add user ── */
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'users'), {
        username: newUser.username,
        password: newUser.password,
        email: newUser.email,
        role: newUser.role,
        name: newUser.name || newUser.username,
        budget: newUser.role === 'team' ? Number(newUser.budget) : 0,
      });
      setNewUser({ username: '', password: '', email: '', role: 'team', name: '', budget: STARTING_BUDGET });
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
    } finally {
      setLoading(false);
    }
  };

  /* ── Inline edit ── */
  const startEdit = (user: AppUser) => {
    setEditingId(user.id);
    setEditState({
      username: user.username || '',
      password: user.password || '',
      budget: user.budget || 0,
      role: user.role || 'team',
      name: user.name || '',
    });
    setShowPass(p => ({ ...p, [user.id]: true }));
  };

  const saveEdit = async (userId: string) => {
    setSavingId(userId);
    try {
      await updateDoc(doc(db, 'users', userId), {
        username: editState.username,
        password: editState.password,
        budget: editState.role === 'team' ? Number(editState.budget) : 0,
        role: editState.role,
        name: editState.name,
      });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    } finally {
      setSavingId(null);
    }
  };

  const cancelEdit = () => setEditingId(null);

  /* ── Delete ── */
  const handleDelete = async (userId: string) => {
    if (!confirm('Delete this user?')) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
    }
  };

  const togglePass = (id: string) => setShowPass(p => ({ ...p, [id]: !p[id] }));

  const sortedUsers = [...users].sort((a, b) => {
    const order = { admin: 0, team: 1, audience: 2 };
    return (order[a.role as keyof typeof order] ?? 3) - (order[b.role as keyof typeof order] ?? 3);
  });

  const inputCls = 'w-full bg-surface-container-high border border-outline-variant rounded-lg px-2.5 py-1.5 text-on-surface text-sm focus:border-primary focus:outline-none font-mono';

  return (
    <div className="space-y-8 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-on-surface flex items-center gap-3">
            <Users className="text-primary" size={32} />
            Manage Users
          </h1>
          <p className="text-on-surface-variant mt-1">Add and manage all participants</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {/* Reset Game Button */}
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold border border-error/40 text-error hover:bg-error/10 transition-all"
          >
            <RotateCcw size={18} />
            Reset Game
          </button>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className={clsx(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all',
              isAdding
                ? 'bg-surface-variant text-on-surface-variant'
                : 'bg-primary text-on-primary shadow-[0_0_15px_rgba(242,253,104,0.2)] hover:shadow-[0_0_20px_rgba(242,253,104,0.3)]'
            )}
          >
            <UserPlus size={20} />
            {isAdding ? 'Cancel' : 'Add User'}
          </button>
        </div>
      </div>

      {/* ── Reset Game Confirmation Modal ── */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container border border-error/40 rounded-3xl p-8 max-w-md w-full shadow-[0_0_40px_rgba(239,68,68,0.15)] space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="text-error" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-headline font-bold text-on-surface">Reset Game?</h2>
                <p className="text-sm text-on-surface-variant">This cannot be undone.</p>
              </div>
            </div>
            <div className="bg-surface-variant rounded-2xl p-4 space-y-2 text-sm text-on-surface-variant">
              <p className="font-bold text-on-surface mb-2">This will:</p>
              <p>🗑️ Delete all portfolios & trade listings</p>
              <p>🗑️ Delete all scenario submissions & votes</p>
              <p>🔄 Reset all meme prices to initial values</p>
              <p>💰 Reset all team budgets to ${STARTING_BUDGET.toLocaleString()}</p>
              <p>⚙️ Set game state back to Setup (Round 0)</p>
              <p className="text-on-surface font-medium mt-2">✅ Users & meme catalog are kept.</p>
            </div>

            {resetStatus && (
              <div className="bg-surface-variant rounded-xl p-3 text-sm font-mono text-on-surface animate-pulse">
                {resetStatus}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowResetConfirm(false); setResetStatus(''); }}
                disabled={resetting}
                className="flex-1 py-3 rounded-xl bg-surface-variant text-on-surface-variant font-bold hover:text-on-surface transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResetGame}
                disabled={resetting}
                className="flex-1 py-3 rounded-xl bg-error text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <RotateCcw size={18} className={resetting ? 'animate-spin' : ''} />
                {resetting ? 'Resetting...' : 'Yes, Reset Everything'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Default Credentials Banner */}
      <div className="bg-surface-container border border-outline-variant rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-tertiary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-on-surface mb-2">Default Login Credentials (pre-seeded)</p>
            <div className="flex flex-wrap gap-3">
              {DEFAULT_CREDS.map(c => (
                <div key={c.role} className="bg-surface-variant rounded-xl px-4 py-2 text-sm">
                  <span className="text-on-surface-variant">{c.role}:</span>{' '}
                  <span className="font-mono font-bold text-on-surface">{c.username}</span>{' '}
                  <span className="text-on-surface-variant">/</span>{' '}
                  <span className="font-mono text-primary">{c.password}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add User Form */}
      {isAdding && (
        <form onSubmit={handleAddUser} className="bg-surface-container border border-primary/30 rounded-3xl p-6 space-y-4 shadow-[0_0_20px_rgba(242,253,104,0.06)]">
          <h2 className="text-lg font-bold text-on-surface">New User</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Display Name</label>
              <input required type="text" placeholder="e.g. Team Alpha"
                value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Username</label>
              <input required type="text" placeholder="e.g. team_alpha"
                value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Password</label>
              <input required type="text" placeholder="e.g. alpha@1234"
                value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Email (optional)</label>
              <input type="email" placeholder="team@example.com"
                value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Role</label>
              <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface focus:border-primary focus:outline-none">
                <option value="team">Team (Player)</option>
                <option value="audience">Audience (Voter)</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {newUser.role === 'team' && (
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Starting Budget ($)</label>
                <input required type="number" min="0" value={newUser.budget}
                  onChange={e => setNewUser({ ...newUser, budget: Number(e.target.value) })}
                  className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface font-mono focus:border-primary focus:outline-none" />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsAdding(false)}
              className="px-5 py-2.5 text-on-surface-variant hover:text-on-surface rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50">
              <UserPlus size={18} />
              {loading ? 'Adding...' : 'Add User'}
            </button>
          </div>
        </form>
      )}

      {/* Users Table */}
      <div className="bg-surface-container border border-outline-variant rounded-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
          <p className="font-bold text-on-surface">{users.length} total users</p>
          <div className="flex gap-2 text-xs">
            <span className="bg-error/20 text-error px-2 py-1 rounded-full border border-error/20">Admin: {users.filter(u => u.role === 'admin').length}</span>
            <span className="bg-primary/20 text-primary px-2 py-1 rounded-full border border-primary/20">Teams: {users.filter(u => u.role === 'team').length}</span>
            <span className="bg-secondary/20 text-secondary px-2 py-1 rounded-full border border-secondary/20">Voters: {users.filter(u => u.role === 'audience').length}</span>
          </div>
        </div>

        {editingId && (
          <div className="px-6 py-2 bg-primary/5 border-b border-primary/20 text-xs text-primary flex items-center gap-2">
            <Pencil size={12} /> Editing row — press <kbd className="bg-surface-variant px-1.5 py-0.5 rounded font-mono">Enter</kbd> or click ✓ to save, <kbd className="bg-surface-variant px-1.5 py-0.5 rounded font-mono">Esc</kbd> to cancel
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-variant text-on-surface-variant">
              <tr>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Username</th>
                <th className="p-4 font-medium">Password</th>
                <th className="p-4 font-medium">Role</th>
                <th className="p-4 font-medium">Budget</th>
                <th className="p-4 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {sortedUsers.map(user => {
                const isEditing = editingId === user.id;
                return (
                  <tr
                    key={user.id}
                    className={clsx('transition-colors', isEditing ? 'bg-primary/5' : 'hover:bg-surface-variant/30')}
                    onKeyDown={e => {
                      if (!isEditing) return;
                      if (e.key === 'Enter') saveEdit(user.id);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  >
                    <td className="p-3">
                      {isEditing ? (
                        <input value={editState.name} onChange={e => setEditState(s => ({ ...s, name: e.target.value }))} className={inputCls} autoFocus />
                      ) : (
                        <span className="font-bold text-on-surface">{user.name || user.username}</span>
                      )}
                    </td>
                    <td className="p-3">
                      {isEditing ? (
                        <input value={editState.username} onChange={e => setEditState(s => ({ ...s, username: e.target.value }))} className={inputCls} />
                      ) : (
                        <span className="font-mono text-on-surface">{user.username}</span>
                      )}
                    </td>
                    <td className="p-3">
                      {isEditing ? (
                        <input value={editState.password} onChange={e => setEditState(s => ({ ...s, password: e.target.value }))} className={inputCls} placeholder="new password" />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-on-surface-variant">
                            {showPass[user.id] ? (user.password || '—') : '••••••••'}
                          </span>
                          <button onClick={() => togglePass(user.id)} className="text-on-surface-variant hover:text-on-surface transition-colors shrink-0">
                            {showPass[user.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      {isEditing ? (
                        <select value={editState.role} onChange={e => setEditState(s => ({ ...s, role: e.target.value }))} className={clsx(inputCls, 'font-sans')}>
                          <option value="team">Team</option>
                          <option value="audience">Audience</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className={clsx('px-2.5 py-1 rounded-full text-xs font-bold capitalize', ROLE_COLORS[user.role || 'audience'])}>
                          {user.role}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {isEditing && editState.role === 'team' ? (
                        <input type="number" min="0" value={editState.budget} onChange={e => setEditState(s => ({ ...s, budget: Number(e.target.value) }))} className={clsx(inputCls, 'w-28')} />
                      ) : (
                        <span className={clsx('font-mono font-bold', (isEditing ? editState.role : user.role) === 'team' ? 'text-primary' : 'text-on-surface-variant')}>
                          {user.role === 'team' ? `$${(user.budget || 0).toLocaleString()}` : '—'}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit(user.id)} disabled={savingId === user.id}
                              className="bg-primary text-on-primary p-1.5 rounded-lg hover:bg-primary-dim transition-colors disabled:opacity-50" title="Save (Enter)">
                              <Check size={15} />
                            </button>
                            <button onClick={cancelEdit}
                              className="bg-surface-variant text-on-surface-variant p-1.5 rounded-lg hover:text-on-surface transition-colors" title="Cancel (Esc)">
                              <X size={15} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(user)}
                              className="text-on-surface-variant hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-primary/10" title="Edit user">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => handleDelete(user.id)}
                              className="text-on-surface-variant hover:text-error transition-colors p-1.5 rounded-lg hover:bg-error/10" title="Delete user">
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-on-surface-variant">
                    No users yet. Click "Add User" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
