import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceDot,
} from 'recharts';
import { findSpeedExtremes } from '../../lib/trace-analysis';

const LAP_COLORS = [
  '#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#ec4899', '#06b6d4', '#84cc16',
];

export function LapComparisonChart({ traces, channel, title, yDomain, yFormatter, showSpeedAnnotations }) {
  if (!traces || traces.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-muted text-sm">
        Select laps to compare
      </div>
    );
  }

  const numBins = traces[0].trace?.length || 0;
  const data = [];

  for (let i = 0; i < numBins; i++) {
    const row = { dist: (i / numBins * 100).toFixed(1) };
    for (let t = 0; t < traces.length; t++) {
      const val = traces[t].trace?.[i]?.[channel];
      row[traces[t].label] = val !== undefined ? Math.round(val * 1000) / 1000 : null;
    }
    data.push(row);
  }

  const downsampled = data.filter((_, i) => i % 5 === 0);

  // Speed annotations
  let annotations = [];
  if (showSpeedAnnotations && channel === 'speed' && traces.length >= 1) {
    const extremes = findSpeedExtremes(traces[0].trace);
    annotations = [
      ...extremes.maxPoints.map((p) => ({
        x: p.pct,
        y: p.speed,
        label: `${(p.speed * 3.6).toFixed(0)}`,
        color: '#f59e0b',
      })),
      ...extremes.minPoints.map((p) => ({
        x: p.pct,
        y: p.speed,
        label: `${(p.speed * 3.6).toFixed(0)}`,
        color: '#ef4444',
      })),
    ];
  }

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-muted mb-2">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={downsampled} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-canvas-grid)" />
          <XAxis
            dataKey="dist"
            stroke="var(--color-muted)"
            tick={{ fontSize: 10 }}
            label={{ value: 'Track %', position: 'bottom', offset: -5, fill: 'var(--color-muted)', fontSize: 10 }}
          />
          <YAxis
            stroke="var(--color-muted)"
            tick={{ fontSize: 10 }}
            domain={yDomain || ['auto', 'auto']}
            tickFormatter={yFormatter}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface-overlay)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {traces.map((t, i) => (
            <Line
              key={t.label}
              type="monotone"
              dataKey={t.label}
              stroke={LAP_COLORS[i % LAP_COLORS.length]}
              dot={false}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          ))}
          {annotations.map((a, i) => (
            <ReferenceDot
              key={i}
              x={a.x}
              y={a.y}
              r={3}
              fill={a.color}
              stroke="none"
              label={{
                value: `${a.label} km/h`,
                position: 'top',
                fill: a.color,
                fontSize: 9,
              }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
