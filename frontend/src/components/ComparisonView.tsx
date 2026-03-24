import React from 'react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { CompareCountryData } from '../types';

interface ComparisonViewProps {
  data: CompareCountryData[];
}

const COUNTRY_COLORS = ['#38bdf8', '#34d399', '#f472b6', '#fb923c'];

const PILLAR_LABELS: Record<string, string> = {
  fx_capital: 'FX & Capital',
  domestic_demand: 'Demand',
  industrial: 'Industrial',
  trade: 'Trade',
  labor: 'Labor',
  credit: 'Credit',
  market_sentiment: 'Sentiment',
  inflation: 'Inflation',
};

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

export default function ComparisonView({ data }: ComparisonViewProps) {
  if (!data.length) return null;

  const pillars = [
    'fx_capital', 'domestic_demand', 'industrial', 'trade',
    'labor', 'credit', 'market_sentiment', 'inflation',
  ];

  // Radar data
  const radarData = pillars.map((p) => {
    const entry: Record<string, any> = { subject: PILLAR_LABELS[p] };
    data.forEach((d, i) => {
      const pillar = d.pillars.find((pl) => pl.name === p);
      entry[d.country.code] = pillar?.score ?? 0;
    });
    return entry;
  });

  // Timeseries data — merge by date
  const allDates = new Set<string>();
  data.forEach((d) => d.timeseries.forEach((t) => allDates.add(t.date)));
  const sortedDates = Array.from(allDates).sort();

  const timeseriesData = sortedDates.map((date) => {
    const entry: Record<string, any> = {
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    };
    data.forEach((d) => {
      const point = d.timeseries.find((t) => t.date === date);
      entry[d.country.code] = point?.momentum_score ?? null;
    });
    return entry;
  });

  return (
    <div className="space-y-8">
      {/* Summary table */}
      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Summary Comparison
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-2 px-3 text-slate-500 font-medium">Country</th>
                <th className="text-right py-2 px-3 text-slate-500 font-medium">Score</th>
                <th className="text-right py-2 px-3 text-slate-500 font-medium">Category</th>
                {pillars.map((p) => (
                  <th key={p} className="text-right py-2 px-3 text-slate-500 font-medium text-xs">
                    {PILLAR_LABELS[p]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => {
                const color = COUNTRY_COLORS[i];
                const scoreColor = getMomentumColor(d.latest_score);
                return (
                  <tr
                    key={d.country.code}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span>{FLAG_EMOJIS[d.country.code]}</span>
                        <span className="text-slate-200 font-medium">{d.country.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="font-mono font-bold" style={{ color: scoreColor }}>
                        {d.latest_score !== null
                          ? (d.latest_score >= 0 ? '+' : '') + d.latest_score.toFixed(2)
                          : '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${scoreColor}20`, color: scoreColor }}
                      >
                        {d.country.momentum_category || '—'}
                      </span>
                    </td>
                    {pillars.map((p) => {
                      const pillar = d.pillars.find((pl) => pl.name === p);
                      const score = pillar?.score ?? null;
                      const sc = getMomentumColor(score);
                      return (
                        <td key={p} className="py-2.5 px-3 text-right">
                          <span className="font-mono text-xs" style={{ color: sc }}>
                            {score !== null ? (score >= 0 ? '+' : '') + score.toFixed(2) : '—'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Radar chart */}
      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Pillar Radar
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
            />
            <PolarRadiusAxis
              domain={[-3, 3]}
              tickCount={4}
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={false}
            />
            {data.map((d, i) => (
              <Radar
                key={d.country.code}
                name={d.country.name}
                dataKey={d.country.code}
                stroke={COUNTRY_COLORS[i]}
                fill={COUNTRY_COLORS[i]}
                fillOpacity={0.1}
                strokeWidth={2}
              />
            ))}
            <Legend
              wrapperStyle={{ color: '#94a3b8', fontSize: 12 }}
              formatter={(value: string) => (
                <span style={{ color: '#94a3b8' }}>{value}</span>
              )}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f1f5f9',
                fontSize: 12,
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Timeseries overlay */}
      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Momentum Timeseries
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={timeseriesData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
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
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: 12,
                color: '#f1f5f9',
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value: string) => (
                <span style={{ color: '#94a3b8' }}>
                  {FLAG_EMOJIS[value]} {data.find((d) => d.country.code === value)?.country.name || value}
                </span>
              )}
            />
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 2" />
            <ReferenceLine y={1} stroke="#10B981" strokeDasharray="2 4" strokeOpacity={0.3} />
            <ReferenceLine y={-1} stroke="#F59E0B" strokeDasharray="2 4" strokeOpacity={0.3} />
            {data.map((d, i) => (
              <Line
                key={d.country.code}
                type="monotone"
                dataKey={d.country.code}
                stroke={COUNTRY_COLORS[i]}
                strokeWidth={2}
                dot={{ r: 2.5, fill: COUNTRY_COLORS[i], strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
