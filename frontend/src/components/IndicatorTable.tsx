import React from 'react';
import type { PillarData, IndicatorData } from '../types';
import clsx from 'clsx';

interface IndicatorTableProps {
  pillars: PillarData[];
}

const PILLAR_LABELS: Record<string, string> = {
  fx_capital: 'FX & Capital',
  domestic_demand: 'Domestic Demand',
  industrial: 'Industrial',
  trade: 'Trade',
  labor: 'Labor',
  credit: 'Credit',
  market_sentiment: 'Market Sentiment',
  inflation: 'Inflation',
};

const INDICATOR_LABELS: Record<string, string> = {
  manufacturing_pmi: 'Manufacturing PMI',
  industrial_production_yoy: 'Industrial Production YoY',
  retail_sales_yoy: 'Retail Sales YoY',
  employment_change: 'Employment Change',
  wage_growth_yoy: 'Wage Growth YoY',
  core_cpi_yoy: 'Core CPI YoY',
  exports_yoy: 'Exports YoY',
  trade_balance_gdp: 'Trade Balance / GDP',
  corporate_credit_yoy: 'Corporate Credit YoY',
  fx_3mo_change: 'FX 3-Month Change',
  equity_3mo_return: 'Equity 3-Month Return',
  sovereign_spread_10y: '10Y Sovereign Spread',
};

function ScoreBadge({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-slate-600">—</span>;
  const color =
    value >= 1.5
      ? 'text-emerald-400'
      : value >= 0.5
      ? 'text-green-400'
      : value >= -0.5
      ? 'text-yellow-300'
      : value >= -1.5
      ? 'text-amber-400'
      : 'text-red-400';
  return (
    <span className={clsx('font-mono text-xs', color)}>
      {value >= 0 ? '+' : ''}
      {value.toFixed(2)}
    </span>
  );
}

export default function IndicatorTable({ pillars }: IndicatorTableProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const togglePillar = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Indicator Detail
      </h3>

      <div className="space-y-1">
        {pillars.map((pillar) => {
          const isOpen = expanded.has(pillar.name);
          const pillarColor =
            pillar.score === null
              ? '#64748b'
              : pillar.score >= 0
              ? '#10B981'
              : '#EF4444';

          return (
            <div key={pillar.name} className="rounded-lg overflow-hidden border border-slate-800">
              {/* Pillar header */}
              <button
                onClick={() => togglePillar(pillar.name)}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/60 hover:bg-slate-800 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: pillarColor }}
                  />
                  <span className="text-sm font-medium text-slate-300">
                    {PILLAR_LABELS[pillar.name] || pillar.name}
                  </span>
                  <span className="text-xs text-slate-600">
                    ({(pillar.weight * 100).toFixed(0)}%)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold" style={{ color: pillarColor }}>
                    {pillar.score !== null
                      ? (pillar.score >= 0 ? '+' : '') + pillar.score.toFixed(2)
                      : '—'}
                  </span>
                  <svg
                    className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Indicators */}
              {isOpen && (
                <div className="bg-slate-900/50">
                  <div className="grid grid-cols-6 gap-0 px-3 py-1.5 text-xs text-slate-600 border-b border-slate-800 font-medium">
                    <span className="col-span-2">Indicator</span>
                    <span className="text-right">Value</span>
                    <span className="text-right">Level</span>
                    <span className="text-right">Trend</span>
                    <span className="text-right">Momentum</span>
                  </div>
                  {pillar.indicators.map((ind) => (
                    <div
                      key={ind.name}
                      className="grid grid-cols-6 gap-0 px-3 py-1.5 text-xs border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition-colors"
                    >
                      <span className="col-span-2 text-slate-400">
                        {INDICATOR_LABELS[ind.name] || ind.name}
                      </span>
                      <span className="text-right font-mono text-slate-300">
                        {ind.value !== null && ind.value !== undefined
                          ? ind.value.toFixed(2)
                          : '—'}
                      </span>
                      <span className="text-right">
                        <ScoreBadge value={ind.level_score} />
                      </span>
                      <span className="text-right">
                        <ScoreBadge value={ind.trend_score} />
                      </span>
                      <span className="text-right">
                        <ScoreBadge value={ind.momentum} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
