import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import {
  Users, LogOut, PlayCircle, Image as ImageIcon, Repeat,
  Shield, TrendingUp, BarChart2, Vote,
} from 'lucide-react';
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
      { path: '/admin/users',    label: 'Users',    icon: Users       },
      { path: '/admin/round1',   label: 'Round 1',  icon: ImageIcon   },
      { path: '/admin/trade',    label: 'Trade',    icon: BarChart2   },
      { path: '/admin/round2',   label: 'Round 2',  icon: PlayCircle  },
      { path: '/admin/transfer', label: 'Transfer', icon: Repeat      },
      { path: '/admin/teams',    label: 'Teams',    icon: Shield      },
    ] : []),
    ...(isTeam ? [
      { path: '/market',   label: 'Market',   icon: ImageIcon  },
      { path: '/scenario', label: 'Scenario', icon: PlayCircle },
      { path: '/trade',    label: 'Trade',    icon: BarChart2  },
      { path: '/progress', label: 'Progress', icon: TrendingUp },
    ] : []),
    ...(isAudience ? [
      { path: '/voting', label: 'Voting', icon: Vote },
    ] : []),
  ];

  // Admin has 6 nav items → needs smaller text/icons on mobile
  const mobileCompact = navItems.length >= 5;

  return (
    <div className="flex h-screen bg-background text-on-surface overflow-hidden">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 bg-surface-container border-r border-outline-variant">
        <div className="p-6 border-b border-outline-variant">
          <h1 className="text-2xl font-headline font-bold text-primary neon-glow">Meme Market</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {appUser.name || appUser.username} ·{' '}
            <span className="capitalize">{appUser.role}</span>
          </p>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-primary text-on-primary font-medium shadow-[0_0_15px_rgba(242,253,104,0.2)]'
                    : 'text-on-surface hover:bg-surface-variant'
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

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-surface-container border-b border-outline-variant z-10 shrink-0">
          <div>
            <h1 className="text-lg font-headline font-bold text-primary neon-glow leading-none">Meme Market</h1>
            <p className="text-xs text-on-surface-variant capitalize">{appUser.name || appUser.username} · {appUser.role}</p>
          </div>
          {/* Show budget on mobile for team users */}
          {isTeam && appUser.budget !== undefined && (
            <div className="text-right mr-2">
              <p className="text-xs text-on-surface-variant">Budget</p>
              <p className="text-sm font-mono font-bold text-primary">${(appUser.budget || 0).toLocaleString()}</p>
            </div>
          )}
          <button onClick={logout} className="text-error p-2 rounded-xl hover:bg-error/10 transition-colors">
            <LogOut size={20} />
          </button>
        </header>

        {/* Scrollable content — padded so bottom content isn't hidden under nav */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 radial-burst pb-24 md:pb-8">
          <Outlet />
        </div>

        {/* ── Mobile Bottom Nav ── always visible, all items ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 flex items-stretch bg-surface-container border-t border-outline-variant z-20"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'flex flex-col items-center justify-center gap-0.5 flex-1 transition-all duration-150',
                  mobileCompact ? 'py-2' : 'py-3',
                  isActive
                    ? 'text-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                )}
              >
                <div className={clsx(
                  'rounded-xl transition-all duration-150 flex items-center justify-center',
                  mobileCompact ? 'w-8 h-6' : 'w-10 h-8',
                  isActive ? 'bg-primary/15' : ''
                )}>
                  <Icon
                    size={mobileCompact ? 18 : 22}
                    className={isActive ? 'drop-shadow-[0_0_6px_rgba(242,253,104,0.6)]' : ''}
                  />
                </div>
                <span className={clsx(
                  'font-medium leading-none',
                  mobileCompact ? 'text-[9px]' : 'text-[11px]'
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
};
