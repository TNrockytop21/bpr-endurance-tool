import { useState } from 'react';
import { useSession } from '../../context/SessionContext';
import { useTheme } from '../../context/ThemeContext';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';

const NAV_ITEMS = [
  { path: '/', label: 'Live' },
  { path: '/fuel', label: 'Fuel' },
  { path: '/stints', label: 'Stints' },
  { path: '/standings', label: 'Standings' },
  { path: '/grid', label: 'Grid' },
  { path: '/compare', label: 'Compare' },
  { path: '/coaching', label: 'Coaching' },
];

export function Header() {
  const { connected, sessionInfo, drivers, teams, currentTeam, switchTeam } = useSession();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const driverCount = Object.values(drivers).filter((d) => d.connected).length;

  return (
    <>
      <header className="bg-surface-raised border-b border-border px-4 py-2 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-xs font-black">
              BPR
            </div>
            <div className="hidden sm:block">
              <span className="text-sm font-bold tracking-wide">Bite Point Racing</span>
              <span className="text-[10px] text-muted ml-1.5 uppercase tracking-widest">Endurance Tool</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'px-3 py-1.5 rounded text-sm transition-colors',
                  location.pathname === item.path
                    ? 'bg-surface-overlay font-medium'
                    : 'text-muted hover:opacity-100 hover:bg-surface-overlay/50'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-1 rounded hover:bg-surface-overlay"
            aria-label="Menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <path d="M3 12h18M3 6h18M3 18h18" />
              )}
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 text-xs">
          {/* Team switcher */}
          {teams.length > 1 && (
            <select
              value={currentTeam || ''}
              onChange={(e) => switchTeam(e.target.value)}
              className="bg-purple-500/20 border border-purple-500/40 text-purple-300 rounded px-2 py-1 text-xs font-semibold"
            >
              {teams.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
          {teams.length <= 1 && currentTeam && (
            <span className="text-purple-400 font-semibold hidden sm:inline">{currentTeam}</span>
          )}
          {sessionInfo?.trackName && (
            <span className="text-muted hidden sm:inline">{sessionInfo.trackName}</span>
          )}
          <span className="text-muted hidden sm:inline">
            {driverCount} driver{driverCount !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                connected ? 'bg-throttle' : 'bg-brake animate-pulse'
              )}
            />
            <span className={cn('hidden sm:inline', connected ? 'text-throttle' : 'text-brake')}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded hover:bg-surface-overlay transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Mobile nav overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-[41px] z-40 bg-surface/95 backdrop-blur-sm">
          <nav className="flex flex-col p-4 gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'px-4 py-3 rounded-lg text-base transition-colors',
                  location.pathname === item.path
                    ? 'bg-surface-overlay font-medium'
                    : 'text-muted hover:bg-surface-overlay/50'
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-4 pt-4 border-t border-border text-sm text-muted space-y-2 px-4">
              {sessionInfo?.trackName && <p>{sessionInfo.trackName}</p>}
              <p>{driverCount} driver{driverCount !== 1 ? 's' : ''}</p>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
