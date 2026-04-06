import { formatLapTime } from '../../lib/utils';
import { cn } from '../../lib/utils';

export function LapTable({ driverId, laps, bestLapTime, onSelectLap, selectedLaps = [] }) {
  if (!laps || laps.length === 0) {
    return <p className="text-muted text-sm">No laps completed yet</p>;
  }

  return (
    <div className="overflow-auto max-h-80">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted text-xs uppercase border-b border-border">
            {onSelectLap && <th className="py-2 px-2 text-left w-8" />}
            <th className="py-2 px-2 text-left">Lap</th>
            <th className="py-2 px-2 text-left">Time</th>
            <th className="py-2 px-2 text-left">Fuel Used</th>
            <th className="py-2 px-2 text-left">Valid</th>
          </tr>
        </thead>
        <tbody>
          {laps.map((lap) => {
            const isBest = lap.lapTime === bestLapTime && lap.valid;
            const isSelected = selectedLaps.includes(lap.lapNumber);
            return (
              <tr
                key={lap.lapNumber}
                className={cn(
                  'border-b border-border/50 hover:bg-surface-overlay/30 cursor-pointer transition-colors',
                  isBest && 'text-purple-400',
                  isSelected && 'bg-surface-overlay/50'
                )}
                onClick={() => onSelectLap?.(lap.lapNumber)}
              >
                {onSelectLap && (
                  <td className="py-1.5 px-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="accent-purple-500"
                    />
                  </td>
                )}
                <td className="py-1.5 px-2 font-mono">{lap.lapNumber}</td>
                <td className="py-1.5 px-2 font-mono">{formatLapTime(lap.lapTime)}</td>
                <td className="py-1.5 px-2 font-mono">{lap.fuelUsed?.toFixed(2)}L</td>
                <td className="py-1.5 px-2">
                  {lap.valid ? (
                    <span className="text-throttle">Yes</span>
                  ) : (
                    <span className="text-muted">No</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
