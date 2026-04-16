import React from 'react';
import { useStore } from '../store/useStore';
import { Trophy, DollarSign, Image as ImageIcon, TrendingUp, Star } from 'lucide-react';
import clsx from 'clsx';

export default function Progress() {
  const { appUser, portfolio, memes, submissions, votes, scenarios } = useStore();

  /* ── Scenario wins for this team ── */
  const myWins: { scenario: (typeof scenarios)[0]; meme: (typeof memes)[0] }[] = [];

  for (const scenario of scenarios) {
    const scenarioSubs = submissions.filter(s => s.scenarioId === scenario.id);
    if (scenarioSubs.length === 0) continue;

    // Count votes per submission
    const voteCounts: Record<string, number> = {};
    for (const sub of scenarioSubs) {
      voteCounts[sub.id] = votes.filter(v => v.submissionId === sub.id).length;
    }
    const maxVotes = Math.max(...Object.values(voteCounts));
    if (maxVotes === 0) continue;

    // Check if my submission is among the winners
    const mySubmission = scenarioSubs.find(s => s.teamId === appUser?.id);
    if (!mySubmission) continue;
    if (voteCounts[mySubmission.id] !== maxVotes) continue;

    const meme = memes.find(m => m.id === mySubmission.memeId);
    if (meme) myWins.push({ scenario, meme });
  }

  /* ── Portfolio items with meme data ── */
  const portfolioItems = portfolio
    .filter(p => p.shares > 0)
    .map(p => ({ ...p, meme: memes.find(m => m.id === p.memeId) }))
    .filter(item => item.meme) as (typeof portfolio[0] & { meme: typeof memes[0] })[];

  const portfolioValue = portfolioItems.reduce(
    (sum, item) => sum + item.meme.currentPrice * item.shares, 0
  );
  const cash = appUser?.budget || 0;
  const totalAssets = cash + portfolioValue;

  return (
    <div className="space-y-8 pb-20 md:pb-0 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-headline font-bold text-on-surface flex items-center gap-3">
          <TrendingUp className="text-primary" size={32} />
          My Progress
        </h1>
        <p className="text-on-surface-variant mt-1">
          Your portfolio, assets, and scenario standings
        </p>
      </div>

      {/* ── Summary Cards Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Cash */}
        <div className="bg-surface-container border border-outline-variant rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
            <DollarSign size={24} className="text-primary" />
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">Remaining Budget</p>
            <p className="text-2xl font-mono font-bold text-primary neon-glow">
              ${cash.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Portfolio Value */}
        <div className="bg-surface-container border border-outline-variant rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-tertiary/10 rounded-full flex items-center justify-center shrink-0">
            <ImageIcon size={24} className="text-tertiary" />
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">Meme Portfolio Value</p>
            <p className="text-2xl font-mono font-bold text-tertiary">
              ${portfolioValue.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Total Assets */}
        <div className="bg-surface-container border border-primary/30 rounded-2xl p-5 flex items-center gap-4 shadow-[0_0_20px_rgba(242,253,104,0.06)]">
          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center shrink-0">
            <TrendingUp size={24} className="text-primary" />
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">Total Assets</p>
            <p className="text-2xl font-mono font-bold text-primary neon-glow">
              ${totalAssets.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* ── Scenario Wins ── */}
      <div className="bg-surface-container border border-outline-variant rounded-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
          <h2 className="font-headline font-bold text-on-surface flex items-center gap-2">
            <Trophy size={20} className="text-secondary" />
            Scenario Wins
          </h2>
          <div className={clsx(
            'flex items-center gap-2 px-3 py-1 rounded-full border font-bold text-sm',
            myWins.length > 0
              ? 'bg-secondary/10 border-secondary/30 text-secondary'
              : 'bg-surface-variant border-outline-variant text-on-surface-variant'
          )}>
            <Star size={14} />
            {myWins.length} / {scenarios.length} won
          </div>
        </div>

        {myWins.length === 0 ? (
          <div className="p-10 text-center text-on-surface-variant">
            <Trophy size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">No wins yet</p>
            <p className="text-sm mt-1">Submit the right meme to win scenario votes!</p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant">
            {myWins.map(({ scenario, meme }) => (
              <div key={scenario.id} className="flex items-center gap-4 p-4 hover:bg-surface-variant/30 transition-colors">
                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-secondary/30">
                  <img src={meme.imageUrl} alt={meme.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-on-surface text-sm leading-tight truncate">{scenario.title}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5 truncate">Winning meme: <span className="text-primary font-medium">{meme.name}</span></p>
                </div>
                <div className="shrink-0 flex items-center gap-1.5 bg-secondary/10 text-secondary px-3 py-1.5 rounded-full border border-secondary/20 text-xs font-bold">
                  <Trophy size={12} /> Winner
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Meme Portfolio ── */}
      <div className="bg-surface-container border border-outline-variant rounded-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
          <h2 className="font-headline font-bold text-on-surface flex items-center gap-2">
            <ImageIcon size={20} className="text-primary" />
            My Meme Portfolio
          </h2>
          <span className="text-sm text-on-surface-variant">
            {portfolioItems.length} memes owned
          </span>
        </div>

        {portfolioItems.length === 0 ? (
          <div className="p-10 text-center text-on-surface-variant">
            <ImageIcon size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">No memes owned yet</p>
            <p className="text-sm mt-1">Head to the Market in Round 1 to buy memes.</p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant">
            {portfolioItems.map(item => {
              const currentValue = item.meme.currentPrice * item.shares;
              const totalInvested = item.averagePrice * item.shares;
              const isProfit = currentValue >= totalInvested;

              return (
                <div key={item.id} className="flex items-center gap-4 p-4 hover:bg-surface-variant/30 transition-colors">
                  {/* Meme Image */}
                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-outline-variant">
                    <img src={item.meme.imageUrl} alt={item.meme.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-on-surface truncate">{item.meme.name}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-on-surface-variant">
                      <span>Shares: <span className="font-mono font-bold text-on-surface">{item.shares}</span></span>
                      <span>Avg Price: <span className="font-mono">${item.averagePrice.toFixed(2)}</span></span>
                      <span>Current: <span className="font-mono">${item.meme.currentPrice.toFixed(2)}</span></span>
                    </div>
                  </div>

                  {/* Value */}
                  <div className="text-right shrink-0">
                    <p className={clsx('font-mono font-bold text-lg', isProfit ? 'text-primary' : 'text-error')}>
                      ${currentValue.toLocaleString()}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Invested: ${totalInvested.toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer total */}
        {portfolioItems.length > 0 && (
          <div className="px-6 py-4 border-t border-outline-variant bg-surface-variant/30 flex justify-between items-center">
            <span className="text-sm font-bold text-on-surface-variant">Total Portfolio Value</span>
            <span className="font-mono font-bold text-xl text-primary">${portfolioValue.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
