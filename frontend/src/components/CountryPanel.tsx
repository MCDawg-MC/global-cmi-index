import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { CountryMomentum, TimeseriesPoint } from '../types';
import MomentumGauge from './MomentumGauge';
import PillarChart from './PillarChart';
import TimeSeries from './TimeSeries';
import IndicatorTable from './IndicatorTable';
import clsx from 'clsx';

interface CountryPanelProps {
  momentum: CountryMomentum | null;
  timeseries: TimeseriesPoint[];
  loading: boolean;
  onClose: () => void;
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

function ChangeBadge({ label, value }: { label: string; value: number | null }) {
  if (value === null || value === undefined) return null;
  const positive = value >= 0;
  return (
    <div
      className={clsx(
        'flex flex-col items-center px-3 py-1.5 rounded-lg border text-xs',
        positive
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          : 'bg-red-500/10 border-red-500/30 text-red-400'
      )}
    >
      <span className="font-mono font-semibold">
        {positive ? '+' : ''}
        {value.toFixed(2)}
      </span>
      <span className="text-slate-500 text-xs">{label}</span>
    </div>
  );
}

export default function CountryPanel({ momentum, timeseries, loading, onClose }: CountryPanelProps) {
  const navigate = useNavigate();

  if (!momentum && !loading) return null;

  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
        {momentum ? (
          <div className="flex items-center gap-3">
            <span className="text-2xl">{FLAG_EMOJIS[momentum.country.code] || '🌐'}</span>
            <div>
              <div className="font-semibold text-slate-100">{momentum.country.name}</div>
              <div className="text-xs text-slate-500">
                {momentum.country.region}
                {momentum.country.global_rank != null &&
                  ` · Rank #${momentum.country.global_rank}`}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-8 w-40 bg-slate-800 rounded animate-pulse" />
        )}
        <div className="flex items-center gap-2">
          {momentum && (
            <button
              onClick={() => navigate(`/country/${momentum.country.code}`)}
              className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
            >
              Full View
            </button>
          )}
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            ×
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : momentum ? (
          <div className="p-4 space-y-6">
            {/* Gauge */}
            <div className="flex flex-col items-center">
              <MomentumGauge
                score={momentum.latest_score}
                category={momentum.momentum_category}
                size={180}
              />
            </div>

            {/* Changes */}
            {(momentum.changes['1m'] !== null ||
              momentum.changes['3m'] !== null ||
              momentum.changes['6m'] !== null) && (
              <div className="flex items-center justify-center gap-3">
                <ChangeBadge label="1 Month" value={momentum.changes['1m']} />
                <ChangeBadge label="3 Months" value={momentum.changes['3m']} />
                <ChangeBadge label="6 Months" value={momentum.changes['6m']} />
              </div>
            )}

            {/* Data completeness */}
            {momentum.country.data_completeness !== null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Data completeness</span>
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full"
                    style={{ width: `${(momentum.country.data_completeness * 100).toFixed(0)}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {(momentum.country.data_completeness * 100).toFixed(0)}%
                </span>
              </div>
            )}

            {/* Pillar chart */}
            <PillarChart pillars={momentum.pillars} />

            {/* Timeseries */}
            {timeseries.length > 0 && (
              <TimeSeries data={timeseries} countryName={momentum.country.name} />
            )}

            {/* Indicator table */}
            <IndicatorTable pillars={momentum.pillars} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
