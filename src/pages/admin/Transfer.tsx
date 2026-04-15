import React, { useState, useEffect } from 'react';
import { useStore, AppUser } from '../../store/useStore';
import { collection, query, where, getDocs, doc, runTransaction } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Repeat } from 'lucide-react';

export default function AdminTransfer() {
  const { memes } = useStore();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [fromUsername, setFromUsername] = useState('');
  const [toUsername, setToUsername] = useState('');
  const [selectedMemeId, setSelectedMemeId] = useState('');
  const [sharesToTransfer, setSharesToTransfer] = useState(1);
  const [isTransferring, setIsTransferring] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'team'));
        const snap = await getDocs(q);
        const usersData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
        setUsers(usersData);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };
    fetchUsers();
  }, []);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!fromUsername || !toUsername || !selectedMemeId || sharesToTransfer <= 0) {
      setMessage({ type: 'error', text: 'Please fill in all fields correctly.' });
      return;
    }

    if (fromUsername === toUsername) {
      setMessage({ type: 'error', text: 'Cannot transfer to the same user.' });
      return;
    }

    const fromUser = users.find(u => u.username === fromUsername);
    const toUser = users.find(u => u.username === toUsername);

    if (!fromUser || !toUser) {
      setMessage({ type: 'error', text: 'One or both users not found.' });
      return;
    }

    setIsTransferring(true);

    try {
      await runTransaction(db, async (transaction) => {
        // Find fromUser's portfolio item for this meme
        const fromPortfolioQuery = query(
          collection(db, 'portfolios'), 
          where('userId', '==', fromUser.id),
          where('memeId', '==', selectedMemeId)
        );
        const fromPortfolioSnap = await getDocs(fromPortfolioQuery);
        
        if (fromPortfolioSnap.empty) {
          throw new Error(`${fromUsername} does not own any shares of this meme.`);
        }

        const fromPortfolioDoc = fromPortfolioSnap.docs[0];
        const fromPortfolioData = fromPortfolioDoc.data();

        if (fromPortfolioData.shares < sharesToTransfer) {
          throw new Error(`${fromUsername} only has ${fromPortfolioData.shares} shares.`);
        }

        // Find toUser's portfolio item for this meme
        const toPortfolioQuery = query(
          collection(db, 'portfolios'), 
          where('userId', '==', toUser.id),
          where('memeId', '==', selectedMemeId)
        );
        const toPortfolioSnap = await getDocs(toPortfolioQuery);

        // Deduct from fromUser
        const newFromShares = fromPortfolioData.shares - sharesToTransfer;
        if (newFromShares === 0) {
          transaction.delete(fromPortfolioDoc.ref);
        } else {
          transaction.update(fromPortfolioDoc.ref, { shares: newFromShares });
        }

        // Add to toUser
        if (toPortfolioSnap.empty) {
          const newPortfolioRef = doc(collection(db, 'portfolios'));
          transaction.set(newPortfolioRef, {
            userId: toUser.id,
            memeId: selectedMemeId,
            shares: sharesToTransfer,
            averagePrice: 0 // Or calculate based on current price if needed
          });
        } else {
          const toPortfolioDoc = toPortfolioSnap.docs[0];
          const toPortfolioData = toPortfolioDoc.data();
          transaction.update(toPortfolioDoc.ref, {
            shares: toPortfolioData.shares + sharesToTransfer
          });
        }
      });

      setMessage({ type: 'success', text: `Successfully transferred ${sharesToTransfer} shares from ${fromUsername} to ${toUsername}.` });
      setFromUsername('');
      setToUsername('');
      setSelectedMemeId('');
      setSharesToTransfer(1);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Transfer failed.' });
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="space-y-8 pb-20 md:pb-0 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-headline font-bold text-on-surface">Transfer Ownership</h1>
        <p className="text-on-surface-variant">Transfer meme shares between teams</p>
      </div>

      <form onSubmit={handleTransfer} className="bg-surface-container border border-outline-variant rounded-3xl p-6 space-y-6">
        {message.text && (
          <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'error' ? 'bg-error/20 text-error' : 'bg-primary/20 text-primary'}`}>
            {message.text}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-on-surface-variant mb-1">From Username</label>
            <select 
              required
              value={fromUsername}
              onChange={e => setFromUsername(e.target.value)}
              className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-3 text-on-surface focus:border-primary focus:outline-none"
            >
              <option value="">Select User</option>
              {users.map(u => (
                <option key={u.id} value={u.username}>{u.username} ({u.name})</option>
              ))}
            </select>
          </div>

          <div className="flex justify-center">
            <div className="bg-surface-variant p-2 rounded-full text-on-surface-variant">
              <Repeat size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm text-on-surface-variant mb-1">To Username</label>
            <select 
              required
              value={toUsername}
              onChange={e => setToUsername(e.target.value)}
              className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-3 text-on-surface focus:border-primary focus:outline-none"
            >
              <option value="">Select User</option>
              {users.map(u => (
                <option key={u.id} value={u.username}>{u.username} ({u.name})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-on-surface-variant mb-1">Meme</label>
            <select 
              required
              value={selectedMemeId}
              onChange={e => setSelectedMemeId(e.target.value)}
              className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-3 text-on-surface focus:border-primary focus:outline-none"
            >
              <option value="">Select Meme</option>
              {memes.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-on-surface-variant mb-1">Number of Shares</label>
            <input 
              required
              type="number" 
              min="1"
              value={sharesToTransfer}
              onChange={e => setSharesToTransfer(Number(e.target.value))}
              className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-3 text-on-surface focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isTransferring}
          className="w-full bg-primary hover:bg-primary-dim text-on-primary font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTransferring ? 'Transferring...' : 'Execute Transfer'}
        </button>
      </form>
    </div>
  );
}
