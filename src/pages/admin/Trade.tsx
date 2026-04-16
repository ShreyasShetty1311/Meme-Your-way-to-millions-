import React from 'react';
import { useStore, AppUser } from '../../store/useStore';
import { doc, updateDoc, collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { BarChart2, Power, ShoppingCart, Tag, CheckCircle, XCircle, Trophy } from 'lucide-react';
import clsx from 'clsx';

const MIN_SHARES = 3;

export default function AdminTrade() {
  const { gameState, memes, tradeListings } = useStore();
  const [teamUsers, setTeamUsers] = React.useState<AppUser[]>([]);

  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setTeamUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)).filter(u => u.role === 'team'));
    }, console.error);
    return () => unsub();
  }, []);

  const isTradeActive = gameState?.tradeRoundActive === true;

  const toggleTrade = async () => {
    try {
      await updateDoc(doc(db, 'gameState', 'current'), { tradeRoundActive: !isTradeActive });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'gameState/current');
    }
  };

  // Stats
  const activeListings = tradeListings.filter(l => l.status === 'active');
  const soldListings = tradeListings.filter(l => l.status === 'sold');
  const totalVolume = soldListings.reduce((s, l) => s + l.pricePerShare * l.shares, 0);

  // Per-team eligibility
  const eligibility = teamUsers.map(team => {
    const sold = soldListings.filter(l => l.sellerId === team.id).reduce((s, l) => s + l.shares, 0);
    const bought = soldListings.filter(l => l.buyerId === team.id).reduce((s, l) => s + l.shares, 0);
    return { team, sold, bought, eligible: sold >= MIN_SHARES && bought >= MIN_SHARES };
  });

  return (
    <div className="space-y-8 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-on-surface flex items-center gap-3">
            <BarChart2 className="text-tertiary" size={32} />
            Trade Round
          </h1>
          <p className="text-on-surface-variant mt-1">Secondary market — teams buy and sell amongst themselves</p>
        </div>
        <button
          onClick={toggleTrade}
          disabled={!gameState}
          className={clsx(
            'flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-lg transition-all shadow-lg disabled:opacity-40',
            isTradeActive
              ? 'bg-error/20 text-error border border-error/30 hover:bg-error/30'
              : 'bg-tertiary text-on-tertiary hover:bg-tertiary-dim shadow-[0_0_20px_rgba(255,224,141,0.25)]'
          )}
        >
          <Power size={22} />
          {isTradeActive ? 'Stop Trade' : 'Start Trade'}
        </button>
      </div>

      {!gameState && (
        <div className="text-center py-12 text-on-surface-variant border border-dashed border-outline-variant rounded-3xl">
          <p>Initialize the game first in Round 1.</p>
        </div>
      )}

      {gameState && (
        <>
          {/* Status Banner */}
          <div className={clsx(
            'rounded-2xl p-4 border flex items-center gap-4',
            isTradeActive
              ? 'bg-tertiary/10 border-tertiary/30'
              : 'bg-surface-container border-outline-variant'
          )}>
            <div className={clsx('w-3 h-3 rounded-full shrink-0', isTradeActive ? 'bg-tertiary animate-pulse' : 'bg-surface-variant border border-outline-variant')} />
            <div>
              <p className="font-bold text-on-surface">
                Trade Market is <span className={isTradeActive ? 'text-tertiary' : 'text-on-surface-variant'}>{isTradeActive ? 'OPEN' : 'CLOSED'}</span>
              </p>
              <p className="text-sm text-on-surface-variant">
                {isTradeActive ? 'Teams can list and buy memes right now.' : 'Turn on to allow teams to trade with each other.'}
              </p>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface-container border border-outline-variant rounded-2xl p-4 text-center">
              <Tag size={20} className="mx-auto mb-2 text-primary" />
              <p className="text-2xl font-mono font-bold text-on-surface">{activeListings.length}</p>
              <p className="text-xs text-on-surface-variant mt-1">Active Listings</p>
            </div>
            <div className="bg-surface-container border border-outline-variant rounded-2xl p-4 text-center">
              <ShoppingCart size={20} className="mx-auto mb-2 text-secondary" />
              <p className="text-2xl font-mono font-bold text-on-surface">{soldListings.length}</p>
              <p className="text-xs text-on-surface-variant mt-1">Completed Trades</p>
            </div>
            <div className="bg-surface-container border border-outline-variant rounded-2xl p-4 text-center">
              <Trophy size={20} className="mx-auto mb-2 text-tertiary" />
              <p className="text-2xl font-mono font-bold text-on-surface">${totalVolume.toLocaleString()}</p>
              <p className="text-xs text-on-surface-variant mt-1">Total Volume</p>
            </div>
          </div>

          {/* Eligibility Tracker */}
          <div className="bg-surface-container border border-outline-variant rounded-3xl overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
              <h2 className="font-headline font-bold text-on-surface">Round 2 Eligibility</h2>
              <p className="text-xs text-on-surface-variant">Must sell ≥ {MIN_SHARES} AND buy ≥ {MIN_SHARES} shares</p>
            </div>
            {eligibility.length === 0 ? (
              <p className="p-6 text-sm text-on-surface-variant text-center italic">No teams added yet.</p>
            ) : (
              <div className="divide-y divide-outline-variant">
                {eligibility.map(({ team, sold, bought, eligible }) => (
                  <div key={team.id} className="px-6 py-4 flex items-center gap-4">
                    <div className={clsx('shrink-0', eligible ? 'text-primary' : 'text-on-surface-variant')}>
                      {eligible ? <CheckCircle size={22} /> : <XCircle size={22} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-on-surface">{team.name}</p>
                      <p className="text-xs font-mono text-on-surface-variant">@{team.username}</p>
                    </div>
                    <div className="flex gap-6 text-sm shrink-0">
                      <div className="text-center">
                        <p className={clsx('font-mono font-bold', sold >= MIN_SHARES ? 'text-primary' : 'text-error')}>{sold}/{MIN_SHARES}</p>
                        <p className="text-xs text-on-surface-variant">Sold</p>
                      </div>
                      <div className="text-center">
                        <p className={clsx('font-mono font-bold', bought >= MIN_SHARES ? 'text-primary' : 'text-error')}>{bought}/{MIN_SHARES}</p>
                        <p className="text-xs text-on-surface-variant">Bought</p>
                      </div>
                    </div>
                    <div className={clsx('text-xs font-bold px-3 py-1 rounded-full border shrink-0',
                      eligible ? 'bg-primary/10 text-primary border-primary/20' : 'bg-surface-variant text-on-surface-variant border-outline-variant')}>
                      {eligible ? '✅ Eligible' : '⏳ Pending'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active listings */}
          {activeListings.length > 0 && (
            <div className="bg-surface-container border border-outline-variant rounded-3xl overflow-hidden">
              <div className="px-6 py-4 border-b border-outline-variant">
                <h2 className="font-headline font-bold text-on-surface">Active Listings ({activeListings.length})</h2>
              </div>
              <div className="divide-y divide-outline-variant">
                {activeListings.map(listing => {
                  const meme = memes.find(m => m.id === listing.memeId);
                  const seller = teamUsers.find(u => u.id === listing.sellerId);
                  return (
                    <div key={listing.id} className="px-6 py-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                        {meme && <img src={meme.imageUrl} alt={meme.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-on-surface text-sm truncate">{meme?.name || '—'}</p>
                        <p className="text-xs text-on-surface-variant">by {seller?.name || listing.sellerId}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-primary text-sm">${listing.pricePerShare}/share</p>
                        <p className="text-xs text-on-surface-variant">{listing.shares} shares</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
