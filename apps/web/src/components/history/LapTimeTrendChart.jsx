import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Dot,
} from 'recharts';
import { useSession } from '../../context/SessionContext';
import { formatLapTime } from '../../lib/utils';

function CustomDot(props) {
  const { cx, cy, payload } = props;
  if (!payload.valid) {
    return <Dot cx={cx} cy={cy} r={3} fill="#6b7280" opacity={0.5} />;
  }
  return <Dot cx={cx} cy={cy} r={3} fill="#8b5cf6" />;
}

export function LapTimeTrendChart({ driverId, laps: lapsProp, bestLapTime: bestLapTimeProp }) {
  const { drivers } = useSession();
  const sessionDriver = drivers[driverId];
  const laps = lapsProp ?? sessionDriver?.laps ?? [];
  const bestLapTime = bestLapTimeProp ?? sessionDriver?.bestLapTime ?? null;

  if (laps.length < 2) return null;

  const data = laps.map((l) => ({
    lap: l.lapNumber,
    time: l.lapTime,
    valid: l.valid,
  }));

  const validTimes = laps.filter((l) => l.valid).map((l) => l.lapTime);
  const minTime = Math.min(...validTimes);
  const maxTime = Math.max(...validTimes);
  const padding = (maxTime - minTime) * 0.1 || 2;

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-muted mb-2">Lap Times</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-canvas-grid)" />
          <XAxis
            dataKey="lap"
            stroke="var(--color-muted)"
            tick={{ fontSize: 10 }}
            label={{ value: 'Lap', position: 'bottom', offset: -5, fill: 'var(--color-muted)', fontSize: 10 }}
          />
          <YAxis
            stroke="var(--color-muted)"
            tick={{ fontSize: 10 }}
            domain={[minTime - padding, maxTime + padding]}
            tickFormatter={(v) => formatLapTime(v)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface-overlay)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(value) => [formatLapTime(value), 'Lap Time']}
          />
          {bestLapTime && (
            <ReferenceLine
              y={bestLapTime}
              stroke="#8b5cf6"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}
          <Line
            type="monotone"
            dataKey="time"
            stroke="#8b5cf6"
            strokeWidth={1.5}
            dot={<CustomDot />}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
