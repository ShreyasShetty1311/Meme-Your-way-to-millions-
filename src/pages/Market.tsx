import React, { useState } from 'react';
import clsx from 'clsx';
import { useStore } from '../store/useStore';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';
import { doc, runTransaction } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export default function Market() {
  const { memes, appUser, gameState, portfolio } = useStore();
  const [buyingMeme, setBuyingMeme] = useState<string | null>(null);
  // Fix #5: Each meme card has its own independent quantity — no more "buy 5
  // of the wrong meme" glitch from shared state.
  const [buyAmounts, setBuyAmounts] = useState<Record<string, number>>({});

  const getBuyAmount = (memeId: string) => Math.max(buyAmounts[memeId] ?? 1, 1);
  const setBuyAmount = (memeId: string, val: number) =>
    setBuyAmounts((prev) => ({ ...prev, [memeId]: Math.max(val, 1) }));

  if (gameState?.currentRound !== 1 || gameState?.status !== 'active') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-24 h-24 bg-surface-variant rounded-full flex items-center justify-center mb-6">
          <Activity size={48} className="text-on-surface-variant" />
        </div>
        <h2 className="text-3xl font-headline font-bold text-on-surface mb-2">Market is Closed</h2>
        <p className="text-on-surface-variant max-w-md">
          The meme stock market is currently closed. Wait for the admin to start Round 1.
        </p>
      </div>
    );
  }

  const handleBuy = async (memeId: string) => {
    const qty = getBuyAmount(memeId);
    if (!appUser || qty <= 0) return;

    try {
      setBuyingMeme(memeId);
      const memeRef = doc(db, 'memes', memeId);
      const userRef = doc(db, 'users', appUser.id);
      // Fix #12: Deterministic portfolio ID — consistent with Transfer.tsx
      const portfolioRef = doc(db, 'portfolios', `${appUser.id}_${memeId}`);

      await runTransaction(db, async (transaction) => {
        const memeDoc = await transaction.get(memeRef);
        const userDoc = await transaction.get(userRef);
        const portfolioDoc = await transaction.get(portfolioRef);

        if (!memeDoc.exists() || !userDoc.exists()) {
          throw new Error('Document does not exist!');
        }

        const memeData = memeDoc.data();
        const userData = userDoc.data();
        const totalCost = memeData.currentPrice * qty;

        if (memeData.availableShares < qty) {
          throw new Error('Not enough shares available!');
        }
        if ((userData.budget || 0) < totalCost) {
          throw new Error('Insufficient funds!');
        }

        // Update Meme
        transaction.update(memeRef, {
          availableShares: memeData.availableShares - qty,
          currentPrice: memeData.currentPrice + qty * 0.5,
        });

        // Update User Budget
        transaction.update(userRef, {
          budget: (userData.budget || 0) - totalCost,
        });

        // Update Portfolio (deterministic ID — set with merge avoids duplicate docs)
        if (portfolioDoc.exists()) {
          const portData = portfolioDoc.data();
          const newShares = portData.shares + qty;
          const newAvgPrice =
            (portData.shares * portData.averagePrice + totalCost) / newShares;
          transaction.update(portfolioRef, {
            shares: newShares,
            averagePrice: newAvgPrice,
          });
        } else {
          transaction.set(portfolioRef, {
            userId: appUser.id,
            memeId: memeId,
            shares: qty,
            averagePrice: memeData.currentPrice,
          });
        }
      });

      // Reset only this meme's qty
      setBuyAmount(memeId, 1);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'market_transaction');
    } finally {
      setBuyingMeme(null);
    }
  };

  return (
    <div className="space-y-8 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-on-surface">Live Market</h1>
          <p className="text-on-surface-variant">Round 1: Acquire your meme arsenal</p>
        </div>
        <div className="bg-surface-container-high border border-outline-variant rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <DollarSign className="text-primary" size={24} />
          </div>
          <div>
            <p className="text-sm text-on-surface-variant">Available Budget</p>
            <p className="text-2xl font-mono font-bold text-primary neon-glow">
              ${appUser?.budget?.toLocaleString() || 0}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {memes.map((meme) => {
          const buyAmount = getBuyAmount(meme.id);
          const isBuying = buyingMeme === meme.id;
          const priceChange = meme.currentPrice - meme.initialPrice;
          const isUp = priceChange >= 0;
          const myPortfolio = portfolio.find(p => p.memeId === meme.id);

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
                <div className="flex justify-between items-center mb-4 text-sm">
                  <span className="text-on-surface-variant">Available Shares</span>
                  <span className="font-mono font-bold text-on-surface">{meme.availableShares} / {meme.totalShares}</span>
                </div>
                
                {myPortfolio && myPortfolio.shares > 0 && (
                  <div className="mb-4 p-3 bg-surface-variant rounded-xl border border-outline-variant/50">
                    <p className="text-xs text-on-surface-variant mb-1">Your Position</p>
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-primary">{myPortfolio.shares} shares</span>
                      <span className="font-mono text-sm text-on-surface-variant">Avg: ${myPortfolio.averagePrice.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div className="mt-auto pt-4 border-t border-outline-variant flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max={meme.availableShares}
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(meme.id, parseInt(e.target.value) || 1)}
                    className="w-20 bg-surface-variant border border-outline-variant rounded-xl px-3 py-2 text-center font-mono text-on-surface focus:outline-none focus:border-primary"
                  />
                  <button 
                    onClick={() => handleBuy(meme.id)}
                    disabled={isBuying || meme.availableShares === 0 || (appUser?.budget || 0) < meme.currentPrice * buyAmount}
                    className="flex-1 bg-primary hover:bg-primary-dim disabled:bg-surface-variant disabled:text-on-surface-variant text-on-primary font-bold py-2 rounded-xl transition-colors"
                  >
                    {isBuying ? 'Processing...' : 'Buy'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
