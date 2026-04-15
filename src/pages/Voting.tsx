import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { PlayCircle, ThumbsUp, CheckCircle } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import clsx from 'clsx';

export default function Voting() {
  const { appUser, gameState, scenarios, submissions, memes } = useStore();
  const [isVoting, setIsVoting] = useState(false);

  const activeScenario = scenarios.find(s => s.id === gameState?.activeScenarioId);
  const activeSubmissions = submissions.filter(s => s.scenarioId === activeScenario?.id);
  
  // Check if user has already voted for this scenario
  // We don't have a global votes array in the store to keep it light, but for this demo, 
  // we can assume if they try to vote again it overwrites, or we can fetch their vote.
  // Actually, we need to know if they voted. Let's add a local state for this session.
  const [votedScenarios, setVotedScenarios] = useState<Record<string, string>>({});

  if (gameState?.currentRound !== 2 || gameState?.status !== 'active' || !activeScenario) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-24 h-24 bg-surface-variant rounded-full flex items-center justify-center mb-6">
          <PlayCircle size={48} className="text-on-surface-variant" />
        </div>
        <h2 className="text-3xl font-headline font-bold text-on-surface mb-2">No Active Voting</h2>
        <p className="text-on-surface-variant max-w-md">
          Wait for the admin to open voting for a scenario.
        </p>
      </div>
    );
  }

  const handleVote = async (submissionId: string) => {
    if (!appUser || !activeScenario) return;
    
    try {
      setIsVoting(true);
      const voteId = `${activeScenario.id}_${appUser.id}`;
      await setDoc(doc(db, 'votes', voteId), {
        scenarioId: activeScenario.id,
        audienceId: appUser.id,
        submissionId: submissionId,
        timestamp: Date.now()
      });
      setVotedScenarios(prev => ({ ...prev, [activeScenario.id]: submissionId }));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'votes');
    } finally {
      setIsVoting(false);
    }
  };

  const myVote = votedScenarios[activeScenario.id];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 md:pb-0">
      <div className="bg-surface-container-high border border-outline-variant rounded-3xl p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary via-tertiary to-secondary"></div>
        <span className="inline-block px-3 py-1 bg-secondary/10 text-secondary rounded-full text-sm font-bold mb-4 border border-secondary/20">
          Live Voting
        </span>
        <h1 className="text-3xl md:text-4xl font-headline font-bold text-on-surface mb-4">{activeScenario.title}</h1>
        <p className="text-lg text-on-surface-variant max-w-2xl mx-auto">
          {activeScenario.description}
        </p>
      </div>

      {activeSubmissions.length === 0 ? (
        <div className="text-center p-12 bg-surface-container border border-outline-variant rounded-3xl">
          <p className="text-on-surface-variant text-lg">Waiting for teams to submit their memes...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeSubmissions.map((submission) => {
            const meme = memes.find(m => m.id === submission.memeId);
            if (!meme) return null;
            
            const isMyVote = myVote === submission.id;

            return (
              <div 
                key={submission.id} 
                className={clsx(
                  "bg-surface-container border rounded-3xl overflow-hidden flex flex-col transition-all duration-300",
                  isMyVote ? "border-secondary shadow-[0_0_20px_rgba(253,211,77,0.2)] scale-[1.02]" : "border-outline-variant"
                )}
              >
                <div className="aspect-square bg-surface-variant relative">
                  <img src={meme.imageUrl} alt={meme.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  {isMyVote && (
                    <div className="absolute inset-0 bg-secondary/20 flex items-center justify-center backdrop-blur-[2px]">
                      <div className="bg-secondary text-on-secondary p-4 rounded-full shadow-xl transform scale-110">
                        <CheckCircle size={32} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-5 flex flex-col items-center gap-4">
                  <h3 className="font-bold text-on-surface text-center line-clamp-1">{meme.name}</h3>
                  <button
                    onClick={() => handleVote(submission.id)}
                    disabled={isVoting || !!myVote}
                    className={clsx(
                      "w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all",
                      isMyVote 
                        ? "bg-secondary text-on-secondary" 
                        : myVote 
                          ? "bg-surface-variant text-on-surface-variant cursor-not-allowed"
                          : "bg-surface-variant hover:bg-secondary hover:text-on-secondary text-on-surface"
                    )}
                  >
                    <ThumbsUp size={20} />
                    {isMyVote ? 'Voted' : 'Vote for this'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
