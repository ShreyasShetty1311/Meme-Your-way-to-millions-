import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  runTransaction, getDocs, query, where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Tag, ShoppingCart, CheckCircle, XCircle, Trash2, BarChart2, AlertCircle, Minus, Plus } from 'lucide-react';
import clsx from 'clsx';

const MIN_SHARES = 3;
type Tab = 'sell' | 'buy';

export default function Trade() {
  const { appUser, gameState, portfolio, memes, tradeListings } = useStore();
  const [tab, setTab] = useState<Tab>('sell');

  // Sell form state
  const [sellMemeId, setSellMemeId] = useState('');
  const [sellShares, setSellShares] = useState(1);
  const [sellPrice, setSellPrice] = useState(0);
  const [isListing, setIsListing] = useState(false);
  const [sellMsg, setSellMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Buy state — qty per listing id
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [buyQty, setBuyQty] = useState<Record<string, number>>({});
  const [buyMsg, setBuyMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isTradeActive = gameState?.tradeRoundActive === true;

  // My portfolio (only memes with shares)
  const myMemes = portfolio
    .filter(p => p.shares > 0)
    .map(p => ({ ...p, meme: memes.find(m => m.id === p.memeId) }))
    .filter(item => item.meme) as (typeof portfolio[0] & { meme: typeof memes[0] })[];

  const selectedPortfolioRow = myMemes.find(p => p.memeId === sellMemeId);
  const maxSell = selectedPortfolioRow?.shares ?? 0;

  // My active sell listings
  const myListings = tradeListings.filter(l => l.sellerId === appUser?.id && l.status === 'active');
  // Listings I can buy (not mine, active)
  const marketListings = tradeListings.filter(l => l.sellerId !== appUser?.id && l.status === 'active');
  // Completed trades for eligibility
  const soldByMe = tradeListings.filter(l => l.sellerId === appUser?.id && l.status === 'sold');
  const boughtByMe = tradeListings.filter(l => l.buyerId === appUser?.id && l.status === 'sold');
  const sharesSold = soldByMe.reduce((s, l) => s + l.shares, 0);
  const sharesBought = boughtByMe.reduce((s, l) => s + l.shares, 0);
  const isEligible = sharesSold >= MIN_SHARES && sharesBought >= MIN_SHARES;

  // Helper: get qty for a listing (default 1)
  const getQty = (listingId: string, max: number) =>
    Math.min(Math.max(buyQty[listingId] ?? 1, 1), max);

  const setQty = (listingId: string, val: number, max: number) =>
    setBuyQty(q => ({ ...q, [listingId]: Math.min(Math.max(val, 1), max) }));

  // Create a sell listing (reserves shares from portfolio)
  const handleList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser || !selectedPortfolioRow) return;
    if (sellShares > maxSell) { setSellMsg({ type: 'error', text: `You only have ${maxSell} shares.` }); return; }
    if (sellPrice <= 0) { setSellMsg({ type: 'error', text: 'Price must be above 0.' }); return; }

    setIsListing(true);
    setSellMsg(null);
    try {
      const portRef = doc(db, 'portfolios', selectedPortfolioRow.id);
      await runTransaction(db, async (transaction) => {
        const portSnap = await transaction.get(portRef);
        if (!portSnap.exists()) throw new Error('Portfolio entry not found.');
        const current: number = portSnap.data().shares;
        if (current < sellShares) throw new Error(`Only ${current} shares available.`);
        if (current - sellShares === 0) transaction.delete(portRef);
        else transaction.update(portRef, { shares: current - sellShares });
      });
      await addDoc(collection(db, 'tradeListings'), {
        sellerId: appUser.id,
        memeId: sellMemeId,
        shares: sellShares,
        pricePerShare: sellPrice,
        createdAt: Date.now(),
        status: 'active',
      });
      setSellMsg({ type: 'success', text: `Listed ${sellShares} shares of "${selectedPortfolioRow.meme?.name}" at $${sellPrice}/share.` });
      setSellMemeId('');
      setSellShares(1);
      setSellPrice(0);
    } catch (err: any) {
      setSellMsg({ type: 'error', text: err.message || 'Failed to list.' });
    } finally {
      setIsListing(false);
    }
  };

  // Cancel a sell listing (return shares to portfolio)
  const handleCancelListing = async (listing: typeof tradeListings[0]) => {
    if (!appUser) return;
    try {
      const portSnap = await getDocs(
        query(collection(db, 'portfolios'), where('userId', '==', appUser.id), where('memeId', '==', listing.memeId))
      );
      if (portSnap.empty) {
        await addDoc(collection(db, 'portfolios'), {
          userId: appUser.id,
          memeId: listing.memeId,
          shares: listing.shares,
          averagePrice: listing.pricePerShare,
        });
      } else {
        const existing = portSnap.docs[0];
        await updateDoc(doc(db, 'portfolios', existing.id), { shares: existing.data().shares + listing.shares });
      }
      await deleteDoc(doc(db, 'tradeListings', listing.id));
    } catch (err: any) {
      setSellMsg({ type: 'error', text: err.message || 'Could not cancel.' });
    }
  };

  // Buy a listing — supports partial qty
  const handleBuy = async (listing: typeof tradeListings[0]) => {
    if (!appUser) return;
    const meme = memes.find(m => m.id === listing.memeId);
    const qty = getQty(listing.id, listing.shares);
    const totalCost = listing.pricePerShare * qty;

    if ((appUser.budget || 0) < totalCost) {
      setBuyMsg({ type: 'error', text: `Not enough budget. Need $${totalCost.toLocaleString()}.` });
      return;
    }

    setBuyingId(listing.id);
    setBuyMsg(null);
    try {
      const listingRef = doc(db, 'tradeListings', listing.id);
      const sellerRef = doc(db, 'users', listing.sellerId);
      const buyerRef = doc(db, 'users', appUser.id);
      const isBuyingAll = qty === listing.shares;

      // Buyer's existing portfolio for this meme
      const buyerPortSnap = await getDocs(
        query(collection(db, 'portfolios'), where('userId', '==', appUser.id), where('memeId', '==', listing.memeId))
      );
      let buyerPortRef: ReturnType<typeof doc> | null = null;
      let existingShares = 0;
      let existingAvg = 0;
      if (!buyerPortSnap.empty) {
        const d = buyerPortSnap.docs[0];
        buyerPortRef = doc(db, 'portfolios', d.id);
        existingShares = d.data().shares;
        existingAvg = d.data().averagePrice;
      }

      await runTransaction(db, async (transaction) => {
        const listingSnap = await transaction.get(listingRef);
        if (!listingSnap.exists() || listingSnap.data().status !== 'active') {
          throw new Error('This listing is no longer available.');
        }
        const buyerSnap = await transaction.get(buyerRef);
        const sellerSnap = await transaction.get(sellerRef);
        const buyerBudget: number = buyerSnap.data()?.budget || 0;
        const sellerBudget: number = sellerSnap.data()?.budget || 0;
        if (buyerBudget < totalCost) throw new Error('Insufficient budget.');

        const remainingShares = listing.shares - qty;

        if (isBuyingAll) {
          // Mark listing fully sold
          transaction.update(listingRef, { status: 'sold', buyerId: appUser.id });
        } else {
          // Partial buy: reduce listing shares, create a sold record for audit
          transaction.update(listingRef, { shares: remainingShares });
          // Add a sold sub-record for eligibility tracking
          const soldRef = doc(collection(db, 'tradeListings'));
          transaction.set(soldRef, {
            sellerId: listing.sellerId,
            memeId: listing.memeId,
            shares: qty,
            pricePerShare: listing.pricePerShare,
            createdAt: Date.now(),
            status: 'sold',
            buyerId: appUser.id,
          });
        }

        // Money transfer
        transaction.update(buyerRef, { budget: buyerBudget - totalCost });
        transaction.update(sellerRef, { budget: sellerBudget + totalCost });

        // Add to buyer portfolio
        if (buyerPortRef) {
          const newShares = existingShares + qty;
          const newAvg = ((existingShares * existingAvg) + (qty * listing.pricePerShare)) / newShares;
          transaction.update(buyerPortRef, { shares: newShares, averagePrice: newAvg });
        } else {
          const newRef = doc(collection(db, 'portfolios'));
          transaction.set(newRef, {
            userId: appUser.id,
            memeId: listing.memeId,
            shares: qty,
            averagePrice: listing.pricePerShare,
          });
        }
      });

      setBuyMsg({ type: 'success', text: `✅ Bought ${qty} share${qty > 1 ? 's' : ''} of "${meme?.name}" for $${totalCost.toLocaleString()}.` });
    } catch (err: any) {
      setBuyMsg({ type: 'error', text: err.message || 'Purchase failed.' });
    } finally {
      setBuyingId(null);
    }
  };

  // Guard: trade not active
  if (!isTradeActive) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-24 h-24 bg-surface-variant rounded-full flex items-center justify-center mb-6">
          <BarChart2 size={48} className="text-on-surface-variant" />
        </div>
        <h2 className="text-3xl font-headline font-bold text-on-surface mb-2">Trade Market Closed</h2>
        <p className="text-on-surface-variant max-w-md">
          Wait for the admin to open the trade round.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-0 max-w-4xl mx-auto">
      {/* Header + Eligibility */}
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-headline font-bold text-on-surface flex items-center gap-3">
            <BarChart2 className="text-tertiary" size={32} />
            Trade Market
          </h1>
          <p className="text-on-surface-variant mt-1">Buy and sell memes with other teams</p>
        </div>
        {/* Eligibility badge */}
        <div className={clsx(
          'border rounded-2xl p-4 shrink-0 min-w-[200px]',
          isEligible ? 'bg-primary/10 border-primary/30' : 'bg-surface-container border-outline-variant'
        )}>
          <div className="flex items-center gap-2 mb-3">
            {isEligible ? <CheckCircle size={18} className="text-primary" /> : <XCircle size={18} className="text-on-surface-variant" />}
            <p className="font-bold text-sm text-on-surface">
              {isEligible ? 'Eligible for Round 2!' : 'Round 2 Eligibility'}
            </p>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">Shares sold</span>
              <span className={clsx('font-mono font-bold', sharesSold >= MIN_SHARES ? 'text-primary' : 'text-error')}>
                {sharesSold} / {MIN_SHARES}
                {sharesSold >= MIN_SHARES ? ' ✓' : ''}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">Shares bought</span>
              <span className={clsx('font-mono font-bold', sharesBought >= MIN_SHARES ? 'text-primary' : 'text-error')}>
                {sharesBought} / {MIN_SHARES}
                {sharesBought >= MIN_SHARES ? ' ✓' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-surface-container rounded-xl p-1 border border-outline-variant w-fit">
        {([['sell', 'Sell', Tag], ['buy', 'Buy', ShoppingCart]] as [Tab, string, React.ElementType][]).map(([t, label, Icon]) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-sm transition-all',
              tab === t ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant hover:text-on-surface')}>
            <Icon size={16} />{label}
          </button>
        ))}
      </div>

      {/* ──── SELL TAB ──── */}
      {tab === 'sell' && (
        <div className="space-y-6">
          <form onSubmit={handleList} className="bg-surface-container border border-outline-variant rounded-3xl p-6 space-y-5">
            <h2 className="font-headline font-bold text-on-surface text-lg">List a Meme for Sale</h2>
            {sellMsg && (
              <div className={clsx('flex items-start gap-3 p-3 rounded-xl text-sm',
                sellMsg.type === 'error' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary')}>
                {sellMsg.type === 'error' ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle size={16} className="mt-0.5 shrink-0" />}
                {sellMsg.text}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Meme to Sell</label>
              <select required value={sellMemeId} onChange={e => { setSellMemeId(e.target.value); setSellShares(1); }}
                className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-3 text-on-surface focus:border-primary focus:outline-none">
                <option value="">Select meme from your portfolio…</option>
                {myMemes.map(item => (
                  <option key={item.memeId} value={item.memeId}>
                    {item.meme.name} — {item.shares} shares
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Shares to List <span className="text-primary">(max {maxSell})</span></label>
                <input required type="number" min="1" max={maxSell} value={sellShares}
                  onChange={e => setSellShares(Math.min(Number(e.target.value), maxSell))}
                  className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-3 text-on-surface font-mono focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Ask Price per Share ($)</label>
                <input required type="number" min="0.01" step="0.01" value={sellPrice}
                  onChange={e => setSellPrice(Number(e.target.value))}
                  className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-3 text-on-surface font-mono focus:border-primary focus:outline-none" />
              </div>
            </div>
            {sellPrice > 0 && sellShares > 0 && (
              <p className="text-sm text-on-surface-variant">
                Total value if sold: <span className="font-mono font-bold text-primary">${(sellShares * sellPrice).toLocaleString()}</span>
              </p>
            )}
            <button type="submit" disabled={isListing || !sellMemeId}
              className="w-full bg-primary hover:bg-primary-dim text-on-primary font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-[0_0_12px_rgba(242,253,104,0.15)]">
              <Tag size={18} />
              {isListing ? 'Listing...' : 'List for Sale'}
            </button>
          </form>

          {myListings.length > 0 && (
            <div className="bg-surface-container border border-outline-variant rounded-3xl overflow-hidden">
              <div className="px-6 py-4 border-b border-outline-variant">
                <h3 className="font-headline font-bold text-on-surface">Your Active Listings ({myListings.length})</h3>
              </div>
              <div className="divide-y divide-outline-variant">
                {myListings.map(listing => {
                  const meme = memes.find(m => m.id === listing.memeId);
                  return (
                    <div key={listing.id} className="flex items-center gap-4 p-4">
                      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-outline-variant">
                        {meme && <img src={meme.imageUrl} alt={meme.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-on-surface text-sm truncate">{meme?.name}</p>
                        <p className="text-xs text-on-surface-variant">{listing.shares} shares @ ${listing.pricePerShare}/share</p>
                      </div>
                      <p className="font-mono font-bold text-primary">${(listing.shares * listing.pricePerShare).toLocaleString()}</p>
                      <button onClick={() => handleCancelListing(listing)}
                        className="text-on-surface-variant hover:text-error p-2 rounded-lg hover:bg-error/10 transition-colors shrink-0">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──── BUY TAB ──── */}
      {tab === 'buy' && (
        <div className="space-y-4">
          {buyMsg && (
            <div className={clsx('flex items-start gap-3 p-3 rounded-xl text-sm',
              buyMsg.type === 'error' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary')}>
              {buyMsg.type === 'error' ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle size={16} className="mt-0.5 shrink-0" />}
              {buyMsg.text}
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="font-headline font-bold text-on-surface text-lg">Market Listings ({marketListings.length})</h2>
            <p className="text-sm text-on-surface-variant">
              Budget: <span className="font-mono font-bold text-primary">${(appUser?.budget || 0).toLocaleString()}</span>
            </p>
          </div>

          {marketListings.length === 0 ? (
            <div className="text-center py-16 text-on-surface-variant border border-dashed border-outline-variant rounded-3xl">
              <ShoppingCart size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No listings yet</p>
              <p className="text-sm mt-1">When other teams list memes for sale, they'll appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {marketListings.map(listing => {
                const meme = memes.find(m => m.id === listing.memeId);
                const qty = getQty(listing.id, listing.shares);
                const totalCost = listing.pricePerShare * qty;
                const canAfford = (appUser?.budget || 0) >= totalCost;
                const isBuying = buyingId === listing.id;

                return (
                  <div key={listing.id} className="bg-surface-container border border-outline-variant rounded-2xl overflow-hidden flex flex-col">
                    {meme && (
                      <div className="h-40 relative overflow-hidden">
                        <img src={meme.imageUrl} alt={meme.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                        <div className="absolute bottom-2 left-3 right-3">
                          <p className="font-bold text-white text-sm drop-shadow-md truncate">{meme.name}</p>
                        </div>
                        {/* Available shares badge */}
                        <div className="absolute top-2 right-2 bg-background/70 backdrop-blur-sm text-on-surface text-xs font-mono font-bold px-2 py-1 rounded-lg">
                          {listing.shares} avail.
                        </div>
                      </div>
                    )}
                    <div className="p-4 flex flex-col gap-3 flex-1">
                      {/* Price info */}
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Per share</span>
                        <span className="font-mono font-bold text-primary">${listing.pricePerShare}/share</span>
                      </div>

                      {/* Qty selector */}
                      <div>
                        <label className="block text-xs text-on-surface-variant mb-1.5">Quantity to buy</label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setQty(listing.id, qty - 1, listing.shares)}
                            disabled={qty <= 1}
                            className="w-8 h-8 rounded-lg bg-surface-variant border border-outline-variant flex items-center justify-center text-on-surface disabled:opacity-30 hover:border-primary transition-colors shrink-0"
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={listing.shares}
                            value={qty}
                            onChange={e => setQty(listing.id, parseInt(e.target.value) || 1, listing.shares)}
                            className="flex-1 bg-surface-variant border border-outline-variant rounded-lg px-2 py-1.5 text-center font-mono text-on-surface focus:border-primary focus:outline-none text-sm"
                          />
                          <button
                            onClick={() => setQty(listing.id, qty + 1, listing.shares)}
                            disabled={qty >= listing.shares}
                            className="w-8 h-8 rounded-lg bg-surface-variant border border-outline-variant flex items-center justify-center text-on-surface disabled:opacity-30 hover:border-primary transition-colors shrink-0"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Total cost */}
                      <div className="flex justify-between text-sm items-center bg-surface-variant rounded-xl px-3 py-2">
                        <span className="text-on-surface-variant">Total cost</span>
                        <span className={clsx('font-mono font-bold text-base', canAfford ? 'text-tertiary' : 'text-error')}>
                          ${totalCost.toLocaleString()}
                        </span>
                      </div>

                      <button
                        onClick={() => handleBuy(listing)}
                        disabled={isBuying || !canAfford}
                        className={clsx(
                          'w-full font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm transition-all mt-auto',
                          canAfford
                            ? 'bg-primary hover:bg-primary-dim text-on-primary shadow-[0_0_10px_rgba(242,253,104,0.1)]'
                            : 'bg-surface-variant text-on-surface-variant cursor-not-allowed opacity-60'
                        )}
                      >
                        <ShoppingCart size={16} />
                        {isBuying ? 'Buying...' : canAfford ? `Buy ${qty} Share${qty > 1 ? 's' : ''}` : "Can't Afford"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
