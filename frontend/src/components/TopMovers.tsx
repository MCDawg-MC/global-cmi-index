import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Country } from '../types';
import clsx from 'clsx';

interface TopMoversProps {
  countries: Country[];
  onSelect: (code: string) => void;
  selectedCode: string | null;
}

const FLAG_EMOJIS: Record<string, string> = {
  USA: '🇺🇸',
  DEU: '🇩🇪',
  GBR: '🇬🇧',
  JPN: '🇯🇵',
  CHN: '🇨🇳',
  CAN: '🇨🇦',
  AUS: '🇦🇺',
  KOR: '🇰🇷',
  BRA: '🇧🇷',
  EUR: '🇪🇺',
};

function getMomentumColor(score: number | null): string {
  if (score === null) return '#64748b';
  if (score >= 2.0) return '#059669';
  if (score >= 1.0) return '#10B981';
  if (score >= -1.0) return '#FCD34D';
  if (score >= -2.0) return '#F59E0B';
  return '#DC2626';
}

function ChangeArrow({ change }: { change: number | null }) {
  if (change === null || change === undefined) return <span className="text-slate-600 text-xs">—</span>;
  if (change > 0)
    return <span className="text-emerald-400 text-xs">+{change.toFixed(2)}</span>;
  if (change < 0)
    return <span className="text-red-400 text-xs">{change.toFixed(2)}</span>;
  return <span className="text-slate-500 text-xs">0.00</span>;
}

export default function TopMovers({ countries, onSelect, selectedCode }: TopMoversProps) {
  const navigate = useNavigate();

  // Sort by momentum score descending
  const sorted = [...countries].sort(
    (a, b) => (b.momentum_score ?? -99) - (a.momentum_score ?? -99)
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Rankings
        </h2>
        <span className="text-xs text-slate-600">{countries.length} economies</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {sorted.map((country) => {
          const color = getMomentumColor(country.momentum_score);
          const isSelected = country.code === selectedCode;

          return (
            <div
              key={country.code}
              onClick={() => onSelect(country.code)}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all border',
                isSelected
                  ? 'bg-slate-700/60 border-slate-600'
                  : 'bg-slate-800/40 border-transparent hover:bg-slate-800/70 hover:border-slate-700'
              )}
            >
              {/* Rank */}
              <span className="text-xs text-slate-600 w-4 flex-shrink-0 font-mono">
                {country.global_rank ?? '—'}
              </span>

              {/* Flag */}
              <span className="text-lg leading-none flex-shrink-0">
                {FLAG_EMOJIS[country.code] || '🌐'}
              </span>

              {/* Name + Region */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-200 truncate">{country.name}</div>
                <div className="text-xs text-slate-600 truncate">{country.region}</div>
              </div>

              {/* Score */}
              <div className="flex flex-col items-end flex-shrink-0">
                <span className="font-mono text-sm font-bold" style={{ color }}>
                  {country.momentum_score !== null
                    ? (country.momentum_score >= 0 ? '+' : '') +
                      country.momentum_score.toFixed(2)
                    : '—'}
                </span>
                <ChangeArrow change={country.momentum_change_1m} />
              </div>

              {/* Score bar */}
              <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden flex-shrink-0">
                {country.momentum_score !== null && (
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, ((country.momentum_score + 3) / 6) * 100))}%`,
                      backgroundColor: color,
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
