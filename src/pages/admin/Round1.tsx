import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { collection, addDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Plus, PlayCircle, StopCircle, TrendingUp, TrendingDown } from 'lucide-react';
import clsx from 'clsx';

export default function AdminRound1() {
  const { memes, gameState } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newMeme, setNewMeme] = useState({
    name: '',
    imageUrl: '',
    initialPrice: 10,
    totalShares: 100
  });

  const handleInitializeGame = async () => {
    try {
      await setDoc(doc(db, 'gameState', 'current'), {
        currentRound: 0,
        status: 'setup',
        activeScenarioId: null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'gameState/current');
    }
  };

  const handleRoundChange = async (round: number, status: 'setup' | 'active' | 'completed') => {
    try {
      await updateDoc(doc(db, 'gameState', 'current'), {
        currentRound: round,
        status: status
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'gameState/current');
    }
  };

  const handleAddMeme = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'memes'), {
        name: newMeme.name,
        imageUrl: newMeme.imageUrl,
        initialPrice: Number(newMeme.initialPrice),
        currentPrice: Number(newMeme.initialPrice),
        totalShares: Number(newMeme.totalShares),
        availableShares: Number(newMeme.totalShares)
      });
      setIsAdding(false);
      setNewMeme({ name: '', imageUrl: '', initialPrice: 10, totalShares: 100 });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'memes');
    }
  };

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-3xl font-headline font-bold text-on-surface mb-4">Game Not Initialized</h2>
        <button 
          onClick={handleInitializeGame}
          className="bg-primary hover:bg-primary-dim text-on-primary font-bold py-3 px-8 rounded-xl transition-all"
        >
          Initialize Game State
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-on-surface">Round 1: Meme Market</h1>
          <p className="text-on-surface-variant">Manage memes and market status</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-surface-container border border-outline-variant hover:border-primary text-on-surface px-4 py-2 rounded-xl font-bold flex items-center gap-2"
          >
            <Plus size={20} /> Add Meme
          </button>
          {gameState?.currentRound === 1 && gameState.status === 'active' ? (
            <button 
              onClick={() => handleRoundChange(1, 'completed')}
              className="bg-error/20 text-error hover:bg-error/30 px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors"
            >
              <StopCircle size={20} /> Stop Round 1
            </button>
          ) : (
            <button 
              onClick={() => handleRoundChange(1, 'active')}
              className="bg-primary hover:bg-primary-dim text-on-primary px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors"
            >
              <PlayCircle size={20} /> Start Round 1
            </button>
          )}
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleAddMeme} className="bg-surface-container border border-outline-variant rounded-3xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-on-surface-variant mb-1">Name</label>
              <input 
                required
                type="text" 
                value={newMeme.name}
                onChange={e => setNewMeme({...newMeme, name: e.target.value})}
                className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2 text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-on-surface-variant mb-1">Image URL</label>
              <input 
                required
                type="url" 
                value={newMeme.imageUrl}
                onChange={e => setNewMeme({...newMeme, imageUrl: e.target.value})}
                className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2 text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-on-surface-variant mb-1">Price per Share</label>
              <input 
                required
                type="number" 
                min="1"
                value={newMeme.initialPrice}
                onChange={e => setNewMeme({...newMeme, initialPrice: Number(e.target.value)})}
                className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2 text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-on-surface-variant mb-1">Total Shares</label>
              <input 
                required
                type="number" 
                min="1"
                value={newMeme.totalShares}
                onChange={e => setNewMeme({...newMeme, totalShares: Number(e.target.value)})}
                className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2 text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-on-surface-variant hover:text-on-surface">Cancel</button>
            <button type="submit" className="bg-primary text-on-primary px-6 py-2 rounded-xl font-bold">Save Meme</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {memes.map((meme) => {
          const priceChange = meme.currentPrice - meme.initialPrice;
          const isUp = priceChange >= 0;

          return (
            <div key={meme.id} className="bg-surface-container border border-outline-variant rounded-3xl overflow-hidden flex flex-col neon-glow-box transition-all duration-300">
              <div className="h-48 bg-surface-variant relative overflow-hidden group">
                <img 
                  src={meme.imageUrl} 
                  alt={meme.name} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent opacity-80" />
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                  <h3 className="text-xl font-headline font-bold text-white drop-shadow-md">{meme.name}</h3>
                  <div className={clsx(
                    "flex items-center gap-1 px-2 py-1 rounded-md text-sm font-bold backdrop-blur-md",
                    isUp ? "bg-primary/20 text-primary" : "bg-error/20 text-error"
                  )}>
                    {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    ${meme.currentPrice.toFixed(2)}
                  </div>
                </div>
              </div>
              
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-2 text-sm">
                  <span className="text-on-surface-variant">Supply</span>
                  <span className="font-mono text-on-surface">{meme.totalShares}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-on-surface-variant">Available</span>
                  <span className="font-mono font-bold text-primary">{meme.availableShares}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
