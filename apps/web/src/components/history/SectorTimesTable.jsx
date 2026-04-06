import { useSession } from '../../context/SessionContext';
import { cn } from '../../lib/utils';

function formatSector(seconds) {
  if (!seconds || seconds <= 0) return '--.-';
  return seconds.toFixed(1);
}

export function SectorTimesTable({ driverId }) {
  const { drivers } = useSession();
  const driver = drivers[driverId];
  if (!driver) return null;

  const laps = (driver.laps || []).filter((l) => l.sectors);
  const bestSectors = driver.bestSectors || [null, null, null];

  if (laps.length === 0) return null;

  const idealLap = bestSectors.every((s) => s !== null)
    ? bestSectors.reduce((a, b) => a + b, 0)
    : null;

  return (
    <div className="bg-surface-raised border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-muted">Sector Times</h3>
        {idealLap && (
          <span className="text-xs font-mono text-yellow-400">
            Ideal: {idealLap.toFixed(3)}s
            ({bestSectors.map((s) => formatSector(s)).join(' + ')})
          </span>
        )}
      </div>
      <div className="overflow-x-auto max-h-48">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-xs uppercase border-b border-border">
              <th className="py-1.5 px-2 text-left">Lap</th>
              <th className="py-1.5 px-2 text-right">S1</th>
              <th className="py-1.5 px-2 text-right">S2</th>
              <th className="py-1.5 px-2 text-right">S3</th>
              <th className="py-1.5 px-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {laps.slice(-10).reverse().map((lap) => (
              <tr key={lap.lapNumber} className="border-b border-border/30">
                <td className="py-1 px-2 font-mono text-muted">{lap.lapNumber}</td>
                {lap.sectors.map((s, i) => (
                  <td
                    key={i}
                    className={cn(
                      'py-1 px-2 text-right font-mono',
                      bestSectors[i] !== null && Math.abs(s - bestSectors[i]) < 0.05
                        ? 'text-purple-400 font-semibold'
                        : ''
                    )}
                  >
                    {formatSector(s)}
                  </td>
                ))}
                <td className="py-1 px-2 text-right font-mono">
                  {lap.lapTime?.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
