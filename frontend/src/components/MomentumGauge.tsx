import React, { useEffect, useState } from 'react';

interface MomentumGaugeProps {
  score: number | null;
  category: string | null;
  size?: number;
}

function getColor(score: number | null): string {
  if (score === null) return '#64748b';
  if (score >= 2.0) return '#059669';
  if (score >= 1.0) return '#10B981';
  if (score >= -1.0) return '#FCD34D';
  if (score >= -2.0) return '#F59E0B';
  return '#DC2626';
}

function scoreToAngle(score: number): number {
  // Map -3..+3 to -150°..+150° (270° total arc)
  const clamped = Math.max(-3, Math.min(3, score));
  return (clamped / 3) * 150;
}

export default function MomentumGauge({ score, category, size = 200 }: MomentumGaugeProps) {
  const [animatedAngle, setAnimatedAngle] = useState(-150);
  const targetAngle = score !== null ? scoreToAngle(score) : -150;

  useEffect(() => {
    // Animate to target
    const timer = setTimeout(() => setAnimatedAngle(targetAngle), 100);
    return () => clearTimeout(timer);
  }, [targetAngle]);

  const cx = size / 2;
  const cy = (size * 0.65);
  const r = size * 0.38;
  const color = getColor(score);

  // Arc path helper
  const describeArc = (startAngle: number, endAngle: number, radius: number): string => {
    const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(toRad(startAngle));
    const y1 = cy + radius * Math.sin(toRad(startAngle));
    const x2 = cx + radius * Math.cos(toRad(endAngle));
    const y2 = cy + radius * Math.sin(toRad(endAngle));
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  // Needle
  const needleAngle = animatedAngle - 90; // offset for SVG coord system
  const needleRad = (needleAngle * Math.PI) / 180;
  const needleLength = r * 0.85;
  const nx = cx + needleLength * Math.cos(needleRad);
  const ny = cy + needleLength * Math.sin(needleRad);

  // Tick marks at -3, -2, -1, 0, 1, 2, 3
  const ticks = [-3, -2, -1, 0, 1, 2, 3];

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`}>
        {/* Background arc */}
        <path
          d={describeArc(-150, 150, r)}
          fill="none"
          stroke="#334155"
          strokeWidth={size * 0.06}
          strokeLinecap="round"
        />

        {/* Colored arc segments */}
        {[
          { start: -150, end: -90, color: '#DC2626' },
          { start: -90,  end: -30, color: '#F59E0B' },
          { start: -30,  end:  30, color: '#FCD34D' },
          { start:  30,  end:  90, color: '#10B981' },
          { start:  90,  end: 150, color: '#059669' },
        ].map(({ start, end, color: segColor }) => (
          <path
            key={start}
            d={describeArc(start, end, r)}
            fill="none"
            stroke={segColor}
            strokeWidth={size * 0.055}
            strokeLinecap="butt"
            opacity={0.4}
          />
        ))}

        {/* Active arc up to current score */}
        {score !== null && (
          <path
            d={describeArc(-150, targetAngle, r)}
            fill="none"
            stroke={color}
            strokeWidth={size * 0.06}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
          />
        )}

        {/* Tick marks */}
        {ticks.map((tick) => {
          const tickAngle = scoreToAngle(tick) - 90;
          const tickRad = (tickAngle * Math.PI) / 180;
          const outerR = r + size * 0.06;
          const innerR = r + size * 0.02;
          return (
            <line
              key={tick}
              x1={cx + outerR * Math.cos(tickRad)}
              y1={cy + outerR * Math.sin(tickRad)}
              x2={cx + innerR * Math.cos(tickRad)}
              y2={cy + innerR * Math.sin(tickRad)}
              stroke="#475569"
              strokeWidth={1.5}
            />
          );
        })}

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke={color}
          strokeWidth={size * 0.025}
          strokeLinecap="round"
          style={{ transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        />

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={size * 0.04} fill={color} />
        <circle cx={cx} cy={cy} r={size * 0.02} fill="#0f172a" />

        {/* Score text */}
        <text
          x={cx}
          y={cy - r * 0.25}
          textAnchor="middle"
          fill={color}
          fontSize={size * 0.14}
          fontWeight="700"
          fontFamily="JetBrains Mono, monospace"
        >
          {score !== null ? (score >= 0 ? `+${score.toFixed(2)}` : score.toFixed(2)) : '—'}
        </text>
      </svg>

      {/* Category label */}
      <div
        className="mt-1 px-3 py-1 rounded-full text-xs font-semibold"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {category || 'No Data'}
      </div>
    </div>
  );
}
