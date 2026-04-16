import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { collection, addDoc, doc, updateDoc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import {
  Plus, PlayCircle, StopCircle, TrendingUp, TrendingDown,
  Trash2, Image as ImageIcon, Zap, ChevronDown, ChevronUp, X, Shield
} from 'lucide-react';
import clsx from 'clsx';

export default function AdminRound1() {
  const { memes, gameState, appUser } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stoppingRound, setStoppingRound] = useState(false);
  const [expandedMeme, setExpandedMeme] = useState<string | null>(null);
  const [newMeme, setNewMeme] = useState({ name: '', imageUrl: '', initialPrice: 100, totalShares: 100 });
  const [previewUrl, setPreviewUrl] = useState('');

  const handleInitializeGame = async () => {
    try {
      const gameRef = doc(db, 'gameState', 'current');
      const existing = await getDoc(gameRef);
      if (!existing.exists()) {
        await setDoc(gameRef, {
          currentRound: 0, status: 'setup', activeScenarioId: null,
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'gameState/current');
    }
  };

  const handleStartRound1 = async () => {
    try {
      await updateDoc(doc(db, 'gameState', 'current'), { currentRound: 1, status: 'active' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'gameState/current');
    }
  };

  /** Stop Round 1: assign all unsold shares to the admin's portfolio */
  const handleStopRound1 = async () => {
    if (!appUser) return;
    setStoppingRound(true);
    try {
      for (const meme of memes) {
        if (meme.availableShares <= 0) continue;

        const portId = `${appUser.id}_${meme.id}`;
        const portRef = doc(db, 'portfolios', portId);
        const existing = await getDoc(portRef);

        if (existing.exists()) {
          await updateDoc(portRef, { shares: existing.data().shares + meme.availableShares });
        } else {
          await setDoc(portRef, {
            userId: appUser.id,
            memeId: meme.id,
            shares: meme.availableShares,
            averagePrice: meme.currentPrice,
          });
        }
        // Zero out available shares on the meme itself
        await updateDoc(doc(db, 'memes', meme.id), { availableShares: 0 });
      }
      await updateDoc(doc(db, 'gameState', 'current'), { currentRound: 1, status: 'completed' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'round1-stop');
    } finally {
      setStoppingRound(false);
    }
  };

  const handleAddMeme = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'memes'), {
        name: newMeme.name,
        imageUrl: newMeme.imageUrl,
        initialPrice: Number(newMeme.initialPrice),
        currentPrice: Number(newMeme.initialPrice),
        totalShares: Number(newMeme.totalShares),
        availableShares: Number(newMeme.totalShares),
      });
      setIsAdding(false);
      setNewMeme({ name: '', imageUrl: '', initialPrice: 100, totalShares: 100 });
      setPreviewUrl('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'memes');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMeme = async (memeId: string) => {
    if (!confirm('Delete this meme? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'memes', memeId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `memes/${memeId}`);
    }
  };

  const isRound1Active = gameState?.currentRound === 1 && gameState?.status === 'active';

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-6">
        <div className="w-24 h-24 bg-surface-variant rounded-full flex items-center justify-center">
          <Zap size={48} className="text-primary" />
        </div>
        <div>
          <h2 className="text-3xl font-headline font-bold text-on-surface mb-2">Game Not Initialized</h2>
          <p className="text-on-surface-variant mb-6">Set up the game state to begin adding memes and starting rounds.</p>
          <button onClick={handleInitializeGame}
            className="bg-primary hover:bg-primary-dim text-on-primary font-bold py-3 px-8 rounded-xl transition-all shadow-[0_0_15px_rgba(242,253,104,0.2)]">
            Initialize Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-on-surface flex items-center gap-3">
            <ImageIcon className="text-primary" size={32} />
            Round 1: Meme Market
          </h1>
          <p className="text-on-surface-variant mt-1">
            {memes.length} memes — Status:{' '}
            <span className={clsx('font-bold', isRound1Active ? 'text-primary' : 'text-on-surface-variant')}>
              {isRound1Active ? '🟢 Live' : gameState.currentRound === 1 && gameState.status === 'completed' ? '🔴 Completed' : '⚪ Pending'}
            </span>
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => setIsAdding(!isAdding)}
            className={clsx('flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold border transition-all',
              isAdding ? 'bg-surface-variant text-on-surface border-outline-variant' : 'bg-surface-container border-outline-variant hover:border-primary text-on-surface')}>
            {isAdding ? <X size={18} /> : <Plus size={18} />}
            {isAdding ? 'Cancel' : 'Add Meme'}
          </button>
          {isRound1Active ? (
            <button onClick={handleStopRound1} disabled={stoppingRound}
              className="bg-error/20 text-error hover:bg-error/30 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 border border-error/30 transition-colors disabled:opacity-50">
              <StopCircle size={18} />
              {stoppingRound ? 'Assigning unsold shares...' : 'Stop Round 1'}
            </button>
          ) : (
            <button onClick={handleStartRound1}
              className="bg-primary hover:bg-primary-dim text-on-primary px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(242,253,104,0.2)]">
              <PlayCircle size={18} /> Start Round 1
            </button>
          )}
        </div>
      </div>

      {/* Unsold shares info when round 1 completed */}
      {gameState.currentRound === 1 && gameState.status === 'completed' && (
        <div className="bg-surface-container border border-outline-variant rounded-2xl p-4 flex items-center gap-3">
          <Shield size={20} className="text-tertiary shrink-0" />
          <p className="text-sm text-on-surface-variant">
            Round 1 ended — all unsold shares have been assigned to your admin account.{' '}
            <span className="text-on-surface font-bold">Use the Transfer panel to distribute them to teams.</span>
          </p>
        </div>
      )}

      {/* Add Meme Form */}
      {isAdding && (
        <form onSubmit={handleAddMeme} className="bg-surface-container border border-primary/30 rounded-3xl p-6 space-y-5 shadow-[0_0_20px_rgba(242,253,104,0.06)]">
          <h2 className="text-lg font-bold text-on-surface">Add New Meme to Market</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Meme Name</label>
                <input required type="text" placeholder='"This is Fine Dog"'
                  value={newMeme.name} onChange={e => setNewMeme({ ...newMeme, name: e.target.value })}
                  className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Image URL</label>
                <input required type="url" placeholder="https://i.imgflip.com/..."
                  value={newMeme.imageUrl}
                  onChange={e => { setNewMeme({ ...newMeme, imageUrl: e.target.value }); setPreviewUrl(e.target.value); }}
                  className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface focus:border-primary focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Price per Share ($)</label>
                  <input required type="number" min="1" value={newMeme.initialPrice}
                    onChange={e => setNewMeme({ ...newMeme, initialPrice: Number(e.target.value) })}
                    className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface font-mono focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Total Shares</label>
                  <input required type="number" min="1" value={newMeme.totalShares}
                    onChange={e => setNewMeme({ ...newMeme, totalShares: Number(e.target.value) })}
                    className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface font-mono focus:border-primary focus:outline-none" />
                </div>
              </div>
              <div className="bg-surface-variant rounded-xl p-3 text-sm text-on-surface-variant border border-outline-variant">
                Market cap: <span className="font-mono font-bold text-primary">${(newMeme.initialPrice * newMeme.totalShares).toLocaleString()}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Image Preview</label>
              <div className="h-52 bg-surface-variant border border-outline-variant rounded-2xl overflow-hidden flex items-center justify-center">
                {previewUrl ? (
                  <img src={previewUrl} alt="preview" className="w-full h-full object-cover" onError={() => setPreviewUrl('')} referrerPolicy="no-referrer" />
                ) : (
                  <div className="text-center text-on-surface-variant p-4">
                    <ImageIcon size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Paste a URL to preview</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsAdding(false)} className="px-5 py-2.5 text-on-surface-variant hover:text-on-surface rounded-xl">Cancel</button>
            <button type="submit" disabled={loading} className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50">
              <Plus size={18} />{loading ? 'Adding...' : 'Add to Market'}
            </button>
          </div>
        </form>
      )}

      {/* Memes Grid */}
      {memes.length === 0 ? (
        <div className="text-center py-20 text-on-surface-variant border border-dashed border-outline-variant rounded-3xl">
          <ImageIcon size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No memes yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {memes.map((meme) => {
            const isUp = meme.currentPrice >= meme.initialPrice;
            const soldShares = meme.totalShares - meme.availableShares;
            const soldPct = meme.totalShares > 0 ? (soldShares / meme.totalShares) * 100 : 0;
            const isExpanded = expandedMeme === meme.id;

            return (
              <div key={meme.id} className="bg-surface-container border border-outline-variant rounded-3xl overflow-hidden flex flex-col neon-glow-box transition-all duration-300">
                <div className="h-44 bg-surface-variant relative overflow-hidden group">
                  <img src={meme.imageUrl} alt={meme.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent opacity-80" />
                  <div className="absolute top-3 right-3">
                    <button onClick={() => handleDeleteMeme(meme.id)}
                      className="bg-background/60 backdrop-blur-sm text-error hover:bg-error/20 p-1.5 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                    <h3 className="text-base font-headline font-bold text-white drop-shadow-md leading-tight">{meme.name}</h3>
                    <div className={clsx('flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold backdrop-blur-md',
                      isUp ? 'bg-primary/20 text-primary' : 'bg-error/20 text-error')}>
                      {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      ${meme.currentPrice.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="p-4 flex-1 space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-on-surface-variant mb-1">
                      <span>Sold: {soldShares}/{meme.totalShares}</span>
                      <span>{soldPct.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-surface-variant rounded-full h-1.5">
                      <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${soldPct}%` }} />
                    </div>
                  </div>
                  <button onClick={() => setExpandedMeme(isExpanded ? null : meme.id)}
                    className="w-full flex items-center justify-between text-xs text-on-surface-variant hover:text-on-surface transition-colors py-1">
                    <span>Details</span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {isExpanded && (
                    <div className="space-y-2 text-sm border-t border-outline-variant pt-3">
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Initial Price</span>
                        <span className="font-mono">${meme.initialPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Available</span>
                        <span className="font-mono font-bold text-primary">{meme.availableShares}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
