import React, { useState, useEffect } from 'react';
import type { CompareCountryData, Country } from '../types';
import { fetchCountries, fetchCompare } from '../api/client';
import ComparisonView from '../components/ComparisonView';

const ALL_COUNTRIES = [
  { code: 'USA', name: 'United States', flag: '🇺🇸' },
  { code: 'DEU', name: 'Germany', flag: '🇩🇪' },
  { code: 'GBR', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'JPN', name: 'Japan', flag: '🇯🇵' },
  { code: 'CHN', name: 'China', flag: '🇨🇳' },
  { code: 'CAN', name: 'Canada', flag: '🇨🇦' },
  { code: 'AUS', name: 'Australia', flag: '🇦🇺' },
  { code: 'KOR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'BRA', name: 'Brazil', flag: '🇧🇷' },
  { code: 'EUR', name: 'Euro Area', flag: '🇪🇺' },
];

const COUNTRY_COLORS = ['#38bdf8', '#34d399', '#f472b6', '#fb923c'];

export default function Compare() {
  const [selected, setSelected] = useState<string[]>(['USA', 'DEU', 'CHN']);
  const [compareData, setCompareData] = useState<CompareCountryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCountry = (code: string) => {
    setSelected((prev) => {
      if (prev.includes(code)) {
        return prev.filter((c) => c !== code);
      }
      if (prev.length >= 4) return prev; // max 4
      return [...prev, code];
    });
  };

  useEffect(() => {
    if (selected.length === 0) {
      setCompareData([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetchCompare(selected)
      .then((data) => {
        setCompareData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load comparison');
        setLoading(false);
      });
  }, [selected.join(',')]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Compare Economies</h1>
        <p className="text-slate-500 text-sm mt-1">
          Select up to 4 countries to compare momentum scores, pillar breakdown, and trends.
        </p>
      </div>

      {/* Country selector */}
      <div className="bg-slate-800/30 rounded-2xl p-5 border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Select Countries
          </h2>
          <span className="text-xs text-slate-600">{selected.length}/4 selected</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_COUNTRIES.map((c, i) => {
            const isSelected = selected.includes(c.code);
            const colorIdx = selected.indexOf(c.code);
            const color = colorIdx >= 0 ? COUNTRY_COLORS[colorIdx] : undefined;
            const disabled = !isSelected && selected.length >= 4;

            return (
              <button
                key={c.code}
                onClick={() => toggleCountry(c.code)}
                disabled={disabled}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                  isSelected
                    ? 'border-current'
                    : disabled
                    ? 'border-slate-800 bg-slate-900/50 text-slate-700 cursor-not-allowed'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
                style={isSelected && color ? { borderColor: color, color, backgroundColor: `${color}15` } : {}}
              >
                <span>{c.flag}</span>
                <span className="font-medium">{c.name}</span>
                {isSelected && (
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-500 text-sm">Loading comparison data...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* No selection */}
      {!loading && selected.length === 0 && (
        <div className="text-center py-12 text-slate-600">
          Select at least one country to see comparison
        </div>
      )}

      {/* Comparison */}
      {!loading && compareData.length > 0 && (
        <div className="bg-slate-800/20 rounded-2xl p-6 border border-slate-800">
          <ComparisonView data={compareData} />
        </div>
      )}
    </div>
  );
}
