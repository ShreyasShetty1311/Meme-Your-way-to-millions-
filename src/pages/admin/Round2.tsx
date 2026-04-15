import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Plus, PlayCircle, StopCircle, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

export default function AdminRound2() {
  const { scenarios, gameState } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newScenario, setNewScenario] = useState({
    title: '',
    description: ''
  });

  const handleRoundChange = async (round: number, status: 'setup' | 'active' | 'completed') => {
    try {
      await updateDoc(doc(db, 'gameState', 'current'), {
        currentRound: round,
        status: status
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'gameState/current');
    }
  };

  const handleAddScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'scenarios'), {
        title: newScenario.title,
        description: newScenario.description,
        status: 'pending'
      });
      setIsAdding(false);
      setNewScenario({ title: '', description: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'scenarios');
    }
  };

  const handleSetActiveScenario = async (scenarioId: string) => {
    try {
      await updateDoc(doc(db, 'gameState', 'current'), {
        activeScenarioId: scenarioId
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'gameState/current');
    }
  };

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-3xl font-headline font-bold text-on-surface mb-4">Game Not Initialized</h2>
        <p className="text-on-surface-variant">Please initialize the game in Round 1 first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-on-surface">Round 2: Scenarios</h1>
          <p className="text-on-surface-variant">Manage scenarios and active display</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-surface-container border border-outline-variant hover:border-primary text-on-surface px-4 py-2 rounded-xl font-bold flex items-center gap-2"
          >
            <Plus size={20} /> Add Scenario
          </button>
          {gameState?.currentRound === 2 && gameState.status === 'active' ? (
            <button 
              onClick={() => handleRoundChange(2, 'completed')}
              className="bg-error/20 text-error hover:bg-error/30 px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors"
            >
              <StopCircle size={20} /> Stop Round 2
            </button>
          ) : (
            <button 
              onClick={() => handleRoundChange(2, 'active')}
              className="bg-primary hover:bg-primary-dim text-on-primary px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors"
            >
              <PlayCircle size={20} /> Start Round 2
            </button>
          )}
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleAddScenario} className="bg-surface-container border border-outline-variant rounded-3xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-on-surface-variant mb-1">Title</label>
            <input 
              required
              type="text" 
              value={newScenario.title}
              onChange={e => setNewScenario({...newScenario, title: e.target.value})}
              className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2 text-on-surface focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-on-surface-variant mb-1">Description</label>
            <textarea 
              required
              rows={4}
              value={newScenario.description}
              onChange={e => setNewScenario({...newScenario, description: e.target.value})}
              className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2 text-on-surface focus:border-primary focus:outline-none resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-on-surface-variant hover:text-on-surface">Cancel</button>
            <button type="submit" className="bg-primary text-on-primary px-6 py-2 rounded-xl font-bold">Save Scenario</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {scenarios.map((scenario) => {
          const isActive = gameState.activeScenarioId === scenario.id;

          return (
            <div 
              key={scenario.id} 
              className={clsx(
                "bg-surface-container border rounded-3xl p-6 transition-all duration-300",
                isActive ? "border-primary shadow-[0_0_15px_rgba(242,253,104,0.1)]" : "border-outline-variant"
              )}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-headline font-bold text-on-surface">{scenario.title}</h3>
                {isActive && (
                  <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <CheckCircle size={14} /> Active
                  </span>
                )}
              </div>
              <p className="text-on-surface-variant mb-6 whitespace-pre-wrap">{scenario.description}</p>
              
              <div className="flex justify-end">
                {!isActive ? (
                  <button 
                    onClick={() => handleSetActiveScenario(scenario.id)}
                    className="bg-surface-variant hover:bg-primary/20 text-on-surface hover:text-primary px-4 py-2 rounded-xl font-bold transition-colors text-sm"
                  >
                    Set as Active
                  </button>
                ) : (
                  <button 
                    onClick={() => handleSetActiveScenario('')}
                    className="bg-surface-variant hover:bg-error/20 text-on-surface hover:text-error px-4 py-2 rounded-xl font-bold transition-colors text-sm"
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </div>
          );
        })}
        
        {scenarios.length === 0 && !isAdding && (
          <div className="col-span-full text-center py-12 text-on-surface-variant">
            No scenarios added yet. Click "Add Scenario" to create one.
          </div>
        )}
      </div>
    </div>
  );
}
