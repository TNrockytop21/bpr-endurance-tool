import { useSession } from '../../context/SessionContext';
import { formatLapTime, cn } from '../../lib/utils';

export function LapSelector({ selectedDriver, onSelectDriver, selectedLaps, onToggleLap }) {
  const { drivers } = useSession();
  const driverList = Object.values(drivers);

  const driver = selectedDriver ? drivers[selectedDriver] : null;
  const laps = driver?.laps || [];

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
      {/* Driver selector */}
      <div className="w-full sm:w-48 shrink-0">
        <label className="text-xs text-muted uppercase mb-1 block">Driver</label>
        <select
          value={selectedDriver || ''}
          onChange={(e) => onSelectDriver(e.target.value || null)}
          className="w-full bg-surface-overlay border border-border rounded px-2 py-1.5 text-sm text-white"
        >
          <option value="">Select driver...</option>
          {driverList.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Lap pills */}
      {driver && laps.length > 0 && (
        <div className="flex-1 min-w-0">
          <label className="text-xs text-muted uppercase mb-1 block">
            Select laps to compare ({selectedLaps.length} selected)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {laps.map((lap) => {
              const isSelected = selectedLaps.includes(lap.lapNumber);
              return (
                <button
                  key={lap.lapNumber}
                  onClick={() => onToggleLap(lap.lapNumber)}
                  className={cn(
                    'px-2 py-1 rounded text-xs font-mono border transition-colors',
                    isSelected
                      ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                      : 'bg-surface-overlay border-border text-muted hover:text-white hover:border-white/30',
                    !lap.valid && 'opacity-50'
                  )}
                >
                  L{lap.lapNumber}
                  <span className="ml-1 text-[10px]">{formatLapTime(lap.lapTime)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
