import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { CountryMomentum, TimeseriesPoint } from '../types';
import { fetchCountryMomentum, fetchTimeseries } from '../api/client';
import MomentumGauge from '../components/MomentumGauge';
import PillarChart from '../components/PillarChart';
import TimeSeries from '../components/TimeSeries';
import IndicatorTable from '../components/IndicatorTable';
import clsx from 'clsx';

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
        'flex flex-col items-center px-4 py-2 rounded-xl border',
        positive
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          : 'bg-red-500/10 border-red-500/30 text-red-400'
      )}
    >
      <span className="font-mono text-lg font-bold">
        {positive ? '+' : ''}
        {value.toFixed(2)}
      </span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

export default function CountryDetail() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [momentum, setMomentum] = useState<CountryMomentum | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setError(null);
    Promise.all([fetchCountryMomentum(code.toUpperCase()), fetchTimeseries(code.toUpperCase())])
      .then(([m, ts]) => {
        setMomentum(m);
        setTimeseries(ts);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load data');
        setLoading(false);
      });
  }, [code]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <div className="h-12 w-64 bg-slate-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !momentum) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 text-center">
        <div className="text-red-400 mb-4">{error || 'Country not found'}</div>
        <button
          onClick={() => navigate('/')}
          className="text-sm text-sky-400 hover:text-sky-300 underline"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-600">
        <button onClick={() => navigate('/')} className="hover:text-slate-400 transition-colors">
          Dashboard
        </button>
        <span>/</span>
        <span className="text-slate-400">{momentum.country.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <span className="text-5xl">{FLAG_EMOJIS[momentum.country.code] || '🌐'}</span>
          <div>
            <h1 className="text-3xl font-bold text-slate-100">{momentum.country.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-slate-500">{momentum.country.region}</span>
              {momentum.country.global_rank !== null && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  Global Rank #{momentum.country.global_rank}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate('/')}
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          ← Back
        </button>
      </div>

      {/* Gauge + changes */}
      <div className="flex flex-col md:flex-row items-center gap-8 bg-slate-800/30 rounded-2xl p-6 border border-slate-800">
        <MomentumGauge
          score={momentum.latest_score}
          category={momentum.momentum_category}
          size={220}
        />
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-slate-300">Momentum Changes</h2>
          <div className="flex flex-wrap gap-3">
            <ChangeBadge label="1 Month" value={momentum.changes['1m']} />
            <ChangeBadge label="3 Months" value={momentum.changes['3m']} />
            <ChangeBadge label="6 Months" value={momentum.changes['6m']} />
          </div>
          {momentum.country.data_completeness !== null && (
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-500">Data completeness</span>
                <span className="text-xs text-slate-400 font-mono">
                  {(momentum.country.data_completeness * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-48 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all"
                  style={{ width: `${(momentum.country.data_completeness * 100).toFixed(0)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pillar chart + timeseries */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-800">
          <PillarChart pillars={momentum.pillars} />
        </div>
        <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-800">
          {timeseries.length > 0 ? (
            <TimeSeries data={timeseries} countryName={momentum.country.name} />
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
              No timeseries data available
            </div>
          )}
        </div>
      </div>

      {/* Indicator table */}
      <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-800">
        <IndicatorTable pillars={momentum.pillars} />
      </div>
    </div>
  );
}
