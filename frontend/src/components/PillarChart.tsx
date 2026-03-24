import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import type { PillarData } from '../types';

interface PillarChartProps {
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

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
        <div className="font-semibold text-slate-200 mb-1">{d.label}</div>
        <div className="text-slate-400">
          Score: <span className="text-slate-200 font-mono">{d.score !== null ? d.score.toFixed(3) : 'N/A'}</span>
        </div>
        <div className="text-slate-400">
          Weight: <span className="text-slate-200">{(d.weight * 100).toFixed(0)}%</span>
        </div>
        <div className="text-slate-400">
          Contribution:{' '}
          <span className="text-slate-200 font-mono">
            {d.contribution !== null ? d.contribution.toFixed(3) : 'N/A'}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export default function PillarChart({ pillars }: PillarChartProps) {
  const data = pillars.map((p) => ({
    name: p.name,
    label: PILLAR_LABELS[p.name] || p.name,
    score: p.score,
    weight: p.weight,
    contribution: p.contribution,
    fill: p.score === null ? '#475569' : p.score >= 0 ? '#10B981' : '#EF4444',
  }));

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Pillar Breakdown
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
          <XAxis
            type="number"
            domain={[-3, 3]}
            tickCount={7}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={{ stroke: '#334155' }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <ReferenceLine x={0} stroke="#475569" strokeWidth={1.5} />
          <Bar dataKey="score" radius={[0, 3, 3, 0]} barSize={14}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Contribution table */}
      <div className="mt-3 grid grid-cols-2 gap-1">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between px-2 py-1 rounded bg-slate-800/50 text-xs">
            <span className="text-slate-400 truncate">{d.label}</span>
            <span
              className="font-mono font-semibold ml-2 flex-shrink-0"
              style={{ color: d.fill }}
            >
              {d.score !== null ? (d.score >= 0 ? '+' : '') + d.score.toFixed(2) : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
