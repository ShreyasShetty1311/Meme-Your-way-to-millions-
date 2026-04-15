import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { AppUser } from '../../store/useStore';
import { Users, DollarSign } from 'lucide-react';

export default function AdminTeams() {
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
      setUsers(usersData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    return () => unsub();
  }, []);

  const teams = users.filter(u => u.role === 'team');

  const handleUpdateBudget = async (userId: string, newBudget: number) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        budget: newBudget
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  return (
    <div className="space-y-8 pb-20 md:pb-0">
      <div>
        <h1 className="text-3xl font-headline font-bold text-on-surface">Manage Teams</h1>
        <p className="text-on-surface-variant">Assign roles and set budgets</p>
      </div>

      <div className="bg-surface-container border border-outline-variant rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-variant text-on-surface-variant text-sm">
              <tr>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Role</th>
                <th className="p-4 font-medium">Budget</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-surface-variant/50 transition-colors">
                  <td className="p-4 font-bold text-on-surface">{user.name}</td>
                  <td className="p-4">
                    <select 
                      value={user.role || 'audience'}
                      onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                      className="bg-surface-container-high border border-outline-variant rounded-lg px-3 py-1 text-on-surface focus:border-primary focus:outline-none"
                    >
                      <option value="audience">Audience</option>
                      <option value="team">Team</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="p-4">
                    {user.role === 'team' ? (
                      <div className="flex items-center gap-2">
                        <DollarSign size={16} className="text-primary" />
                        <input 
                          type="number"
                          defaultValue={user.budget || 0}
                          onBlur={(e) => handleUpdateBudget(user.id, Number(e.target.value))}
                          className="w-24 bg-surface-container-high border border-outline-variant rounded-lg px-3 py-1 text-on-surface font-mono focus:border-primary focus:outline-none"
                        />
                      </div>
                    ) : (
                      <span className="text-on-surface-variant text-sm italic">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
