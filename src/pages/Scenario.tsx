import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { PlayCircle, Image as ImageIcon, CheckCircle, Send } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import clsx from 'clsx';

export default function Scenario() {
  const { appUser, gameState, scenarios, portfolio, memes, submissions } = useStore();
  const [selectedMemeId, setSelectedMemeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeScenario = scenarios.find(s => s.id === gameState?.activeScenarioId);
  const mySubmission = submissions.find(
    s => s.scenarioId === activeScenario?.id && s.teamId === appUser?.id
  );

  // Guard: must be round 2 active with a scenario
  if (gameState?.currentRound !== 2 || gameState?.status !== 'active' || !activeScenario) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-24 h-24 bg-surface-variant rounded-full flex items-center justify-center mb-6">
          <PlayCircle size={48} className="text-on-surface-variant" />
        </div>
        <h2 className="text-3xl font-headline font-bold text-on-surface mb-2">No Active Scenario</h2>
        <p className="text-on-surface-variant max-w-md">
          Wait for the admin to broadcast a scenario for Round 2.
        </p>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!appUser || !selectedMemeId || !activeScenario) return;
    try {
      setIsSubmitting(true);
      const submissionId = `${activeScenario.id}_${appUser.id}`;
      await setDoc(doc(db, 'submissions', submissionId), {
        scenarioId: activeScenario.id,
        teamId: appUser.id,
        memeId: selectedMemeId,
        timestamp: Date.now(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'submissions');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Team's owned memes from portfolio
  const myMemes = portfolio
    .filter(p => p.shares > 0)
    .map(p => memes.find(m => m.id === p.memeId))
    .filter(Boolean) as typeof memes;

  const selectedMeme = myMemes.find(m => m.id === selectedMemeId);

  /* ── SUBMITTED STATE ── */
  if (mySubmission) {
    const submittedMeme = memes.find(m => m.id === mySubmission.memeId);
    return (
      <div className="max-w-2xl mx-auto text-center mt-8 space-y-8">
        {/* Scenario reminder */}
        <div className="bg-surface-container-high border border-secondary/30 rounded-3xl p-6 text-left relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary via-tertiary to-secondary" />
          <span className="inline-block px-3 py-1 bg-secondary/10 text-secondary rounded-full text-xs font-bold mb-3 border border-secondary/20">
            Active Scenario
          </span>
          <h2 className="text-xl font-headline font-bold text-on-surface">{activeScenario.title}</h2>
        </div>
        {/* Submitted confirmation */}
        <div className="space-y-4">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-primary" />
          </div>
          <h3 className="text-2xl font-headline font-bold text-on-surface">Your Reaction is In!</h3>
          <p className="text-on-surface-variant">Waiting for voters to cast their votes...</p>
          {submittedMeme && (
            <div className="bg-surface-container border border-outline-variant rounded-3xl overflow-hidden inline-block max-w-xs w-full">
              <img src={submittedMeme.imageUrl} alt={submittedMeme.name} className="w-full aspect-square object-cover" referrerPolicy="no-referrer" />
              <div className="p-4 bg-surface-variant">
                <p className="font-bold text-on-surface">{submittedMeme.name}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── MAIN: Scenario + Meme Deck ── */
  return (
    <div className="space-y-6 pb-4">
      {/* Scenario Hero */}
      <div className="bg-surface-container-high border border-secondary/30 rounded-3xl p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary via-tertiary to-secondary" />
        <span className="inline-block px-3 py-1 bg-secondary/10 text-secondary rounded-full text-sm font-bold mb-4 border border-secondary/20">
          🎬 Active Scenario — React with your best meme!
        </span>
        <h1 className="text-2xl md:text-3xl font-headline font-bold text-on-surface mb-4 leading-tight">
          {activeScenario.title}
        </h1>
        <p className="text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
          {activeScenario.description}
        </p>
      </div>

      {/* Meme Deck */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-headline font-bold text-on-surface flex items-center gap-2">
            <ImageIcon size={20} className="text-primary" />
            Your Meme Deck
            <span className="text-sm font-normal text-on-surface-variant ml-1">({myMemes.length} memes)</span>
          </h2>
          {selectedMeme && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary-dim text-on-primary font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-[0_0_15px_rgba(242,253,104,0.2)] disabled:opacity-50 transition-all"
            >
              <Send size={16} />
              {isSubmitting ? 'Submitting...' : `Submit "${selectedMeme.name}"`}
            </button>
          )}
        </div>

        {myMemes.length === 0 ? (
          <div className="bg-surface-container border border-outline-variant rounded-2xl p-8 text-center text-on-surface-variant">
            <ImageIcon size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">You don't own any memes.</p>
            <p className="text-sm mt-1">You should have bought some in Round 1.</p>
          </div>
        ) : (
          /* Horizontal scrollable deck */
          <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
            {myMemes.map(meme => {
              const isSelected = selectedMemeId === meme.id;
              const myShares = portfolio.find(p => p.memeId === meme.id)?.shares || 0;
              return (
                <button
                  key={meme.id}
                  onClick={() => setSelectedMemeId(meme.id)}
                  className={clsx(
                    'relative rounded-2xl overflow-hidden border-2 transition-all duration-200 text-left shrink-0 w-40',
                    isSelected
                      ? 'border-primary shadow-[0_0_20px_rgba(242,253,104,0.35)] scale-105'
                      : 'border-outline-variant hover:border-primary/50 hover:scale-102'
                  )}
                >
                  <div className="aspect-square bg-surface-variant">
                    <img src={meme.imageUrl} alt={meme.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                      <CheckCircle size={14} className="text-on-primary" />
                    </div>
                  )}
                  <div className={clsx(
                    'p-2 transition-colors',
                    isSelected ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
                  )}>
                    <p className="font-bold text-xs truncate">{meme.name}</p>
                    <p className="text-xs opacity-70">{myShares} shares</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {!selectedMeme && myMemes.length > 0 && (
          <p className="text-sm text-on-surface-variant text-center mt-2 italic">
            ← Scroll and tap a meme to select it, then submit
          </p>
        )}
      </div>
    </div>
  );
}
