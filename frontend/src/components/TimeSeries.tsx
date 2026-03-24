import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TimeseriesPoint } from '../types';

interface TimeSeriesProps {
  data: TimeseriesPoint[];
  countryName?: string;
}

const PILLAR_COLORS: Record<string, string> = {
  momentum_score: '#38bdf8',
  fx_capital: '#a78bfa',
  domestic_demand: '#f472b6',
  industrial: '#fb923c',
  trade: '#34d399',
  labor: '#fbbf24',
  credit: '#60a5fa',
  market_sentiment: '#e879f9',
  inflation: '#f87171',
};

const PILLAR_LABELS: Record<string, string> = {
  momentum_score: 'Overall',
  fx_capital: 'FX & Capital',
  domestic_demand: 'Demand',
  industrial: 'Industrial',
  trade: 'Trade',
  labor: 'Labor',
  credit: 'Credit',
  market_sentiment: 'Sentiment',
  inflation: 'Inflation',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs shadow-xl min-w-[160px]">
        <div className="font-semibold text-slate-300 mb-2">{label}</div>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-3 mb-0.5">
            <span style={{ color: p.color }} className="text-xs">
              {PILLAR_LABELS[p.dataKey] || p.dataKey}
            </span>
            <span className="font-mono text-slate-200">
              {p.value !== null && p.value !== undefined
                ? (p.value >= 0 ? '+' : '') + p.value.toFixed(2)
                : '—'}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function TimeSeries({ data, countryName }: TimeSeriesProps) {
  const [showPillars, setShowPillars] = useState(false);

  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
  }));

  const pillars = [
    'fx_capital', 'domestic_demand', 'industrial', 'trade',
    'labor', 'credit', 'market_sentiment', 'inflation',
  ];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Momentum History — 12 Months
        </h3>
        <button
          onClick={() => setShowPillars((v) => !v)}
          className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
        >
          {showPillars ? 'Overall Only' : 'Show Pillars'}
        </button>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={formatted} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
          />
          <YAxis
            domain={[-3.5, 3.5]}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickCount={7}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 2" />
          <ReferenceLine y={1} stroke="#10B981" strokeDasharray="2 4" strokeOpacity={0.4} />
          <ReferenceLine y={-1} stroke="#F59E0B" strokeDasharray="2 4" strokeOpacity={0.4} />
          <ReferenceLine y={2} stroke="#059669" strokeDasharray="2 4" strokeOpacity={0.3} />
          <ReferenceLine y={-2} stroke="#DC2626" strokeDasharray="2 4" strokeOpacity={0.3} />

          {showPillars &&
            pillars.map((p) => (
              <Line
                key={p}
                type="monotone"
                dataKey={p}
                stroke={PILLAR_COLORS[p]}
                strokeWidth={1}
                dot={false}
                opacity={0.6}
                connectNulls
              />
            ))}

          <Line
            type="monotone"
            dataKey="momentum_score"
            stroke={PILLAR_COLORS['momentum_score']}
            strokeWidth={2.5}
            dot={{ r: 3, fill: PILLAR_COLORS['momentum_score'], strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
