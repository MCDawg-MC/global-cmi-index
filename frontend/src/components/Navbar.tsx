import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { triggerDataUpdate } from '../api/client';

export default function Navbar() {
  const location = useLocation();
  const { lastUpdated } = useStore();
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await triggerDataUpdate();
      setTimeout(() => setRefreshing(false), 2000);
    } catch {
      setRefreshing(false);
    }
  };

  const navLink = (to: string, label: string) => {
    const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
    return (
      <Link
        to={to}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          active
            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800">
      <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center">
            <span className="text-white font-bold text-xs">M</span>
          </div>
          <span className="font-semibold text-slate-100 tracking-wide text-sm uppercase">
            Macro Momentum Index
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-2">
          {navLink('/', 'Dashboard')}
          {navLink('/compare', 'Compare')}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-xs text-slate-500 hidden md:block">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-50 border border-slate-700"
          >
            {refreshing ? (
              <span className="flex items-center gap-1.5">
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
                </svg>
                Refreshing...
              </span>
            ) : (
              'Refresh Data'
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}
