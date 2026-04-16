import React, { useState, useEffect } from 'react';
import { useStore, AppUser } from '../../store/useStore';
import {
  collection, query, where, getDocs, doc,
  runTransaction, updateDoc, onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { ArrowRight, Repeat2, CheckCircle2, AlertCircle, DollarSign } from 'lucide-react';
import clsx from 'clsx';

interface PortfolioRow { docId: string; memeId: string; shares: number; averagePrice: number; }

export default function AdminTransfer() {
  const { memes } = useStore();

  // All users (admin can be "from" — transfers back to admin = back to market)
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [fromUsername, setFromUsername] = useState('');
  const [toUsername, setToUsername] = useState('');
  const [selectedMemeId, setSelectedMemeId] = useState('');
  const [sharesToTransfer, setSharesToTransfer] = useState(1);
  const [pricePerShare, setPricePerShare] = useState(0);
  const [isTransferring, setIsTransferring] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Portfolio of the selected "from" user — fetched fresh on user change
  const [fromPortfolio, setFromPortfolio] = useState<PortfolioRow[]>([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
    }, console.error);
    return () => unsub();
  }, []);

  // Fetch portfolio whenever fromUsername changes
  const fromUser = allUsers.find(u => u.username === fromUsername);
  const toUser = allUsers.find(u => u.username === toUsername);

  useEffect(() => {
    if (!fromUser) { setFromPortfolio([]); setSelectedMemeId(''); return; }
    setLoadingPortfolio(true);
    getDocs(query(collection(db, 'portfolios'), where('userId', '==', fromUser.id)))
      .then(snap => {
        setFromPortfolio(snap.docs
          .map(d => ({
            docId: d.id,
            memeId: d.data().memeId as string,
            shares: d.data().shares as number,
            averagePrice: d.data().averagePrice as number,
          }))
          .filter(p => p.shares > 0)  // filter client-side (avoids composite index requirement)
        );
        setSelectedMemeId('');
        setSharesToTransfer(1);
      })
      .catch(console.error)
      .finally(() => setLoadingPortfolio(false));
  }, [fromUser?.id]);

  // Update price when meme selected
  useEffect(() => {
    if (selectedMemeId) {
      const meme = memes.find(m => m.id === selectedMemeId);
      if (meme) setPricePerShare(meme.currentPrice);
    }
  }, [selectedMemeId, memes]);

  // Only memes the from-user actually owns
  const ownedMemeIds = new Set(fromPortfolio.map(p => p.memeId));
  const availableMemes = memes.filter(m => ownedMemeIds.has(m.id));
  const selectedPortfolioRow = fromPortfolio.find(p => p.memeId === selectedMemeId);
  const maxShares = selectedPortfolioRow?.shares ?? 1;

  const selectedMeme = memes.find(m => m.id === selectedMemeId);
  const totalValue = sharesToTransfer * pricePerShare;
  const toIsAdmin = toUser?.role === 'admin';

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (fromUsername === toUsername) { setMessage({ type: 'error', text: 'Cannot transfer to the same user.' }); return; }
    if (!fromUser || !toUser) { setMessage({ type: 'error', text: 'One or both users not found.' }); return; }
    if (!selectedPortfolioRow) { setMessage({ type: 'error', text: 'This meme is not in the sender\'s portfolio.' }); return; }
    if (sharesToTransfer > selectedPortfolioRow.shares) {
      setMessage({ type: 'error', text: `${fromUsername} only has ${selectedPortfolioRow.shares} shares. You can't transfer more.` });
      return;
    }

    setIsTransferring(true);
    try {
      /* ────────────────────────────────────────────
       * Query portfolio docs OUTSIDE the transaction
       * to avoid "Quota exceeded" from Firestore
       * retrying getDocs() calls repeatedly
       * ──────────────────────────────────────────── */
      const fromPortRef = doc(db, 'portfolios', selectedPortfolioRow.docId);

      // Receiver's portfolio doc (if exists)
      let toPortRef: ReturnType<typeof doc> | null = null;
      let toPortShares = 0;
      let toPortAvgPrice = 0;

      if (!toIsAdmin) {
        // Only look up receiver portfolio when NOT returning to market
        const toPortSnap = await getDocs(
          query(collection(db, 'portfolios'), where('userId', '==', toUser.id), where('memeId', '==', selectedMemeId))
        );
        if (!toPortSnap.empty) {
          const d = toPortSnap.docs[0];
          toPortRef = doc(db, 'portfolios', d.id);
          toPortShares = d.data().shares;
          toPortAvgPrice = d.data().averagePrice;
        }
      }

      const fromUserRef = doc(db, 'users', fromUser.id);
      const toUserRef = toIsAdmin ? null : doc(db, 'users', toUser.id);
      const memeRef = doc(db, 'memes', selectedMemeId);

      await runTransaction(db, async (transaction) => {
        // ── Read all docs inside transaction using refs (NOT getDocs) ──
        const fromPortData = await transaction.get(fromPortRef);
        if (!fromPortData.exists()) throw new Error(`Sender's portfolio no longer exists.`);
        const currentFromShares: number = fromPortData.data().shares;
        if (currentFromShares < sharesToTransfer) {
          throw new Error(`${fromUsername} only has ${currentFromShares} shares now.`);
        }

        const fromUserData = await transaction.get(fromUserRef);
        const fromBudget: number = fromUserData.data()?.budget || 0;

        // ── Deduct shares from sender ──
        const newFromShares = currentFromShares - sharesToTransfer;
        if (newFromShares === 0) {
          transaction.delete(fromPortRef);
        } else {
          transaction.update(fromPortRef, { shares: newFromShares });
        }

        // ── If returning to market (to = admin): restore availableShares ──
        if (toIsAdmin) {
          const memeData = await transaction.get(memeRef);
          const current = memeData.data()?.availableShares || 0;
          transaction.update(memeRef, { availableShares: current + sharesToTransfer });
          // Seller gets money credited (if price > 0)
          if (pricePerShare > 0) {
            transaction.update(fromUserRef, { budget: fromBudget + totalValue });
          }
          return; // done — no receiver portfolio needed
        }

        // ── Normal team-to-team transfer ──
        if (toPortRef) {
          // Receiver already has this meme — average in
          const toPortData = await transaction.get(toPortRef);
          const existingShares: number = toPortData.data()?.shares || toPortShares;
          const existingAvg: number = toPortData.data()?.averagePrice || toPortAvgPrice;
          const newShares = existingShares + sharesToTransfer;
          const newAvg = ((existingShares * existingAvg) + (sharesToTransfer * pricePerShare)) / newShares;
          transaction.update(toPortRef, { shares: newShares, averagePrice: newAvg });
        } else {
          // Receiver doesn't have this meme yet — create entry
          const newPortRef = doc(collection(db, 'portfolios'));
          transaction.set(newPortRef, {
            userId: toUser.id,
            memeId: selectedMemeId,
            shares: sharesToTransfer,
            averagePrice: pricePerShare,
          });
        }

        // ── Update budgets if price > 0 ──
        if (pricePerShare > 0 && toUserRef) {
          const toUserData = await transaction.get(toUserRef);
          const toBudget: number = toUserData.data()?.budget || 0;
          if (toBudget < totalValue) throw new Error(`${toUsername} doesn't have enough budget ($${toBudget.toFixed(2)}).`);
          transaction.update(fromUserRef, { budget: fromBudget + totalValue });
          transaction.update(toUserRef, { budget: toBudget - totalValue });
        }
      });

      setMessage({
        type: 'success',
        text: toIsAdmin
          ? `✅ ${sharesToTransfer} shares of "${selectedMeme?.name}" returned to market from ${fromUsername}.`
          : `✅ Transferred ${sharesToTransfer} shares of "${selectedMeme?.name}" from ${fromUsername} → ${toUsername}${pricePerShare > 0 ? ` for $${totalValue.toLocaleString()}` : ' (free)'}`,
      });

      // Refresh from-portfolio
      const refresh = await getDocs(
        query(collection(db, 'portfolios'), where('userId', '==', fromUser.id), where('shares', '>', 0))
      );
      setFromPortfolio(refresh.docs.map(d => ({
        docId: d.id,
        memeId: d.data().memeId,
        shares: d.data().shares,
        averagePrice: d.data().averagePrice,
      })));
      setSelectedMemeId('');
      setSharesToTransfer(1);
      setPricePerShare(0);
    } catch (error: any) {
      const msg = error?.message || 'Transfer failed.';
      // Friendlier message for quota/permission errors
      const friendly = msg.includes('resource-exhausted') || msg.includes('RESOURCE_EXHAUSTED')
        ? 'Firebase quota reached. Wait a minute and try again, or reduce the number of Firestore listeners.'
        : msg.includes('permission') || msg.includes('PERMISSION_DENIED')
          ? 'Permission denied. Check Firestore security rules.'
          : msg;
      setMessage({ type: 'error', text: friendly });
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="space-y-8 pb-20 md:pb-0 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-headline font-bold text-on-surface flex items-center gap-3">
          <Repeat2 className="text-tertiary" size={32} />
          Transfer Ownership
        </h1>
        <p className="text-on-surface-variant mt-1">
          Move shares between teams. Transferring to admin returns shares to the open market.
        </p>
      </div>

      {/* Summary Preview */}
      {fromUsername && toUsername && selectedMeme && (
        <div className={clsx(
          'border rounded-2xl p-5 flex flex-wrap items-center gap-4',
          toIsAdmin ? 'bg-secondary/5 border-secondary/30' : 'bg-surface-container border-tertiary/30'
        )}>
          <div className="text-center">
            <p className="text-xs text-on-surface-variant">From</p>
            <p className="font-bold text-on-surface">{fromUser?.name || fromUsername}</p>
            <p className="text-xs font-mono text-on-surface-variant">@{fromUsername}</p>
          </div>
          <ArrowRight className="text-tertiary mx-2" size={24} />
          <div className="text-center">
            <p className="text-xs text-on-surface-variant">Meme</p>
            <p className="font-bold text-primary">{selectedMeme.name}</p>
            <p className="text-xs font-mono text-on-surface-variant">{sharesToTransfer} of {maxShares} shares</p>
          </div>
          <ArrowRight className="text-tertiary mx-2" size={24} />
          <div className="text-center">
            <p className="text-xs text-on-surface-variant">To</p>
            <p className="font-bold text-on-surface">{toUser?.name || toUsername}</p>
            {toIsAdmin && <p className="text-xs text-secondary font-bold">→ Back to Market</p>}
          </div>
          {pricePerShare > 0 && (
            <div className="ml-auto text-right">
              <p className="text-xs text-on-surface-variant">Total</p>
              <p className="font-mono font-bold text-tertiary text-xl">${totalValue.toLocaleString()}</p>
            </div>
          )}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleTransfer} className="bg-surface-container border border-outline-variant rounded-3xl p-6 space-y-6">
        {message && (
          <div className={clsx('flex items-start gap-3 p-4 rounded-xl text-sm font-medium',
            message.type === 'error' ? 'bg-error/10 text-error border border-error/20' : 'bg-primary/10 text-primary border border-primary/20')}>
            {message.type === 'error' ? <AlertCircle size={18} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={18} className="shrink-0 mt-0.5" />}
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* From */}
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1.5">From User</label>
            <select required value={fromUsername} onChange={e => { setFromUsername(e.target.value); setMessage(null); }}
              className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-3 text-on-surface focus:border-primary focus:outline-none">
              <option value="">Select sender…</option>
              {allUsers.map(u => (
                <option key={u.id} value={u.username}>
                  {u.name || u.username} (@{u.username}) {u.role === 'team' ? `— $${(u.budget || 0).toLocaleString()}` : '[Admin]'}
                </option>
              ))}
            </select>
          </div>

          {/* To */}
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
              To User <span className="text-secondary font-normal">(Admin = return to market)</span>
            </label>
            <select required value={toUsername} onChange={e => { setToUsername(e.target.value); setMessage(null); }}
              className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-3 text-on-surface focus:border-primary focus:outline-none">
              <option value="">Select receiver…</option>
              {allUsers.filter(u => u.username !== fromUsername).map(u => (
                <option key={u.id} value={u.username}>
                  {u.name || u.username} (@{u.username}) {u.role === 'admin' ? '🔄 Market' : `— $${(u.budget || 0).toLocaleString()}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Meme — only from user's portfolio */}
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
            Meme {loadingPortfolio && <span className="text-primary animate-pulse">(loading portfolio…)</span>}
          </label>
          <select required value={selectedMemeId} onChange={e => { setSelectedMemeId(e.target.value); setSharesToTransfer(1); setMessage(null); }}
            disabled={!fromUsername || loadingPortfolio}
            className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-3 text-on-surface focus:border-primary focus:outline-none disabled:opacity-50">
            <option value="">{fromUsername ? (availableMemes.length === 0 ? 'No memes in portfolio' : 'Select meme…') : 'Select sender first…'}</option>
            {availableMemes.map(m => {
              const owned = fromPortfolio.find(p => p.memeId === m.id)?.shares || 0;
              return (
                <option key={m.id} value={m.id}>
                  {m.name} — {owned} shares owned — Market price: ${m.currentPrice.toFixed(2)}
                </option>
              );
            })}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Shares */}
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
              Number of Shares {maxShares > 0 && selectedMemeId && <span className="text-primary font-normal">(max: {maxShares})</span>}
            </label>
            <input required type="number" min="1" max={maxShares}
              value={sharesToTransfer}
              onChange={e => {
                const v = Math.min(Number(e.target.value), maxShares);
                setSharesToTransfer(v);
              }}
              className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-3 text-on-surface font-mono focus:border-primary focus:outline-none" />
            {selectedMemeId && sharesToTransfer > maxShares && (
              <p className="text-xs text-error mt-1">⚠ Exceeds available shares ({maxShares})</p>
            )}
          </div>

          {/* Price */}
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
              Price per Share ($) <span className="text-on-surface-variant font-normal">(0 = free)</span>
            </label>
            <div className="relative">
              <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input type="number" min="0" step="0.01" value={pricePerShare}
                onChange={e => setPricePerShare(Number(e.target.value))}
                className="w-full bg-surface-variant border border-outline-variant rounded-xl pl-8 pr-4 py-3 text-on-surface font-mono focus:border-primary focus:outline-none" />
            </div>
            {pricePerShare > 0 && (
              <p className="text-xs text-on-surface-variant mt-1">
                Total: <span className="font-mono font-bold text-tertiary">${totalValue.toLocaleString()}</span>
                {toIsAdmin ? ' credited to sender' : ' deducted from receiver\'s budget'}
              </p>
            )}
          </div>
        </div>

        <button type="submit" disabled={isTransferring || !selectedMemeId || !fromUsername || !toUsername}
          className="w-full bg-tertiary hover:bg-tertiary-dim text-on-tertiary font-bold py-3.5 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,224,141,0.15)]">
          <Repeat2 size={20} />
          {isTransferring ? 'Processing...' : toIsAdmin ? '🔄 Return to Market' : 'Execute Transfer'}
        </button>
      </form>
    </div>
  );
}
