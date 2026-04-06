import { useSession } from '../../context/SessionContext';

function cvToColor(cv) {
  // Green (consistent) to yellow to red (inconsistent)
  if (cv < 0.02) return '#22c55e';
  if (cv < 0.04) return '#84cc16';
  if (cv < 0.06) return '#f59e0b';
  if (cv < 0.08) return '#ef4444';
  return '#dc2626';
}

export function ConsistencyHeatmap({ varianceData, width = 250, height = 180 }) {
  const { trackShape } = useSession();

  if (!trackShape || !varianceData || varianceData.length === 0) return null;

  const padding = 15;
  const pw = width - 2 * padding;
  const ph = height - 2 * padding;

  // Map variance bins to track points
  const segments = [];
  const step = Math.max(1, Math.floor(varianceData.length / trackShape.length));

  for (let i = 0; i < trackShape.length - 1; i++) {
    const p0 = trackShape[i];
    const p1 = trackShape[i + 1];
    const varIdx = Math.min(i * step, varianceData.length - 1);
    const cv = varianceData[varIdx]?.cv || 0;

    segments.push({
      x1: padding + p0.x * pw,
      y1: padding + p0.y * ph,
      x2: padding + p1.x * pw,
      y2: padding + p1.y * ph,
      color: cvToColor(cv),
    });
  }

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-3">
      <h3 className="text-xs text-muted uppercase font-semibold mb-2">Consistency</h3>
      <svg width={width} height={height} className="mx-auto">
        {segments.map((seg, i) => (
          <line
            key={i}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke={seg.color}
            strokeWidth="6"
            strokeLinecap="round"
          />
        ))}
      </svg>
      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-2 text-[10px] text-muted">
        <div className="flex items-center gap-0.5">
          <div className="w-3 h-2 rounded-sm bg-throttle" />
          <span>Consistent</span>
        </div>
        <div className="flex items-center gap-0.5">
          <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: '#f59e0b' }} />
          <span>Variable</span>
        </div>
        <div className="flex items-center gap-0.5">
          <div className="w-3 h-2 rounded-sm bg-brake" />
          <span>Inconsistent</span>
        </div>
      </div>
    </div>
  );
}
