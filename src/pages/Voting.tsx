import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { PlayCircle, ThumbsUp, CheckCircle } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import clsx from 'clsx';

export default function Voting() {
  const { appUser, gameState, scenarios, submissions, memes, votes } = useStore();
  const [isVoting, setIsVoting] = useState(false);

  const activeScenario = scenarios.find(s => s.id === gameState?.activeScenarioId);
  const activeSubmissions = submissions.filter(s => s.scenarioId === activeScenario?.id);

  // My vote for this scenario
  const myVote = activeScenario
    ? votes.find(v => v.scenarioId === activeScenario.id && v.audienceId === appUser?.id)
    : undefined;

  if (gameState?.currentRound !== 2 || gameState?.status !== 'active' || !activeScenario) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-24 h-24 bg-surface-variant rounded-full flex items-center justify-center mb-6">
          <PlayCircle size={48} className="text-on-surface-variant" />
        </div>
        <h2 className="text-3xl font-headline font-bold text-on-surface mb-2">No Active Voting</h2>
        <p className="text-on-surface-variant max-w-md">
          Wait for the admin to broadcast a scenario to start voting.
        </p>
      </div>
    );
  }

  const handleVote = async (submissionId: string) => {
    if (!appUser || !activeScenario || myVote) return;
    try {
      setIsVoting(true);
      const voteId = `${activeScenario.id}_${appUser.id}`;
      await setDoc(doc(db, 'votes', voteId), {
        scenarioId: activeScenario.id,
        audienceId: appUser.id,
        submissionId,
        timestamp: Date.now(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'votes');
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 md:pb-0">
      {/* Scenario Hero */}
      <div className="bg-surface-container-high border border-secondary/30 rounded-3xl p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary via-tertiary to-secondary" />
        <span className="inline-block px-3 py-1 bg-secondary/10 text-secondary rounded-full text-sm font-bold mb-4 border border-secondary/20">
          🗳️ Live Voting
        </span>
        <h1 className="text-2xl md:text-3xl font-headline font-bold text-on-surface mb-4 leading-tight">
          {activeScenario.title}
        </h1>
        <p className="text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
          {activeScenario.description}
        </p>
        {myVote && (
          <div className="mt-4 inline-flex items-center gap-2 bg-secondary/10 text-secondary px-4 py-2 rounded-full border border-secondary/20 text-sm font-bold">
            <CheckCircle size={16} /> You've voted — results update live
          </div>
        )}
      </div>

      {/* Voting Cards */}
      {activeSubmissions.length === 0 ? (
        <div className="text-center p-12 bg-surface-container border border-outline-variant rounded-3xl">
          <p className="text-on-surface-variant text-lg">Waiting for teams to submit their memes...</p>
        </div>
      ) : (
        <>
          {!myVote && (
            <p className="text-center text-sm text-on-surface-variant">
              👆 Tap the <span className="font-bold text-secondary">Like</span> button on the meme that best fits the scenario
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeSubmissions.map((submission) => {
              const meme = memes.find(m => m.id === submission.memeId);
              if (!meme) return null;

              const isMyVotedSubmission = myVote?.submissionId === submission.id;
              const voteCount = votes.filter(v => v.submissionId === submission.id).length;

              return (
                <div
                  key={submission.id}
                  className={clsx(
                    'bg-surface-container border rounded-3xl overflow-hidden flex flex-col transition-all duration-300',
                    isMyVotedSubmission
                      ? 'border-secondary shadow-[0_0_25px_rgba(253,211,77,0.25)] scale-[1.02]'
                      : 'border-outline-variant'
                  )}
                >
                  {/* Meme Image */}
                  <div className="relative aspect-square bg-surface-variant">
                    <img
                      src={meme.imageUrl}
                      alt={meme.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {isMyVotedSubmission && (
                      <div className="absolute inset-0 bg-secondary/15 flex items-center justify-center backdrop-blur-[1px]">
                        <div className="bg-secondary text-on-secondary p-4 rounded-full shadow-xl">
                          <CheckCircle size={36} />
                        </div>
                      </div>
                    )}
                    {/* Vote count badge — shown after voting */}
                    {myVote && (
                      <div className={clsx(
                        'absolute top-3 right-3 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1',
                        isMyVotedSubmission
                          ? 'bg-secondary text-on-secondary'
                          : 'bg-background/80 text-on-surface backdrop-blur-sm'
                      )}>
                        <ThumbsUp size={13} /> {voteCount}
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="p-4 flex items-center justify-between gap-3">
                    <h3 className="font-bold text-on-surface text-sm truncate">{meme.name}</h3>
                    <button
                      onClick={() => handleVote(submission.id)}
                      disabled={isVoting || !!myVote}
                      className={clsx(
                        'shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all',
                        isMyVotedSubmission
                          ? 'bg-secondary text-on-secondary cursor-default'
                          : myVote
                            ? 'bg-surface-variant text-on-surface-variant cursor-not-allowed opacity-50'
                            : 'bg-surface-variant hover:bg-secondary hover:text-on-secondary text-on-surface cursor-pointer'
                      )}
                    >
                      <ThumbsUp size={15} />
                      {isMyVotedSubmission ? 'Voted!' : 'Like'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
