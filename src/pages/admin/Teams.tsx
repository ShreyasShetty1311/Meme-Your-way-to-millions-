import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useStore, AppUser, Meme, PortfolioItem } from '../../store/useStore';
import { Shield, DollarSign, TrendingUp, Edit3, Trophy } from 'lucide-react';
import clsx from 'clsx';

interface TeamWithPortfolio extends AppUser {
  portfolioItems: (PortfolioItem & { meme?: Meme })[];
  netWorth: number;
  scenarioWins: number;
}

export default function AdminTeams() {
  const { memes, submissions, votes, scenarios } = useStore();
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioItem[]>([]);
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState<number>(0);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    const unsubPortfolios = onSnapshot(collection(db, 'portfolios'), (snap) => {
      setPortfolios(snap.docs.map(d => ({ id: d.id, ...d.data() } as PortfolioItem)));
    }, console.error);

    return () => { unsubUsers(); unsubPortfolios(); };
  }, []);

  /* ── Compute scenario wins per team ── */
  const computeWins = (): Record<string, number> => {
    const wins: Record<string, number> = {};
    const scenarioIds = new Set(submissions.map(s => s.scenarioId));

    for (const scenarioId of scenarioIds) {
      const scenarioSubs = submissions.filter(s => s.scenarioId === scenarioId);
      if (scenarioSubs.length === 0) continue;

      // Count votes per submission
      const voteCounts: Record<string, number> = {};
      for (const sub of scenarioSubs) {
        voteCounts[sub.id] = votes.filter(v => v.submissionId === sub.id).length;
      }

      const maxVotes = Math.max(...Object.values(voteCounts));
      if (maxVotes === 0) continue; // No votes yet → no winner

      // Award 1 win to all submissions tied at max votes
      const winners = scenarioSubs.filter(sub => voteCounts[sub.id] === maxVotes);
      for (const winner of winners) {
        wins[winner.teamId] = (wins[winner.teamId] || 0) + 1;
      }
    }
    return wins;
  };

  const scenarioWins = computeWins();

  const teams: TeamWithPortfolio[] = allUsers
    .filter(u => u.role === 'team')
    .map(u => {
      const items = portfolios
        .filter(p => p.userId === u.id && p.shares > 0)
        .map(p => ({ ...p, meme: memes.find(m => m.id === p.memeId) }));

      const portfolioValue = items.reduce((sum, item) =>
        sum + (item.meme ? item.meme.currentPrice * item.shares : 0), 0);

      return {
        ...u,
        portfolioItems: items,
        netWorth: (u.budget || 0) + portfolioValue,
        scenarioWins: scenarioWins[u.id] || 0,
      };
    })
    .sort((a, b) => b.netWorth - a.netWorth);

  const totalScenarios = scenarios.length;
  const totalNetWorth = teams.reduce((s, t) => s + t.netWorth, 0);

  const handleStartEditBudget = (user: AppUser) => {
    setEditingBudget(user.id);
    setBudgetInput(user.budget || 0);
  };

  const handleSaveBudget = async (userId: string) => {
    setSavingId(userId);
    try {
      await updateDoc(doc(db, 'users', userId), { budget: budgetInput });
      setEditingBudget(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-8 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-on-surface flex items-center gap-3">
            <Shield className="text-primary" size={32} />
            Teams
          </h1>
          <p className="text-on-surface-variant mt-1">
            {teams.length} teams — Combined net worth:{' '}
            <span className="font-mono font-bold text-primary">${totalNetWorth.toLocaleString()}</span>
          </p>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="text-center py-20 text-on-surface-variant border border-dashed border-outline-variant rounded-3xl">
          <Shield size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No teams yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {teams.map((team, rank) => {
            const portfolioValue = team.portfolioItems.reduce(
              (s, i) => s + (i.meme ? i.meme.currentPrice * i.shares : 0), 0
            );
            const isEditing = editingBudget === team.id;

            return (
              <div key={team.id}
                className={clsx('bg-surface-container border rounded-3xl overflow-hidden transition-all',
                  rank === 0 ? 'border-primary shadow-[0_0_20px_rgba(242,253,104,0.08)]' : 'border-outline-variant')}>

                {/* Team Header */}
                <div className="p-5 flex flex-wrap items-center gap-4 border-b border-outline-variant">
                  {/* Rank */}
                  <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-sm shrink-0',
                    rank === 0 ? 'bg-primary text-on-primary' :
                    rank === 1 ? 'bg-secondary/20 text-secondary border border-secondary/30' :
                    rank === 2 ? 'bg-tertiary/20 text-tertiary border border-tertiary/30' :
                    'bg-surface-variant text-on-surface-variant')}>
                    #{rank + 1}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="font-headline font-bold text-on-surface text-lg leading-tight">{team.name}</p>
                    <p className="text-xs font-mono text-on-surface-variant">@{team.username}</p>
                  </div>

                  {/* Net Worth */}
                  <div className="text-right shrink-0">
                    <p className="text-xs text-on-surface-variant">Net Worth</p>
                    <p className={clsx('font-mono font-bold text-xl', rank === 0 ? 'text-primary neon-glow' : 'text-on-surface')}>
                      ${team.netWorth.toLocaleString()}
                    </p>
                  </div>

                  {/* Cash + inline budget editor */}
                  <div className="flex items-center gap-2 shrink-0">
                    <DollarSign size={16} className="text-on-surface-variant" />
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input type="number" min="0" value={budgetInput}
                          onChange={e => setBudgetInput(Number(e.target.value))}
                          className="w-28 bg-surface-variant border border-primary rounded-lg px-3 py-1.5 text-on-surface font-mono text-sm focus:outline-none"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveBudget(team.id); if (e.key === 'Escape') setEditingBudget(null); }}
                        />
                        <button onClick={() => handleSaveBudget(team.id)} disabled={savingId === team.id}
                          className="bg-primary text-on-primary px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50">
                          {savingId === team.id ? '...' : 'Save'}
                        </button>
                        <button onClick={() => setEditingBudget(null)} className="text-on-surface-variant text-xs px-2 py-1.5">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-on-surface text-sm">${(team.budget || 0).toLocaleString()} cash</span>
                        <button onClick={() => handleStartEditBudget(team)}
                          className="text-on-surface-variant hover:text-primary transition-colors p-1" title="Edit budget">
                          <Edit3 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Scenario Wins */}
                  <div className={clsx(
                    'flex items-center gap-2 px-3 py-1.5 rounded-xl border shrink-0',
                    team.scenarioWins > 0
                      ? 'bg-secondary/10 border-secondary/30 text-secondary'
                      : 'bg-surface-variant border-outline-variant text-on-surface-variant'
                  )}>
                    <Trophy size={15} />
                    <span className="font-mono font-bold text-sm">{team.scenarioWins}</span>
                    <span className="text-xs">/ {totalScenarios} wins</span>
                  </div>
                </div>

                {/* Portfolio */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-bold text-on-surface-variant flex items-center gap-2">
                      <TrendingUp size={16} />
                      Portfolio ({team.portfolioItems.length} memes)
                    </p>
                    <p className="text-sm font-mono text-on-surface-variant">
                      Value: <span className="font-bold text-primary">${portfolioValue.toLocaleString()}</span>
                    </p>
                  </div>

                  {team.portfolioItems.length === 0 ? (
                    <p className="text-sm text-on-surface-variant italic text-center py-4">No memes owned</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                      {team.portfolioItems.map(item => {
                        if (!item.meme) return null;
                        const currentValue = item.meme.currentPrice * item.shares;
                        return (
                          <div key={item.id} className="bg-surface-variant rounded-2xl overflow-hidden border border-outline-variant">
                            <div className="h-24 relative overflow-hidden">
                              <img src={item.meme.imageUrl} alt={item.meme.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                              <div className="absolute bottom-1.5 left-2 right-2">
                                <p className="text-xs font-bold text-white drop-shadow-md truncate">{item.meme.name}</p>
                              </div>
                            </div>
                            <div className="p-2 space-y-0.5 text-xs">
                              <div className="flex justify-between">
                                <span className="text-on-surface-variant">Shares</span>
                                <span className="font-mono font-bold text-on-surface">{item.shares}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-on-surface-variant">Value</span>
                                <span className="font-mono font-bold text-primary">${currentValue.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Cash/Portfolio breakdown bar */}
                  <div className="mt-4 pt-4 border-t border-outline-variant">
                    <div className="flex justify-between text-xs text-on-surface-variant mb-1.5">
                      <span>Cash: ${(team.budget || 0).toLocaleString()}</span>
                      <span>Memes: ${portfolioValue.toLocaleString()}</span>
                    </div>
                    {team.netWorth > 0 && (
                      <div className="w-full bg-surface-variant rounded-full h-2 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary to-tertiary rounded-full transition-all"
                          style={{ width: `${Math.min((portfolioValue / team.netWorth) * 100, 100)}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
