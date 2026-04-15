import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { PlayCircle, Image as ImageIcon, CheckCircle } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import clsx from 'clsx';

export default function Scenario() {
  const { appUser, gameState, scenarios, portfolio, memes, submissions } = useStore();
  const [selectedMemeId, setSelectedMemeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeScenario = scenarios.find(s => s.id === gameState?.activeScenarioId);
  const mySubmission = submissions.find(s => s.scenarioId === activeScenario?.id && s.teamId === appUser?.id);

  if (gameState?.currentRound !== 2 || gameState?.status !== 'active' || !activeScenario) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-24 h-24 bg-surface-variant rounded-full flex items-center justify-center mb-6">
          <PlayCircle size={48} className="text-on-surface-variant" />
        </div>
        <h2 className="text-3xl font-headline font-bold text-on-surface mb-2">No Active Scenario</h2>
        <p className="text-on-surface-variant max-w-md">
          Wait for the admin to present the next scenario for Round 2.
        </p>
      </div>
    );
  }

  const myMemes = portfolio
    .filter(p => p.shares > 0)
    .map(p => memes.find(m => m.id === p.memeId))
    .filter(Boolean);

  const handleSubmit = async () => {
    if (!appUser || !selectedMemeId || !activeScenario) return;
    
    try {
      setIsSubmitting(true);
      const submissionId = `${activeScenario.id}_${appUser.id}`;
      await setDoc(doc(db, 'submissions', submissionId), {
        scenarioId: activeScenario.id,
        teamId: appUser.id,
        memeId: selectedMemeId,
        timestamp: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'submissions');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (mySubmission) {
    const submittedMeme = memes.find(m => m.id === mySubmission.memeId);
    return (
      <div className="max-w-2xl mx-auto text-center mt-12">
        <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={40} className="text-primary" />
        </div>
        <h2 className="text-3xl font-headline font-bold text-on-surface mb-4">Submission Received!</h2>
        <p className="text-on-surface-variant mb-8">
          You have submitted your meme for the scenario: <span className="font-bold text-on-surface">{activeScenario.title}</span>
        </p>
        {submittedMeme && (
          <div className="bg-surface-container border border-outline-variant rounded-3xl overflow-hidden inline-block max-w-sm w-full">
            <img src={submittedMeme.imageUrl} alt={submittedMeme.name} className="w-full aspect-square object-cover" referrerPolicy="no-referrer" />
            <div className="p-4 bg-surface-variant">
              <h3 className="font-bold text-on-surface">{submittedMeme.name}</h3>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 md:pb-0">
      <div className="bg-surface-container-high border border-outline-variant rounded-3xl p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-tertiary to-primary"></div>
        <span className="inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-bold mb-4 border border-primary/20">
          Active Scenario
        </span>
        <h1 className="text-3xl md:text-4xl font-headline font-bold text-on-surface mb-4">{activeScenario.title}</h1>
        <p className="text-lg text-on-surface-variant max-w-2xl mx-auto">
          {activeScenario.description}
        </p>
      </div>

      <div>
        <h2 className="text-2xl font-headline font-bold text-on-surface mb-6 flex items-center gap-2">
          <ImageIcon className="text-primary" />
          Select Your Meme
        </h2>
        
        {myMemes.length === 0 ? (
          <div className="bg-surface-container border border-outline-variant rounded-2xl p-8 text-center">
            <p className="text-on-surface-variant">You don't own any memes! You should have bought some in Round 1.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {myMemes.map((meme) => {
              if (!meme) return null;
              const isSelected = selectedMemeId === meme.id;
              return (
                <button
                  key={meme.id}
                  onClick={() => setSelectedMemeId(meme.id)}
                  className={clsx(
                    "relative rounded-2xl overflow-hidden border-2 transition-all duration-200 text-left group",
                    isSelected ? "border-primary shadow-[0_0_20px_rgba(242,253,104,0.3)] scale-[1.02]" : "border-outline-variant hover:border-primary/50"
                  )}
                >
                  <div className="aspect-square bg-surface-variant">
                    <img src={meme.imageUrl} alt={meme.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className={clsx(
                    "p-3 absolute bottom-0 left-0 right-0 backdrop-blur-md transition-colors",
                    isSelected ? "bg-primary/90 text-on-primary" : "bg-background/80 text-on-surface group-hover:bg-background/90"
                  )}>
                    <p className="font-bold truncate">{meme.name}</p>
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-on-primary shadow-lg">
                      <CheckCircle size={16} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-6 border-t border-outline-variant">
        <button
          onClick={handleSubmit}
          disabled={!selectedMemeId || isSubmitting}
          className="bg-primary hover:bg-primary-dim disabled:bg-surface-variant disabled:text-on-surface-variant text-on-primary font-bold py-3 px-8 rounded-xl transition-all text-lg shadow-[0_0_15px_rgba(242,253,104,0.2)]"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Meme'}
        </button>
      </div>
    </div>
  );
}
