import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Users, LogOut, PlayCircle, Image as ImageIcon, Repeat, Shield } from 'lucide-react';
import clsx from 'clsx';

export const Layout = () => {
  const { appUser, logout } = useStore();
  const location = useLocation();

  if (!appUser) return <Outlet />;

  const isAdmin = appUser.role === 'admin';
  const isTeam = appUser.role === 'team';
  const isAudience = appUser.role === 'audience';

  const navItems = [
    ...(isAdmin ? [
      { path: '/admin/users', label: 'Users', icon: Users },
      { path: '/admin/round1', label: 'Round 1', icon: ImageIcon },
      { path: '/admin/round2', label: 'Round 2', icon: PlayCircle },
      { path: '/admin/transfer', label: 'Transfer', icon: Repeat },
      { path: '/admin/teams', label: 'Teams', icon: Shield },
    ] : []),
    ...(isTeam ? [
      { path: '/market', label: 'Market', icon: ImageIcon },
      { path: '/scenario', label: 'Scenario', icon: PlayCircle },
    ] : []),
    ...(isAudience ? [
      { path: '/voting', label: 'Voting', icon: PlayCircle },
    ] : []),
  ];

  return (
    <div className="flex h-screen bg-background text-on-surface overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-surface-container border-r border-outline-variant">
        <div className="p-6 border-b border-outline-variant">
          <h1 className="text-2xl font-headline font-bold text-primary neon-glow">Meme Market</h1>
          <p className="text-sm text-on-surface-variant mt-1">Role: <span className="capitalize">{appUser.role}</span></p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                  isActive 
                    ? "bg-primary text-on-primary font-medium shadow-[0_0_15px_rgba(242,253,104,0.2)]" 
                    : "text-on-surface hover:bg-surface-variant"
                )}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-outline-variant">
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-error hover:bg-error/10 transition-colors"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-surface-container border-b border-outline-variant z-10">
          <h1 className="text-xl font-headline font-bold text-primary neon-glow">Meme Market</h1>
          <button onClick={logout} className="text-error p-2 rounded-full hover:bg-error/10">
            <LogOut size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 radial-burst">
          <Outlet />
        </div>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden flex items-center justify-around p-3 bg-surface-container border-t border-outline-variant z-10 pb-safe">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  "flex flex-col items-center gap-1 p-2 rounded-lg min-w-[64px]",
                  isActive ? "text-primary" : "text-on-surface-variant"
                )}
              >
                <Icon size={24} className={isActive ? "drop-shadow-[0_0_8px_rgba(242,253,104,0.5)]" : ""} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
};
