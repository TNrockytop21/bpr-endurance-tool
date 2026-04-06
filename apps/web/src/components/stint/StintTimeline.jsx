import { useSession } from '../../context/SessionContext';
import { formatLapTime } from '../../lib/utils';

const STINT_COLORS = [
  '#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#ec4899', '#06b6d4', '#84cc16',
];

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const hours = Math.floor(mins / 60);
  if (hours > 0) return `${hours}h${mins % 60}m`;
  return `${mins}m`;
}

export function StintTimeline() {
  const { stints, activeDriverId, drivers } = useSession();
  const activeDriver = activeDriverId ? drivers[activeDriverId] : null;

  // Include current stint if a driver is active
  const allStints = [...stints];
  if (activeDriver?.connected) {
    const currentStintLaps = (activeDriver.laps || []).length;
    allStints.push({
      id: 'current',
      driverName: activeDriver.name,
      car: activeDriver.car,
      startTime: Date.now() - (currentStintLaps * 90 * 1000), // approximate
      endTime: Date.now(),
      lapCount: currentStintLaps,
      avgLapTime: null,
      bestLapTime: activeDriver.bestLapTime,
      active: true,
    });
  }

  if (allStints.length === 0) return null;

  const totalDuration = allStints.reduce((s, st) => s + (st.endTime - st.startTime), 0) || 1;

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-muted mb-3">Driver Stints</h3>

      {/* Timeline bar */}
      <div className="flex rounded-full overflow-hidden h-6 mb-3">
        {allStints.map((stint, i) => {
          const pct = ((stint.endTime - stint.startTime) / totalDuration) * 100;
          return (
            <div
              key={stint.id}
              className="flex items-center justify-center text-[10px] font-semibold text-white truncate px-1"
              style={{
                width: `${Math.max(pct, 5)}%`,
                backgroundColor: STINT_COLORS[i % STINT_COLORS.length],
                opacity: stint.active ? 1 : 0.7,
              }}
            >
              {stint.driverName}
            </div>
          );
        })}
      </div>

      {/* Stint details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {allStints.map((stint, i) => (
          <div
            key={stint.id}
            className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-surface-overlay/30"
          >
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: STINT_COLORS[i % STINT_COLORS.length] }}
            />
            <div className="min-w-0">
              <span className="font-semibold">{stint.driverName}</span>
              <span className="text-muted ml-2">
                {stint.lapCount} laps
                {stint.active && ' (live)'}
              </span>
              {stint.avgLapTime && (
                <span className="text-muted ml-1">avg {formatLapTime(stint.avgLapTime)}</span>
              )}
              {stint.bestLapTime && (
                <span className="text-purple-400 ml-1">best {formatLapTime(stint.bestLapTime)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
