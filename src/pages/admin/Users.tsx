import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { AppUser } from '../../store/useStore';
import { UserPlus } from 'lucide-react';

export default function AdminUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    email: '',
    role: 'audience',
    name: ''
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
      setUsers(usersData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    return () => unsub();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'users'), {
        username: newUser.username,
        password: newUser.password,
        email: newUser.email,
        role: newUser.role,
        name: newUser.name || newUser.username,
        budget: newUser.role === 'team' ? 10000 : 0
      });
      setNewUser({ username: '', password: '', email: '', role: 'audience', name: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
    }
  };

  return (
    <div className="space-y-8 pb-20 md:pb-0">
      <div>
        <h1 className="text-3xl font-headline font-bold text-on-surface">Manage Users</h1>
        <p className="text-on-surface-variant">Add users to the system</p>
      </div>

      <form onSubmit={handleAddUser} className="bg-surface-container border border-outline-variant rounded-3xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm text-on-surface-variant mb-1">Username</label>
            <input 
              required
              type="text" 
              value={newUser.username}
              onChange={e => setNewUser({...newUser, username: e.target.value})}
              className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2 text-on-surface focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-on-surface-variant mb-1">Password</label>
            <input 
              required
              type="text" 
              value={newUser.password}
              onChange={e => setNewUser({...newUser, password: e.target.value})}
              className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2 text-on-surface focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-on-surface-variant mb-1">Email</label>
            <input 
              type="email" 
              value={newUser.email}
              onChange={e => setNewUser({...newUser, email: e.target.value})}
              className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2 text-on-surface focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-on-surface-variant mb-1">Role</label>
            <select 
              value={newUser.role}
              onChange={e => setNewUser({...newUser, role: e.target.value})}
              className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2 text-on-surface focus:border-primary focus:outline-none"
            >
              <option value="audience">Audience (Voter)</option>
              <option value="team">Team (User)</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="w-full bg-primary text-on-primary px-6 py-2 rounded-xl font-bold flex items-center justify-center gap-2 h-[42px]">
              <UserPlus size={20} /> Add User
            </button>
          </div>
        </div>
      </form>

      <div className="bg-surface-container border border-outline-variant rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-variant text-on-surface-variant text-sm">
              <tr>
                <th className="p-4 font-medium">Username</th>
                <th className="p-4 font-medium">Password</th>
                <th className="p-4 font-medium">Email</th>
                <th className="p-4 font-medium">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-surface-variant/50 transition-colors">
                  <td className="p-4 font-bold text-on-surface">{user.username}</td>
                  <td className="p-4 font-mono text-sm">{user.password}</td>
                  <td className="p-4 text-on-surface-variant">{user.email || '-'}</td>
                  <td className="p-4 capitalize">{user.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
