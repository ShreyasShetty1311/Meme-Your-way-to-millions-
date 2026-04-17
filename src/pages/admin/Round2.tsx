import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Plus, PlayCircle, StopCircle, CheckCircle, Trash2, Radio, X, FileText, Users, ThumbsUp, Clock } from 'lucide-react';
import clsx from 'clsx';

export default function AdminRound2() {
  const { scenarios, gameState, submissions, votes, memes, allUsers } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newScenario, setNewScenario] = useState({ title: '', description: '' });

  // Fix #6: Use allUsers from the store (single shared listener) instead of a
  // per-component onSnapshot on the users collection.
  const teamUsers = allUsers.filter((u) => u.role === 'team');

  const handleRoundChange = async (round: number, status: 'setup' | 'active' | 'completed') => {
    try {
      await updateDoc(doc(db, 'gameState', 'current'), { currentRound: round, status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'gameState/current');
    }
  };

  const handleAddScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'scenarios'), {
        title: newScenario.title,
        description: newScenario.description,
        status: 'pending',
      });
      setIsAdding(false);
      setNewScenario({ title: '', description: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'scenarios');
    } finally {
      setLoading(false);
    }
  };

  const handleSetActiveScenario = async (scenarioId: string) => {
    try {
      await updateDoc(doc(db, 'gameState', 'current'), { activeScenarioId: scenarioId || null });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'gameState/current');
    }
  };

  const handleDeleteScenario = async (scenarioId: string) => {
    if (!confirm('Delete this scenario?')) return;
    try {
      if (gameState?.activeScenarioId === scenarioId) {
        await updateDoc(doc(db, 'gameState', 'current'), { activeScenarioId: null });
      }
      await deleteDoc(doc(db, 'scenarios', scenarioId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `scenarios/${scenarioId}`);
    }
  };

  const isRound2Active = gameState?.currentRound === 2 && gameState?.status === 'active';
  const activeScenarioId = gameState?.activeScenarioId;
  const activeScenario = scenarios.find(s => s.id === activeScenarioId);

  // Build submission map for active scenario
  const activeSubmissions = submissions.filter(s => s.scenarioId === activeScenarioId);
  const submissionByTeam = Object.fromEntries(activeSubmissions.map(s => [s.teamId, s]));
  const votesForActive = votes.filter(v => activeSubmissions.some(s => s.id === v.submissionId));

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-3xl font-headline font-bold text-on-surface mb-2">Game Not Initialized</h2>
        <p className="text-on-surface-variant">Please initialize the game in Round 1 first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-on-surface flex items-center gap-3">
            <FileText className="text-secondary" size={32} />
            Round 2: Scenarios
          </h1>
          <p className="text-on-surface-variant mt-1">
            {scenarios.length} scenarios — Status:{' '}
            <span className={clsx('font-bold', isRound2Active ? 'text-secondary' : 'text-on-surface-variant')}>
              {isRound2Active ? '🟢 Live' : gameState.currentRound === 2 && gameState.status === 'completed' ? '🔴 Completed' : '⚪ Pending'}
            </span>
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => setIsAdding(!isAdding)}
            className={clsx('flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold border transition-all',
              isAdding ? 'bg-surface-variant text-on-surface border-outline-variant' : 'bg-surface-container border-outline-variant hover:border-secondary text-on-surface')}>
            {isAdding ? <X size={18} /> : <Plus size={18} />}
            {isAdding ? 'Cancel' : 'Add Scenario'}
          </button>
          {isRound2Active ? (
            <button onClick={() => handleRoundChange(2, 'completed')}
              className="bg-error/20 text-error hover:bg-error/30 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 border border-error/30">
              <StopCircle size={18} /> Stop Round 2
            </button>
          ) : (
            <button onClick={() => handleRoundChange(2, 'active')}
              className="bg-secondary hover:bg-secondary-dim text-on-secondary px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(253,211,77,0.2)]">
              <PlayCircle size={18} /> Start Round 2
            </button>
          )}
        </div>
      </div>

      {/* ── LIVE BROADCAST DASHBOARD ── */}
      {activeScenario && isRound2Active && (
        <div className="bg-surface-container border border-secondary/40 rounded-3xl overflow-hidden shadow-[0_0_30px_rgba(253,211,77,0.08)]">
          {/* Scenario header */}
          <div className="relative p-6 border-b border-secondary/20">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary via-tertiary to-secondary" />
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Radio size={20} className="text-secondary animate-pulse shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-secondary uppercase tracking-widest mb-1">Live Broadcast</p>
                  <h2 className="text-xl font-headline font-bold text-on-surface leading-tight">{activeScenario.title}</h2>
                  <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">{activeScenario.description}</p>
                </div>
              </div>
              <button onClick={() => handleSetActiveScenario('')}
                className="shrink-0 text-on-surface-variant hover:text-error px-3 py-1.5 rounded-lg hover:bg-error/10 text-sm font-bold transition-colors">
                Stop Broadcasting
              </button>
            </div>
          </div>

          {/* Team submission tracking */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-on-surface flex items-center gap-2">
                <Users size={18} className="text-on-surface-variant" />
                Team Reactions ({activeSubmissions.length}/{teamUsers.length} submitted)
              </p>
              <p className="text-sm text-on-surface-variant flex items-center gap-1">
                <ThumbsUp size={14} /> {votesForActive.length} votes cast
              </p>
            </div>

            {teamUsers.length === 0 ? (
              <p className="text-sm text-on-surface-variant italic">No teams found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {teamUsers.map(team => {
                  const submission = submissionByTeam[team.id];
                  const meme = submission ? memes.find(m => m.id === submission.memeId) : null;
                  const voteCount = submission
                    ? votes.filter(v => v.submissionId === submission.id).length
                    : 0;

                  return (
                    <div key={team.id}
                      className={clsx('rounded-2xl border overflow-hidden transition-all',
                        submission ? 'border-secondary/30 bg-surface-variant' : 'border-outline-variant bg-surface-container')}>
                      {submission && meme ? (
                        <>
                          <div className="h-32 relative overflow-hidden">
                            <img src={meme.imageUrl} alt={meme.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                            <div className="absolute bottom-2 left-2 right-2">
                              <p className="text-xs font-bold text-white drop-shadow-md truncate">{meme.name}</p>
                            </div>
                            <div className="absolute top-2 right-2 bg-secondary/90 text-on-secondary px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                              <ThumbsUp size={10} /> {voteCount}
                            </div>
                          </div>
                          <div className="px-3 py-2 flex items-center justify-between">
                            <p className="text-xs font-bold text-on-surface">{team.name}</p>
                            <CheckCircle size={14} className="text-secondary" />
                          </div>
                        </>
                      ) : (
                        <div className="h-full p-4 flex flex-col items-center justify-center gap-2 min-h-[120px]">
                          <Clock size={24} className="text-on-surface-variant opacity-40" />
                          <p className="text-xs font-bold text-on-surface">{team.name}</p>
                          <p className="text-xs text-on-surface-variant">Waiting...</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Now Broadcasting banner (when not active but has active scenario) */}
      {activeScenarioId && !isRound2Active && (
        <div className="bg-secondary/10 border border-secondary/30 rounded-2xl p-4 flex items-center gap-3">
          <Radio size={20} className="text-secondary animate-pulse" />
          <p className="text-on-surface font-bold">{activeScenario?.title}</p>
          <button onClick={() => handleSetActiveScenario('')}
            className="ml-auto text-on-surface-variant hover:text-error text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-error/10">
            Clear
          </button>
        </div>
      )}

      {/* Add Scenario Form */}
      {isAdding && (
        <form onSubmit={handleAddScenario} className="bg-surface-container border border-secondary/30 rounded-3xl p-6 space-y-4 shadow-[0_0_20px_rgba(253,211,77,0.06)]">
          <h2 className="text-lg font-bold text-on-surface">New Scenario</h2>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Scenario Title</label>
            <input required type="text" placeholder="e.g. Global Meme Crash of 2067"
              value={newScenario.title} onChange={e => setNewScenario({ ...newScenario, title: e.target.value })}
              className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface focus:border-secondary focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Description</label>
            <textarea required rows={4} placeholder="Describe the scenario teams need to react to..."
              value={newScenario.description} onChange={e => setNewScenario({ ...newScenario, description: e.target.value })}
              className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-3 text-on-surface focus:border-secondary focus:outline-none resize-none" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setIsAdding(false)} className="px-5 py-2.5 text-on-surface-variant hover:text-on-surface rounded-xl">Cancel</button>
            <button type="submit" disabled={loading}
              className="bg-secondary text-on-secondary px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50">
              <Plus size={18} />{loading ? 'Saving...' : 'Save Scenario'}
            </button>
          </div>
        </form>
      )}

      {/* Scenario Cards */}
      {scenarios.length === 0 && !isAdding ? (
        <div className="text-center py-20 text-on-surface-variant border border-dashed border-outline-variant rounded-3xl">
          <FileText size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No scenarios yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {scenarios.map((scenario) => {
            const isActive = activeScenarioId === scenario.id;
            const scenarioSubs = submissions.filter(s => s.scenarioId === scenario.id);
            const scenarioVotes = votes.filter(v => scenarioSubs.some(s => s.id === v.submissionId));

            return (
              <div key={scenario.id}
                className={clsx('bg-surface-container border rounded-3xl p-6 flex flex-col gap-4 transition-all duration-300',
                  isActive ? 'border-secondary shadow-[0_0_25px_rgba(253,211,77,0.12)]' : 'border-outline-variant')}>
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {isActive && (
                      <span className="inline-flex items-center gap-1 bg-secondary/20 text-secondary px-2.5 py-0.5 rounded-full text-xs font-bold border border-secondary/30 mb-2">
                        <Radio size={10} className="animate-pulse" /> LIVE
                      </span>
                    )}
                    <h3 className="text-lg font-headline font-bold text-on-surface leading-tight">{scenario.title}</h3>
                    <div className="flex gap-3 mt-1 text-xs text-on-surface-variant">
                      <span>{scenarioSubs.length} reactions</span>
                      <span>{scenarioVotes.length} votes</span>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteScenario(scenario.id)}
                    className="text-on-surface-variant hover:text-error p-1.5 rounded-lg hover:bg-error/10 shrink-0">
                    <Trash2 size={16} />
                  </button>
                </div>

                <p className="text-sm text-on-surface-variant leading-relaxed line-clamp-3">{scenario.description}</p>

                <div className="flex justify-end pt-2 border-t border-outline-variant">
                  {isActive ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle size={16} className="text-secondary" />
                      <span className="text-secondary text-sm font-bold">Currently Live</span>
                      <button onClick={() => handleSetActiveScenario('')}
                        className="ml-2 bg-surface-variant hover:bg-error/20 text-on-surface-variant hover:text-error px-3 py-1.5 rounded-lg font-bold text-xs transition-colors">
                        Deactivate
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => handleSetActiveScenario(scenario.id)}
                      className="bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/20 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors">
                      <Radio size={14} /> Broadcast This
                    </button>
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
